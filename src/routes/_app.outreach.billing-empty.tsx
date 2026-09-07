import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronRight,
  Receipt,
  Eye,
  Send,
  Undo2,
  Sparkles,
  MousePointerClick,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/outreach/billing-empty")({
  head: () => ({
    meta: [{ title: "账单 · 空状态演示 | 出海大数据平台" }],
  }),
  component: BillingEmptyDemo,
});

function BillingEmptyDemo() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>出海大数据平台</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/outreach/billing" className="hover:text-foreground">
            账单
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">空状态演示</span>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/outreach/billing">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            返回账单
          </Link>
        </Button>
      </div>

      <Card className="p-3 px-4 flex items-center gap-2 border-dashed bg-muted/40">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm">
          这是「账单」在<span className="font-medium mx-1">尚未产生任何积分流水</span>时的引导页面演示，用于产品评审与设计走查。
        </span>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          DEMO
        </Badge>
      </Card>

      <Card className="relative overflow-hidden border-dashed">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            background:
              "radial-gradient(circle at 25% 20%, hsl(var(--primary)) 0%, transparent 40%), radial-gradient(circle at 75% 80%, hsl(var(--accent)) 0%, transparent 40%)",
          }}
        />
        <div className="relative px-6 py-16 flex flex-col items-center text-center">
          <EmptyIllustration />
          <h2 className="mt-6 text-xl font-semibold tracking-tight">
            还没有账单流水
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            查看关键信息（邮箱、电话、社媒等）与发起触达均会消耗积分并在此沉淀为账单。
            <br />
            触达失败的积分将自动退还，账单中亦会同步记录。
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl">
            <EmptyEntry
              icon={Eye}
              label="查看消耗"
              desc="解锁邮箱、电话、社媒等关键信息的密文查看记录"
              tone="text-primary"
              toneBg="bg-primary/10"
            />
            <EmptyEntry
              icon={Send}
              label="触达消耗"
              desc="对企业 / 关键人物发起触达动作产生的积分扣减"
              tone="text-amber-600"
              toneBg="bg-amber-500/10"
            />
            <EmptyEntry
              icon={Undo2}
              label="失败退还"
              desc="触达失败时，对应积分将自动退还并在账单中记录"
              tone="text-emerald-600"
              toneBg="bg-emerald-500/10"
            />
          </div>

          <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground flex-wrap justify-center">
            <MousePointerClick className="h-3.5 w-3.5" />
            <span>前往</span>
            <Link
              to="/outreach/enterprise"
              className="text-primary hover:underline"
            >
              企业
            </Link>
            <span>或</span>
            <Link to="/outreach/reach" className="text-primary hover:underline">
              触达
            </Link>
            <span>开始动作，账单将自动生成对应流水</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function EmptyEntry({
  icon: Icon,
  label,
  desc,
  tone,
  toneBg,
}: {
  icon: typeof Eye;
  label: string;
  desc: string;
  tone: string;
  toneBg: string;
}) {
  return (
    <div className="rounded-xl border bg-background/80 backdrop-blur p-4 text-left">
      <div
        className={`h-9 w-9 rounded-lg flex items-center justify-center mb-2 ${toneBg} ${tone}`}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="font-medium text-sm">{label}</div>
      <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</div>
    </div>
  );
}

function EmptyIllustration() {
  return (
    <div className="relative h-36 w-36">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/15 via-accent/10 to-amber-300/15 blur-xl" />
      <div className="absolute inset-3 rounded-full border border-dashed border-primary/30" />
      <div className="absolute inset-8 rounded-full border border-dashed border-amber-400/40" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-20 w-20 rounded-2xl bg-background shadow-md border flex items-center justify-center">
          <Receipt className="h-10 w-10 text-primary" strokeWidth={1.5} />
        </div>
      </div>
      <div className="absolute -top-1 right-2 h-7 w-7 rounded-lg bg-background shadow border flex items-center justify-center text-primary">
        <Eye className="h-3.5 w-3.5" />
      </div>
      <div className="absolute bottom-1 -left-1 h-7 w-7 rounded-lg bg-background shadow border flex items-center justify-center text-amber-600">
        <Send className="h-3.5 w-3.5" />
      </div>
      <div className="absolute bottom-4 -right-2 h-7 w-7 rounded-lg bg-background shadow border flex items-center justify-center text-emerald-600">
        <Wallet className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}