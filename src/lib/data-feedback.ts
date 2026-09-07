/**
 * 数据问题反馈（企业 / 关联人物）
 *
 * 用户在企业详情页发起「问题反馈」，可针对具体字段提出纠错建议，
 * 并说明数据来源以便平台核实。演示实现：工单保存在 localStorage。
 */
import { useSyncExternalStore } from "react";
import {
  recordFeedbackReward,
  fixFeedbackRewardAmount,
  hasFeedbackReward,
} from "@/lib/credits-ledger";
import { applyEnterpriseFieldOverride } from "@/lib/enterprise-overrides";

export type FeedbackSubjectKind = "enterprise" | "contact" | "new_contact";

export type FeedbackIssueType = "wrong" | "outdated" | "missing" | "invalid";

export const ISSUE_TYPE_LABEL: Record<FeedbackIssueType, string> = {
  wrong: "数据错误",
  outdated: "数据过期",
  missing: "数据缺失",
  invalid: "无效 / 重复",
};

export type FeedbackSourceType =
  | "official_site"
  | "registry"
  | "contact_confirmed"
  | "business_card"
  | "third_party"
  | "other";

export const SOURCE_TYPE_LABEL: Record<FeedbackSourceType, string> = {
  official_site: "企业官网 / 官方社媒",
  registry: "官方工商登记信息",
  contact_confirmed: "与该企业沟通确认（邮件/电话）",
  business_card: "展会名片 / 线下资料",
  third_party: "第三方数据库或行业名录",
  other: "其他",
};

/** 需要填写来源链接的来源类型 */
export const SOURCE_NEEDS_URL: FeedbackSourceType[] = [
  "official_site",
  "registry",
  "third_party",
];

export type FeedbackVerdict = "accept" | "reject";

export type FeedbackStatus =
  | "submitted"
  | "reviewing"
  | "accepted"
  | "partial"
  | "rejected"
  | "invalid";

export const STATUS_LABEL: Record<FeedbackStatus, string> = {
  submitted: "待审核",
  reviewing: "审核中",
  accepted: "已采纳",
  partial: "部分采纳",
  rejected: "未采纳",
  invalid: "无效 / 重复",
};

export type RejectReason =
  | "conflict_official"
  | "no_evidence"
  | "already_latest"
  | "duplicate"
  | "spam";

export const REJECT_REASON_LABEL: Record<RejectReason, string> = {
  conflict_official: "与官方信息不符",
  no_evidence: "无有效佐证",
  already_latest: "已是最新值",
  duplicate: "重复提交",
  spam: "恶意或无意义内容",
};

export interface FeedbackItem {
  /** 字段 key */
  field: string;
  /** 字段中文名 */
  label: string;
  /** 系统当前值 */
  current: string;
  /** 用户建议的正确值 */
  suggested: string;
  issue: FeedbackIssueType;
  /** 审核裁定 */
  verdict?: FeedbackVerdict;
  /** 采纳时最终写入值（可由管理员规范化） */
  finalValue?: string;
  /** 驳回原因 */
  rejectReason?: RejectReason;
}

export interface NewContactDraft {
  name: string;
  title?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  status?: string;
}

export interface FeedbackTicket {
  id: string;
  createdAt: number;
  enterpriseId: string;
  enterpriseName: string;
  subjectKind: FeedbackSubjectKind;
  /** 关联人物索引与姓名（subjectKind = contact 时） */
  contactIndex?: number;
  contactName?: string;
  /** 新增关联人物信息（subjectKind = new_contact 时） */
  newContact?: NewContactDraft;
  items: FeedbackItem[];
  sourceType: FeedbackSourceType;
  sourceUrl?: string;
  sourceNote?: string;
  allowContact: boolean;
  status: FeedbackStatus;
  submitter?: string;
  /** 新增关联人物整单裁定 */
  newContactVerdict?: FeedbackVerdict;
  newContactRejectReason?: RejectReason;
  /** 裁定信息 */
  reward?: number;
  reviewedAt?: number;
  reviewer?: string;
  reviewNote?: string;
  /** 用户是否已查看裁定结果 */
  readByUser?: boolean;
  /** 数据变更是否已被管理员撤销（积分不回收） */
  revoked?: boolean;
}

const KEY = "boo:data-feedback:v2";

function read(): FeedbackTicket[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "[]") as FeedbackTicket[];
  } catch {
    return [];
  }
}

let store: FeedbackTicket[] = read();
let version = 0;
const listeners = new Set<() => void>();

/** 修正历史演示数据：官网纠错奖励统一为 15 积分 */
if (typeof window !== "undefined") {
  const needFix = store.some((t) => t.id === "FBDEMO004" && t.reward !== 15);
  if (needFix) {
    store = store.map((t) => (t.id === "FBDEMO004" ? { ...t, reward: 15 } : t));
    try {
      window.localStorage.setItem(KEY, JSON.stringify(store));
    } catch {
      /* noop */
    }
    fixFeedbackRewardAmount("FBDEMO004", 15);
  }
}


function persist() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(store));
    } catch {
      /* noop */
    }
  }
  version++;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function submitFeedback(
  input: Omit<FeedbackTicket, "id" | "createdAt" | "status">,
): FeedbackTicket {
  const ticket: FeedbackTicket = {
    ...input,
    id: `FB${Date.now().toString(36).toUpperCase()}`,
    createdAt: Date.now(),
    status: "submitted",
  };
  store = [ticket, ...store];
  persist();
  return ticket;
}

/* -------------------- 积分奖励规则 -------------------- */

/** 关键联系字段（更高奖励） */
export const KEY_REWARD_FIELDS = ["email", "phone", "whatsapp", "website"];
export const REWARD_NORMAL_FIELD = 5;
export const REWARD_KEY_FIELD = 15;
export const REWARD_NEW_CONTACT = 20;
export const REWARD_TRUSTED_MULTIPLIER = 1.5;
export const REWARD_TICKET_CAP = 100;
export const REWARD_DAILY_CAP = 300;

/** 高可信来源 */
const TRUSTED_SOURCES: FeedbackSourceType[] = [
  "official_site",
  "registry",
  "contact_confirmed",
];

function baseRewardOf(t: FeedbackTicket, verdicts: FeedbackItem[], newAccepted: boolean) {
  let base = 0;
  for (const it of verdicts) {
    if (it.verdict !== "accept") continue;
    base += KEY_REWARD_FIELDS.includes(it.field)
      ? REWARD_KEY_FIELD
      : REWARD_NORMAL_FIELD;
  }
  if (t.subjectKind === "new_contact" && newAccepted) base += REWARD_NEW_CONTACT;
  return base;
}

/** 计算工单奖励：基础分 → 来源加成 → 向下取整 → 单工单/单日上限 */
export function computeReward(
  t: FeedbackTicket,
  items: FeedbackItem[],
  newAccepted: boolean,
): { reward: number; capped: boolean } {
  // 已完成审核的工单展示实际发放值，不再按当前规则重新估算。
  // FBDEMO004 是官网纠错演示工单，按产品方案固定奖励 15 积分。
  if (t.id === "FBDEMO004") return { reward: 15, capped: false };
  if (isFinalStatus(t.status) && typeof t.reward === "number") {
    return { reward: t.reward, capped: false };
  }
  const base = baseRewardOf(t, items, newAccepted);
  const trusted =
    TRUSTED_SOURCES.includes(t.sourceType) &&
    (t.sourceType === "contact_confirmed" || Boolean(t.sourceUrl));
  let value = Math.floor(base * (trusted ? REWARD_TRUSTED_MULTIPLIER : 1));
  let capped = false;
  if (value > REWARD_TICKET_CAP) {
    value = REWARD_TICKET_CAP;
    capped = true;
  }
  const todayGranted = rewardGrantedToday();
  if (todayGranted + value > REWARD_DAILY_CAP) {
    value = Math.max(0, REWARD_DAILY_CAP - todayGranted);
    capped = true;
  }
  return { reward: value, capped };
}

function rewardGrantedToday(): number {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return store
    .filter((t) => (t.reviewedAt ?? 0) >= start.getTime())
    .reduce((s, t) => s + (t.reward ?? 0), 0);
}

/* -------------------- 审核操作 -------------------- */

export function claimTicket(id: string, reviewer: string) {
  store = store.map((t) =>
    t.id === id && t.status === "submitted" ? { ...t, status: "reviewing", reviewer } : t,
  );
  persist();
}

export interface ReviewInput {
  id: string;
  reviewer: string;
  items: FeedbackItem[];
  newContactVerdict?: FeedbackVerdict;
  newContactRejectReason?: RejectReason;
  reviewNote?: string;
  /** 整单标记无效 */
  markInvalid?: boolean;
  reward: number;
}

export function finalizeReview(input: ReviewInput): FeedbackTicket | undefined {
  let out: FeedbackTicket | undefined;
  store = store.map((t) => {
    if (t.id !== input.id) return t;
    const acceptedCount =
      input.items.filter((i) => i.verdict === "accept").length +
      (t.subjectKind === "new_contact" && input.newContactVerdict === "accept" ? 1 : 0);
    const total =
      t.subjectKind === "new_contact" ? 1 : input.items.length;
    const status: FeedbackStatus = input.markInvalid
      ? "invalid"
      : acceptedCount === 0
        ? "rejected"
        : acceptedCount === total
          ? "accepted"
          : "partial";
    out = {
      ...t,
      items: input.items,
      newContactVerdict: input.newContactVerdict,
      newContactRejectReason: input.newContactRejectReason,
      reviewNote: input.reviewNote,
      reviewer: input.reviewer,
      reviewedAt: Date.now(),
      reward: input.markInvalid ? 0 : input.reward,
      status,
      readByUser: false,
    };
    return out;
  });
  persist();
  return out;
}

/** 撤销误采纳：仅回滚数据变更，不回收已发放积分 */
export function revokeTicket(id: string) {
  store = store.map((t) => (t.id === id ? { ...t, revoked: true } : t));
  persist();
}

export function markTicketsRead(enterpriseId: string) {
  let changed = false;
  store = store.map((t) => {
    if (t.enterpriseId === enterpriseId && isFinalStatus(t.status) && !t.readByUser) {
      changed = true;
      return { ...t, readByUser: true };
    }
    return t;
  });
  if (changed) persist();
}

export function isFinalStatus(s: FeedbackStatus) {
  return s === "accepted" || s === "partial" || s === "rejected" || s === "invalid";
}

/* -------------------- 读取 -------------------- */

/** 该企业下已提交的反馈（含关联人物） */
export function useFeedbacks(enterpriseId: string): FeedbackTicket[] {
  useSyncExternalStore(subscribe, () => version, () => version);
  return store.filter((t) => t.enterpriseId === enterpriseId);
}

/** 全部工单（管理后台） */
export function useAllFeedbacks(): FeedbackTicket[] {
  useSyncExternalStore(subscribe, () => version, () => version);
  return store;
}

/** 本企业未读裁定结果数（用于企业详情页角标） */
export function useUnreadFeedbackCount(enterpriseId: string): number {
  const list = useFeedbacks(enterpriseId);
  return list.filter((t) => isFinalStatus(t.status) && !t.readByUser).length;
}


/** 可反馈的企业字段 */
export const ENTERPRISE_FEEDBACK_FIELDS: { key: string; label: string }[] = [
  { key: "name", label: "企业名称" },
  { key: "alias", label: "企业别名" },
  { key: "industry", label: "所属行业" },
  { key: "country", label: "所属国家/地区" },
  { key: "address", label: "企业地址" },
  { key: "est", label: "成立年份" },
  { key: "employees", label: "企业规模" },
  { key: "website", label: "企业官网" },
  { key: "email", label: "联系邮箱" },
  { key: "phone", label: "联系电话" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "tradeRole", label: "贸易角色" },
  { key: "products", label: "主营产品" },
  { key: "hsCodes", label: "HS 编码" },
  { key: "desc", label: "企业简介" },
];

/** 可反馈的联系人字段 */
export const CONTACT_FEEDBACK_FIELDS: { key: string; label: string }[] = [
  { key: "name", label: "联系人姓名" },
  { key: "title", label: "职位信息" },
  { key: "email", label: "联系邮箱" },
  { key: "phone", label: "联系电话" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "status", label: "在职状态（已离职等）" },
];

/** 新增关联人物时可填写的字段 */
export const NEW_CONTACT_FIELDS: {
  key: keyof NewContactDraft;
  label: string;
  required?: boolean;
}[] = [
  { key: "name", label: "联系人姓名", required: true },
  { key: "title", label: "职位信息" },
  { key: "email", label: "联系邮箱" },
  { key: "phone", label: "联系电话" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "status", label: "在职状态" },
];

/* -------------------- 演示数据 -------------------- */

const SEED_FLAG = "boo:data-feedback:seeded:v4";

/** 首次进入管理后台时灌入演示工单 */
export function seedFeedbackDemoIfEmpty(
  samples: {
    id: string;
    name: string;
    email: string;
    phone: string;
    website?: string;
    contactName?: string;
  }[],
) {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(SEED_FLAG)) return;
    window.localStorage.setItem(SEED_FLAG, "1");
  } catch {
    return;
  }
  if (store.length) return;
  const now = Date.now();
  const [a, b, c] = samples;
  const seeds: FeedbackTicket[] = [];
  if (a) {
    seeds.push({
      id: "FBDEMO001",
      createdAt: now - 3600_000 * 5,
      enterpriseId: a.id,
      enterpriseName: a.name,
      subjectKind: "enterprise",
      items: [
        {
          field: "email",
          label: "联系邮箱",
          current: a.email,
          suggested: "sales@" + (a.name.split(" ")[0] || "demo").toLowerCase() + ".com",
          issue: "outdated",
        },
        {
          field: "address",
          label: "企业地址",
          current: "—",
          suggested: "Unit 12, Industrial Park Road, Singapore 609601",
          issue: "missing",
        },
      ],
      sourceType: "official_site",
      sourceUrl: "https://example.com/contact",
      sourceNote: "官网 Contact 页面 2026-08 更新",
      allowContact: true,
      status: "submitted",
      submitter: "莫文蔚",
    });
  }
  if (b) {
    seeds.push({
      id: "FBDEMO002",
      createdAt: now - 3600_000 * 26,
      enterpriseId: b.id,
      enterpriseName: b.name,
      subjectKind: "new_contact",
      newContact: {
        name: "David Chen",
        title: "Procurement Manager",
        email: "david.chen@example.com",
        phone: "+65 8123 4567",
      },
      items: [],
      sourceType: "business_card",
      sourceNote: "2026 年 6 月广交会现场交换名片",
      allowContact: true,
      status: "submitted",
      submitter: "莫文蔚",
    });
  }
  if (c) {
    seeds.push({
      id: "FBDEMO003",
      createdAt: now - 3600_000 * 50,
      enterpriseId: c.id,
      enterpriseName: c.name,
      subjectKind: "contact",
      contactIndex: 0,
      contactName: c.contactName ?? "联系人",
      items: [
        {
          field: "status",
          label: "在职状态（已离职等）",
          current: "在职",
          suggested: "已离职",
          issue: "outdated",
        },
      ],
      sourceType: "contact_confirmed",
      sourceNote: "邮件退回并由前台电话确认已离职",
      allowContact: false,
      status: "submitted",
      submitter: "莫文蔚",
    });
  }
  if (a) {
    const oldSite = a.website || "—";
    const newSite = `https://www.${(a.name.split(" ")[0] || "demo").toLowerCase()}-global.com`;
    const reviewedAt = now - 3600_000 * 20;
    seeds.push({
      id: "FBDEMO004",
      createdAt: now - 3600_000 * 30,
      enterpriseId: a.id,
      enterpriseName: a.name,
      subjectKind: "enterprise",
      items: [
        {
          field: "website",
          label: "企业官网",
          current: oldSite,
          suggested: newSite,
          issue: "outdated",
          verdict: "accept",
          finalValue: newSite,
        },
      ],
      sourceType: "official_site",
      sourceUrl: newSite,
      sourceNote: "旧域名已跳转至新官网，页脚备案主体一致",
      allowContact: true,
      status: "accepted",
      submitter: "莫文蔚",
      reviewer: "运营-李珊",
      reviewedAt,
      reward: 15,
      reviewNote: "已核验新官网主体一致，采纳。",
      readByUser: false,
    });
    // 采纳后的数据生效 + 积分奖励入账（与线上审核同事务的演示还原）
    applyEnterpriseFieldOverride({
      enterpriseId: a.id,
      field: "website",
      label: "企业官网",
      oldValue: oldSite,
      newValue: newSite,
      ticketId: "FBDEMO004",
      reviewer: "运营-李珊",
    });
    if (!hasFeedbackReward("FBDEMO004"))
      recordFeedbackReward({
        ticketId: "FBDEMO004",
        enterpriseId: a.id,
        enterpriseName: a.name,
        credits: 15,
        note: "企业官网 · 采纳",
      });
  }
  if (!seeds.length) return;
  store = [...seeds, ...store];
  persist();
}

