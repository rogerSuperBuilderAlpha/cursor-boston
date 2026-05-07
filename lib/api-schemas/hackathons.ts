/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Hackathons-area API contracts. The hackathons surface includes pool
 * matchmaking, team management, the Hack-a-Sprint showcase event, and
 * cron-protected admin tools. Request bodies and query/path params are
 * strictly validated; complex aggregate responses (dashboards) are
 * documented with skeletal passthrough shapes.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import { ApiErrorSchema, RateLimitedErrorSchema } from "./common";

const c = initContract();

// ──────────────────── Atom + reusable schemas ────────────────────

const OkSchema = z.object({ ok: z.literal(true) }).passthrough();

const HackathonIdQuery = z.object({
  hackathonId: z.string().optional(),
});

const PassthroughOk = z
  .object({})
  .passthrough()
  .describe(
    "Successful response — exact shape varies by helper. See the lib/hackathons module for the canonical type."
  );

const baseErrors = {
  401: ApiErrorSchema.openapi({
    description: "Authentication required",
  }),
  500: ApiErrorSchema,
} as const;

const writeErrors = {
  ...baseErrors,
  400: ApiErrorSchema.openapi({ description: "Validation error" }),
  429: RateLimitedErrorSchema.openapi({ description: "Rate limit exceeded" }),
} as const;

const teamGuardedErrors = {
  ...writeErrors,
  403: ApiErrorSchema.openapi({ description: "Forbidden" }),
  404: ApiErrorSchema.openapi({ description: "Not found" }),
} as const;

// ──────────────────── Per-route body schemas ────────────────────

const EventCheckinBody = z
  .object({
    userId: z.string().min(1),
    checkedIn: z.boolean().optional(),
  })
  .openapi("HackathonEventCheckinBody");

const SignupPatchBody = z
  .object({
    willBeLate: z.boolean().optional(),
    queuingForSpot: z.boolean().optional(),
    giveUpSpot: z.literal(true).optional(),
  })
  .openapi("HackathonEventSignupPatchBody");

const InviteAcceptBody = z
  .object({ inviteId: z.string().min(1) })
  .openapi("HackathonInviteAcceptBody");

const PoolJoinBody = z
  .object({ hackathonId: z.string().optional() })
  .openapi("HackathonPoolJoinBody");

const RequestAcceptBody = z
  .object({ requestId: z.string().min(1) })
  .openapi("HackathonRequestAcceptBody");

const AiScoreBody = z
  .object({
    submissionId: z.string().min(1),
    aiScore: z.number().min(1).max(10),
    aiReasoning: z.string().optional(),
  })
  .openapi("HackAhostASprintAiScoreBody");

const ScoreBody = z
  .object({
    submissionId: z.string().min(1),
    score: z.number().min(1).max(10),
  })
  .openapi("HackASprintScoreBody");

const SubmissionRegisterBody = z
  .object({
    repoUrl: z.string().min(1),
    hackathonId: z.string().optional(),
  })
  .openapi("HackathonSubmissionRegisterBody");

const SubmissionSubmitBody = z
  .object({ hackathonId: z.string().optional() })
  .openapi("HackathonSubmissionSubmitBody");

const TeamLeaveBody = z
  .object({ teamId: z.string().min(1) })
  .openapi("HackathonTeamLeaveBody");

const TeamProfileBody = z
  .object({
    teamId: z.string().min(1),
    name: z.string().max(50).optional(),
    logoUrl: z.string().optional(),
  })
  .openapi("HackathonTeamProfileBody");

const EventIdParam = z.object({ eventId: z.string().min(1) });

// ──────────────────── Contract router ────────────────────

export const hackathonsContract = c.router(
  {
    eligibility: {
      method: "GET",
      path: "/api/hackathons/eligibility",
      summary: "Get current user's hackathon eligibility",
      query: HackathonIdQuery,
      responses: {
        200: z.object({
          eligible: z.boolean(),
          reason: z.string().optional(),
        }),
        ...baseErrors,
        429: RateLimitedErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "RATE_LIMITED", "SERVER_ERROR"] as const },
    },

    eventSignupGet: {
      method: "GET",
      path: "/api/hackathons/events/:eventId/signup",
      pathParams: EventIdParam,
      summary: "Public event-signup leaderboard",
      description: "30-second cached signup list with merged-PR counts.",
      responses: { 200: PassthroughOk, ...baseErrors, 404: ApiErrorSchema },
      metadata: { errorCodes: ["NOT_FOUND", "SERVER_ERROR"] as const },
    },
    eventSignupPost: {
      method: "POST",
      path: "/api/hackathons/events/:eventId/signup",
      pathParams: EventIdParam,
      summary: "Sign up the current user for an event",
      body: z.object({}).optional(),
      responses: {
        200: z.object({
          signedUp: z.boolean(),
          alreadySignedUp: z.boolean().optional(),
        }),
        ...writeErrors,
        404: ApiErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "NOT_FOUND", "SERVER_ERROR"] as const },
    },
    eventSignupPatch: {
      method: "PATCH",
      path: "/api/hackathons/events/:eventId/signup",
      pathParams: EventIdParam,
      summary: "Update the current user's signup state",
      body: SignupPatchBody,
      responses: { 200: OkSchema, ...writeErrors, 404: ApiErrorSchema },
      metadata: { errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const },
    },
    eventSignupDelete: {
      method: "DELETE",
      path: "/api/hackathons/events/:eventId/signup",
      pathParams: EventIdParam,
      summary: "Withdraw the current user's signup",
      body: z.object({}).optional(),
      responses: { 200: OkSchema, ...writeErrors, 404: ApiErrorSchema },
      metadata: { errorCodes: ["UNAUTHORIZED", "NOT_FOUND", "SERVER_ERROR"] as const },
    },
    eventCheckin: {
      method: "POST",
      path: "/api/hackathons/events/:eventId/checkin",
      pathParams: EventIdParam,
      summary: "Admin-only: check a user in to an event",
      body: EventCheckinBody,
      responses: {
        200: z.object({
          ok: z.literal(true),
          checkedIn: z.boolean(),
          created: z.boolean().optional(),
        }),
        ...teamGuardedErrors,
      },
      metadata: {
        errorCodes: [
          "FORBIDDEN",
          "NOT_FOUND",
          "VALIDATION_ERROR",
          "SERVER_ERROR",
        ] as const,
      },
    },

    inviteAccept: {
      method: "POST",
      path: "/api/hackathons/invites/accept",
      summary: "Accept a team invite",
      body: InviteAcceptBody,
      responses: {
        200: z.object({ accepted: z.boolean() }),
        ...teamGuardedErrors,
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "FORBIDDEN",
          "NOT_FOUND",
          "VALIDATION_ERROR",
          "SERVER_ERROR",
        ] as const,
      },
    },

    poolDashboard: {
      method: "GET",
      path: "/api/hackathons/pool-dashboard",
      summary: "Get the current user's hackathon pool dashboard",
      query: HackathonIdQuery,
      responses: {
        200: PassthroughOk,
        ...baseErrors,
        429: RateLimitedErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "RATE_LIMITED", "SERVER_ERROR"] as const },
    },
    poolJoin: {
      method: "POST",
      path: "/api/hackathons/pool/join",
      summary: "Join the hackathon pool (matchmaking)",
      body: PoolJoinBody,
      responses: {
        200: z.object({
          joined: z.boolean(),
          hackathonId: z.string(),
        }),
        ...writeErrors,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const },
    },

    requestAccept: {
      method: "POST",
      path: "/api/hackathons/requests/accept",
      summary: "Accept a team-join request from another user",
      body: RequestAcceptBody,
      responses: {
        200: z.object({ accepted: z.boolean() }),
        ...teamGuardedErrors,
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "FORBIDDEN",
          "NOT_FOUND",
          "VALIDATION_ERROR",
          "SERVER_ERROR",
        ] as const,
      },
    },

    // Hack-a-Sprint 2026 showcase
    hackASprintAdminDashboard: {
      method: "GET",
      path: "/api/hackathons/showcase/hack-a-sprint-2026/admin-dashboard",
      summary: "Admin: Hack-a-Sprint scoring dashboard",
      responses: { 200: PassthroughOk, ...baseErrors, 403: ApiErrorSchema },
      metadata: { errorCodes: ["FORBIDDEN", "RATE_LIMITED", "SERVER_ERROR"] as const },
    },
    hackASprintAiScore: {
      method: "POST",
      path: "/api/hackathons/showcase/hack-a-sprint-2026/ai-score",
      summary: "Admin: set AI score (1-10) on a submission",
      body: AiScoreBody,
      responses: { 200: OkSchema, ...writeErrors, 403: ApiErrorSchema },
      metadata: { errorCodes: ["FORBIDDEN", "VALIDATION_ERROR", "SERVER_ERROR"] as const },
    },
    hackASprintCreditCode: {
      method: "GET",
      path: "/api/hackathons/showcase/hack-a-sprint-2026/credit-code",
      summary: "Get the current user's Cursor credit link",
      responses: {
        200: z.union([
          z.object({ eligible: z.literal(false), reason: z.string().optional() }),
          z.object({
            eligible: z.literal(true),
            creditUrl: z.string(),
            rank: z.number().int().nonnegative(),
          }),
        ]),
        ...baseErrors,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    hackASprintCreditEmail: {
      method: "POST",
      path: "/api/hackathons/showcase/hack-a-sprint-2026/credit-email",
      summary: "Email the credit link to the current user",
      body: z.object({}).optional(),
      responses: {
        200: z.union([
          z.object({
            ok: z.literal(true),
            alreadySent: z.boolean().optional(),
            message: z.string().optional(),
          }),
          z.object({ ok: z.literal(true), emailedTo: z.string() }),
        ]),
        ...writeErrors,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const },
    },
    hackASprintJudgeScore: {
      method: "POST",
      path: "/api/hackathons/showcase/hack-a-sprint-2026/judge-score",
      summary: "Judge: score a submission during peerVotingOpen",
      body: ScoreBody,
      responses: { 200: OkSchema, ...writeErrors, 403: ApiErrorSchema },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "FORBIDDEN",
          "VALIDATION_ERROR",
          "SERVER_ERROR",
        ] as const,
      },
    },
    hackASprintMe: {
      method: "GET",
      path: "/api/hackathons/showcase/hack-a-sprint-2026/me",
      summary: "Get the current user's Hack-a-Sprint state",
      responses: { 200: PassthroughOk, ...baseErrors },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    hackASprintParticipantScore: {
      method: "POST",
      path: "/api/hackathons/showcase/hack-a-sprint-2026/participant-score",
      summary: "Participant: score a peer submission",
      body: ScoreBody,
      responses: {
        200: z.object({
          ok: z.literal(true),
          submissionId: z.string(),
          score: z.number(),
        }),
        ...writeErrors,
        403: ApiErrorSchema,
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "FORBIDDEN",
          "VALIDATION_ERROR",
          "SERVER_ERROR",
        ] as const,
      },
    },
    hackASprintSubmissions: {
      method: "GET",
      path: "/api/hackathons/showcase/hack-a-sprint-2026/submissions",
      summary: "Public Hack-a-Sprint submissions gallery",
      description:
        "Auth optional. Phase-aware — reveals scores and voter signal differently depending on submission/voting phase.",
      responses: { 200: PassthroughOk, 500: ApiErrorSchema },
      metadata: { errorCodes: ["SERVER_ERROR"] as const },
    },
    hackASprintUnlock: {
      method: "POST",
      path: "/api/hackathons/showcase/hack-a-sprint-2026/unlock",
      summary: "Legacy passcode unlock (retired)",
      description: "Always returns 410 Gone.",
      body: z.object({}).optional(),
      responses: { 410: ApiErrorSchema },
      metadata: { errorCodes: [] as const },
    },
    hackASprintVote: {
      method: "POST",
      path: "/api/hackathons/showcase/hack-a-sprint-2026/vote",
      summary: "Legacy voting endpoint (retired — use participant-score)",
      description: "Always returns 410 Gone.",
      body: z.object({}).optional(),
      responses: { 410: ApiErrorSchema },
      metadata: { errorCodes: [] as const },
    },

    submissionsCheckDisqualified: {
      method: "GET",
      path: "/api/hackathons/submissions/check-disqualified",
      summary: "Cron: scan submissions for late commits and mark disqualified",
      description:
        "Authenticated by `x-cron-secret` header (or `Authorization: Bearer`) rather than Firebase Auth.",
      query: HackathonIdQuery,
      responses: {
        200: z.object({
          hackathonId: z.string(),
          disqualifiedCount: z.number().int().nonnegative(),
          message: z.string(),
        }),
        400: ApiErrorSchema,
        401: ApiErrorSchema.openapi({
          description: "Missing or invalid cron secret",
        }),
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const },
    },
    submissionRegister: {
      method: "POST",
      path: "/api/hackathons/submissions/register",
      summary: "Register a team's repo URL for the hackathon",
      body: SubmissionRegisterBody,
      responses: {
        200: z.object({
          registered: z.boolean(),
          submissionId: z.string(),
          repoUrl: z.string(),
        }),
        ...writeErrors,
        403: ApiErrorSchema,
        502: ApiErrorSchema.openapi({ description: "Repo lookup upstream failure" }),
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "FORBIDDEN",
          "VALIDATION_ERROR",
          "SERVER_ERROR",
        ] as const,
      },
    },
    submissionSubmit: {
      method: "POST",
      path: "/api/hackathons/submissions/submit",
      summary: "Lock the team's submission (sets submittedAt, cutoffAt)",
      body: SubmissionSubmitBody,
      responses: {
        200: z.object({
          submitted: z.boolean(),
          submissionId: z.string(),
          cutoffAt: z.string(),
        }),
        ...writeErrors,
        403: ApiErrorSchema,
        409: ApiErrorSchema.openapi({ description: "Already submitted or past cutoff" }),
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "FORBIDDEN",
          "CONFLICT",
          "VALIDATION_ERROR",
          "SERVER_ERROR",
        ] as const,
      },
    },

    teamDashboard: {
      method: "GET",
      path: "/api/hackathons/team-dashboard",
      summary: "Get the current user's team dashboard",
      query: HackathonIdQuery,
      responses: {
        200: PassthroughOk,
        ...baseErrors,
        429: RateLimitedErrorSchema,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "RATE_LIMITED", "SERVER_ERROR"] as const },
    },
    teamLeave: {
      method: "POST",
      path: "/api/hackathons/team/leave",
      summary: "Leave the user's current hackathon team",
      body: TeamLeaveBody,
      responses: {
        200: z.object({
          left: z.boolean(),
          disqualified: z.boolean(),
          lockoutUntilNextMonth: z.boolean(),
        }),
        ...teamGuardedErrors,
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "FORBIDDEN",
          "NOT_FOUND",
          "VALIDATION_ERROR",
          "SERVER_ERROR",
        ] as const,
      },
    },
    teamProfile: {
      method: "PATCH",
      path: "/api/hackathons/team/profile",
      summary: "Update the team's name / logo (gated on prior wins)",
      body: TeamProfileBody,
      responses: { 200: OkSchema, ...teamGuardedErrors },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "FORBIDDEN",
          "NOT_FOUND",
          "VALIDATION_ERROR",
          "SERVER_ERROR",
        ] as const,
      },
    },
    teamsBoard: {
      method: "GET",
      path: "/api/hackathons/teams-board",
      summary: "Public hackathon teams board",
      description: "Authentication optional.",
      query: HackathonIdQuery,
      responses: {
        200: PassthroughOk,
        429: RateLimitedErrorSchema,
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["RATE_LIMITED", "SERVER_ERROR"] as const },
    },
  },
  {
    pathPrefix: "",
    strictStatusCodes: true,
  }
);
