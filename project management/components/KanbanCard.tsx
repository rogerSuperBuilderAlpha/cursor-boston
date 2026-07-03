"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { Task, TaskPriority } from "@/lib/types";

const priorityStyles: Record<TaskPriority, string> = {
  low: "bg-stone-100 text-stone-500",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-rose-50 text-rose-600",
};

type KanbanCardProps = {
  task: Task;
  isDragOverlay?: boolean;
};

export default function KanbanCard({ task, isDragOverlay = false }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { type: "task", task },
    disabled: isDragOverlay,
  });

  const style = isDragOverlay
    ? undefined
    : {
        transform: CSS.Translate.toString(transform),
      };

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={style}
      {...(isDragOverlay ? {} : { ...listeners, ...attributes })}
      className={`cursor-grab rounded-xl border bg-white px-4 py-3 active:cursor-grabbing ${
        isDragOverlay
          ? "scale-[1.03] rotate-[1.5deg] border-emerald-200/80 shadow-[0_18px_40px_rgba(26,25,23,0.14),0_4px_12px_rgba(26,25,23,0.08)]"
          : isDragging
            ? "border-border/60 opacity-40 shadow-none"
            : "border-border shadow-[0_1px_2px_rgba(26,25,23,0.04)] transition-[box-shadow,transform,border-color] hover:border-emerald-200/70 hover:shadow-[0_8px_24px_rgba(26,25,23,0.08)]"
      }`}
    >
      <p
        className={`text-sm leading-snug ${
          task.status === "done" ? "text-muted line-through decoration-[#c9c4bb]" : "text-foreground"
        }`}
      >
        {task.title}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <span
          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${priorityStyles[task.priority]}`}
        >
          {task.priority}
        </span>
        {task.status === "done" && (
          <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-600">
            Complete
          </span>
        )}
      </div>
    </div>
  );
}
