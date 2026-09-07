import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/outreach/enterprise")({
  component: () => <Outlet />,
});
