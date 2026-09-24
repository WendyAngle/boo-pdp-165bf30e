import { useSyncExternalStore } from "react";

const KEY = "boo:reach-task:terminated:v1";

let store: string[] = [];
const listeners = new Set<() => void>();
let version = 0;
const EMPTY: string[] = [];

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

/** 已终止的触达任务 key 集合 */
export function useTerminatedTaskKeys(): Set<string> {
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

export function isTaskTerminated(key: string) {
  return store.includes(key);
}

/** 终止任务（不可恢复） */
export function terminateTask(key: string) {
  if (!store.includes(key)) write([...store, key]);
}
