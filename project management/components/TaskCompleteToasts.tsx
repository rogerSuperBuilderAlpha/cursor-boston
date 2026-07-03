"use client";

import { AnimatePresence } from "framer-motion";
import TaskCompleteNotification from "@/components/TaskCompleteNotification";
import type { TaskCompletion } from "@/lib/completions";

type TaskCompleteToastsProps = {
  completions: TaskCompletion[];
  onDismiss: (id: string) => void;
};

export default function TaskCompleteToasts({ completions, onDismiss }: TaskCompleteToastsProps) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-5 z-[100] flex flex-col items-end gap-3 px-4 sm:px-6"
      aria-label="Task completion notifications"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {completions.map((completion) => (
          <TaskCompleteNotification
            key={completion.id}
            completion={completion}
            onDismiss={onDismiss}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
