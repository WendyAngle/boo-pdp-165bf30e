import { useSyncExternalStore } from "react";

export type SuppressionKind = "email" | "phone";

export interface SuppressionRecord {
  id: string;
  kind: SuppressionKind;
  value: string; // 邮箱或手机号（已去空白）
  reason: string;
  createdAt: string;
  source?: string; // 来源：STOP 关键字 / 硬退信 / 手动 / 投诉
  note?: string;
}

const KEY = "boo:suppressions:v1";
const SEED_KEY = "boo:suppressions:seed:v3";

function read(): SuppressionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const j = JSON.parse(raw);
    if (Array.isArray(j)) return j as SuppressionRecord[];
  } catch {}
  return [];
}

function write(list: SuppressionRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

let store: SuppressionRecord[] = read();
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
function getVersion() {
  return version;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      store = read();
      emit();
    }
  });
  // 演示种子：版本未匹配 或 当前列表为空 时都重新写入
  if (!window.localStorage.getItem(SEED_KEY) || store.length === 0) {
    const now = Date.now();
    const H = 3600_000;
    const D = 86400_000;
    const seed: SuppressionRecord[] = [
      // 邮箱：5 条
      { id: "sup_e1", kind: "email", value: "no-reply@example.com", reason: "退订请求", source: "退订链接", createdAt: new Date(now - 5 * D).toISOString() },
      { id: "sup_e2", kind: "email", value: "bounced@invalid.io", reason: "硬退信", source: "SMTP 550 5.1.1", createdAt: new Date(now - 3 * D).toISOString() },
      { id: "sup_e3", kind: "email", value: "complaint@mail.com", reason: "投诉", source: "FBL 投诉回执", createdAt: new Date(now - 2 * D - 4 * H).toISOString(), note: "被标记为垃圾邮件" },
      { id: "sup_e4", kind: "email", value: "abuse@corp-legal.cn", reason: "法务/合规", source: "手动", createdAt: new Date(now - 26 * H).toISOString(), note: "客户法务来函要求停止一切联系" },
      { id: "sup_e5", kind: "email", value: "tester@qa.local", reason: "手动添加", source: "手动", createdAt: new Date(now - 6 * H).toISOString(), note: "测试账号" },
      // 手机号：5 条
      { id: "sup_p1", kind: "phone", value: "+8613800001111", reason: "STOP 关键字", source: "MO 消息", createdAt: new Date(now - 4 * D).toISOString() },
      { id: "sup_p2", kind: "phone", value: "+8613900002222", reason: "STOP 关键字", source: "Twilio MO / STOP", createdAt: new Date(now - 2 * D - 5 * H).toISOString() },
      { id: "sup_p3", kind: "phone", value: "+14155550100", reason: "投诉", source: "运营商反馈", createdAt: new Date(now - 1 * D - 8 * H).toISOString(), note: "美国号码，TCPA 风险" },
      { id: "sup_p4", kind: "phone", value: "+447700900123", reason: "硬退信", source: "Vonage DLR / Invalid", createdAt: new Date(now - 20 * H).toISOString(), note: "号码不可达" },
      { id: "sup_p5", kind: "phone", value: "+8617700003333", reason: "手动添加", source: "手动", createdAt: new Date(now - 3 * H).toISOString(), note: "客户电话确认退订" },
    ];
    write(seed);
    store = seed;
    window.localStorage.setItem(SEED_KEY, "1");
  }
}

function makeId() {
  return `sup_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function normalizeValue(kind: SuppressionKind, v: string) {
  const s = v.trim();
  return kind === "email" ? s.toLowerCase() : s.replace(/\s+/g, "");
}

export function isSuppressed(kind: SuppressionKind, v: string): boolean {
  const key = normalizeValue(kind, v);
  return store.some((r) => r.kind === kind && r.value === key);
}

export function addSuppression(kind: SuppressionKind, value: string, reason: string, source?: string, note?: string) {
  const key = normalizeValue(kind, value);
  if (!key) return;
  if (store.some((r) => r.kind === kind && r.value === key)) return;
  const rec: SuppressionRecord = {
    id: makeId(),
    kind,
    value: key,
    reason,
    source,
    note,
    createdAt: new Date().toISOString(),
  };
  store = [rec, ...store];
  write(store);
  emit();
}

export function removeSuppression(id: string) {
  store = store.filter((r) => r.id !== id);
  write(store);
  emit();
}

export function useSuppressions(): SuppressionRecord[] {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return store;
}

export function getSuppressionsSnapshot(): SuppressionRecord[] {
  return store;
}