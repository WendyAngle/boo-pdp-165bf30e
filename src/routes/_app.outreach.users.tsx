import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  UserCog,
  Users,
  UserCheck,
  UserX,
  Search,
  Plus,
  Upload,
  Download,
  Eye,
  Pencil,
  RotateCcw,
  ChevronRight,
  ShieldCheck,
  FileSpreadsheet,
  FileDown,
  CheckCircle2,
  KeyRound,
  Building2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  DialogDescription,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListPagination } from "@/components/ListPagination";
import { Checkbox } from "@/components/ui/checkbox";
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

export const Route = createFileRoute("/_app/outreach/users")({
  head: () => ({ meta: [{ title: "出海大数据平台 · 我的员工 | 出海大数据平台" }] }),
  component: UserSideUsersPage,
});

type UserStatus = "正常" | "停用";
type Gender = "男" | "女" | "未知";

interface AppUser {
  id: string;
  name: string;
  phone: string;
  email: string;
  gender: Gender;
  status: UserStatus;
  remark: string;
  createdAt: string;
}

// 当前企业（登录用户所在企业）
const CURRENT_TENANT = { id: "T202600", name: "字节跳动" };

const USER_NAMES = [
  "张伟", "王芳", "李娜", "刘洋", "陈思", "杨明", "赵磊", "黄雨",
  "周凯", "吴婷", "郑浩", "孙颖", "马超", "朱琳", "胡杰", "林晓",
  "高翔", "何静", "梁宇", "罗敏",
];
const GENDERS: Gender[] = ["男", "女", "未知"];
const STATUSES: UserStatus[] = ["正常", "停用"];

const MOCK: AppUser[] = Array.from({ length: 26 }).map((_, i) => {
  const name =
    USER_NAMES[i % USER_NAMES.length] +
    (i >= USER_NAMES.length ? String(Math.floor(i / USER_NAMES.length) + 1) : "");
  return {
    id: `U${String(200001 + i).padStart(6, "0")}`,
    name,
    phone: "138" + String(10000000 + ((i * 1379) % 89999999)).slice(0, 8),
    email: i % 5 === 0 ? "" : `staff${i + 1}@bytetech.cn`,
    gender: i % 7 === 0 ? "未知" : GENDERS[i % 2],
    status: i % 11 === 0 ? "停用" : "正常",
    remark: i % 3 === 0 ? "" : "企业内部员工账号，负责日常业务操作。",
    createdAt: `2026-${String(((i % 6) + 1)).padStart(2, "0")}-${String(((i % 27) + 1)).padStart(2, "0")}`,
  };
});

function statusBadge(s: UserStatus) {
  return s === "正常"
    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : "bg-muted text-muted-foreground border-border";
}

function UserSideUsersPage() {
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [data, setData] = useState<AppUser[]>(MOCK);
  const [toggleTarget, setToggleTarget] = useState<AppUser | null>(null);
  const [resetTarget, setResetTarget] = useState<AppUser | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [viewTarget, setViewTarget] = useState<AppUser | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    return data.filter((u) => {
      if (
        keyword &&
        !`${u.id} ${u.name} ${u.phone} ${u.email}`
          .toLowerCase()
          .includes(keyword.toLowerCase())
      )
        return false;
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      return true;
    });
  }, [data, keyword, statusFilter]);

  const total = filtered.length;
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize);

  const pageIds = pageData.map((u) => u.id);
  const allPageChecked = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageChecked = pageIds.some((id) => selected.has(id));
  const togglePageAll = (v: boolean) => {
    setSelected((s) => {
      const next = new Set(s);
      if (v) pageIds.forEach((id) => next.add(id));
      else pageIds.forEach((id) => next.delete(id));
      return next;
    });
  };
  const toggleOne = (id: string, v: boolean) => {
    setSelected((s) => {
      const next = new Set(s);
      if (v) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const exportUsers = () => {
    const rows =
      selected.size > 0 ? data.filter((u) => selected.has(u.id)) : filtered;
    if (rows.length === 0) {
      toast.error("没有可导出的数据");
      return;
    }
    const headers = [
      "用户ID",
      "昵称/姓名",
      "手机号码",
      "邮箱",
      "性别",
      "状态",
      "创建时间",
      "备注",
    ];
    const csvEscape = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      headers.join(","),
      ...rows.map((u) =>
        [u.id, u.name, u.phone, u.email, u.gender, u.status, u.createdAt, u.remark]
          .map(csvEscape)
          .join(","),
      ),
    ].join("\r\n");
    const blob = new Blob(["\uFEFF" + lines], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `员工数据_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(
      selected.size > 0
        ? `已导出所选 ${rows.length} 条员工`
        : `已导出全部 ${rows.length} 条员工`,
    );
  };

  const stats = useMemo(() => {
    const c = (fn: (u: AppUser) => boolean) => data.filter(fn).length;
    return {
      total: data.length,
      active: c((u) => u.status === "正常"),
      disabled: c((u) => u.status === "停用"),
    };
  }, [data]);

  const reset = () => {
    setKeyword("");
    setStatusFilter("all");
    setPage(1);
  };

  return (
    <div className="p-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>出海大数据平台</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">员工</span>
      </div>

      {/* Hero */}
      <section
        className="relative overflow-hidden rounded-2xl p-6 text-white"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <UserCog className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">我的员工</h1>
              <p className="text-white/85 text-sm mt-0.5">
                管理本企业的员工账号、登录状态与基础信息
              </p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 rounded-lg bg-white/15 backdrop-blur-sm px-3 py-2">
            <Building2 className="h-4 w-4" />
            <div className="leading-tight">
              <div className="text-xs text-white/80">当前企业</div>
              <div className="text-sm font-medium">
                {CURRENT_TENANT.name}
                <span className="ml-2 font-mono text-xs text-white/80">
                  {CURRENT_TENANT.id}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats（3 卡） */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="员工总数"
          mainValue={stats.total}
          tone="primary"
        />
        <StatCard
          icon={<UserCheck className="h-5 w-5" />}
          label="正常"
          mainValue={stats.active}
          tone="emerald"
        />
        <StatCard
          icon={<UserX className="h-5 w-5" />}
          label="停用"
          mainValue={stats.disabled}
          tone="rose"
        />
      </div>

      {/* Search */}
      <Card className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="xl:col-span-2 relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
              placeholder="搜索用户ID / 姓名 / 手机号 / 邮箱"
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="h-4 w-4" /> 重置
          </Button>
          <Button onClick={() => toast.success(`已应用筛选，共 ${total} 条`)}>
            <Search className="h-4 w-4" /> 搜索
          </Button>
        </div>
      </Card>

      {/* Actions + Table */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="text-sm text-muted-foreground">
            共 <span className="font-semibold text-foreground">{total}</span> 条员工记录
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="h-4 w-4" /> 新增员工
            </Button>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" /> 导入员工
            </Button>
            <Button variant="outline" onClick={exportUsers}>
              <Download className="h-4 w-4" />
              {selected.size > 0 ? `导出所选 (${selected.size})` : "导出员工"}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      allPageChecked
                        ? true
                        : somePageChecked
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={(v) => togglePageAll(!!v)}
                    aria-label="全选当前页"
                  />
                </TableHead>
                <TableHead>昵称 / 姓名</TableHead>
                <TableHead className="whitespace-nowrap">手机号码</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>性别</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="whitespace-nowrap">创建时间</TableHead>
                <TableHead className="text-right whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.length === 0 ? (
                <TableRow>
                   <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    暂无匹配的员工
                  </TableCell>
                </TableRow>
              ) : (
                pageData.map((u) => (
                  <TableRow key={u.id} className="hover:bg-accent/30">
                    <TableCell className="w-10">
                      <Checkbox
                        checked={selected.has(u.id)}
                        onCheckedChange={(v) => toggleOne(u.id, !!v)}
                        aria-label={`选择 ${u.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{u.phone}</TableCell>
                    <TableCell className="text-sm">
                      {u.email ? (
                        <span className="text-foreground">{u.email}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">未填写</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">{u.gender}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadge(u.status)}>
                        {u.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {u.createdAt}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost" onClick={() => setViewTarget(u)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>查看员工详情</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditing(u);
                                  setFormOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>编辑员工</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className={
                                  u.status === "正常"
                                    ? "text-muted-foreground hover:text-foreground"
                                    : "text-emerald-600 hover:text-emerald-700"
                                }
                                onClick={() => setToggleTarget(u)}
                              >
                                {u.status === "正常" ? (
                                  <UserX className="h-4 w-4" />
                                ) : (
                                  <UserCheck className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {u.status === "正常" ? "停用员工" : "启用员工"}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-primary hover:text-primary"
                                onClick={() => setResetTarget(u)}
                              >
                                <KeyRound className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>重置密码</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <ListPagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
        />
      </Card>

      {/* Toggle status confirm */}
      <AlertDialog open={!!toggleTarget} onOpenChange={(o) => !o && setToggleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              确认{toggleTarget?.status === "正常" ? "停用" : "启用"}该员工？
            </AlertDialogTitle>
            <AlertDialogDescription>
              即将{toggleTarget?.status === "正常" ? "停用" : "启用"}{" "}
              <span className="font-medium text-foreground">{toggleTarget?.name}</span>
              （{toggleTarget?.id}）。
              {toggleTarget?.status === "正常"
                ? "停用后该员工将无法登录系统。"
                : "启用后该员工可恢复登录。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toggleTarget) {
                  const next = toggleTarget.status === "正常" ? "停用" : "正常";
                  setData((d) =>
                    d.map((x) => (x.id === toggleTarget.id ? { ...x, status: next } : x)),
                  );
                  toast.success(
                    `已${toggleTarget.status === "正常" ? "停用" : "启用"} ${toggleTarget.name}`,
                  );
                }
                setToggleTarget(null);
              }}
            >
              确认{toggleTarget?.status === "正常" ? "停用" : "启用"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset password confirm */}
      <AlertDialog open={!!resetTarget} onOpenChange={(o) => !o && setResetTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>重置用户密码？</AlertDialogTitle>
            <AlertDialogDescription>
              将把用户 <span className="font-medium text-foreground">{resetTarget?.name}</span> 的密码重置为系统初始密码{" "}
              <code className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono text-xs">Boo@123456</code>
              ，请通知用户首次登录后修改。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (resetTarget) {
                  toast.success(`已将 ${resetTarget.name} 的密码重置为 Boo@123456`);
                }
                setResetTarget(null);
              }}
            >
              确认重置
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        onSubmit={(u) => {
          if (editing) {
            setData((d) => d.map((x) => (x.id === editing.id ? { ...u, id: editing.id } : x)));
            toast.success(`已更新 ${u.name}`);
          } else {
            const id = `U${String(200001 + data.length + 1).padStart(6, "0")}`;
            const createdAt = new Date().toISOString().slice(0, 10);
            setData((d) => [{ ...u, id, createdAt }, ...d]);
            toast.success(`已新增 ${u.name}`);
          }
          setFormOpen(false);
        }}
      />

      <UserDetailDialog
        user={viewTarget}
        onOpenChange={(o) => !o && setViewTarget(null)}
      />

      <ImportUsersDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

/* ---------------- Form Dialog ---------------- */

interface UserFormProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: AppUser | null;
  onSubmit: (u: AppUser) => void;
}

function UserFormDialog({ open, onOpenChange, editing, onSubmit }: UserFormProps) {
  const empty: AppUser = {
    id: "",
    name: "",
    phone: "",
    email: "",
    gender: "未知",
    status: "正常",
    remark: "",
    createdAt: "",
  };
  const [form, setForm] = useState<AppUser>(empty);

  useEffect(() => {
    if (open) setForm(editing ?? empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const set = <K extends keyof AppUser>(k: K, v: AppUser[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const isEdit = !!editing;

  const submit = () => {
    if (!form.name.trim()) {
      toast.error("请输入员工昵称/姓名");
      return;
    }
    if (!/^\d{6,20}$/.test(form.phone.replace(/-/g, ""))) {
      toast.error("请输入合法的手机号码");
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error("邮箱格式不正确");
      return;
    }
    if (form.remark.length > 200) {
      toast.error("备注最长 200 字符");
      return;
    }
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "编辑员工" : "新增员工"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? `修改 ${editing?.name} 的账户信息`
              : `为 ${CURRENT_TENANT.name} 创建新的员工账户`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5">
            <Label>
              昵称 / 姓名 <span className="text-destructive">*</span>
            </Label>
            <Input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="如：张伟"
              maxLength={32}
            />
          </div>

          <div className="space-y-1.5">
            <Label>
              手机号码 <span className="text-destructive">*</span>
            </Label>
            <Input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value.replace(/[^\d-]/g, ""))}
              placeholder="如：13800001234"
              inputMode="tel"
              maxLength={20}
            />
          </div>

          <div className="space-y-1.5">
            <Label>邮箱 <span className="text-xs text-muted-foreground">（选填）</span></Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="如：staff@example.com"
              maxLength={64}
            />
          </div>

          <div className="space-y-1.5">
            <Label>性别 <span className="text-xs text-muted-foreground">（选填）</span></Label>
            <Select value={form.gender} onValueChange={(v) => set("gender", v as Gender)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GENDERS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>所属企业</Label>
            <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-muted/40 px-3">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-foreground">{CURRENT_TENANT.name}</span>
              <span className="text-xs text-muted-foreground font-mono">
                {CURRENT_TENANT.id}
              </span>
              <Badge variant="secondary" className="ml-auto font-normal">默认</Badge>
            </div>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <Label>状态</Label>
            <div className="flex h-9 items-center gap-3 rounded-md border border-input bg-background px-3">
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-2">
                      <Switch
                        checked={form.status === "正常"}
                        onCheckedChange={(v) => set("status", v ? "正常" : "停用")}
                      />
                      <span
                        className={
                          "text-sm " +
                          (form.status === "正常"
                            ? "text-foreground font-medium"
                            : "text-muted-foreground")
                        }
                      >
                        {form.status}
                      </span>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {form.status === "正常" ? "点击停用账户" : "点击启用账户"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <div className="flex items-center justify-between">
              <Label>备注</Label>
              <span className="text-xs text-muted-foreground tabular-nums">
                {form.remark.length} / 200
              </span>
            </div>
            <Textarea
              value={form.remark}
              onChange={(e) => set("remark", e.target.value.slice(0, 200))}
              placeholder="可填写岗位、负责范围、备注信息等，最长 200 字符"
              rows={3}
              maxLength={200}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={submit}>{isEdit ? "保存修改" : "创建员工"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Detail Dialog ---------------- */

function UserDetailDialog({
  user,
  onOpenChange,
}: {
  user: AppUser | null;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            员工详情
          </DialogTitle>
          <DialogDescription>
            {user && (
              <>
                员工：<span className="text-foreground font-medium">{user.name}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {user && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 py-2 text-sm">
            <DetailRow k="昵称/姓名" v={user.name} />
            <DetailRow k="手机号码" v={<span className="font-mono">{user.phone}</span>} />
            <DetailRow k="邮箱" v={user.email || <span className="text-muted-foreground">未填写</span>} />
            <DetailRow k="性别" v={user.gender} />
            <DetailRow
              k="角色"
              v={
                <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200">
                  员工
                </Badge>
              }
            />
            <DetailRow
              k="状态"
              v={
                <Badge variant="outline" className={statusBadge(user.status)}>
                  {user.status}
                </Badge>
              }
            />
            <DetailRow k="创建时间" v={<span className="tabular-nums">{user.createdAt}</span>} />
            <DetailRow
              k="所属企业"
              v={
                <span>
                  {CURRENT_TENANT.name}
                  <span className="ml-2 text-xs text-muted-foreground font-mono">
                    {CURRENT_TENANT.id}
                  </span>
                </span>
              }
            />
            <div className="col-span-2">
              <div className="text-xs text-muted-foreground mb-1">备注</div>
              <div className="rounded-md border bg-muted/30 p-3 text-sm min-h-[64px]">
                {user.remark || <span className="text-muted-foreground">无</span>}
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-0.5">{k}</div>
      <div className="text-sm text-foreground">{v}</div>
    </div>
  );
}

/* ---------------- Stat Card ---------------- */

type Tone = "primary" | "emerald" | "cyan" | "rose";
const toneMap: Record<Tone, { bg: string; icon: string; ring: string }> = {
  primary: {
    bg: "from-primary/15 to-primary/0",
    icon: "bg-primary/15 text-primary",
    ring: "ring-primary/10",
  },
  emerald: {
    bg: "from-emerald-200/40 to-emerald-100/0",
    icon: "bg-emerald-100 text-emerald-700",
    ring: "ring-emerald-200/40",
  },
  cyan: {
    bg: "from-cyan-200/40 to-cyan-100/0",
    icon: "bg-cyan-100 text-cyan-700",
    ring: "ring-cyan-200/40",
  },
  rose: {
    bg: "from-rose-200/40 to-rose-100/0",
    icon: "bg-rose-100 text-rose-700",
    ring: "ring-rose-200/40",
  },
};

function StatCard({
  icon,
  label,
  mainValue,
  tone,
  subs,
}: {
  icon: React.ReactNode;
  label: string;
  mainValue: string | number;
  tone: Tone;
  subs?: { k: string; v: number }[];
}) {
  const t = toneMap[tone];
  return (
    <Card className={`relative overflow-hidden p-5 ring-1 ${t.ring}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${t.bg} pointer-events-none`} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-2 text-2xl font-bold tabular-nums">{mainValue}</div>
          {subs && (
            <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
              {subs.map((s) => (
                <span key={s.k} className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-foreground/30" />
                  {s.k} <span className="font-semibold text-foreground">{s.v}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${t.icon}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

const USER_TEMPLATE_COLUMNS: { key: string; label: string; required: boolean; example: string; note: string; options?: string[] }[] = [
  { key: "name", label: "昵称 / 姓名", required: true, example: "张伟", note: "员工昵称或真实姓名，最长 32 字符" },
  { key: "phone", label: "手机号码", required: true, example: "13800001234", note: "6-20 位数字，可含 -，须唯一" },
  { key: "email", label: "邮箱", required: false, example: "zhangwei@example.com", note: "标准邮箱格式，最长 64 字符" },
  { key: "gender", label: "性别", required: false, example: "男", note: "下拉选择，默认 未知", options: ["男", "女", "未知"] },
  { key: "status", label: "状态", required: false, example: "正常", note: "下拉选择，默认 正常", options: ["正常", "停用"] },
  { key: "remark", label: "备注", required: false, example: "数据中台业务负责人", note: "最长 200 字符" },
];

async function downloadUserTemplate() {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("员工导入");
  ws.columns = USER_TEMPLATE_COLUMNS.map((c) => ({
    header: c.required ? `${c.label}*` : c.label,
    key: c.key,
    width: Math.max(14, c.label.length * 3),
  }));
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEFF3FA" },
  };
  USER_TEMPLATE_COLUMNS.forEach((c, i) => {
    if (c.required) {
      ws.getRow(1).getCell(i + 1).font = { bold: true, color: { argb: "FFDC2626" } };
    }
  });
  ws.addRow(USER_TEMPLATE_COLUMNS.map((c) => c.example));
  ws.addRow(["李娜", "13900002345", "lina@example.com", "女", "正常", "风控业务联系人"]);

  const opts = wb.addWorksheet("_options");
  opts.state = "hidden";
  USER_TEMPLATE_COLUMNS.forEach((c, i) => {
    if (!c.options) return;
    const colLetter = opts.getColumn(i + 1).letter;
    c.options.forEach((v, idx) => {
      opts.getCell(`${colLetter}${idx + 1}`).value = v;
    });
    const colLetterMain = ws.getColumn(i + 1).letter;
    const range = `_options!$${colLetter}$1:$${colLetter}$${c.options.length}`;
    for (let r = 2; r <= 1000; r++) {
      ws.getCell(`${colLetterMain}${r}`).dataValidation = {
        type: "list",
        allowBlank: !c.required,
        formulae: [`=${range}`],
        showErrorMessage: true,
        errorStyle: "error",
        errorTitle: "无效值",
        error: `请从下拉列表选择有效项`,
      };
    }
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "员工导入模板.xlsx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success("模板已下载：员工导入模板.xlsx");
}

function ImportUsersDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [fileName, setFileName] = useState<string>("");

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
  };

  const onImport = () => {
    if (!fileName) {
      toast.error("请先选择要导入的文件");
      return;
    }
    toast.success(`已解析 ${fileName}，导入任务已提交`);
    setFileName("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" /> 批量导入员工
          </DialogTitle>
          <DialogDescription>
            请先下载模板，按列填写后上传 CSV / Excel 文件。带 <span className="text-destructive font-medium">*</span> 的字段为必填项。导入的员工将默认归属于
            <span className="text-foreground font-medium"> {CURRENT_TENANT.name}</span>。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-medium">员工导入模板.xlsx</div>
                <div className="text-xs text-muted-foreground">
                  含全部字段列标题、示例数据与下拉选项校验，支持 Excel / WPS 直接打开
                </div>
              </div>
            </div>
            <Button variant="outline" onClick={downloadUserTemplate}>
              <FileDown className="h-4 w-4" /> 下载模板
            </Button>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              字段说明
            </div>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">列标题</TableHead>
                    <TableHead className="w-20">必填</TableHead>
                    <TableHead>说明</TableHead>
                    <TableHead className="w-48">示例</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {USER_TEMPLATE_COLUMNS.map((c) => (
                    <TableRow key={c.key}>
                      <TableCell className="font-medium">
                        {c.label}
                        {c.required && <span className="text-destructive ml-0.5">*</span>}
                      </TableCell>
                      <TableCell>
                        {c.required ? (
                          <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-0">必填</Badge>
                        ) : (
                          <Badge variant="secondary">选填</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{c.note}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{c.example}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
              <span>
                请确保列标题与模板完全一致；导入员工将自动归属当前企业，无需在模板中填写企业信息。
              </span>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              上传文件
            </div>
            <label className="block cursor-pointer rounded-lg border border-dashed bg-muted/20 hover:bg-muted/40 transition-colors p-6 text-center">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={onPick}
              />
              <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
              <div className="mt-2 text-sm">
                {fileName ? (
                  <span className="font-medium text-foreground">{fileName}</span>
                ) : (
                  <>
                    点击选择文件，或将 <span className="font-medium text-foreground">.csv / .xlsx</span> 文件拖放到此处
                  </>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">单次最多 1000 条，单文件不超过 5MB</div>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={onImport}>
            <Upload className="h-4 w-4" /> 开始导入
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}