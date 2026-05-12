/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  normalizePydataEmail,
  PYDATA_2026_ACCESS_LIST_COLLECTION,
} from "@/lib/pydata-2026-access";

describe("normalizePydataEmail", () => {
  it("lowercases the address", () => {
    expect(normalizePydataEmail("Adam_Sychla@HMS.Harvard.EDU")).toBe(
      "adam_sychla@hms.harvard.edu"
    );
  });

  it("trims surrounding whitespace (pasted CSV values)", () => {
    expect(normalizePydataEmail("  someone@example.com\n")).toBe(
      "someone@example.com"
    );
  });

  it("returns empty string for null/undefined/non-string input", () => {
    expect(normalizePydataEmail(null)).toBe("");
    expect(normalizePydataEmail(undefined)).toBe("");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizePydataEmail("   ")).toBe("");
  });

  it("preserves the local-part casing rules but lowercases globally", () => {
    expect(normalizePydataEmail("Foo.Bar+tag@Gmail.com")).toBe(
      "foo.bar+tag@gmail.com"
    );
  });
});

describe("PYDATA_2026_ACCESS_LIST_COLLECTION", () => {
  it("points at the private allowlist collection (server-only writes)", () => {
    expect(PYDATA_2026_ACCESS_LIST_COLLECTION).toBe("pydataHack2026AccessList");
  });
});
