import type { NextRequest } from "next/server";
import {
  LUDWITT_API_TIMEOUT_MS,
  fetchLudwittWithTimeout,
  getLudwittClientId,
  getLudwittClientSecret,
  getLudwittRedirectUri,
} from "@/lib/ludwitt-config";

describe("ludwitt-config", () => {
  const originalClientId = process.env.NEXT_PUBLIC_LUDWITT_CLIENT_ID;
  const originalClientSecret = process.env.LUDWITT_CLIENT_SECRET;
  const originalRedirect = process.env.NEXT_PUBLIC_LUDWITT_REDIRECT_URI;

  const restoreEnv = (key: string, value: string | undefined) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  };

  afterEach(() => {
    restoreEnv("NEXT_PUBLIC_LUDWITT_CLIENT_ID", originalClientId);
    restoreEnv("LUDWITT_CLIENT_SECRET", originalClientSecret);
    restoreEnv("NEXT_PUBLIC_LUDWITT_REDIRECT_URI", originalRedirect);
  });

  describe("getLudwittClientId", () => {
    it("returns the env value when present", () => {
      process.env.NEXT_PUBLIC_LUDWITT_CLIENT_ID = "client-abc";
      expect(getLudwittClientId()).toBe("client-abc");
    });

    it("returns null when missing", () => {
      delete process.env.NEXT_PUBLIC_LUDWITT_CLIENT_ID;
      expect(getLudwittClientId()).toBeNull();
    });

    it("returns null when empty string", () => {
      process.env.NEXT_PUBLIC_LUDWITT_CLIENT_ID = "";
      expect(getLudwittClientId()).toBeNull();
    });
  });

  describe("getLudwittClientSecret", () => {
    it("returns the env value when present", () => {
      process.env.LUDWITT_CLIENT_SECRET = "sec-xyz";
      expect(getLudwittClientSecret()).toBe("sec-xyz");
    });

    it("returns null when missing", () => {
      delete process.env.LUDWITT_CLIENT_SECRET;
      expect(getLudwittClientSecret()).toBeNull();
    });
  });

  describe("getLudwittRedirectUri", () => {
    const mockRequest = (url: string): NextRequest =>
      ({ url } as NextRequest);

    it("returns NEXT_PUBLIC_LUDWITT_REDIRECT_URI when set", () => {
      process.env.NEXT_PUBLIC_LUDWITT_REDIRECT_URI = "https://override.example.com/cb";
      expect(getLudwittRedirectUri(mockRequest("https://app.example.com/x"))).toBe(
        "https://override.example.com/cb"
      );
    });

    it("derives from the request origin + /auth/callback when env is unset", () => {
      delete process.env.NEXT_PUBLIC_LUDWITT_REDIRECT_URI;
      expect(getLudwittRedirectUri(mockRequest("https://app.example.com/whatever"))).toBe(
        "https://app.example.com/auth/callback"
      );
    });

    it("preserves the port from the request URL", () => {
      delete process.env.NEXT_PUBLIC_LUDWITT_REDIRECT_URI;
      expect(getLudwittRedirectUri(mockRequest("http://localhost:3000/x"))).toBe(
        "http://localhost:3000/auth/callback"
      );
    });
  });

  describe("fetchLudwittWithTimeout", () => {
    const realFetch = global.fetch;

    afterEach(() => {
      global.fetch = realFetch;
    });

    it("delegates to fetch with an AbortController signal", async () => {
      const calls: Array<{ url: string; init?: RequestInit }> = [];
      global.fetch = jest.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return { ok: true } as unknown as Response;
      }) as unknown as typeof fetch;

      await fetchLudwittWithTimeout("https://x.example.com");
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe("https://x.example.com");
      expect(calls[0].init?.signal).toBeInstanceOf(AbortSignal);
    });

    it("merges caller-provided init options", async () => {
      const calls: Array<{ url: string; init?: RequestInit }> = [];
      global.fetch = jest.fn().mockImplementation(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return { ok: true } as unknown as Response;
      }) as unknown as typeof fetch;

      await fetchLudwittWithTimeout("https://x.example.com", { method: "POST", body: "hi" });
      expect(calls[0].init?.method).toBe("POST");
      expect(calls[0].init?.body).toBe("hi");
      expect(calls[0].init?.signal).toBeInstanceOf(AbortSignal);
    });

    it("exposes a sane timeout constant", () => {
      expect(LUDWITT_API_TIMEOUT_MS).toBeGreaterThanOrEqual(1_000);
      expect(LUDWITT_API_TIMEOUT_MS).toBeLessThanOrEqual(60_000);
    });
  });
});
