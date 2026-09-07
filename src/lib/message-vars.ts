import { findEnterprise, type Enterprise } from "@/data/enterprises";
import type { FavoriteRecord } from "@/lib/favorites";
import type { LeadProfile } from "@/lib/lead-profile";
import type { CurrentUser } from "@/lib/current-user";

export const MESSAGE_VARIABLES = [
  "企业名",
  "联系人名",
  "行业",
  "城市",
  "我的公司",
  "我的姓名",
] as const;

export type MessageVariable = (typeof MESSAGE_VARIABLES)[number];

export interface VarContext {
  企业名?: string;
  联系人名?: string;
  行业?: string;
  城市?: string;
  我的公司?: string;
  我的姓名?: string;
}

const VAR_RE = /[{｛]\s*(企业名|联系人名|行业|城市|我的公司|我的姓名)\s*[}｝]/g;

/** 变量缺值时的兜底词；未列出的变量（行业/城市）缺值时整体删除 */
export const VAR_FALLBACK: Partial<Record<MessageVariable, string>> = {
  联系人名: "您好",
  企业名: "贵司",
};

/** 删除变量后可能产生的悬空标点 / 多余空白 */
function cleanupBlanks(s: string): string {
  return s
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[（(]\s*[)）]/g, "")
    .replace(/([，,、。;；:：])\s*(?=[，,、。;；:：])/g, "")
    .replace(/(^|\n)[ \t]*[，,、。;；:：]+[ \t]*/g, "$1")
    .replace(/[ \t]+([，,、。;；:：！？])/g, "$1")
    .replace(/\n{3,}/g, "\n\n");
}

export function renderTemplate(tpl: string, ctx: VarContext): string {
  const out = tpl.replace(VAR_RE, (_, k: MessageVariable) => {
    const v = ctx[k];
    if (v && v.trim()) return v.trim();
    return VAR_FALLBACK[k] ?? "";
  });
  return cleanupBlanks(out);
}

/** 文案中实际用到的变量（去重、保持出现顺序） */
export function extractVars(tpl: string): MessageVariable[] {
  const out: MessageVariable[] = [];
  for (const m of tpl.matchAll(VAR_RE)) {
    const v = m[1] as MessageVariable;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

/** 统计各变量在目标集合中缺值的条数（仅统计文案里用到的变量） */
export function missingVarCounts(
  tpl: string,
  ctxs: VarContext[],
): Array<{ variable: MessageVariable; count: number }> {
  return extractVars(tpl)
    .map((variable) => ({
      variable,
      count: ctxs.filter((c) => !c[variable] || !c[variable]!.trim()).length,
    }))
    .filter((x) => x.count > 0);
}


/** 收件人最小信息 */
export interface Recipient {
  /** 唯一 id，用于 React key */
  key: string;
  /** 渠道目标地址（邮箱或电话） */
  address: string;
  /** 触达对象名称（人名或企业名） */
  name: string;
  targetKind: "enterprise" | "contact";
  targetId: string;
  parentRef?: { id: string; name: string };
  ctx: VarContext;
}

function ctxFromEnterprise(e: Enterprise, my: VarContext): VarContext {
  return {
    企业名: e.name,
    联系人名: e.contacts?.[0]?.name,
    行业: e.industry,
    城市: e.city,
    ...my,
  };
}

/** 从收藏记录批量构建邮件收件人 */
export function recipientsFromFavorites(
  records: FavoriteRecord[],
  channel: "email" | "phone",
  my: VarContext,
): Recipient[] {
  const out: Recipient[] = [];
  for (const r of records) {
    if (r.kind === "enterprise") {
      const e = findEnterprise(r.refId);
      if (!e) continue;
      const addr = channel === "email" ? e.email : e.phone;
      if (!addr) continue;
      out.push({
        key: r.id,
        address: addr,
        name: r.title,
        targetKind: "enterprise",
        targetId: r.refId,
        ctx: ctxFromEnterprise(e, my),
      });
    } else if (r.kind === "contact") {
      const addr = channel === "email" ? r.meta?.email : r.meta?.phone;
      if (!addr) continue;
      const entId = r.parentRef?.id ?? r.refId.split(":")[0];
      const idx = r.refId.split(":")[1] ?? "0";
      const e = entId ? findEnterprise(entId) : undefined;
      out.push({
        key: r.id,
        address: addr,
        name: r.title,
        targetKind: "contact",
        targetId: `${entId}:${idx}`,
        parentRef: r.parentRef
          ? { id: r.parentRef.id, name: r.parentRef.name }
          : undefined,
        ctx: {
          企业名: r.parentRef?.name ?? e?.name,
          联系人名: r.title,
          行业: e?.industry,
          城市: e?.city,
          ...my,
        },
      });
    }
  }
  return out;
}

/** 我的画像 → 变量上下文 */
export function myContext(profile: LeadProfile, user: CurrentUser): VarContext {
  return {
    我的公司: profile.companyName,
    我的姓名: user.name,
  };
}

/** 短信按字符数估算条数（中文 70/英文 140） */
export function smsSegments(text: string): number {
  if (!text) return 0;
  const hasNonAscii = /[^\x00-\x7F]/.test(text);
  const per = hasNonAscii ? 70 : 140;
  return Math.max(1, Math.ceil(text.length / per));
}