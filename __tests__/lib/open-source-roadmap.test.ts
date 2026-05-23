import {
  buildRoadmapIssueUrl,
  countRoadmapItems,
  filterRoadmapCategories,
  ROADMAP_CATEGORIES,
} from "@/lib/open-source-roadmap";

function titles(categories = ROADMAP_CATEGORIES): string[] {
  return categories.flatMap((category) => category.items.map((item) => item.title));
}

describe("open source roadmap helpers", () => {
  it("counts the seeded contribution ideas", () => {
    expect(countRoadmapItems()).toBe(22);
  });

  it("filters roadmap ideas by category and difficulty", () => {
    const filtered = filterRoadmapCategories({
      category: "accessibility",
      difficulty: "beginner",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toMatchObject({ key: "accessibility" });
    expect(titles(filtered)).toEqual([
      "Keyboard Navigation Audit",
      "Color Contrast Check",
    ]);
  });

  it("searches title, description, difficulty, and skills", () => {
    expect(titles(filterRoadmapCategories({ query: "screen reader" }))).toEqual([
      "Screen Reader Testing",
    ]);
    expect(titles(filterRoadmapCategories({ query: "firebase" }))).toEqual(
      expect.arrayContaining([
        "Member Search & Filters",
        "Event RSVP System",
        "Project Showcase",
        "API Documentation",
      ])
    );
  });

  it("drops empty categories when filters have no matching items", () => {
    expect(
      filterRoadmapCategories({
        category: "documentation",
        query: "playwright",
      })
    ).toEqual([]);
  });

  it("builds a pre-filled GitHub issue URL", () => {
    const item = ROADMAP_CATEGORIES[0].items[0];
    const url = new URL(buildRoadmapIssueUrl(item));

    expect(url.hostname).toBe("github.com");
    expect(url.searchParams.get("title")).toBe("Dark Mode Toggle");
    expect(url.searchParams.get("labels")).toBe("good first issue");
    expect(url.searchParams.get("body")).toContain("Tailwind CSS");
  });
});
