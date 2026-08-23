/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

type Category =
  | "university"
  | "accelerator"
  | "ai_org"
  | "vc"
  | "research_lab"
  | "nonprofit";

const NODES: {
  cat: Category;
  label: string;
  /** Position in the 400×300 viewBox */
  x: number;
  y: number;
  accent: string;
  accentSoft: string;
}[] = [
  {
    cat: "university",
    label: "Universities",
    x: 200,
    y: 48,
    accent: "text-emerald-700 dark:text-emerald-400",
    accentSoft: "bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60",
  },
  {
    cat: "accelerator",
    label: "Accelerators",
    x: 318,
    y: 105,
    accent: "text-amber-700 dark:text-amber-400",
    accentSoft: "bg-amber-500/10 border-amber-500/30 hover:border-amber-500/60",
  },
  {
    cat: "ai_org",
    label: "AI orgs",
    x: 318,
    y: 195,
    accent: "text-purple-700 dark:text-purple-400",
    accentSoft: "bg-purple-500/10 border-purple-500/30 hover:border-purple-500/60",
  },
  {
    cat: "vc",
    label: "Venture",
    x: 200,
    y: 252,
    accent: "text-blue-700 dark:text-blue-400",
    accentSoft: "bg-blue-500/10 border-blue-500/30 hover:border-blue-500/60",
  },
  {
    cat: "research_lab",
    label: "Research labs",
    x: 82,
    y: 195,
    accent: "text-cyan-700 dark:text-cyan-400",
    accentSoft: "bg-cyan-500/10 border-cyan-500/30 hover:border-cyan-500/60",
  },
  {
    cat: "nonprofit",
    label: "Nonprofits",
    x: 82,
    y: 105,
    accent: "text-rose-700 dark:text-rose-400",
    accentSoft: "bg-rose-500/10 border-rose-500/30 hover:border-rose-500/60",
  },
];

const CX = 200;
const CY = 150;

interface EcosystemHeroDiagramProps {
  counts: Record<string, number>;
  activeCategory: Category | "all";
  onSelect: (cat: Category) => void;
  total: number;
}

export default function EcosystemHeroDiagram({
  counts,
  activeCategory,
  onSelect,
  total,
}: EcosystemHeroDiagramProps) {
  return (
    <div className="ecosystem-diagram relative mx-auto mt-10 w-full max-w-2xl">
      <div
        className="relative aspect-[4/3] w-full rounded-2xl border border-neutral-200/80 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-100 via-white to-neutral-50 dark:border-neutral-800 dark:from-neutral-900 dark:via-neutral-950 dark:to-black"
        role="group"
        aria-label="Mass AI ecosystem map. Select a category to filter the directory."
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden="true">
          <div
            className="absolute inset-0 opacity-[0.35] dark:opacity-[0.2]"
            style={{
              backgroundImage:
                "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              color: "rgb(163 163 163 / 0.25)",
            }}
          />
        </div>

        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 400 300"
          fill="none"
          aria-hidden="true"
        >
          {NODES.map((node, i) => (
            <line
              key={node.cat}
              x1={CX}
              y1={CY}
              x2={node.x}
              y2={node.y}
              className="eco-line stroke-neutral-300 dark:stroke-neutral-700"
              strokeWidth="1.25"
              strokeDasharray="4 4"
              style={{ animationDelay: `${0.08 * i}s` }}
            />
          ))}
          <circle
            cx={CX}
            cy={CY}
            r="46"
            className="fill-white stroke-neutral-300 dark:fill-neutral-900 dark:stroke-neutral-700"
            strokeWidth="1.5"
          />
          <circle
            cx={CX}
            cy={CY}
            r="52"
            className="eco-hub-ring stroke-emerald-500/40 dark:stroke-emerald-400/30"
            strokeWidth="1"
          />
        </svg>

        <div className="eco-hub-label pointer-events-none absolute left-1/2 top-1/2 z-10 flex w-[7.5rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
            Mass AI
          </span>
          <span className="text-sm font-semibold leading-tight text-foreground">
            Ecosystem
          </span>
          <span className="mt-0.5 text-xs tabular-nums text-neutral-500 dark:text-neutral-400">
            {total} orgs
          </span>
        </div>

        {NODES.map((node, i) => {
          const isActive = activeCategory === node.cat;
          const count = counts[node.cat] ?? 0;
          return (
            <button
              key={node.cat}
              type="button"
              onClick={() => onSelect(node.cat)}
              aria-pressed={isActive}
              aria-label={`Filter by ${node.label}, ${count} entries`}
              className={`eco-node absolute z-10 flex min-h-0 min-w-[6.5rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-xl border px-3 py-2 text-center shadow-sm backdrop-blur-sm transition-[scale,box-shadow,border-color,background-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${node.accentSoft} ${
                isActive
                  ? "scale-105 shadow-md ring-2 ring-foreground/20"
                  : "hover:scale-[1.04] hover:shadow-md"
              }`}
              style={{
                left: `${(node.x / 400) * 100}%`,
                top: `${(node.y / 300) * 100}%`,
                animationDelay: `${0.12 + 0.07 * i}s`,
              }}
            >
              <span className={`text-xs font-semibold leading-tight ${node.accent}`}>
                {node.label}
              </span>
              <span className="mt-0.5 text-[11px] tabular-nums text-neutral-600 dark:text-neutral-400">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-center text-xs text-neutral-500">
        Click a node to filter the directory below
      </p>
    </div>
  );
}
