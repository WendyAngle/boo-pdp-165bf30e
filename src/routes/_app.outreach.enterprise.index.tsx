import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  ChevronRight,
  Search,
  SlidersHorizontal,
  Briefcase,
  MapPin,
  Linkedin,
  Facebook,
  Twitter,
  MessageCircle,
  RotateCcw,
  X as XIcon,
  Hash,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListPagination } from "@/components/ListPagination";
import heroBg from "@/assets/enterprise-hero.jpg";
import { ENTERPRISES } from "@/data/enterprises";
import { FavoriteToggle } from "@/components/FavoriteToggle";
import { useUnlockedContacts } from "@/lib/unlocked-contacts";


export const Route = createFileRoute("/_app/outreach/enterprise/")({
  head: () => ({ meta: [{ title: "出海大数据平台 · 企业 | 出海大数据平台" }] }),
  validateSearch: (s: Record<string, unknown>): { hs?: string; product?: string; q?: string; role?: "进口" | "出口" } => ({
    hs: typeof s.hs === "string" ? s.hs : undefined,
    product: typeof s.product === "string" ? s.product : undefined,
    q: typeof s.q === "string" ? s.q : undefined,
    role:
      s.role === "进口" || s.role === "出口"
        ? (s.role as "进口" | "出口")
        : undefined,
  }),
  component: OutreachEnterprisePage,
});

const INDUSTRIES = [
  "higher education",
  "marketing and advertising",
  "information technology",
  "financial services",
  "manufacturing",
  "retail",
  "logistics",
  "healthcare",
];
const COUNTRIES = [
  "united states",
  "china",
  "japan",
  "germany",
  "united kingdom",
  "mexico",
  "singapore",
  "france",
];
const EMPLOYEE_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5000+"];

function OutreachEnterprisePage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const { hs, product, role, q } = search;
  const hasScenario = !!(hs || product || role);

  const [keyword, setKeyword] = useState(q ?? "");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [industry, setIndustry] = useState("all");
  const [country, setCountry] = useState("all");
  const [employees, setEmployees] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return ENTERPRISES.filter((e) => {
      if (k && !e.name.toLowerCase().includes(k)) return false;
      if (industry !== "all" && e.industry !== industry) return false;
      if (country !== "all" && e.country !== country) return false;
      if (employees !== "all" && e.employees !== employees) return false;
      if (role === "进口" && e.tradeRole === "出口商") return false;
      if (role === "出口" && e.tradeRole === "进口商") return false;
      return true;
    });
  }, [keyword, industry, country, employees, role]);

  const total = filtered.length;
  const pageData = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page],
  );

  const unlockedList = useUnlockedContacts();
  const unlockedEnterpriseIds = useMemo(() => {
    const s = new Set<string>();
    for (const u of unlockedList) {
      if (u.owner_type === "enterprise") s.add(u.owner_id);
      if (u.parent_ref?.id) s.add(u.parent_ref.id);
    }
    return s;
  }, [unlockedList]);



  const resetFilters = () => {
    setIndustry("all");
    setCountry("all");
    setEmployees("all");
    setPage(1);
  };

  const activeFilterCount =
    (industry !== "all" ? 1 : 0) +
    (country !== "all" ? 1 : 0) +
    (employees !== "all" ? 1 : 0);

  const clearScenario = () => {
    navigate({ to: "/outreach/enterprise", search: {} });
    setPage(1);
  };
  const removeScenarioKey = (k: "hs" | "product" | "role") => {
    navigate({
      to: "/outreach/enterprise",
      search: { ...search, [k]: undefined },
    });
    setPage(1);
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>出海大数据平台</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">企业</span>
      </div>

      <section className="relative overflow-hidden rounded-2xl ring-1 ring-border">
        <img
          src={heroBg}
          alt="企业"
          width={1920}
          height={512}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(184_70%_42%/0.92)] via-[hsl(184_60%_55%/0.55)] to-transparent" />
        <div className="relative px-8 py-10 flex items-center gap-5 text-white">
          <div className="h-14 w-14 rounded-2xl bg-white/25 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/30">
            <Building2 className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wide">企业</h1>
            <p className="text-white/90 text-sm mt-1">
              管理触达客户企业库，支持按名称模糊检索与多维度高级筛选
            </p>
          </div>
        </div>
      </section>

      <Card className="p-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            placeholder="输入企业名称进行搜索..."
            className="pl-9 h-10 border-0 shadow-none focus-visible:ring-0 bg-transparent"
          />
        </div>
        <Button
          onClick={() => setAdvancedOpen((s) => !s)}
          className="gap-1.5 h-10 px-4"
          variant={advancedOpen ? "secondary" : "default"}
        >
          <Search className="h-4 w-4" />
          搜索
          {activeFilterCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 h-5 min-w-5 px-1.5 bg-white text-primary"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </Card>

      {hasScenario && (
        <Card className="p-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground shrink-0">筛选场景：</span>
          {product && (
            <ScenarioChip
              icon={<Package className="h-3.5 w-3.5" />}
              tone="primary"
              onRemove={() => removeScenarioKey("product")}
            >
              {product}
            </ScenarioChip>
          )}
          {hs && (
            <ScenarioChip
              icon={<Hash className="h-3.5 w-3.5" />}
              tone="primary"
              onRemove={() => removeScenarioKey("hs")}
            >
              <span className="font-mono">{hs}</span>
            </ScenarioChip>
          )}
          {role && (
            <ScenarioChip
              icon={
                role === "进口" ? (
                  <ArrowDownToLine className="h-3.5 w-3.5" />
                ) : (
                  <ArrowUpFromLine className="h-3.5 w-3.5" />
                )
              }
              tone="accent"
              onRemove={() => removeScenarioKey("role")}
            >
              {role}
            </ScenarioChip>
          )}
          <button
            type="button"
            onClick={clearScenario}
            className="ml-auto text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            <XIcon className="h-3.5 w-3.5" />
            清除筛选
          </button>
        </Card>
      )}

      {advancedOpen && (
        <Card className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">行业</Label>
              <Select
                value={industry}
                onValueChange={(v) => {
                  setIndustry(v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部行业</SelectItem>
                  {INDUSTRIES.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">国家 / 地区</Label>
              <Select
                value={country}
                onValueChange={(v) => {
                  setCountry(v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部国家 / 地区</SelectItem>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">员工规模</Label>
              <Select
                value={employees}
                onValueChange={(v) => {
                  setEmployees(v);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部规模</SelectItem>
                  {EMPLOYEE_SIZES.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={resetFilters} className="gap-1.5">
              <RotateCcw className="h-4 w-4" />
              重置筛选
            </Button>
          </div>
        </Card>
      )}

      <div className="text-sm text-muted-foreground">
        共找到 <span className="font-semibold text-foreground">{total}</span> 家企业
      </div>

      {pageData.length === 0 ? (
        <Card className="p-16 text-center text-muted-foreground">
          没有符合条件的企业
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {pageData.map((e) => (
            <Link
              key={e.id}
              to="/outreach/enterprise/$id"
              params={{ id: e.id }}
              className="group text-left block"
            >
              <Card className="p-5 h-full ring-1 ring-border hover:ring-primary/40 hover:shadow-md transition-all">
                <div className="flex items-start justify-between">
                  <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/20">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <FavoriteToggle
                    kind="enterprise"
                    refId={e.id}
                    payload={{
                      title: e.name,
                      subtitle: e.industry || undefined,
                      meta: {
                        country: e.country || "",
                        role: e.tradeRole,
                        est: e.est,
                      },
                    }}
                    variant="inline"
                  />
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {e.name}
                    </div>
                    {unlockedEnterpriseIds.has(e.id) && (
                      <Badge
                        variant="secondary"
                        className="shrink-0 h-5 px-1.5 text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      >
                        已解锁
                      </Badge>
                    )}
                  </div>

                  {e.industry && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Briefcase className="h-4 w-4 shrink-0" />
                      <span className="truncate">{e.industry}</span>
                    </div>
                  )}
                  {(e.country || e.est) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {e.country && <MapPin className="h-4 w-4 shrink-0" />}
                      {e.country && (
                        <span className="flex-1 truncate">{e.country}</span>
                      )}
                      {e.est && (
                        <span className="font-medium text-foreground/80 tabular-nums whitespace-nowrap ml-auto">
                          est. {e.est}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-3 border-t flex items-center gap-2 text-xs text-muted-foreground">
                  <SocialBadge active={e.socials.linkedin} kind="linkedin" />
                  <SocialBadge active={e.socials.facebook} kind="facebook" />
                  <SocialBadge active={e.socials.twitter} kind="twitter" />
                  <SocialBadge active={e.socials.whatsapp} kind="whatsapp" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <ListPagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
      />
    </div>
  );
}

function SocialBadge({
  active,
  kind,
}: {
  active: boolean;
  kind: "linkedin" | "facebook" | "twitter" | "whatsapp";
}) {
  const Icon =
    kind === "linkedin"
      ? Linkedin
      : kind === "facebook"
        ? Facebook
        : kind === "whatsapp"
          ? MessageCircle
          : Twitter;
  const color =
    kind === "linkedin"
      ? "bg-[#0a66c2] text-white"
      : kind === "facebook"
        ? "bg-[#1877f2] text-white"
        : kind === "whatsapp"
          ? "bg-[#25d366] text-white"
          : "bg-foreground text-background";
  return (
    <span
      className={`inline-flex items-center justify-center h-6 w-6 rounded ${
        active ? color : "bg-muted text-muted-foreground/60"
      }`}
      aria-label={kind}
    >
      <Icon className="h-3 w-3" />
    </span>
  );
}

function ScenarioChip({
  children,
  icon,
  tone,
  onRemove,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  tone: "primary" | "accent";
  onRemove: () => void;
}) {
  const styles =
    tone === "primary"
      ? "bg-primary/10 text-primary"
      : "bg-amber-100 text-amber-700";
  return (
    <span
      className={`inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-xs font-medium ${styles}`}
    >
      {icon}
      {children}
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex items-center justify-center h-4 w-4 rounded-full hover:bg-black/10"
        aria-label="移除"
      >
        <XIcon className="h-3 w-3" />
      </button>
    </span>
  );
}