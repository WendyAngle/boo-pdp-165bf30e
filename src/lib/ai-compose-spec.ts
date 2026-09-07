/**
 * AI 文案「渠道格式规范」统一定义
 *
 * 一处定义，两处使用：
 * 1) 服务端 ai-compose 构造 system prompt（决定 AI 产出的格式）
 * 2) 前端各 AI 生成弹窗展示「格式规范」提示（让用户预期一致）
 */

export type ComposeKind = "email" | "sms" | "whatsapp" | "facebook" | "tiktok";

export interface ComposeSpec {
  kind: ComposeKind;
  /** 展示名，如「Facebook 私信」 */
  label: string;
  /** 是否需要邮件主题（决定 AI 返回 JSON） */
  hasSubject: boolean;
  /** 建议正文长度（按权重字符：中日韩 1 字 = 2 字符） */
  recommendChars: number;
  /** 平台硬上限（权重字符），0 表示无明确上限 */
  maxChars: number;
  /** 结构化写作规则（喂给模型） */
  rules: string[];
  /** 明确禁止项（喂给模型） */
  bans: string[];
  /** 前端提示（3 条以内，短句） */
  tips: string[];
}

export const COMPOSE_SPECS: Record<ComposeKind, ComposeSpec> = {
  email: {
    kind: "email",
    label: "商务邮件",
    hasSubject: true,
    recommendChars: 700,
    maxChars: 0,
    rules: [
      "结构固定为 4 段：① 称呼问候（含 {联系人名}）；② 一句话自我介绍 + 为何联系对方（结合 {企业名}/{行业}）；③ 我方产品或方案的 2-3 个具体价值点，可用「- 」列点；④ 明确且低门槛的行动号召（如索取报价单 / 预约 15 分钟通话）。",
      "段落之间空一行；每段不超过 3 句话。",
      "结尾单独一行署名：{我的姓名} · {我的公司}。",
      "主题行具体、可读，包含对方行业或产品关键词，≤60 字且不使用感叹号。",
      "正文可包含 1 个官网或产品页链接。",
    ],
    bans: ["不使用 emoji", "不使用全大写与多个感叹号", "不使用 Markdown 标题与加粗符号"],
    tips: ["主题 + 4 段正文 + 署名", "语气正式，不使用 emoji", "结尾一个明确 CTA"],
  },
  sms: {
    kind: "sms",
    label: "营销短信",
    hasSubject: false,
    recommendChars: 200,
    maxChars: 280,
    rules: [
      "单段一句到两句话，开头点明我方公司，结尾给出一个动作。",
      "信息密度高，只保留最核心的一个卖点。",
    ],
    bans: ["不含 emoji", "不含链接", "不含退订语与署名", "不换行"],
    tips: ["1-2 句话，≤140 字", "无 emoji、无链接", "只讲一个核心卖点"],
  },
  whatsapp: {
    kind: "whatsapp",
    label: "WhatsApp 消息",
    hasSubject: false,
    recommendChars: 300,
    maxChars: 900,
    rules: [
      "像真人聊天：3 句以内，先自报公司来意，再给一个具体价值点，最后用一个开放式问题收尾。",
      "可用换行分成 2 小段，便于手机阅读。",
      "最多 1 个 emoji，放在句尾。",
    ],
    bans: ["不含主题行", "首条消息不放链接与附件", "不使用列点与 Markdown", "不写署名区块"],
    tips: ["3 句以内，口语化", "首条不放链接", "最多 1 个 emoji"],
  },
  facebook: {
    kind: "facebook",
    label: "Facebook 私信",
    hasSubject: false,
    recommendChars: 500,
    maxChars: 2000,
    rules: [
      "开场先提到对方主页/业务的一个具体点，体现「不是群发」。",
      "正文 2-3 个短段落，每段 1-2 句，段间换行。",
      "结尾用开放式问题邀请对方回复。",
      "可使用 1-2 个 emoji 增加亲和力。",
    ],
    bans: ["首条消息不放外部链接（易被判定垃圾信息）", "不使用 Markdown", "不写邮件式称呼与署名", "不使用全大写"],
    tips: ["2-3 短段，先提对方业务", "首条不放链接", "1-2 个 emoji"],
  },
  tiktok: {
    kind: "tiktok",
    label: "TikTok 私信",
    hasSubject: false,
    recommendChars: 200,
    maxChars: 6000,
    rules: [
      "极简：1-3 句，单段，年轻化、轻松口语。",
      "第一句可以夸赞对方内容/账号，第二句说明合作或产品意图，第三句给一个轻问题。",
      "可使用 1-2 个 emoji。",
    ],
    bans: ["不放链接、邮箱与电话（易触发风控）", "不使用正式商务措辞", "不分多段长文", "不写署名"],
    tips: ["1-3 句，超短口语", "不放链接与联系方式", "1-2 个 emoji"],
  },
};

/** 由 channel + platform 推导规范类型 */
export function resolveComposeKind(
  channel: "email" | "sms" | "social",
  platform?: string,
): ComposeKind {
  if (channel === "email") return "email";
  if (channel === "sms") return "sms";
  const p = (platform ?? "").toLowerCase();
  if (p.includes("tiktok")) return "tiktok";
  if (p.includes("whatsapp")) return "whatsapp";
  return "facebook";
}

export function getComposeSpec(
  channel: "email" | "sms" | "social",
  platform?: string,
): ComposeSpec {
  return COMPOSE_SPECS[resolveComposeKind(channel, platform)];
}
