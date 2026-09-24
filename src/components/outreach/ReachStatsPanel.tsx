import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
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

      <Card className="p-5">
        <div className="mb-5">
          <div>
            <h3 className="text-sm font-semibold">月度效果对比</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">同时比较每月触达规模与成功率</p>
          </div>
        </div>
        <ChartContainer config={chartConfig} className="h-[320px] w-full aspect-auto">
          <ComposedChart data={activeMonths} margin={{ top: 8, right: 0, left: -12, bottom: 0 }}>
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
            <Bar yAxisId="count" dataKey="targets" fill="var(--color-targets)" radius={[3, 3, 0, 0]} maxBarSize={26} />
            <Bar yAxisId="count" dataKey="successes" fill="var(--color-successes)" radius={[3, 3, 0, 0]} maxBarSize={26} />
            <Line yAxisId="rate" type="monotone" dataKey="successRate" stroke="var(--color-successRate)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls={false} />
          </ComposedChart>
        </ChartContainer>
      </Card>

      <section aria-labelledby="monthly-stats-heading">
        <div className="mb-3">
          <h3 id="monthly-stats-heading" className="text-sm font-semibold">月度效果对比</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">仅展示有触达数据的月份，可横向比较总体及各渠道效果</p>
        </div>
        {activeMonths.length === 0 ? (
          <Card className="flex min-h-48 flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <div className="font-medium">该年份暂无触达任务数据</div>
              <div className="mt-1 text-sm text-muted-foreground">请选择其他年份查看</div>
            </div>
          </Card>
        ) : (
          <MonthlyComparison months={activeMonths} channels={stats.channels} />
        )}
      </section>
    </div>
  );
}

function MonthlyComparison({
  months,
  channels,
}: {
  months: ReturnType<typeof aggregateReachStats>["months"];
  channels: ReturnType<typeof aggregateReachStats>["channels"];
}) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/30">
              <th className="px-4 py-3 text-left font-medium" rowSpan={2}>月份</th>
              <th className="border-l px-3 py-2 text-center font-medium" colSpan={4}>总体效果</th>
              {channels.map((channel) => (
                <th key={channel.key} className="border-l px-3 py-2 text-center font-medium" colSpan={3}>
                  <span className="inline-flex items-center gap-1.5"><ChannelIcon channel={channel.key} />{channel.label}</span>
                </th>
              ))}
            </tr>
            <tr className="border-b bg-muted/20 text-xs text-muted-foreground">
              <th className="border-l px-3 py-2 font-normal">任务数</th>
              <th className="px-3 py-2 font-normal">目标数</th>
              <th className="px-3 py-2 font-normal">成功数</th>
              <th className="px-3 py-2 font-normal">成功率</th>
              {channels.map((channel) => (
                <MonthColumnHead key={channel.key} />
              ))}
            </tr>
          </thead>
          <tbody>
            {months.map((month) => (
              <tr key={month.month} className="border-b last:border-b-0 hover:bg-muted/20">
                <td className="px-4 py-4 text-base font-semibold">{month.label}</td>
                <MetricCell value={month.tasks} bordered />
                <MetricCell value={month.targets} />
                <MetricCell value={month.successes} emphasis />
                <MetricCell value={formatRate(month.successRate)} emphasis />
                {channels.map((channel) => {
                  const value = channel.months[month.month - 1];
                  return (
                    <ChannelMonthCells
                      key={channel.key}
                      targets={value?.targets ?? 0}
                      successes={value?.successes ?? 0}
                      successRate={value?.successRate ?? null}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function MonthColumnHead() {
  return (
    <>
      <th className="border-l px-3 py-2 font-normal">目标</th>
      <th className="px-3 py-2 font-normal">成功</th>
      <th className="px-3 py-2 font-normal">成功率</th>
    </>
  );
}

function ChannelMonthCells({ targets, successes, successRate }: { targets: number; successes: number; successRate: number | null }) {
  return (
    <>
      <MetricCell value={targets} bordered />
      <MetricCell value={successes} />
      <MetricCell value={formatRate(successRate)} />
    </>
  );
}

function MetricCell({ value, bordered = false, emphasis = false }: { value: React.ReactNode; bordered?: boolean; emphasis?: boolean }) {
  return (
    <td className={`${bordered ? "border-l" : ""} px-3 py-4 text-center tabular-nums ${emphasis ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
      {value}
    </td>
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