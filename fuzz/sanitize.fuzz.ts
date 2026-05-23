/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

// jazzer.js coverage-guided fuzzer for lib/sanitize.ts.
//
// Exercises every public sanitizer with byte-level random input and
// asserts the documented invariants. A crash, ReDoS-style hang, or
// invariant violation is what we want jazzer to find — those are
// regressions worth catching before they reach prod.
//
// Run locally:
//   npx jazzer fuzz/sanitize.fuzz.ts --sync
// In CI: ClusterFuzzLite invokes this via .clusterfuzzlite/Dockerfile.

import {
  sanitizeText,
  sanitizeName,
  sanitizeUrl,
  sanitizeDocId,
  isValidHackathonId,
} from "../lib/sanitize";

// jazzer.js expects a `fuzz` export with signature (data: Buffer) => void.
export function fuzz(data: Buffer): void {
  // Decode the random bytes into a string the sanitizers can chew on.
  // Cap length defensively so a single iteration can't dominate the
  // fuzzing budget; real inputs aren't multi-MB anyway.
  const input = data.subarray(0, 4096).toString("utf8");

  // === sanitizeText: must never crash and must drop control chars ===
  const text = sanitizeText(input);
  if (typeof text !== "string") {
    throw new Error("sanitizeText returned non-string");
  }
  // Invariant: no ASCII control chars in output (except newline 0x0A).
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (
      (c >= 0x00 && c <= 0x08) ||
      c === 0x0b ||
      c === 0x0c ||
      (c >= 0x0e && c <= 0x1f) ||
      c === 0x7f
    ) {
      throw new Error(
        `sanitizeText leaked control char 0x${c.toString(16)} in output`
      );
    }
  }

  // === sanitizeName: stricter — only [A-Za-z0-9 _\-.] allowed ===
  const name = sanitizeName(input);
  if (typeof name !== "string") {
    throw new Error("sanitizeName returned non-string");
  }
  if (!/^[a-zA-Z0-9 _\-.]*$/.test(name)) {
    throw new Error(`sanitizeName leaked disallowed char in: ${JSON.stringify(name)}`);
  }

  // === sanitizeUrl: returns string|null; if non-null, must be parseable
  // and must use http(s) ===
  const url = sanitizeUrl(input);
  if (url !== null) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`sanitizeUrl returned non-URL: ${url}`);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(
        `sanitizeUrl returned ${parsed.protocol} (must be http: or https:)`
      );
    }
  }

  // === sanitizeDocId: returns string|null; if non-null, must match the
  // Firestore-safe alphabet and be ≤1500 chars ===
  const docId = sanitizeDocId(input);
  if (docId !== null) {
    if (!/^[a-zA-Z0-9_-]+$/.test(docId)) {
      throw new Error(`sanitizeDocId returned invalid id: ${docId}`);
    }
    if (docId.length > 1500) {
      throw new Error(`sanitizeDocId returned >1500 chars (${docId.length})`);
    }
  }

  // === isValidHackathonId: pure boolean; just must not throw ===
  const ok = isValidHackathonId(input);
  if (typeof ok !== "boolean") {
    throw new Error("isValidHackathonId returned non-boolean");
  }
}
