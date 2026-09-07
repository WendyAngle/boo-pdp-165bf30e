import { useSyncExternalStore } from "react";

export type SocialTaskPlatform = "Facebook" | "TikTok";
export type SocialTargetKind = "enterprise" | "user" | "post" | "comment" | "group";

export type ProspectingStatus = "queued" | "running" | "completed" | "paused";
export type TargetStatus =
  | "pending"
  | "requested"
  | "accepted"
  | "following"
  | "rejected"
  | "expired"
  | "failed";

export interface ProspectingTarget {
  id: string;
  name: string;
  handle: string;
  /** 平台侧数字账号 ID，如 Facebook 的 61585883769059 */
  socialId?: string;
  kind: SocialTargetKind;
  status: TargetStatus;
  requestedAt?: string;
  acceptedAt?: string;
}


export interface ProspectingTask {
  id: string;
  name: string;
  platform: SocialTaskPlatform[];
  targetKinds: SocialTargetKind[];
  keywords: string[];
  region?: string;
  targetCap: number;
  accountIds: string[];
  greetOnAccept?: string;
  /** 关系动作：加好友 / 关注（收藏中心「批量社媒加好友」为 connect） */
  action?: "friend" | "follow" | "connect";
  /** 执行节奏档位 */
  pacing?: "safe" | "normal" | "fast";
  /** 任务来源（如：收藏中心 / 关键词搜索） */
  source?: string;
  status: ProspectingStatus;
  createdAt: string;
  frozenCredits: number;
  usedCredits: number;
  targets: ProspectingTarget[];
}

export type DmStatus = "queued" | "running" | "completed" | "paused";
export type DmSendStatus = "pending" | "sent" | "replied" | "failed";

export interface DmSend {
  id: string;
  targetName: string;
  targetHandle: string;
  platform: SocialTaskPlatform;
  status: DmSendStatus;
  sentAt?: string;
}

export interface DmTask {
  id: string;
  name: string;
  platform: SocialTaskPlatform;
  template: string;
  sourceTaskId?: string;
  status: DmStatus;
  createdAt: string;
  sends: DmSend[];
}

const PROS_KEY = "boo:social-prospecting:v4";
const DM_KEY = "boo:social-dm:v2";
const SEED_FLAG = "boo:social-tasks:v4:seeded";


function readArr<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr as T[];
  } catch {}
  return [];
}
function writeArr<T>(key: string, arr: T[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(arr));
  } catch {}
}

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString();
}

function seed() {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(SEED_FLAG)) return;

  const prospecting: ProspectingTask[] = [
    {
      id: "spt_1",
      name: "北美 · Steel Importer 加友",
      platform: ["Facebook"],
      targetKinds: ["enterprise", "user"],
      keywords: ["steel importer", "structural steel"],
      region: "US / CA",
      targetCap: 30,
      accountIds: ["sa_fb_1"],
      greetOnAccept: "Hi {联系人名}, 我们是 {我的公司}，专注钢材出口，方便聊聊吗？",
      status: "running",
      createdAt: daysAgo(1),
      frozenCredits: 1500,
      usedCredits: 850,
      targets: [
        { id: "t1", name: "Northwind Steel", handle: "@northwind.steel", socialId: "61585883769059", kind: "enterprise", status: "accepted", requestedAt: daysAgo(1), acceptedAt: daysAgo(0.5) },
        { id: "t2", name: "Mike O'Brien", handle: "@mike.obrien.buyer", socialId: "61585883769060", kind: "user", status: "accepted", requestedAt: daysAgo(1), acceptedAt: daysAgo(0.4) },
        { id: "t3", name: "Contoso Metals", handle: "@contoso.metals", socialId: "61585883769061", kind: "enterprise", status: "requested", requestedAt: daysAgo(1) },
        { id: "t4", name: "Sarah Lee", handle: "@sarah.lee.pm", socialId: "61585883769062", kind: "user", status: "rejected", requestedAt: daysAgo(1) },
        { id: "t5", name: "SteelMart LLC", handle: "@steelmart", socialId: "61585883769063", kind: "enterprise", status: "pending" },
        { id: "t6", name: "David Chen", handle: "@david.chen.trade", socialId: "61585883769064", kind: "user", status: "failed", requestedAt: daysAgo(1) },

      ],
    },
    {
      id: "spt_2",
      name: "东南亚 · Tile Distributor",
      platform: ["TikTok"],
      targetKinds: ["user", "comment"],
      keywords: ["tile distributor", "ceramic tiles"],
      region: "SG / MY / ID",
      targetCap: 20,
      accountIds: ["sa_tt_1"],
      status: "queued",
      createdAt: daysAgo(0.2),
      frozenCredits: 1000,
      usedCredits: 0,
      targets: [],
    },
  ];

  prospecting.push({
    id: "spt_3",
    name: "东南亚 · 美妆家居达人关注",
    platform: ["TikTok"],
    targetKinds: ["user", "enterprise"],
    keywords: ["beauty device", "home decor", "skincare"],
    region: "TH / MY / ID / VN",
    targetCap: 25,
    accountIds: ["sa_tt_1"],
    action: "follow",
    pacing: "safe",
    source: "关键词搜索",
    status: "running",
    createdAt: daysAgo(6),
    frozenCredits: 1250,
    usedCredits: 250,
    targets: [
      { id: "ttd_1", name: "Nattaya Srisai", handle: "@nattaya.beauty", socialId: "71585883700011", kind: "user", status: "requested", requestedAt: daysAgo(0.4) },
      { id: "ttd_2", name: "Farah Binti Idris", handle: "@farah.homeliving", socialId: "71585883700012", kind: "user", status: "following", requestedAt: daysAgo(1.3), acceptedAt: daysAgo(1.05) },
      { id: "ttd_3", name: "Rizky Pratama", handle: "@rizky.homedecor", socialId: "71585883700013", kind: "user", status: "following", requestedAt: daysAgo(2.2), acceptedAt: daysAgo(1.95) },
      { id: "ttd_4", name: "Ploy Chaiyaphum", handle: "@ploy.skincare", socialId: "71585883700014", kind: "user", status: "following", requestedAt: daysAgo(3.2), acceptedAt: daysAgo(3.0) },
      { id: "ttd_5", name: "Nguyen Minh Anh", handle: "@minhanh.beauty", socialId: "71585883700015", kind: "user", status: "expired", requestedAt: daysAgo(5), acceptedAt: daysAgo(4.9) },
    ],
  });

  const dm: DmTask[] = [
    {
      id: "dmt_1",
      name: "Steel Importer · 首轮问询",
      platform: "Facebook",
      template:
        "Hi {联系人名}, 感谢通过好友请求。{我的公司} 主营结构钢与型材，欢迎回复我们的报价单需求。",
      sourceTaskId: "spt_1",
      status: "running",
      createdAt: daysAgo(0.3),
      sends: [
        { id: "s1", targetName: "Northwind Steel", targetHandle: "@northwind.steel", platform: "Facebook", status: "replied", sentAt: daysAgo(0.3) },
        { id: "s2", targetName: "Mike O'Brien", targetHandle: "@mike.obrien.buyer", platform: "Facebook", status: "sent", sentAt: daysAgo(0.3) },
      ],
    },
  ];

  dm.push({
    id: "dmt_2",
    name: "东南亚 · 互关达人首轮私信",
    platform: "TikTok",
    template:
      "Hi {联系人名}, 感谢回关。{我的公司} 主营美妆仪器与家居用品，欢迎了解我们的目录与报价。",
    sourceTaskId: "spt_3",
    status: "running",
    createdAt: daysAgo(2.2),
    sends: [
      { id: "s3", targetName: "Rizky Pratama", targetHandle: "@rizky.homedecor", platform: "TikTok", status: "sent", sentAt: daysAgo(2.0) },
      { id: "s4", targetName: "Ploy Chaiyaphum", targetHandle: "@ploy.skincare", platform: "TikTok", status: "replied", sentAt: daysAgo(3.0) },
      { id: "s5", targetName: "Nguyen Minh Anh", targetHandle: "@minhanh.beauty", platform: "TikTok", status: "replied", sentAt: daysAgo(4.8) },
    ],
  });

  writeArr(PROS_KEY, prospecting);
  writeArr(DM_KEY, dm);
  window.localStorage.setItem(SEED_FLAG, "1");
}
seed();

const EMPTY_PROS: ProspectingTask[] = [];
const EMPTY_DM: DmTask[] = [];
let prosCache: ProspectingTask[] = readArr<ProspectingTask>(PROS_KEY);
let dmCache: DmTask[] = readArr<DmTask>(DM_KEY);
let prosV = 0;
let dmV = 0;
const prosListeners = new Set<() => void>();
const dmListeners = new Set<() => void>();

function emitPros() {
  prosV++;
  prosListeners.forEach((l) => l());
}
function emitDm() {
  dmV++;
  dmListeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === PROS_KEY) {
      prosCache = readArr<ProspectingTask>(PROS_KEY);
      emitPros();
    }
    if (e.key === DM_KEY) {
      dmCache = readArr<DmTask>(DM_KEY);
      emitDm();
    }
  });
}

export function useProspectingTasks(): ProspectingTask[] {
  return useSyncExternalStore(
    (cb) => {
      prosListeners.add(cb);
      return () => prosListeners.delete(cb);
    },
    () => {
      void prosV;
      return prosCache;
    },
    () => EMPTY_PROS,
  );
}
export function useDmTasks(): DmTask[] {
  return useSyncExternalStore(
    (cb) => {
      dmListeners.add(cb);
      return () => dmListeners.delete(cb);
    },
    () => {
      void dmV;
      return dmCache;
    },
    () => EMPTY_DM,
  );
}

export function addProspectingTask(t: Omit<ProspectingTask, "id" | "createdAt" | "status" | "usedCredits" | "targets"> & Partial<Pick<ProspectingTask, "targets">>) {
  const task: ProspectingTask = {
    id: `spt_${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    status: "queued",
    usedCredits: 0,
    targets: t.targets ?? [],
    ...t,
  };
  prosCache = [task, ...prosCache];
  writeArr(PROS_KEY, prosCache);
  emitPros();
  return task;
}

export function addDmTask(t: Omit<DmTask, "id" | "createdAt" | "status" | "sends"> & Partial<Pick<DmTask, "sends">>) {
  const task: DmTask = {
    id: `dmt_${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    status: "queued",
    sends: t.sends ?? [],
    ...t,
  };
  dmCache = [task, ...dmCache];
  writeArr(DM_KEY, dmCache);
  emitDm();
  return task;
}

/** 以固定 id 写入 / 覆盖拓客任务（演示数据初始化用） */
export function upsertProspectingTask(task: ProspectingTask) {
  prosCache = [task, ...prosCache.filter((t) => t.id !== task.id)];
  writeArr(PROS_KEY, prosCache);
  emitPros();
  return task;
}

/** 非 hook 快照：供 inbox-store 等模块在渲染外读取拓客任务 */
export function getProspectingTasksSnapshot(): ProspectingTask[] {
  return prosCache;
}
