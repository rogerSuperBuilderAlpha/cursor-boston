"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useMemo, useState } from "react";
import KanbanCard from "@/components/KanbanCard";
import KanbanColumn from "@/components/KanbanColumn";
import { KANBAN_COLUMNS, resolveDropStatus } from "@/lib/kanban";
import type { Task, TaskStatus } from "@/lib/types";

type KanbanBoardProps = {
  tasks: Task[];
  onMoveTask: (taskId: string, status: TaskStatus) => void | Promise<void>;
};

export default function KanbanBoard({ tasks, onMoveTask }: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const tasksByColumn = useMemo(() => {
    const grouped = KANBAN_COLUMNS.reduce(
      (accumulator, column) => {
        accumulator[column.id] = [];
        return accumulator;
      },
      {} as Record<TaskStatus, Task[]>,
    );

    for (const task of tasks) {
      grouped[task.status].push(task);
    }

    return grouped;
  }, [tasks]);

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((item) => item.id === event.active.id);
    setActiveTask(task ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = String(active.id);
    const currentTask = tasks.find((item) => item.id === taskId);
    if (!currentTask) return;

    const nextStatus = resolveDropStatus(over.id as string, (id) =>
      tasks.find((item) => item.id === id)?.status,
    );

    if (!nextStatus || nextStatus === currentTask.status) return;

    onMoveTask(taskId, nextStatus);
  }

  function handleDragCancel() {
    setActiveTask(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
        {KANBAN_COLUMNS.map((column) => (
          <KanbanColumn key={column.id} column={column} tasks={tasksByColumn[column.id]} />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
        {activeTask ? <KanbanCard task={activeTask} isDragOverlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
