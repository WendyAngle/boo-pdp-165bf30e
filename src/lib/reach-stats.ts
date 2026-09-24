import type { LedgerEntry } from "./credits-ledger";
import { getReachStatus } from "./credits-ledger";
import { formatDateTime } from "./format-date";
import { groupKeyOf } from "./reach-tasks";

export type ReachStatsChannel =
  | "email"
  | "phone"
  | "Facebook"
  | "TikTok"
  | "WhatsApp"
  | "other-social";

export interface ReachStatsRow {
  key: ReachStatsChannel;
  label: string;
  tasks: number;
  targets: number;
  successes: number;
  successRate: number | null;
  months: ReachStatsMonth[];
}

export interface ReachStatsMonth {
  month: number;
  label: string;
  tasks: number;
  targets: number;
  successes: number;
  successRate: number | null;
}

export interface ReachStatsSummary {
  tasks: number;
  targets: number;
  successes: number;
  successRate: number | null;
}

export interface ReachStatsResult {
  summary: ReachStatsSummary;
  channels: ReachStatsRow[];
  months: ReachStatsMonth[];
}

const CHANNELS: Array<{ key: ReachStatsChannel; label: string }> = [
  { key: "email", label: "邮件" },
  { key: "phone", label: "短信" },
  { key: "Facebook", label: "Facebook" },
  { key: "TikTok", label: "TikTok" },
  { key: "WhatsApp", label: "WhatsApp" },
  { key: "other-social", label: "其他社媒" },
];

function channelOf(entry: LedgerEntry): ReachStatsChannel | null {
  if (entry.channel === "email") return "email";
  if (entry.channel === "phone") return "phone";
  if (entry.channel !== "social") return null;
  if (entry.platform === "Facebook") return "Facebook";
  if (entry.platform === "TikTok") return "TikTok";
  if (entry.platform === "WhatsApp") return "WhatsApp";
  return "other-social";
}

function rate(successes: number, targets: number) {
  return targets === 0 ? null : Math.round((successes / targets) * 1000) / 10;
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

export function aggregateReachStats(
  entries: LedgerEntry[],
  year: number,
  now = Date.now(),
): ReachStatsResult {
  const rows = entries.filter((entry) => {
    if (entry.kind !== "reach") return false;
    const value = beijingYearMonth(entry.createdAt);
    return value.year === year;
  });

  const overallTasks = new Set<string>();
  const overallTargets = new Set<string>();
  const overallSuccesses = new Set<string>();
  const buckets = new Map<
    ReachStatsChannel,
    {
      tasks: Set<string>;
      targets: Set<string>;
      successes: Set<string>;
      months: Array<{ tasks: Set<string>; targets: Set<string>; successes: Set<string> }>;
    }
  >();
  const monthBuckets = Array.from({ length: 12 }, () => ({
    tasks: new Set<string>(),
    targets: new Set<string>(),
    successes: new Set<string>(),
  }));

  for (const channel of CHANNELS) {
    buckets.set(channel.key, {
      tasks: new Set<string>(),
      targets: new Set<string>(),
      successes: new Set<string>(),
      months: Array.from({ length: 12 }, () => ({
        tasks: new Set<string>(),
        targets: new Set<string>(),
        successes: new Set<string>(),
      })),
    });
  }

  for (const entry of rows) {
    const channel = channelOf(entry);
    if (!channel) continue;
    const taskKey = groupKeyOf(entry);
    const targetKey = `${taskKey}:${entry.targetKind}:${entry.targetId}`;
    const bucket = buckets.get(channel);
    const entryMonth = beijingYearMonth(entry.createdAt).month;
    const monthBucket = monthBuckets[entryMonth - 1];
    const channelMonthBucket = bucket?.months[entryMonth - 1];
    if (!bucket || !monthBucket || !channelMonthBucket) continue;

    overallTasks.add(taskKey);
    overallTargets.add(targetKey);
    bucket.tasks.add(taskKey);
    bucket.targets.add(targetKey);
    monthBucket.tasks.add(taskKey);
    monthBucket.targets.add(targetKey);
    channelMonthBucket.tasks.add(taskKey);
    channelMonthBucket.targets.add(targetKey);

    if (getReachStatus(entry, now) === "success") {
      overallSuccesses.add(targetKey);
      bucket.successes.add(targetKey);
      monthBucket.successes.add(targetKey);
      channelMonthBucket.successes.add(targetKey);
    }
  }

  const channels = CHANNELS.flatMap(({ key, label }) => {
    const bucket = buckets.get(key);
    if (!bucket || bucket.targets.size === 0) return [];
    return [
      {
        key,
        label,
        tasks: bucket.tasks.size,
        targets: bucket.targets.size,
        successes: bucket.successes.size,
        successRate: rate(bucket.successes.size, bucket.targets.size),
        months: bucket.months.map((monthBucket, index) => ({
          month: index + 1,
          label: `${index + 1}月`,
          tasks: monthBucket.tasks.size,
          targets: monthBucket.targets.size,
          successes: monthBucket.successes.size,
          successRate: rate(monthBucket.successes.size, monthBucket.targets.size),
        })),
      },
    ];
  });

  return {
    summary: {
      tasks: overallTasks.size,
      targets: overallTargets.size,
      successes: overallSuccesses.size,
      successRate: rate(overallSuccesses.size, overallTargets.size),
    },
    channels,
    months: monthBuckets.map((bucket, index) => ({
      month: index + 1,
      label: `${index + 1}月`,
      tasks: bucket.tasks.size,
      targets: bucket.targets.size,
      successes: bucket.successes.size,
    })),
  };
}