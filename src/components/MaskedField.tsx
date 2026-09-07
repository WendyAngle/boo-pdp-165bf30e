import { Eye, Unlock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  chargeView,
  isUnlocked,
  markUnlocked,
  useUnlocked,
  revealKey,
  maskEmail,
  maskPhone,
  maskHandle,
  maskAddress,
  maskTitle,
  maskSeniority,
  type TargetKind,
  type ViewField,
  costForView,
} from "@/lib/credits-ledger";

interface Props {
  targetKind: TargetKind;
  targetId: string;
  targetName: string;
  parentRef?: { id: string; name: string };
  field: ViewField;
  value: string;
  subKey?: string; // e.g. social platform name
  className?: string;
  mono?: boolean;
}

function maskFor(field: ViewField, value: string) {
  switch (field) {
    case "email":
      return maskEmail(value);
    case "phone":
      return maskPhone(value);
    case "social":
      return maskHandle(value);
    case "address":
      return maskAddress(value);
    case "title":
      return maskTitle(value);
    case "seniority":
      return maskSeniority(value);
  }
}

export function MaskedField({
  targetKind,
  targetId,
  targetName,
  parentRef,
  field,
  value,
  subKey,
  className,
  mono = false,
}: Props) {
  // 职位信息与详细地址按产品要求始终明文展示,不消耗积分
  if (field === "title" || field === "address") {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <span className={cn("select-text", mono && "font-mono tabular-nums text-xs")}>
          {value}
        </span>
      </span>
    );
  }
  const key = revealKey(targetKind, targetId, field, subKey);
  const unlocked = useUnlocked(key);

  // 已永久解锁 → 直接明文展示,不再展示查看按钮,也不再消耗积分
  if (unlocked) {
    return (
      <span className={cn("inline-flex items-center gap-1.5", className)}>
        <span
          className={cn(
            "select-text",
            mono && "font-mono tabular-nums text-xs",
          )}
        >
          {value}
        </span>
        <TooltipProvider delayDuration={80}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                aria-label="已永久解锁"
                className="inline-flex h-6 w-6 items-center justify-center rounded text-emerald-600"
              >
                <Unlock className="h-3.5 w-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">已永久解锁，查看不再消耗积分</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </span>
    );
  }

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 首次解锁 — 每个字段仅扣费一次,永久解锁
    if (!isUnlocked(key)) {
      chargeView({
        targetKind,
        targetId,
        targetName,
        parentRef,
        field,
        detail: value,
      });
      toast.success(`已扣除 ${costForView(field)} 积分，已永久解锁`, {
        description: `查看了 ${targetName} 的${
          {
            email: "邮箱",
            phone: "电话",
            social: "社媒账号",
            address: "详细地址",
            title: "职位信息",
            seniority: "职级信息",
          }[field]
        }，后续查看不再扣费`,
      });
      markUnlocked(key);
    }
  };

  const display = maskFor(field, value);
  const tip = `查看将消耗 ${costForView(field)} 积分（仅首次），确认请点击`;

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        className={cn(
          "select-text",
          mono && "font-mono tabular-nums text-xs",
          "tracking-wider",
        )}
      >
        {display}
      </span>
      <TooltipProvider delayDuration={80}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onClick}
              aria-label={tip}
              className={cn(
                "inline-flex h-6 w-6 items-center justify-center rounded transition-colors",
                "text-muted-foreground hover:bg-muted hover:text-primary",
              )}
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{tip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </span>
  );
}