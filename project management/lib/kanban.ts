import type { KanbanColumnConfig, TaskStatus } from "./types";

export const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  { id: "backlog", title: "Backlog" },
  { id: "in-progress", title: "In Progress" },
  { id: "review", title: "Review" },
  { id: "done", title: "Done" },
];

export const TASK_STATUS_IDS = KANBAN_COLUMNS.map((column) => column.id);

export function isTaskStatus(value: string): value is TaskStatus {
  return TASK_STATUS_IDS.includes(value as TaskStatus);
}

export function resolveDropStatus(
  overId: string,
  getTaskStatus: (taskId: string) => TaskStatus | undefined,
): TaskStatus | null {
  if (isTaskStatus(overId)) {
    return overId;
  }

  return getTaskStatus(overId) ?? null;
}
