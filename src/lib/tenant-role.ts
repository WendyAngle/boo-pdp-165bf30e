import { useSyncExternalStore } from "react";

export type TenantRole = "admin" | "member";

/** 本企业域名（用于 personal 邮箱域名护栏，mock） */
export const TENANT_DOMAINS = ["bytetech.cn"];

/** 演示环境的"当前登录租户用户" */
export const CURRENT_TENANT_USER = {
  id: "u_zhang",
  name: "张三",
  email: "zhang@bytetech.cn",
};

const KEY = "boo:tenant-role:preview";

function readInit(): TenantRole {
  if (typeof window === "undefined") return "admin";
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "member" ? "member" : "admin";
  } catch {
    return "admin";
  }
}

let cache: TenantRole = readInit();
const listeners = new Set<() => void>();

export function useTenantRole(): TenantRole {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => cache,
    () => "admin",
  );
}

export function setTenantRole(r: TenantRole) {
  cache = r;
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, r);
  } catch {
    /* noop */
  }
  listeners.forEach((l) => l());
}

/** 判断邮箱地址后缀是否属于本企业域名 */
export function isTenantDomain(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).toLowerCase().trim();
  return TENANT_DOMAINS.some((d) => domain === d.toLowerCase());
}