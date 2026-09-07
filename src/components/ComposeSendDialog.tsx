import { useEffect, useMemo, useRef, useState } from "react";
import {
  Send,
  Sparkles,
  Mailbox as MailboxIcon,
  Loader2,
  Trash2,
  ShieldOff,
  Eye,
  Unlock,
  Mail,
  Phone,
  Info,
  Plus,
  HelpCircle,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Languages,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
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
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import { isSuppressed } from "@/lib/suppressions-store";
import {
  useSmsTemplates,
  toComposeSyntax,
  getTemplateDeliverableRegions,
  regionLabel,
  templateLangs,
  templateCountries,
  type SmsTemplate,
} from "@/lib/sms-templates-store";
import { languageByCode } from "@/lib/languages";
import { FileText } from "lucide-react";

import {
  smsSegments,
  myContext,
  type Recipient,
  type VarContext,
} from "@/lib/message-vars";
import {
  useUsableMailboxes,
  getDefaultUsableMailbox,
  updateMailbox,
  type Mailbox,
} from "@/lib/mailboxes";
import {
  createReach,
  costForChannel,
  COST_VIEW_EMAIL,
  COST_VIEW_PHONE,
  computeReachBreakdown,
  performReachAutoUnlocks,
  useLedger,
} from "@/lib/credits-ledger";
import { useLeadProfile } from "@/lib/lead-profile";
import { useCurrentUser } from "@/lib/current-user";
import { generateAiContent } from "@/lib/api/ai-compose.functions";
import { TargetLangSection } from "@/components/outreach/TargetLangSection";
import { useMyInfoGuard } from "@/lib/my-info-guard";
import { maskContact } from "@/lib/mask-contact";
import { useCreditBalance } from "@/lib/credits-balance";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PHONE_COUNTRIES, detectPhoneCountryName } from "@/lib/phone-country";
import { ManualTargetPanel } from "@/components/outreach/ManualTargetPanel";
import {
  markManualTargetsReached,
  type ManualTargetInput,
} from "@/lib/manual-lists";




export type ComposeChannel = "email" | "phone";

/** 手动添加的收件人：key 以 manual: 开头，不参与解锁扣费 */
const MANUAL_PREFIX = "manual:";
function isManualRecipient(r: Recipient) {
  return r.key.startsWith(MANUAL_PREFIX);
}




export interface ComposeSendDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  channel: ComposeChannel;
  recipients: Recipient[];
  /** 上层选中总数（用于展示"已自动过滤 N 条无地址"） */
  totalSelected?: number;
  /** 选中但暂不能发送的对象（如缺少手机号/邮箱），用于顶部提示横幅 */
  excludedRecipients?: { name: string; reason: string }[];
  /** 已知发件邮箱（来自上层），不传则内部使用默认邮箱 */
  initialSenderId?: string;
  /** 发送成功回调（已扣费、已生成触达记录） */
  onSent?: (count: number) => void;
}

export function ComposeSendDialog({
  open,
  onOpenChange,
  channel,
  recipients: incomingRecipients,
  totalSelected,
  excludedRecipients = [],
  initialSenderId,
  onSent,
}: ComposeSendDialogProps) {
  const isEmail = channel === "email";
  const mailboxes = useUsableMailboxes();
  const profile = useLeadProfile();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const my = myContext(profile, user);
  const callGenerate = useServerFn(generateAiContent);
  const ledger = useLedger();
  const myInfo = useMyInfoGuard();

  const [allRecipients, setAllRecipients] = useState<Recipient[]>(incomingRecipients);
  /** 被取消勾选（本次不发送）的收件人 key，仅影响发送范围，不删除也不影响解锁状态 */
  const [excludedKeys, setExcludedKeys] = useState<Set<string>>(new Set());
  /** 实际参与发送与计费的收件人 */
  const recipients = useMemo(
    () => allRecipients.filter((r) => !excludedKeys.has(r.key)),
    [allRecipients, excludedKeys],
  );
  function toggleRecipient(key: string, checked: boolean) {
    setExcludedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  /** 记录初始进入弹窗时被自动过滤的数量，用于维持“已自动过滤”文案的稳定性 */
  const [initialFilteredCount, setInitialFilteredCount] = useState(0);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [aiUsed, setAiUsed] = useState(false);
  /** 发件邮箱（支持多选，可发送上限为所选邮箱剩余额度之和） */
  const [senderIds, setSenderIds] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  /** 目标语言（发送语言）代码 */
  const [targetLang, setTargetLang] = useState<string>("en");
  /** 目标语言译文（实际发送内容） */
  const [translated, setTranslated] = useState("");
  const [translatedSubject, setTranslatedSubject] = useState("");

  // 短信合规追踪：内容是否来自已报备模板
  const [smsTemplateId, setSmsTemplateId] = useState<string | null>(null);
  const [smsTemplateName, setSmsTemplateName] = useState<string | null>(null);

  /** 短信：当前选择的模板对象 */
  const [smsTpl, setSmsTpl] = useState<SmsTemplate | null>(null);
  /** 短信：各发送语言的文案（单大括号变量语法） */
  const [smsLangContent, setSmsLangContent] = useState<Record<string, string>>({});
  /** 短信：各发送语言的公司名称 */
  const [smsLangCompany, setSmsLangCompany] = useState<Record<string, string>>({});
  /** 短信：各发送语言的产品范围 */
  const [smsLangProducts, setSmsLangProducts] = useState<Record<string, string>>({});
  /** 短信：公司官网（变量） */
  const [smsWebsite, setSmsWebsite] = useState("");
  /** 短信：各收件国家的语言选择覆盖 */
  const [countryLangs, setCountryLangs] = useState<Record<string, string>>({});

  /** 「添加手机号/邮箱」面板开关 */
  const [addOpen, setAddOpen] = useState(false);
  /** 邮件：待发送邮箱列表展开/收起 */
  const [listOpen, setListOpen] = useState(true);

  /** 系统推荐 / 手动添加 分组 */
  const systemRecipients = useMemo(
    () => allRecipients.filter((r) => !isManualRecipient(r)),
    [allRecipients],
  );
  const manualRecipients = useMemo(
    () => allRecipients.filter((r) => isManualRecipient(r)),
    [allRecipients],
  );

  /** 由「手动添加 / 批量导入 / 自建名单」面板回调：值已完成校验与去重 */
  function addManualValues(values: ManualTargetInput[]) {
    if (values.length === 0) return;
    const exist = new Set(allRecipients.map((r) => r.address.toLowerCase()));
    const added: Recipient[] = values
      .filter((v) => !exist.has(v.value.toLowerCase()))
      .map(({ value, name: cname, company }) => {
        const key = `${MANUAL_PREFIX}${value.toLowerCase()}`;
        const name = cname?.trim() || (isEmail ? value.split("@")[0]! : value);
        return {
          key,
          address: value,
          name,
          targetKind: "contact",
          targetId: key,
          ctx: { 联系人名: name, 企业名: company, ...my } as VarContext,
        };
      });
    setAllRecipients((prev) => [...prev, ...added]);
  }

  // 重置 state 每次打开
  useEffect(() => {
    if (!open) return;
    setAllRecipients(incomingRecipients);
    setExcludedKeys(new Set());
    if (typeof totalSelected === "number") {
      setInitialFilteredCount(Math.max(0, totalSelected - incomingRecipients.length));
    } else {
      setInitialFilteredCount(0);
    }
    setAddOpen(false);
    setListOpen(true);
    setSubject("");
    setContent("");
    setAiUsed(false);
    
    setTargetLang("en");
    setTranslated("");
    setTranslatedSubject("");

    setSmsTemplateId(null);
    setSmsTemplateName(null);
    setSmsTpl(null);
    setSmsLangContent({});
    setSmsLangCompany({});
    setSmsLangProducts({});
    setSmsWebsite(profile.website ?? "");
    setCountryLangs({});
    if (isEmail) {
      const def =
        initialSenderId ?? getDefaultUsableMailbox(mailboxes)?.id ?? mailboxes[0]?.id;
      setSenderIds(def ? [def] : []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** 已勾选的发件邮箱（按列表顺序） */
  const senders: Mailbox[] = useMemo(
    () => mailboxes.filter((m) => senderIds.includes(m.id)),
    [mailboxes, senderIds],
  );
  const sender: Mailbox | undefined = senders[0];
  const mailboxRemaining = (m: Mailbox) => Math.max(0, m.dailyLimit - m.sentToday);
  function toggleSender(id: string, checked: boolean) {
    setSenderIds((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id),
    );
  }

  const subjectRef = useRef<HTMLInputElement | null>(null);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  // 退订预检：Dialog 打开即计算，用于顶部非阻塞横幅
  const suppressedRecipients = useMemo(() => {
    const kind = isEmail ? "email" : "phone";
    return recipients.filter((r) => isSuppressed(kind, r.address));
  }, [recipients, isEmail]);

  /** 实际发送内容：有译文则发译文 */
  const sendSubject = (translatedSubject.trim() || subject).trim();
  const sendContent = (translated.trim() || content).trim();

  // —— 短信多语言内容 ——
  const smsLangs = useMemo(() => (smsTpl ? templateLangs(smsTpl) : []), [smsTpl]);
  const recipientCountry = (r: Recipient) =>
    detectPhoneCountryName(r.address) ?? "其他";
  const langFor = (r: Recipient) =>
    countryLangs[recipientCountry(r)] ?? smsLangs[0] ?? "en";
  /** 勾选收件人覆盖的国家（按出现顺序去重） */
  const usedCountries = useMemo(() => {
    const out: string[] = [];
    for (const r of recipients) {
      const c = detectPhoneCountryName(r.address) ?? "其他";
      if (!out.includes(c)) out.push(c);
    }
    return out;
  }, [recipients]);
  /** 实际使用的发送语言（按国家选择汇总） */
  const usedLangs = useMemo(() => {
    const out: string[] = [];
    for (const r of recipients) {
      const l = countryLangs[detectPhoneCountryName(r.address) ?? "其他"] ?? smsLangs[0] ?? "en";
      if (!out.includes(l)) out.push(l);
    }
    return out;
  }, [recipients, countryLangs, smsLangs]);

  /** 渲染某位收件人的最终短信（变量替换，缺值显示占位提示） */
  function renderSmsFor(r: Recipient, lang: string): string {
    const tpl = smsLangContent[lang] ?? "";
    const fill = (v: string | undefined, ph: string) =>
      v && v.trim() ? v.trim() : ph;
    return tpl
      .replace(/\{联系人名\}/g, r.ctx?.联系人名 || r.name)
      .replace(/\{企业名\}/g, r.ctx?.企业名 ?? "")
      .replace(/\{行业\}/g, r.ctx?.行业 ?? "")
      .replace(/\{城市\}/g, r.ctx?.城市 ?? "")
      .replace(/\{我的姓名\}/g, my.我的姓名 ?? "")
      .replace(/\{我的公司\}/g, fill(smsLangCompany[lang], "【请填写公司名称】"))
      .replace(/\{产品范围\}/g, fill(smsLangProducts[lang], "【请填写产品范围】"))
      .replace(/\{公司官网\}/g, fill(smsWebsite, "【请填写公司官网】"));
  }

  /** 每位收件人的计费条数 */
  const smsSegMap = useMemo(() => {
    const m = new Map<string, number>();
    if (isEmail || !smsTpl) return m;
    for (const r of recipients) m.set(r.key, smsSegments(renderSmsFor(r, langFor(r))));
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEmail, smsTpl, recipients, smsLangContent, smsLangCompany, smsLangProducts, smsWebsite, countryLangs, smsLangs]);
  const totalSegments = useMemo(
    () => [...smsSegMap.values()].reduce((a, b) => a + b, 0),
    [smsSegMap],
  );

  /** 语言不一致预警：非中文文案中出现中文字符（忽略占位提示） */
  const mismatchLangs = useMemo(() => {
    if (isEmail || !smsTpl) return [] as string[];
    const CJK = /[\u4e00-\u9fff]/;
    const out: string[] = [];
    for (const lang of usedLangs) {
      if (lang === "zh") continue;
      const sample = recipients
        .filter((r) => langFor(r) === lang)
        .map((r) => renderSmsFor(r, lang).replace(/【[^】]*】/g, ""))
        .join("");
      if (CJK.test(sample)) out.push(lang);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEmail, smsTpl, recipients, usedLangs, smsLangContent, smsLangCompany, smsLangProducts, smsWebsite, countryLangs]);

  // 费用合计
  const unit = costForChannel(isEmail ? "email" : "phone");
  const segments = isEmail ? 1 : smsSegments(sendContent || "");

  const sendCostPerRecipient = isEmail ? unit : unit * segments;
  const sendTotal = isEmail
    ? recipients.length * sendCostPerRecipient
    : totalSegments * unit;

  // 未解锁字段的自动查看费合计（按每个收件人独立判断）
  const viewCostTotal = useMemo(() => {
    let total = 0;
    for (const r of recipients) {
      // 手动添加的收件人地址由用户自行提供，无需解锁、不产生查看费
      if (isManualRecipient(r)) continue;
      const bd = computeReachBreakdown(
        { targetKind: r.targetKind, targetId: r.targetId },
        isEmail ? "email" : "phone",
        undefined,
        { reachCostOverride: 0 },
      );
      total += bd.viewCost;
    }
    return total;
    // 依赖 ledger 版本以在解锁状态变化时重算
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipients, isEmail, ledger]);

  /** 单条解锁单价 */
  const unitView = isEmail ? COST_VIEW_EMAIL : COST_VIEW_PHONE;

  /** 尚未解锁明文的收件人 key 集合（含未勾选项；手动添加的除外） */
  const lockedKeys = useMemo(() => {
    const s = new Set<string>();
    for (const r of allRecipients) {
      if (isManualRecipient(r)) continue;
      const bd = computeReachBreakdown(
        { targetKind: r.targetKind, targetId: r.targetId },
        isEmail ? "email" : "phone",
        undefined,
        { reachCostOverride: 0 },
      );
      if (bd.viewCost > 0) s.add(r.key);
    }
    return s;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allRecipients, isEmail, ledger]);

  /** 已勾选且未解锁的收件人数 */
  const lockedActiveCount = recipients.filter((r) => lockedKeys.has(r.key)).length;


  /** 主动解锁明文：立即扣费、永久有效（幂等） */
  function unlockOne(r: Recipient) {
    performReachAutoUnlocks({
      targetKind: r.targetKind,
      targetId: r.targetId,
      targetName: r.name,
      parentRef: r.parentRef,
      detail: r.address,
      fields: isEmail ? [{ field: "email" }] : [{ field: "phone" }],
    });
    toast.success(`已解锁 ${r.name} 的${isEmail ? "邮箱" : "电话"}`, {
      description: `扣除 ${unitView} 积分，永久有效`,
    });
  }

  const [unlockAllOpen, setUnlockAllOpen] = useState(false);
  const [unlockAllAck, setUnlockAllAck] = useState(false);
  /** 短信：选择模板前必须先解锁全部目标 */
  const [smsUnlockGateOpen, setSmsUnlockGateOpen] = useState(false);

  function unlockAll() {
    const targets = recipients.filter((r) => lockedKeys.has(r.key));
    targets.forEach((r) =>
      performReachAutoUnlocks({
        targetKind: r.targetKind,
        targetId: r.targetId,
        targetName: r.name,
        parentRef: r.parentRef,
        detail: r.address,
        fields: isEmail ? [{ field: "email" }] : [{ field: "phone" }],
      }),
    );
    setUnlockAllOpen(false);
    setUnlockAllAck(false);
    toast.success(`已解锁 ${targets.length} 位联系人的明文`, {
      description: `扣除 ${targets.length * unitView} 积分，永久有效`,
    });
  }

  // 短信：目标须在选择模板前全部解锁，发送时不再产生解锁查看费
  const grandTotal = sendTotal + (isEmail ? viewCostTotal : 0);

  const { balance: myBalance } = useCreditBalance();


  // 发件邮箱日发上限剩余额度合计（仅邮件；多选时为各邮箱剩余之和）
  const remainingQuota = isEmail
    ? senders.reduce((sum, m) => sum + mailboxRemaining(m), 0)
    : Infinity;
  const overLimit = isEmail && senders.length > 0 && recipients.length > remainingQuota;

  /** 短信：各语言文案是否齐备 */
  const smsContentReady =
    isEmail ||
    (!!smsTpl &&
      usedLangs.length > 0 &&
      usedLangs.every((l) => (smsLangContent[l] ?? "").trim().length > 0));
  /** 短信：变量信息是否齐备（官网 / 各语言公司名称 / 产品范围） */
  const smsVarsMissing =
    !isEmail &&
    !!smsTpl &&
    (!smsWebsite.trim() ||
      usedLangs.some(
        (l) =>
          !(smsLangCompany[l] ?? "").trim() || !(smsLangProducts[l] ?? "").trim(),
      ));

  const canSend =
    recipients.length > 0 &&
    (!isEmail || senders.length > 0) &&
    (!isEmail || sendSubject.length > 0) &&
    (isEmail ? sendContent.length > 0 : smsContentReady && !smsVarsMissing) &&
    (isEmail || lockedActiveCount === 0) &&
    !overLimit;

  /** 按钮禁用原因（可解释禁用态） */
  const disabledReason = !canSend
    ? recipients.length === 0
      ? "请先选择收件目标"
      : isEmail && senders.length === 0
        ? "请选择发件邮箱"
        : isEmail && !sendSubject
          ? "请填写邮件主题"
          : !isEmail && lockedActiveCount > 0
            ? "请先解锁全部目标电话"
            : !isEmail && !smsTemplateId
              ? "请选择短信模板"
              : !isEmail && smsVarsMissing
                ? "请补全公司官网 / 公司名称 / 产品范围"
                : isEmail && !sendContent
                  ? "请填写实际发送内容"
                  : overLimit
                    ? "超出发件邮箱当日发送上限"
                    : "请补全必填项"
    : "";


  function doSend() {
    if (!canSend) return;
    // 过滤退订名单
    const kind = isEmail ? "email" : "phone";
    const blocked = recipients.filter((r) => isSuppressed(kind, r.address));
    const active = recipients.filter((r) => !isSuppressed(kind, r.address));
    if (active.length === 0) {
      toast.error(`所有收件人均在退订名单中，已阻止发送`);
      return;
    }
    let n = 0;
    // 多发件邮箱：按各自剩余额度依次分配
    const plan: Mailbox[] = [];
    if (isEmail) {
      for (const m of senders) {
        for (let i = 0; i < mailboxRemaining(m) && plan.length < active.length; i++) {
          plan.push(m);
        }
      }
    }
    const sentBy = new Map<string, number>();
    for (const r of active) {
      const useMailbox = isEmail ? plan[n] : undefined;
      const finalSubject = isEmail ? sendSubject : undefined;
      const finalContent = isEmail
        ? sendContent
        : renderSmsFor(r, langFor(r));
      const reachCost = isEmail
        ? sendCostPerRecipient
        : unit * (smsSegMap.get(r.key) ?? 1);

      // 邮件：未解锁时先扣查看费并永久解锁（幂等）；手动添加的地址无需解锁
      // 短信：目标须在选择模板前已全部解锁，此处不再自动解锁扣费
      if (isEmail && !isManualRecipient(r)) {
        performReachAutoUnlocks({
          targetKind: r.targetKind,
          targetId: r.targetId,
          targetName: r.name,
          parentRef: r.parentRef,
          detail: r.address,
          fields: [{ field: "email" }],
        });
      }

      createReach({
        targetKind: r.targetKind,
        targetId: r.targetId,
        targetName: r.name,
        parentRef: r.parentRef,
        channel: isEmail ? "email" : "phone",
        detail: r.address,
        senderEmail: useMailbox?.email,
        subject: finalSubject,
        content: finalContent,
        aiGenerated: aiUsed,
        cost: reachCost,
      });
      if (useMailbox) {
        sentBy.set(useMailbox.id, (sentBy.get(useMailbox.id) ?? 0) + 1);
      }
      n++;
    }
    // 累加各发件邮箱当日已发送数
    if (isEmail) {
      for (const [id, count] of sentBy) {
        const m = mailboxes.find((x) => x.id === id);
        if (m) updateMailbox(m.id, { sentToday: m.sentToday + count });
      }
    }
    // 自建名单：标记已触达
    markManualTargetsReached(active.map((r) => r.address));
    onOpenChange(false);
    onSent?.(n);
    if (blocked.length > 0) {
      toast.warning(`已跳过 ${blocked.length} 个退订联系人`, {
        description: blocked.slice(0, 3).map((b) => b.address).join("、") +
          (blocked.length > 3 ? ` 等 ${blocked.length} 个` : ""),
      });
    }
    toast.success(
      isEmail
        ? `已加入发送队列：${n} 封邮件`
        : `已加入发送队列：${n} 条短信`,
      {
        description: `共扣除 ${grandTotal} 积分${
          isEmail && viewCostTotal > 0 ? `（含自动解锁查看 ${viewCostTotal} 积分）` : ""
        }，可在「触达」模块查看进度`,

      },
    );
  }

  function handleSend() {
    if (!canSend) return;
    doSend();
  }

  async function handleAiGenerate() {
    if (aiLoading) return;
    if (!myInfo.ensure()) return;
    setAiLoading(true);
    try {
      const res = await callGenerate({
        data: {
          channel: isEmail ? "email" : "sms",
          scene: "开发信",
          tone: "friendly",
          language: "zh",
          languageName: "中文",
          myCompany: profile.companyName,
          myName: user.name,
          literal: true,
        },
      });
      const post = (t: string) => myInfo.fillAll(t);
      if (isEmail && res.subject) setSubject(post(res.subject));
      if (res.content) setContent(post(res.content));
      setAiUsed(true);
      // AI 生成 → 视为未报备草稿
      if (!isEmail) {
        setSmsTemplateId(null);
        setSmsTemplateName(null);
      }
      toast.success(`AI 已生成${isEmail ? "邮件" : "短信"}首次接触文案`, {
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
            <Send className="h-5 w-5 text-primary" />
            {isEmail ? "撰写并发送邮件" : "撰写并发送短信"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            撰写发送内容并确认积分消耗
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* 收件人 */}
          {isEmail ? (
          /* ============ 邮件：待发送邮箱列表 ============ */
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">收件人</span>
              <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">
                {recipients.length} 个收信人
              </span>
            </div>

            <div className="rounded-lg border">
              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">待发送邮箱列表</span>
                  <span className="text-xs text-muted-foreground">
                    当前 {allRecipients.length} 个邮箱
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-primary hover:text-primary"
                    onClick={() => {
                      setListOpen(true);
                      setAddOpen((v) => !v);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    手动添加
                  </Button>
                  <button
                    type="button"
                    onClick={() => setListOpen((v) => !v)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted"
                    aria-label={listOpen ? "收起列表" : "展开列表"}
                  >
                    {listOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {listOpen && (
                <div className="space-y-2.5 px-3 pb-3">
                  {lockedActiveCount > 0 && (
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Info className="h-3.5 w-3.5 text-primary" />
                        已选的 {lockedActiveCount} 个邮箱未解锁，可在此直接解锁后发送
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-primary/40 text-primary hover:text-primary"
                        onClick={() => {
                          setUnlockAllAck(false);
                          setUnlockAllOpen(true);
                        }}
                      >
                        <Unlock className="h-3.5 w-3.5 mr-1" />
                        全部解锁 · -{lockedActiveCount * unitView}
                      </Button>
                    </div>
                  )}

                  {addOpen && (
                    <ManualTargetPanel
                      channel="email"
                      existing={allRecipients.map((r) => r.address)}
                      manualCount={manualRecipients.length}
                      onAdd={addManualValues}
                    />
                  )}

                  {suppressedRecipients.length > 0 && (
                    <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                      <div className="flex items-start gap-2">
                        <ShieldOff className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
                        <span>
                          本批次含 {suppressedRecipients.length} 个退订邮箱，发送时将自动跳过
                        </span>
                      </div>
                    </div>
                  )}

                  {allRecipients.length === 0 && excludedRecipients.length === 0 ? (
                    <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                      暂无收件邮箱，可点击「手动添加」补充
                    </div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto space-y-2 pr-0.5">
                      {systemRecipients.length > 0 && (
                        <>
                          <div className="text-xs text-muted-foreground">系统推荐</div>
                          {systemRecipients.map((r) => {
                            const locked = lockedKeys.has(r.key);
                            const checked = !excludedKeys.has(r.key);
                            return (
                              <div
                                key={r.key}
                                className={cn(
                                  "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
                                  checked
                                    ? "border-primary/50 bg-primary/5"
                                    : "border-border bg-background opacity-70",
                                )}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) => toggleRecipient(r.key, v === true)}
                                />
                                <span className="text-sm truncate max-w-[220px]">{r.name}</span>
                                <span className="text-sm text-muted-foreground">邮箱：</span>
                                <span className="font-mono text-sm truncate">
                                  {locked ? maskContact("email", r.address) : r.address}
                                </span>
                                {locked && (
                                  <button
                                    type="button"
                                    onClick={() => unlockOne(r)}
                                    className="ml-auto inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10"
                                    title={`解锁明文，扣 ${unitView} 积分（永久有效）`}
                                  >
                                    <Eye className="h-3 w-3" />
                                    {unitView}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </>
                      )}

                      {excludedRecipients.map((x) => (
                        <div
                          key={`ex-${x.name}`}
                          className="px-3 py-1.5 text-xs text-muted-foreground"
                        >
                          {x.name} · {x.reason}
                        </div>
                      ))}

                      {manualRecipients.length > 0 && (
                        <>
                          <div className="text-xs text-muted-foreground pt-1">手动添加</div>
                          {manualRecipients.map((r) => {
                            const checked = !excludedKeys.has(r.key);
                            return (
                              <div
                                key={r.key}
                                className={cn(
                                  "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
                                  checked
                                    ? "border-primary/50 bg-primary/5"
                                    : "border-border bg-background opacity-70",
                                )}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) => toggleRecipient(r.key, v === true)}
                                />
                                <span className="font-mono text-sm truncate">{r.address}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAllRecipients((prev) =>
                                      prev.filter((x) => x.key !== r.key),
                                    )
                                  }
                                  className="ml-auto rounded p-1 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                                  aria-label="删除"
                                  title="删除该手动添加的邮箱"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
              <span>手动添加的邮箱由你自行提供，不产生解锁查看费，仅按渠道计发送费。</span>
            </div>
          </section>
          ) : (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">收件人</span>
                <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">
                  {recipients.length} 个收件人
                </span>
                {lockedActiveCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    · {lockedActiveCount} 位{isEmail ? "邮箱" : "电话"}未解锁，默认脱敏展示
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  已选择收藏 {totalSelected ?? allRecipients.length + excludedRecipients.length} · 当前可发送 {recipients.length} · 已排除 {excludedKeys.size + excludedRecipients.length}
                </span>
                {lockedActiveCount > 0 && (
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
                    全部解锁 · -{lockedActiveCount * unitView}
                  </Button>
                )}
              </div>
            </div>

            {/* 添加收件人入口 */}
            <Button
              type="button"
              className="w-full"
              variant={addOpen ? "secondary" : "default"}
              onClick={() => setAddOpen((v) => !v)}
            >
              <Plus className="h-4 w-4" />
              添加{isEmail ? "邮箱" : "手机号"}
            </Button>

            {/* 暂不能发送提示 */}
            {excludedRecipients.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="font-medium">
                      {excludedRecipients.length} 位联系人暂不能发送
                    </div>
                    <div className="text-amber-800 dark:text-amber-300/90">
                      {excludedRecipients
                        .map((x) => `${x.name}：${x.reason}`)
                        .join("；")}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 说明 */}
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
              <span>
                {isEmail
                  ? "收藏中的邮箱会自动带入；也可以手动添加只用于本次发送的邮箱"
                  : "收藏中的手机号会自动带入；也可以手动添加只用于本次发送的号码，选择国家后按提示填写"}
              </span>
            </div>

            {/* 手动添加面板 */}
            {addOpen && (
              <ManualTargetPanel
                channel="phone"
                existing={allRecipients.map((r) => r.address)}
                manualCount={manualRecipients.length}
                onAdd={addManualValues}
              />
            )}

            {suppressedRecipients.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <div className="flex items-start gap-2">
                  <ShieldOff className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">
                      本批次含 {suppressedRecipients.length} 个退订{isEmail ? "邮箱" : "手机号"}，发送时将自动跳过
                    </div>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-amber-800 hover:underline select-none">
                        查看名单
                      </summary>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {suppressedRecipients.map((r) => (
                          <span
                            key={r.key}
                            className="inline-flex items-center gap-1 rounded border border-amber-200 bg-white/70 px-1.5 py-0.5 font-mono text-[11px]"
                          >
                            {r.name} ·{" "}
                            {lockedKeys.has(r.key)
                              ? maskContact(isEmail ? "email" : "phone", r.address)
                              : r.address}

                          </span>
                        ))}
                      </div>
                    </details>
                  </div>
                </div>
              </div>
            )}

            {/* 收件人列表 */}
            {allRecipients.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">系统推荐</div>
                <div className="max-h-64 overflow-y-auto space-y-2 pr-0.5">
                  {allRecipients.map((r) => {
                    const manual = isManualRecipient(r);
                    const locked = !manual && lockedKeys.has(r.key);
                    const checked = !excludedKeys.has(r.key);
                    const remove = () =>
                      setAllRecipients((prev) => prev.filter((x) => x.key !== r.key));
                    const country = !isEmail
                      ? detectPhoneCountryName(r.address)
                      : undefined;
                    return (
                      <div
                        key={r.key}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
                          checked
                            ? "border-primary/50 bg-primary/5"
                            : "border-border bg-background opacity-70",
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleRecipient(r.key, v === true)}
                        />
                        {isEmail ? (
                          <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="font-mono text-sm">
                          {locked
                            ? maskContact(isEmail ? "email" : "phone", r.address)
                            : r.address}
                        </span>
                        {country && (
                          <Badge
                            variant="outline"
                            className="h-5 shrink-0 border-primary/40 text-primary text-[11px] font-normal"
                          >
                            {country}
                          </Badge>
                        )}
                        {manual && (
                          <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                            手动添加
                          </Badge>
                        )}
                        <span className="text-sm truncate text-foreground/90">
                          {r.name}
                        </span>
                        <div className="ml-auto flex items-center gap-1">
                          {locked && (
                            <button
                              type="button"
                              onClick={() => unlockOne(r)}
                              className="inline-flex items-center gap-1 rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10"
                              title={`解锁明文，扣 ${unitView} 积分（永久有效）`}
                            >
                              <Eye className="h-3 w-3" />
                              {unitView}
                            </button>
                          )}
                          {manual && (
                            <button
                              type="button"
                              onClick={remove}
                              className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              aria-label="删除"
                              title="删除该手动添加的收件人"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                {excludedRecipients.length > 0
                  ? `已选对象均无可用${isEmail ? "邮箱" : "手机号"}，可点击上方按钮手动添加`
                  : `暂无收件人，可点击上方按钮手动添加`}
              </div>
            )}
          </section>
          )}

          {/* 发件人（邮件） */}
          {isEmail && (
            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <MailboxIcon className="h-3.5 w-3.5" /> 发件邮箱（可多选）
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  已选 {senders.length} 个 · 本次最多可发送 {remainingQuota} 封
                </span>
              </div>
              {mailboxes.length === 0 ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  尚未配置发件邮箱。
                  <button
                    type="button"
                    className="underline ml-1"
                    onClick={() => {
                      onOpenChange(false);
                      navigate({ to: "/outreach/mailboxes" });
                    }}
                  >
                    去设置
                  </button>
                </div>
              ) : (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        senders.length > 0
                          ? "border-primary/50 bg-primary/5"
                          : "border-border bg-background",
                      )}
                    >
                      <span className="flex-1 truncate">
                        {senders.length === 0 ? (
                          <span className="text-muted-foreground">请选择发件邮箱</span>
                        ) : (
                          <span className="font-mono text-xs">
                            {senders.map((m) => m.email).join("、")}
                          </span>
                        )}
                      </span>
                      {senders.length > 0 && (
                        <Badge variant="secondary" className="h-4 shrink-0 px-1 text-[10px]">
                          已选 {senders.length}
                        </Badge>
                      )}
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-1.5">
                    <div className="max-h-60 space-y-0.5 overflow-y-auto">
                      {mailboxes.map((m) => {
                        const checked = senderIds.includes(m.id);
                        const left = mailboxRemaining(m);
                        return (
                          <label
                            key={m.id}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/60",
                              checked && "bg-primary/5",
                            )}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => toggleSender(m.id, v === true)}
                            />
                            <span className="font-mono text-xs truncate">{m.email}</span>
                            {m.isDefault && (
                              <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                                默认
                              </Badge>
                            )}
                            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                              今日剩余 {left}/{m.dailyLimit}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              {senders.length > 0 && (
                <div
                  className={cn(
                    "rounded-md border p-2 text-xs flex items-center justify-between gap-2",
                    overLimit
                      ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300"
                      : "border-muted bg-muted/40 text-muted-foreground",
                  )}
                >
                  <span>
                    所选 {senders.length} 个邮箱 ·
                    <span className="font-medium ml-1">合计剩余 {remainingQuota} 封</span>
                    <span className="ml-1">
                      （系统按各邮箱剩余额度依次分配发送）
                    </span>
                    {overLimit && (
                      <span className="ml-2">
                        当前选择 {recipients.length} 条，超出 {recipients.length - remainingQuota} 条
                      </span>
                    )}
                  </span>
                  {overLimit && remainingQuota > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setAllRecipients((prev) => prev.slice(0, remainingQuota))
                      }
                      className="shrink-0 rounded border border-rose-300 bg-white px-2 py-0.5 font-medium hover:bg-rose-100"
                    >
                      仅保留前 {remainingQuota} 条
                    </button>
                  )}
                </div>
              )}
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
                    className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                  >
                    <Sparkles className="h-3 w-3" />
                    AI 已生成 · 可手动调整
                  </Badge>
                )}
              </Label>
              <div className={cn("flex items-center gap-2", !isEmail && "hidden")}>
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
                  {aiLoading
                    ? "生成中…"
                    : aiUsed
                      ? "AI 重新生成"
                      : "AI 生成文案"}
                </Button>
              </div>
            </div>

            {!isEmail && (
              <div className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm">
                    选择短信内容 <span className="text-rose-500">*</span>
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Info className="h-3.5 w-3.5 text-primary" />
                    选择后可以预览每位收件人将收到的内容
                  </span>
                </div>
                <SmsTemplatePicker
                  currentId={smsTemplateId}
                  beforePick={() => {
                    if (lockedActiveCount > 0) {
                      setSmsUnlockGateOpen(true);
                      return false;
                    }
                    return true;
                  }}
                  onPick={(t) => {

                    const langs = templateLangs(t);
                    const contents: Record<string, string> = {};
                    const comps: Record<string, string> = {};
                    const prods: Record<string, string> = {};
                    for (const l of langs) {
                      contents[l] = toComposeSyntax(
                        t.translations?.[l] ?? t.translations?.en ?? t.content,
                      );
                      comps[l] = profile.companyName;
                      prods[l] = profile.mainProducts.join("、");
                    }
                    setSmsTpl(t);
                    setSmsLangContent(contents);
                    setSmsLangCompany(comps);
                    setSmsLangProducts(prods);
                    setCountryLangs({});
                    setSmsWebsite(profile.website ?? "");
                    setSmsTemplateId(t.id);
                    setSmsTemplateName(t.name);
                    // 自动取消勾选模板不支持地区的收件人
                    const allowed = templateCountries(t);
                    if (allowed.length > 0) {
                      const off = allRecipients.filter(
                        (r) =>
                          !allowed.includes(
                            detectPhoneCountryName(r.address) ?? "其他",
                          ),
                      );
                      if (off.length > 0) {
                        setExcludedKeys((prev) => {
                          const next = new Set(prev);
                          off.forEach((r) => next.add(r.key));
                          return next;
                        });
                        toast.info(
                          `已自动取消勾选 ${off.length} 位不在模板支持地区的收件人`,
                          { description: `模板支持地区：${allowed.join("、")}` },
                        );
                      }
                    }
                    setContent(toComposeSyntax(t.content));
                    setAiUsed(false);
                  }}
                />
                {smsTpl && (
                  <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                      {smsTpl.channel === "otp"
                        ? "验证码"
                        : smsTpl.channel === "marketing"
                          ? "营销"
                          : "通知"}
                    </Badge>
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                      <Languages className="h-3 w-3" />
                      发送语言会按国家自动匹配
                    </span>
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                      可用语言：{smsLangs.map((l) => languageByCode(l)?.zh ?? l).join(" / ")}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                      支持国家：{templateCountries(smsTpl).join(" / ")}
                    </span>
                  </div>
                )}
              </div>
            )}

            {isEmail && (
            <div className="grid gap-0 lg:grid-cols-2 lg:divide-x rounded-md border overflow-hidden">
              <div className="space-y-2 p-3">
                <div className="flex h-8 items-center">
                  <Label className="text-xs text-muted-foreground">中文原文</Label>
                </div>

                {isEmail && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">主题</Label>
                    <Input
                      ref={subjectRef}
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      maxLength={120}
                      placeholder="例：关于出口合作的提案"
                    />
                  </div>
                )}

                <Textarea
                  ref={contentRef}
                  value={content}
                  readOnly={!isEmail}
                  className={cn(!isEmail && "bg-muted/40 cursor-not-allowed")}
                  onChange={(e) => {
                    if (!isEmail) return;
                    setContent(e.target.value);
                  }}
                  rows={isEmail ? 8 : 6}
                  maxLength={isEmail ? 5000 : 300}
                  placeholder={
                    isEmail
                      ? "您好，我是××公司的×××……"
                      : "您好，我是××公司的×××……"
                  }
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {content.length} / {isEmail ? 5000 : 300} 字
                    {!isEmail && content && (
                      <span className="ml-2">· 拆分 {smsSegments(content)} 条</span>
                    )}
                  </span>
                </div>
              </div>

              {/* 目标语言文案（实际发送内容） */}
              <TargetLangSection
                source={content}
                sourceSubject={isEmail ? subject : undefined}
                lang={targetLang}
                onLangChange={setTargetLang}
                value={translated}
                onChange={setTranslated}
                subjectValue={isEmail ? translatedSubject : undefined}
                onSubjectChange={isEmail ? setTranslatedSubject : undefined}
                rows={isEmail ? 8 : 6}
                kindLabel={isEmail ? "邮件" : "短信"}
                bare
              />

            </div>
            )}
          </section>

          {/* 发送语言（短信） */}
          {!isEmail && smsTpl && (
            <section className="space-y-2">
              <Label className="text-sm font-medium">发送语言</Label>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Info className="h-3.5 w-3.5 text-primary" />
                系统会按收件人所在国家自动选择；有多个选择时可以调整
              </p>
              {usedCountries.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {usedCountries.map((c) => (
                    <div
                      key={c}
                      className="flex items-center gap-1 rounded-full border bg-background pl-3 pr-1 py-0.5"
                    >
                      <span className="text-xs font-medium">{c}</span>
                      <span className="text-xs text-muted-foreground">|</span>
                      <Select
                        value={countryLangs[c] ?? smsLangs[0] ?? "en"}
                        onValueChange={(v) =>
                          setCountryLangs((p) => ({ ...p, [c]: v }))
                        }
                      >
                        <SelectTrigger className="h-6 w-auto gap-1 border-0 bg-transparent px-1 text-xs shadow-none focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {smsLangs.map((l) => (
                            <SelectItem key={l} value={l} className="text-xs">
                              {languageByCode(l)?.zh ?? l}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* 补充短信信息（短信） */}
          {!isEmail && smsTpl && (
            <section className="space-y-2">
              <Label className="text-sm font-medium">补充短信信息</Label>
              <div className="flex items-start gap-1.5 rounded-md border border-primary/30 bg-primary/5 p-2 text-xs text-muted-foreground">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                建议变量内容使用收件人所在国家或地区的当地语言，确保整条短信语言一致。
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  公司官网 <span className="text-rose-500">*</span>
                  <span className="ml-1 text-[10px]">（已从企业信息自动填写，可修改）</span>
                </Label>
                <Input
                  value={smsWebsite}
                  onChange={(e) => setSmsWebsite(e.target.value)}
                  placeholder="https://"
                  className="h-8 text-sm"
                />
              </div>
              {usedLangs.map((lang) => (
                <div key={lang} className="rounded-md border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {languageByCode(lang)?.zh ?? lang}短信信息
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1"
                      onClick={() => {
                        const tr = smsTpl.translations?.[lang];
                        if (tr) {
                          setSmsLangContent((p) => ({
                            ...p,
                            [lang]: toComposeSyntax(tr),
                          }));
                          toast.success(
                            `已生成${languageByCode(lang)?.zh ?? lang}翻译`,
                            { description: "请确认品牌名称是否准确" },
                          );
                        } else {
                          toast.info(
                            `该模板暂无${languageByCode(lang)?.zh ?? lang}译文，可手动调整公司名称等信息`,
                          );
                        }
                      }}
                    >
                      <Languages className="h-3.5 w-3.5 text-primary" />
                      翻译
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    翻译结果仅用于当前发送，生成后请确认品牌名称是否准确。
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        公司名称 <span className="text-rose-500">*</span>
                        <span className="ml-1 text-[10px]">（可修改）</span>
                      </Label>
                      <Input
                        value={smsLangCompany[lang] ?? ""}
                        onChange={(e) =>
                          setSmsLangCompany((p) => ({
                            ...p,
                            [lang]: e.target.value,
                          }))
                        }
                        placeholder="请填写公司名称"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        产品范围 <span className="text-rose-500">*</span>
                        <span className="ml-1 text-[10px]">
                          （已从企业主营产品自动填写，可修改）
                        </span>
                      </Label>
                      <Input
                        value={smsLangProducts[lang] ?? ""}
                        onChange={(e) =>
                          setSmsLangProducts((p) => ({
                            ...p,
                            [lang]: e.target.value,
                          }))
                        }
                        placeholder="请填写产品范围"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
              {mismatchLangs.length > 0 && (
                <div className="flex items-start gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  短信内容中包含与发送语言（
                  {mismatchLangs.map((l) => languageByCode(l)?.zh ?? l).join("、")}
                  ）不一致的文字，请点击“翻译”或修改内容后再创建任务。
                </div>
              )}
            </section>
          )}

          {/* 发送前预览（短信） */}
          {!isEmail && smsTpl && recipients.length > 0 && (
            <section className="space-y-2">
              <Label className="text-sm font-medium">发送前预览</Label>
              <div className="flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                这是将要发送的短信内容 · 只读
              </div>
              <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {recipients.map((r) => {
                  const lang = langFor(r);
                  const text = renderSmsFor(r, lang);
                  const segs = smsSegments(text);
                  return (
                    <div key={r.key} className="rounded-md border p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium truncate">
                          {r.ctx?.联系人名 || r.name} · {recipientCountry(r)} ·{" "}
                          {languageByCode(lang)?.zh ?? lang}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {text.length} 字符 · 计费 {segs} 条
                        </span>
                      </div>
                      <Textarea
                        readOnly
                        value={text}
                        rows={2}
                        className="resize-none border-amber-200 bg-amber-50/60 text-xs cursor-default dark:border-amber-900/50 dark:bg-amber-950/20"
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 费用 */}
          {!isEmail ? (
            <section className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs space-y-1 dark:border-rose-900/50 dark:bg-rose-950/30">
              <div className="flex justify-between">
                <span className="text-muted-foreground">可发送收件人</span>
                <span className="font-medium">{recipients.length} 人</span>
              </div>
              <div className="flex justify-between">
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  预计计费条数
                  <HelpCircle
                    className="h-3 w-3"
                    aria-label="长短信会按每 70/140 字符拆分为多条计费，详见 积分规则 › 发送短信"
                  />
                </span>
                <span className="font-medium">
                  {smsTpl ? `${totalSegments} 条` : "0 条"}
                </span>
              </div>


              <div className="flex justify-between border-t border-rose-200/70 pt-1 dark:border-rose-900/50">
                <span className="font-semibold text-rose-700 dark:text-rose-300">
                  预计消耗积分
                </span>
                <span className="font-semibold text-rose-700 dark:text-rose-300">
                  {smsTpl ? `${grandTotal} 积分` : "—"}
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>当前余额</span>
                <span>{myBalance} 积分</span>
              </div>
              <div className="text-[11px] text-rose-700/80 pt-0.5 dark:text-rose-300/80">
                短信内容较长时可能拆分为多条计费；费用会实时计算，创建任务前还会再次确认。
              </div>
              <div className="text-[11px] text-muted-foreground">
                目标电话需在选择短信模板前完成解锁，发送短信不再收取解锁查看费。
              </div>

            </section>
          ) : (
            <section className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs space-y-1 dark:border-rose-900/50 dark:bg-rose-950/30">
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  发送费用（{recipients.length} 封 × {sendCostPerRecipient} 积分）
                </span>
                <span className="font-medium">{sendTotal} 积分</span>
              </div>
              {viewCostTotal > 0 && (() => {
                const unlockCount = Math.round(viewCostTotal / unitView);
                const alreadyCount = recipients.length - unlockCount;
                return (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      发送后解锁邮箱（{unlockCount} 位未解锁
                      收件人 × {unitView} 积分
                      {alreadyCount > 0 ? `，另 ${alreadyCount} 位已解锁免费` : ""}
                      ，永久生效）
                    </span>
                    <span className="font-medium">{viewCostTotal} 积分</span>
                  </div>
                );
              })()}

              <div className="flex justify-between border-t border-rose-200/70 pt-1 dark:border-rose-900/50">
                <span className="font-semibold text-rose-700 dark:text-rose-300">
                  合计
                </span>
                <span className="font-semibold text-rose-700 dark:text-rose-300">
                  {grandTotal} 积分
                </span>
              </div>
              {viewCostTotal > 0 && (
                <div className="text-[11px] text-rose-700/80 pt-0.5 dark:text-rose-300/80">
                  触达完成后，对应邮箱将永久解锁，后续查看/再次触达不再收取查看费。
                </div>
              )}
            </section>
          )}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">{disabledReason}</div>
          <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleSend}
            disabled={!canSend}
            className="bg-primary"
          >
            <Send className="h-4 w-4" />
            {isEmail
              ? `确认发送（-${grandTotal}）`
              : `创建短信发送任务（-${grandTotal}）`}
          </Button>
          </div>
        </DialogFooter>
      </DialogContent>




      {/* 全部解锁 · 二次确认 */}
      <Dialog open={unlockAllOpen} onOpenChange={setUnlockAllOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>解锁全部明文{isEmail ? "邮箱" : "电话"}</DialogTitle>
            <DialogDescription>
              将为 {lockedActiveCount} 位未解锁收件人一次性解锁明文，扣除{" "}
              <span className="font-semibold text-rose-600">
                {lockedActiveCount * unitView}
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
            <span>我已知晓将立即扣除 {lockedActiveCount * unitView} 积分</span>
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

      {/* 短信：选择模板前需先解锁全部目标 */}
      <Dialog open={smsUnlockGateOpen} onOpenChange={setSmsUnlockGateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>请先解锁目标电话</DialogTitle>
            <DialogDescription>
              为便于精准匹配短信模版，请先解锁所有目标后继续操作
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
            当前有 <span className="font-semibold text-foreground">{lockedActiveCount}</span> 位收件人电话未解锁，
            解锁将扣除{" "}
            <span className="font-semibold text-rose-600">
              {lockedActiveCount * unitView}
            </span>{" "}
            积分，永久有效、不可撤销。
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSmsUnlockGateOpen(false)}>
              取消
            </Button>
            <Button
              onClick={() => {
                unlockAll();
                setSmsUnlockGateOpen(false);
              }}
            >
              <Unlock className="h-4 w-4" />
              全部解锁 · -{lockedActiveCount * unitView}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>


  );
}


/* -------------------- 短信模板选择器 -------------------- */

function SmsTemplatePicker({
  currentId,
  onPick,
  beforePick,
}: {
  currentId: string | null;
  onPick: (t: SmsTemplate) => void;
  /** 返回 false 时阻断本次选择（如目标未全部解锁） */
  beforePick?: () => boolean;
}) {
  const all = useSmsTemplates();
  const approved = all.filter((t) => t.status === "approved");
  return (
    <div className="flex items-center gap-2 text-xs">
      <Select
        value={currentId ?? ""}
        onValueChange={(id) => {
          if (beforePick && !beforePick()) return;
          const t = approved.find((x) => x.id === id);
          if (t) {
            onPick(t);
            toast.success(`已套用模板「${t.name}」`);
          }
        }}
      >

        <SelectTrigger className="h-8 flex-1 text-xs bg-background">
          <FileText className="h-3.5 w-3.5 text-primary mr-1" />
          <SelectValue placeholder="请选择短信模板" />
        </SelectTrigger>
        <SelectContent>
          {approved.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              暂无已审核模板
            </div>
          ) : (
            approved.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] h-4 px-1">
                    {t.channel === "otp"
                      ? "验证码"
                      : t.channel === "marketing"
                      ? "营销"
                      : "通知"}
                  </Badge>
                  <span>{t.name}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {t.locale}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {getTemplateDeliverableRegions(t.id).length > 0
                      ? getTemplateDeliverableRegions(t.id).map(regionLabel).join(" / ")
                      : "当前无可用通道"}
                  </span>
                </div>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}


