import { useMemo } from "react";
import { useLedger, type LedgerEntry } from "@/lib/credits-ledger";
import type { FavoriteRecord } from "@/lib/favorites";

/** 触达方式（用于「我的收藏」已触达标识与批量触达去重） */
export type ReachMethod = "email" | "sms" | "whatsapp" | "facebook" | "tiktok";

export const REACH_METHOD_LABEL: Record<ReachMethod, string> = {
  email: "邮件",
  sms: "短信",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
  tiktok: "TikTok",
};

/** 徽标配色（与系统其它渠道标识保持一致） */
export const REACH_METHOD_TONE: Record<ReachMethod, string> = {
  email: "bg-blue-50 text-blue-700 border-blue-200",
  sms: "bg-violet-50 text-violet-700 border-violet-200",
  whatsapp: "bg-emerald-50 text-emerald-700 border-emerald-200",
  facebook: "bg-sky-50 text-sky-700 border-sky-200",
  tiktok: "bg-slate-100 text-slate-700 border-slate-300",
};

export const SOCIAL_PLATFORM_METHODS: ReachMethod[] = ["facebook", "tiktok"];

function methodOf(e: LedgerEntry): ReachMethod | null {
  if (e.kind !== "reach") return null;
  if (e.channel === "email") return "email";
  if (e.channel === "phone") return "sms";
  if (e.channel === "social") {
    const p = (e.platform ?? "").toLowerCase();
    if (p.includes("whatsapp")) return "whatsapp";
    if (p.includes("facebook")) return "facebook";
    if (p.includes("tiktok")) return "tiktok";
  }
  return null;
}

/** 收藏记录 → 触达目标 key（与积分明细的 targetKind:targetId 对齐） */
export function favoriteTargetKey(r: FavoriteRecord): string | null {
  if (r.kind === "enterprise") return `enterprise:${r.refId}`;
  if (r.kind === "contact") {
    const parts = r.refId.split(":");
    const entId = r.parentRef?.id ?? parts[0];
    const idx = parts[1] ?? "0";
    if (!entId) return null;
    return `contact:${entId}:${idx}`;
  }
  return null;
}

/** targetKey → 已触达方式集合（含待触达/触达中，即「已操作过触达」） */
export function useReachedMap(): Map<string, Set<ReachMethod>> {
  const ledger = useLedger();
  return useMemo(() => {
    const map = new Map<string, Set<ReachMethod>>();
    for (const e of ledger) {
      const m = methodOf(e);
      if (!m) continue;
      const key = `${e.targetKind}:${e.targetId}`;
      const set = map.get(key) ?? new Set<ReachMethod>();
      set.add(m);
      map.set(key, set);
    }
    return map;
  }, [ledger]);
}

export function methodsOfFavorite(
  map: Map<string, Set<ReachMethod>>,
  r: FavoriteRecord,
): ReachMethod[] {
  const key = favoriteTargetKey(r);
  if (!key) return [];
  const set = map.get(key);
  if (!set) return [];
  return (["email", "sms", "whatsapp", "facebook", "tiktok"] as ReachMethod[]).filter(
    (m) => set.has(m),
  );
}
