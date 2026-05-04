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
 *
 * Each function is a *normalizer*: given any string (or a non-string), it returns
 * either a sanitized string or `null` / `""` for invalid input. None of these
 * functions throw.
 *
 * | Function                | Output type        | Use for                                  |
 * |-------------------------|--------------------|------------------------------------------|
 * | {@link sanitizeText}    | `string`           | Free-text fields rendered via JSX        |
 * | {@link sanitizeName}    | `string`           | Display names, usernames                 |
 * | {@link sanitizeUrl}     | `string \| null`   | `href` / `src` attributes                |
 * | {@link sanitizeDocId}   | `string \| null`   | Firestore document IDs                   |
 * | {@link isValidHackathonId} | `boolean`       | Hackathon ID validation                  |
 */

/**
 * Normalize free-text user input for storage.
 *
 * Strips ASCII control characters (except newline), normalizes tabs and
 * carriage returns to spaces, and trims surrounding whitespace. Does NOT
 * strip HTML — values are expected to be rendered through React's JSX
 * expressions, which auto-escape `<`, `>`, `"`, `'`, and `&`.
 *
 * ### Security properties
 * - **Safe to render via JSX text:** angle brackets, quotes, and ampersands
 *   are preserved verbatim and escaped at the render layer.
 * - **Removes null bytes** (`\x00`) and other C0 control characters that can
 *   confuse downstream parsers, log aggregators, or terminal output.
 * - **NOT safe for HTML sinks.** The output is plain text, not HTML.
 * - **NOT safe for URL contexts.** Strings like `javascript:alert(1)` are
 *   preserved verbatim — use {@link sanitizeUrl} before assigning to `href`.
 *
 * Do NOT use the output of this function as:
 *   - HTML (e.g. `dangerouslySetInnerHTML`) — use a dedicated HTML sanitizer.
 *   - A URL (`href`, `src`) — use {@link sanitizeUrl}.
 *   - A Firestore document ID — use {@link sanitizeDocId}.
 *
 * @param input - The raw string to normalize
 * @returns The normalized string, or an empty string if input is not a string
 *
 * @example
 * sanitizeText("  Hello, World!  ");        // "Hello, World!"
 * sanitizeText("hello\0world");             // "helloworld"  (null byte stripped)
 * sanitizeText("hello\tworld");             // "hello world" (tab → space)
 * sanitizeText("line1\r\nline2");           // "line1 \nline2" (CR → space, LF kept)
 *
 * @example
 * // HTML-like input is preserved verbatim — JSX will escape it on render.
 * sanitizeText('<script>alert("xss")</script>');
 * // → '<script>alert("xss")</script>'
 *
 * @example
 * // Non-string inputs return "" instead of throwing.
 * sanitizeText(null as unknown as string);  // ""
 * sanitizeText(123 as unknown as string);   // ""
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
 * Sanitize a display name.
 *
 * More restrictive than {@link sanitizeText}: keeps only ASCII alphanumeric
 * characters, spaces, hyphens, underscores, and periods. Everything else
 * (including all non-ASCII letters, punctuation, and HTML metacharacters) is
 * dropped. Multiple consecutive spaces are collapsed to one, and the result
 * is trimmed.
 *
 * ### Security properties
 * - **XSS-safe by allowlist:** `<`, `>`, `"`, `'`, `&`, `(`, `)`, `;`, `=`,
 *   etc. are removed, so the output is safe in HTML attribute contexts even
 *   without further escaping.
 * - **Injection-safe for shell/SQL contexts:** no quote, backslash, or
 *   semicolon characters can survive.
 * - **Lossy for non-ASCII users.** Characters such as `é`, `ñ`, `中`, or
 *   emoji are stripped entirely. Do not use this for fields that must
 *   preserve internationalized names; prefer {@link sanitizeText}.
 *
 * @param input - The raw display name to sanitize
 * @returns The sanitized name containing only ASCII alphanumerics, spaces,
 *   hyphens, underscores, and periods. Returns `""` for non-string input.
 *
 * @example
 * sanitizeName("John Doe-Jr_III.");   // "John Doe-Jr_III."
 * sanitizeName("John   Doe");         // "John Doe"   (spaces collapsed)
 * sanitizeName("  John  ");           // "John"       (trimmed)
 *
 * @example
 * // Special characters and HTML are stripped, not escaped.
 * sanitizeName("John@Doe!");          // "JohnDoe"
 * sanitizeName("user<script>");       // "userscript"
 *
 * @example
 * // Lossy for non-ASCII — use sanitizeText if names need full Unicode.
 * sanitizeName("José");               // "Jos"
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
 * Validate and sanitize a URL for use in `href` / `src` attributes.
 *
 * Parses the input with the WHATWG `URL` constructor and accepts the result
 * only if its protocol is exactly `http:` or `https:`. The returned value is
 * the normalized form (`URL.href`), which adds a trailing `/` to bare hosts
 * and percent-encodes path/query characters.
 *
 * ### Security properties
 * - **Blocks XSS-via-URL schemes:** `javascript:`, `data:`, `vbscript:`,
 *   `file:`, etc. all return `null`.
 * - **Blocks malformed URLs:** anything `new URL(...)` would throw on
 *   (e.g. `"not a url"`) returns `null`.
 * - **Does NOT validate the host.** Any reachable hostname — including
 *   `localhost`, raw IPs, internal DNS names, or attacker-controlled
 *   domains — is accepted. Apply an allowlist at the call site if needed
 *   (see e.g. `scripts/_lib/parse-github-login.ts`).
 * - **Does NOT strip credentials.** `https://user:pass@example.com/` is
 *   normalized but passed through verbatim. Reject credential-bearing URLs
 *   at the call site if your context requires it.
 *
 * @param input - The raw URL string to validate and sanitize
 * @returns The normalized URL string, or `null` if the URL is invalid, empty,
 *   non-string, or uses a non-HTTP(S) protocol.
 *
 * @example
 * sanitizeUrl("https://example.com");           // "https://example.com/"
 * sanitizeUrl("http://example.com/path?q=1");   // "http://example.com/path?q=1"
 * sanitizeUrl("  https://example.com  ");       // "https://example.com/"
 *
 * @example
 * // Dangerous schemes return null.
 * sanitizeUrl("javascript:alert(1)");           // null
 * sanitizeUrl("data:text/html,<h1>hi</h1>");    // null
 * sanitizeUrl("ftp://example.com");             // null
 *
 * @example
 * // Malformed input returns null instead of throwing.
 * sanitizeUrl("not a url");                     // null
 * sanitizeUrl("");                              // null
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
 * Sanitize a Firestore document ID.
 *
 * Accepts only IDs matching `/^[a-zA-Z0-9_-]+$/` and at most 1500 bytes
 * (Firestore's documented limit). The input is trimmed before validation;
 * any other character — including dot, slash, space, or non-ASCII — causes
 * the function to return `null` rather than silently rewriting the ID.
 *
 * ### Security properties
 * - **Path-traversal-safe:** rejects `parent/child`, `..`, and other
 *   segments that could escape the intended collection.
 * - **Reserved-name-safe:** rejects `.` and `..` (Firestore-reserved) by way
 *   of the no-dot rule.
 * - **Length-bounded:** rejects IDs over 1500 chars to stay within
 *   Firestore's hard limit and prevent oversized-key DoS.
 * - **No silent rewriting.** Unlike {@link sanitizeName}, this function does
 *   not return a partial ID — invalid input is rejected, so callers cannot
 *   accidentally write to an unintended document.
 *
 * @param input - The raw document ID to sanitize
 * @returns The trimmed, validated document ID, or `null` if the input is
 *   non-string, empty, contains disallowed characters, or exceeds 1500 chars.
 *
 * @example
 * sanitizeDocId("abc-123_DEF");        // "abc-123_DEF"
 * sanitizeDocId("  valid-id  ");       // "valid-id"
 *
 * @example
 * // Anything outside [a-zA-Z0-9_-] returns null.
 * sanitizeDocId("parent/child");       // null  (path separator)
 * sanitizeDocId("file.txt");           // null  (dot)
 * sanitizeDocId("id with spaces");     // null
 * sanitizeDocId("<script>");           // null
 *
 * @example
 * // Length cap (1500 chars).
 * sanitizeDocId("a".repeat(1500));     // "aaa...a" (1500 a's)
 * sanitizeDocId("a".repeat(1501));     // null
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
 * Validate a hackathon ID format (e.g., `"virtual-2025-01"`).
 *
 * Accepts either the canonical `virtual-YYYY-MM` shape or any string of
 * lowercase ASCII alphanumerics and hyphens. Returns a boolean only; this
 * function does not normalize, so callers should use the input verbatim or
 * route it through {@link sanitizeDocId} before using it as a Firestore key.
 *
 * ### Security properties
 * - **Path-traversal-safe:** no `/`, `.`, `..`, or whitespace can pass.
 * - **Case-strict:** uppercase characters are rejected, preventing the
 *   `Hackathon` / `hackathon` aliasing problem in case-sensitive lookups.
 *
 * @param input - The hackathon ID string to validate
 * @returns `true` if the ID is a non-empty string of `[a-z0-9-]` (and so
 *   matches at least the lax fallback pattern); `false` otherwise.
 *
 * @example
 * isValidHackathonId("virtual-2025-01");   // true
 * isValidHackathonId("hack-a-sprint-2026"); // true
 *
 * @example
 * // Case-strict and ASCII-only.
 * isValidHackathonId("Virtual-2025-01");   // false
 * isValidHackathonId("hack thon");         // false
 * isValidHackathonId("hack@thon");         // false
 */
export function isValidHackathonId(input: string): boolean {
  if (typeof input !== "string") {
    return false;
  }
  
  // Matches: "virtual-YYYY-MM" or other allowed formats
  return /^virtual-\d{4}-\d{2}$/.test(input) || /^[a-z0-9-]+$/.test(input);
}
