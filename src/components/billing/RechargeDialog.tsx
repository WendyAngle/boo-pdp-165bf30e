import { useState } from "react";
import { toast } from "sonner";
import { Check, Sparkles, Wallet, Zap } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { addCredits, RECHARGE_PACKAGES, useCreditBalance, formatExpiry } from "@/lib/credits-balance";

export function RechargeDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const balance = useCreditBalance();
  const [selected, setSelected] = useState<string>("standard");
  const pkg = RECHARGE_PACKAGES.find((p) => p.id === selected)!;

  function handleConfirm() {
    addCredits(pkg.credits + pkg.bonus);
    toast.success(`充值成功（演示）`, {
      description: `+${pkg.credits + pkg.bonus} 积分已到账，有效期顺延 365 天`,
      icon: <Sparkles className="h-4 w-4" />,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            积分充值
          </DialogTitle>
          <DialogDescription>
            当前余额 <span className="font-semibold text-foreground tabular-nums">{balance.balance}</span> 积分 · 有效期至 {formatExpiry(balance.expiresAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
          {RECHARGE_PACKAGES.map((p) => {
            const active = selected === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p.id)}
                className={cn(
                  "relative rounded-xl ring-1 p-4 text-left transition-all",
                  active
                    ? "ring-2 ring-primary bg-primary/5"
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
                  <span className="text-xl font-bold tabular-nums">{p.credits.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">积分</span>
                </div>
                {p.bonus > 0 && (
                  <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-600">
                    <Zap className="h-3 w-3" />
                    赠 {p.bonus}
                  </div>
                )}
                <div className="mt-3 text-sm font-semibold text-foreground">¥ {p.price}</div>
                {active && (
                  <div className="absolute top-2 left-2 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground leading-relaxed">
          演示环境：不会发起真实支付。点击「确认充值」将模拟到账，积分有效期顺延 365 天。
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleConfirm} className="gap-1.5">
            <Wallet className="h-4 w-4" />
            确认充值 · ¥{pkg.price}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}