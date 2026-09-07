import { useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

export type DateRangeValue = { from?: Date; to?: Date } | undefined;

const PRESETS = [
  { id: "today", label: "今日" },
  { id: "7d", label: "近 7 天" },
  { id: "30d", label: "近 30 天" },
  { id: "thisMonth", label: "本月" },
  { id: "lastMonth", label: "上月" },
] as const;

export type PresetId = (typeof PRESETS)[number]["id"] | "custom" | "all";

function startOf(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}
function endOf(d: Date) {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

export function resolvePreset(id: PresetId, custom?: DateRangeValue): DateRangeValue {
  const now = new Date();
  if (id === "all") return undefined;
  if (id === "today") return { from: startOf(now), to: endOf(now) };
  if (id === "7d") {
    const f = startOf(now);
    f.setDate(f.getDate() - 6);
    return { from: f, to: endOf(now) };
  }
  if (id === "30d") {
    const f = startOf(now);
    f.setDate(f.getDate() - 29);
    return { from: f, to: endOf(now) };
  }
  if (id === "thisMonth") {
    return {
      from: startOf(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: endOf(now),
    };
  }
  if (id === "lastMonth") {
    const f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const t = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: startOf(f), to: endOf(t) };
  }
  return custom;
}

export function DateRangePicker({
  preset,
  custom,
  onChange,
}: {
  preset: PresetId;
  custom?: DateRangeValue;
  onChange: (preset: PresetId, custom?: DateRangeValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const range = resolvePreset(preset, custom);

  function fmt(d?: Date) {
    if (!d) return "";
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  const triggerLabel =
    preset === "all"
      ? "全部时间"
      : preset === "custom"
        ? range?.from
          ? `${fmt(range.from)} ~ ${fmt(range.to ?? range.from)}`
          : "自定义"
        : PRESETS.find((p) => p.id === preset)?.label ?? "选择时间";

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5" />
            {triggerLabel}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col sm:flex-row">
            <div className="flex sm:flex-col gap-1 p-2 border-b sm:border-b-0 sm:border-r border-border min-w-[120px]">
              <PresetBtn active={preset === "all"} onClick={() => { onChange("all"); setOpen(false); }}>
                全部时间
              </PresetBtn>
              {PRESETS.map((p) => (
                <PresetBtn
                  key={p.id}
                  active={preset === p.id}
                  onClick={() => { onChange(p.id); setOpen(false); }}
                >
                  {p.label}
                </PresetBtn>
              ))}
            </div>
            <Calendar
              mode="range"
              selected={range as DateRange | undefined}
              onSelect={(r) => {
                onChange("custom", r as DateRangeValue);
              }}
              numberOfMonths={2}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </div>
        </PopoverContent>
      </Popover>

      {preset !== "all" && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 px-2 text-muted-foreground"
          onClick={() => onChange("all")}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function PresetBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left text-xs px-3 py-1.5 rounded-md transition-colors",
        active
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}