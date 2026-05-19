/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

interface Props {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
  onShowWorld: () => void;
}

export function ZoomControls({
  onZoomIn,
  onZoomOut,
  onRecenter,
  onShowWorld,
}: Props) {
  return (
    <div className="absolute top-3 right-3 flex flex-col gap-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-sm">
      <button
        onClick={onZoomIn}
        className="px-2.5 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-t-lg"
        title="Zoom in"
      >
        +
      </button>
      <button
        onClick={onZoomOut}
        className="px-2.5 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-800"
        title="Zoom out"
      >
        −
      </button>
      <button
        onClick={onRecenter}
        className="px-2.5 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-800"
        title="Recenter on your territory"
      >
        ⌖
      </button>
      <button
        onClick={onShowWorld}
        className="px-2.5 py-1.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-b-lg border-t border-neutral-200 dark:border-neutral-800"
        title="Show the whole world"
      >
        🌐
      </button>
    </div>
  );
}
