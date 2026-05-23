import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  optionalEnvVars,
  requiredEnvVars,
  validateEnvVar,
} from '@/scripts/validate-env';

const requiredEnvValues: Record<string, string> = {
  NEXT_PUBLIC_FIREBASE_API_KEY: 'actual-api-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'actual-project.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'actual-project-id',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'actual-project.appspot.com',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:abcdef',
  NEXT_PUBLIC_FIREBASE_DATABASE_URL: 'https://actual-project.firebaseio.com',
  UNSUBSCRIBE_SECRET: 'u'.repeat(32),
};

const expectedOptionalEnvNames = [
  'NEXT_PUBLIC_DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'NEXT_PUBLIC_DISCORD_REDIRECT_URI',
  'CURSOR_BOSTON_DISCORD_SERVER_ID',
  'NEXT_PUBLIC_GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'NEXT_PUBLIC_GITHUB_REDIRECT_URI',
  'GITHUB_WEBHOOK_SECRET',
  'GITHUB_REPO_OWNER',
  'GITHUB_REPO_NAME',
  'HACK_A_SPRINT_2026_JUDGE_UIDS',
  'HACK_A_SPRINT_2026_JUDGE_EMAILS',
  'HACK_A_SPRINT_2026_EVENT_PASSCODE',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'ADMIN_EMAIL',
  'SUMMER_COHORT_ADMIN_EMAILS',
  'MAILGUN_API_KEY',
  'MAILGUN_DOMAIN',
];

const repoRoot = process.cwd();
const validateEnvScript = path.join(repoRoot, 'scripts', 'validate-env.ts');
const tsxCli = path.join(path.dirname(require.resolve('tsx')), 'cli.mjs');

function findRequiredEnvVar(name: string) {
  const envVar = requiredEnvVars.find((candidate) => candidate.name === name);
  expect(envVar).toBeDefined();
  return envVar!;
}

function setNodeEnv(value: string) {
  Object.defineProperty(process.env, 'NODE_ENV', {
    value,
    configurable: true,
    writable: true,
  });
}

function setRequiredEnv(overrides: Record<string, string | undefined> = {}) {
  for (const [name, value] of Object.entries({
    ...requiredEnvValues,
    ...overrides,
  })) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}

function childEnv(env: Record<string, string | undefined>) {
  const preservedKeys = [
    'PATH',
    'Path',
    'SYSTEMROOT',
    'SystemRoot',
    'COMSPEC',
    'ComSpec',
    'TEMP',
    'TMP',
    'HOME',
    'USERPROFILE',
  ];
  const baseEnv: NodeJS.ProcessEnv = {};

  for (const key of preservedKeys) {
    if (process.env[key]) {
      baseEnv[key] = process.env[key];
    }
  }

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete baseEnv[key];
    } else {
      baseEnv[key] = value;
    }
  }

  return baseEnv;
}

function runValidateEnv(env: Record<string, string | undefined>) {
  const tempCwd = mkdtempSync(path.join(tmpdir(), 'validate-env-'));

  try {
    return spawnSync(process.execPath, [tsxCli, validateEnvScript], {
      cwd: tempCwd,
      env: childEnv(env),
      encoding: 'utf8',
      timeout: 30_000,
    });
  } finally {
    rmSync(tempCwd, { recursive: true, force: true });
  }
}

describe('Environment Variable Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    setNodeEnv('production');
    setRequiredEnv();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('keeps the test matrix aligned with validate-env declarations', () => {
    expect(requiredEnvVars.map((envVar) => envVar.name).sort()).toEqual(
      Object.keys(requiredEnvValues).sort()
    );
    expect(optionalEnvVars.map((envVar) => envVar.name).sort()).toEqual(
      [...expectedOptionalEnvNames].sort()
    );
  });

  it.each(Object.entries(requiredEnvValues))(
    'accepts a valid value for %s',
    (name, value) => {
      process.env[name] = value;

      expect(validateEnvVar(findRequiredEnvVar(name))).toEqual({ valid: true });
    }
  );

  it.each(Object.keys(requiredEnvValues))(
    'rejects missing required production value for %s',
    (name) => {
      delete process.env[name];

      const result = validateEnvVar(findRequiredEnvVar(name));

      expect(result.valid).toBe(false);
      expect(result.error).toContain('not set');
    }
  );

  it.each([
    [
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'your-api-key',
      'actual Firebase API key',
    ],
    [
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'your-project.firebaseapp.com',
      'actual Firebase project domain',
    ],
    [
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'your-project-id',
      'actual Firebase project ID',
    ],
    [
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      'your-project.appspot.com',
      'actual Firebase storage bucket',
    ],
    [
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      'your-sender-id',
      'actual Firebase sender ID',
    ],
    [
      'NEXT_PUBLIC_FIREBASE_APP_ID',
      'your-app-id',
      'actual Firebase app ID',
    ],
    [
      'NEXT_PUBLIC_FIREBASE_DATABASE_URL',
      'https://your-project.firebaseio.com',
      'actual Firebase database URL',
    ],
    ['UNSUBSCRIBE_SECRET', 'cursor-boston-unsub', 'legacy public fallback'],
    ['UNSUBSCRIBE_SECRET', 'short-secret', '32 bytes'],
    [
      'UNSUBSCRIBE_SECRET',
      'your-unsubscribe-secret-value-over-thirty-two-bytes',
      'actual unsubscribe secret',
    ],
  ])('rejects invalid %s value', (name, value, expectedError) => {
    process.env[name] = value;

    const result = validateEnvVar(findRequiredEnvVar(name));

    expect(result.valid).toBe(false);
    expect(result.error).toContain(expectedError);
  });

  it.each(expectedOptionalEnvNames)(
    'does not require optional variable %s',
    (name) => {
      const envVar = optionalEnvVars.find((candidate) => candidate.name === name);
      expect(envVar).toBeDefined();
      delete process.env[name];

      expect(validateEnvVar(envVar!)).toEqual({ valid: true });
    }
  );

  it.each(['development', 'test'])(
    'allows missing unsubscribe secret in %s',
    (nodeEnv) => {
      setNodeEnv(nodeEnv);
      delete process.env.UNSUBSCRIBE_SECRET;

      expect(validateEnvVar(findRequiredEnvVar('UNSUBSCRIBE_SECRET'))).toEqual({
        valid: true,
      });
    }
  );

  describe('script integration', () => {
    it('exits 0 for a valid production config without optional variables', () => {
      const result = runValidateEnv({
        NODE_ENV: 'production',
        ...requiredEnvValues,
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('All required environment variables');
    });

    it('exits 1 when a required variable is missing', () => {
      const result = runValidateEnv({
        NODE_ENV: 'production',
        ...requiredEnvValues,
        NEXT_PUBLIC_FIREBASE_API_KEY: undefined,
      });

      expect(result.status).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain(
        'NEXT_PUBLIC_FIREBASE_API_KEY'
      );
    });

    it('exits 1 when a required variable has an invalid format', () => {
      const result = runValidateEnv({
        NODE_ENV: 'production',
        ...requiredEnvValues,
        UNSUBSCRIBE_SECRET: 'short-secret',
      });

      expect(result.status).toBe(1);
      expect(`${result.stdout}\n${result.stderr}`).toContain('32 bytes');
    });
  });
});
