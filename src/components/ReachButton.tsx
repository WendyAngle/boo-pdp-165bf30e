import { useMemo, useState } from "react";
import { Send, Loader2, CheckCircle2, XCircle, Clock, MailWarning, Mailbox as MailboxIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { useUsableMailboxes, getDefaultUsableMailbox } from "@/lib/mailboxes";
import {
  createReach,
  useLedger,
  getReachStatus,
  type ReachChannel,
  type TargetKind,
  costForChannel,
  computeReachBreakdown,
  performReachAutoUnlocks,
} from "@/lib/credits-ledger";
import { ComposeSendDialog } from "@/components/ComposeSendDialog";
import { findEnterprise } from "@/data/enterprises";
import { useLeadProfile } from "@/lib/lead-profile";
import { useCurrentUser } from "@/lib/current-user";
import { myContext, type Recipient } from "@/lib/message-vars";

interface Props {
  targetKind: TargetKind;
  targetId: string;
  targetName: string;
  parentRef?: { id: string; name: string };
  channel: ReachChannel;
  platform?: string;
  detail: string;
  disabled?: boolean;
  size?: "sm" | "xs";
  className?: string;
}

export function ReachButton({
  targetKind,
  targetId,
  targetName,
  parentRef,
  channel,
  platform,
  detail,
  disabled,
  size = "xs",
  className,
}: Props) {
  const ledger = useLedger();
  const [open, setOpen] = useState(false);
  const [noMailboxOpen, setNoMailboxOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const navigate = useNavigate();
  const mailboxes = useUsableMailboxes();
  const isEmail = channel === "email";
  const isPhoneCh = channel === "phone";
  const useCompose = isEmail || isPhoneCh;
  const profile = useLeadProfile();
  const user = useCurrentUser();

  // 找 (target, channel, platform) 最近一次未结束的触达
  const active = useMemo(() => {
    const found = ledger.find(
      (e) =>
        e.kind === "reach" &&
        e.targetKind === targetKind &&
        e.targetId === targetId &&
        e.channel === channel &&
        (platform ? e.platform === platform : true),
    );
    if (!found) return null;
    const st = getReachStatus(found);
    return { entry: found, status: st };
  }, [ledger, targetKind, targetId, channel, platform]);

  const inFlight = active && (active.status === "pending" || active.status === "in_progress");
  const channelLabel = { email: "邮件", phone: "电话", social: "社媒" }[channel];
  const isPhone = channel === "phone";
  const reachCost = costForChannel(channel, platform);

  // 触达前扣费明细（含未解锁字段的自动查看费）
  const breakdown = useMemo(
    () =>
      computeReachBreakdown({ targetKind, targetId }, channel, platform),
    [ledger, targetKind, targetId, channel, platform],
  );

  const confirm = () => {
    if (isEmail && !getDefaultUsableMailbox(mailboxes)) {
      toast.error("请先选择发件邮箱");
      return;
    }
    // 先自动解锁需要的查看字段（幂等）
    performReachAutoUnlocks({
      targetKind,
      targetId,
      targetName,
      parentRef,
      detail,
      fields: breakdown.unlocksNeeded,
    });
    createReach({
      targetKind,
      targetId,
      targetName,
      parentRef,
      channel,
      platform,
      detail,
      senderEmail: isEmail ? getDefaultUsableMailbox(mailboxes)?.email : undefined,
    });
    setOpen(false);
    const totalCharged = breakdown.total;
    toast.success(
      isEmail
        ? `邮件已加入发送队列，共扣除 ${totalCharged} 积分`
        : isPhone
        ? `短信已加入发送队列，共扣除 ${totalCharged} 积分`
        : `已加入触达队列，共扣除 ${totalCharged} 积分`,
      {
        description:
          breakdown.viewCost > 0
            ? `含自动解锁查看 ${breakdown.viewCost} 积分 + 触达 ${breakdown.reachCost} 积分，可在「触达」模块查看进度`
            : `触达 ${breakdown.reachCost} 积分（相关信息已解锁，免查看费），可在「触达」模块查看进度`,
      },
    );
  };

  // 单条 → 撰写发送弹窗使用的 recipients
  const composeRecipients = useMemo<Recipient[]>(() => {
    const my = myContext(profile, user);
    // 尝试取所属企业以补充行业/城市
    const entId =
      targetKind === "enterprise" ? targetId : (parentRef?.id ?? targetId.split(":")[0]);
    const ent = entId ? findEnterprise(entId) : undefined;
    return [
      {
        key: targetId,
        address: detail,
        name: targetName,
        targetKind,
        targetId,
        parentRef,
        ctx: {
          企业名: targetKind === "enterprise" ? targetName : parentRef?.name ?? ent?.name,
          联系人名: targetKind === "contact" ? targetName : ent?.contacts?.[0]?.name,
          行业: ent?.industry,
          城市: ent?.city,
          ...my,
        },
      },
    ];
  }, [targetKind, targetId, targetName, parentRef, detail, profile, user]);

  const verb = isEmail ? "发送邮件" : isPhone ? "发送短信" : "触达";
  let label: React.ReactNode = (
    <>
      <Send className="h-3 w-3" />
      {verb}
    </>
  );
  let tone =
    "border-primary/30 text-primary hover:bg-primary/10 bg-primary/5";
  if (inFlight) {
    label =
      active!.status === "pending" ? (
        <>
          <Clock className="h-3 w-3" />
          {isEmail || isPhone ? "待发送" : "待触达"}
        </>
      ) : (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          {isEmail || isPhone ? "发送中" : "触达中"}
        </>
      );
    tone = "border-amber-200 text-amber-700 bg-amber-50";
  } else if (active?.status === "success") {
    label = (
      <>
        <CheckCircle2 className="h-3 w-3" />
        {isEmail || isPhone ? "再次发送" : "再次触达"}
      </>
    );
    tone = "border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100";
  } else if (active?.status === "failed") {
    label = (
      <>
        <XCircle className="h-3 w-3" />
        {isEmail || isPhone ? "重新发送" : "重新触达"}
      </>
    );
    tone = "border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100";
  }

  return (
    <span
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={disabled || !!inFlight}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (isEmail && mailboxes.length === 0) {
            setNoMailboxOpen(true);
            return;
          }
          if (useCompose) {
            setComposeOpen(true);
          } else {
            setOpen(true);
          }
        }}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed",
          size === "sm" ? "h-7 px-2.5 text-sm" : "h-6",
          tone,
          className,
        )}
      >
        {label}
      </button>

      {useCompose && (
        <ComposeSendDialog
          open={composeOpen}
          onOpenChange={setComposeOpen}
          channel={isEmail ? "email" : "phone"}
          recipients={composeRecipients}
        />
      )}

      <AlertDialog open={open && !useCompose} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              {isEmail
                ? "发送邮件"
                : isPhone
                ? "发送短信"
                : `通过${channelLabel}${platform ? `（${platform}）` : ""}触达`}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div className="text-muted-foreground">
                  本次触达将消耗 <span className="font-semibold text-rose-600">{breakdown.total} 积分</span>
                  {breakdown.viewCost > 0 && (
                    <>（含自动解锁查看 {breakdown.viewCost} 积分）</>
                  )}
                  ，并记录到「触达」与「账单」模块。
                </div>
                <div className="rounded-md bg-muted/60 p-3 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">触达对象</span>
                    <span className="font-medium text-foreground">{targetName}</span>
                  </div>
                  {parentRef && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">所属企业</span>
                      <span className="font-medium text-foreground">{parentRef.name}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">渠道</span>
                    <span className="font-medium text-foreground">
                      {channelLabel}
                      {platform ? ` · ${platform}` : ""}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">明细</span>
                    <span className="font-mono text-foreground truncate max-w-[260px]">{detail}</span>
                  </div>
                </div>
                <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs space-y-1">
                  {breakdown.lines.map((l, i) => (
                    <div key={i} className="flex justify-between">
                      <span className="text-muted-foreground">
                        {l.label}
                        {l.kind === "view" && l.alreadyUnlocked && (
                          <span className="ml-1 text-emerald-600">· 已解锁</span>
                        )}
                      </span>
                      <span className="font-medium">
                        {l.kind === "view" && l.alreadyUnlocked ? "免费" : `${l.cost} 积分`}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-rose-200/70 pt-1">
                    <span className="font-semibold text-rose-700">合计</span>
                    <span className="font-semibold text-rose-700">{breakdown.total} 积分</span>
                  </div>
                  {breakdown.viewCost > 0 && (
                    <div className="text-[11px] text-rose-700/80 pt-0.5">
                      触达完成后相关字段将永久解锁，后续查看/再次触达不再收取查看费。
                    </div>
                  )}
                </div>
                {/* email/phone 走 ComposeSendDialog，此分支仅用于 social */}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirm}
              className="bg-primary"
            >
              {isEmail || isPhone
                ? `确认发送（-${breakdown.total}）`
                : `确认触达（-${breakdown.total}）`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={noMailboxOpen} onOpenChange={setNoMailboxOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
              <MailWarning className="h-5 w-5" />
              未配置发件邮箱
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  邮件触达需要先在「邮箱」模块配置至少一个状态为「正常」的发件邮箱，用于发送本次邮件。
                </p>
                <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
                  请先前往「企业设置 · 发信邮箱」新增邮箱并完成连接测试。
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary"
              onClick={() => {
                setNoMailboxOpen(false);
                navigate({ to: "/outreach/mailboxes" });
              }}
            >
              去设置邮箱
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  );
}