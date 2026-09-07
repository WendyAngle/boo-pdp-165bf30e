import { useMemo } from "react";
import {
  useLedger,
  type LedgerEntry,
  type TargetKind,
} from "@/lib/credits-ledger";
import { findEnterprise, type Enterprise, type EnterpriseContact } from "@/data/enterprises";

/**
 * 解锁记录 · 派生自 credits-ledger 中 kind==="view" 且字段为
 * email/phone/social 的条目。同一 (owner, contact_type, value)
 * 仅保留首次解锁记录（时间最早），unlock_cost 与 unlock_time 取自该条。
 */
export type ContactType = "email" | "phone" | "social_media";
export type OwnerType = "enterprise" | "person";

export interface UnlockedContact {
  id: string;
  contact_type: ContactType;
  contact_value: string;
  owner_type: OwnerType;
  owner_id: string;
  owner_name: string;
  parent_ref?: { id: string; name: string };
  platform?: string;
  unlock_time: number;
  unlock_cost: number;
  is_unlocked: boolean;
}

function toContactType(field: string): ContactType | null {
  if (field === "email") return "email";
  if (field === "phone") return "phone";
  if (field === "social") return "social_media";
  return null;
}

function toOwnerType(k: TargetKind): OwnerType {
  return k === "enterprise" ? "enterprise" : "person";
}

/** social 平台推断：先看 ledger.platform；再从 URL/handle 猜测 */
function inferPlatform(value: string, hint?: string): string | undefined {
  if (hint) return hint;
  const v = value.toLowerCase();
  if (v.includes("linkedin.com")) return "LinkedIn";
  if (v.includes("facebook.com") || v.includes("fb.com")) return "Facebook";
  if (v.includes("twitter.com") || v.startsWith("@")) return "Twitter";
  if (v.includes("tiktok.com")) return "TikTok";
  if (v.includes("wa.me") || /^\+?\d[\d\s-]{6,}$/.test(value)) return "WhatsApp";
  return undefined;
}

function resolveParentRef(
  targetKind: TargetKind,
  targetId: string,
  existing?: { id: string; name: string },
): { id: string; name: string } | undefined {
  if (existing) return existing;
  if (targetKind !== "contact") return undefined;
  const [entId] = targetId.split(":");
  const ent = entId ? findEnterprise(entId) : undefined;
  return ent ? { id: ent.id, name: ent.name } : undefined;
}

/** 从 targetId 解析出企业与联系人（contact 目标） */
function resolveTarget(
  targetKind: TargetKind,
  targetId: string,
): { enterprise?: Enterprise; contact?: EnterpriseContact } {
  if (targetKind === "enterprise") {
    return { enterprise: findEnterprise(targetId) };
  }
  const [entId, idxStr] = targetId.split(":");
  const enterprise = entId ? findEnterprise(entId) : undefined;
  const idx = Number(idxStr);
  const contact =
    enterprise && Number.isFinite(idx) ? enterprise.contacts[idx] : undefined;
  return { enterprise, contact };
}

/** 归一化联系方式明文：优先取企业/联系人真实值，兜底用 ledger 中的 detail */
function realContactValue(
  ct: ContactType,
  platform: string | undefined,
  targetKind: TargetKind,
  targetId: string,
  fallback?: string,
): string | undefined {
  const { enterprise, contact } = resolveTarget(targetKind, targetId);
  if (ct === "email") {
    return contact?.email ?? enterprise?.email ?? fallback;
  }
  if (ct === "phone") {
    if (platform === "WhatsApp") {
      return (
        contact?.whatsapp ??
        contact?.phone ??
        enterprise?.whatsapp ??
        enterprise?.phone ??
        fallback
      );
    }
    return contact?.phone ?? enterprise?.phone ?? fallback;
  }
  // social_media：ledger 中 detail 通常已是 handle/URL，可直接使用
  return fallback;
}

interface Derived {
  ct: ContactType;
  value: string;
  platform?: string;
}

/** 由一条 reach 推导它解锁了哪个联系方式 */
function reachToDerived(e: LedgerEntry): Derived | null {
  if (!e.channel) return null;
  if (e.channel === "email") {
    const v = realContactValue("email", undefined, e.targetKind, e.targetId, e.detail);
    return v ? { ct: "email", value: v } : null;
  }
  if (e.channel === "phone") {
    const v = realContactValue("phone", undefined, e.targetKind, e.targetId, e.detail);
    return v ? { ct: "phone", value: v } : null;
  }
  // social
  if (e.platform === "WhatsApp") {
    const v = realContactValue("phone", "WhatsApp", e.targetKind, e.targetId, e.detail);
    return v ? { ct: "social_media", value: v, platform: "WhatsApp" } : null;
  }
  const handle = (e.detail ?? "").trim();
  if (!handle) return null;
  return { ct: "social_media", value: handle, platform: inferPlatform(handle, e.platform) };
}

/** 由一条 view 推导它解锁了哪个联系方式 */
function viewToDerived(e: LedgerEntry): Derived | null {
  const ct = e.field ? toContactType(e.field) : null;
  if (!ct) return null;
  const fallback = (e.detail ?? "").trim() || undefined;
  if (ct === "social_media") {
    if (!fallback) return null;
    return { ct, value: fallback, platform: inferPlatform(fallback, e.platform) };
  }
  const v = realContactValue(ct, undefined, e.targetKind, e.targetId, fallback);
  return v ? { ct, value: v } : null;
}

/**
 * 社媒平台触达（Facebook / TikTok 加好友 · 私信）目标是社媒账号本身，
 * 不关联 CRM 企业/人物（targetId 为占位符）。这类记录不能按「企业」聚合，
 * 否则会出现「Facebook平台私信 · 企业 · 5」这种不合理卡片。
 * 统一归一化为「社媒账号」维度：每个 @handle 单独一张卡片，且不关联企业。
 */
function socialHandleOf(e: LedgerEntry): string | null {
  if (e.channel !== "social") return null;
  if (e.platform === "WhatsApp") return null;
  const known = e.targetKind === "enterprise" ? findEnterprise(e.targetId) : undefined;
  if (known) return null;
  const m = (e.detail ?? "").match(/@[\w.\-]+/);
  return m ? m[0] : null;
}

export function deriveUnlockedContacts(entries: LedgerEntry[]): UnlockedContact[] {
  // 时间正序：view + reach 均视为解锁来源；相同联系方式仅保留最早
  const sorted = [...entries]
    .filter((e) => e.kind === "view" || e.kind === "reach")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const map = new Map<string, UnlockedContact>();
  for (const e of sorted) {
    const d = e.kind === "reach" ? reachToDerived(e) : viewToDerived(e);
    if (!d) continue;
    const handle = e.kind === "reach" ? socialHandleOf(e) : null;
    // 无企业归属的社媒账号：以 @handle 作为独立主体（单独一张卡片）
    const ownerId = handle ?? e.targetId;
    const ownerName = handle ?? e.targetName;
    const ownerType: OwnerType = handle ? "person" : toOwnerType(e.targetKind);
    if (!handle && e.channel === "social" && e.platform !== "WhatsApp" && !findEnterprise(e.targetId) && e.targetKind === "enterprise") {
      // 社媒触达但无法解析出账号：不构成有效的已解锁联系方式
      continue;
    }
    const key = `${ownerType}:${ownerId}:${d.ct}:${handle ?? d.value}`;
    if (map.has(key)) continue;
    map.set(key, {
      id: e.id,
      contact_type: handle ? "social_media" : d.ct,
      contact_value: handle ?? d.value,
      owner_type: ownerType,
      owner_id: ownerId,
      owner_name: ownerName,
      parent_ref: handle
        ? undefined
        : resolveParentRef(e.targetKind, e.targetId, e.parentRef),
      platform: handle ? (e.platform ?? d.platform) : d.platform,
      unlock_time: new Date(e.createdAt).getTime(),
      unlock_cost: e.kind === "view" ? e.cost : 0,
      is_unlocked: true,
    });
  }
  return [...map.values()].sort((a, b) => b.unlock_time - a.unlock_time);
}

export function useUnlockedContacts(): UnlockedContact[] {
  const ledger = useLedger();
  return useMemo(() => deriveUnlockedContacts(ledger), [ledger]);
}

export const CONTACT_TYPE_LABEL: Record<ContactType, string> = {
  email: "邮箱",
  phone: "电话",
  social_media: "社媒",
};

/** 按企业分组：contact 记录挂到其 parent_ref 下，enterprise 记录自成一组的锚点 */
export interface UnlockedGroup {
  key: string;
  name: string;
  items: UnlockedContact[];
  totalCost: number;
}

export function groupByEnterprise(list: UnlockedContact[]): UnlockedGroup[] {
  const buckets = new Map<string, UnlockedGroup>();
  for (const c of list) {
    const key =
      c.owner_type === "enterprise"
        ? c.owner_id
        : c.parent_ref?.id ?? c.owner_id;
    const name =
      c.owner_type === "enterprise"
        ? c.owner_name
        : c.parent_ref?.name ?? "未归属企业";
    if (!buckets.has(key)) {
      buckets.set(key, { key, name, items: [], totalCost: 0 });
    }
    const g = buckets.get(key)!;
    g.items.push(c);
    g.totalCost += c.unlock_cost;
  }
  return [...buckets.values()].sort(
    (a, b) =>
      Math.max(...b.items.map((x) => x.unlock_time)) -
      Math.max(...a.items.map((x) => x.unlock_time)),
  );
}

/** 按天分组 */
export function groupByDay(list: UnlockedContact[]): UnlockedGroup[] {
  const buckets = new Map<string, UnlockedGroup>();
  for (const c of list) {
    const d = new Date(c.unlock_time);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!buckets.has(key)) {
      buckets.set(key, { key, name: key, items: [], totalCost: 0 });
    }
    const g = buckets.get(key)!;
    g.items.push(c);
    g.totalCost += c.unlock_cost;
  }
  return [...buckets.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
}