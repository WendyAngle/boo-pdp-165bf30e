/**
 * 演示数据：为「我的收藏」中的部分对象补齐社媒关系闭环。
 *
 * 一次性生成互相关联的数据：
 * 1) 社媒关系记录（已建立 / 请求中）→ 收藏列表关系标识、批量社媒私信可执行目标
 * 2) 收藏中心发起的「加好友 / 关注」拓客任务 → 触达会话中的好友通过记录、社媒好友池
 * 3) 对应的加友消费明细（50 积分 / 次）
 */
import { getAllFavorites, type FavoriteRecord } from "@/lib/favorites";
import {
  identitiesOfFavorite,
  recordId,
  upsertConnectRecords,
  type ConnectRecord,
} from "@/lib/social-connect";
import {
  getProspectingTasksSnapshot,
  upsertProspectingTask,
  type ProspectingTarget,
  type ProspectingTask,
} from "@/lib/social-tasks";
import {
  COST_SOCIAL_ADD_FRIEND,
  chargeSocialAddFriend,
  getAllLedger,
} from "@/lib/credits-ledger";

const FLAG = "boo:social-connect-demo:v1";
const TASK_ID = "spt_fav_connect";

function hoursAgo(n: number) {
  return new Date(Date.now() - n * 3600000).toISOString();
}

/** 生成稳定的平台侧数字账号 ID（如 61585883769059） */
function socialIdOf(seed: string) {
  const n = Array.from(seed).reduce((a, ch) => (a * 33 + ch.charCodeAt(0)) % 100000, 7);
  return String(61585883700000 + n);
}

export function seedDemoSocialConnectsIfEmpty() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(FLAG)) return;

  const favorites: FavoriteRecord[] = getAllFavorites().filter(
    (r) => r.kind === "enterprise" || r.kind === "contact",
  );
  // 仅取 Facebook 身份（企业收藏 → 主页关注；人物收藏 → 个人号加好友）
  const identities = favorites
    .flatMap((r) => identitiesOfFavorite(r).map((i) => ({ fav: r, id: i })))
    .filter((x) => x.id.platform === "Facebook")
    .slice(0, 4);

  if (identities.length === 0) return;

  const connects: ConnectRecord[] = [];
  const targets: ProspectingTarget[] = [];

  identities.forEach((x, i) => {
    const action = x.id.accountType === "page" ? "follow" : "friend";
    // 前 3 个已建立关系，最后 1 个保持「请求中」，体现真实执行进度
    const established = i < 3;
    const requestedAt = hoursAgo(30 - i);
    const acceptedAt = hoursAgo(6 - i);

    connects.push({
      id: recordId("Facebook", x.id.handle),
      favoriteId: x.fav.id,
      platform: "Facebook",
      handle: x.id.handle,
      name: x.fav.title,
      action,
      state: established ? (action === "friend" ? "accepted" : "following") : "requested",
      taskId: TASK_ID,
      requestedAt,
      updatedAt: established ? acceptedAt : requestedAt,
    });

    targets.push({
      id: `fc${i + 1}`,
      name: x.fav.title,
      handle: x.id.handle,
      socialId: socialIdOf(x.id.handle),
      kind: x.fav.kind === "enterprise" ? "enterprise" : "user",
      status: established ? (action === "friend" ? "accepted" : "following") : "requested",
      requestedAt,
      ...(established ? { acceptedAt } : {}),
    });
  });

  const task: ProspectingTask = {
    id: TASK_ID,
    name: "收藏中心 · 社媒加好友 / 关注",
    platform: ["Facebook"],
    targetKinds: ["enterprise", "user"],
    keywords: [],
    targetCap: targets.length,
    accountIds: ["sa_fb_1"],
    action: "connect",
    pacing: "normal",
    source: "收藏中心",
    status: "running",
    createdAt: hoursAgo(31),
    frozenCredits: targets.length * COST_SOCIAL_ADD_FRIEND,
    usedCredits: targets.length * COST_SOCIAL_ADD_FRIEND,
    targets,
  };

  upsertConnectRecords(connects);
  if (!getProspectingTasksSnapshot().some((t) => t.id === TASK_ID)) {
    upsertProspectingTask(task);
  }

  // 消费明细：每个加友 / 关注请求各扣 50 积分（避免重复写入）
  const existing = new Set(
    getAllLedger()
      .filter((e) => e.kind === "social_add_friend")
      .map((e) => `${e.targetId}:${e.targetName}`),
  );
  identities.forEach((x, i) => {
    const key = `${TASK_ID}:${x.fav.title}`;
    if (existing.has(key)) return;
    const action = x.id.accountType === "page" ? "关注" : "加好友";
    chargeSocialAddFriend({
      platform: "Facebook",
      targetName: x.fav.title,
      taskId: TASK_ID,
      targetKind: x.fav.kind === "enterprise" ? "enterprise" : "contact",
      targetId: TASK_ID,
      parentRef: x.fav.parentRef,
      detail: `Facebook ${action}请求 · ${x.id.handle}`,
      createdAt: hoursAgo(30 - i),
    });
  });

  window.localStorage.setItem(FLAG, "1");
}
