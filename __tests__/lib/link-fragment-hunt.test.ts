/**
 * @jest-environment node
 */
import {
  LINK_FRAGMENT_PUZZLES,
  assembleReferralUrl,
  getLinkFragmentReferralCode,
  getLinkFragmentSlices,
  listLinkFragmentPuzzles,
  signLinkFragmentToken,
  verifyLinkFragmentToken,
} from "@/lib/link-fragment-hunt";

describe("link-fragment-hunt", () => {
  beforeEach(() => {
    delete process.env.LINK_FRAGMENT_HUNT_CODE;
  });

  it("exposes six puzzles in index order", () => {
    const puzzles = listLinkFragmentPuzzles();
    expect(puzzles).toHaveLength(6);
    expect(puzzles.map((p) => p.index)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("splits the default code into six 2-char fragments", () => {
    expect(getLinkFragmentReferralCode()).toBe("HULTSUMMER26");
    expect(getLinkFragmentSlices()).toEqual(["HU", "LT", "SU", "MM", "ER", "26"]);
  });

  it("verifies puzzle answers case-insensitively", () => {
    expect(LINK_FRAGMENT_PUZZLES["about-beantown"].verify("Beantown")).toBe(true);
    expect(LINK_FRAGMENT_PUZZLES["events-perks"].verify("4")).toBe(true);
    expect(LINK_FRAGMENT_PUZZLES["hult-guest"].verify("Shiv Jethi")).toBe(true);
    expect(LINK_FRAGMENT_PUZZLES["about-beantown"].verify("wrong")).toBe(false);
  });

  it("signs and verifies fragment tokens", () => {
    const token = signLinkFragmentToken("about-beantown", "LT");
    expect(verifyLinkFragmentToken("about-beantown", "LT", token)).toBe(true);
    expect(verifyLinkFragmentToken("about-beantown", "HU", token)).toBe(false);
  });

  it("assembles a full referral URL from valid tokens", () => {
    const tokens = Object.fromEntries(
      listLinkFragmentPuzzles().map((p) => [
        p.id,
        signLinkFragmentToken(p.id, getLinkFragmentSlices()[p.index]!),
      ])
    );
    const result = assembleReferralUrl(tokens);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.url).toBe(
        "https://cursor.com/referral?code=HULTSUMMER26"
      );
    }
  });
});
