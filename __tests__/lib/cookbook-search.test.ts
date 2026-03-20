import { matchesCookbookSearchTerms } from "@/lib/cookbook-search";

describe("matchesCookbookSearchTerms", () => {
  it("returns true when there are no terms", () => {
    expect(
      matchesCookbookSearchTerms("Hello", "World", ["a"], [])
    ).toBe(true);
  });

  it("matches title substring", () => {
    expect(
      matchesCookbookSearchTerms("Debug helper", "", [], ["debug"])
    ).toBe(true);
  });

  it("matches description substring", () => {
    expect(
      matchesCookbookSearchTerms("", "Uses React hooks", [], ["react"])
    ).toBe(true);
  });

  it("matches tag substring", () => {
    expect(
      matchesCookbookSearchTerms("", "", ["cursorrules", "go"], ["rules"])
    ).toBe(true);
  });

  it("returns false when nothing matches", () => {
    expect(
      matchesCookbookSearchTerms("A", "B", ["c"], ["zzz"])
    ).toBe(false);
  });
});
