import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Search,
  Building2,
  Globe2,
  Users2,
  X as XIcon,
  TrendingUp,
  ChevronDown,
  Check,
  Lightbulb,
  FileText,
  MapPin,
  Star,
  ArrowLeft,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { detectCountries, detectRoles } from "@/lib/search-intent";


export const Route = createFileRoute("/_app/outreach/search")({
  head: () => ({
    meta: [
      { title: "商机线索 · 全球贸易搜索 | 出海大数据平台" },
      {
        name: "description",
        content:
          "按商品关键词、HS Code 或公司名称检索全球贸易商机，可筛选国家与进出口商角色，并在同页查看线索结果。",
      },
      { property: "og:title", content: "商机线索 · 全球贸易搜索" },
      {
        property: "og:description",
        content: "按商品关键词、HS Code 或公司名称检索全球贸易商机。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SearchPage,
});

/* ------------------------------- 本地最近搜索 ------------------------------- */
const RECENT_KEY = "boo:global-search:recent";
const RECENT_MAX = 8;

function loadRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return ["铝材", "钢材", "铝合金门窗", "apple", "850760 锂电池"];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function pushRecent(kw: string) {
  if (typeof window === "undefined") return;
  const k = kw.trim();
  if (!k) return;
  const cur = loadRecent().filter((x) => x !== k);
  cur.unshift(k);
  localStorage.setItem(RECENT_KEY, JSON.stringify(cur.slice(0, RECENT_MAX)));
}
function removeRecent(kw: string) {
  if (typeof window === "undefined") return;
  const cur = loadRecent().filter((x) => x !== kw);
  localStorage.setItem(RECENT_KEY, JSON.stringify(cur));
}
function clearRecent() {
  if (typeof window === "undefined") return;
  localStorage.setItem(RECENT_KEY, JSON.stringify([]));
}

/* ------------------------------- 热门搜索（mock） ------------------------------- */
const HOT_SEARCHES = ["花岗岩", "光伏组件", "新能源汽车", "锂电池", "680100", "germany"];

/* ------------------------------- 线索结果（mock） ------------------------------- */
const RESULTS = [
  { id: "1", name: "tesla", location: "suite 120, 9201 arboretum parkway, austin, texas, 78759, united states" },
  { id: "2", name: "motorola solutions", location: "500 west monroe street, chicago, illinois, 60661, united states" },
  { id: "3", name: "stanley black and decker", location: "1000 stanley drive, new britain, connecticut, 06053, united states" },
  { id: "4", name: "truper", location: "Mexico" },
  { id: "5", name: "vsun mobile", location: "Dubai, Dubai, United Arab Emirates" },
  { id: "6", name: "rx infotech", location: "New Delhi, Delhi, 110019, India" },
  { id: "7", name: "robert bosch power tools", location: "Suite A, Level 9; Wawasan Open ..." },
  { id: "8", name: "technocom systems", location: "India" },
  { id: "9", name: "electronica steren", location: "Biologo Maxilmino Martinez No. ..." },
  { id: "10", name: "padget electronics", location: "C-33, Noida Phase-II; Gautam Bu..." },
  { id: "11", name: "dell international services india pvt ltd", location: "India" },
  { id: "12", name: "samsung india electronics", location: "6TH FLOOR, DLF CENTRE SANSA..." },
  { id: "13", name: "byd electronics india", location: "kanchipuram, tamil nadu, india" },
  { id: "14", name: "samsung sdi energy malaysia sdn bhd", location: "Chamber E, Lian Seng Courts; No..." },
  { id: "15", name: "navitasys india", location: "Plot No. 32; Sector 5, Rewari, Har..." },
  { id: "16", name: "samsung electronics viet nam", location: "Vietnam" },
  { id: "17", name: "apple india", location: "19th FLOOR; Concorde Tower C, ..." },
  { id: "18", name: "neelkanth crockery emporium", location: "India" },
  { id: "19", name: "apple malaysia", location: "Level 21, Suite 21.01; The Garden..." },
  { id: "20", name: "samsung sdi viet nam", location: "Vietnam" },
];

/* ------------------------------- 国家列表 ------------------------------- */
const COUNTRIES = [
  "安道尔", "阿拉伯联合酋长国", "阿富汗", "安提瓜和巴布达", "安圭拉",
  "阿尔巴尼亚", "亚美尼亚", "库拉索", "安哥拉", "阿根廷", "奥地利",
  "澳大利亚", "巴西", "比利时", "加拿大", "瑞士", "智利", "中国",
  "哥伦比亚", "捷克", "德国", "丹麦", "埃及", "西班牙", "法国",
  "英国", "印度", "印度尼西亚", "意大利", "日本", "韩国", "墨西哥",
  "马来西亚", "荷兰", "尼日利亚", "菲律宾", "波兰", "葡萄牙", "俄罗斯",
  "沙特阿拉伯", "瑞典", "新加坡", "泰国", "土耳其", "美国", "越南", "南非",
];

const PLACEHOLDER = '请输入您要查找的内容，如"我想找德国做汽车配件的采购商"';


/* ------------------------------- 国家选择器（Popover 复用） ------------------------------- */
function CountryFilter({
  countries,
  setCountries,
  countryKw,
  setCountryKw,
  filteredCountries,
  align,
  children,
}: {
  countries: string[];
  setCountries: React.Dispatch<React.SetStateAction<string[]>>;
  countryKw: string;
  setCountryKw: (v: string) => void;
  filteredCountries: string[];
  align?: "start" | "end" | "center";
  children: React.ReactNode;
}) {
  const toggleCountry = (c: string) =>
    setCountries((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} className="w-[280px] p-0">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={countryKw}
              onChange={(e) => setCountryKw(e.target.value)}
              placeholder="搜索国家"
              className="h-9 pl-7 text-sm"
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {filteredCountries.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              无匹配国家
            </div>
          )}
          {filteredCountries.map((c) => {
            const checked = countries.includes(c);
            return (
              <button
                key={c}
                onClick={() => toggleCountry(c)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60"
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border ${
                    checked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-slate-300"
                  }`}
                >
                  {checked && <Check className="h-3 w-3" />}
                </span>
                <span className="truncate">{c}</span>
              </button>
            );
          })}
        </div>
        {countries.length > 0 && (
          <div className="flex items-center justify-between border-t px-3 py-2">
            <span className="text-xs text-muted-foreground">
              已选 {countries.length} 个
            </span>
            <button
              onClick={() => setCountries([])}
              className="text-xs text-primary hover:underline"
            >
              清空
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ============================== 页面 ============================== */
function SearchPage() {
  const [kw, setKw] = useState("");
  const [query, setQuery] = useState<string | null>(null); // null = 未搜索（首页态）
  const [countries, setCountries] = useState<string[]>([]);
  const [countryKw, setCountryKw] = useState("");
  const [importer, setImporter] = useState(true);
  const [exporter, setExporter] = useState(true);
  // 用户一旦手动调整筛选，则不再被自动匹配覆盖
  const countryTouched = useRef(false);
  const roleTouched = useRef(false);
  const [recentTick, setRecentTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  const recent = useMemo(() => loadRecent(), [recentTick]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 根据输入内容自动匹配国家 / 进出口商角色
  useEffect(() => {
    const text = kw.trim();
    if (!countryTouched.current) {
      const hit = detectCountries(text, COUNTRIES);
      setCountries((prev) =>
        prev.length === hit.length && prev.every((c, i) => c === hit[i]) ? prev : hit,
      );
    }
    if (!roleTouched.current) {
      const role = detectRoles(text);
      setImporter(role.importer);
      setExporter(role.exporter);
    }
  }, [kw]);


  const filteredCountries = useMemo(() => {
    const q = countryKw.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.toLowerCase().includes(q));
  }, [countryKw]);

  const countryLabel =
    countries.length === 0
      ? "全部国家"
      : countries.length === 1
        ? countries[0]
        : `已选 ${countries.length} 个国家`;

  const setCountriesManual: React.Dispatch<React.SetStateAction<string[]>> = (v) => {
    countryTouched.current = true;
    setCountries(v);
  };
  const setImporterManual = (v: boolean) => {
    roleTouched.current = true;
    setImporter(v);
  };
  const setExporterManual = (v: boolean) => {
    roleTouched.current = true;
    setExporter(v);
  };

  const toggleCountry = (c: string) =>
    setCountriesManual((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );


  const go = (keyword: string) => {
    const k = keyword.trim();
    if (!k) {
      toast.error("请输入搜索关键词");
      return;
    }
    if (!importer && !exporter) {
      toast.error("请至少选择进口商或出口商");
      return;
    }
    pushRecent(k);
    setRecentTick((n) => n + 1);
    setKw(k);
    setQuery(k);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      go(kw);
    }
  };

  const isResults = query !== null;

  const backToSearch = () => {
    setQuery(null);
    setKw("");
  };

  /* ---------- 复合搜索栏（两态共用） ---------- */
  const searchBar = (
    <div
      className={
        isResults
          ? "rounded-xl bg-white ring-1 ring-slate-200 shadow-sm focus-within:ring-primary/50 transition-all overflow-hidden"
          : "rounded-2xl bg-white shadow-[0_18px_60px_-20px_rgba(56,189,248,0.45)] ring-1 ring-white/80 focus-within:ring-primary/60 transition-all overflow-hidden"
      }
    >
      <div className={`flex items-center gap-1 px-2 ${isResults ? "h-14" : "h-16"}`}>
        <Search className="h-5 w-5 text-muted-foreground shrink-0 ml-3" />
        <Input
          ref={inputRef}
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={isResults ? "商品关键词或HS Code、公司名称等" : PLACEHOLDER}
          className="border-0 shadow-none focus-visible:ring-0 text-base h-12 px-2 placeholder:text-muted-foreground/70 flex-1 min-w-0"
        />
        {kw && (
          <button
            onClick={() => setKw("")}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted/60 shrink-0"
            aria-label="清空"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}

        {/* 桌面端过滤 */}
        <div className="hidden md:flex items-center shrink-0">
          <div className="h-6 w-px bg-slate-200 mx-1" />
          <CountryFilter
            countries={countries}
            setCountries={setCountriesManual}
            countryKw={countryKw}
            setCountryKw={setCountryKw}
            filteredCountries={filteredCountries}
            align="end"
          >
            <button className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors max-w-[160px]">
              <Globe2 className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate">{countryLabel}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          </CountryFilter>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          <label className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap">
            <Checkbox
              checked={importer}
              onCheckedChange={(v) => setImporterManual(v === true)}
            />
            进口商
          </label>
          <label className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap">
            <Checkbox
              checked={exporter}
              onCheckedChange={(v) => setExporterManual(v === true)}
            />
            出口商
          </label>

          <div className="h-6 w-px bg-slate-200 mx-1" />
        </div>

        <button
          onClick={() => go(kw)}
          className="inline-flex h-[calc(100%-10px)] items-center gap-2 rounded-xl bg-primary px-3 md:px-6 text-sm font-medium text-primary-foreground hover:bg-primary/90 shrink-0 mr-1"
        >
          <Search className="h-4 w-4" />
          <span className="hidden md:inline">搜索</span>
        </button>
      </div>

      {/* 移动端过滤行 */}
      <div className="md:hidden flex flex-col gap-2 px-4 py-3 border-t border-slate-100">
        <CountryFilter
          countries={countries}
          setCountries={setCountriesManual}
          countryKw={countryKw}
          setCountryKw={setCountryKw}
          filteredCountries={filteredCountries}
          align="start"
        >
          <button className="inline-flex h-10 w-full items-center justify-between rounded-lg bg-white px-3 text-sm text-slate-700 ring-1 ring-slate-200 hover:ring-primary/50 transition-colors">
            <span className="flex items-center gap-1.5 truncate">
              <Globe2 className="h-4 w-4 text-muted-foreground shrink-0" />
              {countryLabel}
            </span>
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        </CountryFilter>

        <div className="flex items-center gap-2">
          <label className="inline-flex flex-1 h-10 items-center justify-center gap-2 rounded-lg bg-white px-2 text-sm text-slate-700 ring-1 ring-slate-200 cursor-pointer whitespace-nowrap">
            <Checkbox
              checked={importer}
              onCheckedChange={(v) => setImporterManual(v === true)}
            />
            进口商
          </label>
          <label className="inline-flex flex-1 h-10 items-center justify-center gap-2 rounded-lg bg-white px-2 text-sm text-slate-700 ring-1 ring-slate-200 cursor-pointer whitespace-nowrap">
            <Checkbox
              checked={exporter}
              onCheckedChange={(v) => setExporterManual(v === true)}
            />
            出口商
          </label>
        </div>
      </div>
    </div>
  );

  const countryChips = countries.length > 0 && (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {countries.slice(0, 6).map((c) => (
        <Badge key={c} variant="secondary" className="gap-1 bg-primary/8 text-primary">
          {c}
          <XIcon className="h-3 w-3 cursor-pointer" onClick={() => toggleCountry(c)} />
        </Badge>
      ))}
      {countries.length > 6 && <Badge variant="secondary">+{countries.length - 6}</Badge>}
    </div>
  );

  /* ============================ 结果态 ============================ */
  if (isResults) {
    return (
      <div className="min-h-full bg-[#f6f8fb] p-4 sm:p-6 lg:p-8">
        {/* 面包屑 + 返回 */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>客户发现 /</span>
            <button onClick={backToSearch} className="text-foreground/80 hover:text-primary">
              商机线索
            </button>
            <span>/ 搜索结果</span>
          </div>
          <button
            onClick={backToSearch}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm text-slate-700 ring-1 ring-slate-200 shadow-sm hover:text-primary hover:ring-primary/40 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            返回搜索
          </button>
        </div>

        {/* 顶部横幅 */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-500 px-6 py-5 text-white shadow-md mb-6">
          <div className="relative z-10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                <Lightbulb className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">商机线索</h1>
                <p className="text-sm text-white/90">基于全球贸易数据，精准定位潜在客户</p>
              </div>
            </div>
            <button
              onClick={backToSearch}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 px-3 py-2 text-sm font-medium text-white ring-1 ring-white/40 hover:bg-white/30 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              返回搜索
            </button>
          </div>
          <div className="pointer-events-none absolute right-40 top-1/2 -translate-y-1/2 opacity-20">
            <Globe2 className="h-24 w-24 text-white" />
          </div>
        </div>


        {/* 搜索栏 */}
        <div className="mb-4">{searchBar}{countryChips}</div>

        {/* 结果说明 */}
        <div className="rounded-lg bg-cyan-50 px-4 py-3 text-sm text-cyan-700 mb-3">
          以下结果基于关键词「{query}」查询得到
          {countries.length > 0 ? `，国家：${countries.join("、")}` : ""}。
        </div>

        {/* 结果统计 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>
              查询完成，找到{" "}
              <span className="font-semibold text-slate-900">{RESULTS.length}</span> 条线索
            </span>
          </div>
          <div className="flex items-center gap-2">
            {importer && (
              <Badge variant="secondary" className="bg-white text-slate-600 ring-1 ring-slate-200">
                进口商
              </Badge>
            )}
            {exporter && (
              <Badge variant="secondary" className="bg-white text-slate-600 ring-1 ring-slate-200">
                出口商
              </Badge>
            )}
          </div>
        </div>

        {/* 结果卡片网格 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {RESULTS.map((item) => (
            <Card
              key={item.id}
              className="relative overflow-hidden rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100 hover:shadow-md hover:ring-primary/20 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600">
                  <FileText className="h-5 w-5" />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toast.success("已收藏");
                  }}
                  className="rounded-full p-1.5 text-slate-300 hover:text-amber-400 hover:bg-amber-50 transition-colors"
                  aria-label="收藏"
                >
                  <Star className="h-5 w-5" />
                </button>
              </div>

              <h3 className="text-base font-semibold text-slate-900 truncate mb-2 group-hover:text-primary transition-colors">
                {item.name}
              </h3>

              <div className="space-y-2">
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <FileText className="h-4 w-4 shrink-0 text-cyan-500 mt-0.5" />
                  <span className="truncate">线索来源：{query}</span>
                </div>
                <div className="flex items-start gap-2 text-sm text-slate-500">
                  <MapPin className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
                  <span className="line-clamp-2">{item.location}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  /* ============================ 首页态 ============================ */
  return (
    <div className="relative h-full flex flex-col overflow-hidden bg-gradient-to-b from-cyan-50 via-sky-50/60 to-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(56,189,248,0.18),transparent_70%)]" />
      <div className="pointer-events-none absolute -left-1/4 top-1/3 h-[480px] w-[120%] rotate-[-6deg] bg-[linear-gradient(90deg,transparent,rgba(186,230,253,0.55),transparent)] blur-2xl" />

      <div
        className="relative mx-auto my-auto w-full max-w-5xl px-4 sm:px-6 lg:max-w-6xl"
        style={{ paddingTop: "clamp(0.5rem,2.5vh,2.5rem)", paddingBottom: "clamp(0.5rem,2.5vh,2.5rem)" }}
      >
        <div className="text-center">
          <h1 className="font-bold tracking-tight text-slate-900" style={{ fontSize: "clamp(1.375rem,3.2vh,3rem)" }}>
            悦意出海大数据平台 · 商机线索
          </h1>
          <p className="text-slate-500" style={{ marginTop: "clamp(0.25rem,1vh,1rem)", fontSize: "clamp(0.8125rem,1.5vh,1.125rem)" }}>
            从商品、HS 编码到企业，发现全球贸易机会
          </p>
        </div>

        <div className="relative mx-auto w-full" style={{ marginTop: "clamp(1rem,3vh,2.5rem)" }}>


          {searchBar}
          {countryChips}

          {/* 最近搜索 / 热门 */}
          <div className="space-y-3" style={{ marginTop: "clamp(0.75rem,2vh,1.5rem)" }}>
            {mounted && recent.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground shrink-0">最近搜索：</span>
                {recent.slice(0, 6).map((r) => (
                  <button
                    key={r}
                    onClick={() => go(r)}
                    className="group inline-flex max-w-[280px] items-center gap-1 rounded-full bg-white/80 px-3 py-1 text-sm text-slate-700 ring-1 ring-slate-200 hover:ring-primary/50 hover:text-primary transition-colors"
                  >
                    <span className="truncate">{r}</span>
                    <XIcon
                      className="h-3 w-3 text-muted-foreground/60 opacity-0 group-hover:opacity-100 hover:text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecent(r);
                        setRecentTick((n) => n + 1);
                      }}
                    />
                  </button>
                ))}
                <button
                  onClick={() => {
                    clearRecent();
                    setRecentTick((n) => n + 1);
                  }}
                  className="text-xs text-muted-foreground/70 hover:text-foreground ml-1"
                >
                  清空
                </button>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground shrink-0">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                热门搜索：
              </span>
              {HOT_SEARCHES.map((h) => (
                <button
                  key={h}
                  onClick={() => go(h)}
                  className="rounded-full px-3 py-1 text-sm text-primary/90 hover:bg-primary/12 transition-colors"
                  style={{ backgroundColor: "rgba(20,184,166,0.08)" }}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 数据指标卡片 */}
        <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-3" style={{ marginTop: "clamp(1rem,4vh,3.5rem)" }}>
          <StatCard icon={Globe2} tone="from-cyan-400 to-sky-500" kpi="239+" title="覆盖国家/地区" sub="全球主要贸易体" />
          <StatCard icon={Building2} tone="from-emerald-400 to-teal-500" kpi="2亿+" title="全球企业" sub="全球进出口企业" />
          <StatCard icon={Users2} tone="from-sky-400 to-indigo-500" kpi="10亿+" title="全球联系人" sub="全球联系人统计" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- 指标卡片 ------------------------------- */
function StatCard({
  icon: Icon,
  tone,
  kpi,
  title,
  sub,
}: {
  icon: typeof Globe2;
  tone: string;
  kpi: string;
  title: string;
  sub: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white/70 backdrop-blur-sm p-4 sm:p-5 lg:p-6 ring-1 ring-white/80 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.25)] transition-transform hover:-translate-y-0.5">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${tone} text-white shadow-md shadow-sky-200/60`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-base font-medium text-slate-700">{title}</div>
      </div>
      <div className="mt-3 lg:mt-5 text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">{kpi}</div>
      <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
        {sub}
      </div>
      <div className="pointer-events-none absolute -right-8 -bottom-8 h-32 w-32 rounded-full bg-gradient-to-br from-white/40 to-sky-200/30 blur-2xl opacity-70" />
    </div>
  );
}
