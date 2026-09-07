import { Link } from "@tanstack/react-router";
import { Inbox, Sparkles, ArrowRight, MailPlus, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format-date";
import {
  useLatestThreadFor,
  INTENT_LABEL,
  INTENT_COLOR,
  STATUS_LABEL,
  type Thread,
} from "@/lib/inbox-store";
import { useLatestActivityFor } from "@/lib/activity-store";

interface Props {
  targetKind: "enterprise" | "contact";
  targetId: string;
  targetName: string;
}

function relativeTime(iso: string) {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const day = Math.floor(diff / 86_400_000);
  if (day >= 1) return `${day} 天前`;
  const hr = Math.floor(diff / 3_600_000);
  if (hr >= 1) return `${hr} 小时前`;
  const min = Math.max(1, Math.floor(diff / 60_000));
  return `${min} 分钟前`;
}

function threadOneLine(t: Thread) {
  const last = t.messages[t.messages.length - 1];
  if (!last) return null;
  return (
    <div className="text-sm text-foreground/85 line-clamp-1">
      <span
        className={cn(
          "inline-flex items-center gap-1 mr-2 text-xs px-1.5 py-0.5 rounded border",
          last.direction === "outbound"
            ? "bg-slate-50 text-slate-600 border-slate-200"
            : "bg-emerald-50 text-emerald-700 border-emerald-200",
        )}
      >
        {last.direction === "outbound" ? "你发出" : "对方回复"}
      </span>
      <span className="text-muted-foreground mr-1">
        {relativeTime(last.createdAt)} ·
      </span>
      {last.content.slice(0, 90)}
    </div>
  );
}

export function RecentCommsCapsule({ targetKind, targetId }: Props) {
  const t = useLatestThreadFor(targetKind, targetId);
  const latestActivity = useLatestActivityFor(targetKind, targetId);
  // 若最近一次活动是"我方外联但对方尚未回复"，优先展示外联摘要，
  // 与外联任务列表口径保持一致（PR-2：公司页数据源切至 activity）。
  const showOutreach =
    !!latestActivity &&
    latestActivity.kind === "outreach" &&
    (!t || new Date(latestActivity.occurredAt).getTime() > new Date(t.lastAt).getTime());

  if (showOutreach && latestActivity) {
    const a = latestActivity;
    const channelLabel =
      a.channel === "email" ? "邮件" : a.channel === "phone" ? "短信" : "社媒";
    const statusText =
      a.status === "success"
        ? "已送达 · 等待回复"
        : a.status === "in_progress"
          ? "触达中"
          : a.status === "failed"
            ? "触达失败"
            : "已发出";
    return (
      <Card className="p-4 bg-gradient-to-r from-sky-500/5 to-transparent border-sky-500/20">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="h-9 w-9 rounded-md bg-sky-500/10 flex items-center justify-center shrink-0">
              <Send className="h-4 w-4 text-sky-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">最近外联</span>
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-5">
                  {channelLabel}
                </Badge>
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-5">
                  {statusText}
                </Badge>
              </div>
              <div className="mt-2 text-sm text-foreground/85 line-clamp-1">
                <span className="inline-flex items-center gap-1 mr-2 text-xs px-1.5 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-200">
                  你发出
                </span>
                {a.summary || "（无摘要）"}
              </div>
              <div className="mt-2 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                {a.senderEmail && <span>发件 {a.senderEmail}</span>}
                <span>· 发送 {formatDateTime(a.occurredAt)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link to="/outreach/reach">
                查看任务
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  if (!t) {
    return (
      <Card className="p-4 flex items-center justify-between gap-4 bg-muted/30 border-dashed">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
            <MailPlus className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium">尚无邮件沟通记录</div>
            <div className="text-xs text-muted-foreground">
              向该对象发起首封触达即可开始跟进
            </div>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link to="/outreach/reach">
            前往触达
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </Card>
    );
  }
  const events = t.messages.reduce(
    (acc, m) => acc + (m.events?.length ?? 0),
    0,
  );
  return (
    <Card className="p-4 bg-gradient-to-r from-primary/5 to-transparent border-primary/20">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
            <Inbox className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">最新沟通</span>
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-5">
                {STATUS_LABEL[t.meta.status]}
              </Badge>
              {t.meta.aiIntent && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] py-0 px-1.5 h-5",
                    INTENT_COLOR[t.meta.aiIntent],
                  )}
                >
                  {INTENT_LABEL[t.meta.aiIntent]}
                </Badge>
              )}
              {t.meta.unread > 0 && (
                <Badge className="h-5 py-0 px-1.5 bg-rose-500 text-white text-[10px]">
                  未读 {t.meta.unread}
                </Badge>
              )}
            </div>
            <div className="mt-2 space-y-1">{threadOneLine(t)}</div>
            <div className="mt-2 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
              <span>共 {t.messages.length} 封往来</span>
              {events > 0 && <span>· {events} 次送达/打开事件</span>}
              {t.senderEmail && <span>· 发件 {t.senderEmail}</span>}
              <span>· 最后活动 {formatDateTime(t.lastAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/outreach/conversations" search={{ tid: t.id, action: "ai" }}>
              <Sparkles className="h-3.5 w-3.5" />
              AI 回复
            </Link>
          </Button>
          <Button asChild size="sm" className="gap-1.5">
            <Link to="/outreach/conversations" search={{ tid: t.id }}>
              进入会话
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}