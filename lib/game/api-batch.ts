/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { TurnReport } from "./types";

// Loops a turn-spending step `count` times. The FIRST call is allowed to
// throw — the route's outer try/catch handles it, so the original GameError
// reaches the error mapper and the right HTTP status comes back. Once at
// least one step has succeeded, subsequent failures are caught and returned
// as `stoppedEarly`, surfacing a partial result instead of a 500.
export async function runBatch<T extends { report: TurnReport }>(
  count: number,
  step: () => Promise<T>
): Promise<{
  reports: TurnReport[];
  lastResult: T;
  stoppedEarly?: string;
}> {
  const first = await step();
  const reports: TurnReport[] = [first.report];
  let lastResult = first;
  for (let i = 1; i < count; i++) {
    try {
      const out = await step();
      reports.push(out.report);
      lastResult = out;
    } catch (err) {
      return {
        reports,
        lastResult,
        stoppedEarly: err instanceof Error ? err.message : String(err),
      };
    }
  }
  return { reports, lastResult };
}

// Parses `count` from a request body, clamping to [1, max]. Returns 1 for
// undefined / null / non-numeric values.
export function parseBatchCount(raw: unknown, max = 100): number {
  if (raw === undefined || raw === null) return 1;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(max, Math.floor(n)));
}
