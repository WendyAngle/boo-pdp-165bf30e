import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ListPagination } from "@/components/ListPagination";
import { createFileRoute } from "@tanstack/react-router";
import {
  Mailbox,
  Plus,
  Upload,
  Download,
  Search,
  Info,
  ShieldCheck,
  ShieldAlert,
  Ban,
  RotateCcw,
  UserPlus,
  Users,
  Pause,
  Play,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DEMO_TENANTS,
  PROVIDER_OPTIONS,
  KIND_LABEL,
  subscribe,
  getAll,
  getTenantName,
  canAssign,
  canRevoke,
  assignToTenant,
  unassign,
  revoke,
  setSuspended,
  createAccount,
  parseCsv,
  commitImport,
  CSV_TEMPLATE_SAMPLE,
  type EmailAccount,
  type AccountKind,
  type VerifyState,
  type ImportRow,
  type NewAccountInput,
} from "@/lib/email-accounts";

export const Route = createFileRoute("/_app/outreach/admin/email-accounts")({
  head: () => ({
    meta: [
      { title: "邮件账号 · 管理后台 | 出海大数据平台" },
      {
        name: "description",
        content:
          "平台运营侧维护各邮件服务商下的发信身份（Subuser / Verified Identity / Sending Domain / SMTP 凭证），并将其分配给企业租户使用。",
      },
    ],
  }),
  component: EmailAccountsPage,
});

function useAccounts(): EmailAccount[] {
  return useSyncExternalStore(subscribe, getAll, getAll);
}

function EmailAccountsPage() {
  const accounts = useAccounts();

  // filters
  const [q, setQ] = useState("");
  const [providerFilter, setProviderFilter] = useState<string>("__all");
  const [statusFilter, setStatusFilter] = useState<string>("__all");
  const [tenantFilter, setTenantFilter] = useState<string>("__all");
  const [verifyFilter, setVerifyFilter] = useState<string>("__all");

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [assignTargets, setAssignTargets] = useState<string[] | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<EmailAccount | null>(null);

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase();
    return accounts.filter((a) => {
      if (providerFilter !== "__all" && a.providerId !== providerFilter) return false;
      if (statusFilter === "assigned" && !a.assignedTenantId) return false;
      if (statusFilter === "unassigned" && a.assignedTenantId) return false;
      if (statusFilter === "suspended" && a.status !== "suspended") return false;
      if (statusFilter === "revoked" && a.status !== "revoked") return false;
      if (statusFilter === "pending-verify" && a.dkim === "verified" && a.spf === "verified") return false;
      if (tenantFilter !== "__all" && a.assignedTenantId !== tenantFilter) return false;
      if (verifyFilter === "verified" && (a.dkim !== "verified" || a.spf !== "verified")) return false;
      if (verifyFilter === "pending" && a.dkim !== "pending" && a.spf !== "pending") return false;
      if (verifyFilter === "failed" && a.dkim !== "failed" && a.spf !== "failed") return false;
      if (kw && !(
        a.identity.toLowerCase().includes(kw) ||
        a.displayName.toLowerCase().includes(kw)
      )) return false;
      return true;
    });
  }, [accounts, q, providerFilter, statusFilter, tenantFilter, verifyFilter]);

  const [page, setPage] = useState(1);
  const pageSize = 10;
  useEffect(() => {
    setPage(1);
  }, [q, providerFilter, statusFilter, tenantFilter, verifyFilter]);
  const pageData = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page],
  );

  const kpi = useMemo(() => {
    const total = accounts.length;
    const assigned = accounts.filter((a) => a.assignedTenantId && a.status !== "revoked").length;
    const available = accounts.filter((a) => a.status === "available" && !a.assignedTenantId).length;
    const pendingVerify = accounts.filter((a) => a.dkim !== "verified" || a.spf !== "verified").length;
    const suspended = accounts.filter((a) => a.status === "suspended").length;
    return { total, assigned, available, pendingVerify, suspended };
  }, [accounts]);

  const allSelectedOnPage = filtered.length > 0 && filtered.every((a) => selected.has(a.id));
  function togglePage() {
    if (allSelectedOnPage) {
      const s = new Set(selected);
      filtered.forEach((a) => s.delete(a.id));
      setSelected(s);
    } else {
      const s = new Set(selected);
      filtered.forEach((a) => s.add(a.id));
      setSelected(s);
    }
  }
  function toggleOne(id: string) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  }

  function batchSuspend(v: boolean) {
    const ids = [...selected];
    ids.forEach((id) => setSuspended(id, v));
    toast.success(`已${v ? "暂停" : "恢复"} ${ids.length} 个账号`);
    setSelected(new Set());
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="p-6 space-y-4">
        {/* Hero */}
        <section
          className="relative overflow-hidden rounded-2xl p-6 lg:p-7 text-white"
          style={{ background: "var(--gradient-hero)" }}
        >
          <div className="absolute -right-10 -bottom-10 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Mailbox className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold">邮件账号</h1>
                <p className="text-white/85 text-sm mt-0.5 max-w-3xl">
                  管理各邮件服务商下的可分配发信身份，并将其分配给企业租户使用。与「邮件服务商」（通道健康度）、「企业设置 → 发信邮箱」（租户员工可见的邮箱）互相独立、上下游联动。
                </p>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-6 text-white shrink-0">
              <MetricBlock label="账号总数" value={kpi.total} suffix="个" />
              <MetricBlock label="空闲可分配" value={kpi.available} suffix="个" />
              <MetricBlock label="已分配" value={kpi.assigned} suffix="个" />
              <MetricBlock label="待验证" value={kpi.pendingVerify} suffix="个" warn={kpi.pendingVerify > 0} />
              <MetricBlock label="暂停" value={kpi.suspended} suffix="个" warn={kpi.suspended > 0} />
            </div>
          </div>
        </section>

        {/* Filters */}
        <Card className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="搜索 identity / 展示名"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-8"
              />
            </div>
            <FilterSelect
              value={providerFilter}
              onChange={setProviderFilter}
              placeholder="全部服务商"
              options={[
                { value: "__all", label: "全部服务商" },
                ...PROVIDER_OPTIONS.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="全部状态"
              options={[
                { value: "__all", label: "全部状态" },
                { value: "unassigned", label: "未分配" },
                { value: "assigned", label: "已分配" },
                { value: "pending-verify", label: "待验证" },
                { value: "suspended", label: "暂停" },
                { value: "revoked", label: "已回收" },
              ]}
            />
            <FilterSelect
              value={tenantFilter}
              onChange={setTenantFilter}
              placeholder="全部租户"
              options={[
                { value: "__all", label: "全部租户" },
                ...DEMO_TENANTS.map((t) => ({ value: t.id, label: t.name })),
              ]}
            />
            <FilterSelect
              value={verifyFilter}
              onChange={setVerifyFilter}
              placeholder="DKIM/SPF"
              options={[
                { value: "__all", label: "全部 DKIM/SPF" },
                { value: "verified", label: "已验证" },
                { value: "pending", label: "验证中" },
                { value: "failed", label: "验证失败" },
              ]}
            />
          </div>
        </Card>

        {/* Actions above the list */}
        <div className="flex items-center justify-start gap-2">
          <Button variant="outline" onClick={() => setSummaryOpen(true)}>
            <Users className="h-4 w-4" /> 按租户汇总
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" /> 批量导入
          </Button>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> 新增账号
          </Button>
        </div>

        {/* Batch bar */}
        {selected.size > 0 && (
          <Card className="p-3 flex items-center gap-2 bg-primary/5 border-primary/20">
            <span className="text-sm">
              已选 <strong>{selected.size}</strong> 个账号
            </span>
            <div className="flex-1" />
            <Button size="sm" onClick={() => setAssignTargets([...selected])}>
              <UserPlus className="h-3.5 w-3.5" /> 批量分配租户
            </Button>
            <Button size="sm" variant="outline" onClick={() => batchSuspend(true)}>
              <Pause className="h-3.5 w-3.5" /> 批量暂停
            </Button>
            <Button size="sm" variant="outline" onClick={() => batchSuspend(false)}>
              <Play className="h-3.5 w-3.5" /> 批量恢复
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              取消选择
            </Button>
          </Card>
        )}

        {/* Table */}
        <Card className="p-0 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allSelectedOnPage} onCheckedChange={togglePage} aria-label="全选" />
                </TableHead>
                <TableHead>Identity / 展示名</TableHead>
                <TableHead>服务商</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>DKIM / SPF</TableHead>
                <TableHead>日额度 / 已用</TableHead>
                <TableHead>分配租户</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-10">
                    没有匹配的账号
                  </TableCell>
                </TableRow>
              )}
              {pageData.map((a) => {
                const revoked = a.status === "revoked";
                const revokeChk = canRevoke(a);
                return (
                  <TableRow key={a.id} className={cn(revoked && "opacity-60")}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(a.id)}
                        onCheckedChange={() => toggleOne(a.id)}
                        aria-label="选择"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-sm">{a.identity}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {a.displayName}
                        {a.cost && (
                          <Badge variant="outline" className="ml-1.5 text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                            覆盖计价 {a.cost.currency === "USD" ? "$" : "¥"}
                            {a.cost.per1k}/千
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{a.providerName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {KIND_LABEL[a.kind]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <VerifyBadge label="DKIM" state={a.dkim} />
                        <VerifyBadge label="SPF" state={a.spf} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-mono">
                        {a.usedToday.toLocaleString()} / {a.dailyCap.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        月上限 {a.monthlyCap.toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      {a.assignedTenantId ? (
                        <div>
                          <div className="text-sm">{getTenantName(a.assignedTenantId) ?? a.assignedTenantId}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {a.assignedAt} · 排队 {a.pendingTasks ?? 0}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">未分配</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge account={a} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {!revoked && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px]"
                            onClick={() => setAssignTargets([a.id])}
                          >
                            <UserPlus className="h-3 w-3" />
                            {a.assignedTenantId ? "改派" : "分配租户"}
                          </Button>
                        )}
                        {a.assignedTenantId && !revoked && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px]"
                            onClick={() => {
                              unassign(a.id);
                              toast.success("已解除分配");
                            }}
                          >
                            解除
                          </Button>
                        )}
                        {!revoked && (
                          a.status === "suspended" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[11px]"
                              onClick={() => {
                                setSuspended(a.id, false);
                                toast.success("已恢复");
                              }}
                            >
                              <Play className="h-3 w-3" /> 恢复
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-[11px]"
                              onClick={() => {
                                setSuspended(a.id, true);
                                toast.success("已暂停");
                              }}
                            >
                              <Pause className="h-3 w-3" /> 暂停
                            </Button>
                          )
                        )}
                        {!revoked && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-[11px] text-rose-600 hover:text-rose-700"
                                  disabled={!revokeChk.ok}
                                  onClick={() => setRevokeTarget(a)}
                                >
                                  <Trash2 className="h-3 w-3" /> 回收
                                </Button>
                              </span>
                            </TooltipTrigger>
                            {!revokeChk.ok && (
                              <TooltipContent side="left">
                                {revokeChk.reason}
                              </TooltipContent>
                            )}
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
        {filtered.length > 0 && (
          <div className="px-1">
            <ListPagination page={page} pageSize={pageSize} total={filtered.length} onPageChange={setPage} />
          </div>
        )}

        <Card className="p-3 bg-muted/40 border-muted text-xs text-muted-foreground flex items-start gap-2">
          <Info className="h-3.5 w-3.5 mt-0.5" />
          <span>
            回收操作不可恢复。分配前系统会自动校验 DKIM/SPF 验证状态与服务商健康度；
            服务商熔断中的账号会自动禁止分配。
          </span>
        </Card>

        {/* Dialogs */}
        <AssignSheet
          open={!!assignTargets}
          ids={assignTargets ?? []}
          onClose={() => {
            setAssignTargets(null);
            setSelected(new Set());
          }}
        />
        <CreateAccountDialog open={createOpen} onOpenChange={setCreateOpen} />
        <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
        <RevokeDialog
          account={revokeTarget}
          onClose={() => setRevokeTarget(null)}
        />
        <TenantSummarySheet
          open={summaryOpen}
          onClose={() => setSummaryOpen(false)}
          accounts={accounts}
          onFilterTenant={(id) => {
            setTenantFilter(id);
            setSummaryOpen(false);
          }}
        />
      </div>
    </TooltipProvider>
  );
}

// ---------- Small components ----------
function MetricBlock({ label, value, suffix, hint, warn }: {
  label: string; value: string | number; suffix?: string; hint?: string; warn?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-white/75">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">
        {value}{suffix && <span className="text-sm font-medium text-white/80 ml-1">{suffix}</span>}
      </div>
      {hint && (
        <div className={cn("mt-0.5 text-[11px]", warn ? "text-amber-200" : "text-white/70")}>{hint}</div>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function VerifyBadge({ label, state }: { label: string; state: VerifyState }) {
  const map: Record<VerifyState, string> = {
    verified: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    failed: "bg-rose-50 text-rose-700 border-rose-200",
  };
  return (
    <Badge variant="outline" className={cn("text-[10px] gap-0.5", map[state])}>
      {state === "verified" ? (
        <ShieldCheck className="h-2.5 w-2.5" />
      ) : (
        <ShieldAlert className="h-2.5 w-2.5" />
      )}
      {label}
    </Badge>
  );
}

function StatusBadge({ account }: { account: EmailAccount }) {
  if (account.status === "revoked")
    return (
      <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground gap-0.5">
        <Ban className="h-3 w-3" /> 已回收
      </Badge>
    );
  if (account.status === "suspended")
    return (
      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 gap-0.5">
        <Pause className="h-3 w-3" /> 暂停
      </Badge>
    );
  if (account.assignedTenantId)
    return (
      <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-200">
        已分配
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
      空闲
    </Badge>
  );
}

// ---------- Assign sheet ----------
function AssignSheet({
  open,
  ids,
  onClose,
}: {
  open: boolean;
  ids: string[];
  onClose: () => void;
}) {
  const accounts = useAccounts();
  const targets = accounts.filter((a) => ids.includes(a.id));
  const [tenantId, setTenantId] = useState<string>("");
  const [override, setOverride] = useState<string>("");

  function submit() {
    if (!tenantId) {
      toast.error("请选择目标租户");
      return;
    }
    const overrideNum = override ? Number(override) : undefined;
    const res = assignToTenant(ids, tenantId, overrideNum);
    if (res.assigned > 0) {
      toast.success(`已分配 ${res.assigned} 个账号给 ${getTenantName(tenantId)}`);
    }
    if (res.skipped.length > 0) {
      toast.error(`${res.skipped.length} 个账号未分配：${res.skipped[0].reason}`);
    }
    setTenantId("");
    setOverride("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>分配租户</DialogTitle>
          <DialogDescription>
            将选中的 {targets.length} 个邮件账号分配给指定租户。系统会自动校验 DKIM/SPF 与服务商健康度。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>目标租户</Label>
            <Select value={tenantId} onValueChange={setTenantId}>
              <SelectTrigger>
                <SelectValue placeholder="选择租户" />
              </SelectTrigger>
              <SelectContent>
                {DEMO_TENANTS.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} · <span className="text-muted-foreground">{t.id}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {targets.length === 1 && (
            <div className="space-y-2">
              <Label>覆盖日额度（可选）</Label>
              <Input
                type="number"
                placeholder={`默认 ${targets[0].dailyCap.toLocaleString()}`}
                value={override}
                onChange={(e) => setOverride(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">留空则沿用账号原日额度</p>
            </div>
          )}
          <Card className="p-3 max-h-[240px] overflow-auto space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">待分配账号</div>
            {targets.map((a) => {
              const chk = canAssign(a);
              return (
                <div key={a.id} className="text-xs flex items-center justify-between gap-2">
                  <span className="font-mono truncate">{a.identity}</span>
                  <span className="text-muted-foreground">{a.providerName}</span>
                  {chk.ok ? (
                    <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">可分配</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200">
                      {chk.reason}
                    </Badge>
                  )}
                </div>
              );
            })}
          </Card>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={submit}>确认分配</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Create dialog ----------
function CreateAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [form, setForm] = useState<NewAccountInput>({
    providerId: PROVIDER_OPTIONS[0].id,
    identity: "",
    displayName: "",
    kind: "verified-identity",
    dailyCap: 10000,
    monthlyCap: 200000,
    notes: "",
  });

  function submit() {
    if (!form.identity.trim()) {
      toast.error("请填写 identity");
      return;
    }
    createAccount({
      ...form,
      displayName: form.displayName || form.identity,
    });
    toast.success("已新增账号，DKIM/SPF 待验证");
    onOpenChange(false);
    setForm({
      providerId: PROVIDER_OPTIONS[0].id,
      identity: "",
      displayName: "",
      kind: "verified-identity",
      dailyCap: 10000,
      monthlyCap: 200000,
      notes: "",
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>新增邮件账号</DialogTitle>
          <DialogDescription>登记一个新的服务商发信身份，新账号默认 DKIM/SPF 为待验证状态。</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>所属服务商</Label>
              <Select
                value={form.providerId}
                onValueChange={(v) => setForm({ ...form, providerId: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>类型</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm({ ...form, kind: v as AccountKind })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_LABEL) as AccountKind[]).map((k) => (
                    <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Identity</Label>
            <Input
              value={form.identity}
              placeholder="如 notify@example.com 或 subuser_xxx"
              onChange={(e) => setForm({ ...form, identity: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>展示名</Label>
            <Input
              value={form.displayName}
              placeholder="留空则使用 identity"
              onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>日额度</Label>
              <Input
                type="number"
                value={form.dailyCap}
                onChange={(e) => setForm({ ...form, dailyCap: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>月额度</Label>
              <Input
                type="number"
                value={form.monthlyCap}
                onChange={(e) => setForm({ ...form, monthlyCap: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>备注</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={submit}>创建</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Import dialog ----------
function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [step, setStep] = useState<"input" | "preview">("input");

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE_SAMPLE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "email-accounts-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text().then(setText);
  }

  function preview() {
    const parsed = parseCsv(text);
    if (parsed.length === 0) {
      toast.error("未解析到有效行");
      return;
    }
    setRows(parsed);
    setStep("preview");
  }

  function confirm() {
    const n = commitImport(rows);
    toast.success(`成功导入 ${n} 个账号`);
    reset();
    onOpenChange(false);
  }

  function reset() {
    setText("");
    setRows([]);
    setStep("input");
  }

  const stats = useMemo(() => {
    return {
      newN: rows.filter((r) => r.status === "new").length,
      dup: rows.filter((r) => r.status === "duplicate").length,
      bad: rows.filter((r) => r.status === "invalid").length,
    };
  }, [rows]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>批量导入邮件账号</DialogTitle>
          <DialogDescription>
            通过 CSV 一次登记多个账号。表头字段：providerId, identity, displayName, kind, dailyCap, monthlyCap, currency, per1k, notes
          </DialogDescription>
        </DialogHeader>
        {step === "input" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="h-3.5 w-3.5" /> 下载模板
              </Button>
              <label className="text-sm">
                <input type="file" accept=".csv" className="hidden" onChange={onFile} />
                <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border cursor-pointer hover:bg-accent">
                  <Upload className="h-3.5 w-3.5" /> 选择 CSV 文件
                </span>
              </label>
            </div>
            <Textarea
              rows={10}
              placeholder="也可以直接粘贴 CSV 内容到这里"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="font-mono text-xs"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
              <Button onClick={preview} disabled={!text.trim()}>预览校验</Button>
            </DialogFooter>
          </div>
        )}
        {step === "preview" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                新增 {stats.newN}
              </Badge>
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                重复跳过 {stats.dup}
              </Badge>
              <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">
                非法阻断 {stats.bad}
              </Badge>
            </div>
            <div className="border rounded-md max-h-[360px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">行</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Identity</TableHead>
                    <TableHead>信息</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow
                      key={r.row}
                      className={cn(
                        r.status === "new" && "bg-emerald-50/40",
                        r.status === "duplicate" && "bg-amber-50/40",
                        r.status === "invalid" && "bg-rose-50/40",
                      )}
                    >
                      <TableCell className="font-mono text-xs">{r.row}</TableCell>
                      <TableCell>
                        {r.status === "new" && <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">新增</Badge>}
                        {r.status === "duplicate" && <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">重复</Badge>}
                        {r.status === "invalid" && <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200">非法</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">{r.raw.providerId}</TableCell>
                      <TableCell className="text-xs font-mono">{r.raw.identity}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.message ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("input")}>
                <RotateCcw className="h-3.5 w-3.5" /> 返回修改
              </Button>
              <Button onClick={confirm} disabled={stats.newN === 0}>
                确认导入 {stats.newN} 条
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- Revoke dialog ----------
function RevokeDialog({
  account,
  onClose,
}: {
  account: EmailAccount | null;
  onClose: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const open = !!account;

  function submit() {
    if (!account) return;
    if (confirmText !== "REVOKE") {
      toast.error("请输入 REVOKE 以确认");
      return;
    }
    const res = revoke(account.id);
    if (!res.ok) {
      toast.error(res.reason);
      return;
    }
    toast.success("已回收该账号");
    setConfirmText("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setConfirmText(""); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-rose-700">回收邮件账号</DialogTitle>
          <DialogDescription>
            回收后账号不可再分配，历史发信记录保留。此操作不可恢复。
          </DialogDescription>
        </DialogHeader>
        {account && (
          <div className="space-y-3">
            <Card className="p-3 space-y-1 text-sm bg-muted/40">
              <div><span className="text-muted-foreground">Identity：</span><span className="font-mono">{account.identity}</span></div>
              <div><span className="text-muted-foreground">服务商：</span>{account.providerName}</div>
              {account.assignedTenantId && (
                <div><span className="text-muted-foreground">当前分配：</span>{getTenantName(account.assignedTenantId)}</div>
              )}
              <div><span className="text-muted-foreground">排队任务：</span>{account.pendingTasks ?? 0}</div>
            </Card>
            <div className="space-y-1.5">
              <Label>请输入 <span className="font-mono text-rose-600">REVOKE</span> 以确认</Label>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button
            className="bg-rose-600 hover:bg-rose-700 text-white"
            onClick={submit}
            disabled={confirmText !== "REVOKE"}
          >
            确认回收
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Tenant summary drawer ----------
function TenantSummarySheet({
  open,
  onClose,
  accounts,
  onFilterTenant,
}: {
  open: boolean;
  onClose: () => void;
  accounts: EmailAccount[];
  onFilterTenant: (tenantId: string) => void;
}) {
  const rows = useMemo(() => {
    return DEMO_TENANTS.map((t) => {
      const owned = accounts.filter(
        (a) => a.assignedTenantId === t.id && a.status !== "revoked",
      );
      return {
        tenant: t,
        count: owned.length,
        totalDaily: owned.reduce((s, a) => s + a.dailyCap, 0),
        usedToday: owned.reduce((s, a) => s + a.usedToday, 0),
        pending: owned.reduce((s, a) => s + (a.pendingTasks ?? 0), 0),
      };
    });
  }, [accounts]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[520px] sm:max-w-[520px]">
        <SheetHeader>
          <SheetTitle>按租户汇总</SheetTitle>
          <SheetDescription>展示每个租户当前已分配账号的配额与用量。</SheetDescription>
        </SheetHeader>
        <div className="py-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>租户</TableHead>
                <TableHead className="text-right">账号数</TableHead>
                <TableHead className="text-right">日额度合计</TableHead>
                <TableHead className="text-right">今日已用</TableHead>
                <TableHead className="text-right">排队</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.tenant.id}>
                  <TableCell>
                    <div className="text-sm">{r.tenant.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{r.tenant.id}</div>
                  </TableCell>
                  <TableCell className="text-right">{r.count}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{r.totalDaily.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{r.usedToday.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{r.pending}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => onFilterTenant(r.tenant.id)}>
                      查看
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SheetContent>
    </Sheet>
  );
}