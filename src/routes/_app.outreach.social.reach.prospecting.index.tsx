import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, Plus, Play, Pause, Search, Facebook, Music2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addProspectingTask,
  useProspectingTasks,
  type ProspectingTask,
  type SocialTaskPlatform,
} from "@/lib/social-tasks";
import { useSocialAccounts, friendRemaining } from "@/data/social-accounts";
import { useCreditBalance, spendCredits } from "@/lib/credits-balance";
import { COST_SOCIAL_ADD_FRIEND } from "@/lib/credits-ledger";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/outreach/social/reach/prospecting/")({
  head: () => ({
    meta: [
      { title: "社媒搜索加友 · 出海大数据平台" },
      { name: "description", content: "根据关键词搜索 Facebook / TikTok 目标并自动发出加友请求。" },
      { property: "og:title", content: "社媒搜索加友" },
      { property: "og:description", content: "每账号每日 5 个，命中即扣积分。" },
    ],
  }),
  component: ProspectingPage,
});

function ProspectingPage() {
  const tasks = useProspectingTasks();
  const accounts = useSocialAccounts();
  const balance = useCreditBalance();
  const [open, setOpen] = useState(false);

  const fbRemain = friendRemaining(accounts, "Facebook");
  const ttRemain = friendRemaining(accounts, "TikTok");

  return (
    <div className="p-6 space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 px-6 py-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-lg font-semibold">社媒搜索加友</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              系统按关键词自动搜索目标并发出加友请求；每账号每日 5 个，成功发出扣 {COST_SOCIAL_ADD_FRIEND} 积分/次。
            </p>
          </div>
          <div className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Facebook className="h-3.5 w-3.5 text-sky-600" />
              今日加友剩余 <span className="font-semibold text-foreground tabular-nums">{fbRemain}</span>
            </div>
            <div className="flex items-center gap-1">
              <Music2 className="h-3.5 w-3.5 text-rose-600" />
              今日加友剩余 <span className="font-semibold text-foreground tabular-nums">{ttRemain}</span>
            </div>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> 新建任务
            </Button>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="px-5 py-3.5 border-b flex items-center justify-between">
          <div className="text-sm font-semibold">搜索任务</div>
          <div className="text-xs text-muted-foreground">共 {tasks.length} 个</div>
        </div>
        {tasks.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            尚无任务，
            <button className="text-primary hover:underline" onClick={() => setOpen(true)}>
              新建搜索任务
            </button>
            。若还没有社媒账号，请先前往{" "}
            <Link to="/outreach/social/accounts" className="text-primary hover:underline">
              社媒账号购买
            </Link>
            。
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>任务名</TableHead>
                <TableHead className="w-[120px]">平台</TableHead>
                <TableHead>关键词</TableHead>
                <TableHead className="w-[110px]">状态</TableHead>
                <TableHead className="w-[160px]">进度</TableHead>
                <TableHead className="w-[130px]">积分（已用/冻结）</TableHead>
                <TableHead className="w-[140px]">创建时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <CreateProspectingDialog
        open={open}
        onOpenChange={setOpen}
        balance={balance.balance}
        onCreate={(payload) => {
          const freeze = payload.targetCap * COST_SOCIAL_ADD_FRIEND;
          if (balance.balance < freeze) {
            toast.error("积分不足以冻结本次任务预算");
            return;
          }
          spendCredits(freeze);
          addProspectingTask({ ...payload, frozenCredits: freeze });
          toast.success(`任务已创建，冻结积分 ${freeze.toLocaleString()}`, {
            description: "系统将按每账号 5 个 / 天的额度自动执行加友。",
          });
          setOpen(false);
        }}
      />
    </div>
  );
}

function TaskRow({ task }: { task: ProspectingTask }) {
  const total = task.targets.length;
  const requested = task.targets.filter((t) => t.status !== "pending").length;
  const accepted = task.targets.filter((t) => t.status === "accepted").length;
  const statusTone: Record<ProspectingTask["status"], string> = {
    queued: "bg-slate-100 text-slate-700 border-slate-200",
    running: "bg-emerald-50 text-emerald-700 border-emerald-200",
    completed: "bg-sky-50 text-sky-700 border-sky-200",
    paused: "bg-amber-50 text-amber-700 border-amber-200",
  };
  const statusLabel: Record<ProspectingTask["status"], string> = {
    queued: "排队中",
    running: "执行中",
    completed: "已完成",
    paused: "已暂停",
  };
  return (
    <TableRow>
      <TableCell className="font-medium">
        <Link
          to="/outreach/social/reach/prospecting/$taskId"
          params={{ taskId: task.id }}
          className="text-primary hover:underline"
        >
          {task.name}
        </Link>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          {task.platform.includes("Facebook") && <Facebook className="h-3.5 w-3.5 text-sky-600" />}
          {task.platform.includes("TikTok") && <Music2 className="h-3.5 w-3.5 text-rose-600" />}
          <span className="text-xs">{task.platform.join(" / ")}</span>
        </div>
      </TableCell>
      <TableCell className="text-xs">
        <div className="flex flex-wrap gap-1">
          {task.keywords.map((k) => (
            <span key={k} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted text-[11px]">
              <Search className="h-2.5 w-2.5" />
              {k}
            </span>
          ))}
        </div>
      </TableCell>
      <TableCell>
        <span className={cn("inline-flex px-2 py-0.5 rounded-md border text-xs", statusTone[task.status])}>
          {statusLabel[task.status]}
        </span>
      </TableCell>
      <TableCell className="text-xs tabular-nums text-muted-foreground">
        {total > 0 ? (
          <div className="flex items-center gap-1.5">
            <Link
              to="/outreach/social/reach/prospecting/$taskId"
              params={{ taskId: task.id }}
              search={{ status: "requested" as const }}
              className="px-1.5 py-0.5 rounded border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
            >
              已请求 {requested}
            </Link>
            <Link
              to="/outreach/social/reach/prospecting/$taskId"
              params={{ taskId: task.id }}
              search={{ status: "accepted" as const }}
              className="px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            >
              已通过 {accepted}
            </Link>
            <span className="text-muted-foreground">/ 上限 {task.targetCap}</span>
          </div>
        ) : (
          `上限 ${task.targetCap}`
        )}
      </TableCell>
      <TableCell className="text-xs tabular-nums text-muted-foreground">
        {task.usedCredits.toLocaleString()} / {task.frozenCredits.toLocaleString()}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {new Date(task.createdAt).toLocaleString()}
      </TableCell>
    </TableRow>
  );
}

function CreateProspectingDialog({
  open,
  onOpenChange,
  balance,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  balance: number;
  onCreate: (t: {
    name: string;
    platform: SocialTaskPlatform[];
    targetKinds: ("enterprise" | "user" | "post" | "comment" | "group")[];
    keywords: string[];
    region?: string;
    targetCap: number;
    accountIds: string[];
    greetOnAccept?: string;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<SocialTaskPlatform>("Facebook");
  const [keywords, setKeywords] = useState("");
  const [region, setRegion] = useState("");
  const [cap, setCap] = useState(30);
  const [greet, setGreet] = useState("");
  const accounts = useSocialAccounts();
  const platformAccounts = useMemo(
    () => accounts.filter((a) => a.platform === platform),
    [accounts, platform],
  );
  const usable = useMemo(
    () => platformAccounts.filter((a) => a.status === "正常"),
    [platformAccounts],
  );
  const warming = platformAccounts.filter((a) => a.status === "养号中").length;
  const pending = platformAccounts.filter((a) => a.status === "备货中").length;
  const abnormal = platformAccounts.filter(
    (a) => a.status === "风控" || a.status === "被封",
  ).length;
  const freeze = cap * COST_SOCIAL_ADD_FRIEND;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>新建搜索加友任务</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="任务名">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：北美 · Steel Importer" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="平台">
              <Select value={platform} onValueChange={(v) => setPlatform(v as SocialTaskPlatform)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Facebook">Facebook</SelectItem>
                  <SelectItem value="TikTok">TikTok</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="地区 / 语言（可选）">
              <Input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="例如：US / CA" />
            </Field>
          </div>
          <Field label="关键词（英文逗号分隔）">
            <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="steel importer, structural steel" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="目标数量上限">
              <Input
                type="number"
                min={1}
                max={500}
                value={cap}
                onChange={(e) => setCap(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
              />
            </Field>
            <Field
              label={`可用账号：${usable.length}${
                warming || pending || abnormal
                  ? ` （养号中 ${warming} · 备货中 ${pending} · 异常 ${abnormal}）`
                  : ""
              }`}
            >
              <div className="text-xs text-muted-foreground pt-2">
                单账号 5 个/天 · 池上限 {usable.length * 5}/天
                {(warming > 0 || pending > 0 || abnormal > 0) && (
                  <div className="mt-1 text-[11px] text-amber-600">
                    养号中 / 备货中 / 异常账号不参与派发，可到「社媒账号」页查看。
                  </div>
                )}
              </div>
            </Field>
          </div>
          <Field label="通过后自动打招呼（可选）">
            <Textarea
              value={greet}
              onChange={(e) => setGreet(e.target.value)}
              rows={2}
              placeholder="Hi {联系人名}, 我们是 {我的公司} …"
            />
          </Field>
          <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs flex items-center justify-between">
            <span>预冻结积分（可退回未使用部分）</span>
            <span className="font-semibold tabular-nums text-rose-600">
              -{freeze.toLocaleString()}
            </span>
          </div>
          {balance < freeze && (
            <div className="text-xs text-rose-600">
              当前余额 {balance.toLocaleString()}，尚缺 {(freeze - balance).toLocaleString()} 积分。
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button
            onClick={() => {
              if (!name.trim()) return toast.error("请填写任务名");
              const kws = keywords.split(",").map((s) => s.trim()).filter(Boolean);
              if (kws.length === 0) return toast.error("至少填写 1 个关键词");
              if (usable.length === 0) return toast.error("暂无可用账号，请先购买");
              onCreate({
                name: name.trim(),
                platform: [platform],
                targetKinds: ["enterprise", "user"],
                keywords: kws,
                region: region.trim() || undefined,
                targetCap: cap,
                accountIds: usable.map((a) => a.id),
                greetOnAccept: greet.trim() || undefined,
              });
            }}
          >
            创建任务
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
