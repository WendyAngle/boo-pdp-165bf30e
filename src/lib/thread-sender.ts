/**
 * 触达会话 · 发信方（我方身份）解析
 *
 * 会话列表默认只展示「目标（对方）」，但用户高频需要知道：
 * 1) 这条会话是我方哪个邮箱 / 号码 / 社媒账号发出的；
 * 2) 回复会用哪个身份发出（避免串号）；
 * 3) 某个账号异常时，受影响的会话有哪些（配合列表筛选）。
 *
 * 不同渠道的「发信方」语义不同，这里统一抽象为：
 *   图标由渠道决定，文字 = 身份标识（address）+ 可选别名（displayName）。
 */
import { useMemo, useSyncExternalStore } from "react";
import type { Thread, Channel } from "@/lib/inbox-store";
import { useSocialAccounts, type SocialAccount } from "@/data/social-accounts";
import {
  getAll as getEmailAccounts,
  subscribe as subscribeEmailAccounts,
  type EmailAccount,
} from "@/lib/email-accounts";

export interface ThreadSender {
  /** 稳定 key，用于列表按发信身份筛选 */
  key: string;
  /** 身份标识：邮箱 / 号码 / @handle / 通道名 */
  address: string;
  /** 别名：邮箱显示名、社媒昵称、网关备注等 */
  displayName?: string;
  /** 该身份归属的资源类型（决定"查看账号"的落点） */
  origin: "email" | "sms" | "whatsapp" | "social" | "unknown";
  /** 账号健康度：正常 / 异常（异常时列表与详情标红提示） */
  health: "ok" | "warning" | "unknown";
  /** 异常说明 */
  healthNote?: string;
}

const UNKNOWN: ThreadSender = {
  key: "unknown",
  address: "未知通道",
  origin: "unknown",
  health: "unknown",
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** 演示环境的短信发送通道（系统侧网关，非租户自有资源） */
const SMS_GATEWAYS = [
  { address: "国际通道 A", displayName: "SMS Gateway · APAC" },
  { address: "国际通道 B", displayName: "SMS Gateway · EU" },
];

/** 演示环境的 WhatsApp Business 发信号码（社媒账号池中暂无 WhatsApp 资源时使用） */
const WHATSAPP_SENDERS = [
  { address: "+86 138****6621", displayName: "WhatsApp Business · 外贸一部" },
  { address: "+86 139****8032", displayName: "WhatsApp Business · 外贸二部" },
];

/** 演示环境的 Telegram 官方账号 */
const TELEGRAM_SENDERS = [
  { address: "@bytetech_sales", displayName: "ByteTech Sales Bot" },
];

/** 只有「真实邮箱地址」才可作为发信身份（域名 / Subuser 仅为资源，不直接展示） */
function isMailbox(a: EmailAccount): boolean {
  return a.identity.includes("@");
}

function firstOutboundFrom(thread: Thread): string | undefined {
  for (const m of thread.messages) {
    if (m.direction === "outbound" && m.fromAddress) return m.fromAddress;
  }
  return undefined;
}

function pick<T>(list: T[], seed: string): T | undefined {
  if (list.length === 0) return undefined;
  return list[hash(seed) % list.length];
}

function fromSocialAccount(a: SocialAccount): ThreadSender {
  const ok = a.status === "正常";
  return {
    key: `social:${a.id}`,
    address: a.handle,
    displayName: a.displayName,
    origin: a.platform === "WhatsApp" ? "whatsapp" : "social",
    health: ok ? "ok" : "warning",
    healthNote: ok ? undefined : `账号当前状态：${a.status}`,
  };
}

function fromEmailAccount(a: EmailAccount): ThreadSender {
  const ok = a.status === "available";
  return {
    key: `email:${a.id}`,
    address: a.identity,
    displayName: a.displayName,
    origin: "email",
    health: ok ? "ok" : "warning",
    healthNote:
      a.status === "suspended"
        ? "该发信邮箱已暂停"
        : a.status === "revoked"
          ? "该发信邮箱已回收"
          : undefined,
  };
}

export function resolveThreadSender(
  thread: Thread,
  ctx: { social: SocialAccount[]; emails: EmailAccount[] },
): ThreadSender {
  const ch: Channel = thread.channel;

  if (ch === "email") {
    const addr = thread.senderEmail || firstOutboundFrom(thread);
    const matched = addr
      ? ctx.emails.find((e) => e.identity.toLowerCase() === addr.toLowerCase())
      : undefined;
    if (matched) return fromEmailAccount(matched);
    if (addr)
      return {
        key: `email:${addr}`,
        address: addr,
        origin: "email",
        health: "ok",
      };
    const mailboxes = ctx.emails.filter(
      (e) => e.status === "available" && isMailbox(e),
    );
    const fallback = pick(mailboxes, thread.id);
    return fallback ? fromEmailAccount(fallback) : UNKNOWN;
  }

  if (ch === "facebook" || ch === "tiktok") {
    const platform = ch === "facebook" ? "Facebook" : "TikTok";
    const list = ctx.social.filter((a) => a.platform === platform);
    const raw = firstOutboundFrom(thread);
    const matched = raw
      ? list.find((a) => a.id === raw || a.handle === raw)
      : undefined;
    if (matched) return fromSocialAccount(matched);
    const usable = list.filter((a) => a.status === "正常");
    const fallback = pick(usable.length ? usable : list, thread.id);
    return fallback ? fromSocialAccount(fallback) : UNKNOWN;
  }

  if (ch === "whatsapp") {
    const list = ctx.social.filter((a) => a.platform === "WhatsApp");
    const usable = list.filter((a) => a.status === "正常");
    const matched = pick(usable.length ? usable : list, thread.id);
    if (matched) return fromSocialAccount(matched);
    const wa = pick(WHATSAPP_SENDERS, thread.id)!;
    return {
      key: `whatsapp:${wa.address}`,
      address: wa.address,
      displayName: wa.displayName,
      origin: "whatsapp",
      health: "ok",
    };
  }

  if (ch === "sms") {
    const g = pick(SMS_GATEWAYS, thread.id)!;
    return {
      key: `sms:${g.address}`,
      address: g.address,
      displayName: g.displayName,
      origin: "sms",
      health: "ok",
    };
  }

  const raw = firstOutboundFrom(thread);
  if (raw)
    return { key: `other:${raw}`, address: raw, origin: "unknown", health: "ok" };
  const tg = pick(TELEGRAM_SENDERS, thread.id)!;
  return {
    key: `social:${tg.address}`,
    address: tg.address,
    displayName: tg.displayName,
    origin: "social",
    health: "ok",
  };
}

const EMPTY_EMAILS: EmailAccount[] = [];
function useEmailAccounts(): EmailAccount[] {
  return useSyncExternalStore(
    subscribeEmailAccounts,
    getEmailAccounts,
    () => EMPTY_EMAILS,
  );
}

/** 返回稳定的解析函数（随账号数据变化刷新） */
export function useThreadSenderResolver() {
  const social = useSocialAccounts();
  const emails = useEmailAccounts();
  return useMemo(
    () => (t: Thread) => resolveThreadSender(t, { social, emails }),
    [social, emails],
  );
}

/** 列表顶部「发信账号」下拉的可选项（按当前会话集合聚合，含渠道标识） */
export function useSenderOptions(threads: Thread[]) {
  const resolve = useThreadSenderResolver();
  return useMemo(() => {
    const map = new Map<
      string,
      { sender: ThreadSender; count: number; channels: Channel[] }
    >();
    for (const t of threads) {
      const s = resolve(t);
      if (s.key === "unknown") continue;
      // 发信账号筛选不展示「短信」类网关账号
      if (s.origin === "sms") continue;
      const cur = map.get(s.key);
      if (cur) {
        cur.count++;
        if (!cur.channels.includes(t.channel)) cur.channels.push(t.channel);
      } else {
        map.set(s.key, { sender: s, count: 1, channels: [t.channel] });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [threads, resolve]);
}


export function senderText(s: ThreadSender): string {
  return s.displayName ? `${s.address}（${s.displayName}）` : s.address;
}
