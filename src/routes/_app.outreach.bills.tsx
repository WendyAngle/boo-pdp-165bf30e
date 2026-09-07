import { useMemo, useState, Fragment } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  FileText,
  ChevronRight,
  ChevronDown,
  SlidersHorizontal,
  ExternalLink,
  X,
  Search,
  Calendar,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import heroBg from "@/assets/bills-hero.jpg";
import { ENTERPRISES } from "@/data/enterprises";
import { FavoriteToggle } from "@/components/FavoriteToggle";

export const Route = createFileRoute("/_app/outreach/bills")({
  head: () => ({ meta: [{ title: "出海大数据平台 · 提单 | 出海大数据平台" }] }),
  component: BillsPage,
});

// ---------- Mock data generation ----------
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// HS6 编码与产品描述强绑定：一个 HS 只能配套语义匹配的商品描述，
// 避免出现「691010 陶瓷餐具 → CNC ALUMINUM PART」这种演示级硬伤。
const HS_ITEMS: { hs: string; descs: string[] }[] = [
  { hs: "390799", descs: ["POLYESTER RESIN CHIPS BOTTLE GRADE", "PET PREFORM 28MM 25G CLEAR"] },
  { hs: "081120", descs: ["FROZEN BLACKBERRIES IQF 10KG BULK", "IQF RASPBERRY WHOLE FRUIT 5KG"] },
  { hs: "081190", descs: ["ORGANIC FROZEN MIXED BERRIES", "FROZEN STRAWBERRY PUREE 20KG DRUM"] },
  { hs: "843820", descs: ["INDUSTRIAL CHOCOLATE MOULDING LINE", "COMMERCIAL CONFECTIONERY DEPOSITOR"] },
  { hs: "081110", descs: ["FROZEN WHOLE STRAWBERRY GRADE A", "STRAWBERRY IQF SLICED 10KG"] },
  { hs: "262060", descs: ["ZINC ASH RESIDUE FOR RECYCLING", "GALVANIZING DROSS BULK"] },
  { hs: "853110", descs: ["WIRELESS BURGLAR ALARM PANEL KIT", "SMOKE DETECTOR PHOTOELECTRIC 9V"] },
  { hs: "902230", descs: ["MEDICAL X-RAY TUBE HEAD ASSEMBLY", "INDUSTRIAL NDT X-RAY GENERATOR"] },
  { hs: "480269", descs: ["UNCOATED WOODFREE PAPER 80GSM", "OFFSET PRINTING PAPER 70GSM ROLL"] },
  { hs: "392490", descs: ["PLASTIC HOUSEHOLD STORAGE BIN 20L", "PP KITCHEN COLANDER SET 3PC"] },
  { hs: "847290", descs: ["OFFICE PAPER SHREDDER CROSS CUT", "AUTOMATIC BANKNOTE COUNTER MACHINE"] },
  { hs: "732310", descs: ["STAINLESS STEEL SCOURING PAD 6PK", "STEEL WOOL ROLL GRADE 000"] },
  { hs: "852692", descs: ["AUTOMOTIVE KEYLESS ENTRY REMOTE", "REMOTE CONTROL RECEIVER 433MHZ"] },
  { hs: "841490", descs: ["CENTRIFUGAL FAN IMPELLER SPARE PART", "COMPRESSOR CYLINDER HEAD ASSY"] },
  { hs: "840610", descs: ["MARINE STEAM TURBINE 5MW", "SHIP PROPULSION TURBINE ROTOR"] },
  { hs: "853922", descs: ["LED FILAMENT BULB E27 6W WARM", "LED COB DOWNLIGHT 12W WARM WHITE"] },
  { hs: "190430", descs: ["BULGUR WHEAT COARSE GRAIN 1KG", "PARBOILED CRACKED WHEAT 500G"] },
  { hs: "250425", descs: ["NATURAL FLAKE GRAPHITE 94% PURITY", "CRYSTALLINE GRAPHITE POWDER +100"] },
  { hs: "920930", descs: ["ACOUSTIC GUITAR STEEL STRING SET", "ELECTRIC GUITAR NICKEL WOUND 010"] },
  { hs: "282410", descs: ["LEAD MONOXIDE LITHARGE 99.5%", "BATTERY GRADE PBO POWDER"] },
  { hs: "480525", descs: ["KRAFT LINER PAPER 175GSM ROLL", "TESTLINER BROWN 140GSM REEL"] },
  { hs: "401035", descs: ["ENDLESS SYNCHRONOUS RUBBER BELT", "TIMING BELT HTD 8M INDUSTRIAL"] },
  { hs: "510620", descs: ["CARDED WOOL YARN 2/28NM BLENDED", "WOOL SLIVER TOP FOR SPINNING"] },
  { hs: "621600", descs: ["MENS COTTON WORK GLOVES SIZE L", "LEATHER PALM SAFETY GLOVES PAIR"] },
  { hs: "701810", descs: ["GLASS SEED BEADS 11/0 ASSORTED", "CZECH GLASS ROCAILLES 6/0 500G"] },
  { hs: "880521", descs: ["FLIGHT SIMULATOR FIXED BASE UNIT", "AVIATION TRAINING DEVICE FTD"] },
  { hs: "854012", descs: ["CRT DISPLAY TUBE MONOCHROME 14IN", "INDUSTRIAL MONITOR CRT REPLACEMENT"] },
  { hs: "900652", descs: ["FILM CAMERA 35MM POINT AND SHOOT", "SLR FILM CAMERA BODY MANUAL"] },
  { hs: "846711", descs: ["PNEUMATIC IMPACT WRENCH 1/2 INCH", "AIR RATCHET WRENCH ROTARY TOOL"] },
  { hs: "691010", descs: ["CERAMIC WASH BASIN WHITE GLAZED", "PORCELAIN TOILET BOWL ONE PIECE"] },
];
const HS_CODES: string[] = HS_ITEMS.map((it) => it.hs);

const EXPORTER_COMPANIES = [
  { name: "WENZHOU SUNRISE TEXTILE CO LTD", country: "china" },
  { name: "FRUTICOLA OLMUE S.A.", country: "chile" },
  { name: "LOTUS GOURMET FOODS JSC", country: "vietnam" },
  { name: "LA LOMA DEL VALLE EXPORT", country: "mexico" },
  { name: "ALL TIME EXPORTS PVT LTD", country: "india" },
  { name: "JUNGHEINRICH AG", country: "germany" },
  { name: "FRIUL INTAGLI INDUSTRIES SPA", country: "italy" },
  { name: "BTC MOLDOVA TAIPEI BRANCH", country: "taiwan" },
  { name: "GUANGZHOU FORTUNE METAL CO", country: "china" },
  { name: "SHANGHAI HEMA ELECTRONICS LTD", country: "china" },
  { name: "ANHUI HUAMING MACHINERY", country: "china" },
  { name: "VIETNAM PHU HUNG SEAFOOD", country: "vietnam" },
  { name: "EXPORTADORA SUBSOLE S.A.", country: "chile" },
  { name: "NINGBO POLY HARDWARE TRADING", country: "china" },
  { name: "SHENZHEN AURORA OPTOELECTRONIC", country: "china" },
];

const IMPORTER_COMPANIES = [
  { name: "HEWORTH IMPORTERS LLC", country: "united states" },
  { name: "NATURES TOUCH FROZEN FOODS US", country: "united states" },
  { name: "SAMS F&B IMPORT CORP", country: "united states" },
  { name: "BIOMAC USA INC", country: "united states" },
  { name: "IKEA SUPPLY AG", country: "united states" },
  { name: "DOLE FRESH FRUIT COMPANY", country: "united states" },
  { name: "LG ELECTRONICS USA INC", country: "united states" },
  { name: "GLOBAL ETRADE SERVICES", country: "united states" },
  { name: "WALMART INC", country: "united states" },
  { name: "NIKE USA INC", country: "united states" },
  { name: "CRIMSONLOGIC USA INC", country: "united states" },
  { name: "SAMSUNG ELECTRONICS AMERICA", country: "united states" },
  { name: "ADVANCED LOGISTICS GROUP", country: "united states" },
  { name: "HOME DEPOT USA INC", country: "united states" },
  { name: "BEST BUY PURCHASING LLC", country: "united states" },
];

const PORTS_FROM = [
  ["57035", "SHANGHAI"],
  ["22518", "CRISTOBAL"],
  ["55200", "PORT REDON"],
  ["71425", "TANGER"],
  ["23645", "SOUTH RIDING POINT"],
  ["47527", "GENOA"],
  ["47031", "ALGECIRAS"],
  ["58304", "TAIPEI"],
  ["57078", "NINGBO"],
  ["57047", "YANTIAN"],
  ["57011", "QINGDAO"],
  ["44719", "HAMBURG"],
];

const PORTS_TO = [
  ["2704", "LOS ANGELES, CA"],
  ["1303", "BALTIMORE, MD"],
  ["5301", "HOUSTON, TX"],
  ["1803", "JACKSONVILLE, FL"],
  ["4601", "NEW YORK/NEWARK AREA, NEWARK, NJ"],
  ["2709", "LONG BEACH, CA"],
  ["2002", "SAVANNAH, GA"],
  ["3001", "SEATTLE, WA"],
];

interface BillDetail {
  id: string;
  date: string;
  hs: string;
  exporter: { name: string; country: string } | null;
  importer: { name: string; country: string };
  desc: string;
  fromPort: { code: string; name: string };
  toPort: { code: string; name: string };
  weight: number; // 吨
}

function genDate(seed: number) {
  // 2025-09-01 ~ 2025-12-31 之间
  const start = new Date(2025, 8, 1).getTime();
  const end = new Date(2025, 11, 31).getTime();
  const t = start + (seed % 1_000_000) * 1000 * 60 * 17;
  const d = new Date(Math.min(end, t));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const ALL_BILLS: BillDetail[] = Array.from({ length: 220 }, (_, i) => {
  const seed = hash(`bill-${i}`);
  const item = HS_ITEMS[seed % HS_ITEMS.length];
  const hs = item.hs;
  const desc = item.descs[(seed >> 7) % item.descs.length];
  const exp =
    seed % 9 === 0
      ? null // 偶发缺失出口企业 (与原型截图一致)
      : EXPORTER_COMPANIES[(seed >> 3) % EXPORTER_COMPANIES.length];
  const imp = IMPORTER_COMPANIES[(seed >> 5) % IMPORTER_COMPANIES.length];
  const fp = PORTS_FROM[(seed >> 9) % PORTS_FROM.length];
  const tp = PORTS_TO[(seed >> 11) % PORTS_TO.length];
  const weight = 5 + ((seed >> 4) % 480);
  return {
    id: `BL${(1000000 + i).toString()}`,
    date: genDate(seed),
    hs,
    exporter: exp,
    importer: imp,
    desc,
    fromPort: { code: fp[0], name: fp[1] },
    toPort: { code: tp[0], name: tp[1] },
    weight,
  };
}).sort((a, b) => (a.date < b.date ? 1 : -1));

// ---------- Summary aggregation ----------
type Dim = "importer" | "exporter" | "hs";

interface SummaryRow {
  key: string;
  title: string;
  subtitle?: string;
  country?: string;
  hsCodes: string[];
  countries: string[];
  count: number;
  weight: number; // 吨
  bills: BillDetail[];
}

function buildSummary(dim: Dim): SummaryRow[] {
  const map = new Map<string, SummaryRow>();
  for (const b of ALL_BILLS) {
    let key = "";
    let title = "";
    let country: string | undefined;
    if (dim === "importer") {
      key = b.importer.name;
      title = b.importer.name;
      country = b.importer.country;
    } else if (dim === "exporter") {
      if (!b.exporter) continue;
      key = b.exporter.name;
      title = b.exporter.name;
      country = b.exporter.country;
    } else {
      key = b.hs;
      title = b.hs;
    }
    let row = map.get(key);
    if (!row) {
      row = {
        key,
        title,
        country,
        hsCodes: [],
        countries: [],
        count: 0,
        weight: 0,
        bills: [],
      };
      map.set(key, row);
    }
    if (!row.hsCodes.includes(b.hs)) row.hsCodes.push(b.hs);
    const otherCountry =
      dim === "importer"
        ? b.exporter?.country
        : dim === "exporter"
          ? b.importer.country
          : b.importer.country;
    if (otherCountry && !row.countries.includes(otherCountry)) {
      row.countries.push(otherCountry);
    }
    row.count += 1;
    row.weight += b.weight;
    row.bills.push(b);
  }
  // Inflate counts to look like real-world summary data
  return Array.from(map.values())
    .map((r) => ({
      ...r,
      // 显示放大值,保持原型截图的量级
      count: r.count * (1500 + (hash(r.key) % 4500)),
      weight: Math.round(r.weight * (200 + (hash(r.key + "w") % 800)) / 10) / 10,
    }))
    .sort((a, b) => b.count - a.count);
}

function findEnterpriseId(name: string): string | null {
  const seed = hash(name);
  return ENTERPRISES[seed % ENTERPRISES.length]?.id ?? null;
}

function shortenName(s: string, n = 14) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function formatWeight(t: number) {
  if (t >= 10000) return `${(t / 10000).toFixed(2)}万吨`;
  return `${t.toLocaleString()}吨`;
}

// ---------- Page ----------
function BillsPage() {
  const [tab, setTab] = useState<"detail" | "summary">("detail");
  const [dim, setDim] = useState<Dim>("importer");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [filterHs, setFilterHs] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const filteredBills = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return ALL_BILLS.filter((b) => {
      if (filterHs && !b.hs.startsWith(filterHs)) return false;
      if (filterFrom && b.date < filterFrom) return false;
      if (filterTo && b.date > filterTo) return false;
      if (!k) return true;
      return (
        b.hs.includes(k) ||
        b.desc.toLowerCase().includes(k) ||
        b.exporter?.name.toLowerCase().includes(k) ||
        b.importer.name.toLowerCase().includes(k) ||
        b.fromPort.name.toLowerCase().includes(k) ||
        b.toPort.name.toLowerCase().includes(k)
      );
    });
  }, [keyword, filterHs, filterFrom, filterTo]);

  const summary = useMemo(() => buildSummary(dim), [dim]);

  const filteredSummary = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    if (!k) return summary;
    return summary.filter(
      (r) =>
        r.title.toLowerCase().includes(k) ||
        r.hsCodes.some((h) => h.includes(k)),
    );
  }, [summary, keyword]);

  const totalGroups = filteredSummary.length;
  const totalBills = filteredBills.length;

  const clearFilters = () => {
    setKeyword("");
    setFilterHs("");
    setFilterFrom("");
    setFilterTo("");
  };

  const hasFilter = !!(keyword || filterHs || filterFrom || filterTo);

  return (
    <div className="p-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span>出海大数据平台</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">提单</span>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl ring-1 ring-border">
        <img
          src={heroBg}
          alt="提单分析"
          width={1920}
          height={512}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(184_70%_42%/0.92)] via-[hsl(184_60%_55%/0.55)] to-transparent" />
        <div className="relative px-8 py-9 flex items-center gap-5 text-white">
          <div className="h-14 w-14 rounded-2xl bg-white/25 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/30">
            <FileText className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-wide">提单分析</h1>
            <p className="text-white/90 text-sm mt-1 max-w-3xl">
              基于全球提单数据，穿透各国实际进出口动态，识别真实流通路径与交易主体
            </p>
          </div>
        </div>
      </section>

      {/* Tabs + advanced */}
      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 pt-3">
          <div className="flex items-center gap-1">
            <TabBtn active={tab === "detail"} onClick={() => setTab("detail")}>
              <FileText className="h-4 w-4" />
              提单明细
            </TabBtn>
            <TabBtn active={tab === "summary"} onClick={() => setTab("summary")}>
              <SummaryIcon />
              提单汇总
            </TabBtn>
          </div>
          <Button
            variant={advancedOpen ? "default" : "outline"}
            size="sm"
            className="gap-1.5 mb-2"
            onClick={() => setAdvancedOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            高级搜索
          </Button>
        </div>

        {/* Filter row */}
        <div className="px-5 py-3 flex items-center gap-3 flex-wrap border-b border-border bg-muted/20">
          {tab === "summary" && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">汇总维度</span>
              <Select value={dim} onValueChange={(v) => setDim(v as Dim)}>
                <SelectTrigger className="h-9 w-[160px] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="importer">按进口企业</SelectItem>
                  <SelectItem value="exporter">按出口企业</SelectItem>
                  <SelectItem value="hs">按 HS Code</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="输入企业名 / HS / 产品描述 / 港口"
              className="pl-9 h-9 bg-background"
            />
          </div>
          {hasFilter && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
              <X className="h-3.5 w-3.5" />
              清除
            </Button>
          )}
          <div className="text-sm text-muted-foreground ml-auto">
            {tab === "detail" ? (
              <>共 <span className="text-foreground font-semibold">{totalBills.toLocaleString()}</span> 条</>
            ) : (
              <>共 <span className="text-foreground font-semibold">{(10_400_518).toLocaleString()}</span> 组</>
            )}
          </div>
        </div>

        {tab === "detail" ? (
          <DetailTable rows={filteredBills.slice(0, 80)} />
        ) : (
          <SummaryTable rows={filteredSummary.slice(0, 30)} dim={dim} />
        )}
      </Card>

      {/* Advanced search sheet */}
      <Sheet open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <SheetContent className="w-[420px] sm:w-[480px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              高级搜索
            </SheetTitle>
            <SheetDescription>组合多个条件以精准定位提单</SheetDescription>
          </SheetHeader>
          <div className="py-5 space-y-4">
            <Field label="关键词">
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="企业名 / 产品描述 / 港口"
              />
            </Field>
            <Field label="HS 前缀">
              <Input
                value={filterHs}
                onChange={(e) => setFilterHs(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="如 0811 或 081120"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="起始日期">
                <div className="relative">
                  <Calendar className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="date"
                    value={filterFrom}
                    onChange={(e) => setFilterFrom(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </Field>
              <Field label="截止日期">
                <div className="relative">
                  <Calendar className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="date"
                    value={filterTo}
                    onChange={(e) => setFilterTo(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </Field>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={clearFilters}>重置</Button>
            <Button onClick={() => setAdvancedOpen(false)}>应用筛选</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function SummaryIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="9" y1="10" x2="9" y2="20" />
    </svg>
  );
}

// ---------- Detail table ----------
function DetailTable({ rows }: { rows: BillDetail[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-primary/5 hover:bg-primary/5">
            <TableHead className="w-[44px]"></TableHead>
            <TableHead className="w-[110px]">日期</TableHead>
            <TableHead className="w-[100px]">HS Code</TableHead>
            <TableHead className="w-[200px]">出口企业</TableHead>
            <TableHead className="w-[200px]">进口企业</TableHead>
            <TableHead>产品描述</TableHead>
            <TableHead className="w-[300px]">起运港 → 目的港</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b) => (
            <TableRow key={b.id} className="align-top">
              <TableCell className="py-4">
                <FavoriteToggle
                  kind="bill"
                  refId={b.id}
                  payload={{
                    title: b.id,
                    subtitle: b.desc,
                    meta: {
                      date: b.date,
                      hs: b.hs,
                      exporter: b.exporter?.name || "",
                      importer: b.importer.name,
                      fromPort: b.fromPort.name,
                      toPort: b.toPort.name,
                    },
                  }}
                  variant="inline"
                  size="sm"
                />
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground py-4">
                {b.date}
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground py-4">
                {b.hs}
              </TableCell>
              <TableCell className="py-4">
                <CompanyLink company={b.exporter} />
              </TableCell>
              <TableCell className="py-4">
                <CompanyLink company={b.importer} />
              </TableCell>
              <TableCell className="py-4 text-sm">
                <span className="truncate inline-block max-w-[280px] align-middle">
                  {b.desc}
                </span>
              </TableCell>
              <TableCell className="py-4 text-sm">
                <div className="flex items-center gap-2 text-foreground/80">
                  <span className="font-mono text-xs text-muted-foreground">{b.fromPort.code}</span>
                  <span>{b.fromPort.name}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-mono text-xs text-muted-foreground">{b.toPort.code}</span>
                  <span>{b.toPort.name}</span>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                没有匹配的提单
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function CompanyLink({ company }: { company: { name: string; country: string } | null }) {
  if (!company) {
    return <span className="text-muted-foreground">—</span>;
  }
  const id = findEnterpriseId(company.name);
  return (
    <div className="min-w-0">
      <Link
        to="/outreach/enterprise/$id"
        params={{ id: id ?? "ent-001" }}
        className="inline-flex items-center gap-1 text-primary hover:underline font-medium text-sm"
        title={company.name}
      >
        <span className="truncate max-w-[140px]">{shortenName(company.name, 14)}</span>
        <ExternalLink className="h-3 w-3 shrink-0" />
      </Link>
      <div className="text-xs text-muted-foreground mt-0.5">{company.country}</div>
    </div>
  );
}

// ---------- Summary table ----------
function SummaryTable({ rows, dim }: { rows: SummaryRow[]; dim: Dim }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setExpanded((s) => ({ ...s, [k]: !s[k] }));

  const mainColLabel =
    dim === "importer" ? "进口企业" : dim === "exporter" ? "出口企业" : "HS Code";

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-primary/5 hover:bg-primary/5">
            <TableHead className="w-[40px]"></TableHead>
            <TableHead className="w-[260px]">{mainColLabel}</TableHead>
            <TableHead className="w-[300px]">关联 HS Code</TableHead>
            <TableHead>涉及国家</TableHead>
            <TableHead className="w-[110px] text-right">提单数</TableHead>
            <TableHead className="w-[110px] text-right">总重量</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const open = !!expanded[r.key];
            const showHs = r.hsCodes.slice(0, 3);
            const moreHs = r.hsCodes.length - showHs.length;
            const showCountries = r.countries.slice(0, 3);
            const moreCountries = r.countries.length - showCountries.length;
            return (
              <Fragment key={r.key}>
                <TableRow className="align-top">
                  <TableCell className="py-4">
                    <button
                      onClick={() => toggle(r.key)}
                      className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-muted-foreground"
                      aria-label={open ? "收起" : "展开"}
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`}
                      />
                    </button>
                  </TableCell>
                  <TableCell className="py-4">
                    {dim === "hs" ? (
                      <Link
                        to="/outreach/products/$hs"
                        params={{ hs: r.title }}
                        className="font-mono text-sm text-primary hover:underline"
                      >
                        {r.title}
                      </Link>
                    ) : (
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => toggle(r.key)}
                            className="text-primary hover:underline font-medium text-sm text-left truncate max-w-[180px]"
                            title={r.title}
                          >
                            {shortenName(r.title, 18)}
                          </button>
                          <Link
                            to="/outreach/enterprise/$id"
                            params={{ id: findEnterpriseId(r.title) ?? "ent-001" }}
                            className="inline-flex items-center gap-0.5 text-xs text-primary/80 hover:text-primary px-1.5 py-0.5 rounded hover:bg-primary/10"
                          >
                            <ExternalLink className="h-3 w-3" />
                            详情
                          </Link>
                        </div>
                        {r.country && (
                          <div className="text-xs text-muted-foreground mt-0.5">{r.country}</div>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {showHs.map((h) => (
                        <Link
                          key={h}
                          to="/outreach/products/$hs"
                          params={{ hs: h }}
                          className="font-mono text-xs px-2 py-0.5 rounded-full bg-muted text-foreground/80 hover:bg-primary/10 hover:text-primary border border-border"
                        >
                          {h}
                        </Link>
                      ))}
                      {moreHs > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                          +{moreHs}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-4 text-sm text-foreground/80">
                    {showCountries.join(" / ")}
                    {moreCountries > 0 && <span className="text-muted-foreground"> +{moreCountries}</span>}
                  </TableCell>
                  <TableCell className="py-4 text-right font-mono text-sm">
                    {r.count.toLocaleString()}
                  </TableCell>
                  <TableCell className="py-4 text-right text-sm">
                    {formatWeight(r.weight)}
                  </TableCell>
                </TableRow>
                {open && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={6} className="bg-muted/30 p-0">
                      <div className="p-4">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-primary/80 hover:bg-primary/80 border-0">
                              <TableHead className="text-primary-foreground w-[44px]"></TableHead>
                              <TableHead className="text-primary-foreground w-[110px]">日期</TableHead>
                              <TableHead className="text-primary-foreground w-[90px]">HS</TableHead>
                              <TableHead className="text-primary-foreground w-[200px]">出口企业</TableHead>
                              <TableHead className="text-primary-foreground w-[200px]">进口企业</TableHead>
                              <TableHead className="text-primary-foreground">起运 → 目的地</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {r.bills.slice(0, 6).map((b) => (
                              <TableRow key={b.id}>
                                <TableCell>
                                  <FavoriteToggle
                                    kind="bill"
                                    refId={b.id}
                                    payload={{
                                      title: b.id,
                                      subtitle: b.desc,
                                      meta: {
                                        date: b.date,
                                        hs: b.hs,
                                        exporter: b.exporter?.name || "",
                                        importer: b.importer.name,
                                        fromPort: b.fromPort.name,
                                        toPort: b.toPort.name,
                                      },
                                    }}
                                    variant="inline"
                                    size="sm"
                                  />
                                </TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">{b.date}</TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">{b.hs}</TableCell>
                                <TableCell>
                                  <CompanyLink company={b.exporter} />
                                </TableCell>
                                <TableCell>
                                  <CompanyLink company={b.importer} />
                                </TableCell>
                                <TableCell className="text-sm">
                                  <div className="flex items-center gap-2 text-foreground/80 flex-wrap">
                                    <span className="font-mono text-xs text-muted-foreground">{b.fromPort.code}</span>
                                    <span>{b.fromPort.name}</span>
                                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="font-mono text-xs text-muted-foreground">{b.toPort.code}</span>
                                    <span>{b.toPort.name}</span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                        {r.bills.length > 6 && (
                          <div className="text-xs text-muted-foreground mt-3 text-center">
                            仅显示前 6 条 · 共 {r.count.toLocaleString()} 条相关提单
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                没有匹配的汇总数据
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}