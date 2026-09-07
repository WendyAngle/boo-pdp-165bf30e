import { useMemo } from "react";
import { ShieldCheck, Sparkles, Target, ChevronsRight, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format-date";
import {
  CHANNEL_LABEL,
  updateIntent,
  INTENT_LABEL,
  INTENT_COLOR,
  type Thread,
  type AiIntent,
} from "@/lib/inbox-store";
import { scoreIntent, type IntentBand } from "@/lib/ai-intent-score";
import { toast } from "sonner";

const BAND_RING: Record<IntentBand, string> = {
  high: "stroke-emerald-500",
  mid: "stroke-amber-500",
  low: "stroke-slate-400",
};
const BAND_TEXT: Record<IntentBand, string> = {
  high: "text-emerald-600",
  mid: "text-amber-600",
  low: "text-slate-500",
};
const BAND_BADGE: Record<IntentBand, string> = {
  high: "bg-emerald-50 text-emerald-700 border-emerald-200",
  mid: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-slate-50 text-slate-600 border-slate-200",
};

function ScoreRing({ value, band }: { value: number; band: IntentBand }) {
  const R = 42;
  const C = 2 * Math.PI * R;
  const dash = (value / 100) * C;
  return (
    <div className="relative h-28 w-28">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={R} className="fill-none stroke-muted" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={R}
          className={cn("fill-none transition-all", BAND_RING[band])}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C - dash}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-3xl font-semibold tabular-nums leading-none", BAND_TEXT[band])}>
          {value}
        </span>
        <span className="mt-1 text-[10px] text-muted-foreground">AI 意向评分</span>
      </div>
    </div>
  );
}

function DimensionBar({ label, value }: { label: string; value: number }) {
  const barColor =
    value >= 80
      ? "bg-emerald-500"
      : value >= 60
        ? "bg-violet-500"
        : value >= 40
          ? "bg-amber-500"
          : "bg-slate-400";
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-foreground/80">{label}</span>
        <span className="tabular-nums font-medium">{value}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export function IntentScorePanel({ thread }: { thread: Thread }) {
  const result = useMemo(() => scoreIntent(thread), [thread]);
  const hasInbound = thread.messages.some((m) => m.direction === "inbound");
  if (!hasInbound) {
    return (
      <div className="p-6 text-xs text-muted-foreground text-center">
        <Target className="h-6 w-6 mx-auto mb-2 opacity-50" />
        暂无对方回复，AI 意向评分将在收到首条回复后生成。
      </div>
    );
  }
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* 环形分 */}
      <div className="flex flex-col items-center pt-5 pb-3">
        <ScoreRing value={result.score} band={result.band} />
        <Badge
          variant="outline"
          className={cn("mt-2 text-[11px]", BAND_BADGE[result.band])}
        >
          {result.bandLabel}
        </Badge>
        {thread.meta.aiIntent && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Badge
                variant="outline"
                className={cn(
                  "mt-1.5 text-[11px] cursor-pointer hover:opacity-90 gap-1",
                  INTENT_COLOR[thread.meta.aiIntent],
                )}
                title="点击修正意向分类"
              >
                {INTENT_LABEL[thread.meta.aiIntent]}
                <Pencil className="h-3 w-3 opacity-70" />
              </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-44">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">
                修正意向分类
              </DropdownMenuLabel>
              {(
                ["interested", "quote", "ooo", "reject", "unsubscribe", "other"] as AiIntent[]
              ).map((i) => (
                <DropdownMenuItem
                  key={i}
                  onClick={() => {
                    updateIntent(thread.id, i);
                    toast.success(`已修正为「${INTENT_LABEL[i]}」`);
                  }}
                >
                  {INTENT_LABEL[i]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* 客户信息 */}
      <div className="px-4 py-3 border-t">
        <div className="text-[11px] font-medium text-muted-foreground mb-2">
          客户信息
        </div>
        <dl className="text-xs space-y-1.5">
          {thread.parentRef && (
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground shrink-0">公司</dt>
              <dd className="text-right truncate">{thread.parentRef.name}</dd>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground shrink-0">联系人</dt>
            <dd className="text-right truncate">{thread.targetName}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground shrink-0">渠道</dt>
            <dd className="text-right">{CHANNEL_LABEL[thread.channel]}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground shrink-0">联系地址</dt>
            <dd className="text-right truncate">{thread.counterpartyAddress}</dd>
          </div>
        </dl>
      </div>

      {/* 维度 */}
      <div className="px-4 py-3 border-t">
        <div className="text-[11px] font-medium text-muted-foreground mb-3">
          意向维度分析
        </div>
        <div className="space-y-2.5">
          {result.dimensions.map((d) => (
            <DimensionBar key={d.key} label={d.label} value={d.value} />
          ))}
        </div>
      </div>

      {/* 标签 */}
      <div className="px-4 py-3 border-t">
        <div className="text-[11px] font-medium text-muted-foreground mb-2">
          标签
        </div>
        <div className="flex flex-wrap gap-1">
          {result.tags.map((t) => (
            <Badge
              key={t}
              variant="outline"
              className="text-[10px] bg-sky-50 text-sky-700 border-sky-200"
            >
              {t}
            </Badge>
          ))}
        </div>
      </div>

      {/* 下一步行动 */}
      <div className="mx-4 my-3 rounded-md border border-amber-200 bg-amber-50/60 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-amber-800">
          <ChevronsRight className="h-3.5 w-3.5" />
          下一步行动建议
        </div>
        <div className="mt-1.5 text-xs leading-relaxed text-amber-900">
          {result.nextAction}
        </div>
      </div>

      {/* 元信息 */}
      <div className="px-4 pb-4 mt-auto text-[10px] text-muted-foreground flex items-center gap-1">
        <ShieldCheck className="h-3 w-3" />
        评分基于本会话公开信息与用户授权范围内的历史数据，仅供参考。
        <span className="ml-auto inline-flex items-center gap-0.5">
          <Sparkles className="h-2.5 w-2.5" />
          {formatDateTime(result.updatedAt).slice(5, 16)}
        </span>
      </div>
    </div>
  );
}