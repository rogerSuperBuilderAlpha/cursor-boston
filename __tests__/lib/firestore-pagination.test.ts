/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  clampLimit,
  parseCursor,
  paginateFirestoreQuery,
  paginateInMemory,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from "@/lib/firestore-pagination";

describe("clampLimit", () => {
  it("returns default when raw is null/undefined/empty", () => {
    expect(clampLimit(null)).toBe(DEFAULT_PAGE_LIMIT);
    expect(clampLimit(undefined)).toBe(DEFAULT_PAGE_LIMIT);
  });

  it("returns default when raw is not a finite positive integer", () => {
    expect(clampLimit("abc")).toBe(DEFAULT_PAGE_LIMIT);
    expect(clampLimit("0")).toBe(DEFAULT_PAGE_LIMIT);
    expect(clampLimit("-5")).toBe(DEFAULT_PAGE_LIMIT);
  });

  it("respects custom default", () => {
    expect(clampLimit(null, 10)).toBe(10);
  });

  it("clamps oversized requests to maxLimit", () => {
    expect(clampLimit("9999")).toBe(MAX_PAGE_LIMIT);
    expect(clampLimit("1000", 20, 50)).toBe(50);
  });

  it("returns the parsed value when in range", () => {
    expect(clampLimit("25")).toBe(25);
    expect(clampLimit("1")).toBe(1);
  });
});

describe("parseCursor", () => {
  it("returns null for missing or empty input", () => {
    expect(parseCursor(null)).toBeNull();
    expect(parseCursor(undefined)).toBeNull();
    expect(parseCursor("")).toBeNull();
    expect(parseCursor("   ")).toBeNull();
  });

  it("returns sanitized id for valid input", () => {
    expect(parseCursor("abc123")).toBe("abc123");
    expect(parseCursor("  abc123  ")).toBe("abc123");
  });

  it("rejects non-string input", () => {
    // @ts-expect-error — exercising runtime guard
    expect(parseCursor(42)).toBeNull();
  });
});

describe("paginateInMemory", () => {
  const items = [
    { id: "a", value: 1 },
    { id: "b", value: 2 },
    { id: "c", value: 3 },
    { id: "d", value: 4 },
    { id: "e", value: 5 },
  ];

  it("returns first page with cursor when more available", () => {
    const result = paginateInMemory(items, null, 2);
    expect(result.items).toEqual([
      { id: "a", value: 1 },
      { id: "b", value: 2 },
    ]);
    expect(result.nextCursor).toBe("b");
    expect(result.hasMore).toBe(true);
  });

  it("resumes from cursor", () => {
    const result = paginateInMemory(items, "b", 2);
    expect(result.items).toEqual([
      { id: "c", value: 3 },
      { id: "d", value: 4 },
    ]);
    expect(result.nextCursor).toBe("d");
    expect(result.hasMore).toBe(true);
  });

  it("returns final page with null cursor and hasMore=false", () => {
    const result = paginateInMemory(items, "d", 2);
    expect(result.items).toEqual([{ id: "e", value: 5 }]);
    expect(result.nextCursor).toBeNull();
    expect(result.hasMore).toBe(false);
  });

  it("falls back to start when cursor not found", () => {
    const result = paginateInMemory(items, "missing", 2);
    expect(result.items).toEqual([
      { id: "a", value: 1 },
      { id: "b", value: 2 },
    ]);
    expect(result.hasMore).toBe(true);
  });

  it("handles empty array", () => {
    const result = paginateInMemory([], null, 10);
    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeNull();
    expect(result.hasMore).toBe(false);
  });
});

describe("paginateFirestoreQuery", () => {
  function buildMockSnap(docIds: string[]) {
    return {
      docs: docIds.map((id) => ({
        id,
        data: () => ({ id, name: `doc-${id}` }),
      })),
    };
  }

  function buildMockQuery(docIds: string[]) {
    const limitCalls: number[] = [];
    const startAfterCalls: unknown[] = [];
    const query = {
      limit(n: number) {
        limitCalls.push(n);
        return this;
      },
      startAfter(snap: unknown) {
        startAfterCalls.push(snap);
        return this;
      },
      async get() {
        return buildMockSnap(docIds);
      },
    };
    return { query, limitCalls, startAfterCalls };
  }

  function buildMockCollection(existing: Set<string>) {
    return {
      doc(id: string) {
        return {
          async get() {
            return { exists: existing.has(id), id };
          },
        };
      },
    };
  }

  it("fetches limit+1 and reports hasMore correctly when extra doc present", async () => {
    const { query, limitCalls } = buildMockQuery(["a", "b", "c"]);
    const collection = buildMockCollection(new Set());
    const result = await paginateFirestoreQuery({
      query: query as never,
      collection: collection as never,
      cursor: null,
      limit: 2,
      mapDoc: (d) => ({ id: d.id, ...(d.data() as Record<string, unknown>) }),
    });
    expect(limitCalls).toEqual([3]);
    expect(result.items.length).toBe(2);
    expect(result.nextCursor).toBe("b");
    expect(result.hasMore).toBe(true);
  });

  it("hasMore=false and nextCursor=null when fewer than limit returned", async () => {
    const { query } = buildMockQuery(["a"]);
    const collection = buildMockCollection(new Set());
    const result = await paginateFirestoreQuery({
      query: query as never,
      collection: collection as never,
      cursor: null,
      limit: 5,
      mapDoc: (d) => ({ id: d.id }),
    });
    expect(result.items.length).toBe(1);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });

  it("applies startAfter when cursor doc exists", async () => {
    const { query, startAfterCalls } = buildMockQuery(["c", "d"]);
    const collection = buildMockCollection(new Set(["b"]));
    const result = await paginateFirestoreQuery({
      query: query as never,
      collection: collection as never,
      cursor: "b",
      limit: 5,
      mapDoc: (d) => ({ id: d.id }),
    });
    expect(startAfterCalls.length).toBe(1);
    expect(result.items.length).toBe(2);
    expect(result.hasMore).toBe(false);
  });

  it("ignores cursor when doc no longer exists", async () => {
    const { query, startAfterCalls } = buildMockQuery(["a"]);
    const collection = buildMockCollection(new Set());
    await paginateFirestoreQuery({
      query: query as never,
      collection: collection as never,
      cursor: "deleted",
      limit: 5,
      mapDoc: (d) => ({ id: d.id }),
    });
    expect(startAfterCalls.length).toBe(0);
  });
});
