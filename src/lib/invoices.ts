import { useSyncExternalStore } from "react";
import { getAllLedger, useLedger, type LedgerEntry } from "./credits-ledger";

export type InvoiceTitleType = "company" | "personal";
export type InvoiceTaxType = "normal" | "special";
export type InvoiceStatus = "pending" | "issued" | "rejected";

export interface InvoiceProfile {
  id: string;
  type: InvoiceTitleType;
  title: string;
  taxNo?: string;
  bankName?: string;
  bankAccount?: string;
  address?: string;
  phone?: string;
  email: string;
  isDefault?: boolean;
}

export interface InvoiceRequest {
  id: string;
  invoiceNo?: string;
  createdAt: string;
  issuedAt?: string;
  orderNos: string[];
  amount: number;
  titleType: InvoiceTitleType;
  title: string;
  taxNo?: string;
  taxType: InvoiceTaxType;
  content: string;
  email: string;
  status: InvoiceStatus;
  rejectReason?: string;
}

const PROFILES_KEY = "boo:invoice:profiles:v1";
const REQUESTS_KEY = "boo:invoice:requests:v1";
const SEED_FLAG = "boo:invoice:v2:seeded";

function read<T>(k: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(k);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function write<T>(k: string, v: T[]) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(k, JSON.stringify(v)); } catch {}
}

let profiles: InvoiceProfile[] = read<InvoiceProfile>(PROFILES_KEY);
let requests: InvoiceRequest[] = read<InvoiceRequest>(REQUESTS_KEY);
let version = 0;
const listeners = new Set<() => void>();
function emit() { version++; listeners.forEach((l) => l()); }
function subscribe(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }
function getVersion() { return version; }

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === PROFILES_KEY) { profiles = read<InvoiceProfile>(PROFILES_KEY); emit(); }
    else if (e.key === REQUESTS_KEY) { requests = read<InvoiceRequest>(REQUESTS_KEY); emit(); }
  });
}

function makeId(p: string) {
  return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
function fmtInvoiceNo(d = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `INV${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${rand}`;
}

export function seedInvoicesIfEmpty() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(SEED_FLAG)) return;
  // Reset legacy v1 mock data so new status semantics take effect
  requests = [];
  write(REQUESTS_KEY, requests);
  if (profiles.length === 0) {
    profiles = [{
      id: makeId("p"), type: "company",
      title: "上海博欧数据科技有限公司",
      taxNo: "91310000MA1FL12K9X",
      bankName: "招商银行上海分行营业部",
      bankAccount: "1219 0780 1010 999",
      address: "上海市浦东新区世纪大道 100 号",
      phone: "021-5888 6666",
      email: "finance@boodata.cn",
      isDefault: true,
    }];
    write(PROFILES_KEY, profiles);
  }
  if (requests.length === 0) {
    const now = Date.now();
    const company = {
      titleType: "company" as const,
      title: "上海博欧数据科技有限公司",
      taxNo: "91310000MA1FL12K9X",
      content: "信息技术服务费",
      email: "finance@boodata.cn",
    };
    requests = [
      {
        id: makeId("inv"),
        invoiceNo: fmtInvoiceNo(new Date(now - 86400000 * 62)),
        createdAt: new Date(now - 86400000 * 62).toISOString(),
        issuedAt: new Date(now - 86400000 * 60).toISOString(),
        orderNos: ["R20260415101233"],
        amount: 1200,
        taxType: "normal",
        status: "issued",
        ...company,
      },
      {
        id: makeId("inv"),
        invoiceNo: fmtInvoiceNo(new Date(now - 86400000 * 35)),
        createdAt: new Date(now - 86400000 * 35).toISOString(),
        issuedAt: new Date(now - 86400000 * 33).toISOString(),
        orderNos: ["R20260512143355", "R20260518090812"],
        amount: 900,
        taxType: "special",
        status: "issued",
        ...company,
      },
      {
        id: makeId("inv"),
        invoiceNo: fmtInvoiceNo(new Date(now - 86400000 * 18)),
        createdAt: new Date(now - 86400000 * 18).toISOString(),
        issuedAt: new Date(now - 86400000 * 17).toISOString(),
        orderNos: ["R20260601093012"],
        amount: 600,
        taxType: "normal",
        status: "issued",
        ...company,
      },
      {
        id: makeId("inv"),
        createdAt: new Date(now - 86400000 * 1).toISOString(),
        orderNos: ["R20260616154433"],
        amount: 300,
        taxType: "special",
        status: "pending",
        ...company,
      },
    ];
    write(REQUESTS_KEY, requests);
  }
  window.localStorage.setItem(SEED_FLAG, "1");
  emit();
}

export function useInvoiceProfiles(): InvoiceProfile[] {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return profiles;
}

export function saveProfile(p: Omit<InvoiceProfile, "id"> & { id?: string }) {
  let savedId = p.id;
  if (p.id) {
    profiles = profiles.map((x) => (x.id === p.id ? ({ ...x, ...p } as InvoiceProfile) : x));
  } else {
    const id = makeId("p");
    savedId = id;
    const isFirst = profiles.length === 0;
    profiles = [...profiles, { ...p, id, isDefault: p.isDefault || isFirst }];
  }
  if (p.isDefault && savedId) {
    profiles = profiles.map((x) => ({ ...x, isDefault: x.id === savedId }));
  }
  write(PROFILES_KEY, profiles);
  emit();
}

export function deleteProfile(id: string) {
  profiles = profiles.filter((x) => x.id !== id);
  if (profiles.length > 0 && !profiles.some((x) => x.isDefault)) {
    profiles[0] = { ...profiles[0], isDefault: true };
  }
  write(PROFILES_KEY, profiles);
  emit();
}

export function setDefaultProfile(id: string) {
  profiles = profiles.map((x) => ({ ...x, isDefault: x.id === id }));
  write(PROFILES_KEY, profiles);
  emit();
}

export function useInvoiceRequests(): InvoiceRequest[] {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return requests;
}

export function getInvoiceStatusForOrder(orderNo: string): InvoiceStatus | undefined {
  for (const r of requests) { if (r.orderNos.includes(orderNo)) return r.status; }
  return undefined;
}

export function getInvoiceForOrder(orderNo: string): InvoiceRequest | undefined {
  return requests.find((r) => r.orderNos.includes(orderNo));
}

export function getInvoiceableRecharges(): LedgerEntry[] {
  const used = new Set(requests.flatMap((r) => r.orderNos));
  return getAllLedger().filter((e) => e.kind === "recharge" && e.orderNo && !used.has(e.orderNo));
}

export function createInvoiceRequest(input: {
  orderNos: string[];
  amount: number;
  titleType: InvoiceTitleType;
  title: string;
  taxNo?: string;
  taxType: InvoiceTaxType;
  content: string;
  email: string;
}): InvoiceRequest {
  const req: InvoiceRequest = {
    id: makeId("inv"),
    createdAt: new Date().toISOString(),
    status: "pending",
    ...input,
  };
  requests = [req, ...requests];
  write(REQUESTS_KEY, requests);
  emit();
  return req;
}

export function markIssued(id: string) {
  requests = requests.map((r) =>
    r.id === id
      ? { ...r, status: "issued", invoiceNo: r.invoiceNo ?? fmtInvoiceNo(), issuedAt: new Date().toISOString() }
      : r,
  );
  write(REQUESTS_KEY, requests);
  emit();
}

export function cancelInvoiceRequest(id: string) {
  requests = requests.filter((r) => r.id !== id);
  write(REQUESTS_KEY, requests);
  emit();
}

export function useInvoiceableRecharges(): LedgerEntry[] {
  useLedger();
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return getInvoiceableRecharges();
}
