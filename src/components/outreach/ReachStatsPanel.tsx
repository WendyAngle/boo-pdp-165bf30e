import { useMemo, useState } from "react";
import { BarChart3, Mail, Phone, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LedgerEntry } from "@/lib/credits-ledger";
import {
  aggregateReachStats,
  beijingYearMonth,
  reachStatsYears,
  type ReachStatsChannel,
} from "@/lib/reach-stats";

export function ReachStatsPanel({ ledger, now }: { ledger: LedgerEntry[]; now: number }) {
  const current = beijingYearMonth(now);
  const years = useMemo(() => reachStatsYears(ledger, now), [ledger, now]);
  const [year, setYear] = useState(current.year);
  const stats = useMemo(
    () => aggregateReachStats(ledger, year, now),
    [ledger, year, now],
  );
  const hasData = stats.channels.some((channel) => channel.targets > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">渠道月度效果</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            按月查看邮件、短信和 Facebook 的任务数、目标数、成功数及成功率
          </p>
        </div>
        <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
          <SelectTrigger aria-label="统计年份" className="h-9 w-[112px] bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((item) => (
              <SelectItem key={item} value={String(item)}>{item} 年</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!hasData ? (
        <Card className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <div className="font-medium">该年份暂无触达任务数据</div>
              <div className="mt-1 text-sm text-muted-foreground">请选择其他年份查看</div>
            </div>
        </Card>
      ) : <div className="grid gap-4 xl:grid-cols-3">
        {stats.channels.map((channel) => <ChannelMonthlyStats key={channel.key} channel={channel} />)}
      </div>}
    </div>
  );
}

function ChannelMonthlyStats({ channel }: { channel: ReturnType<typeof aggregateReachStats>["channels"][number] }) {
  const months = channel.months.filter((month) => month.targets > 0);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b px-5 py-4">
        <span className="text-primary"><ChannelIcon channel={channel.key} /></span>
        <h3 className="font-semibold">{channel.label}</h3>
      </div>
      {months.length === 0 ? <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">该年份暂无数据</div> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead><tr className="border-b bg-muted/30 text-xs text-muted-foreground">
              <th className="px-4 py-3 text-left font-medium">月份</th><th className="px-3 py-3 text-right font-medium">任务数</th><th className="px-3 py-3 text-right font-medium">目标数</th><th className="px-3 py-3 text-right font-medium">成功数</th><th className="px-4 py-3 text-right font-medium">成功率</th>
            </tr></thead>
            <tbody>{months.map((month) => <tr key={month.month} className="border-b last:border-0">
              <td className="px-4 py-3 font-medium">{month.label}</td><td className="px-3 py-3 text-right tabular-nums">{month.tasks}</td><td className="px-3 py-3 text-right tabular-nums">{month.targets}</td><td className="px-3 py-3 text-right font-semibold tabular-nums">{month.successes}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{formatRate(month.successRate)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ChannelIcon({ channel }: { channel: ReachStatsChannel }) {
  if (channel === "email") return <Mail className="h-4 w-4" />;
  if (channel === "phone") return <Phone className="h-4 w-4" />;
  return <Send className="h-4 w-4" />;
}

function formatRate(value: number | null) {
  return value === null ? "—" : `${value}%`;
}