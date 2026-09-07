import { useEffect, useMemo, useState } from "react";
import {
  Send,
  Sparkles,
  Loader2,
  ServerCog,
  Users,
  Info,
  Unlock,
  Eye,
  Trash2,
  Facebook,
  Music2,
  Check,
  Gauge,
} from "lucide-react";

import { useServerFn } from "@tanstack/react-start";
import { saveReachTaskConfig } from "@/lib/reach-task-config";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { type Recipient } from "@/lib/message-vars";
import {
  createReach,
  costForSocialPlatform,
  COST_VIEW_SOCIAL,
  computeReachBreakdown,
  performReachAutoUnlocks,
  useLedger,
} from "@/lib/credits-ledger";
import { Checkbox } from "@/components/ui/checkbox";
import { maskContact } from "@/lib/mask-contact";
import { useSocialAccounts, type SocialAccount } from "@/data/social-accounts";
import { useLeadProfile } from "@/lib/lead-profile";
import { useCurrentUser } from "@/lib/current-user";
import { ComposeFormatHint } from "@/components/outreach/ComposeFormatHint";
import { generateAiContent } from "@/lib/api/ai-compose.functions";
import { TargetLangSection } from "@/components/outreach/TargetLangSection";
import { useMyInfoGuard } from "@/lib/my-info-guard";
import { useConnectMap } from "@/lib/social-connect";

export type ReachPlatform = "Facebook" | "TikTok";
export const REACH_PLATFORMS: ReachPlatform[] = ["Facebook", "TikTok"];

/** 单日单账号私信上限 */
export const DAILY_PER_ACCOUNT = 5;

/** 执行节奏说明（私信仅保留标准档） */
const PACING_DESC = `标准 · 每账号 ${DAILY_PER_ACCOUNT} 条/天 · 超出部分自动顺延次日 09:00 执行`;

/** 社媒目标候选人（收藏 → 社媒收件人） */
export interface PlatformCandidate extends Recipient {
  enterpriseId?: string;
  /** 该目标在各平台上的社媒联系方式（handle），无则表示该平台不可触达 */
  handles: Partial<Record<ReachPlatform, string>>;
}

/** 账号当日已发送私信数 */
export function accountTouchesToday(a: SocialAccount): number {
  return a.dmSentToday ?? a.sentToday ?? 0;
}

/** 可用执行账号：状态正常（平台匹配） */
export function usableExecAccounts(
  list: SocialAccount[],
  platform: ReachPlatform | "all",
): SocialAccount[] {
  return list.filter(
    (a) =>
      a.status === "正常" &&
      (platform === "all" || a.platform === platform),
  );
}

export interface BatchSocialPlatformDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** 初始待触达目标列表（来自外部选择） */
  candidates: PlatformCandidate[];
  /** 当内部列表变动时同步给父组件 */
  onCandidatesChange?: (newList: PlatformCandidate[]) => void;
}

const STEPS = ["平台与对象", "撰写内容", "执行账号与节奏"];

export function BatchSocialPlatformDialog({
  open,
  onOpenChange,
  candidates: initialCandidates,
  onCandidatesChange,
}: BatchSocialPlatformDialogProps) {
  const accounts = useSocialAccounts();
  const profile = useLeadProfile();
  const user = useCurrentUser();
  const myInfo = useMyInfoGuard();
  const ledger = useLedger();
  const callGenerate = useServerFn(generateAiContent);

  const [step, setStep] = useState(0);
  const [content, setContent] = useState("");
  const [aiUsed, setAiUsed] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  /** 目标语言（发送语言）代码 */
  const [targetLang, setTargetLang] = useState<string>("en");
  /** 目标语言译文（实际发送内容） */
  const [translated, setTranslated] = useState("");

  // 内部维护的完整目标列表（含外部传入和手动添加的）
  const [internalCandidates, setInternalCandidates] = useState<PlatformCandidate[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newTarget, setNewTarget] = useState({ name: "", handle: "", platform: "Facebook" as ReachPlatform });

  // 执行账号分配方式
  const [assign, setAssign] = useState<"auto" | "manual">("auto");
  const [pickedAccounts, setPickedAccounts] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setContent("");
    setAiUsed(false);
    setTargetLang("en");
    setTranslated("");
    setInternalCandidates(initialCandidates);
    setRemovedJobKeys(new Set());
    setIsAdding(false);
    setAssign("auto");
    setPickedAccounts([]);
  }, [open, initialCandidates]);

  const allCandidates = internalCandidates;

  /** 当前平台筛选下的触达目标（单一账号级别，而不是企业级别） */
  type Job = {
    key: string; // 唯一标识：candidateKey-platform
    candidate: PlatformCandidate;
    platform: ReachPlatform;
    handle: string;
  };

  /** 关系状态：仅"已建立"（已通过好友 / 已关注）目标可私信 */
  const connectMap = useConnectMap();
  const isConnected = (platform: ReachPlatform, handle: string) => {
    const st = connectMap[`${platform}:${handle}`]?.state;
    return st === "accepted" || st === "following";
  };

  /** 展开出的全部账号任务（含未建立关系的，用于统计过滤数量） */
  const rawAccountJobs = useMemo<Job[]>(() => {
    const out: Job[] = [];
    for (const c of allCandidates) {
      for (const p of REACH_PLATFORMS) {
        if (c.handles[p]) {
          out.push({
            key: `${c.key}-${p}`,
            candidate: c,
            platform: p,
            handle: c.handles[p]!,
          });
        }
      }
    }
    return out;
  }, [allCandidates]);

  /** 将 candidates 展平为具体的账号任务列表（自动过滤未建立社媒关系的目标） */
  const allAccountJobs = useMemo<Job[]>(
    () =>
      rawAccountJobs.filter(
        (j) => j.candidate.targetId === "manual" || isConnected(j.platform, j.handle),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rawAccountJobs, connectMap],
  );

  /** 因未建立社媒关系被自动过滤的数量 */
  const notConnectedCount = rawAccountJobs.length - allAccountJobs.length;

  // 内部维护的已删除 Job Keys (针对单一账号的删除)
  const [removedJobKeys, setRemovedJobKeys] = useState<Set<string>>(new Set());

  // 实际参与执行的任务列表
  const filteredJobs = useMemo(() => {
    return allAccountJobs.filter((j) => !removedJobKeys.has(j.key));
  }, [allAccountJobs, removedJobKeys]);

  const jobs = filteredJobs;

  // ---- 执行账号池
  /** 任务涉及的平台集合 */
  const involvedPlatforms = useMemo(
    () => Array.from(new Set(jobs.map((j) => j.platform))),
    [jobs],
  );
  /** 可用执行账号（状态正常 + 平台匹配） */
  const pool = useMemo(
    () =>
      accounts.filter(
        (a) =>
          a.status === "正常" &&
          (involvedPlatforms.length === 0 ||
            involvedPlatforms.includes(a.platform as ReachPlatform)),
      ),
    [accounts, involvedPlatforms],
  );
  /** 实际执行账号：自动分配按剩余额度降序，手动指定按勾选 */
  const execAccounts = useMemo(
    () =>
      assign === "auto"
        ? [...pool].sort(
            (a, b) =>
              Math.max(0, DAILY_PER_ACCOUNT - accountTouchesToday(b)) -
              Math.max(0, DAILY_PER_ACCOUNT - accountTouchesToday(a)),
          )
        : pool.filter((a) => pickedAccounts.includes(a.id)),
    [assign, pool, pickedAccounts],
  );
  const capacity = useMemo(
    () =>
      execAccounts.reduce(
        (s, a) => s + Math.max(0, DAILY_PER_ACCOUNT - accountTouchesToday(a)),
        0,
      ),
    [execAccounts],
  );
  const estDays = capacity > 0 ? Math.max(1, Math.ceil(jobs.length / capacity)) : 0;

  const targetCount = jobs.length;
  /** 今日可执行条数，其余顺延次日 */
  const todayCount = Math.min(targetCount, capacity);
  const deferredCount = Math.max(0, targetCount - capacity);
  const overLimit = deferredCount > 0;

  // 费用：按目标数量全额扣除（含顺延次日执行的部分）
  const unit = costForSocialPlatform("Facebook");
  const sendTotal = targetCount * unit;

  /** 单条解锁单价 */
  const unitView = COST_VIEW_SOCIAL;
  /** 手动添加的目标由用户自行提供 handle，无需解锁 */
  const isManualJob = (j: Job) => j.candidate.targetId === "manual";
  /** 尚未解锁明文的任务 key 集合（含未勾选项，勾选状态不影响解锁状态） */
  const lockedJobKeys = useMemo(() => {
    const set = new Set<string>();
    for (const j of allAccountJobs) {
      if (isManualJob(j)) continue;
      const bd = computeReachBreakdown(
        { targetKind: j.candidate.targetKind, targetId: j.candidate.targetId },
        "social",
        j.platform,
        { reachCostOverride: 0 },
      );
      if (bd.viewCost > 0) set.add(j.key);
    }
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAccountJobs, ledger]);

  /** 仅统计已勾选（实际执行）的待解锁条数 */
  const viewCostTotal = jobs.filter((j) => lockedJobKeys.has(j.key)).length * unitView;

  function unlockJob(j: Job) {
    performReachAutoUnlocks({
      targetKind: j.candidate.targetKind,
      targetId: j.candidate.targetId,
      targetName: j.candidate.name,
      parentRef: j.candidate.parentRef,
      detail: j.handle,
      fields: [{ field: "social", subKey: j.platform }],
    });
    toast.success(`已解锁 ${j.candidate.name} 的 ${j.platform} 账号`, {
      description: `扣除 ${unitView} 积分，永久有效`,
    });
  }

  const [unlockAllOpen, setUnlockAllOpen] = useState(false);
  const [unlockAllAck, setUnlockAllAck] = useState(false);
  function unlockAll() {
    const targets = jobs.filter((j) => lockedJobKeys.has(j.key));
    targets.forEach((j) => {
      performReachAutoUnlocks({
        targetKind: j.candidate.targetKind,
        targetId: j.candidate.targetId,
        targetName: j.candidate.name,
        parentRef: j.candidate.parentRef,
        detail: j.handle,
        fields: [{ field: "social", subKey: j.platform }],
      });
    });
    setUnlockAllOpen(false);
    setUnlockAllAck(false);
    toast.success(`已解锁 ${targets.length} 个社媒账号明文`, {
      description: `扣除 ${targets.length * unitView} 积分，永久有效`,
    });
  }

  const grandTotal = sendTotal + viewCostTotal;

  /** 实际发送内容：有译文则发译文 */
  const sendContent = (translated.trim() || content).trim();

  const canSend = targetCount > 0 && sendContent.length > 0 && execAccounts.length > 0;

  const stepValid =
    step === 0
      ? targetCount > 0
      : step === 1
        ? sendContent.length > 0
        : execAccounts.length > 0;

  const footerHint =
    step === 0 && targetCount === 0
      ? "请先添加发送目标"
      : step === 1 && !sendContent
        ? "请填写实际发送内容"
        : step === 2 && execAccounts.length === 0
          ? "请先选择执行账号"
          : "";

  /** 次日 09:00 起继续执行 */
  function nextDayStart(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }

  function handleSend() {
    if (!canSend) return;
    doSend();
  }

  function doSend() {
    if (!canSend) return;
    const scheduled = nextDayStart();
    const taskName = `批量社媒私信 · ${filteredJobs.length}个账号`;
    let n = 0;
    jobs.forEach((job, i) => {
      const r = job.candidate;
      if (r.targetId !== "manual") {
        performReachAutoUnlocks({
          targetKind: r.targetKind,
          targetId: r.targetId,
          targetName: r.name,
          parentRef: r.parentRef,
          detail: job.handle,
          fields: [{ field: "social", subKey: job.platform }],
        });
      }
      createReach({
        targetKind: r.targetKind,
        targetId: r.targetId,
        targetName: r.name,
        parentRef: r.parentRef,
        channel: "social",
        platform: job.platform,
        detail: job.handle,
        subject: taskName, // 使用 subject 存储任务名称以便聚合
        content: sendContent,
        aiGenerated: aiUsed,
        cost: unit,
        userCreated: true,
        ...(i >= capacity ? { scheduledAt: scheduled } : {}),
      });
      n++;
    });
    saveReachTaskConfig({
      taskKey: `s:${taskName}:${jobs[0]?.platform ?? ""}`,
      type: "social_dm",
      platform: jobs[0]?.platform,
      action: "私信",
      targetCap: targetCount,
      targetSource: "「我的收藏」勾选目标",
      sendMode: "系统按账号额度自动排期发送",
      schedule:
        deferredCount > 0
          ? "当日额度用尽部分顺延次日 09:00 继续执行"
          : "创建后立即执行",
      sourceZh: content.trim(),
      targetLang,
      sendContent,
      aiGenerated: aiUsed,
      costPerTarget: unit,
    });
    onOpenChange(false);
    toast.success(`已加入触达队列：${n} 条社媒私信`, {
      description: `${
        deferredCount > 0
          ? `今日执行 ${todayCount} 条，剩余 ${deferredCount} 条将于明日 09:00 自动继续执行；`
          : ""
      }共扣除 ${grandTotal} 积分，可在「客户触达」模块查看进度`,
    });
  }

  function handleAddExtra() {
    if (!newTarget.name || !newTarget.handle) {
      toast.error("请填写完整信息");
      return;
    }
    const candidate: PlatformCandidate = {
      key: `extra-${Date.now()}-${Math.random()}`,
      name: newTarget.name,
      address: newTarget.handle,
      targetKind: "contact",
      targetId: "manual",
      handles: { [newTarget.platform]: newTarget.handle },
      ctx: {
        联系人名: newTarget.name,
        我的公司: profile.companyName,
        我的姓名: user.name,
      },
    };
    const newList = [...internalCandidates, candidate];
    setInternalCandidates(newList);
    onCandidatesChange?.(newList);
    setNewTarget({ ...newTarget, name: "", handle: "" });
    setIsAdding(false);
    toast.success("已手动添加触达目标");
  }

  /** 勾选 / 取消勾选某个目标账号 */
  function toggleJob(jobKey: string, checked: boolean) {
    setRemovedJobKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.delete(jobKey);
      else next.add(jobKey);
      return next;
    });
  }

  /** 删除手动添加的目标 */
  function removeManualCandidate(candidateKey: string) {
    const newList = internalCandidates.filter((c) => c.key !== candidateKey);
    setInternalCandidates(newList);
    onCandidatesChange?.(newList);
    toast.success("已删除手动添加的目标");
  }

  async function handleAiGenerate() {
    if (aiLoading) return;
    if (!myInfo.ensure()) return;
    setAiLoading(true);
    try {
      const res = await callGenerate({
        data: {
          channel: "social",
          platform: "Facebook",
          scene: "开发信",
          tone: "friendly",
          language: "zh",
          languageName: "中文",
          myCompany: profile.companyName,
          myName: user.name,
          literal: true,
        },
      });
      if (res.content)
        setContent(myInfo.fillAll(res.content));
      setAiUsed(true);
      toast.success("AI 已生成社媒首次接触文案", {
        description: "文案基于我方企业与产品信息生成，全部目标发送同一内容",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("AI 生成失败", { description: msg });
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            批量社媒私信
            <Badge variant="secondary" className="ml-1 font-normal">
              待执行 {jobs.length}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs">
            仅向"已建立社媒关系"（好友已通过 / 已关注）的目标发送私信，未建立关系的目标已自动过滤；超出当日额度的部分自动顺延至次日。
          </DialogDescription>
        </DialogHeader>

        {/* 步骤条 */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
                  i === step
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : i < step
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "text-muted-foreground",
                )}
              >
                <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px]">
                  {i < step ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                {s}
              </div>
              {i < STEPS.length - 1 && <div className="h-px w-6 bg-border" />}
            </div>
          ))}
        </div>

        {/* Step 1：平台与对象 */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Label className="text-xs font-medium">待执行目标</Label>
              {REACH_PLATFORMS.map((p) => {
                const count = allAccountJobs.filter((j) => j.platform === p).length;
                if (count === 0) return null;
                return (
                  <span
                    key={p}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs",
                      p === "Facebook"
                        ? "border-sky-200 bg-sky-50 text-sky-700"
                        : "border-violet-200 bg-violet-50 text-violet-700",
                    )}
                  >
                    {p === "Facebook" ? (
                      <Facebook className="h-3.5 w-3.5" />
                    ) : (
                      <Music2 className="h-3.5 w-3.5" />
                    )}
                    {p} · {count}
                  </span>
                );
              })}
              <div className="ml-auto flex items-center gap-2">
                {lockedJobKeys.size > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-[11px]"
                    onClick={() => {
                      setUnlockAllAck(false);
                      setUnlockAllOpen(true);
                    }}
                  >
                    <Unlock className="h-3.5 w-3.5" />
                    批量解锁（{lockedJobKeys.size} 条 · {lockedJobKeys.size * unitView} 积分）
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px] text-primary"
                  onClick={() => setIsAdding(!isAdding)}
                >
                  {isAdding ? "取消添加" : "手动添加目标"}
                </Button>
              </div>
            </div>

            {isAdding && (
              <div className="grid grid-cols-4 gap-2 rounded-md border bg-muted/30 p-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">人名/企业名</Label>
                  <Input
                    className="h-7 text-xs"
                    placeholder="例如: John Doe"
                    value={newTarget.name}
                    onChange={(e) => setNewTarget({ ...newTarget, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">平台</Label>
                  <Select
                    value={newTarget.platform}
                    onValueChange={(v) => setNewTarget({ ...newTarget, platform: v as ReachPlatform })}
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Facebook">Facebook</SelectItem>
                      <SelectItem value="TikTok">TikTok</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">账号/主页链接</Label>
                  <Input
                    className="h-7 text-xs"
                    placeholder="handle 或 URL"
                    value={newTarget.handle}
                    onChange={(e) => setNewTarget({ ...newTarget, handle: e.target.value })}
                  />
                </div>
                <div className="flex items-end">
                  <Button size="sm" className="h-7 w-full text-xs" onClick={handleAddExtra}>
                    添加
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-md border divide-y max-h-[320px] overflow-y-auto">
              {allAccountJobs.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  暂无可私信目标：仅"已建立社媒关系"的目标可发送私信，请先在「批量社媒加好友 / 关注」中建立关系，或手动添加目标。
                </div>
              ) : (
                allAccountJobs.map((j) => {
                  const checked = !removedJobKeys.has(j.key);
                  const isManual = j.candidate.key.startsWith("extra-");
                  const locked = lockedJobKeys.has(j.key);
                  return (
                    <div
                      key={j.key}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggleJob(j.key, v === true)}
                      />
                      <span className="font-medium truncate max-w-[150px]">
                        {j.candidate.name}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]",
                          j.platform === "Facebook"
                            ? "border-sky-200 bg-sky-50 text-sky-700"
                            : "border-violet-200 bg-violet-50 text-violet-700",
                        )}
                      >
                        {j.platform === "Facebook" ? (
                          <Facebook className="h-3 w-3" />
                        ) : (
                          <Music2 className="h-3 w-3" />
                        )}
                        {j.platform}: @{locked ? maskContact("social", j.handle) : j.handle}
                      </span>
                      {isManual && (
                        <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                          手动添加
                        </Badge>
                      )}
                      <div className="ml-auto flex items-center gap-1">
                        {locked && (
                          <button
                            type="button"
                            onClick={() => unlockJob(j)}
                            className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10"
                            title={`解锁明文，扣 ${unitView} 积分（永久有效）`}
                          >
                            <Eye className="h-3 w-3" />
                            {unitView}
                          </button>
                        )}
                        {isManual && (
                          <button
                            type="button"
                            onClick={() => removeManualCandidate(j.candidate.key)}
                            className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="删除该手动添加的目标"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="text-[11px] text-muted-foreground">
              待执行 <b className="text-foreground">{jobs.length}</b> 条
              {notConnectedCount > 0 && (
                <>
                  · 已自动过滤 <b className="text-foreground">{notConnectedCount}</b> 个未建立社媒关系的目标
                </>
              )}
              {lockedJobKeys.size > 0 && (
                <>
                  · <b className="text-foreground">{lockedJobKeys.size}</b> 个账号未解锁，默认脱敏展示，发送后自动解锁
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 2：撰写内容 */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-2">
                撰写内容
                {aiUsed && (
                  <Badge
                    variant="secondary"
                    className="gap-1 bg-amber-100 text-amber-800"
                  >
                    <Sparkles className="h-3 w-3" />
                    AI 已生成 · 可手动调整
                  </Badge>
                )}
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={aiLoading}
                onClick={() => handleAiGenerate()}
                className="h-7 gap-1"
              >
                {aiLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                )}
                {aiLoading ? "生成中…" : aiUsed ? "AI 重新生成" : "AI 生成文案"}
              </Button>
            </div>

            <ComposeFormatHint
              channel="social"
              platform="Facebook"
            />

            <div className="grid gap-0 lg:grid-cols-2 lg:divide-x rounded-md border overflow-hidden">
              <div className="space-y-2 p-3">
                <div className="flex h-8 items-center">
                  <Label className="text-xs text-muted-foreground">中文原文</Label>
                </div>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={10}
                  maxLength={4096}
                  placeholder={`您好，我是××公司的×××，我们主要提供……`}
                />
                <div className="text-[11px] text-muted-foreground">
                  {content.length} / 4096 字
                </div>
              </div>

              {/* 目标语言文案（实际发送内容） */}
              <TargetLangSection
                source={content}
                lang={targetLang}
                onLangChange={setTargetLang}
                value={translated}
                onChange={setTranslated}
                rows={10}
                kindLabel="私信"
                bare
              />
            </div>
          </div>
        )}

        {/* Step 3：执行账号与节奏 */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs font-medium">执行账号</Label>
              <div className="flex items-center gap-2">
                <Select value={assign} onValueChange={(v) => setAssign(v as "auto" | "manual")}>
                  <SelectTrigger className="h-8 w-[180px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">自动分配</SelectItem>
                    <SelectItem value="manual">手动指定</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-[11px] text-muted-foreground">
                  自动分配优先使用今日剩余额度多、状态正常的账号；风控 / 被封 / 养号中的账号已自动移出执行池
                </span>
              </div>
              <div className="rounded-md border divide-y max-h-[200px] overflow-y-auto">
                {pool.length === 0 ? (
                  <div className="p-4 text-center text-xs text-amber-700 bg-amber-50">
                    暂无可用执行账号，请前往「我的账号」补充或恢复账号后再试。
                  </div>
                ) : (
                  pool.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                      {assign === "manual" ? (
                        <Checkbox
                          checked={pickedAccounts.includes(a.id)}
                          onCheckedChange={(v) =>
                            setPickedAccounts((prev) =>
                              v === true
                                ? [...prev, a.id]
                                : prev.filter((x) => x !== a.id),
                            )
                          }
                        />
                      ) : (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      )}
                      <span className="font-medium">{a.displayName}</span>
                      <span className="text-muted-foreground">{a.handle}</span>
                      <Badge variant="outline" className="h-4 px-1 text-[10px]">
                        {a.platform}
                      </Badge>
                      <Badge variant="outline" className="h-4 px-1 text-[10px]">
                        {a.status}
                      </Badge>
                      <span className="ml-auto text-[11px] text-muted-foreground">
                        今日剩余 {Math.max(0, DAILY_PER_ACCOUNT - accountTouchesToday(a))} 条
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5" />
                执行节奏
              </Label>
              <div className="rounded-md border border-primary bg-primary/5 p-2.5 text-left text-xs ring-1 ring-primary/30">
                <div className="font-medium">标准</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {PACING_DESC}
                </div>
              </div>
            </div>

            <div
              className={cn(
                "flex h-9 items-center justify-between rounded-md border px-3 text-xs",
                execAccounts.length === 0
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "bg-muted/40 text-muted-foreground",
              )}
            >
              <span className="flex items-center gap-1">
                <ServerCog className="h-3.5 w-3.5" />
                执行账号
                <b className="text-foreground mx-0.5">{execAccounts.length}</b> 个 · 今日可执行
                <b className="text-foreground mx-0.5">{capacity}</b> 条
              </span>
              <span className="text-[11px]">
                预计 {estDays || "—"} 天完成 {targetCount} 条
              </span>
            </div>

            {overLimit && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 flex items-start gap-1.5">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  目标 {targetCount} 条超出今日可触达额度：系统今日先执行{" "}
                  <b>{todayCount}</b> 条，剩余 <b>{deferredCount}</b>{" "}
                  条将自动顺延至<b>明日 09:00</b>继续执行，无需重复提交；积分按目标总数
                  {targetCount} 条一次性扣除。
                </span>
              </div>
            )}

            <section className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  发送费用（{targetCount} 条 × {unit} 积分）
                </span>
                <span className="font-medium">{sendTotal} 积分</span>
              </div>
              {deferredCount > 0 && (
                <div className="text-[11px] text-amber-700">
                  其中 {deferredCount} 条顺延至明日 09:00 执行
                </div>
              )}
              {viewCostTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    发送后解锁社媒账号（{lockedJobKeys.size} 个未解锁 × {unitView} 积分，永久生效）
                  </span>
                  <span className="font-medium">{viewCostTotal} 积分</span>
                </div>
              )}
              <div className="flex justify-between border-t border-rose-200/70 pt-1">
                <span className="font-semibold text-rose-700">合计</span>
                <span className="font-semibold text-rose-700">{grandTotal} 积分</span>
              </div>
              {viewCostTotal > 0 && (
                <div className="text-[11px] text-rose-700/80 pt-0.5">
                  触达完成后，对应社媒账号将永久解锁，后续查看/再次触达不再收取查看费。
                </div>
              )}
            </section>
          </div>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">{footerHint}</div>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                上一步
              </Button>
            )}
            {step < 2 ? (
              <Button disabled={!stepValid} onClick={() => setStep((s) => s + 1)}>
                下一步
              </Button>
            ) : (
              <Button onClick={handleSend} disabled={!canSend} className="bg-primary">
                <Send className="h-4 w-4" />
                确认发送（-{grandTotal}）
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>

      {/* 全部解锁 · 二次确认 */}
      <Dialog open={unlockAllOpen} onOpenChange={setUnlockAllOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>解锁全部明文社媒账号</DialogTitle>
            <DialogDescription>
              将为 {lockedJobKeys.size} 个未解锁账号一次性解锁明文，扣除{" "}
              <span className="font-semibold text-rose-600">
                {lockedJobKeys.size * unitView}
              </span>{" "}
              积分，解锁后永久有效、不可撤销。批量群发本身无需解锁即可发送。
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={unlockAllAck}
              onCheckedChange={(v) => setUnlockAllAck(v === true)}
              className="mt-0.5"
            />
            <span>我已知晓将立即扣除 {lockedJobKeys.size * unitView} 积分</span>
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockAllOpen(false)}>
              取消
            </Button>
            <Button disabled={!unlockAllAck} onClick={unlockAll}>
              <Unlock className="h-4 w-4" />
              确认解锁
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
