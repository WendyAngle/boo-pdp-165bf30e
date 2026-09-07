import { FileText } from "lucide-react";
import { getComposeSpec } from "@/lib/ai-compose-spec";
import { cn } from "@/lib/utils";

/**
 * 展示当前渠道 / 平台的 AI 文案格式规范，
 * 与服务端 prompt 使用同一份 ai-compose-spec 定义。
 */
export function ComposeFormatHint({
  channel,
  platform,
  className,
}: {
  channel: "email" | "sms" | "social";
  platform?: string;
  className?: string;
}) {
  const spec = getComposeSpec(channel, platform);
  return (
    <div
      className={cn(
        "rounded-md border border-primary/20 bg-primary/5 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground",
        className,
      )}
    >
      <div className="mb-1 flex items-center gap-1.5 font-medium text-primary">
        <FileText className="h-3.5 w-3.5" />
        {spec.label} · 格式规范
      </div>
      <ul className="space-y-0.5">
        {spec.tips.map((t) => (
          <li key={t} className="flex gap-1.5">
            <span className="text-primary/60">·</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
