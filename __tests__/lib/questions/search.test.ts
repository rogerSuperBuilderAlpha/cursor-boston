/**
 * @jest-environment node
 */

import { matchesQuestionSearchTerms } from "@/lib/questions/search";

describe("matchesQuestionSearchTerms", () => {
  it("returns true when no search terms provided", () => {
    expect(matchesQuestionSearchTerms("Title", "Body", ["tag"], [])).toBe(true);
  });

  it("matches against title", () => {
    expect(
      matchesQuestionSearchTerms("How to debug Cursor rules", "Some body", ["other"], ["debug"])
    ).toBe(true);
  });

  it("matches against body", () => {
    expect(
      matchesQuestionSearchTerms("Title", "Use prompting patterns for refactoring", ["other"], ["prompting"])
    ).toBe(true);
  });

  it("matches against tags", () => {
    expect(
      matchesQuestionSearchTerms("Title", "Body", ["mcp", "agents"], ["agents"])
    ).toBe(true);
  });

  it("is case insensitive", () => {
    expect(
      matchesQuestionSearchTerms("CURSOR RULES", "Body", [], ["cursor"])
    ).toBe(true);
  });

  it("returns true if any term matches (OR logic)", () => {
    expect(
      matchesQuestionSearchTerms("Debugging tips", "Body", [], ["nonexistent", "debug"])
    ).toBe(true);
  });

  it("returns false when no terms match", () => {
    expect(
      matchesQuestionSearchTerms("Title", "Body", ["testing"], ["zzzzz"])
    ).toBe(false);
  });
});
