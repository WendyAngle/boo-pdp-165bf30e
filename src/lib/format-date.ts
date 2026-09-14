/**
 * 统一日期时间格式化工具
 * 全系统日期时间展示统一为 yyyy-MM-dd HH:mm:ss
 */

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
    // 无时区的业务字符串按已是北京时间处理，避免二次偏移。
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) {
      const [, y, mo, d, hh = "00", mm = "00", ss = "00"] = m;
      return `${y}-${mo}-${d} ${hh}:${mm}:${ss}`;
    }
  }
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")}`;
}

/** 仅日期部分 `YYYY-MM-DD`（用于按日聚合的分组键、日期筛选等场景） */
export function formatDate(value: string | number | Date | null | undefined): string {
  return formatDateTime(value).slice(0, 10);
}

/** 仅时间部分 `HH:mm:ss`（用于已分组到日的子项展示） */
export function formatTime(value: string | number | Date | null | undefined): string {
  return formatDateTime(value).slice(11, 19);
}

/** 当前北京时间所在自然日的起点（时间戳）。 */
export function startOfBeijingDay(value: number | Date = Date.now()): number {
  const day = formatDateTime(value).slice(0, 10);
  return Date.parse(`${day}T00:00:00+08:00`);
}

/** 当前北京时间所在自然月的起点（时间戳）。 */
export function startOfBeijingMonth(value: number | Date = Date.now()): number {
  const month = formatDateTime(value).slice(0, 7);
  return Date.parse(`${month}-01T00:00:00+08:00`);
}
