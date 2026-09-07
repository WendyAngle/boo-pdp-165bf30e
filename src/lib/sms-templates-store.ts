import { useSyncExternalStore } from "react";
import { isChannelRegionServiceable } from "./sms-network-store";


export type SmsTplStatus = "approved" | "pending" | "rejected";
export type SmsTplChannel = "marketing" | "otp" | "notification";

/** 报备通道（运营商直连 / 国际 A2P / OTT）——由短信服务商承载 */
export type FilingChannel = "cmcc" | "unicom" | "telecom" | "whatsapp" | "intl-a2p";
export const FILING_CHANNELS: { key: FilingChannel; label: string }[] = [
  { key: "cmcc", label: "移动" },
  { key: "unicom", label: "联通" },
  { key: "telecom", label: "电信" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "intl-a2p", label: "国际 A2P" },
];


export type FilingStatus = "none" | "submitted" | "approved" | "rejected" | "expired";

/** 报备目标地区（运营商 / OTT 报备均按地区生效） */
export const FILING_REGIONS: { key: string; label: string }[] = [
  { key: "cn", label: "中国大陆" },
  { key: "hk-tw", label: "中国港澳台" },
  { key: "sea", label: "东南亚" },
  { key: "in", label: "印度" },
  { key: "me", label: "中东" },
  { key: "eu", label: "欧洲（GDPR）" },
  { key: "na", label: "北美" },
  { key: "latam", label: "拉美" },
  { key: "af", label: "非洲" },
  { key: "anz", label: "澳新" },
];
export const regionLabel = (k: string) =>
  FILING_REGIONS.find((r) => r.key === k)?.label ?? k;

export interface TemplateFiling {
  templateId: string;
  channel: FilingChannel;
  status: FilingStatus;
  /** 目标地区（报备生效范围），至少 1 个 */
  regions: string[];
  externalId?: string;    // 运营商回执号
  submittedAt?: string;
  approvedAt?: string;
  expireAt?: string;
  comment?: string;       // 拒因 / 备注
  operator?: string;      // 登记人
}


/** 终端用户提交的自定义模板申请（内部运营审核） */
export type AppStatus = "submitted" | "approved" | "rejected";
export interface TemplateApplication {
  id: string;
  name: string;
  channel: SmsTplChannel;
  locale: string;
  content: string;
  scenario?: string;        // 使用场景说明
  status: AppStatus;
  submittedBy: string;
  submittedAt: string;
  reviewer?: string;
  reviewedAt?: string;
  rejectReason?: string;
  generatedTemplateId?: string; // 通过后生成的模板 id
}

export interface SmsTemplate {
  id: string;
  name: string;
  channel: SmsTplChannel;
  locale: string;
  content: string;
  status: SmsTplStatus;
  updatedAt: string;
  submittedBy: string;
  reviewer?: string;
  rejectReason?: string;
  /** 支持的发送语言代码（languages.ts），缺省时按 locale 推导 */
  langs?: string[];
  /** 支持发送的国家/地区（中文名），缺省时按报备可用地区推导 */
  countries?: string[];
  /** 各语言译文（{{变量}} 语法），一键翻译时套用 */
  translations?: Record<string, string>;
}

/** 模板可用语言代码列表 */
export function templateLangs(t: SmsTemplate): string[] {
  if (t.langs?.length) return t.langs;
  const m: Record<string, string> = { "zh-CN": "zh", "en-US": "en" };
  return [m[t.locale] ?? "en"];
}

/** 模板支持国家/地区（中文名） */
export function templateCountries(t: SmsTemplate): string[] {
  if (t.countries?.length) return t.countries;
  return getTemplateDeliverableRegions(t.id).map(regionLabel);
}

const KEY = "boo:sms-templates:v2";
const KEY_FILINGS = "boo:sms-filings:v3";
const KEY_APPS = "boo:sms-applications:v1";

const SEED: SmsTemplate[] = [
  {
    id: "t1",
    name: "首触 · 产品介绍 EN",
    channel: "marketing",
    locale: "en-US",
    content:
      "Hi {{联系人名}}, this is {{我的姓名}} from {{我的公司}}. We help {{行业}} companies cut sourcing cost by 20%. Interested in a 15-min chat? Reply STOP to opt out.",
    status: "approved",
    updatedAt: "2026-07-01",
    submittedBy: "李经理",
    reviewer: "合规组",
  },
  {
    id: "t2",
    name: "跟进 · 报价请求 中文",
    channel: "marketing",
    locale: "zh-CN",
    content:
      "{{联系人名}}您好，我是{{我的公司}}的{{我的姓名}}。上次沟通提到的报价已整理好，可否留个邮箱？回复T退订。",
    status: "approved",
    updatedAt: "2026-07-02",
    submittedBy: "王销售",
    reviewer: "合规组",
  },
  {
    id: "t3",
    name: "通知 · 订单发货",
    channel: "notification",
    locale: "zh-CN",
    content: "您的订单已发货，物流单号：{{运单号}}，预计近期送达。",
    status: "approved",
    updatedAt: "2026-06-20",
    submittedBy: "系统",
    reviewer: "合规组",
  },
  {
    id: "t4",
    name: "验证码 · 登录",
    channel: "otp",
    locale: "multi",
    content: "【Boo】您的验证码是 {{code}}，5 分钟内有效，请勿泄露。",
    status: "approved",
    updatedAt: "2026-06-10",
    submittedBy: "系统",
    reviewer: "合规组",
  },
  {
    id: "t5",
    name: "促销 · 618 大促",
    channel: "marketing",
    locale: "zh-CN",
    content: "{{联系人名}}亲，618 全场 5 折起，速抢！回复 TD 退订。",
    status: "pending",
    updatedAt: "2026-07-06",
    submittedBy: "运营组",
  },
  {
    id: "t6",
    name: "催单 · 未回复",
    channel: "marketing",
    locale: "en-US",
    content:
      "Hey {{联系人名}}, just checking in on my last email — worth a quick call? --{{我的姓名}} from {{我的公司}}. Reply STOP to opt out.",
    status: "rejected",
    updatedAt: "2026-07-05",
    submittedBy: "张销售",
    reviewer: "合规组",
    rejectReason: "话术过于随意，未体现企业身份，建议使用正式称谓并明确来意",
  },
  {
    id: "t7",
    name: "营销 · 全球产品报价",
    channel: "marketing",
    locale: "multi",
    content:
      "{{联系人名}}您好，我们是{{我的公司}}，主营{{产品范围}}，产品出口欧洲、北美与东南亚。如需采购或定制的准确报价，欢迎联系我们。更多详情请访问官网：{{公司官网}} 回复T退订。",
    status: "approved",
    updatedAt: "2026-07-10",
    submittedBy: "李经理",
    reviewer: "合规组",
    langs: ["en", "de", "th"],
    countries: ["德国", "英国", "印度尼西亚", "印度", "墨西哥", "泰国", "美国"],
    translations: {
      en: "Hi {{联系人名}}, this is {{我的公司}}. We produce {{产品范围}} and export to Europe, North America, and Southeast Asia. Contact us for an accurate quotation on purchase and custom orders. For more details, please visit our website: {{公司官网}} Reply STOP to opt out.",
      de: "Hallo {{联系人名}}, hier ist {{我的公司}}. Wir produzieren {{产品范围}} und exportieren nach Europa, Nordamerika und Südostasien. Kontaktieren Sie uns für ein genaues Angebot zu Kauf und Sonderanfertigungen. Mehr Details auf unserer Website: {{公司官网}} Antworten Sie STOP zum Abbestellen.",
      th: "สวัสดีคุณ {{联系人名}} จาก {{我的公司}} เราผลิต{{产品范围}} และส่งออกไปยังยุโรป อเมริกาเหนือ และเอเชียตะวันออกเฉียงใต้ ติดต่อเราเพื่อขอใบเสนอราคาที่แม่นยำ รายละเอียดเพิ่มเติมที่เว็บไซต์: {{公司官网}} ตอบกลับ STOP เพื่อยกเลิก",
    },
  },
];

function read(): SmsTemplate[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const j = JSON.parse(raw);
      if (Array.isArray(j)) return j as SmsTemplate[];
    }
  } catch {}
  window.localStorage.setItem(KEY, JSON.stringify(SEED));
  return SEED;
}
function write(list: SmsTemplate[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

const SEED_FILINGS: TemplateFiling[] = [
  { templateId: "t1", channel: "intl-a2p", status: "approved", regions: ["na", "eu", "anz"], externalId: "HX8f21…", submittedAt: "2026-06-25", approvedAt: "2026-06-27", expireAt: "2027-06-27", operator: "合规组" },
  { templateId: "t1", channel: "whatsapp", status: "submitted", regions: ["sea", "me"], submittedAt: "2026-07-05", operator: "合规组" },
  { templateId: "t2", channel: "cmcc", status: "approved", regions: ["cn"], externalId: "CM202607010881", submittedAt: "2026-06-28", approvedAt: "2026-07-01", expireAt: "2027-07-01", operator: "合规组" },
  { templateId: "t2", channel: "unicom", status: "rejected", regions: ["cn"], submittedAt: "2026-06-28", comment: "话术含金融词，需替换", operator: "合规组" },
  { templateId: "t3", channel: "cmcc", status: "approved", regions: ["cn"], externalId: "CM202606201122", approvedAt: "2026-06-22", expireAt: "2027-06-22", operator: "系统" },
  { templateId: "t4", channel: "cmcc", status: "approved", regions: ["cn", "hk-tw"], externalId: "CM_OTP_09", approvedAt: "2026-06-10", expireAt: "2027-06-10", operator: "系统" },
  { templateId: "t7", channel: "intl-a2p", status: "approved", regions: ["eu", "sea", "in", "latam", "na"], externalId: "HX9b73…", submittedAt: "2026-07-08", approvedAt: "2026-07-10", expireAt: "2027-07-10", operator: "合规组" },
];

const SEED_APPS: TemplateApplication[] = [
  { id: "a1", name: "客户回访 · 家居行业", channel: "marketing", locale: "zh-CN", content: "{{联系人名}}您好，我是{{我的公司}}的{{我的姓名}}，想跟进一下上次的家居采购需求，方便时可回复邮箱。回复T退订。", scenario: "针对家居行业老客户复购", status: "submitted", submittedBy: "李经理", submittedAt: "2026-07-08" },
  { id: "a2", name: "展会邀约 EN", channel: "marketing", locale: "en-US", content: "Hi {{联系人名}}, we'll exhibit at Canton Fair booth 5C-12. Coffee? -- {{我的姓名}}. Reply STOP to opt out.", scenario: "广交会前批量邀约", status: "submitted", submittedBy: "王销售", submittedAt: "2026-07-09" },
  { id: "a3", name: "促销活动 · 无退订", channel: "marketing", locale: "zh-CN", content: "全场 8 折起，速抢！", scenario: "夏季促销", status: "rejected", submittedBy: "张销售", submittedAt: "2026-07-04", reviewer: "合规组", reviewedAt: "2026-07-05", rejectReason: "缺少退订提示（STOP/退订/TD）" },
];

function readList<T>(key: string, seed: T[]): T[] {
  if (typeof window === "undefined") return seed;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const j = JSON.parse(raw);
      if (Array.isArray(j)) return j as T[];
    }
  } catch {}
  window.localStorage.setItem(key, JSON.stringify(seed));
  return seed;
}
function writeList<T>(key: string, list: T[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(key, JSON.stringify(list)); } catch {}
}

let store: SmsTemplate[] = read();
let filings: TemplateFiling[] = readList<TemplateFiling>(KEY_FILINGS, SEED_FILINGS);
let apps: TemplateApplication[] = readList<TemplateApplication>(KEY_APPS, SEED_APPS);
let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const getVersion = () => version;

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      store = read();
      emit();
    }
  });
}

export function useSmsTemplates(): SmsTemplate[] {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return store;
}

export function useSmsFilings(): TemplateFiling[] {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return filings;
}

export function useSmsApplications(): TemplateApplication[] {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return apps;
}

export function getFilingsByTemplate(templateId: string): Record<FilingChannel, TemplateFiling | undefined> {
  const m: Record<string, TemplateFiling> = {};
  filings.filter((f) => f.templateId === templateId).forEach((f) => { m[f.channel] = f; });
  return m as Record<FilingChannel, TemplateFiling | undefined>;
}

/** 某模板已通过报备覆盖的目标地区（用户端展示可用范围） */
export function getTemplateApprovedRegions(templateId: string): string[] {
  const set = new Set<string>();
  filings
    .filter((f) => f.templateId === templateId && f.status === "approved")
    .forEach((f) => (f.regions ?? []).forEach((r) => set.add(r)));
  return FILING_REGIONS.filter((r) => set.has(r.key)).map((r) => r.key);
}

/**
 * 实际可发地区 = 报备通过的地区 ∩ 当前有可用服务商承载该通道的地区。
 * 这是用户端选模板时真正生效的范围。
 */
export function getTemplateDeliverableRegions(templateId: string): string[] {
  const set = new Set<string>();
  filings
    .filter((f) => f.templateId === templateId && f.status === "approved")
    .forEach((f) =>
      (f.regions ?? []).forEach((r) => {
        if (isChannelRegionServiceable(f.channel, r)) set.add(r);
      }),
    );
  return FILING_REGIONS.filter((r) => set.has(r.key)).map((r) => r.key);
}

/** 已报备但当前无服务商承载的地区（后台需关注的断链） */
export function getTemplateBlockedRegions(
  templateId: string,
): { channel: FilingChannel; region: string }[] {
  const out: { channel: FilingChannel; region: string }[] = [];
  filings
    .filter((f) => f.templateId === templateId && f.status === "approved")
    .forEach((f) =>
      (f.regions ?? []).forEach((r) => {
        if (!isChannelRegionServiceable(f.channel, r)) out.push({ channel: f.channel, region: r });
      }),
    );
  return out;
}


/** 登记 / 更新一条渠道报备 */
export function upsertFiling(rec: TemplateFiling) {
  const idx = filings.findIndex((f) => f.templateId === rec.templateId && f.channel === rec.channel);
  if (idx >= 0) filings = filings.map((f, i) => (i === idx ? rec : f));
  else filings = [...filings, rec];
  writeList(KEY_FILINGS, filings);
  emit();
}

/** 审核用户申请：通过后自动生成一条 approved 模板 */
export function approveApplication(id: string, reviewer = "合规组") {
  const app = apps.find((a) => a.id === id);
  if (!app) return undefined;
  const today = new Date().toISOString().slice(0, 10);
  const newTpl: SmsTemplate = {
    id: `t_${Date.now().toString(36)}`,
    name: app.name,
    channel: app.channel,
    locale: app.locale,
    content: app.content,
    // 用户申请通过后进入模板库待审核，等待平台管理员最终复核
    status: "pending",
    updatedAt: today,
    submittedBy: app.submittedBy,
    reviewer,
  };
  store = [newTpl, ...store];
  write(store);
  apps = apps.map((a) => a.id === id ? { ...a, status: "approved", reviewer, reviewedAt: today, generatedTemplateId: newTpl.id } : a);
  writeList(KEY_APPS, apps);
  emit();
  return newTpl.id;
}

export function rejectApplication(id: string, reason: string, reviewer = "合规组") {
  const today = new Date().toISOString().slice(0, 10);
  apps = apps.map((a) => a.id === id ? { ...a, status: "rejected", rejectReason: reason, reviewer, reviewedAt: today } : a);
  writeList(KEY_APPS, apps);
  emit();
}

export function getApprovedSmsTemplates(): SmsTemplate[] {
  return store.filter((t) => t.status === "approved");
}

export function addSmsTemplate(
  t: Omit<SmsTemplate, "id" | "status" | "updatedAt" | "submittedBy">,
) {
  const rec: SmsTemplate = {
    ...t,
    id: `t_${Date.now().toString(36)}`,
    // 平台内置：进入待审核队列，由平台管理员复核后可用
    status: "pending",
    updatedAt: new Date().toISOString().slice(0, 10),
    submittedBy: "SysM",
  };
  store = [rec, ...store];
  write(store);
  emit();
}

/** 更新一个模板（内部运营编辑后直接保持通过状态；rejected 编辑后自动回到 approved） */
export function updateSmsTemplate(
  id: string,
  patch: Partial<Pick<SmsTemplate, "name" | "channel" | "locale" | "content">>,
) {
  store = store.map((t) => {
    if (t.id !== id) return t;
    const next: SmsTemplate = {
      ...t,
      ...patch,
      status: "pending",
      updatedAt: new Date().toISOString().slice(0, 10),
      rejectReason: undefined,
    };
    return next;
  });
  write(store);
  emit();
}

/** 撤回待审模板（仅 pending 可撤回，直接删除） */
export function withdrawSmsTemplate(id: string) {
  store = store.filter((t) => !(t.id === id && t.status === "pending"));
  write(store);
  emit();
}

/** 将 pending 模板标记为通过（历史遗留数据快速处理） */
export function approveSmsTemplate(id: string) {
  store = store.map((t) =>
    t.id === id && t.status === "pending"
      ? { ...t, status: "approved", updatedAt: new Date().toISOString().slice(0, 10), rejectReason: undefined }
      : t,
  );
  write(store);
  emit();
}

/** 将 pending 模板标记为未通过 */
export function rejectSmsTemplate(id: string, reason: string) {
  store = store.map((t) =>
    t.id === id && t.status === "pending"
      ? { ...t, status: "rejected", updatedAt: new Date().toISOString().slice(0, 10), rejectReason: reason }
      : t,
  );
  write(store);
  emit();
}

/** 把模板 {{变量}} 语法转换为撰写框使用的 {变量} 语法 */
export function toComposeSyntax(tpl: string): string {
  return tpl.replace(/\{\{\s*([^}]+?)\s*\}\}/g, "{$1}");
}

/** 一键续报：把 approved/expired 记录重置为 submitted，更新时间戳 */
export function renewFiling(templateId: string, channel: FilingChannel) {
  const today = new Date().toISOString().slice(0, 10);
  const idx = filings.findIndex((f) => f.templateId === templateId && f.channel === channel);
  if (idx < 0) return;
  const prev = filings[idx];
  filings = filings.map((f, i) => i === idx ? {
    ...f,
    status: "submitted",
    submittedAt: today,
    approvedAt: undefined,
    expireAt: undefined,
    comment: prev.comment,
    operator: "合规组",
  } as TemplateFiling : f);
  writeList(KEY_FILINGS, filings);
  emit();
}

/** 汇总某模板在 5 个渠道的报备状态数量 */
export function getFilingSummary(templateId: string): {
  approved: number; submitted: number; rejected: number; expired: number; missing: number; expiring: number;
} {
  const map = getFilingsByTemplate(templateId);
  let approved = 0, submitted = 0, rejected = 0, expired = 0, missing = 0, expiring = 0;
  for (const c of FILING_CHANNELS) {
    const rec = map[c.key];
    if (!rec) { missing++; continue; }
    if (rec.status === "approved") {
      approved++;
      if (rec.expireAt) {
        const d = Math.ceil((new Date(rec.expireAt).getTime() - Date.now()) / 86400000);
        if (d <= 30) expiring++;
      }
    } else if (rec.status === "submitted") submitted++;
    else if (rec.status === "rejected") rejected++;
    else if (rec.status === "expired") expired++;
    else missing++;
  }
  return { approved, submitted, rejected, expired, missing, expiring };
}