/**
 * @jest-environment node
 */

import { githubUserHasMergedLabeledShowcasePr } from "@/lib/hackathon-showcase";

describe("githubUserHasMergedLabeledShowcasePr", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns false for empty login", async () => {
    await expect(githubUserHasMergedLabeledShowcasePr("")).resolves.toBe(false);
  });

  it("returns true when GitHub search total_count > 0", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ total_count: 1 }),
    } as Response);
    await expect(
      githubUserHasMergedLabeledShowcasePr("octocat")
    ).resolves.toBe(true);
    expect(global.fetch).toHaveBeenCalled();
  });

  it("returns false on API error", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
    } as Response);
    await expect(
      githubUserHasMergedLabeledShowcasePr("octocat")
    ).resolves.toBe(false);
  });
});
