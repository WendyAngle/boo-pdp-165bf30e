/**
 * 私信字数（字符长度）计算规则：
 * 中文 / 日语 / 韩语 等全角字符按 2 个字符长度计算，其余按 1 计算。
 */

/** 平台私信字符长度上限 */
export const PLATFORM_CHAR_LIMIT: Record<string, number> = {
  Facebook: 2000,
  TikTok: 6000,
};

/** AI 生成建议长度（字符长度） */
export const AI_SUGGESTED_CHAR_LEN = 500;

const DOUBLE_WIDTH =
  /[\u1100-\u115F\u2E80-\uA4CF\uA960-\uA97F\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE19\uFE30-\uFE6F\uFF00-\uFF60\uFFE0-\uFFE6]/;

/** 计算字符长度：中日韩全角按 2，其余按 1 */
export function charLength(text: string): number {
  let n = 0;
  for (const ch of text) {
    n += DOUBLE_WIDTH.test(ch) ? 2 : 1;
  }
  return n;
}

/** 按字符长度上限截断（不截断半个字符） */
export function truncateByCharLength(text: string, limit: number): string {
  let n = 0;
  let out = "";
  for (const ch of text) {
    const w = DOUBLE_WIDTH.test(ch) ? 2 : 1;
    if (n + w > limit) break;
    n += w;
    out += ch;
  }
  return out;
}

export function platformCharLimit(platform: string): number {
  return PLATFORM_CHAR_LIMIT[platform] ?? 2000;
}
