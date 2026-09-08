import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Eraser, ListChecks, Pencil, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ListPagination } from "@/components/ListPagination";
import {
  useManualLists,
  saveManualList,
  appendToManualList,
  renameManualList,
  removeManualTarget,
  isTargetReached,
  channelLabel,
  type ManualChannel,
} from "@/lib/manual-lists";
import {
  TEMPLATE_HEADERS,
  classifyContactRows,
  downloadContactTemplate,
  importPlaceholder,
  importSummary,
  parseContactRows,
} from "@/lib/contact-import";
import { CURRENT_USER } from "@/lib/current-user";
import { formatDateTime } from "@/lib/format-date";


export const Route = createFileRoute("/_app/outreach/manual-lists")({
  head: () => ({
    meta: [
      { title: "自建名单 — 手动添加的触达目标管理" },
      {
        name: "description",
        content:
          "管理批量发邮件、批量发短信中手动添加或批量导入的邮箱与手机号名单，支持导入、复用与导出。",
      },
      { property: "og:title", content: "自建名单 — 手动添加的触达目标管理" },
      {
        property: "og:description",
        content: "沉淀手动添加的触达目标，企业内共享，可随时复用于批量发邮件与批量发短信。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManualListsPage,
});

function ManualListsPage() {
  const lists = useManualLists();
  const [q, setQ] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [listPage, setListPage] = useState(1);
  const [targetPage, setTargetPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<"all" | ManualChannel>("all");
  const [reachedFilter, setReachedFilter] = useState<"all" | "reached" | "unreached">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const listPageSize = 9;
  const targetPageSize = 10;

  const totalTargets = lists.reduce((s, l) => s + l.targets.length, 0);
  const active = lists.find((l) => l.id === activeId) ?? null;
  const renaming = lists.find((l) => l.id === renameId) ?? null;

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return lists;
    return lists.filter(
      (l) =>
        l.name.toLowerCase().includes(k) ||
        l.targets.some((t) => t.value.toLowerCase().includes(k)),
    );
  }, [lists, q]);

  const allTargets = useMemo(
    () =>
      lists.flatMap((l) =>
        l.targets.map((t) => ({ ...t, listName: l.name, listId: l.id })),
      ),
    [lists],
  );

  const visibleTargets = useMemo(
    () =>
      allTargets.filter(
        (t) =>
          (typeFilter === "all" || t.channel === typeFilter) &&
          (reachedFilter === "all" ||
            (reachedFilter === "reached" ? isTargetReached(t) : !isTargetReached(t))),
      ),
    [allTargets, typeFilter, reachedFilter],
  );

  const pagedLists = useMemo(
    () => filtered.slice((listPage - 1) * listPageSize, listPage * listPageSize),
    [filtered, listPage],
  );

  const pagedTargets = useMemo(
    () =>
      visibleTargets.slice(
        (targetPage - 1) * targetPageSize,
        targetPage * targetPageSize,
      ),
    [visibleTargets, targetPage],
  );

  const selectedTargets = visibleTargets.filter((t) => selected.has(t.id));
  const selectedReached = selectedTargets.filter(isTargetReached);
  const deletable = selectedTargets.filter((t) => !isTargetReached(t));
  const pageAllChecked =
    pagedTargets.length > 0 && pagedTargets.every((t) => selected.has(t.id));

  function toggleTarget(id: string, v: boolean) {
    setSelected((p) => {
      const n = new Set(p);
      if (v) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  function togglePage(v: boolean) {
    setSelected((p) => {
      const n = new Set(p);
      pagedTargets.forEach((t) => (v ? n.add(t.id) : n.delete(t.id)));
      return n;
    });
  }

  function doBatchDelete() {
    deletable.forEach((t) => removeManualTarget(t.listId, t.id));
    toast.success(
      selectedReached.length > 0
        ? `已删除 ${deletable.length} 条目标，自动过滤 ${selectedReached.length} 条已触达目标`
        : `已删除 ${deletable.length} 条目标`,
    );
    setSelected(new Set());
    setConfirmDelete(false);
  }


  function exportList(id: string) {
    const l = lists.find((x) => x.id === id);
    if (!l) return;
    const head = TEMPLATE_HEADERS[l.channel].join(",");
    const rows = l.targets.map((t) =>
      l.channel === "email"
        ? [t.value, t.name ?? "", t.company ?? ""].join(",")
        : [t.country ?? "", t.value, t.name ?? "", t.company ?? ""].join(","),
    );
    const csv = "\uFEFF" + [head, ...rows].join("\n") + "\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${l.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">自建名单</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            批量发邮件、批量发短信中手动添加或批量导入的目标会沉淀在这里，企业内共享，可随时复用。
          </p>
        </div>
        <Button onClick={() => setOpenNew(true)}>
          <Plus className="h-4 w-4" />
          新建名单
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="名单数" value={lists.length} />
        <StatCard label="目标总数" value={totalTargets} />
        <StatCard
          label="已触达目标"
          value={lists.reduce(
            (s, l) => s + l.targets.filter(isTargetReached).length,
            0,
          )}
        />
        <StatCard
          label="邮件 / 短信名单"
          value={`${lists.filter((l) => l.channel === "email").length} / ${lists.filter((l) => l.channel === "phone").length}`}
        />
      </div>

      <Tabs defaultValue="lists">
        <TabsList>
          <TabsTrigger value="lists">名单</TabsTrigger>
          <TabsTrigger value="targets">全部目标</TabsTrigger>
        </TabsList>

        <TabsContent value="lists" className="space-y-3 pt-3">
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setListPage(1);
              }}
              placeholder="搜索名单名称或目标"
              className="pl-8"
            />
          </div>

          {filtered.length === 0 ? (
            <EmptyState />
          ) : (
            <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {pagedLists.map((l) => (
                <Card key={l.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between gap-2 text-base">
                      <span className="truncate">{l.name}</span>
                      <Badge variant="secondary">{channelLabel(l.channel)}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs text-muted-foreground">
                    <div className="grid grid-cols-2 gap-y-1">
                      <span>目标数：{l.targets.length}</span>
                      <span>创建人：{l.createdBy}</span>
                      <span className="col-span-2">
                        更新时间：{formatDateTime(l.updatedAt)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setActiveId(l.id)}>
                        查看
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => exportList(l.id)}>
                        <Download className="h-3.5 w-3.5" />
                        导出
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setRenameId(l.id)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        编辑
                      </Button>

                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <ListPagination
              page={listPage}
              pageSize={listPageSize}
              total={filtered.length}
              onPageChange={setListPage}
            />
            </>
          )}
        </TabsContent>

        <TabsContent value="targets" className="space-y-3 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v as typeof typeFilter);
                setTargetPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem value="email">邮件（邮箱）</SelectItem>
                <SelectItem value="phone">短信（手机号）</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={reachedFilter}
              onValueChange={(v) => {
                setReachedFilter(v as typeof reachedFilter);
                setTargetPage(1);
              }}
            >
              <SelectTrigger className="h-9 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部触达状态</SelectItem>
                <SelectItem value="reached">已触达</SelectItem>
                <SelectItem value="unreached">未触达</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="h-9 text-destructive hover:text-destructive"
              disabled={selectedTargets.length === 0}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              批量删除{selectedTargets.length > 0 ? `（${selectedTargets.length}）` : ""}
            </Button>
            <span className="text-xs text-muted-foreground">
              共 {visibleTargets.length} 条
            </span>
          </div>

          {visibleTargets.length === 0 ? (
            <EmptyState />
          ) : (
            <>
            <div className="rounded-lg border divide-y">
              <div className="flex items-center gap-2 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={pageAllChecked}
                  onCheckedChange={(v) => togglePage(v === true)}
                />
                本页全选（{pagedTargets.length} 条）· 已触达的目标不会被删除
              </div>
              {pagedTargets.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
                >
                  <Checkbox
                    checked={selected.has(t.id)}
                    onCheckedChange={(v) => toggleTarget(t.id, v === true)}
                  />
                  <span className="font-medium">{t.value}</span>
                  <Badge variant="outline">{channelLabel(t.channel)}</Badge>
                  {t.name && <span className="text-xs">{t.name}</span>}
                  {t.company && (
                    <span className="text-xs text-muted-foreground">{t.company}</span>
                  )}
                  {t.country && (
                    <span className="text-xs text-muted-foreground">{t.country}</span>
                  )}
                  {isTargetReached(t) ? (
                    <ReachedBadge at={t.lastReachedAt!} />
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      未触达
                    </Badge>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    来自「{t.listName}」· {formatDateTime(t.createdAt)}
                  </span>
                </div>
              ))}
            </div>
            <ListPagination
              page={targetPage}
              pageSize={targetPageSize}
              total={visibleTargets.length}
              onPageChange={setTargetPage}
            />
            </>
          )}
        </TabsContent>

      </Tabs>

      <NewListDialog open={openNew} onOpenChange={setOpenNew} />

      <RenameListDialog
        key={renaming?.id ?? "none"}
        list={renaming}
        onOpenChange={(v) => !v && setRenameId(null)}
      />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>确认批量删除目标？</DialogTitle>
            <DialogDescription>
              已选中 {selectedTargets.length} 条目标
              {selectedReached.length > 0
                ? `，其中 ${selectedReached.length} 条为「已触达」目标，将自动过滤不予删除`
                : ""}
              ，本次将删除 {deletable.length} 条未触达目标。删除后不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              disabled={deletable.length === 0}
              onClick={doBatchDelete}
            >
              确认删除（{deletable.length}）
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={!!active} onOpenChange={(v) => !v && setActiveId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{active?.name}</DialogTitle>
            <DialogDescription>
              {active ? `${channelLabel(active.channel)}名单 · 共 ${active.targets.length} 个目标` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-1.5 overflow-y-auto">
            {active?.targets.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span className="truncate">{t.value}</span>
                {t.name && <span className="text-xs">{t.name}</span>}
                {t.company && (
                  <span className="truncate text-xs text-muted-foreground">
                    {t.company}
                  </span>
                )}
                {t.country && (
                  <span className="text-xs text-muted-foreground">{t.country}</span>
                )}
                {isTargetReached(t) && <ReachedBadge at={t.lastReachedAt!} />}
                <button
                  type="button"
                  className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted"
                  aria-label="移除"
                  onClick={() => removeManualTarget(active.id, t.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          {active && (
            <AppendPanel
              listId={active.id}
              channel={active.channel}
              existing={active.targets.map((t) => t.value)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReachedBadge({ at }: { at: string }) {
  return (
    <Badge
      variant="outline"
      className="border-emerald-200 bg-emerald-50 text-emerald-700"
      title={`最近触达：${formatDateTime(at)}`}
    >
      已触达
    </Badge>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
      <ListChecks className="mx-auto mb-2 h-6 w-6 text-muted-foreground/70" />
      暂无自建名单，可在此新建，或在批量发邮件 / 批量发短信弹窗中手动添加后保存。
    </div>
  );
}

function useImportBox(channel: ManualChannel, existing: string[]) {
  const [text, setText] = useState("");
  function collect() {
    const outcome = classifyContactRows(parseContactRows(text), channel, existing);
    const summary = importSummary(outcome);
    if (outcome.valid.length > 0) toast.success(summary);
    else if (summary) toast.error(summary);
    setText(outcome.invalid.join("\n"));
    return outcome.valid;
  }
  return { text, setText, collect };
}

/** 上传已填写的导入模板（CSV / TXT），内容合并到输入框 */
function UploadTemplateButton({
  onLoaded,
  label = "上传模板",
}: {
  onLoaded: (content: string) => void;
  label?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8"
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="h-3.5 w-3.5" />
        {label}
      </Button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.txt"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            const content = (await f.text()).replace(/^\uFEFF/, "");
            if (!content.trim()) {
              toast.error("文件内容为空");
              return;
            }
            onLoaded(content);
            toast.success(`已读取文件「${f.name}」，请确认后提交`);
          } catch {
            toast.error("文件读取失败，请重试");
          }
        }}
      />
    </>
  );
}


/** 一键清空输入框 */
function ClearBoxButton({ text, onClear }: { text: string; onClear: () => void }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-8 text-xs text-muted-foreground"
      disabled={!text.trim()}
      onClick={() => {
        onClear();
        toast.success("已清空输入框");
      }}
    >
      <Eraser className="h-3.5 w-3.5" />
      一键清空
    </Button>
  );
}

function AppendPanel({
  listId,
  channel,
  existing,
}: {
  listId: string;
  channel: ManualChannel;
  existing: string[];
}) {
  const { text, setText, collect } = useImportBox(channel, existing);
  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-2.5">
      <Textarea
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={importPlaceholder(channel)}
        className="text-xs bg-background"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          className="h-8"
          disabled={!text.trim()}
          onClick={() => {
            const values = collect();
            if (values.length) appendToManualList(listId, values);
          }}
        >
          追加
        </Button>
        <UploadTemplateButton
          label="批量导入"
          onLoaded={(content) =>
            setText((prev) => (prev.trim() ? `${prev.replace(/\s+$/, "")}\n${content}` : content))
          }
        />
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs text-muted-foreground"
          onClick={() => downloadContactTemplate(channel)}
        >
          <Download className="h-3.5 w-3.5" />
          下载模板
        </Button>
        <ClearBoxButton text={text} onClear={() => setText("")} />
      </div>
    </div>
  );
}

function NewListDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<ManualChannel>("email");
  const { text, setText, collect } = useImportBox(channel, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>新建自建名单</DialogTitle>
          <DialogDescription>
            名单可在批量发邮件 / 批量发短信弹窗中按目标勾选带入，数量不限；已触达的目标会自动过滤。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="名单名称，如「展会名片 · 广交会」"
          />
          <Select value={channel} onValueChange={(v) => setChannel(v as ManualChannel)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">邮件（邮箱）</SelectItem>
              <SelectItem value="phone">短信（手机号）</SelectItem>
            </SelectContent>
          </Select>
          <Textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={importPlaceholder(channel)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <UploadTemplateButton
              label="批量导入"
              onLoaded={(content) =>
                setText((prev) => (prev.trim() ? `${prev.replace(/\s+$/, "")}\n${content}` : content))
              }
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => downloadContactTemplate(channel)}
            >
              <Download className="h-3.5 w-3.5" />
              下载导入模板
            </Button>
            <ClearBoxButton text={text} onClear={() => setText("")} />
          </div>
          <p className="text-[11px] text-muted-foreground">
            支持上传已填写的模板文件（.csv / .txt），内容会填入上方输入框；数量不限，格式不正确与重复的数据将自动过滤。模板字段：
            {TEMPLATE_HEADERS[channel].join(" / ")}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={!name.trim() || !text.trim()}
            onClick={() => {
              const values = collect();
              if (values.length === 0) return;
              saveManualList(
                name.trim(),
                channel,
                values,
                CURRENT_USER.name,
              );
              setName("");
              onOpenChange(false);
            }}
          >
            创建名单
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RenameListDialog({
  list,
  onOpenChange,
}: {
  list: { id: string; name: string } | null;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState(list?.name ?? "");
  return (
    <Dialog open={!!list} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>编辑名单</DialogTitle>
          <DialogDescription>
            修改名单名称，名单内的目标不受影响。
          </DialogDescription>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="名单名称"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            disabled={!name.trim() || !list || name.trim() === list.name}
            onClick={() => {
              if (!list) return;
              renameManualList(list.id, name.trim());
              toast.success("名单名称已更新");
              onOpenChange(false);
            }}
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
