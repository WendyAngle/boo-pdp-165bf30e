import { useState } from "react";
import { toast } from "sonner";
import { Handshake, Users, Sparkles, Ban, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ManagedStatusBadge } from "@/components/outreach/ManagedStatusBadge";
import {
  useManagedOrders,
  useManagedEngine,
  cancelManagedOrder,
  MANAGED_EMAIL_COST_PER_TARGET,
  MANAGED_ACTIVE_STATUS,
  type ManagedOrder,
} from "@/lib/managed-email";

/** 用户侧：邮件托管批次进度与中途叫停 */
export function ManagedEmailBatches({
  embedded = false,
  onCreate,
}: {
  /** 作为 Tab 内容嵌入时不再包一层卡片与标题 */
  embedded?: boolean;
  onCreate?: () => void;
}) {
  const orders = useManagedOrders();
  useManagedEngine();
  const [cancelOf, setCancelOf] = useState<ManagedOrder | null>(null);

  if (orders.length === 0) {
    if (!embedded) return null;
    return (
      <Card className="p-16 flex flex-col items-center text-center gap-3">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
          <Handshake className="h-7 w-7 text-muted-foreground" />
        </div>
        <div className="text-base font-medium">暂无邮件托管批次</div>
        <div className="text-sm text-muted-foreground max-w-md">
          提交托管需求后，由平台以你的企业名义自动执行，
          {MANAGED_EMAIL_COST_PER_TARGET} 积分/目标，按成功触达数结算，支持中途叫停
        </div>
        {onCreate && (
          <Button size="sm" className="mt-2 gap-1.5" onClick={onCreate}>
            <Handshake className="h-4 w-4" />
            提交托管需求
          </Button>
        )}
      </Card>
    );
  }

  const Wrapper = embedded ? "div" : Card;

  return (
    <Wrapper className={cn(embedded ? "space-y-4" : "p-5 space-y-4")}>
      {!embedded && (
        <div className="flex items-center gap-2">
          <Handshake className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">邮件托管批次</span>
          <span className="text-xs text-muted-foreground">
            由平台以你的企业名义自动执行，{MANAGED_EMAIL_COST_PER_TARGET} 积分/目标
          </span>
        </div>
      )}

      <div className="grid gap-3">
        {orders.map((o) => {
          const pct = o.qty ? Math.round((o.sent / o.qty) * 100) : 0;
          const active = MANAGED_ACTIVE_STATUS.includes(o.status);
          return (
            <div key={o.id} className="rounded-lg border border-border p-4 space-y-2.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm tabular-nums">{o.orderNo}</span>
                <ManagedStatusBadge status={o.status} />
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  {o.source === "own" ? (
                    <Users className="h-3.5 w-3.5" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  {o.source === "own" ? "自有名单" : "AI 智能寻源"}
                </span>
                <span className="text-xs text-muted-foreground">推广产品：{o.product}</span>
                <div className="ml-auto flex items-center gap-3">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    已扣 {o.charged.toLocaleString()} 积分
                    {o.refunded > 0 && `，已退回 ${o.refunded.toLocaleString()}`}
                  </span>
                  {active && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-destructive hover:text-destructive"
                      onClick={() => setCancelOf(o)}
                    >
                      <Ban className="h-3.5 w-3.5" />
                      中途叫停
                    </Button>
                  )}
                </div>
              </div>
              <Progress value={pct} className="h-1.5" />
              <div className="text-xs text-muted-foreground tabular-nums">
                成功触达 {o.sent} / {o.qty}（{pct}%）
                {o.status === "pending" && " · 平台将在 1 个工作日内受理"}
                {o.status === "sourcing" && " · 系统正在自动寻源"}
                {o.status === "paused" && " · 已暂停，恢复后继续执行"}
                {o.exec && o.exec.delivery.refill > 0 &&
                  ` · 退信目标已自动补量 ${o.exec.delivery.refill} 个`}
              </div>
              {(o.rejectReason || o.opsNote) && (
                <div className="text-xs text-muted-foreground rounded-md bg-muted/50 px-2.5 py-1.5">
                  {o.rejectReason ? `驳回原因：${o.rejectReason}` : `执行说明：${o.opsNote}`}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={!!cancelOf} onOpenChange={(v) => !v && setCancelOf(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认中途叫停？</DialogTitle>
            <DialogDescription>
              批次 {cancelOf?.orderNo} 剩余 {cancelOf ? cancelOf.qty - cancelOf.sent : 0} 个未完成目标将停止执行，
              并退回{" "}
              {cancelOf
                ? ((cancelOf.qty - cancelOf.sent) * MANAGED_EMAIL_COST_PER_TARGET).toLocaleString()
                : 0}{" "}
              积分。
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5" />
            已成功触达部分不退积分；叫停后不可恢复，如需继续需重新提交托管需求。
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOf(null)}>
              再想想
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!cancelOf) return;
                cancelManagedOrder(cancelOf.id, "客户中途叫停");
                toast.success("已叫停，未完成目标的积分已退回");
                setCancelOf(null);
              }}
            >
              确认叫停
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Wrapper>
  );
}
