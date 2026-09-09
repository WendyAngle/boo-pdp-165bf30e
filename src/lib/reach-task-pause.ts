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
