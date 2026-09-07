import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ChevronRight,
  Search,
  Sparkles,
  Copy,
  Trash2,
  Pencil,
  Store,
  PhoneCall,
  Star,
  Eye,
  CornerDownRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  SCRIPT_SCENES,
  SCRIPT_LANGUAGES,
  STEP_TYPES,
  TEMPLATE_INDUSTRY,
  END_TARGET,
  SCRIPT_REGIONS,
  regionLabel,
  deleteScript,
  duplicateScript,
  updateScript,
  useScripts,
  createScriptFromTemplate,
  type ScriptScene,
  type VoiceScript,
} from "@/lib/voice-scripts";
import heroBg from "@/assets/voice-scripts-hero.jpg";


export const Route = createFileRoute("/_app/outreach/voice-scripts/")({
  head: () => ({
    meta: [
      { title: "外呼话术 · 出海大数据平台" },
      { name: "description", content: "管理 AI 智能外呼话术，使用平台模板快速开始，线性步骤式编排多轮对话。" },
      { property: "og:title", content: "外呼话术 · 出海大数据平台" },
      { property: "og:description", content: "管理 AI 智能外呼话术与平台模板市场。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VoiceScriptsPage,
});

const sceneLabel = (k: ScriptScene) => SCRIPT_SCENES.find((s) => s.key === k)?.label ?? k;
const langLabel = (k: string) => SCRIPT_LANGUAGES.find((s) => s.key === k)?.label ?? k;

function StatusBadge({ s }: { s: VoiceScript["status"] }) {
  if (s === "published") return <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10">已发布</Badge>;
  if (s === "draft") return <Badge variant="secondary">草稿</Badge>;
  return <Badge variant="outline">已下线</Badge>;
}

function VoiceScriptsPage() {
  const navigate = useNavigate();
  const mine = useScripts("tenant");
  const templates = useScripts("platform");
  const [kw, setKw] = useState("");
  const [mineLang, setMineLang] = useState("all");
  const [scene, setScene] = useState<string>("all");
  const [detail, setDetail] = useState<VoiceScript | null>(null);
  const [useTpl, setUseTpl] = useState<VoiceScript | null>(null);

  const filteredMine = useMemo(
    () =>
      mine.filter(
        (s) =>
          (kw ? s.name.includes(kw) : true) &&
          (mineLang === "all" ? true : s.language === mineLang),
      ),
    [mine, kw, mineLang],
  );
  const market = useMemo(
    () =>
      templates.filter(
        (t) =>
          t.status === "published" &&
          (kw ? t.name.toLowerCase().includes(kw.toLowerCase()) : true) &&
          (scene === "all" ? true : t.scene === scene),
      ),
    [templates, kw, scene],
  );

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>出海大数据平台</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>客户运营</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">外呼话术</span>
      </div>

      <section className="relative overflow-hidden rounded-2xl ring-1 ring-border">
        <img
          src={heroBg}
          alt="外呼话术"
          width={1920}
          height={512}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(184_70%_42%/0.92)] via-[hsl(184_60%_55%/0.55)] to-transparent" />
        <div className="relative px-8 py-10 flex items-center gap-5 text-white">
          <div className="h-14 w-14 rounded-2xl bg-white/25 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/30">
            <PhoneCall className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wide">外呼话术</h1>
            <p className="text-white/90 text-sm mt-1">
              AI 智能外呼使用的对话内容。可从平台模板市场一键复制，再按线性步骤编排多轮对话与意向判定。
            </p>
          </div>
        </div>
      </section>


      <Tabs defaultValue="market">
        <TabsList>
          <TabsTrigger value="market">模板市场</TabsTrigger>
          <TabsTrigger value="mine">我的话术</TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative max-w-xs flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="搜索话术名称" className="pl-8" />
            </div>
            <Select value={mineLang} onValueChange={setMineLang}>
              <SelectTrigger className="w-36"><SelectValue placeholder="外呼语言" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部语言</SelectItem>
                {SCRIPT_LANGUAGES.map((l) => <SelectItem key={l.key} value={l.key}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>话术名称</TableHead>
                  <TableHead>场景</TableHead>
                  <TableHead>外呼语言</TableHead>
                  <TableHead>目标市场</TableHead>
                  <TableHead className="text-right">步骤数</TableHead>
                  <TableHead className="text-right">通话数</TableHead>
                  <TableHead className="text-right">A 类意向</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>更新时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMine.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-10">
                      暂无话术，点击右上角「新建话术」或前往模板市场复制一份
                    </TableCell>
                  </TableRow>
                )}
                {filteredMine.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Link to="/outreach/voice-scripts/$scriptId" params={{ scriptId: s.id }} className="hover:text-primary">
                        {s.name}
                      </Link>
                      {s.fromTemplateId && (
                        <Badge variant="outline" className="ml-2 text-[10px]">来自模板</Badge>
                      )}
                    </TableCell>
                    <TableCell>{sceneLabel(s.scene)}</TableCell>
                    <TableCell>{langLabel(s.language)}</TableCell>
                    <TableCell className="text-muted-foreground">{regionLabel(s.region)}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.steps.length}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.usedCount.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {s.intentRateA != null ? `${s.intentRateA}%` : "—"}
                    </TableCell>
                    <TableCell><StatusBadge s={s.status} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{s.updatedAt}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="编辑"
                          onClick={() => navigate({ to: "/outreach/voice-scripts/$scriptId", params: { scriptId: s.id } })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="复制"
                          onClick={() => { duplicateScript(s.id); toast.success("已复制为新话术"); }}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            updateScript(s.id, { status: s.status === "published" ? "offline" : "published" });
                            toast.success(s.status === "published" ? "已下线" : "已发布");
                          }}
                        >
                          {s.status === "published" ? "下线" : "发布"}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="删除"
                          onClick={() => { deleteScript(s.id); toast.success("已删除"); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="market" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative max-w-xs flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={kw} onChange={(e) => setKw(e.target.value)} placeholder="搜索模板" className="pl-8" />
            </div>
            <Select value={scene} onValueChange={setScene}>
              <SelectTrigger className="w-36"><SelectValue placeholder="场景" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部场景</SelectItem>
                {SCRIPT_SCENES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
              <Store className="h-3.5 w-3.5" />
              模板均为{TEMPLATE_INDUSTRY}中文话术，行业差异由变量与企业知识库注入；使用模板创建话术时可选择外呼语言与目标市场，不影响原模板
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {market.length === 0 && (
              <Card className="p-8 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
                没有符合条件的模板
              </Card>
            )}
            {market.map((t) => (
              <Card key={t.id} className="p-5 space-y-3 hover:shadow-md transition-shadow flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium flex items-center gap-1.5">
                    {t.recommended && <Star className="h-4 w-4 text-amber-500 fill-amber-500 shrink-0" />}
                    {t.name}
                  </div>
                  <Badge variant="secondary" className="shrink-0">{sceneLabel(t.scene)}</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <Badge variant="outline">{TEMPLATE_INDUSTRY}</Badge>
                  <Badge variant="outline">{t.steps.length} 个步骤</Badge>
                  {t.avgDuration != null && <Badge variant="outline">约 {t.avgDuration}s</Badge>}
                </div>
                {t.desc && <p className="text-xs text-muted-foreground line-clamp-3">{t.desc}</p>}
                <ol className="text-xs text-muted-foreground space-y-1">
                  {t.steps.slice(0, 4).map((s, i) => (
                    <li key={s.id} className="truncate">
                      {i + 1}. {s.title}
                      {s.branches.length > 0 && ` · ${s.branches.length} 个分支`}
                    </li>
                  ))}
                  {t.steps.length > 4 && <li>…</li>}
                </ol>
                <div className="flex items-center justify-between pt-1 mt-auto gap-2">
                  <span className="text-xs text-muted-foreground">已被使用 {t.usedCount.toLocaleString()} 次</span>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setDetail(t)}>
                      <Eye className="h-3.5 w-3.5" />
                      查看详情
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setUseTpl(t)}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      使用模板创建
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <TemplateDetailDialog
        template={detail}
        onOpenChange={(v) => !v && setDetail(null)}
        onUse={(id) => {
          const t = templates.find((x) => x.id === id) ?? null;
          setDetail(null);
          setUseTpl(t);
        }}
      />

      <UseTemplateDialog
        template={useTpl}
        onOpenChange={(v) => !v && setUseTpl(null)}
        onConfirm={(id, name, language, region) => {
          const copy = createScriptFromTemplate(id, { name, language, region });
          setUseTpl(null);
          if (copy) {
            toast.success("已创建到「我的话术」");
            navigate({ to: "/outreach/voice-scripts/$scriptId", params: { scriptId: copy.id } });
          }
        }}
      />
    </div>
  );
}

function UseTemplateDialog({
  template,
  onOpenChange,
  onConfirm,
}: {
  template: VoiceScript | null;
  onOpenChange: (v: boolean) => void;
  onConfirm: (id: string, name: string, language: string, region: string) => void;
}) {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("zh");
  const [region, setRegion] = useState("global");

  // 每次打开新模板时重置表单
  const [lastId, setLastId] = useState<string | null>(null);
  if (template && template.id !== lastId) {
    setLastId(template.id);
    setName(template.name);
    setLanguage(template.language);
    setRegion("global");
  }

  if (!template) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>使用模板创建话术</DialogTitle>
          <DialogDescription>
            基于「{template.name}」创建一份属于我的话术，可先设置名称、外呼语言与目标市场；后续修改不影响原模板。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>话术名称</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="请输入话术名称" />
          </div>
          <div className="space-y-1.5">
            <Label>外呼语言</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCRIPT_LANGUAGES.map((l) => (
                  <SelectItem key={l.key} value={l.key}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              该语言即 AI 外呼时与客户对话使用的语言；模板原文为中文，选择其他语言后可在编排页查看实际外呼话术预览。
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>目标市场 / 地区</Label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCRIPT_REGIONS.map((r) => (
                  <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              用于外呼时段（当地工作时间）、称呼习惯与当地合规提示的适配。
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button disabled={!name.trim()} onClick={() => onConfirm(template.id, name, language, region)}>
            创建并编排
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



function TemplateDetailDialog({
  template,
  onOpenChange,
  onUse,
}: {
  template: VoiceScript | null;
  onOpenChange: (v: boolean) => void;
  onUse: (id: string) => void;
}) {
  if (!template) return null;
  const stepName = (id: string) =>
    id === END_TARGET ? "结束通话" : template.steps.find((s) => s.id === id)?.title ?? "未指定";

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5">
            {template.recommended && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
            {template.name}
          </DialogTitle>
          <DialogDescription>{template.desc ?? "平台运营维护的通用外呼话术模板。"}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <Badge variant="secondary">{sceneLabel(template.scene)}</Badge>
          <Badge variant="outline">{TEMPLATE_INDUSTRY}</Badge>
          <Badge variant="outline">{langLabel(template.language)}</Badge>
          <Badge variant="outline">{template.steps.length} 个步骤</Badge>
          {template.avgDuration != null && <Badge variant="outline">平均通话约 {template.avgDuration}s</Badge>}
          <Badge variant="outline">已被使用 {template.usedCount.toLocaleString()} 次</Badge>
        </div>

        {template.tags && template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {template.tags.map((t) => (
              <Badge key={t} variant="secondary" className="text-[11px] font-normal">#{t}</Badge>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <div className="text-sm font-medium">对话流</div>
          {template.steps.map((s, i) => (
            <Card key={s.id} className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[11px] text-primary tabular-nums">
                  {i + 1}
                </span>
                <span className="text-sm font-medium">{s.title}</span>
                <Badge variant="outline" className="text-[10px]">
                  {STEP_TYPES.find((t) => t.key === s.type)?.label}
                </Badge>
                {s.type === "ai" && s.maxTurns != null && (
                  <span className="text-[11px] text-muted-foreground">最多 {s.maxTurns} 轮</span>
                )}
                {s.type === "transfer" && s.agentGroup && (
                  <span className="text-[11px] text-muted-foreground">坐席组：{s.agentGroup}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">{s.content}</p>
              {s.type === "transfer" && s.fallback && (
                <p className="text-[11px] text-muted-foreground">兜底话术：{s.fallback}</p>
              )}
              {s.branches.length > 0 && (
                <div className="space-y-1 pt-1">
                  {s.branches.map((b) => (
                    <div key={b.id} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <CornerDownRight className="h-3 w-3" />
                      <span className="text-foreground">{b.label}</span>
                      <span>→ {stepName(b.to)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
          <Button className="gap-1.5" onClick={() => onUse(template.id)}>
            <Sparkles className="h-3.5 w-3.5" />
            使用模板创建话术
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
