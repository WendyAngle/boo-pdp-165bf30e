import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  ChevronRight,
  Clock,
  FileText,
  Globe,
  Info,
  Languages,
  Linkedin,
  Mail,
  MapPin,
  MessageSquare,
  MessageCircle,
  Phone,
  Sparkles,
  Twitter,
  UserRound,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { findEnterprise } from "@/data/enterprises";
import type { Enterprise, EnterpriseContact } from "@/data/enterprises";
import heroBg from "@/assets/enterprise-hero.jpg";
import { FavoriteToggle } from "@/components/FavoriteToggle";
import { MaskedField } from "@/components/MaskedField";
import { ReachButton } from "@/components/ReachButton";
import { WhatsAppReachButton } from "@/components/WhatsAppReachButton";
import { RecentCommsCapsule } from "@/components/outreach/RecentCommsCapsule";

interface ContactDetail {
  enterprise: Enterprise;
  contact: EnterpriseContact;
  idx: number;
  department: string;
  seniority: string;
  joinedAt: string;
  tenureYears: number;
  language: string;
  timezone: string;
  city: string;
  country: string;
  linkedin: string;
  twitter: string;
  bio: string;
  reachCount: number;
  lastContactedAt: string;
  relatedBillCount: number;
  activities: { type: string; title: string; at: string }[];
  tags: string[];
}

const DEPARTMENTS = ["采购部", "供应链中心", "战略采购部", "进出口业务部", "运营管理部", "合规与风控部"];
const SENIORITIES = ["Director", "Senior Manager", "Manager", "Lead", "Head"];
const LANGUAGES = [
  "英语 / 中文普通话",
  "英语 / 西班牙语",
  "英语 / 日语",
  "英语 / 德语",
  "英语 / 法语",
  "英语 / 意大利语",
];
const TIMEZONES = ["GMT-5 (EST)", "GMT+8 (CST)", "GMT+9 (JST)", "GMT+1 (CET)", "GMT+0 (UTC)", "GMT-6 (CST)"];
const TAG_POOL = ["关键决策人", "高频联系人", "采购口径", "可触达", "近期活跃", "已建立沟通", "邮件回复率高"];

function pad(n: number, len = 2) {
  return String(n).padStart(len, "0");
}

function buildDetail(enterprise: Enterprise, idx: number): ContactDetail | null {
  const contact = enterprise.contacts[idx];
  if (!contact) return null;

  // 用企业 id 数字尾段 + idx 生成稳定随机
  const seed = (Number(enterprise.id.replace(/\D/g, "")) || 0) + idx * 31;
  const department = DEPARTMENTS[seed % DEPARTMENTS.length];
  const seniority = SENIORITIES[(seed >> 1) % SENIORITIES.length];
  const tenureYears = 1 + (seed % 12);
  const joinYear = 2026 - tenureYears;
  const joinMonth = (seed % 12) + 1;
  const joinDay = ((seed * 7) % 27) + 1;
  const joinedAt = `${joinYear}-${pad(joinMonth)}-${pad(joinDay)}`;
  const language = LANGUAGES[(seed >> 2) % LANGUAGES.length];
  const timezone = TIMEZONES[(seed >> 3) % TIMEZONES.length];
  const handle = contact.name.split(" ").join("-").toLowerCase();
  const linkedin = `linkedin.com/in/${handle}`;
  const twitter = `@${contact.name.split(" ").join("").toLowerCase()}`;
  const reachCount = 3 + (seed % 18);
  const lastY = 2025 + ((seed >> 4) % 2);
  const lastM = ((seed * 3) % 12) + 1;
  const lastD = ((seed * 5) % 27) + 1;
  const lastContactedAt = `${lastY}-${pad(lastM)}-${pad(lastD)}T09:${pad((seed * 11) % 60)}:00`;
  const relatedBillCount = Math.max(1, Math.floor(enterprise.totalBills / Math.max(1, enterprise.contacts.length)));

  const activities = [
    {
      type: "邮件",
      title: `通过平台向 ${contact.name} 发送了商务洽谈邮件`,
      at: `${lastY}-${pad(lastM)}-${pad(lastD)}`,
    },
    {
      type: "提单",
      title: `${enterprise.name} 新增关联提单 ${enterprise.bills[0]?.partner ?? ""}`,
      at: `${lastY}-${pad(((lastM + 10) % 12) + 1)}-${pad(((lastD + 5) % 27) + 1)}`,
    },
    {
      type: "更新",
      title: `更新了职位信息：${contact.title}`,
      at: `${lastY - 1}-${pad(((seed * 2) % 12) + 1)}-${pad(((seed * 4) % 27) + 1)}`,
    },
  ];

  const tags = [
    TAG_POOL[seed % TAG_POOL.length],
    TAG_POOL[(seed + 3) % TAG_POOL.length],
    TAG_POOL[(seed + 5) % TAG_POOL.length],
  ].filter((t, i, arr) => arr.indexOf(t) === i);

  const bio =
    `${contact.name} 现任 ${enterprise.name} ${department}「${seniority} · ${contact.title}」,` +
    `在企业已任职约 ${tenureYears} 年,主要负责跨境采购、供应商评估与贸易合规相关业务,` +
    `是企业在 ${enterprise.tradeRole} 业务条线的关键联系人之一。`;

  return {
    enterprise,
    contact,
    idx,
    department,
    seniority,
    joinedAt,
    tenureYears,
    language,
    timezone,
    city: enterprise.city,
    country: enterprise.country || enterprise.countryCode || "—",
    linkedin,
    twitter,
    bio,
    reachCount,
    lastContactedAt,
    relatedBillCount,
    activities,
    tags,
  };
}

export const Route = createFileRoute("/_app/outreach/enterprise/$id/contact/$idx")({
  head: ({ params }) => ({
    meta: [{ title: `人物详情 · ${params.id}-${params.idx} | 出海大数据平台` }],
  }),
  loader: ({ params }): { detail: ContactDetail } => {
    const ent = findEnterprise(params.id);
    if (!ent) throw notFound();
    const idx = Number(params.idx);
    if (!Number.isFinite(idx)) throw notFound();
    const detail = buildDetail(ent, idx);
    if (!detail) throw notFound();
    return { detail };
  },
  notFoundComponent: () => (
    <div className="p-8">
      <Card className="p-16 text-center text-muted-foreground">未找到该人物</Card>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="p-8">
      <Card className="p-16 text-center text-muted-foreground">
        加载失败：{(error as Error).message}
      </Card>
    </div>
  ),
  component: ContactDetailPage,
});

function ContactDetailPage() {
  const { detail: d } = Route.useLoaderData() as { detail: ContactDetail };
  const { enterprise: e, contact: c } = d;

  const initials = c.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="p-8 space-y-6">
      {/* 面包屑 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>出海大数据平台</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/outreach/enterprise" className="hover:text-primary transition-colors">
            企业
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link
            to="/outreach/enterprise/$id"
            params={{ id: e.id }}
            className="hover:text-primary transition-colors truncate max-w-[220px]"
          >
            {e.name}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium truncate max-w-[200px]">{c.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <FavoriteToggle
            kind="contact"
            refId={`${e.id}:${d.idx}`}
            payload={{
              title: c.name,
              subtitle: c.title,
              meta: { email: c.email, phone: c.phone || "" },
              parentRef: { kind: "enterprise", id: e.id, name: e.name },
            }}
            stopPropagation={false}
          />
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/outreach/enterprise/$id" params={{ id: e.id }}>
              <ArrowLeft className="h-4 w-4" />
              返回企业详情
            </Link>
          </Button>
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl ring-1 ring-border">
        <img
          src={heroBg}
          alt={c.name}
          width={1920}
          height={320}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(184_70%_42%/0.95)] via-[hsl(184_60%_55%/0.55)] to-transparent" />
        <div className="relative px-8 py-7 flex items-start gap-5 text-white">
          <div className="h-16 w-16 rounded-2xl bg-white/25 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/30 text-xl font-semibold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-wide truncate capitalize">{c.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-sm">
                <Briefcase className="h-3.5 w-3.5" />
                <MaskedField
                  targetKind="contact"
                  targetId={`${e.id}:${d.idx}`}
                  targetName={c.name}
                  parentRef={{ id: e.id, name: e.name }}
                  field="title"
                  value={c.title}
                />
              </span>
              <Link
                to="/outreach/enterprise/$id"
                params={{ id: e.id }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-sm hover:bg-white/30 transition-colors"
              >
                <Building2 className="h-3.5 w-3.5" />
                {e.name}
              </Link>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-sm">
                <MapPin className="h-3.5 w-3.5" />
                {d.city}
                {d.country ? ` · ${d.country}` : ""}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/95 text-emerald-700 text-sm font-medium">
                {e.tradeRole}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white/90 font-mono text-xs">
                <UserRound className="h-3 w-3" />
                {e.id}-{String(d.idx).padStart(2, "0")}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* KPI */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard icon={<MessageSquare className="h-7 w-7" />} label="累计触达" value={d.reachCount} unit="次" />
        <KpiCard icon={<FileText className="h-7 w-7" />} label="关联提单" value={d.relatedBillCount} unit="票" />
        <KpiCard
          icon={<Calendar className="h-7 w-7" />}
          label="最近联系"
          value={d.lastContactedAt.slice(0, 10)}
        />
      </div>

      {/* 最新沟通胶囊卡 */}
      <RecentCommsCapsule
        targetKind="contact"
        targetId={`${e.id}:${d.idx}`}
        targetName={c.name}
      />

      {/* 基本信息 */}
      <Section icon={<Info className="h-4 w-4" />} title="基本信息">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-5">
          <Field label="姓名"><span className="capitalize">{c.name}</span></Field>
          <Field label="职位">
            <MaskedField
              targetKind="contact"
              targetId={`${e.id}:${d.idx}`}
              targetName={c.name}
              parentRef={{ id: e.id, name: e.name }}
              field="title"
              value={c.title}
            />
          </Field>
          <Field label="所在部门">{d.department}</Field>
          <Field label="职级">
            <MaskedField
              targetKind="contact"
              targetId={`${e.id}:${d.idx}`}
              targetName={c.name}
              parentRef={{ id: e.id, name: e.name }}
              field="seniority"
              value={d.seniority}
            />
          </Field>
          <Field label="任职年限">
            <span className="tabular-nums">{d.tenureYears} 年</span>
          </Field>
          <Field label="入职时间">
            <span className="font-mono tabular-nums">{d.joinedAt}</span>
          </Field>
          <Field label="工作语言">
            <span className="inline-flex items-center gap-1.5">
              <Languages className="h-3.5 w-3.5 text-muted-foreground" />
              {d.language}
            </span>
          </Field>
          <Field label="时区">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              {d.timezone}
            </span>
          </Field>
        </div>
        <div className="mt-5 pt-5 border-t">
          <div className="text-xs text-muted-foreground mb-2">人物简介</div>
          <p className="text-sm text-foreground/80 leading-relaxed">{d.bio}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {d.tags.map((t) => (
              <Badge
                key={t}
                variant="secondary"
                className="bg-primary/10 text-primary border-primary/20"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                {t}
              </Badge>
            ))}
          </div>
        </div>
      </Section>

      {/* 联系方式 */}
      <Section icon={<Mail className="h-4 w-4" />} title="联系方式">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
          <Field label="邮箱">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <MaskedField
                  targetKind="contact"
                  targetId={`${e.id}:${d.idx}`}
                  targetName={c.name}
                  parentRef={{ id: e.id, name: e.name }}
                  field="email"
                  value={c.email}
                  mono
                />
              </span>
            </div>
          </Field>
          <Field label="电话">
            {c.phone ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <MaskedField
                    targetKind="contact"
                    targetId={`${e.id}:${d.idx}`}
                    targetName={c.name}
                    parentRef={{ id: e.id, name: e.name }}
                    field="phone"
                    value={c.phone}
                    mono
                  />
                </span>
                <WhatsAppReachButton
                  targetKind="contact"
                  targetId={`${e.id}:${d.idx}`}
                  targetName={c.name}
                  parentRef={{ id: e.id, name: e.name }}
                  phone={c.phone}
                />
              </div>
            ) : (
              <span className="italic text-muted-foreground">未提供</span>
            )}
          </Field>
          <Field label="LinkedIn">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <Linkedin className="h-3.5 w-3.5 text-[#0a66c2]" />
                <MaskedField
                  targetKind="contact"
                  targetId={`${e.id}:${d.idx}`}
                  targetName={c.name}
                  parentRef={{ id: e.id, name: e.name }}
                  field="social"
                  subKey="LinkedIn"
                  value={d.linkedin}
                  mono
                />
              </span>
            </div>
          </Field>
          <Field label="Twitter">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <Twitter className="h-3.5 w-3.5 text-muted-foreground" />
                <MaskedField
                  targetKind="contact"
                  targetId={`${e.id}:${d.idx}`}
                  targetName={c.name}
                  parentRef={{ id: e.id, name: e.name }}
                  field="social"
                  subKey="Twitter"
                  value={d.twitter}
                  mono
                />
              </span>
            </div>
          </Field>
          <Field label="WhatsApp">
            {c.whatsapp ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5 text-[#25d366]" />
                  <MaskedField
                    targetKind="contact"
                    targetId={`${e.id}:${d.idx}`}
                    targetName={c.name}
                    parentRef={{ id: e.id, name: e.name }}
                    field="social"
                    subKey="WhatsApp"
                    value={c.whatsapp}
                    mono
                  />
                </span>
              </div>
            ) : (
              <span className="italic text-muted-foreground">未提供</span>
            )}
          </Field>
        </div>
      </Section>

      {/* 所属企业 */}
      <Section icon={<Building2 className="h-4 w-4" />} title="所属企业">
        <Link
          to="/outreach/enterprise/$id"
          params={{ id: e.id }}
          className="block rounded-lg ring-1 ring-border bg-gradient-to-r from-primary/5 to-transparent p-5 hover:ring-primary/30 transition-shadow"
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-foreground truncate">{e.name}</div>
              <div className="mt-1 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                {e.industry && (
                  <span className="inline-flex items-center gap-1">
                    <Briefcase className="h-3 w-3" />
                    {e.industry}
                  </span>
                )}
                {e.country && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {e.province}
                    {` · ${e.country}`}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {e.website}
                </span>
                <Badge
                  variant="secondary"
                  className="bg-primary/10 text-primary border-primary/20"
                >
                  {e.tradeRole}
                </Badge>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
          </div>
        </Link>

        {/* 同企业其他联系人 */}
        {e.contacts.length > 1 && (
          <div className="mt-5">
            <div className="flex items-center gap-2 text-sm font-medium mb-3 text-muted-foreground">
              <Users className="h-4 w-4" />
              同企业其他联系人
              <span className="font-normal">（{e.contacts.length - 1}）</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {e.contacts.map((other, oIdx) => {
                if (oIdx === d.idx) return null;
                return (
                  <Link
                    key={oIdx}
                    to="/outreach/enterprise/$id/contact/$idx"
                    params={{ id: e.id, idx: String(oIdx) }}
                    className="rounded-lg border border-border bg-card hover:ring-1 hover:ring-primary/30 transition-shadow p-3 flex items-center gap-3"
                  >
                    <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-medium uppercase shrink-0">
                      {other.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate capitalize">{other.name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        <MaskedField
                          targetKind="contact"
                          targetId={`${e.id}:${oIdx}`}
                          targetName={other.name}
                          parentRef={{ id: e.id, name: e.name }}
                          field="title"
                          value={other.title}
                        />
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </Section>

      {/* 活动记录 */}
      <Section icon={<Clock className="h-4 w-4" />} title="活动记录" subtitle={`近 ${d.activities.length} 条动态`}>
        <ol className="relative border-l border-border ml-2 space-y-5 pl-5">
          {d.activities.map((a, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-primary/15" />
              <div className="flex items-center gap-2 text-sm">
                <Badge
                  variant="secondary"
                  className="bg-primary/10 text-primary border-primary/20"
                >
                  {a.type}
                </Badge>
                <span className="font-medium truncate">{a.title}</span>
              </div>
              <div className="mt-1 text-xs font-mono tabular-nums text-muted-foreground">
                {a.at}
              </div>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 pb-4 mb-5 border-b border-border/70">
        <span className="text-primary">{icon}</span>
        <h2 className="text-base font-semibold text-primary">{title}</h2>
        {subtitle && (
          <span className="text-xs text-muted-foreground">（{subtitle}）</span>
        )}
      </div>
      {children}
    </Card>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="text-sm font-medium text-foreground break-all">{children}</div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  unit?: string;
}) {
  return (
    <div className="rounded-xl ring-1 ring-border bg-gradient-to-br from-primary/5 to-transparent p-5 flex items-center gap-4">
      <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tabular-nums">{value}</span>
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
      </div>
    </div>
  );
}