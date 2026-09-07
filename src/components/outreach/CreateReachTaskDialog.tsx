import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles, Loader2, Send, Zap, Wand2, Languages, Package, X, Plus, Check, Upload, Download, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

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
import { type SocialTaskPlatform } from "@/lib/social-tasks";
import { useSocialAccounts } from "@/data/social-accounts";
import { useCreditBalance, spendCredits } from "@/lib/credits-balance";
import {
  COST_SOCIAL_ADD_FRIEND,
  COST_SOCIAL_DM,
  createSocialReachBatch,
} from "@/lib/credits-ledger";
import { saveReachTaskConfig } from "@/lib/reach-task-config";

import { LANGUAGES, langByCode } from "@/lib/lang-detect";
import { useLeadProfile, saveProfile } from "@/lib/lead-profile";
import { useCurrentUser } from "@/lib/current-user";
import { ComposeFormatHint } from "@/components/outreach/ComposeFormatHint";
import { useMyInfoGuard } from "@/lib/my-info-guard";
import { generateAiContent } from "@/lib/api/ai-compose.functions";
import { translateMessage } from "@/lib/api/ai-translate.functions";
import {
  recommendProductKeywords,
  type KeywordGroup,
} from "@/lib/api/ai-keywords.functions";
import {
  AI_SUGGESTED_CHAR_LEN,
  charLength,
  platformCharLimit,
} from "@/lib/text-length";

const REGIONS = [
  "美国",
  "日本",
  "新加坡",
  "印度尼西亚",
  "中国",
  "马来西亚",
  "韩国",
  "泰国",
  "越南",
  "菲律宾",
  "英国",
  "德国",
  "法国",
  "加拿大",
  "澳大利亚",
  "巴西",
  "印度",
  "墨西哥",
  "其他",
] as const;

/** 目标语言（发送语言）候选：排除中文，中文为原文 */
const TARGET_LANGS = LANGUAGES.filter((l) => l.code !== "zh");

/** 地区 → 默认目标语言 */
const REGION_LANG: Record<string, string> = {
  美国: "en",
  英国: "en",
  加拿大: "en",
  澳大利亚: "en",
  新加坡: "en",
  印度: "en",
  日本: "ja",
  韩国: "ko",
  泰国: "th",
  越南: "vi",
  印度尼西亚: "id",
  马来西亚: "ms",
  菲律宾: "en",
  德国: "de",
  法国: "fr",
  巴西: "pt",
  墨西哥: "es",
};

const SENSITIVE_WORDS = ["赌博", "色情", "毒品", "洗钱", "枪支", "porn", "casino"];
const DAILY_PER_ACCOUNT = 5;

/** 各平台触达动作：Facebook=加好友，TikTok=关注（无需私信内容） */
const PLATFORM_ACTION: Record<SocialTaskPlatform, "加好友" | "关注" | "私信"> = {
  Facebook: "加好友",
  TikTok: "关注",
};

/** 寻找目标方式（Facebook） */
type FindMode = "smart" | "post" | "group";
const FIND_MODES: { value: FindMode; label: string; desc: string }[] = [
  { value: "smart", label: "系统智能搜索", desc: "由系统按推广产品与目标关键词自动寻找目标账号。" },
  { value: "post", label: "指定贴文搜索", desc: "从指定贴文的互动用户（评论、点赞）中筛选目标账号。" },
  { value: "group", label: "指定群组搜索", desc: "从指定群组的活跃成员中筛选目标账号。" },
];
const ACTIVE_WINDOWS = ["近一周", "近两周", "近一个月", "近三个月", "近半年"] as const;

/** 指定群组搜索 · 搜索目标范围 */
type GroupScope = "post" | "member";
const GROUP_SCOPES: { value: GroupScope; label: string; desc: string }[] = [
  { value: "post", label: "贴文", desc: "在群内贴文正文与评论中匹配关键词" },
  { value: "member", label: "群内成员", desc: "在群成员的发帖与评论中匹配关键词" },
];
const groupScopeLabels = (v: GroupScope[]) =>
  GROUP_SCOPES.filter((s) => v.includes(s.value))
    .map((s) => s.label)
    .join("、");

/** 任务截止时间固定为所选日期的 13:59:59 */
const DEADLINE_CLOCK = "13:59:59";
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function formatDeadline(d: Date | undefined): string {
  return d ? `${format(d, "yyyy-MM-dd")} ${DEADLINE_CLOCK}` : "";
}

/** 关键词语言候选（含中文） */
const KEYWORD_LANGS = LANGUAGES;



/** 链接格式校验：必须为 Facebook 域名的 http(s) 链接且包含有效路径 */
function isValidFacebookLink(s: string): boolean {
  const v = s.trim();
  if (!/^https?:\/\//i.test(v)) return false;
  try {
    const u = new URL(v);
    if (!/(^|\.)facebook\.com$/i.test(u.hostname)) return false;
    return u.pathname.length > 1;
  } catch {
    return false;
  }
}

/** 链接总数上限（手动添加与批量导入共用，超出自动截断） */
const LINK_CAP = 20;
/** 导入弹窗内预览的最大条数 */
const IMPORT_PREVIEW_MAX = 10;


export function CreateReachTaskDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const profile = useLeadProfile();
  const user = useCurrentUser();
  const myInfo = useMyInfoGuard();
  const accounts = useSocialAccounts();
  const balance = useCreditBalance();
  const callGenerate = useServerFn(generateAiContent);
  const callTranslate = useServerFn(translateMessage);
  const callKeywords = useServerFn(recommendProductKeywords);

  const [name, setName] = useState("");
  const [platform, setPlatform] = useState<SocialTaskPlatform>("Facebook");
  const [region, setRegion] = useState<string>("美国");
  const [keywords, setKeywords] = useState("");
  const [targetCap, setTargetCap] = useState<number>(30);
  /** 寻找目标方式 */
  const [findMode, setFindMode] = useState<FindMode>("smart");
  /** 贴文链接与群组链接分别独立存储，切换「寻找目标方式」互不影响 */
  const [postLinks, setPostLinks] = useState<string[]>([""]);
  const [groupLinks, setGroupLinks] = useState<string[]>([""]);
  const links = findMode === "group" ? groupLinks : postLinks;
  const setLinks: React.Dispatch<React.SetStateAction<string[]>> =
    findMode === "group" ? setGroupLinks : setPostLinks;
  const [activeWindow, setActiveWindow] = useState<string>("近两周");
  /** 任务截止日期（时间固定 13:59:59），默认今天 */
  const [deadline, setDeadline] = useState<Date | undefined>(() => startOfToday());
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  /** 指定关键词语言 + 关键词翻译 */
  const [keywordLang, setKeywordLang] = useState<string>("en");
  const [kwTrLoading, setKwTrLoading] = useState(false);
  /** 指定群组搜索 · 搜索目标范围（默认群内成员，可多选） */
  const [groupScopes, setGroupScopes] = useState<GroupScope[]>(["member"]);
  const toggleGroupScope = (v: GroupScope) =>
    setGroupScopes((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  /** 链接批量导入弹窗 */
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");

  /** 推广产品（最多 3 个） */
  const [promoProducts, setPromoProducts] = useState<string[]>([]);
  const [customProduct, setCustomProduct] = useState("");
  const [productOpen, setProductOpen] = useState(false);

  /** 中文原文 */
  const [content, setContent] = useState("");
  /** 目标语言译文（实际发送内容） */
  const [translated, setTranslated] = useState("");
  const [targetLang, setTargetLang] = useState<string>("en");

  const [aiUsed, setAiUsed] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [trLoading, setTrLoading] = useState(false);
  const [kwLoading, setKwLoading] = useState(false);
  /** AI 按产品推荐的关键词分组 */
  const [kwGroups, setKwGroups] = useState<KeywordGroup[]>([]);
  /** 译文对应的原文快照，用于提示「原文已修改，需重新翻译」 */
  const [trSource, setTrSource] = useState("");

  useEffect(() => {
    if (!open) return;
    setName("");
    setPlatform("Facebook");
    setRegion("美国");
    setKeywords("");
    setKwGroups([]);
    setTargetCap(30);
    setFindMode("smart");
    setPostLinks([""]);
    setGroupLinks([""]);
    setActiveWindow("近两周");
    setDeadline(startOfToday());
    setDeadlineOpen(false);
    setKeywordLang("en");
    setGroupScopes(["member"]);
    setImportOpen(false);
    setImportText("");

    setPromoProducts([]);
    setCustomProduct("");
    setProductOpen(false);

    setContent("");
    setTranslated("");
    setTrSource("");
    setTargetLang("en");
    setAiUsed(false);
  }, [open]);

  // TikTok 仅支持系统智能搜索
  useEffect(() => {
    if (platform !== "Facebook") setFindMode("smart");
  }, [platform]);

  // 地区变化时同步推荐目标语言（仅在尚未翻译时）
  useEffect(() => {
    if (!open) return;
    const l = REGION_LANG[region];
    if (l && !translated) setTargetLang(l);
    if (l) setKeywordLang(l);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region, open]);


  const availableAccounts = useMemo(
    () => accounts.filter((a) => a.platform === platform && a.status === "正常"),
    [accounts, platform],
  );
  

  /** 推广产品候选：企业信息主营产品 + 手动添加项 */
  const productOptions = useMemo(() => {
    const base = profile.mainProducts ?? [];
    return Array.from(new Set([...base, ...promoProducts]));
  }, [profile.mainProducts, promoProducts]);

  const MAX_PROMO = 3;
  function toggleProduct(p: string) {
    setPromoProducts((prev) => {
      if (prev.includes(p)) return prev.filter((x) => x !== p);
      if (prev.length >= MAX_PROMO) {
        toast.error(`最多可选择 ${MAX_PROMO} 个推广产品`);
        return prev;
      }
      return [...prev, p];
    });
  }
  function addCustomProduct() {
    const v = customProduct.trim();
    if (!v) return;
    if (promoProducts.includes(v)) return setCustomProduct("");
    if (promoProducts.length >= MAX_PROMO)
      return toast.error(`最多可选择 ${MAX_PROMO} 个推广产品`);
    setPromoProducts((prev) => [...prev, v]);
    setCustomProduct("");
    // 同步写回「企业信息 - 主营产品」，避免重复维护
    if (!(profile.mainProducts ?? []).includes(v)) {
      saveProfile({ ...profile, mainProducts: [...(profile.mainProducts ?? []), v] });
      toast.success(`已添加「${v}」，并同步到企业信息的主营产品`);
    }
  }



  const targetLangOpt = langByCode(targetLang);

  // 预览：模拟 3 个虚拟目标（关键词/地区尚未真实抓取）
  const previewTargets = useMemo(() => {
    const kws = keywords
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const base = kws.length > 0 ? kws : ["Target Buyer"];
    return Array.from({ length: Math.min(3, Math.max(1, base.length)) }).map(
      (_, i) => ({
        name: `${region} · ${base[i % base.length]} 潜客 ${i + 1}`,
        handle: `@lead_${i + 1}`,
      }),
    );
  }, [keywords, region]);

  /** 实际发送内容：有译文则发译文 */
  const sendContent = (translated.trim() || content).trim();

  /** 各平台触达动作：Facebook=加好友，TikTok=关注（无需私信内容） */
  const action = PLATFORM_ACTION[platform];
  const needsContent = action === "私信";
  const costPerTarget = needsContent ? COST_SOCIAL_DM : COST_SOCIAL_ADD_FRIEND;
  const sendCost = targetCap * costPerTarget;
  const hit = SENSITIVE_WORDS.find((w) =>
    `${content} ${translated}`.toLowerCase().includes(w.toLowerCase()),
  );
  const staleTranslation =
    !!translated.trim() && trSource.trim() !== content.trim();

  /** 平台字数限制：中/日/韩字符按 2 计 */
  const charLimit = platformCharLimit(platform);
  const contentLen = charLength(content);
  const translatedLen = charLength(translated);
  const sendLen = charLength(sendContent);
  const overLimit = sendLen > charLimit;


  /** 按推广产品维度 AI 推荐关键词（每个产品 3-5 个，免费） */
  async function recommendKeywords() {
    if (promoProducts.length === 0) {
      toast.error("请先选择推广产品", {
        description: "关键词将按每个推广产品分别推荐 3-5 个",
      });
      return;
    }
    setKwLoading(true);
    try {
      const res = await callKeywords({
        data: {
          products: promoProducts,
          platform,
          industries: profile.industries.slice(0, 3),
          region,
        },
      });
      const groups = res.groups.filter((g) => g.keywords.length > 0);
      if (groups.length === 0) throw new Error("AI 未返回可用关键词，请重试");
      setKwGroups(groups);
      const merged = Array.from(new Set(groups.flatMap((g) => g.keywords)));
      setKeywords(merged.join(", "));
      toast.success(
        `已按 ${groups.length} 个推广产品推荐 ${merged.length} 个关键词`,
        { description: "可手动编辑，或点击分组内关键词移除" },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("关键词推荐失败", { description: msg });
    } finally {
      setKwLoading(false);
    }
  }

  /** 单一按钮：AI 生成中文首发私信文案（免费） */
  async function handleAiGenerate() {
    if (!myInfo.ensure()) return;
    setAiLoading(true);
    try {
      const res = await callGenerate({
        data: {
          channel: "social",
          platform,
          scene: "开发信",
          tone: "friendly",
          language: "zh",
          languageName: "中文",
          myCompany: profile.companyName,
          myName: user.name,
          literal: true,
          extra: `${
            promoProducts.length > 0
              ? `本次重点推广产品（必须自然融入文案）：${promoProducts.join("、")}。`
              : ""
          }严格控制篇幅：建议 ${AI_SUGGESTED_CHAR_LEN} 字符长度以内（中文/日文/韩文每字按 2 字符计），绝对不得超过 ${platform} 平台上限 ${charLimit} 字符。`,
        },
      });
      if (res.content) setContent(myInfo.fillAll(res.content));
      setAiUsed(true);
      toast.success("AI 已生成中文私信文案（免费），可直接修改");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("AI 生成失败", { description: msg });
    } finally {
      setAiLoading(false);
    }
  }

  /** 翻译为目标语言（免费） */
  async function handleTranslate(code = targetLang) {
    const src = content.trim();
    if (!src) return toast.error("请先生成或输入中文私信内容");
    const opt = langByCode(code);
    if (!opt) return;
    setTrLoading(true);
    try {
      const res = await callTranslate({
        data: {
          text: src,
          targetLanguageName: opt.en,
          sourceLanguageName: "Chinese (Simplified)",
          tone: "friendly",
        },
      });
      setTranslated(res.content ?? "");
      setTrSource(src);
      toast.success(`已翻译为${opt.zh}（免费）`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("翻译失败", { description: msg });
    } finally {
      setTrLoading(false);
    }
  }

  /** 将已填写的关键词翻译为「指定关键词语言」（免费） */
  async function handleTranslateKeywords(code = keywordLang) {
    const list = keywords
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length === 0) return toast.error("请先填写关键词");
    const opt = langByCode(code);
    if (!opt) return;
    setKwTrLoading(true);
    try {
      const res = await callTranslate({
        data: {
          text: list.join("\n"),
          targetLanguageName: opt.en,
          tone: "friendly",
        },
      });
      const out = (res.content ?? "")
        .split(/\n+/)
        .map((s) => s.replace(/^[\d.、-]+\s*/, "").trim())
        .filter(Boolean);
      if (out.length === 0) throw new Error("未返回可用译文");
      setKeywords(Array.from(new Set(out)).join(", "));
      toast.success(`关键词已翻译为${opt.zh}（免费）`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("关键词翻译失败", { description: msg });
    } finally {
      setKwTrLoading(false);
    }
  }



  /** 格式校验通过的链接（用于提交与计费口径） */
  const validLinks = links.map((l) => l.trim()).filter(Boolean).filter(isValidFacebookLink);
  /** 非空但格式不正确的链接数量（用于提交前拦截提示） */
  const invalidLinksCount = links.map((l) => l.trim()).filter((l) => l && !isValidFacebookLink(l)).length;

  /** 链接批量导入：解析文本（按行/逗号/空白分隔），分类为有效链接与格式不正确数量 */
  function parseImportedLinks(raw: string): { valid: string[]; invalid: number } {
    const header = findMode === "post" ? "贴文链接" : "群组链接";
    const tokens = raw
      .split(/[\n,，;；\t ]+/)
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter((s) => s && s !== header);
    let invalid = 0;
    const seen = new Set<string>();
    const valid: string[] = [];
    for (const t of tokens) {
      if (!isValidFacebookLink(t)) {
        invalid += 1;
        continue;
      }
      if (seen.has(t)) {
        invalid += 0; // 文件内重复按「重复」口径处理，不计入格式错误
        continue;
      }
      seen.add(t);
      valid.push(t);
    }
    return { valid, invalid };
  }

  /** 合并导入结果到链接列表（格式过滤、去重、上限截断） */
  function applyImport(raw: string, sourceLabel: string) {
    const { valid: parsed, invalid } = parseImportedLinks(raw);
    if (parsed.length === 0) {
      toast.error(`未识别到有效链接`, {
        description:
          invalid > 0
            ? `${invalid} 条格式不正确已自动过滤；请使用 Facebook 的 http(s) 链接，或下载导入模版参考示例`
            : `请粘贴 http(s) 开头的${findMode === "post" ? "贴文" : "群组"}链接，或使用导入模版`,
      });
      return;
    }
    setLinks((prev) => {
      const existing = new Set(prev.map((l) => l.trim()).filter(Boolean));
      // 丢弃空白行（无数据损失），导入链接追加在已填写内容之后，两种录入方式可同时进行
      const merged = prev.filter((l) => l.trim());
      let added = 0;
      let dup = 0;
      let overCap = 0;
      for (const l of parsed) {
        if (existing.has(l)) {
          dup += 1;
          continue;
        }
        if (merged.filter((x) => x.trim()).length >= LINK_CAP) {
          overCap += 1;
          continue;
        }
        merged.push(l);
        added += 1;
      }
      const notes: string[] = [];
      if (invalid > 0) notes.push(`${invalid} 条格式不正确已自动过滤`);
      if (dup > 0) notes.push(`${dup} 条与已有数据重复已跳过`);
      if (overCap > 0) notes.push(`最多支持 ${LINK_CAP} 条，超出 ${overCap} 条未导入`);
      toast.success(`成功导入 ${added} 条链接（来自${sourceLabel}）`, {
        description: notes.length > 0 ? notes.join("；") : undefined,
      });
      return merged.length > 0 ? merged : [""];
    });
    setImportText("");
    setImportOpen(false);
  }

  /** 下载导入模版（CSV：列标题 + 一行示例数据） */
  function downloadTemplate() {
    const header = findMode === "post" ? "贴文链接" : "群组链接";
    const example =
      findMode === "post"
        ? "https://www.facebook.com/brandpage/posts/1234567890"
        : "https://www.facebook.com/groups/1234567890";
    const csv = `\uFEFF${header}\n${example}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${findMode === "post" ? "贴文链接" : "群组链接"}导入模版.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** 读取上传的 CSV/TXT 文件并导入 */
  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => applyImport(String(reader.result ?? ""), `文件「${file.name}」`);
    reader.onerror = () => toast.error("文件读取失败，请重试");
    reader.readAsText(file);
  }

  const canSubmit =
    !hit &&
    !overLimit &&
    !!name.trim() &&
    (!needsContent || content.trim().length > 0) &&
    keywords.trim().length > 0 &&
    (findMode === "smart" ? true : validLinks.length > 0 && invalidLinksCount === 0 && !!deadline) &&
    (findMode !== "group" || groupScopes.length > 0) &&
    targetCap > 0 &&
    availableAccounts.length > 0 &&
    balance.balance >= sendCost;


  function handleConfirm() {
    if (!name.trim()) return toast.error("请填写任务名");
    if (!keywords.trim())
      return toast.error(findMode === "smart" ? "请填写目标关键词" : "请填写搜索关键词");
    if (findMode !== "smart" && validLinks.length === 0)
      return toast.error(findMode === "post" ? "请填写贴文链接" : "请填写群组链接");
    if (findMode !== "smart" && invalidLinksCount > 0)
      return toast.error(`${invalidLinksCount} 条链接格式不正确`, {
        description: "请修正为 Facebook 的 http(s) 链接，或删除后再提交",
      });
    if (findMode !== "smart" && !deadline) return toast.error("请选择任务截止日期");
    if (findMode === "group" && groupScopes.length === 0)
      return toast.error("请选择搜索目标");
    if (targetCap <= 0)
      return toast.error(`${action}目标数量需大于 0`);
    if (needsContent && !content.trim()) return toast.error("请填写私信内容");
    if (needsContent && overLimit)
      return toast.error(
        `发送内容 ${sendLen} 字符，超出 ${platform} 上限 ${charLimit} 字符`,
      );
    if (availableAccounts.length === 0)
      return toast.error("暂无可用账号，请先在「我的账号」中申请");
    if (balance.balance < sendCost) return toast.error("积分不足");

    const finalContent = needsContent ? sendContent : "";
    const kws = keywords.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    spendCredits(sendCost);
    // 记录落到「触达任务」列表（渠道=社媒）
    createSocialReachBatch({
      taskName: name.trim(),
      platform,
      region,
      keywords: kws,
      count: targetCap,
      content: finalContent,
      aiGenerated: needsContent ? aiUsed : false,
      action,
    });
    saveReachTaskConfig({
      taskKey: `s:${name.trim()}:${platform}`,
      type: "social_prospecting",
      platform,
      action,
      region,
      keywords: kws,
      products: findMode === "smart" ? promoProducts : [],
      targetCap,
      accounts: availableAccounts.map((a) => a.handle || a.displayName),
      targetSource:
        findMode === "smart"
          ? `系统按推广产品与关键词自动搜索 · 活跃时间 ${activeWindow} · 关键词语言 ${
              langByCode(keywordLang)?.zh ?? keywordLang
            }`
          : `${findMode === "post" ? "指定贴文" : "指定群组"}（${validLinks.length} 个）${
              findMode === "group" ? ` · 搜索目标 ${groupScopeLabels(groupScopes)}` : ""
            } · 活跃时间 ${activeWindow} · 关键词 ${keywords.trim()}（${
              langByCode(keywordLang)?.zh ?? keywordLang
            }）`,


      sendMode: "创建后立即执行",
      schedule:
        findMode === "smart"
          ? "创建后立即执行"
          : `创建后立即执行 · 截止 ${formatDeadline(deadline)}`,
      sourceZh: content.trim(),
      targetLang,
      sendContent: finalContent,
      aiGenerated: needsContent ? aiUsed : false,
      costPerTarget,
    });
    toast.success(
      `已创建触达任务，生成 ${targetCap} 条触达记录，共扣 ${sendCost.toLocaleString()} 积分${
        needsContent ? "（AI 生成与翻译免费）" : ""
      }`,
    );
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            新建社媒拓客任务
            <Badge variant="secondary" className="ml-1 font-normal">
              目标 {targetCap} · {platform}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs">
            {action === "加好友"
              ? "由系统按推广产品与关键词自动寻找目标账号并发出加好友请求。"
              : action === "关注"
                ? "由系统按推广产品与关键词自动寻找目标账号并执行关注。"
                : "由系统按推广产品与关键词自动寻找目标账号并发送私信。"}
          </DialogDescription>
        </DialogHeader>


        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">任务名 *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：北美建材采购商首轮触达"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">平台 *</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as SocialTaskPlatform)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Facebook">Facebook</SelectItem>
                  <SelectItem value="TikTok">TikTok</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {platform === "Facebook" ? "申请加好友目标数量" : "关注目标数量"} *
              </Label>
              <Input
                type="number"
                min={1}
                step={1}
                value={targetCap}
                onChange={(e) => setTargetCap(Math.max(1, Math.floor(Number(e.target.value) || 0)))}
              />
            </div>
          </div>

          {/* 寻找目标方式 */}
          {platform === "Facebook" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">寻找目标方式 *</Label>
              <Select value={findMode} onValueChange={(v) => setFindMode(v as FindMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIND_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                {FIND_MODES.find((m) => m.value === findMode)?.desc}
              </p>
            </div>
          )}

          {/* 推广产品 */}
          {findMode === "smart" && (
          <div className="space-y-1">

            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Package className="h-3.5 w-3.5 text-primary" />
                推广产品
                <span className="text-[10px]">
                  （来自企业信息主营产品，可手动添加，最多 {MAX_PROMO} 个）
                </span>
              </Label>
              <span
                className={`text-[10px] tabular-nums ${
                  promoProducts.length >= MAX_PROMO ? "text-amber-600" : "text-muted-foreground"
                }`}
              >
                已选 {promoProducts.length}/{MAX_PROMO}
              </span>
            </div>
            <Popover open={productOpen} onOpenChange={setProductOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full min-h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-left flex items-center gap-2 hover:border-primary/50 transition-colors"
                >
                  <div className="flex-1 flex flex-wrap gap-1">
                    {promoProducts.length === 0 ? (
                      <span className="text-muted-foreground">
                        选择本次任务重点推广的产品（可选，最多 {MAX_PROMO} 个）
                      </span>
                    ) : (
                      promoProducts.map((p) => (
                        <Badge key={p} variant="secondary" className="font-normal">
                          {p}
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPromoProducts((prev) => prev.filter((x) => x !== p));
                            }}
                            className="ml-1 -mr-0.5 rounded hover:bg-black/10 inline-flex"
                          >
                            <X className="h-3 w-3" />
                          </span>
                        </Badge>
                      ))
                    )}
                  </div>
                  <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <div className="max-h-56 overflow-y-auto py-1">
                  {productOptions.length === 0 ? (
                    <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                      企业信息中暂无主营产品，可在下方手动添加
                    </div>
                  ) : (
                    productOptions.map((p) => {
                      const checked = promoProducts.includes(p);
                      const disabled = !checked && promoProducts.length >= MAX_PROMO;
                      return (
                        <button
                          key={p}
                          type="button"
                          disabled={disabled}
                          onClick={() => toggleProduct(p)}
                          className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-accent/60 ${
                            disabled ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                        >
                          <span className="flex-1">{p}</span>
                          {checked && <Check className="h-3.5 w-3.5 text-primary" />}
                        </button>
                      );
                    })
                  )}
                </div>
                <div className="border-t p-2 flex gap-2">
                  <Input
                    value={customProduct}
                    onChange={(e) => setCustomProduct(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomProduct();
                      }
                    }}
                    placeholder="手动添加产品，回车确认"
                    className="h-8 text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    onClick={addCustomProduct}
                    disabled={!customProduct.trim() || promoProducts.length >= MAX_PROMO}
                  >
                    添加
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <p className="text-[10px] text-muted-foreground">
              已选产品将用于 AI 文案生成与关键词推荐，聚焦 1-3 个产品转化更佳。
            </p>
          </div>
          )}




          {findMode !== "smart" && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">
                    {findMode === "post" ? "贴文链接" : "群组链接"} *
                    <span className="text-[10px]">（最多 {LINK_CAP} 条，可手动输入或批量导入）</span>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1"
                    onClick={() => setImportOpen(true)}
                  >
                    <Upload className="h-3.5 w-3.5 text-primary" />
                    导入
                  </Button>
                </div>
                <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                  {links.map((l, i) => {
                    const trimmed = l.trim();
                    const invalid = trimmed.length > 0 && !isValidFacebookLink(trimmed);
                    return (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Input
                            value={l}
                            aria-invalid={invalid}
                            className={invalid ? "border-destructive focus-visible:ring-destructive" : undefined}
                            onChange={(e) =>
                              setLinks((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))
                            }
                            placeholder={
                              findMode === "post"
                                ? "https://www.facebook.com/xxx/posts/123456"
                                : "https://www.facebook.com/groups/123456"
                            }
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            disabled={links.length <= 1}
                            onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        {invalid && (
                          <p className="pl-1 text-[10px] text-destructive">
                            格式不正确：须为 Facebook 的 http(s) {findMode === "post" ? "贴文" : "群组"}链接
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  共 {links.filter((l) => l.trim()).length} 条
                  {invalidLinksCount > 0 && (
                    <span className="text-destructive">，{invalidLinksCount} 条格式不正确</span>
                  )}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1"
                  disabled={
                    links.filter((l) => l.trim()).length >= LINK_CAP ||
                    links.some((l) => !l.trim())
                  }
                  title={
                    links.some((l) => !l.trim())
                      ? "已有空白行，可直接填写"
                      : links.filter((l) => l.trim()).length >= LINK_CAP
                        ? `最多 ${LINK_CAP} 条`
                        : undefined
                  }
                  onClick={() => setLinks((prev) => [...prev, ""])}
                >
                  <Plus className="h-3.5 w-3.5" />
                  添加{findMode === "post" ? "贴文" : "群组"}链接
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">目标活跃时间 *</Label>
                  <Select value={activeWindow} onValueChange={setActiveWindow}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVE_WINDOWS.map((w) => (
                        <SelectItem key={w} value={w}>
                          {w}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    仅采集在该时间范围内有互动行为的目标账号。
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">任务截止日期 *</Label>
                  <Popover open={deadlineOpen} onOpenChange={setDeadlineOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={`w-full justify-start font-normal ${
                          deadline ? "" : "text-muted-foreground"
                        }`}
                      >
                        <CalendarIcon className="h-4 w-4" />
                        {deadline ? formatDeadline(deadline) : "选择截止日期"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={deadline}
                        onSelect={(d) => {
                          setDeadline(d ?? undefined);
                          if (d) setDeadlineOpen(false);
                        }}
                        disabled={{ before: startOfToday() }}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <p className="text-[10px] text-muted-foreground">
                    截止时间固定为所选日期的 {DEADLINE_CLOCK}，到点后未执行完的目标自动终止。
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label className="text-xs text-muted-foreground">
                    {findMode === "post" ? "搜索关键词" : "群内搜索关键词"} *
                    <span className="text-[10px]">（英文逗号分隔）</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Select
                      value={keywordLang}
                      onValueChange={(v) => {
                        setKeywordLang(v);
                        if (keywords.trim()) void handleTranslateKeywords(v);
                      }}
                    >
                      <SelectTrigger className="h-7 w-[140px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-[280px]">
                        {KEYWORD_LANGS.map((l) => (
                          <SelectItem key={l.code} value={l.code}>
                            {l.flag} {l.zh}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1"
                      disabled={kwTrLoading || !keywords.trim()}
                      onClick={() => void handleTranslateKeywords()}
                    >
                      {kwTrLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Languages className="h-3.5 w-3.5 text-primary" />
                      )}
                      翻译
                      <span className="text-[11px] text-emerald-600">免费</span>
                    </Button>
                  </div>
                </div>
                <Input
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="例如：price, MOQ, 采购"
                />
                <p className="text-[10px] text-muted-foreground">
                  {findMode === "post"
                    ? "系统将在贴文互动用户的评论内容中匹配这些关键词。"
                    : "系统将在所选搜索目标的内容中匹配这些关键词。"}
                  搜索按「{langByCode(keywordLang)?.zh ?? keywordLang}」语言执行，可一键翻译。
                </p>
              </div>

              {findMode === "group" && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    搜索目标 * <span className="text-[10px]">（可多选）</span>
                  </Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {GROUP_SCOPES.map((s) => {
                      const checked = groupScopes.includes(s.value);
                      return (
                        <button
                          key={s.value}
                          type="button"
                          onClick={() => toggleGroupScope(s.value)}
                          className={`flex items-start gap-2 rounded-md border p-2.5 text-left transition-colors ${
                            checked ? "border-primary bg-primary/5" : "hover:bg-accent"
                          }`}
                        >
                          <Checkbox checked={checked} className="pointer-events-none mt-0.5" />
                          <span className="space-y-0.5">
                            <span className="block text-xs font-medium">{s.label}</span>
                            <span className="block text-[10px] text-muted-foreground">
                              {s.desc}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    默认仅搜索群内成员；至少选择一项。当前：
                    {groupScopes.length > 0 ? groupScopeLabels(groupScopes) : "未选择"}
                  </p>
                </div>
              )}

            </div>
          )}

          {findMode === "smart" && (
          <div className="space-y-1.5">
            <div className="space-y-1.5 pb-1">
              <Label className="text-xs text-muted-foreground">目标活跃时间 *</Label>
              <Select value={activeWindow} onValueChange={setActiveWindow}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVE_WINDOWS.map((w) => (
                    <SelectItem key={w} value={w}>
                      {w}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                仅推荐在该时间范围内有活跃行为的目标账号。
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-xs text-muted-foreground">
                目标关键词 * <span className="text-[10px]">（英文逗号分隔）</span>
              </Label>
              <div className="flex items-center gap-2">
                <Select
                  value={keywordLang}
                  onValueChange={(v) => {
                    setKeywordLang(v);
                    if (keywords.trim()) void handleTranslateKeywords(v);
                  }}
                >
                  <SelectTrigger className="h-7 w-[140px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[280px]">
                    {KEYWORD_LANGS.map((l) => (
                      <SelectItem key={l.code} value={l.code}>
                        {l.flag} {l.zh}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1"
                  disabled={kwTrLoading || !keywords.trim()}
                  onClick={() => void handleTranslateKeywords()}
                >
                  {kwTrLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Languages className="h-3.5 w-3.5 text-primary" />
                  )}
                  翻译
                  <span className="text-[11px] text-emerald-600">免费</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={recommendKeywords}
                  disabled={kwLoading || promoProducts.length === 0}
                  title={
                    promoProducts.length === 0
                      ? "请先选择推广产品，AI 将按产品推荐关键词"
                      : undefined
                  }
                  className="h-7 gap-1"
                >
                  {kwLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="h-3.5 w-3.5 text-primary" />
                  )}
                  {kwLoading ? "推荐中…" : "AI 推荐"}
                </Button>
              </div>
            </div>

            <Textarea
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              rows={2}
              placeholder="例如：steel supplier, building materials, 建筑螺纹钢"
            />
            <p className="text-[11px] text-muted-foreground">
              {promoProducts.length === 0
                ? "AI 推荐依据「推广产品」，请先选择产品；每个产品推荐 3-5 个关键词。"
                : `将为已选的 ${promoProducts.length} 个推广产品各推荐 3-5 个关键词。`}
            </p>


            {kwGroups.length > 0 && (
              <div className="rounded-md border bg-muted/30 p-2.5 space-y-2">
                <div className="text-[11px] font-medium text-muted-foreground">
                  按推广产品推荐（点击关键词可从上方输入框移除）
                </div>
                {kwGroups.map((g) => (
                  <div key={g.product} className="space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium">
                      <Package className="h-3 w-3 text-primary" />
                      {g.product}
                      <span className="text-muted-foreground font-normal">
                        · {g.keywords.length} 个
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {g.keywords.map((k) => {
                        const list = keywords
                          .split(/[,，]/)
                          .map((s) => s.trim())
                          .filter(Boolean);
                        const active = list.includes(k);
                        return (
                          <button
                            key={`${g.product}-${k}`}
                            type="button"
                            onClick={() =>
                              setKeywords(
                                (active
                                  ? list.filter((x) => x !== k)
                                  : [...list, k]
                                ).join(", "),
                              )
                            }
                          >
                            <Badge
                              variant={active ? "secondary" : "outline"}
                              className="cursor-pointer text-[11px] font-normal"
                            >
                              {k}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}



          {/* 可用账号 */}
          <div className="rounded-md border bg-muted/30 px-3 py-2 flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">可用账号</span>
            <span className="font-semibold text-foreground tabular-nums">
              {availableAccounts.length}
            </span>
            <span className="text-muted-foreground">
              · 单账号 {DAILY_PER_ACCOUNT} 个/天
            </span>
            {availableAccounts.length === 0 && (
              <span className="ml-auto text-rose-600">
                暂无可用账号，请先在「我的账号」中申请
              </span>
            )}
          </div>

          {needsContent && (
          <section className="space-y-3 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-2">
                私信内容
                {aiUsed && (
                  <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800">
                    <Sparkles className="h-3 w-3" />
                    AI 已生成 · 可手动调整
                  </Badge>
                )}
              </Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAiGenerate}
                disabled={aiLoading}
                className="h-7 gap-1"
              >
                {aiLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                )}
                {aiLoading ? "生成中…" : aiUsed ? "AI 重新生成" : "AI 生成私信内容"}
                <span className="text-[11px] text-emerald-600">免费</span>
              </Button>
            </div>

            <ComposeFormatHint channel="social" platform={platform} />

            <div className="grid gap-0 lg:grid-cols-2 lg:divide-x rounded-md border overflow-hidden">
              {/* 左：中文原文 */}
              <div className="space-y-2 p-3">
                <div className="flex h-8 items-center">
                  <Label className="text-xs text-muted-foreground">中文原文</Label>
                </div>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={10}
                  placeholder={`Hi {联系人名}，我是 {我的公司} 的 {我的姓名}……（AI 生成默认为首发开发信）`}
                />
                <div className="flex items-center justify-between text-[11px]">
                  <span
                    className={
                      contentLen > charLimit ? "text-rose-600" : "text-muted-foreground"
                    }
                  >
                    {contentLen} / {charLimit} 字符（{platform}）
                  </span>
                  <span className="text-muted-foreground">
                    中/日/韩字符按 2 计
                  </span>
                </div>
              </div>

              {/* 右：目标语言译文（实际发送内容） */}
              <div className="space-y-2 bg-primary/[0.03] p-3">
                <div className="flex h-8 items-center justify-between gap-2">
                  <Label className="text-xs font-medium flex items-center gap-1.5 whitespace-nowrap">
                    <Languages className="h-3.5 w-3.5 text-primary" />
                    <span className="whitespace-nowrap">
                      实际发送内容 <span className="text-rose-500">*</span>
                    </span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Select
                      value={targetLang}
                      onValueChange={(v) => {
                        setTargetLang(v);
                        if (content.trim()) void handleTranslate(v);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[140px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-[280px]">
                        {TARGET_LANGS.map((l) => (
                          <SelectItem key={l.code} value={l.code}>
                            {l.flag} {l.zh}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1"
                      disabled={trLoading || !content.trim()}
                      onClick={() => void handleTranslate()}
                    >
                      {trLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Languages className="h-3.5 w-3.5 text-primary" />
                      )}
                      {translated ? "重新翻译" : "翻译"}
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={translated}
                  onChange={(e) => setTranslated(e.target.value)}
                  rows={10}
                  placeholder={`选择目标语言后点击「翻译」，此处展示 ${
                    targetLangOpt?.zh ?? "目标语言"
                  }文案，可手动修改`}
                />
                <div className="flex items-center justify-between text-[11px]">
                  <span
                    className={
                      translatedLen > charLimit ? "text-rose-600" : "text-muted-foreground"
                    }
                  >
                    {translated
                      ? `将以${targetLangOpt?.zh ?? ""}发送 · ${translatedLen} / ${charLimit} 字符`
                      : "未翻译时，将直接发送中文原文"}
                  </span>
                  {staleTranslation && (
                    <span className="text-amber-600">原文已修改，建议重新翻译</span>
                  )}
                </div>
              </div>
            </div>
          </section>
          )}


          {overLimit && (
            <div className="text-xs text-rose-600">
              实际发送内容 {sendLen} 字符，超出 {platform} 平台上限 {charLimit} 字符
              （中/日/韩字符按 2 计），请精简后再提交。
            </div>
          )}

          {hit && (
            <div className="text-xs text-rose-600">
              命中敏感词 "{hit}"，请修改后再提交（否则将被拦截且不扣分）。
            </div>
          )}



          {/* 消耗积分 */}
          <section className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {action === "加好友" ? "加好友费用" : action === "关注" ? "关注费用" : "发送费用"}（{targetCap} 条 ×{" "}
                {costPerTarget} 积分）
              </span>
              <span className="font-medium">{sendCost.toLocaleString()} 积分</span>
            </div>
            {needsContent && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">AI 生成 / 翻译</span>
                <span className="font-medium text-emerald-600">免费</span>
              </div>
            )}
            <div className="flex justify-between border-t border-rose-200/70 pt-1">
              <span className="font-semibold text-rose-700">合计</span>
              <span className="font-semibold text-rose-700">-{sendCost.toLocaleString()}</span>
            </div>
            {balance.balance < sendCost && (
              <div className="text-[11px] text-rose-700/90 pt-0.5">
                当前余额 {balance.balance.toLocaleString()}，尚缺{" "}
                {(sendCost - balance.balance).toLocaleString()} 积分。
              </div>
            )}
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button disabled={!canSubmit} onClick={handleConfirm}>
            <Send className="h-4 w-4" />
            确认（-{sendCost.toLocaleString()}）
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* 链接批量导入弹窗 */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Upload className="h-4 w-4 text-primary" />
              批量导入{findMode === "post" ? "贴文" : "群组"}链接
            </DialogTitle>
            <DialogDescription className="text-xs">
              支持上传 CSV/TXT 文件或直接粘贴链接（每行一个）；列标题须为「
              {findMode === "post" ? "贴文链接" : "群组链接"}」，仅识别 Facebook 的 http(s) 有效链接，格式不正确与重复数据将自动过滤；与手动输入合计最多 {LINK_CAP} 条，超出部分将不导入。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                onClick={downloadTemplate}
              >
                <Download className="h-3.5 w-3.5" />
                下载导入模版
              </Button>
              <label className="inline-flex">
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportFile(f);
                    e.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" size="sm" className="h-8 gap-1" asChild>
                  <span>
                    <Upload className="h-3.5 w-3.5" />
                    上传文件（CSV / TXT）
                  </span>
                </Button>
              </label>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">或直接粘贴链接（每行一个）</Label>
              <Textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={6}
                placeholder={
                  findMode === "post"
                    ? "https://www.facebook.com/brandpage/posts/1234567890\nhttps://www.facebook.com/brandpage/posts/0987654321"
                    : "https://www.facebook.com/groups/1234567890\nhttps://www.facebook.com/groups/0987654321"
                }
                className="font-mono text-xs"
              />
              {(() => {
                const { valid, invalid } = parseImportedLinks(importText);
                if (valid.length === 0 && invalid === 0)
                  return <p className="text-[10px] text-muted-foreground">尚未识别到链接</p>;
                return (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground">
                      已识别 {valid.length} 个有效链接
                      {invalid > 0 && (
                        <span className="text-destructive">，{invalid} 个格式不正确将自动过滤</span>
                      )}
                      {valid.length > LINK_CAP && `，超出上限部分（${valid.length - LINK_CAP} 个）将不导入`}
                    </p>
                    {valid.length > 0 && (
                      <div className="max-h-24 space-y-0.5 overflow-y-auto rounded-md border bg-muted/40 p-2">
                        {valid.slice(0, IMPORT_PREVIEW_MAX).map((l) => (
                          <p key={l} className="truncate font-mono text-[10px] text-muted-foreground">
                            {l}
                          </p>
                        ))}
                        {valid.length > IMPORT_PREVIEW_MAX && (
                          <p className="text-[10px] text-muted-foreground">
                            … 等共 {valid.length} 个，仅预览前 {IMPORT_PREVIEW_MAX} 个
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>取消</Button>
            <Button
              disabled={parseImportedLinks(importText).valid.length === 0}
              onClick={() => applyImport(importText, "粘贴内容")}
            >
              导入 {Math.min(parseImportedLinks(importText).valid.length, LINK_CAP)} 个链接
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
