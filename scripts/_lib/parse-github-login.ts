/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Shared helper for the script tools that parse a GitHub login from a free-form
 * CSV cell — accepts a bare login (`octocat`, `@octocat`), a profile URL
 * (`https://github.com/octocat`), or an unprefixed form (`github.com/octocat`).
 *
 * Strict hostname check (`github.com` / `www.github.com` only) — the previous
 * `hostname.includes("github.com")` and `lower.includes("github.com")` patterns
 * matched `evilgithub.com` and `something.com/github.com/foo` respectively
 * (CodeQL js/incomplete-url-substring-sanitization).
 */

const INVALID_LOGIN_TOKENS = new Set([
  "",
  "n",
  "no",
  "none",
  "na",
  "n/a",
  "-",
  ".",
  "unknown",
]);

function isGithubHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "github.com" || h === "www.github.com";
}

function loginFromUrl(candidate: string): string | null {
  try {
    const u = new URL(candidate);
    if (!isGithubHostname(u.hostname)) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    return parts[0] ?? null;
  } catch {
    return null;
  }
}

export function parseGithubLogin(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();

  let login: string | null = null;
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    login = loginFromUrl(trimmed);
  } else if (/^(www\.)?github\.com[/:@]/i.test(trimmed)) {
    // Unprefixed form like "github.com/foo" — prepend a scheme so the URL
    // parser can do strict hostname validation.
    login = loginFromUrl(`https://${trimmed.replace(/^\/+/, "")}`);
  } else {
    // Treat as bare login.
    login = trimmed;
  }

  if (!login) return null;
  const cleaned = login.replace(/^@+/, "");
  if (INVALID_LOGIN_TOKENS.has(cleaned.toLowerCase()) || cleaned.length < 2) {
    return null;
  }
  return cleaned;
}
