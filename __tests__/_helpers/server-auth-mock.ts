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
  getOptionalVerifiedUser: jest.Mock;
  /** Pre-seed `getVerifiedUser` to return the given user on the next call. */
  mockVerifiedUser: (user: Partial<VerifiedUser> & { uid: string }) => void;
  /** Pre-seed `getVerifiedUser` to return null (unauth) on the next call. */
  mockUnauthenticated: () => void;
  /** Pre-seed `getVerifiedUser` to throw on the next call (token verify fail). */
  mockAuthError: (err?: Error) => void;
}

export function makeServerAuthSpies(): ServerAuthSpies {
  const getVerifiedUser = jest.fn().mockResolvedValue(null);
  const getOptionalVerifiedUser = jest.fn().mockResolvedValue(null);

  return {
    getVerifiedUser,
    getOptionalVerifiedUser,
    mockVerifiedUser(user) {
      getVerifiedUser.mockResolvedValueOnce({
        email: undefined,
        name: undefined,
        picture: undefined,
        isAdmin: false,
        ...user,
      });
      getOptionalVerifiedUser.mockResolvedValueOnce({
        email: undefined,
        name: undefined,
        picture: undefined,
        isAdmin: false,
        ...user,
      });
    },
    mockUnauthenticated() {
      getVerifiedUser.mockResolvedValueOnce(null);
      getOptionalVerifiedUser.mockResolvedValueOnce(null);
    },
    mockAuthError(err = new Error("token verify failed")) {
      getVerifiedUser.mockRejectedValueOnce(err);
      getOptionalVerifiedUser.mockRejectedValueOnce(err);
    },
  };
}

export function createServerAuthModule(spies: ServerAuthSpies) {
  return {
    getVerifiedUser: (...a: unknown[]) => spies.getVerifiedUser(...a),
    getOptionalVerifiedUser: (...a: unknown[]) =>
      spies.getOptionalVerifiedUser(...a),
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
