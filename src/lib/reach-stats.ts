import type { LedgerEntry } from "./credits-ledger";
import { getReachStatus } from "./credits-ledger";
import { formatDateTime } from "./format-date";
import { groupKeyOf } from "./reach-tasks";

export type ReachStatsChannel = "Facebook";

export interface ReachStatsMetrics {
  tasks: number;
  successes: number;
}

export interface ReachStatsMonth extends ReachStatsMetrics {
  month: number;
  label: string;
}

export interface ReachStatsRow extends ReachStatsMetrics {
  key: ReachStatsChannel;
  label: string;
  months: ReachStatsMonth[];
}

export interface ReachStatsResult {
  summary: ReachStatsMetrics;
  channels: ReachStatsRow[];
  months: ReachStatsMonth[];
}

export function beijingYearMonth(value: string | number | Date) {
  const [year, month] = formatDateTime(value).slice(0, 7).split("-").map(Number);
  return { year, month };
}

/** 独立实际执行时间优先；历史目标记录的 createdAt 即目标明细执行时间，顺延记录使用 scheduledAt。 */
export function reachExecutionTime(entry: LedgerEntry) {
  return entry.executedAt ?? entry.scheduledAt ?? entry.createdAt;
}

function deliveredRows(entries: LedgerEntry[], now: number) {
  return entries.filter((entry) =>
    entry.kind === "reach" && entry.channel === "social" && entry.platform === "Facebook" &&
    getReachStatus(entry, now) === "success" &&
    Number.isFinite(Date.parse(reachExecutionTime(entry))) &&
    Date.parse(reachExecutionTime(entry)) <= now,
  );
}

export function reachStatsYears(entries: LedgerEntry[], now = Date.now()) {
  const years = new Set<number>([beijingYearMonth(now).year]);
  for (const entry of deliveredRows(entries, now)) {
    years.add(beijingYearMonth(reachExecutionTime(entry)).year);
  }
  return [...years].sort((a, b) => b - a);
}

class Bucket {
  tasks = new Set<string>();
  successes = new Set<string>();
  add(entry: LedgerEntry) {
    const taskKey = groupKeyOf(entry);
    this.tasks.add(taskKey);
    this.successes.add(`${taskKey}:${entry.targetKind}:${entry.targetId}`);
  }
  metrics(): ReachStatsMetrics {
    return { tasks: this.tasks.size, successes: this.successes.size };
  }
}

const monthsOf = (buckets: Bucket[]): ReachStatsMonth[] =>
  buckets.map((bucket, i) => ({ month: i + 1, label: `${i + 1}月`, ...bucket.metrics() }));

function yearRows(entries: LedgerEntry[], year: number, now: number) {
  return deliveredRows(entries, now).filter(
    (entry) => beijingYearMonth(reachExecutionTime(entry)).year === year,
  );
}

export function aggregateReachStats(entries: LedgerEntry[], year: number, now = Date.now()): ReachStatsResult {
  const overall = new Bucket();
  const months = Array.from({ length: 12 }, () => new Bucket());
  for (const entry of yearRows(entries, year, now)) {
    const month = months[beijingYearMonth(reachExecutionTime(entry)).month - 1];
    if (!month) continue;
    overall.add(entry);
    month.add(entry);
  }
  const summary = overall.metrics();
  const monthly = monthsOf(months);
  return {
    summary,
    channels: [{ key: "Facebook", label: "Facebook", ...summary, months: monthly }],
    months: monthly,
  };
}

export type FacebookFindMode = "smart" | "post" | "group";

export const FACEBOOK_FIND_MODES: Array<{ key: FacebookFindMode; label: string }> = [
  { key: "smart", label: "系统智能搜索" },
  { key: "post", label: "指定贴文搜索" },
  { key: "group", label: "指定群组搜索" },
];

export interface FacebookSourceRow extends ReachStatsMetrics {
  key: FacebookFindMode;
  label: string;
  months: ReachStatsMonth[];
}

/** 历史未记录寻找方式的任务仍归入系统智能搜索；与整体使用相同执行月份口径。 */
export function aggregateFacebookSourceStats(entries: LedgerEntry[], year: number, now = Date.now()): FacebookSourceRow[] {
  const buckets = new Map(FACEBOOK_FIND_MODES.map(({ key }) => [key, {
    all: new Bucket(), months: Array.from({ length: 12 }, () => new Bucket()),
  }]));
  for (const entry of yearRows(entries, year, now)) {
    const bucket = buckets.get(entry.findMode ?? "smart");
    const month = bucket?.months[beijingYearMonth(reachExecutionTime(entry)).month - 1];
    if (!bucket || !month) continue;
    bucket.all.add(entry);
    month.add(entry);
  }
  return FACEBOOK_FIND_MODES.map(({ key, label }) => {
    const bucket = buckets.get(key);
    return { key, label, ...(bucket?.all.metrics() ?? { tasks: 0, successes: 0 }), months: monthsOf(bucket?.months ?? []) };
  });
}
