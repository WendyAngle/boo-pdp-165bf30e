import { useSyncExternalStore } from "react";

export interface LeadProfile {
  companyName: string;
  uscc: string;
  industries: string[];
  mainProducts: string[];
  hsCodes: string[];
  scale: string;
  revenue: string;
  targetCountries: string[];
  targetIndustries: string[];
  targetScale: string;
  competitors: string[];
  advantage: string;
  website: string;
  brandStory: string;
  brandFiles: QualificationFile[];
  /** 企业知识库：AI 智能外呼/触达回答客户问题的参考资料 */
  knowledgeFiles: QualificationFile[];
  qualifications: QualificationItem[];
  businessLicense?: QualificationFile;
}

export interface QualificationFile {
  id: string;
  name: string;
  dataUrl: string;
  mime: string;
}

export interface QualificationItem {
  id: string;
  name: string;
  desc: string;
  files: QualificationFile[];
}

const KEY = "boo:lead:profile:v2";

export const EMPTY_PROFILE: LeadProfile = {
  companyName: "博远智能科技（深圳）有限公司",
  uscc: "91330200MA2K5XQR70",
  industries: ["3C 手机配件", "新能源锂电", "视听数码"],
  mainProducts: [
    "手机壳",
    "数据线",
    "充电头",
    "充电宝",
    "蓝牙耳机",
    "TWS 无线耳机",
  ],
  hsCodes: ["851769", "850760", "852351"],
  scale: "201-1000",
  revenue: "5000 万 - 5 亿",
  targetCountries: ["美国", "德国", "越南", "印度尼西亚", "菲律宾"],
  targetIndustries: ["电子商务", "零售", "消费电子通信"],
  targetScale: "",
  competitors: [],
  advantage: "",

  website: "",
  brandStory: "",
  brandFiles: [],
  knowledgeFiles: [],
  qualifications: [],
};

function readProfile(): LeadProfile {
  if (typeof window === "undefined") return EMPTY_PROFILE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_PROFILE;
    const obj = JSON.parse(raw);
    return {
      ...EMPTY_PROFILE,
      ...obj,
      brandFiles: obj.brandFiles ?? [],
      knowledgeFiles: obj.knowledgeFiles ?? [],
    };
  } catch {
    return EMPTY_PROFILE;
  }
}

let profile: LeadProfile = readProfile();
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version++;
  listeners.forEach((l) => l());
}

export function saveProfile(next: LeadProfile) {
  profile = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
  }
  emit();
}

export function useLeadProfile(): LeadProfile {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
    () => version,
  );
  return profile;
}

/** 0-100 整数完整度 */
export function profileCompleteness(p: LeadProfile): number {
  const weights: Array<[boolean, number]> = [
    [p.industries.length > 0, 12],
    [p.mainProducts.length > 0, 14],
    [p.hsCodes.length > 0, 10],
    [!!p.scale, 6],
    [!!p.revenue, 6],
    [p.targetCountries.length > 0, 14],
    [p.targetIndustries.length > 0, 10],
    [!!p.targetScale, 6],
    [p.competitors.length > 0, 10],
    [!!p.advantage, 4],
    [!!p.website, 2],
    [!!p.brandStory || (p.brandFiles?.length ?? 0) > 0, 2],
    [p.qualifications.length > 0, 4],
  ];
  return weights.reduce((s, [ok, w]) => s + (ok ? w : 0), 0);
}