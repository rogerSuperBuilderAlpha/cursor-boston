/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Events API contracts. Covers the per-event coworking flow
 * (eligibility / register / slots) and the PyData 2026 ticketing surface
 * (capacity, luma cross-check, registration, admin list).
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema, RateLimitedErrorSchema } from "./common";

const c = initContract();

const baseErrors = {
  401: ApiErrorSchema.openapi({ description: "Authentication required" }),
  500: ApiErrorSchema,
} as const;
const writeErrors = {
  ...baseErrors,
  400: ApiErrorSchema.openapi({ description: "Validation error" }),
  429: RateLimitedErrorSchema.openapi({ description: "Rate limit exceeded" }),
} as const;
const adminErrors = {
  ...baseErrors,
  403: ApiErrorSchema.openapi({ description: "Forbidden" }),
} as const;

// ──────────────────── Path / body schemas ────────────────────

const EventIdParam = z.object({ eventId: z.string().min(1) });

const CoworkingRegisterBody = z
  .object({ sessionId: z.string().min(1) })
  .openapi("EventsCoworkingRegisterBody");

const PydataRegistrationBody = z
  .object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().min(1),
    phone: z.string().optional().default(""),
    organization: z.string().min(1),
    attendingConfirmed: z.literal(true),
  })
  .openapi("PydataRegistrationBody");

const PydataWithdrawBody = z
  .object({
    email: z.string().min(1),
    token: z.string().min(1),
  })
  .openapi("PydataWithdrawBody");

const PydataWithdrawRedirect = z.object({}).optional();

// ──────────────────── Response schemas ────────────────────

const EligibilityResponse = z
  .object({
    eligible: z.boolean(),
    reason: z.string().optional(),
  })
  .passthrough();

const SlotsResponse = z.object({
  success: z.literal(true),
  eventId: z.string(),
  sessions: z.array(z.object({}).passthrough()),
});

const CoworkingRegisterResponse = z
  .object({
    success: z.literal(true),
    message: z.string(),
    registration: z.object({}).passthrough().optional(),
  })
  .passthrough();

const CoworkingDeleteResponse = z.object({
  success: z.literal(true),
  message: z.string(),
});

const PydataCapacityResponse = z.object({
  capacity: z.number().int().nonnegative(),
  claimed: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  full: z.boolean(),
});

const PydataLumaStatusResponse = z.object({
  signedIn: z.boolean(),
  onLumaList: z.boolean(),
});

const PydataRegistrationGetResponse = z
  .object({
    registered: z.boolean(),
    registration: z.object({}).passthrough().nullable(),
  })
  .passthrough();

const PydataRegistrationPostResponse = z.object({
  ok: z.literal(true),
  isFirstSubmission: z.boolean(),
});

const PydataAdminListResponse = z
  .object({
    total: z.number().int().nonnegative(),
    counts: z.record(z.string(), z.number().int().nonnegative()),
    capacity: z.number().int().nonnegative(),
    inCapCount: z.number().int().nonnegative(),
    waitlistCount: z.number().int().nonnegative(),
    registrations: z.array(z.object({}).passthrough()),
  })
  .passthrough();

// ──────────────────── Contract router ────────────────────

export const eventsContract = c.router(
  {
    coworkingEligibility: {
      method: "GET",
      path: "/api/events/:eventId/coworking/eligibility",
      pathParams: EventIdParam,
      summary: "Check coworking eligibility for the current user",
      description:
        "Returns 200 with `eligible:false` when unauthenticated rather than 401, so the page can render a 'sign in' affordance.",
      responses: {
        200: EligibilityResponse,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["RATE_LIMITED", "SERVER_ERROR"] as const },
    },
    coworkingRegister: {
      method: "POST",
      path: "/api/events/:eventId/coworking/register",
      pathParams: EventIdParam,
      summary: "Register for a coworking session in an event",
      body: CoworkingRegisterBody,
      responses: {
        200: CoworkingRegisterResponse,
        ...writeErrors,
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "VALIDATION_ERROR",
          "RATE_LIMITED",
          "SERVER_ERROR",
        ] as const,
      },
    },
    coworkingCancel: {
      method: "DELETE",
      path: "/api/events/:eventId/coworking/register",
      pathParams: EventIdParam,
      summary: "Cancel the current user's coworking registration",
      responses: {
        200: CoworkingDeleteResponse,
        ...writeErrors,
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "VALIDATION_ERROR",
          "RATE_LIMITED",
          "SERVER_ERROR",
        ] as const,
      },
    },
    coworkingSlots: {
      method: "GET",
      path: "/api/events/:eventId/coworking/slots",
      pathParams: EventIdParam,
      summary: "List coworking sessions with availability for an event",
      description: "Authentication optional; if present, includes user-specific status.",
      responses: {
        200: SlotsResponse,
        400: ApiErrorSchema,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: {
        errorCodes: ["VALIDATION_ERROR", "RATE_LIMITED", "SERVER_ERROR"] as const,
      },
    },

    pydataAdminList: {
      method: "GET",
      path: "/api/events/pydata-2026/admin/list",
      summary: "Admin: paginated PyData 2026 registrations with cap-vs-waitlist",
      responses: {
        200: PydataAdminListResponse,
        ...adminErrors,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "FORBIDDEN", "SERVER_ERROR"] as const,
      },
    },
    pydataCapacity: {
      method: "GET",
      path: "/api/events/pydata-2026/capacity",
      summary: "Public PyData 2026 capacity / claimed / remaining counts",
      responses: { 200: PydataCapacityResponse, 500: ApiErrorSchema },
      metadata: { errorCodes: ["SERVER_ERROR"] as const },
    },
    pydataLumaStatus: {
      method: "GET",
      path: "/api/events/pydata-2026/luma-status",
      summary: "Whether the current user appears on the PyData Luma guest list",
      responses: { 200: PydataLumaStatusResponse, 500: ApiErrorSchema },
      metadata: { errorCodes: ["SERVER_ERROR"] as const },
    },
    pydataRegistrationGet: {
      method: "GET",
      path: "/api/events/pydata-2026/registration",
      summary: "Get the current user's PyData 2026 registration (if any)",
      responses: { 200: PydataRegistrationGetResponse, ...baseErrors },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    pydataRegistrationPost: {
      method: "POST",
      path: "/api/events/pydata-2026/registration",
      summary: "Create or update the current user's PyData 2026 registration",
      body: PydataRegistrationBody,
      responses: {
        200: PydataRegistrationPostResponse,
        400: ApiErrorSchema.openapi({
          description: "Validation failed (per-field codes returned in `missingFields`)",
        }),
        ...baseErrors,
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "VALIDATION_ERROR",
          "SERVER_ERROR",
        ] as const,
      },
    },
    pydataWithdraw: {
      method: "POST",
      path: "/api/events/pydata-2026/withdraw",
      summary:
        "Two-step PyData withdrawal: confirmation page POSTs here with HMAC token",
      contentType: "application/x-www-form-urlencoded",
      body: PydataWithdrawBody,
      responses: { 303: PydataWithdrawRedirect },
      metadata: { errorCodes: [] as const },
    },
  },
  { pathPrefix: "", strictStatusCodes: true }
);
