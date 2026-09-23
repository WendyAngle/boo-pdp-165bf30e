import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Tags, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  PRESET_TARGET_TAGS,
  TARGET_CATEGORIES,
  getTargetTags,
  setTargetTags,
  usedTargetTags,
} from "@/lib/target-tags-store";

export interface TagTargetItem {
  /** 目标唯一键：enterprise:xxx / contact:xxx */
  key: string;
  name: string;
}

/** 批量设置目标的标签 / 分类 */
export function TargetTagDialog({
  open,
  onOpenChange,
  targets,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targets: TagTargetItem[];
  onDone?: () => void;
}) {
  const single = targets.length === 1;
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"merge" | "replace">("merge");

  const custom = useMemo(() => (open ? usedTargetTags() : []), [open]);

  useEffect(() => {
    if (!open) return;
    setDraft("");
    setMode("merge");
    if (single) {
      const rec = getTargetTags(targets[0]!.key);
      setCategory(rec?.category);
      setTags(rec?.tags ?? []);
    } else {
      setCategory(undefined);
      setTags([]);
    }
  }, [open, single, targets]);

  const toggleTag = (t: string) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const addDraft = () => {
    const v = draft.trim();
    if (!v) return;
    if (v.length > 12) {
      toast.error("标签最多 12 个字");
      return;
    }
    if (!tags.includes(v)) setTags([...tags, v]);
    setDraft("");
  };

  const submit = () => {
    if (!category && tags.length === 0 && mode === "merge") {
      toast.error("请至少选择一个分类或标签");
      return;
    }
    setTargetTags(
      targets.map((t) => t.key),
      { category, tags },
      mode,
    );
    toast.success(
      single
        ? `已更新「${targets[0]!.name}」的标签 / 分类`
        : `已为 ${targets.length} 个目标设置标签 / 分类`,
    );
    onOpenChange(false);
    onDone?.();
  };

  const allTags = [...PRESET_TARGET_TAGS, ...custom.filter((c) => !tags.includes(c))];
  const shown = [...new Set([...allTags, ...tags])];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="h-4 w-4 text-primary" />
            设置标签 / 分类
          </DialogTitle>
          <DialogDescription>
            已选择 {targets.length} 个目标
            {single ? `：${targets[0]!.name}` : ""}。标签 / 分类跟随目标本身，会在触达会话列表同步展示。
          </DialogDescription>
        </DialogHeader>

        {!single && (
          <div className="rounded-md border bg-muted/20 p-3 max-h-24 overflow-y-auto flex flex-wrap gap-1">
            {targets.slice(0, 40).map((t) => (
              <Badge key={t.key} variant="outline" className="text-[11px] font-normal">
                {t.name}
              </Badge>
            ))}
            {targets.length > 40 && (
              <Badge variant="outline" className="text-[11px] font-normal">
                +{targets.length - 40}
              </Badge>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">客户分类（单选）</Label>
          <div className="flex flex-wrap gap-2">
            {TARGET_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(category === c ? undefined : c)}
                className={cn(
                  "px-2.5 h-7 rounded-md border text-xs transition-colors",
                  category === c
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted",
                )}
              >
                {category === c && <Check className="h-3 w-3 mr-1 inline" />}
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">客户标签（多选）</Label>
          <div className="flex flex-wrap gap-2">
            {shown.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTag(t)}
                className={cn(
                  "px-2.5 h-7 rounded-md border text-xs transition-colors",
                  tags.includes(t)
                    ? "bg-primary/10 text-primary border-primary/40"
                    : "bg-background hover:bg-muted",
                )}
              >
                {tags.includes(t) && <Check className="h-3 w-3 mr-1 inline" />}
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addDraft();
                }
              }}
              placeholder="自定义标签，回车添加"
              className="h-8 text-sm"
            />
            <Button type="button" size="sm" variant="outline" className="h-8" onClick={addDraft}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              添加
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {tags.map((t) => (
                <Badge key={t} variant="secondary" className="text-[11px] gap-1 font-normal">
                  {t}
                  <button type="button" onClick={() => toggleTag(t)} aria-label={`移除 ${t}`}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">应用方式</Label>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { v: "merge", label: "追加", hint: "保留目标原有标签" },
                { v: "replace", label: "覆盖", hint: "清空原有标签后写入" },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setMode(o.v)}
                className={cn(
                  "px-3 py-1.5 rounded-md border text-xs text-left transition-colors",
                  mode === o.v
                    ? "bg-primary/10 text-primary border-primary/40"
                    : "bg-background hover:bg-muted",
                )}
              >
                <div className="font-medium">{o.label}</div>
                <div className="text-[11px] text-muted-foreground">{o.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={submit}>确定</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 展示目标的分类 + 标签徽标 */
export function TargetTagBadges({
  record,
  max = 3,
  className,
}: {
  record?: { category?: string; tags: string[] };
  max?: number;
  className?: string;
}) {
  if (!record || (!record.category && record.tags.length === 0)) return null;
  const rest = record.tags.length - max;
  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {record.category && (
        <Badge className="h-4 py-0 px-1.5 text-[10px] bg-primary/10 text-primary hover:bg-primary/10 border border-primary/30">
          {record.category}
        </Badge>
      )}
      {record.tags.slice(0, max).map((t) => (
        <Badge
          key={t}
          variant="outline"
          className="h-4 py-0 px-1.5 text-[10px] bg-muted/50 text-foreground/80 border-border/70"
        >
          {t}
        </Badge>
      ))}
      {rest > 0 && (
        <Badge
          variant="outline"
          className="h-4 py-0 px-1.5 text-[10px] bg-muted/50 text-foreground/80 border-border/70"
        >
          +{rest}
        </Badge>
      )}
    </div>
  );
}
