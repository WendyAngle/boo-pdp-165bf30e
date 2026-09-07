import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Handshake, Info, Mail, Users, Sparkles } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import {
  MANAGED_EMAIL_COST_PER_TARGET as CREDIT_PER_TARGET,
  MANAGED_MIN_AI,
  MANAGED_MIN_OWN,
  createManagedOrder,
} from "@/lib/managed-email";
import {
  EmailComposeFields,
  emptyEmailCopyDraft,
  type EmailCopyDraft,
} from "@/components/outreach/EmailComposeFields";

type SourceKind = "own" | "ai";

const SOURCE_META: Record<
  SourceKind,
  { label: string; desc: string; min: number; icon: React.ReactNode }
> = {
  own: {
    label: "我的名单（收藏 / 已解锁客户）",
    desc: "由营销团队对你提供的名单做清洗、撰写双语文案并代为发送",
    min: MANAGED_MIN_OWN,
    icon: <Users className="h-4 w-4" />,
  },
  ai: {
    label: "AI 智能寻源（平台补充目标）",
    desc: "按推广产品与目标市场，由平台补齐目标名单后代为发送",
    min: MANAGED_MIN_AI,
    icon: <Sparkles className="h-4 w-4" />,
  },
};

export function ManagedEmailReachDialog({
  open,
  onOpenChange,
  defaultSource = "own",
  defaultQty,
  entryHint,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultSource?: SourceKind;
  /** 入口预填的目标数量（如「我的收藏」已勾选目标数） */
  defaultQty?: number;
  entryHint?: string;
}) {
  const [source, setSource] = useState<SourceKind>(defaultSource);
  const [qty, setQty] = useState(String(defaultQty ?? MANAGED_MIN_OWN));
  const [product, setProduct] = useState("");
  const [market, setMarket] = useState("");
  const [keywords, setKeywords] = useState("");
  
  const [draft, setDraft] = useState<EmailCopyDraft>(emptyEmailCopyDraft());
  const [expectStartAt, setExpectStartAt] = useState("");
  const [dailyCap, setDailyCap] = useState("");
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setSource(defaultSource);
    setQty(String(Math.max(defaultQty ?? 0, SOURCE_META[defaultSource].min)));
    
    setDraft(emptyEmailCopyDraft());
  }, [open, defaultSource, defaultQty]);

  const min = SOURCE_META[source].min;
  const qtyNum = Number(qty) || 0;
  const qtyValid = qtyNum >= min;
  const cost = useMemo(() => qtyNum * CREDIT_PER_TARGET, [qtyNum]);
  const copyReady =
    (draft.translatedSubject.trim() || draft.subject.trim()).length > 0 &&
    (draft.translatedBody.trim() || draft.body.trim()).length > 0;
  const canSubmit = qtyValid && product.trim() && contact.trim() && copyReady;

  const submit = () => {
    if (!canSubmit) return;
    const order = createManagedOrder({
      source,
      qty: qtyNum,
      product: product.trim(),
      market: market.trim() || undefined,
      keywords: keywords.trim() || undefined,
      copy: {
        subject: draft.subject.trim(),
        body: draft.body.trim(),
        lang: draft.lang,
        translatedSubject: draft.translatedSubject.trim(),
        translatedBody: draft.translatedBody.trim(),
        aiGenerated: draft.aiGenerated,
      },
      expectStartAt: expectStartAt || undefined,
      dailyCap: Number(dailyCap) || undefined,
      contact: contact.trim(),
      note: note.trim() || undefined,
    });
    onOpenChange(false);
    toast.success(`托管需求已提交（${order.orderNo}）`, {
      description: `${SOURCE_META[source].label}｜${qtyNum} 个目标，已扣除 ${cost.toLocaleString()} 积分。平台受理后由系统自动寻源并按你提交的文案发送。`,
    });
    setNote("");
    setDraft(emptyEmailCopyDraft());
  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5 text-primary" />
            邮件托管触达
          </DialogTitle>
          <DialogDescription>
            由平台营销团队使用平台发信资源、以你的企业名义代为执行邮件触达；执行结果与客户回复同样进入「触达任务」与「触达会话」。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-1">
          {entryHint && (
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {entryHint}
            </div>
          )}
          <div className="space-y-2">
            <Label>目标来源</Label>
            <RadioGroup
              value={source}
              onValueChange={(v) => {
                const k = v as SourceKind;
                setSource(k);
                setQty(String(SOURCE_META[k].min));
              }}
              className="grid gap-2"
            >
              {(Object.keys(SOURCE_META) as SourceKind[]).map((k) => (
                <label
                  key={k}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                    source === k ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
                  )}
                >
                  <RadioGroupItem value={k} className="mt-1" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      {SOURCE_META[k].icon}
                      {SOURCE_META[k].label}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {SOURCE_META[k].desc}｜起做量 {SOURCE_META[k].min} 个目标
                    </div>
                  </div>
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="managed-qty">目标数量</Label>
              <Input
                id="managed-qty"
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(e.target.value.replace(/[^\d]/g, ""))}
              />
              <p className={cn("text-xs", qtyValid ? "text-muted-foreground" : "text-destructive")}>
                起做量 {min} 个目标
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="managed-product">推广产品</Label>
              <Input
                id="managed-product"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                placeholder="如：户外储能电源"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="managed-market">目标市场（选填）</Label>
              <Input
                id="managed-market"
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                placeholder="如：东南亚、欧洲"
              />
            </div>
            {source === "ai" && (
              <div className="space-y-2">
                <Label htmlFor="managed-keywords">目标关键词（选填）</Label>
                <Input
                  id="managed-keywords"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="如：portable power station, solar generator"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="managed-start">期望开始日期（选填）</Label>
              <Input
                id="managed-start"
                type="date"
                value={expectStartAt}
                onChange={(e) => setExpectStartAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="managed-cap">每日发送上限（选填）</Label>
              <Input
                id="managed-cap"
                inputMode="numeric"
                value={dailyCap}
                onChange={(e) => setDailyCap(e.target.value.replace(/[^\d]/g, ""))}
                placeholder="留空则按发信邮箱健康度自动排期"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="managed-contact">对接人 / 联系方式</Label>
              <Input
                id="managed-contact"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="姓名 + 手机号 / 邮箱"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <EmailComposeFields
                value={draft}
                onChange={setDraft}
                scene="开发信"
                aiHint={{ product: product.trim(), market: market.trim() }}
              />
              <p className="mt-2 text-[11px] text-muted-foreground">
                填写后顾问将按此文案执行；留空则由营销顾问代写并在执行前与你确认。如未填写目标语言译文，顾问会补充翻译。
              </p>
            </div>
          </div>



          <div className="space-y-2">
            <Label htmlFor="managed-note">补充说明（选填）</Label>
            <Textarea
              id="managed-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="如：主推卖点、需要规避的客户、期望的发送节奏等"
              rows={3}
            />
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground space-y-1.5">
            <div className="flex items-center gap-1.5 text-foreground font-medium">
              <Info className="h-3.5 w-3.5 text-primary" />
              计费与执行说明
            </div>
            <div>
              统一按 <span className="text-foreground font-medium">{CREDIT_PER_TARGET} 积分 / 目标</span>{" "}
              计费，批次确认后一次性扣除，不再另收服务费与查看费。
            </div>
            <div>支持中途叫停，未执行部分按目标数原路退回积分。</div>
            <div>
              服务含：名单清洗/寻源、中文文案 + 目标语言翻译、分日排期、首轮 + 1 次跟进、回复归集到「触达会话」；不含签约谈判与逐条人工回复。
            </div>
            <div>时效：受理后 1 个工作日内确认方案，自有名单 3 个工作日、AI 寻源 5 个工作日内完成首轮发送。</div>
            <div className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              使用平台发信资源，署名为你的企业名称，无需配置企业邮箱。
            </div>
          </div>
        </div>

        <DialogFooter className="items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            预计扣除{" "}
            <span className="text-foreground font-semibold tabular-nums">
              {cost.toLocaleString()}
            </span>{" "}
            积分
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button disabled={!canSubmit} onClick={submit}>
              提交托管需求
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
