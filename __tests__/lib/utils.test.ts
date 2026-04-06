import { getDisplayName, getInitials } from "@/lib/utils";

describe("utils", () => {
  describe("getDisplayName", () => {
    it("prefers a non-empty trimmed name", () => {
      expect(getDisplayName({ name: "  Ada Lovelace  ", email: "ada@example.com" })).toBe(
        "Ada Lovelace"
      );
    });

    it("falls back to the email local part when no name is present", () => {
      expect(getDisplayName({ email: "ada@example.com" })).toBe("ada");
    });

    it('returns "Anonymous" when the email is missing or malformed', () => {
      expect(getDisplayName({ email: undefined })).toBe("Anonymous");
      expect(getDisplayName({ email: "not-an-email" })).toBe("Anonymous");
    });
  });

  describe("getInitials", () => {
    it("returns initials for a first and last name", () => {
      expect(getInitials("Ada Lovelace")).toBe("AL");
    });

    it("returns a placeholder for missing values", () => {
      expect(getInitials(undefined)).toBe("?");
    });
  });
});
