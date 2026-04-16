/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * fetch() with an AbortController-backed timeout. A stalled external service
 * would otherwise consume up to the function's maxDuration (300s) per call.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { next?: { revalidate?: number } } = {},
  timeoutMs = 8000
): Promise<Response> {
  const controller = new AbortController();
  const signal = init.signal
    ? anySignal([controller.signal, init.signal as AbortSignal])
    : controller.signal;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal });
  } finally {
    clearTimeout(timer);
  }
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  const c = new AbortController();
  for (const s of signals) {
    if (s.aborted) {
      c.abort();
      break;
    }
    s.addEventListener("abort", () => c.abort(), { once: true });
  }
  return c.signal;
}
