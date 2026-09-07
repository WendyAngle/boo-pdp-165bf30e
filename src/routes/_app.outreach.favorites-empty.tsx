import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Star,
  ChevronRight,
  Building2,
  Package,
  FileText,
  Sparkles,
  MousePointerClick,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/outreach/favorites-empty")({
  head: () => ({
    meta: [{ title: "收藏 · 空状态演示 | 出海大数据平台" }],
  }),
  component: FavoritesEmptyDemo,
});

function FavoritesEmptyDemo() {
  return (
    <div className="p-8 space-y-6">
      {/* 面包屑 + 返回 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>出海大数据平台</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/outreach/favorites" className="hover:text-foreground">
            收藏
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">空状态演示</span>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/outreach/favorites">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            返回收藏中心
          </Link>
        </Button>
      </div>

      {/* 演示说明条 */}
      <Card className="p-3 px-4 flex items-center gap-2 border-dashed bg-muted/40">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm">
          这是「收藏中心」在<span className="font-medium mx-1">没有任何收藏数据</span>时的引导页面演示，用于产品评审与设计走查。
        </span>
        <Badge variant="secondary" className="ml-auto text-[10px]">
          DEMO
        </Badge>
      </Card>

      {/* Empty hero */}
      <Card className="relative overflow-hidden border-dashed">
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            background:
              "radial-gradient(circle at 30% 20%, hsl(var(--primary)) 0%, transparent 40%), radial-gradient(circle at 70% 80%, hsl(var(--accent)) 0%, transparent 40%)",
          }}
        />
        <div className="relative px-6 py-16 flex flex-col items-center text-center">
          <EmptyIllustration />
          <h2 className="mt-6 text-xl font-semibold tracking-tight">
            还没有收藏的内容
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md">
            将常用的企业、关键联系人、感兴趣的商品与提单收藏起来，下次可以一键回查。
            <br />
            点击下方按钮，前往对应模块开启你的第一条收藏。
          </p>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-2xl">
            <EmptyEntry
              to="/outreach/enterprise"
              icon={Building2}
              label="企业"
              desc="在列表或详情页点击星标收藏目标企业与关键人物"
              tone="text-primary"
              toneBg="bg-primary/10"
            />
            <EmptyEntry
              to="/outreach/products"
              icon={Package}
              label="商品"
              desc="收藏关注的 HS6 商品分类与详情数据"
              tone="text-amber-600"
              toneBg="bg-amber-500/10"
            />
            <EmptyEntry
              to="/outreach/bills"
              icon={FileText}
              label="提单"
              desc="对重点提单收藏，便于后续对账与追踪"
              tone="text-emerald-600"
              toneBg="bg-emerald-500/10"
            />
          </div>

          <div className="mt-8 flex items-center gap-3 text-xs text-muted-foreground">
            <MousePointerClick className="h-3.5 w-3.5" />
            <span>提示：列表卡片右上角的</span>
            <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-amber-500/15 text-amber-600">
              <Star className="h-3 w-3" />
            </span>
            <span>按钮即为收藏入口</span>
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
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/15 via-accent/10 to-amber-300/15 blur-xl" />
      <div className="absolute inset-3 rounded-full border border-dashed border-primary/30" />
      <div className="absolute inset-8 rounded-full border border-dashed border-amber-400/40" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-20 w-20 rounded-2xl bg-background shadow-md border flex items-center justify-center">
          <Star className="h-10 w-10 text-amber-400 fill-amber-300" strokeWidth={1.5} />
        </div>
      </div>
      {/* 飘浮小图标 */}
      <div className="absolute -top-1 right-2 h-7 w-7 rounded-lg bg-background shadow border flex items-center justify-center text-primary">
        <Building2 className="h-3.5 w-3.5" />
      </div>
      <div className="absolute bottom-1 -left-1 h-7 w-7 rounded-lg bg-background shadow border flex items-center justify-center text-amber-600">
        <Package className="h-3.5 w-3.5" />
      </div>
      <div className="absolute bottom-4 -right-2 h-7 w-7 rounded-lg bg-background shadow border flex items-center justify-center text-emerald-600">
        <FileText className="h-3.5 w-3.5" />
      </div>
    </div>
  );
}