import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { BarChart3, CheckCircle2, Send, Target, TrendingUp } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LedgerEntry } from "@/lib/credits-ledger";
import {
  aggregateReachStats,
  beijingYearMonth,
  reachStatsYears,
} from "@/lib/reach-stats";

const chartConfig = {
  targets: { label: "目标数", color: "var(--chart-3)" },
  successes: { label: "成功数", color: "var(--chart-2)" },
} satisfies ChartConfig;

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

export function ReachStatsPanel({ ledger, now }: { ledger: LedgerEntry[]; now: number }) {
  const current = beijingYearMonth(now);
  const years = useMemo(() => reachStatsYears(ledger, now), [ledger, now]);
  const [year, setYear] = useState(current.year);
  const [month, setMonth] = useState(current.month);
  const stats = useMemo(
    () => aggregateReachStats(ledger, year, month, now),
    [ledger, year, month, now],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">月度触达效果</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            成功指发送或请求成功送达，不代表客户回复
          </p>
        </div>
        <div className="flex items-center gap-2">
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
          <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}>
            <SelectTrigger aria-label="统计月份" className="h-9 w-[96px] bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((item) => (
                <SelectItem key={item} value={String(item)}>{item} 月</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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

      {stats.channels.length === 0 ? (
        <Card className="flex min-h-72 flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <div className="font-medium">该月份暂无触达任务数据</div>
            <div className="mt-1 text-sm text-muted-foreground">请选择其他年份或月份查看</div>
          </div>
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">月度触达趋势</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">各渠道目标数与成功数对比</p>
            </div>
            <ChartContainer config={chartConfig} className="h-[260px] w-full aspect-auto">
              <BarChart data={stats.channels} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} cursor={false} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="targets" fill="var(--color-targets)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="successes" fill="var(--color-successes)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-b bg-muted/20 px-5 py-3">
              <h3 className="text-sm font-semibold">渠道统计</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="bg-primary/5 hover:bg-primary/5">
                  <TableHead>渠道</TableHead>
                  <TableHead className="text-right">任务数</TableHead>
                  <TableHead className="text-right">目标数</TableHead>
                  <TableHead className="text-right">成功数</TableHead>
                  <TableHead className="text-right">成功率</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.channels.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.tasks}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.targets}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.successes}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatRate(row.successRate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">当月合计</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{stats.summary.tasks}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{stats.summary.targets}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{stats.summary.successes}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatRate(stats.summary.successRate)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
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