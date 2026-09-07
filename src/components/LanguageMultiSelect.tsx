import { Check, ChevronsUpDown, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ALL_LANGUAGES, languageLabel } from "@/lib/languages";
import { cn } from "@/lib/utils";

/**
 * 语言多选下拉（勾选式）。
 * 选项统一取自 @/lib/languages，避免各模块语言口径不一致。
 */
export function LanguageMultiSelect({
  value,
  onChange,
  placeholder = "选择语言（可多选）",
  className,
  maxTags = 6,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  className?: string;
  maxTags?: number;
}) {
  const toggle = (code: string) =>
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("h-auto min-h-10 w-full justify-between gap-2 px-3 py-2", className)}
        >
          <span className="flex flex-1 flex-wrap items-center gap-1 text-left">
            {value.length === 0 ? (
              <span className="text-muted-foreground font-normal">{placeholder}</span>
            ) : (
              <>
                {value.slice(0, maxTags).map((c) => (
                  <Badge key={c} variant="secondary" className="font-normal gap-1">
                    {languageLabel(c)}
                    <X
                      className="h-3 w-3 cursor-pointer opacity-60 hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange(value.filter((x) => x !== c));
                      }}
                    />
                  </Badge>
                ))}
                {value.length > maxTags && (
                  <Badge variant="outline" className="font-normal">
                    +{value.length - maxTags}
                  </Badge>
                )}
              </>
            )}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <div className="flex items-center justify-between border-b px-3 py-2 text-xs text-muted-foreground">
          <span>已选 {value.length} / {ALL_LANGUAGES.length}</span>
          <div className="flex gap-2">
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => onChange(ALL_LANGUAGES.map((l) => l.code))}
            >
              全选
            </button>
            <button
              type="button"
              className="hover:underline"
              onClick={() => onChange([])}
            >
              清空
            </button>
          </div>
        </div>
        <ScrollArea className="h-[280px]">
          <div className="p-1">
            {ALL_LANGUAGES.map((l) => {
              const checked = value.includes(l.code);
              return (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => toggle(l.code)}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Checkbox checked={checked} className="pointer-events-none" />
                  <span>{l.flag}</span>
                  <span className="flex-1 text-left">{l.zh}</span>
                  {checked && <Check className="h-3.5 w-3.5 text-primary" />}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
