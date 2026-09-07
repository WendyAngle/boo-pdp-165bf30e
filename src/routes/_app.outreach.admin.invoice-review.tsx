import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  FileCheck2, Download, Settings2, Search, X, Building2, UserRound,
  CheckCircle2, XCircle, Loader2, Upload, RefreshCw, Ban, Copy,
  ShieldAlert, AlertTriangle, Clock, ChevronRight, FileText, Info,
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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ListPagination } from "@/components/ListPagination";
import {
  seedAdminInvoicesIfEmpty,
  useAdminInvoices,
  useAdminRules,
  approveInvoice,
  rejectInvoice,
  uploadInvoiceFile,
  voidInvoice,
  replaceInvoice,
  batchApprove,
  updateRules,
  exportInvoicesCsv,
  slaProgress,
  maskTaxNo,
  type AdminInvoice,
  type AdminStatus,
} from "@/lib/invoice-admin";

export const Route = createFileRoute("/_app/outreach/admin/invoice-review")({
  head: () => ({
    meta: [
      { title: "发票审核 | 出海大数据平台" },
      { name: "description", content: "集中受理租户开票申请、审核抬头、上传发票并回传" },
    ],
  }),
  component: InvoiceReviewPage,
});

const STATUS_META: Record<AdminStatus, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  pending_review: { label: "待审核", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  processing:     { label: "开票中", cls: "bg-blue-50 text-blue-700 border-blue-200", icon: Loader2 },
  issued:         { label: "已开票", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  rejected:       { label: "已驳回", cls: "bg-rose-50 text-rose-700 border-rose-200", icon: XCircle },
  voided:         { label: "已作废", cls: "bg-muted text-muted-foreground border-border", icon: Ban },
  replaced:       { label: "已换开", cls: "bg-muted text-muted-foreground border-border", icon: RefreshCw },
};

const REJECT_PRESETS = [
  "抬头与税号不匹配",
  "税号格式错误",
  "专票缺少开户信息",
  "金额与订单不符",
  "发票内容不合规",
];

type TabKey = "all" | AdminStatus;

function fmt(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function InvoiceReviewPage() {
  useEffect(() => { seedAdminInvoicesIfEmpty(); }, []);

  const list = useAdminInvoices();
  const rules = useAdminRules();

  const [tab, setTab] = useState<TabKey>("pending_review");
  const [kw, setKw] = useState("");
  const [titleFilter, setTitleFilter] = useState<"all" | "company" | "personal">("all");
  const [taxFilter, setTaxFilter] = useState<"all" | "normal" | "special">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [reviewing, setReviewing] = useState<AdminInvoice | null>(null);
  const [uploading, setUploading] = useState<AdminInvoice | null>(null);
  const [voiding, setVoiding] = useState<AdminInvoice | null>(null);
  const [replacing, setReplacing] = useState<AdminInvoice | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const stats = useMemo(() => {
    const now = Date.now();
    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const pending = list.filter((r) => r.status === "pending_review").length;
    const processing = list.filter((r) => r.status === "processing").length;
    const monthIssued = list
      .filter((r) => r.status === "issued" && r.issuedAt && new Date(r.issuedAt).getTime() >= monthStart.getTime())
      .reduce((s, r) => s + r.amount, 0);
    const reviewedTotal = list.filter((r) => r.reviewedAt).length;
    const rejectedTotal = list.filter((r) => r.status === "rejected").length;
    const rejectRate = reviewedTotal ? Math.round((rejectedTotal / reviewedTotal) * 100) : 0;
    // SLA violation count
    const overdue = list.filter((r) => {
      const s = slaProgress(r, rules);
      return s && s.pct >= 100;
    }).length;
    return { pending, processing, monthIssued, rejectRate, overdue };
  }, [list, rules]);

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase();
    return list.filter((r) => {
      if (tab !== "all" && r.status !== tab) return false;
      if (titleFilter !== "all" && r.titleType !== titleFilter) return false;
      if (taxFilter !== "all" && r.taxType !== taxFilter) return false;
      if (!k) return true;
      return (
        r.applyNo.toLowerCase().includes(k) ||
        r.title.toLowerCase().includes(k) ||
        (r.taxNo ?? "").toLowerCase().includes(k) ||
        (r.invoiceNo ?? "").toLowerCase().includes(k) ||
        r.tenantName.toLowerCase().includes(k) ||
        r.orderNos.some((o) => o.toLowerCase().includes(k))
      );
    }).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
  }, [list, tab, titleFilter, taxFilter, kw]);

  const selectableIds = filtered.filter((r) => r.status === "pending_review").map((r) => r.id);

  useEffect(() => {
    setPage(1);
  }, [tab, kw, titleFilter, taxFilter]);

  const pageData = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page],
  );
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someSelected = selectableIds.some((id) => selected.has(id));

  const toggleAll = (v: boolean) => {
    const next = new Set(selected);
    if (v) selectableIds.forEach((id) => next.add(id));
    else selectableIds.forEach((id) => next.delete(id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleExport = () => {
    const csv = exportInvoicesCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const ts = new Date().toISOString().slice(0, 10);
    a.download = `发票台账_${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${filtered.length} 条记录`);
  };

  const handleBatchApprove = () => {
    const ids = Array.from(selected).filter((id) => list.find((r) => r.id === id)?.status === "pending_review");
    if (ids.length === 0) return;
    batchApprove(ids);
    setSelected(new Set());
    toast.success(`已批量通过 ${ids.length} 条申请`);
  };

  return (
    <TooltipProvider>
      <div className="p-8 space-y-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>出海大数据平台</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span>管理后台</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">发票审核</span>
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
                <FileCheck2 className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">发票审核</h1>
                <p className="text-white/85 text-sm mt-0.5">
                  集中受理租户开票申请、审核抬头、上传发票并回传给终端用户
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setRulesOpen(true)}
                    className="h-8 bg-white/15 text-white border-white/20 hover:bg-white/25">
                    <Settings2 className="h-3.5 w-3.5 mr-1.5" /> 开票规则
                  </Button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-6 text-white shrink-0">
              <MetricBlock label="待审核" value={stats.pending} suffix="张" hint={stats.overdue > 0 ? `${stats.overdue} 张超时` : "SLA 正常"} warn={stats.overdue > 0} />
              <MetricBlock label="开票中" value={stats.processing} suffix="张" />
              <MetricBlock label="本月已开" value={`¥ ${stats.monthIssued.toLocaleString()}`} />
              <MetricBlock label="驳回率" value={`${stats.rejectRate}%`} hint="≤ 10% 为健康" />
            </div>
          </div>
        </section>

        {/* 列表卡片 */}
        <Card className="p-0 overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-border px-5 pt-3 flex-wrap">
            <TabBtn active={tab === "pending_review"} onClick={() => setTab("pending_review")}>
              <Clock className="h-3.5 w-3.5 mr-1 inline" />待审核 <Count n={list.filter((r) => r.status === "pending_review").length} />
            </TabBtn>
            <TabBtn active={tab === "processing"} onClick={() => setTab("processing")}>
              <Loader2 className="h-3.5 w-3.5 mr-1 inline" />开票中 <Count n={list.filter((r) => r.status === "processing").length} />
            </TabBtn>
            <TabBtn active={tab === "issued"} onClick={() => setTab("issued")}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1 inline" />已开票 <Count n={list.filter((r) => r.status === "issued").length} />
            </TabBtn>
            <TabBtn active={tab === "rejected"} onClick={() => setTab("rejected")}>
              <XCircle className="h-3.5 w-3.5 mr-1 inline" />已驳回 <Count n={list.filter((r) => r.status === "rejected").length} />
            </TabBtn>
            <TabBtn active={tab === "voided"} onClick={() => setTab("voided")}>
              <Ban className="h-3.5 w-3.5 mr-1 inline" />已作废/换开 <Count n={list.filter((r) => r.status === "voided" || r.status === "replaced").length} />
            </TabBtn>
            <TabBtn active={tab === "all"} onClick={() => setTab("all")}>全部 <Count n={list.length} /></TabBtn>
          </div>

          {/* Filter bar */}
          <div className="px-5 py-3 flex items-center gap-3 flex-wrap border-b border-border bg-muted/20">
            <div className="relative flex-1 min-w-[260px] max-w-md">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={kw} onChange={(e) => setKw(e.target.value)}
                placeholder="搜索申请号 / 租户 / 抬头 / 税号 / 发票号 / 订单号"
                className="pl-9 h-9 bg-background" />
            </div>
            <Select value={titleFilter} onValueChange={(v) => setTitleFilter(v as any)}>
              <SelectTrigger className="h-9 w-[130px] bg-background"><SelectValue placeholder="抬头类型" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部抬头</SelectItem>
                <SelectItem value="company">企业</SelectItem>
                <SelectItem value="personal">个人</SelectItem>
              </SelectContent>
            </Select>
            <Select value={taxFilter} onValueChange={(v) => setTaxFilter(v as any)}>
              <SelectTrigger className="h-9 w-[130px] bg-background"><SelectValue placeholder="税种" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部税种</SelectItem>
                <SelectItem value="normal">增值税普票</SelectItem>
                <SelectItem value="special">增值税专票</SelectItem>
              </SelectContent>
            </Select>
            {(kw || titleFilter !== "all" || taxFilter !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setKw(""); setTitleFilter("all"); setTaxFilter("all"); }} className="gap-1">
                <X className="h-3.5 w-3.5" /> 清除
              </Button>
            )}
            <div className="ml-auto text-sm text-muted-foreground">
              共 <span className="text-foreground font-semibold">{filtered.length}</span> 条
            </div>
          </div>

          {/* Action bar */}
          <div className="px-5 py-3 flex items-center gap-2 border-b border-border">
            <Button
              size="sm"
              disabled={!someSelected}
              onClick={handleBatchApprove}
              className="h-9"
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              批量通过{someSelected ? ` (${Array.from(selected).filter((id) => selectableIds.includes(id)).length})` : ""}
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport} className="h-9">
              <Download className="h-3.5 w-3.5 mr-1.5" /> 导出台账
            </Button>
          </div>

          {filtered.length === 0 ? (
            <div className="p-16 flex flex-col items-center text-center gap-3">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                <FileText className="h-7 w-7 text-muted-foreground" />
              </div>
              <div className="text-base font-medium">暂无符合条件的记录</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/5 hover:bg-primary/5">
                  <TableHead className="w-[40px]">
                    <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(Boolean(v))} disabled={selectableIds.length === 0} />
                  </TableHead>
                  <TableHead className="w-[160px]">申请号</TableHead>
                  <TableHead className="w-[180px]">租户</TableHead>
                  <TableHead>抬头 / 税号</TableHead>
                  <TableHead className="w-[100px]">税种</TableHead>
                  <TableHead className="w-[100px] text-right">金额</TableHead>
                  <TableHead className="w-[150px]">申请时间</TableHead>
                  <TableHead className="w-[140px]">状态 / SLA</TableHead>
                  <TableHead className="w-[210px] text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageData.map((r) => (
                  <RowView
                    key={r.id}
                    row={r}
                    rulesReviewH={rules.reviewSlaHours}
                    rulesIssueH={rules.issueSlaHours}
                    checked={selected.has(r.id)}
                    onToggle={() => toggleOne(r.id)}
                    onReview={() => setReviewing(r)}
                    onUpload={() => setUploading(r)}
                    onVoid={() => setVoiding(r)}
                    onReplace={() => setReplacing(r)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
          {filtered.length > 0 && (
            <div className="px-4 pb-4">
              <ListPagination
                page={page}
                pageSize={pageSize}
                total={filtered.length}
                onPageChange={setPage}
              />
            </div>
          )}
        </Card>

        <ReviewSheet
          record={reviewing}
          onOpenChange={(o) => { if (!o) setReviewing(null); }}
          onApprove={(id) => { approveInvoice(id); toast.success("已通过审核，进入开票中"); setReviewing(null); }}
          onReject={(id, reason) => { rejectInvoice(id, reason); toast.success("已驳回，租户可重新申请"); setReviewing(null); }}
        />

        <UploadDialog
          record={uploading}
          onOpenChange={(o) => { if (!o) setUploading(null); }}
          onSubmit={(id, data) => {
            uploadInvoiceFile(id, data);
            toast.success("发票已上传并回传给租户");
            setUploading(null);
          }}
        />

        <VoidDialog
          record={voiding}
          onOpenChange={(o) => { if (!o) setVoiding(null); }}
          onConfirm={(id, reason) => { voidInvoice(id, reason); toast.success("发票已作废"); setVoiding(null); }}
        />

        <ReplaceDialog
          record={replacing}
          onOpenChange={(o) => { if (!o) setReplacing(null); }}
          onConfirm={(id, reason) => { replaceInvoice(id, reason); toast.success("已生成换开记录，请上传新发票"); setReplacing(null); }}
        />

        <RulesDialog open={rulesOpen} onOpenChange={setRulesOpen} />
      </div>
    </TooltipProvider>
  );
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

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
      )}>
      {children}
    </button>
  );
}
function Count({ n }: { n: number }) {
  return <span className="ml-1 text-muted-foreground">{n}</span>;
}

function StatusBadge({ status }: { status: AdminStatus }) {
  const m = STATUS_META[status];
  const Icon = m.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium", m.cls)}>
      <Icon className={cn("h-3 w-3", status === "processing" && "animate-spin")} />
      {m.label}
    </span>
  );
}

function SLABar({ pct, level, label }: { pct: number; level: "ok" | "warn" | "danger"; label: string }) {
  const barCls = level === "danger" ? "bg-rose-500" : level === "warn" ? "bg-amber-500" : "bg-emerald-500";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="mt-1 space-y-0.5 cursor-help">
          <div className="h-1 rounded-full bg-muted overflow-hidden">
            <div className={cn("h-full transition-all", barCls)} style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
          <div className={cn(
            "text-[10px] tabular-nums",
            level === "danger" ? "text-rose-600" : level === "warn" ? "text-amber-600" : "text-muted-foreground",
          )}>
            {level === "danger" ? "已超时" : label}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">{label}</TooltipContent>
    </Tooltip>
  );
}

function RowView({ row, rulesReviewH, rulesIssueH, checked, onToggle, onReview, onUpload, onVoid, onReplace }: {
  row: AdminInvoice;
  rulesReviewH: number;
  rulesIssueH: number;
  checked: boolean;
  onToggle: () => void;
  onReview: () => void;
  onUpload: () => void;
  onVoid: () => void;
  onReplace: () => void;
}) {
  const sla = slaProgress(row, { minAmount: 0, monthlyLimit: 0, reviewSlaHours: rulesReviewH, issueSlaHours: rulesIssueH, specialDocs: [] });
  return (
    <TableRow className="hover:bg-muted/30">
      <TableCell>
        <Checkbox checked={checked} onCheckedChange={onToggle} disabled={row.status !== "pending_review"} />
      </TableCell>
      <TableCell className="font-mono tabular-nums text-xs">
        <div className="flex items-center gap-1">
          <span>{row.applyNo}</span>
          <button onClick={() => { navigator.clipboard.writeText(row.applyNo); toast.success("已复制"); }}
            className="opacity-50 hover:opacity-100"><Copy className="h-3 w-3" /></button>
        </div>
      </TableCell>
      <TableCell>
        <div className="text-sm font-medium truncate max-w-[170px]">{row.tenantName}</div>
        <div className="text-[11px] text-muted-foreground truncate max-w-[170px]">{row.tenantContact}</div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn(
            "h-8 w-8 rounded-md flex items-center justify-center shrink-0",
            row.titleType === "company" ? "bg-primary/10 text-primary" : "bg-accent/20 text-accent-foreground",
          )}>
            {row.titleType === "company" ? <Building2 className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate max-w-[240px]">{row.title}</div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="text-xs text-muted-foreground font-mono cursor-help">{maskTaxNo(row.taxNo)}</div>
              </TooltipTrigger>
              <TooltipContent>{row.taxNo ?? "—"}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={cn(
          "text-[11px] h-5",
          row.taxType === "special" && "border-primary/40 text-primary bg-primary/5",
        )}>
          {row.taxType === "special" ? "专票" : "普票"}
        </Badge>
      </TableCell>
      <TableCell className="text-right font-semibold tabular-nums">¥ {row.amount.toLocaleString()}</TableCell>
      <TableCell className="text-xs text-muted-foreground tabular-nums">{fmt(row.submittedAt)}</TableCell>
      <TableCell>
        <StatusBadge status={row.status} />
        {sla && <SLABar pct={sla.pct} level={sla.level} label={sla.label} />}
      </TableCell>
      <TableCell className="text-right">
        <div className="inline-flex items-center gap-1">
          {row.status === "pending_review" && (
            <Button size="sm" className="h-7" onClick={onReview}><FileCheck2 className="h-3.5 w-3.5 mr-1" />审核</Button>
          )}
          {row.status === "processing" && (
            <Button size="sm" className="h-7" onClick={onUpload}><Upload className="h-3.5 w-3.5 mr-1" />上传发票</Button>
          )}
          {row.status === "issued" && (
            <>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => toast.success(`发票 ${row.invoiceNo} 已下载（演示）`)}>
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={onReplace}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" />换开
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-rose-600 hover:text-rose-700" onClick={onVoid}>
                <Ban className="h-3.5 w-3.5 mr-1" />作废
              </Button>
            </>
          )}
          {(row.status === "rejected" || row.status === "voided" || row.status === "replaced") && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground" onClick={onReview}>
              查看
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

// ---------- Review Sheet ----------
function ReviewSheet({ record, onOpenChange, onApprove, onReject }: {
  record: AdminInvoice | null;
  onOpenChange: (o: boolean) => void;
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
}) {
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState("");
  useEffect(() => { if (record) { setRejectMode(false); setReason(""); } }, [record?.id]);
  if (!record) return null;
  const readOnly = record.status !== "pending_review";
  return (
    <Dialog open={!!record} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-primary" />
            发票申请详情
          </DialogTitle>
          <DialogDescription className="font-mono">{record.applyNo}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div className="flex items-center gap-3">
            <StatusBadge status={record.status} />
            <span className="text-xs text-muted-foreground">提交于 {fmt(record.submittedAt)}</span>
          </div>

          <Section title="租户信息">
            <Field label="租户" value={record.tenantName} />
            <Field label="联系人" value={record.tenantContact} />
            <Field label="通知邮箱" value={record.email} />
          </Section>

          <Section title="发票信息">
            <Field label="抬头类型" value={record.titleType === "company" ? "企业" : "个人"} />
            <Field label="抬头" value={record.title} />
            <Field label="税号" value={record.taxNo ?? "—"} suffix={record.taxNo && (
              <Badge variant="outline" className="text-[10px] h-4 border-emerald-300 text-emerald-700 bg-emerald-50">
                <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> 天眼查已匹配
              </Badge>
            )} />
            <Field label="税种" value={record.taxType === "special" ? "增值税专用发票" : "增值税普通发票"} />
            <Field label="金额" value={`¥ ${record.amount.toLocaleString()}`} highlight />
            <Field label="内容" value={record.content} />
          </Section>

          <Section title={`关联充值订单（${record.orderNos.length}）`}>
            <div className="space-y-1">
              {record.orderNos.map((no) => (
                <div key={no} className="flex items-center justify-between px-3 py-2 rounded-md border bg-muted/30 font-mono text-xs">
                  <span>{no}</span>
                  <span className="text-muted-foreground">充值订单</span>
                </div>
              ))}
            </div>
          </Section>

          {record.taxType === "special" && (
            <Section title="开户信息（专票）">
              <Field label="开户行" value={record.bankName ?? "—"} />
              <Field label="账号" value={record.bankAccount ?? "—"} />
              <Field label="注册地址" value={record.address ?? "—"} />
              <Field label="注册电话" value={record.phone ?? "—"} />
            </Section>
          )}

          {record.reviewedAt && (
            <Section title="审核记录">
              <Field label="审核人" value={record.reviewedBy ?? "—"} />
              <Field label="审核时间" value={fmt(record.reviewedAt)} />
              {record.rejectReason && <Field label="驳回原因" value={record.rejectReason} danger />}
            </Section>
          )}

          {record.status === "issued" && (
            <Section title="发票信息">
              <Field label="发票号" value={record.invoiceNo ?? "—"} />
              <Field label="开票时间" value={fmt(record.issuedAt)} />
              <Field label="文件" value={record.invoiceFileName ?? "—"} />
            </Section>
          )}

          {!readOnly && rejectMode && (
            <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-3 space-y-2">
              <div className="text-sm font-medium text-rose-700 flex items-center gap-1">
                <ShieldAlert className="h-4 w-4" /> 请选择驳回原因
              </div>
              <div className="flex flex-wrap gap-1.5">
                {REJECT_PRESETS.map((p) => (
                  <button key={p} onClick={() => setReason(p)}
                    className={cn(
                      "px-2 py-1 rounded-md border text-xs",
                      reason === p ? "border-rose-500 bg-rose-100 text-rose-700" : "border-border bg-background hover:border-rose-300",
                    )}>{p}</button>
                ))}
              </div>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="或自定义原因（会通知租户）" className="min-h-[70px]" />
            </div>
          )}
        </div>

        {!readOnly && (
          <DialogFooter className="px-6 py-3 border-t shrink-0 gap-2">
            {!rejectMode ? (
              <>
                <Button variant="outline" className="border-rose-300 text-rose-600 hover:bg-rose-50" onClick={() => setRejectMode(true)}>
                  <XCircle className="h-4 w-4 mr-1" /> 驳回
                </Button>
                <Button onClick={() => onApprove(record.id)}>
                  <CheckCircle2 className="h-4 w-4 mr-1" /> 通过并进入开票中
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setRejectMode(false)}>取消</Button>
                <Button variant="destructive" disabled={!reason.trim()} onClick={() => onReject(record.id, reason.trim())}>
                  确认驳回
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
function Field({ label, value, highlight, danger, suffix }: {
  label: string; value: string; highlight?: boolean; danger?: boolean; suffix?: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <div className="w-24 shrink-0 text-muted-foreground">{label}</div>
      <div className={cn(
        "flex-1 flex items-center gap-2",
        highlight && "font-semibold text-primary tabular-nums",
        danger && "text-rose-700",
      )}>
        <span>{value}</span>
        {suffix}
      </div>
    </div>
  );
}

// ---------- Upload Dialog ----------
function UploadDialog({ record, onOpenChange, onSubmit }: {
  record: AdminInvoice | null;
  onOpenChange: (o: boolean) => void;
  onSubmit: (id: string, data: { invoiceNo: string; fileName: string; issuedAt: string }) => void;
}) {
  const [invoiceNo, setInvoiceNo] = useState("");
  const [fileName, setFileName] = useState("");
  const [issuedAt, setIssuedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notify, setNotify] = useState(true);
  useEffect(() => {
    if (record) {
      setInvoiceNo("");
      setFileName("");
      setIssuedAt(new Date().toISOString().slice(0, 10));
      setNotify(true);
    }
  }, [record?.id]);
  if (!record) return null;
  return (
    <Dialog open={!!record} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" /> 上传发票
          </DialogTitle>
          <DialogDescription>
            {record.title} · ¥ {record.amount.toLocaleString()} · {record.taxType === "special" ? "专票" : "普票"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">发票号 <span className="text-rose-500">*</span></Label>
            <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="如 INV202607101234" className="mt-1 font-mono" />
          </div>
          <div>
            <Label className="text-xs">开票日期 <span className="text-rose-500">*</span></Label>
            <Input type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">发票文件 <span className="text-rose-500">*</span></Label>
            <div className="mt-1 border-2 border-dashed rounded-lg p-4 text-center hover:border-primary/50 cursor-pointer"
              onClick={() => setFileName(`invoice_${Date.now()}.pdf`)}>
              {fileName ? (
                <div className="text-sm">
                  <FileText className="h-8 w-8 mx-auto text-primary mb-1" />
                  <div className="font-medium">{fileName}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">点击可重新选择</div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  <Upload className="h-6 w-6 mx-auto mb-1" />
                  点击选择 PDF/PNG（演示：点击即模拟上传）
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Checkbox id="notify" checked={notify} onCheckedChange={(v) => setNotify(Boolean(v))} />
            <Label htmlFor="notify" className="cursor-pointer">同时发送邮件通知租户至 <span className="text-primary">{record.email}</span></Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
          <Button disabled={!invoiceNo.trim() || !fileName || !issuedAt}
            onClick={() => onSubmit(record.id, { invoiceNo: invoiceNo.trim(), fileName, issuedAt: new Date(issuedAt).toISOString() })}>
            确认上传并回传
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Void Dialog ----------
function VoidDialog({ record, onOpenChange, onConfirm }: {
  record: AdminInvoice | null;
  onOpenChange: (o: boolean) => void;
  onConfirm: (id: string, reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (record) setReason(""); }, [record?.id]);
  if (!record) return null;
  return (
    <Dialog open={!!record} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-700">
            <Ban className="h-5 w-5" /> 作废发票
          </DialogTitle>
          <DialogDescription>
            作废后金额将回滚至租户「可开票金额」。此操作不可撤销。
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
          <div><span className="text-muted-foreground">发票号：</span><span className="font-mono">{record.invoiceNo}</span></div>
          <div><span className="text-muted-foreground">抬头：</span>{record.title}</div>
          <div><span className="text-muted-foreground">金额：</span>¥ {record.amount.toLocaleString()}</div>
        </div>
        <div>
          <Label className="text-xs">作废原因 <span className="text-rose-500">*</span></Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="如：客户申请换开、金额错误等" className="mt-1 min-h-[80px]" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
          <Button variant="destructive" disabled={!reason.trim()} onClick={() => onConfirm(record.id, reason.trim())}>
            确认作废
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Replace Dialog ----------
function ReplaceDialog({ record, onOpenChange, onConfirm }: {
  record: AdminInvoice | null;
  onOpenChange: (o: boolean) => void;
  onConfirm: (id: string, reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (record) setReason(""); }, [record?.id]);
  if (!record) return null;
  return (
    <Dialog open={!!record} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" /> 换开发票
          </DialogTitle>
          <DialogDescription>
            原发票 <span className="font-mono">{record.invoiceNo}</span> 将标记为「已换开」，同时生成一条新的开票中记录待上传新发票。
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label className="text-xs">换开原因 <span className="text-rose-500">*</span></Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="如：抬头需修改、普票换专票等" className="mt-1 min-h-[80px]" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
          <Button disabled={!reason.trim()} onClick={() => onConfirm(record.id, reason.trim())}>
            生成换开记录
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Rules Dialog ----------
function RulesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const rules = useAdminRules();
  const [draft, setDraft] = useState(rules);
  useEffect(() => { if (open) setDraft(rules); }, [open, rules]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" /> 开票规则
          </DialogTitle>
          <DialogDescription>
            平台级配置，影响所有租户的发票申请与 SLA 计算
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">单笔最小金额（¥）</Label>
              <Input type="number" value={draft.minAmount} className="mt-1"
                onChange={(e) => setDraft({ ...draft, minAmount: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">单月次数上限（每租户）</Label>
              <Input type="number" value={draft.monthlyLimit} className="mt-1"
                onChange={(e) => setDraft({ ...draft, monthlyLimit: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">审核 SLA（小时）</Label>
              <Input type="number" value={draft.reviewSlaHours} className="mt-1"
                onChange={(e) => setDraft({ ...draft, reviewSlaHours: Number(e.target.value) })} />
            </div>
            <div>
              <Label className="text-xs">出票 SLA（小时）</Label>
              <Input type="number" value={draft.issueSlaHours} className="mt-1"
                onChange={(e) => setDraft({ ...draft, issueSlaHours: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <Label className="text-xs">专票所需资料</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {draft.specialDocs.map((d) => (
                <Badge key={d} variant="outline" className="text-xs">{d}</Badge>
              ))}
            </div>
          </div>
          <div className="rounded-md bg-muted/40 border p-3 text-xs text-muted-foreground flex gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <div>SLA 超时会在列表 SLA 进度条显示红色，同时在 Hero 头「待审核」指标下方提示。规则变更立即生效。</div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={() => { updateRules(draft); toast.success("开票规则已更新"); onOpenChange(false); }}>
            保存规则
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}