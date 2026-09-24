import { useMemo, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { BarChart3, CheckCircle2, Mail, Phone, Send, Target, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const hasData = stats.summary.targets > 0;

  const scrollToMonth = (month: number) => {
    document.getElementById(`reach-stats-month-${month}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

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
          <ComposedChart data={stats.months} margin={{ top: 8, right: 0, left: -12, bottom: 0 }}>
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="monthly-stats-heading" className="text-sm font-semibold">月度效果明细</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">按月查看邮件、短信、Facebook 的触达效果</p>
          </div>
          <div className="flex max-w-full gap-1 overflow-x-auto pb-1" aria-label="快速定位月份">
            {stats.months.map((month) => (
              <Button key={month.month} variant="outline" size="sm" className="h-8 shrink-0 px-2.5" onClick={() => scrollToMonth(month.month)}>
                {month.label}
              </Button>
            ))}
          </div>
        </div>
        {!hasData ? (
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
          <div className="space-y-4">
            {stats.months.map((month) => (
              <MonthCard
                key={month.month}
                month={month}
                channels={stats.channels}
                isCurrentMonth={year === current.year && month.month === current.month}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MonthCard({
  month,
  channels,
  isCurrentMonth,
}: {
  month: ReturnType<typeof aggregateReachStats>["months"][number];
  channels: ReturnType<typeof aggregateReachStats>["channels"];
  isCurrentMonth: boolean;
}) {
  const metrics = [
    { label: "任务数", value: month.tasks },
    { label: "目标数", value: month.targets },
    { label: "成功数", value: month.successes },
    { label: "成功率", value: formatRate(month.successRate) },
  ];

  return (
    <Card id={`reach-stats-month-${month.month}`} className="scroll-mt-4 overflow-hidden">
      <div className="flex flex-col gap-4 border-b bg-muted/20 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-xl font-semibold">{month.label}</h4>
          {isCurrentMonth ? <Badge variant="secondary">本月</Badge> : null}
        </div>
        <div className="grid grid-cols-4 gap-3 sm:min-w-[420px]">
          {metrics.map((metric) => (
            <div key={metric.label} className="min-w-0 text-center">
              <div className="text-xs text-muted-foreground">{metric.label}</div>
              <div className="mt-1 text-lg font-semibold tabular-nums sm:text-xl">{metric.value}</div>
            </div>
          ))}
        </div>
      </div>
      {month.targets === 0 ? (
        <div className="px-5 py-6 text-center text-sm text-muted-foreground">本月暂无触达数据</div>
      ) : (
        <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {channels.map((channel) => {
            const channelMonth = channel.months[month.month - 1];
            return (
              <div key={channel.key} className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <ChannelIcon channel={channel.key} />
                  </span>
                  <span className="text-sm font-semibold">{channel.label}</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <MonthlyMetric label="目标数" value={channelMonth?.targets ?? 0} />
                  <MonthlyMetric label="成功数" value={channelMonth?.successes ?? 0} />
                  <MonthlyMetric label="成功率" value={formatRate(channelMonth?.successRate ?? null)} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function MonthlyMetric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-xs font-medium tabular-nums">{value}</div>
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