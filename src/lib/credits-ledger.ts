import { useSyncExternalStore } from "react";
import { ENTERPRISES } from "@/data/enterprises";

export type LedgerKind =
  | "view"
  | "reach"
  | "refund"
  | "recharge"
  | "ai_generate"
  | "social_account_purchase"
  | "social_add_friend"
  | "social_dm"
  | "feedback_reward";
export type ViewField =
  | "email"
  | "phone"
  | "social"
  | "address"
  | "title"
  | "seniority";
export type ReachChannel = "email" | "phone" | "social";
export type ReachStatus = "pending" | "in_progress" | "success" | "failed";
export type TargetKind = "enterprise" | "contact";

/** 按字段区分的查看单价（永久解锁,仅首次扣费） */
export const COST_VIEW_EMAIL = 10;
export const COST_VIEW_PHONE = 60;
export const COST_VIEW_SOCIAL = 30;
/** 其他字段（address/title/seniority）目前不消耗积分,保留常量兼容 */
export const COST_VIEW = 5;

export function costForView(field: ViewField): number {
  switch (field) {
    case "email":
      return COST_VIEW_EMAIL;
    case "phone":
      return COST_VIEW_PHONE;
    case "social":
      return COST_VIEW_SOCIAL;
    default:
      return COST_VIEW;
  }
}

export const COST_REACH = 10;

/** 单条发送积分单价（按渠道） */
export const COST_REACH_EMAIL = 10;
export const COST_REACH_SMS = 60;
export const COST_REACH_SOCIAL = 50;
/** 社媒各平台单价（覆盖 COST_REACH_SOCIAL 默认值） */
export const COST_REACH_SOCIAL_WHATSAPP = 100;

/** AI 文案生成积分单价 */
export const COST_AI_EMAIL = 3;
export const COST_AI_SMS = 2;
/** 社媒 AI 文案生成与翻译免费（不扣积分、不产生消费明细） */
export const COST_AI_SOCIAL = 0;

/** 社媒账号购买 & 触达单价（P0） */
export const COST_SOCIAL_ACCOUNT_PURCHASE = 1000; // 1 个账号
export const COST_SOCIAL_ADD_FRIEND = 50; // 每次成功发出加友请求
export const COST_SOCIAL_DM = 50; // 首条私信；同会话 24h 内追发免费

export function costForChannel(channel: ReachChannel, platform?: string): number {
  if (channel === "email") return COST_REACH_EMAIL;
  if (channel === "phone") return COST_REACH_SMS;
  return costForSocialPlatform(platform);
}

export function costForSocialPlatform(platform?: string): number {
  if (platform === "WhatsApp") return COST_REACH_SOCIAL_WHATSAPP;
  return COST_REACH_SOCIAL;
}

/* -------------------- reach auto-unlock cost breakdown -------------------- */

/** 触达时需要自动解锁的查看字段 */
export interface AutoUnlockField {
  field: ViewField;
  subKey?: string;
}

/** 费用明细行 */
export interface ReachCostLine {
  kind: "view" | "reach";
  label: string;
  cost: number;
  field?: ViewField;
  subKey?: string;
  /** view 行：是否已解锁（已解锁则 cost=0，仅作展示） */
  alreadyUnlocked?: boolean;
}

export interface ReachCostBreakdown {
  lines: ReachCostLine[];
  viewCost: number;
  reachCost: number;
  total: number;
  /** 尚未解锁、本次将自动扣费解锁的字段 */
  unlocksNeeded: AutoUnlockField[];
}

/**
 * 根据渠道/平台返回本次触达需要「使用到」的查看字段。
 * WhatsApp:
 *  - 默认账号 = 手机号 → 仅需解锁 phone
 *  - opts.whatsappAccountDistinct = true 表示 WhatsApp 账号是独立标识 → 需额外解锁 social:WhatsApp
 */
export function autoUnlockFieldsFor(
  channel: ReachChannel,
  platform?: string,
  opts: { whatsappAccountDistinct?: boolean } = {},
): AutoUnlockField[] {
  if (channel === "email") return [{ field: "email" }];
  if (channel === "phone") return [{ field: "phone" }];
  if (platform === "WhatsApp") {
    const arr: AutoUnlockField[] = [{ field: "phone" }];
    if (opts.whatsappAccountDistinct)
      arr.push({ field: "social", subKey: "WhatsApp" });
    return arr;
  }
  return [{ field: "social", subKey: platform }];
}

function viewLabelFor(f: AutoUnlockField): string {
  if (f.field === "social")
    return `查看${f.subKey ? f.subKey + " " : ""}社媒账号`;
  return `查看${VIEW_FIELD_LABEL[f.field].replace(/^联系/, "")}`;
}

function reachLabelFor(channel: ReachChannel, platform?: string): string {
  if (channel === "email") return "发送邮件";
  if (channel === "phone") return "发送短信";
  return `发送 ${platform ?? "社媒"} 私信`;
}

/**
 * 计算一次触达的完整费用明细（含自动解锁 + 触达）。
 * reachCostOverride 用于短信按段数扩展、社媒按调度实际条数等场景。
 */
export function computeReachBreakdown(
  target: { targetKind: TargetKind; targetId: string },
  channel: ReachChannel,
  platform: string | undefined,
  opts: {
    whatsappAccountDistinct?: boolean;
    reachCostOverride?: number;
  } = {},
): ReachCostBreakdown {
  const fields = autoUnlockFieldsFor(channel, platform, opts);
  const lines: ReachCostLine[] = [];
  const unlocksNeeded: AutoUnlockField[] = [];
  let viewCost = 0;
  for (const f of fields) {
    const key = revealKey(target.targetKind, target.targetId, f.field, f.subKey);
    const already = isUnlocked(key);
    const unit = costForView(f.field);
    lines.push({
      kind: "view",
      label: viewLabelFor(f),
      cost: already ? 0 : unit,
      field: f.field,
      subKey: f.subKey,
      alreadyUnlocked: already,
    });
    if (!already) {
      viewCost += unit;
      unlocksNeeded.push(f);
    }
  }
  const reachCost = opts.reachCostOverride ?? costForChannel(channel, platform);
  lines.push({
    kind: "reach",
    label: reachLabelFor(channel, platform),
    cost: reachCost,
  });
  return { lines, viewCost, reachCost, total: viewCost + reachCost, unlocksNeeded };
}

/**
 * 对本次触达所需字段执行自动解锁：仅对尚未解锁的字段 chargeView + markUnlocked。
 * 返回本次因自动解锁所扣的查看积分总额（0 表示全部已解锁）。
 */
export function performReachAutoUnlocks(input: {
  targetKind: TargetKind;
  targetId: string;
  targetName: string;
  parentRef?: { id: string; name: string };
  detail: string;
  fields: AutoUnlockField[];
}): number {
  let charged = 0;
  for (const f of input.fields) {
    const key = revealKey(input.targetKind, input.targetId, f.field, f.subKey);
    if (isUnlocked(key)) continue;
    chargeView({
      targetKind: input.targetKind,
      targetId: input.targetId,
      targetName: input.targetName,
      parentRef: input.parentRef,
      field: f.field,
      detail: input.detail,
    });
    markUnlocked(key);
    charged += costForView(f.field);
  }
  return charged;
}

export interface LedgerEntry {
  /** 用户在应用内实际产生的记录（非演示 seed） */
  userCreated?: boolean;
  id: string;
  kind: LedgerKind;
  cost: number;
  createdAt: string;
  targetKind: TargetKind;
  targetId: string; // enterprise: ent.id ; contact: `${ent.id}:${idx}`
  targetName: string;
  parentRef?: { id: string; name: string };
  // view-only
  field?: ViewField;
  // reach-only
  channel?: ReachChannel;
  platform?: string; // e.g. "LinkedIn"
  detail?: string; // masked or partial; e.g. email/phone/handle
  // reach-only: 发件邮箱（channel=email 时）
  senderEmail?: string;
  // reach-only: 邮件主题（email）/ 短信无主题
  subject?: string;
  // reach-only: 渲染后的最终正文/短信内容
  content?: string;
  // reach-only: 是否使用 AI 生成
  aiGenerated?: boolean;
  // demo / override: when set, getReachStatus returns this value directly
  forcedStatus?: ReachStatus;
  // reach-only: 因当日账号额度不足而顺延执行的时间（ISO），到点前恒为「待触达」
  scheduledAt?: string;
  // reach-only: populated when status is failed
  failReason?: string;
  // refund-only: id of the related reach entry being refunded
  relatedReachId?: string;
  // recharge-only
  orderNo?: string;
  paymentMethod?: "wechat" | "alipay" | "corp";
  bonus?: number;
  price?: number;
}

const LEDGER_KEY = "boo:ledger:v2";
const LEDGER_SEED_VERSION = "v22";
const LEDGER_SEED_FLAG = `boo:ledger:${LEDGER_SEED_VERSION}:seeded`;
const REVEAL_KEY = "boo:reveal:v1";
const UNLOCK_KEY = "boo:unlocked:v1";

/* -------------------- ledger store -------------------- */

function readLedger(): LedgerEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEDGER_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr;
  } catch {}
  return [];
}

function writeLedger(arr: LedgerEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LEDGER_KEY, JSON.stringify(arr));
  } catch {}
}

let ledger: LedgerEntry[] = readLedger();
let ledgerVersion = 0;
const ledgerListeners = new Set<() => void>();

function emitLedger() {
  ledgerVersion++;
  ledgerListeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === LEDGER_KEY) {
      ledger = readLedger();
      emitLedger();
    }
  });
}

function subscribeLedger(cb: () => void) {
  ledgerListeners.add(cb);
  return () => ledgerListeners.delete(cb);
}

function getLedgerVersion() {
  return ledgerVersion;
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function chargeView(input: {
  targetKind: TargetKind;
  targetId: string;
  targetName: string;
  parentRef?: { id: string; name: string };
  field: ViewField;
  detail?: string;
}): LedgerEntry {
  const entry: LedgerEntry = {
    id: makeId("v"),
    kind: "view",
    cost: costForView(input.field),
    createdAt: new Date().toISOString(),
    ...input,
  };
  ledger = [entry, ...ledger];
  writeLedger(ledger);
  emitLedger();
  return entry;
}

export function createReach(input: {
  targetKind: TargetKind;
  targetId: string;
  targetName: string;
  parentRef?: { id: string; name: string };
  channel: ReachChannel;
  platform?: string;
  detail: string;
  senderEmail?: string;
  subject?: string;
  content?: string;
  aiGenerated?: boolean;
  cost?: number;
  /** 顺延执行时间（ISO）：额度不足时排队到次日 */
  scheduledAt?: string;
  userCreated?: boolean;
}): LedgerEntry {
  const { cost, ...rest } = input;
  const entry: LedgerEntry = {
    id: makeId("r"),
    kind: "reach",
    cost: cost ?? costForChannel(input.channel, input.platform),
    createdAt: new Date().toISOString(),
    ...rest,
  };
  ledger = [entry, ...ledger];
  writeLedger(ledger);
  emitLedger();
  // 成功发起触达 → 对应联系方式字段自动永久解锁,后续查看不再扣 5 积分
  try {
    const field: ViewField | null =
      input.channel === "email"
        ? "email"
        : input.channel === "phone"
          ? "phone"
          : input.platform === "WhatsApp"
            ? "phone"
            : "social";
    const sub =
      input.channel === "social" && input.platform !== "WhatsApp"
        ? input.platform
        : undefined;
    if (field) {
      markUnlocked(revealKey(input.targetKind, input.targetId, field, sub));
    }
  } catch {}
  return entry;
}

/** AI 文案生成扣费 */
export function chargeAiGeneration(input: {
  channel: ReachChannel;
  targetName: string;
  targetKind?: TargetKind;
  targetId?: string;
  platform?: string;
  detailSuffix?: string;
}): LedgerEntry {
  const cost =
    input.channel === "email"
      ? COST_AI_EMAIL
      : input.channel === "social"
        ? COST_AI_SOCIAL
        : COST_AI_SMS;
  const label =
    input.channel === "email"
      ? "AI 生成邮件文案"
      : input.channel === "social"
        ? `AI 生成${input.platform ? `${input.platform} ` : ""}社媒文案`
        : "AI 生成短信文案";
  const entry: LedgerEntry = {
    id: makeId("ai"),
    kind: "ai_generate",
    cost,
    createdAt: new Date().toISOString(),
    targetKind: input.targetKind ?? "enterprise",
    targetId: input.targetId ?? "—",
    targetName: input.targetName,
    channel: input.channel,
    platform: input.platform,
    detail: input.detailSuffix ? `${label} · ${input.detailSuffix}` : label,
  };

  // 免费项（如社媒 AI 生成/翻译）不写入消费明细
  if (cost <= 0) return entry;
  ledger = [entry, ...ledger];
  writeLedger(ledger);
  emitLedger();
  return entry;
}

/** 购买社媒账号：一次性扣费 N × 1000 */
export function chargeSocialAccountPurchase(input: {
  platform: "Facebook" | "TikTok";
  quantity: number;
}): LedgerEntry {
  const entry: LedgerEntry = {
    id: makeId("sap"),
    kind: "social_account_purchase",
    cost: COST_SOCIAL_ACCOUNT_PURCHASE * input.quantity,
    createdAt: new Date().toISOString(),
    targetKind: "enterprise",
    targetId: "—",
    targetName: `社媒账号购买 · ${input.platform}`,
    platform: input.platform,
    channel: "social",
    detail: `${input.platform} × ${input.quantity}（1000 积分/账号）`,
  };
  ledger = [entry, ...ledger];
  writeLedger(ledger);
  emitLedger();
  return entry;
}

/** 社媒加友请求成功发出 */
export function chargeSocialAddFriend(input: {
  platform: "Facebook" | "TikTok";
  targetName: string;
  detail?: string;
  taskId?: string;
  /** 演示数据可指定发生时间 */
  createdAt?: string;
  targetKind?: TargetKind;
  targetId?: string;
  parentRef?: { id: string; name: string };
}): LedgerEntry {
  const entry: LedgerEntry = {
    id: makeId("saf"),
    kind: "social_add_friend",
    cost: COST_SOCIAL_ADD_FRIEND,
    createdAt: input.createdAt ?? new Date().toISOString(),
    targetKind: input.targetKind ?? "contact",
    targetId: input.targetId ?? input.taskId ?? "—",
    targetName: input.targetName,
    parentRef: input.parentRef,
    platform: input.platform,
    channel: "social",
    detail: input.detail ?? `${input.platform} 加友请求`,
  };

  ledger = [entry, ...ledger];
  writeLedger(ledger);
  emitLedger();
  return entry;
}

/** 社媒私信首发 */
export function chargeSocialDm(input: {
  platform: "Facebook" | "TikTok";
  targetName: string;
  detail?: string;
  taskId?: string;
}): LedgerEntry {
  const entry: LedgerEntry = {
    id: makeId("sdm"),
    kind: "social_dm",
    cost: COST_SOCIAL_DM,
    createdAt: new Date().toISOString(),
    targetKind: "contact",
    targetId: input.taskId ?? "—",
    targetName: input.targetName,
    platform: input.platform,
    channel: "social",
    detail: input.detail ?? `${input.platform} 私信首发`,
  };
  ledger = [entry, ...ledger];
  writeLedger(ledger);
  emitLedger();
  return entry;
}

/**
 * 「新建触达任务」批量落库：按目标数量上限生成 N 条社媒触达记录（渠道=社媒，状态=待触达），
 * 展示在「触达任务」列表中。每条 50 积分，与弹窗内的发送费用一致。
 */
export function createSocialReachBatch(input: {
  taskName: string;
  platform: "Facebook" | "TikTok";
  region: string;
  keywords: string[];
  count: number;
  content: string;
  aiGenerated?: boolean;
  action?: "加好友" | "私信" | "关注";
}): LedgerEntry[] {
  const action = input.action ?? "私信";
  const slug = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 12) || "lead";
  const now = Date.now();
  const entries: LedgerEntry[] = [];
  for (let i = 0; i < input.count; i++) {
    const kw = input.keywords[i % Math.max(1, input.keywords.length)] ?? "lead";
    const handle = `@${input.platform.toLowerCase()}_${slug(kw)}_${String(i + 1).padStart(2, "0")}`;
    entries.push({
      id: makeId("r"),
      kind: "reach",
      cost: COST_REACH_SOCIAL,
      createdAt: new Date(now - i * 1000).toISOString(),
      targetKind: "enterprise",
      targetId: "—",
      targetName: `${input.platform}平台${action}`,
      channel: "social",
      platform: input.platform,
      detail: `${input.platform}平台${action} · ${handle}`,
      subject: input.taskName,
      content: input.content,
      aiGenerated: input.aiGenerated ?? false,
      forcedStatus: "pending",
      userCreated: true,
    });
  }
  ledger = [...entries, ...ledger];
  writeLedger(ledger);
  emitLedger();
  return entries;
}

/**
 * 历史遗留：曾用于给演示触达记录补齐 AI 生成消费明细。
 * 现按产品要求：消费明细不展示「AI 文案生成」记录，故该补齐逻辑停用（保留函数签名以兼容调用方）。
 * 用户在应用内实时使用 AI 生成的扣费在调用处实时写入，不经过此函数。
 */
export function backfillAiGenerationEntries(): number {
  return 0;
}




export function recordRecharge(input: {
  orderNo: string;
  packageLabel: string;
  credits: number;
  bonus: number;
  price: number;
  paymentMethod: "wechat" | "alipay" | "corp";
}): LedgerEntry {
  const entry: LedgerEntry = {
    id: makeId("rc"),
    kind: "recharge",
    // cost 字段统一为正数表示「积分变动绝对值」，UI 根据 kind 决定 +/-
    cost: input.credits + input.bonus,
    createdAt: new Date().toISOString(),
    targetKind: "enterprise",
    targetId: "—",
    targetName: `${input.packageLabel}套餐`,
    orderNo: input.orderNo,
    paymentMethod: input.paymentMethod,
    bonus: input.bonus,
    price: input.price,
    detail: `订单 ${input.orderNo} · ¥${input.price}${
      input.bonus > 0 ? ` · 赠 ${input.bonus} 积分` : ""
    }`,
  };
  ledger = [entry, ...ledger];
  writeLedger(ledger);
  emitLedger();
  return entry;
}

/** 数据反馈采纳奖励（收入类流水） */
export function recordFeedbackReward(input: {
  ticketId: string;
  enterpriseId: string;
  enterpriseName: string;
  credits: number;
  note?: string;
}): LedgerEntry {
  const entry: LedgerEntry = {
    id: makeId("fb"),
    kind: "feedback_reward",
    cost: input.credits,
    createdAt: new Date().toISOString(),
    targetKind: "enterprise",
    targetId: input.enterpriseId,
    targetName: input.enterpriseName,
    userCreated: true,
    detail: `数据反馈奖励 · 工单 ${input.ticketId}${input.note ? ` · ${input.note}` : ""}`,
  };
  ledger = [entry, ...ledger];
  writeLedger(ledger);
  emitLedger();
  return entry;
}

/** 是否已存在该工单的反馈奖励流水 */
export function hasFeedbackReward(ticketId: string): boolean {
  return ledger.some((e) => e.kind === "feedback_reward" && e.detail?.includes(ticketId));
}

/** 修正指定工单的数据反馈奖励金额（演示数据校正用） */
export function fixFeedbackRewardAmount(ticketId: string, credits: number) {
  let changed = false;
  const next = ledger.map((e) => {
    if (e.kind === "feedback_reward" && e.detail?.includes(ticketId) && e.cost !== credits) {
      changed = true;
      return { ...e, cost: credits };
    }
    return e;
  });
  if (!changed) return;
  ledger = next;
  writeLedger(ledger);
  emitLedger();
}

export function useLedger(): LedgerEntry[] {
  useSyncExternalStore(subscribeLedger, getLedgerVersion, getLedgerVersion);
  return ledger;
}

export function getAllLedger(): LedgerEntry[] {
  return ledger;
}

/* -------------------- reach status -------------------- */

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function getReachStatus(r: LedgerEntry, now = Date.now()): ReachStatus {
  if (r.kind !== "reach") return "success";
  if (r.forcedStatus) return r.forcedStatus;
  // 顺延执行：未到计划时间前恒为「待触达」
  if (r.scheduledAt && new Date(r.scheduledAt).getTime() > now) return "pending";
  const t = new Date(r.scheduledAt ?? r.createdAt).getTime();
  const elapsedSec = (now - t) / 1000;
  if (elapsedSec < 30) return "pending";
  if (elapsedSec < 180) return "in_progress";
  // terminal — deterministic by id, ~85% success
  return hashStr(r.id) % 100 < 85 ? "success" : "failed";
}

export const REACH_STATUS_LABEL: Record<ReachStatus, string> = {
  pending: "待触达",
  in_progress: "触达中",
  success: "触达成功",
  failed: "触达失败",
};

export const REACH_STATUS_COLOR: Record<ReachStatus, string> = {
  pending: "bg-slate-100 text-slate-700 border-slate-200",
  in_progress: "bg-amber-100 text-amber-700 border-amber-200",
  success: "bg-emerald-100 text-emerald-700 border-emerald-200",
  failed: "bg-rose-100 text-rose-700 border-rose-200",
};

export const REACH_CHANNEL_LABEL: Record<ReachChannel, string> = {
  email: "邮件",
  phone: "短信",
  social: "社媒",
};

/* -------------------- fail reasons -------------------- */

export const FAIL_REASONS: Record<ReachChannel, string[]> = {
  email: ["邮箱无效（地址不存在）", "对方邮件服务器退信", "对方拒收 / 标记为垃圾邮件"],
  phone: ["对方手机关机或无信号", "多次拨打无人接听", "对方主动拒接"],
  social: ["账号已失效或停用", "私信发送后长期无响应", "消息被平台拦截"],
};

/**
 * 永久性失败原因：联系方式本身存在问题或对方明确拒绝，重新触达基本无意义。
 * 其余原因视为临时性失败，允许重新触达。
 */
const NON_RETRYABLE_FAIL_REASONS: ReadonlySet<string> = new Set([
  "邮箱无效（地址不存在）",
  "对方拒收 / 标记为垃圾邮件",
  "对方主动拒接",
  "账号已失效或停用",
  "消息被平台拦截",
]);

export function isRetryableFailReason(reason?: string): boolean {
  if (!reason) return true;
  return !NON_RETRYABLE_FAIL_REASONS.has(reason);
}

function pickFailReason(channel: ReachChannel | undefined, seed: string): string {
  const ch: ReachChannel = channel ?? "email";
  const list = FAIL_REASONS[ch];
  return list[hashStr(seed) % list.length];
}

function persistLedger() {
  writeLedger(ledger);
  emitLedger();
}

export const VIEW_FIELD_LABEL: Record<ViewField, string> = {
  email: "联系邮箱",
  phone: "联系电话",
  social: "社媒账号",
  address: "详细地址",
  title: "职位信息",
  seniority: "职级信息",
};

/* -------------------- refunds for failed reaches -------------------- */

/**
 * Scan all reach entries: if a reach is currently `failed` and no refund
 * record exists yet for it, append a refund entry that returns COST_REACH.
 * Idempotent — safe to call on a timer.
 */
export function syncFailedRefunds(now = Date.now()): number {
  if (typeof window === "undefined") return 0;
  const refundedIds = new Set(
    ledger
      .filter((e) => e.kind === "refund" && e.relatedReachId)
      .map((e) => e.relatedReachId as string),
  );
  const newRefunds: LedgerEntry[] = [];
  let reasonsChanged = false;
  for (const r of ledger) {
    if (r.kind !== "reach") continue;
    if (getReachStatus(r, now) !== "failed") continue;
    // backfill fail reason on any failed reach lacking one
    if (!r.failReason) {
      r.failReason = pickFailReason(r.channel, r.id);
      reasonsChanged = true;
    }
    if (refundedIds.has(r.id)) continue;
    newRefunds.push({
      id: makeId("rf"),
      kind: "refund",
      cost: r.cost,
      // refund is recorded slightly after the failed reach time
      createdAt: new Date(
        new Date(r.createdAt).getTime() + 1000,
      ).toISOString(),
      targetKind: r.targetKind,
      targetId: r.targetId,
      targetName: r.targetName,
      parentRef: r.parentRef,
      channel: r.channel,
      platform: r.platform,
      detail: r.detail,
      relatedReachId: r.id,
    });
  }
  if (newRefunds.length === 0 && !reasonsChanged) return 0;
  if (newRefunds.length > 0) ledger = [...newRefunds, ...ledger];
  persistLedger();
  return newRefunds.length;
}

/* -------------------- reach actions -------------------- */

/**
 * Immediately advance a pending reach to in_progress.
 * Clears any forcedStatus override and resets createdAt to now so the
 * natural status timeline (in_progress -> success/failed) takes effect.
 */
export function triggerReachNow(reachId: string): boolean {
  const idx = ledger.findIndex((e) => e.id === reachId && e.kind === "reach");
  if (idx < 0) return false;
  const r = ledger[idx];
  const status = getReachStatus(r);
  if (status !== "pending") return false;
  const updated: LedgerEntry = {
    ...r,
    // Backdate so getReachStatus() returns in_progress (30s..180s window)
    createdAt: new Date(Date.now() - 31_000).toISOString(),
    forcedStatus: undefined,
  };
  ledger = [...ledger.slice(0, idx), updated, ...ledger.slice(idx + 1)];
  persistLedger();
  return true;
}

/**
 * Cancel a pending reach and refund its cost. Removes the reach entry
 * and appends a refund record so the credit balance reconciles.
 */
export function cancelPendingReach(reachId: string): boolean {
  const r = ledger.find((e) => e.id === reachId && e.kind === "reach");
  if (!r) return false;
  if (getReachStatus(r) !== "pending") return false;
  const refund: LedgerEntry = {
    id: makeId("rf"),
    kind: "refund",
    cost: r.cost,
    createdAt: new Date().toISOString(),
    targetKind: r.targetKind,
    targetId: r.targetId,
    targetName: r.targetName,
    parentRef: r.parentRef,
    channel: r.channel,
    platform: r.platform,
    detail: r.detail,
    relatedReachId: r.id,
  };
  ledger = [refund, ...ledger.filter((e) => e.id !== reachId)];
  persistLedger();
  return true;
}

/**
 * Retry a failed reach by creating a fresh pending reach entry that
 * targets the same contact/enterprise via the same channel. Charges
 * COST_REACH again (the original failure was already refunded).
 */
export function retryFailedReach(reachId: string): LedgerEntry | null {
  const r = ledger.find((e) => e.id === reachId && e.kind === "reach");
  if (!r) return null;
  if (getReachStatus(r) !== "failed") return null;
  const fresh: LedgerEntry = {
    id: makeId("r"),
    kind: "reach",
    cost: r.channel ? costForChannel(r.channel, r.platform) : r.cost,
    createdAt: new Date().toISOString(),
    targetKind: r.targetKind,
    targetId: r.targetId,
    targetName: r.targetName,
    parentRef: r.parentRef,
    channel: r.channel,
    platform: r.platform,
    detail: r.detail,
  };
  ledger = [fresh, ...ledger];
  persistLedger();
  return fresh;
}

/** True if a refund record already exists for the given reach entry id. */
export function isReachRefunded(reachId: string): boolean {
  return ledger.some(
    (e) => e.kind === "refund" && e.relatedReachId === reachId,
  );
}

/* -------------------- reveal cache (session) -------------------- */

function readReveal(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(REVEAL_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set(arr as string[]);
  } catch {}
  return new Set();
}

function writeReveal(s: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(REVEAL_KEY, JSON.stringify([...s]));
  } catch {}
}

let revealSet: Set<string> = readReveal();
let revealVersion = 0;
const revealListeners = new Set<() => void>();

function emitReveal() {
  revealVersion++;
  revealListeners.forEach((l) => l());
}

function subscribeReveal(cb: () => void) {
  revealListeners.add(cb);
  return () => revealListeners.delete(cb);
}

function getRevealVersion() {
  return revealVersion;
}

export function revealKey(
  targetKind: TargetKind,
  targetId: string,
  field: ViewField,
  subKey?: string,
) {
  return `${targetKind}:${targetId}:${field}${subKey ? `:${subKey}` : ""}`;
}

export function isRevealed(key: string): boolean {
  return revealSet.has(key);
}

export function setRevealed(key: string, value: boolean) {
  const next = new Set(revealSet);
  if (value) next.add(key);
  else next.delete(key);
  revealSet = next;
  writeReveal(revealSet);
  emitReveal();
}

export function useRevealed(key: string): boolean {
  useSyncExternalStore(subscribeReveal, getRevealVersion, getRevealVersion);
  return revealSet.has(key);
}

/* -------------------- unlock cache (permanent) -------------------- */
/**
 * 已永久解锁的字段集合(localStorage)。一旦解锁,后续查看不再消耗积分,
 * 且跨会话保持。与 reveal(session) 的"展开/收起"UI 状态相互独立。
 */
function readUnlock(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(UNLOCK_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set(arr as string[]);
  } catch {}
  return new Set();
}

function writeUnlock(s: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(UNLOCK_KEY, JSON.stringify([...s]));
  } catch {}
}

let unlockSet: Set<string> = readUnlock();
let unlockVersion = 0;
const unlockListeners = new Set<() => void>();

function emitUnlock() {
  unlockVersion++;
  unlockListeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === UNLOCK_KEY) {
      unlockSet = readUnlock();
      emitUnlock();
    }
  });
}

function subscribeUnlock(cb: () => void) {
  unlockListeners.add(cb);
  return () => unlockListeners.delete(cb);
}

function getUnlockVersion() {
  return unlockVersion;
}

export function isUnlocked(key: string): boolean {
  return unlockSet.has(key);
}

export function markUnlocked(key: string) {
  if (unlockSet.has(key)) return;
  const next = new Set(unlockSet);
  next.add(key);
  unlockSet = next;
  writeUnlock(unlockSet);
  emitUnlock();
}

export function useUnlocked(key: string): boolean {
  useSyncExternalStore(subscribeUnlock, getUnlockVersion, getUnlockVersion);
  return unlockSet.has(key);
}

/**
 * 根据账单中已有的 view 记录同步 unlock 集合,保证 mock/历史数据也自动解锁。
 * 幂等,可重复调用。
 */
export function syncUnlocksFromLedger(): number {
  let added = 0;
  const next = new Set(unlockSet);
  for (const e of ledger) {
    if (e.kind !== "view" || !e.field) continue;
    const sub = e.field === "social" ? e.platform : undefined;
    const k = revealKey(e.targetKind, e.targetId, e.field, sub);
    if (!next.has(k)) {
      next.add(k);
      added++;
    }
  }
  if (added > 0) {
    unlockSet = next;
    writeUnlock(unlockSet);
    emitUnlock();
  }
  return added;
}

/* -------------------- masking helpers -------------------- */

export function maskEmail(email: string) {
  if (!email) return "—";
  const at = email.indexOf("@");
  if (at <= 0) return `${email[0] ?? ""}***`;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `${local[0]}***@${domain}`;
}

export function maskPhone(phone: string) {
  if (!phone) return "—";
  const digits = phone.replace(/[^+\d]/g, "");
  if (digits.length <= 5) return "***";
  const head = digits.slice(0, 3);
  const tail = digits.slice(-2);
  return `${head}****${tail}`;
}

export function maskHandle(handle: string) {
  if (!handle || handle === "—") return handle;
  const h = handle.replace(/^@/, "");
  const prefix = handle.startsWith("@") ? "@" : "";
  if (h.length <= 4) return `${prefix}${h[0] ?? ""}***`;
  return `${prefix}${h.slice(0, 2)}****${h.slice(-2)}`;
}

export function maskAddress(_address: string) {
  return "*** *** *** *** ***";
}

export function maskTitle(_title: string) {
  return "•••• ••••••";
}

export function maskSeniority(_seniority: string) {
  return "•••";
}

export function maskUrl(url: string) {
  if (!url) return "";
  const parts = url.split("/");
  if (parts.length < 2) return "***";
  const last = parts[parts.length - 1];
  parts[parts.length - 1] = maskHandle(last);
  return parts.join("/");
}

/* -------------------- seeding -------------------- */

function isoMinutesAgo(min: number) {
  return new Date(Date.now() - min * 60_000).toISOString();
}

function unlockableSeedDateKeys(arr: LedgerEntry[]): Set<string> {
  const dates = new Set<string>();
  for (const e of arr) {
    if (e.kind === "reach") {
      dates.add(e.createdAt.slice(0, 10));
      continue;
    }
    if (
      e.kind === "view" &&
      (e.field === "email" || e.field === "phone" || e.field === "social")
    ) {
      dates.add(e.createdAt.slice(0, 10));
    }
  }
  return dates;
}

function clearLegacyLedgerSeedFlags() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (/^boo:ledger:v\d+:seeded$/.test(key) && key !== LEDGER_SEED_FLAG) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {}
}

function hasLegacyLedgerSeedFlag() {
  if (typeof window === "undefined") return false;
  try {
    return Object.keys(window.localStorage).some(
      (key) => /^boo:ledger:v\d+:seeded$/.test(key) && key !== LEDGER_SEED_FLAG,
    );
  } catch {
    return false;
  }
}

export function seedDemoLedgerIfEmpty() {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(LEDGER_SEED_FLAG)) return;
    const existingLedger = readLedger();
    const legacySeeded = hasLegacyLedgerSeedFlag();
    const dateKeys = unlockableSeedDateKeys(existingLedger);
    // 用户自己创建的记录（如新建触达任务）不算历史 seed，不能被清掉
    const hasUserCreated = existingLedger.some((e) => e.userCreated);
    const staleSingleDaySeed =
      !hasUserCreated && existingLedger.length >= 20 && dateKeys.size <= 1;
    // 天为单位的分钟数,用于将 seed 数据按日打散到最近两周,
    // 避免所有解锁/触达记录都堆到今天,更贴近真实使用节奏。
    const D = 1440;
    const H = 60;
    // 所有 seed 数据均基于真实企业，避免出现"未找到该企业"
    const E = ENTERPRISES;
    const pickEnt = (i: number) => E[i % E.length];
    const reachEnt = (
      i: number,
      channel: ReachChannel,
      minAgo: number,
      status: ReachStatus,
      failReason?: string,
      platform?: string,
    ): LedgerEntry => {
      const e = pickEnt(i);
      const detail =
        channel === "email"
          ? e.email
          : channel === "phone"
            ? maskPhone(e.phone)
            : platform === "WhatsApp"
              ? maskPhone(e.phone)
              : `linkedin.com/company/${e.name.toLowerCase().replace(/[^a-z]/g, "")}`;
      const extra: Partial<LedgerEntry> =
        channel === "email"
          ? {
              senderEmail: i % 2 === 0 ? "sales@boo-demo.com" : "bd@boo-demo.com",
              subject: `${e.name} · 出海合作邀约`,
              content: `${e.name} 团队您好,\n\n我们关注到贵司在 ${e.industry} 领域的表现,希望就跨境采购 / 供应链合作与贵司做一次简短沟通。\n\n方便的话,期待回复约定 15 分钟线上交流。\n\nBoo 团队`,
              aiGenerated: i % 3 === 0,
            }
          : channel === "phone"
            ? {
                content: `【Boo】您好,我们是 Boo 出海平台,希望就 ${e.name} 的采购 / 供应合作做简短沟通,方便时请回拨此号码或回复 1。`,
                aiGenerated: i % 2 === 1,
              }
            : channel === "social"
              ? {
                  content:
                    platform === "WhatsApp"
                      ? `Hi ${e.name} team, this is Boo — we noticed your work in ${e.industry} and would love a quick 10-min chat about cross-border sourcing opportunities. Reply here anytime.`
                      : `Hi ${e.name} team,\n\nSaw your recent updates in ${e.industry}. We're helping global buyers connect with vendors like you — would you be open to a brief intro call this week?\n\n— Boo team`,
                  aiGenerated: i % 2 === 0,
                }
              : {};
      return {
        id: makeId("r"),
        kind: "reach",
        cost:
          channel === "social"
            ? costForSocialPlatform(platform)
            : costForChannel(channel, platform),
        createdAt: isoMinutesAgo(minAgo),
        targetKind: "enterprise",
        targetId: e.id,
        targetName: e.name,
        channel,
        platform: channel === "social" ? (platform ?? "LinkedIn") : undefined,
        detail,
        forcedStatus: status,
        ...extra,
        ...(failReason ? { failReason } : {}),
      };
    };
    const reachContact = (
      i: number,
      k: number,
      channel: ReachChannel,
      minAgo: number,
      status: ReachStatus,
      failReason?: string,
      platform?: string,
    ): LedgerEntry => {
      const e = pickEnt(i);
      const idx = k % e.contacts.length;
      const c = e.contacts[idx];
      const detail =
        channel === "email"
          ? c.email
          : channel === "phone"
            ? maskPhone(c.phone ?? e.phone)
            : platform === "WhatsApp"
              ? maskPhone(c.phone ?? e.phone)
              : `linkedin.com/in/${c.name.replace(/\s+/g, "-")}`;
      const extra: Partial<LedgerEntry> =
        channel === "email"
          ? {
              senderEmail: k % 2 === 0 ? "bd@boo-demo.com" : "sales@boo-demo.com",
              subject: `Hi ${c.name}, 关于 ${e.name} 的一次合作探讨`,
              content: `Hi ${c.name},\n\n看到您在 ${e.name} 担任${c.title ?? "相关负责人"},我们近期有一批适配贵司业务的方案,希望预约 15 分钟做简短交流。\n\n如方便请回复邮件约定时间。\n\nThanks,\nBoo 团队`,
              aiGenerated: (i + k) % 2 === 0,
            }
          : channel === "phone"
            ? {
                content: `【Boo】${c.name} 您好,我们针对 ${e.name} 的业务方向准备了一份简报,方便时请回拨此号码或回复 1。`,
                aiGenerated: (i + k) % 2 === 1,
              }
            : channel === "social"
              ? {
                  content:
                    platform === "WhatsApp"
                      ? `Hi ${c.name}, this is Boo — I came across your profile at ${e.name}. Would love to share a short brief tailored to your team, mind if I send it over?`
                      : `Hi ${c.name},\n\nSaw you lead ${c.title ?? "the team"} at ${e.name}. We've been supporting similar teams on cross-border partnerships and I'd love to share a short brief — open to a quick chat?\n\n— Boo team`,
                  aiGenerated: (i + k) % 2 === 0,
                }
              : {};
      return {
        id: makeId("r"),
        kind: "reach",
        cost:
          channel === "social"
            ? costForSocialPlatform(platform)
            : costForChannel(channel, platform),
        createdAt: isoMinutesAgo(minAgo),
        targetKind: "contact",
        targetId: `${e.id}:${idx}`,
        targetName: c.name,
        parentRef: { id: e.id, name: e.name },
        channel,
        platform: channel === "social" ? (platform ?? "LinkedIn") : undefined,
        detail,
        forcedStatus: status,
        ...extra,
        ...(failReason ? { failReason } : {}),
      };
    };
    const viewEnt = (
      i: number,
      field: ViewField,
      minAgo: number,
      detail: string,
    ): LedgerEntry => {
      const e = pickEnt(i);
      return {
        id: makeId("v"),
        kind: "view",
        cost: costForView(field),
        createdAt: isoMinutesAgo(minAgo),
        targetKind: "enterprise",
        targetId: e.id,
        targetName: e.name,
        field,
        detail,
      };
    };
    const viewContact = (
      i: number,
      k: number,
      field: ViewField,
      minAgo: number,
      detail: string,
    ): LedgerEntry => {
      const e = pickEnt(i);
      const idx = k % e.contacts.length;
      const c = e.contacts[idx];
      return {
        id: makeId("v"),
        kind: "view",
        cost: costForView(field),
        createdAt: isoMinutesAgo(minAgo),
        targetKind: "contact",
        targetId: `${e.id}:${idx}`,
        targetName: c.name,
        parentRef: { id: e.id, name: e.name },
        field,
        detail,
      };
    };
    const seed: LedgerEntry[] = [
      // ---- 富文本触达记录(含主题/正文/发件人,覆盖企业&联系人 × 邮件&短信)----
      (() => {
        const e = pickEnt(2);
        return {
          id: makeId("r"),
          kind: "reach",
          cost: COST_REACH_EMAIL,
          createdAt: isoMinutesAgo(45),
          targetKind: "enterprise" as TargetKind,
          targetId: e.id,
          targetName: e.name,
          channel: "email" as ReachChannel,
          detail: e.email,
          senderEmail: "sales@boo-demo.com",
          subject: `关于与 ${e.name} 的供应合作机会`,
          content: `${e.name} 团队您好,\n\n我们关注到贵司在 ${e.industry} 领域的业务表现,希望就潜在的供应链合作进行初步沟通。期待回复。\n\n顺祝商祺`,
          aiGenerated: false,
          forcedStatus: "success" as ReachStatus,
        };
      })(),
      (() => {
        const e = pickEnt(5);
        return {
          id: makeId("r"),
          kind: "reach",
          cost: COST_REACH_SMS,
          createdAt: isoMinutesAgo(1 * D + 33),
          targetKind: "enterprise" as TargetKind,
          targetId: e.id,
          targetName: e.name,
          channel: "phone" as ReachChannel,
          detail: maskPhone(e.phone),
          content: `【Boo】您好,我们是 Boo 出海平台,希望与 ${e.name} 就采购合作做简短沟通,方便时回拨此号码。`,
          aiGenerated: true,
          forcedStatus: "success" as ReachStatus,
        };
      })(),
      (() => {
        const e = pickEnt(8);
        const idx = 0;
        const c = e.contacts[idx];
        return {
          id: makeId("r"),
          kind: "reach",
          cost: COST_REACH_EMAIL,
          createdAt: isoMinutesAgo(2 * D + 22),
          targetKind: "contact" as TargetKind,
          targetId: `${e.id}:${idx}`,
          targetName: c.name,
          parentRef: { id: e.id, name: e.name },
          channel: "email" as ReachChannel,
          detail: c.email,
          senderEmail: "bd@boo-demo.com",
          subject: `Hi ${c.name}, 一次关于 ${e.name} 的合作探讨`,
          content: `Hi ${c.name},\n\n看到您在 ${e.name} 担任${c.title},我们近期有一批适配贵司业务的方案,想与您预约 15 分钟做简短交流。\n\nThanks,\nBoo 团队`,
          aiGenerated: true,
          forcedStatus: "success" as ReachStatus,
        };
      })(),
      (() => {
        const e = pickEnt(15);
        const idx = e.contacts.length > 1 ? 1 : 0;
        const c = e.contacts[idx];
        return {
          id: makeId("r"),
          kind: "reach",
          cost: COST_REACH_SMS,
          createdAt: isoMinutesAgo(12),
          targetKind: "contact" as TargetKind,
          targetId: `${e.id}:${idx}`,
          targetName: c.name,
          parentRef: { id: e.id, name: e.name },
          channel: "phone" as ReachChannel,
          detail: maskPhone(c.phone ?? e.phone),
          content: `【Boo】${c.name} 您好,我们针对 ${e.name} 的业务方向准备了一份简报,如方便请回拨此号码或回复 1。`,
          aiGenerated: false,
          forcedStatus: "in_progress" as ReachStatus,
        };
      })(),
      (() => {
        const e = pickEnt(19);
        return {
          id: makeId("r"),
          kind: "reach",
          cost: COST_REACH_EMAIL,
          createdAt: isoMinutesAgo(3 * D + 150),
          targetKind: "enterprise" as TargetKind,
          targetId: e.id,
          targetName: e.name,
          channel: "email" as ReachChannel,
          detail: e.email,
          senderEmail: "sales@boo-demo.com",
          subject: `${e.name} - 出海合作邀约`,
          content: `您好,\n\n我们希望与 ${e.name} 就跨境业务展开合作,详细资料见附件。\n\nBoo 团队`,
          aiGenerated: false,
          forcedStatus: "failed" as ReachStatus,
          failReason: "对方邮件服务器退信",
        };
      })(),
      // ---- reach 终态 / 进行中 / 待触达 ----
      reachEnt(0, "email", 5 * D + 60, "success"),
      reachContact(4, 1, "phone", 4 * D + 20, "success"),
      reachEnt(11, "social", 5, "in_progress"),
      reachContact(23, 0, "email", 2, "in_progress"),
      reachEnt(7, "phone", 0.2, "pending"),
      // ---- 触达失败 ----
      reachEnt(14, "email", 6 * D + 180, "failed", "邮箱无效（地址不存在）"),
      reachContact(10, 0, "social", 7 * D + 95, "failed", "私信发送后长期无响应"),
      // ---- WhatsApp 触达 mock（100 积分/条）----
      reachContact(2, 0, "social", 2 * D + 12, "success", undefined, "WhatsApp"),
      reachEnt(5, "social", 1 * D + 40, "in_progress", undefined, "WhatsApp"),
      reachContact(9, 0, "social", 3 * D + 75, "pending", undefined, "WhatsApp"),
      reachContact(15, 1, "social", 8 * D + 210, "failed", "对方未注册 WhatsApp", "WhatsApp"),
      reachEnt(19, "social", 0.3, "pending", undefined, "WhatsApp"),
      // ---- 更多待触达 ----
      reachContact(0, 0, "email", 0.1, "pending"),
      reachEnt(18, "email", 0.05, "pending"),
      reachContact(21, 1, "phone", 0.08, "pending"),
      reachContact(6, 0, "social", 0.15, "pending"),
      reachEnt(30, "email", 0.25, "pending"),
      // ---- 更多失败（可重试）----
      reachContact(7, 0, "phone", 9 * D + 220, "failed", "对方手机关机或无信号"),
      reachEnt(13, "email", 10 * D + 260, "failed", "对方邮件服务器退信"),
      reachContact(26, 0, "phone", 11 * D + 310, "failed", "多次拨打无人接听"),
      // ---- 失败（不可重试）----
      reachContact(32, 0, "social", 12 * D + 360, "failed", "账号已失效或停用"),
      // ---- 触达任务 · 社媒（Facebook / TikTok 加好友 · 私信）----
      // 渠道 = 社媒；明细区分 Facebook平台加好友 / Facebook平台私信 / TikTok平台私信
      // 覆盖 待触达 / 触达中 / 触达成功 / 触达失败 四种状态，时间分散在近两周
      ...([
        { kind: "friend", platform: "Facebook", entI: 3, conIdx: -1, min: 3 * D + 200, status: "success" },
        { kind: "friend", platform: "Facebook", entI: 6, conIdx: 0, min: 1 * D + 180, status: "in_progress" },
        { kind: "friend", platform: "Facebook", entI: 9, conIdx: 1, min: 0.4, status: "pending" },
        { kind: "friend", platform: "Facebook", entI: 16, conIdx: -1, min: 8 * D + 150, status: "failed", failReason: "消息被平台拦截" },
        { kind: "dm", platform: "Facebook", entI: 2, conIdx: 1, min: 4 * D + 300, status: "success" },
        { kind: "dm", platform: "Facebook", entI: 12, conIdx: -1, min: 90, status: "in_progress" },
        { kind: "dm", platform: "Facebook", entI: 20, conIdx: 0, min: 0.12, status: "pending" },
        { kind: "dm", platform: "Facebook", entI: 28, conIdx: -1, min: 9 * D + 260, status: "failed", failReason: "私信发送后长期无响应" },
        { kind: "dm", platform: "TikTok", entI: 1, conIdx: 0, min: 2 * D + 140, status: "success" },
        { kind: "dm", platform: "TikTok", entI: 17, conIdx: -1, min: 45, status: "in_progress" },
        { kind: "dm", platform: "TikTok", entI: 22, conIdx: 2, min: 0.2, status: "pending" },
        { kind: "dm", platform: "TikTok", entI: 31, conIdx: 0, min: 11 * D + 200, status: "failed", failReason: "消息被平台拦截" },
      ].map((t) => {
        const actionLabel = t.kind === "friend" ? "加好友" : "私信";
        // 社媒触达目标为社媒账号（@handle），不关联 CRM 企业 / 人物，无明细跳转
        const handleSeed = `u${t.entI}${t.conIdx >= 0 ? t.conIdx : ""}${t.kind === "friend" ? "f" : "d"}`;
        const handle = `@${t.platform.toLowerCase()}_${handleSeed}`;
        return {
          id: makeId("r"),
          kind: "reach" as LedgerKind,
          cost: COST_REACH_SOCIAL,
          createdAt: isoMinutesAgo(t.min),
          targetKind: "enterprise" as TargetKind,
          targetId: "—",
          targetName: `${t.platform}平台${actionLabel}`,
          parentRef: undefined,
          channel: "social" as ReachChannel,
          platform: t.platform,
          detail: `${t.platform}平台${actionLabel} · ${handle}`,
          forcedStatus: t.status as ReachStatus,
          ...(t.failReason ? { failReason: t.failReason } : {}),
          content:
            t.kind === "friend"
              ? `Hi，我们是 Boo 出海平台，专注跨境供应链合作，希望能与您建立联系，方便通过好友请求吗？`
              : `Hi，\n\n我们是 Boo 出海平台，专注跨境供应链合作，希望能就跨境采购 / 供应合作做一次简短沟通，期待回复。\n\n— Boo team`,
          aiGenerated: t.entI % 2 === 0,
        };
      })),
      // ---- view ----
      viewEnt(0, "email", 2 * D + 120, pickEnt(0).email),
      viewEnt(0, "phone", 2 * D + 118, maskPhone(pickEnt(0).phone)),
      viewContact(4, 1, "email", 4 * D + 95, pickEnt(4).contacts[1 % pickEnt(4).contacts.length].email),
      (() => {
        const e = pickEnt(11);
        return {
          id: makeId("v"),
          kind: "view" as LedgerKind,
          cost: COST_VIEW_SOCIAL,
          createdAt: isoMinutesAgo(5 * D + 48),
          targetKind: "enterprise" as TargetKind,
          targetId: e.id,
          targetName: e.name,
          field: "social" as ViewField,
          platform: "LinkedIn",
          detail: `linkedin.com/company/${e.name.toLowerCase().replace(/[^a-z]/g, "")}`,
        };
      })(),
      viewEnt(7, "address", 6 * D + 30, pickEnt(7).address),
      viewContact(23, 0, "phone", 7 * D + 15, maskPhone(pickEnt(23).contacts[0].phone ?? pickEnt(23).phone)),
      // ---- recharge (3) ----
      {
        id: makeId("rc"),
        kind: "recharge",
        cost: 5400,
        createdAt: isoMinutesAgo(60 * 24 * 70),
        targetKind: "enterprise",
        targetId: "—",
        targetName: "专业套餐",
        orderNo: "R20260408164422",
        paymentMethod: "alipay",
        bonus: 400,
        price: 429,
        detail: "订单 R20260408164422 · ¥429 · 赠 400 积分",
      },
      {
        id: makeId("rc"),
        kind: "recharge",
        cost: 500,
        createdAt: isoMinutesAgo(60 * 24 * 29),
        targetKind: "enterprise",
        targetId: "—",
        targetName: "入门套餐",
        orderNo: "R20260520091205",
        paymentMethod: "wechat",
        bonus: 0,
        price: 49,
        detail: "订单 R20260520091205 · ¥49",
      },
      {
        id: makeId("rc"),
        kind: "recharge",
        cost: 2100,
        createdAt: isoMinutesAgo(60 * 24 * 6),
        targetKind: "enterprise",
        targetId: "—",
        targetName: "标准套餐",
        orderNo: "R20260612143012",
        paymentMethod: "wechat",
        bonus: 100,
        price: 179,
        detail: "订单 R20260612143012 · ¥179 · 赠 100 积分",
      },
      /* ---------------- 社媒账号购买 ---------------- */
      {
        id: makeId("sap"),
        kind: "social_account_purchase",
        cost: COST_SOCIAL_ACCOUNT_PURCHASE * 3,
        createdAt: isoMinutesAgo(9 * D + 120),
        targetKind: "enterprise",
        targetId: "—",
        targetName: "Facebook 账号 × 3",
        platform: "Facebook",
        detail: "购买 Facebook 社媒账号 3 个 · 单价 1,000 积分",
      },
      {
        id: makeId("sap"),
        kind: "social_account_purchase",
        cost: COST_SOCIAL_ACCOUNT_PURCHASE * 2,
        createdAt: isoMinutesAgo(5 * D + 60),
        targetKind: "enterprise",
        targetId: "—",
        targetName: "TikTok 账号 × 2",
        platform: "TikTok",
        detail: "购买 TikTok 社媒账号 2 个 · 单价 1,000 积分",
      },
      {
        id: makeId("sap"),
        kind: "social_account_purchase",
        cost: COST_SOCIAL_ACCOUNT_PURCHASE * 1,
        createdAt: isoMinutesAgo(2 * D + 30),
        targetKind: "enterprise",
        targetId: "—",
        targetName: "Facebook 账号 × 1",
        platform: "Facebook",
        detail: "购买 Facebook 社媒账号 1 个 · 单价 1,000 积分",
      },
      {
        id: makeId("sap"),
        kind: "social_account_purchase",
        cost: COST_SOCIAL_ACCOUNT_PURCHASE * 5,
        createdAt: isoMinutesAgo(12 * D + 45),
        targetKind: "enterprise",
        targetId: "—",
        targetName: "TikTok 账号 × 5",
        platform: "TikTok",
        detail: "购买 TikTok 社媒账号 5 个 · 单价 1,000 积分",
      },
      {
        id: makeId("sap"),
        kind: "social_account_purchase",
        cost: COST_SOCIAL_ACCOUNT_PURCHASE * 2,
        createdAt: isoMinutesAgo(20 * H),
        targetKind: "enterprise",
        targetId: "—",
        targetName: "Facebook 账号 × 2",
        platform: "Facebook",
        detail: "购买 Facebook 社媒账号 2 个 · 单价 1,000 积分",
      },
      /* ---------------- 触达社媒 · 加友 ---------------- */
      ...([
        { name: "Marcus Chen", handle: "@marcus.chen", platform: "Facebook" as const, min: 6 * D + 210 },
        { name: "Priya Nair", handle: "@priya.nair", platform: "Facebook" as const, min: 6 * D + 195 },
        { name: "Diego Alvarez", handle: "@diego.alvarez", platform: "Facebook" as const, min: 4 * D + 180 },
        { name: "Sara Kim", handle: "@sara.kim", platform: "TikTok" as const, min: 3 * D + 120 },
        { name: "Julien Petit", handle: "@julien.petit", platform: "TikTok" as const, min: 3 * D + 90 },
        { name: "Aiko Tanaka", handle: "@aiko.tanaka", platform: "Facebook" as const, min: 1 * D + 340 },
        { name: "Omar Hassan", handle: "@omar.hassan", platform: "TikTok" as const, min: 1 * D + 60 },
        { name: "Lucia Rossi", handle: "@lucia.rossi", platform: "Facebook" as const, min: 220 },
        { name: "Hannah Weber", handle: "@hannah.weber", platform: "Facebook" as const, min: 8 * H },
        { name: "Ravi Kapoor", handle: "@ravi.kapoor", platform: "TikTok" as const, min: 6 * H + 20 },
        { name: "Sofia Martins", handle: "@sofia.martins", platform: "Facebook" as const, min: 4 * H + 5 },
        { name: "Kenji Watanabe", handle: "@kenji.w", platform: "TikTok" as const, min: 2 * H + 40 },
        { name: "Emma Laurent", handle: "@emma.laurent", platform: "Facebook" as const, min: 95 },
        { name: "Noah Becker", handle: "@noah.becker", platform: "TikTok" as const, min: 35 },
      ].map((t) => ({
        id: makeId("saf"),
        kind: "social_add_friend" as LedgerKind,
        cost: COST_SOCIAL_ADD_FRIEND,
        createdAt: isoMinutesAgo(t.min),
        targetKind: "contact" as TargetKind,
        targetId: "—",
        targetName: t.name,
        platform: t.platform,
        channel: "social" as ReachChannel,
        detail: `${t.platform} 加友请求 · ${t.handle}`,
      }))),
      /* ---------------- 触达任务 · TikTok 关注（东南亚 · 美妆家居达人关注） ---------------- */
      ...([
        { name: "Nguyen Minh Anh", handle: "@minhanh.beauty", min: 5 * D },
        { name: "Ploy Chaiyaphum", handle: "@ploy.skincare", min: 3 * D + 60 },
        { name: "Rizky Pratama", handle: "@rizky.homedecor", min: 2 * D + 240 },
        { name: "Farah Binti Idris", handle: "@farah.homeliving", min: 1 * D + 400 },
        { name: "Nattaya Srisai", handle: "@nattaya.beauty", min: 9 * H },
      ].map((t) => ({
        id: makeId("r"),
        kind: "reach" as LedgerKind,
        cost: COST_SOCIAL_ADD_FRIEND,
        createdAt: isoMinutesAgo(t.min),
        targetKind: "contact" as TargetKind,
        targetId: "—",
        targetName: t.name,
        platform: "TikTok" as const,
        channel: "social" as ReachChannel,
        subject: "东南亚 · 美妆家居达人关注",
        detail: `TikTok 关注请求 · ${t.handle}`,
        forcedStatus: "success" as ReachStatus,
      }))),
      /* ---------------- 触达任务 · TikTok 私信（仅互关后可发） ---------------- */
      ...([
        { name: "Nguyen Minh Anh", handle: "@minhanh.beauty", min: 4 * D + 240 },
        { name: "Ploy Chaiyaphum", handle: "@ploy.skincare", min: 3 * D },
        { name: "Rizky Pratama", handle: "@rizky.homedecor", min: 2 * D + 60 },
      ].map((t) => ({
        id: makeId("r"),
        kind: "reach" as LedgerKind,
        cost: COST_SOCIAL_DM,
        createdAt: isoMinutesAgo(t.min),
        targetKind: "contact" as TargetKind,
        targetId: "—",
        targetName: t.name,
        platform: "TikTok" as const,
        channel: "social" as ReachChannel,
        subject: "东南亚 · 互关达人首轮私信",
        detail: `TikTok 私信首发 · ${t.handle}`,
        forcedStatus: "success" as ReachStatus,
      }))),

      /* ---------------- 触达社媒 · 私信 ---------------- */
      ...([
        { name: "Marcus Chen", handle: "@marcus.chen", platform: "Facebook" as const, min: 5 * D + 120 },
        { name: "Priya Nair", handle: "@priya.nair", platform: "Facebook" as const, min: 4 * D + 400 },
        { name: "Sara Kim", handle: "@sara.kim", platform: "TikTok" as const, min: 2 * D + 210 },
        { name: "Julien Petit", handle: "@julien.petit", platform: "TikTok" as const, min: 2 * D + 180 },
        { name: "Aiko Tanaka", handle: "@aiko.tanaka", platform: "Facebook" as const, min: 1 * D + 60 },
        { name: "Omar Hassan", handle: "@omar.hassan", platform: "TikTok" as const, min: 320 },
        { name: "Lucia Rossi", handle: "@lucia.rossi", platform: "Facebook" as const, min: 90 },
        { name: "Hannah Weber", handle: "@hannah.weber", platform: "Facebook" as const, min: 5 * H + 15 },
        { name: "Ravi Kapoor", handle: "@ravi.kapoor", platform: "TikTok" as const, min: 3 * H + 25 },
        { name: "Sofia Martins", handle: "@sofia.martins", platform: "Facebook" as const, min: 110 },
        { name: "Kenji Watanabe", handle: "@kenji.w", platform: "TikTok" as const, min: 55 },
        { name: "Emma Laurent", handle: "@emma.laurent", platform: "Facebook" as const, min: 20 },
      ].map((t) => ({
        id: makeId("sdm"),
        kind: "social_dm" as LedgerKind,
        cost: COST_SOCIAL_DM,
        createdAt: isoMinutesAgo(t.min),
        targetKind: "contact" as TargetKind,
        targetId: "—",
        targetName: t.name,
        platform: t.platform,
        channel: "social" as ReachChannel,
        detail: `${t.platform} 私信首发 · ${t.handle}`,
      }))),
    ];
    ledger = legacySeeded || staleSingleDaySeed ? seed : [...seed, ...ledger];
    writeLedger(ledger);
    clearLegacyLedgerSeedFlags();
    window.localStorage.setItem(LEDGER_SEED_FLAG, "1");
    emitLedger();
    // seed 完成后同步一次永久解锁集,保证 mock view 数据默认呈现明文
    syncUnlocksFromLedger();
    // 为使用了 AI 文案的触达任务补齐 AI 生成消费明细
    backfillAiGenerationEntries();
  } catch {}

}

export function resetDemoLedger() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEDGER_SEED_FLAG);
    window.localStorage.removeItem(UNLOCK_KEY);
  } catch {}
  unlockSet = new Set();
  emitUnlock();
  ledger = [];
  writeLedger(ledger);
  emitLedger();
  seedDemoLedgerIfEmpty();
}

// 兼容已 seed 过的老用户:模块加载时同步一次持久解锁集
if (typeof window !== "undefined") {
  try {
    syncUnlocksFromLedger();
  } catch {}
}
/* -------------------- 邮件托管触达 -------------------- */

/** 托管批次确认时一次性扣除积分（10 积分/目标） */
export function chargeManagedEmailBatch(input: {
  orderNo: string;
  qty: number;
  cost: number;
  detail: string;
}): LedgerEntry {
  const entry: LedgerEntry = {
    id: makeId("mer"),
    kind: "reach",
    cost: input.cost,
    createdAt: new Date().toISOString(),
    targetKind: "enterprise",
    targetId: input.orderNo,
    targetName: `邮件托管批次 ${input.orderNo}`,
    channel: "email",
    detail: input.detail,
    forcedStatus: "success",
  };
  ledger = [entry, ...ledger];
  persistLedger();
  return entry;
}

/** 托管批次中止/结算后，未执行目标退回积分 */
export function refundManagedEmailTargets(input: {
  orderNo: string;
  qty: number;
  cost: number;
  detail: string;
}): LedgerEntry {
  const entry: LedgerEntry = {
    id: makeId("mef"),
    kind: "refund",
    cost: input.cost,
    createdAt: new Date().toISOString(),
    targetKind: "enterprise",
    targetId: input.orderNo,
    targetName: `邮件托管批次 ${input.orderNo}`,
    channel: "email",
    detail: input.detail,
  };
  ledger = [entry, ...ledger];
  persistLedger();
  return entry;
}
