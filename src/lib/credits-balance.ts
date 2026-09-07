import { useSyncExternalStore } from "react";

export interface CreditBalance {
  balance: number;
  expiresAt: string; // ISO
  updatedAt: string;
}

const KEY = "boo:credits:v2";
const DEFAULT: CreditBalance = {
  balance: 7840,
  expiresAt: "2026-12-31T23:59:59",
  updatedAt: new Date().toISOString(),
};

function read(): CreditBalance {
  if (typeof window === "undefined") return DEFAULT;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const v = JSON.parse(raw);
    if (typeof v?.balance === "number" && typeof v?.expiresAt === "string") {
      return { updatedAt: v.updatedAt ?? new Date().toISOString(), ...v };
    }
  } catch {}
  return DEFAULT;
}

function write(v: CreditBalance) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(v));
  } catch {}
}

let state: CreditBalance = read();
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version++;
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      state = read();
      emit();
    }
  });
}

export function getCreditBalance() {
  return state;
}

export function addCredits(amount: number, extendDays = 365) {
  const now = new Date();
  const cur = new Date(state.expiresAt);
  // extend from later of (now, current expiry)
  const base = cur > now ? cur : now;
  base.setDate(base.getDate() + extendDays);
  state = {
    balance: state.balance + amount,
    expiresAt: base.toISOString(),
    updatedAt: now.toISOString(),
  };
  write(state);
  emit();
}

export function spendCredits(amount: number) {
  state = {
    ...state,
    balance: Math.max(0, state.balance - amount),
    updatedAt: new Date().toISOString(),
  };
  write(state);
  emit();
}

export function useCreditBalance(): CreditBalance {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => DEFAULT,
  );
}

export interface RechargePackage {
  id: string;
  credits: number;
  bonus: number;
  price: number;
  label: string;
  popular?: boolean;
}

export const RECHARGE_PACKAGES: RechargePackage[] = [
  { id: "starter", credits: 500, bonus: 0, price: 49, label: "入门" },
  { id: "standard", credits: 2000, bonus: 100, price: 179, label: "标准", popular: true },
  { id: "pro", credits: 5000, bonus: 400, price: 429, label: "专业" },
  { id: "enterprise", credits: 10000, bonus: 1200, price: 799, label: "企业" },
];

export function isBalanceLow(b: CreditBalance) {
  return b.balance < 50;
}

export function isExpiringSoon(b: CreditBalance, days = 30) {
  const ms = new Date(b.expiresAt).getTime() - Date.now();
  return ms > 0 && ms < days * 86400000;
}

export function formatExpiry(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}