import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Package,
  Search,
  ChevronRight,
  ChevronDown,
  Box,
  Sparkles,
  Hash,
  Building2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import heroBg from "@/assets/products-hero.jpg";
import {
  CATALOG,
  categoryStats,
  totalProducts,
  type L1Item,
  type L2Item,
  type L3Item,
  type L4Item,
} from "@/data/products-catalog";

export const Route = createFileRoute("/_app/outreach/products/")({
  head: () => ({ meta: [{ title: "出海大数据平台 · 商品 | 出海大数据平台" }] }),
  component: ProductsPage,
});

// L1 icon emoji 对应表 (与参考截图风格一致)
const L1_EMOJI: Record<string, string> = {
  农牧渔产品与食品饮料: "🌾",
  "能源、矿产与初级原料": "⛏️",
  "化工品、医药与精细化学品": "🧪",
  塑料及橡胶: "🧴",
  "塑料、橡胶及其制品": "🧴",
  "木材、纸浆、纸品与印刷品": "🪵",
  "纺织、服装与家纺": "🧵",
  "皮革、鞋帽、箱包与配饰": "👜",
  "建材、陶瓷、玻璃与石材": "🧱",
  金属材料与金属制品: "⚙️",
  机械设备与电气设备: "🔌",
  运输设备与零部件: "🚚",
  "光学、医疗与精密仪器": "🔬",
};

function ProductsPage() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");
  const [scope, setScope] = useState<"product" | "hs" | "enterprise">("product");
  const [userScope, setUserScope] = useState<"product" | "hs" | "enterprise">("product");
  const [openL1, setOpenL1] = useState<Record<string, boolean>>({
    "建材、陶瓷、玻璃与石材": true,
  });
  const [openL2, setOpenL2] = useState<Record<string, boolean>>({
    "建材、陶瓷、玻璃与石材::加工石材、石膏与水泥制品": true,
  });
  const [openL3, setOpenL3] = useState<Record<string, boolean>>({
    "建材、陶瓷、玻璃与石材::加工石材、石膏与水泥制品::石材制品": true,
  });

  const stats = useMemo(() => {
    const total = totalProducts();
    return {
      total,
      l1Count: CATALOG.length,
    };
  }, []);

  // 智能识别: 纯数字且 ≥4 位 → 自动切到 HS 编码作用域
  const isDigits = /^\d{4,}$/.test(keyword.trim());
  const effectiveScope: "product" | "hs" | "enterprise" =
    isDigits && userScope !== "enterprise" ? "hs" : userScope;

  // 关键词搜索: 按名称 / 英文名 / HS 编码匹配,自动展开所在分类
  const searchHits = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return null;
    if (effectiveScope === "enterprise") return null;
    const out: { l1: string; l2: string; l3: string; l4: L4Item }[] = [];
    for (const l1 of CATALOG) {
      for (const l2 of l1.l2) {
        for (const l3 of l2.l3) {
          for (const l4 of l3.l4) {
            const hit =
              effectiveScope === "hs"
                ? l4.hs.includes(k)
                : l4.name.toLowerCase().includes(k) ||
                  l4.en.toLowerCase().includes(k) ||
                  l1.name.toLowerCase().includes(k);
            if (hit) {
              out.push({ l1: l1.name, l2: l2.name, l3: l3.name, l4 });
            }
          }
        }
      }
    }
    return out.slice(0, 50);
  }, [keyword, effectiveScope]);

  const goEnterprise = () => {
    const q = keyword.trim();
    navigate({ to: "/outreach/enterprise", search: q ? { q } : {} });
  };

  const onSearchSubmit = () => {
    if (effectiveScope === "enterprise") goEnterprise();
  };

  const SCOPE_META: Record<
    "product" | "hs" | "enterprise",
    { label: string; placeholder: string; helper: string }
  > = {
    product: {
      label: "商品",
      placeholder: "输入商品中 / 英文名称,例如 瓷砖 / ceramic tile",
      helper: `在 ${CATALOG.length} 个一级品类下按商品名称匹配`,
    },
    hs: {
      label: "HS 编码",
      placeholder: "输入 6 / 8 / 10 位 HS 编码,例如 690721",
      helper: "命中后直达商品详情与提单数据",
    },
    enterprise: {
      label: "企业",
      placeholder: '输入企业名称,例如 "Acme Logistics"',
      helper: "回车跳转「企业」页继续筛选",
    },
  };
  const meta = SCOPE_META[effectiveScope];
  const autoSwitched = effectiveScope !== userScope;

  const toggleL1 = (n: string) =>
    setOpenL1((s) => ({ ...s, [n]: !s[n] }));
  const toggleL2 = (k: string) =>
    setOpenL2((s) => ({ ...s, [k]: !s[k] }));
  const toggleL3 = (k: string) =>
    setOpenL3((s) => ({ ...s, [k]: !s[k] }));

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>出海大数据平台</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">商品</span>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl ring-1 ring-border">
        <img
          src={heroBg}
          alt="商品目录"
          width={1920}
          height={512}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(184_70%_42%/0.93)] via-[hsl(184_60%_55%/0.5)] to-transparent" />
        <div className="relative px-8 py-10 flex items-center gap-5 text-white">
          <div className="h-14 w-14 rounded-2xl bg-white/25 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/30">
            <Package className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wide">商品目录</h1>
            <p className="text-white/90 text-sm mt-1">
              收录 <span className="font-semibold">{stats.total.toLocaleString()}</span> 个 L4 商品分类,覆盖
              <span className="font-semibold"> {stats.l1Count} </span>个一级品类、4 级分类深度
            </p>
          </div>
        </div>
      </section>

      {/* Search */}
      <Card className="p-3 space-y-2">
        <div className="flex items-center gap-1 rounded-xl bg-white pl-1 h-12 overflow-hidden ring-1 ring-slate-200 focus-within:ring-primary/60 transition-all">
          <Select
            value={effectiveScope}
            onValueChange={(v) => setUserScope(v as "product" | "hs" | "enterprise")}
          >
            <SelectTrigger className="w-[200px] min-w-[200px] h-10 shrink-0 border-0 bg-transparent shadow-none focus:ring-0 focus:ring-offset-0 rounded-none text-sm font-medium text-slate-700 whitespace-nowrap hover:bg-transparent px-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start" className="w-[200px] min-w-[200px]">
              {(["product", "hs", "enterprise"] as const).map((s) => {
                const Icon = s === "product" ? Package : s === "hs" ? Hash : Building2;
                return (
                  <SelectItem key={s} value={s} className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      {SCOPE_META[s].label}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <div className="h-6 w-px bg-slate-200 shrink-0" />
          <Search className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSearchSubmit();
            }}
            placeholder={meta.placeholder}
            className="flex-1 h-10 border-0 shadow-none focus-visible:ring-0 bg-transparent px-2 placeholder:text-muted-foreground/70"
          />
          <Button className="h-full gap-1.5 rounded-none shrink-0 px-6" onClick={onSearchSubmit}>
            <Search className="h-4 w-4" />
            搜索
          </Button>
        </div>
        <div className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" />
          {autoSwitched ? (
            <span>
              已识别为 HS 编码,自动切换搜索范围 ·{" "}
              <button
                type="button"
                onClick={() => setUserScope("product")}
                className="text-primary hover:underline"
              >
                改回商品
              </button>
            </span>
          ) : (
            <span>{meta.helper}</span>
          )}
        </div>
      </Card>

      {/* Search results take over the list area */}
      {searchHits ? (
        <Card className="p-5">
          <div className="text-sm text-muted-foreground mb-3">
            找到 <span className="font-semibold text-foreground">{searchHits.length}</span> 个匹配商品
          </div>
          {searchHits.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              没有匹配项,试试更短的关键词或 HS6 编码
            </div>
          ) : (
            <div className="space-y-2">
              {searchHits.map((h) => (
                <Link
                  key={h.l4.hs}
                  to="/outreach/products/$hs"
                  params={{ hs: h.l4.hs }}
                  className="flex items-center gap-3 rounded-lg border border-border bg-background hover:border-primary/40 hover:bg-accent/40 transition-colors px-4 py-3"
                >
                  <Box className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{h.l4.name}</span>
                      <span className="text-muted-foreground text-sm truncate">{h.l4.en}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground truncate">
                      {h.l1} <ChevronRight className="inline h-3 w-3" /> {h.l2}
                      <ChevronRight className="inline h-3 w-3" /> {h.l3}
                    </div>
                  </div>
                  <Badge className="bg-primary/10 text-primary border-0 font-mono">HS6 {h.l4.hs}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Box className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold">商品分类</h2>
          </div>

          <div className="space-y-2">
            {CATALOG.map((l1) => (
              <L1Row
                key={l1.name}
                l1={l1}
                open={!!openL1[l1.name]}
                onToggle={() => toggleL1(l1.name)}
                openL2={openL2}
                openL3={openL3}
                onToggleL2={toggleL2}
                onToggleL3={toggleL3}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function L1Row({
  l1,
  open,
  onToggle,
  openL2,
  openL3,
  onToggleL2,
  onToggleL3,
}: {
  l1: L1Item;
  open: boolean;
  onToggle: () => void;
  openL2: Record<string, boolean>;
  openL3: Record<string, boolean>;
  onToggleL2: (k: string) => void;
  onToggleL3: (k: string) => void;
}) {
  const s = categoryStats(l1);
  const emoji = L1_EMOJI[l1.name] ?? "📦";
  return (
    <Card
      className={`overflow-hidden ${open ? "ring-1 ring-primary/30" : ""}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${
          open
            ? "bg-primary/5"
            : "hover:bg-accent/40"
        }`}
      >
        <div className="h-10 w-10 rounded-xl bg-muted/60 flex items-center justify-center text-xl shrink-0">
          <span>{emoji}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-semibold text-foreground">{l1.name}</span>
            <span className="text-sm text-muted-foreground truncate">{l1.en}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {s.l2Count} 个二级分类
            </span>
            <span className="text-primary font-medium">{s.l4Count} 个商品</span>
          </div>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-muted-foreground transition-transform ${
            open ? "" : "-rotate-90"
          }`}
        />
      </button>
      {open && (
        <div className="border-t border-border bg-background px-5 py-3 space-y-1">
          {l1.l2.map((l2) => {
            const k2 = `${l1.name}::${l2.name}`;
            const o2 = !!openL2[k2];
            return (
              <L2Row
                key={k2}
                l1Name={l1.name}
                l2={l2}
                open={o2}
                onToggle={() => onToggleL2(k2)}
                openL3={openL3}
                onToggleL3={onToggleL3}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

function L2Row({
  l1Name,
  l2,
  open,
  onToggle,
  openL3,
  onToggleL3,
}: {
  l1Name: string;
  l2: L2Item;
  open: boolean;
  onToggle: () => void;
  openL3: Record<string, boolean>;
  onToggleL3: (k: string) => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-accent/40 text-left"
      >
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
        <span className="font-semibold text-foreground">{l2.name}</span>
        <span className="text-sm text-muted-foreground truncate">{l2.en}</span>
      </button>
      {open && (
        <div className="ml-6 mt-1 mb-2 space-y-1 border-l border-border pl-4">
          {l2.l3.map((l3) => {
            const k3 = `${l1Name}::${l2.name}::${l3.name}`;
            const o3 = !!openL3[k3];
            return (
              <L3Row
                key={k3}
                l3={l3}
                open={o3}
                onToggle={() => onToggleL3(k3)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function L3Row({
  l3,
  open,
  onToggle,
}: {
  l3: L3Item;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/40 text-left"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
        <span className="font-medium text-foreground">{l3.name}</span>
        <span className="text-xs text-muted-foreground truncate">{l3.en}</span>
      </button>
      {open && (
        <div className="ml-6 mt-1.5 mb-2 flex flex-wrap gap-2">
          {l3.l4.map((l4) => (
            <Link
              key={l4.hs}
              to="/outreach/products/$hs"
              params={{ hs: l4.hs }}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 hover:border-primary/40 hover:bg-primary/5 transition-colors px-2.5 py-1.5"
            >
              <span className="font-medium text-sm text-foreground">{l4.name}</span>
              <span className="text-xs text-muted-foreground">{l4.en}</span>
              <span className="font-mono text-xs text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                HS6 {l4.hs}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}