import { useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  Sparkles,
  Loader2,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  ShieldAlert,
  MessageCircle,
  ServerCog,
  Info,
  Unlock,
  Phone,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import {
  myContext,
  type Recipient,
} from "@/lib/message-vars";
import {
  createReach,
  costForSocialPlatform,
  COST_VIEW_PHONE,
  COST_VIEW_SOCIAL,
  computeReachBreakdown,
  performReachAutoUnlocks,
  useLedger,
  type AutoUnlockField,
} from "@/lib/credits-ledger";
import { MaskedField } from "@/components/MaskedField";
import {
  useSocialAccounts,
  poolRemaining,
  poolCapacity,
  dispatchSend,
  type SocialPlatform,
} from "@/data/social-accounts";
import {
  useWaVerifyVersion,
  verifyMany,
  getWaStatus,
  normalizePhone,
  type WaStatus,
} from "@/lib/wa-verify";
import { useLeadProfile } from "@/lib/lead-profile";
import { useCurrentUser } from "@/lib/current-user";
import { ComposeFormatHint } from "@/components/outreach/ComposeFormatHint";
import { generateAiContent } from "@/lib/api/ai-compose.functions";
import { TargetLangSection } from "@/components/outreach/TargetLangSection";
import { useMyInfoGuard } from "@/lib/my-info-guard";


/** 目标候选人（收藏 → 社媒收件人） */
export interface SocialCandidate extends Recipient {
  /** 用于查库/校验的企业 id（联系人时也回填其所属企业 id） */
  enterpriseId?: string;
}

export interface BatchSocialDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  platform: SocialPlatform;
  candidates: SocialCandidate[];
}




export function BatchSocialDialog({
  open,
  onOpenChange,
  platform,
  candidates: incoming,
}: BatchSocialDialogProps) {
  const accounts = useSocialAccounts();
  useWaVerifyVersion(); // 订阅校验状态变化
  const profile = useLeadProfile();
  const user = useCurrentUser();
  const callGenerate = useServerFn(generateAiContent);
  const ledger = useLedger();
  const myInfo = useMyInfoGuard();


  const [allCandidates, setAllCandidates] = useState<SocialCandidate[]>(incoming);
  /** 被取消勾选（本次不发送）的目标 key，仅影响发送范围，不删除也不影响解锁状态 */
  const [excludedKeys, setExcludedKeys] = useState<Set<string>>(new Set());
  const candidates = useMemo(
    () => allCandidates.filter((c) => !excludedKeys.has(c.key)),
    [allCandidates, excludedKeys],
  );
  function toggleCandidate(key: string, checked: boolean) {
    setExcludedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  const [content, setContent] = useState("");
  const [aiUsed, setAiUsed] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  /** 目标语言（发送语言）代码 */
  const [targetLang, setTargetLang] = useState<string>("en");
  /** 目标语言译文（实际发送内容） */
  const [translated, setTranslated] = useState("");

  useEffect(() => {
    if (!open) return;
    setAllCandidates(incoming);
    setExcludedKeys(new Set());
    setContent("");
    setAiUsed(false);
    setTargetLang("en");
    setTranslated("");
    // 打开即自动校验（跳过已缓存）
    void verifyMany(
      incoming
        .filter((c) => c.address)
        .map((c) => ({ phone: c.address, enterpriseId: c.enterpriseId })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 按四桶分类
  type Bucket = "no_number" | "unchecked" | "checking" | "verified" | "unregistered";
  const bucketed = useMemo(() => {
    const groups: Record<Bucket, SocialCandidate[]> = {
      no_number: [],
      unchecked: [],
      checking: [],
      verified: [],
      unregistered: [],
    };
    for (const c of candidates) {
      if (!normalizePhone(c.address)) {
        groups.no_number.push(c);
        continue;
      }
      const s: WaStatus = getWaStatus(c.address);
      if (s === "verified") groups.verified.push(c);
      else if (s === "unregistered") groups.unregistered.push(c);
      else if (s === "checking") groups.checking.push(c);
      else groups.unchecked.push(c);
    }
    return groups;
  }, [candidates]);

  const verified = bucketed.verified;
  const totalCount = candidates.length;
  const validCount = verified.length;

  // 池信息
  const remaining = poolRemaining(accounts, platform);
  const capacity = poolCapacity(accounts, platform);
  const overLimit = validCount > remaining;
  const sendableCount = Math.min(validCount, remaining);

  // 费用
  const unit = costForSocialPlatform(platform);
  const sendTotal = sendableCount * unit;
  // 未解锁字段的自动查看费合计
  const viewCostTotal = useMemo(() => {
    let total = 0;
    for (const r of verified.slice(0, sendableCount)) {
      const bd = computeReachBreakdown(
        { targetKind: r.targetKind, targetId: r.targetId },
        "social",
        platform,
        { reachCostOverride: 0 },
      );
      total += bd.viewCost;
    }
    return total;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verified, sendableCount, platform, ledger]);

  /** 单条解锁单价 */
  const unitView = platform === "WhatsApp" ? COST_VIEW_PHONE : COST_VIEW_SOCIAL;
  const unlockFieldLabel = platform === "WhatsApp" ? "电话" : `${platform} 账号`;

  /** 尚未解锁明文的目标（用于批量解锁） */
  const lockedTargets = useMemo(
    () =>
      candidates.filter((c) => {
        if (!c.address) return false;
        const bd = computeReachBreakdown(
          { targetKind: c.targetKind, targetId: c.targetId },
          "social",
          platform,
          { reachCostOverride: 0 },
        );
        return bd.viewCost > 0;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [candidates, platform, ledger],
  );

  const [unlockAllOpen, setUnlockAllOpen] = useState(false);
  const [unlockAllAck, setUnlockAllAck] = useState(false);
  function unlockAll() {
    const targets = lockedTargets;
    const fields: AutoUnlockField[] =
      platform === "WhatsApp"
        ? [{ field: "phone" }]
        : [{ field: "social", subKey: platform }];
    targets.forEach((r) =>
      performReachAutoUnlocks({
        targetKind: r.targetKind,
        targetId: r.targetId,
        targetName: r.name,
        parentRef: r.parentRef,
        detail: r.address,
        fields,
      }),
    );
    setUnlockAllOpen(false);
    setUnlockAllAck(false);
    toast.success(`已解锁 ${targets.length} 位联系人的明文`, {
      description: `扣除 ${targets.length * unitView} 积分，永久有效`,
    });
  }

  const grandTotal = sendTotal + viewCostTotal;


  const contentRef = useRef<HTMLTextAreaElement | null>(null);

  /** 实际发送内容：有译文则发译文 */
  const sendContent = (translated.trim() || content).trim();

  const noPool = capacity === 0;
  const canSend =
    validCount > 0 &&
    remaining > 0 &&
    !overLimit &&
    sendContent.length > 0 &&
    !noPool;

  const disabledReason = !canSend
    ? noPool
      ? "暂无可用发送账号"
      : validCount === 0
        ? "请先添加有效发送目标"
        : !sendContent
          ? "请填写实际发送内容"
          : remaining <= 0
            ? "今日可发额度已用完"
            : "请补全必填项"
    : "";

  function handleRemoveNonVerified() {
    setAllCandidates((prev) =>
      prev.filter((c) => getWaStatus(c.address) === "verified"),
    );
  }
  function handleTrimToRemaining() {
    // 只在有效收件人里裁剪
    const keep = new Set(verified.slice(0, remaining).map((c) => c.key));
    setAllCandidates((prev) =>
      prev.filter(
        (c) => keep.has(c.key) || getWaStatus(c.address) !== "verified",
      ),
    );
  }
  function handleReverify() {
    void verifyMany(
      candidates
        .filter((c) => c.address)
        .map((c) => ({ phone: c.address, enterpriseId: c.enterpriseId })),
      { force: true },
    );
  }


  function handleSend() {
    if (!canSend) return;
    doSend();
  }

  function doSend() {
    if (!canSend) return;
    // 后台调度分派
    const dispatched = dispatchSend(platform, sendableCount);
    if (dispatched === 0) {
      toast.error("系统池今日额度已用尽，请明日再试");
      return;
    }
    let n = 0;
    for (const r of verified.slice(0, dispatched)) {
      const finalContent = sendContent;
      // 触达 WhatsApp 自动解锁电话；其他社媒解锁 social:platform
      const fields: AutoUnlockField[] =
        platform === "WhatsApp"
          ? [{ field: "phone" }]
          : [{ field: "social", subKey: platform }];
      performReachAutoUnlocks({
        targetKind: r.targetKind,
        targetId: r.targetId,
        targetName: r.name,
        parentRef: r.parentRef,
        detail: r.address,
        fields,
      });
      createReach({
        targetKind: r.targetKind,
        targetId: r.targetId,
        targetName: r.name,
        parentRef: r.parentRef,
        channel: "social",
        platform,
        detail: r.address,
        content: finalContent,
        aiGenerated: aiUsed,
        cost: unit,
      });
      n++;
    }
    onOpenChange(false);
    toast.success(`已加入触达队列：${n} 条 ${platform} 私信`, {
      description: `共扣除 ${grandTotal} 积分${
        viewCostTotal > 0 ? `（含自动解锁查看 ${viewCostTotal} 积分）` : ""
      }，可在「触达」模块查看进度`,
    });
  }

  async function handleAiGenerate() {
    if (aiLoading) return;
    if (!myInfo.ensure()) return;
    setAiLoading(true);
    try {
      const res = await callGenerate({
        data: {
          channel: "social",
          platform,
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
      toast.success(`AI 已生成 ${platform} 首次接触文案`, {
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
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            {`${platform} 系统自动触达`}
            <Badge variant="secondary" className="ml-1 font-normal">
              {totalCount <= 1
                ? `${validCount > 0 ? "可发送" : "校验中"}`
                : `选中 ${totalCount} · 有效 ${validCount}`}
            </Badge>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {platform} 私信触达
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* 覆盖率四桶 */}
          <section className="rounded-md border bg-muted/30 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">收件人覆盖率</Label>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1"
                  onClick={handleReverify}
                >
                  <RefreshCw className="h-3 w-3" />
                  重新校验
                </Button>
                {(bucketed.no_number.length > 0 || bucketed.unregistered.length > 0) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1"
                    onClick={handleRemoveNonVerified}
                  >
                    <X className="h-3 w-3" />
                    仅保留有效
                  </Button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <StatCell
                tone="emerald"
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                label="已注册"
                value={bucketed.verified.length}
              />
              <StatCell
                tone="rose"
                icon={<XCircle className="h-3.5 w-3.5" />}
                label="未注册"
                value={bucketed.unregistered.length}
              />
              <StatCell
                tone="amber"
                icon={
                  bucketed.checking.length > 0 ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Clock className="h-3.5 w-3.5" />
                  )
                }
                label="待校验"
                value={bucketed.checking.length + bucketed.unchecked.length}
              />
              <StatCell
                tone="slate"
                icon={<ShieldAlert className="h-3.5 w-3.5" />}
                label="无号码"
                value={bucketed.no_number.length}
              />
            </div>
          </section>

          {/* 执行账号（后台调度） */}
          <section className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <ServerCog className="h-3.5 w-3.5" /> 执行账号
            </Label>
            {noPool ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                暂无可用 {platform} 执行账号，请联系管理员开通。
              </div>
            ) : (
              <div
                className={cn(
                  "rounded-md border p-2 text-xs flex items-center justify-between gap-2",
                  overLimit
                    ? "border-rose-200 bg-rose-50 text-rose-700"
                    : "border-muted bg-muted/40 text-muted-foreground",
                )}
              >
                <span>
                  系统自动分派执行账号 · 今日池内剩余
                  <span className="font-medium mx-1">{remaining}</span>/{capacity} 条
                  {overLimit && (
                    <span className="ml-2">
                      有效收件人 {validCount} 条，超出 {validCount - remaining} 条
                    </span>
                  )}
                </span>
                {overLimit && remaining > 0 && (
                  <button
                    type="button"
                    onClick={handleTrimToRemaining}
                    className="shrink-0 rounded border border-rose-300 bg-white px-2 py-0.5 font-medium hover:bg-rose-100"
                  >
                    仅保留前 {remaining} 条
                  </button>
                )}
              </div>
            )}
          </section>

          {/* 目标号列表（脱敏） */}
          {allCandidates.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground">
                  目标账号（已选 {candidates.length}/{allCandidates.length}）
                  {lockedTargets.length > 0 && (
                    <span className="ml-1 text-muted-foreground/80">
                      · {lockedTargets.length} 位{unlockFieldLabel}未解锁，默认脱敏展示
                    </span>
                  )}
                </Label>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Info className="h-3 w-3" />
                    点击 👁 单条解锁 -{unitView} 积分；成功发送后自动解锁
                  </span>
                  {lockedTargets.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setUnlockAllAck(false);
                        setUnlockAllOpen(true);
                      }}
                    >
                      <Unlock className="h-3.5 w-3.5 mr-1" />
                      全部解锁 · -{lockedTargets.length * unitView}
                    </Button>
                  )}
                </div>
              </div>

              <div className="max-h-52 overflow-y-auto rounded-md border bg-background divide-y">
                {allCandidates.map((c) => {
                  const st = normalizePhone(c.address)
                    ? getWaStatus(c.address)
                    : "no_number";
                  const tone =
                    st === "verified"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : st === "unregistered"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : st === "checking"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-slate-200 bg-slate-50 text-slate-600";
                  return (
                    <div
                      key={c.key}
                      className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/40"
                    >
                      <Checkbox
                        checked={!excludedKeys.has(c.key)}
                        onCheckedChange={(v) => toggleCandidate(c.key, v === true)}
                      />
                      <span className="text-xs font-medium truncate max-w-[160px]">
                        {c.name}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]",
                          tone,
                        )}
                      >
                        <Phone className="h-3 w-3" />
                        {c.address ? (
                          <MaskedField
                            targetKind={c.targetKind}
                            targetId={c.targetId}
                            targetName={c.name}
                            parentRef={c.parentRef}
                            field="phone"
                            value={c.address}
                            mono
                          />
                        ) : (
                          <span className="font-mono">—</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>

            </section>
          )}

          {/* 撰写内容 */}
          <section className="space-y-3">
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
              <div className="flex items-center gap-2">
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
            </div>

            <ComposeFormatHint channel="social" platform={platform} />


            <div className="grid gap-0 lg:grid-cols-2 lg:divide-x rounded-md border overflow-hidden">
              <div className="space-y-2 p-3">
              <div className="flex h-8 items-center">
                <Label className="text-xs text-muted-foreground">中文原文</Label>
              </div>
                <Textarea
                  ref={contentRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={10}
                  maxLength={4096}
                  placeholder={`您好，我是××公司的×××，看到贵司在××方向的业务……`}
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
          </section>





          {/* 费用 */}
          <section className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                发送费用（{sendableCount} 条 × {unit} 积分）
              </span>
              <span className="font-medium">{sendTotal} 积分</span>
            </div>
            {viewCostTotal > 0 && (() => {
              const unitView =
                platform === "WhatsApp" ? COST_VIEW_PHONE : COST_VIEW_SOCIAL;
              const unlockCount = Math.round(viewCostTotal / unitView);
              const alreadyCount = sendableCount - unlockCount;
              const fieldLabel =
                platform === "WhatsApp" ? "电话" : `${platform} 账号`;
              return (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    自动解锁查看{fieldLabel}（{unlockCount} 位未解锁收件人 ×{" "}
                    {unitView} 积分
                    {alreadyCount > 0 ? `，另 ${alreadyCount} 位已解锁免费` : ""}
                    ，永久生效）
                  </span>
                  <span className="font-medium">{viewCostTotal} 积分</span>
                </div>
              );
            })()}
            <div className="flex justify-between border-t border-rose-200/70 pt-1">
              <span className="font-semibold text-rose-700">合计</span>
              <span className="font-semibold text-rose-700">
                {grandTotal} 积分
              </span>
            </div>
            {viewCostTotal > 0 && (
              <div className="text-[11px] text-rose-700/80 pt-0.5">
                触达完成后，对应{platform === "WhatsApp" ? "电话号码" : `${platform} 账号`}将永久解锁，后续查看/再次触达不再收取查看费。
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">{disabledReason}</div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleSend} disabled={!canSend} className="bg-primary">
              <Send className="h-4 w-4" />
              确认发送（-{grandTotal}）
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>


      {/* 全部解锁 · 二次确认 */}
      <Dialog open={unlockAllOpen} onOpenChange={setUnlockAllOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>解锁全部明文{unlockFieldLabel}</DialogTitle>
            <DialogDescription>
              将为 {lockedTargets.length} 位未解锁目标一次性解锁明文，扣除{" "}
              <span className="font-semibold text-rose-600">
                {lockedTargets.length * unitView}
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
            <span>我已知晓将立即扣除 {lockedTargets.length * unitView} 积分</span>
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

function StatCell({
  tone,
  icon,
  label,
  value,
}: {
  tone: "emerald" | "rose" | "amber" | "slate";
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  const cls = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
  }[tone];
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded border px-2 py-1.5",
        cls,
      )}
    >
      <span className="inline-flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}