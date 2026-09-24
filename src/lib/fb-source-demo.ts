/**
 * Facebook「指定贴文搜索」「指定群组搜索」来源的演示任务。
 * 同一份定义同时供：积分流水（任务列表 / 任务详情 / 触达目标 / 效果统计）、
 * 任务详情配置（贴文 / 群组链接）、触达会话（有回复的目标）使用，保证各模块数据一致。
 */
const H = 60;
const D = 24 * H;

export type FbDemoStatus = "success" | "failed" | "in_progress" | "pending";

export interface FbSourceDemoTarget {
  name: string;
  handle: string;
  /** 相对任务创建时间提前的分钟数（越小越晚） */
  offset: number;
  status: FbDemoStatus;
  failReason?: string;
  /** 有回复时生成触达会话 */
  reply?: { content: string; contentZh: string; afterH: number; tags?: string[] };
}

export interface FbSourceDemoTask {
  subject: string;
  findMode: "post" | "group";
  /** 任务创建距今分钟数 */
  min: number;
  region: string;
  links: string[];
  groupScopes?: string;
  keywords?: string[];
  content: string;
  targets: FbSourceDemoTarget[];
  /** 计划目标数（不填时按演示规则推算） */
  targetCap?: number;
  /** 已终止任务：终止距今分钟数；终止后按（计划目标数 - 触达成功数）× 50 退还积分 */
  terminatedMin?: number;
}

export const FB_SOURCE_DEMO_TASKS: FbSourceDemoTask[] = [
  {
    subject: "美国 · LED 照明贴文互动用户私信",
    findMode: "post",
    min: 4 * D,
    region: "美国",
    links: [
      "https://www.facebook.com/ledlightingusa/posts/pfbid02LedWholesale2026",
      "https://www.facebook.com/groups/lightingbuyers/posts/1850237741",
    ],
    content:
      "Hi {name},\n\n看到您在 LED 照明相关贴文下的互动，我们是专注工程照明的源头工厂，可提供 UL 认证灯具及样品，方便简单聊聊吗？\n\n— Boo team",
    targets: [
      { name: "Jason Miller", handle: "@jason.miller.led", offset: 0, status: "success",
        reply: { content: "Hi, do you have UL listed high bay lights? Please send a price list.", contentZh: "你好，你们有 UL 认证的工矿灯吗？请发一份价格表。", afterH: 6, tags: ["待报价"] } },
      { name: "Ashley Cooper", handle: "@ashley.cooper", offset: 20, status: "success" },
      { name: "Brandon Lee", handle: "@brandon.lee.lighting", offset: 45, status: "success",
        reply: { content: "Thanks, we are not buying this quarter.", contentZh: "谢谢，我们这个季度暂无采购计划。", afterH: 20 } },
      { name: "Megan Price", handle: "@megan.price", offset: 70, status: "failed", failReason: "对方已关闭陌生人私信" },
      { name: "Tyler Brooks", handle: "@tyler.brooks", offset: 95, status: "success" },
      { name: "Rachel Kim", handle: "@rachel.kim.us", offset: 120, status: "failed", failReason: "消息被平台拦截" },
      { name: "Kevin Turner", handle: "@kevin.turner", offset: 150, status: "success" },
    ],
  },
  {
    subject: "德国 · 厨卫五金贴文评论用户私信",
    findMode: "post",
    min: 40 * D,
    region: "德国",
    links: ["https://www.facebook.com/sanitaer.forum/posts/pfbid0KitchenBath88"],
    content:
      "Hallo {name},\n\n我们注意到您在厨卫五金贴文下的评论，我们为欧洲渠道商提供 CE 认证水龙头与挂件，可免费寄样，方便沟通吗？\n\n— Boo team",
    targets: [
      { name: "Lukas Schmidt", handle: "@lukas.schmidt", offset: 0, status: "success",
        reply: { content: "Bitte senden Sie mir den Katalog.", contentZh: "请把产品目录发给我。", afterH: 10 } },
      { name: "Anna Fischer", handle: "@anna.fischer", offset: 30, status: "success" },
      { name: "Felix Wagner", handle: "@felix.wagner", offset: 60, status: "failed", failReason: "消息被平台拦截" },
      { name: "Sophie Becker", handle: "@sophie.becker", offset: 90, status: "failed", failReason: "对方已关闭陌生人私信" },
      { name: "Maximilian Hoffmann", handle: "@max.hoffmann", offset: 120, status: "success" },
    ],
  },
  {
    subject: "中东 · 建材采购群组成员拓客",
    findMode: "group",
    min: 33 * D,
    region: "阿联酋",
    links: [
      "https://www.facebook.com/groups/uaebuildingmaterials",
      "https://www.facebook.com/groups/gulfconstructionbuyers",
    ],
    groupScopes: "群组成员",
    keywords: ["building materials", "tile distributor", "建材批发"],
    content:
      "Hi {name},\n\n我们在中东建材采购群里看到了您，我们是瓷砖与石材源头工厂，可支持迪拜仓发货，想和您做一次简短交流，方便吗？\n\n— Boo team",
    targets: [
      { name: "Omar Al Hashimi", handle: "@omar.alhashimi", offset: 0, status: "success",
        reply: { content: "Interested. What is your MOQ for 60x120 porcelain tiles?", contentZh: "有兴趣。60x120 瓷砖的起订量是多少？", afterH: 5, tags: ["高意向"] } },
      { name: "Fatima Khan", handle: "@fatima.khan", offset: 25, status: "success" },
      { name: "Ahmed Saleh", handle: "@ahmed.saleh", offset: 50, status: "failed", failReason: "消息被平台拦截" },
      { name: "Yousef Nasser", handle: "@yousef.nasser", offset: 80, status: "success" },
      { name: "Layla Haddad", handle: "@layla.haddad", offset: 110, status: "success" },
      { name: "Hassan Rahimi", handle: "@hassan.rahimi", offset: 140, status: "failed", failReason: "对方已关闭陌生人私信" },
    ],
  },
  {
    subject: "英国 · 宠物用品贴文互动用户私信",
    findMode: "post",
    min: 26 * D,
    region: "英国",
    links: ["https://www.facebook.com/petsupplies.uk/posts/pfbid02PetCareDeals2026"],
    content:
      "Hi {name},\n\n看到您在宠物用品贴文下的互动，我们是宠物窝垫与牵引用品源头工厂，支持小批量定制，方便聊聊吗？\n\n— Boo team",
    targetCap: 20,
    terminatedMin: 24 * D,
    targets: [
      { name: "Oliver Hughes", handle: "@oliver.hughes.pets", offset: 0, status: "success",
        reply: { content: "Do you offer private label dog beds?", contentZh: "你们提供狗窝贴牌吗？", afterH: 8 } },
      { name: "Emily Clarke", handle: "@emily.clarke", offset: 25, status: "success" },
      { name: "George Walker", handle: "@george.walker", offset: 55, status: "failed", failReason: "对方已关闭陌生人私信" },
      { name: "Chloe Evans", handle: "@chloe.evans.uk", offset: 80, status: "success" },
      { name: "Harry Wright", handle: "@harry.wright", offset: 110, status: "success" },
    ],
  },
  {
    subject: "东南亚 · 美妆代工群组成员拓客",
    findMode: "group",
    min: 11 * D,
    region: "马来西亚",
    links: ["https://www.facebook.com/groups/sea.beauty.oem"],
    groupScopes: "群组成员",
    keywords: ["cosmetics OEM", "skincare brand", "美妆代工"],
    content:
      "Hi {name},\n\n我们在东南亚美妆代工群里看到了您，我们是护肤品 OEM/ODM 工厂，可提供 Halal 认证配方，方便简单沟通吗？\n\n— Boo team",
    targetCap: 30,
    terminatedMin: 8 * D,
    targets: [
      { name: "Nurul Aina", handle: "@nurul.aina", offset: 0, status: "success",
        reply: { content: "Yes, please share your MOQ for serum.", contentZh: "可以，请发一下精华液的起订量。", afterH: 4, tags: ["高意向"] } },
      { name: "Siti Rahman", handle: "@siti.rahman", offset: 20, status: "success" },
      { name: "Tan Wei Ling", handle: "@tan.weiling", offset: 45, status: "success" },
      { name: "Aisyah Omar", handle: "@aisyah.omar", offset: 70, status: "failed", failReason: "消息被平台拦截" },
      { name: "Lim Jia Hui", handle: "@lim.jiahui", offset: 95, status: "success" },
      { name: "Farah Aziz", handle: "@farah.aziz", offset: 120, status: "success" },
      { name: "Chen Mei", handle: "@chen.mei.my", offset: 150, status: "success" },
    ],
  },
];

/** 演示用已终止任务的 key（与 groupKeyOf 口径一致） */
export const FB_DEMO_TERMINATED_KEYS = new Set(
  FB_SOURCE_DEMO_TASKS.filter((t) => t.terminatedMin != null).map((t) => `s:${t.subject}:Facebook`),
);

/** 已有「欧洲 · 家居建材群组成员拓客」任务的配置（群组链接），与新增任务同口径展示 */
export const FB_EXISTING_GROUP_TASK = {
  subject: "欧洲 · 家居建材群组成员拓客",
  region: "德国",
  links: [
    "https://www.facebook.com/groups/eu.homebuilding.buyers",
    "https://www.facebook.com/groups/europe.furniture.trade",
  ],
  groupScopes: "群组成员",
  keywords: ["furniture importer", "home decor buyer", "家居采购"],
};

export function fbSourceDemoConfig(subject: string | undefined) {
  if (!subject) return undefined;
  const t = FB_SOURCE_DEMO_TASKS.find((x) => x.subject === subject);
  if (t) return t;
  if (subject === FB_EXISTING_GROUP_TASK.subject) return { ...FB_EXISTING_GROUP_TASK, findMode: "group" as const };
  return undefined;
}
