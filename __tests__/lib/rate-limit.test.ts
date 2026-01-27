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
    it('should extract IP from x-forwarded-for header', () => {
      const request = new Request('https://example.com', {
        headers: {
          'x-forwarded-for': '192.168.1.1, 10.0.0.1',
        },
      });

      const identifier = getClientIdentifier(request);
      expect(identifier).toBe('192.168.1.1');
    });

    it('should extract IP from x-real-ip header', () => {
      const request = new Request('https://example.com', {
        headers: {
          'x-real-ip': '192.168.1.2',
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
  });

  describe('rateLimitConfigs', () => {
    it('should have oauthCallback configuration', () => {
      expect(rateLimitConfigs.oauthCallback).toBeDefined();
      expect(rateLimitConfigs.oauthCallback.windowMs).toBe(15 * 60 * 1000);
      expect(rateLimitConfigs.oauthCallback.maxRequests).toBe(10);
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
  });
});
