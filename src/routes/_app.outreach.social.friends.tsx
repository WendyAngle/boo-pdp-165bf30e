import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/outreach/social/friends")({
  beforeLoad: () => {
    throw redirect({ to: "/outreach/conversations", search: { ch: "facebook" } } as never);
  },
});
