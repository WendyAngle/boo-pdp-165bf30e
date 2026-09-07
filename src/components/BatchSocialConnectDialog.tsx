import { useEffect, useMemo, useState } from "react";
import {
  UserPlus,
  ServerCog,
  Info,
  Unlock,
  Eye,
  Facebook,
  Music2,
  Check,
  Gauge,
  ShieldAlert,
  Trash2,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { maskContact } from "@/lib/mask-contact";
import {
  COST_VIEW_SOCIAL,
  COST_SOCIAL_ADD_FRIEND,
  chargeSocialAddFriend,
  computeReachBreakdown,
  performReachAutoUnlocks,
  useLedger,
} from "@/lib/credits-ledger";
import { useSocialAccounts } from "@/data/social-accounts";
import { addProspectingTask } from "@/lib/social-tasks";
import {
  ACTION_LABEL,
  CONNECT_PLATFORMS,
  LABEL_TONE,
  actionOf,
  blockedReason,
  connectStateOf,
  markRequested,
  recordId,
  simulateProgress,
  stateLabel,
  useConnectMap,
  type ConnectPlatform,
  type SocialIdentity,
} from "@/lib/social-connect";

export interface ConnectCandidate {
  /** 收藏记录 id */
  favoriteId: string;
  name: string;
  enterpriseName?: string;
  targetKind: "enterprise" | "contact";
  targetId: string;
  parentRef?: { id: string; name: string };
  identities: SocialIdentity[];
}

type Pacing = "normal";
const PACING_META: Record<Pacing, { label: string; perDay: number; desc: string }> = {
  normal: { label: "标准", perDay: 5, desc: "每账号 5 条/天 · 超出部分自动顺延次日 09:00 执行" },
};

const STEPS = ["平台与对象", "动作设置", "执行账号与节奏"];

export function BatchSocialConnectDialog({
  open,
  onOpenChange,
  candidates,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  candidates: ConnectCandidate[];
}) {
  const accounts = useSocialAccounts();
  const connectMap = useConnectMap();
  const ledger = useLedger();

  const [step, setStep] = useState(0);
  const [platforms, setPlatforms] = useState<ConnectPlatform[]>(["Facebook", "TikTok"]);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState<SocialIdentity[]>([]);
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({
    name: "",
    handle: "",
    platform: "Facebook" as ConnectPlatform,
  });
  const [includePages, setIncludePages] = useState(true);
  const [warmup, setWarmup] = useState(false);
  const pacing: Pacing = "normal";
  const [assign, setAssign] = useState<"auto" | "manual">("auto");
  const [pickedAccounts, setPickedAccounts] = useState<string[]>([]);
  const [unlockAllOpen, setUnlockAllOpen] = useState(false);
  const [unlockAllAck, setUnlockAllAck] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setPlatforms(["Facebook", "TikTok"]);
    setExcluded(new Set());
    setManual([]);
    setAdding(false);
    setIncludePages(true);
    setWarmup(false);
    setAssign("auto");
    setPickedAccounts([]);
  }, [open]);

  type Row = {
    key: string;
    candidate: ConnectCandidate;
    identity: SocialIdentity;
    manual: boolean;
  };

  /** 展平为「对象 × 平台身份」行 */
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const c of candidates) {
      for (const id of c.identities) out.push({ key: id.key, candidate: c, identity: id, manual: false });
    }
    for (const id of manual) {
      out.push({
        key: id.key,
        manual: true,
        identity: id,
        candidate: {
          favoriteId: id.favoriteId,
          name: id.handle.replace(/^@/, ""),
          targetKind: "contact",
          targetId: "manual",
          identities: [id],
        },
      });
    }
    return out;
  }, [candidates, manual]);

  const visibleRows = useMemo(
    () => rows.filter((r) => platforms.includes(r.identity.platform)),
    [rows, platforms],
  );

  /** 每行的执行判定 */
  type Judged = Row & {
    action: ReturnType<typeof actionOf>;
    blocked: string | null;
    locked: boolean;
    label: ReturnType<typeof stateLabel>;
  };
  const judged = useMemo<Judged[]>(() => {
    return visibleRows.map((r) => {
      const rec = connectMap[recordId(r.identity.platform, r.identity.handle)];
      const action = actionOf(r.identity.platform, r.identity.accountType);
      let blocked = blockedReason(rec);
      
      if (!blocked && action === "follow" && r.identity.accountType === "page" && !includePages)
        blocked = "已关闭主页关注";
      let locked = false;
      if (!r.manual) {
        const bd = computeReachBreakdown(
          { targetKind: r.candidate.targetKind, targetId: r.candidate.targetId },
          "social",
          r.identity.platform,
          { reachCostOverride: 0 },
        );
        locked = bd.viewCost > 0;
      }
      return {
        ...r,
        action,
        blocked,
        locked,
        label: stateLabel(connectStateOf(connectMap, r.identity.platform, r.identity.handle)),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleRows, connectMap, includePages, ledger]);

  /** 平台与对象列表：自动过滤掉已建立关系的数据（参考批量邮件过滤无邮箱） */
  const finalRows = useMemo(
    () => judged.filter((r) => r.label !== "已建立"),
    [judged],
  );
  const establishedFiltered = judged.length - finalRows.length;

  const executable = useMemo(
    () => finalRows.filter((r) => !r.blocked && !excluded.has(r.key)),
    [finalRows, excluded],
  );
  const skipped = finalRows.length - executable.length;

  const lockedRows = useMemo(() => executable.filter((r) => r.locked), [executable]);
  const unlockCost = lockedRows.length * COST_VIEW_SOCIAL;
  const connectCost = executable.length * COST_SOCIAL_ADD_FRIEND;
  const grandTotal = connectCost + unlockCost;

  // ---- 账号池
  const poolAll = useMemo(
    () => accounts.filter((a) => a.platform === "Facebook" || a.platform === "TikTok"),
    [accounts],
  );
  const pool = useMemo(
    () =>
      poolAll.filter(
        (a) =>
          a.status === "正常" &&
          platforms.includes(a.platform as ConnectPlatform),
      ),
    [poolAll, platforms],
  );
  const execAccounts = useMemo(
    () =>
      assign === "auto"
        ? [...pool].sort(
            (a, b) =>
              Math.max(0, (b.dailyFriendLimit ?? 5) - (b.friendSentToday ?? 0)) -
              Math.max(0, (a.dailyFriendLimit ?? 5) - (a.friendSentToday ?? 0)),
          )
        : pool.filter((a) => pickedAccounts.includes(a.id)),
    [assign, pool, pickedAccounts],
  );

  /** 生效日额度 = min(节奏档位, 账号 dailyFriendLimit) - 今日已用 */
  const dailyCapacity = useMemo(
    () =>
      execAccounts.reduce((s, a) => {
        const limit = Math.min(PACING_META[pacing].perDay, a.dailyFriendLimit ?? 5);
        return s + Math.max(0, limit - (a.friendSentToday ?? 0));
      }, 0),
    [execAccounts, pacing],
  );
  const clamped = execAccounts.some(
    (a) => (a.dailyFriendLimit ?? 5) < PACING_META[pacing].perDay,
  );
  const estDays =
    dailyCapacity > 0 ? Math.max(1, Math.ceil(executable.length / dailyCapacity)) : 0;

  // ---- 解锁
  function unlockRow(r: Judged) {
    performReachAutoUnlocks({
      targetKind: r.candidate.targetKind,
      targetId: r.candidate.targetId,
      targetName: r.candidate.name,
      parentRef: r.candidate.parentRef,
      detail: r.identity.handle,
      fields: [{ field: "social", subKey: r.identity.platform }],
    });
    toast.success(`已解锁 ${r.candidate.name} 的 ${r.identity.platform} 账号`, {
      description: `扣除 ${COST_VIEW_SOCIAL} 积分，永久有效`,
    });
  }
  function unlockAll() {
    lockedRows.forEach(unlockRow);
    setUnlockAllOpen(false);
    setUnlockAllAck(false);
  }

  function submit() {
    if (executable.length === 0) return;
    const platform = executable[0]!.identity.platform;
    const taskName = `批量社媒加好友 · ${executable.length} 个目标`;
    const task = addProspectingTask({
      name: taskName,
      platform: Array.from(new Set(executable.map((r) => r.identity.platform))),
      targetKinds: ["user", "enterprise"],
      keywords: [],
      targetCap: executable.length,
      accountIds: execAccounts.map((a) => a.id),
      frozenCredits: connectCost,
      source: "收藏中心",
      action: "connect",
      pacing,
      targets: executable.map((r, i) => ({
        id: `ct_${i}_${r.identity.platform}`,
        name: r.candidate.name,
        handle: r.identity.handle,
        kind: r.candidate.targetKind === "enterprise" ? "enterprise" : "user",
        status: "requested" as const,
        requestedAt: new Date().toISOString(),
      })),
    });

    executable.forEach((r) => {
      if (!r.manual) {
        performReachAutoUnlocks({
          targetKind: r.candidate.targetKind,
          targetId: r.candidate.targetId,
          targetName: r.candidate.name,
          parentRef: r.candidate.parentRef,
          detail: r.identity.handle,
          fields: [{ field: "social", subKey: r.identity.platform }],
        });
      }
      chargeSocialAddFriend({
        platform: r.identity.platform,
        targetName: r.candidate.name,
        detail: `${r.identity.platform} ${ACTION_LABEL[r.action]} · ${r.identity.handle}`,
        taskId: task.id,
      });
    });

    markRequested(
      executable.map((r) => ({
        favoriteId: r.candidate.favoriteId,
        platform: r.identity.platform,
        handle: r.identity.handle,
        name: r.candidate.name,
        action: r.action,
      })),
      task.id,
    );
    simulateProgress(
      executable.map((r) => recordId(r.identity.platform, r.identity.handle)),
    );

    onOpenChange(false);
    toast.success(`已创建关系任务：${executable.length} 个目标`, {
      description: `${platform} 等平台按${PACING_META[pacing].label}节奏执行，预计 ${estDays || 1} 天完成；共扣除 ${grandTotal} 积分，可在「触达任务」查看进度`,
    });
  }

  const stepValid =
    step === 0 ? executable.length > 0 : step === 1 ? true : execAccounts.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            批量社媒加好友 / 关注
            <Badge variant="secondary" className="ml-1 font-normal">
              可执行 {executable.length}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs">
            先建立关系再发私信，送达率更高、账号更安全。Facebook 个人号走「加好友」，主页与 TikTok 走「关注」。
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

        {/* Step 1 */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Label className="text-xs font-medium">平台</Label>
              {CONNECT_PLATFORMS.map((p) => {
                const on = platforms.includes(p);
                const count = finalRows.filter((r) => r.identity.platform === p).length;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() =>
                      setPlatforms((prev) =>
                        prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
                      )
                    }
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs",
                      on
                        ? p === "Facebook"
                          ? "border-sky-200 bg-sky-50 text-sky-700"
                          : "border-violet-200 bg-violet-50 text-violet-700"
                        : "text-muted-foreground",
                    )}
                  >
                    {p === "Facebook" ? (
                      <Facebook className="h-3.5 w-3.5" />
                    ) : (
                      <Music2 className="h-3.5 w-3.5" />
                    )}
                    {p} · {count}
                  </button>
                );
              })}
              <div className="ml-auto flex items-center gap-2">
                {lockedRows.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-[11px]"
                    onClick={() => setUnlockAllOpen(true)}
                  >
                    <Unlock className="h-3.5 w-3.5" />
                    批量解锁（{lockedRows.length} 条 · {unlockCost} 积分）
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px] text-primary"
                  onClick={() => setAdding((v) => !v)}
                >
                  {adding ? "取消添加" : "手动添加目标"}
                </Button>
              </div>
            </div>

            {adding && (
              <div className="grid grid-cols-4 gap-2 rounded-md border bg-muted/30 p-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">名称</Label>
                  <Input
                    className="h-7 text-xs"
                    value={newItem.name}
                    placeholder="例如: John Doe"
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">平台</Label>
                  <Select
                    value={newItem.platform}
                    onValueChange={(v) =>
                      setNewItem({ ...newItem, platform: v as ConnectPlatform })
                    }
                  >
                    <SelectTrigger className="h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONNECT_PLATFORMS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">账号 handle</Label>
                  <Input
                    className="h-7 text-xs"
                    value={newItem.handle}
                    placeholder="@handle"
                    onChange={(e) => setNewItem({ ...newItem, handle: e.target.value })}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    size="sm"
                    className="h-7 w-full text-xs"
                    onClick={() => {
                      if (!newItem.name || !newItem.handle) {
                        toast.error("请填写完整信息");
                        return;
                      }
                      const handle = newItem.handle.startsWith("@")
                        ? newItem.handle
                        : `@${newItem.handle}`;
                      setManual((prev) => [
                        ...prev,
                        {
                          key: `manual-${Date.now()}-${Math.random()}`,
                          favoriteId: "manual",
                          platform: newItem.platform,
                          handle,
                          accountType: "personal",
                          confidence: "high",
                          source: "用户手填",
                        },
                      ]);
                      setNewItem({ ...newItem, name: "", handle: "" });
                      setAdding(false);
                      toast.success("已手动添加目标");
                    }}
                  >
                    添加
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-md border divide-y max-h-[320px] overflow-y-auto">
              {finalRows.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">
                  所选对象暂无该平台社媒身份，可先在企业详情「更新企业数据」补全，或手动添加目标。
                </div>
              ) : (
                finalRows.map((r) => {
                  const checked = !r.blocked && !excluded.has(r.key);
                  
                  return (
                    <div
                      key={r.key}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted/40",
                        r.blocked && "bg-muted/20",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={!!r.blocked}
                        onCheckedChange={(v) =>
                          setExcluded((prev) => {
                            const next = new Set(prev);
                            if (v === true) next.delete(r.key);
                            else next.add(r.key);
                            return next;
                          })
                        }
                      />
                      <span className="font-medium truncate max-w-[150px]">
                        {r.candidate.name}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]",
                          r.identity.platform === "Facebook"
                            ? "border-sky-200 bg-sky-50 text-sky-700"
                            : "border-violet-200 bg-violet-50 text-violet-700",
                        )}
                      >
                        {r.identity.platform === "Facebook" ? (
                          <Facebook className="h-3 w-3" />
                        ) : (
                          <Music2 className="h-3 w-3" />
                        )}
                        {r.locked
                          ? maskContact("social", r.identity.handle)
                          : r.identity.handle}
                      </span>
                      <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                        {r.identity.accountType === "page" ? "主页" : "个人号"}
                      </Badge>


                      {r.label !== "未建立" && (
                        <Badge
                          variant="outline"
                          className={cn("h-4 px-1 text-[10px]", LABEL_TONE[r.label])}
                        >
                          {r.label}
                        </Badge>
                      )}
                      <span className="text-[11px] text-muted-foreground">
                        {ACTION_LABEL[r.action]}
                      </span>
                      <div className="ml-auto flex items-center gap-1.5">
                        {r.blocked && (
                          <span className="text-[11px] text-muted-foreground">
                            {r.blocked}
                          </span>
                        )}


                        {r.locked && !r.blocked && (
                          <button
                            type="button"
                            onClick={() => unlockRow(r)}
                            className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10"
                            title={`解锁明文，扣 ${COST_VIEW_SOCIAL} 积分（永久有效）`}
                          >
                            <Eye className="h-3 w-3" />
                            {COST_VIEW_SOCIAL}
                          </button>
                        )}
                        {r.manual && (
                          <button
                            type="button"
                            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() =>
                              setManual((prev) => prev.filter((m) => m.key !== r.key))
                            }
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
              可执行 <b className="text-foreground">{executable.length}</b> 条
              {establishedFiltered > 0 && (
                <>
                  · 已自动过滤 <b className="text-foreground">{establishedFiltered}</b> 条已建立关系
                </>
              )}
              {skipped > 0 && (
                <>
                  · 已跳过 <b className="text-foreground">{skipped}</b> 条（请求中 / 冷却期）
                </>
              )}
            </div>

          </div>
        )}

        {/* Step 2 */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <Facebook className="h-3.5 w-3.5 text-sky-600" />
                  Facebook
                </div>
                <div className="text-[11px] text-muted-foreground">
                  个人号 {executable.filter((r) => r.identity.platform === "Facebook" && r.action === "friend").length} 个 → 加好友；
                  主页 {finalRows.filter((r) => r.identity.platform === "Facebook" && r.identity.accountType === "page").length} 个 → 关注
                </div>
                <label className="flex items-center justify-between text-[11px]">
                  <span>主页对象执行关注</span>
                  <Switch checked={includePages} onCheckedChange={setIncludePages} />
                </label>
              </div>
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <Music2 className="h-3.5 w-3.5 text-violet-600" />
                  TikTok
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {executable.filter((r) => r.identity.platform === "TikTok").length} 个 → 关注（单向，无需对方同意）
                </div>
                <label className="flex items-center justify-between text-[11px]">
                  <span>关注后点赞对方最近 1 条内容（预热）</span>
                  <Switch checked={warmup} onCheckedChange={setWarmup} />
                </label>
              </div>
            </div>

          </div>
        )}

        {/* Step 3 */}
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
                  pool.map((a) => {
                    
                    const limit = Math.min(PACING_META[pacing].perDay, a.dailyFriendLimit ?? 5);
                    return (
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
                          今日剩余 {Math.max(0, limit - (a.friendSentToday ?? 0))} 条
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Gauge className="h-3.5 w-3.5" />
                执行节奏
              </Label>
              <div className="rounded-md border border-primary bg-primary/5 p-2.5 text-left text-xs ring-1 ring-primary/30">
                <div className="font-medium">{PACING_META[pacing].label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {PACING_META[pacing].desc}
                </div>
              </div>
              {clamped && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800 flex items-start gap-1.5">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    部分账号的每日加友额度低于所选节奏，系统按账号额度执行；如需提速请在「我的账号」调整单账号额度。
                  </span>
                </div>
              )}
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
                <b className="text-foreground mx-0.5">{dailyCapacity}</b> 条
              </span>
              <span className="text-[11px]">
                预计 {estDays || "—"} 天完成 {executable.length} 条
              </span>
            </div>

            <section className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  关系建立（{executable.length} 条 × {COST_SOCIAL_ADD_FRIEND} 积分，创建时冻结）
                </span>
                <span className="font-medium">{connectCost} 积分</span>
              </div>
              {unlockCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    解锁社媒账号（{lockedRows.length} 个 × {COST_VIEW_SOCIAL} 积分，永久生效）
                  </span>
                  <span className="font-medium">{unlockCost} 积分</span>
                </div>
              )}
              <div className="flex justify-between border-t border-rose-200/70 pt-1">
                <span className="font-semibold text-rose-700">合计</span>
                <span className="font-semibold text-rose-700">{grandTotal} 积分</span>
              </div>
              <div className="text-[11px] text-rose-700/80 pt-0.5">
                请求已发出即计费（无论对方是否通过）；因账号风控 / 目标不存在等未发出的请求全额释放冻结积分。
              </div>
            </section>
          </div>
        )}

        <DialogFooter className="items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {executable.length === 0
              ? "当前没有可执行目标"
              : step === 2 && execAccounts.length === 0
                ? "请先选择执行账号"
                : ""}
          </div>
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
              <Button disabled={!stepValid} onClick={submit}>
                <UserPlus className="h-4 w-4" />
                创建任务（-{grandTotal}）
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>

      {/* 批量解锁二次确认 */}
      <Dialog open={unlockAllOpen} onOpenChange={setUnlockAllOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>批量解锁社媒账号</DialogTitle>
            <DialogDescription>
              将为 {lockedRows.length} 个未解锁账号一次性解锁明文，扣除{" "}
              <span className="font-semibold text-rose-600">{unlockCost}</span> 积分，
              解锁后永久有效、不可撤销。
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={unlockAllAck}
              onCheckedChange={(v) => setUnlockAllAck(v === true)}
              className="mt-0.5"
            />
            <span>我已知晓将立即扣除 {unlockCost} 积分</span>
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
