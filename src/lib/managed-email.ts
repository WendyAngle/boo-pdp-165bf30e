import { useEffect, useSyncExternalStore } from "react";
import {
  chargeManagedEmailBatch,
  refundManagedEmailTargets,
} from "@/lib/credits-ledger";

/** 邮件托管触达：10 积分 / 目标（含寻源、翻译、代发等全部服务，按成功触达数结算） */
export const MANAGED_EMAIL_COST_PER_TARGET = 10;
export const MANAGED_MIN_OWN = 200;
export const MANAGED_MIN_AI = 500;
/** 候选池冗余比例：按目标数的 1.3 倍建池，用于失败目标自动补量 */
export const MANAGED_POOL_RATIO = 1.3;

export type ManagedSource = "own" | "ai";

/** 待受理 → 寻源中 → 发送中 →（可暂停）→ 已完成 / 已中止 / 已驳回 */
export type ManagedStatus =
  | "pending"
  | "sourcing"
  | "running"
  | "paused"
  | "completed"
  | "cancelled"
  | "rejected";

/** 客户提单时填写的邮件文案（必填） */
export type ManagedCopy = {
  subject: string;
  body: string;
  lang: string;
  translatedSubject?: string;
  translatedBody?: string;
  aiGenerated?: boolean;
};

export type ManagedSendLog = {
  company: string;
  email: string;
  at: string;
  state: "success" | "bounce" | "refilled";
};

export type ManagedDailyLog = {
  date: string;
  plan: number;
  sent: number;
  success: number;
  bounce: number;
  refill: number;
};

/** 单个发信邮箱在本任务中的使用情况 */
export type ManagedMailboxUsage = {
  email: string;
  /** 邮件服务商 ID */
  esp: string;
  sent: number;
  success: number;
  bounce: number;
};

export type ManagedExec = {
  /** 阶段 1：AI 寻源 */
  sourcing: {
    raw: number;
    dup: number;
    invalid: number;
    blocked: number;
    /** 有效目标数 */
    valid: number;
    /** 候选池总量（含补量储备） */
    pool: number;
    done: boolean;
  };
  /** 阶段 2：文案就绪（取用户提交的目标语言文案） */
  copy: {
    subject: string;
    body: string;
    lang: string;
    followupSubject: string;
    followupBody: string;
  };
  /** 阶段 3：自动排期 */
  schedule: {
    startAt: string;
    dailyCap: number;
    days: number;
    mailboxes: string[];
  };
  /** 各发信邮箱 / 服务商的用量分布 */
  mailboxUsage: ManagedMailboxUsage[];
  /** 阶段 4：分日发送 + 自动补量 */
  delivery: {
    /** 累计发出封数（含失败） */
    sent: number;
    /** 成功触达数（= order.sent，结算口径） */
    success: number;
    /** 退信 / 失败数 */
    bounce: number;
    /** 自动补量替换的目标数 */
    refill: number;
  };
  daily: ManagedDailyLog[];
  logs: ManagedSendLog[];
  taskNo: string;
  /** 候选池耗尽且增量寻源仍不足 */
  exhausted?: boolean;
  /** 上次自动推进时间，用于离开页面后按时间差补算 */
  lastTickAt: string;
};


export type ManagedOrder = {
  id: string;
  orderNo: string;
  /** 客户企业（当前租户） */
  company: string;
  source: ManagedSource;
  /** 目标数（承诺成功触达数） */
  qty: number;
  /** 成功触达目标数（结算口径） */
  sent: number;
  product: string;
  market?: string;
  keywords?: string;
  /** 客户提交的邮件文案（必填） */
  copy: ManagedCopy;
  expectStartAt?: string;
  dailyCap?: number;
  contact: string;
  note?: string;
  status: ManagedStatus;
  /** 驳回原因（用户端可见） */
  rejectReason?: string;
  /** 提单时一次性扣除的积分 */
  charged: number;
  /** 中止 / 完成 / 缺口退回的积分 */
  refunded: number;
  createdAt: string;
  updatedAt: string;
  /** 受理时间 */
  acceptedAt?: string;
  /** 运营备注 / 系统说明 */
  opsNote?: string;
  /** 自动执行运行数据（受理后生成） */
  exec?: ManagedExec;
};

/** 邮件服务商（ESP）资源池 */
export type ManagedEsp = {
  id: string;
  name: string;
  /** 发信域名 */
  domain: string;
  /** 每日总配额 */
  dailyQuota: number;
};

/** 与「管理后台 → 邮件服务商 / 邮件账号」保持一致的服务商 ID */
export const MANAGED_ESPS: ManagedEsp[] = [
  { id: "aws-ses", name: "Amazon SES", domain: "boo-mail.com", dailyQuota: 5000 },
  { id: "sendgrid", name: "SendGrid 主账号", domain: "boo-trade.com", dailyQuota: 3000 },
  { id: "mailgun", name: "Mailgun 备用", domain: "boo-global.com", dailyQuota: 2000 },
  { id: "aliyun-dm", name: "阿里云邮件推送", domain: "boo-cn.com", dailyQuota: 2000 },
];

export function espName(id: string) {
  return MANAGED_ESPS.find((e) => e.id === id)?.name ?? id;
}

/** 可用于代发的平台邮箱资源（mock） */
export type ManagedMailbox = {
  email: string;
  esp: string;
  /** 单邮箱日发送上限 */
  dailyLimit: number;
  health: "good" | "warn" | "bad";
};

export const MANAGED_MAILBOX_POOL: ManagedMailbox[] = [
  { email: "sales01@boo-mail.com", esp: "aws-ses", dailyLimit: 300, health: "good" },
  { email: "sales02@boo-mail.com", esp: "aws-ses", dailyLimit: 300, health: "good" },
  { email: "biz01@boo-trade.com", esp: "sendgrid", dailyLimit: 250, health: "warn" },
  { email: "biz02@boo-trade.com", esp: "sendgrid", dailyLimit: 250, health: "good" },
  { email: "market01@boo-global.com", esp: "mailgun", dailyLimit: 200, health: "good" },
  { email: "market02@boo-cn.com", esp: "aliyun-dm", dailyLimit: 200, health: "good" },
];

export const MANAGED_MAILBOXES = MANAGED_MAILBOX_POOL.map((m) => m.email);

export function mailboxEsp(email: string) {
  return MANAGED_MAILBOX_POOL.find((m) => m.email === email)?.esp ?? "aws-ses";
}



/** 处于流程中的状态 */
export const MANAGED_ACTIVE_STATUS: ManagedStatus[] = [
  "pending",
  "sourcing",
  "running",
  "paused",
];

/** 正在自动执行（可暂停 / 中止） */
export const MANAGED_EXEC_STATUS: ManagedStatus[] = ["sourcing", "running", "paused"];

export function managedMinQty(source: ManagedSource) {
  return source === "own" ? MANAGED_MIN_OWN : MANAGED_MIN_AI;
}

export const MANAGED_STATUS_LABEL: Record<ManagedStatus, string> = {
  pending: "待受理",
  sourcing: "寻源中",
  running: "发送中",
  paused: "已暂停",
  completed: "已完成",
  cancelled: "已中止",
  rejected: "已驳回",
};

const KEY = "boo:managed-email:v4";

const CURRENT_COMPANY = "深圳市博奥智能科技有限公司";

const DEMO_BUYERS = [
  "Nordic Power Solutions",
  "GreenVolt Energy BV",
  "Sahara Solar Trading",
  "Pacific Energy Supply",
  "AndesTec Distribucion",
  "BrightHome Systems",
  "EuroCell Wholesale",
  "Desert Sun Equipment",
];

function daysAgo(n: number, h = 10) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, 20, 0, 0);
  return d.toISOString();
}

function dateAfter(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function demoCopy(product: string, lang = "en"): ManagedCopy {
  return {
    subject: `${product} — supplier introduction from ${CURRENT_COMPANY}`,
    body: `您好，\n\n我们是${product}的中国制造商，具备完整的产品认证与稳定的交期。\n\n随信附上产品目录与报价，期待与贵司建立合作。`,
    lang,
    translatedSubject: `${product} — reliable China manufacturer, catalogue inside`,
    translatedBody: `Hello,\n\nWe are a China-based manufacturer of ${product}, with full certifications and stable lead times.\n\nPlease find our catalogue and price list attached. Looking forward to working with you.`,
  };
}

/** 演示工单：覆盖 待受理 / 寻源中 / 发送中 / 已完成 / 已中止 / 已驳回 */
function seed(): ManagedOrder[] {
  const base = (o: Partial<ManagedOrder> & { orderNo: string; qty: number }) => {
    const charged = o.charged ?? o.qty * MANAGED_EMAIL_COST_PER_TARGET;
    const order = {
      id: `me_seed_${o.orderNo}`,
      company: CURRENT_COMPANY,
      source: "own" as ManagedSource,
      sent: 0,
      product: "户外储能电源",
      copy: demoCopy(o.product ?? "户外储能电源"),
      contact: "王磊 138****6621",
      status: "pending" as ManagedStatus,
      charged,
      refunded: 0,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
      ...o,
    } as ManagedOrder;
    if (order.status !== "pending" && !order.exec) {
      order.exec = initExec(order);
      order.exec.delivery.success = order.sent;
      order.exec.delivery.sent = Math.round(order.sent * 1.08);
      order.exec.delivery.bounce = order.exec.delivery.sent - order.sent;
      order.exec.delivery.refill = order.exec.delivery.bounce;
      order.exec.daily = buildDaily(order.exec, order.sent);
      order.exec.logs = buildLogs(order.exec.delivery.sent);
      order.exec.mailboxUsage = spreadUsage(
        order.exec.mailboxUsage,
        order.exec.delivery.sent,
        order.exec.delivery.success,
        order.exec.delivery.bounce,
      );
      order.acceptedAt = order.acceptedAt ?? order.createdAt;
    }
    return order;
  };

  return [
    base({
      orderNo: "ME20260803093012",
      source: "ai",
      qty: 800,
      product: "便携式储能电源",
      market: "欧洲（德国 / 荷兰）",
      keywords: "portable power station, solar generator, off-grid battery",
      expectStartAt: dateAfter(2),
      dailyCap: 120,
      status: "pending",
      note: "主推 2000W 新品，避开已合作的 3 家德国经销商。",
      createdAt: daysAgo(1, 9),
      updatedAt: daysAgo(1, 9),
    }),
    base({
      orderNo: "ME20260802151122",
      source: "ai",
      qty: 500,
      sent: 0,
      product: "家用光伏组件",
      market: "欧洲（西班牙）",
      keywords: "solar panel distributor, PV module importer",
      status: "sourcing",
      dailyCap: 100,
      opsNote: "已受理，系统正在按关键词自动寻源并建立候选池。",
      createdAt: daysAgo(0, 8),
      updatedAt: daysAgo(0, 9),
    }),
    base({
      orderNo: "ME20260731142205",
      source: "own",
      qty: 320,
      sent: 186,
      product: "车载逆变器",
      market: "东南亚",
      expectStartAt: dateAfter(-2),
      dailyCap: 80,
      status: "running",
      opsNote: "候选池 416 个，已成功触达 186 个，退信目标已自动补量。",
      createdAt: daysAgo(4, 14),
      updatedAt: daysAgo(0, 8),
    }),
    base({
      orderNo: "ME20260728101744",
      source: "ai",
      qty: 600,
      sent: 411,
      product: "家用储能系统",
      market: "中东（阿联酋 / 沙特）",
      keywords: "home energy storage, hybrid inverter, solar ESS",
      status: "running",
      dailyCap: 100,
      opsNote: "分 6 天排期，当前第 4 天，退信率 6.8% 在健康区间。",
      createdAt: daysAgo(7, 10),
      updatedAt: daysAgo(0, 9),
    }),
    base({
      orderNo: "ME20260726090015",
      source: "own",
      qty: 260,
      sent: 132,
      product: "便携太阳能板",
      market: "澳洲",
      status: "paused",
      dailyCap: 60,
      opsNote: "发信邮箱 biz01 退信率异常，系统已自动暂停，待邮箱恢复后继续。",
      createdAt: daysAgo(9, 15),
      updatedAt: daysAgo(1, 10),
    }),
    base({
      orderNo: "ME20260715163350",
      source: "own",
      qty: 500,
      sent: 500,
      product: "太阳能板支架",
      market: "拉美",
      status: "completed",
      opsNote: "目标数已足额完成，退信目标全部由候选池自动补齐；共回复 23 封，已归集到触达会话。",
      createdAt: daysAgo(20, 16),
      updatedAt: daysAgo(9, 11),
    }),
    base({
      orderNo: "ME20260709111020",
      source: "ai",
      qty: 500,
      sent: 240,
      product: "工商业储能柜",
      market: "北美",
      status: "cancelled",
      refunded: 260 * MANAGED_EMAIL_COST_PER_TARGET,
      opsNote: "客户中途叫停（产线排期调整），未成功触达的 260 个目标积分已退回。",
      createdAt: daysAgo(26, 11),
      updatedAt: daysAgo(18, 15),
    }),
    base({
      orderNo: "ME20260705090810",
      source: "own",
      qty: 200,
      product: "锂电池组",
      market: "俄罗斯",
      status: "rejected",
      refunded: 200 * MANAGED_EMAIL_COST_PER_TARGET,
      rejectReason: "目标名单中 60% 邮箱已在退订/黑名单库，建议补充名单后重新提交，积分已全额退回。",
      createdAt: daysAgo(30, 9),
      updatedAt: daysAgo(29, 14),
    }),
  ];
}

function read(): ManagedOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : null;
    if (Array.isArray(arr)) return arr as ManagedOrder[];
  } catch {}
  return seed();
}

let orders: ManagedOrder[] = read();
let version = 0;
const listeners = new Set<() => void>();

function persist() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(orders));
    } catch {}
  }
  version++;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const getVersion = () => version;
const getServerVersion = () => 0;

export function useManagedOrders(): ManagedOrder[] {
  useSyncExternalStore(subscribe, getVersion, getServerVersion);
  return orders;
}

export function listManagedOrders() {
  return orders;
}

export function getManagedOrder(id: string) {
  return orders.find((o) => o.id === id);
}

function update(id: string, patch: Partial<ManagedOrder>) {
  orders = orders.map((o) =>
    o.id === id ? { ...o, ...patch, updatedAt: new Date().toISOString() } : o,
  );
  persist();
}

function nextOrderNo() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `ME${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(
    d.getHours(),
  )}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

/** 提交托管需求：一次性按目标数扣积分 */
export function createManagedOrder(input: {
  source: ManagedSource;
  qty: number;
  product: string;
  market?: string;
  keywords?: string;
  copy: ManagedCopy;
  expectStartAt?: string;
  dailyCap?: number;
  contact: string;
  note?: string;
}): ManagedOrder {
  const now = new Date().toISOString();
  const charged = input.qty * MANAGED_EMAIL_COST_PER_TARGET;
  const order: ManagedOrder = {
    id: `me_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    orderNo: nextOrderNo(),
    company: CURRENT_COMPANY,
    source: input.source,
    qty: input.qty,
    sent: 0,
    product: input.product,
    market: input.market,
    keywords: input.keywords,
    copy: input.copy,
    expectStartAt: input.expectStartAt,
    dailyCap: input.dailyCap,
    contact: input.contact,
    note: input.note,
    status: "pending",
    charged,
    refunded: 0,
    createdAt: now,
    updatedAt: now,
  };
  orders = [order, ...orders];
  persist();
  chargeManagedEmailBatch({
    orderNo: order.orderNo,
    qty: order.qty,
    cost: charged,
    detail: `邮件托管触达 · ${order.source === "own" ? "自有名单" : "AI 智能寻源"} ${order.qty} 个目标`,
  });
  return order;
}

/* ------------------------------ 自动执行引擎 ------------------------------ */

function buildLogs(n: number): ManagedSendLog[] {
  const out: ManagedSendLog[] = [];
  const count = Math.min(24, n);
  for (let i = 0; i < count; i++) {
    const company = DEMO_BUYERS[i % DEMO_BUYERS.length];
    const state: ManagedSendLog["state"] =
      i % 9 === 4 ? "bounce" : i % 9 === 5 ? "refilled" : "success";
    const at = new Date(Date.now() - i * 37 * 60000).toISOString();
    out.push({
      company: `${company}${i > 7 ? ` #${Math.floor(i / 8) + 1}` : ""}`,
      email: `pu****${i}@${company.split(" ")[0].toLowerCase()}.com`,
      at,
      state,
    });
  }
  return out;
}

function buildDaily(exec: ManagedExec, success: number): ManagedDailyLog[] {
  const days = Math.max(1, exec.schedule.days);
  const cap = exec.schedule.dailyCap;
  const out: ManagedDailyLog[] = [];
  let left = success;
  const start = new Date(exec.schedule.startAt);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const done = Math.min(cap, Math.max(0, left));
    left -= done;
    const bounce = Math.round(done * 0.07);
    out.push({
      date: d.toISOString().slice(0, 10),
      plan: cap,
      sent: done + bounce,
      success: done,
      bounce,
      refill: bounce,
    });

  }
  return out;
}

function initExec(o: ManagedOrder): ManagedExec {
  const dup = o.source === "own" ? Math.round(o.qty * 0.04) : 0;
  const invalid = Math.round(o.qty * 0.03);
  const blocked = Math.round(o.qty * 0.01);
  const pool = Math.round(o.qty * MANAGED_POOL_RATIO);
  const raw = pool + dup + invalid + blocked;
  const dailyCap = o.dailyCap && o.dailyCap > 0 ? o.dailyCap : 100;
  const lang = o.copy.lang || "en";
  const subject = o.copy.translatedSubject?.trim() || o.copy.subject;
  const body = o.copy.translatedBody?.trim() || o.copy.body;
  const count = o.qty > 600 ? 4 : o.qty > 400 ? 3 : 2;
  const mailboxes = MANAGED_MAILBOX_POOL.filter((m) => m.health !== "bad").slice(0, count);
  return {
    sourcing: { raw, dup, invalid, blocked, valid: o.qty, pool, done: false },
    copy: {
      subject,
      body,
      lang,
      followupSubject: `Re: ${subject}`,
      followupBody: `Just following up on my previous email about ${o.product}. Happy to send samples or a tailored quotation.`,
    },
    schedule: {
      startAt: o.expectStartAt ?? new Date().toISOString().slice(0, 10),
      dailyCap,
      days: Math.max(1, Math.ceil(o.qty / Math.max(1, dailyCap))),
      mailboxes: mailboxes.map((m) => m.email),
    },
    mailboxUsage: mailboxes.map((m) => ({
      email: m.email,
      esp: m.esp,
      sent: 0,
      success: 0,
      bounce: 0,
    })),
    delivery: { sent: 0, success: 0, bounce: 0, refill: 0 },
    daily: [],
    logs: [],
    taskNo: `MT${Date.now().toString(36).toUpperCase()}`,
    lastTickAt: new Date().toISOString(),
  };
}

/** 把一次发送量按邮箱均分（余数给前面的邮箱），用于 mock 用量分布 */
function spreadUsage(
  usage: ManagedMailboxUsage[],
  sent: number,
  success: number,
  bounce: number,
): ManagedMailboxUsage[] {
  const n = usage.length;
  if (!n) return usage;
  const split = (total: number, i: number) =>
    Math.floor(total / n) + (i < total % n ? 1 : 0);
  return usage.map((u, i) => ({
    ...u,
    sent: u.sent + split(sent, i),
    success: u.success + split(success, i),
    bounce: u.bounce + split(bounce, i),
  }));
}

/** 兼容旧数据：缺少 mailboxUsage 时按邮箱均分现有用量补齐 */
export function execMailboxUsage(exec: ManagedExec): ManagedMailboxUsage[] {
  if (exec.mailboxUsage?.length) return exec.mailboxUsage;
  const list = exec.schedule.mailboxes.map((email) => ({
    email,
    esp: mailboxEsp(email),
    sent: 0,
    success: 0,
    bounce: 0,
  }));
  return spreadUsage(list, exec.delivery.sent, exec.delivery.success, exec.delivery.bounce);
}


/** 运营受理 → 系统自动开始寻源与发送 */
export function acceptManagedOrder(id: string, opsNote?: string) {
  const o = orders.find((x) => x.id === id);
  if (!o || o.status !== "pending") return;
  update(id, {
    status: "sourcing",
    acceptedAt: new Date().toISOString(),
    opsNote: opsNote ?? "已受理，系统开始自动寻源并建立候选池。",
    exec: o.exec ?? initExec(o),
  });
}

/** 运营：驳回工单，积分全额退回 */
export function rejectManagedOrder(id: string, reason: string) {
  const o = orders.find((x) => x.id === id);
  if (!o || o.status !== "pending") return;
  const refund = (o.qty - o.sent) * MANAGED_EMAIL_COST_PER_TARGET;
  update(id, {
    status: "rejected",
    rejectReason: reason,
    refunded: o.refunded + refund,
  });
  if (refund > 0) {
    refundManagedEmailTargets({
      orderNo: o.orderNo,
      qty: o.qty - o.sent,
      cost: refund,
      detail: `邮件托管触达驳回退回 · ${o.qty - o.sent} 个目标`,
    });
  }
}

/** 暂停自动执行 */
export function pauseManagedOrder(id: string, reason?: string) {
  const o = orders.find((x) => x.id === id);
  if (!o || (o.status !== "running" && o.status !== "sourcing")) return;
  update(id, { status: "paused", opsNote: reason ?? o.opsNote });
}

/** 恢复自动执行 */
export function resumeManagedOrder(id: string) {
  const o = orders.find((x) => x.id === id);
  if (!o || o.status !== "paused") return;
  const exec = o.exec ? { ...o.exec, lastTickAt: new Date().toISOString() } : undefined;
  update(id, { status: o.exec?.sourcing.done ? "running" : "sourcing", exec });
}

/** 结算完成：未成功触达部分退回积分 */
export function completeManagedOrder(id: string) {
  const o = orders.find((x) => x.id === id);
  if (!o || !MANAGED_EXEC_STATUS.includes(o.status)) return;
  const remain = Math.max(0, o.qty - o.sent);
  const refund = remain * MANAGED_EMAIL_COST_PER_TARGET;
  update(id, { status: "completed", refunded: o.refunded + refund });
  if (refund > 0) {
    refundManagedEmailTargets({
      orderNo: o.orderNo,
      qty: remain,
      cost: refund,
      detail: `邮件托管触达结算退回 · 未完成 ${remain} 个目标`,
    });
  }
}

/** 中途叫停：未成功触达的目标退回积分 */
export function cancelManagedOrder(id: string, reason?: string) {
  const o = orders.find((x) => x.id === id);
  if (!o || !MANAGED_ACTIVE_STATUS.includes(o.status)) return;
  const remain = Math.max(0, o.qty - o.sent);
  const refund = remain * MANAGED_EMAIL_COST_PER_TARGET;
  update(id, {
    status: "cancelled",
    refunded: o.refunded + refund,
    opsNote: reason ?? o.opsNote,
  });
  if (refund > 0) {
    refundManagedEmailTargets({
      orderNo: o.orderNo,
      qty: remain,
      cost: refund,
      detail: `邮件托管触达中止退回 · 未完成 ${remain} 个目标`,
    });
  }
}

/** 待受理超 24h / 执行超期，用于 SLA 看板 */
export function managedSla(o: ManagedOrder): "overdue" | "warn" | "ok" {
  const hours = (Date.now() - new Date(o.createdAt).getTime()) / 36e5;
  if (o.status === "pending" && hours > 24) return "overdue";
  if (o.status === "paused") return "warn";
  if (o.status === "running" && o.expectStartAt) {
    const due = new Date(o.expectStartAt).getTime() + 14 * 864e5;
    if (Date.now() > due) return "warn";
  }
  return "ok";
}

/** 单次推进：寻源完成 / 分批发送 / 失败自动补量 / 足额完成 */
function advance(o: ManagedOrder): ManagedOrder | null {
  if (o.status === "sourcing") {
    const exec = o.exec ?? initExec(o);
    return {
      ...o,
      status: "running",
      exec: {
        ...exec,
        sourcing: { ...exec.sourcing, done: true },
        lastTickAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    };
  }
  if (o.status !== "running" || !o.exec) return null;
  const exec = o.exec;
  const remain = o.qty - o.sent;
  if (remain <= 0) return null;

  const step = Math.max(1, Math.min(remain, Math.round(exec.schedule.dailyCap / 12)));
  const bounce = Math.round(step * 0.07);
  const attempts = step + bounce;
  const usedPool = exec.delivery.sent + attempts;
  const exhausted = usedPool > exec.sourcing.pool;

  const success = o.sent + step;
  const today = new Date().toISOString().slice(0, 10);
  const daily = [...exec.daily];
  const idx = daily.findIndex((d) => d.date === today);
  const row: ManagedDailyLog = idx >= 0
    ? { ...daily[idx] }
    : { date: today, plan: exec.schedule.dailyCap, sent: 0, success: 0, bounce: 0, refill: 0 };
  row.sent += attempts;
  row.success += step;
  row.bounce += bounce;
  row.refill += bounce;
  if (idx >= 0) daily[idx] = row;
  else daily.push(row);

  const nextExec: ManagedExec = {
    ...exec,
    delivery: {
      sent: exec.delivery.sent + attempts,
      success,
      bounce: exec.delivery.bounce + bounce,
      refill: exec.delivery.refill + bounce,
    },
    daily,
    mailboxUsage: spreadUsage(execMailboxUsage(exec), attempts, step, bounce),
    logs: buildLogs(exec.delivery.sent + attempts),
    exhausted,
    lastTickAt: new Date().toISOString(),
  };

  const done = success >= o.qty;
  return {
    ...o,
    sent: success,
    status: done ? "completed" : "running",
    exec: nextExec,
    opsNote: done
      ? `目标数已足额完成，共自动补量 ${nextExec.delivery.refill} 个目标。`
      : o.opsNote,
    updatedAt: new Date().toISOString(),
  };
}

const TICK_MS = 5000;
const MAX_CATCHUP = 12;
let timer: ReturnType<typeof setInterval> | null = null;
let engineRefs = 0;

function tick(times = 1) {
  let changed = false;
  const next = orders.map((o) => {
    if (o.status !== "running" && o.status !== "sourcing") return o;
    let cur = o;
    for (let i = 0; i < times; i++) {
      const adv = advance(cur);
      if (!adv) break;
      cur = adv;
      changed = true;
      if (cur.status === "completed") break;
    }
    return cur;
  });
  if (changed) {
    orders = next;
    persist();
  }
}

/** 挂载自动执行引擎（客户端 mock：每 5 秒推进一次，并按停留间隔补算） */
export function useManagedEngine() {
  useEffect(() => {
    const last = orders
      .map((o) => o.exec?.lastTickAt)
      .filter(Boolean)
      .sort()
      .pop();
    if (last) {
      const missed = Math.floor((Date.now() - new Date(last).getTime()) / TICK_MS);
      if (missed > 0) tick(Math.min(MAX_CATCHUP, missed));
    }
    engineRefs++;
    if (!timer) timer = setInterval(() => tick(1), TICK_MS);
    return () => {
      engineRefs--;
      if (engineRefs <= 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, []);
}
