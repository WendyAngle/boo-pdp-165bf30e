/**
 * 统一日期时间格式化工具
 * 全系统日期时间展示统一为 yyyy-MM-dd HH:mm:ss
 */

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * 将任意可解析的日期值格式化为 `YYYY-MM-DD HH:mm:ss`。
 * - 支持 ISO 字符串（含/不含 `T`、时区）
 * - 支持已是 `YYYY-MM-DD HH:mm` / `YYYY-MM-DD HH:mm:ss` 的字符串
 * - 支持仅 `YYYY-MM-DD` 的字符串，补 `00:00:00`
 * - 解析失败返回原始字符串（避免 UI 出现 "Invalid Date"）
 */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    // 已是目标格式 / 准目标格式
    const m = value.match(
      /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/,
    );
    if (m) {
      const [, y, mo, d, hh = "00", mm = "00", ss = "00"] = m;
      return `${y}-${mo}-${d} ${hh}:${mm}:${ss}`;
    }
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  );
}

/** 仅日期部分 `YYYY-MM-DD`（用于按日聚合的分组键、日期筛选等场景） */
export function formatDate(value: string | number | Date | null | undefined): string {
  return formatDateTime(value).slice(0, 10);
}

/** 仅时间部分 `HH:mm:ss`（用于已分组到日的子项展示） */
export function formatTime(value: string | number | Date | null | undefined): string {
  return formatDateTime(value).slice(11, 19);
}
