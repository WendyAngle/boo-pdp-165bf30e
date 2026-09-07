import { useSyncExternalStore } from "react";
import type { FilingChannel, SmsTplChannel } from "./sms-templates-store";

/**
 * 短信「通道网络」共享数据源：服务商 + 路由策略。
 * 与短信模板报备（sms-templates-store）通过 FilingChannel × 地区 打通：
 *   模板报备（通道 × 地区）→ 服务商承载该通道并覆盖该地区 → 路由策略在发送时选出服务商。
 */

export type ProviderHealth = "healthy" | "degraded" | "down" | "paused";

export interface SmsProvider {
  id: string;
  name: string;
  vendor: string;
  /** 覆盖地区（FILING_REGIONS 的 key） */
  regions: string[];
  /** 业务渠道类型（用户可见的三类） */
  channels: SmsTplChannel[];
  /** 承载的报备通道（与模板报备的 channel 对应） */
  filingChannels: FilingChannel[];
  enabled: boolean;
  health: ProviderHealth;
  deliveryRate: number;
  respMs: number;
  tps: number;
  quotaUsed: number;
  cost: { currency: "USD" | "CNY"; perSegment: number };
  lastCheck: string;
}

export interface RoutingRule {
  id: string;
  name: string;
  match: { region: string; channel: SmsTplChannel | "any" };
  /** 主服务商 id */
  primary: string;
  /** 备用服务商 id 列表 */
  failover: string[];
  minDeliveryRate: number;
  respectQuietHours: boolean;
  enabled: boolean;
  priority: number;
}

const KEY_PROVIDERS = "boo:sms-providers:v1";
const KEY_RULES = "boo:sms-routing:v1";

const SEED_PROVIDERS: SmsProvider[] = [
  {
    id: "twilio",
    name: "Twilio 主账号",
    vendor: "Twilio",
    regions: ["na", "eu", "anz", "latam", "sea", "me"],
    channels: ["marketing", "otp", "notification"],
    filingChannels: ["intl-a2p", "whatsapp"],
    enabled: true,
    health: "healthy",
    deliveryRate: 0.973,
    respMs: 1800,
    tps: 100,
    quotaUsed: 0.42,
    cost: { currency: "USD", perSegment: 0.0075 },
    lastCheck: "1 分钟前",
  },
  {
    id: "vonage",
    name: "Vonage 备用",
    vendor: "Vonage",
    regions: ["eu", "sea", "anz"],
    channels: ["marketing", "notification"],
    filingChannels: ["intl-a2p"],
    enabled: true,
    health: "healthy",
    deliveryRate: 0.951,
    respMs: 2300,
    tps: 60,
    quotaUsed: 0.28,
    cost: { currency: "USD", perSegment: 0.0068 },
    lastCheck: "刚刚",
  },
  {
    id: "aliyun-intl",
    name: "阿里云国际站",
    vendor: "Aliyun",
    regions: ["cn", "hk-tw", "sea"],
    channels: ["marketing", "notification"],
    filingChannels: ["cmcc", "unicom", "telecom", "intl-a2p"],
    enabled: true,
    health: "degraded",
    deliveryRate: 0.881,
    respMs: 6200,
    tps: 200,
    quotaUsed: 0.76,
    cost: { currency: "CNY", perSegment: 0.045 },
    lastCheck: "3 分钟前",
  },
  {
    id: "infobip",
    name: "Infobip",
    vendor: "Infobip",
    regions: ["na", "eu", "me", "af", "in", "sea", "latam", "anz"],
    channels: ["otp"],
    filingChannels: ["intl-a2p", "whatsapp"],
    enabled: true,
    health: "healthy",
    deliveryRate: 0.988,
    respMs: 900,
    tps: 300,
    quotaUsed: 0.15,
    cost: { currency: "USD", perSegment: 0.01 },
    lastCheck: "刚刚",
  },
  {
    id: "sinch",
    name: "Sinch A2P",
    vendor: "Sinch",
    regions: ["na", "latam"],
    channels: ["marketing"],
    filingChannels: ["intl-a2p"],
    enabled: false,
    health: "down",
    deliveryRate: 0.62,
    respMs: 15200,
    tps: 80,
    quotaUsed: 0,
    cost: { currency: "USD", perSegment: 0.008 },
    lastCheck: "12 分钟前",
  },
];

const SEED_RULES: RoutingRule[] = [
  {
    id: "r1",
    name: "北美 · 营销",
    match: { region: "na", channel: "marketing" },
    primary: "twilio",
    failover: ["sinch"],
    minDeliveryRate: 0.95,
    respectQuietHours: true,
    enabled: true,
    priority: 1,
  },
  {
    id: "r2",
    name: "欧洲 · 通知",
    match: { region: "eu", channel: "notification" },
    primary: "vonage",
    failover: ["twilio"],
    minDeliveryRate: 0.93,
    respectQuietHours: true,
    enabled: true,
    priority: 2,
  },
  {
    id: "r3",
    name: "中国大陆 · 全渠道",
    match: { region: "cn", channel: "any" },
    primary: "aliyun-intl",
    failover: [],
    minDeliveryRate: 0.9,
    respectQuietHours: true,
    enabled: true,
    priority: 3,
  },
  {
    id: "r4",
    name: "东南亚 · 全渠道",
    match: { region: "sea", channel: "any" },
    primary: "aliyun-intl",
    failover: ["vonage", "twilio"],
    minDeliveryRate: 0.9,
    respectQuietHours: true,
    enabled: true,
    priority: 4,
  },
  {
    id: "r5",
    name: "全球 · 验证码 OTP",
    match: { region: "any", channel: "otp" },
    primary: "infobip",
    failover: ["twilio"],
    minDeliveryRate: 0.98,
    respectQuietHours: false,
    enabled: true,
    priority: 5,
  },
];

function readList<T>(key: string, seed: T[]): T[] {
  if (typeof window === "undefined") return seed;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const j = JSON.parse(raw);
      if (Array.isArray(j) && j.length) return j as T[];
    }
  } catch {}
  try {
    window.localStorage.setItem(key, JSON.stringify(seed));
  } catch {}
  return seed;
}
function writeList<T>(key: string, list: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch {}
}

let providers: SmsProvider[] = readList(KEY_PROVIDERS, SEED_PROVIDERS);
let rules: RoutingRule[] = readList(KEY_RULES, SEED_RULES);
let version = 0;
const listeners = new Set<() => void>();
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const getVersion = () => version;

export function useSmsProviders(): SmsProvider[] {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return providers;
}
export function useRoutingRules(): RoutingRule[] {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return rules;
}
export const getSmsProviders = () => providers;
export const getRoutingRules = () => rules;
export const providerById = (id: string) => providers.find((p) => p.id === id);
export const providerName = (id: string) => providerById(id)?.name ?? id;

export function upsertProvider(next: SmsProvider) {
  providers = providers.some((p) => p.id === next.id)
    ? providers.map((p) => (p.id === next.id ? next : p))
    : [...providers, next];
  writeList(KEY_PROVIDERS, providers);
  emit();
}
export function patchProvider(id: string, patch: Partial<SmsProvider>) {
  providers = providers.map((p) => (p.id === id ? { ...p, ...patch } : p));
  writeList(KEY_PROVIDERS, providers);
  emit();
}

export function upsertRule(next: RoutingRule) {
  rules = rules.some((r) => r.id === next.id)
    ? rules.map((r) => (r.id === next.id ? next : r))
    : [...rules, next];
  writeList(KEY_RULES, rules);
  emit();
}
export function removeRule(id: string) {
  rules = rules.filter((r) => r.id !== id);
  writeList(KEY_RULES, rules);
  emit();
}
export function toggleRule(id: string) {
  rules = rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
  writeList(KEY_RULES, rules);
  emit();
}

/** 服务商当前是否可参与路由 */
export const isProviderRoutable = (p: SmsProvider) =>
  p.enabled && p.health !== "down" && p.health !== "paused";

/** 承载某报备通道的服务商 */
export function providersForFilingChannel(channel: FilingChannel): SmsProvider[] {
  return providers.filter((p) => p.filingChannels.includes(channel));
}

/** 某「报备通道 × 地区」当前是否有可用服务商承载 */
export function isChannelRegionServiceable(channel: FilingChannel, region: string): boolean {
  return providers.some(
    (p) => isProviderRoutable(p) && p.filingChannels.includes(channel) && p.regions.includes(region),
  );
}

/** 承载「通道 × 地区」的服务商（含不可用，用于展示链路） */
export function carriersFor(channel: FilingChannel, region: string): SmsProvider[] {
  return providers.filter((p) => p.filingChannels.includes(channel) && p.regions.includes(region));
}

/** 路由试算：按优先级匹配首个命中规则，返回可用的服务商链路 */
export function resolveRoute(
  region: string,
  channel: SmsTplChannel,
): { rule?: RoutingRule; chain: SmsProvider[]; reason?: string } {
  const hit = [...rules]
    .filter((r) => r.enabled)
    .sort((a, b) => a.priority - b.priority)
    .find(
      (r) =>
        (r.match.region === "any" || r.match.region === region) &&
        (r.match.channel === "any" || r.match.channel === channel),
    );
  if (!hit) return { chain: [], reason: "无匹配路由规则" };
  const chain = [hit.primary, ...hit.failover]
    .map((id) => providerById(id))
    .filter((p): p is SmsProvider => !!p)
    .filter((p) => isProviderRoutable(p) && p.regions.includes(region) && p.channels.includes(channel));
  return { rule: hit, chain, reason: chain.length ? undefined : "命中规则但链路中无可用服务商" };
}
