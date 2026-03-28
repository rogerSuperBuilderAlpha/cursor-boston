import {
  getHackathonEventSignupBlockReason,
  isHackathonEventSignupId,
} from "@/lib/hackathon-event-signup";
import { HACK_A_SPRINT_2026_EVENT_ID } from "@/lib/hackathon-showcase";

describe("hackathon-event-signup", () => {
  it("allows known event id", () => {
    expect(isHackathonEventSignupId(HACK_A_SPRINT_2026_EVENT_ID)).toBe(true);
  });

  it("rejects unknown event id", () => {
    expect(isHackathonEventSignupId("other-event")).toBe(false);
  });

  it("blocks when profile requirements missing", () => {
    expect(getHackathonEventSignupBlockReason(undefined)).toBe("Profile not found.");
    expect(
      getHackathonEventSignupBlockReason({
        visibility: { isPublic: false },
        github: {},
        discord: {},
      })
    ).toBe("Make your profile public in Settings to sign up.");
  });

  it("allows when requirements met", () => {
    expect(
      getHackathonEventSignupBlockReason({
        visibility: { isPublic: true, showDiscord: true },
        github: { login: "u" },
        discord: { id: "1" },
      })
    ).toBe(null);
  });
});
