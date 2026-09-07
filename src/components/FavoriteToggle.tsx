import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  useFavorite,
  type FavoriteKind,
  type FavoritePayload,
} from "@/lib/favorites";

type Variant = "button" | "overlay" | "inline";
type Size = "sm" | "md";

interface Props {
  kind: FavoriteKind;
  refId: string;
  payload: FavoritePayload;
  variant?: Variant;
  size?: Size;
  className?: string;
  stopPropagation?: boolean;
}

export function FavoriteToggle({
  kind,
  refId,
  payload,
  variant = "button",
  size = "md",
  className,
  stopPropagation = true,
}: Props) {
  const { favored, toggle } = useFavorite(kind, refId, payload);

  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const tip = favored ? "点击取消收藏" : "点击收藏";

  const onClick = (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.preventDefault();
      e.stopPropagation();
    }
    toggle();
  };

  let trigger: React.ReactNode;
  if (variant === "button") {
    trigger = (
      <Button
        type="button"
        variant="outline"
        size={size === "sm" ? "sm" : "icon"}
        onClick={onClick}
        aria-label={tip}
        className={cn(
          favored
            ? "border-amber-300 bg-amber-50 text-amber-500 hover:bg-amber-100 hover:text-amber-600"
            : "text-muted-foreground hover:text-amber-500",
          className,
        )}
      >
        <Star className={cn(iconSize, favored && "fill-amber-400")} />
      </Button>
    );
  } else if (variant === "overlay") {
    trigger = (
      <button
        type="button"
        onClick={onClick}
        aria-label={tip}
        className={cn(
          "inline-flex items-center justify-center h-8 w-8 rounded-full backdrop-blur-sm transition-all",
          favored
            ? "bg-amber-50 text-amber-500 ring-1 ring-amber-200 opacity-100"
            : "bg-background/80 text-muted-foreground ring-1 ring-border opacity-0 group-hover:opacity-100 hover:text-amber-500",
          className,
        )}
      >
        <Star className={cn("h-4 w-4", favored && "fill-amber-400")} />
      </button>
    );
  } else {
    // inline (table row, etc.)
    trigger = (
      <button
        type="button"
        onClick={onClick}
        aria-label={tip}
        className={cn(
          "inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted transition-colors",
          favored ? "text-amber-500" : "text-muted-foreground/60 hover:text-amber-500",
          className,
        )}
      >
        <Star className={cn(iconSize, favored && "fill-amber-400")} />
      </button>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}