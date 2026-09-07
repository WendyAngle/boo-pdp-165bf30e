/**
 * 企业数据覆盖层
 *
 * 管理后台采纳用户「问题反馈」后，将最终生效值写入本地覆盖层；
 * 企业详情页读取基础数据后合并覆盖层展示。演示实现：localStorage。
 */
import { useSyncExternalStore } from "react";
import type { Enterprise, EnterpriseContact } from "@/data/enterprises";

export interface OverrideChange {
  /** 字段 key */
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
  ticketId: string;
  reviewer: string;
  at: number;
}

export interface EnterpriseOverride {
  /** 企业字段覆盖 */
  enterprise: Record<string, string>;
  /** 已有联系人字段覆盖：`${index}` -> { field: value } */
  contacts: Record<string, Record<string, string>>;
  /** 采纳新增的联系人 */
  addedContacts: (EnterpriseContact & { ticketId: string })[];
  /** 变更历史（后台审计用） */
  history: OverrideChange[];
}

const KEY = "boo:enterprise-overrides:v1";

type Store = Record<string, EnterpriseOverride>;

function emptyOverride(): EnterpriseOverride {
  return { enterprise: {}, contacts: {}, addedContacts: [], history: [] };
}

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
    } catch {
      /* noop */
    }
  }
  version++;
  listeners.forEach((l) => l());
}

export function getOverride(enterpriseId: string): EnterpriseOverride {
  return store[enterpriseId] ?? emptyOverride();
}

export function useEnterpriseOverride(enterpriseId: string): EnterpriseOverride {
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
    () => version,
  );
  return getOverride(enterpriseId);
}

export function applyEnterpriseFieldOverride(input: {
  enterpriseId: string;
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
  ticketId: string;
  reviewer: string;
}) {
  const cur = getOverride(input.enterpriseId);
  store = {
    ...store,
    [input.enterpriseId]: {
      ...cur,
      enterprise: { ...cur.enterprise, [input.field]: input.newValue },
      history: [
        {
          field: input.field,
          label: input.label,
          oldValue: input.oldValue,
          newValue: input.newValue,
          ticketId: input.ticketId,
          reviewer: input.reviewer,
          at: Date.now(),
        },
        ...cur.history,
      ],
    },
  };
  persist();
}

export function applyContactFieldOverride(input: {
  enterpriseId: string;
  contactIndex: number;
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
  ticketId: string;
  reviewer: string;
}) {
  const cur = getOverride(input.enterpriseId);
  const k = String(input.contactIndex);
  store = {
    ...store,
    [input.enterpriseId]: {
      ...cur,
      contacts: {
        ...cur.contacts,
        [k]: { ...(cur.contacts[k] ?? {}), [input.field]: input.newValue },
      },
      history: [
        {
          field: `contact[${input.contactIndex}].${input.field}`,
          label: input.label,
          oldValue: input.oldValue,
          newValue: input.newValue,
          ticketId: input.ticketId,
          reviewer: input.reviewer,
          at: Date.now(),
        },
        ...cur.history,
      ],
    },
  };
  persist();
}

export function addOverrideContact(input: {
  enterpriseId: string;
  contact: EnterpriseContact;
  ticketId: string;
  reviewer: string;
}) {
  const cur = getOverride(input.enterpriseId);
  store = {
    ...store,
    [input.enterpriseId]: {
      ...cur,
      addedContacts: [...cur.addedContacts, { ...input.contact, ticketId: input.ticketId }],
      history: [
        {
          field: "contacts",
          label: "新增关联人物",
          oldValue: "—",
          newValue: input.contact.name,
          ticketId: input.ticketId,
          reviewer: input.reviewer,
          at: Date.now(),
        },
        ...cur.history,
      ],
    },
  };
  persist();
}

/** 撤销某工单产生的全部数据变更（不回收已发放积分） */
export function revokeTicketChanges(enterpriseId: string, ticketId: string) {
  const cur = getOverride(enterpriseId);
  const remaining = cur.history.filter((h) => h.ticketId !== ticketId);
  const next = emptyOverride();
  // 以剩余历史（按时间正序）重放，得到撤销后的覆盖层
  for (const h of [...remaining].sort((a, b) => a.at - b.at)) {
    if (h.field.startsWith("contact[")) {
      const m = /^contact\[(\d+)\]\.(.+)$/.exec(h.field);
      if (m) {
        const k = m[1];
        next.contacts[k] = { ...(next.contacts[k] ?? {}), [m[2]]: h.newValue };
      }
    } else if (h.field !== "contacts") {
      next.enterprise[h.field] = h.newValue;
    }
  }
  next.addedContacts = cur.addedContacts.filter((c) => c.ticketId !== ticketId);
  next.history = remaining;
  store = { ...store, [enterpriseId]: next };
  persist();
}

/** 将覆盖层合并到企业对象上 */
export function applyOverrideToEnterprise(
  e: Enterprise,
  ov: EnterpriseOverride,
): Enterprise {
  const merged: Enterprise = { ...e };
  for (const [k, v] of Object.entries(ov.enterprise)) {
    const cur = (merged as unknown as Record<string, unknown>)[k];
    (merged as unknown as Record<string, unknown>)[k] = Array.isArray(cur)
      ? v.split(/[、,，]/).map((s) => s.trim()).filter(Boolean)
      : v;
  }
  const contacts = e.contacts.map((c, i) => {
    const patch = ov.contacts[String(i)];
    return patch ? ({ ...c, ...patch } as EnterpriseContact) : c;
  });
  merged.contacts = [
    ...contacts,
    ...ov.addedContacts.map(({ ticketId: _t, ...c }) => c as EnterpriseContact),
  ];
  return merged;
}
