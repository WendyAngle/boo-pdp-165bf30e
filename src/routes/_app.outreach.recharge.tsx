import { useMemo, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import {
  Wallet,
  Sparkles,
  Zap,
  Check,
  ArrowLeft,
  ShieldCheck,
  FileText,
  Building2,
  AlertTriangle,
  Loader2,
  Receipt,
  ChevronRight,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import {
  addCredits,
  RECHARGE_PACKAGES,
  useCreditBalance,
  formatExpiry,
  isBalanceLow,
  isExpiringSoon,
  type RechargePackage,
} from "@/lib/credits-balance";
import { useLedger, recordRecharge } from "@/lib/credits-ledger";
import { RulesSheet } from "@/components/billing/RulesSheet";

type FromSource = "billing" | "leads" | "reach" | "home";
type Intent = "lowBalance" | "expiring" | undefined;

const FROM_LABEL: Record<FromSource, { label: string; to: string }> = {
  billing: { label: "账单", to: "/outreach/billing" },
  leads: { label: "线索", to: "/outreach/leads" },
  reach: { label: "触达", to: "/outreach/reach" },
  home: { label: "首页", to: "/" },
};

export const Route = createFileRoute("/_app/outreach/recharge")({
  head: () => ({
    meta: [
      { title: "出海大数据平台 · 充值 | 出海大数据平台" },
      { name: "description", content: "积分充值 · 选择套餐与支付方式，立即到账" },
    ],
  }),
  validateSearch: (s) =>
    z
      .object({
        from: z.enum(["billing", "leads", "reach", "home"]).optional(),
        intent: z.enum(["lowBalance", "expiring"]).optional(),
      })
      .parse(s),
  component: RechargePage,
});

type PaymentMethod = "wechat" | "alipay" | "corp";

const PAYMENT_METHODS: { id: PaymentMethod; label: string; desc: string; badge?: string }[] = [
  { id: "wechat", label: "微信支付", desc: "扫码完成支付，秒级到账" },
  { id: "alipay", label: "支付宝", desc: "扫码或登录账户支付" },
  { id: "corp", label: "对公转账", desc: "适合企业大额充值，T+1 工作日到账", badge: "需上传回单" },
];

const CUSTOM_ID = "custom";

function fmtOrderNo() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `R${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function bonusForCustom(amount: number) {
  // 满 ¥100 起，每满 ¥100 赠 5% 积分（1元=10积分基准）
  if (amount < 100) return 0;
  const credits = amount * 10;
  return Math.floor((credits * 0.05 * Math.floor(amount / 100)) / Math.floor(amount / 100));
}

function RechargePage() {
  const search = Route.useSearch();
  const from = search.from as FromSource | undefined;
  const intent = search.intent as Intent;
  const router = useRouter();
  const balance = useCreditBalance();
  const lowBalance = isBalanceLow(balance);
  const expiringSoon = isExpiringSoon(balance);

  const [selectedId, setSelectedId] = useState<string>(
    intent === "lowBalance" ? "standard" : "standard",
  );
  const [customAmount, setCustomAmount] = useState<number>(300);
  const [method, setMethod] = useState<PaymentMethod>("wechat");
  const [needInvoice, setNeedInvoice] = useState(false);
  const [invoice, setInvoice] = useState({
    type: "company" as "company" | "personal",
    title: "",
    taxNo: "",
    email: "",
  });
  const [paying, setPaying] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<{ no: string; credits: number; price: number } | null>(
    null,
  );
  const ledger = useLedger();
  const recentRecharges = useMemo(
    () => ledger.filter((e) => e.kind === "recharge").slice(0, 5),
    [ledger],
  );

  const isCustom = selectedId === CUSTOM_ID;
  const pkg = useMemo<RechargePackage | null>(
    () => (isCustom ? null : RECHARGE_PACKAGES.find((p) => p.id === selectedId) ?? null),
    [isCustom, selectedId],
  );

  const order = useMemo(() => {
    if (isCustom) {
      const price = Math.max(10, Math.floor(customAmount));
      const credits = price * 10;
      const bonus = bonusForCustom(price);
      return { price, credits, bonus, label: "自定义" };
    }
    return {
      price: pkg!.price,
      credits: pkg!.credits,
      bonus: pkg!.bonus,
      label: pkg!.label,
    };
  }, [isCustom, pkg, customAmount]);

  const totalCredits = order.credits + order.bonus;
  const unitPrice = order.price > 0 ? (order.price / (order.credits / 100)).toFixed(2) : "0";

  function handlePay() {
    if (needInvoice && invoice.type === "company" && (!invoice.title || !invoice.taxNo)) {
      toast.error("请填写完整的发票抬头与税号");
      return;
    }
    if (needInvoice && !invoice.email) {
      toast.error("请填写接收发票的邮箱");
      return;
    }
    setPaying(true);
    window.setTimeout(() => {
      const no = fmtOrderNo();
      addCredits(totalCredits);
      recordRecharge({
        orderNo: no,
        packageLabel: order.label,
        credits: order.credits,
        bonus: order.bonus,
        price: order.price,
        paymentMethod: method,
      });
      setLastOrder({ no, credits: totalCredits, price: order.price });
      setPaying(false);
      toast.success("充值成功（演示）", {
        description: `订单 ${no} · +${totalCredits} 积分已到账`,
        icon: <Sparkles className="h-4 w-4" />,
        action: from
          ? {
              label: `返回${FROM_LABEL[from].label}`,
              onClick: () => router.history.back(),
            }
          : undefined,
      });
    }, 1100);
  }

  const back = from ? FROM_LABEL[from] : null;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* 回跳条 */}
      {back && (
        <button
          onClick={() => router.history.back()}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          返回{back.label}
        </button>
      )}

      {/* Banner */}
      <section
        className="relative overflow-hidden rounded-2xl p-6 lg:p-8 text-white"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute right-20 top-6 h-28 w-28 rounded-2xl bg-white/10 backdrop-blur-sm rotate-12" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 text-xs text-white/80">
              <Wallet className="h-3.5 w-3.5" /> 积分充值
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">为账户充值积分</h1>
            <p className="mt-2 text-white/85 text-sm">
              充值后积分有效期顺延 365 天，演示环境不会发起真实支付。
            </p>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setRulesOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs px-2.5 py-1 backdrop-blur-sm transition-colors"
              >
                <HelpCircle className="h-3 w-3" /> 计费说明（各操作扣分、失败退款、免费额度）
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6 text-white">
            <div>
              <div className="text-xs text-white/75">当前余额</div>
              <div className="mt-1 text-2xl font-bold tabular-nums">
                {balance.balance.toLocaleString()}
              </div>
              {lowBalance && (
                <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-200">
                  <AlertTriangle className="h-3 w-3" /> 余额偏低
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-white/75">有效期至</div>
              <div className="mt-1 text-sm font-medium tabular-nums">
                {formatExpiry(balance.expiresAt).slice(0, 10)}
              </div>
              {expiringSoon && (
                <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-200">
                  <AlertTriangle className="h-3 w-3" /> 即将到期
                </div>
              )}
            </div>
            <div>
              <div className="text-xs text-white/75">累计充值</div>
              <div className="mt-1 text-sm font-medium tabular-nums">¥ 1,286</div>
              <div className="mt-1 text-[11px] text-white/70">近 12 个月（演示）</div>
            </div>
          </div>
        </div>
      </section>

      {/* 成功状态条 */}
      {lastOrder && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-sm">
            <div className="h-8 w-8 rounded-full bg-emerald-500 text-white flex items-center justify-center">
              <Check className="h-4 w-4" />
            </div>
            <div>
              <div className="font-medium text-emerald-900">
                订单 {lastOrder.no} 已到账 · +{lastOrder.credits} 积分
              </div>
              <div className="text-xs text-emerald-700/80">
                有效期已顺延 365 天，可在「账单」中查看记录
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="h-8">
              <Link to="/outreach/billing">查看账单</Link>
            </Button>
            <Button asChild size="sm" className="h-8">
              <Link
                to="/outreach/invoices"
                search={{ action: "apply", orderNo: lastOrder.no }}
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                申请发票
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="h-8" onClick={() => setLastOrder(null)}>
              知道了
            </Button>
          </div>
        </div>
      )}

      {/* 主体：左 step / 右 summary */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        <div className="space-y-6">
          {/* Step 1 选择套餐 */}
          <section className="rounded-xl border bg-card">
            <header className="px-5 py-4 border-b flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
                1
              </span>
              <h2 className="text-sm font-semibold">选择充值套餐</h2>
              <span className="text-xs text-muted-foreground ml-auto">¥1 = 10 积分基准</span>
            </header>
            <div className="p-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
              {RECHARGE_PACKAGES.map((p) => {
                const active = selectedId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={cn(
                      "relative rounded-xl ring-1 p-4 text-left transition-all",
                      active
                        ? "ring-2 ring-primary bg-primary/5 shadow-sm"
                        : "ring-border bg-card hover:ring-primary/40",
                    )}
                  >
                    {p.popular && (
                      <Badge className="absolute -top-2 right-3 bg-primary text-[10px] h-5">
                        热门
                      </Badge>
                    )}
                    <div className="text-xs text-muted-foreground">{p.label}</div>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-xl font-bold tabular-nums">
                        {p.credits.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground">积分</span>
                    </div>
                    {p.bonus > 0 ? (
                      <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-600">
                        <Zap className="h-3 w-3" />赠 {p.bonus}
                      </div>
                    ) : (
                      <div className="mt-1 text-[11px] text-muted-foreground/70">—</div>
                    )}
                    <div className="mt-3 text-sm font-semibold text-foreground">¥ {p.price}</div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      ¥{(p.price / (p.credits / 100)).toFixed(2)} / 100 积分
                    </div>
                    {active && (
                      <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                );
              })}
              {/* 自定义 */}
              <button
                type="button"
                onClick={() => setSelectedId(CUSTOM_ID)}
                className={cn(
                  "relative rounded-xl ring-1 p-4 text-left transition-all border-dashed",
                  isCustom
                    ? "ring-2 ring-primary bg-primary/5"
                    : "ring-border bg-card hover:ring-primary/40",
                )}
              >
                <div className="text-xs text-muted-foreground">自定义</div>
                <div className="mt-2 text-sm font-medium text-foreground">手动输入金额</div>
                <div className="mt-3 text-[11px] text-muted-foreground">满 ¥100 起赠 5%</div>
                {isCustom && (
                  <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </button>
            </div>
            {isCustom && (
              <div className="px-5 pb-5 -mt-1 flex flex-wrap items-center gap-3">
                <Label htmlFor="amt" className="text-sm">
                  自定义金额
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    ¥
                  </span>
                  <Input
                    id="amt"
                    type="number"
                    min={10}
                    step={10}
                    value={customAmount}
                    onChange={(e) =>
                      setCustomAmount(Math.max(10, Math.floor(Number(e.target.value) || 0)))
                    }
                    className="w-32 pl-7 tabular-nums"
                  />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  ≈ {(customAmount * 10).toLocaleString()} 积分
                  {bonusForCustom(customAmount) > 0 && (
                    <span className="text-emerald-600 ml-1.5">
                      （赠 {bonusForCustom(customAmount)}）
                    </span>
                  )}
                </span>
              </div>
            )}
          </section>

          {/* Step 2 支付方式 */}
          <section className="rounded-xl border bg-card">
            <header className="px-5 py-4 border-b flex items-center gap-2">
              <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
                2
              </span>
              <h2 className="text-sm font-semibold">选择支付方式</h2>
            </header>
            <RadioGroup
              value={method}
              onValueChange={(v) => setMethod(v as PaymentMethod)}
              className="p-5 grid grid-cols-1 md:grid-cols-3 gap-3"
            >
              {PAYMENT_METHODS.map((m) => {
                const active = method === m.id;
                return (
                  <Label
                    key={m.id}
                    htmlFor={`pm-${m.id}`}
                    className={cn(
                      "relative rounded-xl ring-1 p-4 cursor-pointer transition-all",
                      active
                        ? "ring-2 ring-primary bg-primary/5"
                        : "ring-border bg-card hover:ring-primary/40",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <RadioGroupItem id={`pm-${m.id}`} value={m.id} className="mt-0.5" />
                      <div className="flex-1">
                        <div className="text-sm font-medium flex items-center gap-2">
                          {m.label}
                          {m.badge && (
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                              {m.badge}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">{m.desc}</div>
                      </div>
                    </div>
                  </Label>
                );
              })}
            </RadioGroup>
            {method === "corp" && (
              <div className="mx-5 mb-5 rounded-lg bg-muted/40 p-4 text-xs text-muted-foreground space-y-1.5">
                <div className="flex items-center gap-2 text-foreground font-medium text-sm">
                  <Building2 className="h-4 w-4" />
                  对公收款信息（演示）
                </div>
                <div>户名：上海博欧数据科技有限公司</div>
                <div>开户行：招商银行上海分行营业部</div>
                <div>账号：1219 0780 1010 999</div>
                <div className="text-amber-700">
                  打款备注请填写：充值 + 您的企业 ID（在「账单」页查看）
                </div>
              </div>
            )}
          </section>

          {/* Step 3 发票 */}
          <section className="rounded-xl border bg-card">
            <header className="px-5 py-4 border-b flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
                  3
                </span>
                <h2 className="text-sm font-semibold">发票信息</h2>
                <span className="text-xs text-muted-foreground">（可选）</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>需要发票</span>
                <Switch checked={needInvoice} onCheckedChange={setNeedInvoice} />
              </div>
            </header>
            {needInvoice && (
              <div className="p-5 space-y-4">
                <RadioGroup
                  value={invoice.type}
                  onValueChange={(v) =>
                    setInvoice((s) => ({ ...s, type: v as "company" | "personal" }))
                  }
                  className="flex items-center gap-6"
                >
                  <Label className="flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem value="company" /> 企业
                  </Label>
                  <Label className="flex items-center gap-2 text-sm cursor-pointer">
                    <RadioGroupItem value="personal" /> 个人
                  </Label>
                </RadioGroup>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      {invoice.type === "company" ? "公司名称" : "个人姓名"}
                    </Label>
                    <Input
                      value={invoice.title}
                      onChange={(e) => setInvoice((s) => ({ ...s, title: e.target.value }))}
                      placeholder={invoice.type === "company" ? "请输入公司全称" : "请输入姓名"}
                    />
                  </div>
                  {invoice.type === "company" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">统一社会信用代码</Label>
                      <Input
                        value={invoice.taxNo}
                        onChange={(e) => setInvoice((s) => ({ ...s, taxNo: e.target.value }))}
                        placeholder="请输入 18 位税号"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs text-muted-foreground">接收发票邮箱</Label>
                    <Input
                      type="email"
                      value={invoice.email}
                      onChange={(e) => setInvoice((s) => ({ ...s, email: e.target.value }))}
                      placeholder="例如 finance@company.com"
                    />
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  电子发票将在到账后 1-3 个工作日内发送至所填邮箱。
                </div>
              </div>
            )}
          </section>

          {/* 最近记录 */}
          <section className="rounded-xl border bg-card">
            <header className="px-5 py-4 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold">最近充值</h2>
              <Link
                to="/outreach/billing"
                search={{ tab: "recharge" }}
                className="text-xs text-primary hover:underline inline-flex items-center"
              >
                查看全部账单 <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </header>
            {recentRecharges.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                还没有充值记录，完成首次充值后将在此显示
              </div>
            ) : (
              <div className="divide-y">
                {recentRecharges.map((r) => (
                  <div
                    key={r.id}
                    className="px-5 py-3 flex items-center justify-between text-sm hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <Receipt className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium tabular-nums">{r.orderNo ?? r.id}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {formatExpiry(r.createdAt).slice(0, 16)} · {r.targetName}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-emerald-600 tabular-nums">
                        +{r.cost.toLocaleString()} 积分
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        ¥ {r.price ?? "—"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* 右侧订单摘要 */}
        <aside className="lg:sticky lg:top-6 self-start">
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-5 py-4 border-b bg-muted/30">
              <div className="text-xs text-muted-foreground">订单摘要</div>
              <div className="mt-1 text-sm font-semibold">{order.label}套餐</div>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <Row label="基础积分">
                <span className="tabular-nums">{order.credits.toLocaleString()}</span>
              </Row>
              {order.bonus > 0 && (
                <Row label="赠送积分">
                  <span className="tabular-nums text-emerald-600">+{order.bonus}</span>
                </Row>
              )}
              <Row label="到账总计">
                <span className="tabular-nums font-semibold">{totalCredits.toLocaleString()} 积分</span>
              </Row>
              <Row label="单价">
                 <span className="tabular-nums text-muted-foreground">¥{unitPrice} / 100 积分</span>
              </Row>
              <Separator />
              <Row label="支付方式">
                <span>{PAYMENT_METHODS.find((m) => m.id === method)?.label}</span>
              </Row>
              <Row label="发票">
                <span className="text-muted-foreground">
                  {needInvoice
                    ? invoice.type === "company"
                      ? "企业电子发票"
                      : "个人电子发票"
                    : "暂不开具"}
                </span>
              </Row>
              <Separator />
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">应付金额</span>
                <span className="text-2xl font-bold tabular-nums text-primary">
                  ¥{order.price}
                </span>
              </div>
            </div>
            <div className="px-5 pb-5 space-y-2">
              <Button
                onClick={handlePay}
                disabled={paying}
                className="w-full h-10 gap-2"
                size="lg"
              >
                {paying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> 支付中…
                  </>
                ) : (
                  <>
                    <Wallet className="h-4 w-4" /> 立即支付 ¥{order.price}
                  </>
                )}
              </Button>
              <div className="text-[11px] text-muted-foreground text-center inline-flex items-center justify-center gap-1 w-full">
                <ShieldCheck className="h-3 w-3" />
                点击支付即视为同意
                <a className="text-primary hover:underline">《充值服务协议》</a>
              </div>
            </div>
          </div>

          {intent === "lowBalance" && (
            <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex gap-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              检测到余额不足以完成上一步操作，建议至少选择「标准」套餐。
            </div>
          )}
          <div className="mt-3 rounded-xl border bg-card p-4 text-xs text-muted-foreground leading-relaxed">
            <div className="flex items-center gap-1.5 text-foreground font-medium text-sm mb-1.5">
              <FileText className="h-3.5 w-3.5" /> 充值说明
            </div>
            · 演示环境不会发起真实支付。
            <br />
            · 充值积分有效期顺延 365 天，过期后未消耗的积分将自动失效。
            <br />
            · 如需大额充值或定制方案，请联系商务。
          </div>
        </aside>
      </div>
      <RulesSheet open={rulesOpen} onOpenChange={setRulesOpen} />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
