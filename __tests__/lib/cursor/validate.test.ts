/**
 * @jest-environment node
 */
import { InvalidCursorKeyError, validateCursorApiKey } from "@/lib/cursor/validate";

const mockList = jest.fn();

jest.mock("@cursor/sdk", () => ({
  Cursor: {
    models: {
      list: (...args: unknown[]) => mockList(...args),
    },
  },
}));

describe("cursor/validate", () => {
  beforeEach(() => mockList.mockReset());

  describe("InvalidCursorKeyError", () => {
    it("defaults the message", () => {
      const err = new InvalidCursorKeyError();
      expect(err.message).toBe("Invalid Cursor API key");
      expect(err.name).toBe("InvalidCursorKeyError");
      expect(err).toBeInstanceOf(Error);
    });

    it("accepts a custom message", () => {
      const err = new InvalidCursorKeyError("upstream 401");
      expect(err.message).toBe("upstream 401");
    });
  });

  describe("validateCursorApiKey", () => {
    it("returns modelsAvailable and defaultModel='composer-2' when present", async () => {
      mockList.mockResolvedValueOnce([
        { id: "model-a" },
        { id: "composer-2" },
        { id: "model-b" },
      ]);
      const result = await validateCursorApiKey("sk_abc");
      expect(result.modelsAvailable).toEqual(["model-a", "composer-2", "model-b"]);
      expect(result.defaultModel).toBe("composer-2");
      expect(mockList).toHaveBeenCalledWith({ apiKey: "sk_abc" });
    });

    it("falls back to first available model when composer-2 is absent", async () => {
      mockList.mockResolvedValueOnce([{ id: "model-a" }, { id: "model-b" }]);
      const result = await validateCursorApiKey("sk_abc");
      expect(result.defaultModel).toBe("model-a");
    });

    it("returns undefined defaultModel when modelsAvailable is empty", async () => {
      mockList.mockResolvedValueOnce([]);
      const result = await validateCursorApiKey("sk_abc");
      expect(result.modelsAvailable).toEqual([]);
      expect(result.defaultModel).toBeUndefined();
    });

    it("wraps an Error from the SDK in InvalidCursorKeyError preserving the message", async () => {
      mockList.mockRejectedValueOnce(new Error("HTTP 401: invalid key"));
      try {
        await validateCursorApiKey("bad-key");
        throw new Error("expected validateCursorApiKey to throw");
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidCursorKeyError);
        expect((err as Error).message).toBe("HTTP 401: invalid key");
      }
    });

    it("wraps a non-Error throw in InvalidCursorKeyError with the default message", async () => {
      mockList.mockRejectedValueOnce("string-thrown");
      await expect(validateCursorApiKey("bad-key")).rejects.toThrow("Invalid Cursor API key");
    });
  });
});
