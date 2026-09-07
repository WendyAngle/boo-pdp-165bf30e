import { useSyncExternalStore } from "react";

/**
 * 自建名单：批量发邮件/发短信中手动添加或批量导入的目标沉淀，企业内共享。
 */

export type ManualChannel = "email" | "phone";

export interface ManualTarget {
  id: string;
  channel: ManualChannel;
  value: string; // 邮箱或 E.164 手机号
  /** 联系人姓名 */
  name?: string;
  /** 所属企业 */
  company?: string;
  country?: string;
  createdAt: string;
  /** 最近一次通过批量触达发送的时间；有值即展示「已触达」标识 */
  lastReachedAt?: string;
}

/** 新增/追加目标时的输入 */
export interface ManualTargetInput {
  value: string;
  name?: string;
  company?: string;
  country?: string;
}

export interface ManualList {
  id: string;
  name: string;
  channel: ManualChannel;
  targets: ManualTarget[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const KEY = "boo:manual-lists:v1";
const SEED_KEY = "boo:manual-lists:seed:v3";

function read(): ManualList[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const j = raw ? JSON.parse(raw) : null;
    return Array.isArray(j) ? (j as ManualList[]) : [];
  } catch {
    return [];
  }
}
function write(list: ManualList[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

let store: ManualList[] = read();
let version = 0;
const listeners = new Set<() => void>();
function emit() {
  version++;
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const getVersion = () => version;

function makeId(p: string) {
  return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function mkTarget(
  channel: ManualChannel,
  value: string,
  country?: string,
  extra?: { name?: string; company?: string; lastReachedAt?: string },
): ManualTarget {
  return {
    id: makeId("mt"),
    channel,
    value,
    country,
    name: extra?.name,
    company: extra?.company,
    lastReachedAt: extra?.lastReachedAt,
    createdAt: new Date().toISOString(),
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      store = read();
      emit();
    }
  });
  if (!window.localStorage.getItem(SEED_KEY) || store.length === 0) {
    const now = Date.now();
    const D = 86400_000;
    const seed: ManualList[] = [
      {
        id: "ml_seed_1",
        name: "展会名片 · 广交会 2026 春",
        channel: "email",
        createdBy: "张敏",
        createdAt: new Date(now - 9 * D).toISOString(),
        updatedAt: new Date(now - 2 * D).toISOString(),
        targets: [
          { v: "buyer@nordic-homeware.se", n: "Erik Lindqvist", co: "Nordic Homeware AB", r: 2 },
          { v: "purchase@atlas-import.de", n: "Katrin Weber", co: "Atlas Import GmbH", r: 3 },
          { v: "sales@brightline-retail.co.uk", n: "Oliver Grant", co: "Brightline Retail Ltd." },
          { v: "info@vega-trading.nl", n: "Sanne de Vries", co: "Vega Trading B.V." },
        ].map((x) => ({
          ...mkTarget("email", x.v, undefined, {
            name: x.n,
            company: x.co,
            lastReachedAt: x.r ? new Date(now - x.r * D).toISOString() : undefined,
          }),
          id: makeId("mt"),
        })),
      },
      {
        id: "ml_seed_1a",
        name: `手动邮箱 ${new Date(now - 1 * D).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}`,
        channel: "email",
        createdBy: "王芳",
        createdAt: new Date(now - 1 * D).toISOString(),
        updatedAt: new Date(now - 1 * D).toISOString(),
        targets: [
          { v: "m.hansen@fjord-supplies.no", n: "Mads Hansen", co: "Fjord Supplies AS", r: 1 },
          { v: "orders@summit-housewares.com", n: "Laura Bennett", co: "Summit Housewares Inc." },
          { v: "contact@lumen-decor.fr", n: "Camille Rousseau", co: "Lumen Décor SARL" },
        ].map((x) => ({
          ...mkTarget("email", x.v, undefined, {
            name: x.n,
            company: x.co,
            lastReachedAt: x.r ? new Date(now - x.r * D).toISOString() : undefined,
          }),
          id: makeId("mt"),
        })),
      },
      {
        id: "ml_seed_2a",
        name: `手动手机号 ${new Date(now - 2 * D).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}`,
        channel: "phone",
        createdBy: "张敏",
        createdAt: new Date(now - 2 * D).toISOString(),
        updatedAt: new Date(now - 2 * D).toISOString(),
        targets: [
          { v: "+84901234567", c: "越南", n: "Nguyen Van An", co: "An Phat Trading JSC", r: 1 },
          { v: "+639171234567", c: "菲律宾", n: "Maria Santos", co: "Santos Home Retail" },
        ].map((x) => ({
          ...mkTarget("phone", x.v, x.c, {
            name: x.n,
            company: x.co,
            lastReachedAt: x.r ? new Date(now - x.r * D).toISOString() : undefined,
          }),
          id: makeId("mt"),
        })),
      },
      {
        id: "ml_seed_2",
        name: "东南亚经销商手机号",
        channel: "phone",
        createdBy: "李伟",
        createdAt: new Date(now - 4 * D).toISOString(),
        updatedAt: new Date(now - 4 * D).toISOString(),
        targets: [
          { v: "+6281234567890", c: "印度尼西亚", n: "Budi Santoso", co: "PT Cahaya Rumah" },
          { v: "+66812345678", c: "泰国", n: "Somchai Prasert", co: "Bangkok Living Co." , r: 3 },
          { v: "+60123456789", c: "马来西亚", n: "Lim Wei Jie", co: "Wawasan Home Sdn Bhd" },
        ].map((x) => ({
          ...mkTarget("phone", x.v, x.c, {
            name: x.n,
            company: x.co,
            lastReachedAt: x.r ? new Date(now - x.r * D).toISOString() : undefined,
          }),
          id: makeId("mt"),
        })),
      },
    ];
    write(seed);
    store = seed;
    window.localStorage.setItem(SEED_KEY, "1");
  }
}

export function getManualLists() {
  return store;
}

export function useManualLists(): ManualList[] {
  useSyncExternalStore(subscribe, getVersion, () => 0);
  return store;
}

/** 新建名单；已存在同名同渠道名单则合并去重 */
export function saveManualList(
  name: string,
  channel: ManualChannel,
  values: ManualTargetInput[],
  createdBy: string,
): ManualList {
  const existing = store.find((l) => l.name === name && l.channel === channel);
  if (existing) {
    appendToManualList(existing.id, values);
    return store.find((l) => l.id === existing.id)!;
  }
  const list: ManualList = {
    id: makeId("ml"),
    name,
    channel,
    createdBy,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    targets: values.map((v) => mkTarget(channel, v.value, v.country, { name: v.name, company: v.company })),
  };
  store = [list, ...store];
  write(store);
  emit();
  return list;
}

export function appendToManualList(id: string, values: ManualTargetInput[]) {
  store = store.map((l) => {
    if (l.id !== id) return l;
    const seen = new Set(l.targets.map((t) => t.value.toLowerCase()));
    const add = values
      .filter((v) => !seen.has(v.value.toLowerCase()))
      .map((v) => mkTarget(l.channel, v.value, v.country, { name: v.name, company: v.company }));
    return { ...l, targets: [...l.targets, ...add], updatedAt: new Date().toISOString() };
  });
  write(store);
  emit();
}

export function renameManualList(id: string, name: string) {
  store = store.map((l) =>
    l.id === id ? { ...l, name, updatedAt: new Date().toISOString() } : l,
  );
  write(store);
  emit();
}

export function removeManualList(id: string) {
  store = store.filter((l) => l.id !== id);
  write(store);
  emit();
}

export function removeManualTarget(listId: string, targetId: string) {
  store = store.map((l) =>
    l.id === listId
      ? {
          ...l,
          targets: l.targets.filter((t) => t.id !== targetId),
          updatedAt: new Date().toISOString(),
        }
      : l,
  );
  write(store);
  emit();
}

/** 标记为已触达（批量发邮件 / 批量发短信发送后调用） */
export function markManualTargetsReached(values: string[]) {
  const set = new Set(values.map((v) => v.toLowerCase()));
  if (set.size === 0) return;
  const at = new Date().toISOString();
  let changed = false;
  store = store.map((l) => {
    let hit = false;
    const targets = l.targets.map((t) => {
      if (!set.has(t.value.toLowerCase())) return t;
      hit = true;
      return { ...t, lastReachedAt: at };
    });
    if (!hit) return l;
    changed = true;
    return { ...l, targets, updatedAt: at };
  });
  if (changed) {
    write(store);
    emit();
  }
}

export const isTargetReached = (t: ManualTarget) => !!t.lastReachedAt;

export const channelLabel = (c: ManualChannel) => (c === "email" ? "邮件" : "短信");
