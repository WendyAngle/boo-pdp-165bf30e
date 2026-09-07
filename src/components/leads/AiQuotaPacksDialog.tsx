import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Sparkles,
  Check,
  Zap,
  Coins,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  addAiBonusQuota,
  AI_DAILY_FREE,
  AI_OVERAGE_POINTS,
  consumePoints,
  getAiBonusQuota,
  getAiFreeLeft,
  getPointBalance,
} from "@/lib/leads";

interface QuotaPack {
  id: string;
  count: number;
  price: number;
  label: string;
  popular?: boolean;
  saveRate: number;
}

const PACKS: QuotaPack[] = [
  { id: "s", count: 10, price: 180, label: "小包", saveRate: 0.1 },
  { id: "m", count: 50, price: 800, label: "标准", popular: true, saveRate: 0.2 },
  { id: "l", count: 200, price: 2800, label: "团队", saveRate: 0.3 },
];

export function AiQuotaPacksDialog({
  open,
  onOpenChange,
  onPurchased,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPurchased?: () => void;
}) {
  const [selected, setSelected] = useState<string>("m");
  const balance = getPointBalance();
  const freeLeft = getAiFreeLeft();
  const bonus = getAiBonusQuota();
  const pkg = PACKS.find((p) => p.id === selected)!;
  const insufficient = balance < pkg.price;

  function handleConfirm() {
    if (insufficient) return;
    consumePoints(pkg.price);
    addAiBonusQuota(pkg.count);
    toast.success("扩容包购买成功", {
      description: `+${pkg.count} 次 AI 推荐已到账，可立即使用`,
      icon: <Sparkles className="h-4 w-4" />,
    });
    onOpenChange(false);
    onPurchased?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            购买 AI 推荐扩容包
          </DialogTitle>
          <DialogDescription>
            扩容包用于在当日免费配额耗尽后继续生成 AI 推荐，单次低至{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {(pkg.price / pkg.count).toFixed(1)}
            </span>{" "}
            积分 / 次，比超额单价（{AI_OVERAGE_POINTS} 积分）更划算。
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl bg-muted/40 px-4 py-3 grid grid-cols-3 text-sm">
          <Stat label="今日剩余免费" value={`${freeLeft} / ${AI_DAILY_FREE}`} />
          <Stat label="已购扩容包" value={`${bonus} 次`} accent={bonus > 0} />
          <Stat label="积分余额" value={balance.toLocaleString()} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PACKS.map((p) => {
            const active = selected === p.id;
            const perUnit = (p.price / p.count).toFixed(1);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id)}
                className={cn(
                  "relative rounded-xl ring-1 p-4 text-left transition-all",
                  active
                    ? "ring-2 ring-primary bg-primary/5 shadow-sm"
                    : "ring-border bg-card hover:ring-primary/40",
                )}
              >
                {p.popular && (
                  <Badge className="absolute -top-2 right-3 bg-primary text-[10px] h-5">
                    推荐
                  </Badge>
                )}
                <div className="text-xs text-muted-foreground">{p.label}</div>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-2xl font-bold tabular-nums">{p.count}</span>
                  <span className="text-xs text-muted-foreground">次 AI 推荐</span>
                </div>
                <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-600">
                  <Zap className="h-3 w-3" />
                  低至 {perUnit} 积分 / 次（省 {Math.round(p.saveRate * 100)}%）
                </div>
                <Separator className="my-3" />
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted-foreground">售价</span>
                  <span className="text-sm font-semibold tabular-nums inline-flex items-center gap-1">
                    <Coins className="h-3.5 w-3.5 text-primary" />
                    {p.price.toLocaleString()} 积分
                  </span>
                </div>
                {active && (
                  <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {insufficient ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <div className="flex-1">
              积分余额不足以购买当前套餐（差 {(pkg.price - balance).toLocaleString()} 分）。
              <Link
                to="/outreach/recharge"
                search={{ from: "leads", intent: "lowBalance" }}
                className="ml-1 text-primary hover:underline inline-flex items-center gap-0.5"
                onClick={() => onOpenChange(false)}
              >
                去充值 <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
            · 扩容包永久有效，不随每日免费配额清零；优先消耗当日免费次数后再扣扩容包。
            <br />
            · 推荐结果免费查看，联系方式 / 触达另按既有规则扣减。
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleConfirm} disabled={insufficient} className="gap-1.5">
            <Coins className="h-4 w-4" />
            确认购买 · {pkg.price.toLocaleString()} 积分
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-0.5 text-base font-semibold tabular-nums",
          accent && "text-primary",
        )}
      >
        {value}
      </div>
    </div>
  );
}
