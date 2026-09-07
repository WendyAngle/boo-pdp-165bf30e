import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Sparkles,
  Lightbulb,
  Search,
  Loader2,
  RefreshCw,
  Briefcase,
  MapPin,
  Building2,
  Mail,
  Phone,
  Share2,
  Hash,
  Package,
  Target,
  Save,
  X as XIcon,
  Plus,
  ChevronRight,
  Wand2,
  TrendingUp,
  Upload,
  ImageIcon,
  ThumbsDown,
  RotateCcw,
  Eye,
  EyeOff,
  Info,
  Undo2,
  HelpCircle,
  Coins,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { FavoriteToggle } from "@/components/FavoriteToggle";
import { MaskedField } from "@/components/MaskedField";
import { ReachButton } from "@/components/ReachButton";
import { WhatsAppReachButton } from "@/components/WhatsAppReachButton";
import { AiQuotaPacksDialog } from "@/components/leads/AiQuotaPacksDialog";
import { toast } from "sonner";
import {
  useLeadProfile,
  saveProfile,
  profileCompleteness,
  type LeadProfile,
  type QualificationItem,
  type QualificationFile,
} from "@/lib/lead-profile";
import {
  generateAiLeads,
  getAiQuotaLeft,
  consumeAiQuota,
  getSearchHistory,
  pushSearchHistory,
  AI_DAILY_FREE,
  AI_OVERAGE_POINTS,
  getPointBalance,
  consumePoints,
  type LeadItem,
  type LeadTier,
  getLeadFeedback,
  markLeadsSeen,
  markLeadLiked,
  markLeadIgnored,
  unmarkLeadIgnored,
  resetLeadFeedback,
  type LeadFeedback,
} from "@/lib/leads";
import { searchLeads } from "@/lib/leads";
import { ENTERPRISES } from "@/data/enterprises";

const ENTERPRISES_LOOKUP = new Map(ENTERPRISES.map((e) => [e.id, e]));

export const Route = createFileRoute("/_app/outreach/leads")({
  head: () => ({
    meta: [
      { title: "线索 | 出海大数据平台" },
      {
        name: "description",
        content:
          "AI 智能推荐与主动搜索两种方式获取潜在客户线索，统一管理触达与转化。",
      },
    ],
  }),
  component: LeadsPage,
});

function LeadsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"ai" | "search">("ai");

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>出海大数据平台</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">线索</span>
      </div>

      <section className="relative overflow-hidden rounded-2xl ring-1 ring-border">
        <div
          className="absolute inset-0"
          style={{ background: "var(--gradient-hero)" }}
        />
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 80% 30%, rgba(255,255,255,0.45) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(255,255,255,0.25) 0%, transparent 45%)",
          }}
        />
        <div className="relative px-8 py-10 flex items-center gap-5 text-white">
          <div className="h-14 w-14 rounded-2xl bg-white/25 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/30">
            <Lightbulb className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-wide">线索</h1>
            <p className="text-white/90 text-sm mt-1">
              AI 智能推荐 + 主动搜索双轨获客，结果免费查看，查看联系方式 / 触达按规则扣减积分
            </p>
          </div>
        </div>
      </section>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="h-11 bg-muted/60 p-1">
          <TabsTrigger value="ai" className="gap-1.5 px-4">
            <Sparkles className="h-4 w-4" /> AI 智能推荐
          </TabsTrigger>
          <TabsTrigger value="search" className="gap-1.5 px-4">
            <Search className="h-4 w-4" /> 主动搜索
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ai" className="mt-5">
          <AiTab onGoProfile={() => navigate({ to: "/outreach/my-profile" })} />
        </TabsContent>
        <TabsContent value="search" className="mt-5">
          <SearchTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================ AI 推荐 ============================ */

type AiView = "new" | "seen" | "ignored";

/* ---------- 企业信息健康度卡片（inline 快速补全） ---------- */

const AI_SCALE_OPTIONS = ["1-50", "51-200", "201-1000", "1000+"];
const AI_REVENUE_OPTIONS = [
  "<500 万",
  "500 万 - 5000 万",
  "5000 万 - 5 亿",
  ">5 亿",
];

type ProfileFieldMeta =
  | {
      key: keyof LeadProfile;
      label: string;
      weight: number;
      type: "array";
      placeholder: string;
      mono?: boolean;
    }
  | {
      key: keyof LeadProfile;
      label: string;
      weight: number;
      type: "enum";
      options: string[];
    }
  | {
      key: keyof LeadProfile;
      label: string;
      weight: number;
      type: "text";
      placeholder: string;
      multiline?: boolean;
    };

const PROFILE_FIELDS: ProfileFieldMeta[] = [
  { key: "mainProducts", label: "主营产品", weight: 14, type: "array", placeholder: "输入产品名后回车" },
  { key: "targetCountries", label: "目标国家 / 地区", weight: 14, type: "array", placeholder: "输入国家或地区后回车" },
  { key: "industries", label: "所属行业", weight: 12, type: "array", placeholder: "输入行业名后回车" },
  { key: "hsCodes", label: "HS 编码", weight: 10, type: "array", placeholder: "输入 HS 编码后回车", mono: true },
  { key: "targetIndustries", label: "目标客户行业", weight: 10, type: "array", placeholder: "输入目标行业后回车" },
  { key: "competitors", label: "核心竞品", weight: 10, type: "array", placeholder: "输入竞品企业名后回车" },
  { key: "scale", label: "企业规模", weight: 6, type: "enum", options: AI_SCALE_OPTIONS },
  { key: "revenue", label: "年营业额", weight: 6, type: "enum", options: AI_REVENUE_OPTIONS },
  { key: "targetScale", label: "目标客户规模", weight: 6, type: "enum", options: AI_SCALE_OPTIONS },
  { key: "advantage", label: "我方优势（相对竞品）", weight: 4, type: "text", placeholder: "简述我方相较竞品的核心优势", multiline: true },
  { key: "website", label: "企业官网", weight: 2, type: "text", placeholder: "https://" },
  { key: "brandStory", label: "品牌故事", weight: 2, type: "text", placeholder: "一句话品牌故事", multiline: true },
];

function isFieldMissing(p: LeadProfile, f: ProfileFieldMeta): boolean {
  const v = p[f.key];
  if (Array.isArray(v)) return v.length === 0;
  return !v;
}

function ProfileHealthCard({
  profile,
  completeness,
  onPatch,
  onOpenFull,
}: {
  profile: LeadProfile;
  completeness: number;
  onPatch: <K extends keyof LeadProfile>(k: K, v: LeadProfile[K]) => void;
  onOpenFull: () => void;
}) {
  const missing = PROFILE_FIELDS.filter((f) => isFieldMissing(profile, f));
  const topMissing = missing.slice(0, 4);
  const potentialGain = missing.reduce((s, f) => s + f.weight, 0);

  return (
    <Card className="p-5 space-y-4">
      {/* 头部摘要 */}
      <div className="flex flex-col md:flex-row gap-4 md:items-center">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/20 shrink-0">
            <Target className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="font-semibold">当前企业信息</div>
              <Badge
                variant="secondary"
                className="text-[10px] bg-primary/10 text-primary"
              >
                完整度 {completeness}%
              </Badge>
              {missing.length === 0 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] bg-emerald-100 text-emerald-700"
                >
                  企业信息已完善
                </Badge>
              )}
            </div>
            <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
              <span>
                行业：
                <span className="text-foreground">
                  {profile.industries.join("、") || "未填写"}
                </span>
              </span>
              <span>
                主营：
                <span className="text-foreground">
                  {profile.mainProducts.join("、") || "未填写"}
                </span>
              </span>
              <span>
                目标市场：
                <span className="text-foreground">
                  {profile.targetCountries.join("、") || "未填写"}
                </span>
              </span>
            </div>
            <Progress value={completeness} className="mt-2 h-1.5" />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenFull}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Wand2 className="h-4 w-4" />
            打开完整表单
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 缺失项 inline 快速补全 */}
      {topMissing.length > 0 && (
        <div className="rounded-lg bg-muted/40 border border-dashed p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>
              还差 <b className="text-foreground tabular-nums">{missing.length}</b> 项可达
              <b className="text-foreground tabular-nums"> {Math.min(100, completeness + potentialGain)}%</b>
              ，就地补全即可提升推荐精准度
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {topMissing.map((f) => (
              <QuickFillRow
                key={f.key as string}
                field={f}
                profile={profile}
                onPatch={onPatch}
              />
            ))}
          </div>
          {missing.length > topMissing.length && (
            <button
              type="button"
              onClick={onOpenFull}
              className="text-xs text-primary hover:underline"
            >
              还有 {missing.length - topMissing.length} 项 →
            </button>
          )}
        </div>
      )}
    </Card>
  );
}

function QuickFillRow({
  field,
  profile,
  onPatch,
}: {
  field: ProfileFieldMeta;
  profile: LeadProfile;
  onPatch: <K extends keyof LeadProfile>(k: K, v: LeadProfile[K]) => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-background rounded-md px-2.5 py-1.5 border">
      <div className="text-xs text-foreground flex-1 min-w-0 truncate">
        {field.label}
      </div>
      <Badge
        variant="secondary"
        className="text-[10px] bg-primary/10 text-primary tabular-nums"
      >
        +{field.weight}%
      </Badge>
      {field.type === "enum" ? (
        <Select
          value={(profile[field.key] as string) || ""}
          onValueChange={(v) => onPatch(field.key, v as LeadProfile[typeof field.key])}
        >
          <SelectTrigger className="h-7 w-[120px] text-xs">
            <SelectValue placeholder="选择" />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((o) => (
              <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === "array" ? (
        <QuickArrayPopover field={field} profile={profile} onPatch={onPatch} />
      ) : (
        <QuickTextPopover field={field} profile={profile} onPatch={onPatch} />
      )}
    </div>
  );
}

function QuickArrayPopover({
  field,
  profile,
  onPatch,
}: {
  field: Extract<ProfileFieldMeta, { type: "array" }>;
  profile: LeadProfile;
  onPatch: <K extends keyof LeadProfile>(k: K, v: LeadProfile[K]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const current = (profile[field.key] as string[]) || [];

  const add = () => {
    const v = input.trim();
    if (!v) return;
    if (current.includes(v)) {
      setInput("");
      return;
    }
    onPatch(field.key, [...current, v] as LeadProfile[typeof field.key]);
    setInput("");
  };

  const remove = (i: number) => {
    const next = current.filter((_, idx) => idx !== i);
    onPatch(field.key, next as LeadProfile[typeof field.key]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs">
          <Plus className="h-3 w-3" /> 添加
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3 space-y-2">
        <div className="text-xs font-medium">{field.label}</div>
        <div className="flex gap-1.5">
          <Input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder={field.placeholder}
            className={field.mono ? "h-8 text-xs font-mono" : "h-8 text-xs"}
          />
          <Button size="sm" className="h-8" onClick={add}>添加</Button>
        </div>
        {current.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {current.map((v, i) => (
              <Badge
                key={`${v}-${i}`}
                variant="secondary"
                className={`gap-1 ${field.mono ? "font-mono" : ""}`}
              >
                {v}
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="hover:text-destructive"
                  aria-label="移除"
                >
                  <XIcon className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        <div className="text-[10px] text-muted-foreground pt-1">
          回车快速添加，Esc 关闭
        </div>
      </PopoverContent>
    </Popover>
  );
}

function QuickTextPopover({
  field,
  profile,
  onPatch,
}: {
  field: Extract<ProfileFieldMeta, { type: "text" }>;
  profile: LeadProfile;
  onPatch: <K extends keyof LeadProfile>(k: K, v: LeadProfile[K]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState((profile[field.key] as string) || "");

  useEffect(() => {
    if (open) setVal((profile[field.key] as string) || "");
  }, [open, profile, field.key]);

  const save = () => {
    onPatch(field.key, val.trim() as LeadProfile[typeof field.key]);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 px-2 gap-1 text-xs">
          <Plus className="h-3 w-3" /> 填写
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3 space-y-2">
        <div className="text-xs font-medium">{field.label}</div>
        {field.multiline ? (
          <Textarea
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className="text-xs"
          />
        ) : (
          <Input
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
            placeholder={field.placeholder}
            className="h-8 text-xs"
          />
        )}
        <div className="flex justify-end gap-1.5 pt-1">
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button size="sm" className="h-7" onClick={save}>保存</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function useLeadFeedbackState(): LeadFeedback {
  const [fb, setFb] = useState<LeadFeedback>(() => getLeadFeedback());
  useEffect(() => {
    const onChange = () => setFb(getLeadFeedback());
    window.addEventListener("lead-feedback-change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("lead-feedback-change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return fb;
}

function AiTab({ onGoProfile }: { onGoProfile: () => void }) {
  const profile = useLeadProfile();
  const completeness = profileCompleteness(profile);
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [quotaLeft, setQuotaLeft] = useState(() => getAiQuotaLeft());
  const [pointBalance, setPointBalance] = useState(() => getPointBalance());
  const [seed, setSeed] = useState(1);
  const [view, setView] = useState<AiView>("new");
  const [filteredOut, setFilteredOut] = useState(0);
  const fb = useLeadFeedbackState();
  const [profileDirty, setProfileDirty] = useState(false);
  const [packsOpen, setPacksOpen] = useState(false);

  // 企业信息被 inline 修改后，提示用户重新生成；leads 已存在才有意义
  const handleProfilePatch = <K extends keyof LeadProfile>(
    key: K,
    value: LeadProfile[K],
  ) => {
    saveProfile({ ...profile, [key]: value });
    if (leads.length > 0) setProfileDirty(true);
  };

  const handleGenerate = () => {
    if (quotaLeft <= 0) {
      if (pointBalance < AI_OVERAGE_POINTS) {
        toast.error("今日免费次数已用完，积分余额不足", {
          description: `本次需 ${AI_OVERAGE_POINTS} 积分，当前余额 ${pointBalance}，请购买扩容包`,
        });
        return;
      }
    }
    setLoading(true);
    setView("new");
    // 把当前展示中的企业先记入"已浏览"，下一轮自动去重
    const prevIds = leads.map((l) => l.enterprise.id);
    if (prevIds.length > 0) markLeadsSeen(prevIds);

    setTimeout(() => {
      const next = generateAiLeads(profile, seed, 9);
      const seenBefore = new Set(getLeadFeedback().seen);
      const skipped = next.filter((l) => seenBefore.has(l.enterprise.id)).length;
      setFilteredOut(prevIds.length === 0 ? 0 : Math.max(0, prevIds.length - skipped));
      // 简化：用上一轮 id 数近似展示"已过滤"数量
      setFilteredOut(prevIds.length);
      setLeads(next);
      setSeed((s) => s + 1);
      let billDesc = "";
      if (quotaLeft > 0) {
        const left = consumeAiQuota();
        setQuotaLeft(left);
      } else {
        const nextBalance = consumePoints(AI_OVERAGE_POINTS);
        setPointBalance(nextBalance);
        billDesc = `本次扣减 ${AI_OVERAGE_POINTS} 积分，剩余 ${nextBalance}`;
      }
      setLoading(false);
      const baseDesc = prevIds.length > 0
        ? `已为您过滤 ${prevIds.length} 家已浏览企业，本批含拓展 / 探索分层`
        : "结果免费查看，查看联系方式 / 触达按规则扣减积分";
      const desc = billDesc ? `${billDesc}｜${baseDesc}` : baseDesc;
      toast.success(`已为您匹配 ${next.length} 条潜在线索`, { description: desc });
    }, 1100);
  };

  const handleIgnore = (l: LeadItem) => {
    markLeadIgnored(l.enterprise.id);
    setLeads((cur) => cur.filter((x) => x.enterprise.id !== l.enterprise.id));
    toast("已标记为不感兴趣", {
      description: `${l.enterprise.name} 将不再推荐，同行业 / 同国家权重已下调`,
      action: {
        label: "撤销",
        onClick: () => {
          unmarkLeadIgnored(l.enterprise.id);
          setLeads((cur) =>
            cur.some((x) => x.enterprise.id === l.enterprise.id)
              ? cur
              : [l, ...cur],
          );
        },
      },
    });
  };

  const handleLike = (l: LeadItem) => {
    markLeadLiked(l.enterprise.id);
  };

  const handleRestore = (id: string) => {
    unmarkLeadIgnored(id);
    toast.success("已恢复推荐", { description: "该企业将参与下一轮匹配" });
  };

  const handleReset = () => {
    resetLeadFeedback();
    setLeads([]);
    setSeed(1);
    setFilteredOut(0);
    setView("new");
    toast.success("推荐偏好已重置");
  };

  // 已查看 / 已忽略 视图所用的企业列表（从 mock 库中查找）
  const seenLeads = useMemo<LeadItem[]>(() => {
    return fb.seen
      .map((id) => {
        const ent = ENTERPRISES_LOOKUP.get(id);
        if (!ent) return null;
        return {
          enterprise: ent,
          source: "ai" as const,
          matchScore: 70,
          matchReasons: ["历史推荐"],
          generatedAt: new Date().toISOString(),
        } as LeadItem;
      })
      .filter(Boolean) as LeadItem[];
  }, [fb.seen]);

  const ignoredLeads = useMemo<LeadItem[]>(() => {
    return fb.ignored
      .map((id) => {
        const ent = ENTERPRISES_LOOKUP.get(id);
        if (!ent) return null;
        return {
          enterprise: ent,
          source: "ai" as const,
          matchScore: 65,
          matchReasons: ["已忽略"],
          generatedAt: new Date().toISOString(),
        } as LeadItem;
      })
      .filter(Boolean) as LeadItem[];
  }, [fb.ignored]);

  const visibleLeads =
    view === "new" ? leads : view === "seen" ? seenLeads : ignoredLeads;

  return (
    <div className="space-y-5">
      {/* 企业信息摘要 + 操作 */}
      <ProfileHealthCard
        profile={profile}
        completeness={completeness}
        onPatch={handleProfilePatch}
        onOpenFull={onGoProfile}
      />

      {/* 演示提示 + 偏好控制 */}
      <Card className="px-4 py-3 flex flex-wrap items-center gap-3 bg-amber-50/60 border-amber-200/70 text-amber-900">
        <Info className="h-4 w-4 shrink-0 text-amber-600" />
        <div className="text-xs leading-relaxed flex-1 min-w-[260px]">
          <span className="font-semibold">演示提示：</span>
          连续点击 <span className="font-mono">「重新生成推荐」</span> 体验"去重 + 分层"——
          已浏览企业不再重复，结果含
          <span className="mx-1 inline-flex items-center gap-1"><TierDot tier="precise" />精准</span>+
          <span className="mx-1 inline-flex items-center gap-1"><TierDot tier="expand" />拓展</span>+
          <span className="mx-1 inline-flex items-center gap-1"><TierDot tier="explore" />探索</span>
          三层。收藏 / 触达 → 偏好加权；点 <ThumbsDown className="h-3 w-3 inline" /> → 永不再推。
        </div>
        <div className="flex items-center gap-3 text-[11px] text-amber-800/80">
          <span>已浏览 <b className="tabular-nums">{fb.seen.length}</b></span>
          <span>已收藏 <b className="tabular-nums">{fb.liked.length}</b></span>
          <span>已忽略 <b className="tabular-nums">{fb.ignored.length}</b></span>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 border-amber-300 text-amber-900 hover:bg-amber-100"
            >
              <RotateCcw className="h-3.5 w-3.5" /> 重置推荐偏好
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认重置推荐偏好？</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <div>此操作将清除以下推荐相关数据：</div>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    <li>已浏览记录（{fb.seen.length}）—— 用于去重</li>
                    <li>收藏偏好（{fb.liked.length}）—— 用于同类加权</li>
                    <li>永不再推标记（{fb.ignored.length}）—— 已忽略企业将重新参与匹配</li>
                  </ul>
                  <div className="text-xs pt-1 text-emerald-700">
                    ✓ 不会影响：企业信息、收藏夹、触达历史与积分明细
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset}>确认重置</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>

      {/* 生成按钮 */}
      <Card className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, hsl(var(--primary)) 0%, transparent 45%), radial-gradient(circle at 70% 70%, hsl(var(--accent)) 0%, transparent 45%)",
          }}
        />
        <div className="relative p-6 flex flex-col md:flex-row items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center shrink-0">
            <Sparkles className="h-8 w-8" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <div className="font-semibold text-lg">基于您的企业信息，匹配全球潜在客户</div>
            <div className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center justify-center md:justify-start gap-x-1 gap-y-1">
              <span>结合主营产品、目标市场、HS 编码及竞品客户网络综合排序 ·</span>
              <span className="text-primary font-medium">
                今日剩余免费推荐 {quotaLeft}/{AI_DAILY_FREE} 次
              </span>
              <HoverCard openDelay={120} closeDelay={80}>
                <HoverCardTrigger asChild>
                  <button
                    type="button"
                    aria-label="查看 AI 推荐计费规则"
                    className="inline-flex items-center justify-center h-4 w-4 rounded-full text-muted-foreground hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <HelpCircle className="h-3.5 w-3.5" />
                  </button>
                </HoverCardTrigger>
                <HoverCardContent align="start" className="w-[300px] p-0 text-left">
                  <div className="px-3.5 py-2.5 border-b">
                    <div className="text-sm font-semibold">AI 推荐计费规则</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      推荐结果免费查看，联系方式 / 触达另按既有规则扣减
                    </div>
                  </div>
                  <div className="px-3.5 py-2.5 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">每日免费配额</span>
                      <span className="font-medium">{AI_DAILY_FREE} 次 / 自然日</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">重置时间</span>
                      <span className="font-medium">次日 00:00 自动恢复</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">超额单价</span>
                      <span className="font-medium text-primary">
                        {AI_OVERAGE_POINTS} 积分 / 次
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">当前积分余额</span>
                      <span className="font-medium">{pointBalance.toLocaleString()} 分</span>
                    </div>
                  </div>
                  <div className="px-3.5 py-2 border-t flex items-center justify-between gap-2">
                    <Link
                      to="/outreach/billing"
                      className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-0.5"
                    >
                      查看积分明细 <ChevronRight className="h-3 w-3" />
                    </Link>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2.5 text-xs gap-1"
                      onClick={() => setPacksOpen(true)}
                    >
                      <Coins className="h-3 w-3" /> 购买扩容包
                    </Button>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
            {profileDirty && (
              <div className="mt-2 inline-flex items-center gap-2 text-xs text-primary bg-primary/8 px-2.5 py-1 rounded-md">
                <Sparkles className="h-3 w-3" />
                企业信息已更新，建议重新生成推荐以获得更精准的匹配
              </div>
            )}
          </div>
          <Button
            size="lg"
            disabled={loading}
            onClick={() => {
              setProfileDirty(false);
              handleGenerate();
            }}
            className="gap-2 h-11 px-6 shrink-0 bg-gradient-to-r from-primary to-accent hover:opacity-90"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                AI 正在匹配…
              </>
            ) : quotaLeft <= 0 ? (
              <>
                <Coins className="h-4 w-4" />
                继续推荐（扣 {AI_OVERAGE_POINTS} 积分）
              </>
            ) : leads.length > 0 ? (
              <>
                <RefreshCw className="h-4 w-4" />
                重新生成推荐
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                生成 AI 推荐线索
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* 视图切换 */}
      {(leads.length > 0 || fb.seen.length > 0 || fb.ignored.length > 0) && !loading && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Tabs value={view} onValueChange={(v) => setView(v as AiView)}>
            <TabsList className="h-9 bg-muted/60 p-1">
              <TabsTrigger value="new" className="gap-1.5 px-3 text-xs">
                <Sparkles className="h-3.5 w-3.5" /> 本轮推荐
                {leads.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                    {leads.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="seen" className="gap-1.5 px-3 text-xs">
                <Eye className="h-3.5 w-3.5" /> 历史已查看
                <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                  {fb.seen.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="ignored" className="gap-1.5 px-3 text-xs">
                <EyeOff className="h-3.5 w-3.5" /> 已忽略
                <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">
                  {fb.ignored.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {view === "new" && filteredOut > 0 && (
            <div className="text-xs text-muted-foreground">
              已为您过滤 <b className="text-foreground">{filteredOut}</b> 家已浏览企业
            </div>
          )}
        </div>
      )}

      {visibleLeads.length === 0 && !loading && view === "new" && (
        <Card className="p-12 text-center border-dashed">
          <div className="h-14 w-14 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
            <Sparkles className="h-7 w-7" />
          </div>
          <div className="font-medium">点击上方按钮开始 AI 推荐</div>
          <div className="text-sm text-muted-foreground mt-1">
            企业信息越完整，匹配越精准
          </div>
        </Card>
      )}

      {visibleLeads.length === 0 && !loading && view !== "new" && (
        <Card className="p-10 text-center border-dashed">
          <div className="text-sm text-muted-foreground">
            {view === "seen" ? "尚无历史浏览记录" : "尚无被忽略的企业"}
          </div>
        </Card>
      )}

      {visibleLeads.length > 0 && (
        <>
        {view === "new" && (fb.liked.length + fb.ignored.length) > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-xs text-emerald-800">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>
              已根据您最近 <b className="tabular-nums">{fb.liked.length}</b> 次收藏
              {fb.ignored.length > 0 && (
                <> 与 <b className="tabular-nums">{fb.ignored.length}</b> 次忽略</>
              )}
              ，同类企业已上调 / 下调排序权重。
            </span>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleLeads.map((l) => (
            <LeadCard
              key={l.enterprise.id}
              lead={l}
              onIgnore={view === "new" ? () => handleIgnore(l) : undefined}
              onLike={view === "new" ? () => handleLike(l) : undefined}
              onRestore={
                view === "ignored" ? () => handleRestore(l.enterprise.id) : undefined
              }
              isIgnoredView={view === "ignored"}
              isSeenView={view === "seen"}
            />
          ))}
        </div>
        </>
      )}
      <AiQuotaPacksDialog
        open={packsOpen}
        onOpenChange={setPacksOpen}
        onPurchased={() => {
          setQuotaLeft(getAiQuotaLeft());
          setPointBalance(getPointBalance());
        }}
      />
    </div>
  );
}

const TIER_META: Record<LeadTier, { label: string; cls: string; dot: string }> = {
  precise: {
    label: "精准匹配",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  expand: {
    label: "相邻拓展",
    cls: "bg-sky-50 text-sky-700 border-sky-200",
    dot: "bg-sky-500",
  },
  explore: {
    label: "探索惊喜",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
};

function TierDot({ tier }: { tier: LeadTier }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${TIER_META[tier].dot}`} />;
}

/* ============================ 线索卡片 ============================ */

function LeadCard({
  lead,
  onIgnore,
  onLike,
  onRestore,
  isIgnoredView,
  isSeenView,
}: {
  lead: LeadItem;
  onIgnore?: () => void;
  onLike?: () => void;
  onRestore?: () => void;
  isIgnoredView?: boolean;
  isSeenView?: boolean;
}) {
  const e = lead.enterprise;
  const firstContact = e.contacts[0];
  const tierMeta = lead.tier ? TIER_META[lead.tier] : null;
  return (
    <Card
      className={`p-5 ring-1 hover:shadow-md transition-all flex flex-col relative ${
        isIgnoredView
          ? "ring-border opacity-70"
          : "ring-border hover:ring-primary/40"
      }`}
    >
      {tierMeta && !isIgnoredView && !isSeenView && (
        <div
          className={`absolute top-0 left-5 -translate-y-1/2 inline-flex items-center gap-1 px-2 h-5 rounded-full text-[10px] font-medium border ${tierMeta.cls}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${tierMeta.dot}`} />
          {tierMeta.label}
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary flex items-center justify-center ring-1 ring-primary/20 shrink-0">
            {lead.source === "ai" ? (
              <Sparkles className="h-5 w-5" />
            ) : (
              <Building2 className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0">
            <Link
              to="/outreach/enterprise/$id"
              params={{ id: e.id }}
              className="font-semibold truncate block hover:text-primary"
            >
              {e.name}
            </Link>
            <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {e.country || "未提供"}
              </span>
              <span>·</span>
              <span>{e.employees}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <span onClick={onLike} className="inline-flex">
            <FavoriteToggle
              kind="enterprise"
              refId={e.id}
              payload={{
                title: e.name,
                subtitle: e.industry || undefined,
                meta: { country: e.country || "", role: e.tradeRole, est: e.est },
              }}
              variant="inline"
              size="sm"
            />
          </span>
          {onIgnore && (
            <button
              onClick={onIgnore}
              title="不感兴趣，不再推荐"
              className="h-7 w-7 rounded-md inline-flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          )}
          {onRestore && (
            <button
              onClick={onRestore}
              title="恢复推荐"
              className="h-7 px-2 rounded-md inline-flex items-center gap-1 text-xs text-primary hover:bg-primary/10 transition-colors"
            >
              <Undo2 className="h-3.5 w-3.5" /> 恢复
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Briefcase className="h-3.5 w-3.5 shrink-0" />
        <span className={`truncate ${!e.industry ? "italic" : ""}`}>
          {e.industry || "未提供行业"}
        </span>
      </div>

      {/* AI 匹配徽章 */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
          <span className="font-semibold text-emerald-700 tabular-nums">
            {lead.matchScore}
          </span>
          <span className="text-muted-foreground">匹配度</span>
        </div>
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-primary"
            style={{ width: `${lead.matchScore}%` }}
          />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {lead.matchReasons.map((r) => (
          <Badge
            key={r}
            variant="secondary"
            className="text-[10px] bg-primary/8 text-primary border border-primary/15"
          >
            {r}
          </Badge>
        ))}
      </div>

      {/* 联系方式（密文 + 触达） */}
      <div className="mt-4 pt-3 border-t space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Mail className="h-3.5 w-3.5" /> 邮箱
          </span>
          <div className="flex items-center gap-1.5 min-w-0">
            <MaskedField
              targetKind="enterprise"
              targetId={e.id}
              targetName={e.name}
              field="email"
              value={e.email}
              mono
            />
            <ReachButton
              targetKind="enterprise"
              targetId={e.id}
              targetName={e.name}
              channel="email"
              detail={e.email}
            />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Phone className="h-3.5 w-3.5" /> 电话
          </span>
          <div className="flex items-center gap-1.5 min-w-0">
            <MaskedField
              targetKind="enterprise"
              targetId={e.id}
              targetName={e.name}
              field="phone"
              value={e.phone}
              mono
            />
            <ReachButton
              targetKind="enterprise"
              targetId={e.id}
              targetName={e.name}
              channel="phone"
              detail={e.phone}
            />
            <WhatsAppReachButton
              targetKind="enterprise"
              targetId={e.id}
              targetName={e.name}
              phone={e.phone}
            />
          </div>
        </div>
        {firstContact && (
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground truncate">
              <Share2 className="h-3.5 w-3.5 shrink-0" />
              关键联系人：{firstContact.name}
            </span>
            <Link
              to="/outreach/enterprise/$id"
              params={{ id: e.id }}
              className="text-primary hover:underline shrink-0"
            >
              查看详情
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ============================ 主动搜索 ============================ */

const HOT = [
  "花岗岩",
  "大理石",
  "石膏板",
  "680100",
  "manufacturing",
  "germany",
];

function SearchTab() {
  const [kw, setKw] = useState("");
  const [scope, setScope] = useState<"product" | "hs">("product");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<LeadItem[]>([]);
  const [activeKws, setActiveKws] = useState<string[]>([]);
  const [historyTick, setHistoryTick] = useState(0);
  const history = useMemo(() => getSearchHistory(), [historyTick, results]);

  const parseKeywords = (raw: string): string[] => {
    // 支持 逗号/分号/顿号（中英文）/ 换行 / 中英文空格
    const parts = raw
      .split(/[,，;；、\s\u3000\n\r]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    // 去重，保持顺序
    return Array.from(new Set(parts));
  };

  const submit = (override?: { kw?: string }) => {
    const raw = override?.kw ?? kw;
    const words = parseKeywords(raw);
    if (words.length === 0) {
      toast.error("请输入搜索关键词");
      return;
    }
    if (scope === "hs") {
      const bad = words.filter((w) => !/^\d{4,}$/.test(w));
      if (bad.length > 0) {
        toast.error(`HS 编码需为 4 位及以上数字：${bad.join(", ")}`);
        return;
      }
    }
    words.forEach((w) => pushSearchHistory(w));
    setHistoryTick((n) => n + 1);
    setActiveKws(words);
    if (override?.kw !== undefined) setKw(raw);
    setLoading(true);
    setTimeout(() => {
      // 多关键词合并：以企业 id 聚合，取最高匹配度，合并理由（去重）
      const merged = new Map<string, LeadItem>();
      for (const w of words) {
        const part = searchLeads(w, "all", 24);
        for (const item of part) {
          const prev = merged.get(item.enterprise.id);
          if (!prev) {
            merged.set(item.enterprise.id, { ...item });
          } else {
            prev.matchScore = Math.max(prev.matchScore, item.matchScore);
            const reasons = Array.from(
              new Set([...prev.matchReasons, ...item.matchReasons]),
            ).slice(0, 4);
            prev.matchReasons = reasons;
          }
        }
      }
      const list = Array.from(merged.values())
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 12);
      setResults(list);
      setLoading(false);
    }, 500);
  };

  const clear = () => {
    setResults([]);
    setActiveKws([]);
    setLoading(false);
  };

  const hasResults = results.length > 0;
  const hasSearched = activeKws.length > 0 && !loading;
  const activeKwJoined = activeKws.join(" / ");

  return (
    <div className="space-y-5">
      <Card className="p-5 space-y-4">
        <div className="flex items-stretch gap-2 rounded-2xl bg-white pl-2 py-2 overflow-hidden ring-1 ring-slate-200 focus-within:ring-primary/60 transition-all">
          <Select value={scope} onValueChange={(v) => setScope(v as "product" | "hs")}>
            <SelectTrigger className="h-11 w-[180px] min-w-[180px] border-0 bg-transparent shadow-none hover:bg-transparent focus:ring-0 focus:ring-offset-0 rounded-none text-sm font-medium text-slate-700 shrink-0 whitespace-nowrap self-start px-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start" className="w-[180px] min-w-[180px]">
              <SelectItem value="product" className="whitespace-nowrap">
                <span className="inline-flex items-center gap-2">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  商品关键词
                </span>
              </SelectItem>
              <SelectItem value="hs" className="whitespace-nowrap">
                <span className="inline-flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  HS 编码
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <div className="h-8 w-px bg-slate-200 shrink-0 self-start mt-1.5" />
          <Search className="h-5 w-5 text-muted-foreground shrink-0 ml-1 mt-2.5 self-start" />
          <Textarea
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={
              scope === "hs"
                ? "输入 HS 编码，支持多个：逗号、分号、顿号、换行或空格分隔（如：680100, 720839）"
                : "输入商品关键词，支持多个：逗号、分号、顿号、换行或空格分隔（如：花岗岩, 大理石；石膏板）"
            }
            className="flex-1 border-0 shadow-none focus-visible:ring-0 text-base px-0 min-h-[44px] resize-y placeholder:text-muted-foreground/70"
            rows={2}
          />
          <button
            onClick={() => submit()}
            className="-my-2 self-stretch rounded-none bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 shrink-0 inline-flex items-center gap-1.5"
          >
            <Search className="h-4 w-4" />
            搜索
          </button>
        </div>
        <div className="text-[11px] text-muted-foreground -mt-2">
          支持多关键词：<span className="font-mono">,</span> <span className="font-mono">，</span>{" "}
          <span className="font-mono">;</span> <span className="font-mono">；</span>{" "}
          <span className="font-mono">、</span> 换行 或 空格 分隔 · Enter 搜索，Shift+Enter 换行
        </div>

        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">热门搜索</div>
          <div className="flex flex-wrap gap-1.5">
            {HOT.map((h) => (
              <button
                key={h}
                onClick={() => {
                  setKw(h);
                  submit({ kw: h });
                }}
                className="px-2.5 h-6 rounded-full text-xs bg-muted hover:bg-primary/10 hover:text-primary transition-colors"
              >
                {h}
              </button>
            ))}
          </div>
        </div>

        {history.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">最近搜索</div>
            <div className="flex flex-wrap gap-1.5">
              {history.map((h) => (
                <button
                  key={h}
                  onClick={() => {
                    setKw(h);
                    submit({ kw: h });
                  }}
                  className="px-2.5 h-6 rounded-full text-xs bg-background border border-border hover:border-primary hover:text-primary transition-colors"
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* 搜索结果区 */}
      {loading && (
        <Card className="p-12 text-center border-dashed">
          <Loader2 className="h-7 w-7 mx-auto text-primary animate-spin" />
          <div className="mt-3 font-medium">
            正在为「{activeKwJoined}」匹配线索…
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            扫描企业库、贸易记录与联系方式
          </div>
        </Card>
      )}

      {hasSearched && hasResults && (
        <>
          <Card className="px-5 py-3 flex flex-wrap items-center gap-3 bg-primary/[0.04] border-primary/15">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <Search className="h-4 w-4 text-primary shrink-0" />
              <span className="shrink-0">
                找到{" "}
                <span className="font-semibold text-primary tabular-nums">
                  {results.length}
                </span>{" "}
                条线索 · 关键词
              </span>
              <div className="flex flex-wrap gap-1">
                {activeKws.map((w) => (
                  <span
                    key={w}
                    className="inline-flex items-center px-2 h-5 rounded-full text-[11px] bg-primary/10 text-primary font-medium"
                  >
                    {w}
                  </span>
                ))}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={clear}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <XIcon className="h-3.5 w-3.5" /> 清除结果
              </button>
              <Link
                to="/outreach/enterprise"
                search={{ q: activeKws.join(" ") }}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                在企业库中查看完整结果 <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {results.map((l) => (
              <LeadCard key={l.enterprise.id} lead={l} />
            ))}
          </div>
        </>
      )}

      {hasSearched && !hasResults && (
        <Card className="p-12 text-center border-dashed">
          <div className="h-14 w-14 mx-auto rounded-2xl bg-muted text-muted-foreground flex items-center justify-center mb-3">
            <Search className="h-7 w-7" />
          </div>
          <div className="font-medium">
            没有找到与「{activeKwJoined}」匹配的线索
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            建议放宽搜索类型 · 换个关键词 · 或前往
            <Link
              to="/outreach/enterprise"
              search={{ q: activeKws.join(" ") }}
              className="text-primary hover:underline mx-1"
            >
              企业库
            </Link>
            做更精细的多维筛选
          </div>
        </Card>
      )}

      {/* 快捷入口 —— 未搜索时展开网格；已有结果时折叠为一行 */}
      {!hasSearched && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <ShortcutCard
            icon={<Package className="h-5 w-5" />}
            title="按商品类目"
            desc="从商品库进入，反向找到出口/进口该类商品的企业"
            to="/outreach/products"
          />
          <ShortcutCard
            icon={<Hash className="h-5 w-5" />}
            title="按 HS 编码"
            desc="精确锁定海关编码，查全部相关贸易企业"
            to="/outreach/products"
          />
          <ShortcutCard
            icon={<Building2 className="h-5 w-5" />}
            title="企业库"
            desc="按行业、国家、规模等多维筛选企业"
            to="/outreach/enterprise"
          />
          <ShortcutCard
            icon={<Target className="h-5 w-5" />}
            title="按提单"
            desc="通过历史贸易记录挖掘潜在客户"
            to="/outreach/bills"
          />
        </div>
      )}

      {hasSearched && (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>换个方式继续找：</span>
          <Link to="/outreach/products" className="hover:text-primary inline-flex items-center gap-1">
            <Package className="h-3.5 w-3.5" /> 商品类目
          </Link>
          <Link to="/outreach/enterprise" className="hover:text-primary inline-flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" /> 企业库
          </Link>
          <Link to="/outreach/bills" className="hover:text-primary inline-flex items-center gap-1">
            <Target className="h-3.5 w-3.5" /> 提单挖掘
          </Link>
        </div>
      )}
    </div>
  );
}

function ShortcutCard({
  icon,
  title,
  desc,
  to,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="group block p-4 rounded-xl ring-1 ring-border bg-card hover:ring-primary/40 hover:shadow-sm transition-all"
    >
      <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
        {icon}
      </div>
      <div className="font-medium text-sm">{title}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
    </Link>
  );
}

/* ============================ 企业信息 ============================ */

const INDUSTRY_OPTIONS = [
  "消费电子通信",
  "3C 手机配件",
  "新能源锂电",
  "视听数码",
  "小家电行业",
  "塑料家居用品",
  "纺织服装（针织）",
  "家具家居配件",
  "智能家居电器",
  "玩具母婴行业",
  "鞋类",
  "箱包行业",
  "照明灯具",
  "美妆个护",
  "电动两轮车 / 代步车",
  "运动户外用品",
  "塑胶日用杂品",
  "饰品配饰",
  "橡胶制品",
  "摄像安防",
];

// 目标客户行业：按「主营业务 - 所属行业」推导下游买家类型
const TARGET_INDUSTRY_BY_INDUSTRY: Record<string, string[]> = {
  "消费电子通信": ["3C 数码连锁", "电信运营商 / 渠道商", "消费电子进口批发商", "跨境电商卖家"],
  "3C 手机配件": ["手机配件连锁", "3C 数码连锁", "跨境电商卖家", "礼品促销采购商"],
  "新能源锂电": ["储能系统集成商", "电动工具品牌商", "电动两轮车厂商", "户外电源品牌商"],
  "视听数码": ["消费电子进口批发商", "3C 数码连锁", "跨境电商卖家", "AV 影音专营商"],
  "小家电行业": ["家电连锁零售", "商超 / 大卖场", "厨房用品经销商", "跨境电商卖家"],
  "塑料家居用品": ["商超 / 大卖场", "家居百货批发商", "一元店 / 折扣连锁", "跨境电商卖家"],
  "纺织服装（针织）": ["服装品牌商", "服装批发商", "运动品牌代工采购", "电商服饰卖家"],
  "家具家居配件": ["家居建材卖场", "家具品牌商", "装修工程采购", "电商家居卖家"],
  "智能家居电器": ["智能家居集成商", "家电连锁零售", "地产 / 精装房采购", "跨境电商卖家"],
  "玩具母婴行业": ["母婴连锁", "玩具品牌商", "商超 / 大卖场", "电商玩具卖家"],
  "鞋类": ["鞋类品牌商", "鞋服批发商", "鞋类连锁零售", "电商鞋服卖家"],
  "箱包行业": ["箱包品牌商", "礼品促销采购商", "商超 / 大卖场", "电商箱包卖家"],
  "照明灯具": ["照明工程商", "家居建材卖场", "灯具经销批发", "跨境电商卖家"],
  "美妆个护": ["美妆连锁", "个护品牌商 / 代工", "药妆 / 日化经销商", "电商美妆卖家"],
  "电动两轮车 / 代步车": ["两轮车经销商", "共享出行运营商", "户外运动零售", "跨境电商卖家"],
  "运动户外用品": ["运动品牌商", "户外用品连锁", "健身房 / 场馆采购", "电商运动卖家"],
  "塑胶日用杂品": ["日用百货批发商", "一元店 / 折扣连锁", "商超 / 大卖场", "礼品促销采购商"],
  "饰品配饰": ["饰品连锁", "时尚配饰品牌商", "礼品促销采购商", "电商饰品卖家"],
  "橡胶制品": ["工业配套采购商", "汽配经销商", "日用百货批发商", "OEM 品牌代工商"],
  "摄像安防": ["安防工程集成商", "智能家居集成商", "安防设备经销商", "跨境电商卖家"],
};

const GENERIC_TARGET_INDUSTRIES = [
  "进口批发商",
  "连锁零售商",
  "商超 / 大卖场",
  "跨境电商卖家",
  "品牌商 / OEM 代工",
  "工程 / 项目采购商",
];

function buildTargetIndustryOptions(industries: string[]): string[] {
  const list = industries.flatMap((i) => TARGET_INDUSTRY_BY_INDUSTRY[i] ?? []);
  const merged = list.length > 0 ? [...list, ...GENERIC_TARGET_INDUSTRIES] : GENERIC_TARGET_INDUSTRIES;
  return Array.from(new Set(merged));
}

const COUNTRY_OPTIONS = [
  "印度尼西亚",
  "菲律宾",
  "泰国",
  "马来西亚",
  "越南",
  "新加坡",
  "美国",
  "加拿大",
  "德国",
  "英国",
  "法国",
  "意大利",
  "西班牙",
  "日本",
  "韩国",
];
const PRODUCT_OPTIONS = [
  "智能手机",
  "功能手机",
  "手机壳",
  "数据线",
  "充电头",
  "耳机配件",
  "锂离子蓄电池",
  "充电宝",
  "便携储能电源",
  "蓝牙耳机",
  "TWS 无线耳机",
  "空气炸锅",
  "榨汁杯",
  "扫地机器人",
  "吸尘器",
  "塑料餐具",
  "水杯",
  "收纳盒",
  "厨房储物制品",
  "针织 T 恤",
  "运动短袖",
  "瑜伽服",
  "休闲上衣",
  "简易置物架",
  "衣架",
  "组装家具",
  "家具五金",
  "智能插座",
  "LED 灯带",
  "摄像头",
  "人体感应灯",
  "塑胶玩具",
  "拼装积木",
  "益智玩具",
  "休闲帆布鞋",
  "运动鞋",
  "拖鞋",
  "双肩包",
  "旅行包",
  "化妆包",
  "收纳包",
  "LED 装饰灯",
  "彩灯",
  "庭院灯",
  "太阳能小路灯",
  "彩妆",
  "化妆工具",
  "护肤套装",
  "电动滑板车",
  "电动自行车整车及配件",
  "跳绳",
  "健身小器械",
  "露营装备",
  "瑜伽辅具",
  "硅胶厨具",
  "硅胶冰格",
  "防水配件",
  "时尚项链",
  "耳环",
  "发饰",
  "头饰",
  "太阳镜",
  "橡胶防滑垫",
  "密封圈",
  "车载橡胶配件",
  "瑜伽垫",
  "网络摄像头",
  "行车记录仪",
  "运动相机",
];
const HS_CODE_OPTIONS = [
  "851762",
  "851769",
  "850760",
  "852351",
  "850980",
  "392410",
  "610910",
  "940390",
  "854370",
  "950300",
  "640419",
  "420292",
  "940540",
  "330499",
  "871160",
  "950699",
  "392690",
  "961590",
  "401699",
  "852580",
];

const SCALE_OPTIONS = ["1-50", "51-200", "201-1000", "1000+"];
const REVENUE_OPTIONS = ["<500 万", "500 万 - 5000 万", "5000 万 - 5 亿", ">5 亿"];
const COMPETITOR_OPTIONS = [
  "安克创新",
  "绿联科技",
  "公牛集团",
  "倍思",
  "小米生态链",
  "漫步者",
  "韶音科技",
  "德尔玛",
  "石头科技",
  "追觅科技",
  "贝尔金 Belkin",
  "JBL",
  "Sony",
];


export function ProfileTab() {
  const current = useLeadProfile();
  const [draft, setDraft] = useState<LeadProfile>(current);
  const completeness = profileCompleteness(draft);

  const set = <K extends keyof LeadProfile>(k: K, v: LeadProfile[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const handleSave = () => {
    saveProfile(draft);
    toast.success("企业信息已保存", {
      description: `当前完整度 ${profileCompleteness(draft)}%，AI 推荐结果将更精准`,
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
      <div className="space-y-5">
        <Section title="基础信息" icon={<Building2 className="h-4 w-4" />}>
          <Grid2>
            <Field label="企业名称">
              <Input value={draft.companyName} disabled />
            </Field>
            <Field label="统一社会信用代码">
              <Input value={draft.uscc} disabled />
            </Field>
          </Grid2>
          <Field label="营业执照">
            <BusinessLicenseUpload
              value={draft.businessLicense}
              onChange={(v) => set("businessLicense", v)}
            />
          </Field>
        </Section>

        <Section
          title="主营业务"
          subtitle="以下为平台常见的行业、产品与 HS 编码，请点击选择，若没有匹配项，可点击添加按钮后在输入框手动输入并回车添加。"
          icon={<Briefcase className="h-4 w-4" />}
        >
          <Field label="所属行业（多选）">
            <MultiPick
              options={INDUSTRY_OPTIONS}
              value={draft.industries}
              onChange={(v) => set("industries", v)}
              allowCustom
              addPlaceholder="输入行业名称后回车，可添加多个"
            />
          </Field>
          <Field label="主营产品">
            <MultiPick
              options={PRODUCT_OPTIONS}
              value={draft.mainProducts}
              onChange={(v) => set("mainProducts", v)}
              allowCustom
              addPlaceholder="输入产品名后回车，可添加多个"
            />
          </Field>
          <Field label="主要 HS 编码">
            <MultiPick
              options={HS_CODE_OPTIONS}
              value={draft.hsCodes}
              onChange={(v) => set("hsCodes", v)}
              allowCustom
              addPlaceholder="输入 HS 编码后回车，可添加多个"
              mono
            />
          </Field>
          <Grid2>
            <Field label="企业规模">
              <Select value={draft.scale} onValueChange={(v) => set("scale", v)}>
                <SelectTrigger><SelectValue placeholder="选择规模" /></SelectTrigger>
                <SelectContent>
                  {SCALE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="年营业额">
              <Select value={draft.revenue} onValueChange={(v) => set("revenue", v)}>
                <SelectTrigger><SelectValue placeholder="选择区间" /></SelectTrigger>
                <SelectContent>
                  {REVENUE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </Grid2>
        </Section>

        <Section
          title="目标市场"
          subtitle="请选择目标国家 / 地区与目标客户行业，若没有匹配项，可点击添加按钮后在输入框手动输入并回车添加。"
          icon={<Target className="h-4 w-4" />}
        >
          <Field label="目标国家 / 地区（多选）">
            <MultiPick
              options={COUNTRY_OPTIONS}
              value={draft.targetCountries}
              onChange={(v) => set("targetCountries", v)}
              allowCustom
              addPlaceholder="输入国家或地区后回车，可添加多个"
            />
          </Field>
          <Field
            label="目标客户行业（多选）"
            hint={
              draft.industries.length > 0
                ? `已根据主营业务所属行业（${draft.industries.join("、")}）推荐下游客户行业`
                : "请先在「主营业务」选择所属行业，可获得更精准的下游客户行业推荐"
            }
          >
            <MultiPick
              options={buildTargetIndustryOptions(draft.industries)}
              value={draft.targetIndustries}
              onChange={(v) => set("targetIndustries", v)}
              allowCustom
              addPlaceholder="输入行业名称后回车，可添加多个"
            />
          </Field>
          <Field label="目标客户规模">
            <Select
              value={draft.targetScale}
              onValueChange={(v) => set("targetScale", v)}
            >
              <SelectTrigger><SelectValue placeholder="选择规模" /></SelectTrigger>
              <SelectContent>
                {SCALE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </Section>

        <Section title="竞争情报" icon={<TrendingUp className="h-4 w-4" />}>
          <Field label="主要竞品企业（点击添加按钮后在输入框手动输入并回车添加）">
            <MultiPick
              options={COMPETITOR_OPTIONS}
              value={draft.competitors}
              onChange={(v) => set("competitors", v)}
              allowCustom
              addPlaceholder="输入竞品企业名后回车，可添加多个"
            />
          </Field>
          <Field
            label="我方优势（相对竞品）"
            hint="填写「我方」相较上述竞品的优势，而非竞争对手的优势。AI 会据此在触达文案中突出我方卖点。"
          >
            <CountedTextarea
              rows={3}
              max={2000}
              value={draft.advantage}
              onChange={(v) => set("advantage", v)}
              placeholder="请输入..."
            />
          </Field>
        </Section>

        <Section title="附加资料（可选）" icon={<Sparkles className="h-4 w-4" />}>
          <Grid2>
            <Field label="企业官网">
              <Input
                value={draft.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://"
              />
            </Field>
            <div />
          </Grid2>
          <Field label="品牌故事 / 简介">
            <CountedTextarea
              rows={4}
              max={2000}
              value={draft.brandStory}
              onChange={(v) => set("brandStory", v)}
              placeholder="一段简短的企业故事，将用于 AI 理解品牌定位"
            />
            <div className="pt-2">
              <FilesUploader
                idPrefix="brand-story"
                label="上传品牌手册 / 宣传图（支持 PNG / JPG / PDF）"
                files={draft.brandFiles ?? []}
                onChange={(v) => set("brandFiles", v)}
              />
            </div>
          </Field>

          <Field
            label="企业知识库"
            hint="上传产品手册、报价与规格说明、常见问题解答、案例与售后政策等资料（支持 PNG / JPG / PDF）。知识库将作为后续 AI 智能外呼 / 智能回复时解答目标客户与潜在客户提问的参考依据；资料越完善，AI 回答越准确专业，客户体验越好，也越容易促成合作。"
          >
            <FilesUploader
              idPrefix="knowledge-base"
              label="上传知识库资料（支持 PNG / JPG / PDF）"
              files={draft.knowledgeFiles ?? []}
              onChange={(v) => set("knowledgeFiles", v)}
              max={12}
            />
            <p className="pt-2 text-[11px] leading-relaxed text-muted-foreground/80">
              建议优先上传：产品目录 / 参数规格、价格与起订量、交期与物流方案、资质与检测报告、常见问题（FAQ）、合作案例。
            </p>
          </Field>

          <Field label="企业资质">
            <QualificationsEditor
              items={draft.qualifications}
              onChange={(v) => set("qualifications", v)}
            />
          </Field>
        </Section>

        <div className="flex justify-end gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">重置</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认重置企业信息编辑？</AlertDialogTitle>
                <AlertDialogDescription>
                  将放弃本次未保存的修改，恢复到上次保存的企业信息内容。此操作不可撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setDraft(current);
                    toast.success("已恢复到上次保存的企业信息");
                  }}
                >
                  确认重置
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={handleSave} className="gap-1.5">
            <Save className="h-4 w-4" /> 保存企业信息
          </Button>
        </div>
      </div>

      <aside className="lg:sticky lg:top-6 self-start">
        <Card className="p-5 space-y-4">
          <div className="text-sm font-medium">企业信息完整度</div>
          <div className="relative h-32 w-32 mx-auto">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle
                cx="50" cy="50" r="42"
                strokeWidth="10"
                className="fill-none stroke-muted"
              />
              <circle
                cx="50" cy="50" r="42"
                strokeWidth="10"
                strokeLinecap="round"
                className="fill-none stroke-primary transition-all"
                strokeDasharray={`${(completeness / 100) * 263.9} 263.9`}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold tabular-nums">
                {completeness}
                <span className="text-base text-muted-foreground">%</span>
              </span>
            </div>
          </div>
          <div className="text-xs text-muted-foreground text-center">
            完整度越高，AI 推荐越精准。建议至少填写
            <span className="text-foreground"> 行业、主营产品、目标市场 </span>
            三项。
          </div>
        </Card>
      </aside>
    </div>
  );
}

function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5 space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="text-primary">{icon}</span>
          {title}
        </div>
        {subtitle ? (
          <div className="text-xs text-muted-foreground pl-6">{subtitle}</div>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}


function Grid2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {hint && (
        <p className="text-[11px] leading-relaxed text-muted-foreground/80">{hint}</p>
      )}
      {children}
    </div>
  );

}

function MultiPick({
  options,
  value,
  onChange,
  allowCustom,
  addPlaceholder,
  labelMap,
  hint,
  mono,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  allowCustom?: boolean;
  addPlaceholder?: string;
  labelMap?: Record<string, string>;
  hint?: string;
  mono?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [draftInput, setDraftInput] = useState("");

  // 大小写不敏感去重
  const eq = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  const hasVal = (arr: string[], v: string) => arr.some((x) => eq(x, v));

  const toggle = (o: string) => {
    if (hasVal(value, o)) onChange(value.filter((x) => !eq(x, o)));
    else onChange([...value, o]);
  };

  const commitAdd = () => {
    const v = draftInput.trim();
    if (!v) {
      setAdding(false);
      return;
    }
    // 优先复用已有英文标准选项的大小写
    const canonical = options.find((o) => eq(o, v)) ?? v;
    if (!hasVal(value, canonical)) onChange([...value, canonical]);
    setDraftInput("");
    setAdding(false);
  };

  // 合并：内置选项 + 用户自定义添加（去重，保留首次出现的大小写）
  const merged: string[] = [];
  for (const o of [...options, ...value]) {
    if (!hasVal(merged, o)) merged.push(o);
  }

  const cn = (o: string) => labelMap?.[o.toLowerCase()];

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5 items-center">
        {merged.map((o) => {
          const on = hasVal(value, o);
          const tip = cn(o);
          return (
            <button
              key={o}
              type="button"
              onClick={() => toggle(o)}
              title={tip ? `${o}（${tip}）` : o}
              className={`px-2.5 h-7 rounded-full text-xs font-medium border transition-colors ${
                mono ? "font-mono tracking-tight" : ""
              } ${
                on
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              {o}
            </button>
          );
        })}
      {allowCustom &&
        (adding ? (
          <span className="inline-flex items-center gap-1">
            <Input
              autoFocus
              value={draftInput}
              onChange={(e) => setDraftInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitAdd();
                } else if (e.key === "Escape") {
                  setDraftInput("");
                  setAdding(false);
                }
              }}
              onBlur={commitAdd}
              placeholder={addPlaceholder ?? "输入后回车"}
              className="h-7 w-48 text-xs"
            />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="px-2.5 h-7 rounded-full text-xs font-medium border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary inline-flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> 添加
          </button>
        ))}
      </div>
      {hint && (
        <div className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          <Info className="h-3 w-3" /> {hint}
        </div>
      )}
    </div>
  );
}

function ChipInput({
  value,
  onChange,
  placeholder,
  mono,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (!v) return;
    if (!value.includes(v)) onChange([...value, v]);
    setInput("");
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className={mono ? "font-mono" : ""}
        />
        <Button type="button" variant="outline" onClick={add} className="gap-1 shrink-0">
          <Plus className="h-4 w-4" /> 添加
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span
              key={v}
              className={`inline-flex items-center gap-1 pl-2.5 pr-1 h-6 rounded-full text-xs bg-primary/10 text-primary ${
                mono ? "font-mono" : ""
              }`}
            >
              {v}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== v))}
                className="inline-flex items-center justify-center h-4 w-4 rounded-full hover:bg-black/10"
              >
                <XIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
/* ============================ 受控字数 Textarea ============================ */

function CountedTextarea({
  value,
  onChange,
  max,
  rows = 3,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  max: number;
  rows?: number;
  placeholder?: string;
}) {
  const len = value.length;
  const near = len >= max * 0.9;
  const full = len >= max;
  return (
    <div className="relative">
      <Textarea
        rows={rows}
        value={value}
        maxLength={max}
        onChange={(e) => onChange(e.target.value.slice(0, max))}
        placeholder={placeholder}
        className="pr-2 pb-6"
      />
      <div
        className={`pointer-events-none absolute bottom-1.5 right-2.5 text-[11px] tabular-nums ${
          full ? "text-destructive" : near ? "text-amber-600" : "text-muted-foreground"
        }`}
      >
        {len}/{max}
      </div>
    </div>
  );
}

/* ============================ 出口资质附件上传 ============================ */

/* ============================ 企业资质 ============================ */

const ACCEPTED_MIME = ["image/png", "image/jpeg", "application/pdf"];
const ACCEPT_ATTR = ".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf";
const MAX_FILES_PER_ITEM = 8;

function newQualificationId() {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const MAX_BRAND_FILES = 6;

function FilesUploader({
  idPrefix,
  label,
  files,
  onChange,
  max = MAX_BRAND_FILES,
}: {
  idPrefix: string;
  label: string;
  files: QualificationFile[];
  onChange: (next: QualificationFile[]) => void;
  max?: number;
}) {
  const inputId = `${idPrefix}-files`;

  const handleFiles = async (list: FileList | null) => {
    if (!list || !list.length) return;
    const valid = Array.from(list).filter((f) => ACCEPTED_MIME.includes(f.type));
    if (list.length - valid.length > 0) {
      toast.error(
        `已忽略 ${list.length - valid.length} 个不支持的文件（仅支持 PNG / JPG / PDF）`,
      );
    }
    if (!valid.length) return;
    const room = max - files.length;
    if (valid.length > room) {
      toast.warning(`最多上传 ${max} 个文件，已截取前 ${room} 个`);
    }
    const next = [...files];
    for (const f of valid.slice(0, room)) {
      const dataUrl = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ""));
        r.readAsDataURL(f);
      });
      next.push({
        id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name,
        dataUrl,
        mime: f.type,
      });
    }
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <ImageIcon className="h-3.5 w-3.5" />
          {label}
        </span>
        <span className="tabular-nums">
          {files.length}/{max}
        </span>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {files.map((f) => {
          const isPdf = f.mime === "application/pdf";
          return (
            <div
              key={f.id}
              className="group relative aspect-square rounded-lg ring-1 ring-border overflow-hidden bg-muted/30"
            >
              {isPdf ? (
                <a
                  href={f.dataUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="h-full w-full flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary p-2"
                >
                  <Upload className="h-5 w-5" />
                  <span className="text-[10px] uppercase tracking-wide">PDF</span>
                </a>
              ) : (
                <img src={f.dataUrl} alt={f.name} className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                onClick={() => onChange(files.filter((x) => x.id !== f.id))}
                className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="删除"
              >
                <XIcon className="h-3 w-3" />
              </button>
              <div className="absolute bottom-0 inset-x-0 px-1.5 py-1 text-[10px] text-white bg-gradient-to-t from-black/70 to-transparent truncate">
                {f.name}
              </div>
            </div>
          );
        })}
        {files.length < max && (
          <label
            htmlFor={inputId}
            className="aspect-square rounded-lg ring-1 ring-dashed ring-border hover:ring-primary/50 hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-1 cursor-pointer text-muted-foreground"
          >
            <Upload className="h-4 w-4" />
            <span className="text-[11px]">点击上传</span>
            <input
              id={inputId}
              type="file"
              accept={ACCEPT_ATTR}
              multiple
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.currentTarget.value = "";
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}

function QualificationsEditor({
  items,
  onChange,
}: {
  items: QualificationItem[];
  onChange: (next: QualificationItem[]) => void;
}) {
  const update = (id: string, patch: Partial<QualificationItem>) => {
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };
  const remove = (id: string) => {
    onChange(items.filter((it) => it.id !== id));
  };
  const add = () => {
    onChange([
      ...items,
      { id: newQualificationId(), name: "", desc: "", files: [] },
    ]);
  };

  return (
    <div className="space-y-3">
      {items.length === 0 && (
        <div className="rounded-lg border border-dashed bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
          暂未添加企业资质，点击下方按钮新增
        </div>
      )}
      {items.map((it, idx) => (
        <QualificationItemCard
          key={it.id}
          index={idx}
          item={it}
          onChange={(patch) => update(it.id, patch)}
          onRemove={() => remove(it.id)}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        className="gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" /> 新增企业资质
      </Button>
    </div>
  );
}

function QualificationItemCard({
  index,
  item,
  onChange,
  onRemove,
}: {
  index: number;
  item: QualificationItem;
  onChange: (patch: Partial<QualificationItem>) => void;
  onRemove: () => void;
}) {
  const inputId = `qualification-files-${item.id}`;

  const handleFiles = async (list: FileList | null) => {
    if (!list || !list.length) return;
    const valid = Array.from(list).filter((f) => ACCEPTED_MIME.includes(f.type));
    const invalidCount = list.length - valid.length;
    if (invalidCount > 0) {
      toast.error(`已忽略 ${invalidCount} 个不支持的文件（仅支持 PNG / JPG / PDF）`);
    }
    if (!valid.length) return;
    const room = MAX_FILES_PER_ITEM - item.files.length;
    if (valid.length > room) {
      toast.warning(`每项资质最多 ${MAX_FILES_PER_ITEM} 个文件，已截取前 ${room} 个`);
    }
    const picked = valid.slice(0, room);
    const next = [...item.files];
    for (const f of picked) {
      const dataUrl = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ""));
        r.readAsDataURL(f);
      });
      next.push({
        id: `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: f.name,
        dataUrl,
        mime: f.type,
      });
    }
    onChange({ files: next });
  };

  const removeFile = (fid: string) => {
    onChange({ files: item.files.filter((f) => f.id !== fid) });
  };

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">
          资质 #{index + 1}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-7 px-2 text-muted-foreground hover:text-destructive"
        >
          <XIcon className="h-3.5 w-3.5" /> 删除
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">资质名称</Label>
          <Input
            value={item.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="例如：ISO 9001 质量管理体系"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">资质描述</Label>
          <Input
            value={item.desc}
            onChange={(e) => onChange({ desc: e.target.value })}
            placeholder="发证机构 / 有效期 / 备注"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ImageIcon className="h-3.5 w-3.5" />
            上传资质图片或文件（支持 PNG / JPG / PDF）
          </span>
          <span className="tabular-nums">
            {item.files.length}/{MAX_FILES_PER_ITEM}
          </span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {item.files.map((f) => {
            const isPdf = f.mime === "application/pdf";
            return (
              <div
                key={f.id}
                className="group relative aspect-square rounded-lg ring-1 ring-border overflow-hidden bg-muted/30"
              >
                {isPdf ? (
                  <a
                    href={f.dataUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="h-full w-full flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary p-2"
                  >
                    <Upload className="h-5 w-5" />
                    <span className="text-[10px] uppercase tracking-wide">PDF</span>
                  </a>
                ) : (
                  <img
                    src={f.dataUrl}
                    alt={f.name}
                    className="h-full w-full object-cover"
                  />
                )}
                <button
                  type="button"
                  onClick={() => removeFile(f.id)}
                  className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="删除"
                >
                  <XIcon className="h-3 w-3" />
                </button>
                <div className="absolute bottom-0 inset-x-0 px-1.5 py-1 text-[10px] text-white bg-gradient-to-t from-black/70 to-transparent truncate">
                  {f.name}
                </div>
              </div>
            );
          })}
          {item.files.length < MAX_FILES_PER_ITEM && (
            <label
              htmlFor={inputId}
              className="aspect-square rounded-lg ring-1 ring-dashed ring-border hover:ring-primary/50 hover:bg-primary/5 transition-colors flex flex-col items-center justify-center gap-1 cursor-pointer text-muted-foreground"
            >
              <Upload className="h-4 w-4" />
              <span className="text-[11px]">点击上传</span>
              <input
                id={inputId}
                type="file"
                accept={ACCEPT_ATTR}
                multiple
                className="hidden"
                onChange={(e) => {
                  handleFiles(e.target.files);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

function BusinessLicenseUpload({
  value,
  onChange,
}: {
  value?: QualificationFile;
  onChange: (v: QualificationFile | undefined) => void;
}) {
  const inputId = "business-license-upload";

  const handleFiles = async (list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    if (!ACCEPTED_MIME.includes(file.type)) {
      toast.error("仅支持 PNG / JPG / PDF 格式");
      return;
    }
    const dataUrl = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.readAsDataURL(file);
    });
    onChange({
      id: `bl-${Date.now()}`,
      name: file.name,
      dataUrl,
      mime: file.type,
    });
  };

  if (value) {
    const isPdf = value.mime === "application/pdf";
    return (
      <div className="flex items-center gap-3">
        <div className="relative h-20 w-20 rounded-lg ring-1 ring-border overflow-hidden bg-muted/30 shrink-0">
          {isPdf ? (
            <a
              href={value.dataUrl}
              target="_blank"
              rel="noreferrer"
              className="h-full w-full flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-primary"
            >
              <Upload className="h-5 w-5" />
              <span className="text-[10px] uppercase tracking-wide">PDF</span>
            </a>
          ) : (
            <img src={value.dataUrl} alt={value.name} className="h-full w-full object-cover" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate">{value.name}</div>
          <div className="mt-1 flex items-center gap-2">
            <label
              htmlFor={inputId}
              className="text-xs text-primary hover:underline cursor-pointer"
            >
              重新上传
            </label>
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              删除
            </button>
            <input
              id={inputId}
              type="file"
              accept={ACCEPT_ATTR}
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.currentTarget.value = "";
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <label
      htmlFor={inputId}
      className="flex items-center gap-3 rounded-lg ring-1 ring-dashed ring-border hover:ring-primary/50 hover:bg-primary/5 transition-colors px-3 py-3 cursor-pointer text-muted-foreground"
    >
      <Upload className="h-4 w-4" />
      <span className="text-sm">点击上传营业执照（支持 PNG / JPG / PDF）</span>
      <input
        id={inputId}
        type="file"
        accept={ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />
    </label>
  );
}
