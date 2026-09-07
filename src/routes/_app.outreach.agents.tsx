import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronRight, Plus, Headset, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { LanguageMultiSelect } from "@/components/LanguageMultiSelect";
import {
  SCRIPT_LANGUAGES,
  TRANSFER_STRATEGIES,
  deleteAgent,
  saveAgent,
  toggleAgent,
  useAgents,
  type Agent,
  type TransferStrategy,
} from "@/lib/voice-scripts";

export const Route = createFileRoute("/_app/outreach/agents")({
  head: () => ({
    meta: [
      { title: "人工坐席 · 出海大数据平台" },
      { name: "description", content: "配置 AI 智能外呼「转人工」使用的真实坐席联系方式、坐席组、服务时段与转接策略。" },
      { property: "og:title", content: "人工坐席 · 出海大数据平台" },
      { property: "og:description", content: "配置真实坐席联系方式与转接策略。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgentsPage,
});

const TIMEZONES = ["Asia/Shanghai", "Asia/Singapore", "Europe/London", "America/New_York", "Asia/Dubai"];

const EMPTY: Omit<Agent, "id"> = {
  name: "",
  group: "外贸一组",
  phone: "",
  timezone: "Asia/Shanghai",
  workStart: "09:00",
  workEnd: "18:00",
  languages: ["zh"],
  maxConcurrency: 1,
  priority: 1,
  enabled: true,
};

function AgentsPage() {
  const agents = useAgents();
  const [strategy, setStrategy] = useState<TransferStrategy>("sequential");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [form, setForm] = useState<Omit<Agent, "id">>(EMPTY);

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (a: Agent) => { setEditing(a); setForm({ ...a }); setOpen(true); };

  const valid = form.name.trim().length > 0 && /^\+?[\d\-()]{6,20}$/.test(form.phone.trim()) && form.group.trim().length > 0;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>出海大数据平台</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>企业设置</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">人工坐席</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Headset className="h-6 w-6 text-primary" />
            人工坐席
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI 智能外呼话术中的「转人工」步骤会按此处配置转接真实坐席。未配置启用坐席时，话术无法发布。
          </p>
        </div>
        <Button className="gap-1.5" onClick={openNew}>
          <Plus className="h-4 w-4" />
          添加坐席
        </Button>
      </div>

      <Card className="p-5 space-y-3">
        <div className="text-sm font-medium">转接策略</div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={strategy} onValueChange={(v) => { setStrategy(v as TransferStrategy); toast.success("转接策略已更新"); }}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRANSFER_STRATEGIES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            转接失败或非坐席工作时间：播放兜底话术 → 记录留言 → 打「需人工跟进」标签 → 结束通话。
          </p>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>坐席</TableHead>
              <TableHead>坐席组</TableHead>
              <TableHead>转接号码</TableHead>
              <TableHead>服务时段</TableHead>
              <TableHead>语言</TableHead>
              <TableHead className="text-right">并发上限</TableHead>
              <TableHead className="text-right">优先级</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-10">
                  暂无坐席，点击「添加坐席」配置转人工联系方式
                </TableCell>
              </TableRow>
            )}
            {agents.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell><Badge variant="secondary">{a.group}</Badge></TableCell>
                <TableCell className="font-mono text-sm">{a.phone}</TableCell>
                <TableCell className="text-sm">
                  {a.workStart} ~ {a.workEnd}
                  <span className="block text-xs text-muted-foreground">{a.timezone}</span>
                </TableCell>
                <TableCell className="text-sm">
                  {a.languages.map((l) => SCRIPT_LANGUAGES.find((x) => x.key === l)?.label ?? l).join("、")}
                </TableCell>
                <TableCell className="text-right tabular-nums">{a.maxConcurrency}</TableCell>
                <TableCell className="text-right tabular-nums">{a.priority}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch checked={a.enabled} onCheckedChange={() => toggleAgent(a.id)} />
                    <span className="text-sm text-muted-foreground">{a.enabled ? "启用" : "停用"}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                      onClick={() => { deleteAgent(a.id); toast.success("已删除坐席"); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "编辑坐席" : "添加坐席"}</DialogTitle>
            <DialogDescription>转接号码支持手机号、固话或分机，请使用 E.164 国际格式。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>坐席姓名 <span className="text-destructive">*</span></Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>坐席组 <span className="text-destructive">*</span></Label>
                <Input value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })} placeholder="如：外贸一组" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>转接号码 <span className="text-destructive">*</span></Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+8613800138000" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>时区</Label>
                <Select value={form.timezone} onValueChange={(v) => setForm({ ...form, timezone: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>服务开始</Label>
                <Input type="time" value={form.workStart} onChange={(e) => setForm({ ...form, workStart: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>服务结束</Label>
                <Input type="time" value={form.workEnd} onChange={(e) => setForm({ ...form, workEnd: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>可服务语言</Label>
              <LanguageMultiSelect
                value={form.languages}
                onChange={(v: string[]) => setForm({ ...form, languages: v })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>并发上限（同时接听通话数）</Label>
                <Input type="number" min={1} max={5} value={form.maxConcurrency}
                  onChange={(e) => setForm({ ...form, maxConcurrency: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>优先级（数字越小越优先）</Label>
                <Input type="number" min={1} max={9} value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
              启用该坐席
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            <Button
              disabled={!valid}
              onClick={() => {
                saveAgent(editing ? { ...form, id: editing.id } : form);
                setOpen(false);
                toast.success(editing ? "坐席已更新" : "坐席已添加");
              }}
            >
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
