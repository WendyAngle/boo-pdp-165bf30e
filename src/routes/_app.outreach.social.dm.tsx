import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/outreach/social/dm")({
  beforeLoad: () => {
    throw redirect({ to: "/outreach/social/reach/dm" });
  },
});
