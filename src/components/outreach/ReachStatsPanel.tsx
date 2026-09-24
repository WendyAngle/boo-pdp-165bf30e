import { useMemo, useState, type ReactNode } from "react";
import { BarChart3, FileText, Mail, Phone, Send, Sparkles, Users } from "lucide-react";
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
  aggregateFacebookSourceStats,
  aggregateReachStats,
  type FacebookFindMode,
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
  const fbSources = useMemo(
    () => aggregateFacebookSourceStats(ledger, year, now),
    [ledger, year, now],
  );
  const hasData = stats.channels.some((channel) => channel.targets > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">渠道月度效果</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            按月查看 Facebook 的计划目标数、已触达数与目标填充率
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            统计规则：数据按任务创建时间归入对应月份（跨月执行的任务计入创建当月）；已触达指发送/请求成功送达，不代表客户回复。
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            目标填充率 = 已触达数 ÷ 计划目标数，衡量目标池供给与找目标的能力；填充率偏低说明计划目标数虚高或来源可用数据不足。
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
      ) : <div className="grid gap-4 xl:grid-cols-2">
        {stats.channels.map((channel) => <ChannelMonthlyStats key={channel.key} channel={channel} />)}
      </div>}

      {hasData && fbSources.some((s) => s.targets > 0) && (
        <div className="space-y-3 pt-2">
          <div>
            <h2 className="text-base font-semibold">Facebook 目标来源效果</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              对上方 Facebook 渠道按任务「寻找目标方式」细分，三种来源合计与 Facebook 渠道数据一致
            </p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {fbSources.map((source) => (
              <MonthlyStatsCard
                key={source.key}
                icon={<SourceIcon mode={source.key} />}
                title={source.label}
                subtitle="Facebook"
                months={source.months}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChannelMonthlyStats({ channel }: { channel: ReturnType<typeof aggregateReachStats>["channels"][number] }) {
  return <MonthlyStatsCard icon={<ChannelIcon channel={channel.key} />} title={channel.label} months={channel.months} />;
}

function MonthlyStatsCard({
  icon,
  title,
  subtitle,
  months: allMonths,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  months: ReturnType<typeof aggregateReachStats>["months"];
}) {
  const months = allMonths.filter((month) => month.targets > 0);
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <span className="text-primary">{icon}</span>
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
      </div>
      {months.length === 0 ? <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">该年份暂无数据</div> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[380px] text-sm">
            <thead><tr className="border-b bg-muted/30 text-xs text-muted-foreground">
              <th className="w-[18%] px-3 py-2 text-left font-medium">月份</th>
              <th className="w-[15%] px-2 py-2 text-right font-medium">任务数</th>
              <th className="w-[22%] px-2 py-2 text-right font-medium">计划目标数</th>
              <th className="w-[20%] px-2 py-2 text-right font-medium">已触达数</th>
              <th className="w-[25%] px-3 py-2 text-right font-medium">目标填充率</th>
            </tr></thead>
            <tbody>{months.map((month) => <tr key={month.month} className="border-b last:border-0">
              <td className="px-3 py-2 font-medium">{month.label}</td>
              <td className="px-2 py-2 text-right tabular-nums">{month.tasks}</td>
              <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">{month.planned}</td>
              <td className="px-2 py-2 text-right font-semibold tabular-nums text-primary">{month.successes}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatRate(month.fillRate)}</td>
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

function SourceIcon({ mode }: { mode: FacebookFindMode }) {
  if (mode === "smart") return <Sparkles className="h-4 w-4" />;
  if (mode === "post") return <FileText className="h-4 w-4" />;
  return <Users className="h-4 w-4" />;
}

function formatRate(value: number | null) {
  return value === null ? "—" : `${value}%`;
}