import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { BarChart3, CheckCircle2, Mail, MessageCircle, Phone, Send, Target, TrendingUp } from "lucide-react";
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
  TikTok: "var(--chart-4)",
  WhatsApp: "var(--chart-5)",
  "other-social": "var(--primary)",
};

const chartConfig = {
  email: { label: "邮件", color: CHANNEL_COLORS.email },
  phone: { label: "短信", color: CHANNEL_COLORS.phone },
  Facebook: { label: "Facebook", color: CHANNEL_COLORS.Facebook },
  TikTok: { label: "TikTok", color: CHANNEL_COLORS.TikTok },
  WhatsApp: { label: "WhatsApp", color: CHANNEL_COLORS.WhatsApp },
  "other-social": { label: "其他社媒", color: CHANNEL_COLORS["other-social"] },
} satisfies ChartConfig;

export function ReachStatsPanel({ ledger, now }: { ledger: LedgerEntry[]; now: number }) {
  const current = beijingYearMonth(now);
  const years = useMemo(() => reachStatsYears(ledger, now), [ledger, now]);
  const [year, setYear] = useState(current.year);
  const [trendMetric, setTrendMetric] = useState<"targets" | "successes">("targets");
  const stats = useMemo(
    () => aggregateReachStats(ledger, year, now),
    [ledger, year, now],
  );
  const trendData = useMemo(
    () => stats.months.map((month) => ({
      label: month.label,
      ...Object.fromEntries(stats.channels.map((channel) => [
        channel.key,
        channel.months[month.month - 1]?.[trendMetric] ?? 0,
      ])),
    })),
    [stats, trendMetric],
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

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">月度触达趋势</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{year} 年各渠道 1–12 月变化</p>
          </div>
          <div className="flex rounded-md border bg-muted/30 p-0.5" aria-label="趋势指标">
            <Button
              size="sm"
              variant={trendMetric === "targets" ? "secondary" : "ghost"}
              className="h-7 px-3"
              onClick={() => setTrendMetric("targets")}
            >
              目标数
            </Button>
            <Button
              size="sm"
              variant={trendMetric === "successes" ? "secondary" : "ghost"}
              className="h-7 px-3"
              onClick={() => setTrendMetric("successes")}
            >
              成功数
            </Button>
          </div>
        </div>
        <ChartContainer config={chartConfig} className="h-[280px] w-full aspect-auto">
          <LineChart data={trendData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
            <ChartLegend content={<ChartLegendContent />} />
            {stats.channels.map((channel) => (
              <Line
                key={channel.key}
                type="monotone"
                dataKey={channel.key}
                stroke={`var(--color-${channel.key})`}
                strokeWidth={2.25}
                dot={{ r: 2.5 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ChartContainer>
      </Card>

      <section aria-labelledby="channel-stats-heading">
        <h3 id="channel-stats-heading" className="mb-3 text-sm font-semibold">渠道统计</h3>
        {stats.channels.length === 0 ? (
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
            {stats.channels.map((row) => (
              <ChannelCard key={row.key} row={row} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ChannelCard({ row }: { row: ReturnType<typeof aggregateReachStats>["channels"][number] }) {
  const metrics = [
    { label: "任务数", value: row.tasks },
    { label: "目标数", value: row.targets },
    { label: "成功数", value: row.successes },
    { label: "成功率", value: formatRate(row.successRate) },
  ];

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ChannelIcon channel={row.key} />
          </div>
          <div>
            <h4 className="font-semibold">{row.label}</h4>
            <span className="text-xs text-muted-foreground">年度汇总</span>
          </div>
        </div>
        <div className="grid w-full grid-cols-4 gap-2 sm:w-auto sm:min-w-[360px]">
          {metrics.map((metric) => (
            <div key={metric.label} className="min-w-0 text-center">
              <div className="text-xs text-muted-foreground">{metric.label}</div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{metric.value}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {row.months.map((month) => (
          <div key={month.month} className="bg-card p-3">
            <div className="mb-2 text-xs font-semibold">{month.label}</div>
            <div className="grid grid-cols-4 gap-1 text-center">
              <MonthlyMetric label="任务" value={month.tasks} />
              <MonthlyMetric label="目标" value={month.targets} />
              <MonthlyMetric label="成功" value={month.successes} />
              <MonthlyMetric label="成功率" value={formatRate(month.successRate)} />
            </div>
          </div>
        ))}
      </div>
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
  if (channel === "WhatsApp") return <MessageCircle className="h-4 w-4" />;
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