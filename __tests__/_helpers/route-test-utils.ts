/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";

/**
 * Request factories for App Router route-handler tests.
 *
 * Consolidates the boilerplate `new NextRequest("http://localhost/api/x",
 * { method, headers, body: JSON.stringify(...) })` from the 79 existing
 * route tests so future tests only need to think about the auth context
 * and the body shape.
 */

export interface MakeRequestOpts {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";
  /** Path relative to localhost; defaults to "/api/route". */
  path?: string;
  /** Plain object — will be JSON.stringify'd. Skipped on GET/HEAD. */
  body?: unknown;
  /** Searchparams object. */
  searchParams?: Record<string, string>;
  /** Extra headers to merge in. */
  headers?: Record<string, string>;
}

const BASE_URL = "http://localhost:3000";

function buildUrl(path = "/api/route", searchParams?: Record<string, string>): string {
  const url = new URL(path, BASE_URL);
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

/** Plain request, no auth. */
export function makeRequest(opts: MakeRequestOpts = {}): NextRequest {
  const method = opts.method ?? "GET";
  const headers = new Headers({
    "content-type": "application/json",
    ...(opts.headers ?? {}),
  });
  const init: RequestInit = { method, headers };
  if (opts.body !== undefined && method !== "GET" && method !== "HEAD") {
    init.body = typeof opts.body === "string" ? opts.body : JSON.stringify(opts.body);
  }
  return new NextRequest(buildUrl(opts.path, opts.searchParams), init);
}

/**
 * Authed request — adds `Authorization: Bearer dummy-token` so the route's
 * `getVerifiedUser()` call will hit a token; the test must pair this with
 * a `mockVerifiedUser(...)` call on the server-auth spies bag.
 */
export function makeAuthedRequest(
  opts: MakeRequestOpts & { token?: string } = {},
): NextRequest {
  return makeRequest({
    ...opts,
    headers: {
      Authorization: `Bearer ${opts.token ?? "test-token"}`,
      ...(opts.headers ?? {}),
    },
  });
}

/**
 * Cron-secret request — sets the `x-cron-secret` header. Pair with
 * `withCronSecret("...")` in your beforeEach to populate the env.
 */
export function makeCronRequest(
  opts: MakeRequestOpts & { secret?: string } = {},
): NextRequest {
  return makeRequest({
    ...opts,
    headers: {
      "x-cron-secret": opts.secret ?? "test-cron-secret",
      ...(opts.headers ?? {}),
    },
  });
}

/**
 * Reads the JSON body off a Response (most route handlers return
 * `NextResponse.json(...)`). Returns `{ status, body }` for easy
 * assertion.
 */
export async function readJson<T = unknown>(res: Response): Promise<{ status: number; body: T }> {
  const status = res.status;
  const body = (await res.json()) as T;
  return { status, body };
}
