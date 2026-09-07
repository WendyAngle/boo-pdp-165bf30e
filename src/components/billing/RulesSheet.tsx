import {
  Mail,
  Phone,
  Share2,
  Info,
  Lock,
  Send,
  MailPlus,
  MessageSquare,
  MessageCircle,
  Undo2,
  Gift,
  ShieldAlert,
  Users,
} from "lucide-react";
import {
  COST_VIEW_EMAIL,
  COST_VIEW_PHONE,
  COST_VIEW_SOCIAL,
  COST_REACH_EMAIL,
  COST_REACH_SMS,
  COST_REACH_SOCIAL,
  COST_REACH_SOCIAL_WHATSAPP,
  COST_SOCIAL_ACCOUNT_PURCHASE,
} from "@/lib/credits-ledger";
import { SMS_RATE_MIN, SMS_RATE_MAX } from "@/lib/sms-credit-rates";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Tone = "sky" | "violet" | "emerald" | "amber";

type Rule = {
  tone: Tone;
  icon: React.ReactNode;
  title: string;
  cost: number;
  /** 覆盖右上角价格徽标文案（用于浮动定价场景） */
  costLabel?: string;
  desc: string;
  /** 卡片底部附加内容（如地区 / 渠道价目表） */
  extra?: React.ReactNode;
};

const UNLOCK_RULES: Rule[] = [
  {
    tone: "sky",
    icon: <Mail className="h-4 w-4" />,
    title: "查看邮箱",
    cost: COST_VIEW_EMAIL,
    desc: "解锁联系人邮箱字段，已解锁后不再重复扣费。",
  },
  {
    tone: "violet",
    icon: <Phone className="h-4 w-4" />,
    title: "查看电话",
    cost: COST_VIEW_PHONE,
    desc: "解锁联系人电话字段，已解锁后不再重复扣费。",
  },
  {
    tone: "emerald",
    icon: <Share2 className="h-4 w-4" />,
    title: "查看社媒账号",
    cost: COST_VIEW_SOCIAL,
    desc: "解锁联系人社媒账号字段，已解锁后不再重复扣费。",
  },
];

const REACH_RULES: Rule[] = [
  {
    tone: "sky",
    icon: <MailPlus className="h-4 w-4" />,
    title: "触达邮箱",
    cost: COST_REACH_EMAIL,
    desc: "向单个联系人发送一封邮件，按有效收件人计费；若邮箱未解锁，将自动解锁并合并扣费。",
  },
  {
    tone: "violet",
    icon: <MessageSquare className="h-4 w-4" />,
    title: "触达短信",
    cost: COST_REACH_SMS,
    costLabel: `${SMS_RATE_MIN}~${SMS_RATE_MAX} 积分/条`,
    desc: "短信为浮动计费：按接收号码所在地区与实际发送渠道扣点，系统默认自动路由到该地区扣点更低的渠道；发送前会展示本次预估扣点，按实际提交成功的号码计费。若电话未解锁，将自动解锁并合并扣费。",
  },
  {
    tone: "amber",
    icon: <MessageCircle className="h-4 w-4" />,
    title: "触达 WhatsApp",
    cost: COST_REACH_SOCIAL_WHATSAPP,
    desc: "向单个已注册 WhatsApp 的号码发送一条私信，未注册号码不计费；若电话未解锁，将自动解锁并合并扣费。",
  },
  {
    tone: "emerald",
    icon: <Send className="h-4 w-4" />,
    title: "触达社媒",
    cost: COST_REACH_SOCIAL,
    desc: "通过社媒渠道触达单个联系人，含「加好友/关注」与「发私信」两类动作，每次成功执行按次计费。",
  },
];

const SOCIAL_ACCOUNT_RULES: Rule[] = [
  {
    tone: "emerald",
    icon: <Users className="h-4 w-4" />,
    title: "购买社媒账号",
    cost: COST_SOCIAL_ACCOUNT_PURCHASE,
    desc: "开通 1 个可用于加友与私信的社媒账号（Facebook / TikTok），按账号一次性扣费；账号成功入池后不退款。",
  },
];


export function RulesSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[760px] p-0 overflow-hidden max-h-[85vh] flex flex-col">
        <div className="bg-gradient-to-br from-primary/8 via-primary/4 to-transparent px-6 pt-6 pb-5 border-b">
          <DialogHeader className="space-y-2">
            <DialogTitle className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                <Info className="h-4 w-4" />
              </span>
              积分规则说明
            </DialogTitle>
            <DialogDescription className="whitespace-nowrap">
              以下业务操作将从积分余额中扣除相应积分，字段解锁一次性计费，触达按次计费。
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <RuleGroup
            icon={<Lock className="h-3.5 w-3.5" />}
            title="字段解锁"
            hint="按字段一次性扣费，已解锁后不再重复计费。"
            rules={UNLOCK_RULES}
          />
          <RuleGroup
            icon={<Send className="h-3.5 w-3.5" />}
            title="触达消耗"
            hint="每次发送均扣费，仅对有效收件人计费。"
            rules={REACH_RULES}
          />
          <RuleGroup
            icon={<Users className="h-3.5 w-3.5" />}
            title="社媒账号"
            hint="社媒账号购买后可用于加友与私信触达。"
            rules={SOCIAL_ACCOUNT_RULES}
          />
          <PolicySection />
        </div>

        <div className="mx-6 mb-6 mt-1 rounded-lg bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground leading-relaxed shrink-0 whitespace-nowrap">
          积分仅用于功能解锁，不可提现。所有扣费流水可在账单列表中查询与复核。
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RuleGroup({
  icon,
  title,
  hint,
  rules,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  rules: Rule[];
}) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </span>
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">· {hint}</span>
      </div>
      <div className="space-y-2">
        {rules.map((r) => (
          <RuleCard key={r.title} {...r} />
        ))}
      </div>
    </section>
  );
}

function RuleCard({
  icon,
  title,
  cost,
  costLabel,
  desc,
  tone,
  extra,
}: {
  icon: React.ReactNode;
  title: string;
  cost: number;
  costLabel?: string;
  desc: string;
  tone: Tone;
  extra?: React.ReactNode;
}) {
  const tones = {
    sky: "bg-sky-50 text-sky-700 ring-sky-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
  } as const;
  return (
    <div className="group rounded-xl ring-1 ring-border p-3.5 hover:ring-primary/30 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-2.5">
        <span className={`inline-flex h-8 w-8 rounded-lg ring-1 items-center justify-center ${tones[tone]}`}>
          {icon}
        </span>
        <div className="font-medium text-sm">{title}</div>
        {costLabel ? (
          <span className="ml-auto inline-flex items-baseline gap-0.5 rounded-md bg-rose-50 text-rose-600 ring-1 ring-rose-200 px-2 py-0.5">
            <span className="text-sm font-semibold tabular-nums">{costLabel}</span>
          </span>
        ) : cost <= 0 ? (
          <span className="ml-auto inline-flex items-baseline rounded-md bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-2 py-0.5">
            <span className="text-sm font-semibold">免费</span>
          </span>
        ) : (
          <span className="ml-auto inline-flex items-baseline gap-0.5 rounded-md bg-rose-50 text-rose-600 ring-1 ring-rose-200 px-2 py-0.5">
            <span className="text-[11px]">−</span>
            <span className="text-sm font-semibold tabular-nums">{cost}</span>
            <span className="text-[11px] ml-0.5">积分</span>
          </span>
        )}
      </div>
      <p className="mt-2 pl-[42px] text-xs text-muted-foreground leading-relaxed">{desc}</p>
      {extra ? <div className="mt-2.5 pl-[42px]">{extra}</div> : null}
    </div>
  );
}



function PolicySection() {
  const items = [
    {
      tone: "emerald" as const,
      icon: <Undo2 className="h-4 w-4" />,
      title: "触达失败自动退还",
      desc: "邮件被邮箱服务商硬退回、短信下发失败、WhatsApp 号码未注册等失败场景，24 小时内系统自动退还对应积分；成功送达后不退。",
    },
    {
      tone: "sky" as const,
      icon: <Gift className="h-4 w-4" />,
      title: "AI 推荐每日免费额度",
      desc: "每个自然日提供 5 次免费 AI 推荐生成，次日 00:00 自动重置；超出后按 AI 推荐单价扣减积分，不占用触达/解锁额度。",
    },
    {
      tone: "amber" as const,
      icon: <ShieldAlert className="h-4 w-4" />,
      title: "积分不足兜底策略",
      desc: "积分余额不足以支付本次操作时，系统会阻止发起并弹出充值引导；不支持欠费、不允许透支。批量操作仅按可支付部分执行，其余保留在草稿。",
    },
  ];
  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold">补充规则</h3>
        <span className="text-xs text-muted-foreground">· 退款、免费额度与兜底策略</span>
      </div>
      <div className="space-y-2">
        {items.map((r) => (
          <div
            key={r.title}
            className="rounded-xl ring-1 ring-border p-3.5 hover:ring-primary/30 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <span
                className={
                  r.tone === "emerald"
                    ? "inline-flex h-8 w-8 rounded-lg ring-1 items-center justify-center bg-emerald-50 text-emerald-700 ring-emerald-200"
                    : r.tone === "sky"
                      ? "inline-flex h-8 w-8 rounded-lg ring-1 items-center justify-center bg-sky-50 text-sky-700 ring-sky-200"
                      : "inline-flex h-8 w-8 rounded-lg ring-1 items-center justify-center bg-amber-50 text-amber-700 ring-amber-200"
                }
              >
                {r.icon}
              </span>
              <div className="font-medium text-sm">{r.title}</div>
            </div>
            <p className="mt-2 pl-[42px] text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}