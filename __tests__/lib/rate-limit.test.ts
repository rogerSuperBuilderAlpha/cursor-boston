/**
 * @jest-environment node
 */
import { checkRateLimit, getClientIdentifier, rateLimitConfigs } from '@/lib/rate-limit';

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Clear the rate limit store before each test
    jest.clearAllMocks();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within the limit', () => {
      const identifier = 'test-ip-1';
      const result = checkRateLimit(identifier, {
        windowMs: 60000, // 1 minute
        maxRequests: 10,
      });

      expect(result.success).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should block requests exceeding the limit', () => {
      const identifier = 'test-ip-2';
      const options = {
        windowMs: 60000,
        maxRequests: 3,
      };

      // Make 3 requests (should all succeed)
      for (let i = 0; i < 3; i++) {
        const result = checkRateLimit(identifier, options);
        expect(result.success).toBe(true);
      }

      // 4th request should be blocked
      const result = checkRateLimit(identifier, options);
      expect(result.success).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
    });

    it('should reset after the time window', async () => {
      const identifier = 'test-ip-3';
      const options = {
        windowMs: 100, // Very short window for testing
        maxRequests: 2,
      };

      // Make 2 requests
      checkRateLimit(identifier, options);
      checkRateLimit(identifier, options);

      // 3rd should be blocked
      let result = checkRateLimit(identifier, options);
      expect(result.success).toBe(false);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be allowed again
      result = checkRateLimit(identifier, options);
      expect(result.success).toBe(true);
    });
  });

  describe('getClientIdentifier', () => {
    it('should extract the trusted client IP from x-forwarded-for', () => {
      const request = new Request('https://example.com', {
        headers: {
          'x-forwarded-for': '203.0.113.200, 198.51.100.10',
        },
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('198.51.100.10');
    });

    it('should prefer x-vercel-forwarded-for over x-forwarded-for', () => {
      const request = new Request('https://example.com', {
        headers: {
          'x-vercel-forwarded-for': '192.168.1.2',
          'x-forwarded-for': '203.0.113.200, 10.0.0.1',
        },
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('192.168.1.2');
    });

    it('should extract IP from cf-connecting-ip header', () => {
      const request = new Request('https://example.com', {
        headers: {
          'cf-connecting-ip': '192.168.1.3',
        },
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('192.168.1.3');
    });

    it('should return "unknown" if no IP header is present', () => {
      const request = new Request('https://example.com');
      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('unknown');
    });

    it('should ignore x-real-ip because it is spoofable outside trusted proxies', () => {
      const request = new Request('https://example.com', {
        headers: {
          'x-real-ip': '192.168.1.4',
        },
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('unknown');
    });
  });

  describe('rateLimitConfigs', () => {
    it('should have oauthCallback configuration', () => {
      expect(rateLimitConfigs.oauthCallback).toBeDefined();
      expect(rateLimitConfigs.oauthCallback.windowMs).toBe(15 * 60 * 1000);
      // Sized for shared-NAT venues. Raised to 1000 on 2026-05-24 after the
      // previous 100 ceiling saturated at the May 26 event prep (218+
      // confirmed attendees connecting Discord/GitHub from the same egress).
      // See lib/rate-limit.ts oauthCallback comment for the full history.
      expect(rateLimitConfigs.oauthCallback.maxRequests).toBe(1000);
    });

    it('should have webhook configuration', () => {
      expect(rateLimitConfigs.webhook).toBeDefined();
      expect(rateLimitConfigs.webhook.windowMs).toBe(60 * 1000);
      expect(rateLimitConfigs.webhook.maxRequests).toBe(30);
    });

    it('should have standard configuration', () => {
      expect(rateLimitConfigs.standard).toBeDefined();
      expect(rateLimitConfigs.standard.windowMs).toBe(60 * 1000);
      expect(rateLimitConfigs.standard.maxRequests).toBe(60);
    });

    it('should preserve hackathon presets from the route-local values', () => {
      expect(rateLimitConfigs.hackathonMutation).toEqual({
        windowMs: 60 * 1000,
        maxRequests: 10,
      });
      expect(rateLimitConfigs.hackathonAction).toEqual({
        windowMs: 60 * 1000,
        maxRequests: 20,
      });
      expect(rateLimitConfigs.hackathonEligibility).toEqual({
        windowMs: 60 * 1000,
        maxRequests: 30,
      });
      expect(rateLimitConfigs.hackathonEventSignup).toEqual({
        windowMs: 60 * 1000,
        maxRequests: 40,
      });
    });

    it('should keep distinct live showcase presets where the behavior differs', () => {
      expect(rateLimitConfigs.hackathonShowcaseAiScore).toEqual({
        windowMs: 60 * 1000,
        maxRequests: 30,
      });
      expect(rateLimitConfigs.hackathonShowcaseJudgeScore).toEqual({
        windowMs: 60 * 1000,
        maxRequests: 40,
      });
      expect(rateLimitConfigs.hackathonShowcaseVote).toEqual({
        windowMs: 60 * 1000,
        maxRequests: 30,
      });
    });
  });
});
