import { useSyncExternalStore } from "react";

/**
 * 目标标签 / 分类：以「目标」为维度（targetKind:targetId），
 * 与具体触达任务、渠道无关，因此在触达任务详情、触达目标页、触达会话列表间天然同步。
 */
export interface TargetTagRecord {
  /** 客户分类，单选 */
  category?: string;
  /** 客户标签，多选 */
  tags: string[];
  updatedAt: string;
}

export const TARGET_CATEGORIES = [
  "重点客户",
  "潜在客户",
  "已合作",
  "待跟进",
  "暂不合作",
] as const;

export const PRESET_TARGET_TAGS = [
  "高意向",
  "待报价",
  "已报价",
  "价格敏感",
  "需样品",
  "大客户",
  "需人工跟进",
] as const;

const KEY = "boo:target-tags:v1";

type Store = Record<string, TargetTagRecord>;

let store: Store = {};
let loaded = false;

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) store = JSON.parse(raw) as Store;
  } catch {
    store = {};
  }
}

const listeners = new Set<() => void>();
function commit() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(store));
    } catch {
      /* ignore */
    }
  }
  store = { ...store };
  listeners.forEach((l) => l());
}

/** 目标唯一键 */
export function targetTagKey(t: { targetKind: string; targetId: string }) {
  return `${t.targetKind === "enterprise" ? "enterprise" : "contact"}:${t.targetId}`;
}

export function getTargetTags(key: string): TargetTagRecord | undefined {
  load();
  return store[key];
}

export function getTargetTagsMap(): Store {
  load();
  return store;
}

export function useTargetTagsMap(): Store {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => {
      load();
      return store;
    },
    () => store,
  );
}

/**
 * 批量设置标签 / 分类。
 * mode = "merge"：标签追加去重，分类仅在传入时覆盖（不传则保留原值）。
 * mode = "replace"：整体覆盖，未传分类视为清空。
 */
export function setTargetTags(
  keys: string[],
  input: { category?: string; tags?: string[] },
  mode: "merge" | "replace" = "merge",
) {
  load();
  const now = new Date().toISOString();
  for (const k of keys) {
    const prev = store[k];
    if (mode === "replace") {
      const tags = [...new Set(input.tags ?? [])];
      if (!input.category && tags.length === 0) {
        delete store[k];
        continue;
      }
      store[k] = { category: input.category, tags, updatedAt: now };
    } else {
      const tags = [...new Set([...(prev?.tags ?? []), ...(input.tags ?? [])])];
      store[k] = {
        category: input.category ?? prev?.category,
        tags,
        updatedAt: now,
      };
    }
  }
  commit();
}

export function clearTargetTags(keys: string[]) {
  load();
  for (const k of keys) delete store[k];
  commit();
}

/** 已被使用过的自定义标签，便于复用 */
export function usedTargetTags(): string[] {
  load();
  const s = new Set<string>();
  for (const v of Object.values(store)) for (const t of v.tags) s.add(t);
  for (const t of PRESET_TARGET_TAGS) s.delete(t);
  return [...s];
}
