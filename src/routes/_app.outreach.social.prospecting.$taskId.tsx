import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/outreach/social/prospecting/$taskId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/outreach/social/reach/prospecting/$taskId",
      params: { taskId: params.taskId },
    });
  },
});
