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
  });
});
