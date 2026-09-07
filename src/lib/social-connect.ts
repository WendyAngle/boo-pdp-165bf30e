import { useSyncExternalStore } from "react";
import { findEnterprise } from "@/data/enterprises";
import type { FavoriteRecord } from "@/lib/favorites";

/**
 * 收藏中心 · 社媒「加好友 / 关注」关系层（P0）
 * 平台差异：Facebook 个人号 = 加好友（不支持附言）；Facebook 主页 / TikTok = 关注。
 */

export type ConnectPlatform = "Facebook" | "TikTok";
export const CONNECT_PLATFORMS: ConnectPlatform[] = ["Facebook", "TikTok"];

export type SocialAccountType = "personal" | "page";
export type IdentityConfidence = "high" | "medium" | "low";

export type ConnectAction = "friend" | "follow";

export interface SocialIdentity {
  /** 唯一键：favoriteId + 平台 */
  key: string;
  favoriteId: string;
  platform: ConnectPlatform;
  handle: string;
  accountType: SocialAccountType;
  confidence: IdentityConfidence;
  source: string;
}

/** 内部状态机 */
export type ConnectState =
  | "none"
  | "queued"
  | "requested"
  | "accepted"
  | "following"
  | "rejected"
  | "expired"
  | "failed";

/** 对外标签映射（列表 / 筛选统一口径） */
export type ConnectLabel = "未建立" | "请求中" | "已建立" | "未通过" | "失败";

export function stateLabel(s: ConnectState): ConnectLabel {
  switch (s) {
    case "queued":
    case "requested":
      return "请求中";
    case "accepted":
    case "following":
      return "已建立";
    case "rejected":
    case "expired":
      return "未通过";
    case "failed":
      return "失败";
    default:
      return "未建立";
  }
}

export const LABEL_TONE: Record<ConnectLabel, string> = {
  未建立: "bg-muted text-muted-foreground border-border",
  请求中: "bg-amber-50 text-amber-700 border-amber-200",
  已建立: "bg-emerald-50 text-emerald-700 border-emerald-200",
  未通过: "bg-slate-100 text-slate-600 border-slate-300",
  失败: "bg-rose-50 text-rose-700 border-rose-200",
};

export const CONFIDENCE_LABEL: Record<IdentityConfidence, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

/** 平台动作：Facebook 主页 / TikTok 一律关注；Facebook 个人号加好友 */
export function actionOf(
  platform: ConnectPlatform,
  accountType: SocialAccountType,
): ConnectAction {
  if (platform === "TikTok") return "follow";
  return accountType === "page" ? "follow" : "friend";
}

export const ACTION_LABEL: Record<ConnectAction, string> = {
  friend: "加好友",
  follow: "关注",
};

// ---------------------------------------------------------------- 身份识别

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "")
    .slice(0, 24) || "user";

const hash = (s: string) =>
  Array.from(s).reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 997, 7);

/** 从收藏对象解析社媒身份（与批量社媒私信的 handle 口径保持一致） */
export function identitiesOfFavorite(r: FavoriteRecord): SocialIdentity[] {
  if (r.kind !== "enterprise" && r.kind !== "contact") return [];
  const entId =
    r.kind === "enterprise" ? r.refId : (r.parentRef?.id ?? r.refId.split(":")[0]);
  const ent = entId ? findEnterprise(entId) : undefined;
  const base = slug(r.title);
  const out: SocialIdentity[] = [];

  if (ent?.socials?.facebook) {
    out.push({
      key: `${r.id}:Facebook`,
      favoriteId: r.id,
      platform: "Facebook",
      handle: `@${base}`,
      // 企业收藏 → 主页（关注）；人物收藏 → 个人号（加好友）
      accountType: r.kind === "enterprise" ? "page" : "personal",
      confidence: "high",
      source: "企业库",
    });
  }
  if (hash(`${entId}:${r.title}`) % 3 !== 0) {
    out.push({
      key: `${r.id}:TikTok`,
      favoriteId: r.id,
      platform: "TikTok",
      handle: `@${base}.tt`,
      accountType: "personal",
      // TikTok handle 目前由规则推测，标记为低可信
      confidence: "low",
      source: "规则推测",
    });
  }
  return out;
}

// ---------------------------------------------------------------- 状态存储

export interface ConnectRecord {
  /** 唯一键：platform:handle */
  id: string;
  favoriteId: string;
  platform: ConnectPlatform;
  handle: string;
  name: string;
  action: ConnectAction;
  state: ConnectState;
  taskId?: string;
  requestedAt?: string;
  updatedAt: string;
  failReason?: string;
}

const KEY = "boo:social-connect:v1";
export const recordId = (platform: ConnectPlatform, handle: string) =>
  `${platform}:${handle}`;

function read(): Record<string, ConnectRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") return obj as Record<string, ConnectRecord>;
  } catch {}
  return {};
}
function write(map: Record<string, ConnectRecord>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(map));
  } catch {}
}

const EMPTY: Record<string, ConnectRecord> = {};
let cache = read();
let version = 0;
const listeners = new Set<() => void>();
function emit() {
  version++;
  cache = { ...cache };
  write(cache);
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      cache = read();
      version++;
      listeners.forEach((l) => l());
    }
  });
}

export function useConnectMap(): Record<string, ConnectRecord> {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      void version;
      return cache;
    },
    () => EMPTY,
  );
}

export function connectStateOf(
  map: Record<string, ConnectRecord>,
  platform: ConnectPlatform,
  handle: string,
): ConnectState {
  return map[recordId(platform, handle)]?.state ?? "none";
}

/** 收藏对象的聚合关系标签：任一身份已建立 → 已建立，其次 请求中 / 未通过 / 失败 */
export function favoriteConnectLabel(
  map: Record<string, ConnectRecord>,
  r: FavoriteRecord,
): ConnectLabel | null {
  const ids = identitiesOfFavorite(r);
  if (ids.length === 0) return null;
  const labels = ids.map((i) => stateLabel(connectStateOf(map, i.platform, i.handle)));
  const order: ConnectLabel[] = ["已建立", "请求中", "未通过", "失败", "未建立"];
  for (const l of order) if (labels.includes(l)) return l;
  return "未建立";
}

const DAY = 86400000;

/** 去重与冷却：返回不可执行的原因（可执行时返回 null） */
export function blockedReason(rec?: ConnectRecord): string | null {
  if (!rec) return null;
  const since = (t?: string) => (t ? Date.now() - new Date(t).getTime() : Infinity);
  switch (rec.state) {
    case "accepted":
    case "following":
      return "关系已建立";
    case "queued":
    case "requested":
      return "请求进行中";
    case "rejected":
      return "对方已拒绝，不再重试";
    case "expired":
      return since(rec.requestedAt) >= 30 * DAY ? null : "冷却中（首次请求满 30 天后可重试）";
    case "failed":
      return since(rec.updatedAt) >= 7 * DAY ? null : "失败冷却中（7 天）";
    default:
      return null;
  }
}

/** 批量写入：任务创建后进入 queued → requested */
export function markRequested(
  items: {
    favoriteId: string;
    platform: ConnectPlatform;
    handle: string;
    name: string;
    action: ConnectAction;
  }[],
  taskId: string,
) {
  const now = new Date().toISOString();
  for (const it of items) {
    const id = recordId(it.platform, it.handle);
    cache[id] = {
      id,
      favoriteId: it.favoriteId,
      platform: it.platform,
      handle: it.handle,
      name: it.name,
      action: it.action,
      state: "requested",
      taskId,
      requestedAt: now,
      updatedAt: now,
    };
  }
  emit();
}

/** 演示环境：请求发出一段时间后回流部分「已建立」状态，形成闭环 */
export function simulateProgress(ids: string[], delayMs = 6000) {
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    let changed = false;
    ids.forEach((id, i) => {
      const rec = cache[id];
      if (!rec || rec.state !== "requested") return;
      if (i % 3 !== 0) return; // 约 1/3 通过
      cache[id] = {
        ...rec,
        state: rec.action === "friend" ? "accepted" : "following",
        updatedAt: new Date().toISOString(),
      };
      changed = true;
    });
    if (changed) emit();
  }, delayMs);
}

/** 批量写入 / 覆盖关系记录（用于演示数据初始化） */
export function upsertConnectRecords(records: ConnectRecord[]) {
  for (const rec of records) cache[rec.id] = rec;
  emit();
}

export function resetConnectRecords() {
  cache = {};
  emit();
}
