/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { readFileSync } from "fs";
import { join } from "path";

function readSource(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("CTA analytics instrumentation", () => {
  it("tracks the NeedsWork banner view and all contributor CTAs", () => {
    const source = readSource("components/NeedsWorkBanner.tsx");

    expect(source).toContain('trackEvent("feature_banner_view"');
    for (const cta of [
      "open_source_roadmap",
      "edit_github",
      "open_issue",
      "browse_repo",
    ]) {
      expect(source).toContain(`trackCta("${cta}")`);
    }
  });

  it("tracks signed-out hackathon auth CTAs", () => {
    for (const path of [
      "app/hackathons/hack-a-sprint-2026/signup/page.tsx",
      "app/hackathons/sports-hack-2026/signup/page.tsx",
    ]) {
      const source = readSource(path);

      expect(source).toContain('trackAuthCta("sign_in")');
      expect(source).toContain('trackAuthCta("create_account")');
    }
  });

  it("tracks PR Studio issue-backed launches without issue titles or bodies", () => {
    const source = readSource("app/pr-ideas/_hooks/useIdeaRuns.ts");

    expect(source).toContain('trackEvent("issue_claimed"');
    expect(source).toContain("issue_number");
    expect(source).toContain("label_count");
    expect(source).not.toContain("issue_title");
    expect(source).not.toContain("issue_body");
  });
});
