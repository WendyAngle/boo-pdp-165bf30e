import { useSyncExternalStore } from "react";
import { findEnterprise } from "@/data/enterprises";

/** WhatsApp 号码注册状态本地缓存（mock） */
export type WaStatus = "verified" | "unregistered" | "checking" | "unchecked";

const KEY = "boo:wa-verify:v1";

function readCache(): Record<string, "verified" | "unregistered"> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) ?? {};
  } catch {
    return {};
  }
}
function writeCache(v: Record<string, "verified" | "unregistered">) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(v));
  } catch {}
}

let cache = readCache();
let checking = new Set<string>();
let version = 0;
const listeners = new Set<() => void>();
function emit() {
  version++;
  listeners.forEach((l) => l());
}

export function normalizePhone(p?: string): string {
  return (p ?? "").replace(/[^\d+]/g, "");
}

export function getWaStatus(phone: string): WaStatus {
  const k = normalizePhone(phone);
  if (!k) return "unchecked";
  if (checking.has(k)) return "checking";
  const v = cache[k];
  return v ?? "unchecked";
}

/**
 * 使用「企业 socials.whatsapp 布尔值」作为 mock 的真值来源：
 * true → verified，false → unregistered。
 * 未来切换真实 WhatsApp Business Check Contact API 时接口不变。
 */
function truthFor(phone: string, enterpriseId?: string): "verified" | "unregistered" {
  if (enterpriseId) {
    const e = findEnterprise(enterpriseId);
    if (e) return e.socials?.whatsapp ? "verified" : "unregistered";
  }
  // 兜底：按号码哈希 80% 已注册
  let h = 0;
  for (let i = 0; i < phone.length; i++) h = (h * 31 + phone.charCodeAt(i)) | 0;
  return Math.abs(h) % 100 < 80 ? "verified" : "unregistered";
}

/**
 * 校验一组 (phone, enterpriseId?) 组合。已有缓存的跳过（force=true 时强制重校）。
 * 每条 ≈ 150-250ms，最大并发 10。
 */
export async function verifyMany(
  items: { phone: string; enterpriseId?: string }[],
  opts: { force?: boolean } = {},
): Promise<void> {
  const todo = items
    .map((x) => ({ ...x, key: normalizePhone(x.phone) }))
    .filter((x) => x.key && (opts.force || cache[x.key] === undefined));
  if (todo.length === 0) return;

  for (const t of todo) checking.add(t.key);
  emit();

  const CONCURRENCY = 10;
  let i = 0;
  async function worker() {
    while (i < todo.length) {
      const t = todo[i++];
      await new Promise((r) => setTimeout(r, 150 + Math.random() * 100));
      cache[t.key] = truthFor(t.key, t.enterpriseId);
      checking.delete(t.key);
      writeCache(cache);
      emit();
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, todo.length) }, worker),
  );
}

export function useWaVerifyVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
    () => 0,
  );
}

/** 脱敏国际手机号：+86 138****5678 */
export function maskPhoneWa(phone: string): string {
  const p = normalizePhone(phone);
  if (!p) return "—";
  if (p.length <= 6) return "***";
  const head = p.slice(0, Math.min(6, p.length - 4));
  const tail = p.slice(-4);
  return `${head}****${tail}`;
}