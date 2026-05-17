/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

import { getHeroBackstoryServer } from "@/lib/game/heroes-server";

// Mock the auto-generated index so we control what looks like "has a backstory".
jest.mock("@/lib/game/content/hero-backstories/_index", () => ({
  HERO_BACKSTORY_IDS: new Set<string>(["hero-with-chapter"]),
}));

const BACKSTORIES_DIR = join(
  process.cwd(),
  "lib",
  "game",
  "content",
  "hero-backstories"
);

describe("getHeroBackstoryServer", () => {
  beforeAll(async () => {
    await mkdir(BACKSTORIES_DIR, { recursive: true });
    await writeFile(
      join(BACKSTORIES_DIR, "hero-with-chapter.md"),
      "## Chapter 1\n\nThe pale dawn.\n",
      "utf8"
    );
  });

  afterAll(async () => {
    await rm(join(BACKSTORIES_DIR, "hero-with-chapter.md"), { force: true });
  });

  it("returns the markdown content for a hero with a chapter", async () => {
    const md = await getHeroBackstoryServer({ heroId: "hero-with-chapter" });
    expect(md).toContain("Chapter 1");
    expect(md).toContain("The pale dawn.");
  });

  it("returns null when the hero is not in the backstory index", async () => {
    const md = await getHeroBackstoryServer({ heroId: "no-chapter-hero" });
    expect(md).toBeNull();
  });

  it("returns null when the index lists the hero but the file is missing on disk", async () => {
    // We mocked the index to include "hero-with-chapter" only; force a miss
    // by spying on readFile via a hero id that's been forced into the index
    // but isn't on disk. Easiest path: re-mock for this test.
    jest.resetModules();
    jest.doMock("@/lib/game/content/hero-backstories/_index", () => ({
      HERO_BACKSTORY_IDS: new Set<string>(["ghost-hero-not-on-disk"]),
    }));
    const { getHeroBackstoryServer: fresh } = await import(
      "@/lib/game/heroes-server"
    );
    const md = await fresh({ heroId: "ghost-hero-not-on-disk" });
    expect(md).toBeNull();
  });
});
