/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * @jest-environment node
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SOURCE_DIRS = ["app", "components"];
const IMAGE_TAG_RE = /<Image\b[\s\S]*?\/>/g;

function listTsxFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) return listTsxFiles(fullPath);
    return fullPath.endsWith(".tsx") ? [fullPath] : [];
  });
}

function importsNextImage(source: string): boolean {
  return source.includes('"next/image"') || source.includes("'next/image'");
}

describe("next/image sizing audit", () => {
  it("declares sizes on every next/image component usage", () => {
    const violations = SOURCE_DIRS.flatMap((dir) => listTsxFiles(dir)).flatMap(
      (filePath) => {
        const source = readFileSync(filePath, "utf8");
        if (!importsNextImage(source)) return [];
        return [...source.matchAll(IMAGE_TAG_RE)]
          .filter((match) => !/\ssizes\s*=/.test(match[0]))
          .map((match) => `${filePath}:${source.slice(0, match.index).split("\n").length}`);
      }
    );

    expect(violations).toEqual([]);
  });
});
