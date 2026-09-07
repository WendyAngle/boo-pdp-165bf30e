import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import {
  Receipt,
  ChevronRight,
  Search,
  X,
  Eye,
  Send,
  Building2,
  UserRound,
  Wallet,
  TrendingDown,
  Mail,
  Phone,
  Globe,
  MapPin,
  Undo2,
  EyeOff,
  Briefcase,
  BadgeCheck,
  HelpCircle,
  Download,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findEnterprise } from "@/data/enterprises";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  useLedger,
  seedDemoLedgerIfEmpty,
  backfillAiGenerationEntries,
  syncFailedRefunds,
  REACH_CHANNEL_LABEL,
  VIEW_FIELD_LABEL,
  type LedgerKind,
  type ViewField,
  type ReachChannel,
  type LedgerEntry,
} from "@/lib/credits-ledger";
import {
  useCreditBalance,
  formatExpiry,
  isBalanceLow,
  isExpiringSoon,
} from "@/lib/credits-balance";
import { RulesSheet } from "@/components/billing/RulesSheet";
import { ListPagination } from "@/components/ListPagination";
import {
  DateRangePicker,
  resolvePreset,
  type DateRangeValue,
  type PresetId,
} from "@/components/billing/DateRangePicker";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";

export const Route = createFileRoute("/_app/outreach/billing")({
  head: () => ({ meta: [{ title: "出海大数据平台 · 消费明细 | 出海大数据平台" }] }),
  validateSearch: (s) =>
    z
      .object({
        tab: z
          .enum([
            "all",
            "consume",
            "refund",
            "recharge",
            "expire",
            "package_recharge",
            "recharge_refund",
            "feedback_reward",
          ])
          .optional(),
      })
      .parse(s),
  component: BillingPage,
});

import { formatDateTime as fmtTime } from "@/lib/format-date";

/** 收入类流水（正向记账） */
function isIncome(e: LedgerEntry) {
  return e.kind === "refund" || e.kind === "recharge" || e.kind === "feedback_reward";
}

function BillingPage() {
  const { tab: tabFromUrl } = Route.useSearch();
  useEffect(() => {
    seedDemoLedgerIfEmpty();
    backfillAiGenerationEntries();
    syncFailedRefunds();
    const t = setInterval(() => syncFailedRefunds(), 10000);
    return () => clearInterval(t);
  }, []);
  const ledger = useLedger();
  const balance = useCreditBalance();
  const lowBalance = isBalanceLow(balance);
  const expiringSoon = isExpiringSoon(balance);

  type TabKey =
    | "all"
    | "consume"
    | "refund"
    | "recharge"
    | "expire"
    | "package_recharge"
    | "recharge_refund"
    | "feedback_reward";
  const [tab, setTab] = useState<TabKey>(tabFromUrl ?? "all");
  const [kw, setKw] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase();
    const fromMs = dateFrom
      ? new Date(new Date(dateFrom).setHours(0, 0, 0, 0)).getTime()
      : undefined;
    const toMs = dateTo
      ? new Date(new Date(dateTo).setHours(23, 59, 59, 999)).getTime()
      : dateFrom
        ? new Date(new Date(dateFrom).setHours(23, 59, 59, 999)).getTime()
        : undefined;
    return ledger.filter((e) => {
      if (tab !== "all") {
        const consumeKinds: LedgerKind[] = ["view", "reach", "ai_generate"];
        if (tab === "consume" && !consumeKinds.includes(e.kind)) return false;
        else if (tab === "refund" && e.kind !== "refund") return false;
        else if (tab === "recharge" && e.kind !== "recharge") return false;
        else if (tab === "feedback_reward" && e.kind !== "feedback_reward") return false;
        else if (tab === "expire" || tab === "package_recharge" || tab === "recharge_refund")
          return false;
      }
      if (fromMs !== undefined) {
        const t = new Date(e.createdAt).getTime();
        if (t < fromMs) return false;
        if (toMs !== undefined && t > toMs) return false;
      }
      if (!k) return true;
      return (
        e.targetName.toLowerCase().includes(k) ||
        (e.parentRef?.name ?? "").toLowerCase().includes(k) ||
        (e.detail ?? "").toLowerCase().includes(k) ||
        (e.platform ?? "").toLowerCase().includes(k)
      );
    });
  }, [ledger, tab, dateFrom, dateTo, kw]);

  useEffect(() => {
    setPage(1);
  }, [tab, kw, dateFrom, dateTo]);

  const pageData = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page],
  );

  const stats = useMemo(() => {
    const all = ledger;
    const viewSum = all.filter((e) => e.kind === "view").reduce((s, e) => s + e.cost, 0);
    const reachSum = all.filter((e) => e.kind === "reach").reduce((s, e) => s + e.cost, 0);
    const aiSum = all.filter((e) => e.kind === "ai_generate").reduce((s, e) => s + e.cost, 0);
    const refundSum = all.filter((e) => e.kind === "refund").reduce((s, e) => s + e.cost, 0);
    const rechargeSum = all.filter((e) => e.kind === "recharge").reduce((s, e) => s + e.cost, 0);
    const rechargeCount = all.filter((e) => e.kind === "recharge").length;
    return {
      total: viewSum + reachSum + aiSum - refundSum,
      view: viewSum,
      reach: reachSum,
      ai: aiSum,
      refund: refundSum,
      recharge: rechargeSum,
      rechargeCount,
      count: all.length,
      consumed: viewSum + reachSum + aiSum - refundSum,
      granted: rechargeSum,
      expired: 0,
    };
  }, [ledger]);

  // 计算每条流水的「变动后余额」。以当前可用余额为最新一条记录的期末余额，向历史反推。
  const balanceMap = useMemo(() => {
    const map = new Map<string, number>();
    // 按时间升序（最早在前）以便顺推
    const sorted = [...ledger].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    const signed = (e: LedgerEntry) =>
      isIncome(e) ? e.cost : -e.cost;
    const totalDelta = sorted.reduce((s, e) => s + signed(e), 0);
    let running = balance.balance - totalDelta; // 期初余额
    for (const e of sorted) {
      running += signed(e);
      map.set(e.id, running);
    }
    return map;
  }, [ledger, balance.balance]);

  const filteredConsume = filtered
    .filter((e) => e.kind === "view" || e.kind === "reach" || e.kind === "ai_generate")
    .reduce((s, e) => s + e.cost, 0);
  const filteredRefund = filtered
    .filter((e) => e.kind === "refund")
    .reduce((s, e) => s + e.cost, 0);
  const filteredRecharge = filtered
    .filter((e) => e.kind === "recharge")
    .reduce((s, e) => s + e.cost, 0);

  function handleExport(format: "csv" | "excel") {
    const VIEW_ACTION: Record<string, string> = {
      email: "查看邮箱",
      phone: "查看电话",
      social: "查看社媒账号",
      address: "查看地址",
      title: "查看职位",
      seniority: "查看职级",
    };
    const REACH_ACTION: Record<string, string> = {
      email: "发送邮件",
      phone: "发送短信",
      social: "触达社媒账号",
    };
    const PAY_LABEL: Record<string, string> = {
      alipay: "支付宝",
      wechat: "微信支付",
      corp: "对公转账",
    };
    const opLabel = (e: LedgerEntry) => {
      if (e.kind === "view") return VIEW_ACTION[e.field!] ?? "";
      if (e.kind === "reach" || e.kind === "refund")
        return e.channel
          ? e.channel === "social" && e.platform === "WhatsApp"
            ? "触达 WhatsApp"
            : REACH_ACTION[e.channel] ?? ""
          : "";
      if (e.kind === "recharge") return PAY_LABEL[e.paymentMethod ?? ""] ?? "";
      return "";
    };
    const detailText = (e: LedgerEntry) => {
      const prefix =
        e.kind === "refund" ? "触达失败退还 · " : e.kind === "recharge" ? "套餐充值 · " : "";
      const target =
        e.kind === "recharge"
          ? e.orderNo
            ? `订单 ${e.orderNo}`
            : ""
          : e.targetKind === "enterprise"
            ? e.targetName
            : `${e.parentRef?.name ?? "—"} · ${e.targetName}`;
      const detail = e.detail ?? "";
      return [`${prefix}${detail}`, target].filter(Boolean).join(" | ");
    };
    const rows = [
      ["时间", "变动类型", "操作", "明细说明", "积分变动", "变动后余额"],
      ...filtered.map((e) => [
        fmtTime(e.createdAt),
        e.kind === "refund"
          ? "服务失败退款"
          : e.kind === "recharge"
            ? "充值"
            : e.kind === "feedback_reward"
              ? "数据反馈奖励"
              : "消费积分",
        opLabel(e),
        detailText(e),
        `${isIncome(e) ? "+" : "-"}${e.cost}`,
        String(balanceMap.get(e.id) ?? ""),
      ]),
    ];
    const csv = rows
      .map((r) =>
        r
          .map((c) => {
            const s = String(c ?? "");
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(","),
      )
      .join("\n");
    // UTF-8 BOM for Excel compatibility
    const blob = new Blob(["\ufeff" + csv], {
      type: format === "excel" ? "application/vnd.ms-excel;charset=utf-8" : "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}_${p(now.getHours())}${p(now.getMinutes())}`;
    a.href = url;
    a.download = `账单_${stamp}.${format === "excel" ? "csv" : "csv"}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${filtered.length} 条账单`);
  }

  return (
    <TooltipProvider delayDuration={200}>
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>出海大数据平台</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">消费明细</span>
      </div>

      <section
        className="relative overflow-hidden rounded-2xl p-6 text-white"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Receipt className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">消费明细</h1>
            <p className="text-white/85 text-sm mt-0.5">
              按次记录信息查看、触达发送、AI 生成等积分消耗；充值订单请见「账户充值」，开票请见「发票管理」
            </p>
          </div>
          <div className="flex items-stretch gap-4">
            <div className="rounded-xl bg-white/15 backdrop-blur-sm px-4 py-2.5 min-w-[180px]">
              <div className="text-[11px] opacity-80 flex items-center gap-1">
                <Wallet className="h-3 w-3" />
                当前积分余额
              </div>
              <div
                className={cn(
                  "text-2xl font-bold tabular-nums mt-0.5",
                  lowBalance && "text-amber-200",
                )}
              >
                {balance.balance.toLocaleString()}
                <span className="text-sm font-normal ml-1 opacity-90">积分</span>
              </div>
              <div
                className={cn(
                  "text-[11px] mt-0.5 flex items-center gap-1",
                  expiringSoon ? "text-amber-200" : "text-white/75",
                )}
              >
                {expiringSoon && <AlertTriangle className="h-3 w-3" />}
                有效期至 {formatExpiry(balance.expiresAt)}
              </div>
            </div>
          </div>
        </div>
        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          <Button
            asChild
            size="sm"
            className={cn(
              "h-8 bg-white text-primary hover:bg-white/90 font-medium",
              lowBalance && "ring-2 ring-amber-300",
            )}
          >
            <Link to="/outreach/recharge" search={{ from: "billing" }}>
              <Wallet className="h-3.5 w-3.5 mr-1.5" />
              积分充值
              {lowBalance && (
                <span className="ml-1.5 inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
              )}
            </Link>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setRulesOpen(true)}
            className="h-8 bg-white/15 text-white border-white/20 hover:bg-white/25"
          >
            <HelpCircle className="h-3.5 w-3.5 mr-1.5" />
            积分规则
          </Button>
          <Button
            asChild
            size="sm"
            variant="secondary"
            className="h-8 bg-white/15 text-white border-white/20 hover:bg-white/25"
          >
            <Link to="/outreach/invoices">
              <Receipt className="h-3.5 w-3.5 mr-1.5" />
              发票管理
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="secondary"
            className="h-8 bg-white/15 text-white border-white/20 hover:bg-white/25"
          >
            <Link to="/outreach/billing-empty">
              <EyeOff className="h-3.5 w-3.5 mr-1.5" />
              查看空状态演示
            </Link>
          </Button>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={<Wallet className="h-5 w-5" />}
          label="累计发放积分"
          value={stats.granted}
          unit="积分"
          tone="emerald"
          hint="历史累计充值/发放到账"
        />
        <StatCard
          icon={<TrendingDown className="h-5 w-5" />}
          label="已消费积分"
          value={stats.consumed}
          unit="积分"
          tone="rose"
          hint="信息查看 + 触达发送 + AI生成 - 失败退还"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="已失效积分"
          value={0}
          unit="积分"
          tone="slate"
          hint="已过有效期未使用的积分"
        />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="px-5 py-3 flex items-center gap-3 flex-wrap border-b border-border bg-muted/20">
          <DateField label="开始日期" value={dateFrom} onChange={setDateFrom} />
          <DateField label="结束日期" value={dateTo} onChange={setDateTo} min={dateFrom} />
          <Select value={tab} onValueChange={(v) => setTab(v as TabKey)}>
            <SelectTrigger className="h-9 w-[180px] bg-background">
              <SelectValue placeholder="变动类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部变动</SelectItem>
              <SelectItem value="consume">
                <span className="inline-flex items-center gap-1.5">
                  <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
                  消费积分
                </span>
              </SelectItem>
              <SelectItem value="refund">
                <span className="inline-flex items-center gap-1.5">
                  <Undo2 className="h-3.5 w-3.5 text-emerald-600" />
                  服务失败退款
                </span>
              </SelectItem>
              <SelectItem value="recharge">
                <span className="inline-flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 text-emerald-600" />
                  充值
                </span>
              </SelectItem>
              <SelectItem value="expire">
                <span className="inline-flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-slate-500" />
                  失效
                </span>
              </SelectItem>
              <SelectItem value="package_recharge">
                <span className="inline-flex items-center gap-1.5">
                  <Wallet className="h-3.5 w-3.5 text-primary" />
                  套餐充值
                </span>
              </SelectItem>
              <SelectItem value="recharge_refund">
                <span className="inline-flex items-center gap-1.5">
                  <Undo2 className="h-3.5 w-3.5 text-amber-600" />
                  充值退款
                </span>
              </SelectItem>
              <SelectItem value="feedback_reward">
                <span className="inline-flex items-center gap-1.5">
                  <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" />
                  数据反馈奖励
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          {(dateFrom || dateTo || tab !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom(undefined);
                setDateTo(undefined);
                setTab("all");
              }}
              className="gap-1"
            >
              <X className="h-3.5 w-3.5" />
              清除
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 gap-1.5" disabled={filtered.length === 0}>
                <Download className="h-3.5 w-3.5" />
                导出
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("csv")}>导出 CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("excel")}>
                导出 Excel（兼容 CSV）
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="ml-auto" />
        </div>

        {filtered.length === 0 ? (
          <div className="p-16 flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <Receipt className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="text-base font-medium">暂无账单记录</div>
            <div className="text-sm text-muted-foreground max-w-md">
              查看企业 / 人物的关键信息或发起触达后，账单会在此处汇总。积分不足？
              <Link
                to="/outreach/recharge"
                search={{ from: "billing" }}
                className="text-primary hover:underline ml-1"
              >
                立即充值
              </Link>
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-primary/5 hover:bg-primary/5">
                <TableHead className="w-[170px]">时间</TableHead>
                <TableHead className="w-[160px] whitespace-nowrap">变动类型</TableHead>
                <TableHead className="w-[160px]">操作</TableHead>
                <TableHead className="w-[110px]">
                  <span className="inline-flex items-center gap-1">
                    积分变动
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setRulesOpen(true)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <HelpCircle className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        信息查看 10~60 积分/字段 · 触达-发送 10~100 积分/次 · 触达-AI生成 2~3 积分/次 · 失败自动退还
                      </TooltipContent>
                    </Tooltip>
                  </span>
                </TableHead>
                <TableHead className="w-[130px]">变动后余额</TableHead>
                <TableHead>明细说明</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map((e) => (
                <TableRow key={e.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono tabular-nums text-xs text-muted-foreground">
                    {fmtTime(e.createdAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <KindBadge entry={e} />
                  </TableCell>
                  <TableCell>
                    <FieldCell entry={e} />
                  </TableCell>
                  <TableCell
                    className={cn(
                      "font-semibold tabular-nums",
                      isIncome(e)
                        ? "text-emerald-600"
                        : "text-rose-600",
                    )}
                  >
                    {isIncome(e) ? "+" : "-"}
                    {e.cost.toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono tabular-nums text-sm">
                    {(balanceMap.get(e.id) ?? 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs max-w-[380px]">
                    <DetailCell entry={e} />
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
              total={filtered.length}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>
      <RulesSheet open={rulesOpen} onOpenChange={setRulesOpen} />
    </div>
    </TooltipProvider>
  );
}

function StatCard({
  icon,
  label,
  value,
  unit,
  tone,
  positive,
  signed,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  unit: string;
  tone: "primary" | "sky" | "violet" | "slate" | "emerald" | "amber" | "rose";
  positive?: boolean;
  signed?: boolean;
  hint?: string;
}) {
  const toneMap = {
    primary: "bg-primary/10 text-primary ring-primary/20",
    sky: "bg-sky-50 text-sky-600 ring-sky-200",
    violet: "bg-violet-50 text-violet-600 ring-violet-200",
    slate: "bg-slate-50 text-slate-600 ring-slate-200",
    emerald: "bg-emerald-50 text-emerald-600 ring-emerald-200",
    amber: "bg-amber-50 text-amber-600 ring-amber-200",
    rose: "bg-rose-50 text-rose-600 ring-rose-200",
  } as const;
  return (
    <div className="rounded-xl ring-1 ring-border bg-card p-5 flex items-center gap-4">
      <div className={cn("h-10 w-10 rounded-lg ring-1 flex items-center justify-center", toneMap[tone])}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {label}
          {hint && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground/70 hover:text-foreground"
                  aria-label={`${label}说明`}
                >
                  <HelpCircle className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs">
                {hint}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span
            className={cn(
              "text-2xl font-bold tabular-nums",
              positive && value > 0 && "text-emerald-600",
              signed && value > 0 && "text-emerald-600",
              signed && value < 0 && "text-rose-600",
            )}
          >
            {signed ? (value > 0 ? "+" : value < 0 ? "−" : "") : positive && value > 0 ? "+" : ""}
            {Math.abs(value).toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">{unit}</span>
        </div>
      </div>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function DateField({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
  min?: Date;
}) {
  const fmt = (d: Date) =>
    `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 justify-start gap-2 bg-background font-normal min-w-[170px]",
            !value && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 opacity-70" />
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="ml-auto tabular-nums text-foreground">
            {value ? fmt(value) : "年/月/日"}
          </span>
          {value && (
            <X
              className="h-3.5 w-3.5 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange(undefined);
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          disabled={min ? (d) => d < new Date(new Date(min).setHours(0, 0, 0, 0)) : undefined}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

function KindBadge({ entry }: { entry: LedgerEntry }) {
  if (entry.kind === "refund") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium bg-emerald-50 text-emerald-700 border-emerald-200">
        <Undo2 className="h-3 w-3" />
        服务失败退款
      </span>
    );
  }
  if (entry.kind === "recharge") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium bg-primary/10 text-primary border-primary/20">
        <Wallet className="h-3 w-3" />
        充值
      </span>
    );
  }
  if (entry.kind === "feedback_reward") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium bg-emerald-50 text-emerald-700 border-emerald-200">
        <BadgeCheck className="h-3 w-3" />
        数据反馈奖励
      </span>
    );
  }
  // view / reach / ai_generate → 消费积分
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium bg-rose-50 text-rose-700 border-rose-200">
      <TrendingDown className="h-3 w-3" />
      消费积分
    </span>
  );
}

function FieldCell({ entry }: { entry: LedgerEntry }) {
  if (entry.kind === "recharge") {
    const label =
      entry.paymentMethod === "alipay"
        ? "支付宝"
        : entry.paymentMethod === "corp"
          ? "对公转账"
          : "微信支付";
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Wallet className="h-3.5 w-3.5" />
        <span className="text-foreground">{label}</span>
      </span>
    );
  }
  if (entry.kind === "view") {
    const Icon: Record<ViewField, typeof Mail> = {
      email: Mail,
      phone: Phone,
      social: Globe,
      address: MapPin,
      title: Briefcase,
      seniority: BadgeCheck,
    };
    const I = Icon[entry.field!];
    const VIEW_ACTION_LABEL: Record<ViewField, string> = {
      email: "查看邮箱",
      phone: "查看电话",
      social: "查看社媒账号",
      address: "查看地址",
      title: "查看职位",
      seniority: "查看职级",
    };
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <I className="h-3.5 w-3.5" />
        <span className="text-foreground">{VIEW_ACTION_LABEL[entry.field!]}</span>
      </span>
    );
  }
  if (entry.kind === "ai_generate") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" />
        <span className="text-foreground">AI 文案生成</span>
      </span>
    );
  }
  if (entry.kind === "feedback_reward") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <BadgeCheck className="h-3.5 w-3.5" />
        <span className="text-foreground">数据反馈采纳</span>
      </span>
    );
  }
  if (entry.kind === "social_account_purchase") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Wallet className="h-3.5 w-3.5" />
        <span className="text-foreground">购买社媒账号</span>
      </span>
    );
  }
  if (entry.kind === "social_add_friend") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Globe className="h-3.5 w-3.5" />
        <span className="text-foreground">
          {entry.platform === "TikTok" ? "触达社媒 · 关注" : "触达社媒 · 加友"}
        </span>
      </span>
    );
  }
  if (entry.kind === "social_dm") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Globe className="h-3.5 w-3.5" />
        <span className="text-foreground">触达社媒 · 私信</span>
      </span>
    );
  }
  // reach or refund — both use channel
  if (!entry.channel) return <span className="text-xs text-muted-foreground">—</span>;
  const Icon: Record<ReachChannel, typeof Mail> = {
    email: Mail,
    phone: Phone,
    social: Globe,
  };
  const I = Icon[entry.channel];
  const REACH_ACTION_LABEL: Record<ReachChannel, string> = {
    email: "发送邮件",
    phone: "发送短信",
    social: "触达社媒账号",
  };
  const label =
    entry.channel === "social" && entry.platform === "WhatsApp"
      ? "触达 WhatsApp"
      : REACH_ACTION_LABEL[entry.channel];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <I className="h-3.5 w-3.5" />
      <span className="text-foreground">{label}</span>
    </span>
  );
}

function DetailCell({ entry: e }: { entry: LedgerEntry }) {
  const detail = e.detail ?? "—";
  const prefix =
    e.kind === "refund"
      ? "触达失败退还 · "
      : e.kind === "recharge"
        ? "套餐充值 · "
        : "";
  const target =
    e.kind === "recharge"
      ? e.orderNo
        ? `订单 ${e.orderNo}`
        : ""
      : e.targetKind === "enterprise"
        ? e.targetName
        : `${e.parentRef?.name ?? "—"} · ${e.targetName}`;
  const link =
    e.kind === "recharge"
      ? null
      : e.targetKind === "enterprise"
        ? findEnterprise(e.targetId)
          ? { to: "/outreach/enterprise/$id" as const, params: { id: e.targetId } }
          : null
        : (() => {
            const [entId, idx] = e.targetId.split(":");
            return findEnterprise(entId)
              ? {
                  to: "/outreach/enterprise/$id/contact/$idx" as const,
                  params: { id: entId, idx },
                }
              : null;
          })();
  return (
    <div className="min-w-0">
      <div className="font-mono text-xs text-foreground truncate">
        {prefix}
        {detail}
      </div>
      {target && (
        <div className="text-[11px] text-muted-foreground truncate mt-0.5 flex items-center gap-1">
          {e.kind === "recharge" ? (
            <Wallet className="h-3 w-3" />
          ) : e.targetKind === "enterprise" ? (
            <Building2 className="h-3 w-3" />
          ) : (
            <UserRound className="h-3 w-3" />
          )}
          {link ? (
            <Link
              to={link.to}
              params={link.params as never}
              className="capitalize hover:text-primary truncate"
            >
              {target}
            </Link>
          ) : (
            <span className="capitalize truncate">{target}</span>
          )}
        </div>
      )}
    </div>
  );
}

function TargetCell({ entry: e }: { entry: LedgerEntry }) {
  if (e.kind === "recharge") {
    return (
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Wallet className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="font-medium truncate text-sm">{e.targetName}</div>
          <div className="text-xs text-muted-foreground tabular-nums">{e.orderNo ?? "—"}</div>
        </div>
      </div>
    );
  }
  if (e.targetKind === "enterprise") {
    const exists = !!findEnterprise(e.targetId);
    if (!exists) {
      return (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-md bg-muted text-muted-foreground flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate capitalize text-sm">{e.targetName}</div>
            <div className="text-xs text-muted-foreground">企业</div>
          </div>
        </div>
      );
    }
    return (
      <Link
        to="/outreach/enterprise/$id"
        params={{ id: e.targetId }}
        className="group flex items-center gap-2.5 min-w-0"
      >
        <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="font-medium truncate group-hover:text-primary capitalize text-sm">
            {e.targetName}
          </div>
          <div className="text-xs text-muted-foreground">企业</div>
        </div>
      </Link>
    );
  }
  const [entId, idx] = e.targetId.split(":");
  const parentExists = !!findEnterprise(entId);
  if (!parentExists) {
    return (
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
          <UserRound className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="font-medium truncate capitalize text-sm">{e.targetName}</div>
          <div className="text-xs text-muted-foreground truncate">
            {e.parentRef?.name ?? "—"}
          </div>
        </div>
      </div>
    );
  }
  return (
    <Link
      to="/outreach/enterprise/$id/contact/$idx"
      params={{ id: entId, idx }}
      className="group flex items-center gap-2.5 min-w-0"
    >
      <div className="h-8 w-8 rounded-full bg-accent/20 text-accent-foreground flex items-center justify-center shrink-0">
        <UserRound className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="font-medium truncate group-hover:text-primary capitalize text-sm">
          {e.targetName}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {e.parentRef?.name ?? "—"}
        </div>
      </div>
    </Link>
  );
}