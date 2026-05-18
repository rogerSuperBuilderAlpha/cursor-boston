import { getLumaCheckoutEventId, getLumaCheckoutHref } from "@/lib/luma-event";

describe("luma-event", () => {
  describe("getLumaCheckoutEventId", () => {
    it("prefers lumaCheckoutEventId when present", () => {
      expect(
        getLumaCheckoutEventId({
          lumaEventId: "evt-999",
          lumaCheckoutEventId: "chk-123",
        })
      ).toBe("chk-123");
    });

    it("falls back to lumaEventId when lumaCheckoutEventId is missing", () => {
      expect(
        getLumaCheckoutEventId({ lumaEventId: "evt-999" } as Parameters<typeof getLumaCheckoutEventId>[0])
      ).toBe("evt-999");
    });

    it("falls back to lumaEventId when lumaCheckoutEventId is empty string", () => {
      expect(
        getLumaCheckoutEventId({
          lumaEventId: "evt-fallback",
          lumaCheckoutEventId: "",
        } as Parameters<typeof getLumaCheckoutEventId>[0])
      ).toBe("");
    });
  });

  describe("getLumaCheckoutHref", () => {
    it("builds a luma.com/event URL when lumaCheckoutEventId is set", () => {
      expect(
        getLumaCheckoutHref({
          lumaUrl: "https://lu.ma/other",
          lumaCheckoutEventId: "evt-123",
        })
      ).toBe("https://luma.com/event/evt-123");
    });

    it("falls back to lumaUrl when lumaCheckoutEventId is missing", () => {
      expect(
        getLumaCheckoutHref({
          lumaUrl: "https://lu.ma/fallback",
        } as Parameters<typeof getLumaCheckoutHref>[0])
      ).toBe("https://lu.ma/fallback");
    });

    it("falls back to lumaUrl when lumaCheckoutEventId is empty string", () => {
      expect(
        getLumaCheckoutHref({
          lumaUrl: "https://lu.ma/fallback",
          lumaCheckoutEventId: "",
        } as Parameters<typeof getLumaCheckoutHref>[0])
      ).toBe("https://lu.ma/fallback");
    });
  });
});
