import { useMemo, useState } from "react";
import { ChevronDown, X, Check, Layers, Box, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type ProductSel =
  | { type: "category"; key: string }
  | { type: "basic"; key: string };

export interface PickerBasicProduct {
  id: string;
  name: string;
  category: string;
}

interface Props {
  categories: string[];
  basicProducts: PickerBasicProduct[];
  value: ProductSel[];
  onChange: (v: ProductSel[]) => void;
  placeholder?: string;
  /** 已被其它服务项占用的选项，禁止再次勾选 */
  disabledKeys?: ProductSel[];
}

export function ProductMultiPicker({
  categories,
  basicProducts,
  value,
  onChange,
  placeholder = "请选择产品（支持多选）",
  disabledKeys = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [kw, setKw] = useState("");

  const grouped = useMemo(
    () =>
      categories.map((c) => ({
        name: c,
        items: basicProducts.filter((b) => b.category === c),
      })),
    [categories, basicProducts],
  );

  const isCatChecked = (c: string) => value.some((v) => v.type === "category" && v.key === c);
  const isBasicChecked = (id: string) => value.some((v) => v.type === "basic" && v.key === id);
  const isCatDisabled = (c: string) =>
    disabledKeys.some((v) => v.type === "category" && v.key === c);
  const isBasicDisabled = (id: string) =>
    disabledKeys.some((v) => v.type === "basic" && v.key === id);

  const toggleCat = (c: string) => {
    if (isCatChecked(c)) {
      onChange(value.filter((v) => !(v.type === "category" && v.key === c)));
    } else {
      const remain = value.filter((v) => {
        if (v.type === "category") return v.key !== c;
        const bp = basicProducts.find((b) => b.id === v.key);
        return bp?.category !== c;
      });
      onChange([...remain, { type: "category", key: c }]);
    }
  };
  const toggleBasic = (id: string, category: string) => {
    if (isBasicChecked(id)) {
      onChange(value.filter((v) => !(v.type === "basic" && v.key === id)));
    } else {
      const remain = value.filter((v) => !(v.type === "category" && v.key === category));
      onChange([...remain, { type: "basic", key: id }]);
    }
  };
  const removeItem = (sel: ProductSel) =>
    onChange(value.filter((v) => !(v.type === sel.type && v.key === sel.key)));

  const k = kw.trim().toLowerCase();
  const visibleGroups = grouped
    .map((g) => ({
      ...g,
      items: k
        ? g.items.filter((b) => b.name.toLowerCase().includes(k) || b.id.toLowerCase().includes(k))
        : g.items,
      matchCat: !k || g.name.toLowerCase().includes(k),
    }))
    .filter((g) => g.matchCat || g.items.length > 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="w-full min-h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:border-primary/50 transition-colors"
        >
          <div className="flex-1 flex flex-wrap gap-1">
            {value.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              value.map((v) => {
                const label =
                  v.type === "category"
                    ? v.key
                    : (() => {
                        const bp = basicProducts.find((b) => b.id === v.key);
                        return bp ? `${bp.category} / ${bp.name}` : v.key;
                      })();
                return (
                  <Badge
                    key={`${v.type}:${v.key}`}
                    variant="outline"
                    className={
                      v.type === "category"
                        ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
                    }
                  >
                    {v.type === "category" ? <Layers className="h-3 w-3 mr-1" /> : <Box className="h-3 w-3 mr-1" />}
                    {label}
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(v);
                      }}
                      className="ml-1 -mr-0.5 rounded hover:bg-black/10 inline-flex"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </Badge>
                );
              })
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              placeholder="搜索分类或基础产品"
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {visibleGroups.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">未找到匹配项</div>
          ) : (
            visibleGroups.map((g) => {
              const catChecked = isCatChecked(g.name);
              const isExp = expanded[g.name] ?? true;
              return (
                <div key={g.name} className="px-1">
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent/50">
                    <button
                      type="button"
                      onClick={() => setExpanded((s) => ({ ...s, [g.name]: !isExp }))}
                      className="p-0.5 rounded hover:bg-accent"
                    >
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExp ? "" : "-rotate-90"}`} />
                    </button>
                    <Checkbox checked={catChecked} onCheckedChange={() => toggleCat(g.name)} />
                    <Layers className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-sm font-medium flex-1">{g.name}</span>
                    {isCatDisabled(g.name) && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400">已设置</span>
                    )}
                    <span className="text-xs text-muted-foreground">{g.items.length}</span>
                  </div>
                  {isExp && g.items.length > 0 && (
                    <div className="ml-7 border-l border-border/60 pl-2 space-y-0.5 pb-1">
                      {g.items.map((b) => {
                        const checked = catChecked || isBasicChecked(b.id);
                        const disabledByOther = isBasicDisabled(b.id) || isCatDisabled(b.category);
                        return (
                          <label
                            key={b.id}
                            className={`flex items-center gap-2 px-2 py-1 rounded text-sm hover:bg-accent/50 ${
                              catChecked || disabledByOther ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
                            }`}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={catChecked || disabledByOther}
                              onCheckedChange={() => toggleBasic(b.id, b.category)}
                            />
                            <Box className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="flex-1">{b.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">{b.id}</span>
                            {checked && <Check className="h-3.5 w-3.5 text-primary" />}
                            {!checked && disabledByOther && (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400">已设置</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs">
          <span className="text-muted-foreground">已选 {value.length} 项</span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onChange([])}
              disabled={value.length === 0}
            >
              清空
            </Button>
            <Button type="button" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
              完成
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function productSelLabel(
  sel: ProductSel,
  basicProducts: PickerBasicProduct[],
): string {
  if (sel.type === "category") return sel.key;
  const bp = basicProducts.find((b) => b.id === sel.key);
  return bp ? `${bp.category} / ${bp.name}` : sel.key;
}
