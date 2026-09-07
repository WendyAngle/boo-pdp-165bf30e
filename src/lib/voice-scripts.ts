import { ALL_LANGUAGES } from "@/lib/languages";
import { useSyncExternalStore } from "react";

/* ------------------------------------------------------------------ *
 * AI 智能外呼 · 话术（线性步骤式编排）/ 人工坐席 / 数据与合规
 * 方案：AI智能外呼_话术与对话流_产品设计方案 v1.2
 * ------------------------------------------------------------------ */

export type ScriptScene = "marketing" | "notify" | "revisit" | "invite" | "other";
export const SCRIPT_SCENES: { key: ScriptScene; label: string }[] = [
  { key: "marketing", label: "营销外呼" },
  { key: "notify", label: "语音通知" },
  { key: "revisit", label: "客户回访" },
  { key: "invite", label: "展会邀约" },
  { key: "other", label: "其他" },
];

export const SCRIPT_INDUSTRIES = [
  "外贸制造",
  "跨境电商",
  "机械设备",
  "新能源",
  "消费电子",
  "物流服务",
  "通用",
];

/** 平台模板不区分行业，统一为多行业通用（行业差异由变量与企业知识库注入） */
export const TEMPLATE_INDUSTRY = "多行业通用";

export const SCRIPT_LANGUAGES: { key: string; label: string }[] = ALL_LANGUAGES.map(
  (l) => ({ key: l.code, label: l.zh }),
);

export type StepType = "opening" | "ai" | "transfer" | "collect" | "ending";
export const STEP_TYPES: { key: StepType; label: string; desc: string }[] = [
  { key: "opening", label: "开场白", desc: "自我介绍与来意说明，内置录音告知语" },
  { key: "ai", label: "AI 对话", desc: "LLM 驱动的多轮自由对话，输出意向标签" },
  { key: "transfer", label: "转人工", desc: "转接真实坐席，失败走兜底" },
  { key: "collect", label: "留资 / 发资料", desc: "确认邮箱或 WhatsApp，触发后续触达" },
  { key: "ending", label: "结束语", desc: "礼貌收尾并挂机" },
];

/** 分支跳转目标：步骤 id 或 "__end__"（结束通话） */
export const END_TARGET = "__end__";

export interface ScriptBranch {
  id: string;
  label: string;
  to: string;
}

export interface ScriptStep {
  id: string;
  type: StepType;
  title: string;
  /** 播报文本 / 系统提示词 */
  content: string;
  /** AI 对话：最大轮次 */
  maxTurns?: number;
  /** AI 对话：绑定企业知识库 */
  useKnowledge?: boolean;
  /** AI 对话：注入变量 */
  variables?: string[];
  /** 转人工：坐席组 */
  agentGroup?: string;
  /** 转人工：振铃超时（秒） */
  ringTimeout?: number;
  /** 转人工：失败兜底话术 */
  fallback?: string;
  branches: ScriptBranch[];
}

export type ScriptStatus = "draft" | "published" | "offline";

export interface VoiceScript {
  id: string;
  name: string;
  scene: ScriptScene;
  industry: string;
  language: string;
  /** 目标市场 / 地区（SCRIPT_REGIONS.key） */
  region?: string;
  /** platform = 平台运营维护的模板；tenant = 租户自有话术 */
  owner: "platform" | "tenant";
  status: ScriptStatus;
  steps: ScriptStep[];
  updatedAt: string;
  updatedBy: string;
  /** 平台模板：被使用次数；租户话术：通话数 */
  usedCount: number;
  /** 租户话术：A 类高意向占比 % */
  intentRateA?: number;
  /** 由哪个平台模板复制而来 */
  fromTemplateId?: string;
  recommended?: boolean;
  /** 模板简介（模板市场展示） */
  desc?: string;
  /** 适用场景标签 */
  tags?: string[];
  /** 预计通话时长（秒） */
  avgDuration?: number;
}

export const SCRIPT_VARIABLES = ["企业名", "联系人名", "行业", "我的公司", "我的姓名", "活动主题"];

/** 目标市场 / 地区（创建话术时选择，用于外呼时段、称呼与合规提示的本地化） */
export const SCRIPT_REGIONS: { key: string; label: string }[] = [
  { key: "global", label: "全球通用" },
  { key: "na", label: "北美（美国 / 加拿大）" },
  { key: "eu", label: "欧洲（西欧 / 北欧）" },
  { key: "sea", label: "东南亚" },
  { key: "me", label: "中东" },
  { key: "latam", label: "拉美" },
  { key: "africa", label: "非洲" },
  { key: "jpkr", label: "日韩" },
  { key: "cn", label: "中国大陆" },
];

export const regionLabel = (k?: string) =>
  SCRIPT_REGIONS.find((r) => r.key === k)?.label ?? "全球通用";

/** 语言全称，用于调用翻译引擎 */
export const LANGUAGE_FULL_NAME: Record<string, string> = Object.fromEntries(
  ALL_LANGUAGES.map((l) => [l.code, l.en]),
);

/** 预览用示例变量值（实际外呼时由目标客户数据填充） */
export const PREVIEW_VARS: Record<string, string> = {
  企业名: "Nordic Trade AB",
  联系人名: "Mr. Andersson",
  行业: "机械设备",
  我的公司: "宁波智造机械",
  我的姓名: "李明",
  活动主题: "2026 汉诺威工业展",
};

/** 用示例值填充变量占位符，得到贴近真实播报的文本 */
export function fillPreviewVars(text: string): string {
  return text.replace(/\{([^}]+)\}/g, (m, k: string) => PREVIEW_VARS[k] ?? m);
}

export const RECORDING_NOTICE = "为保证服务质量，本次通话可能会被录音。";

const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8)}`;

function step(partial: Partial<ScriptStep> & { type: StepType; title: string; content: string }): ScriptStep {
  return { id: uid("st"), branches: [], ...partial };
}

/* ---------------------------- mock 数据 ---------------------------- */

const NOTICE_EN = "This call may be recorded for quality assurance.";

/** 营销外呼：开场 → AI 对话 → 转人工 / 留资 → 结束 */
function marketingSteps(en = false): ScriptStep[] {
  const s1 = step({
    type: "opening",
    title: en ? "Opening" : "开场白",
    content: en
      ? `${NOTICE_EN} Hi, this is {我的姓名} from {我的公司}. Am I speaking with {联系人名} who handles sourcing at {企业名}?`
      : `${RECORDING_NOTICE}您好，我是{我的公司}的{我的姓名}，请问是{企业名}负责采购的{联系人名}吗？`,
  });
  const s2 = step({
    type: "ai",
    title: en ? "AI Conversation" : "AI 对话",
    content: en
      ? "You are the AI sales assistant of {我的公司} calling {企业名}. Goal: understand their sourcing plan and qualify the lead.\nRules:\n- If the buyer says \"not interested\" → close politely\n- If asked about price → offer to send a quotation and ask for an email\n- After 3 turns → ask for a clear next step"
      : "你是{我的公司}的 AI 业务助理，正在致电{企业名}。目标：了解对方近期的采购计划并判断合作意向。\n规则：\n- 客户说“不需要”“没兴趣” → 礼貌结束\n- 客户询问价格/MOQ/交期 → 依据企业知识库简要回答，并引导留邮箱发报价单\n- 对话超过 3 轮 → 引导客户明确下一步",
    maxTurns: 5,
    useKnowledge: true,
    variables: ["企业名", "联系人名", "我的公司"],
  });
  const s3 = step({
    type: "transfer",
    title: en ? "Transfer to Agent" : "转人工",
    content: en ? "Great, let me connect you with our specialist. One moment please." : "好的，我这边为您转接专属顾问，请稍等。",
    agentGroup: en ? "海外组" : "外贸一组",
    ringTimeout: 20,
    fallback: en
      ? "Our specialist is on another call. We will reach out shortly. Thank you for your time."
      : "顾问当前正忙，稍后会由专人与您联系，感谢您的时间。",
  });
  const s4 = step({
    type: "collect",
    title: en ? "Collect Contact" : "留资 / 发资料",
    content: en
      ? "Could you share your email? I will send our catalogue and price list right away."
      : "方便留一个邮箱吗？我把产品目录和报价单发给您。",
  });
  const s5 = step({
    type: "ending",
    title: en ? "Closing" : "结束语",
    content: en ? "Thank you for your time, have a great day. Goodbye." : "感谢您的时间，祝您工作顺利，再见。",
  });
  s2.branches = [
    { id: uid("br"), label: en ? "Interested" : "有意向", to: s3.id },
    { id: uid("br"), label: en ? "Send materials" : "需要考虑 / 要资料", to: s4.id },
    { id: uid("br"), label: en ? "Rejected" : "明确拒绝", to: s5.id },
  ];
  s3.branches = [{ id: uid("br"), label: en ? "Transfer failed" : "转接失败", to: s4.id }];
  s4.branches = [{ id: uid("br"), label: en ? "Collected" : "已留资", to: s5.id }];
  return [s1, s2, s3, s4, s5];
}

/** 语音通知：开场（含通知内容）→ 确认 → 结束，无转人工 */
function notifySteps(variant: "order" | "renew"): ScriptStep[] {
  const isOrder = variant === "order";
  const s1 = step({
    type: "opening",
    title: "开场白",
    content: isOrder
      ? `${RECORDING_NOTICE}您好，这里是{我的公司}客户服务，请问是{企业名}的{联系人名}吗？占用您 30 秒同步一条订单进度信息。`
      : `${RECORDING_NOTICE}您好，这里是{我的公司}客户服务，请问是{企业名}的{联系人名}吗？您的服务将于近期到期，占用您 30 秒同步续约信息。`,
  });
  const s2 = step({
    type: "ai",
    title: "通知内容确认",
    content: isOrder
      ? "播报订单进度：您的订单已于本周完成生产并安排出运，预计到港时间与提单号会同步发送至您的邮箱。\n规则：\n- 客户表示已知悉 → 进入结束语\n- 客户提出异议或询问细节 → 记录问题并告知 2 小时内由跟单员回电\n- 不做任何销售推荐"
      : "播报续约信息：您当前的服务将于{活动主题}到期，续约可延续现有价格与服务等级。\n规则：\n- 客户明确续约意愿 → 进入留资确认\n- 客户表示考虑 → 记录并结束\n- 客户明确拒绝 → 记录退订偏好并结束",
    maxTurns: 3,
    useKnowledge: false,
    variables: ["企业名", "联系人名", "我的公司"],
  });
  const s3 = step({
    type: "collect",
    title: "留资 / 发资料",
    content: isOrder
      ? "我把物流跟踪链接发到您邮箱，请确认下邮箱是否仍是我们系统里登记的这个？"
      : "我把续约方案与报价发到您邮箱，请确认下接收邮箱。",
  });
  const s4 = step({ type: "ending", title: "结束语", content: "以上信息已同步给您，感谢接听，再见。" });
  s2.branches = [
    { id: uid("br"), label: "已知悉", to: s4.id },
    { id: uid("br"), label: "需要资料 / 有异议", to: s3.id },
  ];
  s3.branches = [{ id: uid("br"), label: "已确认", to: s4.id }];
  return [s1, s2, s3, s4];
}

/** 客户回访：开场 → 满意度/进展 AI 对话 → 转人工 → 结束 */
function revisitSteps(variant: "csat" | "quote"): ScriptStep[] {
  const isCsat = variant === "csat";
  const s1 = step({
    type: "opening",
    title: "开场白",
    content: isCsat
      ? `${RECORDING_NOTICE}您好，我是{我的公司}的{我的姓名}，上批货到货后想做一次简短回访，方便耽误您两分钟吗？`
      : `${RECORDING_NOTICE}您好，我是{我的公司}的{我的姓名}，上周给{企业名}发过一份报价单，想跟您确认下是否收到、有没有需要补充的信息？`,
  });
  const s2 = step({
    type: "ai",
    title: "AI 对话",
    content: isCsat
      ? "你是{我的公司}的客户成功助理，正在回访{企业名}。目标：确认到货与使用体验，收集问题并识别复购/追加需求。\n规则：\n- 客户反馈质量或物流问题 → 致歉并转人工\n- 客户满意 → 询问下一批采购计划\n- 全程不催单、不硬推销"
      : "你是{我的公司}的业务助理，正在跟进{企业名}的报价。目标：确认报价是否收到、判断价格/交期/规格上的顾虑并推进下一步。\n规则：\n- 客户嫌价格高 → 了解目标价与数量，不当场承诺折扣\n- 客户需要样品 → 引导留收件信息\n- 客户已选择其他供应商 → 记录原因并礼貌结束",
    maxTurns: 6,
    useKnowledge: true,
    variables: ["企业名", "联系人名", "我的公司"],
  });
  const s3 = step({
    type: "transfer",
    title: "转人工",
    content: "这个问题我帮您转接对应的顾问处理，请稍等。",
    agentGroup: "外贸一组",
    ringTimeout: 25,
    fallback: "顾问暂时未接通，我已记录您的问题，稍后会有专人回电，感谢理解。",
  });
  const s4 = step({
    type: "collect",
    title: "留资 / 发资料",
    content: isCsat ? "我把新品目录发到您邮箱，方便确认下邮箱地址吗？" : "我把修订后的报价单和样品说明发到您邮箱，方便确认下邮箱地址吗？",
  });
  const s5 = step({ type: "ending", title: "结束语", content: "谢谢您的反馈，后续有需要随时联系我们，再见。" });
  s2.branches = [
    { id: uid("br"), label: "有问题需处理", to: s3.id },
    { id: uid("br"), label: "有复购 / 推进意向", to: s4.id },
    { id: uid("br"), label: "暂无需求", to: s5.id },
  ];
  s3.branches = [{ id: uid("br"), label: "转接失败", to: s5.id }];
  s4.branches = [{ id: uid("br"), label: "已留资", to: s5.id }];
  return [s1, s2, s3, s4, s5];
}

/** 展会邀约：开场 → 邀约 AI 对话 → 留资（发邀请函）→ 转人工 → 结束 */
function inviteSteps(en = false): ScriptStep[] {
  const s1 = step({
    type: "opening",
    title: en ? "Opening" : "开场白",
    content: en
      ? `${NOTICE_EN} Hi, this is {我的姓名} from {我的公司}. We are hosting {活动主题} and would like to invite {企业名} to join.`
      : `${RECORDING_NOTICE}您好，我是{我的公司}的{我的姓名}，我们将参加{活动主题}，想邀请{企业名}的{联系人名}到展位交流，方便占用一分钟吗？`,
  });
  const s2 = step({
    type: "ai",
    title: en ? "AI Conversation" : "AI 对话",
    content: en
      ? "You are the AI assistant of {我的公司} inviting {企业名} to {活动主题}. Goal: confirm attendance and book a booth meeting slot.\nRules:\n- If they will attend → propose a time slot and collect email for the invitation\n- If they cannot attend → offer an online session instead\n- Never push more than twice"
      : "你是{我的公司}的 AI 助理，正在邀约{企业名}参加{活动主题}。目标：确认是否到场、预约展位洽谈时段。\n规则：\n- 客户确认到场 → 推荐时段并引导留邮箱发送邀请函与展位号\n- 客户无法到场 → 改约线上会议或寄送资料\n- 最多推进两次，避免打扰",
    maxTurns: 5,
    useKnowledge: true,
    variables: ["企业名", "联系人名", "活动主题"],
  });
  const s3 = step({
    type: "collect",
    title: en ? "Send Invitation" : "留资 / 发邀请函",
    content: en
      ? "May I have your email? I will send the invitation with our booth number and the agenda."
      : "方便留一个邮箱吗？我把电子邀请函、展位号和议程发给您。",
  });
  const s4 = step({
    type: "transfer",
    title: en ? "Transfer to Agent" : "转人工",
    content: en ? "Let me connect you with the organiser for the detailed agenda." : "关于洽谈安排，我为您转接负责的顾问，请稍等。",
    agentGroup: en ? "海外组" : "外贸一组",
    ringTimeout: 20,
    fallback: en ? "The organiser is busy; the invitation will be emailed to you shortly." : "顾问当前正忙，邀请函稍后会发送到您的邮箱，感谢您的时间。",
  });
  const s5 = step({
    type: "ending",
    title: en ? "Closing" : "结束语",
    content: en ? "Looking forward to meeting you at the show. Goodbye." : "期待展会现场与您见面，再见。",
  });
  s2.branches = [
    { id: uid("br"), label: en ? "Will attend" : "确认到场", to: s3.id },
    { id: uid("br"), label: en ? "Needs details" : "需要详细安排", to: s4.id },
    { id: uid("br"), label: en ? "Cannot attend" : "无法到场", to: s5.id },
  ];
  s3.branches = [{ id: uid("br"), label: en ? "Collected" : "已留资", to: s5.id }];
  s4.branches = [{ id: uid("br"), label: en ? "Transfer failed" : "转接失败", to: s5.id }];
  return [s1, s2, s3, s4, s5];
}

/** 其他：询盘核验 / 沉默客户激活 */
function otherSteps(variant: "verify" | "reactivate"): ScriptStep[] {
  const isVerify = variant === "verify";
  const s1 = step({
    type: "opening",
    title: "开场白",
    content: isVerify
      ? `${RECORDING_NOTICE}您好，我是{我的公司}的{我的姓名}，我们收到了来自{企业名}的询盘，想跟您核实几项信息，方便吗？`
      : `${RECORDING_NOTICE}您好，我是{我的公司}的{我的姓名}，我们之前有过合作/联系，想确认下{企业名}今年的采购安排是否有变化。`,
  });
  const s2 = step({
    type: "ai",
    title: "AI 对话",
    content: isVerify
      ? "你是{我的公司}的 AI 助理，正在核验{企业名}提交的询盘真实性并补全信息。目标：确认公司主体、采购品类、数量与目标市场。\n规则：\n- 信息一致且需求明确 → 判定为真实询盘，转人工\n- 对方不清楚询盘内容或信息矛盾 → 标记为待核实，不转人工\n- 不索要银行、支付相关信息"
      : "你是{我的公司}的 AI 助理，正在激活长期未互动的{企业名}。目标：确认联系人是否仍在职、今年是否仍有采购需求。\n规则：\n- 联系人已变更 → 询问新对接人姓名与联系方式\n- 明确表示不再需要 → 确认加入退订名单并结束\n- 有需求 → 引导留邮箱发送最新产品与价格",
    maxTurns: 5,
    useKnowledge: true,
    variables: ["企业名", "联系人名", "我的公司"],
  });
  const s3 = step({
    type: "transfer",
    title: "转人工",
    content: "信息我已核对，现在为您转接对应顾问继续沟通，请稍等。",
    agentGroup: "外贸一组",
    ringTimeout: 20,
    fallback: "顾问当前正忙，稍后会由专人与您联系，感谢您的时间。",
  });
  const s4 = step({
    type: "collect",
    title: "留资 / 发资料",
    content: isVerify ? "方便留一个常用邮箱吗？我把规格确认表发给您。" : "方便留一个邮箱吗？我把今年的新品与价格表发给您。",
  });
  const s5 = step({
    type: "ending",
    title: "结束语",
    content: isVerify ? "感谢您的配合，我们会尽快回复您的询盘，再见。" : "打扰了，后续有需要随时联系我们，祝您顺利，再见。",
  });
  s2.branches = [
    { id: uid("br"), label: isVerify ? "询盘属实" : "仍有需求", to: s3.id },
    { id: uid("br"), label: "需要资料", to: s4.id },
    { id: uid("br"), label: isVerify ? "信息存疑" : "不再需要 / 退订", to: s5.id },
  ];
  s3.branches = [{ id: uid("br"), label: "转接失败", to: s4.id }];
  s4.branches = [{ id: uid("br"), label: "已留资", to: s5.id }];
  return [s1, s2, s3, s4, s5];
}

function buildDefaultSteps(scene: ScriptScene): ScriptStep[] {
  if (scene === "notify") return notifySteps("order");
  if (scene === "revisit") return revisitSteps("csat");
  if (scene === "invite") return inviteSteps();
  if (scene === "other") return otherSteps("verify");
  return marketingSteps();
}

const today = new Date();
const day = (n: number) => new Date(today.getTime() - n * 86400000).toISOString().slice(0, 10);

const T = TEMPLATE_INDUSTRY;

let scripts: VoiceScript[] = [
  /* ---------- 营销外呼 ---------- */
  {
    id: "tpl-001",
    name: "新客首轮开发 · 意向初筛",
    scene: "marketing",
    industry: T,
    language: "zh",
    owner: "platform",
    status: "published",
    steps: marketingSteps(),
    updatedAt: day(3),
    updatedBy: "平台运营 · 李珊",
    usedCount: 1862,
    recommended: true,
    avgDuration: 95,
    desc: "面向陌生客户的首轮外呼，30 秒说明来意，AI 判断采购计划与合作意向，高意向直接转人工，中意向留邮箱发资料。",
    tags: ["新客开发", "意向初筛", "转人工"],
  },
  {
    id: "tpl-002",
    name: "海外买家陌拜 · 快速筛需求",
    scene: "marketing",
    industry: T,
    language: "zh",
    owner: "platform",
    status: "published",
    steps: marketingSteps(),
    updatedAt: day(8),
    updatedBy: "平台运营 · 王琳",
    usedCount: 947,
    avgDuration: 88,
    desc: "面向海外买家的陌拜版本，语气简洁直接，30 秒内说明来意，价格问题统一引导至报价单；创建话术时可切换外呼语言。",
    tags: ["陌拜", "快速筛需求", "报价引导"],
  },

  /* ---------- 语音通知 ---------- */
  {
    id: "tpl-003",
    name: "订单进度与出运通知",
    scene: "notify",
    industry: T,
    language: "zh",
    owner: "platform",
    status: "published",
    steps: notifySteps("order"),
    updatedAt: day(11),
    updatedBy: "平台运营 · 李珊",
    usedCount: 613,
    avgDuration: 52,
    desc: "纯通知类话术，播报生产与出运进度，不做任何销售推荐；客户有异议时记录并转由跟单员回电。",
    tags: ["订单通知", "无销售", "短通话"],
  },
  {
    id: "tpl-004",
    name: "服务到期与续约提醒",
    scene: "notify",
    industry: T,
    language: "zh",
    owner: "platform",
    status: "published",
    steps: notifySteps("renew"),
    updatedAt: day(17),
    updatedBy: "平台运营 · 李珊",
    usedCount: 388,
    avgDuration: 61,
    desc: "到期前 15 天提醒续约，确认续约意愿后发送方案与报价，明确拒绝则写入退订偏好。",
    tags: ["续约", "到期提醒", "退订合规"],
  },

  /* ---------- 客户回访 ---------- */
  {
    id: "tpl-005",
    name: "成交客户满意度回访",
    scene: "revisit",
    industry: T,
    language: "zh",
    owner: "platform",
    status: "published",
    steps: revisitSteps("csat"),
    updatedAt: day(5),
    updatedBy: "平台运营 · 陈昊",
    usedCount: 1024,
    recommended: true,
    avgDuration: 132,
    desc: "到货后回访，收集质量与物流反馈，识别复购与追加需求；出现质量投诉自动转人工，避免 AI 处理纠纷。",
    tags: ["满意度", "复购挖掘", "投诉转人工"],
  },
  {
    id: "tpl-006",
    name: "报价后 7 天跟进",
    scene: "revisit",
    industry: T,
    language: "zh",
    owner: "platform",
    status: "published",
    steps: revisitSteps("quote"),
    updatedAt: day(14),
    updatedBy: "平台运营 · 陈昊",
    usedCount: 756,
    avgDuration: 118,
    desc: "报价单发出后的标准跟进，确认接收情况并挖掘价格、交期、规格上的真实顾虑，不当场承诺折扣。",
    tags: ["报价跟进", "异议处理", "样品"],
  },

  /* ---------- 展会邀约 ---------- */
  {
    id: "tpl-007",
    name: "展会到展邀约 · 展位预约",
    scene: "invite",
    industry: T,
    language: "zh",
    owner: "platform",
    status: "published",
    steps: inviteSteps(),
    updatedAt: day(2),
    updatedBy: "平台运营 · 李珊",
    usedCount: 542,
    avgDuration: 76,
    desc: "展前 3 周批量邀约，确认到场后预约展位洽谈时段并发送电子邀请函；无法到场改约线上会议。",
    tags: ["展会", "预约时段", "邀请函"],
  },
  {
    id: "tpl-008",
    name: "线上发布会 / 直播邀约",
    scene: "invite",
    industry: T,
    language: "zh",
    owner: "platform",
    status: "published",
    steps: inviteSteps(),
    updatedAt: day(9),
    updatedBy: "平台运营 · 王琳",
    usedCount: 301,
    avgDuration: 70,
    desc: "线上活动邀约，适用于新品发布会与行业直播，确认参会后发送日程与会议链接。",
    tags: ["线上活动", "新品发布", "参会确认"],
  },

  /* ---------- 其他 ---------- */
  {
    id: "tpl-009",
    name: "询盘真实性核验与信息补全",
    scene: "other",
    industry: T,
    language: "zh",
    owner: "platform",
    status: "published",
    steps: otherSteps("verify"),
    updatedAt: day(6),
    updatedBy: "平台运营 · 陈昊",
    usedCount: 469,
    avgDuration: 104,
    desc: "配合「意向真实度」模块使用：电话核验询盘主体、品类、数量与目标市场，属实转人工，存疑标记待核实。",
    tags: ["询盘核验", "反欺诈", "信息补全"],
  },
  {
    id: "tpl-010",
    name: "沉默客户激活与联系人更新",
    scene: "other",
    industry: T,
    language: "zh",
    owner: "platform",
    status: "published",
    steps: otherSteps("reactivate"),
    updatedAt: day(21),
    updatedBy: "平台运营 · 李珊",
    usedCount: 233,
    avgDuration: 97,
    desc: "唤醒 6 个月以上无互动的老客户，核实联系人是否在职并更新对接人，明确拒绝的自动加入退订名单。",
    tags: ["客户激活", "联系人更新", "退订合规"],
  },
  {
    id: "tpl-011",
    name: "节日问候与关系维护（下架中）",
    scene: "other",
    industry: T,
    language: "zh",
    owner: "platform",
    status: "offline",
    steps: otherSteps("reactivate"),
    updatedAt: day(45),
    updatedBy: "平台运营 · 李珊",
    usedCount: 88,
    avgDuration: 45,
    desc: "节假日问候话术，内容季节性较强，非节日期间下架维护。",
    tags: ["关系维护", "季节性"],
  },

  /* ---------- 租户话术 ---------- */
  {
    id: "scr-001",
    name: "东南亚储能客户 8 月回访",
    scene: "revisit",
    industry: "新能源",
    language: "zh",
    owner: "tenant",
    status: "published",
    steps: revisitSteps("csat"),
    updatedAt: day(1),
    region: "eu",
    updatedBy: "张明",
    usedCount: 1240,
    intentRateA: 18,
    fromTemplateId: "tpl-005",
  },
  {
    id: "scr-002",
    name: "机械配件询盘跟进（草稿）",
    scene: "marketing",
    industry: "机械设备",
    language: "zh",
    owner: "tenant",
    status: "draft",
    steps: marketingSteps(),
    updatedAt: day(4),
    region: "sea",
    updatedBy: "王倩",
    usedCount: 0,
    fromTemplateId: "tpl-001",
  },
];

/* ---------------------------- 人工坐席 ---------------------------- */

export interface Agent {
  id: string;
  name: string;
  group: string;
  phone: string;
  timezone: string;
  workStart: string;
  workEnd: string;
  languages: string[];
  maxConcurrency: number;
  priority: number;
  enabled: boolean;
}

let agents: Agent[] = [
  {
    id: "ag-001",
    name: "张明",
    group: "外贸一组",
    phone: "+8613800138001",
    timezone: "Asia/Shanghai",
    workStart: "09:00",
    workEnd: "18:00",
    languages: ["zh", "en"],
    maxConcurrency: 2,
    priority: 1,
    enabled: true,
  },
  {
    id: "ag-002",
    name: "王倩",
    group: "外贸一组",
    phone: "+8613900139002",
    timezone: "Asia/Shanghai",
    workStart: "10:00",
    workEnd: "19:00",
    languages: ["zh"],
    maxConcurrency: 1,
    priority: 2,
    enabled: true,
  },
  {
    id: "ag-003",
    name: "Leo Chen",
    group: "海外组",
    phone: "+6598765432",
    timezone: "Asia/Singapore",
    workStart: "09:00",
    workEnd: "18:00",
    languages: ["en", "zh"],
    maxConcurrency: 2,
    priority: 1,
    enabled: false,
  },
];

export type TransferStrategy = "sequential" | "roundrobin" | "idlest";
export const TRANSFER_STRATEGIES: { key: TransferStrategy; label: string }[] = [
  { key: "sequential", label: "顺序转接（按优先级）" },
  { key: "roundrobin", label: "轮询转接" },
  { key: "idlest", label: "最空闲优先" },
];

/* ---------------------------- 数据与合规 ---------------------------- */

export interface ComplianceSettings {
  /** 录音留存月数 */
  recordingMonths: number;
  /** 转写文本留存月数 */
  transcriptMonths: number;
  /** 列表展示手机号打码 */
  maskPhone: boolean;
  /** 邮箱打码 */
  maskEmail: boolean;
  /** 敏感字段（卡号/证件号/验证码）过滤 */
  filterSensitive: boolean;
  /** 客户拒绝录音时仅保留文本 */
  stopOnRefusal: boolean;
  /** 录音告知语 */
  notice: string;
}

let compliance: ComplianceSettings = {
  recordingMonths: 6,
  transcriptMonths: 12,
  maskPhone: true,
  maskEmail: true,
  filterSensitive: true,
  stopOnRefusal: true,
  notice: RECORDING_NOTICE,
};

export const RECORDING_MONTH_OPTIONS = [3, 6, 12];
export const TRANSCRIPT_MONTH_OPTIONS = [6, 12, 24];
export const METADATA_MONTHS = 24;

/* ---------------------------- store ---------------------------- */

const listeners = new Set<() => void>();
let version = 0;
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getVersion = () => version;

function useStore<T>(select: () => T): T {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return select();
}

/* ---------------------------- 话术 API ---------------------------- */

export function useScripts(owner?: "platform" | "tenant"): VoiceScript[] {
  return useStore(() => (owner ? scripts.filter((s) => s.owner === owner) : scripts));
}

export function useScript(id: string): VoiceScript | undefined {
  return useStore(() => scripts.find((s) => s.id === id));
}

export function getScript(id: string) {
  return scripts.find((s) => s.id === id);
}

/** 可用于外呼任务的话术（租户已发布） */
export function usePublishedScripts(): VoiceScript[] {
  return useStore(() => scripts.filter((s) => s.owner === "tenant" && s.status === "published"));
}

export function createScript(input: {
  name: string;
  scene: ScriptScene;
  industry: string;
  language: string;
  owner: "platform" | "tenant";
}): VoiceScript {
  const s: VoiceScript = {
    id: uid(input.owner === "platform" ? "tpl" : "scr"),
    name: input.name,
    scene: input.scene,
    industry: input.industry,
    language: input.language,
    owner: input.owner,
    status: "draft",
    steps: buildDefaultSteps(input.scene),
    updatedAt: new Date().toISOString().slice(0, 10),
    updatedBy: input.owner === "platform" ? "平台运营" : "我",
    usedCount: 0,
  };
  scripts = [s, ...scripts];
  emit();
  return s;
}

export function updateScript(id: string, patch: Partial<VoiceScript>) {
  scripts = scripts.map((s) =>
    s.id === id
      ? { ...s, ...patch, updatedAt: new Date().toISOString().slice(0, 10) }
      : s,
  );
  emit();
}

export function deleteScript(id: string) {
  scripts = scripts.filter((s) => s.id !== id);
  emit();
}

export function duplicateScript(id: string, name?: string): VoiceScript | undefined {
  const src = scripts.find((s) => s.id === id);
  if (!src) return;
  const copy: VoiceScript = {
    ...src,
    id: uid("scr"),
    name: name ?? `${src.name}（副本）`,
    steps: JSON.parse(JSON.stringify(src.steps)) as ScriptStep[],
    status: "draft",
    updatedAt: new Date().toISOString().slice(0, 10),
    updatedBy: "我",
    usedCount: 0,
    intentRateA: undefined,
  };
  scripts = [copy, ...scripts];
  emit();
  return copy;
}

/** 模板市场「使用模板创建话术」：基于平台模板生成一份租户话术 */
export function createScriptFromTemplate(
  templateId: string,
  overrides?: { name?: string; language?: string; region?: string },
): VoiceScript | undefined {
  const src = scripts.find((s) => s.id === templateId);
  if (!src) return;
  const copy: VoiceScript = {
    ...src,
    id: uid("scr"),
    owner: "tenant",
    name: overrides?.name?.trim() || src.name,
    language: overrides?.language || src.language,
    region: overrides?.region || "global",
    steps: JSON.parse(JSON.stringify(src.steps)) as ScriptStep[],
    status: "draft",
    fromTemplateId: src.id,
    updatedAt: new Date().toISOString().slice(0, 10),
    updatedBy: "我",
    usedCount: 0,
    recommended: false,
  };
  scripts = [copy, ...scripts.map((s) => (s.id === templateId ? { ...s, usedCount: s.usedCount + 1 } : s))];
  emit();
  return copy;
}

export function newStep(type: StepType): ScriptStep {
  const meta = STEP_TYPES.find((t) => t.key === type)!;
  return step({ type, title: meta.label, content: "", maxTurns: type === "ai" ? 5 : undefined });
}

/** 发布前校验 */
export function validateScript(s: VoiceScript): string[] {
  const errs: string[] = [];
  const ids = new Set(s.steps.map((x) => x.id));
  if (s.steps.length === 0) errs.push("话术至少需要一个步骤");
  if (!s.steps.some((x) => x.type === "opening")) errs.push("缺少「开场白」步骤");
  if (!s.steps.some((x) => x.type === "ending")) errs.push("缺少「结束语」步骤");
  s.steps.forEach((x, i) => {
    if (!x.content.trim()) errs.push(`步骤 ${i + 1}「${x.title}」内容为空`);
    if (x.type === "opening" && !x.content.includes(RECORDING_NOTICE.slice(0, 8)))
      errs.push(`步骤 ${i + 1}「${x.title}」缺少录音告知语（合规要求）`);
    if (x.type === "transfer" && !agents.some((a) => a.enabled && a.group === x.agentGroup))
      errs.push(`步骤 ${i + 1}「${x.title}」所选坐席组无启用坐席，请先在 企业设置 → 人工坐席 配置`);
    x.branches.forEach((b) => {
      if (!b.to || (b.to !== END_TARGET && !ids.has(b.to)))
        errs.push(`步骤 ${i + 1}「${x.title}」分支「${b.label}」未指定有效跳转目标`);
    });
  });
  return errs;
}

/* ---------------------------- 坐席 API ---------------------------- */

export function useAgents(): Agent[] {
  return useStore(() => agents);
}

export function getAgentGroups(): string[] {
  return Array.from(new Set(agents.map((a) => a.group)));
}

export function useAgentGroups(): string[] {
  return useStore(() => Array.from(new Set(agents.map((a) => a.group))));
}

export function hasEnabledAgents(): boolean {
  return agents.some((a) => a.enabled);
}

export function saveAgent(a: Omit<Agent, "id"> & { id?: string }) {
  if (a.id) {
    agents = agents.map((x) => (x.id === a.id ? ({ ...x, ...a } as Agent) : x));
  } else {
    agents = [...agents, { ...a, id: uid("ag") } as Agent];
  }
  emit();
}

export function deleteAgent(id: string) {
  agents = agents.filter((a) => a.id !== id);
  emit();
}

export function toggleAgent(id: string) {
  agents = agents.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a));
  emit();
}

/* ---------------------------- 合规 API ---------------------------- */

export function useCompliance(): ComplianceSettings {
  return useStore(() => compliance);
}

export function updateCompliance(patch: Partial<ComplianceSettings>) {
  compliance = { ...compliance, ...patch };
  emit();
}

export function maskPhoneNumber(phone: string): string {
  if (phone.length < 7) return phone;
  return `${phone.slice(0, phone.length - 8)}${"*".repeat(4)}${phone.slice(-4)}`;
}
