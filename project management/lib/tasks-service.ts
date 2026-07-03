import { publishTaskEvent } from "@/lib/events";
import { listTasks, updateTaskStatus } from "@/lib/db";
import type { TaskStatus } from "@/lib/types";

export function getAllTasks() {
  return listTasks();
}

export function changeTaskStatus(taskId: string, status: TaskStatus, source: "api" | "manual") {
  const updatedTask = updateTaskStatus(taskId, status);
  if (!updatedTask) {
    return null;
  }

  publishTaskEvent({
    type: "task.updated",
    task: updatedTask,
    source,
  });

  return updatedTask;
}

export function publishTasksSnapshot() {
  publishTaskEvent({
    type: "tasks.snapshot",
    tasks: listTasks(),
  });
}
