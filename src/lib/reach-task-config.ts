import type { LedgerEntry } from "./credits-ledger";

/** 触达任务类型：不同类型在详情页展示不同的配置项 */
export type ReachTaskType =
  | "social_prospecting" // 社媒拓客触达（系统按关键词寻找新目标）
  | "social_dm" // 批量社媒私信（存量名单）
  | "email"
  | "sms"
  | "whatsapp";

export const TASK_TYPE_LABEL: Record<ReachTaskType, string> = {
  social_prospecting: "社媒拓客触达",
  social_dm: "批量社媒私信",
  email: "批量邮件触达",
  sms: "批量短信触达",
  whatsapp: "WhatsApp 自动触达",
};

export interface ReachTaskConfig {
  taskKey: string;
  type: ReachTaskType;
  /** 通用 */
  platform?: string;
  action?: string;
  targetSource?: string;
  targetCap?: number;
  aiGenerated?: boolean;
  sourceZh?: string;
  targetLang?: string;
  sendContent?: string;
  costPerTarget?: number;
  /** 社媒 */
  region?: string;
  keywords?: string[];
  products?: string[];
  accounts?: string[];
  sendMode?: string;
  /** 邮件 */
  senderEmail?: string;
  subject?: string;
  /** 短信 */
  smsTemplate?: string;
  smsSign?: string;
  /** 排期 */
  schedule?: string;
}

const KEY = "boo:reach-task-config:v1";

function readAll(): Record<string, ReachTaskConfig> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const v = JSON.parse(raw);
    if (v && typeof v === "object") return v as Record<string, ReachTaskConfig>;
  } catch {}
  return {};
}

/** 弹窗创建任务时写入真实配置，详情页优先读取 */
export function saveReachTaskConfig(cfg: ReachTaskConfig) {
  if (typeof window === "undefined") return;
  try {
    const all = readAll();
    all[cfg.taskKey] = cfg;
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
}

export function getReachTaskConfig(taskKey: string): ReachTaskConfig | undefined {
  return readAll()[taskKey];
}

/* ---------------- 演示数据推导 ---------------- */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
function pick<T>(arr: T[], seed: number, salt = 0): T {
  return arr[(seed + salt * 7919) % arr.length]!;
}

const REGIONS = ["美国", "德国", "阿联酋", "东南亚（新马印）", "巴西", "英国"];
const KEYWORD_POOL = [
  ["steel importer", "structural steel", "钢材采购"],
  ["building materials", "tile distributor", "建材批发"],
  ["led lighting", "lighting wholesaler", "照明采购"],
  ["auto parts buyer", "spare parts importer", "汽配采购"],
  ["furniture importer", "home decor buyer", "家居采购"],
];
const PRODUCT_POOL = [
  ["热轧钢卷", "螺纹钢"],
  ["瓷砖", "石材"],
  ["LED 灯具", "灯带"],
  ["刹车片", "滤清器"],
  ["实木家具", "软体沙发"],
];
const ACCOUNTS_FB = ["@boo.global.sales", "@boo.trade.hub"];
const ACCOUNTS_TT = ["@boo_export", "@boo_supply"];
const MAILBOXES = ["sales@boo-global.com", "marketing@boo-global.com", "info@boo-global.com"];
const SMS_TEMPLATES = ["首轮开发问询模板", "展会邀约模板", "报价跟进模板"];

/** 判定任务类型 */
export function taskTypeOf(entries: LedgerEntry[], action: string): ReachTaskType {
  const r = entries[0];
  if (!r) return "email";
  if (r.channel === "email") return "email";
  if (r.channel === "phone") return "sms";
  if (r.platform === "WhatsApp") return "whatsapp";
  const isProspecting = entries.every((e) => e.targetId === "—") || action === "加好友";
  return isProspecting ? "social_prospecting" : "social_dm";
}

/**
 * 详情页配置：优先读取用户创建时保存的真实配置，
 * 否则按任务 key 稳定推导一份与「创建弹窗可编辑项」一致的演示配置。
 */
export function resolveTaskConfig(
  taskKey: string,
  entries: LedgerEntry[],
  action: string,
): ReachTaskConfig {
  const saved = getReachTaskConfig(taskKey);
  const type = saved?.type ?? taskTypeOf(entries, action);
  const seed = hash(taskKey);
  const first = entries[0];
  const platform = first?.platform;
  const idx = seed % KEYWORD_POOL.length;

  const derived: ReachTaskConfig = {
    taskKey,
    type,
    platform,
    action,
    targetCap: entries.length,
    aiGenerated: entries.some((e) => e.aiGenerated),
    sourceZh: first?.content,
    sendContent: first?.content,
    targetLang: pick(["en", "en", "es", "de", "pt"], seed),
    costPerTarget: first?.cost,
    region: pick(REGIONS, seed),
    keywords: KEYWORD_POOL[idx],
    products: PRODUCT_POOL[idx],
    accounts:
      platform === "TikTok" ? ACCOUNTS_TT : platform === "Facebook" ? ACCOUNTS_FB : undefined,
    sendMode: pick(["立即发送", "按目标账号活跃时间发出"], seed, 1),
    senderEmail: first?.senderEmail ?? pick(MAILBOXES, seed, 2),
    subject: type === "email" ? first?.subject : undefined,
    smsTemplate: pick(SMS_TEMPLATES, seed, 3),
    smsSign: "【BOO 出海】",
    targetSource:
      type === "social_prospecting"
        ? "系统按推广产品与关键词自动搜索"
        : "「我的收藏」勾选目标",
    schedule:
      entries.some((e) => e.scheduledAt)
        ? "当日额度用尽部分顺延次日 09:00 继续执行"
        : "创建后立即执行",
  };

  return { ...derived, ...(saved ?? {}) };
}
