import { useMemo } from "react";
import { ShieldAlert, ShieldCheck, AlertTriangle, Ban, CheckCircle2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format-date";
import type { Thread } from "@/lib/inbox-store";
import { scoreAuthenticity, type AuthLevel } from "@/lib/ai-authenticity";

const LEVEL_RING: Record<AuthLevel, string> = {
  trusted: "stroke-emerald-500",
  neutral: "stroke-sky-500",
  suspicious: "stroke-amber-500",
  high_risk: "stroke-orange-500",
  blocked: "stroke-rose-500",
};
const LEVEL_TEXT: Record<AuthLevel, string> = {
  trusted: "text-emerald-600",
  neutral: "text-sky-600",
  suspicious: "text-amber-600",
  high_risk: "text-orange-600",
  blocked: "text-rose-600",
};
const LEVEL_BADGE: Record<AuthLevel, string> = {
  trusted: "bg-emerald-50 text-emerald-700 border-emerald-200",
  neutral: "bg-sky-50 text-sky-700 border-sky-200",
  suspicious: "bg-amber-50 text-amber-700 border-amber-200",
  high_risk: "bg-orange-50 text-orange-700 border-orange-200",
  blocked: "bg-rose-50 text-rose-700 border-rose-200",
};

function ScoreRing({ value, level }: { value: number; level: AuthLevel }) {
  const R = 42;
  const C = 2 * Math.PI * R;
  const displayed = level === "blocked" ? 0 : value;
  const dash = (displayed / 100) * C;
  return (
    <div className="relative h-28 w-28">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={R} className="fill-none stroke-muted" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={R}
          className={cn("fill-none transition-all", LEVEL_RING[level])}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C - dash}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-3xl font-semibold tabular-nums leading-none", LEVEL_TEXT[level])}>
          {level === "blocked" ? "!" : value}
        </span>
        <span className="mt-1 text-[10px] text-muted-foreground">AI 真实度评分</span>
      </div>
    </div>
  );
}

function DimensionBar({ label, value }: { label: string; value: number }) {
  const barColor =
    value >= 80 ? "bg-emerald-500"
    : value >= 60 ? "bg-sky-500"
    : value >= 40 ? "bg-amber-500"
    : "bg-orange-500";
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

export function AuthenticityPanel({ thread }: { thread: Thread }) {
  const result = useMemo(() => scoreAuthenticity(thread), [thread]);
  const hasInbound = thread.messages.some((m) => m.direction === "inbound");
  if (!hasInbound) {
    return (
      <div className="p-6 text-xs text-muted-foreground text-center">
        <ShieldCheck className="h-6 w-6 mx-auto mb-2 opacity-50" />
        暂无对方回复，真实度评分将在收到首条回复后生成。
      </div>
    );
  }
  const allHits = [...result.hardHits, ...result.softHits];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex flex-col items-center pt-5 pb-3">
        <ScoreRing value={result.score} level={result.level} />
        <Badge variant="outline" className={cn("mt-2 text-[11px]", LEVEL_BADGE[result.level])}>
          {result.level === "blocked" && <Ban className="h-3 w-3 mr-1" />}
          {result.levelLabel}
        </Badge>
      </div>

      {result.level === "blocked" && (
        <div className="mx-4 mb-3 rounded-md border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-900">
          <div className="flex items-center gap-1.5 font-medium">
            <ShieldAlert className="h-3.5 w-3.5" />
            已命中硬规则，建议不再回复
          </div>
          <ul className="mt-1.5 space-y-0.5 list-disc pl-4">
            {result.hardHits.map((h) => (
              <li key={h.id}>
                <span className="font-mono text-[10px] mr-1">{h.id}</span>
                {h.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="px-4 py-3 border-t">
        <div className="text-[11px] font-medium text-muted-foreground mb-3">
          维度分数
        </div>
        <div className="space-y-2.5">
          {result.dims.map((d) => (
            <DimensionBar key={d.key} label={d.label} value={d.value} />
          ))}
        </div>
      </div>

      <div className="px-4 py-3 border-t">
        <div className="text-[11px] font-medium text-muted-foreground mb-2">
          命中规则
        </div>
        {allHits.length === 0 ? (
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            未命中任何风险规则
          </div>
        ) : (
          <ul className="space-y-1.5">
            {allHits.map((h) => (
              <li key={h.id} className="text-xs flex items-start gap-1.5">
                {h.hard ? (
                  <Ban className="h-3.5 w-3.5 text-rose-500 mt-0.5 shrink-0" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <div>
                    <span className="font-mono text-[10px] text-muted-foreground mr-1">
                      {h.id}
                    </span>
                    {h.label}
                    {!h.hard && h.penalty ? (
                      <span className="ml-1 text-[10px] text-rose-600">−{h.penalty}</span>
                    ) : null}
                  </div>
                  {h.evidence && (
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                      {h.evidence}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mx-4 my-3 rounded-md border border-sky-200 bg-sky-50/60 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-sky-800">
          <Info className="h-3.5 w-3.5" />
          处置建议
        </div>
        <div className="mt-1.5 text-xs leading-relaxed text-sky-900">
          {result.nextAction}
        </div>
      </div>

      <div className="px-4 pb-4 mt-auto text-[10px] text-muted-foreground flex items-center gap-1">
        <ShieldCheck className="h-3 w-3" />
        真实度基于会话公开信息与规则库判定，仅供参考。
        <span className="ml-auto">{formatDateTime(result.updatedAt).slice(5, 16)}</span>
      </div>
    </div>
  );
}
