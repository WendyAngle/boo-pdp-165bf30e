/**
 * 全系统统一语言字典。
 * 所有涉及语言选择 / 展示的模块（外呼话术、坐席、翻译、社媒 & 邮件触达）
 * 必须从这里取选项，避免各处口径不一致。
 */
export interface LanguageOption {
  /** 语言代码（存储值，历史数据兼容：中文普通话仍为 zh） */
  code: string;
  /** 中文名（UI 展示） */
  zh: string;
  /** 英文全称（调用翻译 / TTS 引擎时使用） */
  en: string;
  flag: string;
}

export const ALL_LANGUAGES: LanguageOption[] = [
  { code: "zh", zh: "中文普通话", en: "Chinese (Mandarin, Simplified)", flag: "🇨🇳" },
  { code: "yue", zh: "中文粤语", en: "Chinese (Cantonese)", flag: "🇭🇰" },
  { code: "en", zh: "英语", en: "English", flag: "🇬🇧" },
  { code: "ja", zh: "日语", en: "Japanese", flag: "🇯🇵" },
  { code: "ko", zh: "韩语", en: "Korean", flag: "🇰🇷" },
  { code: "ru", zh: "俄语", en: "Russian", flag: "🇷🇺" },
  { code: "fr", zh: "法语", en: "French", flag: "🇫🇷" },
  { code: "de", zh: "德语", en: "German", flag: "🇩🇪" },
  { code: "es", zh: "西班牙语", en: "Spanish", flag: "🇪🇸" },
  { code: "it", zh: "意大利语", en: "Italian", flag: "🇮🇹" },
  { code: "id", zh: "印尼语", en: "Indonesian", flag: "🇮🇩" },
  { code: "ms", zh: "马来语", en: "Malay", flag: "🇲🇾" },
  { code: "th", zh: "泰语", en: "Thai", flag: "🇹🇭" },
  { code: "vi", zh: "越南语", en: "Vietnamese", flag: "🇻🇳" },
  { code: "fil", zh: "菲律宾语", en: "Filipino", flag: "🇵🇭" },
  { code: "pt", zh: "葡萄牙语", en: "Portuguese", flag: "🇵🇹" },
  { code: "nl", zh: "荷兰语", en: "Dutch", flag: "🇳🇱" },
  { code: "pl", zh: "波兰语", en: "Polish", flag: "🇵🇱" },
  { code: "ar", zh: "阿拉伯语", en: "Arabic", flag: "🇸🇦" },
  { code: "sv", zh: "瑞典语", en: "Swedish", flag: "🇸🇪" },
  { code: "da", zh: "丹麦语", en: "Danish", flag: "🇩🇰" },
  { code: "no", zh: "挪威语", en: "Norwegian", flag: "🇳🇴" },
];

export function languageByCode(code?: string): LanguageOption | undefined {
  return ALL_LANGUAGES.find((l) => l.code === code);
}

/** 中文名，未知代码原样返回 */
export const languageLabel = (code?: string) => languageByCode(code)?.zh ?? code ?? "";

/** 英文全称（翻译引擎入参） */
export const languageFullName = (code?: string) => languageByCode(code)?.en ?? code ?? "";

/** 多个语言代码 → 「中文、英语」 */
export const languageLabels = (codes: string[] = []) =>
  codes.map((c) => languageLabel(c)).join("、");
