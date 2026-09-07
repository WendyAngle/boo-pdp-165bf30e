// Mock store for platform-side email account inventory.
// See design doc: email-account-management-design-v2.md

export type AccountKind =
  | "subuser"
  | "verified-identity"
  | "sending-domain"
  | "smtp-credential";
export type VerifyState = "verified" | "pending" | "failed";
export type AccountStatus = "available" | "suspended" | "revoked";

export interface EmailAccount {
  id: string;
  providerId: string;
  providerName: string; // 冗余存储便于展示
  identity: string;
  displayName: string;
  kind: AccountKind;
  dkim: VerifyState;
  spf: VerifyState;
  dailyCap: number;
  monthlyCap: number;
  usedToday: number;
  status: AccountStatus;
  assignedTenantId?: string;
  assignedAt?: string;
  pendingTasks?: number;
  cost?: { currency: "USD" | "CNY"; per1k: number };
  notes?: string;
  createdAt: string;
}

export interface TenantLite {
  id: string;
  name: string;
}

/** 演示用租户名录（真实项目应从租户中心接口获取） */
export const DEMO_TENANTS: TenantLite[] = [
  { id: "T-1001", name: "字节科技 (ByteTech)" },
  { id: "T-1002", name: "环球贸易" },
  { id: "T-1003", name: "海通电子" },
  { id: "T-1004", name: "蓝海机械" },
  { id: "T-1005", name: "绿源新能源" },
];

/** Provider 选项（与 email-providers 页保持一致的 id） */
export const PROVIDER_OPTIONS = [
  { id: "sendgrid", name: "SendGrid 主账号" },
  { id: "aws-ses", name: "Amazon SES" },
  { id: "mailgun", name: "Mailgun 备用" },
  { id: "aliyun-dm", name: "阿里云邮件推送" },
  { id: "postmark", name: "Postmark" },
] as const;

export const KIND_LABEL: Record<AccountKind, string> = {
  subuser: "Subuser",
  "verified-identity": "Verified Identity",
  "sending-domain": "Sending Domain",
  "smtp-credential": "SMTP 凭证",
};

const SEED: EmailAccount[] = [
  {
    id: "acc-001",
    providerId: "sendgrid",
    providerName: "SendGrid 主账号",
    identity: "notify@bytetech.cn",
    displayName: "ByteTech 通知邮箱",
    kind: "verified-identity",
    dkim: "verified",
    spf: "verified",
    dailyCap: 20000,
    monthlyCap: 400000,
    usedToday: 3120,
    status: "available",
    assignedTenantId: "T-1001",
    assignedAt: "2025-06-20 10:12",
    pendingTasks: 42,
    createdAt: "2025-06-01",
  },
  {
    id: "acc-002",
    providerId: "sendgrid",
    providerName: "SendGrid 主账号",
    identity: "sub_boo_a",
    displayName: "SendGrid Subuser A",
    kind: "subuser",
    dkim: "verified",
    spf: "verified",
    dailyCap: 30000,
    monthlyCap: 600000,
    usedToday: 0,
    status: "available",
    pendingTasks: 0,
    createdAt: "2025-06-05",
  },
  {
    id: "acc-003",
    providerId: "aws-ses",
    providerName: "Amazon SES",
    identity: "no-reply@boo.com",
    displayName: "SES 平台事务",
    kind: "verified-identity",
    dkim: "verified",
    spf: "verified",
    dailyCap: 100000,
    monthlyCap: 3000000,
    usedToday: 25890,
    status: "available",
    assignedTenantId: "T-1002",
    assignedAt: "2025-05-11 09:00",
    pendingTasks: 0,
    cost: { currency: "USD", per1k: 0.08 },
    notes: "运营指定给环球贸易，独立计价折扣。",
    createdAt: "2025-05-01",
  },
  {
    id: "acc-004",
    providerId: "aws-ses",
    providerName: "Amazon SES",
    identity: "bytetech.cn",
    displayName: "SES · bytetech.cn 域",
    kind: "sending-domain",
    dkim: "verified",
    spf: "verified",
    dailyCap: 50000,
    monthlyCap: 1000000,
    usedToday: 8210,
    status: "available",
    assignedTenantId: "T-1001",
    assignedAt: "2025-06-25 14:30",
    pendingTasks: 5,
    createdAt: "2025-06-20",
  },
  {
    id: "acc-005",
    providerId: "mailgun",
    providerName: "Mailgun 备用",
    identity: "mkt@haitong-e.com",
    displayName: "海通营销邮箱",
    kind: "smtp-credential",
    dkim: "pending",
    spf: "verified",
    dailyCap: 10000,
    monthlyCap: 250000,
    usedToday: 0,
    status: "available",
    pendingTasks: 0,
    createdAt: "2025-07-01",
  },
  {
    id: "acc-006",
    providerId: "aliyun-dm",
    providerName: "阿里云邮件推送",
    identity: "svc@blueocean-m.com",
    displayName: "蓝海机械专用",
    kind: "verified-identity",
    dkim: "verified",
    spf: "verified",
    dailyCap: 15000,
    monthlyCap: 300000,
    usedToday: 1290,
    status: "available",
    assignedTenantId: "T-1004",
    assignedAt: "2025-06-30 16:22",
    pendingTasks: 0,
    createdAt: "2025-06-15",
  },
  {
    id: "acc-007",
    providerId: "aliyun-dm",
    providerName: "阿里云邮件推送",
    identity: "svc2@aliyun-boo.com",
    displayName: "阿里云通用 02",
    kind: "verified-identity",
    dkim: "verified",
    spf: "verified",
    dailyCap: 15000,
    monthlyCap: 300000,
    usedToday: 0,
    status: "available",
    pendingTasks: 0,
    createdAt: "2025-06-28",
  },
  {
    id: "acc-008",
    providerId: "postmark",
    providerName: "Postmark",
    identity: "tx@boo.com",
    displayName: "Postmark 事务",
    kind: "smtp-credential",
    dkim: "failed",
    spf: "verified",
    dailyCap: 5000,
    monthlyCap: 120000,
    usedToday: 0,
    status: "suspended",
    pendingTasks: 0,
    notes: "服务商熔断中，暂停中。",
    createdAt: "2025-04-10",
  },
  {
    id: "acc-009",
    providerId: "sendgrid",
    providerName: "SendGrid 主账号",
    identity: "sub_legacy_x",
    displayName: "旧版 Subuser X",
    kind: "subuser",
    dkim: "verified",
    spf: "verified",
    dailyCap: 10000,
    monthlyCap: 200000,
    usedToday: 0,
    status: "revoked",
    pendingTasks: 0,
    notes: "2025-05 迁移后停用。",
    createdAt: "2024-11-01",
  },
  {
    id: "acc-010",
    providerId: "mailgun",
    providerName: "Mailgun 备用",
    identity: "mkt2@mailgun-boo.com",
    displayName: "Mailgun 备用 02",
    kind: "verified-identity",
    dkim: "pending",
    spf: "pending",
    dailyCap: 8000,
    monthlyCap: 150000,
    usedToday: 0,
    status: "available",
    pendingTasks: 0,
    createdAt: "2025-07-05",
  },
];

let STORE: EmailAccount[] = [...SEED];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getAll(): EmailAccount[] {
  return STORE;
}

export function getTenantName(tenantId?: string): string | undefined {
  if (!tenantId) return undefined;
  return DEMO_TENANTS.find((t) => t.id === tenantId)?.name;
}

/** provider 熔断态（演示：postmark 熔断） */
export function isProviderDown(providerId: string): boolean {
  return providerId === "postmark";
}

export type AssignError =
  | { ok: false; reason: string }
  | { ok: true };

export function canAssign(a: EmailAccount): AssignError {
  if (a.status !== "available") return { ok: false, reason: "账号非可用状态" };
  if (a.dkim !== "verified" || a.spf !== "verified")
    return { ok: false, reason: "DKIM/SPF 未验证通过" };
  if (isProviderDown(a.providerId))
    return { ok: false, reason: "所属服务商熔断中，暂不可分配" };
  return { ok: true };
}

export function canRevoke(a: EmailAccount): AssignError {
  if (a.status === "revoked") return { ok: false, reason: "账号已回收" };
  if ((a.pendingTasks ?? 0) > 0)
    return { ok: false, reason: `尚有 ${a.pendingTasks} 条排队任务，请先清空` };
  return { ok: true };
}

export function assignToTenant(
  ids: string[],
  tenantId: string,
  overrideDailyCap?: number,
): { assigned: number; skipped: Array<{ id: string; reason: string }> } {
  const skipped: Array<{ id: string; reason: string }> = [];
  let assigned = 0;
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  STORE = STORE.map((a) => {
    if (!ids.includes(a.id)) return a;
    const chk = canAssign(a);
    if (!chk.ok) {
      skipped.push({ id: a.id, reason: chk.reason });
      return a;
    }
    assigned += 1;
    return {
      ...a,
      assignedTenantId: tenantId,
      assignedAt: now,
      dailyCap: overrideDailyCap ?? a.dailyCap,
    };
  });
  emit();
  return { assigned, skipped };
}

export function unassign(id: string) {
  STORE = STORE.map((a) =>
    a.id === id ? { ...a, assignedTenantId: undefined, assignedAt: undefined } : a,
  );
  emit();
}

export function revoke(id: string): AssignError {
  const a = STORE.find((x) => x.id === id);
  if (!a) return { ok: false, reason: "账号不存在" };
  const chk = canRevoke(a);
  if (!chk.ok) return chk;
  STORE = STORE.map((x) =>
    x.id === id
      ? { ...x, status: "revoked", assignedTenantId: undefined, assignedAt: undefined }
      : x,
  );
  emit();
  return { ok: true };
}

export function setSuspended(id: string, suspended: boolean) {
  STORE = STORE.map((a) =>
    a.id === id
      ? { ...a, status: suspended ? "suspended" : "available" }
      : a,
  );
  emit();
}

export interface NewAccountInput {
  providerId: string;
  identity: string;
  displayName: string;
  kind: AccountKind;
  dailyCap: number;
  monthlyCap: number;
  notes?: string;
  cost?: { currency: "USD" | "CNY"; per1k: number };
}

export function createAccount(input: NewAccountInput): EmailAccount {
  const providerName =
    PROVIDER_OPTIONS.find((p) => p.id === input.providerId)?.name ?? input.providerId;
  const a: EmailAccount = {
    id: `acc-${Math.random().toString(36).slice(2, 8)}`,
    providerId: input.providerId,
    providerName,
    identity: input.identity,
    displayName: input.displayName,
    kind: input.kind,
    dkim: "pending",
    spf: "pending",
    dailyCap: input.dailyCap,
    monthlyCap: input.monthlyCap,
    usedToday: 0,
    status: "available",
    pendingTasks: 0,
    cost: input.cost,
    notes: input.notes,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  STORE = [a, ...STORE];
  emit();
  return a;
}

// ----- CSV -----
export const CSV_TEMPLATE_HEADERS = [
  "providerId",
  "identity",
  "displayName",
  "kind",
  "dailyCap",
  "monthlyCap",
  "currency",
  "per1k",
  "notes",
] as const;

export const CSV_TEMPLATE_SAMPLE = `${CSV_TEMPLATE_HEADERS.join(",")}
sendgrid,newbox@example.com,示例邮箱,verified-identity,10000,200000,USD,0.85,备注可选
aws-ses,example.com,示例发信域,sending-domain,50000,1000000,USD,0.10,`;

export type ImportRowStatus = "new" | "duplicate" | "invalid";
export interface ImportRow {
  row: number;
  raw: Record<string, string>;
  status: ImportRowStatus;
  message?: string;
  payload?: NewAccountInput;
}

export function parseCsv(text: string): ImportRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((s) => s.trim());
  const rows: ImportRow[] = [];
  const seenInFile = new Set<string>();
  const existing = new Set(STORE.map((a) => `${a.providerId}::${a.identity}`));
  const validKinds: AccountKind[] = ["subuser", "verified-identity", "sending-domain", "smtp-credential"];
  const validProviders = new Set<string>(PROVIDER_OPTIONS.map((p) => p.id));

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((s) => s.trim());
    const raw: Record<string, string> = {};
    header.forEach((h, idx) => (raw[h] = cols[idx] ?? ""));
    const key = `${raw.providerId}::${raw.identity}`;

    if (!raw.providerId || !raw.identity) {
      rows.push({ row: i + 1, raw, status: "invalid", message: "缺少 providerId 或 identity" });
      continue;
    }
    if (!validProviders.has(raw.providerId)) {
      rows.push({ row: i + 1, raw, status: "invalid", message: `未知 providerId：${raw.providerId}` });
      continue;
    }
    if (!validKinds.includes(raw.kind as AccountKind)) {
      rows.push({ row: i + 1, raw, status: "invalid", message: `非法 kind：${raw.kind}` });
      continue;
    }
    if (existing.has(key) || seenInFile.has(key)) {
      rows.push({ row: i + 1, raw, status: "duplicate", message: "identity 已存在，跳过" });
      continue;
    }
    seenInFile.add(key);
    const dailyCap = Number(raw.dailyCap) || 0;
    const monthlyCap = Number(raw.monthlyCap) || 0;
    const per1k = Number(raw.per1k);
    const currency = (raw.currency === "CNY" ? "CNY" : "USD") as "USD" | "CNY";
    rows.push({
      row: i + 1,
      raw,
      status: "new",
      payload: {
        providerId: raw.providerId,
        identity: raw.identity,
        displayName: raw.displayName || raw.identity,
        kind: raw.kind as AccountKind,
        dailyCap,
        monthlyCap,
        notes: raw.notes || undefined,
        cost: Number.isFinite(per1k) && per1k > 0 ? { currency, per1k } : undefined,
      },
    });
  }
  return rows;
}

export function commitImport(rows: ImportRow[]): number {
  let n = 0;
  rows.forEach((r) => {
    if (r.status === "new" && r.payload) {
      createAccount(r.payload);
      n += 1;
    }
  });
  return n;
}