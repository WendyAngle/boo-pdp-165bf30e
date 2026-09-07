import { useMemo, useState } from "react";
import { MessageSquareWarning, Plus, Trash2, Info, HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Enterprise } from "@/data/enterprises";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  CONTACT_FEEDBACK_FIELDS,
  ENTERPRISE_FEEDBACK_FIELDS,
  ISSUE_TYPE_LABEL,
  markTicketsRead,
  NEW_CONTACT_FIELDS,
  REJECT_REASON_LABEL,
  SOURCE_NEEDS_URL,
  SOURCE_TYPE_LABEL,
  STATUS_LABEL,
  submitFeedback,
  useFeedbacks,
  useUnreadFeedbackCount,
  type FeedbackIssueType,
  type FeedbackItem,
  type FeedbackSourceType,
  type FeedbackSubjectKind,
  type FeedbackTicket,
  type NewContactDraft,
} from "@/lib/data-feedback";
import { CURRENT_USER } from "@/lib/current-user";

interface Props {
  enterprise: Enterprise;
  /** 指定默认反馈对象（关联人物卡片入口） */
  defaultContactIndex?: number;
  /** 触发按钮形态 */
  trigger?: React.ReactNode;
}

interface Draft {
  field: string;
  issue: FeedbackIssueType;
  suggested: string;
}

const ISSUE_TYPES: FeedbackIssueType[] = ["wrong", "outdated", "missing", "invalid"];
const SOURCE_TYPES = Object.keys(SOURCE_TYPE_LABEL) as FeedbackSourceType[];

const EMPTY_NEW_CONTACT: NewContactDraft = {
  name: "",
  title: "",
  email: "",
  phone: "",
  whatsapp: "",
  status: "",
};

function enterpriseValue(e: Enterprise, key: string): string {
  const raw = (e as unknown as Record<string, unknown>)[key];
  if (Array.isArray(raw)) return raw.join("、");
  return raw ? String(raw) : "";
}

export function DataFeedbackDialog({ enterprise, defaultContactIndex, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState<FeedbackSubjectKind>(
    defaultContactIndex === undefined ? "enterprise" : "contact",
  );
  const [contactIdx, setContactIdx] = useState(defaultContactIndex ?? 0);
  const [drafts, setDrafts] = useState<Draft[]>([
    { field: "", issue: "wrong", suggested: "" },
  ]);
  const [newContact, setNewContact] = useState<NewContactDraft>(EMPTY_NEW_CONTACT);
  const [sourceType, setSourceType] = useState<FeedbackSourceType | "">("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceNote, setSourceNote] = useState("");
  const [allowContact, setAllowContact] = useState(true);
  const [tab, setTabRaw] = useState<"submit" | "mine">("submit");

  const myTickets = useFeedbacks(enterprise.id);
  const unread = useUnreadFeedbackCount(enterprise.id);

  const setTab = (v: "submit" | "mine") => {
    setTabRaw(v);
    if (v === "mine") markTicketsRead(enterprise.id);
  };

  const contact = enterprise.contacts[contactIdx];
  const fieldDefs =
    subject === "enterprise"
      ? ENTERPRISE_FEEDBACK_FIELDS
      : subject === "contact"
        ? CONTACT_FEEDBACK_FIELDS
        : NEW_CONTACT_FIELDS;

  const currentOf = (key: string): string => {
    if (subject === "new_contact") return "";
    if (subject === "enterprise") return enterpriseValue(enterprise, key);
    if (!contact) return "";
    const raw = (contact as unknown as Record<string, unknown>)[key];
    return raw ? String(raw) : "";
  };

  const reset = () => {
    setSubject(defaultContactIndex === undefined ? "enterprise" : "contact");
    setContactIdx(defaultContactIndex ?? 0);
    setDrafts([{ field: "", issue: "wrong", suggested: "" }]);
    setNewContact(EMPTY_NEW_CONTACT);
    setSourceType("");
    setSourceUrl("");
    setSourceNote("");
    setAllowContact(true);
  };

  const usedFields = drafts.map((d) => d.field).filter(Boolean);

  const validItems = useMemo<FeedbackItem[]>(
    () =>
      subject === "new_contact"
        ? []
        : drafts
            .filter((d) => d.field)
            .map((d) => ({
              field: d.field,
              label: fieldDefs.find((f) => f.key === d.field)?.label ?? d.field,
              current: currentOf(d.field),
              suggested: d.suggested.trim(),
              issue: d.issue,
            })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drafts, subject, contactIdx],
  );

  const newContactFilled = useMemo(
    () =>
      subject === "new_contact"
        ? Boolean(
            newContact.name.trim() &&
              (newContact.email?.trim() ||
                newContact.phone?.trim() ||
                newContact.whatsapp?.trim()),
          )
        : true,
    [subject, newContact],
  );

  const needsUrl = sourceType ? SOURCE_NEEDS_URL.includes(sourceType) : false;
  const missingSuggested = validItems.some(
    (i) => i.issue !== "invalid" && !i.suggested,
  );

  const disabledReason =
    subject === "new_contact"
      ? !newContact.name.trim()
        ? "请填写新增联系人姓名"
        : !newContactFilled
          ? "请至少填写联系邮箱、电话或 WhatsApp 中的一项"
          : !sourceType
            ? "请选择数据来源"
            : needsUrl && !sourceUrl.trim()
              ? "请填写来源链接"
              : sourceType === "other" && !sourceNote.trim()
                ? "请补充说明数据来源"
                : ""
        : !validItems.length
          ? "请至少选择一个存在问题的字段"
          : missingSuggested
            ? "请填写正确值"
            : !sourceType
            ? "请选择数据来源"
            : needsUrl && !sourceUrl.trim()
              ? "请填写来源链接"
              : sourceType === "other" && !sourceNote.trim()
                ? "请补充说明数据来源"
                : "";

  const onSubmit = () => {
    if (disabledReason) return;
    submitFeedback({
      enterpriseId: enterprise.id,
      enterpriseName: enterprise.name,
      subjectKind: subject,
      contactIndex: subject === "contact" ? contactIdx : undefined,
      contactName: subject === "contact" ? contact?.name : undefined,
      newContact: subject === "new_contact" ? newContact : undefined,
      items: validItems,
      sourceType: sourceType as FeedbackSourceType,
      sourceUrl: sourceUrl.trim() || undefined,
      sourceNote: sourceNote.trim() || undefined,
      allowContact,
      submitter: CURRENT_USER.name,
    });
    toast.success("反馈已提交，感谢您的贡献", {
      description: "平台将在 1-3 个工作日内核实，核实通过后数据会自动更新",
    });
    setOpen(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-1.5 relative">
            <MessageSquareWarning className="h-4 w-4" />
            问题反馈
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-4 text-center">
                {unread}
              </span>
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[86vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>问题反馈 · 数据纠错与补充</DialogTitle>
          <DialogDescription>
            可纠正现有企业/联系人数据，也可补充系统中尚未录入的关联人物。请说明数据来源以便平台核实，核实通过后数据会自动更新。
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "submit" | "mine")}>
          <TabsList>
            <TabsTrigger value="submit">提交反馈</TabsTrigger>
            <TabsTrigger value="mine" className="gap-1.5">
              我的反馈
              {myTickets.length > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px] font-normal">
                  {myTickets.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="submit" className="mt-4">
        <div className="space-y-5">
          {/* 反馈对象 */}
          <section className="space-y-2">
            <Label className="text-xs text-muted-foreground">反馈对象</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={subject === "enterprise" ? "default" : "outline"}
                onClick={() => {
                  setSubject("enterprise");
                  setDrafts([{ field: "", issue: "wrong", suggested: "" }]);
                }}
              >
                企业数据
              </Button>
              <Button
                type="button"
                size="sm"
                variant={subject === "contact" ? "default" : "outline"}
                disabled={!enterprise.contacts.length}
                onClick={() => {
                  setSubject("contact");
                  setDrafts([{ field: "", issue: "wrong", suggested: "" }]);
                }}
              >
                关联人物
              </Button>
              <Button
                type="button"
                size="sm"
                variant={subject === "new_contact" ? "default" : "outline"}
                onClick={() => {
                  setSubject("new_contact");
                  setNewContact(EMPTY_NEW_CONTACT);
                }}
              >
                新增关联人物
              </Button>
              {subject === "contact" && (
                <Select
                  value={String(contactIdx)}
                  onValueChange={(v) => {
                    setContactIdx(Number(v));
                    setDrafts([{ field: "", issue: "wrong", suggested: "" }]);
                  }}
                >
                  <SelectTrigger className="h-8 w-[220px]">
                    <SelectValue placeholder="选择联系人" />
                  </SelectTrigger>
                  <SelectContent>
                    {enterprise.contacts.map((c, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {c.name}
                        {c.title ? ` · ${c.title}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Badge variant="secondary" className="ml-auto font-normal">
                {enterprise.name}
              </Badge>
            </div>
          </section>

          {/* 问题字段 / 新增联系人 */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  {subject === "new_contact"
                    ? "新增联系人信息"
                    : "问题字段（可添加多条）"}
                </Label>
                {subject !== "new_contact" && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground"
                        aria-label="问题类型说明"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 text-sm" side="right">
                      <div className="space-y-2">
                        <p className="font-medium">问题类型说明</p>
                        <ul className="space-y-1.5 text-muted-foreground">
                          <li>
                            <span className="font-medium text-foreground">数据错误：</span>
                            系统当前值与客观事实不符，如邮箱/电话写错、行业分类错误。
                          </li>
                          <li>
                            <span className="font-medium text-foreground">数据过期：</span>
                            该值曾经可能正确，但已因企业/联系人状态变化而失效，如联系人离职、公司迁址。
                          </li>
                          <li>
                            <span className="font-medium text-foreground">数据缺失：</span>
                            该字段应当有数据但系统未提供，需补充正确值。
                          </li>
                          <li>
                            <span className="font-medium text-foreground">无效 / 重复：</span>
                            格式明显不规范，或同一家企业/联系人出现重复记录，主要供运营清理。
                          </li>
                        </ul>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
              {subject !== "new_contact" && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs"
                  onClick={() =>
                    setDrafts((d) => [...d, { field: "", issue: "wrong", suggested: "" }])
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加字段
                </Button>
              )}
            </div>

            {subject === "new_contact" ? (
              <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {NEW_CONTACT_FIELDS.map((f) => (
                    <div key={f.key} className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">
                        {f.label}
                        {f.required && <span className="text-destructive ml-0.5">*</span>}
                      </Label>
                      <Input
                        className="h-8"
                        value={newContact[f.key] ?? ""}
                        maxLength={200}
                        placeholder={`请输入${f.label}`}
                        onChange={(ev) =>
                          setNewContact((prev) => ({ ...prev, [f.key]: ev.target.value }))
                        }
                      />
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  邮箱、电话、WhatsApp 至少填写一项，以便平台核实与后续触达。
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {drafts.map((d, i) => {
                  const cur = d.field ? currentOf(d.field) : "";
                  return (
                    <div key={i} className="rounded-lg border bg-muted/20 p-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={d.field}
                          onValueChange={(v) =>
                            setDrafts((arr) =>
                              arr.map((x, k) => (k === i ? { ...x, field: v } : x)),
                            )
                          }
                        >
                          <SelectTrigger className="h-8 w-[200px]">
                            <SelectValue placeholder="选择字段" />
                          </SelectTrigger>
                          <SelectContent>
                            {fieldDefs.map((f) => (
                              <SelectItem
                                key={f.key}
                                value={f.key}
                                disabled={f.key !== d.field && usedFields.includes(f.key)}
                              >
                                {f.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          value={d.issue}
                          onValueChange={(v) =>
                            setDrafts((arr) =>
                              arr.map((x, k) =>
                                k === i ? { ...x, issue: v as FeedbackIssueType } : x,
                              ),
                            )
                          }
                        >
                          <SelectTrigger className="h-8 w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ISSUE_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>
                                {ISSUE_TYPE_LABEL[t]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {drafts.length > 1 && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="ml-auto h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              setDrafts((arr) => arr.filter((_, k) => k !== i))
                            }
                            aria-label="删除该条"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <div className="text-[11px] text-muted-foreground">系统当前值</div>
                          <div className="min-h-8 rounded-md border border-dashed bg-background/60 px-2.5 py-1.5 text-sm text-muted-foreground break-all">
                            {d.field ? cur || "未提供" : "—"}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[11px] text-muted-foreground">
                            正确值
                            {d.issue !== "invalid" && (
                              <span className="text-destructive ml-0.5">*</span>
                            )}
                          </div>
                          <Input
                            className="h-8"
                            value={d.suggested}
                            maxLength={200}
                            placeholder={
                              d.issue === "invalid"
                                ? "如需说明可在下方备注"
                                : "请填写您了解到的正确内容"
                            }
                            onChange={(ev) =>
                              setDrafts((arr) =>
                                arr.map((x, k) =>
                                  k === i ? { ...x, suggested: ev.target.value } : x,
                                ),
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 数据来源 */}
          <section className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">
                  来源类型 <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={sourceType}
                  onValueChange={(v) => setSourceType(v as FeedbackSourceType)}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="请选择来源类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {SOURCE_TYPE_LABEL[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">
                  来源链接 {needsUrl && <span className="text-destructive">*</span>}
                </Label>
                <Input
                  className="h-8"
                  value={sourceUrl}
                  maxLength={300}
                  placeholder="如 https://…"
                  onChange={(ev) => setSourceUrl(ev.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">
                补充说明 {sourceType === "other" && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                rows={3}
                maxLength={500}
                value={sourceNote}
                placeholder="如何获取到该信息、核实时间、可佐证的细节等"
                onChange={(ev) => setSourceNote(ev.target.value)}
              />
            </div>
            <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              提交即表示您确认所提供内容真实合法，平台仅将其用于数据核实与更新。
            </p>
          </section>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={allowContact}
              onCheckedChange={(v) => setAllowContact(Boolean(v))}
            />
            允许平台在核实过程中与我联系
          </label>
        </div>
          </TabsContent>

          <TabsContent value="mine" className="mt-4">
            <MyFeedbackList tickets={myTickets} />
          </TabsContent>
        </Tabs>

        {tab === "submit" ? (
          <DialogFooter className="gap-2 sm:gap-2">
            {disabledReason && (
              <span className="mr-auto self-center text-xs text-muted-foreground">
                {disabledReason}
              </span>
            )}
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button disabled={Boolean(disabledReason)} onClick={onSubmit}>
              提交反馈
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MyFeedbackList({ tickets }: { tickets: FeedbackTicket[] }) {
  if (tickets.length === 0) {
    return (
      <div className="py-14 text-center text-sm text-muted-foreground">
        您还没有对该企业提交过数据反馈
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {[...tickets]
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((t) => (
          <div key={t.id} className="rounded-lg border p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{t.id}</span>
              <Badge variant="secondary" className="font-normal">
                {t.subjectKind === "enterprise"
                  ? "企业数据"
                  : t.subjectKind === "contact"
                    ? `关联人物 · ${t.contactName ?? ""}`
                    : "新增关联人物"}
              </Badge>
              <span
                className={
                  "px-2 py-0.5 rounded-md border text-xs font-medium " +
                  (t.status === "accepted" || t.status === "partial"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : t.status === "rejected" || t.status === "invalid"
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-amber-50 text-amber-700 border-amber-200")
                }
              >
                {STATUS_LABEL[t.status]}
              </span>
              {Boolean(t.reward) && (
                <span className="text-xs font-medium text-emerald-600">
                  +{t.reward} 积分
                </span>
              )}
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {new Date(t.createdAt).toLocaleString("zh-CN", { hour12: false })}
              </span>
            </div>

            <div className="space-y-1 text-xs">
              {t.subjectKind === "new_contact" ? (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {t.newContact?.name}
                    {t.newContact?.title ? ` · ${t.newContact.title}` : ""}
                  </span>
                  {t.newContactVerdict === "reject" && t.newContactRejectReason && (
                    <span className="text-rose-600">
                      未采纳：{REJECT_REASON_LABEL[t.newContactRejectReason]}
                    </span>
                  )}
                </div>
              ) : (
                t.items.map((it, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{it.label}</span>
                    <span className="text-muted-foreground break-all">
                      {it.current || "未提供"} → {it.finalValue ?? it.suggested}
                    </span>
                    {it.verdict === "accept" && (
                      <span className="text-emerald-600">已采纳</span>
                    )}
                    {it.verdict === "reject" && (
                      <span className="text-rose-600">
                        未采纳
                        {it.rejectReason
                          ? `：${REJECT_REASON_LABEL[it.rejectReason]}`
                          : ""}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
    </div>
  );
}
