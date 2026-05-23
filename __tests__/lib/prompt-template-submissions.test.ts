import {
  containsSensitivePromptText,
  extractPromptPlaceholders,
  normalizePromptTemplateSubmission,
  slugifyPromptTemplateTitle,
} from "@/lib/prompt-template-submissions";

describe("prompt template submission helpers", () => {
  it("extracts sorted unique placeholders from prompt text", () => {
    expect(
      extractPromptPlaceholders(
        "Create {{project_name}} with {{ stack }} and reuse {{project_name}}."
      )
    ).toEqual({
      names: ["project_name", "stack"],
      invalidTokens: [],
    });
  });

  it("reports invalid placeholder tokens", () => {
    expect(extractPromptPlaceholders("Use {{Project Name}} and {{ok_name}}")).toEqual({
      names: ["ok_name"],
      invalidTokens: ["Project Name"],
    });
  });

  it("normalizes a valid draft submission", () => {
    const result = normalizePromptTemplateSubmission({
      title: " Next.js Launch Checklist ",
      summary: "Checklist for preparing a launch.",
      category: "Launch",
      useCase: "Release readiness",
      prompt:
        "Review {{project_name}} and list the release blockers, owners, and verification commands.",
      placeholders: [
        {
          name: "project_name",
          label: "Project name",
          description: "The app or package being released.",
          required: true,
          example: "Cursor Boston",
        },
      ],
      tags: ["Next.js", "release", "release"],
    });

    expect(result.errors).toEqual([]);
    expect(result.data).toMatchObject({
      title: "Next.js Launch Checklist",
      category: "Launch",
      useCase: "Release readiness",
      moderationStatus: "draft",
      visibility: "private",
      tags: ["next.js", "release"],
    });
  });

  it("sets pending_review when requested", () => {
    const result = normalizePromptTemplateSubmission({
      title: "Review plan",
      summary: "Generate a structured review plan.",
      category: "Code review",
      prompt: "Read the diff and produce a prioritized review plan.",
      submitForReview: true,
    });

    expect(result.data?.moderationStatus).toBe("pending_review");
  });

  it("requires placeholder metadata to match prompt tokens", () => {
    const missing = normalizePromptTemplateSubmission({
      title: "Prompt with missing metadata",
      summary: "Summary with enough useful detail.",
      category: "Testing",
      prompt: "Generate tests for {{component_name}} and {{state_name}}.",
      placeholders: [
        {
          name: "component_name",
          label: "Component",
          description: "The React component.",
          required: true,
          example: "ProfileCard",
        },
      ],
    });

    expect(missing.errors).toContain("Placeholder metadata required for: state_name.");

    const stale = normalizePromptTemplateSubmission({
      title: "Prompt with stale metadata",
      summary: "Summary with enough useful detail.",
      category: "Testing",
      prompt: "Generate tests for {{component_name}}.",
      placeholders: [
        {
          name: "component_name",
          label: "Component",
          description: "The React component.",
          required: true,
          example: "ProfileCard",
        },
        {
          name: "state_name",
          label: "State",
          description: "Unused state.",
          required: true,
          example: "loading",
        },
      ],
    });

    expect(stale.errors).toContain("Placeholder not found in prompt: state_name.");
  });

  it("rejects secret-looking prompt text", () => {
    expect(containsSensitivePromptText("api_key = 'supersecret123456'"))
      .toBe(true);
    expect(
      normalizePromptTemplateSubmission({
        title: "Secret prompt",
        summary: "Summary with enough detail.",
        category: "Security",
        prompt: "Use api_key = 'supersecret123456' to call the service.",
      }).errors
    ).toContain("Prompt must not include secrets, tokens, or credentials.");
  });

  it("creates stable slugs from titles", () => {
    expect(slugifyPromptTemplateTitle("  Next.js + Firebase Launch Plan! ")).toBe(
      "next-js-firebase-launch-plan"
    );
    expect(slugifyPromptTemplateTitle("!!!")).toBe("prompt-template");
  });
});
