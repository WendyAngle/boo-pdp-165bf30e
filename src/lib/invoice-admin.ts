import { useSyncExternalStore } from "react";

export type AdminTitleType = "company" | "personal";
export type AdminTaxType = "normal" | "special";
export type AdminStatus =
  | "pending_review"
  | "processing"
  | "issued"
  | "rejected"
  | "voided"
  | "replaced";

export interface AdminInvoice {
  id: string;
  applyNo: string;
  tenantId: string;
  tenantName: string;
  tenantContact: string;
  titleType: AdminTitleType;
  title: string;
  taxNo?: string;
  taxType: AdminTaxType;
  content: string;
  amount: number;
  orderNos: string[];
  email: string;
  bankName?: string;
  bankAccount?: string;
  address?: string;
  phone?: string;
  status: AdminStatus;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  rejectReason?: string;
  invoiceNo?: string;
  issuedAt?: string;
  invoiceFileName?: string;
  voidedAt?: string;
  voidReason?: string;
  replacesId?: string;
  replacedById?: string;
}

export interface AdminRules {
  minAmount: number;
  monthlyLimit: number;
  reviewSlaHours: number;
  issueSlaHours: number;
  specialDocs: string[];
}

const K_INV = "boo:admin:invoices:v1";
const K_RULES = "boo:admin:invoice-rules:v1";
const K_SEED = "boo:admin:invoice-seed:v2";

const DEFAULT_RULES: AdminRules = {
  minAmount: 100,
  monthlyLimit: 20,
  reviewSlaHours: 24,
  issueSlaHours: 72,
  specialDocs: ["开户行", "银行账号", "注册地址", "注册电话"],
};

function read<T>(k: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(k);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
function write<T>(k: string, v: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}

let invoices: AdminInvoice[] = read<AdminInvoice[]>(K_INV, []);
let rules: AdminRules = { ...DEFAULT_RULES, ...read<Partial<AdminRules>>(K_RULES, {}) };
let version = 0;
const subs = new Set<() => void>();
const emit = () => {
  version++;
  subs.forEach((f) => f());
};
const subscribe = (cb: () => void) => {
  subs.add(cb);
  return () => subs.delete(cb);
};
const getVersion = () => version;

function id(p: string) {
  return `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
function fmtApplyNo(d: Date, i: number) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `APP${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${String(i).padStart(3, "0")}`;
}
function fmtInvoiceNo(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  const r = Math.floor(Math.random() * 9000 + 1000);
  return `INV${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${r}`;
}

export function seedAdminInvoicesIfEmpty() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(K_SEED)) return;

  const now = Date.now();
  const day = 86400000;
  const mk = (
    daysAgo: number,
    status: AdminStatus,
    tenant: { id: string; name: string; contact: string; email?: string; bankName?: string; bankAccount?: string; address?: string; phone?: string },
    tt: AdminTitleType,
    tx: AdminTaxType,
    title: string,
    taxNo: string | undefined,
    amount: number,
    orderNos: string[],
    extra: Partial<AdminInvoice> = {},
  ): AdminInvoice => {
    const submitted = new Date(now - daysAgo * day);
    const base: AdminInvoice = {
      id: id("adm"),
      applyNo: fmtApplyNo(submitted, Math.floor(Math.random() * 999)),
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantContact: tenant.contact,
      titleType: tt,
      title,
      taxNo,
      taxType: tx,
      content: "信息技术服务费",
      amount,
      orderNos,
      email:
        tt === "company"
          ? (tenant.email ?? "finance@example.cn")
          : "user@qq.com",
      bankName: tx === "special" ? (tenant.bankName ?? "招商银行上海分行营业部") : undefined,
      bankAccount: tx === "special" ? (tenant.bankAccount ?? "1219 0780 1010 999") : undefined,
      address: tx === "special" ? (tenant.address ?? "上海市浦东新区世纪大道 100 号") : undefined,
      phone: tx === "special" ? (tenant.phone ?? "021-5888 6666") : undefined,
      submittedAt: submitted.toISOString(),
      status,
    };
    return { ...base, ...extra };
  };

  const T = [
    {
      id: "t1",
      name: "上海博欧数据科技有限公司",
      contact: "莫文蔚 · 138****6688",
      // 与「费用中心 → 发票管理」中默认抬头保持一致
      email: "finance@boodata.cn",
      bankName: "招商银行上海分行营业部",
      bankAccount: "1219 0780 1010 999",
      address: "上海市浦东新区世纪大道 100 号",
      phone: "021-5888 6666",
    },
    { id: "t2", name: "杭州星联贸易有限公司", contact: "李嘉琪 · 139****2233", email: "finance@xinglian.cn" },
    { id: "t3", name: "深圳锐锋科技有限公司", contact: "张伟 · 137****9911", email: "finance@ruifeng.cn" },
    { id: "t4", name: "广州云汇进出口有限公司", contact: "陈晓 · 133****1122", email: "finance@yunhui.cn" },
    { id: "t5", name: "北京海联信息有限公司", contact: "王芳 · 136****7788", email: "finance@hailian.cn" },
  ];
  const P = [
    { id: "p1", name: "刘敏 · 个人", contact: "刘敏 · 152****3344" },
    { id: "p2", name: "赵磊 · 个人", contact: "赵磊 · 158****9900" },
  ];

  const rev = (d: number, by = "财务小云") => ({
    reviewedAt: new Date(now - d * day).toISOString(),
    reviewedBy: by,
  });
  const iss = (d: number, no: string, file = "invoice.pdf") => ({
    issuedAt: new Date(now - d * day).toISOString(),
    invoiceNo: no,
    invoiceFileName: file,
  });

  invoices = [
    // 待审核 8 条
    mk(0.02, "pending_review", T[0], "company", "normal", T[0].name, "91310000MA1FL12K9X", 1200, ["R20260710093012"]),
    mk(0.08, "pending_review", T[1], "company", "special", T[1].name, "91330100MA2AB33K11", 3600, ["R20260710101122", "R20260710134400"]),
    mk(0.2, "pending_review", T[2], "company", "normal", T[2].name, "91440300MA5EK99K88", 800, ["R20260710160055"]),
    mk(0.5, "pending_review", P[0], "personal", "normal", "刘敏", undefined, 300, ["R20260709210033"]),
    mk(0.6, "pending_review", T[3], "company", "special", T[3].name, "91440101MA9GH88W20", 5400, ["R20260709154422"]),
    mk(0.8, "pending_review", T[4], "company", "normal", T[4].name, "91110108MA01ZZ99X0", 1800, ["R20260709112233"]),
    mk(0.9, "pending_review", T[0], "company", "special", T[0].name, "91310000MA1FL12K9X", 6000, ["R20260709090011", "R20260709103322"]),
    mk(1.1, "pending_review", P[1], "personal", "normal", "赵磊", undefined, 500, ["R20260708190022"]),

    // 开票中 3 条
    mk(1.4, "processing", T[1], "company", "normal", T[1].name, "91330100MA2AB33K11", 1500, ["R20260708150011"], rev(1.3)),
    mk(2.2, "processing", T[2], "company", "special", T[2].name, "91440300MA5EK99K88", 4200, ["R20260707120033"], rev(2.1)),
    mk(3.5, "processing", T[3], "company", "normal", T[3].name, "91440101MA9GH88W20", 900, ["R20260706093344"], rev(3.4)),

    // 已开票 12 条（近 60 天）
    ...([2, 5, 8, 12, 17, 22, 28, 33, 39, 44, 50, 58] as number[]).map((d, i) => {
      const t = i % 2 === 0 ? T[0] : T[i % T.length];
      const tx: AdminTaxType = i % 3 === 0 ? "special" : "normal";
      const amt = 600 + (i * 300) % 3200;
      // 各租户对应的税号，避免所有已开票记录都挂到博欧头上
      const tenantTaxNo: Record<string, string> = {
        t1: "91310000MA1FL12K9X",
        t2: "91330100MA2AB33K11",
        t3: "91440300MA5EK99K88",
        t4: "91440101MA9GH88W20",
        t5: "91110108MA01ZZ99X0",
      };
      return mk(d, "issued", t, "company", tx, t.name, tenantTaxNo[t.id], amt, [`R2026${String(i).padStart(4, "0")}`], {
        ...rev(d + 0.05),
        ...iss(d - 1, fmtInvoiceNo(new Date(now - (d - 1) * day))),
      });
    }),

    // 已驳回 2 条
    mk(4, "rejected", T[4], "company", "special", "北京海联信息有限公司（旧）", "91110000ERROR", 2000, ["R20260706001122"], {
      ...rev(3.8),
      rejectReason: "抬头与税号不匹配，请核对营业执照后重新提交",
    }),
    mk(6, "rejected", T[2], "company", "special", T[2].name, "91440300MA5EK99K88", 3000, ["R20260704003344"], {
      ...rev(5.5),
      rejectReason: "增值税专票缺少开户信息（开户行 / 银行账号）",
    }),

    // 已作废 1 条
    mk(5, "voided", T[1], "company", "normal", T[1].name, "91330100MA2AB33K11", 1000, ["R20260705110000"], {
      ...rev(4.9),
      ...iss(4.8, "INV202607051188"),
      voidedAt: new Date(now - 4 * day).toISOString(),
      voidReason: "客户申请换开为专票",
    }),
  ];

  write(K_INV, invoices);
  window.localStorage.setItem(K_SEED, "1");
  emit();
}

export function useAdminInvoices(): AdminInvoice[] {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return invoices;
}
export function useAdminRules(): AdminRules {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return rules;
}

export function updateRules(patch: Partial<AdminRules>) {
  rules = { ...rules, ...patch };
  write(K_RULES, rules);
  emit();
}

export function approveInvoice(idKey: string, by = "财务小云") {
  invoices = invoices.map((r) =>
    r.id === idKey && r.status === "pending_review"
      ? { ...r, status: "processing", reviewedAt: new Date().toISOString(), reviewedBy: by }
      : r,
  );
  write(K_INV, invoices);
  emit();
}

export function rejectInvoice(idKey: string, reason: string, by = "财务小云") {
  invoices = invoices.map((r) =>
    r.id === idKey && r.status === "pending_review"
      ? {
          ...r,
          status: "rejected",
          reviewedAt: new Date().toISOString(),
          reviewedBy: by,
          rejectReason: reason,
        }
      : r,
  );
  write(K_INV, invoices);
  emit();
}

export function uploadInvoiceFile(
  idKey: string,
  input: { invoiceNo: string; fileName: string; issuedAt?: string },
) {
  invoices = invoices.map((r) =>
    r.id === idKey && r.status === "processing"
      ? {
          ...r,
          status: "issued",
          invoiceNo: input.invoiceNo,
          invoiceFileName: input.fileName,
          issuedAt: input.issuedAt ?? new Date().toISOString(),
        }
      : r,
  );
  write(K_INV, invoices);
  emit();
}

export function voidInvoice(idKey: string, reason: string) {
  invoices = invoices.map((r) =>
    r.id === idKey && r.status === "issued"
      ? { ...r, status: "voided", voidedAt: new Date().toISOString(), voidReason: reason }
      : r,
  );
  write(K_INV, invoices);
  emit();
}

export function replaceInvoice(idKey: string, reason: string) {
  const target = invoices.find((r) => r.id === idKey && r.status === "issued");
  if (!target) return;
  const newId = id("adm");
  const now = new Date();
  const newRecord: AdminInvoice = {
    ...target,
    id: newId,
    applyNo: fmtApplyNo(now, Math.floor(Math.random() * 999)),
    status: "processing",
    submittedAt: now.toISOString(),
    reviewedAt: now.toISOString(),
    invoiceNo: undefined,
    issuedAt: undefined,
    invoiceFileName: undefined,
    voidedAt: undefined,
    voidReason: undefined,
    replacesId: target.id,
    replacedById: undefined,
  };
  invoices = invoices.map((r) =>
    r.id === idKey
      ? { ...r, status: "replaced", replacedById: newId, voidReason: reason }
      : r,
  );
  invoices = [newRecord, ...invoices];
  write(K_INV, invoices);
  emit();
}

export function batchApprove(ids: string[], by = "财务小云") {
  invoices = invoices.map((r) =>
    ids.includes(r.id) && r.status === "pending_review"
      ? { ...r, status: "processing", reviewedAt: new Date().toISOString(), reviewedBy: by }
      : r,
  );
  write(K_INV, invoices);
  emit();
}

export function exportInvoicesCsv(rows: AdminInvoice[]): string {
  const headers = [
    "申请号", "租户", "联系人", "抬头类型", "抬头", "税号", "税种", "金额",
    "关联订单", "邮箱", "状态", "发票号", "开票日期", "审核人", "驳回原因",
  ];
  const statusZh: Record<AdminStatus, string> = {
    pending_review: "待审核",
    processing: "开票中",
    issued: "已开票",
    rejected: "已驳回",
    voided: "已作废",
    replaced: "已换开",
  };
  const escape = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.applyNo,
        r.tenantName,
        r.tenantContact,
        r.titleType === "company" ? "企业" : "个人",
        r.title,
        r.taxNo ?? "",
        r.taxType === "special" ? "专票" : "普票",
        String(r.amount),
        r.orderNos.join(" | "),
        r.email,
        statusZh[r.status],
        r.invoiceNo ?? "",
        r.issuedAt ? r.issuedAt.slice(0, 10) : "",
        r.reviewedBy ?? "",
        r.rejectReason ?? "",
      ].map(escape).join(","),
    );
  }
  return "\uFEFF" + lines.join("\n");
}

export function slaProgress(r: AdminInvoice, rules: AdminRules): { pct: number; label: string; level: "ok" | "warn" | "danger" } | null {
  if (r.status === "pending_review") {
    const elapsed = (Date.now() - new Date(r.submittedAt).getTime()) / 3600000;
    const pct = Math.min(100, (elapsed / rules.reviewSlaHours) * 100);
    const level = pct >= 100 ? "danger" : pct >= 80 ? "warn" : "ok";
    return { pct, label: `审核 ${elapsed.toFixed(1)}h / ${rules.reviewSlaHours}h`, level };
  }
  if (r.status === "processing" && r.reviewedAt) {
    const elapsed = (Date.now() - new Date(r.reviewedAt).getTime()) / 3600000;
    const pct = Math.min(100, (elapsed / rules.issueSlaHours) * 100);
    const level = pct >= 100 ? "danger" : pct >= 80 ? "warn" : "ok";
    return { pct, label: `出票 ${elapsed.toFixed(1)}h / ${rules.issueSlaHours}h`, level };
  }
  return null;
}

export function maskTaxNo(t?: string) {
  if (!t) return "—";
  if (t.length <= 8) return t;
  return `${t.slice(0, 4)}****${t.slice(-4)}`;
}