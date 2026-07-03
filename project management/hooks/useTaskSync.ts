"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TaskCompletion } from "@/lib/completions";
import type { RealtimeEvent, Task, TaskStatus } from "@/lib/types";

type SyncStatus = "connecting" | "live" | "offline";

function createCompletionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function queueCompletion(
  setCompletions: React.Dispatch<React.SetStateAction<TaskCompletion[]>>,
  task: Task,
  source: TaskCompletion["source"],
) {
  setCompletions((current) => [
    ...current,
    {
      id: createCompletionId(),
      task,
      source,
      createdAt: Date.now(),
    },
  ]);
}

export function useTaskSync() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [status, setStatus] = useState<SyncStatus>("connecting");
  const [isLoading, setIsLoading] = useState(true);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);

  const previousStatusesRef = useRef<Map<string, TaskStatus>>(new Map());
  const hasHydratedRef = useRef(false);

  const dismissCompletion = useCallback((id: string) => {
    setCompletions((current) => current.filter((completion) => completion.id !== id));
  }, []);

  const detectCompletions = useCallback(
    (nextTasks: Task[], source: TaskCompletion["source"]) => {
      if (!hasHydratedRef.current) {
        previousStatusesRef.current = new Map(nextTasks.map((task) => [task.id, task.status]));
        hasHydratedRef.current = true;
        return;
      }

      const previousStatuses = previousStatusesRef.current;

      for (const task of nextTasks) {
        const previousStatus = previousStatuses.get(task.id);
        if (previousStatus !== undefined && previousStatus !== "done" && task.status === "done") {
          queueCompletion(setCompletions, task, source);
        }
      }

      previousStatusesRef.current = new Map(nextTasks.map((task) => [task.id, task.status]));
    },
    [],
  );

  useEffect(() => {
    let isMounted = true;
    const eventSource = new EventSource("/api/events");

    eventSource.onopen = () => {
      if (isMounted) {
        setStatus("live");
      }
    };

    eventSource.onmessage = (message) => {
      if (!isMounted) return;

      const event = JSON.parse(message.data) as RealtimeEvent;

      if (event.type === "tasks.snapshot") {
        setTasks(event.tasks);
        detectCompletions(event.tasks, "api");
        setIsLoading(false);
        return;
      }

      if (event.type === "task.updated") {
        setTasks((current) => {
          const nextTasks = current.some((task) => task.id === event.task.id)
            ? current.map((task) => (task.id === event.task.id ? event.task : task))
            : [...current, event.task];

          detectCompletions(nextTasks, event.source);
          return nextTasks;
        });
        setIsLoading(false);
      }
    };

    eventSource.onerror = () => {
      if (isMounted) {
        setStatus("offline");
      }
    };

    return () => {
      isMounted = false;
      eventSource.close();
    };
  }, [detectCompletions]);

  const moveTask = useCallback(
    async (taskId: string, nextStatus: TaskStatus) => {
      const optimisticTasks = tasks.map((task) =>
        task.id === taskId ? { ...task, status: nextStatus } : task,
      );

      setTasks(optimisticTasks);
      detectCompletions(optimisticTasks, "manual");

      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        const snapshot = await fetch("/api/tasks");
        if (snapshot.ok) {
          const body = (await snapshot.json()) as { tasks: Task[] };
          setTasks(body.tasks);
          previousStatusesRef.current = new Map(body.tasks.map((task) => [task.id, task.status]));
        }
        throw new Error("Failed to update task.");
      }
    },
    [detectCompletions, tasks],
  );

  return {
    tasks,
    status,
    isLoading,
    moveTask,
    completions,
    dismissCompletion,
  };
}
