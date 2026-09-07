import { useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ComposeFormatHint } from "@/components/outreach/ComposeFormatHint";
import { TargetLangSection } from "@/components/outreach/TargetLangSection";
import { MESSAGE_VARIABLES, myContext, renderTemplate, type VarContext } from "@/lib/message-vars";
import { generateAiContent } from "@/lib/api/ai-compose.functions";
import { useLeadProfile } from "@/lib/lead-profile";
import { useCurrentUser } from "@/lib/current-user";
import { cn } from "@/lib/utils";

/** 邮件文案草稿（中文原文 + 目标语言译文） */
export type EmailCopyDraft = {
  subject: string;
  body: string;
  /** 目标语言代码 */
  lang: string;
  translatedSubject: string;
  translatedBody: string;
  aiGenerated: boolean;
};

export function emptyEmailCopyDraft(): EmailCopyDraft {
  return {
    subject: "",
    body: "",
    lang: "en",
    translatedSubject: "",
    translatedBody: "",
    aiGenerated: false,
  };
}

/** 预览样例（无真实收件人时使用） */
export type PreviewSample = { key: string; name: string; ctx: VarContext };

/**
 * 「撰写内容」通用区块（与「撰写并发送邮件」弹窗一致）：
 * AI 生成文案 → 插入变量 → 主题 / 正文 → 目标语言邮件（翻译）→ 变量替换预览。
 */
export function EmailComposeFields({
  value,
  onChange,
  samples = [],
  scene = "开发信",
  aiHint,
  className,
}: {
  value: EmailCopyDraft;
  onChange: (v: EmailCopyDraft) => void;
  /** 预览样例目标 */
  samples?: PreviewSample[];
  scene?: string;
  /** 传给 AI 的补充上下文（如推广产品 / 目标市场） */
  aiHint?: { product?: string; market?: string };
  className?: string;
}) {
  const profile = useLeadProfile();
  const user = useCurrentUser();
  const my = myContext(profile, user);
  const callGenerate = useServerFn(generateAiContent);

  const [aiLoading, setAiLoading] = useState(false);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [focusField, setFocusField] = useState<"subject" | "content">("subject");
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);

  const set = (patch: Partial<EmailCopyDraft>) => onChange({ ...value, ...patch });

  function insertVarAt(field: "subject" | "content", v: string) {
    const token = `{${v}}`;
    if (field === "subject") {
      const el = subjectRef.current;
      const s = value.subject;
      if (!el) return set({ subject: s + token });
      const start = el.selectionStart ?? s.length;
      const end = el.selectionEnd ?? s.length;
      set({ subject: s.slice(0, start) + token + s.slice(end) });
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      const el = contentRef.current;
      const s = value.body;
      if (!el) return set({ body: s + token });
      const start = el.selectionStart ?? s.length;
      const end = el.selectionEnd ?? s.length;
      set({ body: s.slice(0, start) + token + s.slice(end) });
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
    }
  }

  async function handleAiGenerate() {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const res = await callGenerate({
        data: {
          channel: "email",
          scene,
          tone: "friendly",
          language: "zh",
          languageName: "中文",
          myCompany: profile.companyName,
          myName: user.name,
          sampleEnterprise: samples[0]?.ctx.企业名,
          extra: [
            aiHint?.product ? `推广产品: ${aiHint.product}` : "",
            aiHint?.market ? `目标市场: ${aiHint.market}` : "",
          ]
            .filter(Boolean)
            .join("；") || undefined,
        },
      });
      set({
        subject: res.subject || value.subject,
        body: res.content || value.body,
        aiGenerated: true,
      });
      toast.success("AI 已生成邮件文案");
    } catch (e) {
      toast.error("AI 生成失败", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setAiLoading(false);
    }
  }

  const sample = samples[Math.min(previewIdx, Math.max(0, samples.length - 1))];
  const ctx: VarContext = sample?.ctx ?? { ...my };
  const sendSubject = (value.translatedSubject.trim() || value.subject).trim();
  const sendBody = (value.translatedBody.trim() || value.body).trim();
  const previewSubject = useMemo(() => renderTemplate(sendSubject, ctx), [sendSubject, ctx]);
  const previewBody = useMemo(() => renderTemplate(sendBody, ctx), [sendBody, ctx]);

  return (
    <div className={cn("space-y-3", className)}>
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium flex items-center gap-2">
            撰写内容
            {value.aiGenerated && (
              <Badge
                variant="secondary"
                className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
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
            onClick={() => void handleAiGenerate()}
            className="h-7 gap-1"
          >
            {aiLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            )}
            {aiLoading ? "生成中…" : value.aiGenerated ? "AI 重新生成" : "AI 生成文案"}
          </Button>
        </div>

        <ComposeFormatHint channel="email" />

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            插入变量（光标处插入到{focusField === "subject" ? "主题" : "正文"}）：
          </span>
          {MESSAGE_VARIABLES.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => insertVarAt(focusField, v)}
              className="rounded border bg-background px-1.5 py-0.5 text-[11px] font-mono text-primary hover:bg-primary/10"
            >
              {`{${v}}`}
            </button>
          ))}
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">主题</Label>
          <Input
            ref={subjectRef}
            value={value.subject}
            onChange={(e) => set({ subject: e.target.value })}
            onFocus={() => setFocusField("subject")}
            maxLength={120}
            placeholder="例：{企业名}，关于 {行业} 出口合作的提案"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">正文</Label>
          <Textarea
            ref={contentRef}
            value={value.body}
            onChange={(e) => set({ body: e.target.value })}
            onFocus={() => setFocusField("content")}
            rows={8}
            maxLength={5000}
            placeholder="你好 {联系人名}，我是 {我的公司} 的 {我的姓名}……"
          />
          <div className="text-[11px] text-muted-foreground">{value.body.length} / 5000 字</div>
        </div>
      </section>

      <TargetLangSection
        source={value.body}
        sourceSubject={value.subject}
        lang={value.lang}
        onLangChange={(v) => set({ lang: v })}
        value={value.translatedBody}
        onChange={(v) => set({ translatedBody: v })}
        subjectValue={value.translatedSubject}
        onSubjectChange={(v) => set({ translatedSubject: v })}
        rows={8}
        kindLabel="邮件"
      />

      <section className="space-y-2 rounded-md border bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            预览（变量已替换）
            <span className="ml-1 inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-normal text-muted-foreground">实时同步</span>
          </Label>
          {samples.length > 1 && (
            <Select value={String(previewIdx)} onValueChange={(v) => setPreviewIdx(Number(v))}>
              <SelectTrigger className="h-7 w-[180px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {samples.map((s, i) => (
                  <SelectItem key={s.key} value={String(i)}>
                    第 {i + 1} 条 · {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="text-xs">
          <span className="text-muted-foreground">主题：</span>
          <span className="font-medium">{previewSubject || "—"}</span>
        </div>
        <div className="text-xs whitespace-pre-wrap text-foreground/90 max-h-40 overflow-y-auto">
          {previewBody || <span className="text-muted-foreground">（暂无内容）</span>}
        </div>
      </section>
    </div>
  );
}
