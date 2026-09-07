// 出海大数据平台 · 企业 mock 数据
// 列表页与详情页共享同一份数据,保证两端展示一致

import { findByHs } from "./products-catalog";

export interface EnterpriseContact {
  name: string;
  title: string;
  email: string; // masked
  phone?: string;
  whatsapp?: string; // WhatsApp 账号（国际格式手机号）
}

export interface EnterpriseBill {
  partner: string; // 提单企业名
  partnerCountry: string;
  role: "出口商" | "进口商";
  count: number;
  lastAt: string;
}

export interface Enterprise {
  id: string;
  name: string;
  alias: string;
  industry: string;
  country: string;
  countryCode: string;
  province: string;
  city: string;
  address: string;
  est: string;
  employees: string;
  website: string;
  email: string;
  phone: string;
  desc: string;
  socials: { linkedin: boolean; facebook: boolean; twitter: boolean; whatsapp: boolean };
  whatsapp?: string; // 企业 WhatsApp 账号（国际格式手机号）
  createdAt: string;
  tradeRole: "出口商" | "进口商" | "进出口商";
  totalBills: number;
  totalVolumeTon: number;
  contacts: EnterpriseContact[];
  bills: EnterpriseBill[];
  hsCodes: string[];
  products: string[];
}

const COUNTRY_PAIRS: { name: string; code: string; provinces: string[] }[] = [
  { name: "united states", code: "US", provinces: ["connecticut", "california", "texas", "new york"] },
  { name: "china", code: "CN", provinces: ["广东", "浙江", "江苏", "上海"] },
  { name: "japan", code: "JP", provinces: ["tokyo", "osaka", "kyoto"] },
  { name: "germany", code: "DE", provinces: ["bavaria", "berlin", "hamburg"] },
  { name: "united kingdom", code: "GB", provinces: ["england", "scotland"] },
  { name: "mexico", code: "MX", provinces: ["jalisco", "nuevo leon"] },
  { name: "singapore", code: "SG", provinces: ["central region"] },
  { name: "france", code: "FR", provinces: ["ile-de-france", "occitanie"] },
];
const CITIES = ["middletown", "shanghai", "tokyo", "munich", "london", "guadalajara", "singapore", "paris"];
// 企业名与行业强绑定，避免出现「Summit Healthcare → marketing」这种硬伤。
// 国家仍随机，但业务标签保持语义一致。
const NAMED_ENTITIES: { name: string; industry: string }[] = [
  { name: "Aurora Holdings", industry: "financial services" },
  { name: "Northwind Group", industry: "financial services" },
  { name: "Skyline Education", industry: "higher education" },
  { name: "BlueWave Logistics", industry: "logistics" },
  { name: "Helios Capital", industry: "financial services" },
  { name: "Greenfield Manufacturing", industry: "manufacturing" },
  { name: "Bright Future Media", industry: "marketing and advertising" },
  { name: "Crystal Retail", industry: "retail" },
  { name: "Pioneer Robotics", industry: "manufacturing" },
  { name: "Summit Healthcare", industry: "healthcare" },
  { name: "Quantum Labs", industry: "information technology" },
  { name: "Pacific Trading Co.", industry: "retail" },
  { name: "Maple Leaf Foods", industry: "manufacturing" },
  { name: "Vertex Analytics", industry: "information technology" },
  { name: "Harbor Shipping", industry: "logistics" },
  { name: "Echo Marketing", industry: "marketing and advertising" },
  { name: "Stellar University", industry: "higher education" },
  { name: "Mosaic Studios", industry: "marketing and advertising" },
  { name: "Atlas Engineering", industry: "manufacturing" },
  { name: "Lighthouse Ventures", industry: "financial services" },
];
const NAMES = NAMED_ENTITIES.map((e) => e.name);
const ALIAS_SUFFIXES = [
  "国际",
  "集团",
  "(中国)",
  "海外事业部",
  "贸易",
  "控股",
  "科技",
  "供应链",
];
function makeAlias(baseName: string, i: number): string {
  const short = baseName.split(" ")[0];
  const suffix = ALIAS_SUFFIXES[i % ALIAS_SUFFIXES.length];
  return `${short}${suffix}`;
}
const CONTACT_NAMES = [
  "olga bookas",
  "michael chen",
  "sarah johnson",
  "david kim",
  "emily rodriguez",
  "yuki tanaka",
  "thomas wagner",
  "isabella rossi",
];
const TITLES = [
  "director of purchasing",
  "head of procurement",
  "sourcing manager",
  "supply chain director",
  "operations lead",
  "trade compliance officer",
];

const TRADE_ROLES: Enterprise["tradeRole"][] = ["出口商", "进口商", "进出口商"];

function pad(n: number, len = 2) {
  return String(n).padStart(len, "0");
}

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z]/g, "");
}

function makeBills(i: number, role: Enterprise["tradeRole"]): EnterpriseBill[] {
  const n = 1 + (i % 4);
  return Array.from({ length: n }).map((_, k) => {
    const partnerIdx = (i + k * 3) % NAMES.length;
    const cp = COUNTRY_PAIRS[(i + k) % COUNTRY_PAIRS.length];
    const y = 2021 + ((i + k) % 5);
    const m = ((i + k) % 12) + 1;
    const d = ((i + k * 7) % 27) + 1;
    return {
      partner: `${NAMES[partnerIdx].toUpperCase()} INC`,
      partnerCountry: cp.code,
      role: role === "进口商" ? "进口商" : "出口商",
      count: 1 + ((i + k) % 9),
      lastAt: `${y}-${pad(m)}-${pad(d)}T00:00:00`,
    };
  });
}

// 选取若干稳定存在的 HS6 编码
const FALLBACK_HS = [
  "482020",
  "680100",
  "680210",
  "680221",
  "680223",
  "680300",
  "680911",
  "680919",
];
function makeHs(i: number): string[] {
  const n = 1 + (i % 3);
  const out: string[] = [];
  for (let k = 0; k < n; k++) {
    const hs = FALLBACK_HS[(i + k * 2) % FALLBACK_HS.length];
    if (!out.includes(hs)) out.push(hs);
  }
  return out;
}

export const ENTERPRISES: Enterprise[] = Array.from({ length: 60 }).map((_, i) => {
  const missingIndustry = i % 3 === 1;
  const missingCountry = i % 3 === 1 || i % 7 === 0;
  const missingEst = i % 4 === 1;
  const cp = COUNTRY_PAIRS[i % COUNTRY_PAIRS.length];
  const province = cp.provinces[i % cp.provinces.length];
  const city = CITIES[i % CITIES.length];
  const entity = NAMED_ENTITIES[i % NAMED_ENTITIES.length];
  const baseName = `${entity.name}${i >= NAMED_ENTITIES.length ? ` ${Math.floor(i / NAMED_ENTITIES.length) + 1}` : ""}`;
  const s = slug(baseName);
  const m = ((i * 11) % 12) + 1;
  const d = ((i * 7) % 27) + 1;
  const yy = 2018 + (i % 7);
  const tradeRole = TRADE_ROLES[i % TRADE_ROLES.length];
  const contactsCount = 1 + (i % 3);
  const contacts: EnterpriseContact[] = Array.from({ length: contactsCount }).map((_, k) => {
    const cname = CONTACT_NAMES[(i + k) % CONTACT_NAMES.length];
    const local = cname.split(" ").join("_");
    return {
      name: cname,
      title: TITLES[(i + k) % TITLES.length],
      email: `${local.toLowerCase()}@${s}.com`,
      phone: k === 0 ? `+1 (${200 + (i % 700)}) ${100 + (i % 800)}-${1000 + (i % 9000)}` : undefined,
      whatsapp:
        (i + k) % 3 !== 2
          ? `+${1 + ((i + k) % 9)}${String(13000000000 + ((i + k) * 9176543)).slice(0, 10)}`
          : undefined,
    };
  });
  const bills = makeBills(i, tradeRole);
  const totalBills = bills.reduce((sum, b) => sum + b.count, 0);
  const hsCodes = makeHs(i);
  const products = hsCodes
    .map((hs) => findByHs(hs)?.l4.name)
    .filter((x): x is string => Boolean(x));

  return {
    id: `E${String(2026000 + i + 1).padStart(7, "0")}`,
    name: baseName,
    alias: makeAlias(baseName, i),
    industry: missingIndustry ? "" : entity.industry,
    country: missingCountry ? "" : cp.name,
    countryCode: missingCountry ? "" : cp.code,
    province,
    city,
    address: `${city}, ${province}, ${cp.name}`,
    est: missingEst ? "" : String(1831 + ((i * 17) % 190)),
    employees: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5000+"][i % 7],
    website: `www.${s}.com`,
    email: `contact@${s}.com`,
    phone: `+1 (${200 + (i % 700)}) ${100 + (i % 800)}-${1000 + (i % 9000)}`,
    desc:
      "该企业是行业内具有代表性的服务型组织,业务覆盖产品研发、客户服务与品牌运营等多个领域,与平台已建立长期合作关系。",
    socials: {
      linkedin: i % 2 === 0,
      facebook: i % 3 !== 2,
      twitter: i % 2 === 1 || i % 5 === 0,
      whatsapp: i % 4 !== 3,
    },
    whatsapp:
      i % 4 !== 3
        ? `+${1 + (i % 9)}${String(15000000000 + (i * 7654321)).slice(0, 10)}`
        : undefined,
    createdAt: `${yy}-${pad(m)}-${pad(d)}T00:00:00`,
    tradeRole,
    totalBills,
    totalVolumeTon: (i * 13) % 250,
    contacts,
    bills,
    hsCodes,
    products,
  };
});

export function findEnterprise(id: string): Enterprise | undefined {
  return ENTERPRISES.find((e) => e.id === id);
}