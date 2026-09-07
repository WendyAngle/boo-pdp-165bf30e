import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  /** 推广产品（1-3 个） */
  products: z.array(z.string().min(1).max(60)).min(1).max(3),
  platform: z.string().max(20).optional(),
  industries: z.array(z.string().max(40)).max(5).optional(),
  region: z.string().max(60).optional(),
});

export interface KeywordGroup {
  product: string;
  keywords: string[];
}

/**
 * 按「推广产品」维度推荐社媒加友 / 搜索关键词，每个产品 3-5 个。
 */
export const recommendProductKeywords = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<{ groups: KeywordGroup[] }> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = [
      `你是 B2B 外贸出海获客专家，负责为社媒平台（${data.platform ?? "Facebook / TikTok"}）的目标账号搜索与加好友生成关键词。`,
      `针对每一个「推广产品」，输出 3-5 个关键词：`,
      `1. 关键词用于在社媒平台搜索潜在采购方 / 分销商 / 行业人群，而不是描述我方公司。`,
      `2. 每个产品的关键词需覆盖：产品英文通用名、行业采购角色/场景、上下游行业词。`,
      `3. 以英文为主，可保留 1 个中文关键词。每个关键词 1-4 个词，不含标点与井号。`,
      data.industries?.length ? `我方所属行业：${data.industries.join("、")}。` : "",
      data.region ? `目标地区：${data.region}，可在关键词中体现地区。` : "",
      `严格输出 JSON：{"groups":[{"product":"产品名","keywords":["kw1","kw2","kw3"]}]}，产品名必须与输入完全一致，不要解释。`,
    ]
      .filter(Boolean)
      .join("\n");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `推广产品：\n${data.products.map((p) => `- ${p}`).join("\n")}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      if (resp.status === 429) throw new Error("AI 调用频繁，请稍后再试");
      if (resp.status === 402) throw new Error("AI 额度不足，请联系管理员充值");
      throw new Error(`关键词推荐失败：${resp.status} ${text.slice(0, 160)}`);
    }

    const json = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const parsed = safeParse(raw);

    const groups: KeywordGroup[] = data.products.map((p) => {
      const hit = parsed.find(
        (g) => g.product?.trim().toLowerCase() === p.trim().toLowerCase(),
      );
      const kws = (hit?.keywords ?? [])
        .map((k) => String(k).trim())
        .filter(Boolean)
        .slice(0, 5);
      return { product: p, keywords: kws };
    });

    return { groups };
  });

function safeParse(raw: string): Array<{ product?: string; keywords?: string[] }> {
  const s = raw
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  const tryParse = (t: string) => {
    try {
      const v = JSON.parse(t) as { groups?: Array<{ product?: string; keywords?: string[] }> };
      return Array.isArray(v?.groups) ? v.groups : null;
    } catch {
      return null;
    }
  };
  const direct = tryParse(s);
  if (direct) return direct;
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const sliced = tryParse(s.slice(start, end + 1));
    if (sliced) return sliced;
  }
  return [];
}
