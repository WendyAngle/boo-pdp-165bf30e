import { useEffect, useRef, useState } from "react";
import { Loader2, Volume2 } from "lucide-react";
import { translateMessage } from "@/lib/api/ai-translate.functions";
import {
  LANGUAGE_FULL_NAME,
  SCRIPT_LANGUAGES,
  fillPreviewVars,
} from "@/lib/voice-scripts";

const cache = new Map<string, string>();

/**
 * 实际外呼话术预览：变量替换为示例值，并按话术的「外呼语言」呈现。
 * 常显组件——编排页的播报文本与转接兜底话术下方直接展示外呼时客户实际听到的内容。
 */
export function ScriptSpeechPreview({
  text,
  language,
  label = "实际外呼话术预览",
}: {
  text: string;
  language: string;
  label?: string;
}) {
  const filled = fillPreviewVars(text ?? "");
  const langLabel = SCRIPT_LANGUAGES.find((l) => l.key === language)?.label ?? language;
  const needTranslate = language !== "zh" && filled.trim().length > 0;
  const cacheKey = `${language}::${filled}`;
  const [out, setOut] = useState<string>(() => (needTranslate ? cache.get(cacheKey) ?? "" : filled));
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!needTranslate) {
      setOut(filled);
      setErr(null);
      setLoading(false);
      return;
    }
    const hit = cache.get(cacheKey);
    if (hit) {
      setOut(hit);
      setErr(null);
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setLoading(true);
    setErr(null);
    timer.current = setTimeout(async () => {
      try {
        const res = await translateMessage({
          data: {
            text: filled.slice(0, 4000),
            targetLanguageName: LANGUAGE_FULL_NAME[language] ?? language,
            sourceLanguageName: "Chinese (Simplified)",
            tone: "friendly",
          },
        });
        const t = (res as { content?: string; text?: string }).content ??
          (res as { text?: string }).text ??
          "";
        cache.set(cacheKey, t);
        setOut(t);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "预览生成失败");
      } finally {
        setLoading(false);
      }
    }, 700);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [cacheKey, filled, language, needTranslate]);

  return (
    <div className="rounded-md border border-dashed bg-muted/40 p-3 space-y-1.5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Volume2 className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{label}</span>
        <span>· 外呼语言：{langLabel} · 变量已用示例数据填充，实际外呼按客户数据替换</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>
      {filled.trim().length === 0 ? (
        <p className="text-xs text-muted-foreground">尚未填写内容，填写后此处显示客户实际听到的话术。</p>
      ) : err ? (
        <p className="text-xs text-destructive">{err}</p>
      ) : (
        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {out || (loading ? "正在生成外呼语言预览…" : filled)}
        </p>
      )}
    </div>
  );
}
