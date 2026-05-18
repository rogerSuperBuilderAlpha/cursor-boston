import { getLudwittErrorMessage } from "@/app/(auth)/login/_lib/ludwitt-errors";

describe("getLudwittErrorMessage", () => {
  it.each([
    ["missing_params", "incomplete"],
    ["invalid_state", "expired"],
    ["not_configured", "isn't set up"],
    ["token_failed", "reach Ludwitt"],
    ["userinfo_failed", "account details"],
    ["no_email", "doesn't have an email"],
    ["firebase_user_failed", "create your account"],
    ["token_persist_failed", "save your Ludwitt session"],
    ["custom_token_failed", "sign-in session"],
    ["finalize_failed", "expired"],
    ["access_denied", "declined"],
  ])("returns a specific message for code '%s'", (code, fragment) => {
    expect(getLudwittErrorMessage(code)).toContain(fragment);
  });

  it("returns a generic message for null", () => {
    expect(getLudwittErrorMessage(null)).toBe("Ludwitt sign-in failed. Please try again.");
  });

  it("returns the generic message for unknown codes", () => {
    expect(getLudwittErrorMessage("totally-made-up")).toBe(
      "Ludwitt sign-in failed. Please try again."
    );
  });
});
