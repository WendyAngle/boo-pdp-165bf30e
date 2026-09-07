import { useMemo } from "react";
import { useProspectingTasks, type ProspectingTask, type SocialTaskPlatform } from "@/lib/social-tasks";

export interface SocialFriend {
  /** 唯一 key：taskId:targetId */
  id: string;
  targetId: string;
  name: string;
  handle: string;
  /** 平台侧数字账号 ID，如 Facebook 的 61585883769059 */
  socialId?: string;
  platform: SocialTaskPlatform;
  accountId: string;
  sourceTaskId: string;
  sourceTaskName: string;
  acceptedAt?: string;
  kind: "enterprise" | "user" | "post" | "comment" | "group";
}


export function deriveFriends(tasks: ProspectingTask[]): SocialFriend[] {
  const out: SocialFriend[] = [];
  for (const t of tasks) {
    const platform: SocialTaskPlatform = t.platform[0] ?? "Facebook";
    const accountId = t.accountIds[0] ?? "";
    for (const tg of t.targets) {
      if (tg.status !== "accepted" && tg.status !== "following") continue;
      out.push({
        id: `${t.id}:${tg.id}`,
        targetId: tg.id,
        name: tg.name,
        handle: tg.handle,
        socialId: tg.socialId,
        platform,
        accountId,
        sourceTaskId: t.id,
        sourceTaskName: t.name,
        acceptedAt: tg.acceptedAt,
        kind: tg.kind,
      });

    }
  }
  return out;
}

export function useSocialFriends(): SocialFriend[] {
  const tasks = useProspectingTasks();
  return useMemo(() => deriveFriends(tasks), [tasks]);
}

/** DM 预填交接（好友池 → 私信页） */
const PREFILL_KEY = "boo:dm-prefill:v1";
export interface DmPrefill {
  platform: SocialTaskPlatform;
  friends: { name: string; handle: string }[];
}
export function setDmPrefill(p: DmPrefill) {
  try {
    window.sessionStorage.setItem(PREFILL_KEY, JSON.stringify(p));
  } catch {}
}
export function consumeDmPrefill(): DmPrefill | null {
  try {
    const raw = window.sessionStorage.getItem(PREFILL_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(PREFILL_KEY);
    return JSON.parse(raw) as DmPrefill;
  } catch {
    return null;
  }
}
