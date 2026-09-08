import { useMemo, useRef, useState } from "react";
import { Download, Upload, ListPlus, CheckCircle2, Eraser } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PHONE_COUNTRIES } from "@/lib/phone-country";
import {
  TEMPLATE_HEADERS,
  classifyContactRows,
  downloadContactTemplate,
  importPlaceholder,
  importSummary,
  parseContactRows,
  type ContactRow,
} from "@/lib/contact-import";
import {
  useManualLists,
  saveManualList,
  isTargetReached,
  type ManualTargetInput,
} from "@/lib/manual-lists";
import { CURRENT_USER } from "@/lib/current-user";
import { formatDateTime } from "@/lib/format-date";

export interface ManualTargetPanelProps {
  channel: "email" | "phone";
  /** 已在收件人中的地址（用于去重） */
  existing: string[];
  /** 当前已手动添加的条数（仅用于展示） */
  manualCount: number;
  onAdd: (values: ManualTargetInput[]) => void;
}

/**
 * 手动添加 / 批量导入目标面板。批量发邮件、批量发短信共用。
 * 手动输入、文件导入与从「自建名单」选择三种方式，数量不设上限。
 */
export function ManualTargetPanel({
  channel,
  existing,
  manualCount,
  onAdd,
}: ManualTargetPanelProps) {
  const isEmail = channel === "email";
  const [text, setText] = useState("");
  const [country, setCountry] = useState("");
  const [saveToList, setSaveToList] = useState(true);
  const [listName, setListName] = useState("");
  const [pickOpen, setPickOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const lists = useManualLists().filter((l) => l.channel === channel);

  const dial = PHONE_COUNTRIES.find((c) => c.code === country)?.dial;
  const countryName = PHONE_COUNTRIES.find((c) => c.code === country)?.name;

  function commit(
    rows: ContactRow[],
    keepInvalidInBox: boolean,
    strict: boolean,
  ) {
    if (rows.length === 0) return;
    const outcome = classifyContactRows(rows, channel, existing, {
      dial,
      defaultCountry: isEmail ? undefined : countryName,
      requireName: strict,
      requireCountry: strict && !isEmail,
    });
    const values: ManualTargetInput[] = outcome.valid.map((v) => ({
      value: v.value,
      name: v.name,
      company: v.company,
      country: isEmail ? undefined : (v.country ?? countryName),
    }));
    if (values.length > 0) {
      onAdd(values);
      if (saveToList) {
        const name =
          listName.trim() ||
          `${isEmail ? "手动邮箱" : "手动手机号"} ${new Date().toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}`;
        saveManualList(name, channel, values, CURRENT_USER.name);
      }
    }
    if (keepInvalidInBox) setText(outcome.invalid.join("\n"));
    else setText("");
    const summary = importSummary(outcome);
    if (outcome.valid.length > 0) toast.success(summary);
    else if (summary) toast.error(summary);
  }

  async function onFile(file: File) {
    const content = await file.text();
    commit(parseContactRows(content), false, true);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-2.5">
      {!isEmail && (
        <Select value={country} onValueChange={setCountry}>
          <SelectTrigger className="h-8 w-40 text-xs bg-background">
            <SelectValue placeholder="选择国家/地区" />
          </SelectTrigger>
          <SelectContent>
            {PHONE_COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.name} +{c.dial}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={
          isEmail
            ? importPlaceholder("email")
            : dial
              ? `${importPlaceholder("phone")}\n未填区号时自动拼接 +${dial}`
              : importPlaceholder("phone")
        }
        className="text-xs bg-background"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="h-8"
          onClick={() => commit(parseContactRows(text), true, false)}
          disabled={!text.trim()}
        >
          添加
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          批量导入
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 text-xs text-muted-foreground"
          onClick={() => downloadContactTemplate(channel)}
        >
          <Download className="h-3.5 w-3.5" />
          下载模板
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 text-xs text-muted-foreground"
          disabled={!text.trim()}
          onClick={() => {
            setText("");
            toast.success("已清空输入框");
          }}
        >
          <Eraser className="h-3.5 w-3.5" />
          一键清空
        </Button>
        {lists.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => setPickOpen(true)}
          >
            <ListPlus className="h-3.5 w-3.5" />
            从自建名单选择
          </Button>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          已手动添加 {manualCount} 条
        </span>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,.txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Checkbox
            checked={saveToList}
            onCheckedChange={(v) => setSaveToList(v === true)}
          />
          同时保存到「自建名单」
        </label>
        {saveToList && (
          <Input
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            placeholder="名单名称（选填，默认按时间命名）"
            className="h-7 w-72 text-xs bg-background"
          />
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        导入模板字段：{TEMPLATE_HEADERS[channel].join(" / ")}
        ；数量不限，格式不正确、缺少必填项与重复的数据会自动过滤。手动
        {isEmail ? "邮箱" : "手机号"}不产生解锁查看费，仅按渠道计发送费。
      </p>

      <ManualListPicker
        open={pickOpen}
        onOpenChange={setPickOpen}
        channel={channel}
        existing={existing}
        onConfirm={(values) => {
          const outcome = classifyContactRows(values, channel, existing, {
            dial,
            defaultCountry: isEmail ? undefined : countryName,
          });
          if (outcome.valid.length === 0) {
            toast.error(importSummary(outcome) || "没有可导入的目标");
            return;
          }
          onAdd(
            outcome.valid.map((v) => ({
              value: v.value,
              name: v.name,
              company: v.company,
              country: isEmail ? undefined : v.country,
            })),
          );
          toast.success(importSummary(outcome));
          setPickOpen(false);
        }}
      />
    </div>
  );
}

/* -------------------- 从自建名单选择目标 -------------------- */

function ManualListPicker({
  open,
  onOpenChange,
  channel,
  existing,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  channel: "email" | "phone";
  existing: string[];
  onConfirm: (values: ContactRow[]) => void;
}) {
  const lists = useManualLists().filter((l) => l.channel === channel);
  const [listId, setListId] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const current = lists.find((l) => l.id === listId) ?? lists[0];

  const existingSet = useMemo(
    () => new Set(existing.map((v) => v.toLowerCase())),
    [existing],
  );
  /** 自动过滤掉已触达的目标 */
  const reachedCount = current?.targets.filter(isTargetReached).length ?? 0;
  const selectable = useMemo(
    () => (current ? current.targets.filter((t) => !isTargetReached(t)) : []),
    [current],
  );

  function toggle(id: string, v: boolean) {
    setSelected((p) => {
      const n = new Set(p);
      if (v) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  const allChecked =
    selectable.length > 0 && selectable.every((t) => selected.has(t.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>从自建名单选择</DialogTitle>
          <DialogDescription>
            勾选需要本次发送的目标；已触达的目标已自动过滤，不会重复打扰。
          </DialogDescription>
        </DialogHeader>

        <Select
          value={current?.id ?? ""}
          onValueChange={(v) => {
            setListId(v);
            setSelected(new Set());
          }}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="选择名单" />
          </SelectTrigger>
          <SelectContent>
            {lists.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}（{l.targets.length}）
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <label className="flex items-center gap-1.5">
            <Checkbox
              checked={allChecked}
              onCheckedChange={(v) =>
                setSelected(
                  v === true ? new Set(selectable.map((t) => t.id)) : new Set(),
                )
              }
            />
            全选（可选 {selectable.length} 条）
          </label>
          {reachedCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              已自动过滤 {reachedCount} 条已触达
            </span>
          )}
        </div>

        <div className="max-h-72 space-y-1.5 overflow-y-auto pr-0.5">
          {selectable.length === 0 ? (
            <div className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
              该名单暂无未触达的目标
            </div>
          ) : (
            selectable.map((t) => {
              const dup = existingSet.has(t.value.toLowerCase());
              return (
                <label
                  key={t.id}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={selected.has(t.id)}
                    disabled={dup}
                    onCheckedChange={(v) => toggle(t.id, v === true)}
                  />
                  <span className="font-mono text-xs">{t.value}</span>
                  {t.name && <span className="text-xs">{t.name}</span>}
                  {t.company && (
                    <span className="truncate text-xs text-muted-foreground">
                      {t.company}
                    </span>
                  )}
                  {t.country && (
                    <span className="text-[11px] text-muted-foreground">
                      {t.country}
                    </span>
                  )}
                  <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                    {dup ? "已在收件人中" : formatDateTime(t.createdAt)}
                  </span>
                </label>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={selected.size === 0}
            onClick={() =>
              onConfirm(
                selectable
                  .filter((t) => selected.has(t.id))
                  .map((t) => ({
                    value: t.value,
                    name: t.name,
                    company: t.company,
                    country: t.country,
                  })),
              )
            }
          >
            导入选中（{selected.size}）
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
