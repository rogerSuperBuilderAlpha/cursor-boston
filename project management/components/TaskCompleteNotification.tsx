"use client";

import { motion } from "framer-motion";
import { useEffect } from "react";
import { getCompletionDetail, getCompletionLabel, type TaskCompletion } from "@/lib/completions";
import { playSuccessChime } from "@/lib/success-chime";

type TaskCompleteNotificationProps = {
  completion: TaskCompletion;
  onDismiss: (id: string) => void;
};

const AUTO_DISMISS_MS = 4800;

export default function TaskCompleteNotification({
  completion,
  onDismiss,
}: TaskCompleteNotificationProps) {
  useEffect(() => {
    playSuccessChime();

    const timer = window.setTimeout(() => {
      onDismiss(completion.id);
    }, AUTO_DISMISS_MS);

    return () => window.clearTimeout(timer);
  }, [completion.id, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ x: 120, opacity: 0, scale: 0.92 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ x: 120, opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.85 }}
      className="pointer-events-auto relative w-[min(92vw,360px)] overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(145deg,#17171c_0%,#25252d_48%,#1d1d24_100%)] shadow-[0_18px_50px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.04)_inset]"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,112,204,0.22),transparent_55%)]" />
      <div className="trophy-shine pointer-events-none absolute inset-0" />

      <div className="relative flex items-stretch gap-3 p-4">
        <div className="flex shrink-0 flex-col items-center justify-center">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-[linear-gradient(160deg,#3a3a45_0%,#1f1f26_100%)] shadow-[0_8px_20px_rgba(0,0,0,0.35)]">
            <div className="absolute inset-1 rounded-full border border-white/10" />
            <TrophyIcon />
          </div>
        </div>

        <div className="min-w-0 flex-1 py-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7eb8ff]">
            {getCompletionLabel(completion.source)}
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-white">{completion.task.title}</p>
          <p className="mt-1 text-xs text-white/55">{getCompletionDetail(completion.source)}</p>
        </div>

        <button
          type="button"
          onClick={() => onDismiss(completion.id)}
          className="self-start rounded-md px-1.5 py-1 text-xs text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>

      <div className="relative h-0.5 overflow-hidden bg-white/5">
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: AUTO_DISMISS_MS / 1000, ease: "linear" }}
          className="h-full origin-left bg-[linear-gradient(90deg,#0070cc,#5eb0ff)]"
        />
      </div>
    </motion.div>
  );
}

function TrophyIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className="h-7 w-7 text-[#f5d061]"
      aria-hidden
    >
      <path
        fill="currentColor"
        d="M8 3h8l1 2h3a1 1 0 0 1 1 1v1a4 4 0 0 1-3.07 3.88A6.5 6.5 0 0 1 12 18.5V21h2v1H10v-1h2v-2.5A6.5 6.5 0 0 1 6.07 10.88 4 4 0 0 1 3 7V6a1 1 0 0 1 1-1h3l1-2Z"
        opacity="0.95"
      />
      <path
        stroke="currentColor"
        strokeWidth="1.2"
        d="M8 5h8"
        className="text-[#fff3bf]"
      />
    </svg>
  );
}
