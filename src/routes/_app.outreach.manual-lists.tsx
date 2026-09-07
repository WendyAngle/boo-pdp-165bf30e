import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, ListChecks, Plus, Search, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  removeManualList,
  removeManualTarget,
  isTargetReached,
  channelLabel,
  type ManualChannel,
} from "@/lib/manual-lists";
import {
  TEMPLATE_HEADERS,
  classifyContactRows,
  downloadContactTemplate,
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
  const [listPage, setListPage] = useState(1);
  const [targetPage, setTargetPage] = useState(1);
  const listPageSize = 9;
  const targetPageSize = 10;

  const totalTargets = lists.reduce((s, l) => s + l.targets.length, 0);
  const active = lists.find((l) => l.id === activeId) ?? null;

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

  const pagedLists = useMemo(
    () => filtered.slice((listPage - 1) * listPageSize, listPage * listPageSize),
    [filtered, listPage],
  );

  const pagedTargets = useMemo(
    () =>
      allTargets.slice(
        (targetPage - 1) * targetPageSize,
        targetPage * targetPageSize,
      ),
    [allTargets, targetPage],
  );

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
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          removeManualList(l.id);
                          toast.success("名单已删除");
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
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

        <TabsContent value="targets" className="pt-3">
          {allTargets.length === 0 ? (
            <EmptyState />
          ) : (
            <>
            <div className="rounded-lg border divide-y">
              {pagedTargets.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm"
                >
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
              total={allTargets.length}
              onPageChange={setTargetPage}
            />
            </>
          )}
        </TabsContent>
      </Tabs>

      <NewListDialog open={openNew} onOpenChange={setOpenNew} />

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
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={channel === "email" ? "一行一个邮箱，追加到本名单" : "一行一个含区号手机号，追加到本名单"}
        className="text-xs bg-background"
      />
      <div className="flex items-center gap-2">
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
        <Button
          size="sm"
          variant="ghost"
          className="h-8 text-xs text-muted-foreground"
          onClick={() => downloadContactTemplate(channel)}
        >
          <Download className="h-3.5 w-3.5" />
          下载模板
        </Button>
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
            placeholder={
              channel === "email"
                ? "一行一个邮箱，或粘贴导入模板内容"
                : "一行一个含区号的完整手机号（如 +8613800138000）"
            }
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-muted-foreground"
              onClick={() => downloadContactTemplate(channel)}
            >
              <Upload className="h-3.5 w-3.5" />
              下载导入模板
            </Button>
            <span className="text-[11px] text-muted-foreground">
              模板字段：{TEMPLATE_HEADERS[channel].join(" / ")}；数量不限，格式不正确与重复的数据将自动过滤
            </span>
          </div>
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
