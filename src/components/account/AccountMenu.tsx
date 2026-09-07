import { useState } from "react";
import { KeyRound, LogOut, ChevronUp, Phone, Coins } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useCreditBalance } from "@/lib/credits-balance";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/current-user";
import { ChangePasswordDialog } from "./ChangePasswordDialog";

export function AccountMenu() {
  const user = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const { balance } = useCreditBalance();

  return (
    <>
      <Link
        to="/outreach/recharge"
        className="mb-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-50 to-amber-100/60 hover:from-amber-100 hover:to-amber-100 ring-1 ring-amber-200/70 transition-colors group"
        aria-label={`当前积分余额 ${balance}，点击去充值`}
      >
        <Coins className="h-3.5 w-3.5 text-amber-600 shrink-0" />
        <span className="text-[11px] text-amber-800/80 leading-none">积分</span>
        <span className="text-sm font-semibold text-amber-900 tabular-nums leading-none">
          {balance.toLocaleString()}
        </span>
        <span className="ml-auto text-[11px] text-amber-700 opacity-0 group-hover:opacity-100 transition-opacity">
          去充值 →
        </span>
      </Link>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-sidebar-accent transition-colors text-left group"
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0">
              {user.avatarLetter}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-sidebar-foreground truncate leading-tight">
                {user.name}
              </div>
              <div className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                {user.phone}
              </div>
            </div>
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          sideOffset={8}
          className="w-64 p-0 overflow-hidden"
        >
          <div className="p-3 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground flex items-center justify-center text-base font-semibold shrink-0">
                {user.avatarLetter}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{user.name}</div>
                <div className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                  <Phone className="h-3 w-3" />
                  {user.phone}
                </div>
              </div>
            </div>
          </div>
          <div className="p-1">
            <MenuItem
              icon={<KeyRound className="h-4 w-4" />}
              label="修改密码"
              onClick={() => {
                setOpen(false);
                setPwdOpen(true);
              }}
            />
            <MenuItem
              icon={<LogOut className="h-4 w-4" />}
              label="退出登录"
              danger
              onClick={() => {
                setOpen(false);
                toast.info("演示环境，未接入登录态");
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
      <ChangePasswordDialog open={pwdOpen} onOpenChange={setPwdOpen} />
    </>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors " +
        (danger
          ? "text-rose-600 hover:bg-rose-50"
          : "text-foreground hover:bg-accent")
      }
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {trailing}
    </button>
  );
}