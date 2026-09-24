import type { LedgerEntry } from "./credits-ledger";
import { getReachStatus, isRetryableFailReason } from "./credits-ledger";
import { formatDateTime } from "./format-date";
import { resolveTaskConfig } from "./reach-task-config";
import { groupKeyOf } from "./reach-tasks";

export type ReachStatsChannel = "email" | "phone" | "Facebook";

/** 统计指标：计划目标数 → 实际目标数 → 实际发起数 → 触达成功数 */
export interface ReachStatsMetrics {
  tasks: number;
  /** 任务创建时填写的目标数量（上限）合计 */
  planned: number;
  /** 实际找到并纳入执行的目标数（任务内去重） */
  targets: number;
  /** 已出结果（成功 + 失败）的目标数，待触达/触达中不计入 */
  initiated: number;
  successes: number;
  /** 失败且可再触达 */
  retryable: number;
  /** 失败且不建议再触达 */
  nonRetryable: number;
  /** 目标填充率 = 实际目标数 ÷ 计划目标数 */
  fillRate: number | null;
  /** 触达成功率 = 触达成功数 ÷ 实际发起数 */
  successRate: number | null;
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

const CHANNELS: Array<{ key: ReachStatsChannel; label: string }> = [
  { key: "Facebook", label: "Facebook" },
  { key: "email", label: "邮件" },
  { key: "phone", label: "短信" },
];

function channelOf(entry: LedgerEntry): ReachStatsChannel | null {
  if (entry.channel === "email") return "email";
  if (entry.channel === "phone") return "phone";
  if (entry.channel === "social" && entry.platform === "Facebook") return "Facebook";
  return null;
}

function rate(n: number, d: number) {
  return d === 0 ? null : Math.round((n / d) * 1000) / 10;
}

export function beijingYearMonth(value: string | number | Date) {
  const [year, month] = formatDateTime(value).slice(0, 7).split("-").map(Number);
  return { year, month };
}

export function reachStatsYears(entries: LedgerEntry[], now = Date.now()) {
  const years = new Set<number>([beijingYearMonth(now).year]);
  for (const entry of entries) {
    if (entry.kind !== "reach") continue;
    years.add(beijingYearMonth(entry.createdAt).year);
  }
  return [...years].sort((a, b) => b - a);
}

class Bucket {
  tasks = new Set<string>();
  targets = new Set<string>();
  initiated = new Set<string>();
  successes = new Set<string>();
  retryable = new Set<string>();
  nonRetryable = new Set<string>();
  planned = 0;
  add(taskKey: string, targetKey: string, entry: LedgerEntry, now: number, planned: number) {
    if (!this.tasks.has(taskKey)) {
      this.tasks.add(taskKey);
      this.planned += planned;
    }
    this.targets.add(targetKey);
    const status = getReachStatus(entry, now);
    if (status === "success") {
      this.initiated.add(targetKey);
      this.successes.add(targetKey);
    } else if (status === "failed") {
      this.initiated.add(targetKey);
      (isRetryableFailReason(entry.failReason) ? this.retryable : this.nonRetryable).add(targetKey);
    }
  }
  metrics(): ReachStatsMetrics {
    const planned = Math.max(this.planned, this.targets.size);
    return {
      tasks: this.tasks.size,
      planned,
      targets: this.targets.size,
      initiated: this.initiated.size,
      successes: this.successes.size,
      retryable: this.retryable.size,
      nonRetryable: this.nonRetryable.size,
      fillRate: rate(this.targets.size, planned),
      successRate: rate(this.successes.size, this.initiated.size),
    };
  }
}

const monthsOf = (buckets: Bucket[]): ReachStatsMonth[] =>
  buckets.map((b, i) => ({ month: i + 1, label: `${i + 1}月`, ...b.metrics() }));

/** 每个任务的计划目标数：优先创建时保存的目标数量，否则取演示配置 */
function plannedByTask(rows: LedgerEntry[]) {
  const groups = new Map<string, LedgerEntry[]>();
  for (const e of rows) {
    const k = groupKeyOf(e);
    const list = groups.get(k);
    if (list) list.push(e);
    else groups.set(k, [e]);
  }
  const result = new Map<string, number>();
  for (const [k, list] of groups) {
    const cap = resolveTaskConfig(k, list, "").targetCap;
    result.set(k, cap ?? list.length);
  }
  return result;
}

function yearRows(entries: LedgerEntry[], year: number) {
  return entries.filter(
    (e) => e.kind === "reach" && channelOf(e) !== null && beijingYearMonth(e.createdAt).year === year,
  );
}

export function aggregateReachStats(entries: LedgerEntry[], year: number, now = Date.now()): ReachStatsResult {
  const rows = yearRows(entries, year);
  const planned = plannedByTask(rows);
  const overall = new Bucket();
  const months = Array.from({ length: 12 }, () => new Bucket());
  const channels = new Map(
    CHANNELS.map(({ key }) => [key, { all: new Bucket(), months: Array.from({ length: 12 }, () => new Bucket()) }]),
  );
  for (const entry of rows) {
    const ch = channels.get(channelOf(entry)!)!;
    const taskKey = groupKeyOf(entry);
    const targetKey = `${taskKey}:${entry.targetKind}:${entry.targetId}`;
    const m = beijingYearMonth(entry.createdAt).month - 1;
    const p = planned.get(taskKey) ?? 0;
    for (const b of [overall, months[m]!, ch.all, ch.months[m]!]) b.add(taskKey, targetKey, entry, now, p);
  }
  return {
    summary: overall.metrics(),
    channels: CHANNELS.map(({ key, label }) => {
      const ch = channels.get(key)!;
      return { key, label, ...ch.all.metrics(), months: monthsOf(ch.months) };
    }),
    months: monthsOf(months),
  };
}

/* ---------- Facebook 目标来源（寻找目标方式）细分统计 ---------- */

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

/** 仅统计 Facebook 渠道触达记录，按寻找目标方式归类；未记录方式的历史任务归入系统智能搜索 */
export function aggregateFacebookSourceStats(
  entries: LedgerEntry[],
  year: number,
  now = Date.now(),
): FacebookSourceRow[] {
  const rows = yearRows(entries, year).filter((e) => channelOf(e) === "Facebook");
  const planned = plannedByTask(rows);
  const buckets = new Map(
    FACEBOOK_FIND_MODES.map(({ key }) => [key, { all: new Bucket(), months: Array.from({ length: 12 }, () => new Bucket()) }]),
  );
  for (const entry of rows) {
    const bucket = buckets.get(entry.findMode ?? "smart");
    if (!bucket) continue;
    const taskKey = groupKeyOf(entry);
    const targetKey = `${taskKey}:${entry.targetKind}:${entry.targetId}`;
    const m = beijingYearMonth(entry.createdAt).month - 1;
    const p = planned.get(taskKey) ?? 0;
    for (const b of [bucket.all, bucket.months[m]!]) b.add(taskKey, targetKey, entry, now, p);
  }
  return FACEBOOK_FIND_MODES.map(({ key, label }) => {
    const b = buckets.get(key)!;
    return { key, label, ...b.all.metrics(), months: monthsOf(b.months) };
  });
}
