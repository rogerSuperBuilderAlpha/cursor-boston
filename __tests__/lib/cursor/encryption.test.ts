/**
 * @jest-environment node
 */
import {
  decryptApiKey,
  encryptApiKey,
  fingerprintApiKey,
} from "@/lib/cursor/encryption";

describe("cursor/encryption", () => {
  const originalEnv = process.env.CURSOR_KEY_ENC_KEY;

  beforeAll(() => {
    // 32 bytes, base64-encoded — deterministic test key, NOT a production secret.
    process.env.CURSOR_KEY_ENC_KEY = Buffer.alloc(32, 0x42).toString("base64");
    // Force re-read of the cached key by re-importing not necessary because the
    // module caches lazily on first call; the env var is in place before any call.
  });

  afterAll(() => {
    if (originalEnv === undefined) delete process.env.CURSOR_KEY_ENC_KEY;
    else process.env.CURSOR_KEY_ENC_KEY = originalEnv;
  });

  describe("encryptApiKey + decryptApiKey", () => {
    it("round-trips arbitrary UTF-8 plaintext", () => {
      const plaintext = "sk_test_abc123-éñc😀de";
      const encrypted = encryptApiKey(plaintext);
      expect(decryptApiKey(encrypted)).toBe(plaintext);
    });

    it("produces a fresh IV each call (non-deterministic ciphertext)", () => {
      const plaintext = "sk_test_same_input";
      const a = encryptApiKey(plaintext);
      const b = encryptApiKey(plaintext);
      expect(a.ciphertext).not.toBe(b.ciphertext);
      expect(a.iv).not.toBe(b.iv);
      // Both still decrypt back to the same plaintext.
      expect(decryptApiKey(a)).toBe(plaintext);
      expect(decryptApiKey(b)).toBe(plaintext);
    });

    it("returns the versioned envelope shape", () => {
      const e = encryptApiKey("anything");
      expect(e.v).toBe(1);
      expect(typeof e.ciphertext).toBe("string");
      expect(typeof e.iv).toBe("string");
      expect(typeof e.authTag).toBe("string");
    });

    it("rejects tampered ciphertext (AES-GCM auth tag check)", () => {
      const encrypted = encryptApiKey("secret");
      const tampered = {
        ...encrypted,
        ciphertext: Buffer.from(encrypted.ciphertext, "base64")
          .map((b, i) => (i === 0 ? b ^ 0xff : b))
          .toString("base64"),
      };
      expect(() => decryptApiKey(tampered)).toThrow();
    });
  });

  describe("fingerprintApiKey", () => {
    it("returns first-7 + ellipsis + last-4 characters", () => {
      expect(fingerprintApiKey("sk_test_abcdefghijklmnop")).toBe("sk_test...mnop");
    });

    it("does not leak the middle of the key", () => {
      const key = "sk_secret_DO_NOT_LEAK_xyz";
      const fp = fingerprintApiKey(key);
      expect(fp).not.toContain("DO_NOT_LEAK");
    });
  });
});
