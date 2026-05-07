/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  ApiErrorSchema,
  PaginationFieldsSchema,
  PaginationQuerySchema,
} from "./common";

const c = initContract();

const CasteEnum = z
  .enum(["military", "food", "magic"])
  .nullable()
  .describe("Player's chosen caste, or null before assignment");

const PhaseEnum = z
  .enum(["onboarding", "active", "eliminated"])
  .describe("Current game phase for the player");

const LeaderRowSchema = z
  .object({
    userId: z.string(),
    displayName: z.string(),
    caste: CasteEnum,
    phase: PhaseEnum,
    tilesHeld: z.number().int().nonnegative(),
    unitsAlive: z.number().int().nonnegative(),
    attacksWon: z.number().int().nonnegative(),
    attacksLost: z.number().int().nonnegative(),
  })
  .openapi("GameLeaderboardRow", {
    description: "One row of the game leaderboard.",
    example: {
      userId: "abc123",
      displayName: "Sun Tzu",
      caste: "military",
      phase: "active",
      tilesHeld: 42,
      unitsAlive: 280,
      attacksWon: 9,
      attacksLost: 2,
    },
  });

const LeaderboardSuccessSchema = z
  .object({
    success: z.literal(true),
    players: z.array(LeaderRowSchema),
  })
  .merge(PaginationFieldsSchema)
  .openapi("GameLeaderboardResponse");

export const gameContract = c.router(
  {
    getLeaderboard: {
      method: "GET",
      path: "/api/game/leaderboard",
      summary: "Get the leaderboard ranked by tiles held",
      description:
        "Returns players ranked by `stats.tilesHeld` descending. Cursor-paginated; default page size is 20 (max 100).",
      query: PaginationQuerySchema,
      responses: {
        200: LeaderboardSuccessSchema,
        401: ApiErrorSchema.openapi({
          description: "Missing or invalid Firebase ID token",
        }),
        500: ApiErrorSchema,
      },
      metadata: {
        // Documents which ErrorCode values this route can return so the spec
        // surfaces them per-endpoint per AC #3 in issue #234.
        errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const,
      },
    },
  },
  {
    pathPrefix: "",
    strictStatusCodes: true,
  }
);
