import type { Thread } from "@/lib/inbox-store";

export type IntentBand = "high" | "mid" | "low";

export interface IntentDimension {
  key: "activeness" | "product" | "budget" | "decision" | "urgency";
  label: string;
  value: number; // 0-100
}

export interface IntentScoreResult {
  score: number; // 0-100
  band: IntentBand;
  bandLabel: string;
  dimensions: IntentDimension[];
  tags: string[];
  nextAction: string;
  updatedAt: string;
}

const BAND_LABEL: Record<IntentBand, string> = {
  high: "高意向",
  mid: "中意向",
  low: "低意向",
};

/** 稳定哈希（同一 thread.id 输出稳定） */
function seedFrom(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h >>> 0;
}
function rand(seed: number, salt: number) {
  const x = Math.sin(seed + salt) * 10000;
  return x - Math.floor(x);
}
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const KW = {
  budget: /(price|quote|quotation|pdf|budget|cost|报价|价格|预算|pricing)/i,
  urgency: /(asap|urgent|urgente|immediately|deadline|next week|by (mon|tue|wed|thu|fri)|尽快|急|紧急|本周|下周)/i,
  decision: /(ceo|cto|coo|manager|director|purchase|procurement|决策|采购|老板|总监|经理)/i,
  product: /(sku|model|catalog|spec|specification|型号|规格|目录|series|模型|产品)/i,
};

export function scoreIntent(thread: Thread): IntentScoreResult {
  const seed = seedFrom(thread.id);
  const inbound = thread.messages.filter((m) => m.direction === "inbound");
  const outbound = thread.messages.filter((m) => m.direction === "outbound");
  const corpus = inbound.map((m) => m.content).join("\n");
  const intent = thread.meta.aiIntent;

  // 基础噪声（保持稳定，避免整齐划一）
  const noise = (salt: number) => Math.round((rand(seed, salt) - 0.5) * 12);

  // 询价主动性：inbound 条数 + 平均长度
  const avgLen = inbound.length
    ? inbound.reduce((a, m) => a + m.content.length, 0) / inbound.length
    : 0;
  let activeness =
    30 + Math.min(50, inbound.length * 14) + Math.min(20, avgLen / 8);

  // 产品匹配度：关键词命中 + 有回复轮次
  let product =
    45 +
    (KW.product.test(corpus) ? 25 : 0) +
    Math.min(15, outbound.length * 5);

  // 预算可能性：报价关键词
  let budget = 40 + (KW.budget.test(corpus) ? 30 : 0);

  // 决策层接触：关键词命中 + 是否已分配到人
  let decision =
    35 +
    (KW.decision.test(corpus) ? 25 : 0) +
    (thread.meta.assigneeId ? 10 : 0);

  // 时间紧迫度：紧急关键词 + SLA 状态
  let urgency = 40 + (KW.urgency.test(corpus) ? 30 : 0);

  // 意向调节
  if (intent === "interested") {
    activeness += 10; product += 8; budget += 6;
  } else if (intent === "quote") {
    budget += 18; product += 10; urgency += 8;
  } else if (intent === "reject") {
    activeness -= 25; product -= 15; budget -= 25; urgency -= 15;
  } else if (intent === "unsubscribe" || intent === "complaint") {
    activeness -= 30; product -= 20; budget -= 30; decision -= 20;
  } else if (intent === "ooo") {
    urgency -= 20; activeness -= 5;
  }

  const dims: IntentDimension[] = [
    { key: "activeness", label: "询价主动性", value: clamp(activeness + noise(1)) },
    { key: "product", label: "产品匹配度", value: clamp(product + noise(2)) },
    { key: "budget", label: "预算可能性", value: clamp(budget + noise(3)) },
    { key: "decision", label: "决策层接触", value: clamp(decision + noise(4)) },
    { key: "urgency", label: "时间紧迫度", value: clamp(urgency + noise(5)) },
  ];

  // 综合分：加权
  const weights = { activeness: 0.2, product: 0.22, budget: 0.24, decision: 0.14, urgency: 0.2 };
  const score = clamp(
    dims.reduce((a, d) => a + d.value * weights[d.key], 0),
  );

  const band: IntentBand = score >= 80 ? "high" : score >= 60 ? "mid" : "low";

  // 标签
  const tags: string[] = [BAND_LABEL[band]];
  if (intent === "quote") tags.push("报价阶段");
  if (intent === "interested") tags.push("需求确认");
  if (KW.budget.test(corpus)) tags.push("询价意图");
  if (KW.urgency.test(corpus)) tags.push("时间敏感");
  if (KW.decision.test(corpus)) tags.push("决策层");
  for (const t of thread.meta.tags ?? []) if (!tags.includes(t)) tags.push(t);

  // 下一步行动
  let nextAction: string;
  if (band === "high") {
    nextAction = KW.budget.test(corpus)
      ? "整理完整报价单（规格+价格+交期），24 小时内回复对方，抄送团队负责人"
      : "邀约 30 分钟视频/电话，确认关键需求后立即出具正式报价";
  } else if (band === "mid") {
    nextAction = "补充产品资料与案例，2 个工作日内二次跟进以确认预算与决策链";
  } else {
    nextAction = "加入 nurturing 序列，按月推送行业内容，等待更强意向信号再重启";
  }

  return {
    score,
    band,
    bandLabel: BAND_LABEL[band],
    dimensions: dims,
    tags,
    nextAction,
    updatedAt: thread.lastAt,
  };
}
