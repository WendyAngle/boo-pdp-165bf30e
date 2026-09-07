/**
 * 真实度评分 scoreAuthenticity(thread)
 * 基于 ai-authenticity-rules.ts 中的规则表，对 thread 的 inbound 消息评分。
 */
import type { Thread } from "@/lib/inbox-store";
import {
  DIM_LABEL,
  DIM_WEIGHT,
  DISPOSABLE_DOMAINS,
  FREE_EMAIL_DOMAINS,
  domainOf,
  type AuthDimensionKey,
  type RuleHit,
} from "@/lib/ai-authenticity-rules";

export type AuthLevel =
  | "trusted"
  | "neutral"
  | "suspicious"
  | "high_risk"
  | "blocked";

export const AUTH_LEVEL_LABEL: Record<AuthLevel, string> = {
  trusted: "可信",
  neutral: "一般",
  suspicious: "可疑",
  high_risk: "高危",
  blocked: "已拦截",
};

export interface AuthDimension {
  key: AuthDimensionKey;
  label: string;
  value: number;
  hits: RuleHit[];
}

export interface AuthResult {
  score: number; // 软分 0-100
  level: AuthLevel;
  levelLabel: string;
  dims: AuthDimension[];
  hardHits: RuleHit[];
  softHits: RuleHit[];
  nextAction: string;
  updatedAt: string;
}

const EMOJI_ONLY = /^[\s\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]+$/u;
const BEC_ACCOUNT = /(change (our|the|bank) (bank )?account|new (wire|bank) (instructions|details)|update.*payment.*account|变更.*(收款|账户|银行))/i;
const INTEL_KEYWORDS = [
  /customer\s*list|客户名单|top[-\s]?\d+\s*customer/i,
  /bill\s*of\s*material|\bBOM\b|物料清单/i,
  /cost\s*breakdown|成本(结构|明细|分解)|成本单/i,
  /full\s*price\s*list|完整报价单/i,
  /factory\s*(address|layout)|工厂(地址|布局)/i,
];
const BIG_AMOUNT = /(\$|USD\s?)\s?([1-9]\d{5,})|(\d+(\.\d+)?)\s?(million|mio|mn|百万|万美金)/i;
const PREPAY_PERSONAL = /(100\s?%\s*(t\/?t|prepay|前\s*t\/?t)).*?(personal|individual|私人|个人)|(personal|个人).*?account/i;
const TEMPLATE_HINT = /^dear\s+(sir|madam|purchasing|manager|team)/i;
const STOP_HARASS = /^(stop|退订|remove me|do not (contact|email))/i;

function penalize(base: number, hits: RuleHit[]): number {
  let v = base;
  for (const h of hits) if (!h.hard && h.penalty) v -= h.penalty;
  return Math.max(0, Math.min(100, Math.round(v)));
}

export function scoreAuthenticity(thread: Thread): AuthResult {
  const inbound = thread.messages.filter((m) => m.direction === "inbound");
  const last = inbound[inbound.length - 1];
  const corpus = inbound.map((m) => m.content).join("\n");
  const senderAddr = last?.fromAddress || thread.counterpartyAddress || "";
  const senderDomain = domainOf(senderAddr);
  const isEmailChannel = thread.channel === "email";
  const isSocialChannel =
    thread.channel === "facebook" || thread.channel === "tiktok";
  const isFreeEmail = isEmailChannel && FREE_EMAIL_DOMAINS.includes(senderDomain);
  const isDisposable = isEmailChannel && DISPOSABLE_DOMAINS.includes(senderDomain);
  const bigMoney = BIG_AMOUNT.test(corpus);
  const intelHits = INTEL_KEYWORDS.filter((r) => r.test(corpus)).length;
  const sig = thread.socialSignals;

  const identity: RuleHit[] = [];
  const content: RuleHit[] = [];
  const behavior: RuleHit[] = [];
  const commercial: RuleHit[] = [];
  const risk: RuleHit[] = [];
  const hardHits: RuleHit[] = [];

  // R001 hardBlock 一次性邮箱
  if (isDisposable) {
    hardHits.push({
      id: "R001",
      label: "一次性邮箱域",
      hard: true,
      evidence: `发件域 ${senderDomain} 属于已知一次性/临时邮箱`,
    });
  }
  // R002 hardBlock BEC 换账户
  if (BEC_ACCOUNT.test(corpus)) {
    hardHits.push({
      id: "R002",
      label: "疑似 BEC：要求变更收款账户",
      hard: true,
      evidence: "正文出现 change/new bank account 类语句",
    });
  }
  // R003b 免费邮箱 + 自称大企业
  if (isFreeEmail && (bigMoney || /group|corporation|enterprise|集团|股份/i.test(corpus))) {
    identity.push({
      id: "R003b",
      label: "免费邮箱伪装大企业采购",
      hard: false,
      dimension: "identity",
      penalty: 12,
      evidence: `发件域 ${senderDomain} 与自称的企业规模不匹配`,
    });
  }
  // R005 内容过短 / 纯 emoji
  if (last) {
    const c = last.content.trim();
    if (c.length < 6 || EMOJI_ONLY.test(c)) {
      content.push({
        id: "R005",
        label: "回复过短或纯 emoji",
        hard: false,
        dimension: "content",
        penalty: 20,
        evidence: `最新回复长度 ${c.length}，疑似敷衍`,
      });
    }
  }
  // R006 模板群发迹象
  if (TEMPLATE_HINT.test(corpus) && corpus.length < 400) {
    content.push({
      id: "R006",
      label: "疑似模板群发",
      hard: false,
      dimension: "content",
      penalty: 15,
      evidence: "以 Dear Sir/Madam 起手 + 内容短小",
    });
  }
  // R007 情报刺探
  if (intelHits >= 2) {
    behavior.push({
      id: "R007",
      label: "首次接触即索要多项内部资料",
      hard: false,
      dimension: "behavior",
      penalty: 30,
      evidence: `命中情报关键词 ${intelHits} 项（客户名单 / BOM / 成本结构 等）`,
    });
  }
  // R008 疑似脚本：首条 inbound 长且回复极快
  if (inbound.length && thread.messages.length >= 2) {
    const first = inbound[0];
    const priorOut = thread.messages.find(
      (m) => m.direction === "outbound" && new Date(m.createdAt) < new Date(first.createdAt),
    );
    if (priorOut) {
      const gapMs = new Date(first.createdAt).getTime() - new Date(priorOut.createdAt).getTime();
      if (gapMs > 0 && gapMs < 60_000 && first.content.length > 800) {
        behavior.push({
          id: "R008",
          label: "极短时间内长文回复",
          hard: false,
          dimension: "behavior",
          penalty: 15,
          evidence: "首条回复间隔 <1 分钟且长度 >800，疑似自动脚本",
        });
      }
    }
  }
  // R009 免费邮箱 + 大金额
  if (isFreeEmail && bigMoney) {
    commercial.push({
      id: "R009",
      label: "免费邮箱开口大额订单",
      hard: false,
      dimension: "commercial",
      penalty: 25,
      evidence: "使用免费邮箱且提及百万级金额",
    });
  }
  // R010 前 T/T + 个人账户
  if (PREPAY_PERSONAL.test(corpus)) {
    commercial.push({
      id: "R010",
      label: "要求 100% 前 T/T 至个人账户",
      hard: false,
      dimension: "commercial",
      penalty: 35,
      evidence: "支付条款异常",
    });
  }
  // R013 命中 suppressions（简化：从 tags 或 status=suppressed 推断）
  if (thread.meta.status === "suppressed" || /spam|harass|骚扰|举报/i.test(corpus) || STOP_HARASS.test(corpus)) {
    risk.push({
      id: "R013",
      label: "疑似骚扰 / 已加入退订名单",
      hard: false,
      dimension: "risk",
      penalty: 40,
      evidence: "命中 STOP / spam / 抑制名单",
    });
  }
  // R011 邮件头（无字段可读，跳过；保留位置）

  // ---- 社媒渠道专属规则（Facebook / TikTok） ----
  if (isSocialChannel && sig) {
    // S001 新注册账号（<30 天）
    if (typeof sig.accountAgeDays === "number" && sig.accountAgeDays < 30) {
      identity.push({
        id: "S001",
        label: "社媒新号（注册 <30 天）",
        hard: false,
        dimension: "identity",
        penalty: 18,
        evidence: `账号注册仅 ${sig.accountAgeDays} 天`,
      });
    }
    // S002 无头像
    if (sig.hasAvatar === false) {
      identity.push({
        id: "S002",
        label: "社媒账号未设置头像",
        hard: false,
        dimension: "identity",
        penalty: 10,
        evidence: "profile 未上传头像",
      });
    }
    // S003 僵尸粉：粉丝<10 且 贴文<3
    if (
      typeof sig.followers === "number" &&
      typeof sig.postsCount === "number" &&
      sig.followers < 10 &&
      sig.postsCount < 3
    ) {
      behavior.push({
        id: "S003",
        label: "疑似僵尸账号（粉丝/贴文极少）",
        hard: false,
        dimension: "behavior",
        penalty: 20,
        evidence: `粉丝 ${sig.followers} · 贴文 ${sig.postsCount}`,
      });
    }
    // S004 批量转发：同内容在最近渠道中重复出现 >=2 次
    if (typeof sig.duplicateBroadcastCount === "number" && sig.duplicateBroadcastCount >= 2) {
      content.push({
        id: "S004",
        label: "同文批量转发",
        hard: false,
        dimension: "content",
        penalty: 15,
        evidence: `相同内容在最近渠道中重复 ${sig.duplicateBroadcastCount} 次`,
      });
    }
  }

  const dims: AuthDimension[] = [
    { key: "identity", label: DIM_LABEL.identity, value: penalize(100, identity), hits: identity },
    { key: "content", label: DIM_LABEL.content, value: penalize(100, content), hits: content },
    { key: "behavior", label: DIM_LABEL.behavior, value: penalize(100, behavior), hits: behavior },
    { key: "commercial", label: DIM_LABEL.commercial, value: penalize(100, commercial), hits: commercial },
    { key: "risk", label: DIM_LABEL.risk, value: penalize(100, risk), hits: risk },
  ];

  // 总分采用「100 − 累计扣分」，让单一维度的高扣分能直接反映到总分，
  // 避免加权平均把明显风险稀释成接近满分。
  const totalPenalty = [...identity, ...content, ...behavior, ...commercial, ...risk]
    .reduce((a, h) => a + (h.penalty ?? 0), 0);
  const softScore = Math.max(0, Math.min(100, 100 - totalPenalty));

  let level: AuthLevel;
  if (hardHits.length > 0) level = "blocked";
  else if (softScore >= 80) level = "trusted";
  else if (softScore >= 60) level = "neutral";
  else if (softScore >= 40) level = "suspicious";
  else level = "high_risk";

  const softHits = [...identity, ...content, ...behavior, ...commercial, ...risk];

  let nextAction: string;
  if (level === "blocked") {
    nextAction = "命中硬规则，已提示为高危。请勿回复任何报价 / 内部资料，交由管理员在复核队列处理。";
  } else if (level === "high_risk") {
    nextAction = "真实度极低，建议加入抑制名单候选，或转人工复核后再决定是否跟进。";
  } else if (level === "suspicious") {
    nextAction = "谨慎跟进：仅回复公开资料，不发送完整报价单 / 客户案例；请求对方补充公司邮箱与官网信息。";
  } else if (level === "neutral") {
    nextAction = "按常规节奏跟进，如后续要发送敏感附件，先确认对方身份。";
  } else {
    nextAction = "真实度高，可按意向评分建议的动作正常推进。";
  }

  return {
    score: softScore,
    level,
    levelLabel: AUTH_LEVEL_LABEL[level],
    dims,
    hardHits,
    softHits,
    nextAction,
    updatedAt: thread.lastAt,
  };
}
