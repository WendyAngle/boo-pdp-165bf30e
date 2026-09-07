import type { MailboxProvider } from "./mailboxes";

/** 域名 → 服务商 自动识别规则 */
const DOMAIN_RULES: { provider: MailboxProvider; domains: string[] }[] = [
  { provider: "Gmail", domains: ["gmail.com", "googlemail.com"] },
  {
    provider: "Outlook",
    domains: ["outlook.com", "hotmail.com", "live.com", "office365.com", "msn.com"],
  },
  { provider: "腾讯企业邮", domains: ["qq.com", "foxmail.com", "exmail.qq.com"] },
  { provider: "阿里企业邮", domains: ["aliyun.com", "mxhichina.com", "alibaba-inc.com"] },
  { provider: "网易企业邮", domains: ["163.com", "126.com", "yeah.net", "qiye.163.com"] },
];

/** MX 归属模拟：企业自有域名常见的托管服务商（用于「系统自动识别」演示） */
const MX_HOSTED: Record<string, MailboxProvider> = {
  "bytedance.com": "腾讯企业邮",
  "boo-data.com": "腾讯企业邮",
  "haier.com": "阿里企业邮",
  "midea.com": "网易企业邮",
};

export interface DetectResult {
  provider: MailboxProvider;
  /** 识别依据说明，用于向用户解释「系统怎么知道的」 */
  basis: string;
  /** true = 识别到明确服务商；false = 未识别，回退自定义 SMTP */
  matched: boolean;
}

export function detectProvider(email: string): DetectResult | null {
  const at = email.indexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain || !domain.includes(".")) return null;

  for (const rule of DOMAIN_RULES) {
    if (rule.domains.some((d) => domain === d || domain.endsWith(`.${d}`))) {
      return {
        provider: rule.provider,
        basis: `根据域名 @${domain} 识别为「${rule.provider}」，已自动填充 SMTP 服务器、端口与加密方式`,
        matched: true,
      };
    }
  }

  const hosted = MX_HOSTED[domain];
  if (hosted) {
    return {
      provider: hosted,
      basis: `检测到 @${domain} 的邮件解析（MX）托管在「${hosted}」，已自动填充服务器参数`,
      matched: true,
    };
  }

  return {
    provider: "自定义SMTP",
    basis: `未能识别 @${domain} 的邮件服务商，请按下方配置指导手动填写 SMTP 服务器信息`,
    matched: false,
  };
}

/** 显示名称建议：企业名 + 邮箱前缀 */
export function suggestDisplayName(email: string, tenantName: string): string {
  const local = email.split("@")[0] ?? "";
  if (!local) return "";
  const pretty = local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
  return `${tenantName} · ${pretty}`;
}

export interface ProviderGuide {
  /** 授权凭证的正式名称 */
  credentialName: string;
  /** 获取步骤 */
  steps: string[];
  /** 常见坑 */
  notes: string[];
  /** 开启收信（IMAP）的步骤 */
  imapSteps: string[];
  /** 收信相关注意事项 */
  imapNotes: string[];
}


export const PROVIDER_GUIDES: Record<MailboxProvider, ProviderGuide> = {
  Gmail: {
    credentialName: "应用专用密码（App Password）",
    steps: [
      "登录 Google 账号 → 安全性，先开启「两步验证」",
      "在安全性页面搜索并进入「应用专用密码」",
      "应用选择「邮件」，设备选择「其他」并填写 Boo 平台",
      "复制生成的 16 位密码，粘贴到「授权密码」（注意去掉空格）",
    ],
    notes: [
      "普通登录密码无法用于 SMTP，必须使用应用专用密码",
      "未开启两步验证时看不到应用专用密码入口",
    ],
    imapSteps: [
      "登录 Gmail → 设置（齿轮）→ 查看所有设置",
      "进入「转发和 POP/IMAP」标签页",
      "在「IMAP 访问权限」中选择「启用 IMAP」并保存更改",
      "收信与发信共用同一个应用专用密码，无需另外获取",
    ],
    imapNotes: [
      "Google Workspace 企业账号需管理员在管理控制台 → 应用 → Gmail → 最终用户访问权限中允许 IMAP",
      "IMAP 服务器：imap.gmail.com，端口 993（SSL）",
    ]
  },
  Outlook: {
    credentialName: "OAuth 2.0 授权（唯一方式）",
    steps: [
      "在左侧点击「使用 OAuth 2.0 登录」，跳转 Microsoft 官方授权页",
      "使用要接入的 Outlook / Microsoft 365 邮箱账号登录",
      "在授权页勾选同意邮件收发（Mail.Send、Mail.Read、offline_access）权限",
      "授权成功后自动返回本页，凭证由系统托管，无需填写任何密码",
    ],
    notes: [
      "Microsoft 已停用 SMTP/IMAP 基本认证，应用密码与登录密码均无法接入，本平台仅支持 OAuth 2.0",
      "企业账号若提示需要管理员同意，请让 Microsoft 365 管理员在 Entra 管理中心批准该应用授权",
      "授权令牌会自动续期；若邮箱改密或管理员撤销授权，需点击「重新授权」",
    ],
    imapSteps: [
      "OAuth 授权已同时包含收信（IMAP）权限，无需单独开启",
      "企业账号：管理员在 Microsoft 365 管理中心 → 用户 → 邮箱应用中确认已启用「IMAP」",
      "开启「接收客户回复」后使用「保存并测试」验证收信通道",
    ],
    imapNotes: [
      "IMAP 服务器：outlook.office365.com，端口 993 (SSL/TLS)",
      "收信与发信共用同一份 OAuth 授权，撤销授权将同时中断收发",
    ]
  },
  腾讯企业邮: {
    credentialName: "客户端专用密码",
    steps: [
      "登录 exmail.qq.com → 设置 → 收发信设置",
      "开启「IMAP/SMTP 服务」",
      "在「客户端专用密码」中生成一个新密码（需管理员允许）",
      "复制专用密码，粘贴到「授权密码」",
    ],
    notes: ["若管理员开启了「安全登录」，需先在企业管理后台放开客户端登录"],
    imapSteps: [
      "登录 exmail.qq.com → 设置 → 收发信设置",
      "确认「IMAP/SMTP 服务」已开启（与发信为同一开关）",
      "收信使用同一个客户端专用密码",
    ],
    imapNotes: [
      "若仅开启了 POP 而未开启 IMAP，将无法同步已读状态与文件夹",
      "IMAP 服务器：imap.exmail.qq.com，端口 993（SSL）",
    ]
  },
  阿里企业邮: {
    credentialName: "邮箱登录密码 / 客户端密码",
    steps: [
      "登录 qiye.aliyun.com → 设置 → 账户与安全",
      "确认已开启「SMTP 服务」",
      "如企业启用了客户端独立密码，请在此生成后使用",
      "将密码粘贴到「授权密码」",
    ],
    notes: [
      "SMTP 服务器：smtp.qiye.aliyun.com，端口 465（SSL）",
      "旧版地址 smtp.mxhichina.com 仍可用，官方建议改用新版 qiye.aliyun.com",
      "部分企业限制外网客户端登录，需管理员在安全策略中放行",
    ],
    imapSteps: [
      "登录 qiye.aliyun.com → 设置 → 账户与安全 → 客户端设置",
      "开启「IMAP 服务」（与 SMTP 为独立开关，需分别确认）",
      "收信使用同一个邮箱/客户端密码",
    ],
    imapNotes: [
      "阿里企业邮 IMAP 与 SMTP 开关相互独立，只开 SMTP 会导致收信测试失败",
      "IMAP 服务器：imap.qiye.aliyun.com，端口 993（SSL）；旧版 imap.mxhichina.com 仍有效",
    ]
  },
  网易企业邮: {
    credentialName: "客户端授权码",
    steps: [
      "登录 qiye.163.com → 设置 → 客户端设置",
      "开启「SMTP 服务」并生成客户端授权码",
      "复制授权码，粘贴到「授权密码」",
    ],
    notes: ["网易企业邮 SMTP SSL 端口为 465（部分企业为 994），以后台展示为准"],
    imapSteps: [
      "登录 qiye.163.com → 设置 → 客户端设置",
      "开启「IMAP 服务」并确认授权码可用",
      "收信使用同一个客户端授权码",
    ],
    imapNotes: [
      "网易企业邮部分企业默认仅开启 POP3，需手动勾选 IMAP",
      "IMAP 服务器：imap.qiye.163.com，端口 993（SSL）",
    ]
  },
  自定义SMTP: {
    credentialName: "SMTP 认证密码",
    steps: [
      "联系企业 IT / 邮件管理员，索取 SMTP 服务器地址、端口与加密方式",
      "确认该邮箱已开启 SMTP 发信权限",
      "获取该邮箱的 SMTP 认证用户名与密码（多数与邮箱地址一致）",
      "填写完成后使用「保存并测试」验证连通性",
    ],
    notes: [
      "常用端口：465（SSL）、587（STARTTLS）、25（不加密，多数云厂商已封禁）",
      "服务器需允许平台出口 IP 访问，否则测试会超时",
    ],
    imapSteps: [
      "向企业邮件管理员确认是否提供 IMAP 收信服务",
      "索取 IMAP 服务器地址、端口与加密方式",
      "确认该邮箱账号具备 IMAP 登录权限",
      "填写后使用「保存并测试」验证收信通道",
    ],
    imapNotes: [
      "常用 IMAP 端口：993（SSL）、143（STARTTLS）",
      "部分企业仅开放 POP3，此时无法同步客户回复，建议联系管理员开通 IMAP",
    ]
  },
};

/** 各服务商建议的起步日发上限 */
export const PROVIDER_DAILY_LIMIT: Record<MailboxProvider, number> = {
  Gmail: 50,
  Outlook: 50,
  腾讯企业邮: 100,
  阿里企业邮: 100,
  网易企业邮: 100,
  自定义SMTP: 50,
};
