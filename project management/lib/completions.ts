import type { Task } from "@/lib/types";

export type TaskCompletion = {
  id: string;
  task: Task;
  source: "webhook" | "api" | "manual";
  createdAt: number;
};

export function getCompletionLabel(source: TaskCompletion["source"]): string {
  if (source === "webhook") {
    return "Synced from GitHub";
  }

  return "Task Complete";
}

export function getCompletionDetail(source: TaskCompletion["source"]): string {
  if (source === "webhook") {
    return "Pull request merged";
  }

  return "Moved to Done";
}
