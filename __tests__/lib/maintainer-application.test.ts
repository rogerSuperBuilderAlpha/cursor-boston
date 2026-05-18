/**
 * @jest-environment node
 */
import {
  MAINTAINER_APPLICATION_BRANCH,
  MAINTAINER_APPLICATION_SCHEMA_VERSION,
  buildMaintainerApplicationDraft,
  formatMaintainerApplicationJson,
  getMaintainerApplicationBranchTreeUrl,
  getMaintainerApplicationFilePath,
  getMaintainerApplicationRepoBaseUrl,
} from "@/lib/maintainer-application";

describe("maintainer-application", () => {
  describe("constants", () => {
    it("exposes the application branch name", () => {
      expect(MAINTAINER_APPLICATION_BRANCH).toBe("maintainer-application");
    });

    it("uses schema version 1", () => {
      expect(MAINTAINER_APPLICATION_SCHEMA_VERSION).toBe(1);
    });
  });

  describe("getMaintainerApplicationRepoBaseUrl + branch tree URL", () => {
    it("returns an https github URL", () => {
      expect(getMaintainerApplicationRepoBaseUrl()).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
    });

    it("branch tree URL appends /tree/maintainer-application", () => {
      const base = getMaintainerApplicationRepoBaseUrl();
      expect(getMaintainerApplicationBranchTreeUrl()).toBe(`${base}/tree/${MAINTAINER_APPLICATION_BRANCH}`);
    });
  });

  describe("getMaintainerApplicationFilePath", () => {
    it("places files under maintainer-applications/<login>.json", () => {
      expect(getMaintainerApplicationFilePath("octocat")).toBe("maintainer-applications/octocat.json");
    });

    it("sanitizes unsafe characters in the login", () => {
      expect(getMaintainerApplicationFilePath("foo/bar")).toBe("maintainer-applications/foo-bar.json");
      expect(getMaintainerApplicationFilePath("oct@cat")).toBe("maintainer-applications/oct-cat.json");
      expect(getMaintainerApplicationFilePath("oct cat")).toBe("maintainer-applications/oct-cat.json");
    });

    it("preserves alphanumerics, dot, hyphen, underscore", () => {
      expect(getMaintainerApplicationFilePath("oct.cat_1-2")).toBe(
        "maintainer-applications/oct.cat_1-2.json"
      );
    });

    it("falls back to 'github-username' when login is all whitespace", () => {
      expect(getMaintainerApplicationFilePath("   ")).toBe(
        "maintainer-applications/github-username.json"
      );
    });

    it("falls back to 'github-username' when login is empty", () => {
      expect(getMaintainerApplicationFilePath("")).toBe(
        "maintainer-applications/github-username.json"
      );
    });

    it("trims surrounding whitespace before sanitizing", () => {
      expect(getMaintainerApplicationFilePath("  octocat  ")).toBe(
        "maintainer-applications/octocat.json"
      );
    });
  });

  describe("buildMaintainerApplicationDraft", () => {
    it("returns a payload with the current schema version and empty user-supplied fields", () => {
      const draft = buildMaintainerApplicationDraft({
        githubLogin: "octocat",
        discordUsername: "oct#1234",
        displayName: "Octo Cat",
        siteEmail: "oct@example.com",
      });
      expect(draft.schemaVersion).toBe(MAINTAINER_APPLICATION_SCHEMA_VERSION);
      expect(draft.githubLogin).toBe("octocat");
      expect(draft.discordUsername).toBe("oct#1234");
      expect(draft.displayName).toBe("Octo Cat");
      expect(draft.siteEmail).toBe("oct@example.com");
      expect(draft.whyMaintainer).toBe("");
      expect(draft.relevantExperience).toBe("");
      expect(draft.availability).toBe("");
      expect(draft.agreedToCodeOfConduct).toBe(false);
      // ISO 8601 (with milliseconds, UTC)
      expect(draft.submittedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it("preserves null siteEmail", () => {
      const draft = buildMaintainerApplicationDraft({
        githubLogin: "x",
        discordUsername: "y",
        displayName: "z",
        siteEmail: null,
      });
      expect(draft.siteEmail).toBeNull();
    });
  });

  describe("formatMaintainerApplicationJson", () => {
    it("returns pretty-printed JSON with trailing newline", () => {
      const draft = buildMaintainerApplicationDraft({
        githubLogin: "x",
        discordUsername: "y",
        displayName: "z",
        siteEmail: null,
      });
      const out = formatMaintainerApplicationJson(draft);
      expect(out.endsWith("\n")).toBe(true);
      expect(out).toContain('"githubLogin": "x"');
      // Indented with 2 spaces
      expect(out).toContain('  "githubLogin"');
    });

    it("produces parse-back-identical output", () => {
      const draft = buildMaintainerApplicationDraft({
        githubLogin: "foo",
        discordUsername: "bar",
        displayName: "baz",
        siteEmail: "x@y.com",
      });
      const reparsed = JSON.parse(formatMaintainerApplicationJson(draft));
      expect(reparsed).toEqual(draft);
    });
  });
});
