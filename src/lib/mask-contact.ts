/**
 * 联系方式脱敏工具 · 统一各触达弹窗的明文遮蔽规则
 * 原则：未付费解锁前，屏幕上不出现可用的明文联系方式。
 */

export function maskEmail(v: string): string {
  const s = (v ?? "").trim();
  if (!s) return "—";
  const at = s.indexOf("@");
  if (at <= 0) return maskGeneric(s);
  const user = s.slice(0, at);
  const domain = s.slice(at + 1);
  const head = user.slice(0, 1);
  const dot = domain.lastIndexOf(".");
  const suffix = dot > 0 ? domain.slice(dot) : "";
  return `${head}${"*".repeat(Math.max(3, user.length - 1))}@${"*".repeat(
    Math.max(3, (dot > 0 ? dot : domain.length)),
  )}${suffix}`;
}

export function maskPhone(v: string): string {
  const s = (v ?? "").trim();
  if (!s) return "—";
  const digits = s.replace(/[^\d]/g, "");
  if (digits.length <= 4) return "*".repeat(digits.length || 4);
  const head = s.startsWith("+") ? `+${digits.slice(0, 2)} ` : digits.slice(0, 3);
  const tail = digits.slice(-4);
  return `${head}****${tail}`;
}

export function maskHandle(v: string): string {
  const s = (v ?? "").trim();
  if (!s) return "—";
  const at = s.startsWith("@");
  const body = at ? s.slice(1) : s;
  if (body.length <= 4) return `${at ? "@" : ""}${body.slice(0, 1)}***`;
  return `${at ? "@" : ""}${body.slice(0, 3)}****${body.slice(-2)}`;
}

function maskGeneric(s: string): string {
  if (s.length <= 3) return "***";
  return `${s.slice(0, 2)}****${s.slice(-1)}`;
}

export function maskContact(
  kind: "email" | "phone" | "social",
  value: string,
): string {
  if (kind === "email") return maskEmail(value);
  if (kind === "phone") return maskPhone(value);
  return maskHandle(value);
}
