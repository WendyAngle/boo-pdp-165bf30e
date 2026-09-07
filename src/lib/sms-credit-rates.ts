// 短信积分扣点：不同地区 / 不同渠道单条扣点（积分 / 条）
export type SmsChannel = "paasoo" | "engagelab";

export type SmsRate = {
  code: string;
  name: string;
  paasoo: number;
  engagelab: number;
};

export const SMS_RATES: SmsRate[] = [
  { code: "US", name: "美国", paasoo: 30, engagelab: 80 },
  { code: "GB", name: "英国", paasoo: 120, engagelab: 300 },
  { code: "DE", name: "德国", paasoo: 200, engagelab: 500 },
  { code: "AE", name: "阿联酋", paasoo: 200, engagelab: 500 },
  { code: "VN", name: "越南", paasoo: 600, engagelab: 200 },
  { code: "ID", name: "印度尼西亚", paasoo: 1000, engagelab: 30 },
  { code: "PH", name: "菲律宾", paasoo: 500, engagelab: 30 },
  { code: "TH", name: "泰国", paasoo: 15, engagelab: 30 },
  { code: "MX", name: "墨西哥", paasoo: 15, engagelab: 30 },
  { code: "IN", name: "印度", paasoo: 120, engagelab: 15 },
];

export const SMS_CHANNEL_LABEL: Record<SmsChannel, string> = {
  paasoo: "PaaSoo",
  engagelab: "EngageLab",
};

/** 系统默认按「最优价」自动路由：取两个渠道中扣点更低者 */
export function bestSmsRate(r: SmsRate) {
  const channel: SmsChannel = r.paasoo <= r.engagelab ? "paasoo" : "engagelab";
  return { channel, cost: Math.min(r.paasoo, r.engagelab) };
}

export const SMS_RATE_MIN = Math.min(...SMS_RATES.map((r) => bestSmsRate(r).cost));
export const SMS_RATE_MAX = Math.max(...SMS_RATES.map((r) => bestSmsRate(r).cost));

/** 未在表中的地区，按兜底扣点计费 */
export const SMS_RATE_FALLBACK = 200;
