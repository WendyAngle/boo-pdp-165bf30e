/**
 * AI 语言识别（客户端启发式模型，模拟 AI 语种检测）
 *
 * 输入会话中的对方（inbound）消息，输出：
 * - 识别到的语种（含中文名 / 英文名 / 旗帜）
 * - 置信度（0-100）
 * - 判定依据（脚本占比、停用词命中），便于在 UI 上体现「AI 识别」的可解释性
 */
import type { Thread } from "@/lib/inbox-store";
import { ALL_LANGUAGES } from "@/lib/languages";

export interface LangOption {
  code: string;
  zh: string;
  en: string;
  flag: string;
}

/** 支持的目标语言（AI 生成回复时可选） */
export const LANGUAGES: LangOption[] = ALL_LANGUAGES;

export function langByCode(code: string): LangOption | undefined {
  return LANGUAGES.find((l) => l.code === code);
}

export interface DetectedLanguage {
  code: string;
  zh: string;
  en: string;
  flag: string;
  /** 置信度 0-100 */
  confidence: number;
  /** 判定依据（用于 UI 展示 AI 可解释性） */
  evidence: string[];
  /** 样本量：参与识别的对方消息条数 */
  samples: number;
  /** 是否存在多语种混用 */
  mixed: boolean;
}

/* -------------------- 脚本（字符集）特征 -------------------- */

const SCRIPTS: { code: string; re: RegExp; label: string }[] = [
  { code: "th", re: /[\u0E00-\u0E7F]/g, label: "泰文字符" },
  { code: "ja", re: /[\u3040-\u30FF]/g, label: "日文假名" },
  { code: "ko", re: /[\uAC00-\uD7AF\u1100-\u11FF]/g, label: "韩文谚文" },
  { code: "zh", re: /[\u4E00-\u9FFF]/g, label: "中日汉字" },
  { code: "ru", re: /[\u0400-\u04FF]/g, label: "西里尔字母" },
  { code: "ar", re: /[\u0600-\u06FF]/g, label: "阿拉伯字母" },
  { code: "hi", re: /[\u0900-\u097F]/g, label: "天城文" },
];

/* -------------------- 拉丁语系停用词特征 -------------------- */

const STOPWORDS: { code: string; words: string[] }[] = [
  { code: "en", words: ["the", "and", "you", "please", "we", "for", "with", "our", "quote", "would", "thanks", "hello", "regards"] },
  { code: "es", words: ["que", "por", "para", "gracias", "precio", "estamos", "necesitamos", "buenos", "días", "saludos", "una", "los"] },
  { code: "pt", words: ["por", "para", "obrigado", "preço", "nós", "gostaria", "olá", "cumprimentos", "uma", "não"] },
  { code: "fr", words: ["bonjour", "merci", "nous", "pour", "vous", "prix", "cordialement", "une", "est", "avec"] },
  { code: "de", words: ["und", "wir", "bitte", "danke", "preis", "mit", "sehr", "geehrte", "ihre", "grüße"] },
  { code: "it", words: ["grazie", "prezzo", "per", "noi", "cordiali", "saluti", "una", "sono", "vorrei"] },
  { code: "vi", words: ["chúng", "tôi", "bạn", "giá", "cảm", "ơn", "xin", "chào", "được", "hàng"] },
  { code: "id", words: ["kami", "anda", "harga", "terima", "kasih", "untuk", "dengan", "yang", "bisa"] },
  { code: "ms", words: ["kami", "anda", "harga", "terima", "kasih", "untuk", "dengan", "yang", "boleh", "adakah"] },
  { code: "tr", words: ["merhaba", "teşekkür", "fiyat", "için", "biz", "ürün", "istiyoruz", "iyi", "günler"] },
];

const VI_DIACRITIC = /[ăâđêôơưĂÂĐÊÔƠƯ]|[\u0300-\u0303\u0309\u0323]/;

const FALLBACK: DetectedLanguage = {
  code: "en",
  zh: "英语",
  en: "English",
  flag: "🇬🇧",
  confidence: 40,
  evidence: ["样本不足，默认按英语处理"],
  samples: 0,
  mixed: false,
};

/** 对一段文本做语种识别 */
export function detectLanguage(text: string, samples = 1): DetectedLanguage {
  const raw = (text ?? "").trim();
  if (raw.length < 4) return { ...FALLBACK, samples };

  const evidence: string[] = [];
  const letters = raw.replace(/[\s\d\p{P}\p{S}]/gu, "");
  const total = Math.max(1, letters.length);

  // 1) 脚本占比
  const scriptHits: { code: string; ratio: number; label: string }[] = [];
  for (const s of SCRIPTS) {
    const n = (raw.match(s.re) ?? []).length;
    if (n > 0) scriptHits.push({ code: s.code, ratio: n / total, label: s.label });
  }
  scriptHits.sort((a, b) => b.ratio - a.ratio);

  // 日文假名优先于汉字（日语文本必含汉字）
  const kana = scriptHits.find((s) => s.code === "ja");
  const top = kana && kana.ratio > 0.04 ? kana : scriptHits[0];

  if (top && top.ratio > 0.12) {
    const conf = Math.min(99, Math.round(72 + top.ratio * 30));
    const opt = langByCode(top.code) ?? langByCode("en")!;
    evidence.push(`${top.label}占比 ${Math.round(top.ratio * 100)}%`);
    if (scriptHits.length > 1) evidence.push("检测到多脚本混排（含拉丁字母/英文术语）");
    return {
      ...opt,
      confidence: conf,
      evidence,
      samples,
      mixed: scriptHits.length > 1 || /[a-zA-Z]{3,}/.test(raw),
    };
  }

  // 2) 拉丁语系停用词打分
  const lower = raw.toLowerCase();
  const tokens = lower.split(/[^a-zà-ÿăâđêôơưğışçñ\u0300-\u0323]+/i).filter(Boolean);
  const tokenSet = new Set(tokens);
  let best: { code: string; hits: string[] } = { code: "en", hits: [] };
  for (const s of STOPWORDS) {
    const hits = s.words.filter((w) => tokenSet.has(w));
    if (hits.length > best.hits.length) best = { code: s.code, hits };
  }
  if (best.code === "vi" || VI_DIACRITIC.test(raw)) {
    if (VI_DIACRITIC.test(raw) && best.hits.length > 0) best = { code: "vi", hits: best.hits };
  }

  const opt = langByCode(best.code) ?? langByCode("en")!;
  const conf = Math.min(97, 52 + best.hits.length * 9 + Math.min(10, tokens.length / 6));
  if (best.hits.length) evidence.push(`命中 ${best.code.toUpperCase()} 特征词：${best.hits.slice(0, 4).join("、")}`);
  else evidence.push("以拉丁字母为主，未命中其他语种特征词");
  evidence.push(`样本长度 ${raw.length} 字符`);

  return {
    ...opt,
    confidence: Math.round(conf),
    evidence,
    samples,
    mixed: false,
  };
}

/** 识别会话中「对方」使用的语言（取最近若干条 inbound 消息） */
export function detectThreadLanguage(thread: Thread): DetectedLanguage {
  const inbound = thread.messages.filter((m) => m.direction === "inbound");
  if (!inbound.length) return { ...FALLBACK, evidence: ["对方暂无回复，默认按英语处理"] };
  const recent = inbound.slice(-3);
  const corpus = recent.map((m) => m.content ?? "").join("\n");
  const res = detectLanguage(corpus, inbound.length);
  // 多条消息一致性提升置信度
  if (recent.length > 1) {
    const codes = new Set(recent.map((m) => detectLanguage(m.content ?? "").code));
    if (codes.size === 1) {
      res.confidence = Math.min(99, res.confidence + 4);
      res.evidence.push(`最近 ${recent.length} 条回复语种一致`);
    } else {
      res.mixed = true;
      res.evidence.push("最近多条回复存在语种切换");
    }
  }
  return res;
}
