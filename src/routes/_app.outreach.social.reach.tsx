import { createFileRoute, redirect } from "@tanstack/react-router";

// 社媒触达已并入「触达任务」模块，统一在一个工作台中管理加友 / 私信任务
export const Route = createFileRoute("/_app/outreach/social/reach")({
  beforeLoad: () => {
    throw redirect({ to: "/outreach/reach" });
  },
});
