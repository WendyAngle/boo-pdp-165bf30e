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
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatDateTime, startOfBeijingDay } from "@/lib/format-date";
import { ENTERPRISES } from "@/data/enterprises";
import { CURRENT_USER } from "@/lib/current-user";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  batchMarkInvalid,
  claimTicket,
  CLAIM_TIMEOUT_MINUTES,
  finalizeReview,
  isFinalStatus,
  ISSUE_TYPE_LABEL,
  REJECT_REASON_LABEL,
  releaseStaleClaims,
  releaseTicket,
  revokeTicket,
  REVOKE_REASON_LABEL,
  seedFeedbackDemoIfEmpty,
  SOURCE_TYPE_LABEL,
  STATUS_LABEL,
  TicketConflictError,
  useAllFeedbacks,
  type FeedbackIssueType,
  type FeedbackItem,
  type FeedbackSourceType,
  type FeedbackStatus,
  type FeedbackTicket,
  type FeedbackVerdict,
  type RejectReason,
  type RevokeReason,
} from "@/lib/data-feedback";
import {
  addOverrideContact,
  applyContactFieldOverride,
  applyEnterpriseFieldOverride,
  revokeTicketChanges,
} from "@/lib/enterprise-overrides";
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

export const Route = createFileRoute("/_app/outreach/admin/data-feedback")({
  head: () => ({
    meta: [
      { title: "数据反馈审核 | 出海大数据平台" },
      {
        name: "description",
        content: "集中受理用户提交的企业数据纠错工单，逐条裁定并让采纳内容即时生效",
      },
      { property: "og:title", content: "数据反馈审核 | 出海大数据平台" },
      {
        property: "og:description",
        content: "逐条裁定用户数据纠错工单，采纳后企业数据即时生效",
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
    // 认领超时自动释放，避免工单长期挂在「审核中」
    releaseStaleClaims();
  }, []);

  const tickets = useAllFeedbacks();
  const [status, setStatus] = useState<"all" | FeedbackStatus>("all");
  const [subject, setSubject] = useState<string>("all");
  const [issue, setIssue] = useState<"all" | FeedbackIssueType>("all");
  const [source, setSource] = useState<"all" | FeedbackSourceType>("all");
  const [range, setRange] = useState<"all" | "7" | "30">("all");
  const [kw, setKw] = useState("");
  const [page, setPage] = useState(1);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [batchOpen, setBatchOpen] = useState(false);
  const pageSize = 10;

  const stats = useMemo(() => {
    const todayStart = startOfBeijingDay();
    const judged = tickets.filter((t) => t.reviewedAt && !t.revoked);
    const accepted = judged.filter(
      (t) => t.status === "accepted" || t.status === "partial",
    );
    return {
      pending: tickets.filter((t) => t.status === "submitted").length,
      reviewing: tickets.filter((t) => t.status === "reviewing").length,
      today: judged.filter((t) => (t.reviewedAt ?? 0) >= todayStart).length,
      rate: judged.length ? Math.round((accepted.length / judged.length) * 100) : 0,
    };
  }, [tickets]);

  const filtered = useMemo(() => {
    const k = kw.trim().toLowerCase();
    const since =
      range === "all" ? 0 : Date.now() - Number(range) * 86400_000;
    return [...tickets]
      .sort((a, b) => {
        const pa = a.status === "submitted" ? 0 : 1;
        const pb = b.status === "submitted" ? 0 : 1;
        return pa - pb || b.createdAt - a.createdAt;
      })
      .filter((t) => {
        if (status !== "all" && t.status !== status) return false;
        if (subject !== "all" && t.subjectKind !== subject) return false;
        if (source !== "all" && t.sourceType !== source) return false;
        if (issue !== "all") {
          // 新增关联人物工单无字段条目，语义等同「数据缺失」
          const matched =
            t.subjectKind === "new_contact"
              ? issue === "missing"
              : t.items.some((i) => i.issue === issue);
          if (!matched) return false;
        }
        if (t.createdAt < since) return false;
        if (!k) return true;
        return (
          t.enterpriseName.toLowerCase().includes(k) ||
          t.id.toLowerCase().includes(k) ||
          (t.submitter ?? "").toLowerCase().includes(k)
        );
      });
  }, [tickets, status, subject, issue, source, range, kw]);

  useEffect(() => setPage(1), [status, subject, issue, source, range, kw]);

  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize);
  const current = tickets.find((t) => t.id === reviewId) ?? null;
  const selectable = pageData.filter((t) => !isFinalStatus(t.status));
  const selectedOnPage = selectable.filter((t) => selected.includes(t.id));
  const allPageSelected =
    selectable.length > 0 && selectedOnPage.length === selectable.length;
  const toggleTicket = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const doBatchInvalid = () => {
    const count = batchMarkInvalid(selected, CURRENT_USER.name);
    setSelected([]);
    setBatchOpen(false);
    toast.success(`已批量标记 ${count} 条工单为无效`, {
      description: "无效工单不变更任何企业数据，也不计入采纳率",
    });
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <MessageSquareWarning className="h-6 w-6 text-primary" />
            数据反馈审核
          </h1>
          <p className="text-sm text-muted-foreground">
            逐条裁定用户提交的企业数据纠错工单；采纳内容即时写入企业主数据。
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "待审核", value: stats.pending, tone: "text-amber-600" },
          { label: "审核中", value: stats.reviewing, tone: "text-blue-600" },
          { label: "今日已处理", value: stats.today, tone: "text-foreground" },
          { label: "采纳率", value: `${stats.rate}%`, tone: "text-emerald-600" },
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
            <SelectTrigger className="h-9 w-[140px]">
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
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue placeholder="主体类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部主体</SelectItem>
              <SelectItem value="enterprise">企业数据</SelectItem>
              <SelectItem value="contact">关联人物</SelectItem>
              <SelectItem value="new_contact">新增人物</SelectItem>
            </SelectContent>
          </Select>
          <Select value={issue} onValueChange={(v) => setIssue(v as typeof issue)}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="问题类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部问题类型</SelectItem>
              {(Object.keys(ISSUE_TYPE_LABEL) as FeedbackIssueType[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {ISSUE_TYPE_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={source} onValueChange={(v) => setSource(v as typeof source)}>
            <SelectTrigger className="h-9 w-[190px]">
              <SelectValue placeholder="来源类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部来源</SelectItem>
              {(Object.keys(SOURCE_TYPE_LABEL) as FeedbackSourceType[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {SOURCE_TYPE_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={range} onValueChange={(v) => setRange(v as typeof range)}>
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue placeholder="提交时间" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部时间</SelectItem>
              <SelectItem value="7">近 7 天</SelectItem>
              <SelectItem value="30">近 30 天</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-2">
            {selected.length > 0 && (
              <>
                <span className="text-xs text-muted-foreground">
                  已选 {selected.length} 条
                </span>
                <Button size="sm" variant="outline" onClick={() => setBatchOpen(true)}>
                  批量标记无效
                </Button>
              </>
            )}
            <span className="text-xs text-muted-foreground">
              共 {filtered.length} 条工单
            </span>
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
                <TableHead className="w-10">
                  <Checkbox
                    checked={allPageSelected}
                    disabled={selectable.length === 0}
                    aria-label="全选本页可处理工单"
                    onCheckedChange={(v) =>
                      setSelected((prev) =>
                        v
                          ? Array.from(new Set([...prev, ...selectable.map((t) => t.id)]))
                          : prev.filter((id) => !selectable.some((t) => t.id === id)),
                      )
                    }
                  />
                </TableHead>
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
                  <TableCell>
                    <Checkbox
                      checked={selected.includes(t.id)}
                      disabled={isFinalStatus(t.status)}
                      aria-label={`选择工单 ${t.id}`}
                      onCheckedChange={() => toggleTicket(t.id)}
                    />
                  </TableCell>
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
                      {formatDateTime(t.createdAt)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={t.status} />
                      {Boolean(t.revokeCount) && (
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {t.revoked
                            ? `已撤销待重审${(t.revokeCount ?? 0) > 1 ? ` ×${t.revokeCount}` : ""}`
                            : `曾撤销 ${t.revokeCount} 次`}
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

      <AlertDialog open={batchOpen} onOpenChange={setBatchOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认批量标记为无效？</AlertDialogTitle>
            <AlertDialogDescription>
              将把已选中的 {selected.length} 条未完结工单标记为「无效 / 重复」。企业数据不会发生任何变更，用户可在「我的反馈」中看到结果；已完结工单会自动跳过。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={doBatchInvalid}>确认标记</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
  const [invalidConfirmOpen, setInvalidConfirmOpen] = useState(false);
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState<RevokeReason | undefined>(undefined);
  /** 打开工单时的裁定时间快照，用于并发覆盖保护 */
  const [openedReviewedAt, setOpenedReviewedAt] = useState(0);

  const readonly = Boolean(ticket && isFinalStatus(ticket.status));

  useEffect(() => {
    if (!ticket) return;
    const v: Verdicts = {};
    ticket.items.forEach((it, i) => {
      v[i] = {
        verdict: it.verdict ?? "accept",
        finalValue: it.finalValue ?? it.suggested ?? "",
        rejectReason: it.rejectReason,
      };
    });
    setVerdicts(v);
    setNewVerdict(ticket.newContactVerdict ?? "accept");
    setNewReason(ticket.newContactRejectReason);
    setNote(ticket.reviewNote ?? "");
    setConfirmOpen(false);
    setInvalidConfirmOpen(false);
    setRevokeConfirmOpen(false);
    setRevokeReason(undefined);
    setOpenedReviewedAt(ticket.reviewedAt ?? 0);
  }, [ticket?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 关闭且未裁定时释放认领 */
  const handleClose = () => {
    if (ticket) releaseTicket(ticket.id, CURRENT_USER.name);
    onClose();
  };

  const resolvedItems: FeedbackItem[] = useMemo(
    () =>
      (ticket?.items ?? []).map((it, i) => ({
        ...it,
        verdict: verdicts[i]?.verdict ?? "accept",
        finalValue: verdicts[i]?.finalValue ?? it.suggested ?? "",
        rejectReason: verdicts[i]?.rejectReason,
      })),
    [ticket, verdicts],
  );

  const newAccepted = ticket?.subjectKind === "new_contact" && newVerdict === "accept";

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
    // 并发保护：先落库裁定，被他人处理过则直接中止
    try {
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
        expectedReviewedAt: openedReviewedAt,
      });
    } catch (e) {
      if (e instanceof TicketConflictError) {
        toast.error("提交失败", { description: e.message });
        setConfirmOpen(false);
        setInvalidConfirmOpen(false);
        onClose();
        return;
      }
      throw e;
    }
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
            newValue: it.finalValue ?? it.suggested ?? "",
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
            newValue: it.finalValue ?? it.suggested ?? "",
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
    toast.success(markInvalid ? "已标记为无效工单" : "裁定已提交", {
      description: markInvalid
        ? "数据不变更，用户可在「我的反馈」中查看结果"
        : `生效 ${acceptCount} 项变更`,
    });
    setConfirmOpen(false);
    setInvalidConfirmOpen(false);
    onClose();
  };

  const doRevoke = () => {
    if (!revokeReason) return;
    revokeTicketChanges(ticket.enterpriseId, ticket.id);
    revokeTicket(ticket.id, revokeReason, CURRENT_USER.name);
    toast.success("已撤销并恢复审核", {
      description: "数据变更已回滚，工单已进入审核中，提交人会看到结果被收回",
    });
    setRevokeConfirmOpen(false);
    setRevokeReason(undefined);
  };

  return (
    <Dialog open={Boolean(ticket)} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="flex items-center gap-2">
            工单 {ticket.id}
            <StatusBadge status={ticket.status} />
          </DialogTitle>
          <DialogDescription>
            核对来源佐证后逐条裁定；采纳内容将即时写入企业主数据。
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
              {formatDateTime(ticket.createdAt)}
            </Field>
            <Field label="允许联系">{ticket.allowContact ? "是" : "否"}</Field>
            {ticket.reviewedAt && (
              <>
                <Field label="审核人">{ticket.reviewer ?? "—"}</Field>
                <Field label="裁定时间">
                  {formatDateTime(ticket.reviewedAt)}
                </Field>
                <Field label="裁定结果">{STATUS_LABEL[ticket.status]}</Field>
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
                        <span className="break-all">{it.suggested || "未填写"}</span>
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
                该工单已裁定；撤销后将回滚数据，并重新进入审核。
              </span>
              {!ticket.revoked &&
                (ticket.status === "accepted" || ticket.status === "partial") && (
                  <Button
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setRevokeConfirmOpen(true)}
                  >
                    <Undo2 className="h-4 w-4" />
                    撤销并重新审核
                  </Button>
                )}
              <Button onClick={onClose}>关闭</Button>
            </>
          ) : (
            <>
              <span className="mr-auto self-center text-xs text-muted-foreground inline-flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" />
                采纳 {acceptCount} 项将即时写入主数据
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
              <li>
                {ticket.subjectKind === "enterprise"
                  ? `将变更 ${acceptCount} 项企业数据`
                  : ticket.subjectKind === "contact"
                    ? `将变更关联人物「${ticket.contactName ?? ""}」的 ${acceptCount} 项资料`
                    : newAccepted
                      ? `将新增关联人物「${ticket.newContact?.name ?? ""}」`
                      : "不新增关联人物"}
              </li>
              <li>未采纳条目将按所选原因反馈给提交人</li>
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
        <AlertDialog open={invalidConfirmOpen} onOpenChange={setInvalidConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认标记为无效工单？</AlertDialogTitle>
              <AlertDialogDescription>
                标记后不变更任何数据，工单直接完结且不可再修改，提交人可在「我的反馈」中看到结果。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={() => doSubmit(true)}>确认标记</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog open={revokeConfirmOpen} onOpenChange={setRevokeConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认撤销并重新审核？</AlertDialogTitle>
              <AlertDialogDescription>
                撤销后将回滚本次数据变更，工单恢复为「审核中」并可重新裁定；原裁定与撤销原因保留在审计记录中，提交人会看到「结果已收回，正在重新核实」。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">撤销原因（必选）</Label>
              <Select
                value={revokeReason ?? ""}
                onValueChange={(v) => setRevokeReason(v as RevokeReason)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="请选择撤销原因" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(REVOKE_REASON_LABEL) as RevokeReason[]).map((r) => (
                    <SelectItem key={r} value={r}>
                      {REVOKE_REASON_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction disabled={!revokeReason} onClick={doRevoke}>
                确认撤销
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
        未采纳
      </Button>
      {verdict === "reject" && (
        <Select
          value={reason ?? ""}
          disabled={disabled}
          onValueChange={(v) => onReason(v as RejectReason)}
        >
          <SelectTrigger className="h-8 w-[200px]">
            <SelectValue placeholder="选择未采纳原因" />
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
