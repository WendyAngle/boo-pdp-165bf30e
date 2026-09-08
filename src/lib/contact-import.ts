/**
 * 手动目标（邮箱/手机号）批量导入解析工具。
 * 供批量发邮件 / 批量发短信弹窗与「自建名单」模块共用。
 *
 * 模板字段：
 * - 邮件：邮箱地址（必填）、联系人姓名（必填）、所属企业（选填）
 * - 短信：手机号（必填）、联系人姓名（必填）、所属企业（选填）、国家/地区（必填）
 * 导入数量不再限制。
 */

import { PHONE_COUNTRIES } from "./phone-country";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE_RE = /^\+?[0-9][0-9\s-]{5,19}$/;

export type ImportChannel = "email" | "phone";

/** 一行导入数据 */
export interface ContactRow {
  value: string;
  /** 联系人姓名 */
  name?: string;
  /** 所属企业 */
  company?: string;
  /** 国家/地区（短信） */
  country?: string;
}

export type ImportOutcome = {
  /** 通过校验且去重后的数据 */
  valid: ContactRow[];
  /** 格式不正确 */
  invalid: string[];
  /** 缺少必填项 */
  missing: string[];
  /** 与已有数据或文件内部重复 */
  duplicate: string[];
};

/** 表头单元格 → 字段名映射（按列识别，支持任意列顺序） */
const HEADER_CELL_PATTERNS: { re: RegExp; key: keyof ContactRow }[] = [
  { re: /^(邮箱地址|邮箱|email)/i, key: "value" },
  { re: /^(手机号|手机号码|phone|mobile)/i, key: "value" },
  { re: /^(联系人姓名|姓名|name)/i, key: "name" },
  { re: /^(所属企业|企业|company)/i, key: "company" },
  { re: /^(国家\/地区|国家|地区|country)/i, key: "country" },
];

function mapHeaderCell(cell: string): keyof ContactRow | null {
  const c = cell.trim();
  if (!c) return null;
  for (const p of HEADER_CELL_PATTERNS) {
    if (p.re.test(c)) return p.key;
  }
  return null;
}

/**
 * 从粘贴文本 / CSV / TXT 中解析导入行。
 * 若首行为表头（含「邮箱/手机号/联系人姓名/所属企业/国家地区」等关键词），
 * 则按表头列顺序映射字段，支持任意列顺序；否则按默认顺序：
 * 第 1 列邮箱/手机号，第 2 列联系人姓名，第 3 列所属企业，第 4 列国家/地区。
 * 单列文本（手动粘贴）只取第 1 列。
 */
export function parseContactRows(text: string): ContactRow[] {
  const out: ContactRow[] = [];
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  let colMap: (keyof ContactRow | null)[] | null = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split(/[,，\t;；]/).map((c) => c.trim());
    const first = cols[0] ?? "";
    if (!first) continue;
    // 首个含表头关键词的行视为表头，建立列映射
    if (!colMap) {
      const mapped = cols.map(mapHeaderCell);
      if (mapped.some((m) => m !== null)) {
        colMap = mapped;
        continue;
      }
    }
    if (cols.length > 1) {
      if (colMap) {
        const map = colMap;
        const row: ContactRow = { value: "" };
        cols.forEach((c, i) => {
          const key = map[i];
          if (key && c) row[key] = c;
        });
        if (row.value) out.push(row);
      } else {
        out.push(rowFromCols(cols));
      }
      continue;
    }
    // 单列：一行内可能用空格分隔多个
    for (const piece of first.split(/\s+/)) {
      if (piece.trim()) out.push({ value: piece.trim() });
    }
  }
  return out;
}

/** 兼容旧调用：仅取值列 */
export function parseContactText(text: string): string[] {
  return parseContactRows(text).map((r) => r.value);
}

/** 手机号规范化：无 + 前缀时按所选区号补全 */
export function normalizePhone(raw: string, dial?: string) {
  const v = raw.trim();
  if (v.startsWith("+")) return v.replace(/[\s-]/g, "");
  if (!dial) return v.replace(/[\s-]/g, "");
  return `+${dial}${v.replace(/\D/g, "")}`;
}

function dialOfCountryName(name?: string) {
  if (!name) return undefined;
  const k = name.trim();
  return PHONE_COUNTRIES.find((c) => c.name === k || c.code === k.toUpperCase())?.dial;
}

export interface ClassifyOptions {
  /** 默认区号（短信手动添加时由国家下拉决定） */
  dial?: string;
  /** 是否要求「联系人姓名」必填（文件/模板导入时为 true） */
  requireName?: boolean;
  /** 是否要求「国家/地区」必填（短信文件/模板导入时为 true） */
  requireCountry?: boolean;
  /** 缺省国家/地区（短信手动添加时由国家下拉决定） */
  defaultCountry?: string;
}

/** 校验 + 去重（不再限制数量） */
export function classifyContactRows(
  rows: ContactRow[],
  channel: ImportChannel,
  existing: Iterable<string>,
  opts: ClassifyOptions = {},
): ImportOutcome {
  const seen = new Set(Array.from(existing, (v) => v.toLowerCase()));
  const res: ImportOutcome = { valid: [], invalid: [], missing: [], duplicate: [] };
  for (const row of rows) {
    const country = row.country?.trim() || opts.defaultCountry;
    const dial =
      channel === "phone" ? (dialOfCountryName(row.country) ?? opts.dial) : undefined;
    const v = channel === "email" ? row.value.trim() : normalizePhone(row.value, dial);
    const ok = channel === "email" ? EMAIL_RE.test(v) : PHONE_RE.test(v);
    if (!ok) {
      res.invalid.push(row.value.trim());
      continue;
    }
    const missName = !!opts.requireName && !row.name?.trim();
    const missCountry =
      channel === "phone" && !!opts.requireCountry && !country?.trim();
    if (missName || missCountry) {
      res.missing.push(v);
      continue;
    }
    if (seen.has(v.toLowerCase())) {
      res.duplicate.push(v);
      continue;
    }
    seen.add(v.toLowerCase());
    res.valid.push({
      value: v,
      name: row.name?.trim() || undefined,
      company: row.company?.trim() || undefined,
      country: country?.trim() || undefined,
    });
  }
  return res;
}

/** 结果提示文案（只拼接非零项） */
export function importSummary(o: ImportOutcome) {
  const parts: string[] = [];
  if (o.valid.length) parts.push(`成功导入 ${o.valid.length} 条`);
  if (o.invalid.length) parts.push(`${o.invalid.length} 条格式不正确已过滤`);
  if (o.missing.length) parts.push(`${o.missing.length} 条缺少必填项已过滤`);
  if (o.duplicate.length) parts.push(`${o.duplicate.length} 条重复已过滤`);
  return parts.join("；");
}

/** 模板表头 */
export const TEMPLATE_HEADERS: Record<ImportChannel, string[]> = {
  email: ["邮箱地址（必填）", "联系人姓名（必填）", "所属企业（选填）"],
  phone: [
    "国家/地区（必填）",
    "手机号（必填）",
    "联系人姓名（必填）",
    "所属企业（选填）",
  ],
};

/** 下载导入模板（UTF-8 BOM，内置一条示例数据） */
export function downloadContactTemplate(channel: ImportChannel) {
  const rows =
    channel === "email"
      ? [
          TEMPLATE_HEADERS.email.join(","),
          "sales@example-trading.com,John Smith,Example Trading Co.",
        ]
      : [
          TEMPLATE_HEADERS.phone.join(","),
          "中国,+8613800138000,张伟,示例进出口有限公司",
        ];
  const blob = new Blob(["\uFEFF" + rows.join("\n") + "\n"], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = channel === "email" ? "邮箱导入模板.csv" : "手机号导入模板.csv";
  a.click();
  URL.revokeObjectURL(url);
}
