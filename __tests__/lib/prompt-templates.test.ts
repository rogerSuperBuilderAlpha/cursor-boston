import {
  PROMPT_TEMPLATES,
  getPromptTemplateById,
  getTemplatePlaceholderTokens,
  getTemplateStacks,
} from "@/lib/prompt-templates";

describe("prompt templates", () => {
  it("uses unique ids for templates and variants", () => {
    const templateIds = new Set<string>();
    const variantIds = new Set<string>();

    for (const template of PROMPT_TEMPLATES) {
      expect(templateIds.has(template.id)).toBe(false);
      templateIds.add(template.id);
      expect(template.variants.length).toBeGreaterThanOrEqual(2);

      for (const variant of template.variants) {
        const variantKey = `${template.id}:${variant.id}`;
        expect(variantIds.has(variantKey)).toBe(false);
        variantIds.add(variantKey);
      }
    }
  });

  it("finds templates by id", () => {
    expect(getPromptTemplateById("feature-slice-planner")?.title).toBe(
      "Feature Slice Planner"
    );
    expect(getPromptTemplateById("missing-template")).toBeNull();
  });

  it("extracts placeholder tokens from base and variant prompts", () => {
    const template = getPromptTemplateById("bug-reproduction-brief");
    expect(template).not.toBeNull();

    const tokens = getTemplatePlaceholderTokens(template!);

    expect(tokens).toEqual([
      "ACTUAL_BEHAVIOR",
      "BUG_SUMMARY",
      "EXPECTED_BEHAVIOR",
      "RELEVANT_STACK",
    ]);
  });

  it("returns a sorted stack list", () => {
    const stacks = getTemplateStacks();

    expect(stacks).toEqual([...stacks].sort((a, b) => a.localeCompare(b)));
    expect(stacks).toEqual(
      expect.arrayContaining(["Next.js + Firebase", "TypeScript Shared Library"])
    );
  });
});
