import { SMS_RATES } from "./sms-credit-rates";

/** 国家/地区 → 国际区号（用于手机号归属识别与手动添加号码） */
const DIAL_CODES: Record<string, string> = {
  US: "1",
  GB: "44",
  DE: "49",
  AE: "971",
  VN: "84",
  ID: "62",
  PH: "63",
  TH: "66",
  MX: "52",
  IN: "91",
  CN: "86",
};

export interface PhoneCountry {
  code: string;
  name: string;
  dial: string;
}

/** 可选国家列表：短信扣点表覆盖的国家 + 中国 */
export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "CN", name: "中国", dial: DIAL_CODES.CN },
  ...SMS_RATES.map((r) => ({ code: r.code, name: r.name, dial: DIAL_CODES[r.code] })),
].filter((c) => !!c.dial);

/** 按 E.164 号码前缀识别国家/地区名称（最长前缀匹配）；识别失败返回 undefined */
export function detectPhoneCountryName(phone: string): string | undefined {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return undefined;
  const hit = [...PHONE_COUNTRIES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((c) => digits.startsWith(c.dial));
  return hit?.name;
}
