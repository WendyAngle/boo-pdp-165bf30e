import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, KeyRound, ShieldCheck, Check, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { changePassword, passwordStrength } from "@/lib/current-user";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: Props) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showCur, setShowCur] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setCur("");
      setNext("");
      setConfirm("");
      setShowCur(false);
      setShowNext(false);
      setShowConfirm(false);
      setSubmitting(false);
    }
  }, [open]);

  const strength = useMemo(() => passwordStrength(next), [next]);
  const variety =
    Number(strength.checks.lower) +
    Number(strength.checks.upper) +
    Number(strength.checks.digit) +
    Number(strength.checks.symbol);
  const meetsBasic = strength.checks.length && variety >= 3;
  const matches = confirm.length > 0 && next === confirm;
  const mismatch = confirm.length > 0 && next !== confirm;
  const sameAsCur = cur.length > 0 && next.length > 0 && cur === next;
  const canSubmit =
    !submitting &&
    cur.length > 0 &&
    meetsBasic &&
    matches &&
    !sameAsCur;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await changePassword(cur, next);
      toast.success("密码已更新", { description: "下次登录请使用新密码" });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "修改失败，请重试");
      setSubmitting(false);
    }
  }

  const barColors = ["bg-muted", "bg-rose-500", "bg-amber-500", "bg-sky-500", "bg-emerald-500"];
  const labelColors = [
    "text-muted-foreground",
    "text-rose-600",
    "text-amber-600",
    "text-sky-600",
    "text-emerald-600",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <KeyRound className="h-4.5 w-4.5" />
            </div>
            <div>
              <DialogTitle>修改密码</DialogTitle>
              <DialogDescription className="mt-0.5">
                为了账号安全，建议定期更换密码
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <PasswordField
            id="cur"
            label="当前密码"
            value={cur}
            onChange={setCur}
            show={showCur}
            onToggle={() => setShowCur((s) => !s)}
            placeholder="请输入当前密码"
            autoFocus
          />

          <div className="space-y-2">
            <PasswordField
              id="next"
              label="新密码"
              value={next}
              onChange={setNext}
              show={showNext}
              onToggle={() => setShowNext((s) => !s)}
              placeholder="请输入新密码"
              error={sameAsCur ? "新密码不能与当前密码相同" : undefined}
            />
            {next.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden flex gap-0.5">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "flex-1 transition-colors",
                          strength.score >= i ? barColors[strength.score] : "bg-muted",
                        )}
                      />
                    ))}
                  </div>
                  <span className={cn("text-xs font-medium tabular-nums", labelColors[strength.score])}>
                    {strength.label}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <Rule ok={strength.checks.length} text="至少 8 个字符" />
                  <Rule ok={strength.checks.upper} text="包含大写字母" />
                  <Rule ok={strength.checks.lower} text="包含小写字母" />
                  <Rule ok={strength.checks.digit} text="包含数字" />
                  <Rule ok={strength.checks.symbol} text="包含符号" />
                  <Rule ok={variety >= 3 && strength.checks.length} text="字符类型 ≥ 3 种" />
                </div>
              </div>
            )}
          </div>

          <PasswordField
            id="confirm"
            label="确认新密码"
            value={confirm}
            onChange={setConfirm}
            show={showConfirm}
            onToggle={() => setShowConfirm((s) => !s)}
            placeholder="请再次输入新密码"
            error={mismatch ? "两次输入的密码不一致" : undefined}
            success={matches ? "两次输入一致" : undefined}
          />

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              取消
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  提交中
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-1.5" />
                  确认修改
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggle,
  placeholder,
  autoFocus,
  error,
  success,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  error?: string;
  success?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete={id === "cur" ? "current-password" : "new-password"}
          className={cn(
            "pr-9 h-9",
            error && "border-rose-400 focus-visible:ring-rose-400/30",
          )}
        />
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          aria-label={show ? "隐藏密码" : "显示密码"}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground"
        >
          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {!error && success && <p className="text-xs text-emerald-600">{success}</p>}
    </div>
  );
}

function Rule({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1", ok ? "text-emerald-600" : "text-muted-foreground")}>
      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {text}
    </span>
  );
}