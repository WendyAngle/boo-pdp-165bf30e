import { useEffect, useState } from "react";

const PWD_KEY = "boo:account:password";
const DEFAULT_PWD = "admin123";

export interface CurrentUser {
  name: string;
  email: string;
  phone: string;
  role: string;
  avatarLetter: string;
}

export const CURRENT_USER: CurrentUser = {
  name: "莫文蔚",
  email: "admin@boo.com",
  phone: "+86 138 0000 0000",
  role: "超级管理员",
  avatarLetter: "A",
};

export function useCurrentUser(): CurrentUser {
  return CURRENT_USER;
}

function readPwd(): string {
  if (typeof window === "undefined") return DEFAULT_PWD;
  try {
    return window.localStorage.getItem(PWD_KEY) ?? DEFAULT_PWD;
  } catch {
    return DEFAULT_PWD;
  }
}

function writePwd(v: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PWD_KEY, v);
  } catch {
    /* noop */
  }
}

export async function changePassword(current: string, next: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 600));
  const stored = readPwd();
  if (current !== stored) {
    throw new Error("当前密码不正确");
  }
  if (current === next) {
    throw new Error("新密码不能与当前密码相同");
  }
  writePwd(next);
}

export function passwordStrength(pwd: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  checks: { length: boolean; lower: boolean; upper: boolean; digit: boolean; symbol: boolean };
} {
  const checks = {
    length: pwd.length >= 8,
    lower: /[a-z]/.test(pwd),
    upper: /[A-Z]/.test(pwd),
    digit: /\d/.test(pwd),
    symbol: /[^A-Za-z0-9]/.test(pwd),
  };
  const variety = [checks.lower, checks.upper, checks.digit, checks.symbol].filter(Boolean).length;
  let score: 0 | 1 | 2 | 3 | 4 = 0;
  if (pwd.length === 0) score = 0;
  else if (!checks.length || variety <= 1) score = 1;
  else if (variety === 2) score = 2;
  else if (variety === 3) score = 3;
  else score = 4;
  const label = ["", "弱", "一般", "强", "非常强"][score];
  return { score, label, checks };
}

/** Force re-render hook for components that depend on localStorage password (e.g. last-changed badge). */
export function usePasswordVersion() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === PWD_KEY) setV((x) => x + 1);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
  return v;
}