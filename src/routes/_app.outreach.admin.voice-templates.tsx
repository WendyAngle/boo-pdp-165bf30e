import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronRight, Plus, Search, Store, Pencil, Copy, ArrowUpFromLine, ArrowDownToLine, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TEMPLATE_INDUSTRY,
  SCRIPT_LANGUAGES,
  SCRIPT_SCENES,
  createScript,
  duplicateScript,
  updateScript,
  useScripts,
  type ScriptScene,
} from "@/lib/voice-scripts";

export const Route = createFileRoute("/_app/outreach/admin/voice-templates")({
  head: () => ({
    meta: [
      { title: "外呼话术模板 · 管理后台" },
      { name: "description", content: "平台运营维护 AI 智能外呼话术模板，上架后在模板市场向企业用户展示。" },
      { property: "og:title", content: "外呼话术模板 · 管理后台" },
      { property: "og:description", content: "平台侧维护 AI 外呼话术模板与上下架。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminVoiceTemplatesPage,
});

function AdminVoiceTemplatesPage() {
  const navigate = useNavigate();
  const templates = useScripts("platform");
  const [kw, setKw] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [scene, setScene] = useState<ScriptScene>("marketing");
  const [language, setLanguage] = useState("zh");

  const rows = useMemo(
    () =>
      templates.filter(
        (t) =>
          (kw ? t.name.toLowerCase().includes(kw.toLowerCase()) : true) &&
          (status === "all" ? true : t.status === status),
      ),
    [templates, kw, status],
  );

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>管理后台</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">外呼话术模板</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            外呼话术模板
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            平台运营维护的行业话术模板。上架后展示在企业用户的「外呼话术 → 模板市场」，用户复制后可自行修改，不回写模板。
          </p>
        </div>
        <Button className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          新建模板
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="搜索模板名称" className="pl-8" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="draft">草稿</SelectItem>
            <SelectItem value="published">已上架</SelectItem>
            <SelectItem value="offline">已下架</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>模板名称</TableHead>
              <TableHead>场景</TableHead>
              <TableHead>语言</TableHead>
              <TableHead className="text-right">步骤数</TableHead>
              <TableHead className="text-right">使用次数</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>更新</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">暂无模板</TableCell>
              </TableRow>
            )}
            {rows.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-1.5">
                    {t.recommended && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                    {t.name}
                  </span>
                </TableCell>
                <TableCell>{SCRIPT_SCENES.find((s) => s.key === t.scene)?.label}</TableCell>
                <TableCell>{SCRIPT_LANGUAGES.find((l) => l.key === t.language)?.label}</TableCell>
                <TableCell className="text-right tabular-nums">{t.steps.length}</TableCell>
                <TableCell className="text-right tabular-nums">{t.usedCount.toLocaleString()}</TableCell>
                <TableCell>
                  {t.status === "published" ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10">已上架</Badge>
                  ) : t.status === "draft" ? (
                    <Badge variant="secondary">草稿</Badge>
                  ) : (
                    <Badge variant="outline">已下架</Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {t.updatedAt}
                  <span className="block text-xs">{t.updatedBy}</span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="编辑编排"
                      onClick={() => navigate({ to: "/outreach/voice-scripts/$scriptId", params: { scriptId: t.id } })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" title="复制为新版本"
                      onClick={() => { duplicateScript(t.id, `${t.name} v2`); toast.success("已复制为新版本草稿"); }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => {
                        const next = t.status === "published" ? "offline" : "published";
                        updateScript(t.id, { status: next });
                        toast.success(next === "published" ? "已上架到模板市场" : "已下架");
                      }}
                    >
                      {t.status === "published" ? <ArrowDownToLine className="h-3.5 w-3.5" /> : <ArrowUpFromLine className="h-3.5 w-3.5" />}
                      {t.status === "published" ? "下架" : "上架"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { updateScript(t.id, { recommended: !t.recommended }); }}>
                      {t.recommended ? "取消推荐" : "推荐"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建话术模板</DialogTitle>
            <DialogDescription>模板不区分行业，统一为多行业通用；创建后进入话术设计器编排步骤，编排完成再上架到模板市场。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>模板名称 <span className="text-destructive">*</span></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：新能源 · 海外经销商开发" maxLength={60} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>场景</Label>
                <Select value={scene} onValueChange={(v) => setScene(v as ScriptScene)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCRIPT_SCENES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>语言</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCRIPT_LANGUAGES.map((l) => <SelectItem key={l.key} value={l.key}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button
              disabled={!name.trim()}
              onClick={() => {
                const s = createScript({ name: name.trim(), scene, industry: TEMPLATE_INDUSTRY, language, owner: "platform" });
                setOpen(false);
                setName("");
                navigate({ to: "/outreach/voice-scripts/$scriptId", params: { scriptId: s.id } });
              }}
            >
              创建并编排
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
