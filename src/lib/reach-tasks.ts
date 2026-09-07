import type { ReachChannel } from "./credits-ledger";
import { formatDateTime } from "./format-date";

/** 从明细中提取触达动作：社媒区分「加好友 / 私信」，其余按渠道语义 */
export function reachAction(r: {
  channel?: ReachChannel;
  detail?: string;
  platform?: string;
}) {
  const d = r.detail ?? "";
  if (d.includes("加好友")) return "加好友";
  if (d.includes("关注请求")) return "关注";
  if (r.channel === "social") return "私信";
  if (r.channel === "email") return "邮件触达";
  if (r.channel === "phone") return "短信触达";
  return "触达";
}

/** 触达记录 → 所属任务 key（社媒批次按批次名聚合，其余按渠道+动作+日期） */
export function groupKeyOf(r: {
  channel?: ReachChannel;
  platform?: string;
  subject?: string;
  detail?: string;
  createdAt: string;
}) {
  const day = r.createdAt.slice(0, 10);
  const batchName = r.channel === "social" && r.subject ? r.subject : null;
  return batchName
    ? `s:${batchName}:${r.platform ?? ""}`
    : `c:${r.channel}:${r.platform ?? ""}:${reachAction(r)}:${day}`;
}

/** 触达记录 → 任务名（日期部分统一为 yyyy-MM-dd HH:mm:ss） */
export function taskNameOf(r: {
  channel?: ReachChannel;
  platform?: string;
  subject?: string;
  detail?: string;
  createdAt: string;
}) {
  const batchName = r.channel === "social" && r.subject ? r.subject : null;
  const action = reachAction(r);
  return (
    batchName ??
    (r.platform ? `${r.platform}${action}` : action) +
      ` · ${formatDateTime(r.createdAt)}`
  );
}
