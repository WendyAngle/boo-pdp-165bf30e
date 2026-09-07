import { useMemo, useState } from "react";
import { createFileRoute, Link, useParams, useSearch } from "@tanstack/react-router";
import {
  ArrowLeft,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Facebook,
  Music2,
  Search,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useProspectingTasks,
  type ProspectingTarget,
  type TargetStatus,
} from "@/lib/social-tasks";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/outreach/social/reach/prospecting/$taskId")({
  validateSearch: (s: Record<string, unknown>): { status?: "all" | TargetStatus } => {
    const status = s.status;
    const allowed = ["all", "requested", "accepted", "rejected", "failed", "pending"];
    return { status: typeof status === "string" && allowed.includes(status) ? (status as "all" | TargetStatus) : undefined };
  },
  head: () => ({
    meta: [
      { title: "搜索加友任务详情 · 出海大数据平台" },
      { name: "description", content: "查看该搜索任务已请求、已通过、失败的目标详情。" },
      { property: "og:title", content: "搜索加友任务详情" },
      { property: "og:description", content: "按状态筛选目标，追踪加友进度。" },
    ],
  }),
  component: ProspectingDetailPage,
});

const STATUS_META: Record<TargetStatus, { label: string; tone: string; icon: React.ReactNode }> = {
  pending: { label: "待请求", tone: "bg-slate-100 text-slate-700 border-slate-200", icon: <Clock className="h-3 w-3" /> },
  requested: { label: "已请求", tone: "bg-sky-50 text-sky-700 border-sky-200", icon: <Clock className="h-3 w-3" /> },
  accepted: { label: "已通过", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  following: { label: "已关注", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  expired: { label: "已过期", tone: "bg-slate-100 text-slate-600 border-slate-300", icon: <Clock className="h-3 w-3" /> },
  rejected: { label: "已拒绝", tone: "bg-rose-50 text-rose-700 border-rose-200", icon: <XCircle className="h-3 w-3" /> },
  failed: { label: "失败", tone: "bg-amber-50 text-amber-700 border-amber-200", icon: <AlertTriangle className="h-3 w-3" /> },
};

function ProspectingDetailPage() {
  const { taskId } = useParams({ from: "/_app/outreach/social/reach/prospecting/$taskId" });
  const search = useSearch({ from: "/_app/outreach/social/reach/prospecting/$taskId" });
  const tasks = useProspectingTasks();
  const task = tasks.find((t) => t.id === taskId);
  const [filter, setFilter] = useState<"all" | TargetStatus>(search.status ?? "all");
  const [q, setQ] = useState("");

  const stats = useMemo(() => {
    const t = task?.targets ?? [];
    return {
      total: t.length,
      requested: t.filter((x) => x.status !== "pending").length,
      accepted: t.filter((x) => x.status === "accepted").length,
      rejected: t.filter((x) => x.status === "rejected").length,
      failed: t.filter((x) => x.status === "failed").length,
      pending: t.filter((x) => x.status === "pending").length,
    };
  }, [task]);

  const rows = useMemo(() => {
    const t = task?.targets ?? [];
    const kw = q.trim().toLowerCase();
    return t.filter((x) => {
      if (filter !== "all" && x.status !== filter) return false;
      if (kw && !`${x.name} ${x.handle}`.toLowerCase().includes(kw)) return false;
      return true;
    });
  }, [task, filter, q]);

  if (!task) {
    return (
      <div className="p-6">
        <Link to="/outreach/social/reach/prospecting" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> 返回任务列表
        </Link>
        <Card className="mt-4 p-10 text-center text-sm text-muted-foreground">未找到该任务。</Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 px-6 py-5">
        <Link to="/outreach/social/reach/prospecting" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> 返回搜索任务
        </Link>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Users className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold truncate">{task.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {task.platform.includes("Facebook") && <span className="inline-flex items-center gap-1"><Facebook className="h-3 w-3 text-sky-600" />Facebook</span>}
              {task.platform.includes("TikTok") && <span className="inline-flex items-center gap-1"><Music2 className="h-3 w-3 text-rose-600" />TikTok</span>}
              {task.region && <span>· 地区 {task.region}</span>}
              <span>· 上限 {task.targetCap}</span>
              <span>· 创建 {new Date(task.createdAt).toLocaleString()}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {task.keywords.map((k) => (
                <span key={k} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[11px]">
                  <Search className="h-2.5 w-2.5" />
                  {k}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <MetricCard label="目标总数" value={stats.total} />
        <MetricCard label="已请求" value={stats.requested} tone="sky" />
        <MetricCard label="已通过" value={stats.accepted} tone="emerald" />
        <MetricCard label="已拒绝" value={stats.rejected} tone="rose" />
        <MetricCard label="失败" value={stats.failed} tone="amber" />
        <MetricCard label="积分（已用/冻结）" value={`${task.usedCredits.toLocaleString()} / ${task.frozenCredits.toLocaleString()}`} small />
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-3.5 border-b flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm font-semibold">已请求 / 待请求目标</div>
          <div className="flex items-center gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索名称 / 账号"
              className="h-8 w-56"
            />
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="requested">已请求</SelectItem>
                <SelectItem value="accepted">已通过</SelectItem>
                <SelectItem value="rejected">已拒绝</SelectItem>
                <SelectItem value="failed">失败</SelectItem>
                <SelectItem value="pending">待请求</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">暂无匹配目标。</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>目标</TableHead>
                <TableHead className="w-[180px]">账号</TableHead>
                <TableHead className="w-[100px]">类型</TableHead>
                <TableHead className="w-[100px]">状态</TableHead>
                <TableHead className="w-[160px]">请求时间</TableHead>
                <TableHead className="w-[160px]">通过时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => <TargetRow key={r.id} r={r} />)}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function TargetRow({ r }: { r: ProspectingTarget }) {
  const m = STATUS_META[r.status];
  return (
    <TableRow>
      <TableCell className="font-medium">{r.name}</TableCell>
      <TableCell className="text-xs text-muted-foreground">{r.handle}</TableCell>
      <TableCell className="text-xs">{r.kind}</TableCell>
      <TableCell>
        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs", m.tone)}>
          {m.icon}{m.label}
        </span>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground tabular-nums">
        {r.requestedAt ? new Date(r.requestedAt).toLocaleString() : "—"}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground tabular-nums">
        {r.acceptedAt ? new Date(r.acceptedAt).toLocaleString() : "—"}
      </TableCell>
    </TableRow>
  );
}

function MetricCard({
  label,
  value,
  tone,
  small,
}: {
  label: string;
  value: number | string;
  tone?: "sky" | "emerald" | "rose" | "amber";
  small?: boolean;
}) {
  const toneCls =
    tone === "sky" ? "text-sky-700"
    : tone === "emerald" ? "text-emerald-700"
    : tone === "rose" ? "text-rose-700"
    : tone === "amber" ? "text-amber-700"
    : "text-foreground";
  return (
    <Card className="px-4 py-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-semibold tabular-nums", small ? "text-sm" : "text-xl", toneCls)}>
        {value}
      </div>
    </Card>
  );
}
