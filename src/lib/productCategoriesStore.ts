import { useSyncExternalStore } from "react";

export interface ProductCategory {
  id: string;
  name: string;
  remark: string;
  createdAt: string;
  enabled: boolean;
}

function code(seq: number) {
  return `PC${String(seq).padStart(8, "0")}`;
}

const INITIAL_NAMES = [
  "AI内容创作",
  "AI智能获客",
  "AI贸易数据",
  "AI视频制作",
  "AI客服助手",
  "数据洞察",
];
const INITIAL_REMARKS = [
  "面向内容团队的AI写作、文案与素材生成能力。",
  "基于大模型的销售线索挖掘与精准触达。",
  "覆盖全球进出口贸易的数据查询与分析。",
  "AI短视频生成与剪辑相关产品集合。",
  "智能问答、工单分流等客服场景产品。",
  "面向业务分析的看板、报表与洞察服务。",
];

let categories: ProductCategory[] = INITIAL_NAMES.map((name, i) => ({
  id: code(i + 1),
  name,
  remark: INITIAL_REMARKS[i] ?? "",
  createdAt: `2026-0${(i % 6) + 1}-${String(((i * 7) % 27) + 1).padStart(2, "0")}`,
  enabled: true,
}));
let seq = INITIAL_NAMES.length;

const listeners = new Set<() => void>();
const emit = () => {
  listeners.forEach((l) => l());
};

export const productCategoriesStore = {
  getSnapshot: () => categories,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  nextCode: () => code(seq + 1),
  add(input: { name: string; remark: string; enabled: boolean }) {
    const today = new Date();
    const createdAt = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const next: ProductCategory = {
      id: code(seq + 1),
      name: input.name,
      remark: input.remark,
      createdAt,
      enabled: input.enabled,
    };
    seq += 1;
    categories = [next, ...categories];
    emit();
    return next;
  },
  update(id: string, patch: Partial<Omit<ProductCategory, "id" | "createdAt">>) {
    categories = categories.map((c) => (c.id === id ? { ...c, ...patch } : c));
    emit();
  },
  remove(id: string) {
    categories = categories.filter((c) => c.id !== id);
    emit();
  },
};

export function useProductCategories(): ProductCategory[] {
  return useSyncExternalStore(
    productCategoriesStore.subscribe,
    productCategoriesStore.getSnapshot,
    productCategoriesStore.getSnapshot,
  );
}