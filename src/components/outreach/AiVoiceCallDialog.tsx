import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  PhoneCall,
  Plus,
  X,
  MapPin,
  Sparkles,
  Loader2,
  Clock,
  Rocket,
  CalendarClock,
  TrendingUp,
  ExternalLink,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { generateAiContent } from "@/lib/api/ai-compose.functions";
import { usePublishedScripts } from "@/lib/voice-scripts";

export interface AiCallTarget {
  key: string;
  name: string;
  phone: string;
}

type Scene = "marketing" | "notify" | "revisit" | "other";
type Pacing = "ramp" | "steady" | "random";


const SCENE_OPTIONS: { value: Scene; label: string }[] = [
  { value: "marketing", label: "营销外呼" },
  { value: "notify", label: "语音通知" },
  { value: "revisit", label: "客户回访" },
  { value: "other", label: "其他" },
];

const STEPS = ["基本信息", "内容与策略", "预览与确认", "启动控制"];

export function AiVoiceCallDialog({
  open,
  onOpenChange,
  targets,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targets: AiCallTarget[];
}) {
  const [step, setStep] = useState(0);

  // step 1
  const [name, setName] = useState("");
  const [list, setList] = useState<AiCallTarget[]>([]);
  const [manual, setManual] = useState("");
  const [scene, setScene] = useState<Scene>("marketing");

  // step 2
  const scriptOptions = usePublishedScripts();
  const [scriptId, setScriptId] = useState("");
  const [script, setScript] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [concurrency, setConcurrency] = useState("20");
  // step 4 起量方式
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("20:00");
  const [maxRetry, setMaxRetry] = useState("3");

  // step 4
  const [launch, setLaunch] = useState<"now" | "scheduled">("now");
  const [pacing, setPacing] = useState<Pacing>("ramp");
  const [scheduledAt, setScheduledAt] = useState("");
  const [rampInit, setRampInit] = useState("5");
  const [rampStep, setRampStep] = useState("5");
  const [rampInterval, setRampInterval] = useState("30");


  useEffect(() => {
    if (!open) return;
    setStep(0);
    setName("");
    setManual("");
    setScene("marketing");
    setScript("");
    setScriptId("");
    setConcurrency("20");
    setPacing("ramp");
    setStartTime("09:00");
    setEndTime("20:00");
    setMaxRetry("3");
    setLaunch("now");
    setScheduledAt("");
    setRampInit("5");
    setRampStep("5");
    setRampInterval("30");
    setList(targets);
  }, [open, targets]);

  const sceneLabel = SCENE_OPTIONS.find((s) => s.value === scene)!.label;
  const selectedScript = scriptOptions.find((s) => s.id === scriptId);

  const addManual = () => {
    const raw = manual.trim();
    if (!raw) return;
    const nums = raw
      .split(/[,，;；\s]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    const exists = new Set(list.map((t) => t.phone));
    const next = [...list];
    let added = 0;
    for (const n of nums) {
      if (!/^\+?[\d\-()]{6,20}$/.test(n)) {
        toast.warning(`号码格式不正确：${n}`);
        continue;
      }
      if (exists.has(n)) continue;
      exists.add(n);
      next.push({ key: `manual-${n}`, name: "手动添加", phone: n });
      added++;
    }
    setList(next);
    setManual("");
    if (added > 0) toast.success(`已添加 ${added} 个号码`);
  };

  const genScript = async () => {
    setAiLoading(true);
    try {
      const res = await generateAiContent({
        data: {
          channel: "sms",
          scene: `AI 智能外呼话术 · ${sceneLabel}`,
          tone: "friendly",
          language: "zh",
          extra:
            "输出可直接用于 AI 语音外呼的口语化话术，包含开场自我介绍、一个核心价值点、一个明确问题收尾。",
        },
      });
      setScript(res.content ?? "");
      toast.success("话术已生成");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "生成失败");
    } finally {
      setAiLoading(false);
    }
  };

  const step1Valid = name.trim().length > 0 && name.length <= 100 && list.length > 0;
  const step2Valid = scriptId.length > 0 && startTime < endTime;
  const rampValid =
    pacing !== "ramp" ||
    (Number(rampInit) >= 1 &&
      Number(rampInit) <= Number(concurrency) &&
      Number(rampStep) > 0 &&
      Number(rampInterval) > 0);
  const step4Valid =
    (launch === "now" || (launch === "scheduled" && scheduledAt.length > 0)) && rampValid;

  const canNext = useMemo(() => {
    if (step === 0) return step1Valid;
    if (step === 1) return step2Valid;
    return true;
  }, [step, step1Valid, step2Valid]);

  const submit = () => {
    if (!step4Valid) return;
    onOpenChange(false);
    const launchLabel =
      launch === "now"
        ? `外呼任务「${name.trim()}」已启动`
        : `外呼任务「${name.trim()}」已定时`;
    const pacingText =
      pacing === "ramp"
        ? `灰度爬坡 ${rampInit} 路起，每 ${rampInterval} 秒 +${rampStep} 路，上限 ${concurrency} 路`
        : pacing === "random"
        ? `随机并发（上限 ${concurrency} 路）`
        : `恒定并发 ${concurrency} 路`;
    toast.success(launchLabel, {
      description: `${sceneLabel}｜话术「${selectedScript?.name ?? ""}」｜${list.length} 个号码｜${pacingText}｜${startTime}-${endTime}｜最多重试 ${maxRetry} 次${
        launch === "scheduled" ? `｜启动时间 ${scheduledAt.replace("T", " ")}` : ""
      }`,
    });
  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-primary" />
            AI 智能外呼
          </DialogTitle>
          <DialogDescription>
            由 AI 语音机器人按设定话术批量外呼所选目标号码，通话结果与客户回复统一归集到「触达会话」。
          </DialogDescription>
        </DialogHeader>

        {/* 步骤条 */}
        <div className="flex items-center gap-2 text-xs">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2.5 py-1 border",
                  i === step
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : i < step
                      ? "border-primary/30 text-primary"
                      : "border-border text-muted-foreground",
                )}
              >
                <span className="tabular-nums">{i + 1}</span>
                {s}
              </span>
              {i < STEPS.length - 1 && <span className="h-px w-3 bg-border" />}
            </div>
          ))}
        </div>

        <div className="space-y-5 max-h-[58vh] overflow-y-auto pr-1">
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="call-name">
                  任务名称 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="call-name"
                  value={name}
                  maxLength={100}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="如：东南亚储能客户 8 月回访"
                />
                <p className="text-xs text-muted-foreground text-right">{name.length}/100</p>
              </div>

              <div className="space-y-2">
                <Label>目标号码（{list.length}）</Label>
                <div className="rounded-lg border border-border max-h-48 overflow-y-auto divide-y">
                  {list.length === 0 ? (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      暂无号码，请手动添加
                    </div>
                  ) : (
                    list.map((t) => (
                      <div
                        key={t.key}
                        className="flex items-center gap-2 px-3 py-2 text-sm"
                      >
                        <span className="truncate flex-1">{t.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {t.phone}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => setList(list.filter((x) => x.key !== t.key))}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={manual}
                    onChange={(e) => setManual(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addManual();
                      }
                    }}
                    placeholder="手动添加号码，如 +8613800138000，支持逗号分隔批量添加"
                  />
                  <Button variant="outline" onClick={addManual} className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    添加
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>场景类型</Label>
                <Select value={scene} onValueChange={(v) => setScene(v as Scene)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCENE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 cursor-not-allowed">
                <Checkbox checked disabled className="mt-0.5" />
                <div className="min-w-0">
                  <div className="text-sm font-medium flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-primary" />
                    启用号码归属地识别
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    自动识别目标号码归属地并选择当地线路号码呼出，提升接通率。当前版本默认开启，暂不支持关闭。
                  </div>
                </div>
              </label>
            </>
          )}

          {step === 1 && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    外呼话术 <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => window.open("/outreach/voice-scripts", "_blank")}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    新建 / 管理话术
                  </Button>
                </div>
                <Select value={scriptId} onValueChange={setScriptId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择一个已发布的话术" />
                  </SelectTrigger>
                  <SelectContent>
                    {scriptOptions.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        暂无已发布话术，请先前往「客户运营 → 外呼话术」创建并发布
                      </div>
                    ) : (
                      scriptOptions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}（{s.steps.length} 个步骤）
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                {selectedScript && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5">
                    <div className="text-xs font-medium text-muted-foreground">对话流预览</div>
                    <ol className="space-y-1 text-xs">
                      {selectedScript.steps.map((s, i) => (
                        <li key={s.id} className="flex items-start gap-2">
                          <span className="tabular-nums text-muted-foreground">{i + 1}.</span>
                          <span className="min-w-0">
                            <span className="font-medium">{s.title}</span>
                            {s.branches.length > 0 && (
                              <span className="text-muted-foreground">
                                {" "}
                                · 分支：{s.branches.map((b) => b.label).join(" / ")}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="call-script">开场白覆写（选填）</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={aiLoading}
                    onClick={genScript}
                  >
                    {aiLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    AI 生成开场白
                  </Button>
                </div>
                <Textarea
                  id="call-script"
                  rows={4}
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  placeholder="留空则使用所选话术的开场白；填写后仅覆盖本次任务的开场白，不修改原话术"
                />
                <p className="text-xs text-muted-foreground">
                  支持变量：{"{企业名}"} {"{联系人名}"} {"{行业}"} {"{我的公司}"} {"{我的姓名}"}
                </p>
              </div>


              <div className="rounded-lg border border-border p-3 space-y-4">
                <div className="text-sm font-medium">拨打规则</div>

                <div className="space-y-2">
                  <Label>目标并发上限</Label>
                  <Select value={concurrency} onValueChange={setConcurrency}>
                    <SelectTrigger className="max-w-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["20", "50", "100"].map((c) => (
                        <SelectItem key={c} value={c}>
                          {c} 路
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    任务运行期间的并发天花板；具体起量方式（恒定 / 随机 / 灰度爬坡）在第 4 步「外呼策略」中设置。
                  </p>
                </div>


                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    拨打时间窗口
                  </Label>
                  <div className="grid grid-cols-2 gap-4">
                    <Input value="按号码时区自动" disabled />
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                      />
                      <span className="text-muted-foreground">~</span>
                      <Input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                      />
                    </div>
                  </div>
                  {startTime >= endTime && (
                    <p className="text-xs text-destructive">结束时间需晚于开始时间</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>单号码最大重试</Label>
                  <RadioGroup
                    value={maxRetry}
                    onValueChange={setMaxRetry}
                    className="flex items-center gap-4"
                  >
                    {["3", "5"].map((r) => (
                      <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                        <RadioGroupItem value={r} />
                        {r} 次
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border divide-y text-sm">
                {[
                  ["任务名称", name.trim()],
                  ["场景类型", sceneLabel],
                  ["外呼话术", selectedScript ? `${selectedScript.name}（${selectedScript.steps.length} 个步骤）` : "—"],
                  ["目标号码", `${list.length} 个`],
                  ["号码归属地识别", "已开启（当地号码呼出）"],
                  ["目标并发上限", `${concurrency} 路`],
                  ["拨打时间窗口", `按号码时区自动｜${startTime} ~ ${endTime}`],
                  ["单号码最大重试", `${maxRetry} 次`],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center gap-3 px-3 py-2">
                    <span className="w-32 shrink-0 text-muted-foreground">{k}</span>
                    <span className="font-medium">{v}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5">
                <Label>{script.trim() ? "开场白（本次覆写）" : "开场白"}</Label>
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                  {script.trim() || selectedScript?.steps[0]?.content || "—"}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {list.slice(0, 12).map((t) => (
                  <Badge key={t.key} variant="secondary" className="font-mono text-[11px]">
                    {t.phone}
                  </Badge>
                ))}
                {list.length > 12 && (
                  <Badge variant="outline" className="text-[11px]">
                    +{list.length - 12}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-3">
                <Label>启动方式</Label>
                <RadioGroup
                  value={launch}
                  onValueChange={(v) => setLaunch(v as "now" | "scheduled")}
                  className="grid gap-2"
                >
                  <label
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      launch === "now" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                    )}
                  >
                    <RadioGroupItem value="now" className="mt-1" />
                    <div>
                      <div className="text-sm font-medium flex items-center gap-1.5">
                        <Rocket className="h-4 w-4" />
                        立即启动
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        提交后立即进入外呼队列，非时间窗口内的号码将顺延至窗口内拨打。
                      </div>
                    </div>
                  </label>
                  <label
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      launch === "scheduled"
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/40",
                    )}
                  >
                    <RadioGroupItem value="scheduled" className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium flex items-center gap-1.5">
                        <CalendarClock className="h-4 w-4" />
                        定时启动
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 mb-2">
                        按指定时间自动启动任务。
                      </div>
                      <Input
                        type="datetime-local"
                        value={scheduledAt}
                        disabled={launch !== "scheduled"}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        className="max-w-xs"
                      />
                    </div>
                  </label>
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label>外呼策略（起量方式）</Label>
                <p className="text-xs text-muted-foreground -mt-1">
                  第 2 步已设定目标并发上限 {concurrency} 路，这里决定如何达到该上限。
                </p>
                <RadioGroup
                  value={pacing}
                  onValueChange={(v) => setPacing(v as Pacing)}
                  className="grid gap-2"
                >
                  <label
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      pacing === "ramp" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                    )}
                  >
                    <RadioGroupItem value="ramp" className="mt-1" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        灰度爬坡
                        <Badge variant="secondary" className="text-[11px]">
                          推荐
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        从较低并发起步逐步提升至上限（{concurrency} 路），降低线路风险、提升接通率。
                      </div>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">初始并发</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={1}
                              max={Number(concurrency)}
                              value={rampInit}
                              disabled={pacing !== "ramp"}
                              onChange={(e) => setRampInit(e.target.value)}
                              className="w-24"
                            />
                            <span className="text-sm text-muted-foreground">路</span>
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">爬坡节奏</Label>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">每</span>
                            <Input
                              type="number"
                              min={10}
                              step={10}
                              value={rampInterval}
                              disabled={pacing !== "ramp"}
                              onChange={(e) => setRampInterval(e.target.value)}
                              className="w-20"
                            />
                            <span className="text-sm text-muted-foreground">秒增加</span>
                            <Input
                              type="number"
                              min={1}
                              value={rampStep}
                              disabled={pacing !== "ramp"}
                              onChange={(e) => setRampStep(e.target.value)}
                              className="w-20"
                            />
                            <span className="text-sm text-muted-foreground">路</span>
                          </div>
                        </div>
                        {!rampValid && (
                          <p className="text-xs text-destructive sm:col-span-2">
                            初始并发需为 1 ~ {concurrency} 之间，爬坡步长与间隔需大于 0
                          </p>
                        )}
                      </div>
                    </div>
                  </label>

                  <label
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      pacing === "steady" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                    )}
                  >
                    <RadioGroupItem value="steady" className="mt-1" />
                    <div>
                      <div className="text-sm font-medium">恒定并发</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        启动即以 {concurrency} 路满并发拨打，起量最快，线路风险较高。
                      </div>
                    </div>
                  </label>

                  <label
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                      pacing === "random" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                    )}
                  >
                    <RadioGroupItem value="random" className="mt-1" />
                    <div>
                      <div className="text-sm font-medium">随机并发</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        在上限内随机浮动（约 50%~100%），拨打节奏更自然，规避号码风控。
                      </div>
                    </div>
                  </label>
                </RadioGroup>
              </div>

            </div>
          )}

        </div>

        <DialogFooter className="items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            共 <span className="text-foreground font-semibold tabular-nums">{list.length}</span>{" "}
            个目标号码
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                上一步
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button disabled={!canNext} onClick={() => setStep(step + 1)}>
                下一步
              </Button>
            ) : (
              <Button disabled={!step4Valid} onClick={submit}>
                启动
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
