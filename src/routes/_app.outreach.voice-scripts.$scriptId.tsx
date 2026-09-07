import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Plus,
  Trash2,
  Copy,
  Save,
  Rocket,
  AlertTriangle,
  Sparkles,
  Loader2,
  PhoneForwarded,
  Bot,
  Megaphone,
  ClipboardList,
  Flag,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { generateAiContent } from "@/lib/api/ai-compose.functions";
import { ScriptSpeechPreview } from "@/components/outreach/ScriptSpeechPreview";
import {
  END_TARGET,
  RECORDING_NOTICE,
  SCRIPT_SCENES,
  SCRIPT_LANGUAGES,
  SCRIPT_VARIABLES,
  SCRIPT_REGIONS,
  regionLabel,
  STEP_TYPES,
  newStep,
  updateScript,
  useAgentGroups,
  useScript,
  validateScript,
  type ScriptStep,
  type StepType,
} from "@/lib/voice-scripts";

export const Route = createFileRoute("/_app/outreach/voice-scripts/$scriptId")({
  head: () => ({
    meta: [
      { title: "话术设计器 · 出海大数据平台" },
      { name: "description", content: "线性步骤式编排 AI 智能外呼话术：开场白、AI 对话、转人工、留资与结束语。" },
      { property: "og:title", content: "话术设计器 · 出海大数据平台" },
      { property: "og:description", content: "线性步骤式编排 AI 智能外呼话术。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScriptEditorPage,
});

const STEP_ICON: Record<StepType, typeof Bot> = {
  opening: Megaphone,
  ai: Bot,
  transfer: PhoneForwarded,
  collect: ClipboardList,
  ending: Flag,
};

function ScriptEditorPage() {
  const { scriptId } = Route.useParams();
  const navigate = useNavigate();
  const script = useScript(scriptId);
  const groups = useAgentGroups();
  const [errors, setErrors] = useState<string[]>([]);
  const [aiStep, setAiStep] = useState<string | null>(null);

  const steps = script?.steps ?? [];
  const stepOptions = useMemo(
    () => [
      ...steps.map((s, i) => ({ value: s.id, label: `步骤 ${i + 1} · ${s.title}` })),
      { value: END_TARGET, label: "结束通话" },
    ],
    [steps],
  );

  if (!script) {
    return (
      <div className="p-8">
        <Card className="p-10 text-center text-muted-foreground">
          话术不存在或已删除。
          <div className="mt-4">
            <Button variant="outline" onClick={() => navigate({ to: "/outreach/voice-scripts" })}>返回话术列表</Button>
          </div>
        </Card>
      </div>
    );
  }

  const setSteps = (next: ScriptStep[]) => updateScript(script.id, { steps: next });
  const patchStep = (id: string, patch: Partial<ScriptStep>) =>
    setSteps(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const move = (idx: number, dir: -1 | 1) => {
    const next = [...steps];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setSteps(next);
  };

  const genContent = async (s: ScriptStep) => {
    setAiStep(s.id);
    try {
      const res = await generateAiContent({
        data: {
          channel: "sms",
          scene: `AI 智能外呼 · ${SCRIPT_SCENES.find((x) => x.key === script.scene)?.label ?? ""} · ${s.title}`,
          tone: "friendly",
          language: script.language,
          extra:
            s.type === "ai"
              ? "输出一段用于 LLM 语音对话节点的系统提示词，包含角色、目标、应对规则与收尾要求。"
              : "输出口语化、可直接由 AI 语音播报的一段话，30 秒内可读完。",
        },
      });
      patchStep(s.id, { content: res.content ?? "" });
      toast.success("内容已生成");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "生成失败");
    } finally {
      setAiStep(null);
    }
  };

  const publish = () => {
    const errs = validateScript({ ...script, steps });
    setErrors(errs);
    if (errs.length > 0) {
      toast.error(`校验未通过，共 ${errs.length} 项问题`);
      return;
    }
    updateScript(script.id, { status: "published" });
    toast.success("话术已发布，可在 AI 智能外呼中选用");
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>出海大数据平台</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to="/outreach/voice-scripts" className="hover:text-foreground">外呼话术</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{script.name}</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            {script.name}
            {script.owner === "platform" && <Badge variant="secondary">平台模板</Badge>}
            {script.status === "published" ? (
              <Badge className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/10">已发布</Badge>
            ) : script.status === "draft" ? (
              <Badge variant="secondary">草稿</Badge>
            ) : (
              <Badge variant="outline">已下线</Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {SCRIPT_SCENES.find((s) => s.key === script.scene)?.label} · 目标市场：{regionLabel(script.region)} · 最近更新 {script.updatedAt}（{script.updatedBy}）
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground whitespace-nowrap">外呼语言</span>
            <Select value={script.language} onValueChange={(v) => { updateScript(script.id, { language: v }); toast.success("外呼语言已更新"); }}>
              <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCRIPT_LANGUAGES.map((l) => <SelectItem key={l.key} value={l.key}>{l.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground whitespace-nowrap">目标市场</span>
            <Select value={script.region ?? "global"} onValueChange={(v) => { updateScript(script.id, { region: v }); toast.success("目标市场已更新"); }}>
              <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCRIPT_REGIONS.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" className="gap-1.5" onClick={() => { updateScript(script.id, { status: script.status === "published" ? script.status : "draft" }); toast.success("草稿已保存"); }}>
            <Save className="h-4 w-4" />
            保存草稿
          </Button>
          <Button className="gap-1.5" onClick={publish}>
            <Rocket className="h-4 w-4" />
            发布
          </Button>
        </div>
      </div>

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>发布校验未通过</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5 space-y-0.5 mt-1">
              {errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="text-xs text-muted-foreground">
        可用变量：{SCRIPT_VARIABLES.map((v) => `{${v}}`).join("  ")}
      </div>

      <Accordion type="multiple" defaultValue={steps.map((s) => s.id)} className="space-y-3">
        {steps.map((s, idx) => {
          const Icon = STEP_ICON[s.type];
          return (
            <AccordionItem key={s.id} value={s.id} className="border rounded-lg bg-card px-4">
              <div className="flex items-center gap-2">
                <AccordionTrigger className="flex-1 hover:no-underline">
                  <div className="flex items-center gap-3 text-left">
                    <span className="h-7 w-7 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold tabular-nums">
                      {idx + 1}
                    </span>
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="font-medium">{s.title}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {STEP_TYPES.find((t) => t.key === s.type)?.label}
                    </Badge>
                    {s.branches.length > 0 && (
                      <span className="text-xs text-muted-foreground">{s.branches.length} 个分支</span>
                    )}
                  </div>
                </AccordionTrigger>
                <div className="flex items-center gap-0.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => move(idx, -1)}>
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === steps.length - 1} onClick={() => move(idx, 1)}>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="复制步骤"
                    onClick={() => {
                      const copy: ScriptStep = { ...JSON.parse(JSON.stringify(s)) as ScriptStep, id: `st-${Math.random().toString(36).slice(2, 8)}`, title: `${s.title}（副本）` };
                      const next = [...steps];
                      next.splice(idx + 1, 0, copy);
                      setSteps(next);
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => setSteps(steps.filter((x) => x.id !== s.id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <AccordionContent className="pb-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs">步骤名称</Label>
                    <Input value={s.title} onChange={(e) => patchStep(s.id, { title: e.target.value })} />
                  </div>
                  {s.type === "ai" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">最大对话轮次</Label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={s.maxTurns ?? 5}
                        onChange={(e) => patchStep(s.id, { maxTurns: Number(e.target.value) })}
                        className="w-28"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">
                      {s.type === "ai" ? "系统提示词" : "播报文本"} <span className="text-destructive">*</span>
                    </Label>
                    <Button variant="outline" size="sm" className="gap-1.5" disabled={aiStep === s.id} onClick={() => genContent(s)}>
                      {aiStep === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      AI 生成
                    </Button>
                  </div>
                  <Textarea rows={s.type === "ai" ? 6 : 3} value={s.content} onChange={(e) => patchStep(s.id, { content: e.target.value })} />
                  {s.type === "opening" && !s.content.includes(RECORDING_NOTICE.slice(0, 8)) && (
                    <button
                      className="text-xs text-amber-600 hover:underline"
                      onClick={() => patchStep(s.id, { content: `${RECORDING_NOTICE}${s.content}` })}
                    >
                      缺少录音告知语（合规要求），点击插入「{RECORDING_NOTICE}」
                    </button>
                  )}
                  {s.type !== "ai" && (
                    <ScriptSpeechPreview text={s.content} language={script.language} />
                  )}
                </div>

                {s.type === "ai" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">变量注入</Label>
                      <div className="flex flex-wrap gap-3">
                        {SCRIPT_VARIABLES.map((v) => (
                          <label key={v} className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <Checkbox
                              checked={(s.variables ?? []).includes(v)}
                              onCheckedChange={(c) =>
                                patchStep(s.id, {
                                  variables: c
                                    ? [...(s.variables ?? []), v]
                                    : (s.variables ?? []).filter((x) => x !== v),
                                })
                              }
                            />
                            {`{${v}}`}
                          </label>
                        ))}
                      </div>
                    </div>
                    <label className="flex items-start gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={!!s.useKnowledge}
                        onCheckedChange={(c) => patchStep(s.id, { useKnowledge: !!c })}
                        className="mt-0.5"
                      />
                      <span>
                        关联企业知识库
                        <span className="block text-xs text-muted-foreground">
                          AI 回答产品与公司问题时引用「企业信息 → 附加资料」内容
                        </span>
                      </span>
                    </label>
                  </div>
                )}

                {s.type === "transfer" && (
                  <div className="space-y-3">
                    {groups.length === 0 ? (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          尚未配置人工坐席，请先前往{" "}
                          <Link to="/outreach/agents" className="text-primary underline">企业设置 → 人工坐席</Link> 添加。
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">坐席组</Label>
                          <Select value={s.agentGroup ?? ""} onValueChange={(v) => patchStep(s.id, { agentGroup: v })}>
                            <SelectTrigger><SelectValue placeholder="选择坐席组" /></SelectTrigger>
                            <SelectContent>
                              {groups.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">振铃超时（秒）</Label>
                          <Input
                            type="number"
                            min={5}
                            value={s.ringTimeout ?? 20}
                            onChange={(e) => patchStep(s.id, { ringTimeout: Number(e.target.value) })}
                            className="w-28"
                          />
                        </div>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-xs">转接失败兜底话术</Label>
                      <Textarea rows={2} value={s.fallback ?? ""} onChange={(e) => patchStep(s.id, { fallback: e.target.value })} />
                      <ScriptSpeechPreview
                        text={s.fallback ?? ""}
                        language={script.language}
                        label="转接失败兜底话术 · 实际外呼话术预览"
                      />
                      <p className="text-xs text-muted-foreground">
                        转接失败或非坐席工作时间：播放兜底话术 → 记录留言 → 打「需人工跟进」标签 → 结束通话。
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">分支与跳转</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() =>
                        patchStep(s.id, {
                          branches: [
                            ...s.branches,
                            { id: `br-${Math.random().toString(36).slice(2, 8)}`, label: "新分支", to: END_TARGET },
                          ],
                        })
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                      添加分支
                    </Button>
                  </div>
                  {s.branches.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      无分支，执行完成后按顺序进入下一步骤{idx === steps.length - 1 ? "（当前为最后一步，将结束通话）" : ""}。
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {s.branches.map((b) => (
                        <div key={b.id} className="flex items-center gap-2">
                          <Input
                            value={b.label}
                            onChange={(e) =>
                              patchStep(s.id, {
                                branches: s.branches.map((x) => (x.id === b.id ? { ...x, label: e.target.value } : x)),
                              })
                            }
                            className="max-w-[220px]"
                            placeholder="客户回应，如：有意向"
                          />
                          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          <Select
                            value={b.to}
                            onValueChange={(v) =>
                              patchStep(s.id, {
                                branches: s.branches.map((x) => (x.id === b.id ? { ...x, to: v } : x)),
                              })
                            }
                          >
                            <SelectTrigger className="max-w-[260px]"><SelectValue placeholder="选择跳转目标" /></SelectTrigger>
                            <SelectContent>
                              {stepOptions.filter((o) => o.value !== s.id).map((o) => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => patchStep(s.id, { branches: s.branches.filter((x) => x.id !== b.id) })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className={cn("w-full gap-1.5 border-dashed")}>
            <Plus className="h-4 w-4" />
            添加步骤
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72">
          {STEP_TYPES.map((t) => (
            <DropdownMenuItem key={t.key} onClick={() => setSteps([...steps, newStep(t.key)])} className="flex-col items-start gap-0.5">
              <span className="font-medium">{t.label}</span>
              <span className="text-xs text-muted-foreground">{t.desc}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
