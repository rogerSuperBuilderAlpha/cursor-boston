"use client";

import { useDroppable } from "@dnd-kit/core";
import { AnimatePresence, motion } from "framer-motion";
import KanbanCard from "@/components/KanbanCard";
import type { KanbanColumnConfig, Task } from "@/lib/types";

type KanbanColumnProps = {
  column: KanbanColumnConfig;
  tasks: Task[];
};

export default function KanbanColumn({ column, tasks }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column", columnId: column.id },
  });

  const isDoneColumn = column.id === "done";

  return (
    <section
      ref={setNodeRef}
      className={`flex min-h-[420px] flex-col rounded-2xl border p-3 transition-colors ${
        isOver
          ? isDoneColumn
            ? "border-emerald-300/80 bg-emerald-50/40"
            : "border-[#d4cfc6] bg-[#f5f3ef]"
          : "border-border bg-[#faf9f7]"
      }`}
    >
      <header className="mb-3 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">{column.title}</h2>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium tabular-nums text-muted shadow-sm">
          {tasks.length}
        </span>
      </header>

      <ul className="flex flex-1 flex-col gap-2">
        <AnimatePresence mode="popLayout" initial={false}>
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <motion.li
                key={task.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              >
                <KanbanCard task={task} />
              </motion.li>
            ))
          ) : (
            <motion.li
              key={`empty-${column.id}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/80 px-4 py-10 text-center text-xs text-muted"
            >
              Drop tasks here
            </motion.li>
          )}
        </AnimatePresence>
      </ul>
    </section>
  );
}
