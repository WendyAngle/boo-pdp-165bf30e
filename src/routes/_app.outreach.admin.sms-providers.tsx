import { useEffect, useMemo, useState } from "react";
import { ListPagination } from "@/components/ListPagination";
import { createFileRoute } from "@tanstack/react-router";
import {
  ServerCog,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Settings2,
  ShieldOff,
  Info,
  RotateCcw,
  Plus,
  Pencil,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useSmsProviders,
  patchProvider,
  upsertProvider,
  type SmsProvider,
  type ProviderHealth,
} from "@/lib/sms-network-store";
import { FILING_CHANNELS, FILING_REGIONS, regionLabel } from "@/lib/sms-templates-store";


export const Route = createFileRoute("/_app/outreach/admin/sms-providers")({
  head: () => ({
    meta: [
      { title: "短信服务商 · 系统管理 | 出海大数据平台" },
      {
        name: "description",
        content: "查看已对接的短信服务商健康度、送达率与配额，并按国家/渠道分配容量。",
      },
    ],
  }),
  component: SmsProvidersPage,
});

type Health = ProviderHealth;
type Provider = SmsProvider;

// USD 记账口径，其他币种保留原始展示。汇率写死为演示值。
const FX_TO_USD: Record<string, number> = { USD: 1, CNY: 0.14 };

/** 统一转 USD 显示，tooltip 展示原币值 */
function formatCostUSD(cost: Provider["cost"]) {
  const usd = cost.perSegment * (FX_TO_USD[cost.currency] ?? 1);
  return `$${usd.toFixed(4)}/段`;
}
function formatCostOriginal(cost: Provider["cost"]) {
  const sym = cost.currency === "USD" ? "$" : "¥";
  return `${sym}${cost.perSegment.toFixed(4)}/段（${cost.currency}）`;
}


function SmsProvidersPage() {
  const list = useSmsProviders();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const pageData = useMemo(
    () => list.slice((page - 1) * pageSize, page * pageSize),
    [list, page],
  );
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(list.length / pageSize));
    if (page > maxPage) setPage(maxPage);
  }, [list.length, page]);

  const summary = useMemo(() => {
    const active = list.filter((p) => p.enabled);
    const avg = active.length
      ? active.reduce((s, p) => s + p.deliveryRate, 0) / active.length
      : 0;
    return {
      total: list.length,
      active: active.length,
      avg,
      degraded: list.filter((p) => p.health !== "healthy").length,
    };
  }, [list]);

  function toggle(id: string) {
    const p = list.find((x) => x.id === id);
    if (!p) return;
    if (p.health === "down") {
      toast.error("服务商已触发熔断，无法在此手动启用；请先解决底层问题");
      return;
    }
    patchProvider(id, { enabled: !p.enabled });
    toast.success("已更新服务商启用状态");
  }

  /** 熔断重置：进入观察态（paused），路由权重 0、只观测健康度，30 min 后自动恢复评估 */
  function resetToObservation(id: string) {
    patchProvider(id, { health: "paused", enabled: false, lastCheck: "刚刚" });
    toast.success("已重置为观察态，30 分钟内不参与路由，稳定后可手动启用");
  }


  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }
  function openEdit(p: Provider) {
    setEditing(p);
    setEditorOpen(true);
  }
  function handleSave(next: Provider) {
    upsertProvider(next);
    setEditorOpen(false);
    toast.success(editing ? "已更新服务商配置" : "已新增服务商，默认置为观察态");
  }


  return (
    <TooltipProvider delayDuration={200}>
    <div className="p-6 space-y-4">
      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-2xl p-6 lg:p-7 text-white"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <ServerCog className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">短信服务商</h1>
              <p className="text-white/85 text-sm mt-0.5 max-w-2xl">
                由平台统一对接多家国际/国内短信服务商，按国家、渠道类型与健康度自动分流。业务人员发短信时无需关心服务商归属。
              </p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-6 text-white shrink-0">
            <MetricBlock label="总服务商" value={summary.total} suffix="家" />
            <MetricBlock label="启用中" value={summary.active} suffix="家" />
            <MetricBlock
              label="平均送达率"
              value={(summary.avg * 100).toFixed(1) + "%"}
              warn={summary.avg <= 0.95}
              hint={summary.avg > 0.95 ? "健康" : "低于 95%"}
            />
            <MetricBlock
              label="异常/降级"
              value={summary.degraded}
              suffix="家"
              warn={summary.degraded > 0}
            />
          </div>
        </div>
      </section>

      <Card className="p-4 space-y-2 border-primary/20 bg-primary/[0.03]">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Info className="h-4 w-4 text-primary" />
          健康度判定规则（近 5 分钟滚动窗口）
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
          <RuleCell tone="ok"    label="🟢 正常"   rule="送达率 ≥95% 且 响应 <3s" />
          <RuleCell tone="warn"  label="🟡 降级"   rule="送达率 85–95% 或 响应 3–10s → 路由权重降至 50%" />
          <RuleCell tone="err"   label="🔴 异常"   rule="送达率 <85% 或 响应 >10s → 权重清零、等待人工确认" />
          <RuleCell tone="fatal" label="⛔ 熔断"   rule="连续 3 个窗口 <70% → 自动禁用，30min 后进入观察态" />
        </div>
        <div className="text-[11px] text-muted-foreground pt-1">
          说明：单位「TPS」= 条/秒；单价统一以 <strong>USD</strong> 显示，鼠标悬停可查看原币计价。熔断态下开关强制置灰，需管理员在故障排除后重置。
        </div>
      </Card>

      {/* 操作区 */}
      <div className="flex items-center justify-start gap-2">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> 新增服务商
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>服务商</TableHead>
              <TableHead>覆盖地区</TableHead>
              <TableHead>承载报备通道</TableHead>
              <TableHead>支持渠道</TableHead>

              <TableHead>健康度</TableHead>
              <TableHead>送达率</TableHead>
              <TableHead>
                TPS
                <span className="text-[10px] font-normal text-muted-foreground ml-1">(条/秒)</span>
              </TableHead>
              <TableHead>今日配额</TableHead>
              <TableHead>
                单价
                <span className="text-[10px] font-normal text-muted-foreground ml-1">(USD)</span>
              </TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.map((p) => {
              const isDown = p.health === "down";
              const effectiveEnabled = isDown ? false : p.enabled;
              return (
              <TableRow key={p.id} className={cn(isDown && "opacity-70")}>
                <TableCell>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {p.vendor} · 最近检查 {p.lastCheck}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-[220px]">
                    {p.regions.map((r) => (
                      <Badge key={r} variant="outline" className="text-[10px]">
                        {regionLabel(r)}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-[180px]">
                    {p.filingChannels.map((fc) => (
                      <Badge key={fc} variant="secondary" className="text-[10px]">
                        {FILING_CHANNELS.find((c) => c.key === fc)?.label ?? fc}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>

                  <div className="flex flex-wrap gap-1">
                    {p.channels.map((c) => (
                      <Badge
                        key={c}
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          c === "otp" && "bg-sky-50 text-sky-700 border-sky-200",
                          c === "marketing" && "bg-violet-50 text-violet-700 border-violet-200",
                          c === "notification" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                        )}
                      >
                        {c === "otp" ? "验证码" : c === "marketing" ? "营销" : "通知"}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <HealthBadge health={p.health} />
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "text-sm font-mono",
                      p.deliveryRate < 0.9 ? "text-rose-600" : p.deliveryRate < 0.95 ? "text-amber-600" : "text-emerald-600",
                    )}
                  >
                    {(p.deliveryRate * 100).toFixed(1)}%
                  </span>
                  <div className="text-[10px] text-muted-foreground">
                    响应 {(p.respMs / 1000).toFixed(1)}s
                  </div>
                </TableCell>
                <TableCell className="text-sm">{p.tps}</TableCell>
                <TableCell className="w-40">
                  <div className="flex items-center gap-2">
                    <Progress value={p.quotaUsed * 100} className="h-1.5 flex-1" />
                    <span className="text-[11px] text-muted-foreground w-9 text-right">
                      {(p.quotaUsed * 100).toFixed(0)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="font-mono cursor-help border-b border-dotted border-muted-foreground/40">
                        {formatCostUSD(p.cost)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      原币计价：{formatCostOriginal(p.cost)}
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {isDown && (
                      <>
                        <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200 gap-0.5">
                          <ShieldOff className="h-3 w-3" /> 熔断禁用
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[11px]"
                          onClick={() => resetToObservation(p.id)}
                        >
                          <RotateCcw className="h-3 w-3" />
                          重置观察
                        </Button>
                      </>
                    )}
                    {p.health === "degraded" && p.enabled && (
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                        权重 50%
                      </Badge>
                    )}
                    {p.health === "paused" && (
                      <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-200">
                        观察中
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="h-3 w-3" /> 编辑
                    </Button>
                    <Switch
                      checked={effectiveEnabled}
                      disabled={isDown || p.health === "paused"}
                      onCheckedChange={() => toggle(p.id)}
                    />
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {list.length > 0 && (
          <div className="px-4 py-3 border-t">
            <ListPagination page={page} pageSize={pageSize} total={list.length} onPageChange={setPage} />
          </div>
        )}
      </Card>

      <Card className="p-4 flex items-start gap-3 bg-amber-50/60 border-amber-200">
        <Settings2 className="h-4 w-4 text-amber-600 mt-0.5" />
        <div className="text-xs text-amber-800 leading-relaxed">
          服务商由后台统一管理，业务用户仅可见"营销 / 通知 / 验证码"三种渠道选项。
          详细路由规则见「路由策略」页面。健康度异常时，路由引擎会自动触发 Failover 到备用服务商。
        </div>
      </Card>
    </div>
    <ProviderEditor
      open={editorOpen}
      onOpenChange={setEditorOpen}
      editing={editing}
      onSave={handleSave}
    />
    </TooltipProvider>
  );
}

function ProviderEditor({
  open,
  onOpenChange,
  editing,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Provider | null;
  onSave: (p: Provider) => void;
}) {
  const isEdit = !!editing;
  const [form, setForm] = useState<Provider>(() => makeDraft(editing));
  useMemo(() => {
    if (open) setForm(makeDraft(editing));
  }, [open, editing]);

  const set = <K extends keyof Provider>(k: K, v: Provider[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  function toggleChannel(v: "marketing" | "otp" | "notification") {
    set(
      "channels",
      form.channels.includes(v)
        ? (form.channels.filter((x) => x !== v) as Provider["channels"])
        : ([...form.channels, v] as Provider["channels"]),
    );
  }

  function submit() {
    if (!form.name.trim() || !form.vendor.trim()) {
      toast.error("请填写服务商名称与厂商");
      return;
    }
    if (form.channels.length === 0) {
      toast.error("至少选择一种支持渠道");
      return;
    }
    if (form.regions.length === 0) {
      toast.error("至少选择一个覆盖地区");
      return;
    }
    if (form.filingChannels.length === 0) {
      toast.error("至少选择一个承载报备通道");
      return;
    }
    if (form.tps <= 0) {
      toast.error("TPS 需大于 0");
      return;
    }
    onSave(form);
  }


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑短信服务商" : "新增短信服务商"}</DialogTitle>
          <DialogDescription>
            仅平台管理员可见。新增服务商默认为「观察态」，通过健康度评估后再启用。
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-2">
          <Field label="名称" required>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="如：Twilio 主账号" />
          </Field>
          <Field label="厂商" required>
            <Input value={form.vendor} onChange={(e) => set("vendor", e.target.value)} placeholder="Twilio / Vonage / Aliyun" />
          </Field>
          <Field label="覆盖地区" required hint="与短信模板报备的目标地区口径一致">
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-md border p-2 max-h-32 overflow-auto">
              {FILING_REGIONS.map((r) => (
                <label key={r.key} className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={form.regions.includes(r.key)}
                    onCheckedChange={() =>
                      set(
                        "regions",
                        form.regions.includes(r.key)
                          ? form.regions.filter((x) => x !== r.key)
                          : [...form.regions, r.key],
                      )
                    }
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </Field>
          <Field label="承载报备通道" required hint="决定哪些模板报备可由该服务商发出">
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 rounded-md border p-2 max-h-32 overflow-auto">
              {FILING_CHANNELS.map((c) => (
                <label key={c.key} className="flex items-center gap-1.5 text-xs">
                  <Checkbox
                    checked={form.filingChannels.includes(c.key)}
                    onCheckedChange={() =>
                      set(
                        "filingChannels",
                        form.filingChannels.includes(c.key)
                          ? form.filingChannels.filter((x) => x !== c.key)
                          : [...form.filingChannels, c.key],
                      )
                    }
                  />
                  {c.label}
                </label>
              ))}
            </div>
          </Field>

          <Field label="支持渠道" required>
            <div className="flex items-center gap-4 h-9">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.channels.includes("otp")} onCheckedChange={() => toggleChannel("otp")} />
                验证码
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.channels.includes("marketing")} onCheckedChange={() => toggleChannel("marketing")} />
                营销
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.channels.includes("notification")} onCheckedChange={() => toggleChannel("notification")} />
                通知
              </label>
            </div>
          </Field>
          <Field label="TPS（条/秒）" required>
            <Input
              type="number"
              min={0}
              value={form.tps}
              onChange={(e) => set("tps", Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="计价币种">
            <Select value={form.cost.currency} onValueChange={(v) => set("cost", { ...form.cost, currency: v as "USD" | "CNY" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="CNY">CNY</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="单价（每段）">
            <Input
              type="number"
              min={0}
              step={0.0001}
              value={form.cost.perSegment}
              onChange={(e) => set("cost", { ...form.cost, perSegment: Number(e.target.value) || 0 })}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={submit}>{isEdit ? "保存修改" : "创建服务商"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function makeDraft(editing: Provider | null): Provider {
  if (editing)
    return {
      ...editing,
      regions: [...editing.regions],
      channels: [...editing.channels],
      filingChannels: [...editing.filingChannels],
      cost: { ...editing.cost },
    };
  return {
    id: `prov-${Date.now().toString(36)}`,
    name: "",
    vendor: "",
    regions: ["na"],
    channels: ["notification"],
    filingChannels: ["intl-a2p"],
    enabled: false,
    health: "paused",
    deliveryRate: 0,
    respMs: 0,
    tps: 50,
    quotaUsed: 0,
    cost: { currency: "USD", perSegment: 0.005 },
    lastCheck: "刚刚",
  };
}


function RuleCell({ tone, label, rule }: { tone: "ok" | "warn" | "err" | "fatal"; label: string; rule: string }) {
  return (
    <div
      className={cn(
        "rounded-md border p-2 space-y-0.5",
        tone === "ok" && "border-emerald-200 bg-emerald-50/60",
        tone === "warn" && "border-amber-200 bg-amber-50/60",
        tone === "err" && "border-rose-200 bg-rose-50/60",
        tone === "fatal" && "border-neutral-300 bg-neutral-100",
      )}
    >
      <div className="text-xs font-medium">{label}</div>
      <div className="text-[11px] text-muted-foreground leading-snug">{rule}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "warn";
}) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold",
          tone === "good" && "text-emerald-600",
          tone === "warn" && "text-amber-600",
        )}
      >
        {value}
      </div>
    </Card>
  );
}

function HealthBadge({ health }: { health: Health }) {
  return _renderHealth(health);
}

function MetricBlock({ label, value, suffix, hint, warn }: {
  label: string; value: string | number; suffix?: string; hint?: string; warn?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-white/75">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">
        {value}{suffix && <span className="text-sm font-medium text-white/80 ml-1">{suffix}</span>}
      </div>
      {hint && (
        <div className={cn("mt-0.5 text-[11px]", warn ? "text-amber-200" : "text-white/70")}>{hint}</div>
      )}
    </div>
  );
}

function _renderHealth(health: Health) {
  if (health === "healthy")
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
        <CheckCircle2 className="h-3 w-3" /> 正常
      </Badge>
    );
  if (health === "degraded")
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
        <AlertTriangle className="h-3 w-3" /> 降级
      </Badge>
    );
  if (health === "paused")
    return (
      <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 gap-1">
        <AlertTriangle className="h-3 w-3" /> 暂停
      </Badge>
    );
  return (
    <Badge variant="outline" className="bg-rose-100 text-rose-800 border-rose-300 gap-1">
      <XCircle className="h-3 w-3" /> 熔断
    </Badge>
  );
}