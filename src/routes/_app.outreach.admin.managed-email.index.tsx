import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Handshake, Search, Users, Sparkles, Play, AlertTriangle, FileText,
  Pause, PlayCircle, Ban, Server, Info,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ManagedStatusBadge } from "@/components/outreach/ManagedStatusBadge";
import {
  useManagedOrders,
  useManagedEngine,
  acceptManagedOrder,
  rejectManagedOrder,
  pauseManagedOrder,
  resumeManagedOrder,
  cancelManagedOrder,
  execMailboxUsage,
  espName,
  MANAGED_ESPS,
  MANAGED_MAILBOX_POOL,
  MANAGED_EMAIL_COST_PER_TARGET,
  MANAGED_EXEC_STATUS,
  managedSla,
  type ManagedOrder,
} from "@/lib/managed-email";

export const Route = createFileRoute("/_app/outreach/admin/managed-email/")({
  head: () => ({
    meta: [
      { title: "邮件托管运营 | 出海大数据平台" },
      {
        name: "description",
        content:
          "按受理、执行、结算三个阶段集中管理邮件托管触达工单，并查看发信服务商与邮箱资源的用量分布。",
      },
      { property: "og:title", content: "邮件托管运营 · 运营管理" },
      {
        property: "og:description",
        content: "受理托管需求、监控系统自动执行、掌握邮件服务商与发信邮箱用量。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManagedEmailAdminPage,
});

type Stage = "intake" | "exec" | "closed";

const STAGE_OF: Record<string, Stage> = {
  pending: "intake",
  sourcing: "exec",
  running: "exec",
  paused: "exec",
  completed: "closed",
  cancelled: "closed",
  rejected: "closed",
};

const STAGE_DESC: Record<Stage, string> = {
  intake:
    "客户提交的托管需求在此审核；受理后由系统自动寻源、按客户提交的目标语言文案发送，驳回则全额退回积分。",
  exec:
    "受理后的任务由系统自动寻源、排期、分日发送，退信 / 失败目标自动从候选池补量；人工仅在异常时暂停、恢复或中止。",
  closed:
    "已完成 / 已中止 / 已驳回的工单，按成功触达数结算，缺口部分积分已退回客户。",
};

function fmt(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function ManagedEmailAdminPage() {
  const orders = useManagedOrders();
  useManagedEngine();
  const [stage, setStage] = useState<Stage>("intake");
  const [kw, setKw] = useState("");
  const [source, setSource] = useState<"all" | "own" | "ai">("all");
  const [rejectOf, setRejectOf] = useState<ManagedOrder | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [cancelOf, setCancelOf] = useState<ManagedOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const isAbnormal = (o: ManagedOrder) => o.status === "paused" || !!o.exec?.exhausted;

  const rows = useMemo(() => {
    const k = kw.trim().toLowerCase();
    return orders
      .filter((o) => STAGE_OF[o.status] === stage)
      .filter((o) => {
        if (source !== "all" && o.source !== source) return false;
        if (!k) return true;
        return [o.orderNo, o.product, o.contact, o.company, o.market ?? ""].some((v) =>
          v.toLowerCase().includes(k),
        );
      })
      .sort((a, b) => Number(isAbnormal(b)) - Number(isAbnormal(a)));
  }, [orders, kw, source, stage]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let sent = 0;
    let success = 0;
    let bounce = 0;
    orders.forEach((o) => {
      const d = o.exec?.daily.find((x) => x.date === today);
      if (!d) return;
      sent += d.sent;
      success += d.success;
      bounce += d.bounce;
    });
    return {
      pending: orders.filter((o) => o.status === "pending").length,
      running: orders.filter((o) => MANAGED_EXEC_STATUS.includes(o.status)).length,
      sent,
      rate: sent ? Math.round((success / sent) * 100) : 0,
      bounceRate: sent ? Math.round((bounce / sent) * 100) : 0,
      abnormal: orders.filter((o) => !!o.exec && isAbnormal(o)).length,
    };
  }, [orders]);

  /** 各邮件服务商今日发信量（按执行中任务的邮箱用量聚合） */
  const espUsage = useMemo(() => {
    const map = new Map<string, { sent: number; bounce: number; boxes: Set<string> }>();
    orders.forEach((o) => {
      if (!o.exec) return;
      execMailboxUsage(o.exec).forEach((u) => {
        const cur = map.get(u.esp) ?? { sent: 0, bounce: 0, boxes: new Set<string>() };
        cur.sent += u.sent;
        cur.bounce += u.bounce;
        cur.boxes.add(u.email);
        map.set(u.esp, cur);
      });
    });
    return MANAGED_ESPS.map((e) => {
      const v = map.get(e.id);
      return {
        ...e,
        sent: v?.sent ?? 0,
        bounce: v?.bounce ?? 0,
        boxes: v ? v.boxes.size : MANAGED_MAILBOX_POOL.filter((m) => m.esp === e.id).length,
      };
    });
  }, [orders]);

  const counts = useMemo(
    () => ({
      intake: orders.filter((o) => STAGE_OF[o.status] === "intake").length,
      exec: orders.filter((o) => STAGE_OF[o.status] === "exec").length,
      closed: orders.filter((o) => STAGE_OF[o.status] === "closed").length,
    }),
    [orders],
  );

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Handshake className="h-5 w-5 text-primary" />
          邮件托管运营
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          一个页面按「受理 → 执行 → 结算」三个阶段管理全部托管工单，按成功触达数以{" "}
          {MANAGED_EMAIL_COST_PER_TARGET} 积分/目标结算。
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "待受理", value: `${stats.pending}` },
          { label: "执行中任务", value: `${stats.running}` },
          { label: "今日已发", value: `${stats.sent}` },
          { label: "今日成功率", value: `${stats.rate}%` },
          { label: "今日退信率", value: `${stats.bounceRate}%` },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">{s.value}</div>
          </Card>
        ))}
      </div>

      {stats.abnormal > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4" />
          有 {stats.abnormal} 个任务处于异常（已暂停 / 候选池不足），请优先处理。
        </div>
      )}

      {/* 邮件服务商与发信邮箱资源 */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Server className="h-4 w-4 text-primary" />
          发信资源（邮件服务商 / 邮箱）
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {espUsage.map((e) => {
            const rate = e.sent ? Math.round((e.bounce / e.sent) * 100) : 0;
            return (
              <div key={e.id} className="rounded-md border border-border p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{e.name}</span>
                  <Badge variant="secondary" className="font-normal">
                    {e.boxes} 个邮箱
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">发信域名 {e.domain}</div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  累计发出 {e.sent.toLocaleString()} 封 · 退信率{" "}
                  <span className={rate > 8 ? "text-amber-600" : ""}>{rate}%</span>
                </div>
                <Progress
                  value={Math.min(100, Math.round((e.sent / e.dailyQuota) * 100))}
                  className="h-1.5"
                />
              </div>
            );
          })}
        </div>
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5" />
          系统按邮箱健康度与服务商配额自动分配发信邮箱；退信率异常的邮箱会被自动降权或暂停。
        </div>
      </Card>

      <Tabs value={stage} onValueChange={(v) => setStage(v as Stage)}>
        <TabsList>
          <TabsTrigger value="intake">待受理（{counts.intake}）</TabsTrigger>
          <TabsTrigger value="exec">执行中（{counts.exec}）</TabsTrigger>
          <TabsTrigger value="closed">已结束（{counts.closed}）</TabsTrigger>
        </TabsList>

        {(["intake", "exec", "closed"] as Stage[]).map((s) => (
          <TabsContent key={s} value={s} className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">{STAGE_DESC[s]}</p>

            <Card className="p-0 overflow-hidden">
              <div className="px-5 py-3 flex items-center gap-3 flex-wrap border-b border-border bg-muted/20">
                <div className="relative">
                  <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={kw}
                    onChange={(e) => setKw(e.target.value)}
                    placeholder="搜索工单号 / 企业 / 推广产品"
                    className="h-9 w-[260px] pl-8 bg-background"
                  />
                </div>
                <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
                  <SelectTrigger className="h-9 w-[150px] bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部来源</SelectItem>
                    <SelectItem value="own">自有名单</SelectItem>
                    <SelectItem value="ai">AI 智能寻源</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>工单号 / 提交时间</TableHead>
                    <TableHead className="min-w-[170px]">客户企业 / 对接人</TableHead>
                    <TableHead className="min-w-[130px]">目标来源</TableHead>
                    <TableHead className="min-w-[150px]">推广产品 / 市场</TableHead>
                    <TableHead className="w-[190px]">完成进度</TableHead>
                    {s === "exec" ? (
                      <TableHead className="min-w-[160px]">发信服务商 / 邮箱</TableHead>
                    ) : (
                      <TableHead className="text-right">积分</TableHead>
                    )}
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right min-w-[230px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-sm text-muted-foreground py-12"
                      >
                        暂无符合条件的工单
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((o) => {
                    const pct = o.qty ? Math.round((o.sent / o.qty) * 100) : 0;
                    const sla = managedSla(o);
                    const usage = o.exec ? execMailboxUsage(o.exec) : [];
                    const esps = Array.from(new Set(usage.map((u) => u.esp)));
                    return (
                      <TableRow key={o.id}>
                        <TableCell>
                          <div className="font-medium tabular-nums">{o.orderNo}</div>
                          <div className="text-xs text-muted-foreground">{fmt(o.createdAt)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{o.company}</div>
                          <div className="text-xs text-muted-foreground">{o.contact}</div>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            {o.source === "own" ? (
                              <Users className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5 text-primary" />
                            )}
                            {o.source === "own" ? "自有名单" : "AI 智能寻源"}
                          </span>
                          <div className="text-xs text-muted-foreground">
                            目标语言：{o.copy.lang.toUpperCase()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{o.product}</div>
                          <div className="text-xs text-muted-foreground">{o.market || "—"}</div>
                        </TableCell>
                        <TableCell>
                          <Progress value={pct} className="h-1.5" />
                          <div className="text-xs text-muted-foreground mt-1 tabular-nums">
                            {o.sent} / {o.qty}（{pct}%）
                            {o.exec && s === "exec" ? ` · 补量 ${o.exec.delivery.refill}` : ""}
                          </div>
                        </TableCell>
                        {s === "exec" ? (
                          <TableCell>
                            <div className="text-sm">
                              {esps.map((e) => espName(e)).join(" / ") || "—"}
                            </div>
                            <div className="text-xs text-muted-foreground tabular-nums">
                              {usage.length} 个邮箱 · {o.exec?.schedule.dailyCap ?? 0} 封/天
                            </div>
                          </TableCell>
                        ) : (
                          <TableCell className="text-right text-sm tabular-nums">
                            <div>扣 {o.charged.toLocaleString()}</div>
                            {o.refunded > 0 && (
                              <div className="text-xs text-emerald-600">
                                退 {o.refunded.toLocaleString()}
                              </div>
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          <ManagedStatusBadge status={o.status} />
                          {s === "intake" && sla !== "ok" && (
                            <div
                              className={cn(
                                "mt-1 inline-flex items-center gap-1 text-[11px]",
                                sla === "overdue" ? "text-rose-600" : "text-amber-600",
                              )}
                            >
                              <AlertTriangle className="h-3 w-3" />
                              {sla === "overdue" ? "受理超时 >24h" : "预警"}
                            </div>
                          )}
                          {s === "exec" && o.exec?.exhausted && (
                            <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-600">
                              <AlertTriangle className="h-3 w-3" />
                              候选池不足
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          {o.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 gap-1 mr-1"
                                onClick={() => {
                                  acceptManagedOrder(o.id);
                                  toast.success(`工单 ${o.orderNo} 已受理，系统开始自动寻源`);
                                }}
                              >
                                <Play className="h-3.5 w-3.5" />
                                受理
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 mr-1 text-destructive hover:text-destructive"
                                onClick={() => {
                                  setRejectOf(o);
                                  setRejectReason("");
                                }}
                              >
                                驳回
                              </Button>
                            </>
                          )}
                          {(o.status === "running" || o.status === "sourcing") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 gap-1"
                              onClick={() => {
                                pauseManagedOrder(o.id, "运营手动暂停");
                                toast.success("任务已暂停");
                              }}
                            >
                              <Pause className="h-3.5 w-3.5" />
                              暂停
                            </Button>
                          )}
                          {o.status === "paused" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 gap-1"
                              onClick={() => {
                                resumeManagedOrder(o.id);
                                toast.success("任务已恢复自动执行");
                              }}
                            >
                              <PlayCircle className="h-3.5 w-3.5" />
                              恢复
                            </Button>
                          )}
                          {MANAGED_EXEC_STATUS.includes(o.status) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 gap-1 text-destructive hover:text-destructive"
                              onClick={() => {
                                setCancelOf(o);
                                setCancelReason("");
                              }}
                            >
                              <Ban className="h-3.5 w-3.5" />
                              中止
                            </Button>
                          )}
                          <Button asChild size="sm" variant="ghost" className="h-8 gap-1">
                            <Link
                              to="/outreach/admin/managed-email/$orderId"
                              params={{ orderId: o.id }}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              详情
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* 驳回 */}
      <Dialog open={!!rejectOf} onOpenChange={(v) => !v && setRejectOf(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>驳回托管工单</DialogTitle>
            <DialogDescription>
              工单 {rejectOf?.orderNo}｜驳回后该批次已扣的{" "}
              {rejectOf ? rejectOf.charged.toLocaleString() : 0} 积分将全额退回客户，原因对客户可见。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">驳回原因</Label>
            <Textarea
              id="reject-reason"
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="如：名单有效邮箱不足、目标条件过窄无法凑齐起做量、文案存在合规风险等"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOf(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={!rejectReason.trim()}
              onClick={() => {
                if (!rejectOf) return;
                rejectManagedOrder(rejectOf.id, rejectReason.trim());
                toast.success(`工单 ${rejectOf.orderNo} 已驳回，积分已退回`);
                setRejectOf(null);
              }}
            >
              确认驳回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 中止 */}
      <Dialog open={!!cancelOf} onOpenChange={(v) => !v && setCancelOf(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>中止托管任务</DialogTitle>
            <DialogDescription>
              工单 {cancelOf?.orderNo}｜未完成的 {cancelOf ? cancelOf.qty - cancelOf.sent : 0}{" "}
              个目标将按 {MANAGED_EMAIL_COST_PER_TARGET} 积分/目标退回，共{" "}
              {cancelOf
                ? ((cancelOf.qty - cancelOf.sent) * MANAGED_EMAIL_COST_PER_TARGET).toLocaleString()
                : 0}{" "}
              积分。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="exec-cancel-reason">中止原因</Label>
            <Textarea
              id="exec-cancel-reason"
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="如：客户主动叫停、候选池耗尽无法补量、邮箱资源受限等"
            />
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5" />
              中止不可撤销，已成功触达部分不退积分。
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOf(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!cancelOf) return;
                cancelManagedOrder(cancelOf.id, cancelReason.trim() || undefined);
                toast.success("任务已中止，未完成目标积分已退回");
                setCancelOf(null);
              }}
            >
              确认中止
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
