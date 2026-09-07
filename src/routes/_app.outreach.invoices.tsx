import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import {
  FileText, ChevronRight, Wallet, Plus, Building2, UserRound, Search, X,
  Download, Mail, Check, Loader2, AlertTriangle, Pencil, Trash2, Star, CheckCircle2,
  Receipt, Send, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { seedDemoLedgerIfEmpty } from "@/lib/credits-ledger";
import {
  seedInvoicesIfEmpty,
  useInvoiceProfiles,
  useInvoiceRequests,
  useInvoiceableRecharges,
  saveProfile,
  deleteProfile,
  setDefaultProfile,
  createInvoiceRequest,
  cancelInvoiceRequest,
  type InvoiceProfile,
  type InvoiceRequest,
  type InvoiceStatus,
  type InvoiceTitleType,
  type InvoiceTaxType,
} from "@/lib/invoices";

export const Route = createFileRoute("/_app/outreach/invoices")({
  head: () => ({
    meta: [
      { title: "出海大数据平台 · 发票 | 出海大数据平台" },
      { name: "description", content: "发票申请、抬头管理与历史记录" },
    ],
  }),
  validateSearch: (s) =>
    z.object({
      action: z.enum(["apply"]).optional(),
      orderNo: z.string().optional(),
      tab: z.enum(["all", "pending", "issued", "rejected"]).optional(),
    }).parse(s),
  component: InvoicesPage,
});

function fmtTime(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function InvoicesPage() {
  const search = Route.useSearch();
  useEffect(() => {
    seedDemoLedgerIfEmpty();
    seedInvoicesIfEmpty();
  }, []);

  const profiles = useInvoiceProfiles();
  const requests = useInvoiceRequests();
  const invoiceable = useInvoiceableRecharges();

  const [applyOpen, setApplyOpen] = useState(false);
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [presetOrder, setPresetOrder] = useState<string | undefined>();
  const [tab, setTab] = useState<"all" | InvoiceStatus>(search.tab ?? "all");
  const [kw, setKw] = useState("");

  useEffect(() => {
    if (search.action === "apply") {
      setPresetOrder(search.orderNo);
      setApplyOpen(true);
    }
  }, [search.action, search.orderNo]);

  const stats = useMemo(() => {
    const invoiceableAmt = invoiceable.reduce((s, e) => s + (e.price ?? 0), 0);
    const issuedAmt = requests.filter((r) => r.status === "issued").reduce((s, r) => s + r.amount, 0);
    const yearAmt = requests
      .filter((r) => r.status === "issued" && new Date(r.issuedAt ?? r.createdAt).getFullYear() === new Date().getFullYear())
      .reduce((s, r) => s + r.amount, 0);
    const pendingCount = requests.filter((r) => r.status === "pending").length;
    return { invoiceableAmt, issuedAmt, yearAmt, pendingCount };
  }, [invoiceable, requests]);

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase();
    return requests.filter((r) => {
      if (tab !== "all" && r.status !== tab) return false;
      if (!k) return true;
      return (
        r.title.toLowerCase().includes(k) ||
        (r.invoiceNo ?? "").toLowerCase().includes(k) ||
        r.orderNos.some((o) => o.toLowerCase().includes(k))
      );
    });
  }, [requests, tab, kw]);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>出海大数据平台</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>费用中心</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">发票</span>
      </div>

      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-2xl p-6 lg:p-7 text-white"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute right-16 top-4 h-24 w-24 rounded-2xl bg-white/10 backdrop-blur-sm rotate-12" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">发票管理</h1>
              <p className="text-white/85 text-sm mt-0.5">
                为已完成的充值订单申请发票、管理抬头与下载历史发票
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  className="h-8 bg-white text-primary hover:bg-white/90 font-medium"
                  onClick={() => { setPresetOrder(undefined); setApplyOpen(true); }}
                  disabled={invoiceable.length === 0}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  申请开票
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setProfilesOpen(true)}
                  className="h-8 bg-white/15 text-white border-white/20 hover:bg-white/25"
                >
                  <Building2 className="h-3.5 w-3.5 mr-1.5" />
                  抬头管理 ({profiles.length})
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant="secondary"
                  className="h-8 bg-white/15 text-white border-white/20 hover:bg-white/25"
                >
                  <Link to="/outreach/billing">
                    <Receipt className="h-3.5 w-3.5 mr-1.5" />
                    查看账单
                  </Link>
                </Button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6 text-white shrink-0">
            <div>
              <div className="text-xs text-white/75">可开票金额</div>
              <div className="mt-1 text-2xl font-bold tabular-nums">¥ {stats.invoiceableAmt.toLocaleString()}</div>
              <div className="mt-0.5 text-[11px] text-white/70 tabular-nums">{invoiceable.length} 个订单</div>
            </div>
            <div>
              <div className="text-xs text-white/75">已开票金额</div>
              <div className="mt-1 text-2xl font-bold tabular-nums">¥ {stats.issuedAmt.toLocaleString()}</div>
              {stats.pendingCount > 0 && (
                <div className="mt-0.5 text-[11px] text-amber-200 inline-flex items-center gap-1">
                  <Loader2 className="h-3 w-3" /> {stats.pendingCount} 张处理中
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-white/75">本年度累计</div>
              <div className="mt-1 text-2xl font-bold tabular-nums">¥ {stats.yearAmt.toLocaleString()}</div>
              <div className="mt-0.5 text-[11px] text-white/70">{new Date().getFullYear()} 年</div>
            </div>
          </div>
        </div>
      </section>

      {/* 可开票提示条 */}
      {invoiceable.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm">
            <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div>
              <div className="font-medium text-foreground">
                有 {invoiceable.length} 笔充值订单可开票，共 ¥ {stats.invoiceableAmt.toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                建议在 90 天内申请，避免跨年度合规风险
              </div>
            </div>
          </div>
          <Button size="sm" className="h-8" onClick={() => { setPresetOrder(undefined); setApplyOpen(true); }}>
            立即申请
          </Button>
        </div>
      )}

      {/* 列表卡片 */}
      <Card className="p-0 overflow-hidden">
        <div className="flex items-center gap-1 border-b border-border px-5 pt-3">
          <TabBtn active={tab === "all"} onClick={() => setTab("all")}>
            全部 <span className="ml-1 text-muted-foreground">{requests.length}</span>
          </TabBtn>
          <TabBtn active={tab === "pending"} onClick={() => setTab("pending")}>
            <Loader2 className="h-3.5 w-3.5 mr-1 inline" />
            开票中 <span className="ml-1 text-muted-foreground">{requests.filter((r) => r.status === "pending").length}</span>
          </TabBtn>
          <TabBtn active={tab === "issued"} onClick={() => setTab("issued")}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1 inline" />
            已开票 <span className="ml-1 text-muted-foreground">{requests.filter((r) => r.status === "issued").length}</span>
          </TabBtn>
          <TabBtn active={tab === "rejected"} onClick={() => setTab("rejected")}>
            <X className="h-3.5 w-3.5 mr-1 inline" />
            已驳回 <span className="ml-1 text-muted-foreground">{requests.filter((r) => r.status === "rejected").length}</span>
          </TabBtn>
        </div>
        <div className="px-5 py-3 flex items-center gap-3 flex-wrap border-b border-border bg-muted/20">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              placeholder="搜索发票号 / 抬头 / 订单号"
              className="pl-9 h-9 bg-background"
            />
          </div>
          {kw && (
            <Button variant="ghost" size="sm" onClick={() => setKw("")} className="gap-1">
              <X className="h-3.5 w-3.5" /> 清除
            </Button>
          )}
          <div className="text-sm text-muted-foreground ml-auto">
            共 <span className="text-foreground font-semibold">{filtered.length}</span> 张
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-16 flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <FileText className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="text-base font-medium">暂无发票记录</div>
            <div className="text-sm text-muted-foreground max-w-md">
              充值订单完成后即可在此申请开票。还未充值？
              <Link to="/outreach/recharge" search={{ from: "billing" }} className="text-primary hover:underline ml-1">
                去充值
              </Link>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/5 hover:bg-primary/5">
                <TableHead className="w-[160px]">申请时间</TableHead>
                <TableHead className="w-[180px]">发票号</TableHead>
                <TableHead>抬头</TableHead>
                <TableHead className="w-[120px]">类型</TableHead>
                <TableHead className="w-[120px] text-right">金额</TableHead>
                <TableHead className="w-[110px]">关联订单</TableHead>
                <TableHead className="w-[100px]">状态</TableHead>
                <TableHead className="w-[200px] text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono tabular-nums text-xs text-muted-foreground">
                    {fmtTime(r.createdAt)}
                  </TableCell>
                  <TableCell className="font-mono tabular-nums text-xs">
                    {r.invoiceNo ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn(
                        "h-8 w-8 rounded-md flex items-center justify-center shrink-0",
                        r.titleType === "company" ? "bg-primary/10 text-primary" : "bg-accent/20 text-accent-foreground",
                      )}>
                        {r.titleType === "company" ? <Building2 className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{r.title}</div>
                        {r.taxNo && <div className="text-xs text-muted-foreground font-mono">{r.taxNo}</div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(
                      "text-[11px] h-5",
                      r.taxType === "special" && "border-primary/40 text-primary bg-primary/5",
                    )}>
                      {r.taxType === "special" ? "增值税专票" : "增值税普票"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">¥ {r.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.orderNos.length} 个订单
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                    {r.status === "pending" && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">预计 1–3 工作日</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.status === "issued" ? (
                      <div className="inline-flex items-center gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => toast.success("发票 PDF 已开始下载（演示）")}>
                          <Download className="h-3.5 w-3.5 mr-1" /> 下载
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => toast.success(`已重新发送至 ${r.email}`)}>
                          <Mail className="h-3.5 w-3.5 mr-1" /> 重发
                        </Button>
                      </div>
                    ) : r.status === "pending" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-muted-foreground hover:text-rose-600"
                        onClick={() => {
                          cancelInvoiceRequest(r.id);
                          toast.success("已撤销开票申请");
                        }}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" /> 撤销申请
                      </Button>
                    ) : (
                      <span className="text-xs text-rose-600">{r.rejectReason ?? "信息有误"}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ApplyInvoiceSheet
        open={applyOpen}
        onOpenChange={(v) => { setApplyOpen(v); if (!v) setPresetOrder(undefined); }}
        profiles={profiles}
        invoiceable={invoiceable}
        presetOrderNo={presetOrder}
        onOpenProfiles={() => setProfilesOpen(true)}
      />
      <ProfilesSheet open={profilesOpen} onOpenChange={setProfilesOpen} profiles={profiles} />
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: InvoiceStatus }) {
  if (status === "issued") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium bg-emerald-50 text-emerald-700 border-emerald-200">
        <CheckCircle2 className="h-3 w-3" /> 已开票
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium bg-rose-50 text-rose-700 border-rose-200">
        <X className="h-3 w-3" /> 已驳回
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium bg-amber-50 text-amber-700 border-amber-200">
      <Loader2 className="h-3 w-3" /> 开票中
    </span>
  );
}

/* -------------------- Apply Sheet -------------------- */

function ApplyInvoiceSheet({
  open, onOpenChange, profiles, invoiceable, presetOrderNo, onOpenProfiles,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profiles: InvoiceProfile[];
  invoiceable: ReturnType<typeof useInvoiceableRecharges>;
  presetOrderNo?: string;
  onOpenProfiles: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [profileId, setProfileId] = useState<string | undefined>();
  const [taxType, setTaxType] = useState<InvoiceTaxType>("normal");
  const [content, setContent] = useState("信息技术服务费");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const def = profiles.find((p) => p.isDefault) ?? profiles[0];
    setProfileId(def?.id);
    setEmail(def?.email ?? "");
    if (presetOrderNo) {
      setSelected(new Set([presetOrderNo]));
    } else {
      setSelected(new Set());
    }
    setTaxType("normal");
    setContent("信息技术服务费");
  }, [open, presetOrderNo, profiles]);

  const amount = useMemo(
    () => invoiceable.filter((e) => e.orderNo && selected.has(e.orderNo)).reduce((s, e) => s + (e.price ?? 0), 0),
    [invoiceable, selected],
  );

  const profile = profiles.find((p) => p.id === profileId);

  function toggle(orderNo: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(orderNo)) next.delete(orderNo); else next.add(orderNo);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(invoiceable.map((e) => e.orderNo!).filter(Boolean)));
  }

  function submit() {
    if (selected.size === 0) return toast.error("请至少选择一笔订单");
    if (!profile) return toast.error("请选择发票抬头");
    if (!email) return toast.error("请填写接收邮箱");
    if (taxType === "special" && profile.type === "personal") {
      return toast.error("个人抬头不支持增值税专票");
    }
    setSubmitting(true);
    const req = createInvoiceRequest({
      orderNos: [...selected],
      amount,
      titleType: profile.type,
      title: profile.title,
      taxNo: profile.taxNo,
      taxType,
      content,
      email,
    });
    window.setTimeout(() => {
      setSubmitting(false);
      onOpenChange(false);
      toast.success("开票申请已提交", {
        description: `共 ¥ ${amount.toLocaleString()} · 预计 1–3 工作日出票并发送至 ${email}`,
        icon: <Check className="h-4 w-4" />,
      });
    }, 800);
    void req;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> 申请开票
          </DialogTitle>
          <DialogDescription>选择充值订单、抬头与发票类型，提交后由财务系统开具</DialogDescription>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          {/* Step 1 选订单 */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold flex items-center justify-center">1</span>
                选择充值订单
              </h3>
              {invoiceable.length > 0 && (
                <Button size="sm" variant="ghost" className="h-7" onClick={selectAll}>全选</Button>
              )}
            </div>
            <div className="rounded-lg border bg-card max-h-64 overflow-y-auto divide-y">
              {invoiceable.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  暂无可开票订单，
                  <Link to="/outreach/recharge" search={{ from: "billing" }} className="text-primary hover:underline">
                    去充值
                  </Link>
                </div>
              ) : (
                invoiceable.map((e) => {
                  const checked = e.orderNo ? selected.has(e.orderNo) : false;
                  return (
                    <label
                      key={e.id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors",
                        checked ? "bg-primary/5" : "hover:bg-muted/40",
                      )}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => e.orderNo && toggle(e.orderNo)} />
                      <Wallet className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{e.targetName}</div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {e.orderNo} · {fmtTime(e.createdAt)}
                        </div>
                      </div>
                      <div className="text-sm font-semibold tabular-nums">¥ {(e.price ?? 0).toLocaleString()}</div>
                    </label>
                  );
                })
              )}
            </div>
          </section>

          {/* Step 2 抬头 */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold flex items-center justify-center">2</span>
                发票抬头
              </h3>
              <Button size="sm" variant="ghost" className="h-7" onClick={onOpenProfiles}>
                <Plus className="h-3.5 w-3.5 mr-1" /> 管理抬头
              </Button>
            </div>
            {profiles.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <div className="text-sm text-muted-foreground mb-2">尚未添加抬头</div>
                <Button size="sm" onClick={onOpenProfiles}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> 新增抬头
                </Button>
              </div>
            ) : (
              <RadioGroup value={profileId} onValueChange={(v) => { setProfileId(v); const p = profiles.find((x) => x.id === v); if (p) setEmail(p.email); }} className="space-y-2">
                {profiles.map((p) => (
                  <Label
                    key={p.id}
                    htmlFor={`pf-${p.id}`}
                    className={cn(
                      "flex items-start gap-3 rounded-lg ring-1 p-3 cursor-pointer transition-all",
                      profileId === p.id ? "ring-2 ring-primary bg-primary/5" : "ring-border bg-card hover:ring-primary/40",
                    )}
                  >
                    <RadioGroupItem id={`pf-${p.id}`} value={p.id} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {p.type === "company" ? <Building2 className="h-3.5 w-3.5 text-primary" /> : <UserRound className="h-3.5 w-3.5 text-accent-foreground" />}
                        <span className="text-sm font-medium truncate">{p.title}</span>
                        {p.isDefault && <Badge variant="outline" className="text-[10px] h-4 px-1.5">默认</Badge>}
                      </div>
                      {p.taxNo && <div className="text-xs text-muted-foreground font-mono mt-0.5">{p.taxNo}</div>}
                    </div>
                  </Label>
                ))}
              </RadioGroup>
            )}
          </section>

          {/* Step 3 发票信息 */}
          <section>
            <div className="flex items-center mb-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold flex items-center justify-center">3</span>
                发票信息
              </h3>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">发票类型</Label>
                <Select value={taxType} onValueChange={(v) => setTaxType(v as InvoiceTaxType)}>
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">增值税普通发票</SelectItem>
                    <SelectItem value="special" disabled={profile?.type === "personal"}>
                      增值税专用发票{profile?.type === "personal" && "（仅企业抬头）"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">开票内容</Label>
                <Input value={content} onChange={(e) => setContent(e.target.value)} className="h-9 mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">接收邮箱</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="finance@example.com"
                  className="h-9 mt-1"
                />
              </div>
            </div>
          </section>

          {/* 汇总 */}
          <div className="rounded-xl bg-muted/40 p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">订单数</span><span className="font-medium tabular-nums">{selected.size}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">发票类型</span><span className="font-medium">{taxType === "special" ? "增值税专票" : "增值税普票"}</span></div>
            <Separator />
            <div className="flex justify-between items-baseline">
              <span className="text-muted-foreground">开票金额</span>
              <span className="text-xl font-bold text-primary tabular-nums">¥ {amount.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6 gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={submit} disabled={submitting || selected.size === 0}>
            {submitting ? (<><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> 提交中…</>) : (<><Send className="h-4 w-4 mr-1.5" /> 提交申请</>)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------- Profiles Sheet -------------------- */

function ProfilesSheet({ open, onOpenChange, profiles }: { open: boolean; onOpenChange: (v: boolean) => void; profiles: InvoiceProfile[] }) {
  const [editing, setEditing] = useState<InvoiceProfile | null>(null);
  const [mode, setMode] = useState<"list" | "form">("list");

  useEffect(() => {
    if (open) { setMode("list"); setEditing(null); }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> 发票抬头管理
          </DialogTitle>
          <DialogDescription>维护企业 / 个人抬头，开票时一键选用</DialogDescription>
        </DialogHeader>

        {mode === "list" ? (
          <div className="mt-6 space-y-3">
            <Button className="w-full" variant="outline" onClick={() => { setEditing(null); setMode("form"); }}>
              <Plus className="h-4 w-4 mr-1.5" /> 新增抬头
            </Button>
            {profiles.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                暂无抬头，点击上方按钮新增
              </div>
            ) : (
              profiles.map((p) => (
                <div key={p.id} className="rounded-lg ring-1 ring-border bg-card p-4">
                  <div className="flex items-start gap-2">
                    <div className={cn(
                      "h-9 w-9 rounded-md flex items-center justify-center shrink-0",
                      p.type === "company" ? "bg-primary/10 text-primary" : "bg-accent/20 text-accent-foreground",
                    )}>
                      {p.type === "company" ? <Building2 className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{p.title}</span>
                        {p.isDefault && <Badge variant="outline" className="text-[10px] h-4 px-1.5">默认</Badge>}
                      </div>
                      {p.taxNo && <div className="text-xs text-muted-foreground font-mono mt-0.5">{p.taxNo}</div>}
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">{p.email}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1">
                    {!p.isDefault && (
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setDefaultProfile(p.id); toast.success("已设为默认抬头"); }}>
                        <Star className="h-3.5 w-3.5 mr-1" /> 设为默认
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setEditing(p); setMode("form"); }}>
                      <Pencil className="h-3.5 w-3.5 mr-1" /> 编辑
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-rose-600 hover:text-rose-700 ml-auto" onClick={() => { deleteProfile(p.id); toast.success("已删除"); }}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> 删除
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <ProfileForm
            initial={editing}
            onCancel={() => setMode("list")}
            onSave={(data) => {
              saveProfile(editing ? { ...data, id: editing.id } : data);
              toast.success(editing ? "已更新抬头" : "已新增抬头");
              setMode("list");
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProfileForm({
  initial, onCancel, onSave,
}: {
  initial: InvoiceProfile | null;
  onCancel: () => void;
  onSave: (data: Omit<InvoiceProfile, "id">) => void;
}) {
  const [type, setType] = useState<InvoiceTitleType>(initial?.type ?? "company");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [taxNo, setTaxNo] = useState(initial?.taxNo ?? "");
  const [bankName, setBankName] = useState(initial?.bankName ?? "");
  const [bankAccount, setBankAccount] = useState(initial?.bankAccount ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [isDefault, setIsDefault] = useState<boolean>(!!initial?.isDefault);

  function submit() {
    if (!title) return toast.error("请填写抬头名称");
    if (type === "company" && !taxNo) return toast.error("请填写税号");
    if (!email) return toast.error("请填写接收邮箱");
    onSave({ type, title, taxNo: type === "company" ? taxNo : undefined, bankName, bankAccount, address, phone, email, isDefault });
  }

  return (
    <div className="mt-6 space-y-4">
      <div>
        <Label className="text-xs text-muted-foreground">抬头类型</Label>
        <RadioGroup value={type} onValueChange={(v) => setType(v as InvoiceTitleType)} className="grid grid-cols-2 gap-2 mt-1">
          {(["company", "personal"] as const).map((t) => (
            <Label
              key={t}
              htmlFor={`t-${t}`}
              className={cn(
                "flex items-center gap-2 rounded-lg ring-1 p-3 cursor-pointer",
                type === t ? "ring-2 ring-primary bg-primary/5" : "ring-border",
              )}
            >
              <RadioGroupItem id={`t-${t}`} value={t} />
              {t === "company" ? <Building2 className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
              <span className="text-sm">{t === "company" ? "企业单位" : "个人 / 非企业"}</span>
            </Label>
          ))}
        </RadioGroup>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">{type === "company" ? "单位名称" : "姓名"} *</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 mt-1" />
      </div>
      {type === "company" && (
        <div>
          <Label className="text-xs text-muted-foreground">统一社会信用代码 / 税号 *</Label>
          <Input value={taxNo} onChange={(e) => setTaxNo(e.target.value)} className="h-9 mt-1 font-mono" />
        </div>
      )}
      {type === "company" && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">开户行</Label>
            <Input value={bankName} onChange={(e) => setBankName(e.target.value)} className="h-9 mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">银行账号</Label>
            <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className="h-9 mt-1 font-mono" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">注册地址</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} className="h-9 mt-1" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">注册电话</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-9 mt-1" />
          </div>
        </div>
      )}
      <div>
        <Label className="text-xs text-muted-foreground">接收邮箱 *</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9 mt-1" />
      </div>
      <Label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox checked={isDefault} onCheckedChange={(v) => setIsDefault(!!v)} />
        设为默认抬头
      </Label>
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>取消</Button>
        <Button onClick={submit}>保存</Button>
      </div>
    </div>
  );
}
