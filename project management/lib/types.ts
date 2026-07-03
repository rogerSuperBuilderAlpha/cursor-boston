export type TaskPriority = "low" | "medium" | "high";

export type TaskStatus = "backlog" | "in-progress" | "review" | "done";

export type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  githubIssueNumber?: number | null;
};

export type Project = {
  id: string;
  name: string;
  milestone: string;
  tasks: Task[];
};

export type KanbanColumnConfig = {
  id: TaskStatus;
  title: string;
};

export type TaskUpdatedEvent = {
  type: "task.updated";
  task: Task;
  source: "webhook" | "api" | "manual";
};

export type TasksSnapshotEvent = {
  type: "tasks.snapshot";
  tasks: Task[];
};

export type RealtimeEvent = TaskUpdatedEvent | TasksSnapshotEvent | { type: "connected" };
