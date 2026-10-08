import { test } from "node:test";
import assert from "node:assert/strict";
import type { LedgerEntry } from "./credits-ledger";
import { aggregateReachStats, aggregateFacebookSourceStats, reachStatsYears } from "./reach-stats";

const now = Date.parse("2026-12-31T15:59:59Z");
function row(id: string, executedAt: string, extra: Partial<LedgerEntry> = {}): LedgerEntry {
  return { id, kind: "reach", cost: 50, createdAt: "2026-09-01T00:00:00Z", executedAt,
    targetKind: "contact", targetId: id, targetName: id, channel: "social", platform: "Facebook",
    subject: "跨月任务", forcedStatus: "success", ...extra };
}

test("September-created targets executed in October count only in October", () => {
  const stats = aggregateReachStats([row("a", "2026-10-01T00:00:00Z")], 2026, now);
  assert.equal(stats.months[8]?.successes, 0);
  assert.equal(stats.months[9]?.successes, 1);
});
test("Beijing month boundary belongs to October", () => {
  const stats = aggregateReachStats([row("a", "2026-09-30T16:00:00Z")], 2026, now);
  assert.equal(stats.months[9]?.tasks, 1);
});
test("cross-month task counts once annually and once in each active month", () => {
  const stats = aggregateReachStats([row("a", "2026-09-02T00:00:00Z"), row("b", "2026-10-02T00:00:00Z")], 2026, now);
  assert.deepEqual(stats.summary, { tasks: 1, successes: 2 });
  assert.equal(stats.months[8]?.tasks, 1);
  assert.equal(stats.months[9]?.tasks, 1);
});
test("pending, running, failed and other channels do not count as reached", () => {
  const entries = [row("a", "2026-10-02T00:00:00Z", { forcedStatus: "pending" }),
    row("b", "2026-10-02T00:00:00Z", { forcedStatus: "in_progress" }),
    row("c", "2026-10-02T00:00:00Z", { forcedStatus: "failed" }),
    row("d", "2026-10-02T00:00:00Z", { platform: "TikTok" })];
  assert.deepEqual(aggregateReachStats(entries, 2026, now).summary, { tasks: 0, successes: 0 });
});
test("execution year rather than task creation year determines year options", () => {
  const entries = [row("a", "2026-01-01T00:00:00Z", { createdAt: "2025-12-01T00:00:00Z" })];
  assert.deepEqual(reachStatsYears(entries, now), [2026]);
  assert.equal(aggregateReachStats(entries, 2025, now).summary.tasks, 0);
});
test("historical deferred execution uses scheduled time", () => {
  const stats = aggregateReachStats([row("a", "", { executedAt: undefined, scheduledAt: "2026-10-01T00:00:00Z" })], 2026, now);
  assert.equal(stats.months[9]?.successes, 1);
});
test("duplicate target records count once per task", () => {
  const entry = row("a", "2026-10-02T00:00:00Z");
  assert.equal(aggregateReachStats([entry, { ...entry, id: "duplicate" }], 2026, now).summary.successes, 1);
});
test("all three source categories reconcile with the overall execution-month totals", () => {
  const entries = [row("a", "2026-10-02T00:00:00Z", { subject: "智能" }),
    row("b", "2026-10-02T00:00:00Z", { subject: "贴文", findMode: "post" }),
    row("c", "2026-10-02T00:00:00Z", { subject: "群组", findMode: "group" })];
  const sources = aggregateFacebookSourceStats(entries, 2026, now);
  assert.deepEqual(sources.map((s) => s.successes), [1, 1, 1]);
  assert.equal(sources.reduce((total, s) => total + s.tasks, 0), aggregateReachStats(entries, 2026, now).summary.tasks);
});