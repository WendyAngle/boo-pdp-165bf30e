import { useEffect, useState } from "react";

/** 返回 true 表示已完成 SSR → 客户端水合，可安全读取浏览器存储。 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}
