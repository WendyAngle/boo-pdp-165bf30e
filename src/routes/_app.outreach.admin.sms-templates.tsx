import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, Plus, CheckCircle2, Clock, XCircle, Copy, Pencil, Undo2, Eye, Sparkles, AlertTriangle, Send, Radio, ShieldCheck, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp, RefreshCw, Settings2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ListPagination } from "@/components/ListPagination";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useSmsTemplates,
  addSmsTemplate,
  updateSmsTemplate,
  withdrawSmsTemplate,
  approveSmsTemplate,
  rejectSmsTemplate,
  type SmsTemplate as Tpl,
  type SmsTplStatus as Status,
  useSmsFilings,
  useSmsApplications,
  upsertFiling,
  approveApplication,
  rejectApplication,
  getFilingsByTemplate,
  getTemplateApprovedRegions,
  getFilingSummary,
  renewFiling,
  FILING_CHANNELS,
  FILING_REGIONS,
  regionLabel,
  type FilingChannel,
  type FilingStatus,
  type TemplateFiling,
  type TemplateApplication,
  getTemplateBlockedRegions,
} from "@/lib/sms-templates-store";
import { useSmsProviders, carriersFor, isProviderRoutable } from "@/lib/sms-network-store";


/** 按渠道给出默认目标地区建议 */
function defaultRegionsForChannel(ch: FilingChannel): string[] {
  if (ch === "cmcc" || ch === "unicom" || ch === "telecom") return ["cn"];
  if (ch === "intl-a2p") return ["na", "eu"];
  return [];
}


export const Route = createFileRoute("/_app/outreach/admin/sms-templates")({
  head: () => ({
    meta: [
      { title: "短信模板 · 系统管理 | 出海大数据平台" },
      {
        name: "description",
        content: "维护并送审营销/通知/验证码短信模板，仅审批通过的模板可用于批量发送。",
      },
    ],
  }),
  component: SmsTemplatesPage,
});

function SmsTemplatesPage() {
  const list = useSmsTemplates();
  const applications = useSmsApplications();
  const filings = useSmsFilings();
  const [libStatus, setLibStatus] = useState<Status | "all">("all");
  const [libSearch, setLibSearch] = useState("");
  const [libChannel, setLibChannel] = useState<"all" | Tpl["channel"]>("all");
  const [libRegion, setLibRegion] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Tpl | null>(null);
  const [previewing, setPreviewing] = useState<Tpl | null>(null);
  const [filingCtx, setFilingCtx] = useState<{ tpl: Tpl; channel: FilingChannel } | null>(null);
  const [reviewingApp, setReviewingApp] = useState<TemplateApplication | null>(null);
  const [managingTplId, setManagingTplId] = useState<string | null>(null);
  const managingTpl = managingTplId ? list.find((x) => x.id === managingTplId) ?? null : null;
  const [auditingTpl, setAuditingTpl] = useState<Tpl | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const counts = {
    all: list.length,
    approved: list.filter((t) => t.status === "approved").length,
    pending: list.filter((t) => t.status === "pending").length,
    rejected: list.filter((t) => t.status === "rejected").length,
  };
  const appCounts = {
    submitted: applications.filter((a) => a.status === "submitted").length,
    total: applications.length,
  };
  const filingCounts = {
    approved: filings.filter((f) => f.status === "approved").length,
    submitted: filings.filter((f) => f.status === "submitted").length,
    rejected: filings.filter((f) => f.status === "rejected").length,
    expiring: filings.filter((f) => f.status === "approved" && f.expireAt && daysUntil(f.expireAt) <= 30).length,
  };

  const filtered = list.filter((t) => {
    if (libStatus !== "all" && t.status !== libStatus) return false;
    if (libChannel !== "all" && t.channel !== libChannel) return false;
    if (libRegion !== "all" && !getTemplateApprovedRegions(t.id).includes(libRegion)) return false;
    if (libSearch.trim()) {
      const q = libSearch.trim().toLowerCase();
      if (!t.name.toLowerCase().includes(q) && !t.content.toLowerCase().includes(q)) return false;
    }
    return true;
  }).slice().sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));

  useEffect(() => {
    setPage(1);
  }, [libStatus, libChannel, libRegion, libSearch]);


  const pageData = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page],
  );

  function submitNew(t: Omit<Tpl, "id" | "status" | "updatedAt" | "submittedBy">) {
    addSmsTemplate(t);
    toast.success("已提交审核，预计 1 个工作日内反馈");
  }

  function submitEdit(patch: Omit<Tpl, "id" | "status" | "updatedAt" | "submittedBy">) {
    if (!editing) return;
    updateSmsTemplate(editing.id, patch);
    toast.success(
      editing.status === "rejected" ? "已重新提交审核" : "已保存并重新提交审核",
    );
    setEditing(null);
  }

  return (
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
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">短信模板</h1>
              <p className="text-white/85 text-sm mt-0.5 max-w-2xl">
                营销类模板需通过合规审批后方可用于批量发送；验证码/通知类模板走独立审批流程。模板必须包含退订提示（STOP / 退订 / TD 等）。
              </p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-6 text-white shrink-0">
            <MetricBlock label="模板总数" value={counts.all} suffix="个" />
            <MetricBlock label="已通过" value={counts.approved} suffix="个" />
            <MetricBlock label="待审核" value={counts.pending} suffix="个" warn={counts.pending > 0} />
            <MetricBlock label="即将过期" value={filingCounts.expiring} suffix="条" warn={filingCounts.expiring > 0} hint="30 天内到期报备" />
          </div>
        </div>
      </section>

      <ProcessGuideCard />

      <Tabs defaultValue="lib">
        <TabsList>
          <TabsTrigger value="lib">模板</TabsTrigger>
          <TabsTrigger value="filings">报备记录</TabsTrigger>
        </TabsList>

        <TabsContent value="lib" className="mt-3">
      <Card className="p-0 overflow-hidden">

        <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2 flex-wrap">
          <Input
            value={libSearch}
            onChange={(e) => setLibSearch(e.target.value)}
            placeholder="搜索模板名称 / 内容"
            className="h-8 w-56"
          />
          <Select value={libChannel} onValueChange={(v) => setLibChannel(v as typeof libChannel)}>
            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部模板类型</SelectItem>
              <SelectItem value="marketing">营销</SelectItem>
              <SelectItem value="notification">通知</SelectItem>
              <SelectItem value="otp">验证码</SelectItem>
            </SelectContent>
          </Select>
          <Select value={libRegion} onValueChange={setLibRegion}>
            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部覆盖地区</SelectItem>
              {FILING_REGIONS.map((r) => (
                <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={libStatus} onValueChange={(v) => setLibStatus(v as Status | "all")}>
            <SelectTrigger className="h-8 w-36"><SelectValue placeholder="状态" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="approved">已通过</SelectItem>
              <SelectItem value="pending">待审核</SelectItem>
              <SelectItem value="rejected">未通过</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">共 {filtered.length} 条</span>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" />
              新建模板
            </Button>
          </div>
        </div>
        <TooltipProvider delayDuration={200}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-[11px] text-muted-foreground">
                <tr className="text-left">
                  <th className="px-4 py-2 font-medium w-[16%]">模板名称</th>
                  <th className="px-3 py-2 font-medium w-[8%]">模板类型</th>
                  <th className="px-3 py-2 font-medium">模板内容</th>
                  <th className="px-3 py-2 font-medium w-[9%]">内审状态</th>
                  <th className="px-3 py-2 font-medium w-[28%]">渠道 + 目标地区报备</th>
                  <th className="px-3 py-2 font-medium w-[10%]">更新时间</th>
                  <th className="px-3 py-2 font-medium w-[12%] text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-sm text-muted-foreground">

                      无匹配模板
                    </td>
                  </tr>
                )}
                {pageData.map((t) => {
                  return (
                    <tr key={t.id} className="align-top hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="font-medium">{t.name}</div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          语言：{t.locale}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="outline" className="text-[10px]">
                          {t.channel === "otp" ? "验证码" : t.channel === "marketing" ? "营销" : "通知"}
                        </Badge>
                      </td>

                      <td className="px-3 py-3">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-xs text-foreground/80 line-clamp-2 font-mono cursor-help max-w-[28rem]">
                              {t.content}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-md whitespace-pre-wrap font-mono text-xs leading-relaxed">
                            {t.content}
                          </TooltipContent>
                        </Tooltip>
                        {t.rejectReason && (
                          <div className="mt-1 text-[11px] text-rose-600">拒因：{t.rejectReason}</div>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="px-3 py-3">
                        <FilingMatrix template={t} onPick={(ch) => setFilingCtx({ tpl: t, channel: ch })} />
                      </td>
                      <td className="px-3 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
                        {t.updatedAt}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 justify-end flex-nowrap whitespace-nowrap">
                          <IconAction title="报备" onClick={() => setManagingTplId(t.id)}>
                            <Settings2 className="h-3.5 w-3.5" />
                          </IconAction>
                          <IconAction title="复制" onClick={() => {
                            navigator.clipboard?.writeText(t.content);
                            toast.success("已复制模板内容");
                          }}>
                            <Copy className="h-3.5 w-3.5" />
                          </IconAction>
                          <IconAction title="编辑" onClick={() => setEditing(t)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </IconAction>

                          <IconAction title="预览" onClick={() => setPreviewing(t)}>
                            <Eye className="h-3.5 w-3.5" />
                          </IconAction>
                          {t.status === "pending" && (
                            <IconAction
                              title="审核"
                              className="text-primary hover:bg-primary/10"
                              onClick={() => setAuditingTpl(t)}
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                            </IconAction>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="px-4 pb-4 pt-2 border-t">
              <ListPagination
                page={page}
                pageSize={pageSize}
                total={filtered.length}
                onPageChange={setPage}
              />
            </div>
          )}
        </TooltipProvider>
      </Card>

        </TabsContent>

        <TabsContent value="filings" className="mt-3 space-y-2">
          <div className="text-xs text-muted-foreground">
            按「渠道 + 目标地区」登记的外部报备明细，决定用户端在各地区可选用的模板。
          </div>
          <FilingsPanel
            filings={filings}
            templates={list}
            onEdit={(tpl, ch) => setFilingCtx({ tpl, channel: ch })}
          />
        </TabsContent>
      </Tabs>





      <NewTplDialog open={addOpen} onOpenChange={setAddOpen} onSubmit={submitNew} />
      <NewTplDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSubmit={submitEdit}
        initial={editing}
      />
      <PreviewDialog
        template={previewing}
        onOpenChange={(o) => !o && setPreviewing(null)}
      />
      <FilingDialog ctx={filingCtx} onOpenChange={(o) => !o && setFilingCtx(null)} />
      <ReviewAppDialog
        app={reviewingApp}
        onOpenChange={(o) => !o && setReviewingApp(null)}
        onApproved={(newId) => {
          setManagingTplId(newId);
        }}
      />
      <FilingManagerDialog
        template={managingTpl}
        onOpenChange={(o) => !o && setManagingTplId(null)}
        onPick={(ch) => managingTpl && setFilingCtx({ tpl: managingTpl, channel: ch })}
      />
      <AuditTplDialog
        template={auditingTpl}
        onOpenChange={(o) => !o && setAuditingTpl(null)}
      />
    </div>
  );
}

function IconAction({
  children,
  title,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn("h-7 w-7 p-0", className)}
    >
      {children}
    </Button>
  );
}

function StatusBadge({ status }: { status: Status }) {
  return _renderStatus(status);
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

function _renderStatus(status: Status) {
  const map = {
    approved: { label: "已通过", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: CheckCircle2 },
    pending:  { label: "待审核", cls: "bg-amber-50 text-amber-700 border-amber-200",       Icon: Clock },
    rejected: { label: "未通过", cls: "bg-rose-50 text-rose-700 border-rose-200",          Icon: XCircle },
  } as const;
  const { label, cls, Icon } = map[status];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={label}
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-full border",
            cls,
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

/* ---------- 变量元数据 & 示例数据（ST-02 变量说明 / ST-03 预览） ---------- */

interface VarDef {
  key: string;
  desc: string;
  sample: string;
}

const VAR_GROUPS: Record<"system" | "contact" | "dynamic", { label: string; items: VarDef[] }> = {
  system: {
    label: "系统变量",
    items: [
      { key: "我的姓名", desc: "当前发送人姓名", sample: "John" },
      { key: "我的公司", desc: "当前发送人所属公司", sample: "TechCorp" },
      { key: "我的职位", desc: "当前发送人职位", sample: "Sales Manager" },
      { key: "我的邮箱", desc: "当前发送人的登录邮箱", sample: "john@techcorp.com" },
    ],
  },
  contact: {
    label: "联系人变量",
    items: [
      { key: "联系人名", desc: "收件联系人姓名（必填数据源）", sample: "Sarah" },
      { key: "联系人职位", desc: "联系人所在企业中的职位", sample: "Buyer" },
      { key: "联系人公司", desc: "联系人所属企业名称", sample: "Living Spaces LLC" },
      { key: "联系人国家", desc: "联系人所在国家（用于本地化）", sample: "United States" },
    ],
  },
  dynamic: {
    label: "动态变量",
    items: [
      { key: "行业", desc: "联系人所在行业类目", sample: "furniture" },
      { key: "产品名", desc: "本次推广的产品名称", sample: "Marble Countertop" },
      { key: "订单号", desc: "订单/运单编号（通知类）", sample: "BL20260112001" },
      { key: "验证码", desc: "OTP 场景一次性口令", sample: "482913" },
      { key: "折扣", desc: "促销活动优惠力度", sample: "20%" },
    ],
  },
};

function resolveSample(varName: string): string {
  for (const g of Object.values(VAR_GROUPS)) {
    const m = g.items.find((i) => i.key === varName);
    if (m) return m.sample;
  }
  return `{{${varName}}}`;
}

/** 渲染预览：{{变量}} 替换为示例值；未识别变量保留原样以便用户发现拼写错误 */
function renderPreview(content: string): { text: string; unresolved: string[] } {
  const unresolved: string[] = [];
  const text = content.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, name: string) => {
    const key = name.trim();
    const sample = resolveSample(key);
    if (sample === `{{${key}}}`) unresolved.push(key);
    return sample;
  });
  return { text, unresolved: Array.from(new Set(unresolved)) };
}

function NewTplDialog({
  open,
  onOpenChange,
  onSubmit,
  initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (t: Omit<Tpl, "id" | "status" | "updatedAt" | "submittedBy">) => void;
  initial?: Tpl | null;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [channel, setChannel] = useState<Tpl["channel"]>(initial?.channel ?? "marketing");
  const [content, setContent] = useState(initial?.content ?? "");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEdit = !!initial;

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setChannel(initial?.channel ?? "marketing");
    setContent(initial?.content ?? "");
  }, [open, initial]);

  function insertVar(key: string) {
    const el = textareaRef.current;
    const token = `{{${key}}}`;
    if (!el) {
      setContent((c) => c + token);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + token + content.slice(end);
    setContent(next);
    // 恢复光标到插入尾
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  const preview = useMemo(() => renderPreview(content), [content]);
  const hasOptOut = /STOP|退订|TD/i.test(content);

  function submit() {
    if (!name.trim() || !content.trim()) {
      toast.error("请填写名称与内容");
      return;
    }
    if (channel === "marketing" && !hasOptOut) {
      toast.error("营销类模板必须包含退订提示（STOP / 退订 / TD）");
      return;
    }
    onSubmit({ name: name.trim(), channel, locale: "zh-CN", content: content.trim() });
    setName("");
    setContent("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? initial?.status === "rejected"
                ? "修改并重提审核"
                : "修改待审模板"
              : "新建短信模板"}
          </DialogTitle>
          <DialogDescription>
            使用 <code className="text-xs">{"{{变量名}}"}</code> 语法插入动态字段。右侧变量面板可直接点击插入到光标位置，下方预览区实时展示替换效果。
          </DialogDescription>
        </DialogHeader>
        {isEdit && initial?.status === "rejected" && initial.rejectReason && (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            上次未通过原因：{initial.rejectReason}
          </div>
        )}

        <div className="grid grid-cols-5 gap-4">
          {/* 左：表单 */}
          <div className="col-span-3 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">模板名称</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
                placeholder="例：首触 · 产品介绍 EN"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">模板类型</label>
              <Select value={channel} onValueChange={(v) => setChannel(v as Tpl["channel"])}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="marketing">营销</SelectItem>
                  <SelectItem value="notification">通知</SelectItem>
                  <SelectItem value="otp">验证码</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">
                  模板内容
                </label>
                <div className="flex items-center gap-2">
                  {!hasOptOut && (
                    <button
                      type="button"
                      onClick={() => {
                        const hint = " 回复T退订";
                        const el = textareaRef.current;
                        const base = content.replace(/\s+$/, "");
                        const next = base + hint;
                        setContent(next);
                        requestAnimationFrame(() => {
                          el?.focus();
                          el?.setSelectionRange(next.length, next.length);
                        });
                      }}
                      className="text-[11px] px-1.5 py-0.5 rounded border border-dashed border-rose-300 text-rose-600 hover:bg-rose-50"
                    >
                      + 退订提示
                    </button>
                  )}
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {content.length} 字符 · 预计 {Math.max(1, Math.ceil(content.length / 70))} 段
                  </span>
                </div>
              </div>
              <Textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                className="mt-1 font-mono text-xs"
                placeholder="Hi {{联系人名}}, this is {{我的姓名}} from {{我的公司}}. Reply STOP to opt out."
              />
              {channel === "marketing" && (
                <div className={cn(
                  "mt-1.5 text-[11px] flex items-start gap-1",
                  hasOptOut ? "text-emerald-600" : "text-rose-600",
                )}>
                  {hasOptOut ? <CheckCircle2 className="h-3 w-3 mt-0.5" /> : <AlertTriangle className="h-3 w-3 mt-0.5" />}
                  {hasOptOut ? "已包含退订提示（STOP / 退订 / TD）" : "营销类必须包含退订提示，否则无法保存"}
                </div>
              )}
            </div>

            {/* 预览面板（ST-03） */}
            <div className="rounded-md border bg-muted/30 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                预览效果
                <span className="text-[10px] text-muted-foreground font-normal">
                  （示例数据）
                </span>
              </div>
              <div className="rounded bg-background border p-2.5 text-sm whitespace-pre-wrap font-mono min-h-[3rem]">
                {preview.text || <span className="text-muted-foreground">在上方输入模板内容即可预览…</span>}
              </div>
              {preview.unresolved.length > 0 && (
                <div className="text-[11px] text-amber-700 flex items-start gap-1">
                  <AlertTriangle className="h-3 w-3 mt-0.5" />
                  未识别变量：{preview.unresolved.map((v) => `{{${v}}}`).join("、")}
                  <span className="text-muted-foreground">（发送时将保留原样）</span>
                </div>
              )}
            </div>
          </div>

          {/* 右：变量面板（ST-02） */}
          <div className="col-span-2">
            <div className="text-xs text-muted-foreground mb-1.5">可用变量（点击插入）</div>
            <Tabs defaultValue="contact" className="w-full">
              <TabsList className="grid grid-cols-3 h-8">
                <TabsTrigger value="system" className="text-xs">系统</TabsTrigger>
                <TabsTrigger value="contact" className="text-xs">联系人</TabsTrigger>
                <TabsTrigger value="dynamic" className="text-xs">动态</TabsTrigger>
              </TabsList>
              {(Object.keys(VAR_GROUPS) as Array<keyof typeof VAR_GROUPS>).map((k) => (
                <TabsContent key={k} value={k} className="mt-2 space-y-1.5 max-h-72 overflow-y-auto pr-1">
                  {VAR_GROUPS[k].items.map((v) => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVar(v.key)}
                      className="w-full text-left rounded-md border bg-background hover:border-primary/50 hover:bg-primary/5 px-2.5 py-1.5 transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-xs font-medium text-primary">{`{{${v.key}}}`}</code>
                        <span className="text-[10px] text-muted-foreground group-hover:text-primary">
                          插入 →
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                        {v.desc} · 示例：<span className="font-mono">{v.sample}</span>
                      </div>
                    </button>
                  ))}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={submit}>{isEdit ? "重新提交审核" : "提交审核"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProcessGuideCard() {
  return _processGuideInner();
}

function AuditTplDialog({ template, onOpenChange }: {
  template: Tpl | null;
  onOpenChange: (o: boolean) => void;
}) {
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (template) { setDecision("approve"); setReason(""); }
  }, [template?.id]);
  if (!template) return null;
  const submit = () => {
    if (decision === "approve") {
      approveSmsTemplate(template.id);
      toast.success("已审核通过");
    } else {
      if (!reason.trim()) { toast.error("请填写驳回原因"); return; }
      rejectSmsTemplate(template.id, reason.trim());
      toast.success("已驳回该模板");
    }
    onOpenChange(false);
  };
  return (
    <Dialog open={!!template} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> 审核模板 · {template.name}
          </DialogTitle>
          <DialogDescription>请确认审核结论。通过后模板即可用于对应渠道发送；驳回请填写原因供提交人整改。</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border bg-muted/30 p-3 text-xs font-mono whitespace-pre-wrap max-h-40 overflow-auto">
            {template.content}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDecision("approve")}
              className={cn(
                "flex-1 rounded-md border px-3 py-2 text-sm flex items-center justify-center gap-2 transition",
                decision === "approve"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              <ThumbsUp className="h-4 w-4" /> 通过
            </button>
            <button
              type="button"
              onClick={() => setDecision("reject")}
              className={cn(
                "flex-1 rounded-md border px-3 py-2 text-sm flex items-center justify-center gap-2 transition",
                decision === "reject"
                  ? "border-rose-300 bg-rose-50 text-rose-700"
                  : "text-muted-foreground hover:bg-muted/50",
              )}
            >
              <ThumbsDown className="h-4 w-4" /> 驳回
            </button>
          </div>
          {decision === "reject" && (
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请输入驳回原因，例如：缺少退订提示 / 含违禁词 …"
              rows={3}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={submit} className={decision === "reject" ? "bg-rose-600 hover:bg-rose-700" : ""}>
            确认{decision === "approve" ? "通过" : "驳回"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function _processGuideInner() {
  const [open, setOpen] = useState(true);
  return (
    <Card className="p-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-sm"
      >
        <span className="flex items-center gap-2 font-medium">
          <ShieldCheck className="h-4 w-4 text-primary" />
          流程指引：平台新建 → 内审通过 → 渠道 + 地区报备 → 用户可选用
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2 text-[12px]">
          {[
            { n: 1, title: "平台新建", desc: "所有短信模板均由平台运营在后台新建与维护，入库后进入『待审核』。" },
            { n: 2, title: "内审 · 报备", desc: "操作列点击『审核』确认通过或驳回；再在『报备』中按渠道 + 目标地区分别登记外部审核结果。" },
            { n: 3, title: "用户可用", desc: "内审通过 + 对应渠道地区报备通过后，终端用户在批量发短信时即可按覆盖地区选用该模板。" },

          ].map((s) => (
            <div key={s.n} className="rounded-md border bg-muted/30 p-2">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[11px] flex items-center justify-center">{s.n}</span>
                {s.title}
              </div>
              <div className="mt-1 text-muted-foreground leading-relaxed">{s.desc}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function FilingSummaryBadge({ templateId }: { templateId: string }) {
  const s = getFilingSummary(templateId);
  const total = FILING_CHANNELS.length;
  const done = s.approved;
  const cls = done === 0
    ? "bg-rose-50 text-rose-700 border-rose-200"
    : done < total
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";
  return (
    <Badge variant="outline" className={cn("text-[10px] gap-1", cls)} title="已通过渠道数 / 全部渠道数">
      <Radio className="h-3 w-3" /> 报备 {done}/{total}
      {s.expiring > 0 && <span className="ml-1 text-orange-600">· {s.expiring} 即将到期</span>}
    </Badge>
  );
}

function FilingManagerDialog({ template, onOpenChange, onPick }: {
  template: Tpl | null;
  onOpenChange: (o: boolean) => void;
  onPick: (ch: FilingChannel) => void;
}) {
  if (!template) return null;
  const map = getFilingsByTemplate(template.id);
  return (
    <Dialog open={!!template} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" /> 报备管理 · {template.name}
          </DialogTitle>
          <DialogDescription>
            对每个渠道分别登记外部审核结果；点击『登记 / 更新』填写外部编号与到期时间，点击『续报』将记录重置为待审核。
          </DialogDescription>
        </DialogHeader>
        <div className="divide-y border rounded-md">
          {FILING_CHANNELS.map((c) => {
            const rec = map[c.key];
            const st: FilingStatus = rec?.status ?? "none";
            const expiring = rec?.status === "approved" && rec.expireAt && daysUntil(rec.expireAt) <= 30;
            return (
              <div key={c.key} className="flex items-center gap-3 p-3">
                <div className="w-24 shrink-0 text-sm font-medium">{c.label}</div>
                <Badge variant="outline" className={cn("text-[10px]", FILING_STATUS_CLASS[st])}>
                  {FILING_STATUS_LABEL[st]}
                </Badge>
                <div className="flex-1 text-[11px] text-muted-foreground truncate">
                  {rec?.externalId && <span className="mr-2">编号 {rec.externalId}</span>}
                  {rec?.expireAt && <span className={cn("mr-2", expiring && "text-orange-600")}>到期 {rec.expireAt}</span>}
                  {rec?.comment && <span>· {rec.comment}</span>}
                  {!rec && <span>未登记</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {(st === "approved" || st === "expired") && (
                    <Button size="sm" variant="outline" onClick={() => { renewFiling(template.id, c.key); toast.success("已提交续报"); }}>
                      <RefreshCw className="h-3.5 w-3.5" /> 续报
                    </Button>
                  )}
                  <Button size="sm" onClick={() => onPick(c.key)}>
                    <Pencil className="h-3.5 w-3.5" /> 登记 / 更新
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 列表行独立的预览弹窗（ST-03 只读预览） */
function PreviewDialog({
  template,
  onOpenChange,
}: {
  template: Tpl | null;
  onOpenChange: (o: boolean) => void;
}) {
  const preview = useMemo(
    () => (template ? renderPreview(template.content) : { text: "", unresolved: [] }),
    [template],
  );
  return (
    <Dialog open={!!template} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            模板预览
          </DialogTitle>
          <DialogDescription>
            使用示例数据替换 <code className="text-xs">{"{{变量}}"}</code> 后的实际发送效果。
          </DialogDescription>
        </DialogHeader>
        {template && (
          <div className="space-y-3">
            <div>
              <div className="text-xs text-muted-foreground mb-1">原始模板</div>
              <div className="rounded border bg-muted/40 p-2.5 text-xs font-mono whitespace-pre-wrap">
                {template.content}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">预览效果</div>
              <div className="rounded border bg-emerald-50/50 border-emerald-200 p-2.5 text-sm whitespace-pre-wrap">
                {preview.text}
              </div>
              {preview.unresolved.length > 0 && (
                <div className="text-[11px] text-amber-700 mt-1.5 flex items-start gap-1">
                  <AlertTriangle className="h-3 w-3 mt-0.5" />
                  未识别变量：{preview.unresolved.map((v) => `{{${v}}}`).join("、")}
                </div>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground">
              长度：{template.content.length} 字符 · 预计 {Math.max(1, Math.ceil(template.content.length / 70))} 段
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
/* ============ Round 1: 渠道报备 & 用户申请 ============ */

function daysUntil(iso: string): number {
  const t = new Date(iso).getTime();
  return Math.ceil((t - Date.now()) / 86400000);
}

const FILING_STATUS_LABEL: Record<FilingStatus, string> = {
  none: "未报备",
  submitted: "报备中",
  approved: "已通过",
  rejected: "已拒绝",
  expired: "已过期",
};
const FILING_STATUS_CLASS: Record<FilingStatus, string> = {
  none: "bg-muted text-muted-foreground border-border",
  submitted: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
  expired: "bg-orange-50 text-orange-700 border-orange-200",
};

/** 展示该模板的报备通道由哪些服务商承载，以及是否存在断链地区 */
function CarrierLine({ templateId }: { templateId: string }) {
  useSmsProviders();
  const map = getFilingsByTemplate(templateId);
  const approved = FILING_CHANNELS.map((c) => map[c.key]).filter(
    (f): f is NonNullable<typeof f> => !!f && f.status === "approved",
  );
  if (approved.length === 0) return null;
  const carriers = new Set<string>();
  approved.forEach((f) =>
    (f.regions ?? []).forEach((r) =>
      carriersFor(f.channel, r)
        .filter(isProviderRoutable)
        .forEach((p) => carriers.add(p.name)),
    ),
  );
  const blocked = getTemplateBlockedRegions(templateId);
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] text-muted-foreground">
        承载服务商：{carriers.size ? [...carriers].join("、") : "无可用服务商"}
      </div>
      {blocked.length > 0 && (
        <div className="text-[10px] text-amber-700">
          断链：
          {blocked
            .map(
              (b) =>
                `${FILING_CHANNELS.find((c) => c.key === b.channel)?.label ?? b.channel}·${regionLabel(b.region)}`,
            )
            .join("、")}
          （无服务商承载，实际不可发）
        </div>
      )}
    </div>
  );
}

function FilingMatrix({ template, onPick }: { template: Tpl; onPick: (ch: FilingChannel) => void }) {

  const map = getFilingsByTemplate(template.id);
  const recs = FILING_CHANNELS.map((c) => ({ c, rec: map[c.key] })).filter((x) => !!x.rec);
  const missing = FILING_CHANNELS.filter((c) => !map[c.key]);
  return (
    <div className="flex flex-col gap-1.5">
      {recs.length === 0 && (
        <span className="text-[11px] text-muted-foreground">尚未登记任何渠道报备</span>
      )}
      <div className="flex flex-wrap gap-1.5">
        {recs.map(({ c, rec }) => {
          const st: FilingStatus = rec!.status;
          const isExpiring = st === "approved" && rec!.expireAt && daysUntil(rec!.expireAt!) <= 30;
          const regions = rec!.regions ?? [];
          return (
            <button
              key={c.key}
              onClick={() => onPick(c.key)}
              className={cn(
                "px-2 py-0.5 rounded-md border text-[10px] leading-tight flex items-center gap-1 hover:opacity-80 transition-opacity text-left",
                FILING_STATUS_CLASS[st],
                isExpiring && "ring-1 ring-orange-300",
              )}
              title={rec!.comment || FILING_STATUS_LABEL[st]}
            >
              <span className="font-medium">{c.label}</span>
              <span className="opacity-60">·</span>
              <span>{regions.length ? regions.map(regionLabel).join(" / ") : "未设地区"}</span>
              <span className="opacity-60">·</span>
              <span>{FILING_STATUS_LABEL[st]}</span>
              {isExpiring && <AlertTriangle className="h-2.5 w-2.5" />}
            </button>
          );
        })}
      </div>
      <CarrierLine templateId={template.id} />

      {missing.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
          <span>未报备：</span>
          {missing.map((c) => (
            <button
              key={c.key}
              onClick={() => onPick(c.key)}
              className="px-1.5 py-0.5 rounded border border-dashed hover:bg-muted"
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


function ApplicationsPanel({ apps, onReview }: { apps: TemplateApplication[]; onReview: (a: TemplateApplication) => void }) {
  const [tab, setTab] = useState<"submitted" | "approved" | "rejected" | "all">("submitted");
  const filtered = tab === "all" ? apps : apps.filter((a) => a.status === tab);
  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center gap-1 border-b bg-muted/40 px-4 py-2">
        {([
          { k: "submitted", label: "待审核" },
          { k: "approved", label: "已通过" },
          { k: "rejected", label: "已拒绝" },
          { k: "all", label: "全部" },
        ] as const).map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm transition-colors",
              tab === t.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t.label}
            <span className="ml-1 text-[10px] opacity-70">
              ({apps.filter((a) => t.k === "all" ? true : a.status === t.k).length})
            </span>
          </button>
        ))}
      </div>
      <div className="divide-y">
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">暂无申请</div>
        )}
        {filtered.map((a) => (
          <div key={a.id} className="p-4 flex gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{a.name}</span>
                <AppStatusBadge status={a.status} />
                <Badge variant="outline" className="text-[10px]">
                  {a.channel === "otp" ? "验证码" : a.channel === "marketing" ? "营销" : "通知"}
                </Badge>
                <Badge variant="outline" className="text-[10px]">{a.locale}</Badge>
              </div>
              {a.scenario && (
                <div className="mt-1.5 text-[11px] text-muted-foreground">
                  <span className="font-medium">使用场景：</span>{a.scenario}
                </div>
              )}
              <div className="mt-2 text-sm text-foreground/80 bg-muted/50 rounded p-2 font-mono whitespace-pre-wrap">
                {a.content}
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-3 flex-wrap">
                <span>提交人：{a.submittedBy}</span>
                <span>提交时间：{a.submittedAt}</span>
                {a.reviewer && <span>审核：{a.reviewer} · {a.reviewedAt}</span>}
                {a.rejectReason && <span className="text-rose-600">拒因：{a.rejectReason}</span>}
              </div>
            </div>
            <div className="shrink-0 flex flex-col gap-1 w-24">
              {a.status === "submitted" ? (
                <Button size="sm" onClick={() => onReview(a)}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  审核
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => onReview(a)}>
                  <Eye className="h-3.5 w-3.5" />
                  详情
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AppStatusBadge({ status }: { status: TemplateApplication["status"] }) {
  if (status === "approved")
    return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1"><CheckCircle2 className="h-3 w-3" /> 已通过</Badge>;
  if (status === "rejected")
    return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 gap-1"><XCircle className="h-3 w-3" /> 已拒绝</Badge>;
  return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1"><Clock className="h-3 w-3" /> 待审核</Badge>;
}

function FilingsPanel({ filings, templates, onEdit }: {
  filings: TemplateFiling[];
  templates: Tpl[];
  onEdit: (tpl: Tpl, ch: FilingChannel) => void;
}) {
  const tplMap = useMemo(() => Object.fromEntries(templates.map((t) => [t.id, t])), [templates]);
  const [ch, setCh] = useState<FilingChannel | "all">("all");
  const [st, setSt] = useState<FilingStatus | "all">("all");
  const [rg, setRg] = useState<string>("all");
  const rows = filings
    .filter(
      (f) =>
        (ch === "all" || f.channel === ch) &&
        (st === "all" || f.status === st) &&
        (rg === "all" || (f.regions ?? []).includes(rg)),
    )
    .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));

  return (
    <Card className="p-0 overflow-hidden">
      <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-2">
        <Select value={ch} onValueChange={(v) => setCh(v as FilingChannel | "all")}>
          <SelectTrigger className="h-8 w-40"><SelectValue placeholder="渠道" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部渠道</SelectItem>
            {FILING_CHANNELS.map((c) => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={st} onValueChange={(v) => setSt(v as FilingStatus | "all")}>
          <SelectTrigger className="h-8 w-40"><SelectValue placeholder="状态" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            {(Object.keys(FILING_STATUS_LABEL) as FilingStatus[]).filter((s) => s !== "none").map((s) => (
              <SelectItem key={s} value={s}>{FILING_STATUS_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={rg} onValueChange={setRg}>
          <SelectTrigger className="h-8 w-44"><SelectValue placeholder="目标地区" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部地区</SelectItem>
            {FILING_REGIONS.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">共 {rows.length} 条</span>

      </div>
      <div className="divide-y">
        {rows.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">暂无报备记录</div>
        )}
        {rows.map((f) => {
          const tpl = tplMap[f.templateId];
          const chLabel = FILING_CHANNELS.find((c) => c.key === f.channel)?.label ?? f.channel;
          const expiring = f.status === "approved" && f.expireAt && daysUntil(f.expireAt) <= 30;
          return (
            <div key={`${f.templateId}-${f.channel}`} className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{tpl?.name ?? f.templateId}</span>
                  <Badge variant="outline" className="text-[10px]">{chLabel}</Badge>
                  <Badge variant="outline" className={cn("text-[10px]", FILING_STATUS_CLASS[f.status])}>
                    {FILING_STATUS_LABEL[f.status]}
                  </Badge>
                  {expiring && (
                    <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-700 border-orange-200 gap-1">
                      <AlertTriangle className="h-3 w-3" /> {daysUntil(f.expireAt!)} 天内到期
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[11px] text-muted-foreground">
                  <span>目标地区：</span>
                  {(f.regions ?? []).length === 0 ? (
                    <span className="text-amber-600">未设置</span>
                  ) : (
                    (f.regions ?? []).map((r) => (
                      <Badge key={r} variant="secondary" className="text-[10px] font-normal">
                        {regionLabel(r)}
                      </Badge>
                    ))
                  )}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-3 flex-wrap">
                  {f.externalId && <span>回执号：<code className="text-[11px]">{f.externalId}</code></span>}

                  {f.submittedAt && <span>报备：{f.submittedAt}</span>}
                  {f.approvedAt && <span>通过：{f.approvedAt}</span>}
                  {f.expireAt && <span>到期：{f.expireAt}</span>}
                  {f.operator && <span>登记人：{f.operator}</span>}
                </div>
                {f.comment && (
                  <div className="mt-1 text-[11px] text-muted-foreground">备注：{f.comment}</div>
                )}
              </div>
              <Button size="sm" variant="outline" onClick={() => tpl && onEdit(tpl, f.channel)}>
                <Pencil className="h-3.5 w-3.5" />
                编辑
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function FilingDialog({ ctx, onOpenChange }: {
  ctx: { tpl: Tpl; channel: FilingChannel } | null;
  onOpenChange: (o: boolean) => void;
}) {
  const existing = ctx ? getFilingsByTemplate(ctx.tpl.id)[ctx.channel] : undefined;
  const [status, setStatus] = useState<FilingStatus>("submitted");
  const [regions, setRegions] = useState<string[]>([]);
  const [externalId, setExternalId] = useState("");
  const [submittedAt, setSubmittedAt] = useState("");
  const [approvedAt, setApprovedAt] = useState("");
  const [expireAt, setExpireAt] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!ctx) return;
    const today = new Date().toISOString().slice(0, 10);
    setStatus(existing?.status && existing.status !== "none" ? existing.status : "submitted");
    setRegions(existing?.regions ?? defaultRegionsForChannel(ctx.channel));
    setExternalId(existing?.externalId ?? "");
    setSubmittedAt(existing?.submittedAt ?? today);
    setApprovedAt(existing?.approvedAt ?? "");
    setExpireAt(existing?.expireAt ?? "");
    setComment(existing?.comment ?? "");
  }, [ctx?.tpl.id, ctx?.channel]);

  if (!ctx) return null;
  const chLabel = FILING_CHANNELS.find((c) => c.key === ctx.channel)?.label ?? ctx.channel;

  function save() {
    if (regions.length === 0) {
      toast.error("请至少选择一个目标地区");
      return;
    }
    upsertFiling({
      templateId: ctx!.tpl.id,
      channel: ctx!.channel,
      status,
      regions,
      externalId: externalId.trim() || undefined,
      submittedAt: submittedAt || undefined,
      approvedAt: approvedAt || undefined,
      expireAt: expireAt || undefined,
      comment: comment.trim() || undefined,
      operator: "合规组",
    });
    toast.success(`已登记「${ctx!.tpl.name} · ${chLabel}」报备状态`);
    onOpenChange(false);
  }


  return (
    <Dialog open={!!ctx} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            渠道报备登记 · {chLabel}
          </DialogTitle>
          <DialogDescription>
            模板：<span className="font-medium text-foreground">{ctx.tpl.name}</span>。
            在外部平台完成报备后，将回执信息登记到系统，用于送达前的合规校验与到期提醒。
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">报备状态</label>
            <Select value={status} onValueChange={(v) => setStatus(v as FilingStatus)}>
              <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="submitted">报备中</SelectItem>
                <SelectItem value="approved">已通过</SelectItem>
                <SelectItem value="rejected">已拒绝</SelectItem>
                <SelectItem value="expired">已过期</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">
              目标地区 * <span className="text-[11px]">（该报备生效的发送地区，用户端按此范围选用模板）</span>
            </label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {FILING_REGIONS.map((r) => {
                const on = regions.includes(r.key);
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() =>
                      setRegions((prev) =>
                        prev.includes(r.key) ? prev.filter((x) => x !== r.key) : [...prev, r.key],
                      )
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      on
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-muted bg-background text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {on ? "✓ " : ""}{r.label}
                  </button>
                );
              })}
            </div>
            {regions.length === 0 && (
              <div className="mt-1 text-[11px] text-amber-600">请至少选择一个目标地区</div>
            )}
          </div>

          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">外部回执号 / 模板ID</label>
            <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} className="mt-1" placeholder="如 CM202607010881 / HXxxxxx" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">报备日期</label>
            <Input type="date" value={submittedAt} onChange={(e) => setSubmittedAt(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">通过日期</label>
            <Input type="date" value={approvedAt} onChange={(e) => setApprovedAt(e.target.value)} className="mt-1" disabled={status !== "approved"} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">到期日期</label>
            <Input type="date" value={expireAt} onChange={(e) => setExpireAt(e.target.value)} className="mt-1" disabled={status !== "approved"} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted-foreground">备注 / 拒因</label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} className="mt-1" placeholder="被拒的具体原因、修改建议等" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={save}><Send className="h-3.5 w-3.5" />保存登记</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewAppDialog({ app, onOpenChange, onApproved }: {
  app: TemplateApplication | null;
  onOpenChange: (o: boolean) => void;
  onApproved?: (newTemplateId: string) => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => { setReason(""); }, [app?.id]);
  if (!app) return null;
  const isReadonly = app.status !== "submitted";
  const hasOptOut = /STOP|退订|TD/i.test(app.content);

  function approve() {
    const newId = approveApplication(app!.id);
    toast.success(`已通过并生成模板「${app!.name}」，请前往模板库完成渠道报备`);
    onOpenChange(false);
    if (newId) onApproved?.(newId);
  }
  function reject() {
    if (!reason.trim()) { toast.error("请填写拒绝原因"); return; }
    rejectApplication(app!.id, reason.trim());
    toast.success("已拒绝并通知提交人");
    onOpenChange(false);
  }

  return (
    <Dialog open={!!app} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            {isReadonly ? "申请详情" : "审核模板申请"}
          </DialogTitle>
          <DialogDescription>
            提交人 {app.submittedBy} · {app.submittedAt}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">模板名称</div>
            <div className="text-sm font-medium">{app.name}</div>
          </div>
          {app.scenario && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">使用场景</div>
              <div className="text-sm">{app.scenario}</div>
            </div>
          )}
          <div>
            <div className="text-xs text-muted-foreground mb-1">模板内容</div>
            <div className="rounded border bg-muted/40 p-2.5 text-xs font-mono whitespace-pre-wrap">{app.content}</div>
          </div>
          {app.channel === "marketing" && (
            <div className={cn("text-[11px] flex items-center gap-1", hasOptOut ? "text-emerald-600" : "text-rose-600")}>
              {hasOptOut ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              {hasOptOut ? "含退订提示" : "缺少退订提示（STOP / 退订 / TD），建议拒绝"}
            </div>
          )}
          {isReadonly && app.rejectReason && (
            <div className="rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">拒因：{app.rejectReason}</div>
          )}
          {!isReadonly && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">拒绝原因（拒绝时必填）</div>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="例：缺少退订提示 / 含敏感词" />
            </div>
          )}
        </div>
        <DialogFooter>
          {isReadonly ? (
            <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
          ) : (
            <>
              <Button variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700" onClick={reject}>
                <ThumbsDown className="h-3.5 w-3.5" />
                拒绝
              </Button>
              <Button onClick={approve}>
                <ThumbsUp className="h-3.5 w-3.5" />
                通过并生成模板
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
