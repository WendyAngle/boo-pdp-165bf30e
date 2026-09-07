import { useSyncExternalStore } from "react";

export type MailboxStatus = "正常" | "停用" | "异常";
export type MailboxEncryption = "SSL" | "TLS" | "STARTTLS" | "NONE";

export type MailboxProvider =
  | "Gmail"
  | "Outlook"
  | "腾讯企业邮"
  | "阿里企业邮"
  | "网易企业邮"
  | "自定义SMTP";

export interface Mailbox {
  id: string;
  email: string;
  displayName: string;
  provider: MailboxProvider;
  smtpHost: string;
  smtpPort: number;
  encryption: MailboxEncryption;
  /** 收信（IMAP）配置 */
  receiveEnabled: boolean;
  imapHost: string;
  imapPort: number;
  imapEncryption: MailboxEncryption;
  /** 收信通道连通状态 */
  receiveStatus: MailboxReceiveStatus;
  username: string;
  password: string;
  signature?: string;
  dailyLimit: number;
  sentToday: number;
  status: MailboxStatus;
  isDefault: boolean;
  createdAt: string;
  lastTestedAt?: string;

}

export type MailboxReceiveStatus = "收信正常" | "未开启收信" | "收信异常" | "未测试";

export interface MailboxPreset {
  smtpHost: string;
  smtpPort: number;
  encryption: MailboxEncryption;
  imapHost: string;
  imapPort: number;
  imapEncryption: MailboxEncryption;
}

export const PROVIDER_PRESETS: Record<MailboxProvider, MailboxPreset> = {
  Gmail: {
    smtpHost: "smtp.gmail.com",
    smtpPort: 587,
    encryption: "STARTTLS",
    imapHost: "imap.gmail.com",
    imapPort: 993,
    imapEncryption: "SSL",
  },
  Outlook: {
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    encryption: "STARTTLS",
    imapHost: "outlook.office365.com",
    imapPort: 993,
    imapEncryption: "SSL",
  },
  腾讯企业邮: {
    smtpHost: "smtp.exmail.qq.com",
    smtpPort: 465,
    encryption: "SSL",
    imapHost: "imap.exmail.qq.com",
    imapPort: 993,
    imapEncryption: "SSL",
  },
  阿里企业邮: {
    smtpHost: "smtp.qiye.aliyun.com",
    smtpPort: 465,
    encryption: "SSL",
    imapHost: "imap.qiye.aliyun.com",
    imapPort: 993,
    imapEncryption: "SSL",
  },
  网易企业邮: {
    smtpHost: "smtp.qiye.163.com",
    smtpPort: 465,
    encryption: "SSL",
    imapHost: "imap.qiye.163.com",
    imapPort: 993,
    imapEncryption: "SSL",
  },
  自定义SMTP: {
    smtpHost: "",
    smtpPort: 465,
    encryption: "SSL",
    imapHost: "",
    imapPort: 993,
    imapEncryption: "SSL",
  },
};


const KEY = "boo:mailboxes:v1";
const SEED_FLAG = "boo:mailboxes:v4:seeded";

/** 历史数据迁移：补齐收信（IMAP）相关字段 */
function withReceiveDefaults(m: Record<string, unknown>): Mailbox {
  const provider = (m["provider"] as MailboxProvider) ?? "自定义SMTP";
  const preset = PROVIDER_PRESETS[provider] ?? PROVIDER_PRESETS["自定义SMTP"];
  return {
    ...(m as unknown as Mailbox),
    receiveEnabled: (m["receiveEnabled"] as boolean) ?? true,
    imapHost: (m["imapHost"] as string) ?? preset.imapHost,
    imapPort: (m["imapPort"] as number) ?? preset.imapPort,
    imapEncryption: (m["imapEncryption"] as MailboxEncryption) ?? preset.imapEncryption,
    receiveStatus:
      (m["receiveStatus"] as MailboxReceiveStatus) ??
      ((m["receiveEnabled"] as boolean) === false ? "未开启收信" : "未测试"),
  };
}

function read(): Mailbox[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      // 历史数据迁移：不再区分团队 / 个人，统一为企业邮箱
      return arr.map((m: Record<string, unknown>) => {
        const { scope: _s, ownerId: _o, ...rest } = m;
        return withReceiveDefaults(rest);
      });
    }
  } catch {}
  return [];
}


function write(arr: Mailbox[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(arr));
  } catch {}
}

function seed() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(SEED_FLAG)) return;
  const now = new Date().toISOString();
  const seedData: Mailbox[] = [
    {
      id: makeId(),
      email: "outreach@bytetech.cn",
      displayName: "ByteTech 业务部",
      provider: "腾讯企业邮",
      ...PROVIDER_PRESETS["腾讯企业邮"],
      username: "outreach@bytetech.cn",
      password: "********",
      signature: "—\nByteTech Global Business\nhttps://bytetech.cn",
      dailyLimit: 200,
      sentToday: 27,
      receiveEnabled: true,
      receiveStatus: "收信正常",
      status: "正常",
      isDefault: true,
      createdAt: now,
      lastTestedAt: now,
    },
    {
      id: makeId(),
      email: "marketing@bytetech.cn",
      displayName: "ByteTech 市场部",
      provider: "Gmail",
      ...PROVIDER_PRESETS.Gmail,
      username: "marketing@bytetech.cn",
      password: "********",
      signature: "",
      dailyLimit: 100,
      sentToday: 0,
      receiveEnabled: false,
      receiveStatus: "未开启收信",
      status: "停用",
      isDefault: false,
      createdAt: now,
    },
    {
      id: makeId(),
      email: "sales01@bytetech.cn",
      displayName: "ByteTech 销售一部",
      provider: "腾讯企业邮",
      ...PROVIDER_PRESETS["腾讯企业邮"],
      username: "sales01@bytetech.cn",
      password: "********",
      signature: "",
      dailyLimit: 80,
      sentToday: 8,
      receiveEnabled: true,
      receiveStatus: "收信异常",
      status: "正常",
      isDefault: false,
      createdAt: now,
      lastTestedAt: now,
    },
  ];
  write(seedData);
  window.localStorage.setItem(SEED_FLAG, "1");
}

seed();

let cache: Mailbox[] = read();
let version = 0;
const listeners = new Set<() => void>();

function emit() {
  version++;
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      cache = read();
      emit();
    }
  });
}

function commit(next: Mailbox[]) {
  cache = next;
  write(next);
  emit();
}

function makeId() {
  return `mb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useMailboxes(): Mailbox[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      void version;
      return cache;
    },
    () => [],
  );
}

/* ---------- 统一可用性状态（对外唯一口径） ----------
 * 业务规则：邮箱需「已启用 + 发信连接测试通过」才可用于发信。
 * 底层三要素（启用、测试结果、收信通道）不再各自成为一个状态标签，
 * 而是收敛为一个主状态 + 明细说明。
 */
export type MailboxUsability = "可用" | "待验证" | "异常" | "已停用";

export interface MailboxUsabilityInfo {
  state: MailboxUsability;
  usable: boolean;
  /** 状态说明 / 下一步动作提示 */
  hint: string;
}

export function getMailboxUsability(m: Mailbox): MailboxUsabilityInfo {
  if (m.status === "停用")
    return { state: "已停用", usable: false, hint: "已被管理员停用，不参与邮件触达" };
  if (m.status === "异常")
    return { state: "异常", usable: false, hint: "上次发信测试失败，请检查账号配置后重新测试" };
  if (!m.lastTestedAt)
    return { state: "待验证", usable: false, hint: "尚未通过发信测试，点击「测试连接」完成验证后可用" };
  return { state: "可用", usable: true, hint: "已启用且发信测试通过，可用于邮件触达" };
}

export function isMailboxUsable(m: Mailbox): boolean {
  return getMailboxUsability(m).usable;
}

export function useUsableMailboxes(): Mailbox[] {
  const all = useMailboxes();
  return all.filter(isMailboxUsable);
}

export function getDefaultUsableMailbox(list: Mailbox[]): Mailbox | undefined {
  return list.find((m) => m.isDefault && isMailboxUsable(m)) ?? list.find(isMailboxUsable);
}

export function createMailbox(input: Omit<Mailbox, "id" | "createdAt" | "sentToday">): Mailbox {
  const isFirst = cache.length === 0;
  const next: Mailbox = {
    ...input,
    id: makeId(),
    createdAt: new Date().toISOString(),
    sentToday: 0,
    isDefault: isFirst ? true : input.isDefault,
  };
  let list = [next, ...cache];
  if (next.isDefault) list = list.map((m) => ({ ...m, isDefault: m.id === next.id }));
  commit(list);
  return next;
}

export function updateMailbox(id: string, patch: Partial<Mailbox>) {
  let list = cache.map((m) => (m.id === id ? { ...m, ...patch } : m));
  if (patch.isDefault) {
    list = list.map((m) => ({ ...m, isDefault: m.id === id }));
  }
  commit(list);
}

export function deleteMailbox(id: string) {
  const target = cache.find((m) => m.id === id);
  let list = cache.filter((m) => m.id !== id);
  // 若删掉的是默认，自动把第一个「正常」设为默认
  if (target?.isDefault) {
    const idx = list.findIndex((m) => m.status === "正常");
    if (idx >= 0) list = list.map((m, i) => ({ ...m, isDefault: i === idx }));
  }
  commit(list);
}

export function setDefaultMailbox(id: string) {
  const target = cache.find((m) => m.id === id);
  if (!target || target.status !== "正常") return false;
  commit(cache.map((m) => ({ ...m, isDefault: m.id === id })));
  return true;
}

export function setMailboxStatus(id: string, status: MailboxStatus) {
  let list = cache.map((m) => (m.id === id ? { ...m, status } : m));
  // 停用了默认邮箱，则取消默认并尝试自动指派
  const target = list.find((m) => m.id === id);
  if (target && target.status !== "正常" && target.isDefault) {
    list = list.map((m) => (m.id === id ? { ...m, isDefault: false } : m));
    const idx = list.findIndex((m) => m.status === "正常");
    if (idx >= 0) list = list.map((m, i) => ({ ...m, isDefault: i === idx }));
  }
  commit(list);
}

export interface MailboxTestResult {
  ok: boolean;
  message: string;
  smtp: { ok: boolean; message: string };
  imap: { ok: boolean; message: string; skipped?: boolean };
}

/** 模拟测试连接：1.2s，分别校验发信（SMTP）与收信（IMAP） */
export function testMailbox(id: string): Promise<MailboxTestResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const target = cache.find((m) => m.id === id);
      const smtpOk = Math.random() > 0.1;
      const receiveEnabled = target?.receiveEnabled ?? false;
      const imapOk = receiveEnabled ? Math.random() > 0.15 : false;

      const receiveStatus: MailboxReceiveStatus = !receiveEnabled
        ? "未开启收信"
        : imapOk
          ? "收信正常"
          : "收信异常";

      updateMailbox(id, {
        lastTestedAt: new Date().toISOString(),
        status: smtpOk ? "正常" : "异常",
        receiveStatus,
      });

      const smtp = {
        ok: smtpOk,
        message: smtpOk ? "SMTP 连接成功" : "SMTP 连接失败：认证失败或服务器无响应",
      };
      const imap = receiveEnabled
        ? {
            ok: imapOk,
            message: imapOk ? "IMAP 连接成功" : "IMAP 连接失败：请确认已开启 IMAP 服务",
          }
        : { ok: true, skipped: true, message: "未开启收信，已跳过 IMAP 测试" };

      resolve({
        ok: smtp.ok && imap.ok,
        message: `${smtp.message}；${imap.message}`,
        smtp,
        imap,
      });
    }, 1200);
  });
}
