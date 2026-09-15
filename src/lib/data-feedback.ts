/**
 * 数据问题反馈（企业 / 关联人物）
 *
 * 用户在企业详情页发起「问题反馈」，可针对具体字段提出纠错建议，
 * 并说明数据来源以便平台核实。演示实现：工单保存在 localStorage。
 */
import { useSyncExternalStore } from "react";
import { applyEnterpriseFieldOverride } from "@/lib/enterprise-overrides";


export type FeedbackSubjectKind = "enterprise" | "contact" | "new_contact";

export type FeedbackIssueType = "wrong" | "outdated" | "missing" | "invalid";

export const ISSUE_TYPE_LABEL: Record<FeedbackIssueType, string> = {
  wrong: "数据错误",
  outdated: "数据过期",
  missing: "数据缺失",
  invalid: "重复 / 冒充数据",
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
  invalid: "无效工单",
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

/** 撤销裁定的业务原因（必填，用于留痕） */
export type RevokeReason = "reviewer_mistake" | "evidence_overturned" | "bad_data";

export const REVOKE_REASON_LABEL: Record<RevokeReason, string> = {
  reviewer_mistake: "审核员误操作（看错佐证 / 最终值填错）",
  evidence_overturned: "佐证事后被推翻（官网改回 / 企业本人否认）",
  bad_data: "采纳内容为无效或恶意数据",
};

/** 认领后无人处理的自动释放时长（分钟） */
export const CLAIM_TIMEOUT_MINUTES = 30;

export interface FeedbackItem {
  /** 字段 key */
  field: string;
  /** 字段中文名 */
  label: string;
  /** 系统当前值 */
  current: string;
  /** 用户建议的正确值 */
  suggested?: string;
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
  reviewedAt?: number;
  reviewer?: string;
  reviewNote?: string;
  /** 用户是否已查看裁定结果 */
  readByUser?: boolean;
  /** 当前「审核中」状态是否由撤销产生（重新裁定后清除） */
  revoked?: boolean;
  /** 撤销次数（永久保留，用于审计留痕） */
  revokeCount?: number;
  /** 认领时间，用于超时自动释放 */
  claimedAt?: number;
  /** 撤销前的历史裁定快照（审计用） */
  reviewHistory?: Array<{
    status: FeedbackStatus;
    reviewedAt?: number;
    reviewer?: string;
    reviewNote?: string;
    /** 撤销原因与操作人 */
    revokeReason?: RevokeReason;
    revokedAt?: number;
    revokedBy?: string;
  }>;
}

const KEY = "boo:data-feedback:v2";

const SUPPORTED_ENTERPRISE_FIELDS = new Set([
  "name",
  "alias",
  "industry",
  "country",
  "address",
  "est",
  "employees",
  "website",
  "email",
  "phone",
  "whatsapp",
]);
const SUPPORTED_CONTACT_FIELDS = new Set(["name", "title", "email", "phone", "whatsapp"]);

function withoutRemovedFields(tickets: FeedbackTicket[]): FeedbackTicket[] {
  return tickets.map((ticket) => {
    const allowed =
      ticket.subjectKind === "enterprise"
        ? SUPPORTED_ENTERPRISE_FIELDS
        : SUPPORTED_CONTACT_FIELDS;
    if (ticket.subjectKind === "new_contact") {
      const { status: _removedStatus, ...newContact } = (ticket.newContact ?? {}) as NewContactDraft & {
        status?: string;
      };
      return { ...ticket, newContact: newContact as NewContactDraft };
    }
    return { ...ticket, items: ticket.items.filter((item) => allowed.has(item.field)) };
  });
}

function read(): FeedbackTicket[] {
  if (typeof window === "undefined") return [];
  try {
    const tickets = JSON.parse(window.localStorage.getItem(KEY) || "[]") as FeedbackTicket[];
    return withoutRemovedFields(tickets);
  } catch {
    return [];
  }
}

let store: FeedbackTicket[] = read();
let version = 0;
const listeners = new Set<() => void>();




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
    items: input.items.map((item) => ({
      ...item,
      suggested: item.suggested?.trim() || undefined,
    })),
    id: `FB${Date.now().toString(36).toUpperCase()}`,
    createdAt: Date.now(),
    status: "submitted",
  };
  store = [ticket, ...store];
  persist();
  return ticket;
}

/* -------------------- 数据质量规则 -------------------- */

/** 重复提交判定窗口（天） */
export const DUPLICATE_WINDOW_DAYS = 30;

/** 值等价归一：忽略大小写、首尾空格、连续空格与末尾斜杠 */
export function normalizeValue(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, " ").replace(/\/+$/, "");
}

/** 两个值是否等价（用于「与当前值一致」的无效提交拦截） */
export function isEquivalentValue(a: string, b: string): boolean {
  return normalizeValue(a) === normalizeValue(b) && normalizeValue(a) !== "";
}

/**
 * 近 DUPLICATE_WINDOW_DAYS 天内、同企业同主体已提交过且尚未出结论（或已采纳）的字段集合。
 * 用于阻止同一问题被反复提交。
 */
export function recentlySubmittedFields(
  tickets: FeedbackTicket[],
  subjectKind: FeedbackSubjectKind,
  contactIndex?: number,
): Set<string> {
  const since = Date.now() - DUPLICATE_WINDOW_DAYS * 86400_000;
  const out = new Set<string>();
  for (const t of tickets) {
    if (t.subjectKind !== subjectKind) continue;
    if (subjectKind === "contact" && t.contactIndex !== contactIndex) continue;
    if (t.createdAt < since) continue;
    const openOrAccepted =
      t.status === "submitted" ||
      t.status === "reviewing" ||
      t.status === "accepted" ||
      t.status === "partial";
    if (!openOrAccepted) continue;
    for (const item of t.items) {
      if (t.status === "partial" && item.verdict === "reject") continue;
      out.add(item.field);
    }
  }
  return out;
}

/** 近 DUPLICATE_WINDOW_DAYS 天内是否已提交过同名新增关联人物 */
export function hasRecentNewContact(
  tickets: FeedbackTicket[],
  name: string,
): boolean {
  const since = Date.now() - DUPLICATE_WINDOW_DAYS * 86400_000;
  return tickets.some(
    (t) =>
      t.subjectKind === "new_contact" &&
      t.createdAt >= since &&
      t.status !== "rejected" &&
      t.status !== "invalid" &&
      isEquivalentValue(t.newContact?.name ?? "", name),
  );
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
    const next: FeedbackTicket = {
      ...t,
      items: input.items,
      newContactVerdict: input.newContactVerdict,
      newContactRejectReason: input.newContactRejectReason,
      reviewNote: input.reviewNote,
      reviewer: input.reviewer,
      reviewedAt: Date.now(),
      status,
      readByUser: false,
      revoked: false,
    };
    out = next;
    return next;
  });
  persist();
  return out;
}

/** 批量标记无效：仅对未完结工单生效，不变更任何企业数据 */
export function batchMarkInvalid(ids: string[], reviewer: string): number {
  const set = new Set(ids);
  let count = 0;
  store = store.map((t) => {
    if (!set.has(t.id) || isFinalStatus(t.status)) return t;
    count++;
    return {
      ...t,
      status: "invalid" as FeedbackStatus,
      reviewer,
      reviewedAt: Date.now(),
      readByUser: false,
      revoked: false,
    };
  });
  if (count) persist();
  return count;
}

/** 撤销误采纳：回滚数据并恢复审核中，保留历史裁定快照 */
export function revokeTicket(id: string) {
  store = store.map((t) =>
    t.id === id
      ? {
          ...t,
          status: "reviewing" as FeedbackStatus,
          revoked: true,
          reviewHistory: [
            ...(t.reviewHistory ?? []),
            {
              status: t.status,
              reviewedAt: t.reviewedAt,
              reviewer: t.reviewer,
              reviewNote: t.reviewNote,
            },
          ],
          reviewedAt: undefined,
          reviewNote: undefined,
          items: t.items.map(({ verdict: _v, finalValue: _f, rejectReason: _r, ...item }) => item),
          newContactVerdict: undefined,
          newContactRejectReason: undefined,
          readByUser: true,
        }
      : t,
  );
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
];

/** 可反馈的联系人字段 */
export const CONTACT_FEEDBACK_FIELDS: { key: string; label: string }[] = [
  { key: "name", label: "联系人姓名" },
  { key: "title", label: "职位信息" },
  { key: "email", label: "联系邮箱" },
  { key: "phone", label: "联系电话" },
  { key: "whatsapp", label: "WhatsApp" },
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
];

/* -------------------- 演示数据 -------------------- */

const SEED_FLAG = "boo:data-feedback:seeded:v6";

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
          field: "phone",
          label: "联系电话",
          current: c.phone,
          suggested: "+1 (212) 555-0186",
          issue: "outdated",
        },
      ],
      sourceType: "contact_confirmed",
      sourceNote: "与企业前台电话确认联系人号码已更新",
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
      reviewNote: "已核验新官网主体一致，采纳。",
      readByUser: false,
    });
    // 采纳后的数据生效（与线上审核同事务的演示还原）
    applyEnterpriseFieldOverride({
      enterpriseId: a.id,
      field: "website",
      label: "企业官网",
      oldValue: oldSite,
      newValue: newSite,
      ticketId: "FBDEMO004",
      reviewer: "运营-李珊",
    });

  }
  if (!seeds.length) return;
  store = [...seeds, ...store];
  persist();
}

