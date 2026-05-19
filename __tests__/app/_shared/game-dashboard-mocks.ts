/**
 * Shared helpers for game / hackathon RTL tests (import in test files;
 * call jest.mock at top level using the patterns in summer-cohort/page.test.tsx).
 */
import type { User } from "firebase/auth";

export function makeAuthUser(uid = "u1"): User {
  return {
    uid,
    email: `${uid}@test.com`,
    displayName: "Test User",
    getIdToken: jest.fn().mockResolvedValue(`token-${uid}`),
  } as unknown as User;
}

export const defaultRouterMock = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn(),
};

export function stubGlobalFetch(data: unknown, ok = true) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 400,
    json: async () => data,
    text: async () => JSON.stringify(data),
  }) as typeof fetch;
}

export const emptyGithubConnection = {
  githubInfo: null,
  connecting: false,
  disconnecting: false,
  error: null,
  connect: jest.fn(),
  disconnect: jest.fn(),
};

export const emptyDiscordConnection = {
  discordInfo: null,
  connecting: false,
  disconnecting: false,
  error: null,
  connect: jest.fn(),
  disconnect: jest.fn(),
};
