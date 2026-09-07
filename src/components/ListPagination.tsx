import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** 同时显示的最大页码按钮数，默认 5 */
  siblingCount?: number;
  className?: string;
}

/**
 * 通用列表分页组件
 * 布局：左侧 "共 N 条 · 第 X / Y 页"，右侧 ‹ [页码] ›
 * 当前页使用主色实心方块高亮，与系统整体风格一致。
 */
export function ListPagination({
  page,
  pageSize,
  total,
  onPageChange,
  siblingCount = 5,
  className,
}: ListPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, page), totalPages);

  // 计算需要渲染的页码窗口
  const pages: (number | "...")[] = [];
  if (totalPages <= siblingCount + 2) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    const half = Math.floor(siblingCount / 2);
    let start = Math.max(2, current - half);
    let end = Math.min(totalPages - 1, current + half);
    if (current - 1 <= half) end = siblingCount;
    if (totalPages - current <= half) start = totalPages - siblingCount + 1;
    pages.push(1);
    if (start > 2) pages.push("...");
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push("...");
    pages.push(totalPages);
  }

  const baseBtn =
    "inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-md text-xs transition-colors select-none";

  return (
    <div
      className={cn(
        "flex items-center justify-between flex-wrap gap-3 pt-4",
        className,
      )}
    >
      <div className="text-xs text-muted-foreground">
        共 <span className="tabular-nums text-foreground font-medium">{total}</span> 条
        <span className="mx-1.5 text-border">·</span>
        第 <span className="tabular-nums text-foreground font-medium">{current}</span> / {totalPages} 页
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="上一页"
          disabled={current === 1}
          onClick={() => onPageChange(current - 1)}
          className={cn(
            baseBtn,
            "border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 disabled:hover:bg-background disabled:cursor-not-allowed",
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((p, idx) =>
          p === "..." ? (
            <span
              key={`e-${idx}`}
              className={cn(baseBtn, "text-muted-foreground")}
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === current ? "page" : undefined}
              className={cn(
                baseBtn,
                p === current
                  ? "bg-primary text-primary-foreground shadow-sm font-medium"
                  : "border border-border bg-background text-foreground hover:bg-accent",
              )}
            >
              <span className="tabular-nums">{p}</span>
            </button>
          ),
        )}
        <button
          type="button"
          aria-label="下一页"
          disabled={current === totalPages}
          onClick={() => onPageChange(current + 1)}
          className={cn(
            baseBtn,
            "border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-40 disabled:hover:bg-background disabled:cursor-not-allowed",
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}