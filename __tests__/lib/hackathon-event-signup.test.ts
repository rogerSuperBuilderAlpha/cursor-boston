/**
 * @jest-environment node
 */
import {
  getDeclinedEmailsForEvent,
  getHackathonEventSignupBlockReason,
  getJudgeEmailsForEvent,
  isHackathonEventSignupId,
  profileMatchesHackathonJudgeCheckinException,
} from "@/lib/hackathon-event-signup";
import { HACK_A_SPRINT_2026_EVENT_ID } from "@/lib/hackathon-showcase";
import { SPORTS_HACK_2026_EVENT_ID } from "@/lib/sports-hack-2026";

describe("hackathon-event-signup", () => {
  it("allows known event ids", () => {
    expect(isHackathonEventSignupId(HACK_A_SPRINT_2026_EVENT_ID)).toBe(true);
    expect(isHackathonEventSignupId(SPORTS_HACK_2026_EVENT_ID)).toBe(true);
  });

  it("rejects unknown event id", () => {
    expect(isHackathonEventSignupId("other-event")).toBe(false);
  });

  it("scopes judge/declined sets per event so hack-a-sprint lists don't leak into sports-hack", () => {
    const hackASprintJudges = getJudgeEmailsForEvent(HACK_A_SPRINT_2026_EVENT_ID);
    const sportsHackJudges = getJudgeEmailsForEvent(SPORTS_HACK_2026_EVENT_ID);
    // Ray was a hack-a-sprint judge, not a sports-hack judge
    expect(hackASprintJudges.has("ray@vectorly.app")).toBe(true);
    expect(sportsHackJudges.has("ray@vectorly.app")).toBe(false);

    const hackASprintDeclined = getDeclinedEmailsForEvent(HACK_A_SPRINT_2026_EVENT_ID);
    const sportsHackDeclined = getDeclinedEmailsForEvent(SPORTS_HACK_2026_EVENT_ID);
    // A hack-a-sprint decliner should not be excluded from sports-hack
    expect(hackASprintDeclined.size).toBeGreaterThan(0);
    const sampleDeclined = hackASprintDeclined.values().next().value as string;
    expect(sportsHackDeclined.has(sampleDeclined)).toBe(false);
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

  it("treats judge emails as check-in exceptions via token or profile", () => {
    expect(profileMatchesHackathonJudgeCheckinException("Ray@vectorly.app", undefined)).toBe(
      true
    );
    expect(
      profileMatchesHackathonJudgeCheckinException(null, {
        email: "ashbhatia@gmail.com",
      })
    ).toBe(true);
    expect(
      profileMatchesHackathonJudgeCheckinException(null, {
        email: "other@example.com",
        additionalEmails: [{ verified: true, email: "MikeBoensel@gmail.com" }],
      })
    ).toBe(true);
    expect(
      profileMatchesHackathonJudgeCheckinException(null, { email: "participant@example.com" })
    ).toBe(false);
  });

  it("blocks when public but no GitHub linked", () => {
    expect(
      getHackathonEventSignupBlockReason({
        visibility: { isPublic: true },
        // No github
        discord: { id: "1" },
      }),
    ).toBe("Connect GitHub in your profile to sign up.");
  });

  it("blocks when public + github but no Discord", () => {
    expect(
      getHackathonEventSignupBlockReason({
        visibility: { isPublic: true },
        github: { login: "u" },
        // No discord
      }),
    ).toBe("Connect Discord in your profile to sign up.");
  });

  it("judge exception: token mismatch + undefined profile returns false (no further checks)", () => {
    expect(
      profileMatchesHackathonJudgeCheckinException("not-a-judge@example.com", undefined),
    ).toBe(false);
  });

  it("judge exception: additionalEmails with verified=false is ignored", () => {
    expect(
      profileMatchesHackathonJudgeCheckinException(null, {
        email: "non-judge@example.com",
        additionalEmails: [{ verified: false, email: "MikeBoensel@gmail.com" }],
      }),
    ).toBe(false);
  });

  it("judge exception: additionalEmails entry without email field is skipped", () => {
    expect(
      profileMatchesHackathonJudgeCheckinException(null, {
        email: "non-judge@example.com",
        additionalEmails: [{ verified: true }],
      }),
    ).toBe(false);
  });
});
