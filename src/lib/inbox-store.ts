import { useSyncExternalStore } from "react";
import {
  getAllLedger,
  useLedger,
  type LedgerEntry,
} from "@/lib/credits-ledger";
import { addSuppression } from "@/lib/suppressions-store";
import { deriveFriends } from "@/lib/social-friends";
import {
  useProspectingTasks,
  getProspectingTasksSnapshot,
  type ProspectingTask,
} from "@/lib/social-tasks";


/* -------------------- Types -------------------- */

export type AiIntent =
  | "interested"
  | "quote"
  | "reject"
  | "ooo"
  | "unsubscribe"
  | "complaint"
  | "other";

export type ThreadStatus =
  | "pending" // 待跟进（有未读或 AI 标为意向/询价）
  | "waiting_reply" // 我方已回复，等对方
  | "in_cadence" // 已加入自动序列
  | "snoozed"
  | "won" // 已成交
  | "lost" // 已流失
  | "suppressed";

export const INTENT_LABEL: Record<AiIntent, string> = {
  interested: "意向",
  quote: "询价",
  reject: "拒绝",
  ooo: "自动回复",
  unsubscribe: "退订请求",
  complaint: "投诉",
  other: "其他",
};

export const INTENT_COLOR: Record<AiIntent, string> = {
  interested: "bg-emerald-100 text-emerald-700 border-emerald-200",
  quote: "bg-sky-100 text-sky-700 border-sky-200",
  reject: "bg-slate-100 text-slate-700 border-slate-200",
  ooo: "bg-amber-100 text-amber-700 border-amber-200",
  unsubscribe: "bg-orange-100 text-orange-700 border-orange-200",
  complaint: "bg-rose-100 text-rose-700 border-rose-200",
  other: "bg-slate-100 text-slate-700 border-slate-200",
};

export const STATUS_LABEL: Record<ThreadStatus, string> = {
  pending: "待我回复",
  waiting_reply: "等客回复",
  in_cadence: "跟进中",
  snoozed: "已稍后处理",
  won: "已成交",
  lost: "已流失",
  suppressed: "已退订",
};

/** 关单原因（成交 / 流失） */
export type CloseOutcome = "won" | "lost";
export const CLOSE_OUTCOME_LABEL: Record<CloseOutcome, string> = {
  won: "已成交",
  lost: "已流失",
};

/* -------------------- Channels & groups (v2) -------------------- */

export type Channel =
  | "email"
  | "sms"
  | "whatsapp"
  | "telegram"
  | "facebook"
  | "tiktok";

export const CHANNEL_LABEL: Record<Channel, string> = {
  email: "邮件",
  sms: "短信",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  facebook: "Facebook",
  tiktok: "TikTok",
};

/** 会话客服窗口时长（小时）；无窗口概念的渠道为 undefined */
export const WINDOW_HOURS: Partial<Record<Channel, number>> = {
  whatsapp: 24,
  facebook: 24,
  tiktok: 48,
};

export const CHANNEL_COLOR: Record<Channel, string> = {
  email: "bg-violet-50 text-violet-700 border-violet-200",
  sms: "bg-sky-50 text-sky-700 border-sky-200",
  whatsapp: "bg-emerald-50 text-emerald-700 border-emerald-200",
  telegram: "bg-cyan-50 text-cyan-700 border-cyan-200",
  facebook: "bg-blue-50 text-blue-700 border-blue-200",
  tiktok: "bg-neutral-100 text-neutral-800 border-neutral-200",
};

export type GroupKind = "enterprise" | "contact";
export const GROUP_LABEL: Record<GroupKind, string> = {
  enterprise: "企业分组",
  contact: "人物分组",
};

/** 分组 SLA 配置（Phase 1 常量；管理页可覆盖但只影响 UI 视觉） */
export const GROUP_SLA: Record<GroupKind, { firstResponseMin: number; replyHour: number }> = {
  enterprise: { firstResponseMin: 30, replyHour: 8 },
  contact: { firstResponseMin: 20, replyHour: 4 },
};

export interface AssignmentEvent {
  id: string;
  from?: string;
  to?: string;
  reason?: string;
  crossGroup?: boolean;
  greetingSent?: boolean;
  at: string;
}

/** 演示用团队成员（Phase 1 mock；后续接入 /outreach/users） */
export interface TeamMember {
  id: string;
  name: string;
  avatarLetter: string;
  groups: GroupKind[];
  role?: "member" | "lead";
}

export const TEAM_MEMBERS: TeamMember[] = [
  { id: "u_zhang", name: "张三", avatarLetter: "张", groups: ["enterprise", "contact"], role: "lead" },
  { id: "u_li", name: "李四", avatarLetter: "李", groups: ["enterprise"] },
  { id: "u_wang", name: "王五", avatarLetter: "王", groups: ["contact"] },
  { id: "u_zhao", name: "赵六", avatarLetter: "赵", groups: ["contact"] },
  { id: "u_sun", name: "孙七", avatarLetter: "孙", groups: ["enterprise", "contact"] },
];

export function memberById(id?: string | null): TeamMember | undefined {
  if (!id) return undefined;
  return TEAM_MEMBERS.find((m) => m.id === id);
}

export function threadGroup(t: { targetKind: "enterprise" | "contact" }): GroupKind {
  return t.targetKind === "enterprise" ? "enterprise" : "contact";
}

/** 一条会话消息（我方发出 或 对方回复） */
export interface ThreadMessage {
  id: string;
  direction: "outbound" | "inbound";
  createdAt: string;
  fromName: string;
  fromAddress: string;
  subject?: string;
  content: string;
  aiGenerated?: boolean;
  /** 对方回复的中文译文（仅 inbound 且原文非中文时提供） */
  contentZh?: string;
  /** 我方发送的中文译文（仅 outbound 且原文非中文时提供，供内部对照） */
  contentZhOutbound?: string;

  /** outbound 关联的 ledger id */
  ledgerId?: string;
  /** outbound 送达事件（模拟） */
  events?: Array<{ type: "delivered" | "opened" | "clicked" | "sending" | "failed"; at: string; failReason?: string }>;
}

/** 会话的持久化元数据 */
interface ThreadMeta {
  threadId: string;
  status: ThreadStatus;
  snoozeUntil?: string;
  tags: string[];
  aiIntent?: AiIntent;
  assignee?: string;
  /** 分配给的员工 id（Phase 1 mock，见 TEAM_MEMBERS） */
  assigneeId?: string;
  /** 分配 / 转派事件时间线 */
  assignmentEvents?: AssignmentEvent[];
  /** WhatsApp / Facebook / TikTok 客服窗口截止时间 */
  windowExpiresAt?: string;
  /** snooze 到期自动唤醒的时间点，用于列表高亮 */
  wokenAt?: string;
  /** 是否被标为 star */
  starred?: boolean;
  /** 未读的 inbound 数量 */
  unread: number;
  /** 手动追加的跟进/回复 */
  extraMessages: ThreadMessage[];
  /** inbound 回复（含 seed 与后续追加） */
  inboundMessages: ThreadMessage[];
  /** 待办 */
  tasks: Array<{ id: string; title: string; dueAt?: string; done: boolean }>;
  /** 是否已加入跟进序列 */
  cadenceEnrolled?: boolean;
  /** 人工接管标记：当 AI/自动流程无法胜任时，由人工员工显式接管；接管后会话从「人工接管」筛选中移除，形成闭环 */
  humanTakeover?: {
    at: string;
    byId: string;
    byName: string;
    reason?: string;
  };
  /** 用户手工编辑的客户资料覆盖值 */
  profile?: {
    targetName?: string;
    counterpartyAddress?: string;
    contactPerson?: string;
    email?: string;
    company?: string;
    phone?: string;
    website?: string;
    country?: string;
  };
  /** 客户备注 */
  notes?: Array<{ id: string; text: string; at: string; by: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface SocialSignals {
  /** 账号注册天数（Facebook / TikTok） */
  accountAgeDays?: number;
  /** 是否设置头像 */
  hasAvatar?: boolean;
  /** 粉丝 / 好友数 */
  followers?: number;
  /** 历史贴文 / 视频数 */
  postsCount?: number;
  /** 该条内容在最近同渠道中被重复出现的次数（>=2 视为批量转发） */
  duplicateBroadcastCount?: number;
}

export interface Thread {
  id: string;
  targetKind: "enterprise" | "contact";
  targetId: string;
  targetName: string;
  parentRef?: { id: string; name: string };
  /** 会话所属渠道 */
  channel: Channel;
  /** 对方地址（收件邮箱） */
  counterpartyAddress: string;
  /** 我方 sender */
  senderEmail?: string;
  messages: ThreadMessage[];
  meta: ThreadMeta;
  lastAt: string;
  lastPreview: string;
  lastDirection: "outbound" | "inbound";
  /** 社媒渠道专属信号（facebook / tiktok），供真实度评分使用 */
  socialSignals?: SocialSignals;
  /** 来源为社媒好友池（已通过好友），列表中打「好友」标记 */
  isFriend?: boolean;
  /** 好友来源任务名（isFriend 时可用） */
  friendSource?: string;
  /** 已申请加好友但对方尚未通过：暂不可发起私信触达（避免风控） */
  friendPending?: boolean;
  /** 对方已解除好友关系：不可再发私信触达（避免风控） */
  friendRemoved?: boolean;
  /** 是否由用户手动添加（非系统推荐/非企业库选择） */
  manualAdd?: boolean;
}

/* -------------------- Storage -------------------- */

const META_KEY = "boo:inbox:meta:v1";
const SEED_FLAG = "boo:inbox:seed:v11";
/** Phase 1 演示：当前登录员工，需与 conversations.tsx 中的 CURRENT_TEAM_USER_ID 保持一致 */
const DEMO_CURRENT_USER = "u_zhang";

function readMeta(): Record<string, ThreadMeta> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(META_KEY);
    if (!raw) return {};
    const j = JSON.parse(raw);
    if (j && typeof j === "object") {
      // 迁移：旧版 "handled" 语义不明，默认视为"已流失"（用户可在 UI 改判为"已成交"）
      const rec = j as Record<string, ThreadMeta>;
      for (const k in rec) {
        const m = rec[k];
        if ((m.status as string) === "handled") m.status = "lost";
      }
      return rec;
    }
  } catch {}
  return {};
}

function writeMeta(m: Record<string, ThreadMeta>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {}
}

let metaStore: Record<string, ThreadMeta> = readMeta();
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
    if (e.key === META_KEY) {
      metaStore = readMeta();
      emit();
    }
  });
}

function commit() {
  writeMeta(metaStore);
  emit();
}

function makeId(p: string) {
  return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/* -------------------- Thread key -------------------- */

/** 会话 id：企业/联系人 + 对方邮箱地址 */
function threadKey(r: LedgerEntry): string | null {
  if (r.kind !== "reach" || !r.detail) return null;
  if (r.channel === "email")
    return `t:email:${r.targetKind}:${r.targetId}:${r.detail.toLowerCase()}`;
  if (r.channel === "phone")
    return `t:sms:${r.targetKind}:${r.targetId}:${r.detail}`;
  return null;
}

/** 供外部（触达任务列表 → 收件箱 反查）计算 threadKey */
export function threadKeyFor(r: LedgerEntry): string | null {
  return threadKey(r);
}

function ensureMeta(threadId: string, createdAt: string): ThreadMeta {
  let m = metaStore[threadId];
  if (!m) {
    m = {
      threadId,
      status: "pending",
      tags: [],
      unread: 0,
      extraMessages: [],
      inboundMessages: [],
      tasks: [],
      createdAt,
      updatedAt: createdAt,
    };
    metaStore[threadId] = m;
  }
  return m;
}

/* -------------------- Reply seed data -------------------- */

type ReplyBody = { body: string; zh?: string };

/** 若原文本身是中文，则不再重复提供 zh 译文 */
function isChinese(s: string) {
  return /[\u4e00-\u9fa5]/.test(s);
}

const INTENT_TEMPLATES: Array<{ intent: AiIntent; bodies: ReplyBody[] }> = [
  {
    intent: "interested",
    bodies: [
      {
        body: "Thanks for reaching out — this actually aligns with what we're evaluating this quarter. Could you share a short deck and pricing tiers?",
        zh: "感谢来信 —— 这与我们本季度正在评估的方向正好吻合。可否发一份简短的资料和分档报价？",
      },
      { body: "很感兴趣，方便本周内做个 30 分钟的电话会吗？也请把资料一并发一下。" },
      {
        body: "Sounds interesting. Please loop in our procurement lead — cc'd. What are the typical MOQs?",
        zh: "看起来不错。已将我们的采购负责人加入抄送，请一并沟通。你们通常的最小起订量是多少？",
      },
    ],
  },
  {
    intent: "quote",
    bodies: [
      {
        body: "Could you send a formal quote for 5,000 units, delivered CIF Rotterdam? Also, lead time please.",
        zh: "请就 5,000 件、CIF 鹿特丹交付方式提供正式报价，同时请告知交货周期。",
      },
      { body: "麻烦按 20HQ 报个 FOB 深圳的价，含目录里 SKU-A 和 SKU-C，谢谢。" },
    ],
  },
  {
    intent: "ooo",
    bodies: [
      {
        body: "I'm out of office until Monday with limited email access. For urgent matters please contact my colleague.",
        zh: "我正在休假，下周一才会回来，期间邮件查看有限。如有紧急事项，请联系我的同事。",
      },
      { body: "我正在休假，将于下周一回复邮件，紧急事项请联系同事 David。" },
    ],
  },
  {
    intent: "reject",
    bodies: [
      {
        body: "Thanks but we already work with an existing supplier and are not looking to switch this year.",
        zh: "感谢来信，我们已有长期合作的供应商，今年暂不打算更换，祝好。",
      },
      { body: "感谢来信，我们暂无相关采购计划，祝好。" },
    ],
  },
  {
    intent: "unsubscribe",
    bodies: [{ body: "Please remove me from your list. Thanks.", zh: "请将我从你们的邮件列表中移除，谢谢。" }],
  },
  {
    intent: "complaint",
    bodies: [
      {
        body: "This is the third email this week — please stop contacting us or I will report as spam.",
        zh: "这已经是本周的第三封邮件 —— 请停止联系我们，否则我将把邮件举报为垃圾邮件。",
      },
    ],
  },
];

/** SMS 场景下的短回复模板（比邮件更简短，含 STOP 关键字） */
const SMS_INTENT_TEMPLATES: Array<{ intent: AiIntent; bodies: ReplyBody[] }> = [
  {
    intent: "interested",
    bodies: [
      { body: "Interested — send details please.", zh: "有兴趣，请把详细资料发给我。" },
      { body: "有兴趣，请发资料到我邮箱。" },
      { body: "Ok, share your catalog.", zh: "好的，把你们的产品目录发过来。" },
    ],
  },
  {
    intent: "quote",
    bodies: [
      { body: "Send price for 5k units.", zh: "请报 5,000 件的价格。" },
      { body: "报个 FOB 深圳的价" },
    ],
  },
  {
    intent: "ooo",
    bodies: [
      { body: "On leave, back Mon.", zh: "正在休假，下周一回。" },
      { body: "在休假，下周一联系" },
    ],
  },
  {
    intent: "reject",
    bodies: [
      { body: "No thanks.", zh: "不需要，谢谢。" },
      { body: "暂无采购计划" },
    ],
  },
  {
    intent: "unsubscribe",
    bodies: [
      { body: "STOP", zh: "退订" },
      { body: "退订" },
    ],
  },
  { intent: "complaint", bodies: [{ body: "Stop texting me!", zh: "不要再给我发短信了！" }] },
];

function pickSmsIntent(seed: number): { intent: AiIntent; body: string; zh?: string } {
  // SMS 权重：意向 20% / 询价 15% / OOO 10% / 拒绝 30% / 退订 20% / 投诉 5%
  const w = [20, 35, 45, 75, 95, 100];
  const kind = ["interested", "quote", "ooo", "reject", "unsubscribe", "complaint"] as const;
  const p = seed % 100;
  const idx = w.findIndex((x) => p < x);
  const intent = kind[Math.max(0, idx)];
  const tpl = SMS_INTENT_TEMPLATES.find((t) => t.intent === intent)!;
  const pick = tpl.bodies[seed % tpl.bodies.length];
  return { intent, body: pick.body, zh: pick.zh };
}

function pickIntent(seed: number): { intent: AiIntent; body: string; zh?: string } {
  // 权重：意向 30% / 询价 25% / OOO 15% / 拒绝 20% / 退订 7% / 投诉 3%
  const w = [30, 55, 70, 90, 97, 100];
  const kind = ["interested", "quote", "ooo", "reject", "unsubscribe", "complaint"] as const;
  const p = seed % 100;
  const idx = w.findIndex((x) => p < x);
  const intent = kind[Math.max(0, idx)];
  const tpl = INTENT_TEMPLATES.find((t) => t.intent === intent)!;
  const pick = tpl.bodies[seed % tpl.bodies.length];
  return { intent, body: pick.body, zh: pick.zh };
}

/* -------------------- Risk seed samples（对应真实度方案 §12）-------------------- */

type RiskKind =
  | "disposable"
  | "bec"
  | "intel"
  | "freeBig"
  | "emojiOnly"
  | "stopHarass"
  | "template";

interface RiskSample {
  kind: RiskKind;
  body: string;
  zh?: string;
  /** 覆盖 inbound 消息的 fromAddress，用于让 R001/R003b 命中 */
  senderOverride?: string;
  /** 覆盖 aiIntent（默认沿用普通抽签） */
  intentOverride?: AiIntent;
}

const RISK_SAMPLES: RiskSample[] = [
  // —— blocked（硬规则）——
  {
    kind: "disposable",
    body: "Hi, we are a large European distributor and we'd like to discuss a bulk order for your catalog. Please share pricing.",
    zh: "我们是欧洲大型分销商，希望批量采购贵司产品，请提供报价。",
    senderOverride: "buyer_9921@mailinator.com",
    intentOverride: "quote",
  },
  {
    kind: "bec",
    body: "Please note: we have changed our bank account. Kindly update payment details in your system and send remittance to the new wire instructions attached.",
    zh: "请注意：我们已变更银行账户，请更新贵司系统的收款信息，按新汇款说明付款。",
    intentOverride: "other",
  },
  // —— high_risk / suspicious（多规则叠加，落入 30~55 区间）——
  {
    kind: "intel",
    body: "Dear Sir, to move forward please send: (1) your full price list for ALL SKUs, (2) top-10 customer list with references, (3) BOM and cost breakdown of your best-selling model, (4) factory address & layout. We also require 100% TT prepay to our personal account for the first trial order. Thanks.",
    zh: "请提供：完整报价单、TOP10 客户名单、明星产品的 BOM 与成本结构、工厂地址与布局；首单要求 100% 前 T/T 至个人账户。",
    senderOverride: "sourcing.k88@gmail.com",
    intentOverride: "quote",
  },
  {
    kind: "freeBig",
    body: "Dear Purchasing, our group corporation plans a 2 million USD order in Q1 for 20 x 40HQ. Please send your best price list and BOM breakdown so we can compare with other suppliers.",
    zh: "我集团 Q1 计划下单 200 万美金 20 x 40HQ，请发送最优报价单与 BOM 明细供比价。",
    senderOverride: "big.buyer.777@gmail.com",
    intentOverride: "quote",
  },
  {
    kind: "stopHarass",
    body: "STOP. Remove me from your list immediately or I'll report your domain as spam to authorities.",
    zh: "请立刻把我从你们名单中移除，否则我会把贵司域名作为垃圾邮件举报。",
    intentOverride: "complaint",
  },
  // —— neutral / suspicious 边界（单规则轻度扣分，落入 60~85 区间）——
  {
    kind: "emojiOnly",
    body: "👍👍👍",
    intentOverride: "other",
  },
  {
    kind: "emojiOnly",
    body: "ok",
    intentOverride: "other",
  },
  {
    kind: "template",
    body: "Dear Sir/Madam, we are interested in your products. Please send catalog. Thanks.",
    zh: "Dear Sir/Madam，我们对贵司产品感兴趣，请发送目录。谢谢。",
    intentOverride: "quote",
  },
  {
    kind: "freeBig",
    body: "We are a corporation from West Africa, interested in a 1.5 million USD trial order. Please share your best price.",
    zh: "我司为西非集团客户，拟试单 150 万美金，请提供最优价。",
    senderOverride: "westafrica.trade@yahoo.com",
    intentOverride: "quote",
  },
  // —— 多规则叠加（免费邮箱 + 大额 + 模板群发；落入 high_risk 区间）——
  {
    kind: "freeBig",
    body: "Dear Purchasing Manager, our group corporation urgently needs 3 million USD order. Please send full price list and BOM breakdown ASAP.",
    zh: "Dear Purchasing Manager，我集团急需 300 万美金订单，请尽快发送完整报价单与 BOM 明细。",
    senderOverride: "global.trade.buyer@hotmail.com",
    intentOverride: "quote",
  },
  // —— 多规则叠加（情报刺探 + 前 T/T 个人账户 + 免费邮箱）——
  {
    kind: "intel",
    body: "Please share your customer list and full price list for evaluation. We can pay 100% TT prepay to personal account for the first order to speed things up.",
    zh: "请提供客户名单与完整报价单用于评估，为加快进度首单可 100% 前 T/T 至个人账户。",
    senderOverride: "quick.deal.2026@gmail.com",
    intentOverride: "quote",
  },
];

function pickRiskSample(seed: number): RiskSample {
  return RISK_SAMPLES[seed % RISK_SAMPLES.length];
}



/** 首次访问收件箱时，对已有邮件触达按 ~40% 概率补上一条对方回复 */
function seedInboundIfNeeded(entries: LedgerEntry[]) {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(SEED_FLAG)) return;
  let changed = false;
  for (const r of entries) {
    const key = threadKey(r);
    if (!key) continue;
    const m = ensureMeta(key, r.createdAt);
    if (m.inboundMessages.length > 0) continue;
    const h = hashStr(r.id);
    const isSms = r.channel === "phone";
    // SMS 回复率更低（~25%），邮件 ~40%
    const threshold = isSms ? 25 : 40;
    if (h % 100 < threshold) {
      const picked = isSms ? pickSmsIntent(h) : pickIntent(h);
      let intent = picked.intent;
      let body = picked.body;
      let zh = picked.zh;
      let senderAddr = r.detail || "";
      // 邮件渠道下按 ~35% 概率覆盖为风险样本（对应真实度方案 §12 mock 数据）
      const isRisk = !isSms && h % 100 < 35;
      if (isRisk) {
        const risk = pickRiskSample(h >> 4);
        body = risk.body;
        zh = risk.zh;
        if (risk.senderOverride) senderAddr = risk.senderOverride;
        if (risk.intentOverride) intent = risk.intentOverride;
      }
      // 回复时间：发送后 4~72 小时
      const sentAt = new Date(r.createdAt).getTime();
      const delayH = 4 + (h % 68);
      const replyAt = new Date(sentAt + delayH * 3600_000).toISOString();
      if (new Date(replyAt).getTime() > Date.now()) continue;
      m.inboundMessages.push({
        id: makeId("in"),
        direction: "inbound",
        createdAt: replyAt,
        fromName: r.parentRef?.name
          ? `${r.targetName} · ${r.parentRef.name}`
          : r.targetName,
        fromAddress: senderAddr,
        subject: r.subject ? `Re: ${r.subject}` : undefined,
        content: body,
        contentZh: zh && !isChinese(body) ? zh : undefined,
      });
      m.aiIntent = intent;
      m.unread = 1;
      // 退订 / 投诉 → 自动抑制并加入退订名单；OOO → snooze 3 天；意向/询价 → 待跟进；拒绝 → 已处理
      if (intent === "unsubscribe" || intent === "complaint") {
        m.status = "suppressed";
        m.unread = 0;
        // SMS 场景 STOP 关键字 → 加入手机号退订名单
        if (isSms && r.detail) {
          addSuppression("phone", r.detail, intent === "unsubscribe" ? "STOP 关键字" : "投诉");
        } else if (!isSms && r.detail) {
          addSuppression("email", r.detail, intent === "unsubscribe" ? "退订请求" : "投诉");
        }
      } else if (intent === "ooo") {
        m.status = "snoozed";
        m.snoozeUntil = new Date(
          new Date(replyAt).getTime() + 3 * 24 * 3600_000,
        ).toISOString();
      } else if (intent === "reject") {
        m.status = "lost";
        m.unread = 0;
      } else {
        m.status = "pending";
      }
      m.updatedAt = replyAt;
      changed = true;
    }
  }
  // 演示数据：把前若干条"待跟进"会话分派给当前员工，避免"我的待办"视图为空
  let assigned = 0;
  for (const r of entries) {
    if (assigned >= 5) break;
    const key = threadKey(r);
    if (!key) continue;
    const m = metaStore[key];
    if (!m) continue;
    if (m.status !== "pending") continue;
    if (m.assigneeId) continue;
    if (m.inboundMessages.length === 0) continue;
    m.assigneeId = DEMO_CURRENT_USER;
    m.assignee = memberById(DEMO_CURRENT_USER)?.name;
    assigned++;
    changed = true;
  }
  // 演示数据：分派若干条给其他成员，体现多员工分布
  const otherMembers = TEAM_MEMBERS.filter((m) => m.id !== DEMO_CURRENT_USER);
  let otherAssigned = 0;
  for (const r of entries) {
    if (otherAssigned >= 4) break;
    const key = threadKey(r);
    if (!key) continue;
    const m = metaStore[key];
    if (!m) continue;
    if (m.status !== "pending") continue;
    if (m.assigneeId) continue;
    if (m.inboundMessages.length === 0) continue;
    const pick = otherMembers[otherAssigned % otherMembers.length];
    m.assigneeId = pick.id;
    m.assignee = pick.name;
    otherAssigned++;
    changed = true;
  }
  // 演示数据：生命周期多样化 —— 等待回复 / 已成交 / 已流失 / 已抑制 各若干条，
  // 让"询盘与回复"的状态筛选每项都有真实数据可看。
  const lifecyclePlan: { status: ThreadStatus; count: number; clearUnread?: boolean }[] = [
    { status: "waiting_reply", count: 2 },
    { status: "won", count: 2, clearUnread: true },
    { status: "lost", count: 1, clearUnread: true },
    { status: "suppressed", count: 1, clearUnread: true },
    { status: "snoozed", count: 1 },
  ];
  for (const plan of lifecyclePlan) {
    let n = 0;
    for (const r of entries) {
      if (n >= plan.count) break;
      const key = threadKey(r);
      if (!key) continue;
      const m = metaStore[key];
      if (!m) continue;
      if (m.status !== "pending") continue;
      if (m.inboundMessages.length === 0) continue;
      // 等待回复：追加一条我方回复，模拟已回复对方
      if (plan.status === "waiting_reply") {
        const last = m.inboundMessages[m.inboundMessages.length - 1];
        const replyAt = new Date(
          new Date(last.createdAt).getTime() + 30 * 60_000,
        ).toISOString();
        m.extraMessages.push({
          id: makeId("ob_seed"),
          direction: "outbound",
          createdAt: replyAt,
          fromName: "你",
          fromAddress: r.senderEmail || "",
          subject: r.subject ? `Re: ${r.subject}` : undefined,
          content:
            "Thanks for your message — we've forwarded the details to our sales team and will follow up shortly with pricing & availability.",
        });
        m.updatedAt = replyAt;
        m.unread = 0;
      }
      if (plan.status === "snoozed") {
        m.snoozeUntil = new Date(Date.now() + 2 * 24 * 3600_000).toISOString();
      }
      m.status = plan.status;
      if (plan.clearUnread) m.unread = 0;
      n++;
      changed = true;
    }
  }
  if (changed) writeMeta(metaStore);
  window.localStorage.setItem(SEED_FLAG, "1");
}

/* -------------------- Derive threads -------------------- */

function buildThreads(entries: LedgerEntry[]): Thread[] {
  seedInboundIfNeeded(entries);
  const map = new Map<string, Thread>();
  // ledger 已按时间倒序，我们要按线索归并
  for (let i = entries.length - 1; i >= 0; i--) {
    const r = entries[i];
    const key = threadKey(r);
    if (!key) continue;
    const meta = ensureMeta(key, r.createdAt);
    let t = map.get(key);
    if (!t) {
      t = {
        id: key,
        targetKind: r.targetKind,
        targetId: r.targetId,
        targetName: r.targetName,
        parentRef: r.parentRef,
        channel: r.channel === "phone" ? "sms" : "email",
        counterpartyAddress: r.detail || "",
        senderEmail: r.senderEmail,
        messages: [],
        meta,
        lastAt: r.createdAt,
        lastPreview: "",
        lastDirection: "outbound",
      };
      map.set(key, t);
    }
    // outbound 事件（模拟）：15 分钟后 delivered；30% opened；10% clicked
    const sent = new Date(r.createdAt).getTime();
    const events: ThreadMessage["events"] = [];
    if (Date.now() - sent > 15 * 60_000)
      events.push({ type: "delivered", at: new Date(sent + 15 * 60_000).toISOString() });
    const h = hashStr(r.id);
    if (h % 100 < 55)
      events.push({ type: "opened", at: new Date(sent + 60 * 60_000).toISOString() });
    if (h % 100 < 18)
      events.push({ type: "clicked", at: new Date(sent + 90 * 60_000).toISOString() });
    t.messages.push({
      id: `ob_${r.id}`,
      direction: "outbound",
      createdAt: r.createdAt,
      fromName: "你",
      fromAddress: r.senderEmail || "",
      subject: r.subject,
      content: r.content || "(此邮件无正文快照)",
      aiGenerated: r.aiGenerated,
      ledgerId: r.id,
      contentZhOutbound: r.content && !isChinese(r.content) ? "（演示数据：此处展示该非中文触达内容的中文译文对照）" : undefined,
      events,

    });
    if (r.senderEmail && !t.senderEmail) t.senderEmail = r.senderEmail;
  }
  // 追加 inbound + extra
  for (const t of map.values()) {
    const meta = t.meta;
    for (const im of meta.inboundMessages) t.messages.push(im);
    for (const em of meta.extraMessages) t.messages.push(em);
    t.messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const last = t.messages[t.messages.length - 1];
    if (last) {
      t.lastAt = last.createdAt;
      t.lastDirection = last.direction;
      t.lastPreview = last.content.slice(0, 120);
    }
    // 到期解 snooze
    if (meta.status === "snoozed" && meta.snoozeUntil && new Date(meta.snoozeUntil).getTime() < Date.now()) {
      meta.status = "pending";
      meta.snoozeUntil = undefined;
      meta.wokenAt = new Date().toISOString();
    }
  }
  return Array.from(map.values()).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/* -------------------- 社媒演示数据（含发送状态 mock） -------------------- */

function getDemoSocialStatusThreads(): Thread[] {
  // 生成一些含有「发送中」、「发送失败」状态的社媒会话
  const now = new Date();
  const demoThreads: Thread[] = [
    {
      id: "demo:social:fb:sending",
      targetKind: "contact",
      targetId: "demo-target-fb-1",
      targetName: "Aidil Rahman",
      channel: "facebook",
      counterpartyAddress: "@aidil_r",
      senderEmail: "CloudBeauty_Official",
      messages: [
        {
          id: "m_fb_1",
          direction: "inbound",
          createdAt: new Date(now.getTime() - 2 * 3600_000).toISOString(),
          fromName: "Aidil Rahman",
          fromAddress: "@aidil_r",
          content: "Hai, boleh saya tahu masa penghantaran ke KL?",
          contentZh: "你好，请问寄到吉隆坡要多久？",
        },
        {
          id: "m_fb_2",
          direction: "outbound",
          createdAt: new Date(now.getTime() - 1.5 * 3600_000).toISOString(),
          fromName: "你",
          fromAddress: "CloudBeauty_Official",
          content: "Ada, saiz M ready stock. Nak saya tolong order?",
          contentZhOutbound: "有的，M码有现货。需要我帮您下单吗？",
          events: [{ type: "delivered", at: new Date(now.getTime() - 1.4 * 3600_000).toISOString() }],

        },
        {
          id: "m_fb_3",
          direction: "inbound",
          createdAt: new Date(now.getTime() - 1 * 3600_000).toISOString(),
          fromName: "Aidil Rahman",
          fromAddress: "@aidil_r",
          content: "Ok, boleh share size chart?",
          contentZh: "好的，能发下尺码表吗？",
        },
        {
          id: "m_fb_4",
          direction: "outbound",
          createdAt: new Date(now.getTime() - 5 * 60_000).toISOString(),
          fromName: "你",
          fromAddress: "CloudBeauty_Official",
          content: "Baik, saya akan uruskan sebentar lagi—harap tunggu sekejap ya.",
          contentZhOutbound: "好的，我马上为您处理——请稍等一下。",
          events: [{ type: "sending", at: new Date(now.getTime() - 5 * 60_000).toISOString() }],

        }
      ],
      meta: {
        threadId: "demo:social:fb:sending",
        status: "pending",
        tags: ["发送状态演示"],
        unread: 0,
        extraMessages: [],
        inboundMessages: [], // 此处简化，buildThreads 会合并
        tasks: [],
        createdAt: new Date(now.getTime() - 2 * 3600_000).toISOString(),
        updatedAt: now.toISOString(),
      },
      lastAt: now.toISOString(),
      lastPreview: "Baik, saya akan uruskan sebentar lagi—harap tunggu sekejap ya.",
      lastDirection: "outbound",
    },
    {
      id: "demo:social:tt:failed",
      targetKind: "contact",
      targetId: "demo-target-tt-1",
      targetName: "李婷婷",
      channel: "tiktok",
      counterpartyAddress: "@liting",
      senderEmail: "CloudBeauty_Official",
      messages: [
        {
          id: "m_tt_1",
          direction: "inbound",
          createdAt: new Date(now.getTime() - 24 * 3600_000).toISOString(),
          fromName: "李婷婷",
          fromAddress: "@liting",
          content: "你好呀，认识一下~",
        },
        {
          id: "m_tt_2",
          direction: "outbound",
          createdAt: new Date(now.getTime() - 23 * 3600_000).toISOString(),
          fromName: "你",
          fromAddress: "CloudBeauty_Official",
          content: "你好，感谢关注~",
          events: [{ type: "delivered", at: new Date(now.getTime() - 22.9 * 3600_000).toISOString() }],
        },
        {
          id: "m_tt_3",
          direction: "inbound",
          createdAt: new Date(now.getTime() - 22 * 3600_000).toISOString(),
          fromName: "李婷婷",
          fromAddress: "@liting",
          content: "好的，麻烦发下尺码表~",
        },
        {
          id: "m_tt_4",
          direction: "outbound",
          createdAt: new Date(now.getTime() - 10 * 60_000).toISOString(),
          fromName: "你",
          fromAddress: "CloudBeauty_Official",
          content: "感谢您的耐心等待，正在为您核实中。",
          events: [{ 
            type: "failed", 
            at: new Date(now.getTime() - 9 * 60_000).toISOString(),
            failReason: "网络连接超时，请重试"
          }],
        }
      ],
      meta: {
        threadId: "demo:social:tt:failed",
        status: "pending",
        tags: ["发送失败示例"],
        unread: 0,
        extraMessages: [],
        inboundMessages: [],
        tasks: [],
        createdAt: new Date(now.getTime() - 24 * 3600_000).toISOString(),
        updatedAt: now.toISOString(),
      },
      lastAt: now.toISOString(),
      lastPreview: "感谢您的耐心等待，正在为您核实中。",
      lastDirection: "outbound",
    }
  ];

  // 补全 inboundMessages 字段以便 useThreads 过滤逻辑能选中它们
  return demoThreads.map(t => {
    t.meta.inboundMessages = t.messages.filter(m => m.direction === 'inbound');
    return t;
  });
}

/* -------------------- Facebook 已申请加好友（待通过）演示会话 -------------------- */

/** 已申请加好友、对方尚未通过：仅一条系统记录，暂不可私信 */
function getDemoFriendPendingThreads(): Thread[] {
  const at = new Date(Date.now() - 6 * 3600_000).toISOString();
  const source = "北美 · Steel Importer 加友";
  const content = `已申请添加对方好友（任务来源：${source}），为避免引起风控暂不可发起私信触达。`;
  const id = "demo:social:fb:friend-pending";
  const meta = ensureMeta(id, at);
  const msg: ThreadMessage = {
    id: "m_fb_friend_pending",
    direction: "outbound",
    createdAt: at,
    fromName: "系统",
    fromAddress: "CloudBeauty_Official",
    content,
  };
  return [
    {
      id,
      targetKind: "contact",
      targetId: "demo-target-fb-pending",
      targetName: "Daniel Whitmore",
      channel: "facebook",
      counterpartyAddress: "@daniel.whitmore",
      senderEmail: "CloudBeauty_Official",
      messages: [msg],
      meta,
      lastAt: at,
      lastPreview: content.slice(0, 120),
      lastDirection: "outbound",
      friendPending: true,
      friendSource: source,
    },
  ];
}

/* -------------------- Facebook 已解除好友关系演示会话 -------------------- */

/** 已加好友 → 互发私信 → 对方解除好友：最后一条系统记录，不可再私信 */
function getDemoFriendRemovedThreads(): Thread[] {
  const now = Date.now();
  const source = "北美 · Steel Importer 加友";
  const id = "demo:social:fb:friend-removed";
  const base = now - 48 * 3600_000;
  const meta = ensureMeta(id, new Date(base).toISOString());
  const messages: ThreadMessage[] = [
    {
      id: "m_fb_rm_1",
      direction: "outbound",
      createdAt: new Date(base).toISOString(),
      fromName: "系统",
      fromAddress: "CloudBeauty_Official",
      content: `已申请添加对方好友（任务来源：${source}），为避免引起风控暂不可发起私信触达。`,
    },
    {
      id: "m_fb_rm_2",
      direction: "outbound",
      createdAt: new Date(base + 2 * 3600_000).toISOString(),
      fromName: "系统",
      fromAddress: "CloudBeauty_Official",
      content: `好友申请已通过（来源任务：${source}），可直接发起私信触达。`,
    },
    {
      id: "m_fb_rm_3",
      direction: "outbound",
      createdAt: new Date(base + 3 * 3600_000).toISOString(),
      fromName: "你",
      fromAddress: "CloudBeauty_Official",
      content: "Hi, thanks for connecting. We specialize in beauty devices and would love to explore cooperation opportunities.",
      contentZhOutbound: "您好，感谢您的通过。我们专注于美容仪器，希望有机会探讨合作。",
      events: [{ type: "delivered", at: new Date(base + 3.1 * 3600_000).toISOString() }],
    },
    {
      id: "m_fb_rm_4",
      direction: "inbound",
      createdAt: new Date(base + 5 * 3600_000).toISOString(),
      fromName: "Emma Collins",
      fromAddress: "@emma.collins",
      content: "Thanks for reaching out. Please send your catalog and MOQ.",
      contentZh: "感谢您的联系。请发送你们的产品目录和最小起订量。",
    },
    {
      id: "m_fb_rm_5",
      direction: "outbound",
      createdAt: new Date(base + 6 * 3600_000).toISOString(),
      fromName: "你",
      fromAddress: "CloudBeauty_Official",
      content: "Sure, here is the catalog link. Looking forward to your feedback.",
      contentZhOutbound: "好的，这是产品目录链接。期待您的反馈。",
      events: [{ type: "delivered", at: new Date(base + 6.1 * 3600_000).toISOString() }],
    },
    {
      id: "m_fb_rm_6",
      direction: "inbound",
      createdAt: new Date(base + 8 * 3600_000).toISOString(),
      fromName: "Emma Collins",
      fromAddress: "@emma.collins",
      content: "Not interested for now.",
      contentZh: "暂时不感兴趣。",
    },
    {
      id: "m_fb_rm_7",
      direction: "outbound",
      createdAt: new Date(base + 10 * 3600_000).toISOString(),
      fromName: "系统",
      fromAddress: "CloudBeauty_Official",
      content: "对方已解除好友关系，请勿再发私信触达。",
    },
  ];
  const last = messages[messages.length - 1];
  return [
    {
      id,
      targetKind: "contact",
      targetId: "demo-target-fb-removed",
      targetName: "Emma Collins",
      channel: "facebook",
      counterpartyAddress: "@emma.collins",
      senderEmail: "CloudBeauty_Official",
      messages,
      meta,
      lastAt: last.createdAt,
      lastPreview: last.content.slice(0, 120),
      lastDirection: "outbound",
      friendRemoved: true,
      friendSource: source,
    },
  ];
}

/* -------------------- TikTok 关注 / 回关演示会话 -------------------- */

/** TikTok 关系口径：关注（单向）→ 对方回关（互关＝好友，可私信）→ 对方取消关注（关系解除） */
export const TT_DEMO_SOURCE = "东南亚 · 美妆家居达人关注";
const TT_DEMO_ACCOUNT = "@bytetech_official";

function ttThread(input: {
  id: string;
  targetId: string;
  name: string;
  handle: string;
  messages: ThreadMessage[];
  isFriend?: boolean;
  friendPending?: boolean;
  friendRemoved?: boolean;
}): Thread {
  const first = input.messages[0];
  const meta = ensureMeta(input.id, first.createdAt);
  const inbound = input.messages.filter((m) => m.direction === "inbound");
  meta.inboundMessages = inbound;
  const last = input.messages[input.messages.length - 1];
  return {
    id: input.id,
    targetKind: "contact",
    targetId: input.targetId,
    targetName: input.name,
    channel: "tiktok",
    counterpartyAddress: input.handle,
    senderEmail: TT_DEMO_ACCOUNT,
    messages: input.messages,
    meta,
    lastAt: last.createdAt,
    lastPreview: last.content.slice(0, 120),
    lastDirection: last.direction,
    isFriend: input.isFriend,
    friendPending: input.friendPending,
    friendRemoved: input.friendRemoved,
    friendSource: TT_DEMO_SOURCE,
    socialSignals: { accountAgeDays: 420, hasAvatar: true, followers: 8600, postsCount: 132 },
  };
}

/** 5 个场景：待回关 / 已回关 / 已回关+我方私信 / 双向对话 / 对话后取消关注 */
function getDemoTikTokThreads(): Thread[] {
  const now = Date.now();
  const H = 3600_000;
  const sysFollow = (at: number, id: string): ThreadMessage => ({
    id,
    direction: "outbound",
    createdAt: new Date(at).toISOString(),
    fromName: "系统",
    fromAddress: TT_DEMO_ACCOUNT,
    content: `已关注对方（任务来源：${TT_DEMO_SOURCE}），对方回关后方可发起私信触达。`,
  });
  const sysBack = (at: number, id: string): ThreadMessage => ({
    id,
    direction: "outbound",
    createdAt: new Date(at).toISOString(),
    fromName: "系统",
    fromAddress: TT_DEMO_ACCOUNT,
    content: `对方已回关（来源任务：${TT_DEMO_SOURCE}），双方互关即为好友，可直接发起私信触达。`,
  });

  /* 1) 已关注，待对方回关 —— 不可发私信 */
  const t1Base = now - 9 * H;
  const s1 = ttThread({
    id: "demo:social:tt:follow-pending",
    targetId: "ttd_1",
    name: "Nattaya Srisai",
    handle: "@nattaya.beauty",
    friendPending: true,
    messages: [sysFollow(t1Base, "m_tt_p_1")],
  });

  /* 2) 已回关，尚未私信 —— 可发私信 */
  const t2Base = now - 30 * H;
  const s2 = ttThread({
    id: "demo:social:tt:follow-back",
    targetId: "ttd_2",
    name: "Farah Binti Idris",
    handle: "@farah.homeliving",
    isFriend: true,
    messages: [sysFollow(t2Base, "m_tt_b_1"), sysBack(t2Base + 5 * H, "m_tt_b_2")],
  });

  /* 3) 已回关 + 我方账号发出一条私信（未回复） */
  const t3Base = now - 52 * H;
  const s3 = ttThread({
    id: "demo:social:tt:dm-sent",
    targetId: "ttd_3",
    name: "Rizky Pratama",
    handle: "@rizky.homedecor",
    isFriend: true,
    messages: [
      sysFollow(t3Base, "m_tt_s_1"),
      sysBack(t3Base + 6 * H, "m_tt_s_2"),
      {
        id: "m_tt_s_3",
        direction: "outbound",
        createdAt: new Date(t3Base + 7 * H).toISOString(),
        fromName: "你",
        fromAddress: TT_DEMO_ACCOUNT,
        content:
          "Hi Rizky, thanks for the follow back! We manufacture home decor and small appliances for overseas brands. Happy to share our catalog if you're sourcing.",
        contentZhOutbound:
          "Hi Rizky，感谢回关！我们为海外品牌生产家居装饰与小家电，如果您正在采购，很乐意分享产品目录。",
        events: [{ type: "delivered", at: new Date(t3Base + 7.05 * H).toISOString() }],
      },
    ],
  });

  /* 4) 已回关 + 我方私信 + 对方回复 */
  const t4Base = now - 76 * H;
  const s4 = ttThread({
    id: "demo:social:tt:dm-replied",
    targetId: "ttd_4",
    name: "Ploy Chaiyaphum",
    handle: "@ploy.skincare",
    isFriend: true,
    messages: [
      sysFollow(t4Base, "m_tt_r_1"),
      sysBack(t4Base + 4 * H, "m_tt_r_2"),
      {
        id: "m_tt_r_3",
        direction: "outbound",
        createdAt: new Date(t4Base + 5 * H).toISOString(),
        fromName: "你",
        fromAddress: TT_DEMO_ACCOUNT,
        content:
          "Hi Ploy, great to connect. We supply OEM skincare devices with CE certification. Would you like to see our price list?",
        contentZhOutbound:
          "Hi Ploy，很高兴与您建立联系。我们提供带 CE 认证的 OEM 美容仪器，需要看下报价单吗？",
        events: [{ type: "delivered", at: new Date(t4Base + 5.05 * H).toISOString() }],
      },
      {
        id: "m_tt_r_4",
        direction: "inbound",
        createdAt: new Date(t4Base + 9 * H).toISOString(),
        fromName: "Ploy Chaiyaphum",
        fromAddress: "@ploy.skincare",
        content: "Yes please, send the price list and MOQ. Do you ship to Bangkok?",
        contentZh: "好的，请发报价单和最小起订量。你们能发货到曼谷吗？",
      },
    ],
  });

  /* 5) 已回关 + 私信往来 + 对方取消关注 → 关系解除，不可再私信 */
  const t5Base = now - 120 * H;
  const s5 = ttThread({
    id: "demo:social:tt:unfollowed",
    targetId: "ttd_5",
    name: "Nguyen Minh Anh",
    handle: "@minhanh.beauty",
    friendRemoved: true,
    messages: [
      sysFollow(t5Base, "m_tt_u_1"),
      sysBack(t5Base + 3 * H, "m_tt_u_2"),
      {
        id: "m_tt_u_3",
        direction: "outbound",
        createdAt: new Date(t5Base + 4 * H).toISOString(),
        fromName: "你",
        fromAddress: TT_DEMO_ACCOUNT,
        content:
          "Hi Minh Anh, thanks for following back. We produce beauty tools for Southeast Asia distributors — may I send our catalog?",
        contentZhOutbound:
          "Hi Minh Anh，感谢回关。我们为东南亚经销商生产美妆工具，方便发一份产品目录给您吗？",
        events: [{ type: "delivered", at: new Date(t5Base + 4.05 * H).toISOString() }],
      },
      {
        id: "m_tt_u_4",
        direction: "inbound",
        createdAt: new Date(t5Base + 8 * H).toISOString(),
        fromName: "Nguyen Minh Anh",
        fromAddress: "@minhanh.beauty",
        content: "We already have a supplier, thanks.",
        contentZh: "我们已经有供应商了，谢谢。",
      },
      {
        id: "m_tt_u_5",
        direction: "outbound",
        createdAt: new Date(t5Base + 20 * H).toISOString(),
        fromName: "系统",
        fromAddress: TT_DEMO_ACCOUNT,
        content: "对方已取消关注，互关关系解除，请勿再发私信触达。",
      },
    ],
  });

  return [s1, s2, s3, s4, s5];
}

/** 上述 TikTok 场景由演示会话显式构造，避免好友池重复生成 */
const TT_DEMO_TARGET_IDS = new Set(["ttd_1", "ttd_2", "ttd_3", "ttd_4", "ttd_5"]);





/* -------------------- 社媒好友池 → 客户触达 -------------------- */

/**
 * 好友池（已通过好友的 Facebook / TikTok 目标）并入「客户触达」会话列表：
 * 渠道 = facebook / tiktok（可用顶部渠道筛选过滤），展示时打「好友」标记。
 */
function buildFriendThreads(tasks: ProspectingTask[]): Thread[] {
  return deriveFriends(tasks)
    .filter((f) => !TT_DEMO_TARGET_IDS.has(f.targetId))
    .map((f) => {
    const id = `friend:${f.id}`;
    const at = f.acceptedAt ?? new Date().toISOString();
    const meta = ensureMeta(id, at);
    const channel: Channel = f.platform === "TikTok" ? "tiktok" : "facebook";
    const msg: ThreadMessage = {
      id: `fr_${f.id}`,
      direction: "outbound",
      createdAt: at,
      fromName: "你",
      fromAddress: f.accountId,
      content: `好友申请已通过（来源任务：${f.sourceTaskName}），可直接发起私信触达。`,
    };
    const extra: ThreadMessage[] = [];
    // Mike O'Brien 演示：好友通过后我方主动发送营销破冰私信
    if (f.targetId === "t2") {
      const icebreakerAt = new Date(new Date(at).getTime() + 10 * 60_000).toISOString();
      extra.push({
        id: `fr_${f.id}_icebreaker`,
        direction: "outbound",
        createdAt: icebreakerAt,
        fromName: "你",
        fromAddress: "@bytetech.export",
        content:
          "Hi Mike, thanks for connecting. We came across your profile in the steel import space and would love to learn more about your sourcing needs. If you're open to it, we'd be happy to share our latest catalog and competitive pricing.",
        contentZhOutbound:
          "Hi Mike，感谢通过好友请求。我们注意到您在钢材进口领域的背景，想进一步了解您的采购需求。如果您愿意，我们很乐意分享最新的产品目录和有竞争力的报价。",
        events: [{ type: "delivered", at: new Date(new Date(icebreakerAt).getTime() + 2 * 60_000).toISOString() }],
      });
    }
    const messages = [msg, ...extra, ...meta.inboundMessages, ...meta.extraMessages].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt),
    );
    const last = messages[messages.length - 1];
    return {
      id,
      targetKind: "contact" as const,
      targetId: f.targetId,
      targetName: f.name,
      channel,
      counterpartyAddress: f.handle,
      messages,
      meta,
      lastAt: last.createdAt,
      lastPreview: last.content.slice(0, 120),
      lastDirection: last.direction,
      isFriend: true,
      friendSource: f.sourceTaskName,
    } satisfies Thread;
  });
}

/* -------------------- Hooks -------------------- */

function useMetaVersion() {
  useSyncExternalStore(subscribe, getVersion, getVersion);
}

export function useThreads(): Thread[] {
  useMetaVersion();
  const entries = useLedger();
  const tasks = useProspectingTasks();
  const all = [...buildThreads(entries), ...getDemoSocialThreads(), ...getDemoSocialStatusThreads()];
  // 询盘与回复模块只呈现"已有客户回复"的会话——即包含至少一条 inbound 消息。
  // 仅发出、尚未收到回复的触达在「触达」模块跟进，不进入询盘视图。
  const withReply = all.filter((t) => t.meta.inboundMessages.length > 0);
  return sortByUrgency([
    ...withReply,
    ...buildFriendThreads(tasks),
    ...getDemoFriendPendingThreads(),
    ...getDemoFriendRemovedThreads(),
    ...getDemoTikTokThreads(),
  ]);
}

export function useThread(id: string): Thread | undefined {
  const list = useThreads();
  return list.find((t) => t.id === id);
}

export function getThreadsSnapshot(): Thread[] {
  const all = [...buildThreads(getAllLedger()), ...getDemoSocialThreads(), ...getDemoSocialStatusThreads()];
  return sortByUrgency([
    ...all.filter((t) => t.meta.inboundMessages.length > 0),
    ...buildFriendThreads(getProspectingTasksSnapshot()),
    ...getDemoFriendPendingThreads(),
    ...getDemoFriendRemovedThreads(),
    ...getDemoTikTokThreads(),
  ]);
}


/**
 * 默认排序：SLA 紧急度优先 → 最新更新
 * 优先级：逾期 > 即将超时 > 有 SLA 未风险 > 无 SLA / 已处理
 * 组内：逾期与即将超时按剩余时间升序（最紧急在前）；其余按 lastAt 降序
 */
function sortByUrgency(list: Thread[]): Thread[] {
  const scored = list.map((t) => {
    const sla = slaInfo(t);
    let bucket = 3;
    if (sla?.overdue) bucket = 0;
    else if (sla?.approaching) bucket = 1;
    else if (sla) bucket = 2;
    return { t, bucket, leftMs: sla?.leftMs ?? Number.POSITIVE_INFINITY };
  });
  scored.sort((a, b) => {
    if (a.bucket !== b.bucket) return a.bucket - b.bucket;
    if (a.bucket <= 1) return a.leftMs - b.leftMs; // 紧急桶：最紧急在前
    return b.t.lastAt.localeCompare(a.t.lastAt);
  });
  return scored.map((s) => s.t);
}

export interface InboxCounts {
  all: number;
  unread: number;
  pending: number;
  waiting: number;
  won: number;
  lost: number;
  snoozed: number;
  suppressed: number;
  hasReply: number;
  noReply: number;
  bounced: number;
  unassigned: number;
}

export function useInboxCounts(): InboxCounts {
  const list = useThreads();
  const c: InboxCounts = {
    all: list.length,
    unread: 0,
    pending: 0,
    waiting: 0,
    won: 0,
    lost: 0,
    snoozed: 0,
    suppressed: 0,
    hasReply: 0,
    noReply: 0,
    bounced: 0,
    unassigned: 0,
  };
  for (const t of list) {
    if (t.meta.unread > 0) c.unread++;
    if (t.meta.status === "pending") c.pending++;
    if (t.meta.status === "waiting_reply") c.waiting++;
    if (t.meta.status === "won") c.won++;
    if (t.meta.status === "lost") c.lost++;
    if (t.meta.status === "snoozed") c.snoozed++;
    if (t.meta.status === "suppressed") c.suppressed++;
    if (t.meta.inboundMessages.length > 0) c.hasReply++;
    else c.noReply++;
    if (!t.meta.assigneeId) c.unassigned++;
  }
  return c;
}

/** 供侧边栏轻量订阅未读 + 待跟进 徽标 */
export function useSidebarBadge(): { unread: number; pending: number } {
  const list = useThreads();
  let unread = 0;
  let pending = 0;
  for (const t of list) {
    if (t.meta.unread > 0) unread++;
    if (t.meta.status === "pending") pending++;
  }
  return { unread, pending };
}

/** 取某企业/联系人的最新会话（用于详情页胶囊卡） */
export function useLatestThreadFor(
  targetKind: "enterprise" | "contact",
  targetId: string,
): Thread | undefined {
  const list = useThreads();
  return list.find((t) => t.targetKind === targetKind && t.targetId === targetId);
}

/* -------------------- Actions -------------------- */

export function markThreadRead(id: string) {
  const m = metaStore[id];
  if (!m || m.unread === 0) return;
  m.unread = 0;
  m.updatedAt = new Date().toISOString();
  commit();
}

export function snoozeThread(id: string, ms: number) {
  const m = metaStore[id];
  if (!m) return;
  m.status = "snoozed";
  m.snoozeUntil = new Date(Date.now() + ms).toISOString();
  m.unread = 0;
  m.updatedAt = new Date().toISOString();
  commit();
}

export function closeThread(id: string, outcome: CloseOutcome) {
  const m = metaStore[id];
  if (!m) return;
  m.status = outcome;
  m.unread = 0;
  m.updatedAt = new Date().toISOString();
  commit();
}

/** 从"已成交/已流失"恢复到待跟进 */
export function reopenThread(id: string) {
  const m = metaStore[id];
  if (!m) return;
  m.status = "pending";
  m.updatedAt = new Date().toISOString();
  commit();
}

export function updateThreadProfile(
  id: string,
  patch: NonNullable<ThreadMeta["profile"]>,
) {
  const m = metaStore[id];
  if (!m) return;
  m.profile = { ...(m.profile ?? {}), ...patch };
  m.updatedAt = new Date().toISOString();
  commit();
}

export function addThreadNote(id: string, text: string, by = "我") {
  const m = metaStore[id];
  if (!m || !text.trim()) return;
  m.notes = [
    ...(m.notes ?? []),
    { id: makeId("note"), text: text.trim(), at: new Date().toISOString(), by },
  ];
  m.updatedAt = new Date().toISOString();
  commit();
}

export function removeThreadNote(id: string, noteId: string) {
  const m = metaStore[id];
  if (!m) return;
  m.notes = (m.notes ?? []).filter((n) => n.id !== noteId);
  commit();
}

export function toggleStar(id: string) {
  const m = metaStore[id];
  if (!m) return;
  m.starred = !m.starred;
  commit();
}

export function updateIntent(id: string, intent: AiIntent) {
  const m = metaStore[id];
  if (!m) return;
  m.aiIntent = intent;
  m.updatedAt = new Date().toISOString();
  commit();
}

export function addTag(id: string, tag: string) {
  const m = metaStore[id];
  if (!m) return;
  if (!m.tags.includes(tag)) m.tags.push(tag);
  commit();
}

export function removeTag(id: string, tag: string) {
  const m = metaStore[id];
  if (!m) return;
  m.tags = m.tags.filter((t) => t !== tag);
  commit();
}

export function enrollCadence(id: string, enrolled = true) {
  const m = metaStore[id];
  if (!m) return;
  m.cadenceEnrolled = enrolled;
  m.status = enrolled ? "in_cadence" : "pending";
  m.updatedAt = new Date().toISOString();
  commit();
}

/**
 * 人工接管闭环：
 * - 开启：写入接管标记；未分配则自动分配给当前员工并写入分配事件（原因=人工接管）；
 *   暂停跟进序列；清零未读；状态置为待跟进，便于员工立即回复。
 * - 撤销：清除接管标记，其它状态维持不变，交回自动流程。
 */
export function setHumanTakeover(
  id: string,
  on: boolean,
  opts?: { userId?: string; reason?: string },
) {
  const m = metaStore[id];
  if (!m) return;
  const now = new Date().toISOString();
  if (on) {
    const userId = opts?.userId || DEMO_CURRENT_USER;
    const member = memberById(userId);
    m.humanTakeover = {
      at: now,
      byId: userId,
      byName: member?.name || "当前员工",
      reason: opts?.reason,
    };
    if (!m.assigneeId) {
      const from = m.assigneeId;
      m.assigneeId = userId;
      m.assignee = member?.name;
      if (!m.assignmentEvents) m.assignmentEvents = [];
      m.assignmentEvents.push({
        id: makeId("ae"),
        from,
        to: userId,
        reason: opts?.reason || "人工接管",
        at: now,
      });
    }
    if (m.cadenceEnrolled) m.cadenceEnrolled = false;
    if (m.status === "in_cadence" || m.status === "snoozed") m.status = "pending";
    m.unread = 0;
  } else {
    m.humanTakeover = undefined;
  }
  m.updatedAt = now;
  commit();
}

export function suppressThread(id: string) {
  const m = metaStore[id];
  if (!m) return;
  m.status = "suppressed";
  m.unread = 0;
  m.updatedAt = new Date().toISOString();
  commit();
}

export function addTaskForThread(
  id: string,
  title: string,
  dueAt?: string,
) {
  const m = metaStore[id];
  if (!m) return;
  m.tasks.push({ id: makeId("tk"), title, dueAt, done: false });
  m.updatedAt = new Date().toISOString();
  commit();
}

export function toggleTask(id: string, taskId: string) {
  const m = metaStore[id];
  if (!m) return;
  const t = m.tasks.find((x) => x.id === taskId);
  if (t) t.done = !t.done;
  commit();
}

export function sendReply(input: {
  threadId: string;
  content: string;
  fromAddress: string;
  fromName?: string;
  subject?: string;
  aiGenerated?: boolean;
  contentZh?: string;
}) {

  const m = metaStore[input.threadId];
  if (!m) return;
  const now = new Date().toISOString();
  m.extraMessages.push({
    id: makeId("ob"),
    direction: "outbound",
    createdAt: now,
    fromName: input.fromName || "你",
    fromAddress: input.fromAddress,
    subject: input.subject,
    content: input.content,
    aiGenerated: input.aiGenerated,
    contentZhOutbound: input.contentZh,
    events: [{ type: "delivered", at: now }],
  });

  m.status = "waiting_reply";
  m.unread = 0;
  m.updatedAt = now;
  commit();
}

/* -------------------- Snooze presets -------------------- */

export const SNOOZE_PRESETS: Array<{ label: string; ms: number }> = [
  { label: "1 小时后", ms: 60 * 60_000 },
  { label: "明早 9:00", ms: nextMorningMs() },
  { label: "3 天后", ms: 3 * 24 * 3600_000 },
  { label: "下周一 9:00", ms: nextMondayMs() },
];
function nextMorningMs() {
  const d = new Date();
  const n = new Date(d);
  n.setDate(d.getDate() + 1);
  n.setHours(9, 0, 0, 0);
  return n.getTime() - d.getTime();
}
function nextMondayMs() {
  const d = new Date();
  const n = new Date(d);
  const day = d.getDay();
  const add = ((8 - day) % 7) || 7;
  n.setDate(d.getDate() + add);
  n.setHours(9, 0, 0, 0);
  return n.getTime() - d.getTime();
}

/* -------------------- Reset for dev/demo -------------------- */

export function resetInboxMeta() {
  metaStore = {};
  writeMeta(metaStore);
  if (typeof window !== "undefined") window.localStorage.removeItem(SEED_FLAG);
  emit();
}

/* -------------------- Assign (v2) -------------------- */

export function assignThread(
  id: string,
  userId: string | null,
  opts?: { reason?: string; crossGroup?: boolean; sendGreeting?: boolean },
) {
  const m = metaStore[id];
  if (!m) return;
  const from = m.assigneeId;
  m.assigneeId = userId ?? undefined;
  m.assignee = userId ? memberById(userId)?.name : undefined;
  const now = new Date().toISOString();
  m.updatedAt = now;
  if (!m.assignmentEvents) m.assignmentEvents = [];
  m.assignmentEvents.push({
    id: makeId("ae"),
    from,
    to: userId ?? undefined,
    reason: opts?.reason,
    crossGroup: opts?.crossGroup,
    greetingSent: opts?.sendGreeting,
    at: now,
  });
  if (opts?.sendGreeting && userId) {
    m.extraMessages.push({
      id: makeId("ob"),
      direction: "outbound",
      createdAt: now,
      fromName: memberById(userId)?.name || "你",
      fromAddress: "",
      content: `Hi, ${memberById(userId)?.name ?? "客服"} 接手您的会话，后续由我为您跟进，请随时提问。`,
      events: [{ type: "delivered", at: now }],
    });
  }
  commit();
}

/** 从事件历史中提取该会话上一次的跟进人（去重、最近优先） */
export function previousAssigneeIds(threadId: string): string[] {
  const m = metaStore[threadId];
  if (!m?.assignmentEvents) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = m.assignmentEvents.length - 1; i >= 0; i--) {
    const to = m.assignmentEvents[i].to;
    if (to && !seen.has(to) && to !== m.assigneeId) {
      seen.add(to);
      out.push(to);
    }
  }
  return out;
}

/** 计算 SLA 状态：基于最后一条 inbound 时间 + 分组首响阈值 */
export function slaInfo(t: Thread): {
  deadlineMs: number;
  leftMs: number;
  overdue: boolean;
  approaching: boolean;
} | null {
  if (
    t.meta.status === "won" ||
    t.meta.status === "lost" ||
    t.meta.status === "suppressed" ||
    t.meta.status === "snoozed"
  )
    return null;
  const lastIn = [...t.messages].reverse().find((m) => m.direction === "inbound");
  if (!lastIn) return null;
  const cfg = GROUP_SLA[threadGroup(t)];
  // 已分配后按"每次回复 SLA"；未分配按"首响 SLA"
  const budgetMs = t.meta.assigneeId
    ? cfg.replyHour * 3600_000
    : cfg.firstResponseMin * 60_000;
  const deadlineMs = new Date(lastIn.createdAt).getTime() + budgetMs;
  const leftMs = deadlineMs - Date.now();
  return {
    deadlineMs,
    leftMs,
    overdue: leftMs < 0,
    approaching: leftMs >= 0 && leftMs < budgetMs * 0.2,
  };
}

/* -------------------- Demo social threads (Phase 1 mock) -------------------- */

interface DemoSeed {
  id: string;
  channel: Channel;
  targetKind: "enterprise" | "contact";
  targetName: string;
  parentRef?: { id: string; name: string };
  counterparty: string;
  lastInbound: string;
  lastInboundZh?: string;
  hoursAgo: number;
  /** 剩余客服窗口小时数（覆盖默认计算） */
  windowLeftHours?: number | null;
  aiIntent?: AiIntent;
  assigneeId?: string;
  tags?: string[];
  socialSignals?: SocialSignals;
  /** 是否由用户手动添加（非系统推荐/非企业库选择） */
  manualAdd?: boolean;
}

const DEMO_SEEDS: DemoSeed[] = [
  {
    id: "demo:wa:1",
    channel: "whatsapp",
    targetKind: "contact",
    targetName: "Anna Müller",
    parentRef: { id: "demo-ent-1", name: "Bosch GmbH" },
    counterparty: "+491701234567",
    lastInbound: "Hi, could you send the pricing PDF for SKU-A?",
    lastInboundZh: "你好，可否发一份 SKU-A 的报价 PDF 给我？",
    hoursAgo: 2,
    aiIntent: "quote",
    tags: ["高意向"],
    manualAdd: true,
  },
  {
    id: "demo:wa:2",
    channel: "whatsapp",
    targetKind: "enterprise",
    targetName: "Rakuten Global",
    counterparty: "+81901234567",
    lastInbound: "こんにちは、サンプル送付は可能ですか？",
    lastInboundZh: "你好，请问可以寄样品吗？",
    hoursAgo: 3,
    windowLeftHours: null, // 窗口已过期
    aiIntent: "interested",
    assigneeId: "u_li",
  },
  {
    id: "demo:tg:1",
    channel: "telegram",
    targetKind: "contact",
    targetName: "Ivan Petrov",
    parentRef: { id: "demo-ent-2", name: "TechnoPolymer LLC" },
    counterparty: "@ivanp",
    lastInbound: "Interested, please share catalog.",
    lastInboundZh: "有兴趣，请把产品目录发给我。",
    hoursAgo: 5,
    aiIntent: "interested",
    manualAdd: true,
  },
  {
    id: "demo:fb:1",
    channel: "facebook",
    targetKind: "contact",
    targetName: "María López",
    parentRef: { id: "demo-ent-3", name: "Grupo Andino" },
    counterparty: "psid:1234567890",
    lastInbound: "¿Cuál es el precio FOB Shanghai?",
    lastInboundZh: "FOB 上海的价格是多少？",
    hoursAgo: 10,
    aiIntent: "quote",
    socialSignals: { accountAgeDays: 640, hasAvatar: true, followers: 312, postsCount: 87 },
  },
  {
    id: "demo:tt:1",
    channel: "tiktok",
    targetKind: "contact",
    targetName: "@sofia_home",
    counterparty: "openid:tt_9876",
    lastInbound: "Do you ship to US?",
    lastInboundZh: "你们发货到美国吗？",
    hoursAgo: 2,
    aiIntent: "interested",
    assigneeId: "u_wang",
    socialSignals: { accountAgeDays: 420, hasAvatar: true, followers: 1240, postsCount: 46 },
  },
  // ---- 社媒渠道真实度专项 mock（P1，触发 S001-S004） ----
  {
    id: "demo:auth:fb-new",
    channel: "facebook",
    targetKind: "contact",
    targetName: "John Buyer",
    counterparty: "psid:9998887771",
    lastInbound: "Hi, please send price list and MOQ, we plan a big order.",
    lastInboundZh: "你好，请发送价格表与起订量，我们计划下大单。",
    hoursAgo: 6,
    aiIntent: "quote",
    tags: ["真实度样本", "社媒新号"],
    socialSignals: { accountAgeDays: 9, hasAvatar: false, followers: 3, postsCount: 0 },
  },
  {
    id: "demo:auth:tt-zombie",
    channel: "tiktok",
    targetKind: "contact",
    targetName: "@buyer_x88",
    counterparty: "openid:tt_zombie_01",
    lastInbound: "Interested, send catalog to my WhatsApp +8613100001111.",
    lastInboundZh: "有意向，请把目录发到我 WhatsApp +8613100001111。",
    hoursAgo: 4,
    aiIntent: "interested",
    tags: ["真实度样本", "僵尸粉"],
    socialSignals: { accountAgeDays: 210, hasAvatar: true, followers: 4, postsCount: 0 },
  },
  {
    id: "demo:auth:fb-broadcast",
    channel: "facebook",
    targetKind: "contact",
    targetName: "Group Buyer 01",
    counterparty: "psid:5551110001",
    lastInbound: "Send me best price for bulk order 1,000,000 USD. Reply ASAP.",
    lastInboundZh: "请发送百万美金大单最优价，尽快回复。",
    hoursAgo: 3,
    aiIntent: "quote",
    tags: ["真实度样本", "批量转发"],
    socialSignals: {
      accountAgeDays: 55,
      hasAvatar: true,
      followers: 21,
      postsCount: 2,
      duplicateBroadcastCount: 6,
    },
  },
  // -------- Email replies (3) --------
  {
    id: "demo:em:1",
    channel: "email",
    targetKind: "contact",
    targetName: "James Carter",
    parentRef: { id: "demo-ent-4", name: "Carter & Sons Ltd." },
    counterparty: "james.carter@carterandsons.co.uk",
    lastInbound:
      "Thanks for the quotation. Could you confirm MOQ for SKU-B and the lead time if we order 5,000 pcs? We'd also need CE certificates.",
    lastInboundZh:
      "感谢报价。请确认 SKU-B 的起订量，以及订购 5,000 件的交期。我们同时需要 CE 认证文件。",
    hoursAgo: 4,
    aiIntent: "quote",
    tags: ["高意向", "待报价"],
  },
  {
    id: "demo:em:2",
    channel: "email",
    targetKind: "enterprise",
    targetName: "Nordic Retail AB",
    counterparty: "purchasing@nordicretail.se",
    lastInbound:
      "Hello, we received your samples last week. Quality looks good. Please send the FOB Shanghai price list and payment terms for a trial order.",
    lastInboundZh:
      "你好，上周已收到样品，品质不错。请发送 FOB 上海价格表及首单付款条件。",
    hoursAgo: 20,
    aiIntent: "interested",
    assigneeId: "u_li",
    tags: ["试单"],
  },
  {
    id: "demo:em:3",
    channel: "email",
    targetKind: "contact",
    targetName: "Ahmed Al-Farsi",
    parentRef: { id: "demo-ent-5", name: "Gulf Trading Co." },
    counterparty: "ahmed@gulftrading.ae",
    lastInbound:
      "Please share the updated catalog in PDF. We are planning an order before end of Q3.",
    lastInboundZh:
      "请发送最新的 PDF 产品目录。我们计划在三季度末前下单。",
    hoursAgo: 6,
    aiIntent: "interested",
  },
  // -------- SMS replies (2) --------
  {
    id: "demo:sms:1",
    channel: "sms",
    targetKind: "contact",
    targetName: "David Kim",
    parentRef: { id: "demo-ent-6", name: "Kim Electronics" },
    counterparty: "+8210123456789",
    lastInbound: "Received. Please call me tomorrow 10am KST to discuss pricing.",
    lastInboundZh: "已收到，请明早 10 点（韩国时间）致电洽谈价格。",
    hoursAgo: 3,
    aiIntent: "quote",
    tags: ["待回电"],
  },
  {
    id: "demo:sms:2",
    channel: "sms",
    targetKind: "contact",
    targetName: "Laura Bianchi",
    parentRef: { id: "demo-ent-7", name: "Milano Home" },
    counterparty: "+393471234567",
    lastInbound: "Ok grazie, invia proforma per 200 pezzi SKU-C.",
    lastInboundZh: "好的，谢谢，请发送 200 件 SKU-C 的形式发票。",
    hoursAgo: 1,
    aiIntent: "quote",
  },
  // -------- 非高意向样本：让"高意向"过滤不再等于"全部" --------
  {
    id: "demo:em:4",
    channel: "email",
    targetKind: "contact",
    targetName: "Pierre Dubois",
    parentRef: { id: "demo-ent-8", name: "Lyon Distribution" },
    counterparty: "p.dubois@lyondistrib.fr",
    lastInbound:
      "I'm out of the office until August 5 with limited access to email. For urgent matters please contact my colleague marie@lyondistrib.fr.",
    lastInboundZh:
      "8 月 5 日前休假，邮件回复延迟。紧急事宜请联系同事 marie@lyondistrib.fr。",
    hoursAgo: 7,
    aiIntent: "ooo",
  },
  {
    id: "demo:em:5",
    channel: "email",
    targetKind: "enterprise",
    targetName: "Copenhagen Wholesale",
    counterparty: "sourcing@cphwholesale.dk",
    lastInbound:
      "Thanks for reaching out. We've already committed to another supplier for this category — no need to follow up further.",
    lastInboundZh:
      "感谢来信，此类目我们已与其他供应商合作，无需再跟进。",
    hoursAgo: 14,
    aiIntent: "reject",
  },
  // -------- AI 真实度评分专项 mock：固定展示不同分值，避免依赖随机 ledger seed --------
  {
    id: "demo:auth:template-light",
    channel: "email",
    targetKind: "contact",
    targetName: "Ravi Sharma",
    parentRef: { id: "demo-auth-ent-1", name: "Mumbai Trade House" },
    counterparty: "ravi.sharma@mumbaitrade.in",
    lastInbound:
      "Dear Sir/Madam, we are interested in your products. Please send catalog. Thanks.",
    lastInboundZh: "Dear Sir/Madam，我们对贵司产品感兴趣，请发送目录。谢谢。",
    hoursAgo: 8,
    aiIntent: "quote",
    tags: ["真实度样本", "轻扣分"],
  },
  {
    id: "demo:auth:free-big-stack",
    channel: "email",
    targetKind: "enterprise",
    targetName: "Global Trade Procurement",
    counterparty: "global.trade.buyer@hotmail.com",
    lastInbound:
      "Dear Purchasing Manager, our group corporation urgently needs 3 million USD order. Please send full price list and BOM breakdown ASAP.",
    lastInboundZh:
      "Dear Purchasing Manager，我集团急需 300 万美金订单，请尽快发送完整报价单与 BOM 明细。",
    hoursAgo: 9,
    aiIntent: "quote",
    tags: ["真实度样本", "多规则叠加"],
  },
  {
    id: "demo:auth:intel-personal",
    channel: "email",
    targetKind: "contact",
    targetName: "Kofi Mensah",
    parentRef: { id: "demo-auth-ent-2", name: "Accra Sourcing Desk" },
    counterparty: "quick.deal.2026@gmail.com",
    lastInbound:
      "Please share your customer list and full price list for evaluation. We can pay 100% TT prepay to personal account for the first order to speed things up.",
    lastInboundZh:
      "请提供客户名单与完整报价单用于评估，为加快进度首单可 100% 前 T/T 至个人账户。",
    hoursAgo: 11,
    aiIntent: "quote",
    tags: ["真实度样本", "高危"],
  },
  {
    id: "demo:auth:disposable",
    channel: "email",
    targetKind: "enterprise",
    targetName: "Euro Bulk Distributor",
    counterparty: "buyer_9921@mailinator.com",
    lastInbound:
      "Hi, we are a large European distributor and we'd like to discuss a bulk order for your catalog. Please share pricing.",
    lastInboundZh: "我们是欧洲大型分销商，希望批量采购贵司产品，请提供报价。",
    hoursAgo: 13,
    aiIntent: "quote",
    tags: ["真实度样本", "硬规则"],
  },
  {
    id: "demo:wa:3",
    channel: "whatsapp",
    targetKind: "contact",
    targetName: "Ken Watanabe",
    parentRef: { id: "demo-ent-9", name: "Tokyo Retail" },
    counterparty: "+81801122334",
    lastInbound: "Got it, thanks.",
    lastInboundZh: "收到，谢谢。",
    hoursAgo: 4,
    // 低信号确认，AI 未打意向标签
  },
];

export function getDemoSocialThreads(): Thread[] {
  const now = Date.now();
  return DEMO_SEEDS.map((s) => {
    const meta = ensureMeta(
      s.id,
      new Date(now - s.hoursAgo * 3600_000).toISOString(),
    );
    // 首次注入默认值
    if (meta.inboundMessages.length === 0) {
      const at = new Date(now - s.hoursAgo * 3600_000).toISOString();
      meta.inboundMessages.push({
        id: makeId("in"),
        direction: "inbound",
        createdAt: at,
        fromName: s.targetName,
        fromAddress: s.counterparty,
        content: s.lastInbound,
        contentZh: s.lastInboundZh && !isChinese(s.lastInbound) ? s.lastInboundZh : undefined,
      });
      meta.aiIntent = s.aiIntent;
      meta.unread = 1;
      meta.status = "pending";
      if (s.tags) meta.tags = [...s.tags];
      if (s.assigneeId) {
        meta.assigneeId = s.assigneeId;
        meta.assignee = memberById(s.assigneeId)?.name;
      }
      // 客服窗口
      const winH = WINDOW_HOURS[s.channel];
      if (winH !== undefined) {
        if (s.windowLeftHours === null) {
          meta.windowExpiresAt = new Date(now - 3600_000).toISOString(); // 已过期
        } else {
          const leftH = s.windowLeftHours ?? Math.max(1, winH - s.hoursAgo);
          meta.windowExpiresAt = new Date(now + leftH * 3600_000).toISOString();
        }
      }
      writeMeta(metaStore);
    }
    // 回填：早期版本没有 contentZh 字段，此处按 seed 补齐（仅演示种子的第一条入站）。
    if (s.lastInboundZh && !isChinese(s.lastInbound) && meta.inboundMessages[0] && !meta.inboundMessages[0].contentZh) {
      meta.inboundMessages[0].contentZh = s.lastInboundZh;
      writeMeta(metaStore);
    }
    return {
      id: s.id,
      targetKind: s.targetKind,
      targetId: s.id,
      targetName: s.targetName,
      parentRef: s.parentRef,
      channel: s.channel,
      counterpartyAddress: s.counterparty,
      messages: [...meta.inboundMessages, ...meta.extraMessages].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      ),
      meta,
      lastAt: meta.updatedAt,
      lastPreview: s.lastInbound.slice(0, 120),
      lastDirection: (meta.extraMessages[meta.extraMessages.length - 1]?.direction ??
        "inbound") as "inbound" | "outbound",
      socialSignals: s.socialSignals,
      manualAdd: s.manualAdd,
    };
  });
}