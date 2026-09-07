import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/PagePlaceholder";

export const Route = createFileRoute("/_app/outreach/")({
  head: () => ({ meta: [{ title: "出海大数据平台 | 出海大数据平台" }] }),
  component: () => (
    <PagePlaceholder
      breadcrumb={["出海大数据平台"]}
      title="出海大数据平台"
      subtitle="该模块功能建设中，敬请期待"
    />
  ),
});