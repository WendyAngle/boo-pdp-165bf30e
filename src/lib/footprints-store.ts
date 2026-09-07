import { useSyncExternalStore } from "react";

/**
 * 运行时记录的足迹（由用户在详情页浏览触发）。
 * 与 footprints 页面里的 mock 生成数据合并展示。
 */
export type RuntimeFootprintModule = "enterprise" | "contact" | "product" | "bill";

export interface RuntimeFootprint {
  id: string;
  module: RuntimeFootprintModule;
  viewedAt: string; // "YYYY-MM-DD HH:mm:ss"
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

const KEY = "boo:footprints:runtime:v1";
const MAX = 500;

function read(): RuntimeFootprint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as RuntimeFootprint[]) : [];
  } catch {
    return [];
  }
}

let items: RuntimeFootprint[] = read();
let version = 0;
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {}
}

function emit() {
  version++;
  listeners.forEach((l) => l());
}

function nowStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * 去重键：同模块 + 目标标识；再次访问只更新时间并置顶。
 */
function dedupeKey(f: Omit<RuntimeFootprint, "id" | "viewedAt">): string {
  switch (f.module) {
    case "enterprise":
      return `E:${f.enterpriseId}`;
    case "contact":
      return `C:${f.enterpriseId}:${f.contactIdx}`;
    case "product":
      return `P:${f.hs}`;
    case "bill":
      return `B:${f.billNo}`;
  }
}

export function recordFootprint(f: Omit<RuntimeFootprint, "id" | "viewedAt">) {
  const viewedAt = nowStr();
  const key = dedupeKey(f);
  const rest = items.filter((it) => dedupeKey(it) !== key);
  const next: RuntimeFootprint = {
    ...f,
    id: `rt-${key}-${Date.now()}`,
    viewedAt,
  };
  items = [next, ...rest].slice(0, MAX);
  persist();
  emit();
}

export function useRuntimeFootprints(): RuntimeFootprint[] {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
    () => version,
  );
  return items;
}

export function clearRuntimeFootprints(ids: string[]) {
  const set = new Set(ids);
  items = items.filter((i) => !set.has(i.id));
  persist();
  emit();
}