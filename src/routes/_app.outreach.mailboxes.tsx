import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Mailbox as MailboxIcon,
  CheckCircle2,
  AlertCircle,
  Ban,
  Search,
  Plus,
  RotateCcw,
  Pencil,
  Trash2,
  Star,
  StarOff,
  Power,
  Zap,
  ChevronRight,
  Server,
  ShieldCheck,
  Activity,
  Loader2,
  Building2,
  HelpCircle,
  Link2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import {
  useMailboxes,
  createMailbox,
  updateMailbox,
  deleteMailbox,
  setDefaultMailbox,
  setMailboxStatus,
  testMailbox,
  PROVIDER_PRESETS,
  type Mailbox,
  type MailboxProvider,
  type MailboxEncryption,
  type MailboxStatus,
  getMailboxUsability,
  isMailboxUsable,
  type MailboxUsability,
} from "@/lib/mailboxes";
import {
  detectProvider,
  suggestDisplayName,
  PROVIDER_GUIDES,
  PROVIDER_DAILY_LIMIT,
  type DetectResult,
} from "@/lib/mailbox-setup-guide";
import { useTenantRole, setTenantRole } from "@/lib/tenant-role";
import { Users, EyeOff, Eye, Lock, BookOpen, Sparkles } from "lucide-react";

const CURRENT_TENANT = { id: "T202600", name: "字节跳动" };

const PROVIDERS: MailboxProvider[] = [
  "Gmail",
  "Outlook",
  "腾讯企业邮",
  "阿里企业邮",
  "网易企业邮",
  "自定义SMTP",
];
/** 新增邮箱弹窗中可选的服务商（不含「自定义SMTP」） */
const FORM_PROVIDERS: MailboxProvider[] = [
  "Gmail",
  "Outlook",
  "腾讯企业邮",
  "阿里企业邮",
  "网易企业邮",
];
const USABILITY_STATES: MailboxUsability[] = ["可用", "待验证", "异常", "已停用"];
const ENCRYPTIONS: MailboxEncryption[] = ["SSL", "TLS", "STARTTLS", "NONE"];

export const Route = createFileRoute("/_app/outreach/mailboxes")({
  head: () => ({ meta: [{ title: "出海大数据平台 · 邮箱 | 出海大数据平台" }] }),
  component: MailboxesPage,
});

/** 收信通道摘要：仅作为明细展示，不再作为独立状态标签 */
function receiveSummary(m: Mailbox) {
  if (!m.receiveEnabled) return "未开启";
  if (m.receiveStatus === "收信正常") return m.imapHost || "已连通";
  if (m.receiveStatus === "收信异常") return "连接异常，请重新测试";
  return "待测试";
}

function usabilityBadgeCls(s: MailboxUsability) {
  if (s === "可用") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (s === "待验证") return "bg-amber-100 text-amber-700 border-amber-200";
  if (s === "异常") return "bg-rose-100 text-rose-700 border-rose-200";
  return "bg-muted text-muted-foreground border-border";
}

function formatDateTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function MailboxesPage() {
  const data = useMailboxes();
  const role = useTenantRole();
  const isAdmin = role === "admin";
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [providerFilter, setProviderFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Mailbox | null>(null);
  const [delTarget, setDelTarget] = useState<Mailbox | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return data.filter((m) => {
      // 成员视角：仅展示「可用」的企业邮箱（只读）
      if (!isAdmin && !isMailboxUsable(m)) return false;
      if (
        keyword &&
        !`${m.email} ${m.displayName} ${m.username}`
          .toLowerCase()
          .includes(keyword.toLowerCase())
      )
        return false;
      if (statusFilter !== "all" && getMailboxUsability(m).state !== statusFilter) return false;
      if (providerFilter !== "all" && m.provider !== providerFilter) return false;
      return true;
    });
  }, [data, keyword, statusFilter, providerFilter, isAdmin]);


  const stats = useMemo(() => {
    const c = (s: MailboxUsability) =>
      data.filter((m) => getMailboxUsability(m).state === s).length;
    return {
      total: data.length,
      usable: c("可用"),
      pending: c("待验证"),
      unavailable: c("异常") + c("已停用"),
    };
  }, [data]);

  const reset = () => {
    setKeyword("");
    setStatusFilter("all");
    setProviderFilter("all");
  };

  const onTest = async (m: Mailbox) => {
    setTestingId(m.id);
    const r = await testMailbox(m.id);
    setTestingId(null);
    if (r.smtp.ok) toast.success(r.smtp.message);
    else toast.error(r.smtp.message);
    if (r.imap.skipped) toast.info(r.imap.message);
    else if (r.imap.ok) toast.success(r.imap.message);
    else toast.error(r.imap.message);
  };

  const onToggleStatus = (m: Mailbox) => {
    if (m.status !== "停用") {
      const usables = data.filter(isMailboxUsable).length;
      if (m.isDefault && usables === 1) {
        toast.error("当前为唯一可用的默认邮箱，停用前请先新增并设置其他邮箱为默认");
        return;
      }
      setMailboxStatus(m.id, "停用");
      toast.success(`已停用 ${m.email}`);
    } else {
      setMailboxStatus(m.id, "正常");
      // 启用后需重新通过测试方可使用
      if (!m.lastTestedAt) toast.success(`已启用 ${m.email}，请测试连接后使用`);
      else toast.success(`已启用 ${m.email}`);
    }
  };

  const onSetDefault = (m: Mailbox) => {
    if (!isMailboxUsable(m)) {
      toast.error("仅「可用」状态的邮箱可设为默认（需已启用且测试通过）");
      return;
    }
    setDefaultMailbox(m.id);
    toast.success(`已将 ${m.email} 设为默认发件邮箱`);
  };

  return (
    <div className="p-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>出海大数据平台</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>企业设置</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">邮箱</span>
      </div>

      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-2xl p-6 text-white"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <MailboxIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">我的邮箱</h1>
              <p className="text-white/85 text-sm mt-0.5">
                管理用于邮件触达的发件邮箱账号；至少配置一个「正常」状态的邮箱才可发起邮件触达
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 rounded-lg bg-white/15 backdrop-blur-sm px-3 py-2">
              <Building2 className="h-4 w-4" />
              <div className="leading-tight">
                <div className="text-xs text-white/80">当前企业</div>
                <div className="text-sm font-medium">
                  {CURRENT_TENANT.name}
                  <span className="ml-2 font-mono text-xs text-white/80">{CURRENT_TENANT.id}</span>
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="h-9 bg-white/15 text-white border-white/20 hover:bg-white/25"
              onClick={() => setTenantRole(isAdmin ? "member" : "admin")}
              title="演示：切换当前用户角色"
            >
              {isAdmin ? (
                <>
                  <EyeOff className="h-4 w-4" /> 以员工身份预览
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" /> 恢复管理员视图
                </>
              )}
            </Button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={<MailboxIcon className="h-5 w-5" />} label="邮箱总数" value={stats.total} tone="primary" />
        <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="可用（已启用 + 测试通过）" value={stats.usable} tone="emerald" />
        <StatCard icon={<AlertCircle className="h-5 w-5" />} label="待验证" value={stats.pending} tone="amber" />
        <StatCard icon={<Ban className="h-5 w-5" />} label="不可用（异常 / 已停用）" value={stats.unavailable} tone="muted" />
      </div>

      {/* Filter */}
      <Card className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="xl:col-span-2 relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索邮箱地址 / 显示名称 / 用户名"
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {USABILITY_STATES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger>
              <SelectValue placeholder="全部服务商" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部服务商</SelectItem>
              {PROVIDERS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="h-4 w-4" /> 重置
          </Button>
        </div>
      </Card>

      {/* List */}
      <ScopeSection
        title="企业邮箱"
        subtitle={
          isAdmin
            ? "归企业所有，企业内部全员均可用于发信；仅管理员可新增、编辑、启用/停用、删除。"
            : "归企业所有，全员可用于发信。如需新增或变更，请联系企业管理员。"
        }
        icon={<Users className="h-4 w-4" />}
        count={filtered.length}
        canAdd={isAdmin}
        onAdd={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        empty={isAdmin ? "暂无企业邮箱，点击右上「新增邮箱」添加" : "暂无可用的企业邮箱"}
      >
        {filtered.map((m) => (
          <MailboxCard
            key={m.id}
            m={m}
            readOnly={!isAdmin}
            testing={testingId === m.id}
            onTest={() => onTest(m)}
            onEdit={() => {
              setEditing(m);
              setFormOpen(true);
            }}
            onDelete={() => setDelTarget(m)}
            onSetDefault={() => onSetDefault(m)}
            onToggleStatus={() => onToggleStatus(m)}
          />
        ))}
      </ScopeSection>

      <MailboxFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
      />


      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除发件邮箱</AlertDialogTitle>
            <AlertDialogDescription>
              确认删除 <span className="font-mono">{delTarget?.email}</span> ？删除后该邮箱不可用于触达，已发送历史不受影响。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => {
                if (delTarget) {
                  deleteMailbox(delTarget.id);
                  toast.success(`已删除 ${delTarget.email}`);
                }
                setDelTarget(null);
              }}
            >
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ----------------- subcomponents ----------------- */

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "primary" | "emerald" | "rose" | "muted" | "amber";
}) {
  const toneCls = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-100 text-emerald-700",
    rose: "bg-rose-100 text-rose-700",
    muted: "bg-muted text-muted-foreground",
    amber: "bg-amber-100 text-amber-700",
  }[tone];
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${toneCls}`}>
          {icon}
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tabular-nums mt-0.5">{value}</div>
        </div>
      </div>
    </Card>
  );
}

function MailboxCard({
  m,
  readOnly,
  testing,
  onTest,
  onEdit,
  onDelete,
  onSetDefault,
  onToggleStatus,
}: {
  m: Mailbox;
  readOnly?: boolean;
  testing: boolean;
  onTest: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  onToggleStatus: () => void;
}) {
  const pct = Math.min(100, Math.round((m.sentToday / Math.max(1, m.dailyLimit)) * 100));
  const usability = getMailboxUsability(m);
  return (
    <Card className="p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 shrink-0 rounded-xl bg-gradient-to-br from-primary/80 to-accent text-primary-foreground flex items-center justify-center text-base font-semibold uppercase">
          {m.email[0] ?? "?"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-mono text-sm font-medium truncate">{m.email}</div>
            {m.isDefault && (
              <Badge className="bg-amber-100 text-amber-700 border-amber-200 border" variant="outline">
                <Star className="h-3 w-3 mr-0.5 fill-amber-500 stroke-amber-500" />
                默认
              </Badge>
            )}
            <Badge variant="outline" className={usabilityBadgeCls(usability.state)}>
              {usability.state}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 truncate">{m.displayName}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <Meta icon={<Server className="h-3.5 w-3.5" />} label="服务商" value={m.provider} />
        <Meta
          icon={<MailboxIcon className="h-3.5 w-3.5" />}
          label="发信（SMTP）"
          value={m.smtpHost || "—"}
          mono
        />
        <Meta
          icon={<MailboxIcon className="h-3.5 w-3.5" />}
          label="收信（IMAP）"
          value={receiveSummary(m)}
          mono={m.receiveEnabled && m.receiveStatus === "收信正常"}
        />
        <Meta
          icon={<Activity className="h-3.5 w-3.5" />}
          label="上次测试"
          value={formatDateTime(m.lastTestedAt)}
        />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">今日发送 / 日发上限</span>
          <span className="font-mono tabular-nums">
            {m.sentToday} / {m.dailyLimit}
          </span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              pct >= 90 ? "bg-rose-500" : pct >= 60 ? "bg-amber-500" : "bg-primary"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {readOnly ? (
        <div className="mt-4 pt-4 border-t flex items-center justify-end">
          <span className="text-[11px] text-muted-foreground">只读 · 无操作权限</span>
        </div>
      ) : (
      <div className="mt-4 pt-4 border-t flex items-center justify-end gap-1">
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" onClick={onTest} disabled={testing}>
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>测试连接</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={onSetDefault}
                disabled={m.isDefault || !usability.usable}
              >
                {m.isDefault ? <Star className="h-4 w-4 fill-amber-500 text-amber-500" /> : <StarOff className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {m.isDefault ? "已是默认" : "设为默认"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="ghost" onClick={onEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>编辑</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className={m.status !== "停用" ? "text-muted-foreground" : "text-emerald-600"}
                onClick={onToggleStatus}
              >
                <Power className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{m.status !== "停用" ? "停用" : "启用"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="text-rose-600 hover:text-rose-700"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>删除</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      )}
    </Card>
  );
}

function Meta({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`mt-0.5 truncate text-foreground ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}

function ScopeSection({
  title,
  subtitle,
  icon,
  count,
  canAdd,
  onAdd,
  empty,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  count: number;
  canAdd: boolean;
  onAdd: () => void;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
          {icon}
        </div>
        <div>
          <div className="text-base font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>
        {canAdd && (
          <Button size="sm" className="ml-auto h-8" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" /> 新增邮箱
          </Button>
        )}
      </div>
      {count === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">{empty}</Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{children}</div>
      )}
    </section>
  );
}

/* ----------------- form dialog ----------------- */

interface FormState {
  email: string;
  displayName: string;
  provider: MailboxProvider;
  smtpHost: string;
  smtpPort: number;
  encryption: MailboxEncryption;
  receiveEnabled: boolean;
  imapHost: string;
  imapPort: number;
  imapEncryption: MailboxEncryption;
  username: string;
  password: string;
  signature: string;
  dailyLimit: number;
  isDefault: boolean;
  status: MailboxStatus;
}

function emptyForm(): FormState {
  return {
    email: "",
    displayName: "",
    provider: "腾讯企业邮",
    ...PROVIDER_PRESETS["腾讯企业邮"],
    receiveEnabled: true,
    username: "",
    password: "",
    signature: "",
    dailyLimit: 100,
    isDefault: false,
    status: "正常",
  };
}

function MailboxFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Mailbox | null;
}) {
  const [form, setForm] = useState<FormState>(emptyForm());
  const [testing, setTesting] = useState(false);
  /** 是否已手动改过显示名（改过后不再自动覆盖） */
  const [nameTouched, setNameTouched] = useState(false);
  const [detect, setDetect] = useState<DetectResult | null>(null);
  const [tipOpen, setTipOpen] = useState(false);

  // 同步 editing → form（依赖 open + editing.id）
  const editingKey = editing?.id ?? "new";
  const [lastKey, setLastKey] = useState<string>("");
  if (open && lastKey !== editingKey) {
    setLastKey(editingKey);
    setNameTouched(!!editing);
    setDetect(editing ? null : null);

    setForm(
      editing
        ? {
            email: editing.email,
            displayName: editing.displayName,
            provider: editing.provider,
            smtpHost: editing.smtpHost,
            smtpPort: editing.smtpPort,
            encryption: editing.encryption,
            receiveEnabled: editing.receiveEnabled,
            imapHost: editing.imapHost,
            imapPort: editing.imapPort,
            imapEncryption: editing.imapEncryption,
            username: editing.username,
            password: editing.password,
            signature: editing.signature ?? "",
            dailyLimit: editing.dailyLimit,
            isDefault: editing.isDefault,
            status: editing.status,
          }
        : emptyForm(),
    );
  }
  if (!open && lastKey !== "") setTimeout(() => setLastKey(""), 0);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const applyProvider = (p: MailboxProvider, email: string) => {
    const preset = PROVIDER_PRESETS[p];
    setForm((s) => ({
      ...s,
      provider: p,
      smtpHost: preset.smtpHost || s.smtpHost,
      smtpPort: preset.smtpPort,
      encryption: preset.encryption,
      imapHost: preset.imapHost || s.imapHost,
      imapPort: preset.imapPort,
      imapEncryption: preset.imapEncryption,
      username: email || s.username,
      dailyLimit: editing ? s.dailyLimit : PROVIDER_DAILY_LIMIT[p],
    }));
  };

  const onEmailChange = (email: string) => {
    setForm((s) => ({
      ...s,
      email,
      username: email,
      displayName: nameTouched
        ? s.displayName
        : suggestDisplayName(email, CURRENT_TENANT.name),
    }));
    const d = detectProvider(email);
    setDetect(d);
    if (d && d.matched) {
      applyProvider(d.provider, email);
    }
  };

  const onProviderChange = (p: MailboxProvider) => {
    applyProvider(p, form.email);
    setDetect({
      provider: p,
      basis: `已手动指定服务商「${p}」，服务器参数按该服务商默认值填充`,
      matched: p !== "自定义SMTP",
    });
  };

  const guide = PROVIDER_GUIDES[form.provider];

  const validate = (): string | null => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "请输入有效的邮箱地址";
    if (!form.displayName.trim()) return "请输入显示名称";
    if (!form.smtpHost.trim()) return "请填写 SMTP 服务器地址";
    if (!(form.smtpPort > 0 && form.smtpPort < 65536)) return "SMTP 端口无效";
    if (form.receiveEnabled) {
      if (!form.imapHost.trim()) return "已开启收信，请填写 IMAP 服务器地址";
      if (!(form.imapPort > 0 && form.imapPort < 65536)) return "IMAP 端口无效";
    }
    if (!form.username.trim()) return "请输入登录用户名";
    if (form.provider !== "Outlook" && !form.password.trim()) return `请输入${guide.credentialName}`;
    if (form.dailyLimit < 1) return "日发上限至少为 1";
    return null;
  };

  const onSave = async (alsoTest: boolean) => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    let id = editing?.id;
    if (editing) {
      updateMailbox(editing.id, {
        email: form.email,
        displayName: form.displayName,
        provider: form.provider,
        smtpHost: form.smtpHost,
        smtpPort: form.smtpPort,
        encryption: form.encryption,
        receiveEnabled: form.receiveEnabled,
        imapHost: form.receiveEnabled ? form.imapHost : "",
        imapPort: form.imapPort,
        imapEncryption: form.imapEncryption,
        receiveStatus: form.receiveEnabled ? "未测试" : "未开启收信",
        username: form.username,
        password: form.provider === "Outlook" ? "OAUTH2_TOKEN_DEMO" : form.password,
        signature: form.signature,
        dailyLimit: form.dailyLimit,
        status: form.status,
        isDefault: form.isDefault,
      });
      toast.success("已更新邮箱信息");
    } else {
      const created = createMailbox({
        email: form.email,
        displayName: form.displayName,
        provider: form.provider,
        smtpHost: form.smtpHost,
        smtpPort: form.smtpPort,
        encryption: form.encryption,
        receiveEnabled: form.receiveEnabled,
        imapHost: form.receiveEnabled ? form.imapHost : "",
        imapPort: form.imapPort,
        imapEncryption: form.imapEncryption,
        receiveStatus: form.receiveEnabled ? "未测试" : "未开启收信",
        username: form.username,
        password: form.provider === "Outlook" ? "OAUTH2_TOKEN_DEMO" : form.password,
        signature: form.signature,
        dailyLimit: form.dailyLimit,
        status: form.status,
        isDefault: form.isDefault,
      });
      id = created.id;
      toast.success("已新增邮箱");
    }
    if (alsoTest && id) {
      setTesting(true);
      const r = await testMailbox(id);
      setTesting(false);
      if (r.smtp.ok) toast.success(r.smtp.message);
      else toast.error(r.smtp.message);
      if (r.imap.skipped) toast.info(r.imap.message);
      else if (r.imap.ok) toast.success(r.imap.message);
      else toast.error(r.imap.message);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{editing ? "编辑邮箱" : "新增企业邮箱"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[1fr_320px] items-start">
          <div className="space-y-5 md:max-h-[62vh] overflow-y-auto pr-1">
            {/* 第 1 步：必填项 */}
            <StepBlock
              index={1}
              title="填写邮箱与授权凭证"
              desc="这两项无法自动获取，需按右侧配置指导从服务商后台取得。"
              titleExtra={
                <button
                  type="button"
                  onClick={() => setTipOpen(true)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="邮箱填写提示"
                  title="邮箱填写提示"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="邮箱地址" required>
                  <Input
                    value={form.email}
                    onChange={(e) => onEmailChange(e.target.value)}
                    placeholder="name@company.com"
                  />
                </Field>
                <Field label="邮箱服务商" required>
                  <Select
                    value={form.provider}
                    onValueChange={(v) => onProviderChange(v as MailboxProvider)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(editing?.provider === "自定义SMTP"
                        ? [...FORM_PROVIDERS, "自定义SMTP"]
                        : FORM_PROVIDERS
                      ).map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-[11px] text-muted-foreground">
                    系统按邮箱域名自动识别，如识别有误可手动切换。
                  </div>
                </Field>
                {form.provider === "Outlook" ? (
                  <div className="rounded-md border border-sky-200 bg-sky-50/70 p-3 flex items-start gap-2.5 self-end">
                    <Link2 className="h-4 w-4 text-[#0078d4] mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-[#0f4c81]">
                        使用 Microsoft OAuth2
                      </div>
                      <div className="text-[11px] leading-relaxed text-muted-foreground">
                        无需填写邮箱密码或应用密码，保存后将前往 Microsoft 完成授权。
                      </div>
                    </div>
                  </div>
                ) : (
                  <Field label={`${guide.credentialName}`} required className="md:col-span-2">
                    <Input
                      type="password"
                      value={form.password}
                      onChange={(e) => update("password", e.target.value)}
                      placeholder="非邮箱登录密码，见右侧配置指导"
                    />
                  </Field>
                )}
              </div>
            </StepBlock>


            {/* 第 2 步：服务器配置 */}
            <StepBlock
              index={2}
              title="服务器配置（发信 / 收信）"
              desc="系统根据邮箱域名自动识别 SMTP 与 IMAP 参数，可手动修正。"
            >
              <div
                className={`rounded-md border p-3 flex items-start gap-2 ${
                  detect?.matched
                    ? "border-emerald-200 bg-emerald-50/60"
                    : "border-amber-200 bg-amber-50/60"
                }`}
              >
                {detect?.matched ? (
                  <Sparkles className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                )}
                <div className="text-[11px] leading-relaxed text-foreground/80">
                  {detect
                    ? detect.basis
                    : "填写邮箱地址后，系统将自动识别服务商并填充 SMTP（发信）与 IMAP（收信）服务器、端口、加密方式与登录用户名。"}
                </div>
              </div>

              {/* 发信 SMTP */}
              <div className="mt-3 rounded-lg border p-3 space-y-3">
                <div className="text-xs font-medium">发信 · SMTP</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="SMTP 服务器" required>
                    <Input
                      value={form.smtpHost}
                      onChange={(e) => update("smtpHost", e.target.value)}
                      placeholder="smtp.example.com"
                      className="font-mono"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="端口" required>
                      <Input
                        type="number"
                        value={form.smtpPort}
                        onChange={(e) => update("smtpPort", Number(e.target.value))}
                      />
                    </Field>
                    <Field label="加密方式">
                      <Select
                        value={form.encryption}
                        onValueChange={(v) => update("encryption", v as MailboxEncryption)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ENCRYPTIONS.map((e) => (
                            <SelectItem key={e} value={e}>
                              {e}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </div>
              </div>

              {/* 收信 IMAP */}
              <div className="mt-3 rounded-lg border p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium">收信 · IMAP</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      开启后客户回信将自动同步到「客户触达 · 会话」并参与意向真实度分析；关闭则该邮箱仅能发信。
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Label className="text-[11px] text-muted-foreground">接收客户回复</Label>
                    <Switch
                      checked={form.receiveEnabled}
                      onCheckedChange={(v) => update("receiveEnabled", !!v)}
                    />
                  </div>
                </div>

                {!form.receiveEnabled ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50/60 p-2.5 flex items-start gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-[11px] text-foreground/80">
                      未开启收信：该邮箱在会话模块将标注「仅发信，不同步回复」，客户回信需自行到邮箱查看。
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="IMAP 服务器" required>
                      <Input
                        value={form.imapHost}
                        onChange={(e) => update("imapHost", e.target.value)}
                        placeholder="imap.example.com"
                        className="font-mono"
                      />
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="端口" required>
                        <Input
                          type="number"
                          value={form.imapPort}
                          onChange={(e) => update("imapPort", Number(e.target.value))}
                        />
                      </Field>
                      <Field label="加密方式">
                        <Select
                          value={form.imapEncryption}
                          onValueChange={(v) => update("imapEncryption", v as MailboxEncryption)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ENCRYPTIONS.map((e) => (
                              <SelectItem key={e} value={e}>
                                {e}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    <div className="md:col-span-2 text-[11px] text-muted-foreground">
                      收信与发信共用同一份「{guide.credentialName}」，无需额外获取凭证。
                    </div>
                  </div>
                )}
              </div>
            </StepBlock>


            {/* 第 3 步：发信策略 */}
            <StepBlock
              index={3}
              title="发信策略"
              desc="系统已按服务商给出推荐值，可按需调整。"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    日发上限
                    <TooltipProvider delayDuration={150}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground focus:outline-none"
                            aria-label="日发上限说明"
                          >
                            <HelpCircle className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                          该值决定此邮箱每日可触达的邮件上限。设置过高易触发服务商风控，导致邮箱被限流或封禁。建议新邮箱从
                          <span className="font-medium"> 30–50 封/日 </span>起步，稳定养号 2–4 周后逐步提升；成熟邮箱推荐
                          <span className="font-medium"> 100–200 封/日</span>，一般不超过 300 封/日。
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input
                    type="number"
                    value={form.dailyLimit}
                    onChange={(e) => update("dailyLimit", Number(e.target.value))}
                  />
                </div>
                {editing ? (
                  <Field label="启用状态">
                    <Select
                      value={form.status === "停用" ? "停用" : "正常"}
                      onValueChange={(v) => update("status", v as MailboxStatus)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="正常">启用</SelectItem>
                        <SelectItem value="停用">停用</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                ) : (
                  <AutoField label="启用状态" value="启用（保存后需测试通过方可使用）" />
                )}
                <div className="flex items-center gap-3 md:col-span-2">
                  <Switch
                    checked={form.isDefault}
                    onCheckedChange={(v) => update("isDefault", !!v)}
                    disabled={form.status !== "正常"}
                  />
                  <Label className="text-sm">设为默认发件邮箱</Label>
                </div>
                <Field label="邮件签名（选填）" className="md:col-span-2">
                  <Textarea
                    rows={3}
                    value={form.signature}
                    onChange={(e) => update("signature", e.target.value)}
                    placeholder="将自动附加到邮件末尾，建议包含公司名、联系方式与官网"
                  />
                </Field>
              </div>
            </StepBlock>
          </div>

          <aside className="rounded-lg border bg-muted/30 p-4 space-y-3 md:max-h-[62vh] overflow-y-auto md:sticky md:top-0">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <div className="text-sm font-semibold">配置指导 · {form.provider}</div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              指导内容随左侧「服务商」选择自动切换。需要获取：
              <span className="font-medium text-foreground">{guide.credentialName}</span>
            </div>
            <ol className="space-y-2">
              {guide.steps.map((s, i) => (
                <li key={i} className="flex gap-2 text-[12px] leading-relaxed">
                  <span className="h-4 w-4 shrink-0 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <div className="space-y-1.5">
              <div className="text-xs font-medium">注意事项</div>
              {guide.notes.map((n, i) => (
                <div key={i} className="flex gap-1.5 text-[11px] text-muted-foreground">
                  <AlertCircle className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                  <span>{n}</span>
                </div>
              ))}
            </div>

            <div className="rounded-md border bg-background p-3 space-y-2">
              <div className="text-xs font-semibold">开启收信（IMAP）</div>
              <div className="text-[11px] text-muted-foreground">
                需要同步客户回复时，请确认该邮箱已开启 IMAP 服务。
              </div>
              <ol className="space-y-2">
                {guide.imapSteps.map((s, i) => (
                  <li key={i} className="flex gap-2 text-[12px] leading-relaxed">
                    <span className="h-4 w-4 shrink-0 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
              {guide.imapNotes.map((n, i) => (
                <div key={i} className="flex gap-1.5 text-[11px] text-muted-foreground">
                  <AlertCircle className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                  <span>{n}</span>
                </div>
              ))}
            </div>

          </aside>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          {form.provider === "Outlook" ? (
            <>
              <Button variant="outline" onClick={() => onSave(false)}>
                保存
              </Button>
              <Button
                className="bg-[#0078d4] hover:bg-[#005a9e] text-white"
                onClick={async () => {
                  const err = validate();
                  if (err) {
                    toast.error(err);
                    return;
                  }
                  window.open(
                    "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
                    "_blank",
                    "noopener,noreferrer",
                  );
                  await onSave(false);
                  toast.info("已在新标签页打开 Microsoft 授权，完成后返回本页");
                }}
              >
                <Link2 className="h-4 w-4" />
                保存并连接 Microsoft
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" disabled={testing} onClick={() => onSave(true)}>
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                保存并测试
              </Button>
              <Button onClick={() => onSave(false)}>保存</Button>
            </>
          )}
        </DialogFooter>


      </DialogContent>

      <Dialog open={tipOpen} onOpenChange={setTipOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>邮箱填写提示</DialogTitle>
          </DialogHeader>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {form.provider === "Outlook"
              ? "填写邮箱地址后连接 Microsoft 账户，系统将通过 OAuth2 授权并使用 Microsoft Graph API 发信与收信。"
              : `只需填写「邮箱地址 + ${guide.credentialName}」，发信（SMTP）与收信（IMAP）参数由系统按域名自动识别；完成后建议「保存并测试」分别验证两条通道的连通性。`}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTipOpen(false)}>
              知道了
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function StepBlock({
  index,
  title,
  desc,
  action,
  titleExtra,
  children,
}: {
  index: number;
  title: string;
  desc: string;
  action?: React.ReactNode;
  titleExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-2">
        <span className="h-5 w-5 shrink-0 rounded-full bg-primary text-primary-foreground text-[11px] flex items-center justify-center mt-0.5">
          {index}
        </span>
        <div className="flex-1">
          <div className="text-sm font-semibold flex items-center gap-1.5">
            {title}
            {titleExtra}
          </div>
          <div className="text-[11px] text-muted-foreground">{desc}</div>
        </div>
        {action}
      </div>
      <div className="pl-7">{children}</div>
    </section>
  );
}

function AutoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-md border bg-muted/40 px-2.5 py-2">
      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
        <Sparkles className="h-3 w-3" /> {label}
      </div>
      <div className={`text-xs mt-0.5 truncate ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}


function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs text-muted-foreground">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}