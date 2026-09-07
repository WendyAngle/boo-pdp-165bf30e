import { useSyncExternalStore } from "react";

export type UnitKey = "次" | "秒" | "分" | "小时" | "天";
export interface AppLink {
  app: string;
  serviceCode: string;
}
export interface BasicProduct {
  id: string;
  category: string;
  name: string;
  description: string;
  cashValue: number;
  pointsCost: number;
  unit: UnitKey;
  enabled: boolean;
  appLinks: AppLink[];
  createdAt: string;
}

function code(seq: number) {
  return `BP${String(seq).padStart(6, "0")}`;
}

const INITIAL: BasicProduct[] = [
  { id: "BP000058", category: "AI视频制作", name: "ggg", description: "ggg", cashValue: 1, pointsCost: 10, unit: "次", enabled: false, appLinks: [], createdAt: "2026-03-11 17:01:50" },
  { id: "BP000052", category: "AI客服助手", name: "ggg", description: "gege", cashValue: 0, pointsCost: 222, unit: "次", enabled: false, appLinks: [], createdAt: "2026-03-11 10:20:45" },
  { id: "BP000043", category: "AI视频制作", name: "AI文生图", description: "文生图", cashValue: 1, pointsCost: 20, unit: "秒", enabled: true, appLinks: [{ app: "SIS", serviceCode: "SIS46818" }, { app: "AI视频生成", serviceCode: "AG497554" }], createdAt: "2026-03-10 15:43:27" },
  { id: "BP000032", category: "AI智能获客", name: "Tiktok获客", description: "获取tiktok账号", cashValue: 2, pointsCost: 20, unit: "次", enabled: true, appLinks: [], createdAt: "2026-03-09 10:12:42" },
  { id: "BP000030", category: "AI视频制作", name: "AI图生视频", description: "图生数字人视频", cashValue: 1, pointsCost: 10, unit: "秒", enabled: true, appLinks: [], createdAt: "2026-03-09 10:11:15" },
  { id: "BP000028", category: "AI视频制作", name: "AI视频消除", description: "消除字幕、水印等", cashValue: 1, pointsCost: 10, unit: "分", enabled: true, appLinks: [], createdAt: "2026-03-09 10:02:14" },
];

let products: BasicProduct[] = INITIAL;
let seq = 58;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function now() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export const basicProductsStore = {
  getSnapshot: () => products,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  nextCode: () => code(seq + 1),
  add(input: Omit<BasicProduct, "id" | "createdAt">) {
    seq += 1;
    const next: BasicProduct = { id: code(seq), createdAt: now(), ...input };
    products = [next, ...products];
    emit();
    return next;
  },
  update(id: string, patch: Partial<Omit<BasicProduct, "id" | "createdAt">>) {
    products = products.map((p) => (p.id === id ? { ...p, ...patch } : p));
    emit();
  },
  remove(id: string) {
    products = products.filter((p) => p.id !== id);
    emit();
  },
};

export function useBasicProducts(): BasicProduct[] {
  return useSyncExternalStore(
    basicProductsStore.subscribe,
    basicProductsStore.getSnapshot,
    basicProductsStore.getSnapshot,
  );
}