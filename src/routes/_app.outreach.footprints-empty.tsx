import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronRight,
  Footprints,
  Building2,
  Package,
  
  Sparkles,
  MousePointerClick,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/outreach/footprints-empty")({
  head: () => ({
    meta: [{ title: "足迹 · 空状态演示 | 出海大数据平台" }],
  }),
  component: FootprintsEmptyDemo,
});

function FootprintsEmptyDemo() {
  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>出海大数据平台</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/outreach/footprints" className="hover:text-foreground">
            足迹
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">空状态演示</span>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/outreach/footprints">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            返回足迹
          </Link>
        </Button>
      </div>

      <Card className="p-3 px-4 flex items-center gap-2 border-dashed bg-muted/40">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm">
          这是「足迹」在<span className="font-medium mx-1">尚未产生任何浏览记录</span>时的引导页面演示，用于产品评审与设计走查。
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
            还没有浏览足迹
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            浏览过的企业与商品详情会自动归集在这里，按日期分组沉淀为可回溯的访问轨迹。
            <br />
            点击下方任一入口，开启你的第一段浏览旅程。
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
            <EmptyEntry
              to="/outreach/enterprise"
              icon={Building2}
              label="企业"
              desc="查看目标企业的概况、联系人与贸易关系"
              tone="text-primary"
              toneBg="bg-primary/10"
            />
            <EmptyEntry
              to="/outreach/products"
              icon={Package}
              label="商品"
              desc="按 HS6 浏览商品分类、走势与买卖双方"
              tone="text-amber-600"
              toneBg="bg-amber-500/10"
            />
          </div>

          <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
            <MousePointerClick className="h-3.5 w-3.5" />
            <span>每次进入详情页都会自动记录一次足迹，可按</span>
            <CalendarIcon className="h-3.5 w-3.5" />
            <span>日期与模块筛选查看</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function EmptyEntry({
  to,
  icon: Icon,
  label,
  desc,
  tone,
  toneBg,
}: {
  to: string;
  icon: typeof Building2;
  label: string;
  desc: string;
  tone: string;
  toneBg: string;
}) {
  return (
    <Link
      to={to as any}
      className="group rounded-xl border bg-background/80 backdrop-blur p-4 text-left hover:border-primary/50 hover:shadow-sm transition-all"
    >
      <div
        className={`h-9 w-9 rounded-lg flex items-center justify-center mb-2 ${toneBg} ${tone}`}
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="font-medium text-sm group-hover:text-primary">{label}</div>
      <div className="text-xs text-muted-foreground mt-1 leading-relaxed">
        {desc}
      </div>
    </Link>
  );
}

function EmptyIllustration() {
  return (
    <div className="relative h-36 w-36">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/15 via-accent/10 to-emerald-300/15 blur-xl" />
      <div className="absolute inset-3 rounded-full border border-dashed border-primary/30" />
      <div className="absolute inset-8 rounded-full border border-dashed border-emerald-400/40" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-20 w-20 rounded-2xl bg-background shadow-md border flex items-center justify-center">
          <Footprints className="h-10 w-10 text-primary" strokeWidth={1.5} />
        </div>
      </div>
      <div className="absolute -top-1 right-2 h-7 w-7 rounded-lg bg-background shadow border flex items-center justify-center text-primary">
        <Building2 className="h-3.5 w-3.5" />
      </div>
      <div className="absolute bottom-1 -left-1 h-7 w-7 rounded-lg bg-background shadow border flex items-center justify-center text-amber-600">
        <Package className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}