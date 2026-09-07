import { useSyncExternalStore } from "react";

/** 我方社媒执行账号池（对最终用户隐藏，仅后台调度使用） */
export type SocialPlatform = "WhatsApp" | "TikTok" | "Facebook";

/** 账号 / 代理 地区枚举（ISO code + 中文标签） */
export const REGION_OPTIONS: { code: string; label: string }[] = [
  { code: "US", label: "美国" },
  { code: "JP", label: "日本" },
  { code: "SG", label: "新加坡" },
  { code: "ID", label: "印度尼西亚" },
  { code: "CN", label: "中国" },
  { code: "MY", label: "马来西亚" },
  { code: "KR", label: "韩国" },
  { code: "TH", label: "泰国" },
  { code: "VN", label: "越南" },
  { code: "PH", label: "菲律宾" },
  { code: "GB", label: "英国" },
  { code: "DE", label: "德国" },
  { code: "FR", label: "法国" },
  { code: "CA", label: "加拿大" },
  { code: "AU", label: "澳大利亚" },
  { code: "BR", label: "巴西" },
  { code: "IN", label: "印度" },
  { code: "MX", label: "墨西哥" },
  { code: "OTHER", label: "其他" },
];
export function regionLabel(code?: string): string {
  if (!code) return "—";
  return REGION_OPTIONS.find((r) => r.code === code)?.label ?? code;
}

export interface SocialAccount {
  id: string;
  platform: SocialPlatform;
  handle: string;
  displayName: string;
  /** 每日发送额度（私信） */
  dailyLimit: number;
  sentToday: number;
  /** Facebook / TikTok：每日加友额度（默认 5） */
  dailyFriendLimit?: number;
  friendSentToday?: number;
  /** Facebook / TikTok：每日私信额度（默认 20） */
  dailyDmLimit?: number;
  dmSentToday?: number;
  status: "正常" | "风控" | "被封" | "养号中" | "备货中";
  purchasedAt?: string;
  /** 下单时间 */
  orderedAt?: string;
  /** 预计交付时间（下单 + 7 个工作日） */
  expectedDeliveryAt?: string;
  /** 实际交付时间 */
  deliveredAt?: string;
  /** 到期时间（默认交付后 1 年） */
  expiresAt?: string;
  /** 账号"人设"归属地（ISO code） */
  ownerRegion?: string;
  /** 出口 IP / 代理所在地（ISO code） */
  proxyRegion?: string;
}

const KEY = "boo:social-accounts:v10";
const SEED_FLAG = "boo:social-accounts:v10:seeded";

/** 已交付账号必须有 handle / 显示名 / 交付与到期时间，缺一即为脏数据 */
function isValidAccount(a: SocialAccount): boolean {
  if (!a || !a.id || !a.platform) return false;
  if (a.status === "备货中") return Boolean(a.orderedAt);
  return Boolean(a.handle && a.displayName && a.deliveredAt && a.expiresAt);
}

function read(): SocialAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return (arr as SocialAccount[]).filter(isValidAccount);
  } catch {}
  return [];
}
function write(arr: SocialAccount[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(arr));
  } catch {}
}

/** 在指定日期基础上加 N 个工作日（跳过周六、周日） */
export function addWorkdays(from: Date, days: number): Date {
  const d = new Date(from);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

/** 返回距离目标日期还剩多少个工作日（今天算 0） */
export function workdaysUntil(target: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const t = new Date(target);
  t.setHours(0, 0, 0, 0);
  if (t <= now) return 0;
  let count = 0;
  const cur = new Date(now);
  while (cur < t) {
    cur.setDate(cur.getDate() + 1);
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

function seed() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(SEED_FLAG)) return;
  const now = new Date();
  const nowIso = now.toISOString();
  const daysFromNow = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return d.toISOString();
  };
  // 覆盖 4 档到期区间：>3 个月、1-3 个月、<1 个月、<1 周
  const seedData: SocialAccount[] = [
    {
      id: "sa_fb_1",
      platform: "Facebook",
      handle: "@bytetech.export",
      displayName: "ByteTech FB · Global",
      dailyLimit: 20, sentToday: 3,
      dailyFriendLimit: 5, friendSentToday: 2,
      dailyDmLimit: 5, dmSentToday: 3,
      status: "正常",
      ownerRegion: "US",
      proxyRegion: "US",
      deliveredAt: nowIso,
      expiresAt: daysFromNow(300), // >3 个月
    },
    {
      id: "sa_fb_2",
      platform: "Facebook",
      handle: "@bytetech.trade",
      displayName: "ByteTech FB · Trade",
      dailyLimit: 20, sentToday: 0,
      dailyFriendLimit: 5, friendSentToday: 0,
      dailyDmLimit: 5, dmSentToday: 0,
      status: "风控",
      ownerRegion: "SG",
      proxyRegion: "SG",
      deliveredAt: nowIso,
      expiresAt: daysFromNow(60), // 1-3 个月
    },
    {
      id: "sa_tt_1",
      platform: "TikTok",
      handle: "@bytetech_official",
      displayName: "ByteTech TT · Official",
      dailyLimit: 20, sentToday: 1,
      dailyFriendLimit: 5, friendSentToday: 1,
      dailyDmLimit: 5, dmSentToday: 2,
      status: "正常",
      ownerRegion: "JP",
      proxyRegion: "JP",
      deliveredAt: nowIso,
      expiresAt: daysFromNow(220), // >3 个月
    },
    {
      id: "sa_tt_2",
      platform: "TikTok",
      handle: "@bytetech_biz",
      displayName: "ByteTech TT · Biz",
      dailyLimit: 20, sentToday: 0,
      dailyFriendLimit: 5, friendSentToday: 0,
      dailyDmLimit: 5, dmSentToday: 0,
      status: "被封",
      ownerRegion: "MY",
      proxyRegion: "SG",
      deliveredAt: nowIso,
      expiresAt: daysFromNow(20), // <1 个月
    },
    {
      id: "sa_fb_3",
      platform: "Facebook",
      handle: "@bytetech.eu",
      displayName: "ByteTech FB · EU",
      dailyLimit: 20, sentToday: 4,
      dailyFriendLimit: 5, friendSentToday: 1,
      dailyDmLimit: 5, dmSentToday: 4,
      status: "正常",
      ownerRegion: "DE",
      proxyRegion: "DE",
      deliveredAt: nowIso,
      expiresAt: daysFromNow(5), // <1 周
    },
    {
      id: "sa_tt_3",
      platform: "TikTok",
      handle: "@bytetech_th",
      displayName: "ByteTech TT · Thailand",
      dailyLimit: 20, sentToday: 2,
      dailyFriendLimit: 5, friendSentToday: 2,
      dailyDmLimit: 5, dmSentToday: 2,
      status: "风控",
      ownerRegion: "TH",
      proxyRegion: "SG",
      deliveredAt: nowIso,
      expiresAt: daysFromNow(85), // 1-3 个月
    },
    {
      id: "sa_fb_4",
      platform: "Facebook",
      handle: "@bytetech.uk",
      displayName: "ByteTech FB · UK",
      dailyLimit: 20, sentToday: 1,
      dailyFriendLimit: 5, friendSentToday: 0,
      dailyDmLimit: 5, dmSentToday: 1,
      status: "正常",
      ownerRegion: "GB",
      proxyRegion: "GB",
      deliveredAt: nowIso,
      expiresAt: daysFromNow(3), // <1 周
    },
    {
      id: "sa_tt_4",
      platform: "TikTok",
      handle: "@bytetech_kr",
      displayName: "ByteTech TT · Korea",
      dailyLimit: 20, sentToday: 0,
      dailyFriendLimit: 5, friendSentToday: 0,
      dailyDmLimit: 5, dmSentToday: 0,
      status: "正常",
      ownerRegion: "KR",
      proxyRegion: "KR",
      deliveredAt: nowIso,
      expiresAt: daysFromNow(25), // <1 个月
    },
  ];
  write(seedData);
  window.localStorage.setItem(SEED_FLAG, "1");
}
seed();

let cache: SocialAccount[] = read();
let version = 0;
const listeners = new Set<() => void>();
function emit() {
  version++;
  listeners.forEach((l) => l());
}
function commit(next: SocialAccount[]) {
  cache = next;
  write(next);
  emit();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      cache = read();
      emit();
    }
  });
}

export function useSocialAccounts(): SocialAccount[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      void version;
      return cache;
    },
    () => [],
  );
}

export function getSocialAccounts(): SocialAccount[] {
  return cache;
}

/** 更新账号状态（用于一键恢复 / 转入养号） */
export function updateAccountStatus(id: string, status: SocialAccount["status"]) {
  const next = cache.map((a) => (a.id === id ? { ...a, status } : a));
  commit(next);
}

/** 平台可用账号（状态=正常） */
export function usableAccountsOf(list: SocialAccount[], platform: SocialPlatform) {
  return list.filter((a) => a.platform === platform && a.status === "正常");
}

/** 池今日剩余额度合计 */
export function poolRemaining(list: SocialAccount[], platform: SocialPlatform): number {
  return usableAccountsOf(list, platform).reduce(
    (s, a) => s + Math.max(0, a.dailyLimit - a.sentToday),
    0,
  );
}

/** 池今日上限合计（用于展示 N/M） */
export function poolCapacity(list: SocialAccount[], platform: SocialPlatform): number {
  return usableAccountsOf(list, platform).reduce((s, a) => s + a.dailyLimit, 0);
}

/**
 * 后台调度分派：按剩余额度从高到低轮询，为 count 条消息分配账号，
 * 返回实际可分配数量并同步累加 sentToday。
 */
export function dispatchSend(platform: SocialPlatform, count: number): number {
  let remaining = count;
  const next = cache.map((a) => ({ ...a }));
  while (remaining > 0) {
    const idx = next
      .map((a, i) => ({ a, i }))
      .filter(
        ({ a }) =>
          a.platform === platform &&
          a.status === "正常" &&
          a.sentToday < a.dailyLimit,
      )
      .sort(
        (x, y) =>
          y.a.dailyLimit - y.a.sentToday - (x.a.dailyLimit - x.a.sentToday),
      )[0]?.i;
    if (idx === undefined) break;
    next[idx].sentToday += 1;
    remaining -= 1;
  }
  commit(next);
  return count - remaining;
}

/**
 * 购买后向池中追加 N 个「备货中」账号（7 个工作日后交付）。
 */
export function addPurchasedAccounts(
  platform: "Facebook" | "TikTok",
  quantity: number,
  options?: { ownerRegion?: string; proxyRegion?: string },
): SocialAccount[] {
  const now = new Date();
  const nowIso = now.toISOString();
  const deliverAt = addWorkdays(now, 7).toISOString();
  const newOnes: SocialAccount[] = Array.from({ length: quantity }).map((_, i) => ({
    id: `sa_${platform === "Facebook" ? "fb" : "tt"}_${Date.now().toString(36)}_${i}`,
    platform,
    handle: "",
    displayName: "",
    dailyLimit: 0,
    sentToday: 0,
    dailyFriendLimit: 0,
    friendSentToday: 0,
    dailyDmLimit: 0,
    dmSentToday: 0,
    status: "备货中",
    orderedAt: nowIso,
    expectedDeliveryAt: deliverAt,
    ownerRegion: options?.ownerRegion,
    proxyRegion: options?.proxyRegion,
  }));
  commit([...newOnes, ...cache]);
  return newOnes;
}

/**
 * 【演示环境】立即交付一个备货中账号：填充 handle / displayName，
 * 状态转为「养号中」，额度恢复默认值。
 */
export function simulateDeliver(id: string): void {
  const target = cache.find((a) => a.id === id);
  if (!target || target.status !== "备货中") return;
  const samePlatform = cache.filter((a) => a.platform === target.platform).length;
  const seq = samePlatform;
  const prefix = target.platform === "Facebook" ? "fb" : "tt";
  const handle =
    target.platform === "Facebook"
      ? `@bytetech.${prefix}${String(seq).padStart(3, "0")}`
      : `@bytetech_${prefix}${String(seq).padStart(3, "0")}`;
  const deliveredIso = new Date().toISOString();
  const expiresIso = (() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString();
  })();
  const next = cache.map((a) =>
    a.id === id
      ? {
          ...a,
          handle,
          displayName: `ByteTech ${target.platform} · #${seq}`,
          dailyLimit: 20,
          dailyFriendLimit: 5,
          dailyDmLimit: 5,
          status: "养号中" as const,
          purchasedAt: deliveredIso,
          deliveredAt: deliveredIso,
          expiresAt: expiresIso,
        }
      : a,
  );
  commit(next);
}

/** 平台已购账号数 */
export function countAccountsByPlatform(
  list: SocialAccount[],
  platform: SocialPlatform,
): number {
  return list.filter((a) => a.platform === platform).length;
}

/** 平台今日加友剩余额度合计 */
export function friendRemaining(
  list: SocialAccount[],
  platform: "Facebook" | "TikTok",
): number {
  return list
    .filter((a) => a.platform === platform && a.status === "正常")
    .reduce(
      (s, a) => s + Math.max(0, (a.dailyFriendLimit ?? 5) - (a.friendSentToday ?? 0)),
      0,
    );
}
