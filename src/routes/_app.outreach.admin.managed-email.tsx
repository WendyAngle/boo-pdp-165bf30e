import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/outreach/admin/managed-email")({
  component: () => <Outlet />,
});
