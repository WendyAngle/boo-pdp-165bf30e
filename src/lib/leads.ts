import { ENTERPRISES } from "@/data/enterprises";
import type { Enterprise } from "@/data/enterprises";
import type { LeadProfile } from "./lead-profile";

export type LeadSource = "ai" | "search";

/** 推荐分层：精准匹配 / 相邻拓展 / 探索惊喜 */
export type LeadTier = "precise" | "expand" | "explore";

export interface LeadItem {
  enterprise: Enterprise;
  source: LeadSource;
  matchScore: number; // 60-99
  matchReasons: string[];
  generatedAt: string;
  /** 仅 AI 推荐时存在 */
  tier?: LeadTier;
}

const REASONS_AI = [
  "与主营产品高度匹配",
  "目标市场重合",
  "竞品同类客户",
  "近 90 天有同类品采购记录",
  "行业上下游高度相关",
  "员工规模匹配目标客户画像",
];

const REASONS_SEARCH_DEFAULT = [
  "贸易记录活跃",
  "联系方式完整",
  "近半年有同类品交易",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * 基于画像生成 AI 推荐线索（mock）
 * 分层混合策略：精准匹配 60% + 相邻拓展 30% + 探索惊喜 10%
 * - 自动剔除"已忽略"企业
 * - 已浏览企业默认不再出现（除非候选池耗尽兜底）
 * - 已收藏 / 已触达的企业，其同国家 / 同行业可获得偏好加权
 */
export function generateAiLeads(
  profile: LeadProfile,
  seed: number,
  count = 9,
): LeadItem[] {
  const targetCountries = profile.targetCountries.map((c) => c.toLowerCase());
  const targetIndustries = profile.targetIndustries.map((c) => c.toLowerCase());
  const fb = getLeadFeedback();
  const seen = new Set(fb.seen);
  const ignored = new Set(fb.ignored);
  const liked = new Set(fb.liked);

  // 偏好画像：从已收藏企业中提炼国家 / 行业偏好
  const prefCountries = new Set<string>();
  const prefIndustries = new Set<string>();
  for (const id of liked) {
    const ent = ENTERPRISES.find((e) => e.id === id);
    if (!ent) continue;
    if (ent.country) prefCountries.add(ent.country);
    if (ent.industry) prefIndustries.add(ent.industry);
  }

  const scored = ENTERPRISES.filter((e) => !ignored.has(e.id)).map((e) => {
    let score = 60 + (hash(e.id + seed) % 25);
    const reasons: string[] = [];
    if (targetCountries.length > 0 && targetCountries.includes(e.country)) {
      score += 10;
      reasons.push("目标市场重合");
    }
    if (
      targetIndustries.length > 0 &&
      targetIndustries.includes(e.industry)
    ) {
      score += 8;
      reasons.push("目标行业匹配");
    }
    if (
      profile.hsCodes.length > 0 &&
      e.hsCodes.some((h) => profile.hsCodes.includes(h))
    ) {
      score += 6;
      reasons.push("HS 编码匹配");
    }
    if (
      profile.mainProducts.length > 0 &&
      e.products.some((p) =>
        profile.mainProducts.some((mp) =>
          p.toLowerCase().includes(mp.toLowerCase()),
        ),
      )
    ) {
      score += 6;
      reasons.push("与主营产品高度匹配");
    }
    // 偏好加权：基于历史收藏 / 触达行为
    if (prefCountries.has(e.country)) {
      score += 5;
      reasons.push("与您关注的市场相似");
    }
    if (prefIndustries.has(e.industry)) {
      score += 4;
      reasons.push("与您关注的行业相似");
    }
    // 即使画像空，也补一个随机理由让用户体验完整
    if (reasons.length === 0) {
      reasons.push(REASONS_AI[hash(e.id) % REASONS_AI.length]);
    }
    if (e.tradeRole === "进口商" || e.tradeRole === "进出口商") {
      reasons.push("具备进口意向");
    }
    score = Math.min(99, score);
    return { enterprise: e, score, reasons: reasons.slice(0, 3) };
  });

  scored.sort((a, b) => b.score - a.score);

  // —— 分层选取：默认排除已浏览，候选耗尽时降级 ——
  const preciseCnt = Math.max(1, Math.round(count * 0.6));
  const expandCnt = Math.max(1, Math.round(count * 0.3));
  const exploreCnt = Math.max(1, count - preciseCnt - expandCnt);

  const unseenPool = scored.filter((x) => !seen.has(x.enterprise.id));
  // 若过滤后不足，回退到全量（保证页面始终有结果）
  const pool = unseenPool.length >= count ? unseenPool : scored;

  // 精准层：Top-N
  const precise = pool.slice(0, preciseCnt);

  // 拓展层：在中段 (N ~ 2N) 随机取
  const expandPool = pool.slice(preciseCnt, preciseCnt + expandCnt * 4);
  const expand = pickRandom(expandPool, expandCnt, seed + 7);

  // 探索层：在剩余池中随机取（带来"惊喜"）
  const taken = new Set([
    ...precise.map((x) => x.enterprise.id),
    ...expand.map((x) => x.enterprise.id),
  ]);
  const explorePool = pool.filter((x) => !taken.has(x.enterprise.id));
  const explore = pickRandom(explorePool, exploreCnt, seed + 17);

  const tag = (
    list: typeof scored,
    tier: LeadTier,
    extraReason?: string,
  ): LeadItem[] =>
    list.map((x) => ({
      enterprise: x.enterprise,
      source: "ai" as const,
      matchScore: x.score,
      matchReasons: extraReason
        ? Array.from(new Set([extraReason, ...x.reasons])).slice(0, 3)
        : x.reasons,
      generatedAt: new Date().toISOString(),
      tier,
    }));

  const result = [
    ...tag(precise, "precise"),
    ...tag(expand, "expand", "相邻市场拓展"),
    ...tag(explore, "explore", "探索惊喜推荐"),
  ];

  return result;
}

function pickRandom<T>(arr: T[], n: number, seed: number): T[] {
  if (arr.length <= n) return arr.slice();
  // 确定性洗牌
  const idxs = arr.map((_, i) => i);
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = (hash("rnd" + seed + i) % (i + 1)) | 0;
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  return idxs.slice(0, n).map((i) => arr[i]);
}

/** 主动搜索：根据关键词与类型在企业库中筛选并打分（mock） */
export type SearchType = "all" | "enterprise" | "product" | "hs";

export function searchLeads(
  keyword: string,
  type: SearchType,
  count = 12,
): LeadItem[] {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return [];

  const scored = ENTERPRISES.map((e) => {
    const reasons: string[] = [];
    let score = 0;
    const nameHit = e.name.toLowerCase().includes(kw);
    const industryHit = e.industry.toLowerCase().includes(kw);
    const productHit = e.products.some((p) => p.toLowerCase().includes(kw));
    const hsHit = e.hsCodes.some((h) => h.toLowerCase().includes(kw));
    const countryHit = e.country.toLowerCase().includes(kw);

    if (type === "hs") {
      if (hsHit) {
        score += 50;
        reasons.push(`命中 HS 编码 ${kw}`);
      } else return null;
    } else if (type === "product") {
      if (productHit) {
        score += 45;
        reasons.push("主营产品命中");
      } else if (industryHit) {
        score += 20;
        reasons.push("所属行业相关");
      } else return null;
    } else if (type === "enterprise") {
      if (nameHit) {
        score += 50;
        reasons.push("企业名称匹配");
      } else return null;
    } else {
      if (nameHit) {
        score += 40;
        reasons.push("企业名称匹配");
      }
      if (productHit) {
        score += 30;
        reasons.push("主营产品命中");
      }
      if (hsHit) {
        score += 25;
        reasons.push(`HS 编码命中 ${kw}`);
      }
      if (industryHit) {
        score += 15;
        reasons.push("行业相关");
      }
      if (countryHit) {
        score += 10;
        reasons.push("国家/地区匹配");
      }
      if (score === 0) return null;
    }

    if (e.tradeRole === "进口商" || e.tradeRole === "进出口商") {
      score += 4;
      reasons.push("具备进口意向");
    }
    // 用稳定 hash 给出 60-92 的基础匹配度，再叠加命中加分
    const base = 60 + (hash(e.id + kw) % 20);
    const matchScore = Math.min(99, base + Math.min(20, Math.floor(score / 3)));

    if (reasons.length === 0) {
      reasons.push(REASONS_SEARCH_DEFAULT[hash(e.id) % REASONS_SEARCH_DEFAULT.length]);
    }

    return { enterprise: e, score: matchScore, reasons: reasons.slice(0, 3) };
  }).filter(Boolean) as Array<{ enterprise: Enterprise; score: number; reasons: string[] }>;

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, count).map((x) => ({
    enterprise: x.enterprise,
    source: "search" as const,
    matchScore: x.score,
    matchReasons: x.reasons,
    generatedAt: new Date().toISOString(),
  }));
}

/* -------- AI 免费生成次数（每日） -------- */

const QUOTA_KEY = "boo:lead:ai-quota:v1";
const BONUS_KEY = "boo:lead:ai-bonus:v1";
export const AI_DAILY_FREE = 5;

function today() {
  return new Date().toISOString().slice(0, 10);
}

function readUsed(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(QUOTA_KEY);
    if (!raw) return 0;
    const obj = JSON.parse(raw) as { date: string; used: number };
    if (obj.date !== today()) return 0;
    return obj.used;
  } catch {
    return 0;
  }
}

export function getAiBonusQuota(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(BONUS_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function writeBonus(n: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BONUS_KEY, String(Math.max(0, Math.floor(n))));
  } catch {}
}

export function addAiBonusQuota(n: number) {
  writeBonus(getAiBonusQuota() + Math.max(0, Math.floor(n)));
}

export function getAiFreeLeft(): number {
  return Math.max(0, AI_DAILY_FREE - readUsed());
}

export function getAiQuotaLeft(): number {
  return getAiFreeLeft() + getAiBonusQuota();
}

export function consumeAiQuota(): number {
  if (typeof window === "undefined") return AI_DAILY_FREE;
  const used = readUsed();
  // 优先消耗每日免费额度，之后再扣扩容包
  if (used < AI_DAILY_FREE) {
    window.localStorage.setItem(
      QUOTA_KEY,
      JSON.stringify({ date: today(), used: used + 1 }),
    );
  } else {
    const bonus = getAiBonusQuota();
    if (bonus > 0) writeBonus(bonus - 1);
  }
  return getAiQuotaLeft();
}

/* -------- 积分余额（演示用 / 超额扣减） -------- */

const POINTS_KEY = "boo:points:balance:v1";
export const AI_OVERAGE_POINTS = 20; // 超额单次 AI 推荐扣减积分
export const AI_DEMO_BALANCE = 1280; // 初始演示余额

export function getPointBalance(): number {
  if (typeof window === "undefined") return AI_DEMO_BALANCE;
  try {
    const raw = window.localStorage.getItem(POINTS_KEY);
    if (raw == null) return AI_DEMO_BALANCE;
    const n = Number(raw);
    return Number.isFinite(n) ? n : AI_DEMO_BALANCE;
  } catch {
    return AI_DEMO_BALANCE;
  }
}

export function consumePoints(n: number): number {
  const cur = getPointBalance();
  const next = Math.max(0, cur - n);
  try {
    window.localStorage.setItem(POINTS_KEY, String(next));
  } catch {}
  return next;
}

/* -------- 搜索历史 -------- */

const HISTORY_KEY = "boo:lead:search-history:v1";

export function getSearchHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr;
  } catch {}
  return [];
}

export function pushSearchHistory(kw: string) {
  const k = kw.trim();
  if (!k || typeof window === "undefined") return;
  const cur = getSearchHistory().filter((x) => x !== k);
  cur.unshift(k);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(cur.slice(0, 8)));
}

/* -------- 推荐行为反馈（已浏览 / 已收藏 / 已忽略） -------- */

const FEEDBACK_KEY = "boo:lead:feedback:v1";

export interface LeadFeedback {
  seen: string[]; // 已被推荐过的企业 id（用于去重）
  liked: string[]; // 收藏 / 触达过的企业 id（正向信号）
  ignored: string[]; // 用户点击"不感兴趣"的企业 id（负向信号）
}

const EMPTY_FB: LeadFeedback = { seen: [], liked: [], ignored: [] };

export function getLeadFeedback(): LeadFeedback {
  if (typeof window === "undefined") return { ...EMPTY_FB };
  try {
    const raw = window.localStorage.getItem(FEEDBACK_KEY);
    if (!raw) return { ...EMPTY_FB };
    const obj = JSON.parse(raw);
    return {
      seen: Array.isArray(obj.seen) ? obj.seen : [],
      liked: Array.isArray(obj.liked) ? obj.liked : [],
      ignored: Array.isArray(obj.ignored) ? obj.ignored : [],
    };
  } catch {
    return { ...EMPTY_FB };
  }
}

function saveFeedback(fb: LeadFeedback) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FEEDBACK_KEY, JSON.stringify(fb));
  window.dispatchEvent(new CustomEvent("lead-feedback-change"));
}

export function markLeadsSeen(ids: string[]) {
  if (ids.length === 0) return;
  const fb = getLeadFeedback();
  const set = new Set(fb.seen);
  ids.forEach((id) => set.add(id));
  fb.seen = Array.from(set);
  saveFeedback(fb);
}

export function markLeadLiked(id: string) {
  const fb = getLeadFeedback();
  if (!fb.liked.includes(id)) fb.liked.push(id);
  fb.ignored = fb.ignored.filter((x) => x !== id);
  saveFeedback(fb);
}

export function markLeadIgnored(id: string) {
  const fb = getLeadFeedback();
  if (!fb.ignored.includes(id)) fb.ignored.push(id);
  fb.liked = fb.liked.filter((x) => x !== id);
  saveFeedback(fb);
}

export function unmarkLeadIgnored(id: string) {
  const fb = getLeadFeedback();
  fb.ignored = fb.ignored.filter((x) => x !== id);
  saveFeedback(fb);
}

export function resetLeadFeedback() {
  saveFeedback({ ...EMPTY_FB });
}