/**
 * PR-1 · Activity Store（统一活动时间线，聚合视图）
 *
 * 目标：为公司/联系人页与后续 Timeline 提供跨 inbox / reach 的统一沟通事实源。
 * 本 PR 不改动写入侧——直接聚合现有 `credits-ledger`（外联真源）与 `inbox-store`
 * 中的入站消息，输出去重后的 Activity 列表。等 PR-3 完成后，读源可以完全切至此。
 */
import { useMemo } from "react";
import {
  useLedger,
  getReachStatus,
  type LedgerEntry,
  type ReachChannel,
  type ReachStatus,
} from "@/lib/credits-ledger";
import { useThreads, threadKeyFor, type Thread } from "@/lib/inbox-store";

export type ActivityKind =
  | "message" // 收到的入站消息
  | "outreach" // 外联任务（我方发出的一次触达）
  | "call"
  | "meeting"
  | "note"
  | "stage";

export interface Activity {
  id: string;
  kind: ActivityKind;
  channel?: ReachChannel | "whatsapp" | "linkedin" | "sms";
  direction?: "inbound" | "outbound";
  targetKind: "enterprise" | "contact";
  targetId: string;
  threadId?: string;
  taskId?: string;
  occurredAt: string;
  summary: string;
  status?: ReachStatus | "replied";
  senderEmail?: string;
}

/* -------------------- adapters -------------------- */

function ledgerToOutreach(r: LedgerEntry): Activity | null {
  if (r.kind !== "reach") return null;
  return {
    id: `outreach_${r.id}`,
    kind: "outreach",
    channel: r.channel,
    direction: "outbound",
    targetKind: r.targetKind,
    targetId: r.targetId,
    threadId: threadKeyFor(r) ?? undefined,
    taskId: r.id,
    occurredAt: r.createdAt,
    summary:
      r.subject?.trim() ||
      r.content?.slice(0, 90) ||
      `${r.channel === "email" ? "邮件" : r.channel === "phone" ? "短信" : "社媒"}触达 ${r.detail ?? ""}`.trim(),
    status: getReachStatus(r),
    senderEmail: r.senderEmail,
  };
}

function threadInboundToActivities(t: Thread): Activity[] {
  const out: Activity[] = [];
  for (const m of t.messages) {
    if (m.direction !== "inbound") continue;
    out.push({
      id: `msg_${m.id}`,
      kind: "message",
      channel: t.channel as Activity["channel"],
      direction: "inbound",
      targetKind: t.targetKind,
      targetId: t.targetId,
      threadId: t.id,
      occurredAt: m.createdAt,
      summary: (m.content ?? "").slice(0, 90),
      status: "replied",
      senderEmail: t.senderEmail,
    });
  }
  return out;
}

/* -------------------- aggregator -------------------- */

function aggregate(
  ledger: LedgerEntry[],
  threads: Thread[],
  targetKind: "enterprise" | "contact",
  targetId: string,
): Activity[] {
  const list: Activity[] = [];
  for (const r of ledger) {
    if (r.targetKind !== targetKind || r.targetId !== targetId) continue;
    const a = ledgerToOutreach(r);
    if (a) list.push(a);
  }
  for (const t of threads) {
    if (t.targetKind !== targetKind || t.targetId !== targetId) continue;
    list.push(...threadInboundToActivities(t));
  }
  list.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
  return list;
}

/* -------------------- hooks -------------------- */

export function useCompanyActivities(
  targetKind: "enterprise" | "contact",
  targetId: string,
): Activity[] {
  const ledger = useLedger();
  const threads = useThreads();
  return useMemo(
    () => aggregate(ledger, threads, targetKind, targetId),
    [ledger, threads, targetKind, targetId],
  );
}

export function useLatestActivityFor(
  targetKind: "enterprise" | "contact",
  targetId: string,
): Activity | undefined {
  const list = useCompanyActivities(targetKind, targetId);
  return list[0];
}