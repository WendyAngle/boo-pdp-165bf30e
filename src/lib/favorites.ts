import { useSyncExternalStore, useCallback } from "react";
import { ENTERPRISES } from "@/data/enterprises";
import { findByHs } from "@/data/products-catalog";

export type FavoriteKind = "enterprise" | "contact" | "product" | "bill";

export interface FavoritePayload {
  title: string;
  subtitle?: string;
  meta?: Record<string, string>;
  parentRef?: { kind: "enterprise"; id: string; name: string };
}

export interface FavoriteRecord extends FavoritePayload {
  id: string; // `${kind}:${refId}`
  kind: FavoriteKind;
  refId: string;
  createdAt: string; // ISO
}

const STORAGE_KEY = "boo:favorites:v1";
const SEED_FLAG_KEY = "boo:favorites:v3:seeded";

function readStore(): Record<string, FavoriteRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {}
  return {};
}

function writeStore(s: Record<string, FavoriteRecord>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

let store: Record<string, FavoriteRecord> = readStore();
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version++;
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      store = readStore();
      emit();
    }
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getVersion() {
  return version;
}

function makeKey(kind: FavoriteKind, refId: string) {
  return `${kind}:${refId}`;
}

export function isFavorited(kind: FavoriteKind, refId: string): boolean {
  return !!store[makeKey(kind, refId)];
}

export function toggleFavorite(
  kind: FavoriteKind,
  refId: string,
  payload: FavoritePayload,
): boolean {
  const key = makeKey(kind, refId);
  const next = { ...store };
  if (next[key]) {
    delete next[key];
    store = next;
    writeStore(store);
    emit();
    return false;
  }
  next[key] = {
    id: key,
    kind,
    refId,
    createdAt: new Date().toISOString(),
    ...payload,
  };
  store = next;
  writeStore(store);
  emit();
  return true;
}

export function removeFavorite(kind: FavoriteKind, refId: string) {
  const key = makeKey(kind, refId);
  if (!store[key]) return;
  const next = { ...store };
  delete next[key];
  store = next;
  writeStore(store);
  emit();
}

export function removeFavoritesByIds(ids: string[]) {
  if (ids.length === 0) return;
  const next = { ...store };
  let changed = false;
  for (const id of ids) {
    if (next[id]) {
      delete next[id];
      changed = true;
    }
  }
  if (changed) {
    store = next;
    writeStore(store);
    emit();
  }
}

export function getAllFavorites(): FavoriteRecord[] {
  return Object.values(store).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
}

export function useFavorites(): FavoriteRecord[] {
  // 服务端与首帧 hydration 返回空列表，避免 SSR/CSR 文本不一致
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return hydrated ? getAllFavorites() : [];
}


export function useFavorite(
  kind: FavoriteKind,
  refId: string,
  payload: FavoritePayload,
) {
  const favored = useSyncExternalStore(
    subscribe,
    () => isFavorited(kind, refId),
    () => false,
  );
  const toggle = useCallback(() => {
    toggleFavorite(kind, refId, payload);
    // payload is referenced by caller; if it changes ad-hoc that's fine
  }, [kind, refId, payload]);
  return { favored, toggle };
}

export const FAVORITE_KIND_LABEL: Record<FavoriteKind, string> = {
  enterprise: "企业",
  contact: "人物",
  bill: "提单",
  product: "商品",
};

/* ---------------- Demo / Mock seeding ---------------- */

function isoDaysAgo(days: number, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function buildDemoRecords(): FavoriteRecord[] {
  const out: FavoriteRecord[] = [];
  // 4 企业
  const entPicks = [0, 4, 11, 23]
    .map((i) => ENTERPRISES[i])
    .filter(Boolean);
  entPicks.forEach((e, idx) => {
    out.push({
      id: `enterprise:${e.id}`,
      kind: "enterprise",
      refId: e.id,
      createdAt: isoDaysAgo(idx, 9, 15 + idx),
      title: e.name,
      subtitle: e.industry || "未公开行业",
      meta: {
        country: e.country || "未知国家",
        role: e.tradeRole,
        est: e.est,
      },
    });
  });
  // 3 人物 (隶属企业)
  const contactSource = [
    { entIdx: 0, contactIdx: 0 },
    { entIdx: 4, contactIdx: 1 },
    { entIdx: 11, contactIdx: 0 },
  ];
  contactSource.forEach((c, idx) => {
    const ent = ENTERPRISES[c.entIdx];
    const contact = ent?.contacts[c.contactIdx];
    if (!ent || !contact) return;
    out.push({
      id: `contact:${ent.id}:${c.contactIdx}`,
      kind: "contact",
      refId: `${ent.id}:${c.contactIdx}`,
      createdAt: isoDaysAgo(idx + 1, 14, 30 + idx),
      title: contact.name,
      subtitle: contact.title,
      meta: {
        email: contact.email,
        ...(contact.phone ? { phone: contact.phone } : {}),
      },
      parentRef: { kind: "enterprise", id: ent.id, name: ent.name },
    });
  });
  return out;
}

export function seedDemoFavoritesIfEmpty() {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(SEED_FLAG_KEY)) return;
    const records = buildDemoRecords();
    const next = { ...store };
    for (const r of records) {
      // 不覆盖用户已有的收藏
      if (!next[r.id]) next[r.id] = r;
    }
    store = next;
    writeStore(store);
    window.localStorage.setItem(SEED_FLAG_KEY, "1");
    emit();
  } catch {}
}

export function resetDemoFavorites() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SEED_FLAG_KEY);
  } catch {}
  store = {};
  writeStore(store);
  emit();
  seedDemoFavoritesIfEmpty();
}