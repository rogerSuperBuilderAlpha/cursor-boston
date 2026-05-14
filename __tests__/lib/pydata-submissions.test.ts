/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  getPyDataSubmissions,
  PYDATA_SUBMISSIONS_BRANCH,
  PYDATA_SUBMISSIONS_DIR,
  PYDATA_SUBMISSIONS_REPO_URL,
} from "@/lib/pydata-submissions";

/**
 * The loader reads from `process.cwd()`, so each test spins up an isolated
 * temp directory, chdir's into it, populates the expected
 * `pydata-2026-submissions/<handle>/{submission.py,meta.json}` layout,
 * runs the loader, and restores the original cwd.
 */
function withTempCwd(setup: (dir: string) => void): ReturnType<typeof getPyDataSubmissions> {
  const original = process.cwd();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pydata-submissions-test-"));
  try {
    process.chdir(tmp);
    setup(tmp);
    return getPyDataSubmissions();
  } finally {
    process.chdir(original);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function writeSubmission(
  root: string,
  handle: string,
  meta: unknown | null,
  options: { notebook?: boolean; score?: unknown } = {}
): void {
  const folder = path.join(root, PYDATA_SUBMISSIONS_DIR, handle);
  fs.mkdirSync(folder, { recursive: true });
  if (options.notebook !== false) {
    fs.writeFileSync(path.join(folder, "submission.py"), "# marimo notebook\n");
  }
  if (meta !== null) {
    const body = typeof meta === "string" ? meta : JSON.stringify(meta);
    fs.writeFileSync(path.join(folder, "meta.json"), body);
  }
  if (options.score !== undefined) {
    fs.writeFileSync(path.join(folder, "score.json"), JSON.stringify(options.score));
  }
}

describe("getPyDataSubmissions", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("returns empty when the submissions directory is missing", () => {
    const result = withTempCwd(() => {
      // No directory created at all.
    });
    expect(result).toEqual([]);
  });

  it("loads a valid submission and builds the GitHub URLs from the handle", () => {
    const result = withTempCwd((root) => {
      writeSubmission(root, "adam-sychla", {
        title: "mRNA embedding tricks",
        description: "Quick exploration of mRNA-derived embeddings.",
        displayName: "Adam Sychla",
        tags: ["healthcare", "EMBEDDINGS", " healthcare "], // dedup + lowercase + trim
      });
    });
    expect(result).toHaveLength(1);
    const [s] = result;
    expect(s.githubHandle).toBe("adam-sychla");
    expect(s.displayName).toBe("Adam Sychla");
    expect(s.title).toBe("mRNA embedding tricks");
    expect(s.tags).toEqual(["healthcare", "embeddings"]);
    expect(s.notebookUrl).toBe(
      `${PYDATA_SUBMISSIONS_REPO_URL}/blob/main/${PYDATA_SUBMISSIONS_DIR}/adam-sychla/submission.py`
    );
    expect(s.folderUrl).toBe(
      `${PYDATA_SUBMISSIONS_REPO_URL}/tree/main/${PYDATA_SUBMISSIONS_DIR}/adam-sychla`
    );
    expect(s.submittedAt).toBeNull();
    expect(s.winnerEligible).toBe(false);
  });

  it("skips a folder missing submission.py", () => {
    const result = withTempCwd((root) => {
      writeSubmission(
        root,
        "no-notebook",
        { title: "T", description: "D", displayName: "N" },
        { notebook: false }
      );
    });
    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("missing submission.py")
    );
  });

  it("skips a folder with malformed meta.json", () => {
    const result = withTempCwd((root) => {
      writeSubmission(root, "bad-json", "{ not valid json");
    });
    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("missing or invalid meta.json")
    );
  });

  it("skips a folder with meta.json missing required fields", () => {
    const result = withTempCwd((root) => {
      // No description, so the entry must be skipped.
      writeSubmission(root, "no-desc", { title: "Only title" });
    });
    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("missing required fields")
    );
  });

  it("ignores dotfile dirs, _template scaffolding, and non-directories", () => {
    const result = withTempCwd((root) => {
      const base = path.join(root, PYDATA_SUBMISSIONS_DIR);
      fs.mkdirSync(base, { recursive: true });
      fs.writeFileSync(path.join(base, "README.md"), "# readme");

      writeSubmission(root, ".hidden", {
        title: "T",
        description: "D",
        displayName: "N",
      });
      writeSubmission(root, "_template", {
        title: "T",
        description: "D",
        displayName: "N",
      });
      writeSubmission(root, "valid-user", {
        title: "T",
        description: "D",
        displayName: "Valid",
      });
    });
    expect(result.map((s) => s.githubHandle)).toEqual(["valid-user"]);
  });

  it("falls back to handle when displayName is missing, sorts by score then alphabetically", () => {
    const result = withTempCwd((root) => {
      writeSubmission(root, "zach", {
        title: "Z work",
        description: "Z description",
      }, {
        score: {
          score: 9,
          rationale: "Strong.",
          model: "test",
          scoredAt: "2026-05-14T00:00:00.000Z",
        },
      });
      writeSubmission(root, "barry", {
        title: "B work",
        description: "B description",
      }, {
        score: {
          score: 9,
          rationale: "Also strong.",
          model: "test",
          scoredAt: "2026-05-14T00:00:00.000Z",
        },
      });
      writeSubmission(root, "amy", {
        title: "A work",
        description: "A description",
        displayName: "Amy A",
      });
    });
    // Scores sort descending first; equal scores use displayName as a stable
    // case-insensitive tie-breaker. Unscored submissions come last.
    expect(result.map((s) => s.displayName)).toEqual(["barry", "zach", "Amy A"]);
    expect(result.map((s) => s.githubHandle)).toEqual(["barry", "zach", "amy"]);
  });

  it("marks submissions opened before the winner cutoff as eligible", () => {
    const result = withTempCwd((root) => {
      writeSubmission(
        root,
        "aaravraina3",
        {
          title: "Eligible",
          description: "Submitted before the deadline.",
          displayName: "Eligible Person",
        },
        {
          score: {
            score: 9,
            rationale: "Strong.",
            model: "test",
            scoredAt: "2026-05-14T00:00:00.000Z",
          },
        }
      );
      writeSubmission(
        root,
        "trevordcampbell",
        {
          title: "Late",
          description: "Submitted after the deadline.",
          displayName: "Late Person",
        },
        {
          score: {
            score: 9,
            rationale: "Also strong.",
            model: "test",
            scoredAt: "2026-05-14T00:00:00.000Z",
          },
        }
      );
    });

    const byHandle = Object.fromEntries(result.map((s) => [s.githubHandle, s]));
    expect(byHandle.aaravraina3.submittedAt).toBe("2026-05-14T00:40:39Z");
    expect(byHandle.aaravraina3.winnerEligible).toBe(true);
    expect(byHandle.trevordcampbell.submittedAt).toBe("2026-05-14T01:04:01Z");
    expect(byHandle.trevordcampbell.winnerEligible).toBe(false);
  });

  it("clamps tags to a max of 6 and ignores non-string entries", () => {
    const result = withTempCwd((root) => {
      writeSubmission(root, "tagged", {
        title: "T",
        description: "D",
        displayName: "T",
        tags: ["a", "b", "c", "d", "e", "f", "g", 123, null, "h"],
      });
    });
    expect(result[0].tags).toHaveLength(6);
  });

  it("parses collaborators and strips @ from handles", () => {
    const result = withTempCwd((root) => {
      writeSubmission(root, "lead", {
        title: "Team work",
        description: "Built together.",
        displayName: "Lead Person",
        collaborators: [
          { displayName: "Co A", githubHandle: "@co-a" },
          { displayName: "Co B" }, // no handle — allowed
          { displayName: "" }, // empty displayName — must be dropped
          "not an object",
        ],
      });
    });
    expect(result[0].collaborators).toEqual([
      { displayName: "Co A", githubHandle: "co-a" },
      { displayName: "Co B", githubHandle: null },
    ]);
  });
});

describe("submissions constants", () => {
  it("exports a single source-of-truth branch name", () => {
    expect(PYDATA_SUBMISSIONS_BRANCH).toBe("pydata-2026-submissions");
  });
  it("uses the same name for the on-disk directory", () => {
    expect(PYDATA_SUBMISSIONS_DIR).toBe("pydata-2026-submissions");
  });
  it("points at the rogerSuperBuilderAlpha repo (not a fork)", () => {
    expect(PYDATA_SUBMISSIONS_REPO_URL).toBe(
      "https://github.com/rogerSuperBuilderAlpha/cursor-boston"
    );
  });
});
