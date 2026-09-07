import type { SocialAccount } from "@/data/social-accounts";

export interface HealthResult {
  score: number; // 0-100
  band: "健康" | "一般" | "偏弱" | "异常";
  reasons: string[];
}

/** 计算单账号健康度（0-100） */
export function computeHealth(a: SocialAccount): HealthResult {
  let score = 100;
  const reasons: string[] = [];

  if (a.status === "风控") {
    score -= 60;
    reasons.push("账号处于风控状态");
  } else if (a.status === "被封") {
    score -= 80;
    reasons.push("账号已被封禁");
  } else if (a.status === "养号中") {
    score -= 15;
    reasons.push("养号期");
  }

  // 账号年龄（购买时长）
  if (a.purchasedAt) {
    const days = Math.max(
      0,
      (Date.now() - new Date(a.purchasedAt).getTime()) / 86400_000,
    );
    if (days < 3) {
      score -= 10;
      reasons.push("新号 <3 天");
    } else if (days < 7) {
      score -= 5;
    }
  }

  // 私信使用率
  const dmLimit = a.dailyDmLimit ?? a.dailyLimit;
  const dmUsed = a.dmSentToday ?? a.sentToday;
  if (dmLimit > 0) {
    const ratio = dmUsed / dmLimit;
    if (ratio >= 1) {
      score -= 10;
      reasons.push("今日私信额度用尽");
    } else if (ratio >= 0.8) {
      score -= 5;
    }
  }

  // 加友使用率
  const fLimit = a.dailyFriendLimit ?? 5;
  const fUsed = a.friendSentToday ?? 0;
  if (fLimit > 0 && fUsed / fLimit >= 1) {
    score -= 5;
    reasons.push("今日加友额度用尽");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const band: HealthResult["band"] =
    score >= 85 ? "健康" : score >= 70 ? "一般" : score >= 50 ? "偏弱" : "异常";
  return { score, band, reasons };
}

export function poolAverageHealth(list: SocialAccount[]): number {
  const active = list.filter((a) => a.status !== "备货中");
  if (active.length === 0) return 0;
  const total = active.reduce((s, a) => s + computeHealth(a).score, 0);
  return Math.round(total / active.length);
}

export function healthToneClass(band: HealthResult["band"]): string {
  switch (band) {
    case "健康":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "一般":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "偏弱":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "异常":
      return "bg-rose-50 text-rose-700 border-rose-200";
  }
}
