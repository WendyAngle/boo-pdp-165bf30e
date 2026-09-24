import { useEffect, useMemo, useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { BarChart3, CheckCircle2, Mail, Phone, Send, Target, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
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

const CHANNEL_COLORS: Record<ReachStatsChannel, string> = {
  email: "var(--chart-1)",
  phone: "var(--chart-2)",
  Facebook: "var(--chart-3)",
};

const chartConfig = {
  targets: { label: "目标数", color: "var(--chart-1)" },
  successes: { label: "成功数", color: "var(--chart-2)" },
  successRate: { label: "成功率", color: "var(--chart-3)" },
} satisfies ChartConfig;

export function ReachStatsPanel({ ledger, now }: { ledger: LedgerEntry[]; now: number }) {
  const current = beijingYearMonth(now);
  const years = useMemo(() => reachStatsYears(ledger, now), [ledger, now]);
  const [year, setYear] = useState(current.year);
  const stats = useMemo(
    () => aggregateReachStats(ledger, year, now),
    [ledger, year, now],
  );
  const activeMonths = useMemo(
    () => stats.months.filter((month) => month.targets > 0),
    [stats.months],
  );
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const selectedMonthStats = activeMonths.find((month) => month.month === selectedMonth)
    ?? activeMonths.at(-1)
    ?? null;

  useEffect(() => {
    setSelectedMonth(activeMonths.at(-1)?.month ?? null);
  }, [year, activeMonths]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">年度触达效果</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            成功指发送或请求成功送达，不代表客户回复
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatsCard icon={<Send className="h-5 w-5" />} label="任务总数" value={stats.summary.tasks} />
        <StatsCard icon={<Target className="h-5 w-5" />} label="目标总数" value={stats.summary.targets} />
        <StatsCard icon={<CheckCircle2 className="h-5 w-5" />} label="成功数" value={stats.summary.successes} />
        <StatsCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="总成功率"
          value={formatRate(stats.summary.successRate)}
        />
      </div>

      {activeMonths.length === 0 ? (
        <Card className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <div className="font-medium">该年份暂无触达任务数据</div>
              <div className="mt-1 text-sm text-muted-foreground">请选择其他年份查看</div>
            </div>
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <div className="mb-5">
              <h3 className="text-sm font-semibold">月度效果趋势</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">比较各月触达规模与成功率，点击月份查看渠道构成</p>
            </div>
            <ChartContainer config={chartConfig} className="h-[320px] w-full aspect-auto">
              <ComposedChart
                data={activeMonths}
                margin={{ top: 8, right: 0, left: -12, bottom: 0 }}
                className="cursor-pointer"
                onClick={(state) => {
                  const month = state?.activePayload?.[0]?.payload?.month;
                  if (typeof month === "number") setSelectedMonth(month);
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis yAxisId="count" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis
                  yAxisId="rate"
                  orientation="right"
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  tickLine={false}
                  axisLine={false}
                  width={42}
                />
                <ChartTooltip
                  content={<ChartTooltipContent formatter={(value, name) => (
                    <div className="flex flex-1 items-center justify-between gap-6">
                      <span className="text-muted-foreground">{chartConfig[name as keyof typeof chartConfig]?.label}</span>
                      <span className="font-mono font-medium tabular-nums">
                        {name === "successRate" ? (value === null ? "—" : `${value}%`) : Number(value).toLocaleString()}
                      </span>
                    </div>
                  )} />}
                />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar yAxisId="count" dataKey="targets" fill="var(--color-targets)" radius={[3, 3, 0, 0]} maxBarSize={26}>
                  {activeMonths.map((month) => <Cell key={month.month} fillOpacity={month.month === selectedMonthStats?.month ? 1 : 0.38} />)}
                </Bar>
                <Bar yAxisId="count" dataKey="successes" fill="var(--color-successes)" radius={[3, 3, 0, 0]} maxBarSize={26}>
                  {activeMonths.map((month) => <Cell key={month.month} fillOpacity={month.month === selectedMonthStats?.month ? 1 : 0.38} />)}
                </Bar>
                <Line yAxisId="rate" type="monotone" dataKey="successRate" stroke="var(--color-successRate)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} />
              </ComposedChart>
            </ChartContainer>
          </Card>

          {selectedMonthStats ? (
            <MonthlyChannelAnalysis month={selectedMonthStats} channels={stats.channels} />
          ) : null}
        </>
      )}
    </div>
  );
}

function MonthlyChannelAnalysis({
  month,
  channels,
}: {
  month: ReturnType<typeof aggregateReachStats>["months"][number];
  channels: ReturnType<typeof aggregateReachStats>["channels"];
}) {
  return (
    <section aria-labelledby="channel-analysis-heading" className="space-y-3">
      <div>
        <h3 id="channel-analysis-heading" className="text-sm font-semibold">{month.label}渠道效果</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">查看所选月份的总体结果及各渠道构成</p>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-4">
        <MonthMetric label="任务数" value={month.tasks} />
        <MonthMetric label="目标数" value={month.targets} />
        <MonthMetric label="成功数" value={month.successes} />
        <MonthMetric label="成功率" value={formatRate(month.successRate)} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {channels.map((channel) => {
          const value = channel.months[month.month - 1];
          const hasData = (value?.targets ?? 0) > 0;
          return (
            <Card key={channel.key} className="p-5">
              <div className="mb-4 flex items-center gap-2 font-medium">
                <span className="text-primary"><ChannelIcon channel={channel.key} /></span>
                {channel.label}
              </div>
              {hasData && value ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <ChannelMetric label="任务数" value={value.tasks} />
                  <ChannelMetric label="目标数" value={value.targets} />
                  <ChannelMetric label="成功数" value={value.successes} emphasis />
                  <ChannelMetric label="成功率" value={formatRate(value.successRate)} emphasis />
                </dl>
              ) : (
                <div className="flex h-[76px] items-center justify-center text-sm text-muted-foreground">本月暂无数据</div>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function MonthMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-background px-4 py-3 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ChannelMetric({ label, value, emphasis = false }: { label: string; value: React.ReactNode; emphasis?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-1 text-lg tabular-nums ${emphasis ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{value}</dd>
    </div>
  );
}

function ChannelIcon({ channel }: { channel: ReachStatsChannel }) {
  if (channel === "email") return <Mail className="h-4 w-4" />;
  if (channel === "phone") return <Phone className="h-4 w-4" />;
  return <Send className="h-4 w-4" />;
}

function StatsCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      </div>
    </Card>
  );
}

function formatRate(value: number | null) {
  return value === null ? "—" : `${value}%`;
}