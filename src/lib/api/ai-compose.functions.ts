import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getComposeSpec } from "@/lib/ai-compose-spec";

const InputSchema = z.object({
  channel: z.enum(["email", "sms", "social"]),
  platform: z.string().max(20).optional(),
  scene: z.string().min(1).max(40),
  tone: z.enum(["formal", "friendly", "concise"]).default("friendly"),
  language: z.enum(["zh", "en"]).default("zh"),
  /** 目标语言全称（如 Thai / Japanese），优先于 language */
  languageName: z.string().max(40).optional(),
  extra: z.string().max(500).optional(),
  /** 我方公司 / 个人 信息（供 system prompt 参考） */
  myCompany: z.string().max(120).optional(),
  myName: z.string().max(40).optional(),
  /** 示例收件方（用于让模型知道占位符的语义） */
  sampleEnterprise: z.string().max(120).optional(),
  /** 收件方真实信息（literal 模式下直接写入文案） */
  sampleContact: z.string().max(80).optional(),
  sampleIndustry: z.string().max(80).optional(),
  sampleCity: z.string().max(80).optional(),
  /** true = 不使用任何花括号占位符，直接输出可发送的成品文案 */
  literal: z.boolean().optional(),
});

export const generateAiContent = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");

    const spec = getComposeSpec(data.channel, data.platform);
    const isEmail = spec.hasSubject;
    const langName =
      data.languageName?.trim() || (data.language === "zh" ? "中文" : "English");
    const toneMap = { formal: "正式商务", friendly: "友好诚恳", concise: "简洁直接" } as const;
    const cjk = /中文|日本語|Japanese|한국어|Korean|Chinese/i.test(langName) || data.language === "zh";
    const limitHint = `建议长度 ${cjk ? Math.round(spec.recommendChars / 2) + " 字" : spec.recommendChars + " 字符"}${
      spec.maxChars ? `，绝对不超过 ${cjk ? Math.round(spec.maxChars / 2) + " 字" : spec.maxChars + " 字符"}` : ""
    }。`;

    const systemPrompt = [
      `你是一名资深 B2B 外贸出海销售文案专家，正在为「${data.myCompany ?? "我方公司"}」撰写「${spec.label}」。`,
      `语言: ${langName}；语气: ${toneMap[data.tone]}。全文必须完整使用「${langName}」撰写（专有名词与型号可保留原文），不要输出其他语言的译文。`,
      `【${spec.label} 格式规范】`,
      ...spec.rules.map((r, i) => `${i + 1}. ${r}`),
      `【禁止】${spec.bans.join("；")}。`,
      limitHint,
      ...(data.literal
        ? [
            `【重要】绝对不要输出任何花括号占位符（如 {企业名}{联系人名}{行业}{城市}{我的公司}{我的姓名}），也不要出现方括号/下划线等待填写标记。`,
            `我方信息：公司「${data.myCompany ?? ""}」，联系人「${data.myName ?? ""}」，请直接写入文案。`,
            data.sampleEnterprise || data.sampleContact || data.sampleIndustry || data.sampleCity
              ? `对方信息（如提供则直接写入，未提供的信息一律不要提及、不要留空位）：${[
                  data.sampleContact ? `联系人「${data.sampleContact}」` : "",
                  data.sampleEnterprise ? `企业「${data.sampleEnterprise}」` : "",
                  data.sampleIndustry ? `行业「${data.sampleIndustry}」` : "",
                  data.sampleCity ? `城市「${data.sampleCity}」` : "",
                ]
                  .filter(Boolean)
                  .join("，")}。`
              : `未提供对方具体信息，请使用不指名的通用称呼与表述，不要编造对方公司名、城市或行业。`,
          ]
        : [
            `在文案中合理使用以下占位符（保留花括号原样，发送时会被替换）：`,
            `{企业名} {联系人名} {行业} {城市} {我的公司} {我的姓名}`,
          ]),
      isEmail
        ? `严格输出 JSON：{"subject": "邮件主题（≤60字）","content": "邮件正文（纯文本，含换行）"}。不要解释，不要 Markdown。`
        : `只输出${spec.label}正文本身。不要 JSON，不要 Markdown，不要解释，不要引号包裹，不要输出任何前后缀说明。`,
    ].join("\n");

    const userPrompt = [
      `场景: ${data.scene}`,
      data.extra ? `补充要求: ${data.extra}` : "",
      data.sampleEnterprise ? `示例目标客户: ${data.sampleEnterprise}` : "",
      data.myName ? `落款署名: ${data.myName}` : "",
    ]
      .filter(Boolean)
      .join("\n");



    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        ...(isEmail ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      if (resp.status === 429) throw new Error("AI 调用频繁，请稍后再试");
      if (resp.status === 402) throw new Error("AI 额度不足，请联系管理员充值");
      throw new Error(`AI 生成失败：${resp.status} ${text.slice(0, 200)}`);
    }
    const json = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content ?? "";
    if (isEmail) {
      const parsed = extractJson(raw);
      return {
        subject: parsed.subject ?? "",
        content: parsed.content ?? stripFences(raw),
      };
    }
    return {
      subject: undefined,
      content: stripFences(raw).trim().replace(/^["'`]|["'`]$/g, ""),
    };
  });

function stripFences(s: string): string {
  return s
    .replace(/^\s*```(?:json|text)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function extractJson(raw: string): { subject?: string; content?: string } {
  const s = stripFences(raw);
  try {
    return JSON.parse(s);
  } catch {}
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(s.slice(start, end + 1));
    } catch {}
  }
  const subj = s.match(/"subject"\s*:\s*"([^"]*)"/);
  const cont = s.match(/"content"\s*:\s*"([\s\S]*?)"\s*[},]/);
  if (subj || cont) {
    return {
      subject: subj?.[1],
      content: cont?.[1]?.replace(/\\n/g, "\n"),
    };
  }
  return {};
}