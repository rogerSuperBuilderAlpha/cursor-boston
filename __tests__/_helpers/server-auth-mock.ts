/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Helpers for mocking @/lib/server-auth — the verifier used by 161 Next.js
 * App Router API routes. Plus a tiny CRON_SECRET helper for the 5 internal
 * cron endpoints.
 *
 * Pattern (registered at file top, hoisted by Jest):
 *
 * ```ts
 * const auth = makeServerAuthSpies();
 * jest.mock("@/lib/server-auth", () => createServerAuthModule(auth));
 * // ...
 * auth.mockVerifiedUser({ uid: "u1", email: "u@x.com" });
 * await POST(makeAuthedRequest({ uid: "u1" }));
 * ```
 */

import type { VerifiedUser } from "@/lib/server-auth";

export interface ServerAuthSpies {
  getVerifiedUser: jest.Mock;
  getVerifiedAdminUser: jest.Mock;
  getVerifiedUserWithRevocation: jest.Mock;
  getOptionalVerifiedUser: jest.Mock;
  isCurrentIdTokenRevoked: jest.Mock;
  isRevokedIdTokenError: jest.Mock;
  /** Pre-seed `getVerifiedUser` to return the given user on the next call. */
  mockVerifiedUser: (user: Partial<VerifiedUser> & { uid: string }) => void;
  /** Pre-seed `getVerifiedUser` to return null (unauth) on the next call. */
  mockUnauthenticated: () => void;
  /** Pre-seed `getVerifiedUser` to throw on the next call (token verify fail). */
  mockAuthError: (err?: Error) => void;
  /** Pre-seed all auth helpers to throw a revoked-token error. */
  mockRevokedAuthError: (err?: Error) => void;
}

export function makeServerAuthSpies(): ServerAuthSpies {
  const getVerifiedUser = jest.fn().mockResolvedValue(null);
  const getVerifiedAdminUser = jest.fn().mockResolvedValue(null);
  const getVerifiedUserWithRevocation = jest.fn().mockResolvedValue(null);
  const getOptionalVerifiedUser = jest.fn().mockResolvedValue(null);
  const isCurrentIdTokenRevoked = jest.fn().mockResolvedValue(false);
  const isRevokedIdTokenError = jest.fn().mockReturnValue(false);

  return {
    getVerifiedUser,
    getVerifiedAdminUser,
    getVerifiedUserWithRevocation,
    getOptionalVerifiedUser,
    isCurrentIdTokenRevoked,
    isRevokedIdTokenError,
    mockVerifiedUser(user) {
      const verified = {
        email: undefined,
        name: undefined,
        picture: undefined,
        isAdmin: false,
        ...user,
      };
      getVerifiedUser.mockResolvedValueOnce(verified);
      getVerifiedAdminUser.mockResolvedValueOnce(verified);
      getVerifiedUserWithRevocation.mockResolvedValueOnce(verified);
      getOptionalVerifiedUser.mockResolvedValueOnce(verified);
      isCurrentIdTokenRevoked.mockResolvedValueOnce(false);
    },
    mockUnauthenticated() {
      getVerifiedUser.mockResolvedValueOnce(null);
      getVerifiedAdminUser.mockResolvedValueOnce(null);
      getVerifiedUserWithRevocation.mockResolvedValueOnce(null);
      getOptionalVerifiedUser.mockResolvedValueOnce(null);
      isCurrentIdTokenRevoked.mockResolvedValueOnce(false);
    },
    mockAuthError(err = new Error("token verify failed")) {
      getVerifiedUser.mockRejectedValueOnce(err);
      getVerifiedAdminUser.mockRejectedValueOnce(err);
      getVerifiedUserWithRevocation.mockRejectedValueOnce(err);
      getOptionalVerifiedUser.mockRejectedValueOnce(err);
      isCurrentIdTokenRevoked.mockResolvedValueOnce(false);
    },
    mockRevokedAuthError(err = new Error("The Firebase ID token has been revoked.")) {
      getVerifiedUser.mockRejectedValueOnce(err);
      getVerifiedAdminUser.mockRejectedValueOnce(err);
      getVerifiedUserWithRevocation.mockRejectedValueOnce(err);
      getOptionalVerifiedUser.mockRejectedValueOnce(err);
      isCurrentIdTokenRevoked.mockResolvedValueOnce(true);
      isRevokedIdTokenError.mockReturnValueOnce(true);
    },
  };
}

export function createServerAuthModule(spies: ServerAuthSpies) {
  return {
    getVerifiedUser: (...a: unknown[]) => spies.getVerifiedUser(...a),
    getVerifiedAdminUser: (...a: unknown[]) =>
      spies.getVerifiedAdminUser(...a),
    getVerifiedUserWithRevocation: (...a: unknown[]) =>
      spies.getVerifiedUserWithRevocation(...a),
    getOptionalVerifiedUser: (...a: unknown[]) =>
      spies.getOptionalVerifiedUser(...a),
    isCurrentIdTokenRevoked: (...a: unknown[]) =>
      spies.isCurrentIdTokenRevoked(...a),
    isRevokedIdTokenError: spies.isRevokedIdTokenError,
  };
}

/**
 * CRON_SECRET env helper. The 5 internal cron routes all read
 * `process.env.CRON_SECRET` at request time and compare against either
 * `x-cron-secret` header or `Authorization: Bearer <secret>`.
 *
 * Use in beforeEach: `withCronSecret("test-secret-123")`. Returns the
 * secret string so tests can also use it when constructing the request.
 */
export function withCronSecret(secret = "test-cron-secret"): string {
  process.env.CRON_SECRET = secret;
  return secret;
}

/** Test cleanup helper. */
export function clearCronSecret(): void {
  delete process.env.CRON_SECRET;
}
