import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1).max(4000),
});

const InputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
  lang: z.enum(["bi", "zh", "en"]).default("bi"),
});

const TranslateSchema = z.object({
  items: z
    .array(z.object({ id: z.string(), text: z.string().min(1).max(4000) }))
    .min(1)
    .max(40),
  target: z.enum(["bi", "zh", "en"]),
});

const PLATFORM_CONTEXT = `你正在为「出海大数据平台」的用户提供帮助。平台核心能力包括：
- 企业检索（按行业/国家/HS Code）、企业详情与人物（联系人）联系方式（邮箱、电话、WhatsApp、社媒）。
- 提单数据：可看到提单方/收货方、国家、商品、HS Code、数量、最近成交时间等字段。
- 智能触达：对企业/联系人发送邮件或短信，支持 AI 一键生成文案并可手动调整内容与变量。
- 收藏 / 足迹：可批量收藏企业或联系人，后续可在收藏夹中批量触达。
- 积分账单：触达消耗、AI 生成内容消耗、AI 发送内容消耗分类计费；账单可按日期范围筛选与导出，支持发票申请；充值实时到账。
- 收费规则参考：AI 生成邮件/短信按"积分/次"计费，发送邮件/短信另行计费，规则详见账单页"积分规则"。
回答要专业、简洁、结构化（必要时使用短列表），不要编造未提供的数据。`;

function systemPrompt(lang: "bi" | "zh" | "en") {
  if (lang === "zh") {
    return `${PLATFORM_CONTEXT}\n请仅使用中文回答。`;
  }
  if (lang === "en") {
    return `${PLATFORM_CONTEXT}\nRespond ONLY in English. Keep answers concise and professional.`;
  }
  return `${PLATFORM_CONTEXT}\n请先用中文作答，然后另起一行输出"---"，再用英文给出相同含义的回答。`;
}

export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY 未配置");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt(data.lang) },
          ...data.messages,
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      if (resp.status === 429) throw new Error("AI 调用过于频繁，请稍后再试");
      if (resp.status === 402) throw new Error("AI 额度不足，请联系管理员充值");
      throw new Error(`AI 调用失败：${resp.status} ${text.slice(0, 200)}`);
    }
    const json = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return { content: json.choices?.[0]?.message?.content ?? "" };
  });

function translateInstruction(target: "bi" | "zh" | "en") {
  if (target === "zh") return "把下列条目翻译为简体中文，保留原本的语气与结构。";
  if (target === "en") return "Translate the following items into natural English, keep tone and structure.";
  return '将下列条目转换为"双语"格式：先中文，再换行输出"---"，再输出对应英文。';
}

export const translateMessages = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => TranslateSchema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY 未配置");

    const payload = data.items
      .map((it) => `<<<ITEM ${it.id}>>>\n${it.text}\n<<<END ${it.id}>>>`)
      .join("\n\n");

    const sys = `你是翻译助手。${translateInstruction(data.target)}
严格按如下格式输出，每条之间空一行，不要添加任何解释：
<<<ITEM {id}>>>
{translated}
<<<END {id}>>>`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: payload },
        ],
      }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      if (resp.status === 429) throw new Error("AI 调用过于频繁，请稍后再试");
      if (resp.status === 402) throw new Error("AI 额度不足，请联系管理员充值");
      throw new Error(`翻译失败：${resp.status} ${text.slice(0, 200)}`);
    }
    const json = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const result: Record<string, string> = {};
    const re = /<<<ITEM\s+([^>]+?)>>>\s*([\s\S]*?)\s*<<<END\s+\1>>>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      result[m[1].trim()] = m[2].trim();
    }
    // 回退：若解析失败，把原文作为结果，避免阻塞 UI
    for (const it of data.items) if (!result[it.id]) result[it.id] = it.text;
    return { translations: result };
  });