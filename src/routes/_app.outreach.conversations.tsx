import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  Inbox as InboxIcon,
  Search,
  Sparkles,
  Send,
  Clock,
  CheckCheck,
  Repeat,
  Star,
  MoreHorizontal,
  Tag,
  UserPlus,
  ChevronRight,
  Building2,
  UserRound,
  Eye,
  MailOpen,
  MousePointerClick,
  Loader2,
  RefreshCw,
  MessageCircleReply,
  Mail,
  MessageSquare,
  MessageCircle,
  Facebook,
  Music2,
  Send as SendIcon,
  AlertTriangle,
  UserCheck,

  Zap,
  Pin,
  Hand,
  ChevronDown as ChevronDownIcon,
  User as UserIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format-date";
import {
  useThreads,
  useInboxCounts,
  markThreadRead,
  snoozeThread,
  closeThread,
  reopenThread,
  toggleStar,
  addTag,
  sendReply,
  SNOOZE_PRESETS,
  type Thread,
  type Channel,
  CHANNEL_LABEL,
  CHANNEL_COLOR,
  WINDOW_HOURS,
  TEAM_MEMBERS,
  memberById,
  updateThreadProfile,
  addThreadNote,
  removeThreadNote,
} from "@/lib/inbox-store";
import { generateAiContent } from "@/lib/api/ai-compose.functions";
import { translateMessage } from "@/lib/api/ai-translate.functions";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { IntelPanel } from "@/components/outreach/IntelPanel";
import { scoreIntent } from "@/lib/ai-intent-score";
import { Target as TargetIcon, PanelRightClose, PanelRightOpen, Languages, Pencil } from "lucide-react";
import {
  detectThreadLanguage,
  detectLanguage,
  langByCode,
  LANGUAGES,
} from "@/lib/lang-detect";
import { getTargetReason } from "@/lib/target-reason";
import { resolveThreadProfile } from "@/lib/thread-profile";




import {
  useThreadSenderResolver,
  useSenderOptions,
} from "@/lib/thread-sender";

const searchSchema = z.object({
  view: z
    .enum([
      "unread",
      "pending",
      "waiting",
      "all",
      "hasReply",
      "noReply",
      "won",
      "lost",
      "snoozed",
      "suppressed",
      "high_intent",
      "needs_human",
    ])
    .optional(),
  ch: z
    .enum(["all", "email", "sms", "whatsapp", "telegram", "facebook", "tiktok"])
    .optional(),
  /** 发信账号（我方身份）过滤，值为 ThreadSender.key */
  sender: z.string().optional(),
  tid: z.string().optional(),
  q: z.string().optional(),
  /** 意向档位过滤：高/中/低/全部（左侧列表顶部 Tab） */
  intent: z.enum(["all", "high", "mid", "low"]).optional(),
  /** 加星过滤 */
  starred: z.enum(["all", "starred", "unstarred"]).optional(),
  /** 好友关系过滤（社媒渠道）：全部 / 对方待通过 / 对方已通过 / 对方已解除 */
  friend: z.enum(["all", "pending", "accepted", "removed"]).optional(),
  // 从"最新沟通"胶囊中的"AI 回复"进入时，自动生成一条 AI 草稿。
  action: z.enum(["ai"]).optional(),
});

function channelIcon(ch: Channel) {
  switch (ch) {
    case "email":
      return Mail;
    case "sms":
      return MessageSquare;
    case "whatsapp":
      return MessageCircle;
    case "telegram":
      return SendIcon;
    case "facebook":
      return Facebook;
    case "tiktok":
      return Music2;
  }
}

function channelTooltip(ch: Channel) {
  if (ch === "email") return "邮箱";
  if (ch === "sms") return "短信";
  return CHANNEL_LABEL[ch];
}


type ViewKey = NonNullable<z.infer<typeof searchSchema>["view"]>;

const VIEW_LABEL: Record<ViewKey, string> = {
  unread: "未读",
  pending: "待我回复",
  waiting: "等客回复",
  snoozed: "稍后处理",
  won: "已成交",
  lost: "已流失",
  suppressed: "已退订",
  hasReply: "有回复",
  noReply: "未回复",
  all: "全部",
  high_intent: "高意向",
  needs_human: "人工接管",
};
function viewLabel(v: ViewKey) {
  return VIEW_LABEL[v] ?? "全部";
}

export const Route = createFileRoute("/_app/outreach/conversations")({
  head: () => ({
    meta: [{ title: "触达会话 | 出海大数据平台" }],
  }),
  validateSearch: (s) => searchSchema.parse(s),
  component: InboxPage,
});

function InboxPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const threads = useThreads();
  const counts = useInboxCounts();
  // 按标签维度的计数（用于中栏顶部的标签筛选条）
  const intentCounts = useMemo(() => {
    let high = 0;
    let needsHuman = 0;
    let mid = 0;
    let low = 0;
    for (const t of threads) {
      const band = scoreIntent(t).band;
      if (band === "high") high++;
      else if (band === "mid") mid++;
      else low++;
      if (
        !t.meta.humanTakeover &&
        (t.meta.aiIntent === "complaint" || t.meta.aiIntent === "unsubscribe")
      ) {
        needsHuman++;
      }
    }
    return { high, mid, low, needsHuman };
  }, [threads]);
  // 从企业/联系人详情等入口带 tid 直接进入时，默认使用 “全部” 视图，
  // 避免出现「右侧展示了会话，中间列表却提示"该视图下暂无会话"」的错位。
  const view: ViewKey = search.view ?? "all";
  const intent = search.intent ?? "all";
  const starred = search.starred ?? "all";
  const friend = search.friend ?? "all";
  const [scorePanelOpen, setScorePanelOpen] = useState(true);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const q = search.q ?? "";
  const ch = search.ch ?? "all";

  const senderKey = search.sender ?? "all";
  const resolveSender = useThreadSenderResolver();
  const senderOptions = useSenderOptions(threads);

  const filtered = useMemo(() => {
    let list = threads;
    if (ch !== "all") list = list.filter((t) => t.channel === ch);
    if (senderKey !== "all")
      list = list.filter((t) => resolveSender(t).key === senderKey);
    if (starred !== "all")
      list = list.filter((t) => (starred === "starred" ? t.meta.starred : !t.meta.starred));
    if (intent !== "all")
      list = list.filter((t) => scoreIntent(t).band === intent);
    if (friend !== "all") {
      list = list.filter((t) => {
        if (friend === "pending") return Boolean(t.friendPending);
        if (friend === "removed") return Boolean(t.friendRemoved);
        // accepted：好友申请已通过且未被解除
        return Boolean(t.isFriend) && !t.friendPending && !t.friendRemoved;
      });
    }
    if (view === "unread") list = list.filter((t) => t.meta.unread > 0);
    else if (view === "pending")
      list = list.filter((t) => t.meta.status === "pending");
    else if (view === "hasReply")
      list = list.filter((t) => t.meta.inboundMessages.length > 0);
    else if (view === "noReply")
      list = list.filter((t) => t.meta.inboundMessages.length === 0);
    else if (view === "won")
      list = list.filter((t) => t.meta.status === "won");
    else if (view === "lost")
      list = list.filter((t) => t.meta.status === "lost");
    else if (view === "waiting")
      list = list.filter((t) => t.meta.status === "waiting_reply");
    else if (view === "snoozed")
      list = list.filter((t) => t.meta.status === "snoozed");
    else if (view === "suppressed")
      list = list.filter((t) => t.meta.status === "suppressed");
    else if (view === "high_intent")
      list = list.filter((t) => scoreIntent(t).band === "high");
    else if (view === "needs_human")
      list = list.filter(
        (t) =>
          !t.meta.humanTakeover &&
          (t.meta.aiIntent === "complaint" || t.meta.aiIntent === "unsubscribe"),
      );
    if (q.trim()) {
      const kw = q.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.targetName.toLowerCase().includes(kw) ||
          t.counterpartyAddress.toLowerCase().includes(kw) ||
          t.messages.some(
            (m) =>
              m.subject?.toLowerCase().includes(kw) ||
              m.content.toLowerCase().includes(kw),
          ),
      );
    }
    return list;
  }, [threads, view, q, ch, intent, starred, friend, senderKey, resolveSender]);

  const currentId = search.tid ?? filtered[0]?.id;
  const current = threads.find((t) => t.id === currentId);

  // 保险：如果通过 tid 打开的会话不在当前筛选视图内，则把它并入中栏列表，
  // 保持右侧详情与左侧列表的一致性。
  const displayList = useMemo(() => {
    if (current && !filtered.some((t) => t.id === current.id)) {
      return [current, ...filtered];
    }
    return filtered;
  }, [filtered, current]);

  // 打开会话即标记已读
  useEffect(() => {
    if (current && current.meta.unread > 0) markThreadRead(current.id);
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function goto(patch: Partial<z.infer<typeof searchSchema>>) {
    navigate({
      to: "/outreach/conversations",
      search: { ...search, ...patch },
      replace: true,
    });
  }

  if (!mounted) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        加载会话数据中…
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* 顶栏 */}
      <div className="h-12 px-4 border-b flex items-center gap-2 shrink-0">
        <InboxIcon className="h-4 w-4 text-primary shrink-0" />
        <div className="font-semibold text-sm shrink-0">
          触达会话
          <span className="ml-1 text-muted-foreground font-normal">({counts.all})</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-[11px] text-muted-foreground">
          {counts.unread > 0 && (
            <>
              <span className="text-border">|</span>
              <button
                onClick={() => goto({ view: "unread", tid: undefined })}
                className={cn(
                  "inline-flex items-center gap-1 transition-colors hover:text-rose-700",
                  view === "unread" ? "text-rose-700 font-medium" : "",
                )}
                title="点击查看未读会话"
              >
                未读 <span className="tabular-nums">{counts.unread}</span>
              </button>
            </>
          )}
        </div>
        {/* 统一筛选面板：渠道 / 类型 / 搜索 */}
        <div className="ml-2 flex items-center gap-1.5 shrink-0">
          <Select value={ch} onValueChange={(v) => goto({ ch: v as typeof ch, tid: undefined })}>
            <SelectTrigger className="h-8 text-xs w-[128px]">
              <SelectValue placeholder="渠道" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">渠道：全部</SelectItem>
              <SelectItem value="email">邮件</SelectItem>
              <SelectItem value="sms">短信</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="telegram">Telegram</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={senderKey}
            onValueChange={(v) => goto({ sender: v, tid: undefined })}
          >
            <SelectTrigger className="h-8 text-xs w-[186px]">
              <SelectValue placeholder="发信账号" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">发信账号：全部</SelectItem>
              {senderOptions.map(({ sender, count, channels }) => (
                <SelectItem key={sender.key} value={sender.key}>
                  <span className="flex items-center gap-1.5 truncate">
                    {channels.map((c) => (
                      <span
                        key={c}
                        className={`shrink-0 rounded border px-1 py-px text-[10px] leading-none ${CHANNEL_COLOR[c]}`}
                      >
                        {CHANNEL_LABEL[c]}
                      </span>
                    ))}
                    <span className="truncate">{sender.address}</span>
                    <span className="text-muted-foreground shrink-0">
                      · {count}
                    </span>
                  </span>
                </SelectItem>
              ))}

            </SelectContent>
          </Select>
          <Select
            value={starred}
            onValueChange={(v) => goto({ starred: v as "all" | "starred" | "unstarred", tid: undefined })}
          >
            <SelectTrigger className="h-8 text-xs w-[120px]">
              <SelectValue placeholder="加星" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              <SelectItem value="starred">已加星</SelectItem>
              <SelectItem value="unstarred">未加星</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={friend}
            onValueChange={(v) =>
              goto({ friend: v as NonNullable<z.infer<typeof searchSchema>["friend"]>, tid: undefined })
            }
          >
            <SelectTrigger className="h-8 text-xs w-[150px]">
              <SelectValue placeholder="好友关系" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">好友关系：全部</SelectItem>
            <SelectItem value="pending">待对方通过/回关</SelectItem>
            <SelectItem value="accepted">对方已通过/回关</SelectItem>
            <SelectItem value="removed">对方已解除/取消关注</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 min-w-0 max-w-xs relative ml-1">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => goto({ q: e.target.value })}
            placeholder="搜索企业 / 联系人 / 内容"
            className="pl-7 h-8 text-xs"
          />
        </div>
        <div className="ml-auto flex items-center gap-2 shrink-0" />
      </div>

      <div className="flex-1 flex min-h-0">
        {/* 中栏：会话列表 */}
        <div className="w-[320px] xl:w-[380px] shrink-0 border-r flex flex-col min-h-0">
          {/* 意向档位过滤：合并为单个下拉框，默认「全部意向」—— 与右侧 AI 意向评分同源 */}
          <div className="px-3 pt-2 pb-1.5 border-b shrink-0">
            <Select
              value={intent}
              onValueChange={(v) =>
                goto({
                  intent: v === "all" ? undefined : (v as "high" | "mid" | "low"),
                  tid: undefined,
                })
              }
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue placeholder="全部意向" />
              </SelectTrigger>
              <SelectContent>
                {(
                  [
                    { key: "all", label: "全部意向", count: counts.all, dot: "bg-muted-foreground/40" },
                    { key: "high", label: "高意向", count: intentCounts.high, dot: "bg-emerald-500" },
                    { key: "mid", label: "中意向", count: intentCounts.mid, dot: "bg-sky-500" },
                    { key: "low", label: "低意向", count: intentCounts.low, dot: "bg-slate-400" },
                  ] as const
                ).map((opt) => (
                  <SelectItem key={opt.key} value={opt.key}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className={cn("h-1.5 w-1.5 rounded-full", opt.dot)} />
                      <span>{opt.label}</span>
                      <span className="tabular-nums text-muted-foreground">{opt.count}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* 结果条：显示当前筛选与匹配数量 */}
          <div className="px-3 py-2 border-b bg-muted/20 shrink-0 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              显示结果：
              <span className="text-foreground font-medium tabular-nums mx-1">
                {displayList.length}
              </span>
              条会话
            </span>
            {(view !== "all" || ch !== "all" || senderKey !== "all" || q || intent !== "all" || starred !== "all") && (
              <button
                onClick={() =>
                  goto({ view: "all", ch: "all", sender: "all", q: "", intent: undefined, starred: "all", tid: undefined })
                }
                className="text-primary hover:underline"
              >
                清除筛选
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {displayList.length === 0 ? (
              <div className="p-10 text-center text-sm text-muted-foreground">
                该视图下暂无会话
              </div>
            ) : (
              displayList.map((t) => (
                <ThreadRow
                  key={t.id}
                  thread={t}
                  active={t.id === currentId}
                  onClick={() => goto({ tid: t.id })}
                />
              ))
            )}
          </div>
        </div>

        {/* 右栏：会话详情 */}
        <div className="flex-1 min-w-0 flex bg-background">
          <div className="flex-1 min-w-0 overflow-y-auto">
            {current ? (
              <ThreadDetail
                thread={current}
                autoAi={search.action === "ai"}
                onConsumeAction={() =>
                  navigate({
                    to: "/outreach/conversations",
                    search: { ...search, action: undefined },
                    replace: true,
                  })
                }
                scorePanelOpen={scorePanelOpen}
                onToggleScorePanel={() => setScorePanelOpen((v) => !v)}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                选择左侧一个会话查看详情
              </div>
            )}
          </div>
          {current && (
            scorePanelOpen ? (
              <aside className="hidden lg:flex w-[300px] xl:w-[320px] shrink-0 border-l bg-muted/10 flex-col min-h-0">
                <IntelPanel thread={current} onCollapse={() => setScorePanelOpen(false)} />
              </aside>
            ) : (
              <aside className="hidden lg:flex w-10 shrink-0 border-l bg-muted/10 flex-col items-center pt-2">
                <button
                  type="button"
                  onClick={() => setScorePanelOpen(true)}
                  title="展开意向评分"
                  aria-label="展开意向评分"
                  className="h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <PanelRightOpen className="h-4 w-4" />
                </button>
                <span className="mt-2 text-[11px] text-muted-foreground [writing-mode:vertical-rl] tracking-widest">
                  意向评分
                </span>
              </aside>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function relTime(iso: string) {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return "刚刚";
  const min = Math.floor(diff / 60_000);
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(diff / 3_600_000);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(diff / 86_400_000);
  if (day < 30) return `${day} 天前`;
  return formatDateTime(iso).slice(0, 10);
}

function ThreadRow({
  thread,
  active,
  onClick,
}: {
  thread: Thread;
  active: boolean;
  onClick: () => void;
}) {
  const isUnread = thread.meta.unread > 0;
  const last = thread.messages[thread.messages.length - 1];
  const sender = useThreadSenderResolver()(thread);
  const woken =
    thread.meta.wokenAt &&
    Date.now() - new Date(thread.meta.wokenAt).getTime() < 24 * 3600_000;
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-3 py-3 rounded-lg border bg-card hover:border-primary/40 hover:bg-muted/40 transition-colors block",
        active && "border-primary bg-primary/5 ring-1 ring-primary/30 shadow-sm",
        !active && isUnread && "bg-rose-50/40",
        woken && "bg-amber-50/60",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {(() => {
              const CI = channelIcon(thread.channel);
              return (
                <span title={channelTooltip(thread.channel)}>
                  <CI
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                    aria-label={channelTooltip(thread.channel)}
                  />
                </span>
              );
            })()}
            <span
              className={cn(
                "text-sm truncate",
                isUnread ? "font-semibold" : "font-medium",
              )}
              title={thread.targetName}
            >
              {thread.targetName}
            </span>
            {woken && (
              <Badge className="text-[10px] py-0 px-1 h-4 bg-amber-500 hover:bg-amber-500">
                已唤醒
              </Badge>
            )}
            {thread.meta.humanTakeover && (
              <Badge
                className="h-4 py-0 px-1.5 text-[10px] font-medium shrink-0 whitespace-nowrap bg-sky-500 hover:bg-sky-500 text-white gap-0.5"
                title={`已由 ${thread.meta.humanTakeover.byName} 接管`}
              >
                <Hand className="h-2.5 w-2.5" /> 接管中
              </Badge>
            )}
            <span className="ml-auto flex items-center gap-1.5 shrink-0">
              <span
                role="button"
                tabIndex={-1}
                title={thread.meta.starred ? "取消加星" : "加星"}
                aria-label={thread.meta.starred ? "取消加星" : "加星"}
                className="p-0.5 -m-0.5 rounded hover:bg-muted/60 transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  const willStar = !thread.meta.starred;
                  toggleStar(thread.id);
                  toast.success(willStar ? "已加星" : "已取消加星");
                }}
              >
                <Star
                  className={cn(
                    "h-3.5 w-3.5 transition-colors",
                    thread.meta.starred
                      ? "fill-amber-400 text-amber-400"
                      : "text-muted-foreground/50 hover:text-amber-400",
                  )}
                />
              </span>
              {isUnread && (
                <span className="h-4 min-w-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-semibold inline-flex items-center justify-center tabular-nums">
                  {thread.meta.unread}
                </span>
              )}
              <span className="text-[11px] text-muted-foreground">
                {relTime(thread.lastAt)}
              </span>
            </span>
          </div>
          {last?.subject && (
            <div className="mt-0.5 text-xs text-muted-foreground truncate">
              {last.subject}
            </div>
          )}
          <div className="mt-1 text-xs text-foreground/70 line-clamp-2">
            {thread.lastPreview}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-muted-foreground">
            {(thread.parentRef?.name || thread.targetKind === "enterprise") && (
              <span title="企业">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </span>
            )}
            <span
              className="text-[10px] truncate max-w-[200px]"
              title={thread.parentRef?.name || thread.targetName}
            >
              {thread.parentRef?.name || thread.targetName}
            </span>
            {thread.isFriend && (
              <Badge
                variant="outline"
                className="h-4 py-0 px-1.5 text-[10px] gap-0.5 bg-violet-50 text-violet-700 border-violet-200"
              >
                <UserCheck className="h-2.5 w-2.5" />
                好友
              </Badge>
            )}

            {(() => {
              const band = scoreIntent(thread).band;
              if (band === "high") {
                return (
                  <Badge className="h-4 py-0 px-1.5 text-[10px] bg-emerald-500 hover:bg-emerald-500 text-white gap-0.5">
                    <Sparkles className="h-2.5 w-2.5" />
                    高意向
                  </Badge>
                );
              }
              if (band === "mid") {
                return (
                  <Badge
                    variant="outline"
                    className="h-4 py-0 px-1.5 text-[10px] bg-sky-50 text-sky-700 border-sky-200 gap-0.5"
                  >
                    <Sparkles className="h-2.5 w-2.5" />
                    中意向
                  </Badge>
                );
              }
              return null;
            })()}
            {thread.meta.tags && thread.meta.tags.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 ml-auto shrink-0 overflow-hidden">
                    {thread.meta.tags.slice(0, 1).map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="h-4 py-0 px-1.5 text-[10px] bg-muted/50 text-foreground/80 border-border/70 truncate max-w-[80px]"
                      >
                        {tag}
                      </Badge>
                    ))}
                    {thread.meta.tags.length > 1 && (
                      <Badge
                        variant="outline"
                        className="h-4 py-0 px-1.5 text-[10px] bg-muted/50 text-foreground/80 border-border/70 shrink-0"
                      >
                        +{thread.meta.tags.length - 1}
                      </Badge>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" align="start" className="max-w-xs">
                  <div className="flex flex-wrap gap-1">
                    {thread.meta.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="text-[10px] bg-muted/50 text-foreground/80 border-border/70"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function initialsOf(name: string) {
  const t = (name || "").replace(/^@/, "").trim();
  if (!t) return "?";
  const cn_ = t.match(/[\u4e00-\u9fa5]/);
  if (cn_) return t.slice(0, 1);
  return t.slice(0, 2).toUpperCase();
}

/** 会话气泡头像：社媒=账号头像（首字母），邮箱/短信=渠道图标 */
function PartyAvatar({
  channel,
  name,
  outbound,
  className,
}: {
  channel: Channel;
  name: string;
  outbound: boolean;
  className?: string;
}) {
  const isSocial = channel === "facebook" || channel === "tiktok" || channel === "whatsapp" || channel === "telegram";
  const CI = channelIcon(channel);
  return (
    <div
      className={cn(
        "h-8 w-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-medium shadow-sm",
        outbound ? "bg-primary text-primary-foreground" : "bg-emerald-500 text-white",
        className,
      )}
      title={name}
    >
      {isSocial || outbound ? initialsOf(name) : <CI className="h-4 w-4" />}
    </div>
  );
}

function ThreadDetail({
  thread,
  autoAi,
  onConsumeAction,
  scorePanelOpen,
  onToggleScorePanel,
}: {
  thread: Thread;
  autoAi?: boolean;
  onConsumeAction?: () => void;
  scorePanelOpen?: boolean;
  onToggleScorePanel?: () => void;
}) {
  const [reply, setReply] = useState("");

  const detailSender = useThreadSenderResolver()(thread);
  const [detailTab, setDetailTab] = useState("thread");
  const senderNickname = detailSender.displayName || detailSender.address;
  const counterpartyNickname =
    thread.meta.profile?.targetName || thread.targetName || thread.counterpartyAddress;
  // AI 识别的对方语言
  const detectedLang = useMemo(() => detectThreadLanguage(thread), [thread]);
  // 回复目标语言：auto = 跟随对方语言
  const [replyLang, setReplyLang] = useState<string>("auto");
  useEffect(() => {
    setReplyLang("auto");
    setTranslated("");
    setTranslatedFrom("");
  }, [thread.id]);
  const targetLang =
    langByCode(replyLang === "auto" ? detectedLang.code : replyLang) ??
    langByCode("en")!;
  const [aiLoading, setAiLoading] = useState(false);
  /** 目标语言译文（实际发送内容） */
  const [translated, setTranslated] = useState("");
  /** 生成译文时对应的中文原文，用于判断译文是否过期 */
  const [translatedFrom, setTranslatedFrom] = useState("");
  const [translating, setTranslating] = useState(false);
  const [sending, setSending] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const draftKey = `boo:inbox:draft:${thread.id}`;
  // 切换会话：从 localStorage 恢复该会话的草稿
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(draftKey);
      if (raw) {
        const j = JSON.parse(raw) as { content?: string; savedAt?: string };
        setReply(j.content ?? "");
        setDraftSavedAt(j.savedAt ?? null);
      } else {
        setReply("");
        setDraftSavedAt(null);
      }
    } catch {
      setReply("");
      setDraftSavedAt(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.id]);
  // 草稿自动保存（1.2s 防抖）
  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = window.setTimeout(() => {
      if (reply.trim()) {
        const savedAt = new Date().toISOString();
        window.localStorage.setItem(
          draftKey,
          JSON.stringify({ content: reply, savedAt }),
        );
        setDraftSavedAt(savedAt);
      } else {
        window.localStorage.removeItem(draftKey);
        setDraftSavedAt(null);
      }
    }, 1200);
    return () => window.clearTimeout(h);
  }, [reply, draftKey]);
  const lastInbound = [...thread.messages]
    .reverse()
    .find((m) => m.direction === "inbound");

  // 窗口计算（WA/FB/TT）
  const winInfo = useMemo(() => {
    const winH = WINDOW_HOURS[thread.channel];
    if (winH === undefined) return null;
    const exp = thread.meta.windowExpiresAt
      ? new Date(thread.meta.windowExpiresAt).getTime()
      : null;
    if (!exp) return { winH, leftMs: winH * 3600_000, closed: false };
    const leftMs = exp - Date.now();
    return { winH, leftMs, closed: leftMs <= 0 };
  }, [thread.channel, thread.meta.windowExpiresAt]);

  async function aiGenerate() {
    setAiLoading(true);
    try {
      const res = await generateAiContent({
        data: {
          channel: "email",
          scene: "跟进客户回复邮件",
          extra: [
            `对方姓名：${thread.parentRef?.name ?? thread.targetName}`,
            `对方最新原话：${(lastInbound?.content ?? "(尚无对方回复)").slice(0, 400)}`,
            `AI 识别对方语言：${detectedLang.zh}（${detectedLang.en}，置信度 ${detectedLang.confidence}%）`,
            `请使用简体中文撰写整封回复（后续会由系统翻译为客户语言）。`,
          ].join("\n"),
          tone: "friendly",
          language: "zh",
          languageName: "Chinese (Simplified)",
          sampleEnterprise: thread.targetName,
        },
      });
      setReply(res.content || "");
      setTranslated("");
      setTranslatedFrom("");
      toast.success("AI 已生成中文回复草稿，可编辑后翻译发送");
    } catch (e) {
      toast.error(`AI 生成失败：${(e as Error).message}`);
    } finally {
      setAiLoading(false);
    }
  }

  // 当从企业/联系人详情胶囊上的"AI 回复"按钮进入时，自动触发一次生成，
  // 生成后清除 URL 上的 action 参数，避免切换会话或刷新时反复触发。
  useEffect(() => {
    if (!autoAi) return;
    aiGenerate();
    onConsumeAction?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAi, thread.id]);

  /* ---------- 中文原文 → 目标语言译文 ---------- */
  /** 目标语言为中文时无需翻译 */
  const needsTranslation = targetLang.code !== "zh";
  /** 译文是否已过期（中文原文在翻译后被改动） */
  const translationStale =
    needsTranslation && !!translated && reply.trim() !== translatedFrom;
  /** 实际发送内容 */
  const sendContent = needsTranslation ? translated : reply;

  async function doTranslate() {
    const text = reply.trim();
    if (!text) {
      toast.error("请先输入中文原文");
      return;
    }
    setTranslating(true);
    try {
      const res = await translateMessage({
        data: {
          text,
          targetLanguageName: targetLang.en,
          sourceLanguageName: "Chinese (Simplified)",
          tone: "friendly",
        },
      });
      if (!res.content) throw new Error("译文为空");
      setTranslated(res.content);
      setTranslatedFrom(text);
      toast.success(`已翻译为${targetLang.zh}，请复核后发送`);
    } catch (e) {
      toast.error(`翻译失败：${(e as Error).message}`);
    } finally {
      setTranslating(false);
    }
  }

  function doSend(aiGen = false) {
    if (thread.friendPending) {
      toast.warning(
        thread.channel === "tiktok"
          ? "对方还未回关，发私信可能会触发风控，待对方回关后再发送"
          : "当前对方还未通过好友申请，发私信可能会触发风控，待通过好友后再发送",
      );
      return;
    }
    if (thread.friendRemoved) {
      toast.warning(
        thread.channel === "tiktok"
          ? "对方已取消关注，互关关系已解除，发私信可能触发风控，请勿再发送"
          : "对方已解除好友关系，发私信可能触发风控，请勿再发送",
      );
      return;
    }
    if (!sendContent.trim()) {
      toast.error(needsTranslation ? "请先生成目标语言译文" : "请输入回复内容");
      return;
    }
    setSending(true);
    setTimeout(() => {
      sendReply({
        threadId: thread.id,
        content: sendContent.trim(),
        fromAddress: thread.senderEmail || "outreach@bytetech.cn",
        subject: thread.messages[0]?.subject
          ? `Re: ${thread.messages[0].subject.replace(/^Re:\s*/i, "")}`
          : undefined,
        aiGenerated: aiGen,
        contentZh: needsTranslation ? reply.trim() : undefined,
      });

      setReply("");
      setTranslated("");
      setTranslatedFrom("");
      if (typeof window !== "undefined") window.localStorage.removeItem(draftKey);
      setDraftSavedAt(null);
      setSending(false);
      toast.success("回复已发送");
    }, 400);
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶栏 */}
      <div className="px-6 py-4 border-b space-y-2 shrink-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {thread.targetKind === "enterprise" ? (
            <Building2 className="h-3.5 w-3.5" />
          ) : (
            <UserRound className="h-3.5 w-3.5" />
          )}
          <Link
            to={
              thread.targetKind === "enterprise"
                ? "/outreach/enterprise/$id"
                : "/outreach/enterprise/$id/contact/$idx"
            }
            params={
              thread.targetKind === "enterprise"
                ? { id: thread.targetId }
                : {
                    id: thread.targetId.split(":")[0],
                    idx: thread.targetId.split(":")[1] ?? "0",
                  }
            }
            className="hover:text-primary transition-colors"
          >
            {thread.targetName}
          </Link>
          {thread.parentRef && (
            <>
              <ChevronRight className="h-3 w-3" />
              <span>{thread.parentRef.name}</span>
            </>
          )}
          <span className="ml-2">· {thread.counterpartyAddress}</span>
          {thread.messages.some((m) => m.direction === "outbound" && m.ledgerId) && (
              <Link
                to="/outreach/reach"
                className="ml-2 inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
                title="查看来源触达任务"
              >
                <Zap className="h-3 w-3" />
                来自触达
              </Link>
            )}
        </div>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1 basis-full xl:basis-auto">
            {thread.messages[0]?.subject && (
              <div className="text-base font-semibold truncate">
                {thread.messages[0].subject}
              </div>
            )}
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              {/* AI 识别的对方语言 */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700 hover:bg-violet-100 transition-colors"
                    title="AI 语种识别依据"
                  >
                    <Sparkles className="h-3 w-3" />
                    AI 识别语言
                    {detectedLang.zh}
                    <span className="tabular-nums opacity-70">
                      {detectedLang.confidence}%
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 font-medium">
                    <Languages className="h-3.5 w-3.5 text-violet-600" />
                    AI 语种识别
                  </div>
                  <div className="text-muted-foreground">
                    识别结果：
                    <span className="text-foreground font-medium">
                      {detectedLang.zh}（{detectedLang.en}）
                    </span>
                    ，置信度 {detectedLang.confidence}%
                    {detectedLang.samples > 0 &&
                      ` · 样本 ${detectedLang.samples} 条对方消息`}
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                    {detectedLang.evidence.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                  {detectedLang.mixed && (
                    <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-800 px-2 py-1">
                      检测到多语种混用，建议在回复区手动指定目标语言。
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground">
                    识别结果仅供参考，可在下方回复区覆盖选择目标语言。
                  </div>
                </PopoverContent>
              </Popover>
              {thread.meta.cadenceEnrolled && (
                <Badge variant="outline" className="text-[11px]">
                  <Repeat className="h-3 w-3 mr-1" /> 已加入跟进序列
                </Badge>
              )}
              {thread.meta.humanTakeover && (
                <Badge
                  variant="outline"
                  className="text-[11px] bg-sky-50 text-sky-700 border-sky-200"
                  title={
                    thread.meta.humanTakeover.reason
                      ? `原因：${thread.meta.humanTakeover.reason}`
                      : undefined
                  }
                >
                  <Hand className="h-3 w-3 mr-1" />
                  已人工接管 · {thread.meta.humanTakeover.byName}
                </Badge>
              )}
              {thread.meta.tags.map((t) => (
                <Badge key={t} variant="outline" className="text-[11px]">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            <ActionBar thread={thread} />
          </div>
        </div>
      </div>

      {/* 时间线 */}
      <Tabs value={detailTab} onValueChange={setDetailTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-6 mt-2 h-9 shrink-0 self-start">
          <TabsTrigger value="thread" className="text-xs gap-1">
            <MessageCircleReply className="h-3.5 w-3.5" />
            会话
          </TabsTrigger>
          <TabsTrigger value="profile" className="text-xs gap-1">
            <UserIcon className="h-3.5 w-3.5" />
            客户资料
          </TabsTrigger>
        </TabsList>
        <TabsContent value="thread" className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4 mt-0">
        {(() => {
          const isSocial = thread.channel === "facebook" || thread.channel === "tiktok";
          
          if (isSocial) {
            return (
              <div className="flex flex-col space-y-4 pb-4">
                {thread.messages.map((m) => {
                  const isOutbound = m.direction === "outbound";
                  const ml = m.direction === "inbound" ? detectLanguage(m.content ?? "") : null;
                  const sending = isOutbound && m.events?.some(e => e.type === 'sending');
                  const failed = isOutbound && m.events?.some(e => e.type === 'failed');
                  const delivered = isOutbound && m.events?.some(e => e.type === 'delivered');

                  return (
                    <div key={m.id} className={cn("flex w-full", isOutbound ? "justify-end" : "justify-start")}>
                      <div className={cn("flex max-w-[85%] sm:max-w-[70%] gap-2", isOutbound ? "flex-row-reverse" : "flex-row")}>
                        {/* 头像 */}
                        <PartyAvatar
                          channel={thread.channel}
                          name={isOutbound ? senderNickname : counterpartyNickname}
                          outbound={isOutbound}
                        />

                        {/* 气泡区域 */}
                        <div className={cn("flex flex-col min-w-0", isOutbound ? "items-end" : "items-start")}>
                          <div className="flex items-center gap-1.5 px-1 mb-1 text-[10px] text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {isOutbound ? senderNickname : counterpartyNickname}
                            </span>
                            <span>· {formatDateTime(m.createdAt)}</span>
                          </div>

                          {/* 消息气泡 */}
                          <div
                            className={cn(
                              "relative group rounded-2xl px-3 py-2 text-sm shadow-sm",
                              isOutbound
                                ? "bg-primary text-primary-foreground rounded-tr-none"
                                : "bg-card border rounded-tl-none",
                              sending && "opacity-70",
                              failed && "border-rose-200 bg-rose-50/50 text-rose-900 shadow-none"
                            )}
                          >
                            <div className="whitespace-pre-wrap leading-relaxed break-words">
                              {m.content}
                            </div>
                            
                            {/* 译文展示 (发出的非中文内容增加中文译文) */}
                            {isOutbound && m.contentZhOutbound && (
                              <div className="mt-2 pt-2 border-t border-primary-foreground/20 text-[13px] opacity-90 italic">
                                <div className="mb-0.5 text-[9px] font-medium flex items-center gap-1">
                                  <Languages className="h-2.5 w-2.5" />
                                  中文对照
                                </div>
                                {m.contentZhOutbound}
                              </div>
                            )}

                            {/* 状态图标 */}
                            {isOutbound && (
                              <div className="mt-1 flex justify-end items-center gap-1">
                                {sending && <Loader2 className="h-3 w-3 animate-spin text-primary-foreground/70" />}
                                {delivered && <CheckCheck className="h-3 w-3 text-primary-foreground/70" />}
                                {failed && (
                                  <div className="flex items-center gap-1 text-[10px] text-rose-600">
                                    <RefreshCw className="h-3 w-3" />
                                    <span>发送失败</span>
                                  </div>
                                )}
                              </div>
                            )}


                            {/* 操作菜单/翻译 */}
                            {!isOutbound && (
                              <div className="absolute top-0 -right-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>

                          {/* 失败重试 */}
                          {failed && (
                            <div className="mt-1 flex items-center gap-2 text-[10px]">
                              <span className="text-rose-500">
                                {m.events?.find(e => e.type === 'failed')?.failReason ?? "网络异常"}
                              </span>
                              <button
                                className="text-primary hover:underline font-medium"
                                onClick={(e) => {
                                  e.preventDefault();
                                  toast.info("功能演示：正在重新发送...");
                                }}
                              >
                                重试
                              </button>
                            </div>
                          )}

                          {/* 翻译块 */}
                          {m.direction === "inbound" && (
                            <div className="mt-1.5 space-y-1.5 max-w-full">
                              <div className="flex items-center gap-1.5">
                                {ml && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] py-0 h-3.5 bg-violet-50 text-violet-700 border-violet-200"
                                  >
                                    <Sparkles className="h-2 w-2 mr-0.5" />
                                    {ml.zh}
                                  </Badge>
                                )}
                                {m.aiGenerated && (
                                  <Badge variant="outline" className="text-[9px] py-0 h-3.5">
                                    AI
                                  </Badge>
                                )}
                              </div>
                              {m.contentZh && (
                                <div className="rounded-xl border border-dashed border-sky-200 bg-sky-50/40 p-2 text-[13px] leading-relaxed text-sky-900">
                                  <div className="mb-0.5 text-[9px] font-medium text-sky-600 flex items-center gap-1">
                                    <Languages className="h-2.5 w-2.5" />
                                    译文
                                  </div>
                                  {m.contentZh}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          }

          // 非社媒渠道保持原有的列表排版
          return thread.messages.map((m) => (
            <div key={m.id} className="flex gap-3">
              <PartyAvatar
                channel={thread.channel}
                name={m.direction === "outbound" ? senderNickname : counterpartyNickname}
                outbound={m.direction === "outbound"}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {m.direction === "outbound" ? senderNickname : counterpartyNickname}
                  </span>
                  <span>· {formatDateTime(m.createdAt)}</span>
                  {m.aiGenerated && (
                    <Badge variant="outline" className="text-[10px] py-0 h-4">
                      <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                      AI
                    </Badge>
                  )}
                  {m.direction === "inbound" &&
                    (() => {
                      const ml = detectLanguage(m.content ?? "");
                      return (
                        <Badge
                          variant="outline"
                          className="text-[10px] py-0 h-4 bg-violet-50 text-violet-700 border-violet-200"
                          title={`AI 语种识别：${ml.en} · 置信度 ${ml.confidence}%`}
                        >
                          <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                          {ml.zh}
                        </Badge>
                      );
                    })()}
                </div>
                {m.direction === "outbound" && m.events && m.events.length > 0 && (
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    {m.events.map((ev, i) => (
                      <span key={i} className="inline-flex items-center gap-0.5">
                        {ev.type === "delivered" && (
                          <>
                            <CheckCheck className="h-3 w-3 text-emerald-500" />
                            已送达
                          </>
                        )}
                        {ev.type === "opened" && (
                          <>
                            <MailOpen className="h-3 w-3 text-sky-500" />
                            已打开
                          </>
                        )}
                        {ev.type === "clicked" && (
                          <>
                            <MousePointerClick className="h-3 w-3 text-violet-500" />
                            已点击
                          </>
                        )}
                        {ev.type === "sending" && (
                          <>
                            <Loader2 className="h-3 w-3 text-primary animate-spin" />
                            发送中
                          </>
                        )}
                        {ev.type === "failed" && (
                          <>
                            <RefreshCw className="h-3 w-3 text-rose-500" />
                            <span className="text-rose-600">发送失败</span>
                            {ev.failReason && (
                              <span className="opacity-70"> · {ev.failReason}</span>
                            )}
                            <button 
                              className="ml-1 text-primary hover:underline font-medium"
                              onClick={(e) => {
                                e.preventDefault();
                                toast.info("功能演示：正在重新发送...");
                              }}
                            >
                              重试
                            </button>
                          </>
                        )}
                      </span>
                    ))}
                  </div>
                )}
                <div className={cn(
                  "mt-2 rounded-md border bg-card p-3 text-sm whitespace-pre-wrap leading-relaxed relative",
                  m.direction === "outbound" && m.events?.some(e => e.type === 'sending') && "opacity-70",
                  m.direction === "outbound" && m.events?.some(e => e.type === 'failed') && "border-rose-200 bg-rose-50/30"
                )}>
                  {m.content}
                  {m.direction === "outbound" && m.events?.some(e => e.type === 'sending') && (
                    <div className="absolute right-2 bottom-2">
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    </div>
                  )}
                </div>
                {m.direction === "outbound" && m.contentZhOutbound && (
                  <div className="mt-1.5 rounded-md border border-dashed border-primary/20 bg-primary/5 p-3 text-sm whitespace-pre-wrap leading-relaxed text-primary/80">
                    <div className="mb-1 text-[11px] font-medium text-primary/70 inline-flex items-center gap-1">
                      <Languages className="h-3 w-3" />
                      中文对照（发送内容译文）
                    </div>
                    {m.contentZhOutbound}
                  </div>
                )}
                {m.direction === "inbound" && m.contentZh && (
                  <div className="mt-1.5 rounded-md border border-dashed border-sky-200 bg-sky-50/60 p-3 text-sm whitespace-pre-wrap leading-relaxed text-sky-900">
                    <div className="mb-1 text-[11px] font-medium text-sky-700 inline-flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      中文译文（AI 自动翻译）
                    </div>
                    {m.contentZh}
                  </div>
                )}

              </div>
            </div>
          ));
        })()}
        </TabsContent>
        <TabsContent value="profile" className="flex-1 min-h-0 overflow-y-auto px-6 py-4 mt-0">
          <ProfilePanel thread={thread} />
        </TabsContent>
      </Tabs>

      {/* 回复区（客户资料标签页下不展示） */}
      {detailTab === "thread" && (
      <div className="border-t bg-muted/20 p-4 shrink-0">

        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <MessageCircleReply className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">回复</span>
          <span className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
            {thread.channel === "whatsapp"
              ? "由公司共享 WhatsApp 商号发出（对客户显示同一号码）"
              : `将以 ${detailSender.address} 发出`}
            ，保持在同一会话内
          </span>

          <Button
            variant="ghost"
            size="sm"
            className="ml-auto gap-1 h-7"

            onClick={aiGenerate}
            disabled={aiLoading || winInfo?.closed}
          >
            {aiLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            AI 生成回复（中文）
          </Button>
        </div>
        {needsTranslation ? (
          <div className="grid gap-2 md:grid-cols-2">
            {/* 左：中文原文 */}
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">中文原文</span>
                <span>（内部撰写，不发送）</span>
              </div>
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder='用中文写点什么，或点击"AI 生成回复（中文）"…'
                rows={6}
                className="resize-none bg-background"
                disabled={winInfo?.closed}
              />
            </div>
            {/* 右：目标语言译文（实际发送） */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Languages className="h-3.5 w-3.5 shrink-0" />
                <Select value={replyLang} onValueChange={setReplyLang}>
                  <SelectTrigger className="h-6 w-[168px] text-[11px] bg-background">
                    <SelectValue placeholder="目标语言" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel className="text-[11px]">AI 建议</SelectLabel>
                      <SelectItem value="auto" className="text-xs">
                        跟随对方语言 · {detectedLang.zh}
                      </SelectItem>
                    </SelectGroup>
                    <SelectGroup>
                      <SelectLabel className="text-[11px]">指定目标语言</SelectLabel>
                      {LANGUAGES.map((l) => (
                        <SelectItem key={l.code} value={l.code} className="text-xs">
                          {l.zh}（{l.en}）
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <span>译文（实际发送内容）</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto h-6 gap-1 px-2 text-[11px] bg-background"
                  onClick={doTranslate}
                  disabled={translating || !reply.trim() || winInfo?.closed}
                >
                  {translating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Languages className="h-3 w-3" />
                  )}
                  {translated ? "重新翻译" : `翻译为${targetLang.zh}`}
                </Button>
              </div>

              <Textarea
                value={translated}
                onChange={(e) => setTranslated(e.target.value)}
                placeholder={`点击「翻译为${targetLang.zh}」生成译文，可手动微调`}
                rows={6}
                className="resize-none bg-background"
                disabled={winInfo?.closed}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Languages className="h-3.5 w-3.5 shrink-0" />
              <Select value={replyLang} onValueChange={setReplyLang}>
                <SelectTrigger className="h-6 w-[168px] text-[11px] bg-background">
                  <SelectValue placeholder="目标语言" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel className="text-[11px]">AI 建议</SelectLabel>
                    <SelectItem value="auto" className="text-xs">
                      跟随对方语言 · {detectedLang.zh}
                    </SelectItem>
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel className="text-[11px]">指定目标语言</SelectLabel>
                    {LANGUAGES.map((l) => (
                      <SelectItem key={l.code} value={l.code} className="text-xs">
                        {l.zh}（{l.en}）
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <span>目标语言为中文，无需翻译，直接发送原文</span>
            </div>
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder='写点什么，或点击"AI 生成回复（中文）"由 AI 起草…'
              rows={5}
              className="resize-none bg-background"
              disabled={winInfo?.closed}
            />
          </div>
        )}

        {/* 译文状态提示 */}
        {!winInfo?.closed && needsTranslation && (
          <div
            className={cn(
              "mt-2 flex items-center gap-2 flex-wrap rounded-md border px-2.5 py-1.5 text-xs",
              translationStale
                ? "border-amber-300 bg-amber-50 text-amber-800"
                : translated
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-border bg-muted/40 text-muted-foreground",
            )}
          >
            <Languages className="h-3.5 w-3.5 shrink-0" />
            {translationStale ? (
              <span>中文原文已修改，右侧译文对应的是旧内容，请点击「重新翻译」后再发送。</span>
            ) : translated ? (

              <span>
                已生成「{targetLang.zh}」译文，发送时以右侧译文为准，中文原文仅内部留存。
              </span>
            ) : (
              <span>
                目标语言默认跟随对方语言「{detectedLang.zh}」，翻译后即可发送。
              </span>
            )}
          </div>
        )}
        {!winInfo?.closed && !needsTranslation && (
          <div className="mt-2 text-xs text-muted-foreground">
            对方语言为中文，将直接发送原文，无需翻译。
          </div>
        )}
        <div className="mt-2 flex items-center gap-2">
          <Button
            onClick={() => doSend(false)}
            disabled={
              sending ||
              !!winInfo?.closed ||
              (!winInfo?.closed && translationStale) ||
              (!winInfo?.closed && !sendContent.trim())
            }
            className="gap-1.5"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {needsTranslation ? `发送${targetLang.zh}译文` : "发送回复"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setReply("");
              setTranslated("");
              setTranslatedFrom("");
              if (typeof window !== "undefined")
                window.localStorage.removeItem(draftKey);
              setDraftSavedAt(null);
            }}
            disabled={(!reply && !translated) || sending}
          >
            清空
          </Button>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            {draftSavedAt && (
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <CheckCheck className="h-3 w-3" />
                草稿已自动保存 · {relTime(draftSavedAt)}
              </span>
            )}
            <span>回复后本会话状态自动切换为「等待回复」</span>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

function ActionBar({ thread }: { thread: Thread }) {
  return _ActionBar({ thread });
}

function _ActionBar({ thread }: { thread: Thread }) {
  return __ActionBarImpl({ thread });
}

function ProfileEditor({
  thread,
  footer,
}: {
  thread: Thread;
  footer?: React.ReactNode;
}) {
  const p = thread.meta.profile ?? {};
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    targetName: p.targetName ?? thread.targetName,
    email:
      p.email ?? (thread.channel === "email" ? thread.counterpartyAddress : ""),
    phone:
      p.phone ?? (thread.channel === "sms" ? thread.counterpartyAddress : ""),
    company: p.company ?? thread.parentRef?.name ?? "",
    website: p.website ?? "",
    country: p.country ?? "",
  });
  const [note, setNote] = useState("");
  const notes = thread.meta.notes ?? [];

  const fields: Array<[keyof typeof form, string, string]> = [
    ["targetName", "客户名称", "客户 / 联系人名称"],
    ["email", "联系邮箱", "name@company.com"],
    ["phone", "联系电话", "+86 138…"],
    ["company", "所属企业", "企业名称"],
    ["website", "企业官网", "https://"],
    ["country", "国家/地区", "如：德国"],
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          {thread.targetKind === "enterprise" ? (
            <Building2 className="h-4 w-4 text-muted-foreground" />
          ) : (
            <UserRound className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium">客户资料</span>
          <Badge variant="outline" className="h-5 py-0 px-1.5 text-[10px]">
            {CHANNEL_LABEL[thread.channel]}
          </Badge>
          {thread.isFriend && (
            <Badge
              variant="outline"
              className="h-5 py-0 px-1.5 text-[10px] gap-0.5 bg-violet-50 text-violet-700 border-violet-200"
            >
              <UserCheck className="h-2.5 w-2.5" />
              好友
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {editing ? (
              <>
                <Button
                  size="sm"
                  className="h-7"
                  onClick={() => {
                    updateThreadProfile(thread.id, form);
                    setEditing(false);
                    toast.success("客户资料已保存");
                  }}
                >
                  保存
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={() => setEditing(false)}
                >
                  取消
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" />
                编辑
              </Button>
            )}
          </div>
        </div>
        <div className="grid gap-x-4 gap-y-2.5 sm:grid-cols-2">
          {fields.map(([k, label, ph]) => (
            <div key={k} className="space-y-1">
              <div className="text-xs text-muted-foreground">{label}</div>
              {editing ? (
                <Input
                  value={form[k]}
                  placeholder={ph}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                  className="h-8 text-sm"
                />
              ) : (
                <div className="text-sm break-all">
                  {form[k] || <span className="text-muted-foreground">—</span>}
                </div>
              )}
            </div>
          ))}
        </div>
        {footer && <div className="border-t pt-3">{footer}</div>}
      </div>


      <div className="rounded-md border bg-card p-4 space-y-3">
        <div className="text-sm font-medium">备注</div>
        <div className="flex items-start gap-2">
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="记录客户偏好、报价进展等…"
            className="resize-none text-sm"
          />
          <Button
            size="sm"
            className="h-8 shrink-0"
            disabled={!note.trim()}
            onClick={() => {
              addThreadNote(thread.id, note);
              setNote("");
              toast.success("备注已添加");
            }}
          >
            添加
          </Button>
        </div>
        {notes.length === 0 ? (
          <div className="text-xs text-muted-foreground">暂无备注</div>
        ) : (
          <div className="space-y-2">
            {notes
              .slice()
              .reverse()
              .map((n) => (
                <div key={n.id} className="rounded-md border bg-muted/30 p-2.5 text-sm">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{n.by}</span>
                    <span>· {formatDateTime(n.at)}</span>
                    <button
                      className="ml-auto hover:text-foreground"
                      onClick={() => removeThreadNote(thread.id, n.id)}
                    >
                      删除
                    </button>
                  </div>
                  <div className="mt-1 whitespace-pre-wrap">{n.text}</div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileDocLinks({ thread }: { thread: Thread }) {
  const profile = resolveThreadProfile(thread);
  return (
    <div className="space-y-2">
        <div className="text-xs text-muted-foreground">客户档案</div>

        {profile.kind === "enterprise" && (
          <Link
            to="/outreach/enterprise/$id"
            params={{ id: profile.id }}
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            打开企业详情 · {profile.name}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        )}

        {profile.kind === "contact" && (
          <div className="space-y-1.5">
            <Link
              to="/outreach/enterprise/$id/contact/$idx"
              params={{ id: profile.entId, idx: profile.idx }}
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              打开联系人详情 · {profile.name}
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
            <div>
              <Link
                to="/outreach/enterprise/$id"
                params={{ id: profile.entId }}
                className="text-xs text-muted-foreground hover:text-primary hover:underline inline-flex items-center gap-1"
              >
                所属企业：{profile.entName}
                <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        )}

        {profile.kind === "social" && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground leading-relaxed">
              该客户来自社媒触达任务，为 {profile.platform} 平台账号，企业名录中暂无对应档案。
            </div>
            <div className="text-xs">
              <span className="text-muted-foreground">平台账号：</span>
              <span className="font-mono">{profile.handle}</span>
            </div>
            {thread.socialSignals && (
              <div className="text-xs text-muted-foreground">
                粉丝 {thread.socialSignals.followers ?? "—"} · 内容{" "}
                {thread.socialSignals.postsCount ?? "—"} 条
                {thread.socialSignals.accountAgeDays != null
                  ? ` · 注册 ${thread.socialSignals.accountAgeDays} 天`
                  : ""}
              </div>
            )}
            <div className="flex flex-wrap gap-3 pt-0.5">
              <Link
                to="/outreach/reach"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                查看触达任务
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/outreach/social/accounts"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                查看社媒账号
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {profile.kind === "external" && (
          <div className="text-xs text-muted-foreground leading-relaxed">
            {profile.reason}，暂无可跳转的完整档案。可在「企业名录」检索同名客户后收藏，再回到本会话继续跟进。
          </div>
        )}
    </div>
  );
}

function ProfilePanel({ thread }: { thread: Thread }) {
  const resolveSenderForPanel = useThreadSenderResolver();
  return (
    <div className="space-y-3 text-sm">
      <ProfileEditor thread={thread} footer={<ProfileDocLinks thread={thread} />} />
      {(() => {
        const sender = resolveSenderForPanel(thread);
        const link =
          sender.origin === "email"
            ? { to: "/outreach/mailboxes" as const, label: "查看发信邮箱" }
            : sender.origin === "social" || sender.origin === "whatsapp"
              ? { to: "/outreach/social/accounts" as const, label: "查看社媒账号" }
              : null;
        return (
          <div className="rounded-md border bg-card p-4 space-y-2">
            <div className="text-xs text-muted-foreground">沟通通道</div>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-xs text-muted-foreground shrink-0">我方</span>
              <span className="font-mono truncate">{sender.address}</span>
              {sender.displayName && (
                <span className="text-xs text-muted-foreground truncate">
                  {sender.displayName}
                </span>
              )}
              {sender.health === "warning" && (
                <Badge
                  variant="outline"
                  className="h-4 py-0 px-1.5 text-[10px] gap-0.5 bg-rose-50 text-rose-700 border-rose-200 shrink-0"
                >
                  <AlertTriangle className="h-2.5 w-2.5" />
                  异常
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="text-xs text-muted-foreground shrink-0">对方</span>
              <span className="font-mono truncate">
                {thread.counterpartyAddress}
              </span>
              <Badge
                variant="outline"
                className="h-4 py-0 px-1.5 text-[10px] shrink-0"
              >
                {CHANNEL_LABEL[thread.channel]}
              </Badge>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {sender.health === "warning"
                ? `${sender.healthNote ?? "该发信账号当前异常"}，回复可能失败`
                : "回复将使用同一账号发出"}
            </div>
            {link && (
              <Link
                to={link.to}
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                {link.label}
                <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        );
      })()}

      {/* 目标客户来源与原因 */}
      {(() => {
        const reason = getTargetReason(thread);
        const recommended = reason.mode === "recommended";
        const manualAdd = thread.manualAdd;
        return (
          <div className="rounded-md border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">作为目标客户的原因</span>
              <Badge
                variant="outline"
                className={cn(
                  "h-5 text-[10px] gap-1",
                  recommended
                    ? "bg-violet-50 text-violet-700 border-violet-200"
                    : "bg-sky-50 text-sky-700 border-sky-200",
                )}
              >
                {recommended ? (
                  <Sparkles className="h-2.5 w-2.5" />
                ) : (
                  <UserCheck className="h-2.5 w-2.5" />
                )}
                {recommended ? "系统推荐" : manualAdd ? "手动添加" : "自主选择"}
              </Badge>
              {recommended && reason.matchScore != null && (
                <span className="ml-auto text-xs font-medium tabular-nums text-violet-700">
                  匹配度 {reason.matchScore}%
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              {reason.summary}
            </div>
            {reason.origin && (
              <div className="text-xs text-muted-foreground">
                来源：{reason.origin}
              </div>
            )}
            {reason.factors.length > 0 && (
              <div className="space-y-2">
                {reason.factors.map((f) => (
                  <div key={f.label} className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium">{f.label}</span>
                      <span className="ml-auto tabular-nums text-muted-foreground">
                        {f.score}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-violet-500"
                        style={{ width: `${Math.min(100, f.score)}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-muted-foreground leading-relaxed">
                      {f.detail}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}


    </div>
  );
}

function __ActionBarImpl({ thread }: { thread: Thread }) {
  const [tagInput, setTagInput] = useState("");

  const addTagHandler = () => {
    if (tagInput.trim()) {
      addTag(thread.id, tagInput.trim());
      setTagInput("");
      toast.success("已加标签");
    }
  };

  return (
    <div className="flex items-center gap-1 shrink-0">
      {/* 加星 */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => {
          toggleStar(thread.id);
          toast.success(thread.meta.starred ? "已取消加星" : "已加星");
        }}
      >
        <Star
          className={cn(
            "h-4 w-4",
            thread.meta.starred ? "fill-amber-400 text-amber-400" : "",
          )}
        />
      </Button>

      {/* 打标签 */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Tag className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-2.5">
          <div className="text-xs font-medium text-muted-foreground mb-1.5">
            标签 / 分类
          </div>
          <div className="flex items-center gap-1">
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="打标签"
              className="h-7"
              onKeyDown={(e) => {
                if (e.key === "Enter") addTagHandler();
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-7 shrink-0"
              onClick={addTagHandler}
            >
              <Tag className="h-3 w-3" />
            </Button>
          </div>
        </PopoverContent>
      </Popover>

    </div>
  );
}

