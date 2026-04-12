/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  sanitizeText,
  sanitizeName,
  sanitizeUrl,
  sanitizeDocId,
  isValidHackathonId,
} from "@/lib/sanitize";

describe("sanitizeText", () => {
  it("returns empty string for non-string input", () => {
    expect(sanitizeText(undefined as unknown as string)).toBe("");
    expect(sanitizeText(null as unknown as string)).toBe("");
    expect(sanitizeText(123 as unknown as string)).toBe("");
  });

  it("strips HTML tags", () => {
    expect(sanitizeText("<b>bold</b>")).toBe("bold");
    expect(sanitizeText('<script>alert("xss")</script>')).toBe('alert("xss")');
    expect(sanitizeText("<img src=x onerror=alert(1)>")).toBe("");
  });

  it("strips javascript: protocol", () => {
    expect(sanitizeText("javascript:alert(1)")).toBe("alert(1)");
    expect(sanitizeText("JAVASCRIPT:void(0)")).toBe("void(0)");
  });

  it("strips data: protocol", () => {
    expect(sanitizeText("data:text/html,<h1>hi</h1>")).toBe("text/html,hi");
  });

  it("strips vbscript: protocol", () => {
    expect(sanitizeText("vbscript:msgbox")).toBe("msgbox");
  });

  it("strips event handlers", () => {
    expect(sanitizeText('onerror=alert(1)')).toBe("alert(1)");
    expect(sanitizeText('onclick=doStuff()')).toBe("doStuff()");
  });

  it("removes null bytes", () => {
    expect(sanitizeText("hello\0world")).toBe("helloworld");
  });

  it("normalizes tabs and carriage returns but preserves newlines", () => {
    expect(sanitizeText("hello\t\tworld")).toBe("hello world");
    expect(sanitizeText("hello\r\nworld")).toBe("hello \nworld");
  });

  it("trims whitespace", () => {
    expect(sanitizeText("  hello  ")).toBe("hello");
  });

  it("passes through clean text", () => {
    expect(sanitizeText("Hello, World!")).toBe("Hello, World!");
  });
});

describe("sanitizeName", () => {
  it("returns empty string for non-string input", () => {
    expect(sanitizeName(undefined as unknown as string)).toBe("");
    expect(sanitizeName(null as unknown as string)).toBe("");
  });

  it("strips special characters", () => {
    expect(sanitizeName("John@Doe!")).toBe("JohnDoe");
    expect(sanitizeName("user<script>")).toBe("userscript");
  });

  it("allows alphanumeric, spaces, hyphens, underscores, periods", () => {
    expect(sanitizeName("John Doe-Jr_III.")).toBe("John Doe-Jr_III.");
  });

  it("collapses multiple spaces", () => {
    expect(sanitizeName("John   Doe")).toBe("John Doe");
  });

  it("trims whitespace", () => {
    expect(sanitizeName("  John  ")).toBe("John");
  });
});

describe("sanitizeUrl", () => {
  it("returns null for non-string or empty input", () => {
    expect(sanitizeUrl(undefined as unknown as string)).toBeNull();
    expect(sanitizeUrl("")).toBeNull();
    expect(sanitizeUrl("   ")).toBeNull();
  });

  it("returns normalized URL for valid http/https", () => {
    expect(sanitizeUrl("https://example.com")).toBe("https://example.com/");
    expect(sanitizeUrl("http://example.com/path?q=1")).toBe(
      "http://example.com/path?q=1"
    );
  });

  it("rejects javascript: protocol", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects ftp: protocol", () => {
    expect(sanitizeUrl("ftp://example.com")).toBeNull();
  });

  it("rejects data: protocol", () => {
    expect(sanitizeUrl("data:text/html,<h1>hi</h1>")).toBeNull();
  });

  it("returns null for malformed URLs", () => {
    expect(sanitizeUrl("not a url")).toBeNull();
  });

  it("trims whitespace before parsing", () => {
    expect(sanitizeUrl("  https://example.com  ")).toBe("https://example.com/");
  });
});

describe("sanitizeDocId", () => {
  it("returns null for non-string or empty input", () => {
    expect(sanitizeDocId(undefined as unknown as string)).toBeNull();
    expect(sanitizeDocId("")).toBeNull();
    expect(sanitizeDocId("   ")).toBeNull();
  });

  it("returns trimmed ID for valid input", () => {
    expect(sanitizeDocId("abc-123_DEF")).toBe("abc-123_DEF");
    expect(sanitizeDocId("  valid-id  ")).toBe("valid-id");
  });

  it("rejects IDs with path separators", () => {
    expect(sanitizeDocId("parent/child")).toBeNull();
  });

  it("rejects IDs with dots", () => {
    expect(sanitizeDocId("file.txt")).toBeNull();
  });

  it("rejects IDs with special characters", () => {
    expect(sanitizeDocId("id@domain")).toBeNull();
    expect(sanitizeDocId("id with spaces")).toBeNull();
    expect(sanitizeDocId("<script>")).toBeNull();
  });

  it("rejects IDs exceeding 1500 characters", () => {
    const longId = "a".repeat(1501);
    expect(sanitizeDocId(longId)).toBeNull();
    expect(sanitizeDocId("a".repeat(1500))).toBe("a".repeat(1500));
  });
});

describe("isValidHackathonId", () => {
  it("returns false for non-string input", () => {
    expect(isValidHackathonId(undefined as unknown as string)).toBe(false);
    expect(isValidHackathonId(null as unknown as string)).toBe(false);
  });

  it("accepts virtual-YYYY-MM format", () => {
    expect(isValidHackathonId("virtual-2025-01")).toBe(true);
    expect(isValidHackathonId("virtual-2026-12")).toBe(true);
  });

  it("accepts lowercase alphanumeric with hyphens", () => {
    expect(isValidHackathonId("hack-a-sprint-2026")).toBe(true);
    expect(isValidHackathonId("my-hackathon")).toBe(true);
  });

  it("rejects uppercase or special characters", () => {
    expect(isValidHackathonId("Virtual-2025-01")).toBe(false);
    expect(isValidHackathonId("hack@thon")).toBe(false);
    expect(isValidHackathonId("hack thon")).toBe(false);
  });
});
