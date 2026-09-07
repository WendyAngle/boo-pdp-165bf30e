/**
 * 企业数据补全（后台采集）
 *
 * 交互模型：用户在企业详情页点击「一键补全企业数据」→ 后台采集任务约 30s 返回，
 * 采集结果以「补丁」形式覆盖到企业档案上，并记录本次补全了哪些字段，
 * 页面据此高亮「本次新增」的字段。
 *
 * 当前为演示实现：任务状态与结果保存在 localStorage，刷新后仍保留。
 */
import { useSyncExternalStore } from "react";
import type { Enterprise } from "@/data/enterprises";

export type EnrichFieldKey =
  | "alias"
  | "industry"
  | "country"
  | "est"
  | "employees"
  | "website"
  | "email"
  | "phone"
  | "whatsapp"
  | "address";

export const ENRICH_FIELD_LABEL: Record<EnrichFieldKey, string> = {
  alias: "企业别名",
  industry: "所属行业",
  country: "所属国家/地区",
  est: "成立年份",
  employees: "企业规模",
  website: "企业官网",
  email: "联系邮箱",
  phone: "联系电话",
  whatsapp: "WhatsApp",
  address: "企业地址",
};

export type EnrichPatch = Partial<
  Pick<
    Enterprise,
    | "alias"
    | "industry"
    | "country"
    | "countryCode"
    | "est"
    | "employees"
    | "website"
    | "email"
    | "phone"
    | "whatsapp"
    | "address"
  >
>;

export interface EnrichRecord {
  status: "running" | "done";
  startedAt: number;
  finishedAt?: number;
  patch: EnrichPatch;
  filled: EnrichFieldKey[];
  /** 采集后仍未获取到的字段 */
  stillMissing: EnrichFieldKey[];
}

/** 采集预计耗时（毫秒） */
export const ENRICH_DURATION_MS = 30_000;

const KEY = "boo:enterprise:enrich:v1";

type Store = Record<string, EnrichRecord>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "{}") as Store;
  } catch {
    return {};
  }
}

let store: Store = read();
let version = 0;
const listeners = new Set<() => void>();

function persist() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(store));
    } catch {}
  }
  version++;
  listeners.forEach((l) => l());
}

/** 当前档案中缺失的可补全字段 */
export function missingFields(e: Enterprise): EnrichFieldKey[] {
  const out: EnrichFieldKey[] = [];
  if (!e.alias) out.push("alias");
  if (!e.industry) out.push("industry");
  if (!e.country) out.push("country");
  if (!e.est) out.push("est");
  if (!e.employees) out.push("employees");
  if (!e.website) out.push("website");
  if (!e.email) out.push("email");
  if (!e.phone) out.push("phone");
  if (!e.whatsapp) out.push("whatsapp");
  if (!e.address) out.push("address");
  return out;
}

const INDUSTRIES = [
  "building materials",
  "manufacturing",
  "wholesale trade",
  "construction",
];
const COUNTRIES: { name: string; code: string }[] = [
  { name: "united states", code: "US" },
  { name: "germany", code: "DE" },
  { name: "mexico", code: "MX" },
  { name: "vietnam", code: "VN" },
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** 模拟后台采集结果：多数缺失字段可补全，少量字段仍未采集到 */
function collect(e: Enterprise, missing: EnrichFieldKey[]) {
  const h = hash(e.id);
  const patch: EnrichPatch = {};
  const filled: EnrichFieldKey[] = [];
  const stillMissing: EnrichFieldKey[] = [];
  const slug = e.name.toLowerCase().replace(/[^a-z]/g, "");
  const country = COUNTRIES[h % COUNTRIES.length];

  missing.forEach((f, i) => {
    // 约每 5 个字段留 1 个采集不到，贴近真实召回率
    if ((h + i) % 5 === 4) {
      stillMissing.push(f);
      return;
    }
    switch (f) {
      case "alias":
        patch.alias = `${e.name.split(" ")[0]}国际`;
        break;
      case "industry":
        patch.industry = INDUSTRIES[(h + i) % INDUSTRIES.length];
        break;
      case "country":
        patch.country = country.name;
        patch.countryCode = country.code;
        break;
      case "est":
        patch.est = String(1960 + ((h + i) % 60));
        break;
      case "employees":
        patch.employees = ["11-50", "51-200", "201-500", "501-1000"][(h + i) % 4];
        break;
      case "website":
        patch.website = `www.${slug}.com`;
        break;
      case "email":
        patch.email = `info@${slug}.com`;
        break;
      case "phone":
        patch.phone = `+1 (${200 + (h % 700)}) ${100 + (h % 800)}-${1000 + (h % 9000)}`;
        break;
      case "whatsapp":
        patch.whatsapp = `+${1 + (h % 9)}${String(15000000000 + h * 7).slice(0, 10)}`;
        break;
      case "address":
        patch.address = `${e.city || "middletown"}, ${e.province || "california"}, ${
          patch.country || e.country || country.name
        }`;
        break;
    }
    filled.push(f);
  });

  return { patch, filled, stillMissing };
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

export function getEnrich(id: string): EnrichRecord | undefined {
  return store[id];
}

/** 发起采集，返回是否成功发起 */
export function startEnrich(e: Enterprise, onDone?: (r: EnrichRecord) => void) {
  const cur = store[e.id];
  if (cur?.status === "running") return false;
  const missing = missingFields(e);
  store = {
    ...store,
    [e.id]: { status: "running", startedAt: Date.now(), patch: cur?.patch ?? {}, filled: [], stillMissing: [] },
  };
  persist();

  const t = setTimeout(() => {
    timers.delete(e.id);
    const { patch, filled, stillMissing } = collect(e, missing);
    const rec: EnrichRecord = {
      status: "done",
      startedAt: store[e.id]?.startedAt ?? Date.now(),
      finishedAt: Date.now(),
      patch: { ...(cur?.patch ?? {}), ...patch },
      filled,
      stillMissing,
    };
    store = { ...store, [e.id]: rec };
    persist();
    onDone?.(rec);
  }, ENRICH_DURATION_MS);
  timers.set(e.id, t);
  return true;
}

export function useEnrich(id: string): EnrichRecord | undefined {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
    () => version,
  );
  const rec = store[id];
  // 刷新页面后 setTimeout 丢失：超时的 running 视为已结束（无结果）
  if (rec?.status === "running" && Date.now() - rec.startedAt > ENRICH_DURATION_MS * 2) {
    return undefined;
  }
  return rec;
}

export function applyPatch(e: Enterprise, rec?: EnrichRecord): Enterprise {
  if (!rec?.patch) return e;
  return { ...e, ...rec.patch };
}
