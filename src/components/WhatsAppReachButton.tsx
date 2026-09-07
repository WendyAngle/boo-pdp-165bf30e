import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { TargetKind } from "@/lib/credits-ledger";

interface Props {
  targetKind: TargetKind;
  targetId: string;
  targetName: string;
  parentRef?: { id: string; name: string };
  phone: string;
  disabled?: boolean;
  className?: string;
}

/** WhatsApp 官方风格图标 */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" fill="currentColor">
      <path d="M16.04 4C9.96 4 5.02 8.94 5.02 15.02c0 2.12.6 4.1 1.63 5.79L5 28l7.36-1.6a11 11 0 0 0 3.68.63h.01c6.08 0 11.02-4.94 11.02-11.02C27.07 8.94 22.12 4 16.04 4Zm0 20.03c-1.14 0-2.26-.2-3.32-.6l-.24-.09-4.37.95.93-4.26-.15-.25a9.02 9.02 0 1 1 7.15 4.25Zm5.06-6.73c-.28-.14-1.63-.8-1.88-.9-.25-.09-.44-.14-.62.14-.19.28-.71.9-.87 1.08-.16.19-.32.21-.6.07-.28-.14-1.17-.43-2.22-1.37a8.3 8.3 0 0 1-1.54-1.91c-.16-.28-.02-.43.12-.57.13-.13.28-.32.42-.49.14-.16.19-.28.28-.46.09-.19.05-.35-.02-.49-.07-.14-.62-1.5-.86-2.05-.22-.53-.45-.46-.62-.47l-.53-.01a1.02 1.02 0 0 0-.74.35c-.25.28-.97.95-.97 2.31s1 2.68 1.13 2.87c.14.19 1.96 2.99 4.75 4.19.66.29 1.18.46 1.59.59.67.21 1.27.18 1.75.11.53-.08 1.63-.67 1.86-1.31.23-.65.23-1.2.16-1.31-.07-.12-.25-.19-.53-.33Z" />
    </svg>
  );
}

export function WhatsAppReachButton({ phone, disabled, className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <span
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        disabled={disabled || !phone}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        title="WhatsApp"
        aria-label="WhatsApp"
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#25D366] text-white transition-opacity hover:opacity-85",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className,
        )}
      >
        <WhatsAppIcon className="h-4 w-4" />
      </button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>WhatsApp 使用提醒</AlertDialogTitle>
            <AlertDialogDescription>
              每天最多向 5 名陌生人发送信息，否则可能导致 WhatsApp 封号。请合理控制联系频率。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => setOpen(false)}>
              继续打开 WhatsApp
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  );
}
