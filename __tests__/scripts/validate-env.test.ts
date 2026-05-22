import { validateEnvVar, requiredEnvVars } from '@/scripts/validate-env';

describe('Environment Variable Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validateEnvVar', () => {
    it('should validate required variables that are set', () => {
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'actual-api-key';
      const envVar = requiredEnvVars.find(
        (v) => v.name === 'NEXT_PUBLIC_FIREBASE_API_KEY'
      );
      
      if (envVar) {
        const result = validateEnvVar(envVar);
        expect(result.valid).toBe(true);
      }
    });

    it('should reject required variables that are not set', () => {
      delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
      const envVar = requiredEnvVars.find(
        (v) => v.name === 'NEXT_PUBLIC_FIREBASE_API_KEY'
      );
      
      if (envVar) {
        const result = validateEnvVar(envVar);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('not set');
      }
    });

    it('should reject placeholder values', () => {
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY = 'your-api-key';
      const envVar = requiredEnvVars.find(
        (v) => v.name === 'NEXT_PUBLIC_FIREBASE_API_KEY'
      );
      
      if (envVar) {
        const result = validateEnvVar(envVar);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Must be set');
      }
    });

    it('should accept valid values', () => {
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = 'my-real-project-id';
      const envVar = requiredEnvVars.find(
        (v) => v.name === 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'
      );
      
      if (envVar) {
        const result = validateEnvVar(envVar);
        expect(result.valid).toBe(true);
      }
    });

    it('should accept a strong unsubscribe secret', () => {
      process.env.UNSUBSCRIBE_SECRET = 'u'.repeat(32);
      const envVar = requiredEnvVars.find(
        (v) => v.name === 'UNSUBSCRIBE_SECRET'
      );

      if (envVar) {
        const result = validateEnvVar(envVar);
        expect(result.valid).toBe(true);
      }
    });

    it('should require unsubscribe secret outside development and test', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        configurable: true,
      });
      delete process.env.UNSUBSCRIBE_SECRET;
      const envVar = requiredEnvVars.find(
        (v) => v.name === 'UNSUBSCRIBE_SECRET'
      );

      if (envVar) {
        const result = validateEnvVar(envVar);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('not set');
      }
    });

    it('should allow missing unsubscribe secret in development', () => {
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'development',
        configurable: true,
      });
      delete process.env.UNSUBSCRIBE_SECRET;
      const envVar = requiredEnvVars.find(
        (v) => v.name === 'UNSUBSCRIBE_SECRET'
      );

      if (envVar) {
        const result = validateEnvVar(envVar);
        expect(result.valid).toBe(true);
      }
    });

    it('should reject the legacy public unsubscribe fallback secret', () => {
      process.env.UNSUBSCRIBE_SECRET = 'cursor-boston-unsub';
      const envVar = requiredEnvVars.find(
        (v) => v.name === 'UNSUBSCRIBE_SECRET'
      );

      if (envVar) {
        const result = validateEnvVar(envVar);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('legacy public fallback');
      }
    });

    it('should reject short unsubscribe secrets', () => {
      process.env.UNSUBSCRIBE_SECRET = 'short-secret';
      const envVar = requiredEnvVars.find(
        (v) => v.name === 'UNSUBSCRIBE_SECRET'
      );

      if (envVar) {
        const result = validateEnvVar(envVar);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('32 bytes');
      }
    });
  });
});
