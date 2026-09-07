/**
 * 客户回复「真实度」规则表（v1.1）
 * - hardBlock：命中即 Blocked
 * - dimension：对应维度扣分（identity / content / behavior / commercial / risk）
 * 详细说明见 /mnt/documents/客户回复意向真实度判断_产品方案.md §8
 */

export type AuthDimensionKey =
  | "identity"
  | "content"
  | "behavior"
  | "commercial"
  | "risk";

export interface RuleHit {
  id: string;
  label: string;
  hard: boolean;
  dimension?: AuthDimensionKey;
  penalty?: number; // 正数表示扣分
  evidence?: string;
}

export const DISPOSABLE_DOMAINS = [
  "mailinator.com",
  "10minutemail.com",
  "guerrillamail.com",
  "tempmail.com",
  "tempmail.net",
  "throwawaymail.com",
  "yopmail.com",
  "trashmail.com",
  "getnada.com",
];

export const FREE_EMAIL_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "yahoo.com",
  "163.com",
  "126.com",
  "qq.com",
  "sina.com",
  "aol.com",
  "protonmail.com",
];

export const DIM_LABEL: Record<AuthDimensionKey, string> = {
  identity: "身份可信度",
  content: "内容质量",
  behavior: "行为一致性",
  commercial: "商业合理性",
  risk: "风控与黑名单",
};

export const DIM_WEIGHT: Record<AuthDimensionKey, number> = {
  identity: 0.25,
  content: 0.2,
  behavior: 0.2,
  commercial: 0.2,
  risk: 0.15,
};

export function domainOf(addr?: string | null): string {
  if (!addr) return "";
  const at = addr.lastIndexOf("@");
  if (at < 0) return "";
  return addr.slice(at + 1).toLowerCase().trim();
}
