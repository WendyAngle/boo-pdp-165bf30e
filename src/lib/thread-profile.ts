/**
 * 触达会话 · 客户档案解析
 *
 * 会话的目标客户来源不同，「完整档案」的落点也不同：
 * 1) 企业名录企业        → 企业详情页
 * 2) 企业详情页关联人物  → 联系人详情页
 * 3) 社媒触达任务账号    → 名录中不存在，只能回到社媒账号 / 触达任务
 * 4) 外部会话（WhatsApp / 邮件等）→ 尚未沉淀为名录数据，无档案可跳
 *
 * 之前的实现无条件拼 /outreach/enterprise/$id，导致 3、4 两类会话
 * 打开后是「未找到该企业 / 未找到该人物」空页。
 */
import { findEnterprise } from "@/data/enterprises";
import type { Thread } from "@/lib/inbox-store";

export type ThreadProfile =
  | { kind: "enterprise"; id: string; name: string }
  | { kind: "contact"; entId: string; idx: string; entName: string; name: string }
  | { kind: "social"; platform: "Facebook" | "TikTok"; handle: string }
  | { kind: "external"; reason: string };

const SOCIAL_CHANNELS: Record<string, "Facebook" | "TikTok"> = {
  facebook: "Facebook",
  tiktok: "TikTok",
};

export function resolveThreadProfile(thread: Thread): ThreadProfile {
  // 社媒渠道：目标来自社媒触达任务 / 好友池，不存在名录档案
  const platform = SOCIAL_CHANNELS[thread.channel];
  if (platform) {
    return { kind: "social", platform, handle: thread.counterpartyAddress };
  }

  if (thread.targetKind === "enterprise") {
    const ent = findEnterprise(thread.targetId);
    if (ent) return { kind: "enterprise", id: ent.id, name: ent.name };
    return {
      kind: "external",
      reason: "该企业由外部会话产生，尚未匹配到企业名录记录",
    };
  }

  // 联系人：targetId 形如 `${enterpriseId}:${idx}`
  const [entId, rawIdx = "0"] = thread.targetId.split(":");
  const ent = entId ? findEnterprise(entId) : undefined;
  const idx = Number(rawIdx);
  if (ent && Number.isInteger(idx) && ent.contacts[idx]) {
    return {
      kind: "contact",
      entId: ent.id,
      idx: String(idx),
      entName: ent.name,
      name: ent.contacts[idx].name,
    };
  }
  return {
    kind: "external",
    reason: "该联系人由外部会话产生，尚未匹配到企业名录中的关联人物",
  };
}
