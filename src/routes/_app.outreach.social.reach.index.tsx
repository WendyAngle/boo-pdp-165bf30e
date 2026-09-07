import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/outreach/social/reach/")({
  beforeLoad: () => {
    throw redirect({ to: "/outreach/social/reach/prospecting" });
  },
});
