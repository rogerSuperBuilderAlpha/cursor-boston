/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Input Sanitization Utilities
 * 
 * Provides functions to sanitize user input to prevent XSS and other injection attacks.
 * These functions should be used on all user-generated content before storage.
 */

/**
 * Normalize free-text user input for storage.
 *
 * Strips ASCII control characters (except newline), normalizes tabs and
 * carriage returns to spaces, and trims surrounding whitespace. Does NOT
 * strip HTML — values are expected to be rendered through React's JSX
 * expressions, which auto-escape `<`, `>`, `"`, `'`, and `&`.
 *
 * Do NOT use the output of this function as:
 *   - HTML (e.g. `dangerouslySetInnerHTML`) — use a dedicated HTML sanitizer.
 *   - A URL (`href`, `src`) — use {@link sanitizeUrl}.
 *   - A Firestore document ID — use {@link sanitizeDocId}.
 *
 * @param input - The raw string to normalize
 * @returns The normalized string, or an empty string if input is not a string
 * @example
 * // Strips invisible control characters but keeps everything else
 * sanitizeText("me\x00ow")  // "meow"
 *
 * @example
 * // Trims surrounding whitespace but keeps internal punctuation and HTML
 * sanitizeText("  <b>Hello, World!</b>  ")  // "<b>Hello, World!</b>"
 */
export function sanitizeText(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  return input
    // Strip ASCII control chars except \t (0x09), \n (0x0A), \r (0x0D).
    // Character class — no backtracking, no ReDoS.
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    // Normalize tabs and carriage returns to spaces; preserve newlines.
    .replace(/[\t\r]+/g, " ")
    .trim();
}

/**
 * Sanitize a display name to a restricted character set.
 *
 * Allows only ASCII letters (a–z, A–Z), digits, whitespace, hyphens,
 * underscores, and periods. Everything else gets stripped — punctuation,
 * symbols, and non-ASCII letters like accents or non-Latin scripts.
 * Runs of whitespace collapse to a single space, and surrounding
 * whitespace is trimmed.
 *
 * Heads up: international names with accented or non-Latin characters
 * (e.g. "José", "李雷") will be partially or fully stripped. Make sure
 * that's the behavior you want before using this on user-facing name fields.
 *
 * Do NOT use the output of this function as:
 *   - A URL (`href`, `src`) — use {@link sanitizeUrl}.
 *   - A Firestore document ID — use {@link sanitizeDocId}.
 *
 * @param input - The raw display name to sanitize
 * @returns The sanitized name, or an empty string if input is not a string or contains no allowed characters.
 *
 * @example
 * sanitizeName("Hello,  World^^! ")  // "Hello World"
 *
 * @example
 * // Non-ASCII letters get stripped
 * sanitizeName("José Ñoño")  // "Jos oo"
 */
export function sanitizeName(input: string): string {
  if (typeof input !== "string") {
    return "";
  }
  
  return input
    // Only allow alphanumeric, spaces, hyphens, underscores, periods
    .replace(/[^a-zA-Z0-9\s\-_.]/g, "")
    // Collapse multiple spaces
    .replace(/\s+/g, " ")
    // Trim
    .trim();
}

/**
 * Validate and normalize an HTTP or HTTPS URL.
 *
 * Trims whitespace, then parses the input with the WHATWG URL constructor.
 * Only `http:` and `https:` URLs are allowed — anything else (including
 * `javascript:`, `data:`, and `file:`) returns null. This blocks XSS via
 * clickable links and other URL-based injection.
 *
 * On success, the URL comes back normalized: lowercased host and protocol,
 * trailing slash added to bare hostnames, paths normalized, special
 * characters percent-encoded. The output may not match the input exactly
 * even when the URL is valid.
 *
 * Returns null for input that isn't a string, is empty after trimming,
 * fails to parse, or uses a disallowed protocol. Callers need to handle
 * the null case before using the result.
 *
 * Do NOT use the output of this function as:
 *   - A Firestore document ID — use {@link sanitizeDocId}.
 *
 * @param input - The raw URL string to validate and sanitize
 * @returns The normalized URL string, or null if invalid or uses a disallowed protocol.
 *
 * @example
 * sanitizeUrl("HTTPS://Example.com")  // "https://example.com/"
 *
 * @example
 * // Blocks javascript: URLs to prevent XSS
 * sanitizeUrl("javascript:alert(1)")  // null
 *
 * @example
 * sanitizeUrl("not a url")  // null
 */
export function sanitizeUrl(input: string): string | null {
  if (typeof input !== "string" || !input.trim()) {
    return null;
  }
  
  const trimmed = input.trim();
  
  try {
    const url = new URL(trimmed);
    
    // Only allow http and https protocols
    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }
    
    // Reconstruct the URL to normalize it
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Validate a Firestore document ID.
 *
 * Firestore is strict about document IDs: ASCII letters (a–z, A–Z),
 * digits, hyphens, and underscores only, and 1500 bytes max. This
 * function trims whitespace and checks both rules — if anything fails,
 * it returns null. Unlike {@link sanitizeText} and {@link sanitizeName},
 * this function never modifies the input. It either returns the trimmed
 * string as-is or rejects it.
 *
 * Validation-only is on purpose. Silently transforming an ID could cause
 * data corruption (two different inputs mapping to the same ID). If you
 * get null back, treat it as an input error and surface it to the user
 * instead of retrying with a transformed value.
 *
 * Returns null for input that isn't a string, is empty after trimming,
 * has disallowed characters (spaces, periods, slashes, non-ASCII letters),
 * or exceeds 1500 characters.
 *
 * @param input - The raw document ID to validate
 * @returns The trimmed document ID if valid, or null if invalid.
 *
 * @example
 * sanitizeDocId("user-abc_123")  // "user-abc_123"
 *
 * @example
 * // Spaces and periods aren't allowed
 * sanitizeDocId("my user.id")  // null
 *
 * @example
 * // Non-ASCII characters get rejected
 * sanitizeDocId("user-josé")  // null
 *
 * @example
 * // Over the 1500-character limit
 * sanitizeDocId("a".repeat(1501))  // null
 */
export function sanitizeDocId(input: string): string | null {
  if (typeof input !== "string" || !input.trim()) {
    return null;
  }
  
  const trimmed = input.trim();
  
  // Firestore document IDs: alphanumeric, hyphens, underscores
  // Max length 1500 bytes (roughly 1500 chars for ASCII)
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed) || trimmed.length > 1500) {
    return null;
  }
  
  return trimmed;
}

/**
 * Validate a hackathon ID format (e.g., "virtual-2025-01").
 * @param input - The hackathon ID string to validate
 * @returns True if the ID matches a valid hackathon ID format, false otherwise
 */
export function isValidHackathonId(input: string): boolean {
  if (typeof input !== "string") {
    return false;
  }
  
  // Matches: "virtual-YYYY-MM" or other allowed formats
  return /^virtual-\d{4}-\d{2}$/.test(input) || /^[a-z0-9-]+$/.test(input);
}
