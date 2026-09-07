import type { Thread } from "./inbox-store";

/**
 * 目标客户来源与原因
 * - manual（自主选择）：来自系统内企业名录 / 人物库，由用户主动收藏、解锁或勾选后发起触达
 * - recommended（系统推荐）：社媒账号（Facebook / TikTok）由系统按匹配模型自动圈选
 */
export type TargetReasonMode = "manual" | "recommended";

export interface TargetReasonFactor {
  /** 维度名称，如「行业匹配」 */
  label: string;
  /** 命中说明 */
  detail: string;
  /** 匹配度 0-100 */
  score: number;
}

export interface TargetReason {
  mode: TargetReasonMode;
  /** 一句话摘要 */
  summary: string;
  /** 来源动作说明（自主选择时使用） */
  origin?: string;
  /** 推荐因子（系统推荐时使用） */
  factors: TargetReasonFactor[];
  /** 综合匹配度（系统推荐时使用） */
  matchScore?: number;
}

const SOCIAL_CHANNELS = new Set(["facebook", "tiktok", "instagram", "linkedin"]);

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const INDUSTRIES = ["消费电子", "家居用品", "户外运动", "美妆个护", "汽车配件", "工业设备"];
const PRODUCTS = ["无线充电模组", "储能电源", "智能小家电", "户外照明", "定制包装", "工业传感器"];
const REGIONS = ["东南亚（泰国 / 越南）", "北美（美国 / 加拿大）", "欧洲（德国 / 法国）", "中东（阿联酋）"];

/** 依据会话确定性地推导「为什么把 TA 作为目标客户」 */
export function getTargetReason(thread: Thread): TargetReason {
  const isSocial = SOCIAL_CHANNELS.has(thread.channel);

  if (!isSocial) {
    if (thread.manualAdd) {
      return {
        mode: "manual",
        summary:
          "手动添加：在批量发邮件、批量发短信或批量社媒私信时，手动录入的非平台内/非社媒触达系统选择的目标",
        origin:
          "通过批量触达弹窗手动添加联系人（非企业名录、非社媒拓客任务推荐），直接发起触达",
        factors: [],
      };
    }
    const kind = thread.targetKind === "enterprise" ? "企业" : "人物";
    return {
      mode: "manual",
      summary: `自主选择：来自系统${kind}库，由团队成员主动选定后发起触达`,
      origin:
        thread.targetKind === "enterprise"
          ? "在「企业名录」中查看并解锁该企业后，加入我的收藏并创建触达任务"
          : "在企业详情的「关联人物」中解锁该联系人后，主动发起触达",
      factors: [],
    };
  }

  const h = hash(thread.id || thread.targetName);
  const industry = INDUSTRIES[h % INDUSTRIES.length];
  const product = PRODUCTS[(h >> 3) % PRODUCTS.length];
  const region = REGIONS[(h >> 6) % REGIONS.length];
  const followers = thread.socialSignals?.followers;
  const posts = thread.socialSignals?.postsCount;

  const factors: TargetReasonFactor[] = [
    {
      label: "行业匹配",
      detail: `账号主页 / 发帖内容聚焦「${industry}」，与企业信息中的目标行业一致`,
      score: 70 + (h % 26),
    },
    {
      label: "产品匹配",
      detail: `近期内容多次出现「${product}」相关关键词，与我方主推品类重合`,
      score: 65 + ((h >> 2) % 31),
    },
    {
      label: "地区匹配",
      detail: `账号归属地/语言指向 ${region}，属于当前目标市场`,
      score: 60 + ((h >> 4) % 36),
    },
    {
      label: "活跃度与真实性",
      detail:
        followers != null || posts != null
          ? `粉丝 ${followers ?? "—"} · 内容 ${posts ?? "—"} 条，账号活跃且非空壳`
          : "近 30 天有持续互动，账号活跃且非空壳",
      score: 58 + ((h >> 5) % 38),
    },
  ];

  if (thread.isFriend) {
    factors.unshift({
      label: "好友关系",
      detail: `已通过加好友${thread.friendSource ? `（来源任务：${thread.friendSource}）` : ""}，可直接私信触达`,
      score: 90,
    });
  }

  const matchScore = Math.round(
    factors.reduce((s, f) => s + f.score, 0) / factors.length,
  );

  return {
    mode: "recommended",
    summary: `系统推荐：社媒账号由匹配模型自动圈选，综合匹配度 ${matchScore}%`,
    origin: "社媒获客模型基于企业信息中的行业、主推产品与目标市场自动圈选",
    factors,
    matchScore,
  };
}
