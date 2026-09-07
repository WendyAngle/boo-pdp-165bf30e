import { PanelRightClose } from "lucide-react";
import { IntentScorePanel } from "./IntentScorePanel";
import type { Thread } from "@/lib/inbox-store";

export function IntelPanel({ thread, onCollapse }: { thread: Thread; onCollapse?: () => void }) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center border-b shrink-0 pr-1">
        <div className="flex-1 h-9 text-xs inline-flex items-center justify-center gap-1.5 border-b-2 border-primary text-foreground font-medium">
          意向评分
        </div>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            title="收起意向评分"
            aria-label="收起意向评分"
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <PanelRightClose className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <IntentScorePanel thread={thread} />
      </div>
    </div>
  );
}
