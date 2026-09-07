import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowLeft, Handshake, Users, Sparkles, Play, Info, Mail, Coins, Clock,
  Pause, PlayCircle, Ban, CheckCircle2, Loader2, Circle, RefreshCcw, AlertTriangle, Server,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  MANAGED_EMAIL_COST_PER_TARGET,
  MANAGED_EXEC_STATUS,
  type ManagedOrder,
} from "@/lib/managed-email";

export const Route = createFileRoute("/_app/outreach/admin/managed-email/$orderId")({
  head: () => ({
    meta: [
      { title: "工单详情 | 邮件托管运营" },
      {
        name: "description",
        content:
          "查看邮件托管触达工单的客户需求、发送文案、计费、执行管线与发信服务商邮箱用量，并进行受理、暂停或中止。",
      },
      { property: "og:title", content: "托管工单详情" },
      {
        property: "og:description",
        content: "邮件托管触达工单的需求、执行与发信资源全景视图。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManagedOrderDetailPage,
});

function fmt(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{value || "—"}</div>
    </div>
  );
}

function Section({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-medium text-sm">{title}</span>
        {desc && <span className="text-xs text-muted-foreground">{desc}</span>}
      </div>
      {children}
    </Card>
  );
}

function Stage({
  state,
  title,
  desc,
}: {
  state: "done" | "active" | "todo";
  title: string;
  desc: React.ReactNode;
}) {
  const Icon = state === "done" ? CheckCircle2 : state === "active" ? Loader2 : Circle;
  return (
    <div className="flex gap-3">
      <Icon
        className={`h-4 w-4 mt-0.5 shrink-0 ${
          state === "done"
            ? "text-emerald-500"
            : state === "active"
              ? "text-primary animate-spin"
              : "text-muted-foreground/50"
        }`}
      />
      <div className="space-y-0.5">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}

function timeline(o: ManagedOrder) {
  const items: { label: string; at?: string; note?: string }[] = [
    {
      label: "客户提交需求",
      at: o.createdAt,
      note: `${o.qty} 个目标，扣除 ${o.charged.toLocaleString()} 积分`,
    },
  ];
  if (o.status === "rejected") {
    items.push({ label: "运营驳回", at: o.updatedAt, note: o.rejectReason });
    return items;
  }
  if (o.acceptedAt) items.push({ label: "运营受理", at: o.acceptedAt, note: "系统开始自动执行" });
  if (o.exec?.sourcing.done)
    items.push({
      label: "AI 寻源完成",
      note: `有效目标 ${o.exec.sourcing.valid} 个，候选池 ${o.exec.sourcing.pool} 个`,
    });
  if (o.exec && o.exec.delivery.sent > 0)
    items.push({
      label: "自动分日发送",
      note: `已发出 ${o.exec.delivery.sent} 封，成功触达 ${o.exec.delivery.success} 个，自动补量 ${o.exec.delivery.refill} 个`,
    });
  if (o.status === "paused") items.push({ label: "已暂停", at: o.updatedAt, note: o.opsNote });
  if (o.status === "completed") items.push({ label: "任务完成", at: o.updatedAt, note: o.opsNote });
  if (o.status === "cancelled")
    items.push({
      label: "已中止",
      at: o.updatedAt,
      note: `${o.opsNote ?? ""}（退回 ${o.refunded.toLocaleString()} 积分）`,
    });
  return items;
}

function ManagedOrderDetailPage() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const orders = useManagedOrders();
  useManagedEngine();
  const o = orders.find((x) => x.id === orderId);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const logs = useMemo(() => (o?.exec ? [...o.exec.logs].reverse().slice(0, 60) : []), [o]);
  const usage = useMemo(() => (o?.exec ? execMailboxUsage(o.exec) : []), [o]);

  if (!o) {
    return (
      <div className="p-8">
        <Card className="p-12 text-center space-y-3">
          <div className="text-sm text-muted-foreground">工单不存在或已被清理</div>
          <Button asChild variant="outline">
            <Link to="/outreach/admin/managed-email">返回邮件托管运营</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const exec = o.exec;
  const pct = o.qty ? Math.round((o.sent / o.qty) * 100) : 0;
  const finished = o.status === "completed" || o.status === "cancelled";
  const successRate = exec?.delivery.sent
    ? Math.round((exec.delivery.success / exec.delivery.sent) * 100)
    : 0;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 gap-1">
            <Link to="/outreach/admin/managed-email">
              <ArrowLeft className="h-4 w-4" />
              返回邮件托管运营
            </Link>
          </Button>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Handshake className="h-5 w-5 text-primary" />
            {o.orderNo}
            <ManagedStatusBadge status={o.status} />
          </h1>
          <p className="text-sm text-muted-foreground">
            {o.company}｜{o.contact}｜提交于 {fmt(o.createdAt)}
            {exec ? `｜任务号 ${exec.taskNo}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {o.status === "pending" && (
            <>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive"
                onClick={() => {
                  setReason("");
                  setRejectOpen(true);
                }}
              >
                驳回
              </Button>
              <Button
                className="gap-1.5"
                onClick={() => {
                  acceptManagedOrder(o.id);
                  toast.success("已受理，系统开始自动寻源");
                }}
              >
                <Play className="h-4 w-4" />
                受理并自动执行
              </Button>
            </>
          )}
          {(o.status === "running" || o.status === "sourcing") && (
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                pauseManagedOrder(o.id, "运营手动暂停");
                toast.success("任务已暂停");
              }}
            >
              <Pause className="h-4 w-4" />
              暂停
            </Button>
          )}
          {o.status === "paused" && (
            <Button
              className="gap-1.5"
              onClick={() => {
                resumeManagedOrder(o.id);
                toast.success("任务已恢复自动执行");
              }}
            >
              <PlayCircle className="h-4 w-4" />
              恢复执行
            </Button>
          )}
          {MANAGED_EXEC_STATUS.includes(o.status) && (
            <Button
              variant="outline"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => {
                setCancelReason("");
                setCancelOpen(true);
              }}
            >
              <Ban className="h-4 w-4" />
              中止
            </Button>
          )}
        </div>
      </div>

      {exec?.exhausted && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4" />
          候选池已耗尽，系统正在发起增量寻源；若仍无法补足，将在结算时按缺口自动退回积分。
        </div>
      )}

      {o.status !== "pending" && (
        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">目标完成进度（成功触达 / 目标数）</span>
            <span className="tabular-nums text-muted-foreground">
              {o.sent} / {o.qty}（{pct}%）
            </span>
          </div>
          <Progress value={pct} className="h-2" />
          {exec && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-2">
              {[
                { label: "累计发出", value: exec.delivery.sent },
                { label: "成功触达", value: exec.delivery.success },
                { label: "退信 / 失败", value: exec.delivery.bounce },
                { label: "自动补量", value: exec.delivery.refill },
                {
                  label: "候选池余量",
                  value: Math.max(0, exec.sourcing.pool - exec.delivery.sent),
                },
              ].map((s) => (
                <div key={s.label} className="rounded-md bg-muted/40 px-3 py-2">
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                  <div className="text-lg font-semibold tabular-nums">{s.value}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Section icon={<Users className="h-4 w-4 text-primary" />} title="客户与需求">
          <div className="grid grid-cols-2 gap-4">
            <Field
              label="目标来源"
              value={
                <span className="inline-flex items-center gap-1.5">
                  {o.source === "own" ? (
                    <Users className="h-3.5 w-3.5" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {o.source === "own" ? "自有名单" : "AI 智能寻源"}
                </span>
              }
            />
            <Field label="目标数" value={<span className="tabular-nums">{o.qty}</span>} />
            <Field label="推广产品" value={o.product} />
            <Field label="目标市场" value={o.market} />
            <Field label="目标关键词" value={o.keywords} />
            <Field label="期望开始日" value={o.expectStartAt} />
            <Field
              label="每日发送上限"
              value={o.dailyCap ? `${o.dailyCap} 封/天` : "按邮箱健康度自动"}
            />
            <Field label="对接人" value={o.contact} />
          </div>
          {o.note && <Field label="补充说明" value={o.note} />}
        </Section>

        <Section
          icon={<Coins className="h-4 w-4 text-primary" />}
          title="计费"
          desc={`${MANAGED_EMAIL_COST_PER_TARGET} 积分 / 目标，按成功触达数结算`}
        >
          <div className="grid grid-cols-3 gap-4">
            <Field
              label="提单扣除"
              value={<span className="tabular-nums">{o.charged.toLocaleString()}</span>}
            />
            <Field
              label="已退回"
              value={
                <span className="tabular-nums text-emerald-600">
                  {o.refunded.toLocaleString()}
                </span>
              }
            />
            <Field
              label="实际消耗"
              value={
                <span className="tabular-nums">{(o.charged - o.refunded).toLocaleString()}</span>
              }
            />
          </div>
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5" />
            退信 / 失败目标不单独退款，由候选池自动补量；仅当候选池耗尽且增量寻源仍不足，或中止 / 结算时未达目标数，才按缺口退回积分。
          </div>
        </Section>
      </div>

      {exec && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Section icon={<Loader2 className="h-4 w-4 text-primary" />} title="自动执行管线">
            <div className="space-y-4">
              <Stage
                state={exec.sourcing.done ? "done" : "active"}
                title="1. AI 自动寻源"
                desc={
                  exec.sourcing.done
                    ? `抓取 ${exec.sourcing.raw} 条，去重 ${exec.sourcing.dup}、无效 ${exec.sourcing.invalid}、屏蔽 ${exec.sourcing.blocked}，有效目标 ${exec.sourcing.valid} 个，候选池 ${exec.sourcing.pool} 个`
                    : "正在按目标市场与关键词检索并校验邮箱有效性…"
                }
              />
              <Stage
                state={exec.sourcing.done ? "done" : "todo"}
                title="2. 文案就绪"
                desc={`直接使用客户提交的 ${exec.copy.lang.toUpperCase()} 文案，系统自动生成 1 封跟进信`}
              />
              <Stage
                state={exec.sourcing.done ? "done" : "todo"}
                title="3. 自动排期与邮箱分配"
                desc={`${exec.schedule.startAt} 起，${exec.schedule.dailyCap} 封/天，预计 ${exec.schedule.days} 天，使用 ${usage.length} 个发信邮箱`}
              />
              <Stage
                state={finished ? "done" : exec.delivery.sent > 0 ? "active" : "todo"}
                title="4. 分日发送与自动补量"
                desc={
                  finished
                    ? `已结束，成功触达 ${exec.delivery.success} 个，成功率 ${successRate}%`
                    : `发送中，成功率 ${successRate}%，退信目标自动由候选池替换`
                }
              />
            </div>
          </Section>

          <Section
            icon={<Server className="h-4 w-4 text-primary" />}
            title="发信服务商与邮箱"
            desc="系统按服务商配额与邮箱健康度自动分配"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>邮件服务商</TableHead>
                  <TableHead>发信邮箱</TableHead>
                  <TableHead className="text-right">已发</TableHead>
                  <TableHead className="text-right">成功</TableHead>
                  <TableHead className="text-right">退信率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usage.map((u) => (
                  <TableRow key={u.email}>
                    <TableCell className="text-sm">
                      <Badge variant="secondary" className="font-normal">
                        {espName(u.esp)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{u.sent}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm text-emerald-600">
                      {u.success}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {u.sent ? Math.round((u.bounce / u.sent) * 100) : 0}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Section>
        </div>
      )}

      <Section
        icon={<Mail className="h-4 w-4 text-primary" />}
        title="发送文案（客户提交，只读）"
        desc={`目标语言 ${o.copy.lang.toUpperCase()}`}
      >
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">中文原文</div>
            <div className="rounded-md border border-border p-3 space-y-2">
              <div className="text-sm font-medium">{o.copy.subject}</div>
              <div className="text-sm whitespace-pre-wrap text-muted-foreground">{o.copy.body}</div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">目标语言译文（实际发送版本）</div>
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
              <div className="text-sm font-medium">
                {o.copy.translatedSubject || o.copy.subject}
              </div>
              <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                {o.copy.translatedBody || o.copy.body}
              </div>
            </div>
          </div>
        </div>
        {exec && (
          <div className="rounded-md bg-muted/40 p-3 space-y-1">
            <div className="text-xs text-muted-foreground">跟进信（系统按模板自动生成）</div>
            <div className="text-sm font-medium">{exec.copy.followupSubject}</div>
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">
              {exec.copy.followupBody}
            </div>
          </div>
        )}
      </Section>

      {exec && (
        <Card className="p-0 overflow-hidden">
          <Tabs defaultValue="daily">
            <div className="px-5 pt-4">
              <TabsList>
                <TabsTrigger value="daily">分日执行</TabsTrigger>
                <TabsTrigger value="logs">发送明细</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="daily" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>日期</TableHead>
                    <TableHead className="text-right">计划</TableHead>
                    <TableHead className="text-right">已发</TableHead>
                    <TableHead className="text-right">成功</TableHead>
                    <TableHead className="text-right">退信</TableHead>
                    <TableHead className="text-right">自动补量</TableHead>
                    <TableHead className="text-right">成功率</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exec.daily.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-sm text-muted-foreground py-10"
                      >
                        尚未开始发送
                      </TableCell>
                    </TableRow>
                  )}
                  {exec.daily.map((d) => (
                    <TableRow key={d.date}>
                      <TableCell className="tabular-nums">{d.date}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.plan}</TableCell>
                      <TableCell className="text-right tabular-nums">{d.sent}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">
                        {d.success}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">
                        {d.bounce}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{d.refill}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {d.sent ? Math.round((d.success / d.sent) * 100) : 0}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
            <TabsContent value="logs" className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>时间</TableHead>
                    <TableHead>目标企业</TableHead>
                    <TableHead>联系邮箱</TableHead>
                    <TableHead>发信邮箱 / 服务商</TableHead>
                    <TableHead className="text-right">结果</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-sm text-muted-foreground py-10"
                      >
                        暂无发送记录
                      </TableCell>
                    </TableRow>
                  )}
                  {logs.map((l, i) => {
                    const box = usage.length ? usage[i % usage.length] : null;
                    return (
                      <TableRow key={`${l.email}-${i}`}>
                        <TableCell className="tabular-nums text-sm">{fmtTime(l.at)}</TableCell>
                        <TableCell className="text-sm">{l.company}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{l.email}</TableCell>
                        <TableCell className="text-sm">
                          {box ? (
                            <>
                              <div>{box.email}</div>
                              <div className="text-xs text-muted-foreground">
                                {espName(box.esp)}
                              </div>
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {l.state === "success" && (
                            <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10">
                              成功触达
                            </Badge>
                          )}
                          {l.state === "bounce" && <Badge variant="destructive">退信</Badge>}
                          {l.state === "refilled" && (
                            <Badge variant="secondary" className="gap-1">
                              <RefreshCcw className="h-3 w-3" />
                              已自动补量
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </Card>
      )}

      <Section icon={<Clock className="h-4 w-4 text-primary" />} title="执行时间线">
        <ol className="space-y-3">
          {timeline(o).map((t, i) => (
            <li key={i} className="flex gap-3">
              <div className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
              <div className="space-y-0.5">
                <div className="text-sm font-medium">
                  {t.label}
                  {t.at && (
                    <span className="ml-2 text-xs text-muted-foreground font-normal">
                      {fmt(t.at)}
                    </span>
                  )}
                </div>
                {t.note && <div className="text-xs text-muted-foreground">{t.note}</div>}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>驳回托管工单</DialogTitle>
            <DialogDescription>
              驳回后已扣的 {o.charged.toLocaleString()} 积分将全额退回客户，原因对客户可见。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="detail-reject">驳回原因</Label>
            <Textarea
              id="detail-reject"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="如：名单有效邮箱不足、目标条件过窄、文案存在合规风险等"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim()}
              onClick={() => {
                rejectManagedOrder(o.id, reason.trim());
                toast.success("已驳回，积分已退回客户");
                setRejectOpen(false);
                navigate({ to: "/outreach/admin/managed-email" });
              }}
            >
              确认驳回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>中止托管任务</DialogTitle>
            <DialogDescription>
              未完成的 {o.qty - o.sent} 个目标将按 {MANAGED_EMAIL_COST_PER_TARGET} 积分/目标退回，共{" "}
              {((o.qty - o.sent) * MANAGED_EMAIL_COST_PER_TARGET).toLocaleString()} 积分。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="exec-detail-cancel">中止原因</Label>
            <Textarea
              id="exec-detail-cancel"
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="如：客户主动叫停、候选池耗尽无法补量等"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                cancelManagedOrder(o.id, cancelReason.trim() || undefined);
                toast.success("任务已中止，未完成目标积分已退回");
                setCancelOpen(false);
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
