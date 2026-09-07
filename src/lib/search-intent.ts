// 商机线索搜索：自然语言意图解析
// 1) 从查询语句中识别国家/地区，自动勾选国家筛选
// 2) 从"采购商/经销商/供应商"等角色词，自动勾选进口商 / 出口商

/** 国家标准名 -> 别名（中文简称 / 英文名） */
const COUNTRY_ALIASES: Record<string, string[]> = {
  安道尔: ["andorra"],
  阿拉伯联合酋长国: ["阿联酋", "迪拜", "uae", "united arab emirates", "dubai"],
  阿富汗: ["afghanistan"],
  安提瓜和巴布达: ["antigua"],
  安圭拉: ["anguilla"],
  阿尔巴尼亚: ["albania"],
  亚美尼亚: ["armenia"],
  库拉索: ["curacao"],
  安哥拉: ["angola"],
  阿根廷: ["argentina"],
  奥地利: ["austria"],
  澳大利亚: ["澳洲", "australia"],
  巴西: ["brazil"],
  比利时: ["belgium"],
  加拿大: ["canada"],
  瑞士: ["switzerland"],
  智利: ["chile"],
  中国: ["china", "国内"],
  哥伦比亚: ["colombia"],
  捷克: ["czech"],
  德国: ["germany", "deutschland"],
  丹麦: ["denmark"],
  埃及: ["egypt"],
  西班牙: ["spain"],
  法国: ["france"],
  英国: ["英格兰", "uk", "united kingdom", "britain", "england"],
  印度: ["india"],
  印度尼西亚: ["印尼", "indonesia"],
  意大利: ["italy"],
  日本: ["japan"],
  韩国: ["南韩", "korea", "south korea"],
  墨西哥: ["mexico"],
  马来西亚: ["马来", "malaysia"],
  荷兰: ["netherlands", "holland"],
  尼日利亚: ["nigeria"],
  菲律宾: ["philippines"],
  波兰: ["poland"],
  葡萄牙: ["portugal"],
  俄罗斯: ["俄国", "russia"],
  沙特阿拉伯: ["沙特", "saudi"],
  瑞典: ["sweden"],
  新加坡: ["singapore"],
  泰国: ["thailand"],
  土耳其: ["turkey", "türkiye"],
  美国: ["美利坚", "usa", "u.s.", "us", "united states", "america"],
  越南: ["vietnam", "viet nam"],
  南非: ["south africa"],
};

/** 需要整词匹配的短别名（避免 "us" 命中 "industry"） */
const WORD_BOUNDARY_ALIASES = new Set(["us", "uk", "uae", "u.s."]);

/**
 * 从查询语句中识别国家/地区（返回标准中文名，按出现顺序）
 * @param available 可选：限定在筛选器支持的国家列表内
 */
export function detectCountries(query: string, available?: string[]): string[] {
  const text = query.toLowerCase();
  if (!text.trim()) return [];
  const allow = available ? new Set(available) : null;
  const hits: { name: string; pos: number }[] = [];

  for (const [name, aliases] of Object.entries(COUNTRY_ALIASES)) {
    if (allow && !allow.has(name)) continue;
    const candidates = [name.toLowerCase(), ...aliases];
    let pos = -1;
    for (const c of candidates) {
      const idx = WORD_BOUNDARY_ALIASES.has(c)
        ? indexOfWord(text, c)
        : text.indexOf(c);
      if (idx >= 0 && (pos < 0 || idx < pos)) pos = idx;
    }
    if (pos >= 0) hits.push({ name, pos });
  }

  hits.sort((a, b) => a.pos - b.pos);
  return hits.map((h) => h.name);
}

function indexOfWord(text: string, word: string): number {
  const re = new RegExp(`(^|[^a-z])${word.replace(/\./g, "\\.")}($|[^a-z])`, "i");
  const m = re.exec(text);
  return m ? m.index : -1;
}

/* -------------------- 角色（进口商 / 出口商）匹配规则 -------------------- */
// 规则设计：
// - "买方语义"（采购、进口、经销、分销、批发、零售、买家、终端客户…）→ 进口商
// - "卖方语义"（供应、出口、制造、生产、工厂、厂家、卖家、代工…）→ 出口商
// - "贸易商 / trading company" 等中性词 → 两者都勾
// - 未识别到任何角色词 → 保持默认（进口商 + 出口商 全选）

const IMPORTER_WORDS = [
  "采购商", "采购方", "采购", "买家", "买方", "买手", "进口商", "进口",
  "经销商", "代理商", "分销商", "分销", "批发商", "零售商", "商超", "连锁",
  "终端客户", "客户", "需求方",
  "buyer", "buyers", "importer", "importers", "purchaser", "procurement",
  "distributor", "distributors", "wholesaler", "retailer", "reseller",
];

const EXPORTER_WORDS = [
  "供应商", "供货商", "出口商", "出口", "制造商", "生产商", "生产厂",
  "工厂", "厂家", "卖家", "卖方", "代工", "oem", "odm",
  "supplier", "suppliers", "exporter", "exporters", "manufacturer",
  "manufacturers", "factory", "producer", "vendor",
];

const NEUTRAL_WORDS = ["贸易商", "外贸公司", "贸易公司", "trader", "trading company"];

export interface RoleMatch {
  importer: boolean;
  exporter: boolean;
  /** 是否命中了角色关键词（未命中时调用方应保持默认） */
  matched: boolean;
  /** 命中的关键词，可用于提示 */
  hits: string[];
}

export function detectRoles(query: string): RoleMatch {
  const text = query.toLowerCase();
  const hits: string[] = [];
  const hit = (list: string[]) =>
    list.filter((w) => text.includes(w.toLowerCase()));

  const neutral = hit(NEUTRAL_WORDS);
  const imp = hit(IMPORTER_WORDS);
  const exp = hit(EXPORTER_WORDS);
  hits.push(...neutral, ...imp, ...exp);

  if (neutral.length > 0) {
    return { importer: true, exporter: true, matched: true, hits };
  }
  if (imp.length === 0 && exp.length === 0) {
    return { importer: true, exporter: true, matched: false, hits: [] };
  }
  return {
    importer: imp.length > 0,
    exporter: exp.length > 0,
    matched: true,
    hits,
  };
}
