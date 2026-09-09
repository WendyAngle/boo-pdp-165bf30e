import { useSyncExternalStore } from "react";

const KEY = "boo:reach-task:paused:v1";

let store: string[] = [];
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version++;
  for (const l of listeners) l();
}

function write(next: string[]) {
  store = next;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }
  emit();
}

if (typeof window !== "undefined") {
  try {
    const raw = localStorage.getItem(KEY);
    store = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    store = [];
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** 已暂停的触达任务 key 集合 */
export function usePausedTaskKeys(): Set<string> {
  const keys = useSyncExternalStore(
    subscribe,
    () => {
      void version;
      return store;
    },
    () => EMPTY,
  );
  return new Set(keys);
}

const EMPTY: string[] = [];

export function isTaskPaused(key: string) {
  return store.includes(key);
}

export function pauseTask(key: string) {
  if (!store.includes(key)) write([...store, key]);
}

export function resumeTask(key: string) {
  write(store.filter((k) => k !== key));
}

export function toggleTaskPaused(key: string) {
  if (store.includes(key)) resumeTask(key);
  else pauseTask(key);
}

/** demo：默认处于「已暂停」的示例任务（可点击继续执行） */
export const DEMO_PAUSED_TASK_KEYS = ["s:北欧 · 户外运动达人私信拓客:TikTok"];
const DEMO_SEED_FLAG = "boo:reach-task:paused:seed:v1";

export function seedDemoPausedTasksIfNeeded() {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(DEMO_SEED_FLAG)) return;
    const next = [...store];
    for (const k of DEMO_PAUSED_TASK_KEYS) if (!next.includes(k)) next.push(k);
    write(next);
    localStorage.setItem(DEMO_SEED_FLAG, "1");
  } catch {
    /* ignore */
  }
}
