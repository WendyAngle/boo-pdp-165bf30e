import { useEffect, useState } from "react";

export type CertStatus = "unverified" | "pending" | "verified";

export interface CertRecord {
  status: CertStatus;
  enterpriseName: string;
  creditCode: string;
  legalRep: string;
  registeredAddress: string;
  contactName: string;
  contactPhone: string;
  licenseName: string;
  submittedAt?: number;
  verifiedAt?: number;
  certNo?: string;
}

const KEY = "boo:certification";

const EMPTY: CertRecord = {
  status: "unverified",
  enterpriseName: "",
  creditCode: "",
  legalRep: "",
  registeredAddress: "",
  contactName: "",
  contactPhone: "",
  licenseName: "",
};

const VERIFIED: CertRecord = {
  status: "verified",
  enterpriseName: "深圳市出海数据科技有限公司",
  creditCode: "91440300MA5EXAMPLE9X",
  legalRep: "莫文蔚",
  registeredAddress: "深圳市南山区科技园粤兴二道10号",
  contactName: "莫文蔚",
  contactPhone: "+86 138 0000 0000",
  licenseName: "营业执照_2026.pdf",
  verifiedAt: Date.now() - 1000 * 60 * 60 * 24 * 18,
  certNo: "BOO-CERT-2026-0007",
};

function isBrowser() {
  return typeof window !== "undefined";
}

function read(): CertRecord {
  if (!isBrowser()) return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return EMPTY;
  }
}

function write(rec: CertRecord) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rec));
    window.dispatchEvent(new Event("boo:cert-change"));
  } catch {
    /* noop */
  }
}

/** Reset to the initial unverified state (used by the page's reset button). */
export function resetCertification() {
  write(EMPTY);
}

/** Demo helper: jump straight to the verified state. */
export function markVerifiedDemo() {
  write(VERIFIED);
}

export function submitCertification(input: Omit<CertRecord, "status" | "submittedAt">) {
  const rec: CertRecord = {
    ...input,
    status: "pending",
    submittedAt: Date.now(),
  };
  write(rec);
}

export function approveCertification() {
  const cur = read();
  write({
    ...cur,
    status: "verified",
    verifiedAt: Date.now(),
    certNo: `BOO-CERT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
  });
}

export function useCertification(): CertRecord {
  const [rec, setRec] = useState<CertRecord>(() => (isBrowser() ? read() : EMPTY));
  useEffect(() => {
    setRec(read());
    const handler = () => setRec(read());
    window.addEventListener("boo:cert-change", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("boo:cert-change", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return rec;
}

export const STATUS_META: Record<CertStatus, { label: string; tone: string }> = {
  unverified: { label: "未认证", tone: "text-rose-600" },
  pending: { label: "审核中", tone: "text-amber-600" },
  verified: { label: "已认证", tone: "text-emerald-600" },
};
