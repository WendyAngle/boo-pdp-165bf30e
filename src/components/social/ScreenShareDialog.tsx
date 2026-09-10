import { useEffect, useMemo, useState } from "react";
import {
  MonitorPlay,
  RefreshCw,
  MousePointer2,
  X,
  Copy,
  Save,
  Monitor,
  Facebook,
  Music2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  REGION_OPTIONS,
  regionLabel,
  updateAccountProfile,
  type SocialAccount,
} from "@/data/social-accounts";
import { cn } from "@/lib/utils";

const LANGUAGE_OPTIONS = [
  "English (US)",
  "English (UK)",
  "日本語",
  "한국어",
  "Deutsch",
  "Français",
  "Español",
  "Português",
  "ไทย",
  "Tiếng Việt",
];

const BIO_MAX = 150;

/** 根据账号生成稳定的伪随机节点 / IP（演示用） */
function nodeInfoOf(account: SocialAccount) {
  let h = 0;
  for (const c of account.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const seg = (mod: number, min = 1) => (h % mod) + min;
  return {
    node: `172.31.${seg(200)}.${seg(200)}`,
    ip: `69.12.${seg(200)}.${seg(200)}`,
    deviceId: String(2000000000000000000 + (h % 90000000000000000)),
    quality: h % 2 === 0 ? "流畅" : "高清",
  };
}

export function ScreenShareDialog({
  account,
  onClose,
}: {
  account: SocialAccount;
  onClose: () => void;
}) {
  const node = useMemo(() => nodeInfoOf(account), [account]);
  const [connected, setConnected] = useState(true);
  const [control, setControl] = useState(false);

  // 资料回填表单
  const [nickname, setNickname] = useState(account.handle.replace(/^@/, ""));
  const [displayName, setDisplayName] = useState(account.displayName);
  const [language, setLanguage] = useState(LANGUAGE_OPTIONS[0]);
  const [region, setRegion] = useState(account.ownerRegion ?? "US");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  // 切换账号时重置表单
  useEffect(() => {
    setNickname(account.handle.replace(/^@/, ""));
    setDisplayName(account.displayName);
    setRegion(account.ownerRegion ?? "US");
    setBio("");
    setConnected(true);
    setControl(false);
  }, [account]);

  const save = () => {
    if (!nickname.trim()) {
      toast.error("账号昵称不能为空");
      return;
    }
    if (!displayName.trim()) {
      toast.error("账号显示名不能为空");
      return;
    }
    setSaving(true);
    window.setTimeout(() => {
      updateAccountProfile(account.id, {
        handle: nickname.trim().startsWith("@")
          ? nickname.trim()
          : `@${nickname.trim()}`,
        displayName: displayName.trim(),
        ownerRegion: region,
      });
      setSaving(false);
      toast.success("资料已回填，系统账号数据已同步更新");
    }, 400);
  };

  const platformIcon =
    account.platform === "Facebook" ? (
      <Facebook className="h-3.5 w-3.5 text-sky-600" />
    ) : (
      <Music2 className="h-3.5 w-3.5 text-rose-600" />
    );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-6xl p-0 gap-0 overflow-hidden">
        <DialogDescription className="sr-only">
          账号 {account.handle} 的远程同屏画面与资料回填
        </DialogDescription>
        <div className="flex h-[78vh]">
          {/* 左侧：同屏画面 */}
          <div className="flex-1 flex flex-col min-w-0">
            <DialogHeader className="px-5 pt-4 pb-3 border-b space-y-0">
              <DialogTitle className="text-base flex items-center gap-2">
                <MonitorPlay className="h-4.5 w-4.5 text-primary" />
                账号同屏 - {account.displayName}
              </DialogTitle>
            </DialogHeader>

            {/* 工具栏 */}
            <div className="px-4 py-2 border-b flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  setConnected(false);
                  window.setTimeout(() => setConnected(true), 600);
                }}
              >
                <RefreshCw className="h-3 w-3" />
                重新连接
              </Button>
              <Button
                variant="outline"
                size="sm"
                className={cn("h-7 text-xs gap-1", control && "border-primary text-primary")}
                onClick={() => {
                  setControl((v) => !v);
                  toast.success(control ? "已切换为仅观看" : "已开启手动控制，可操作远端桌面");
                }}
              >
                <MousePointer2 className="h-3 w-3" />
                手动控制
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  navigator.clipboard?.writeText(
                    `node=${node.node} ip=${node.ip} account=${account.handle}`,
                  );
                  toast.success("连接信息已复制");
                }}
              >
                <Copy className="h-3 w-3" />
                复制连接信息
              </Button>
              <div className="ml-auto flex items-center gap-2">
                <Badge variant={control ? "default" : "secondary"} className="text-xs font-normal">
                  {control ? "手动控制中" : "仅观看"}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs font-normal",
                    connected
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-amber-200 bg-amber-50 text-amber-700",
                  )}
                >
                  {connected ? "已连接" : "连接中…"}
                </Badge>
              </div>
            </div>

            {/* 画面区 */}
            <div className="flex-1 m-3 rounded-lg bg-black/95 flex items-center justify-center">
              <div className="text-center space-y-2">
                <Monitor className="h-10 w-10 mx-auto text-muted-foreground/50" />
                <p className="text-sm font-medium text-muted-foreground">
                  {control ? "手动控制" : "仅观看"}
                </p>
                <p className="text-xs text-muted-foreground/60">
                  {control ? "可直接操作远端桌面" : "开启手动控制后可操作远端桌面"}
                </p>
                <p className="text-[11px] text-muted-foreground/40 tabular-nums">
                  {account.ownerRegion ?? "—"} / {regionLabel(account.proxyRegion)} · {node.ip} · {node.quality}
                </p>
              </div>
            </div>

            {/* 连接日志 */}
            <div className="px-5 py-2 border-t flex items-center justify-between text-xs text-muted-foreground">
              <span>连接日志</span>
              <span className="text-[11px]">展开</span>
            </div>
          </div>

          {/* 右侧：资料回填 */}
          <div className="w-[340px] shrink-0 border-l flex flex-col bg-muted/20">
            <div className="px-4 py-3 border-b flex items-center justify-between bg-background">
              <span className="text-sm font-medium">资料回填</span>
              <button
                type="button"
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 py-2.5 border-b text-[11px] leading-relaxed text-muted-foreground">
              在左侧同屏画面中于 {account.platform} 修改资料后，在此录入并一键回填，系统账号数据同步更新。
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">
                  账号昵称（平台用户名）
                </label>
                <Input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">账号显示名</label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">语言</label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGE_OPTIONS.map((l) => (
                        <SelectItem key={l} value={l} className="text-xs">
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium">地区</label>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {REGION_OPTIONS.map((r) => (
                        <SelectItem key={r.code} value={r.code} className="text-xs">
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">
                  个人简介（{account.platform} Bio）
                </label>
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
                  rows={3}
                  className="text-sm resize-none"
                  placeholder="与平台侧简介保持一致"
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>最多 {BIO_MAX} 字符，与平台侧简介保持一致。</span>
                  <span className="tabular-nums">
                    {bio.length}/{BIO_MAX}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button className="flex-1 h-9 gap-1.5" onClick={save} disabled={saving}>
                  <Save className="h-4 w-4" />
                  一键保存回填
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  title="重置为账号当前资料"
                  onClick={() => {
                    setNickname(account.handle.replace(/^@/, ""));
                    setDisplayName(account.displayName);
                    setRegion(account.ownerRegion ?? "US");
                    setBio("");
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="px-4 py-2.5 border-t flex items-center gap-1.5 text-[11px] text-muted-foreground bg-background">
              {platformIcon}
              {account.platform} · {account.handle}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
