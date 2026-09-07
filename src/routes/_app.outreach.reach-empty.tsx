import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronRight,
  Zap,
  Mail,
  Phone,
  Globe,
  Sparkles,
  MousePointerClick,
  Building2,
  UserRound,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/outreach/reach-empty")({
  head: () => ({
    meta: [{ title: "触达 · 空状态演示 | 出海大数据平台" }],
  }),
  component: ReachEmptyDemo,
});

function ReachEmptyDemo() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>出海大数据平台</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/outreach/reach" className="hover:text-foreground">
            触达
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">空状态演示</span>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/outreach/reach">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            返回触达
          </Link>
        </Button>
      </div>

      <Card className="p-3 px-4 flex items-center gap-2 border-dashed bg-muted/40">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm">
          这是「触达」在<span className="font-medium mx-1">尚未发起任何触达动作</span>时的引导页面演示，用于产品评审与设计走查。
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
            还没有触达记录
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            在企业、关键人物或社交媒体详情中发起触达后，
            <br />
            对应的渠道、状态与积分流水会自动归集在这里，便于统一跟进与回顾。
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl">
            <EmptyEntry
              icon={Mail}
              label="邮件触达"
              desc="对关键联系人邮箱发起触达，自动记录状态与回执"
              tone="text-primary"
              toneBg="bg-primary/10"
            />
            <EmptyEntry
              icon={Phone}
              label="电话触达"
              desc="拨打关键联系人电话，沉淀通话与跟进结果"
              tone="text-amber-600"
              toneBg="bg-amber-500/10"
            />
            <EmptyEntry
              icon={Globe}
              label="社媒触达"
              desc="通过企业社媒账号发起接触，统一记录渠道与平台"
              tone="text-emerald-600"
              toneBg="bg-emerald-500/10"
            />
          </div>

          <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground flex-wrap justify-center">
            <MousePointerClick className="h-3.5 w-3.5" />
            <span>前往</span>
            <Link
              to="/outreach/enterprise"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              <Building2 className="h-3.5 w-3.5" />
              企业
            </Link>
            <span>或人物详情，点击</span>
            <span className="inline-flex h-5 items-center gap-1 px-1.5 rounded bg-primary/10 text-primary">
              <UserRound className="h-3 w-3" />
              触达
            </span>
            <span>按钮即可发起首次触达</span>
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
  icon: typeof Mail;
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
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/15 via-accent/10 to-emerald-300/15 blur-xl" />
      <div className="absolute inset-3 rounded-full border border-dashed border-primary/30" />
      <div className="absolute inset-8 rounded-full border border-dashed border-amber-400/40" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-20 w-20 rounded-2xl bg-background shadow-md border flex items-center justify-center">
          <Zap className="h-10 w-10 text-primary" strokeWidth={1.5} />
        </div>
      </div>
      <div className="absolute -top-1 right-2 h-7 w-7 rounded-lg bg-background shadow border flex items-center justify-center text-primary">
        <Mail className="h-3.5 w-3.5" />
      </div>
      <div className="absolute bottom-1 -left-1 h-7 w-7 rounded-lg bg-background shadow border flex items-center justify-center text-amber-600">
        <Phone className="h-3.5 w-3.5" />
      </div>
      <div className="absolute bottom-4 -right-2 h-7 w-7 rounded-lg bg-background shadow border flex items-center justify-center text-emerald-600">
        <Globe className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}