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
 * Sanitize plain text content by removing HTML tags and dangerous characters.
 * Preserves basic punctuation and whitespace.
 *
 * @param input - Raw user-supplied string (non-strings are treated as empty).
 * @returns Sanitized plain text safe for storage or display as text.
 */
export function sanitizeText(input: string): string {
  if (typeof input !== "string") {
    return "";
  }
  
  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, "")
    // Remove script-related content
    .replace(/javascript:/gi, "")
    .replace(/data:/gi, "")
    .replace(/vbscript:/gi, "")
    // Remove event handlers (onclick, onerror, etc.)
    .replace(/on\w+\s*=/gi, "")
    // Normalize whitespace (but preserve single spaces and newlines)
    .replace(/[\t\r]+/g, " ")
    // Remove null bytes
    .replace(/\0/g, "")
    // Trim leading/trailing whitespace
    .trim();
}

/**
 * Sanitize a display name.
 * More restrictive than general text — only allows alphanumeric, spaces, and basic punctuation.
 *
 * @param input - Raw name string (non-strings are treated as empty).
 * @returns Sanitized name with disallowed characters removed.
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
 * Validate and sanitize a URL to `http:` or `https:` only.
 *
 * @param input - Candidate URL string.
 * @returns null if the URL is invalid or uses a dangerous protocol.
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
 * Sanitize a Firestore document ID (alphanumeric, hyphens, underscores; max length enforced).
 *
 * @param input - Candidate document id.
 * @returns Trimmed valid id, or `null` if the format is unsafe or too long.
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
 * Validate a hackathon id string against allowed patterns (e.g. `virtual-YYYY-MM` or slug form).
 *
 * @param input - Candidate hackathon id.
 * @returns `true` if the string matches an allowed format.
 */
export function isValidHackathonId(input: string): boolean {
  if (typeof input !== "string") {
    return false;
  }
  
  // Matches: "virtual-YYYY-MM" or other allowed formats
  return /^virtual-\d{4}-\d{2}$/.test(input) || /^[a-z0-9-]+$/.test(input);
}
