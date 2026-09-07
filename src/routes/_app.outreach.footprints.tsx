import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Footprints,
  ChevronRight,
  Calendar as CalendarIcon,
  Building2,
  Package,
  
  X,
  Clock,
  MapPin,
  ArrowRight,
  ExternalLink,
  EyeOff,
  Star,
  Trash2,
  Settings2,
  CheckCheck,
  TrendingUp,
  Trophy,
  UserRound,
  Mail,
  Briefcase,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ENTERPRISES } from "@/data/enterprises";
import { CATALOG, findByHs } from "@/data/products-catalog";
import { formatTime } from "@/lib/format-date";
import {
  isFavorited,
  toggleFavorite,
  type FavoriteKind,
  type FavoritePayload,
} from "@/lib/favorites";
import {
  useRuntimeFootprints,
  clearRuntimeFootprints,
  type RuntimeFootprint,
} from "@/lib/footprints-store";

export const Route = createFileRoute("/_app/outreach/footprints")({
  head: () => ({ meta: [{ title: "出海大数据平台 · 足迹 | 出海大数据平台" }] }),
  component: FootprintsPage,
});

type FootprintModule = "enterprise" | "contact" | "product";

interface FootprintItem {
  id: string;
  module: FootprintModule;
  viewedAt: string;
  enterpriseId?: string;
  enterpriseName?: string;
  enterpriseCountry?: string;
  enterpriseIndustry?: string;
  enterpriseRole?: string;
  contactIdx?: number;
  contactName?: string;
  contactTitle?: string;
  contactEmail?: string;
  contactCity?: string;
  hs?: string;
  productName?: string;
  productEn?: string;
  productCategory?: string;
  billNo?: string;
  billDate?: string;
  exporter?: string;
  importer?: string;
  fromPort?: string;
  toPort?: string;
  desc?: string;
}

function h(s: string) {
  let x = 0;
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(x);
}

// Build HS pool from actual catalog so detail routes always resolve.
const HS_POOL: string[] = (() => {
  const codes: string[] = [];
  for (const l1 of CATALOG) {
    for (const l2 of l1.l2) {
      for (const l3 of l2.l3) {
        for (const l4 of l3.l4) {
          codes.push(l4.hs);
        }
      }
    }
  }
  return codes;
})();


function genFootprints(): FootprintItem[] {
  const items: FootprintItem[] = [];
  const today = new Date(2026, 5, 17);
  for (let d = 0; d < 14; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() - d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${day}`;
    const seed = h(dateStr);
    const count = 2 + (seed % 3);
    for (let i = 0; i < count; i++) {
      const s = h(`${dateStr}-${i}`);
      const moduleIdx = s % 3;
      const moduleKey: FootprintModule =
        moduleIdx === 0
          ? "enterprise"
          : moduleIdx === 1
            ? "contact"
            : "product";
      const hh = String(8 + ((s >> 3) % 12)).padStart(2, "0");
      const mm = String((s >> 5) % 60).padStart(2, "0");
      const ss = String((s >> 7) % 60).padStart(2, "0");
      const viewedAt = `${dateStr} ${hh}:${mm}:${ss}`;
      if (moduleKey === "enterprise") {
        const ent = ENTERPRISES[s % ENTERPRISES.length];
        items.push({
          id: `f-${dateStr}-${i}`,
          module: moduleKey,
          viewedAt,
          enterpriseId: ent.id,
          enterpriseName: ent.name,
          enterpriseCountry: ent.country,
          enterpriseIndustry: ent.industry,
          enterpriseRole: ent.tradeRole,
        });
      } else if (moduleKey === "contact") {
        const ent = ENTERPRISES[s % ENTERPRISES.length];
        const cIdx = ent.contacts.length ? s % ent.contacts.length : 0;
        const c = ent.contacts[cIdx];
        if (!c) continue;
        items.push({
          id: `f-${dateStr}-${i}`,
          module: moduleKey,
          viewedAt,
          enterpriseId: ent.id,
          enterpriseName: ent.name,
          enterpriseCountry: ent.country,
          enterpriseIndustry: ent.industry,
          enterpriseRole: ent.tradeRole,
          contactIdx: cIdx,
          contactName: c.name,
          contactTitle: c.title,
          contactEmail: c.email,
          contactCity: ent.city,
        });
      } else if (moduleKey === "product") {
        const hs = HS_POOL[s % HS_POOL.length];
        const lk = findByHs(hs);
        items.push({
          id: `f-${dateStr}-${i}`,
          module: moduleKey,
          viewedAt,
          hs,
          productName: lk?.l4.name ?? hs,
          productEn: lk?.l4.en,
          productCategory: lk ? `${lk.l1.name} / ${lk.l2.name}` : undefined,
        });
      }
    }
  }
  return items;
}

const ALL_FOOTPRINTS = genFootprints();

function runtimeDedupeKey(f: FootprintItem | RuntimeFootprint): string {
  switch (f.module) {
    case "enterprise":
      return `E:${f.enterpriseId}`;
    case "contact":
      return `C:${f.enterpriseId}:${f.contactIdx}`;
    case "product":
      return `P:${f.hs}`;
    default:
      return f.id;
  }
}

type ModuleFilter = "all" | FootprintModule;

function formatDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function weekdayCN(dateStr: string) {
  const d = new Date(dateStr);
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
}

function FootprintsPage() {
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [mod, setMod] = useState<ModuleFilter>("all");
  const [open, setOpen] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<
    | null
    | {
        title: string;
        desc: string;
        ids: string[];
      }
  >(null);

  const runtime = useRuntimeFootprints();
  const merged = useMemo<FootprintItem[]>(() => {
    // 运行时足迹在前（更新），mock 在后
    const rt: FootprintItem[] = runtime.map((r) => ({ ...(r as FootprintItem) }));
    const rtKeys = new Set(rt.map((r) => runtimeDedupeKey(r)));
    const mock = ALL_FOOTPRINTS.filter((m) => !rtKeys.has(runtimeDedupeKey(m)));
    return [...rt, ...mock];
  }, [runtime]);

  const visible = useMemo(
    () => merged.filter((it) => !hiddenIds.has(it.id)),
    [merged, hiddenIds],
  );

  const filtered = useMemo(() => {
    return visible.filter((it) => {
      if (mod !== "all" && it.module !== mod) return false;
      if (date) {
        const key = formatDateKey(date);
        if (!it.viewedAt.startsWith(key)) return false;
      }
      return true;
    });
  }, [visible, date, mod]);

  const grouped = useMemo(() => {
    const map = new Map<string, FootprintItem[]>();
    for (const it of filtered) {
      const key = it.viewedAt.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(
        ([k, list]) =>
          [k, list.sort((a, b) => (a.viewedAt < b.viewedAt ? 1 : -1))] as const,
      );
  }, [filtered]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {
      all: 0,
      enterprise: 0,
      contact: 0,
      product: 0,
    };
    for (const it of visible) {
      if (date && !it.viewedAt.startsWith(formatDateKey(date))) continue;
      c.all++;
      c[it.module]++;
    }
    return c;
  }, [visible, date]);

  // ---- Insights aggregations (respect hiddenIds, NOT date filter) ----
  const trend = useMemo(() => {
    const days: { key: string; count: number }[] = [];
    const today = new Date(2026, 5, 17);
    for (let d = 13; d >= 0; d--) {
      const x = new Date(today);
      x.setDate(today.getDate() - d);
      days.push({ key: formatDateKey(x), count: 0 });
    }
    const idx = new Map(days.map((x, i) => [x.key, i] as const));
    for (const it of visible) {
      const k = it.viewedAt.slice(0, 10);
      const i = idx.get(k);
      if (i !== undefined) days[i].count++;
    }
    return days;
  }, [visible]);

  const modDist = useMemo(() => {
    const c = { enterprise: 0, contact: 0, product: 0 };
    for (const it of visible) c[it.module]++;
    const total = c.enterprise + c.contact + c.product || 1;
    return { ...c, total };
  }, [visible]);

  const topEnterprises = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; country?: string; count: number }
    >();
    for (const it of visible) {
      if (it.module !== "enterprise" || !it.enterpriseId) continue;
      const cur = map.get(it.enterpriseId);
      if (cur) cur.count++;
      else
        map.set(it.enterpriseId, {
          id: it.enterpriseId,
          name: it.enterpriseName ?? "—",
          country: it.enterpriseCountry,
          count: 1,
        });
    }
    return Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [visible]);

  // ---- Manage / clear handlers ----
  const allFilteredIds = useMemo(() => filtered.map((f) => f.id), [filtered]);
  const allSelected =
    selectMode &&
    allFilteredIds.length > 0 &&
    allFilteredIds.every((id) => selectedIds.has(id));

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allFilteredIds));
  }

  function exitSelect() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  function applyDelete(ids: string[]) {
    if (ids.length === 0) return;
    const rtIds = ids.filter((i) => i.startsWith("rt-"));
    if (rtIds.length) clearRuntimeFootprints(rtIds);
    setHiddenIds((prev) => {
      const n = new Set(prev);
      ids.forEach((i) => n.add(i));
      return n;
    });
    setSelectedIds((prev) => {
      const n = new Set(prev);
      ids.forEach((i) => n.delete(i));
      return n;
    });
    toast.success(`已清理 ${ids.length} 条足迹`);
  }

  const moduleOptions: { key: ModuleFilter; label: string; icon: typeof Building2 }[] = [
    { key: "all", label: "全部", icon: Footprints },
    { key: "enterprise", label: "企业", icon: Building2 },
    { key: "contact", label: "人物", icon: UserRound },
    { key: "product", label: "商品", icon: Package },
  ];

  return (
    <TooltipProvider delayDuration={150}>
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>出海大数据平台</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">足迹</span>
      </div>

      <section
        className="relative overflow-hidden rounded-2xl p-6 text-white"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Footprints className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">足迹</h1>
            <p className="text-white/85 text-sm mt-0.5">
              系统自动记录你最近浏览的企业、商品与提单，用于回溯与跟进；在卡片上点击 ☆ 可加入收藏
            </p>
          </div>
          <div className="ml-auto hidden md:flex items-center gap-6 text-sm">
            <div className="text-center">
              <div className="text-2xl font-bold">{visible.length}</div>
              <div className="text-white/70 text-xs">累计浏览</div>
            </div>
            <div className="h-8 w-px bg-white/20" />
            <div className="text-center">
              <div className="text-2xl font-bold">
                {new Set(visible.map((i) => i.viewedAt.slice(0, 10))).size}
              </div>
              <div className="text-white/70 text-xs">活跃天数</div>
            </div>
          </div>
        </div>
        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          <Button
            asChild
            size="sm"
            variant="secondary"
            className="h-8 bg-white/15 text-white border-white/20 hover:bg-white/25"
          >
            <Link to="/outreach/footprints-empty">
              <EyeOff className="h-3.5 w-3.5 mr-1.5" />
              查看空状态演示
            </Link>
          </Button>
        </div>
      </section>

      <InsightsStrip trend={trend} modDist={modDist} topEnterprises={topEnterprises} />

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">浏览时间</span>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-9 justify-start text-left font-normal min-w-[200px]",
                    !date && "text-muted-foreground",
                  )}
                >
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {date ? formatDateKey(date) : "全部日期"}
                  {date && (
                    <span
                      role="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDate(undefined);
                      }}
                      className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted"
                    >
                      <X className="h-3.5 w-3.5" />
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => {
                    setDate(d);
                    setOpen(false);
                  }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="h-6 w-px bg-border mx-1" />

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">模块</span>
            {moduleOptions.map((opt) => {
              const active = mod === opt.key;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.key}
                  onClick={() => setMod(opt.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm border transition-colors",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-muted",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {opt.label}
                  <Badge
                    variant="secondary"
                    className={cn(
                      "ml-1 h-5 px-1.5 text-[11px]",
                      active && "bg-primary-foreground/20 text-primary-foreground",
                    )}
                  >
                    {counts[opt.key] ?? 0}
                  </Badge>
                </button>
              );
            })}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {(date || mod !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDate(undefined);
                  setMod("all");
                }}
              >
                <X className="h-4 w-4 mr-1" />
                清除筛选
              </Button>
            )}
            <Button
              variant={selectMode ? "default" : "outline"}
              size="sm"
              className="h-9"
              onClick={() => {
                if (selectMode) exitSelect();
                else setSelectMode(true);
              }}
            >
              <Settings2 className="h-4 w-4 mr-1" />
              {selectMode ? "退出管理" : "管理"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <Trash2 className="h-4 w-4 mr-1" />
                  清理
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
                  选择清理范围
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={filtered.length === 0}
                  onSelect={() =>
                    setConfirm({
                      title: "清理当前筛选结果？",
                      desc: `将清除 ${filtered.length} 条与当前筛选匹配的足迹记录，操作不可撤销。`,
                      ids: filtered.map((i) => i.id),
                    })
                  }
                >
                  <div className="flex flex-col">
                    <span>清理当前筛选 ({filtered.length})</span>
                    {filtered.length === 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        当前筛选结果为空
                      </span>
                    )}
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={!date}
                  onSelect={() => {
                    if (!date) return;
                    const key = formatDateKey(date);
                    const ids = visible
                      .filter((i) => i.viewedAt.startsWith(key))
                      .map((i) => i.id);
                    setConfirm({
                      title: `清理 ${key} 当日足迹？`,
                      desc: `将清除该日全部 ${ids.length} 条浏览记录，操作不可撤销。`,
                      ids,
                    });
                  }}
                >
                  <div className="flex flex-col">
                    <span>清理选中日期</span>
                    <span className="text-[11px] text-muted-foreground">
                      {date ? formatDateKey(date) : "请先在左侧日历选择日期"}
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={visible.length === 0}
                  onSelect={() =>
                    setConfirm({
                      title: "清理全部足迹？",
                      desc: `将清除剩余 ${visible.length} 条全部浏览记录，操作不可撤销。`,
                      ids: visible.map((i) => i.id),
                    })
                  }
                >
                  清理全部 ({visible.length})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {selectMode && (
          <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-2 text-sm">
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
              aria-label="全选"
            />
            <button
              type="button"
              onClick={toggleAll}
              className="text-muted-foreground hover:text-foreground"
            >
              {allSelected ? "取消全选" : "全选当前筛选"}
            </button>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">
              已选 <span className="text-foreground font-medium">{selectedIds.size}</span> 条
            </span>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={selectedIds.size === 0}
                onClick={() => setSelectedIds(new Set())}
              >
                取消选择
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={selectedIds.size === 0}
                onClick={() =>
                  setConfirm({
                    title: `删除已选 ${selectedIds.size} 条足迹？`,
                    desc: "所选浏览记录将被清除，操作不可撤销。",
                    ids: Array.from(selectedIds),
                  })
                }
              >
                <Trash2 className="h-4 w-4 mr-1" />
                删除选中
              </Button>
            </div>
          </div>
        )}
      </Card>

      {grouped.length === 0 ? (
        <Card className="p-16 flex flex-col items-center justify-center text-center gap-3 border-dashed">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
            <Footprints className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="text-base font-medium">暂无浏览记录</div>
          <div className="text-sm text-muted-foreground max-w-md">
            当前筛选条件下没有匹配的足迹，试试调整日期或模块筛选
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([dateKey, list]) => (
            <div key={dateKey} className="space-y-3">
              <div className="flex items-center gap-3 sticky top-0 z-10 bg-background/95 backdrop-blur py-1">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <CalendarIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{dateKey}</div>
                    <div className="text-xs text-muted-foreground">{weekdayCN(dateKey)}</div>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {list.length} 条记录
                </Badge>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {list.map((it) => (
                  <FootprintCard
                    key={it.id}
                    item={it}
                    selectMode={selectMode}
                    selected={selectedIds.has(it.id)}
                    onToggleSelect={() => toggleOne(it.id)}
                    onDelete={() =>
                      setConfirm({
                        title: "删除该条足迹？",
                        desc: "此浏览记录将被清除，操作不可撤销。",
                        ids: [it.id],
                      })
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirm) {
                  applyDelete(confirm.ids);
                  if (selectMode && confirm.ids.length === selectedIds.size) {
                    // selection cleared above
                  }
                }
                setConfirm(null);
              }}
            >
              确认清理
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}

interface CardProps {
  item: FootprintItem;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
}

function buildFavorite(
  item: FootprintItem,
): { kind: FavoriteKind; refId: string; payload: FavoritePayload } | null {
  if (item.module === "enterprise" && item.enterpriseId) {
    return {
      kind: "enterprise",
      refId: item.enterpriseId,
      payload: {
        title: item.enterpriseName ?? "—",
        subtitle: item.enterpriseIndustry,
        meta: {
          ...(item.enterpriseCountry ? { country: item.enterpriseCountry } : {}),
          ...(item.enterpriseRole ? { role: item.enterpriseRole } : {}),
        },
      },
    };
  }
  if (
    item.module === "contact" &&
    item.enterpriseId &&
    item.contactIdx !== undefined
  ) {
    return {
      kind: "contact",
      refId: `${item.enterpriseId}:${item.contactIdx}`,
      payload: {
        title: item.contactName ?? "—",
        subtitle: item.contactTitle,
        meta: {
          ...(item.contactEmail ? { email: item.contactEmail } : {}),
        },
        parentRef: {
          kind: "enterprise",
          id: item.enterpriseId,
          name: item.enterpriseName ?? "—",
        },
      },
    };
  }
  if (item.module === "product" && item.hs) {
    return {
      kind: "product",
      refId: item.hs,
      payload: {
        title: item.productName ?? item.hs,
        subtitle: item.productEn,
        meta: {
          hs: item.hs,
          ...(item.productCategory ? { category: item.productCategory } : {}),
        },
      },
    };
  }
  return null;
}

function FootprintCard({
  item,
  selectMode,
  selected,
  onToggleSelect,
  onDelete,
}: CardProps) {
  const fav = buildFavorite(item);
  const favored = fav ? isFavorited(fav.kind, fav.refId) : false;
  const [, force] = useState(0);

  const handleStar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!fav) return;
    const nowFavored = toggleFavorite(fav.kind, fav.refId, fav.payload);
    toast.success(nowFavored ? "已加入收藏" : "已取消收藏");
    force((n) => n + 1);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete();
  };

  const overlay = (
    <>
      {selectMode && (
        <div className="absolute top-2 left-2 z-10">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            className="bg-background border-border shadow-sm"
            aria-label="选择此条足迹"
          />
        </div>
      )}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {fav && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleStar}
                className={cn(
                  "h-7 w-7 inline-flex items-center justify-center rounded-md border bg-background/95 backdrop-blur hover:bg-muted",
                  favored && "text-amber-500 border-amber-300",
                )}
                aria-label={favored ? "取消收藏" : "加入收藏"}
              >
                <Star
                  className={cn("h-3.5 w-3.5", favored && "fill-current")}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {favored ? "已收藏（点击取消）" : "加入收藏"}
            </TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleDelete}
              className="h-7 w-7 inline-flex items-center justify-center rounded-md border bg-background/95 backdrop-blur hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40"
              aria-label="删除此条足迹"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">删除该足迹</TooltipContent>
        </Tooltip>
      </div>
    </>
  );

  const inner = renderCardInner(item);

  if (selectMode) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleSelect}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onToggleSelect();
          }
        }}
        className={cn(
          "relative group block text-left cursor-pointer rounded-lg",
          selected && "ring-2 ring-primary ring-offset-1",
        )}
      >
        {overlay}
        {inner}
      </div>
    );
  }

  return (
    <div className="relative group">
      {overlay}
      {item.module === "enterprise" ? (
        <Link
          to="/outreach/enterprise/$id"
          params={{ id: item.enterpriseId! }}
          className="block"
        >
          {inner}
        </Link>
      ) : item.module === "contact" ? (
        <Link
          to="/outreach/enterprise/$id/contact/$idx"
          params={{
            id: item.enterpriseId!,
            idx: String(item.contactIdx ?? 0),
          }}
          className="block"
        >
          {inner}
        </Link>
      ) : item.module === "product" ? (
        <Link
          to="/outreach/products/$hs"
          params={{ hs: item.hs! }}
          className="block"
        >
          {inner}
        </Link>
      ) : (
        <div className="block">{inner}</div>
      )}
    </div>
  );
}

function renderCardInner(item: FootprintItem) {
  if (item.module === "enterprise") {
    return (
      <Card className="p-4 h-full hover:shadow-md hover:border-primary/40 transition-all">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 text-primary border-primary/40"
              >
                企业
              </Badge>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(item.viewedAt)}
              </span>
            </div>
            <div className="font-medium text-sm truncate group-hover:text-primary">
              {item.enterpriseName}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {item.enterpriseCountry}
              </span>
              <span>·</span>
              <span className="truncate">{item.enterpriseIndustry}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {item.enterpriseRole}
              </Badge>
              <span className="ml-auto text-[11px] text-primary opacity-0 group-hover:opacity-100 inline-flex items-center gap-0.5">
                查看详情 <ExternalLink className="h-3 w-3" />
              </span>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  if (item.module === "contact") {
    return (
      <Card className="p-4 h-full hover:shadow-md hover:border-primary/40 transition-all">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-violet-500/10 text-violet-600 flex items-center justify-center shrink-0">
            <UserRound className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap pr-16">
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 text-violet-600 border-violet-300"
              >
                人物
              </Badge>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(item.viewedAt)}
              </span>
            </div>
            <div className="font-medium text-sm truncate capitalize group-hover:text-primary">
              {item.contactName}
            </div>
            <div className="text-xs text-muted-foreground mt-1 truncate flex items-center gap-1">
              <Briefcase className="h-3 w-3" />
              <span className="truncate">{item.contactTitle}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1 truncate flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              <span className="truncate">{item.enterpriseName}</span>
            </div>
            {item.contactEmail && (
              <div className="text-[11px] text-muted-foreground mt-1 truncate flex items-center gap-1 font-mono">
                <Mail className="h-3 w-3" />
                {item.contactEmail}
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  if (item.module === "product") {
    return (
      <Card className="p-4 h-full hover:shadow-md hover:border-primary/40 transition-all">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <Package className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap pr-16">
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 text-amber-600 border-amber-300"
              >
                商品
              </Badge>
              <Badge variant="secondary" className="text-[10px] font-mono">
                HS {item.hs}
              </Badge>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatTime(item.viewedAt)}
              </span>
            </div>
            <div className="font-medium text-sm truncate group-hover:text-primary">
              {item.productName}
            </div>
            {item.productEn && (
              <div className="text-xs text-muted-foreground truncate italic">
                {item.productEn}
              </div>
            )}
            {item.productCategory && (
              <div className="text-xs text-muted-foreground mt-1 truncate">
                {item.productCategory}
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  }

  return null;
}

/* ---------------- Insights Strip ---------------- */

interface InsightsProps {
  trend: { key: string; count: number }[];
  modDist: {
    enterprise: number;
    contact: number;
    product: number;
    
    total: number;
  };
  topEnterprises: { id: string; name: string; country?: string; count: number }[];
}

function InsightsStrip({ trend, modDist, topEnterprises }: InsightsProps) {
  const max = Math.max(1, ...trend.map((t) => t.count));
  const w = 220;
  const h = 44;
  const pad = 2;
  const stepX = (w - pad * 2) / Math.max(1, trend.length - 1);
  const points = trend
    .map((t, i) => {
      const x = pad + i * stepX;
      const y = pad + (h - pad * 2) * (1 - t.count / max);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const areaPath =
    `M ${pad},${h - pad} ` +
    trend
      .map((t, i) => {
        const x = pad + i * stepX;
        const y = pad + (h - pad * 2) * (1 - t.count / max);
        return `L ${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ") +
    ` L ${(pad + stepX * (trend.length - 1)).toFixed(1)},${h - pad} Z`;

  const total14 = trend.reduce((s, t) => s + t.count, 0);

  const segs: { key: keyof typeof modDist; label: string; cls: string }[] = [
    { key: "enterprise", label: "企业", cls: "bg-primary" },
    { key: "contact", label: "人物", cls: "bg-violet-500" },
    { key: "product", label: "商品", cls: "bg-amber-500" },
  ];

  return (
    <Card className="p-4">
      <div className="grid gap-4 md:grid-cols-3">
        {/* Trend */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs text-muted-foreground">近 14 天浏览</span>
              <span className="text-sm font-semibold">{total14}</span>
              <span className="text-[11px] text-muted-foreground">次</span>
            </div>
            <svg
              viewBox={`0 0 ${w} ${h}`}
              className="mt-1 w-full h-9"
              preserveAspectRatio="none"
            >
              <path d={areaPath} fill="hsl(var(--primary) / 0.12)" />
              <polyline
                points={points}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Module distribution */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-muted text-foreground flex items-center justify-center shrink-0">
            <CheckCheck className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground mb-1.5">模块分布</div>
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
              {segs.map((s) => {
                const v = modDist[s.key] as number;
                const pct = (v / modDist.total) * 100;
                if (pct <= 0) return null;
                return (
                  <div
                    key={s.key}
                    className={s.cls}
                    style={{ width: `${pct}%` }}
                    title={`${s.label} ${v}`}
                  />
                );
              })}
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
              {segs.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1">
                  <span className={cn("h-2 w-2 rounded-sm", s.cls)} />
                  {s.label}
                  <span className="text-foreground font-medium">
                    {modDist[s.key] as number}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Top enterprises */}
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
            <Trophy className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground mb-1.5">高频访问 TOP 3 企业</div>
            {topEnterprises.length === 0 ? (
              <div className="text-xs text-muted-foreground">暂无企业访问记录</div>
            ) : (
              <ul className="space-y-1">
                {topEnterprises.map((e, i) => (
                  <li key={e.id} className="flex items-center gap-2 text-xs">
                    <span
                      className={cn(
                        "h-4 w-4 rounded text-[10px] font-semibold inline-flex items-center justify-center",
                        i === 0 && "bg-amber-500 text-white",
                        i === 1 && "bg-zinc-400 text-white",
                        i === 2 && "bg-amber-700 text-white",
                      )}
                    >
                      {i + 1}
                    </span>
                    <Link
                      to="/outreach/enterprise/$id"
                      params={{ id: e.id }}
                      className="truncate hover:text-primary font-medium"
                    >
                      {e.name}
                    </Link>
                    <span className="ml-auto text-muted-foreground shrink-0">
                      {e.count} 次
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}