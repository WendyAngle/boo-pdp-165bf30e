import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/")({
  head: () => ({
    meta: [
      { title: "商机线索 · 全球贸易搜索 | 出海大数据平台" },
      {
        name: "description",
        content:
          "按商品关键词、HS Code 或公司名称检索全球贸易商机，可筛选国家与进出口商角色，并在同页查看线索结果。",
      },
      { property: "og:title", content: "商机线索 · 全球贸易搜索" },
      {
        property: "og:description",
        content: "按商品关键词、HS Code 或公司名称检索全球贸易商机。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndexRedirect,
});

function IndexRedirect() {
  return <Navigate to="/outreach/search" replace />;
}
