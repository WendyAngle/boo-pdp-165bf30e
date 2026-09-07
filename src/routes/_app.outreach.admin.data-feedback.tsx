import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  MessageSquareWarning,
  Search,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  ExternalLink,
  Coins,
  Undo2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { ListPagination } from "@/components/ListPagination";
import { formatDateTime } from "@/lib/format-date";
import { ENTERPRISES } from "@/data/enterprises";
import { CURRENT_USER } from "@/lib/current-user";
import { useHydrated } from "@/hooks/use-hydrated";
import { addCredits } from "@/lib/credits-balance";
import { recordFeedbackReward } from "@/lib/credits-ledger";
import {
  claimTicket,
  computeReward,
  finalizeReview,
  ISSUE_TYPE_LABEL,
  REJECT_REASON_LABEL,
  revokeTicket,
  seedFeedbackDemoIfEmpty,
  SOURCE_TYPE_LABEL,
  STATUS_LABEL,
  useAllFeedbacks,
  type FeedbackItem,
  type FeedbackStatus,
  type FeedbackTicket,
  type FeedbackVerdict,
  type RejectReason,
} from "@/lib/data-feedback";
import {
  addOverrideContact,
  applyContactFieldOverride,
  applyEnterpriseFieldOverride,
  revokeTicketChanges,
} from "@/lib/enterprise-overrides";

export const Route = createFileRoute("/_app/outreach/admin/data-feedback")({
  head: () => ({
    meta: [
      { title: "数据反馈审核 | 出海大数据平台" },
      {
        name: "description",
        content: "集中受理用户提交的企业数据纠错工单，逐条裁定、生效数据并发放积分奖励",
      },
      { property: "og:title", content: "数据反馈审核 | 出海大数据平台" },
      {
        property: "og:description",
        content: "逐条裁定用户数据纠错工单，采纳后数据生效并即时发放积分奖励",
      },
    ],
  }),
  component: DataFeedbackAdminPage,
});

const STATUS_META: Record<
  FeedbackStatus,
  { cls: string; icon: typeof CheckCircle2 }
> = {
  submitted: { cls: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  reviewing: { cls: "bg-blue-50 text-blue-700 border-blue-200", icon: Clock },
  accepted: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  partial: { cls: "bg-teal-50 text-teal-700 border-teal-200", icon: CheckCircle2 },
  rejected: { cls: "bg-rose-50 text-rose-700 border-rose-200", icon: XCircle },
  invalid: { cls: "bg-muted text-muted-foreground border-border", icon: Ban },
};

const SUBJECT_LABEL: Record<string, string> = {
  enterprise: "企业数据",
  contact: "关联人物",
  new_contact: "新增人物",
};

function StatusBadge({ status }: { status: FeedbackStatus }) {
  const m = STATUS_META[status];
  const I = m.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium",
        m.cls,
      )}
    >
      <I className="h-3 w-3" />
      {STATUS_LABEL[status]}
    </span>
  );
}

function DataFeedbackAdminPage() {
  const hydrated = useHydrated();
  useEffect(() => {
    seedFeedbackDemoIfEmpty(
      ENTERPRISES.slice(0, 3).map((e) => ({
        id: e.id,
        name: e.name,
        email: e.email,
        phone: e.phone,
        website: e.website,
        contactName: e.contacts[0]?.name,
      })),
    );
  }, []);

  const tickets = useAllFeedbacks();
  const [status, setStatus] = useState<"all" | FeedbackStatus>("all");
  const [subject, setSubject] = useState<string>("all");
  const [kw, setKw] = useState("");
  const [page, setPage] = useState(1);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const pageSize = 10;

  const stats = useMemo(() => {
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const judged = tickets.filter((t) => t.reviewedAt);
    const accepted = judged.filter(
      (t) => t.status === "accepted" || t.status === "partial",
    );
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return {
      pending: tickets.filter((t) => t.status === "submitted").length,
      reviewing: tickets.filter((t) => t.status === "reviewing").length,
      today: judged.filter((t) => (t.reviewedAt ?? 0) >= todayStart).length,
      rate: judged.length ? Math.round((accepted.length / judged.length) * 100) : 0,
      reward: tickets
        .filter((t) => (t.reviewedAt ?? 0) >= monthStart.getTime())
        .reduce((s, t) => s + (t.reward ?? 0), 0),
    };
  }, [tickets]);

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase();
    return [...tickets]
      .sort((a, b) => {
        const pa = a.status === "submitted" ? 0 : 1;
        const pb = b.status === "submitted" ? 0 : 1;
        return pa - pb || b.createdAt - a.createdAt;
      })
      .filter((t) => {
        if (status !== "all" && t.status !== status) return false;
        if (subject !== "all" && t.subjectKind !== subject) return false;
        if (!k) return true;
        return (
          t.enterpriseName.toLowerCase().includes(k) ||
          t.id.toLowerCase().includes(k) ||
          (t.submitter ?? "").toLowerCase().includes(k)
        );
      });
  }, [tickets, status, subject, kw]);

  useEffect(() => setPage(1), [status, subject, kw]);

  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize);
  const current = tickets.find((t) => t.id === reviewId) ?? null;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <MessageSquareWarning className="h-6 w-6 text-primary" />
            数据反馈审核
          </h1>
          <p className="text-sm text-muted-foreground">
            逐条裁定用户提交的企业数据纠错工单；采纳后数据即时生效并同步发放积分奖励。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "待审核", value: stats.pending, tone: "text-amber-600" },
          { label: "审核中", value: stats.reviewing, tone: "text-blue-600" },
          { label: "今日已处理", value: stats.today, tone: "text-foreground" },
          { label: "采纳率", value: `${stats.rate}%`, tone: "text-emerald-600" },
          { label: "本月发放积分", value: stats.reward, tone: "text-primary" },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className={cn("text-2xl font-semibold tabular-nums mt-1", s.tone)}>
              {hydrated ? s.value : s.label === "采纳率" ? "0%" : 0}
            </div>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 flex flex-wrap items-center gap-2 border-b">
          <div className="relative w-[260px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="h-9 pl-8"
              placeholder="搜索企业名 / 工单号 / 提交人"
              value={kw}
              onChange={(e) => setKw(e.target.value)}
            />
            {kw && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setKw("")}
                aria-label="清空"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {(Object.keys(STATUS_LABEL) as FeedbackStatus[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue placeholder="主体类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部主体</SelectItem>
              <SelectItem value="enterprise">企业数据</SelectItem>
              <SelectItem value="contact">关联人物</SelectItem>
              <SelectItem value="new_contact">新增人物</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto text-xs text-muted-foreground">
            共 {filtered.length} 条工单
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-16 text-center text-sm text-muted-foreground">
            暂无符合条件的工单
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>工单号</TableHead>
                <TableHead>企业</TableHead>
                <TableHead>主体</TableHead>
                <TableHead>条目</TableHead>
                <TableHead>来源</TableHead>
                <TableHead>提交人 / 时间</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map((t) => (
                <TableRow key={t.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-xs">{t.id}</TableCell>
                  <TableCell className="max-w-[220px] truncate capitalize">
                    {t.enterpriseName}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="font-normal">
                      {SUBJECT_LABEL[t.subjectKind]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {t.subjectKind === "new_contact" ? "1 人" : `${t.items.length} 项`}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">
                    {SOURCE_TYPE_LABEL[t.sourceType]}
                    {t.sourceUrl ? " · 有链接" : ""}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div>{t.submitter ?? "—"}</div>
                    <div className="tabular-nums">
                      {formatDateTime(new Date(t.createdAt).toISOString())}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={t.status} />
                      {t.revoked && (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          已撤销
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant={t.reviewedAt ? "outline" : "default"}
                      onClick={() => {
                        if (t.status === "submitted") claimTicket(t.id, CURRENT_USER.name);
                        setReviewId(t.id);
                      }}
                    >
                      {t.reviewedAt ? "查看" : "审核"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {filtered.length > 0 && (
          <div className="px-5 py-4">
            <ListPagination
              page={page}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
            />
          </div>
        )}
      </Card>

      <ReviewDialog
        ticket={current}
        onClose={() => setReviewId(null)}
      />
    </div>
  );
}

/* -------------------- 审核弹窗 -------------------- */

interface Verdicts {
  [index: number]: {
    verdict: FeedbackVerdict;
    finalValue: string;
    rejectReason?: RejectReason;
  };
}

function ReviewDialog({
  ticket,
  onClose,
}: {
  ticket: FeedbackTicket | null;
  onClose: () => void;
}) {
  const [verdicts, setVerdicts] = useState<Verdicts>({});
  const [newVerdict, setNewVerdict] = useState<FeedbackVerdict>("accept");
  const [newReason, setNewReason] = useState<RejectReason | undefined>(undefined);
  const [note, setNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const readonly = Boolean(ticket?.reviewedAt);

  useEffect(() => {
    if (!ticket) return;
    const v: Verdicts = {};
    ticket.items.forEach((it, i) => {
      v[i] = {
        verdict: it.verdict ?? "accept",
        finalValue: it.finalValue ?? it.suggested,
        rejectReason: it.rejectReason,
      };
    });
    setVerdicts(v);
    setNewVerdict(ticket.newContactVerdict ?? "accept");
    setNewReason(ticket.newContactRejectReason);
    setNote(ticket.reviewNote ?? "");
    setConfirmOpen(false);
  }, [ticket?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolvedItems: FeedbackItem[] = useMemo(
    () =>
      (ticket?.items ?? []).map((it, i) => ({
        ...it,
        verdict: verdicts[i]?.verdict ?? "accept",
        finalValue: verdicts[i]?.finalValue ?? it.suggested,
        rejectReason: verdicts[i]?.rejectReason,
      })),
    [ticket, verdicts],
  );

  const newAccepted = ticket?.subjectKind === "new_contact" && newVerdict === "accept";

  const rewardInfo = useMemo(
    () =>
      ticket
        ? computeReward(ticket, resolvedItems, Boolean(newAccepted))
        : { reward: 0, capped: false },
    [ticket, resolvedItems, newAccepted],
  );

  if (!ticket) return null;

  const acceptCount =
    resolvedItems.filter((i) => i.verdict === "accept").length +
    (newAccepted ? 1 : 0);

  const missingReason =
    resolvedItems.some((i) => i.verdict === "reject" && !i.rejectReason) ||
    (ticket.subjectKind === "new_contact" && newVerdict === "reject" && !newReason);
  const missingValue = resolvedItems.some(
    (i) => i.verdict === "accept" && !(i.finalValue ?? "").trim(),
  );

  const disabledReason = missingValue
    ? "请填写采纳字段的最终生效值"
    : missingReason
      ? "请为驳回条目选择驳回原因"
      : "";

  const doSubmit = (markInvalid = false) => {
    const reward = markInvalid ? 0 : rewardInfo.reward;
    // 数据生效
    if (!markInvalid) {
      for (const it of resolvedItems) {
        if (it.verdict !== "accept") continue;
        if (ticket.subjectKind === "enterprise") {
          applyEnterpriseFieldOverride({
            enterpriseId: ticket.enterpriseId,
            field: it.field,
            label: it.label,
            oldValue: it.current,
            newValue: it.finalValue ?? it.suggested,
            ticketId: ticket.id,
            reviewer: CURRENT_USER.name,
          });
        } else if (ticket.subjectKind === "contact") {
          applyContactFieldOverride({
            enterpriseId: ticket.enterpriseId,
            contactIndex: ticket.contactIndex ?? 0,
            field: it.field,
            label: it.label,
            oldValue: it.current,
            newValue: it.finalValue ?? it.suggested,
            ticketId: ticket.id,
            reviewer: CURRENT_USER.name,
          });
        }
      }
      if (newAccepted && ticket.newContact) {
        addOverrideContact({
          enterpriseId: ticket.enterpriseId,
          contact: {
            name: ticket.newContact.name,
            title: ticket.newContact.title ?? "",
            email: ticket.newContact.email ?? "",
            phone: ticket.newContact.phone,
            whatsapp: ticket.newContact.whatsapp,
          },
          ticketId: ticket.id,
          reviewer: CURRENT_USER.name,
        });
      }
    }
    // 裁定落库
    finalizeReview({
      id: ticket.id,
      reviewer: CURRENT_USER.name,
      items: resolvedItems,
      newContactVerdict:
        ticket.subjectKind === "new_contact" ? newVerdict : undefined,
      newContactRejectReason:
        ticket.subjectKind === "new_contact" && newVerdict === "reject"
          ? newReason
          : undefined,
      reviewNote: note.trim() || undefined,
      markInvalid,
      reward,
    });
    // 积分与数据生效同事务发放
    if (reward > 0) {
      addCredits(reward, 0);
      recordFeedbackReward({
        ticketId: ticket.id,
        enterpriseId: ticket.enterpriseId,
        enterpriseName: ticket.enterpriseName,
        credits: reward,
        note: `采纳 ${acceptCount} 项`,
      });
    }
    toast.success(markInvalid ? "已标记为无效工单" : "裁定已提交", {
      description: markInvalid
        ? "数据不变更，不发放积分"
        : `生效 ${acceptCount} 项变更 · 发放 ${reward} 积分`,
    });
    setConfirmOpen(false);
    onClose();
  };

  const doRevoke = () => {
    revokeTicketChanges(ticket.enterpriseId, ticket.id);
    revokeTicket(ticket.id);
    toast.success("已撤销该工单的数据变更", {
      description: "按平台规则，已发放的积分奖励不予回收",
    });
    onClose();
  };

  return (
    <Dialog open={Boolean(ticket)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            工单 {ticket.id}
            <StatusBadge status={ticket.status} />
          </DialogTitle>
          <DialogDescription>
            核对来源佐证后逐条裁定；采纳内容将写入企业主数据，并按采纳条目发放积分奖励。
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-5">
          {/* A. 工单信息 */}
          <section className="rounded-lg border bg-muted/20 p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Field label="企业">
              <Link
                to="/outreach/enterprise/$id"
                params={{ id: ticket.enterpriseId }}
                className="text-primary hover:underline inline-flex items-center gap-1 capitalize"
              >
                <span className="truncate">{ticket.enterpriseName}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </Link>
            </Field>
            <Field label="主体">
              {SUBJECT_LABEL[ticket.subjectKind]}
              {ticket.contactName ? ` · ${ticket.contactName}` : ""}
            </Field>
            <Field label="提交人">{ticket.submitter ?? "—"}</Field>
            <Field label="提交时间">
              {formatDateTime(new Date(ticket.createdAt).toISOString())}
            </Field>
            <Field label="允许联系">{ticket.allowContact ? "是" : "否"}</Field>
            {ticket.reviewedAt && (
              <>
                <Field label="审核人">{ticket.reviewer ?? "—"}</Field>
                <Field label="裁定时间">
                  {formatDateTime(new Date(ticket.reviewedAt).toISOString())}
                </Field>
                <Field label="发放积分">
                  <span className="text-emerald-600 font-medium">
                    +{ticket.reward ?? 0}
                  </span>
                </Field>
              </>
            )}
          </section>

          {/* B. 字段裁定 */}
          <section className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {ticket.subjectKind === "new_contact" ? "新增关联人物" : "字段裁定"}
            </Label>

            {ticket.subjectKind === "new_contact" ? (
              <div className="rounded-lg border p-3 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <Field label="姓名">{ticket.newContact?.name || "—"}</Field>
                  <Field label="职位">{ticket.newContact?.title || "—"}</Field>
                  <Field label="邮箱">{ticket.newContact?.email || "—"}</Field>
                  <Field label="电话">{ticket.newContact?.phone || "—"}</Field>
                  <Field label="WhatsApp">{ticket.newContact?.whatsapp || "—"}</Field>
                  <Field label="在职状态">{ticket.newContact?.status || "—"}</Field>
                </div>
                <Separator />
                <VerdictRow
                  disabled={readonly}
                  verdict={newVerdict}
                  onVerdict={setNewVerdict}
                  reason={newReason}
                  onReason={setNewReason}
                />
              </div>
            ) : (
              <div className="space-y-2">
                {resolvedItems.map((it, i) => (
                  <div key={i} className="rounded-lg border p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{it.label}</span>
                      <Badge variant="secondary" className="font-normal">
                        {ISSUE_TYPE_LABEL[it.issue]}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                      <Field label="系统当前值">
                        <span className="text-muted-foreground break-all">
                          {it.current || "未提供"}
                        </span>
                      </Field>
                      <Field label="用户建议值">
                        <span className="break-all">{it.suggested || "—"}</span>
                      </Field>
                      <Field label="最终生效值">
                        <Input
                          className="h-8"
                          disabled={readonly || it.verdict === "reject"}
                          value={verdicts[i]?.finalValue ?? ""}
                          onChange={(e) =>
                            setVerdicts((v) => ({
                              ...v,
                              [i]: { ...v[i], finalValue: e.target.value },
                            }))
                          }
                        />
                      </Field>
                    </div>
                    <VerdictRow
                      disabled={readonly}
                      verdict={verdicts[i]?.verdict ?? "accept"}
                      onVerdict={(vd) =>
                        setVerdicts((v) => ({ ...v, [i]: { ...v[i], verdict: vd } }))
                      }
                      reason={verdicts[i]?.rejectReason}
                      onReason={(r) =>
                        setVerdicts((v) => ({ ...v, [i]: { ...v[i], rejectReason: r } }))
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* C. 来源佐证 */}
          <section className="rounded-lg border bg-muted/20 p-3 space-y-2 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="来源类型">{SOURCE_TYPE_LABEL[ticket.sourceType]}</Field>
              <Field label="来源链接">
                {ticket.sourceUrl ? (
                  <a
                    href={ticket.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-primary hover:underline inline-flex items-center gap-1 break-all"
                  >
                    {ticket.sourceUrl}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : (
                  "—"
                )}
              </Field>
            </div>
            <Field label="补充说明">{ticket.sourceNote || "—"}</Field>
            <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              核验优先级：企业官网 / 官方工商登记 &gt; 与联系人沟通确认 &gt; 第三方名录（需交叉验证）。
            </p>
          </section>

          {!readonly && (
            <section className="space-y-1">
              <Label className="text-xs text-muted-foreground">审核备注</Label>
              <Textarea
                rows={2}
                maxLength={300}
                value={note}
                placeholder="内部备注，用户端仅可见驳回原因"
                onChange={(e) => setNote(e.target.value)}
              />
            </section>
          )}
        </div>

        <DialogFooter className="border-t p-4 gap-2 sm:gap-2">
          {readonly ? (
            <>
              <span className="mr-auto self-center text-xs text-muted-foreground">
                该工单已裁定，如需翻案请撤销数据变更（积分不回收）。
              </span>
              {!ticket.revoked &&
                (ticket.status === "accepted" || ticket.status === "partial") && (
                  <Button variant="outline" className="gap-1.5" onClick={doRevoke}>
                    <Undo2 className="h-4 w-4" />
                    撤销数据变更
                  </Button>
                )}
              <Button onClick={onClose}>关闭</Button>
            </>
          ) : (
            <>
              <span className="mr-auto self-center text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5" />
                预计发放 {rewardInfo.reward} 积分
                {rewardInfo.capped ? "（已触发上限）" : ""}
                {disabledReason ? ` · ${disabledReason}` : ""}
              </span>
              <Button variant="outline" onClick={() => doSubmit(true)}>
                标记无效
              </Button>
              <Button
                disabled={Boolean(disabledReason)}
                onClick={() => setConfirmOpen(true)}
              >
                提交裁定
              </Button>
            </>
          )}
        </DialogFooter>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>确认提交裁定</DialogTitle>
              <DialogDescription>提交后状态不可再修改，请确认以下结果。</DialogDescription>
            </DialogHeader>
            <ul className="text-sm space-y-1.5">
              <li>将变更 {acceptCount} 项企业数据</li>
              <li>
                将发放 {rewardInfo.reward} 积分
                {rewardInfo.capped && (
                  <span className="text-amber-600">（触发上限，超出部分不发放）</span>
                )}
              </li>
              <li>用户可在企业详情页「我的反馈」中查看结果</li>
            </ul>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                返回修改
              </Button>
              <Button onClick={() => doSubmit(false)}>确认提交</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 min-w-0">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm break-words">{children}</div>
    </div>
  );
}

function VerdictRow({
  disabled,
  verdict,
  onVerdict,
  reason,
  onReason,
}: {
  disabled: boolean;
  verdict: FeedbackVerdict;
  onVerdict: (v: FeedbackVerdict) => void;
  reason?: RejectReason;
  onReason: (r: RejectReason) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        disabled={disabled}
        variant={verdict === "accept" ? "default" : "outline"}
        className="h-8 gap-1.5"
        onClick={() => onVerdict("accept")}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        采纳
      </Button>
      <Button
        type="button"
        size="sm"
        disabled={disabled}
        variant={verdict === "reject" ? "destructive" : "outline"}
        className="h-8 gap-1.5"
        onClick={() => onVerdict("reject")}
      >
        <XCircle className="h-3.5 w-3.5" />
        驳回
      </Button>
      {verdict === "reject" && (
        <Select
          value={reason ?? ""}
          disabled={disabled}
          onValueChange={(v) => onReason(v as RejectReason)}
        >
          <SelectTrigger className="h-8 w-[200px]">
            <SelectValue placeholder="选择驳回原因" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(REJECT_REASON_LABEL) as RejectReason[]).map((r) => (
              <SelectItem key={r} value={r}>
                {REJECT_REASON_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
