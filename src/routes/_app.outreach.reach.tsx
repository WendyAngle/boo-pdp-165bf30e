import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Zap,
  ChevronRight,
  Mail,
  Phone,
  Globe,
  Search,
  X,
  Building2,
  CheckCircle2,
  Send,
  RefreshCw,
  EyeOff,
  Info,
  Sparkles,
  Loader2,
  Pause,
  Play,
  PauseCircle,
} from "lucide-react";
import { toast } from "sonner";
import { usePausedTaskKeys, toggleTaskPaused } from "@/lib/reach-task-pause";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  useLedger,
  getReachStatus,
  seedDemoLedgerIfEmpty,
  backfillAiGenerationEntries,
  resetDemoLedger,
  syncFailedRefunds,
  REACH_CHANNEL_LABEL,
  type ReachChannel,
} from "@/lib/credits-ledger";
import { ListPagination } from "@/components/ListPagination";
import { groupKeyOf, reachAction } from "@/lib/reach-tasks";
import { useThreads, threadKeyFor, type Thread } from "@/lib/inbox-store";
import {
  Inbox as InboxIcon,
  MessageCircleReply,
  Users,
  MessageSquare,
} from "lucide-react";
import { CreateReachTaskDialog } from "@/components/outreach/CreateReachTaskDialog";
import { ManagedEmailReachDialog } from "@/components/outreach/ManagedEmailReachDialog";
import { ManagedEmailBatches } from "@/components/outreach/ManagedEmailBatches";
import { useManagedOrders } from "@/lib/managed-email";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UserCircle2, Plus, Handshake } from "lucide-react";



export const Route = createFileRoute("/_app/outreach/reach")({
  head: () => ({ meta: [{ title: "出海大数据平台 · 触达 | 出海大数据平台" }] }),
  component: ReachPage,
});

import { formatDateTime as fmtTime } from "@/lib/format-date";

type TaskGroup = {
  key: string;
  name: string;
  channel: ReachChannel;
  platform?: string;
  action: string;
  total: number;
  replies: number;
  aiGenerated: boolean;
  createdAt: string;
  lastAt: string;
  status: "completed" | "running" | "paused";
};


function ReachPage() {
  useEffect(() => {
    seedDemoLedgerIfEmpty();
    backfillAiGenerationEntries();
    syncFailedRefunds();
  }, []);

  const ledger = useLedger();
  const threads = useThreads();
  const threadByKey = useMemo(() => {
    const m = new Map<string, Thread>();
    for (const t of threads) m.set(t.id, t);
    return m;
  }, [threads]);
  const [now, setNow] = useState(() => Date.now());
  const [createReachOpen, setCreateReachOpen] = useState(false);
  const [managedEmailOpen, setManagedEmailOpen] = useState(false);
  const [tab, setTab] = useState<"self" | "managed">("self");
  const managedOrders = useManagedOrders();
  const pausedKeys = usePausedTaskKeys();


  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      syncFailedRefunds();
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const [channel, setChannel] = useState<"all" | ReachChannel | "whatsapp">(
    "all",
  );
  const [kw, setKw] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // 触达任务仅展示「触达成功」的数据，不再区分待触达 / 触达中 / 触达失败
  const reachRows = useMemo(() => {
    return ledger
      .filter((e) => e.kind === "reach")
      .map((e) => ({ ...e, status: getReachStatus(e, now) }))
      .filter((e) => e.status === "success")
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
  }, [ledger, now]);

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase();
    return reachRows.filter((r) => {
      if (channel === "whatsapp") {
        if (r.channel !== "social" || r.platform !== "WhatsApp") return false;
      } else if (channel === "social") {
        if (r.channel !== "social" || r.platform === "WhatsApp") return false;
      } else if (channel !== "all" && r.channel !== channel) {
        return false;
      }
      if (!k) return true;
      return (
        r.targetName.toLowerCase().includes(k) ||
        (r.parentRef?.name ?? "").toLowerCase().includes(k) ||
        (r.detail ?? "").toLowerCase().includes(k) ||
        (r.platform ?? "").toLowerCase().includes(k)
      );
    });
  }, [reachRows, channel, kw]);

  useEffect(() => {
    setPage(1);
  }, [channel, kw]);

  const channelCounts = useMemo(() => {
    let email = 0;
    let phone = 0;
    let social = 0;
    for (const r of reachRows) {
      if (r.channel === "email") email++;
      else if (r.channel === "phone") phone++;
      else if (r.channel === "social") social++;
    }
    return { email, phone, social };
  }, [reachRows]);

  const replyTotal = useMemo(
    () =>
      reachRows.reduce((n, r) => {
        const t = threadByKey.get(threadKeyFor(r) ?? "");
        return n + (t?.meta.inboundMessages.length ?? 0);
      }, 0),
    [reachRows, threadByKey],
  );
  const replyRate =
    reachRows.length === 0 ? 0 : Math.round((replyTotal / reachRows.length) * 100);

  // 根据全量 ledger 判断每个任务 key 是否仍有未执行完毕的记录
  const runningKeys = useMemo(() => {
    const set = new Set<string>();
    for (const r of ledger) {
      if (r.kind !== "reach") continue;
      const s = getReachStatus(r, now);
      if (s === "pending" || s === "in_progress") {
        set.add(groupKeyOf(r));
      }
    }
    return set;
  }, [ledger, now]);

  // 任务视图：把逐条触达成功记录按「任务」聚合
  const taskGroups = useMemo(() => {
    const map = new Map<string, TaskGroup>();
    for (const r of filtered) {
      const action = reachAction(r);
      const batchName = r.channel === "social" && r.subject ? r.subject : null;
      const key = groupKeyOf(r);
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          name:
            batchName ??
            (r.platform ? `${r.platform}${action}` : action) +
              ` · ${fmtTime(r.createdAt)}`,
          channel: r.channel!,
          platform: r.platform,
          action,
          total: 0,
          replies: 0,
          aiGenerated: false,
          createdAt: r.createdAt,
          lastAt: r.createdAt,
          status: runningKeys.has(key) ? "running" : "completed",
        };
        map.set(key, g);
      }
      g.total++;
      if (r.aiGenerated) g.aiGenerated = true;
      const t = threadByKey.get(threadKeyFor(r) ?? "");
      g.replies += t?.meta.inboundMessages.length ?? 0;
      if (r.createdAt < g.createdAt) g.createdAt = r.createdAt;
      if (r.createdAt > g.lastAt) g.lastAt = r.createdAt;
    }
    return [...map.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  }, [filtered, threadByKey, runningKeys]);


  const taskPageData = useMemo(
    () => taskGroups.slice((page - 1) * pageSize, page * pageSize),
    [taskGroups, page],
  );


  return (
    <TooltipProvider delayDuration={150}>
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>出海大数据平台</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">客户触达</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => {
            if (window.confirm("将清空当前触达记录并重新加载演示数据，确认？")) {
              resetDemoLedger();
            }
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          重置演示数据
        </Button>
      </div>
      <CreateReachTaskDialog open={createReachOpen} onOpenChange={setCreateReachOpen} />
      <ManagedEmailReachDialog open={managedEmailOpen} onOpenChange={setManagedEmailOpen} />


      <section
        className="relative overflow-hidden rounded-2xl p-6 text-white"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Zap className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">触达</h1>
            <p className="text-white/85 text-sm mt-0.5">
              汇总「我的收藏」发起的批量触达与本页发起的社媒拓客任务，仅展示触达成功的数据
            </p>

          </div>
          <div className="flex items-center gap-5 text-right text-white/90">
            <div>
              <div className="text-xs opacity-80">触达成功</div>
              <div className="text-2xl font-bold tabular-nums">{reachRows.length}</div>
            </div>
            <div>
              <div className="text-xs opacity-80">客户回复</div>
              <div className="text-2xl font-bold tabular-nums">{replyTotal}</div>
            </div>
            <div>
              <div className="text-xs opacity-80">回复率</div>
              <div className="text-2xl font-bold tabular-nums">{replyRate}%</div>
            </div>
          </div>

        </div>
        <div className="relative mt-3 flex flex-wrap items-center gap-2">

          <Button
            asChild
            size="sm"
            variant="secondary"
            className="h-8 bg-white/15 text-white border-white/20 hover:bg-white/25"
          >
            <Link to="/outreach/reach-empty">
              <EyeOff className="h-3.5 w-3.5 mr-1.5" />
              查看空状态演示
            </Link>
          </Button>
        </div>
      </section>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="触达成功"
          value={reachRows.length}
          tone="emerald"
        />
        <KpiCard
          icon={<Mail className="h-5 w-5" />}
          label="邮件触达"
          value={channelCounts.email}
          tone="sky"
        />
        <KpiCard
          icon={<Phone className="h-5 w-5" />}
          label="短信触达"
          value={channelCounts.phone}
          tone="amber"
        />
        <KpiCard
          icon={<Globe className="h-5 w-5" />}
          label="社媒触达"
          value={channelCounts.social}
          tone="violet"
        />
        <KpiCard
          icon={<MessageCircleReply className="h-5 w-5" />}
          label="客户回复"
          value={replyTotal}
          tone="rose"
        />
      </div>


      {/* Tab：自助触达任务 / 邮件托管批次 */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList>
            <TabsTrigger value="self" className="gap-1.5">
              <Send className="h-3.5 w-3.5" />
              自助触达任务
            </TabsTrigger>
            <TabsTrigger value="managed" className="gap-1.5">
              <Handshake className="h-3.5 w-3.5" />
              邮件托管批次
            </TabsTrigger>

          </TabsList>

          <div className="flex items-center gap-2">
            {tab === "self" ? (
              <>
                <Button size="sm" className="h-9 gap-1.5" onClick={() => setCreateReachOpen(true)}>
                  <Plus className="h-4 w-4" />
                  社媒拓客触达
                </Button>
                <Button asChild size="sm" variant="outline" className="h-9 gap-1.5">
                  <Link to="/outreach/social/accounts">
                    <UserCircle2 className="h-4 w-4" />
                    社媒账号
                  </Link>
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className="h-9 gap-1.5"
                onClick={() => setManagedEmailOpen(true)}
              >
                <Handshake className="h-4 w-4" />
                邮件托管触达
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="managed" className="mt-0 space-y-4">
          <SourceNote
            title="邮件托管批次说明"
            items={[
              <>由平台营销团队以你的企业名义、使用平台发信资源代为执行，全流程含目标确认、文案、排期与执行。</>,
              <>自有名单起做 <b className="text-foreground">200</b> 个目标，AI 智能寻源起做 <b className="text-foreground">500</b> 个目标；统一 <b className="text-foreground">10 积分/目标</b>。</>,
              <>支持中途叫停，未执行部分积分原路退回；批次进度与回执在本页跟踪。</>,
            ]}
          />
          <ManagedEmailBatches embedded onCreate={() => setManagedEmailOpen(true)} />
        </TabsContent>

        <TabsContent value="self" className="mt-0 space-y-4">
          <SourceNote
            title="自助触达任务来源"
            items={[
              <>「我的收藏」勾选目标后发起的邮件／短信／WhatsApp／社媒加好友与私信（存量名单群发）。</>,
              <>本页<b className="text-foreground mx-1">社媒拓客触达</b>由系统按推广产品与关键词自动寻找新目标账号（增量拓客）。</>,
              <>列表仅展示<b className="text-foreground mx-1">触达成功</b>的数据；点击任务行的目标数可查看目标资料明细。</>,
            ]}
          />

      <Card className="p-0 overflow-hidden">

        {/* 筛选 */}
        <div className="px-5 py-3 flex items-center gap-3 flex-wrap border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">触达渠道</span>
            <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
              <SelectTrigger className="h-9 w-[140px] bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部渠道</SelectItem>
                <SelectItem value="email">邮件</SelectItem>
                <SelectItem value="phone">短信</SelectItem>
                <SelectItem value="social">社媒</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              placeholder="输入企业 / 人物 / 平台 / 明细"
              className="pl-9 h-9 bg-background"
            />
          </div>
          {(kw || channel !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setKw("");
                setChannel("all");
              }}
              className="gap-1"
            >
              <X className="h-3.5 w-3.5" />
              清除
            </Button>
          )}
          <div className="text-sm text-muted-foreground ml-auto">
            共{" "}
            <span className="text-foreground font-semibold">
              {taskGroups.length}
            </span>{" "}
            个任务
          </div>

        </div>

        {filtered.length === 0 ? (
          <div className="p-16 flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <Send className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="text-base font-medium">暂无触达成功记录</div>
            <div className="text-sm text-muted-foreground max-w-md">
              前往企业 / 人物详情页，针对邮箱、电话或社媒账号发起触达，成功送达后将在此展示
            </div>

            <Button asChild variant="outline" size="sm" className="mt-2 gap-1.5">
              <Link to="/outreach/enterprise">
                <Building2 className="h-4 w-4" />
                去企业列表
              </Link>
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/5 hover:bg-primary/5">
                <TableHead className="min-w-[220px]">任务名</TableHead>
                <TableHead className="w-[150px]">渠道 / 平台</TableHead>
                <TableHead className="w-[90px]">动作</TableHead>
                <TableHead className="w-[110px]">目标数</TableHead>
                <TableHead className="w-[100px]">任务状态</TableHead>
                <TableHead className="w-[170px]">创建时间</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {taskPageData.map((g) => (
                <TableRow key={g.key} className="hover:bg-muted/30">

                  <TableCell className="max-w-[280px]">
                    <div className="flex items-center gap-1.5">
                      <Link
                        to="/outreach/reach-task/$taskKey"
                        params={{ taskKey: g.key }}
                        className="font-medium text-primary hover:underline"
                        title="查看任务详情"
                      >
                        {g.name}
                      </Link>
                      {g.aiGenerated && (
                        <Badge variant="secondary" className="gap-1 font-normal shrink-0">
                          <Sparkles className="h-3 w-3 text-primary" />
                          AI
                        </Badge>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <ChannelBadge channel={g.channel} platform={g.platform} />
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="inline-flex items-center gap-1">
                      {g.action === "加好友" ? (
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      {g.action}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums font-semibold">
                    <Link
                      to="/outreach/reach-targets"
                      search={{ task: g.key }}
                      onClick={(e) => e.stopPropagation()}
                      className="text-primary hover:underline inline-flex items-center gap-1"
                      title="查看该任务的目标资料"
                    >
                      {g.total}
                      <Users className="h-3.5 w-3.5" />
                    </Link>
                  </TableCell>

                  <TableCell>
                    <TaskStatusBadge status={g.status} />
                  </TableCell>

                  <TableCell className="font-mono tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                    {fmtTime(g.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {filtered.length > 0 && (
          <div className="px-5 pb-4">
            <ListPagination
              page={page}
              pageSize={pageSize}
              total={taskGroups.length}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>
        </TabsContent>
      </Tabs>



    </div>
    </TooltipProvider>
  );
}


function SourceNote({ title, items }: { title: string; items: React.ReactNode[] }) {
  return (
    <Card className="p-4 border-primary/20 bg-primary/5">
      <div className="flex items-start gap-3">
        <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Info className="h-4 w-4" />
        </div>
        <div className="text-sm space-y-1.5 flex-1 min-w-0">
          <div className="font-medium">{title}</div>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
            {items.map((it, i) => (
              <li key={i}>{it}</li>
            ))}
          </ol>
        </div>
      </div>
    </Card>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "slate" | "amber" | "emerald" | "rose" | "sky" | "violet";
}) {
  const toneMap = {
    slate: "bg-slate-50 text-slate-600 ring-slate-200",
    amber: "bg-amber-50 text-amber-600 ring-amber-200",
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-200",
    rose: "bg-rose-50 text-rose-600 ring-rose-200",
    sky: "bg-sky-50 text-sky-600 ring-sky-200",
    violet: "bg-violet-50 text-violet-600 ring-violet-200",
  } as const;
  return (
    <div className="rounded-xl ring-1 ring-border bg-card p-5 flex items-center gap-4">
      <div className={cn("h-10 w-10 rounded-lg ring-1 flex items-center justify-center", toneMap[tone])}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      </div>
    </div>
  );
}

function ChannelBadge({ channel, platform }: { channel: ReachChannel; platform?: string }) {
  const isWhatsApp = channel === "social" && platform === "WhatsApp";
  const Icon = channel === "email" ? Mail : channel === "phone" ? Phone : isWhatsApp ? Send : Globe;
  const label = isWhatsApp ? "WhatsApp" : REACH_CHANNEL_LABEL[channel];
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-xs">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="font-medium text-foreground">{label}</span>
    </span>
  );
}

function TaskStatusBadge({ status }: { status: "completed" | "running" }) {
  if (status === "running") {
    return (
      <Badge variant="outline" className="gap-1 font-normal bg-amber-50 text-amber-700 border-amber-200">
        <Loader2 className="h-3 w-3 animate-spin" />
        执行中
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 font-normal bg-emerald-50 text-emerald-700 border-emerald-200">
      <CheckCircle2 className="h-3 w-3" />
      已完成
    </Badge>
  );
}
