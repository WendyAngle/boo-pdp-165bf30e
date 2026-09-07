import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import {
  ArrowLeft,
  Sparkles,
  Users,
  Mail,
  Phone,
  Globe,
  Send,
  CheckCircle2,
  MessageCircleReply,
  Coins,
  Settings2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatDateTime as fmtTime } from "@/lib/format-date";
import {
  useLedger,
  getReachStatus,
  seedDemoLedgerIfEmpty,
  REACH_CHANNEL_LABEL,
  type ReachChannel,
} from "@/lib/credits-ledger";
import { groupKeyOf, reachAction, taskNameOf } from "@/lib/reach-tasks";
import { useThreads, threadKeyFor, type Thread } from "@/lib/inbox-store";
import { resolveTaskConfig, TASK_TYPE_LABEL } from "@/lib/reach-task-config";
import { languageLabel } from "@/lib/languages";

export const Route = createFileRoute("/_app/outreach/reach-task/$taskKey")({
  head: () => ({
    meta: [
      { title: "触达任务详情 · 出海大数据平台" },
      { name: "description", content: "查看触达任务的配置数据、目标明细与执行结果。" },
      { property: "og:title", content: "触达任务详情" },
      { property: "og:description", content: "任务配置、目标明细与回复情况一览。" },
    ],
  }),
  component: ReachTaskDetailPage,
});

function ReachTaskDetailPage() {
  const { taskKey } = useParams({ from: "/_app/outreach/reach-task/$taskKey" });
  const ledger = useLedger();
  const threads = useThreads();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    seedDemoLedgerIfEmpty();
  }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, []);

  const threadByKey = useMemo(() => {
    const m = new Map<string, Thread>();
    for (const t of threads) m.set(t.id, t);
    return m;
  }, [threads]);

  const entries = useMemo(
    () =>
      ledger
        .filter((e) => e.kind === "reach")
        .filter((e) => getReachStatus(e, now) === "success")
        .filter((e) => groupKeyOf(e) === taskKey)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [ledger, now, taskKey],
  );

  const action = entries[0] ? reachAction(entries[0]) : "触达";
  const cfg = useMemo(
    () => resolveTaskConfig(taskKey, entries, action),
    [taskKey, entries, action],
  );

  const replies = useMemo(
    () =>
      entries.reduce((n, r) => {
        const t = threadByKey.get(threadKeyFor(r) ?? "");
        return n + (t?.meta.inboundMessages.length ?? 0);
      }, 0),
    [entries, threadByKey],
  );
  const cost = entries.reduce((n, r) => n + (r.cost ?? 0), 0);

  if (entries.length === 0) {
    return (
      <div className="p-8 space-y-4">
        <BackLink />
        <Card className="p-12 text-center text-sm text-muted-foreground">
          未找到该触达任务，可能演示数据已被重置。
        </Card>
      </div>
    );
  }

  const first = entries[0]!;
  const name = taskNameOf(first);
  const lastAt = entries[0]!.createdAt;
  const createdAt = entries[entries.length - 1]!.createdAt;

  return (
    <div className="p-8 space-y-6">
      <BackLink />

      <section
        className="relative overflow-hidden rounded-2xl p-6 text-white"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
            <Send className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold truncate">{name}</h1>
              <Badge variant="secondary" className="font-normal text-foreground">
                {TASK_TYPE_LABEL[cfg.type]}
              </Badge>
              {cfg.aiGenerated && (
                <Badge variant="secondary" className="gap-1 font-normal text-foreground">
                  <Sparkles className="h-3 w-3 text-primary" />
                  AI 文案
                </Badge>
              )}
            </div>
            <p className="text-white/85 text-sm mt-1">
              创建于 {fmtTime(createdAt)} · 最近执行 {fmtTime(lastAt)}
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi icon={<Users className="h-5 w-5" />} label="目标数" value={entries.length} tone="slate" />
        <Kpi
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="触达成功"
          value={entries.length}
          tone="emerald"
        />
        <Kpi
          icon={<MessageCircleReply className="h-5 w-5" />}
          label="客户回复"
          value={replies}
          tone="amber"
        />
        <Kpi icon={<Coins className="h-5 w-5" />} label="消耗积分" value={cost} tone="slate" />
      </div>

      {/* 任务配置 */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b bg-muted/20 flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold">任务配置</div>
          <span className="text-xs text-muted-foreground">
            与创建该任务时的可编辑项一致
          </span>
        </div>
        <div className="p-5 grid gap-x-8 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="任务类型" value={TASK_TYPE_LABEL[cfg.type]} />
          <Field
            label="触达渠道"
            value={<ChannelBadge channel={first.channel!} platform={first.platform} />}
          />
          <Field label="执行动作" value={action} />

          {(cfg.type === "social_prospecting" || cfg.type === "social_dm") && (
            <>
              <Field label="社媒平台" value={cfg.platform ?? "—"} />
              <Field label="使用账号" value={(cfg.accounts ?? []).join("、") || "—"} />
              <Field label="发送时机" value={cfg.sendMode ?? "—"} />
            </>
          )}

          {cfg.type === "social_prospecting" && (
            <>
              <Field label="目标地区" value={cfg.region ?? "—"} />
              <Field label="目标数量上限" value={String(cfg.targetCap ?? entries.length)} />
              <Field label="推广产品" value={<Chips items={cfg.products ?? []} />} />
              <Field label="目标关键词" value={<Chips items={cfg.keywords ?? []} />} />
            </>
          )}

          {cfg.type === "email" && (
            <>
              <Field label="发件邮箱" value={cfg.senderEmail ?? "—"} />
              <Field label="邮件主题" value={first.subject ?? cfg.subject ?? "—"} />
            </>
          )}

          {cfg.type === "sms" && (
            <>
              <Field label="短信模板" value={cfg.smsTemplate ?? "—"} />
              <Field label="短信签名" value={cfg.smsSign ?? "—"} />
            </>
          )}

          {cfg.type === "whatsapp" && (
            <>
              <Field label="发送方式" value="系统自动触达" />
              <Field label="发送时机" value={cfg.sendMode ?? "—"} />
            </>
          )}

          <Field label="目标来源" value={cfg.targetSource ?? "—"} />
          <Field label="执行排期" value={cfg.schedule ?? "—"} />
          <Field label="目标语言" value={languageLabel(cfg.targetLang) || "—"} />
          <Field label="AI 生成文案" value={cfg.aiGenerated ? "是" : "否"} />
          <Field
            label="单目标积分"
            value={`${(cfg.costPerTarget ?? first.cost ?? 0).toLocaleString()} 积分`}
          />
        </div>

        <div className="px-5 pb-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="text-xs text-muted-foreground mb-1.5">中文原文</div>
            <div className="text-sm whitespace-pre-wrap break-words">
              {cfg.sourceZh?.trim() || "—"}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="text-xs text-muted-foreground mb-1.5">
              实际发送内容{cfg.targetLang ? `（${languageLabel(cfg.targetLang)}）` : ""}
            </div>
            <div className="text-sm whitespace-pre-wrap break-words">
              {cfg.sendContent?.trim() || "—"}
            </div>
          </div>
        </div>
      </Card>

      {/* 目标明细 */}
      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 border-b bg-muted/20 flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">
            目标明细
            <span className="ml-2 text-xs text-muted-foreground font-normal">
              共 {entries.length} 个
            </span>
          </div>
          <Button asChild size="sm" variant="outline" className="h-8 gap-1.5">
            <Link to="/outreach/reach-targets" search={{ task: taskKey }}>
              <Users className="h-3.5 w-3.5" />
              查看目标资料
            </Link>
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-primary/5 hover:bg-primary/5">
              <TableHead className="min-w-[200px]">目标</TableHead>
              <TableHead className="w-[220px]">联系方式 / 明细</TableHead>
              <TableHead className="w-[100px]">类型</TableHead>
              <TableHead className="w-[90px]">积分</TableHead>
              <TableHead className="w-[170px]">执行时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.slice(0, 100).map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.targetName}</div>
                  {r.parentRef?.name && (
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {r.parentRef.name}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground break-all">
                  {r.detail ?? "—"}
                </TableCell>
                <TableCell className="text-xs">
                  {r.targetKind === "enterprise" ? "企业" : "人物"}
                </TableCell>
                <TableCell className="tabular-nums text-xs">{r.cost}</TableCell>
                <TableCell className="font-mono tabular-nums text-xs text-muted-foreground whitespace-nowrap">
                  {fmtTime(r.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/outreach/reach"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
    >
      <ArrowLeft className="h-4 w-4" />
      返回触达任务列表
    </Link>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm break-words">{value}</div>
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  if (items.length === 0) return <>—</>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((k) => (
        <span key={k} className="px-1.5 py-0.5 rounded bg-muted text-[11px]">
          {k}
        </span>
      ))}
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
      <span className="font-medium text-foreground">
        {label}
        {platform && !isWhatsApp ? ` · ${platform}` : ""}
      </span>
    </span>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "slate" | "amber" | "emerald";
}) {
  const toneMap = {
    slate: "bg-slate-50 text-slate-600 ring-slate-200",
    amber: "bg-amber-50 text-amber-600 ring-amber-200",
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-200",
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
