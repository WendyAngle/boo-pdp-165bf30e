import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MANAGED_STATUS_LABEL, type ManagedStatus } from "@/lib/managed-email";

const CLS: Record<ManagedStatus, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  sourcing: "bg-violet-50 text-violet-700 border-violet-200",
  running: "bg-blue-50 text-blue-700 border-blue-200",
  paused: "bg-orange-50 text-orange-700 border-orange-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-muted text-muted-foreground border-border",
  rejected: "bg-rose-50 text-rose-700 border-rose-200",
};

/** 托管工单状态徽标（用户端与后台共用） */
export function ManagedStatusBadge({
  status,
  className,
}: {
  status: ManagedStatus;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("font-normal", CLS[status], className)}>
      {MANAGED_STATUS_LABEL[status]}
    </Badge>
  );
}
