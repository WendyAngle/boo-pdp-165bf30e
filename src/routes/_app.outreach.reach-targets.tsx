import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  ChevronRight,
  Facebook,
  Globe,
  Mail,
  MessageCircleReply,
  Music2,
  Phone,
  Search,
  Sparkles,
  Target as TargetIcon,
  UserCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ListPagination } from "@/components/ListPagination";
import { formatDateTime } from "@/lib/format-date";
import {
  useLedger,
  getReachStatus,
  seedDemoLedgerIfEmpty,
  REACH_CHANNEL_LABEL,
  type ReachChannel,
} from "@/lib/credits-ledger";
import { groupKeyOf, reachAction, taskNameOf } from "@/lib/reach-tasks";
import { useThreads, threadKeyFor, type Thread, type Channel } from "@/lib/inbox-store";
import { getTargetReason } from "@/lib/target-reason";

export const Route = createFileRoute("/_app/outreach/reach-targets")({
  validateSearch: (search: Record<string, unknown>): { task?: string } => ({
    task: typeof search.task === "string" ? search.task : undefined,
  }),
  head: () => ({
    meta: [
      { title: "触达目标 · 客户触达 | 出海大数据平台" },
      {
        name: "description",
        content: "以卡片形式查看触达任务下的目标企业、人物与社媒账号资料及入选原因。",
      },
      { property: "og:title", content: "触达目标 · 客户触达" },
      {
        property: "og:description",
        content: "查看触达任务下每个目标的资料与作为目标客户的原因。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReachTargetsPage,
});

/** 触达渠道 → 会话渠道，用于复用「目标客户原因」模型 */
function toThreadChannel(channel?: ReachChannel, platform?: string): Channel {
  if (channel === "email") return "email";
  if (channel === "phone") return "sms";
  if (platform === "WhatsApp") return "whatsapp";
  if (platform === "TikTok") return "tiktok";
  return "facebook";
}

function ChannelIcon({ channel, platform }: { channel?: ReachChannel; platform?: string }) {
  if (channel === "email") return <Mail className="h-3.5 w-3.5" />;
  if (channel === "phone") return <Phone className="h-3.5 w-3.5" />;
  if (platform === "Facebook") return <Facebook className="h-3.5 w-3.5" />;
  if (platform === "TikTok") return <Music2 className="h-3.5 w-3.5" />;
  return <Globe className="h-3.5 w-3.5" />;
}

function ReachTargetsPage() {
  const { task } = Route.useSearch();
  useEffect(() => {
    seedDemoLedgerIfEmpty();
  }, []);

  const ledger = useLedger();
  const threads = useThreads();
  const threadByKey = useMemo(() => {
    const m = new Map<string, Thread>();
    for (const t of threads) m.set(t.id, t);
    return m;
  }, [threads]);

  const [kw, setKw] = useState("");
  const [kind, setKind] = useState<"all" | "enterprise" | "contact">("all");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const rows = useMemo(() => {
    const now = Date.now();
    return ledger
      .filter((e) => e.kind === "reach")
      .filter((e) => getReachStatus(e, now) === "success")
      .filter((e) => (task ? groupKeyOf(e) === task : true))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [ledger, task]);

  const taskName = rows.length > 0 ? taskNameOf(rows[0]) : "全部触达任务";

  /** 同一目标在同一任务内可能有多条记录，按目标聚合成一张卡片 */
  const targets = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        targetKind: "enterprise" | "contact";
        targetId: string;
        parentName?: string;
        address?: string;
        channel?: ReachChannel;
        platform?: string;
        action: string;
        times: number;
        firstAt: string;
        lastAt: string;
        replies: number;
        thread?: Thread;
        sample: (typeof rows)[number];
      }
    >();
    for (const r of rows) {
      const key = `${r.targetKind}:${r.targetId}:${r.channel}:${r.platform ?? ""}`;
      const t = threadByKey.get(threadKeyFor(r) ?? "");
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          name: r.targetName,
          targetKind: r.targetKind === "contact" ? "contact" : "enterprise",
          targetId: r.targetId,
          parentName: r.parentRef?.name,
          address: r.detail,
          channel: r.channel,
          platform: r.platform,
          action: reachAction(r),
          times: 0,
          firstAt: r.createdAt,
          lastAt: r.createdAt,
          replies: 0,
          thread: t,
          sample: r,
        };
        map.set(key, g);
      }
      g.times++;
      if (r.createdAt < g.firstAt) g.firstAt = r.createdAt;
      if (r.createdAt > g.lastAt) g.lastAt = r.createdAt;
      g.replies = Math.max(g.replies, t?.meta.inboundMessages.length ?? 0);
    }
    return [...map.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  }, [rows, threadByKey]);

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase();
    return targets.filter((t) => {
      if (kind !== "all" && t.targetKind !== kind) return false;
      if (!k) return true;
      return (
        t.name.toLowerCase().includes(k) ||
        (t.parentName ?? "").toLowerCase().includes(k) ||
        (t.address ?? "").toLowerCase().includes(k) ||
        (t.platform ?? "").toLowerCase().includes(k)
      );
    });
  }, [targets, kw, kind]);

  useEffect(() => {
    setPage(1);
  }, [kw, kind, task]);

  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize);
  const entCount = targets.filter((t) => t.targetKind === "enterprise").length;
  const conCount = targets.length - entCount;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>出海大数据平台</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to="/outreach/reach" className="hover:text-foreground">
          客户触达
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">触达目标</span>
      </div>

      <section
        className="relative overflow-hidden rounded-2xl p-6 text-white"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <TargetIcon className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{taskName}</h1>
            <p className="text-white/85 text-sm mt-0.5">
              该任务下已触达成功的目标资料与入选原因
            </p>
          </div>
          <div className="flex items-center gap-5 text-right text-white/90">
            <div>
              <div className="text-xs opacity-80">目标数</div>
              <div className="text-2xl font-bold tabular-nums">{targets.length}</div>
            </div>
            <div>
              <div className="text-xs opacity-80">企业</div>
              <div className="text-2xl font-bold tabular-nums">{entCount}</div>
            </div>
            <div>
              <div className="text-xs opacity-80">人物 / 账号</div>
              <div className="text-2xl font-bold tabular-nums">{conCount}</div>
            </div>
          </div>
        </div>
        <div className="relative mt-4">
          <Button
            asChild
            size="sm"
            variant="secondary"
            className="h-8 bg-white/15 text-white border-white/20 hover:bg-white/25"
          >
            <Link to="/outreach/reach">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              返回触达任务
            </Link>
          </Button>
        </div>
      </section>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 flex items-center gap-3 flex-wrap border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">目标类型</span>
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger className="h-9 w-[160px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部（{targets.length}）</SelectItem>
                <SelectItem value="enterprise">企业（{entCount}）</SelectItem>
                <SelectItem value="contact">人物 / 账号（{conCount}）</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              placeholder="搜索目标名称 / 所属企业 / 联系方式 / 平台"
              className="pl-9 h-9 bg-background"
            />
          </div>
          {(kw || kind !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1"
              onClick={() => {
                setKw("");
                setKind("all");
              }}
            >
              <X className="h-3.5 w-3.5" />
              清除
            </Button>
          )}
          <div className="text-sm text-muted-foreground ml-auto">
            共 <span className="text-foreground font-semibold">{filtered.length}</span> 个目标
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-16 flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <Users className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="text-base font-medium">未找到匹配的目标</div>
            <div className="text-sm text-muted-foreground">
              调整搜索关键词或目标类型后重试
            </div>
          </div>
        ) : (
          <div className="p-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pageData.map((t) => (
              <TargetCard key={t.key} t={t} />
            ))}
          </div>
        )}

        {filtered.length > pageSize && (
          <div className="border-t px-5 py-3">
            <ListPagination
              page={page}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>
    </div>
  );
}

function TargetCard({
  t,
}: {
  t: {
    name: string;
    targetKind: "enterprise" | "contact";
    targetId: string;
    parentName?: string;
    address?: string;
    channel?: ReachChannel;
    platform?: string;
    action: string;
    times: number;
    firstAt: string;
    lastAt: string;
    replies: number;
    thread?: Thread;
  };
}) {
  const pseudoThread = {
    id: t.thread?.id ?? `${t.targetKind}:${t.targetId}`,
    targetKind: t.targetKind,
    targetId: t.targetId,
    targetName: t.name,
    channel: toThreadChannel(t.channel, t.platform),
    isFriend: t.thread?.isFriend,
    friendSource: t.thread?.friendSource,
    socialSignals: t.thread?.socialSignals,
    manualAdd: t.thread?.manualAdd,
  } as Thread;
  const reason = getTargetReason(t.thread ?? pseudoThread);
  const recommended = reason.mode === "recommended";
  const manualAdd = (t.thread ?? pseudoThread).manualAdd;
  const isSocial = t.channel === "social";

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-2">
        <div
          className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
            t.targetKind === "enterprise"
              ? "bg-slate-100 text-slate-600"
              : "bg-amber-100 text-amber-700",
          )}
        >
          {t.targetKind === "enterprise" ? (
            <Building2 className="h-4.5 w-4.5" />
          ) : (
            <UserRound className="h-4.5 w-4.5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate" title={t.name}>
            {t.name}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            {t.targetKind === "enterprise"
              ? "企业目标"
              : isSocial
                ? `社媒账号${t.platform ? ` · ${t.platform}` : ""}`
                : "人物目标"}
            {t.parentName ? ` · 所属 ${t.parentName}` : ""}
          </div>
        </div>
        {t.thread?.isFriend && (
          <Badge
            variant="outline"
            className="h-5 text-[10px] gap-0.5 bg-violet-50 text-violet-700 border-violet-200 shrink-0"
          >
            <UserCheck className="h-2.5 w-2.5" />
            好友
          </Badge>
        )}
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <ChannelIcon channel={t.channel} platform={t.platform} />
          <span>
            {t.channel ? REACH_CHANNEL_LABEL[t.channel] : "触达"}
            {t.platform ? ` · ${t.platform}` : ""} · {t.action}
          </span>
        </div>
        {t.address && (
          <div className="truncate">
            <span className="text-muted-foreground">联系方式：</span>
            <span className="font-mono">{t.address}</span>
          </div>
        )}
        <div className="flex items-center gap-3 text-muted-foreground">
          <span>触达 {t.times} 次</span>
          <span className="inline-flex items-center gap-1">
            <MessageCircleReply className="h-3 w-3" />
            回复 {t.replies}
          </span>
          <span className="ml-auto">{formatDateTime(t.lastAt)}</span>
        </div>
      </div>

      <div className="rounded-md border bg-muted/20 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">作为目标客户的原因</span>
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
            <span className="ml-auto text-[11px] font-medium tabular-nums text-violet-700">
              匹配度 {reason.matchScore}%
            </span>
          )}
        </div>
        <div className="text-[11px] text-muted-foreground leading-relaxed">
          {reason.summary}
        </div>
        {reason.factors.slice(0, 3).map((f) => (
          <div key={f.label} className="space-y-0.5">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="font-medium">{f.label}</span>
              <span className="ml-auto tabular-nums text-muted-foreground">{f.score}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-500"
                style={{ width: `${Math.min(100, f.score)}%` }}
              />
            </div>
          </div>
        ))}
        {!recommended && reason.origin && (
          <div className="text-[11px] text-muted-foreground leading-relaxed">
            来源：{reason.origin}
          </div>
        )}
      </div>

      {!isSocial && (
        <Link
          to={
            t.targetKind === "enterprise"
              ? "/outreach/enterprise/$id"
              : "/outreach/enterprise/$id/contact/$idx"
          }
          params={
            t.targetKind === "enterprise"
              ? { id: t.targetId }
              : {
                  id: t.targetId.split(":")[0],
                  idx: t.targetId.split(":")[1] ?? "0",
                }
          }
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          打开{t.targetKind === "enterprise" ? "企业" : "联系人"}详情
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
