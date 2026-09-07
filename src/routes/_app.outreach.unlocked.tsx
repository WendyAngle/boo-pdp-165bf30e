import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/outreach/unlocked")({
  beforeLoad: () => {
    throw redirect({ to: "/outreach/favorites", search: { tab: "unlocked" } });
  },
});
