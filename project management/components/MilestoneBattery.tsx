"use client";

import { motion, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";

type MilestoneBatteryProps = {
  percent: number;
  milestone: string;
  completedCount: number;
  totalCount: number;
};

const springConfig = { stiffness: 120, damping: 18, mass: 0.8 };

export default function MilestoneBattery({
  percent,
  milestone,
  completedCount,
  totalCount,
}: MilestoneBatteryProps) {
  const isComplete = percent === 100;
  const clamped = Math.min(Math.max(percent, 0), 100);

  const springPercent = useSpring(0, springConfig);
  const displayPercent = useTransform(springPercent, (value) => Math.round(value));
  const ringOffset = useTransform(springPercent, (value) => {
    const circumference = 2 * Math.PI * 54;
    return circumference - (value / 100) * circumference;
  });
  const barScale = useTransform(springPercent, (value) => value / 100);

  useEffect(() => {
    springPercent.set(clamped);
  }, [clamped, springPercent]);

  const ringSize = 140;
  const strokeWidth = 14;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className={`relative overflow-hidden rounded-3xl border border-border bg-surface p-8 shadow-[0_1px_2px_rgba(26,25,23,0.04),0_12px_40px_rgba(26,25,23,0.06)] ${
        isComplete ? "milestone-complete-glow border-emerald-300/60" : ""
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_55%)]" />

      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            Milestone Battery
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {milestone}
          </h1>
          <p className="text-sm text-muted">
            {completedCount} of {totalCount} tasks complete
          </p>
        </div>

        <div className="flex items-center gap-8">
          <div className="relative shrink-0" style={{ width: ringSize, height: ringSize }}>
            <svg
              width={ringSize}
              height={ringSize}
              viewBox={`0 0 ${ringSize} ${ringSize}`}
              className="-rotate-90"
              aria-hidden
            >
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke="#ece9e3"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
              <motion.circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke={isComplete ? "#10b981" : "#059669"}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                style={{ strokeDashoffset: ringOffset }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                {displayPercent}
              </motion.span>
              <span className="text-xs font-medium uppercase tracking-wider text-muted">%</span>
            </div>
          </div>

          <div className="hidden min-w-[200px] flex-1 sm:block lg:min-w-[280px]">
            <div className="mb-2 flex items-end justify-between">
              <span className="text-sm font-medium text-foreground">Progress</span>
              <motion.span
                key={isComplete ? "done" : "progress"}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className={`text-sm font-medium ${isComplete ? "text-emerald-600" : "text-muted"}`}
              >
                {isComplete ? "Complete" : "In progress"}
              </motion.span>
            </div>

            <div className="relative h-7 overflow-hidden rounded-full bg-[#ece9e3] p-1">
              <motion.div
                className={`relative h-full origin-left rounded-full ${
                  isComplete
                    ? "bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600"
                    : "bg-gradient-to-r from-emerald-500/80 via-emerald-500 to-emerald-600"
                }`}
                style={{ scaleX: barScale }}
              />
              <div className="pointer-events-none absolute inset-1 flex gap-1">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-full flex-1 rounded-full border border-white/20"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative mt-8 sm:hidden">
        <div className="relative h-8 overflow-hidden rounded-full bg-[#ece9e3] p-1">
          <motion.div
            className={`h-full origin-left rounded-full ${
              isComplete
                ? "bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600"
                : "bg-gradient-to-r from-emerald-500/80 via-emerald-500 to-emerald-600"
            }`}
            style={{ scaleX: barScale }}
          />
        </div>
      </div>

      {isComplete && (
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
          className="relative mt-6 text-center text-sm font-medium text-emerald-600"
        >
          Milestone reached — nice work.
        </motion.p>
      )}
    </motion.section>
  );
}
