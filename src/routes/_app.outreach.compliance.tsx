import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronRight, ShieldCheck, Trash2, Download, Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  METADATA_MONTHS,
  RECORDING_MONTH_OPTIONS,
  TRANSCRIPT_MONTH_OPTIONS,
  updateCompliance,
  useCompliance,
} from "@/lib/voice-scripts";

export const Route = createFileRoute("/_app/outreach/compliance")({
  head: () => ({
    meta: [
      { title: "数据与合规 · 出海大数据平台" },
      { name: "description", content: "设置通话录音与转写文本的留存期限、展示脱敏规则与录音告知语，到期自动删除。" },
      { property: "og:title", content: "数据与合规 · 出海大数据平台" },
      { property: "og:description", content: "通话录音留存期限与脱敏规则配置。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompliancePage,
});

function CompliancePage() {
  const c = useCompliance();

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>出海大数据平台</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>管理后台</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">数据与合规</span>
      </div>


      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          数据与合规
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          适用于 AI 智能外呼产生的通话录音、语音转写文本与通话元数据。默认规则参照行业通用做法（录音 6 个月、转写 12 个月），到期自动删除并写入审计日志。
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <div className="text-sm font-medium">留存期限</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>数据类型</TableHead>
              <TableHead>留存期限</TableHead>
              <TableHead>到期处理</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">通话录音（音频）</TableCell>
              <TableCell>
                <Select
                  value={String(c.recordingMonths)}
                  onValueChange={(v) => { updateCompliance({ recordingMonths: Number(v) }); toast.success("留存期限已更新"); }}
                >
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RECORDING_MONTH_OPTIONS.map((m) => <SelectItem key={m} value={String(m)}>{m} 个月</SelectItem>)}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">自动物理删除，写审计日志</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">语音转写文本</TableCell>
              <TableCell>
                <Select
                  value={String(c.transcriptMonths)}
                  onValueChange={(v) => { updateCompliance({ transcriptMonths: Number(v) }); toast.success("留存期限已更新"); }}
                >
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRANSCRIPT_MONTH_OPTIONS.map((m) => <SelectItem key={m} value={String(m)}>{m} 个月</SelectItem>)}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">自动删除</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-medium">
                通话元数据
                <span className="block text-xs text-muted-foreground">时长、结果、意向标签、摘要</span>
              </TableCell>
              <TableCell><Badge variant="secondary">{METADATA_MONTHS} 个月（固定）</Badge></TableCell>
              <TableCell className="text-sm text-muted-foreground">匿名化保留用于统计</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="text-sm font-medium">脱敏与安全</div>
        <ToggleRow
          label="列表与详情页手机号打码"
          desc="展示为 138****5678；完整号码仅对具备「查看完整联系方式」权限的角色可见，并记录访问审计。"
          checked={c.maskPhone}
          onChange={(v) => updateCompliance({ maskPhone: v })}
        />
        <ToggleRow
          label="邮箱本地部分打码"
          desc="展示为 jo****@example.com。"
          checked={c.maskEmail}
          onChange={(v) => updateCompliance({ maskEmail: v })}
        />
        <ToggleRow
          label="敏感字段自动过滤"
          desc="转写文本中自动遮蔽银行卡号、身份证号、支付验证码；CVV 等支付验证信息一律不落库。"
          checked={c.filterSensitive}
          onChange={(v) => updateCompliance({ filterSensitive: v })}
        />
        <ToggleRow
          label="客户拒绝录音时停止录音"
          desc="客户在通话中明确拒绝录音后自动停止录制，仅保留转写文本，并写入退订名单偏好。"
          checked={c.stopOnRefusal}
          onChange={(v) => updateCompliance({ stopOnRefusal: v })}
        />
        <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground flex items-start gap-2">
          <Lock className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          录音与转写静态加密（AES-256）、传输 TLS；录音下载链接为 15 分钟时效签名地址。平台运营默认无权访问企业录音，仅在工单授权下临时访问且全程审计。
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="text-sm font-medium">录音告知语</div>
        <p className="text-xs text-muted-foreground">
          该提示句默认内置于所有话术的「开场白」步骤，可改写但不可删除（合规硬约束）。
        </p>
        <Textarea
          rows={2}
          value={c.notice}
          onChange={(e) => updateCompliance({ notice: e.target.value })}
        />
        <div>
          <Button size="sm" variant="outline" onClick={() => toast.success("录音告知语已保存")}>保存</Button>
        </div>
      </Card>

      <Card className="p-5 space-y-3">
        <div className="text-sm font-medium">数据删除与导出</div>
        <p className="text-xs text-muted-foreground">
          支持按任务批量删除录音与转写，或按客户号码检索并删除全部关联记录（响应客户的删除权主张）。
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-1.5" onClick={() => toast.success("导出任务已创建，完成后将发送下载链接")}>
            <Download className="h-4 w-4" />
            导出通话记录
          </Button>
          <Button variant="outline" className="gap-1.5 text-destructive" onClick={() => toast.success("已提交删除请求，将在 24 小时内完成并生成审计记录")}>
            <Trash2 className="h-4 w-4" />
            按号码删除录音与转写
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
      <div className="min-w-0">
        <Label className="text-sm">{label}</Label>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
