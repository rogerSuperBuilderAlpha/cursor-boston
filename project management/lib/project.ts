import type { Project } from "./types";

export const initialProject: Project = {
  id: "milestone-1",
  name: "Product Launch",
  milestone: "Ship v1.0",
  tasks: [
    {
      id: "1",
      title: "Finalize feature scope",
      status: "done",
      priority: "high",
    },
    {
      id: "2",
      title: "Design landing page",
      status: "done",
      priority: "medium",
    },
    {
      id: "3",
      title: "Implement auth flow",
      status: "in-progress",
      priority: "high",
    },
    {
      id: "4",
      title: "Write onboarding copy",
      status: "backlog",
      priority: "low",
    },
    {
      id: "5",
      title: "Run QA pass",
      status: "review",
      priority: "medium",
    },
    {
      id: "6",
      title: "Deploy to production",
      status: "backlog",
      priority: "high",
    },
  ],
};

export function getCompletionPercent(tasks: Project["tasks"]): number {
  if (tasks.length === 0) return 0;
  const completed = tasks.filter((task) => task.status === "done").length;
  return Math.round((completed / tasks.length) * 100);
}

export function getCompletedCount(tasks: Project["tasks"]): number {
  return tasks.filter((task) => task.status === "done").length;
}
