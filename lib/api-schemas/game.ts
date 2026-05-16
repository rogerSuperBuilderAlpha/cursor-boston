/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Game-area API contracts. The strategy game has elaborate Firestore
 * document shapes (GamePlayer, GameTile, GameAttack, GameArtifact,
 * TurnReport) — modelling those in full zod is a separate effort. For
 * now, response payloads use skeletal `passthrough` shapes that capture
 * the well-known top-level keys; future PRs can deepen them.
 *
 * Input validation is fully strict (zod parses every body / query / path
 * param), so this PR meaningfully replaces the ad-hoc `parseRequestBody`
 * + manual type-narrowing patterns across the 23 game route handlers.
 */

import { initContract } from "@ts-rest/core";
import { z } from "zod";

import {
  ApiErrorSchema,
  PaginationFieldsSchema,
  PaginationQuerySchema,
} from "./common";

const c = initContract();

// ──────────────────── Shared atom schemas ────────────────────

const CasteEnum = z.enum(["military", "food", "magic"]);
const SetupCasteEnum = z.enum(["black", "red", "white", "green", "blue"]);
const PhaseEnum = z.enum(["onboarding", "active", "eliminated"]);
const LandTypeEnum = z.enum([
  "military",
  "food",
  "magic",
  "unassigned",
]);
const UnitTypeEnum = z.enum(["ground", "siege", "air"]);
const AttackSideEnum = z.enum(["sent", "received", "all"]);
const LeaderboardAudienceEnum = z.enum(["all", "npc", "real"]);

const UnitStackSchema = z.object({
  ground: z.number().int().nonnegative(),
  siege: z.number().int().nonnegative(),
  air: z.number().int().nonnegative(),
});

// ──────────────────── Skeletal entity shapes ────────────────────
// `passthrough()` so additional fields aren't a contract violation —
// these schemas describe the *known* fields that callers depend on,
// without pretending to be exhaustive Firestore document mirrors.

const GamePlayerSchema = z
  .object({
    userId: z.string(),
    displayName: z.string().nullable().optional(),
    caste: CasteEnum.nullable().optional(),
    phase: PhaseEnum.optional(),
    stats: z
      .object({
        tilesHeld: z.number().int().nonnegative(),
        unitsAlive: z.number().int().nonnegative(),
        attacksWon: z.number().int().nonnegative(),
        attacksLost: z.number().int().nonnegative(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough()
  .openapi("GamePlayer", {
    description:
      "Player document. Fields beyond those listed here exist (turn budget, spell inventory, etc.) — see `lib/game/types.ts` for the canonical interface.",
  });

const GameTileSchema = z
  .object({
    id: z.string().optional(),
    q: z.number().int(),
    r: z.number().int(),
    type: LandTypeEnum.optional(),
    ownerId: z.string().nullable().optional(),
    units: UnitStackSchema.optional(),
  })
  .passthrough()
  .openapi("GameTile", {
    description:
      "Hex tile on the world map. `q`/`r` are axial coordinates. Additional fields (capacity, upgrades, armed defense spell, etc.) exist on the canonical type.",
  });

const GameAttackSchema = z
  .object({
    id: z.string().optional(),
    attackerId: z.string(),
    defenderId: z.string(),
    targetTileId: z.string(),
    sourceTileIds: z.array(z.string()),
    unitsSent: UnitStackSchema,
    unitsLostAttacker: UnitStackSchema,
    unitsLostDefender: UnitStackSchema,
    outcome: z.string(),
    turnsCost: z.number().int().nonnegative(),
    casteAttacker: CasteEnum,
    casteDefender: CasteEnum,
    offenseSpellId: z.string().nullable(),
    defenseSpellId: z.string().nullable(),
  })
  .passthrough()
  .openapi("GameAttack");

const GameArtifactSchema = z
  .object({
    id: z.string(),
    ownerId: z.string(),
    definitionId: z.string(),
    rarity: z.enum(["common", "rare", "epic", "legendary"]),
    type: z.enum(["offense", "defense", "production", "utility"]),
    foundAtTurn: z.number().int(),
    used: z.boolean(),
  })
  .passthrough()
  .openapi("GameArtifact");

const TurnReportSchema = z
  .object({})
  .passthrough()
  .openapi("GameTurnReport", {
    description:
      "Per-action turn report. Shape varies by action type — see `lib/game/turn-report.ts` for the discriminated union.",
  });

// Mirrors `CombatResult` from `lib/game/types.ts`. Returned alongside the
// TurnReport on attack responses so the client can render a structured
// battle readout (RNG rolls, supply ×, applied spells, intel-passive flags,
// per-unit-type loss breakdowns). Optional on the response so older clients
// that ignore it remain compatible.
const CombatResultSchema = z
  .object({
    outcome: z.string(),
    unitsDeployed: UnitStackSchema,
    unitsClampedFromCapacity: z.number().int().nonnegative(),
    attackPower: z.number(),
    defensePower: z.number(),
    attackerLosses: UnitStackSchema,
    defenderLosses: UnitStackSchema,
    underdogApplied: z.boolean(),
    supplyMultiplier: z.number(),
    rng: z.object({
      attackerRoll: z.number(),
      defenderRoll: z.number(),
    }),
    appliedSpells: z.object({
      offenseId: z.string().nullable(),
      defenseId: z.string().nullable(),
    }),
    airIntel: z
      .object({
        sourcePassive: z.string(),
        defenseSpellTier: z.number().int().optional(),
        weakFace: UnitTypeEnum.optional(),
        forgeScoutsBonusApplied: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough()
  .openapi("GameCombatResult");

// ──────────────────── Common response wrappers ────────────────────

const PlayerOkResponse = z.object({
  success: z.literal(true),
  player: GamePlayerSchema,
});

const PlayerTileOkResponse = z.object({
  success: z.literal(true),
  player: GamePlayerSchema,
  tile: GameTileSchema,
});

const ActionOkResponse = z.object({
  success: z.literal(true),
  player: GamePlayerSchema,
  tile: GameTileSchema.optional(),
  report: TurnReportSchema.optional(),
  reports: z.array(TurnReportSchema).optional(),
  stoppedEarly: z.boolean().optional(),
});

const BulkActionOkResponse = z.object({
  success: z.literal(true),
  player: GamePlayerSchema,
  tiles: z.array(GameTileSchema),
  reports: z.array(TurnReportSchema),
  stoppedEarly: z.boolean().optional(),
});

// ──────────────────── List response schemas ────────────────────

const LeaderRowSchema = z
  .object({
    userId: z.string(),
    displayName: z.string(),
    caste: CasteEnum.nullable(),
    phase: PhaseEnum,
    tilesHeld: z.number().int().nonnegative(),
    unitsAlive: z.number().int().nonnegative(),
    attacksWon: z.number().int().nonnegative(),
    attacksLost: z.number().int().nonnegative(),
  })
  .openapi("GameLeaderboardRow", {
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

const LeaderboardOk = z
  .object({
    success: z.literal(true),
    players: z.array(LeaderRowSchema),
  })
  .merge(PaginationFieldsSchema);

const AttacksOk = z
  .object({
    success: z.literal(true),
    attacks: z.array(GameAttackSchema),
  })
  .merge(PaginationFieldsSchema);

const ArtifactsOk = z
  .object({
    success: z.literal(true),
    artifacts: z.array(GameArtifactSchema),
  })
  .merge(PaginationFieldsSchema);

// ──────────────────── Body schemas ────────────────────

const AdminGrantBody = z
  .object({
    userId: z.string().optional(),
    weekStartIso: z.string().optional(),
  })
  .openapi("GameAdminGrantBody");

const AdminUnitsBody = z
  .object({
    ownerId: z.string().optional(),
    tileId: z.string().optional(),
    unitType: UnitTypeEnum.optional(),
    count: z.number().int().positive().optional(),
  })
  .openapi("GameAdminUnitsBody");

const ArtifactUseBody = z
  .object({
    artifactId: z.string().min(1),
    targetTileId: z.string().optional(),
  })
  .openapi("GameArtifactUseBody");

const AttackBody = z
  .object({
    sourceTileId: z.string().min(1),
    targetTileId: z.string().min(1),
    units: UnitStackSchema,
    offenseSpellId: z.string().nullish(),
    // Heroes (May 2026). What to do with the defender's hero on a winning
    // combat. Ignored when the target tile has no hero. Default: "kill"
    // (preserves legacy behavior). "convert" requires the hero to be at
    // or below STAMINA_CONVERSION_THRESHOLD; if the convert roll fails,
    // `heroActionOnConvertFail` is applied as the fallback.
    heroAction: z.enum(["kill", "spare", "convert"]).optional(),
    heroActionOnConvertFail: z.enum(["kill", "spare"]).optional(),
  })
  .openapi("GameAttackBody");

// Same shape as AttackBody — preview reuses the same input but never
// deducts turns or writes state. Validation rules are softer: cap-overflow
// and insufficient-units are reported in the response, not thrown.
const AttackPreviewBody = AttackBody.openapi("GameAttackPreviewBody");

const SiegeBody = z
  .object({
    sourceTileId: z.string().min(1),
    targetTileId: z.string().min(1),
  })
  .openapi("GameSiegeBody");

// Heroes (May 2026): caste-themed special unit station / recall. Tied to
// a SpecialUnitInstance held in the player's pool.
const SpecialUnitSummonBody = z
  .object({
    instanceId: z.string().min(1),
    targetTileId: z.string().min(1),
  })
  .openapi("GameSpecialUnitSummonBody");

const SpecialUnitUnsummonBody = z
  .object({
    instanceId: z.string().min(1),
  })
  .openapi("GameSpecialUnitUnsummonBody");

const FlyoverBody = z
  .object({
    sourceTileId: z.string().min(1),
    targetTileId: z.string().min(1),
    // Air units only. Server enforces ground/siege == 0; we keep the full
    // UnitStack shape to share validation with the attack call site.
    units: UnitStackSchema,
  })
  .openapi("GameFlyoverBody");

const CastSpellBody = z
  .object({
    spellId: z.string().min(1),
    sourceTileId: z.string().min(1),
    targetTileId: z.string().min(1),
  })
  .openapi("GameCastSpellBody");

// Aggregated active prep-effect summary surfaced to the sim panel. Mirrors
// readAttackContextEffects' shape but with display-friendly fields. All
// magnitudes are zero (and `count` zero) when no effects of that kind apply.
const AttackPreviewEffectsSchema = z
  .object({
    forgeSightOffenseBonus: z.number(),
    alertVsCasterDefenseBonus: z.number(),
    siegeDebuffMagnitude: z.number(),
    preCastOffenseBonus: z.number(),
    defenseDisarmFraction: z.number(),
  })
  .openapi("GameAttackPreviewEffects");

const BuildBody = z
  .object({
    tileId: z.string().min(1),
    unitType: UnitTypeEnum,
    count: z.number().int().positive().optional(),
  })
  .openapi("GameBuildBody");

const BuildBulkBody = z
  .object({
    plan: z
      .array(
        z.object({
          tileId: z.string().min(1),
          unitType: UnitTypeEnum,
          cycles: z.number().int().positive(),
        })
      )
      .min(1),
  })
  .openapi("GameBuildBulkBody");

const DistributeBulkBody = z
  .object({
    tileIds: z.array(z.string().min(1)).min(1),
    type: LandTypeEnum,
  })
  .openapi("GameDistributeBulkBody");

const ExploreBody = z
  .object({
    count: z.number().int().positive().optional(),
  })
  .openapi("GameExploreBody");

const ExploreBulkBody = z
  .object({
    count: z.number().int().positive(),
  })
  .openapi("GameExploreBulkBody");

const PlayerCreateBody = z
  .object({
    displayName: z.string().min(1),
  })
  .openapi("GamePlayerCreateBody");

const PlayerRenameBody = PlayerCreateBody.openapi("GamePlayerRenameBody");

const RolloverQuery = z.object({
  weekStartIso: z.string().optional(),
});

const NpcWeeklyQuery = z.object({
  weekStartIso: z.string().optional(),
  // "1" enables a no-write planning pass (used by the workflow's manual
  // dispatch input).
  dryRun: z.string().optional(),
  // Optional limit on number of NPCs processed (for incremental backfills).
  limit: z.string().optional(),
});

const SetupCasteBody = z
  .object({ caste: SetupCasteEnum })
  .openapi("GameSetupCasteBody");

const SetupDistributeBody = z
  .object({
    tileId: z.string().min(1),
    type: LandTypeEnum,
    count: z.number().int().positive(),
  })
  .openapi("GameSetupDistributeBody");

const SetupExploreBody = ExploreBody.openapi("GameSetupExploreBody");

// Spell-arm has two modes: single (tileId) or bulk (tileIds). The handler
// picks the bulk path when `tileIds` is present.
const SpellArmBody = z
  .object({
    spellId: z.string().min(1),
    tileId: z.string().optional(),
    tileIds: z.array(z.string().min(1)).optional(),
    count: z.number().int().positive().optional(),
  })
  .refine(
    (v) => Boolean(v.tileId) || (Array.isArray(v.tileIds) && v.tileIds.length > 0),
    { message: "Provide either `tileId` (single) or `tileIds` (bulk)" }
  )
  .openapi("GameSpellArmBody");

const SpellArmBulkOk = z.object({
  success: z.literal(true),
  player: GamePlayerSchema.nullable(),
  armed: z.number().int().nonnegative(),
  failed: z.array(z.object({ tileId: z.string(), reason: z.string() })),
  reports: z.array(TurnReportSchema),
});

const SpellProduceBody = z
  .object({
    spellId: z.string().min(1),
    count: z.number().int().positive().optional(),
  })
  .openapi("GameSpellProduceBody");

const TileParam = z.object({ tileId: z.string().min(1) });

const UpgradesApplyBody = z
  .object({
    targetId: z.string().min(1),
    upgradeId: z.string().min(1),
  })
  .openapi("GameUpgradesApplyBody");

const UpgradesRemoveBody = z
  .object({
    targetId: z.string().min(1),
  })
  .openapi("GameUpgradesRemoveBody");

// Community feed + chat schemas. Denormalized at write-time so the
// renderer doesn't need to join against game_players.
const CommunityEventKindEnum = z.enum([
  "player_join",
  "caste_pick",
  "caste_change",
  "attack",
  "milestone_1k_tiles",
]);
const AttackOutcomeEnum = z.enum(["captured", "repelled", "stalemate"]);

const CommunityEventSchema = z
  .object({
    id: z.string(),
    kind: CommunityEventKindEnum,
    actorUserId: z.string(),
    actorDisplayName: z.string(),
    actorCaste: SetupCasteEnum.nullable(),
    targetUserId: z.string().optional(),
    targetDisplayName: z.string().optional(),
    tileId: z.string().optional(),
    outcome: AttackOutcomeEnum.optional(),
    fromCaste: SetupCasteEnum.optional(),
    toCaste: SetupCasteEnum.optional(),
  })
  .passthrough()
  .openapi("GameCommunityEvent");

const CommunityMessageSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    displayName: z.string(),
    caste: SetupCasteEnum.nullable(),
    body: z.string(),
    deletedByAdmin: z.boolean().optional(),
  })
  .passthrough()
  .openapi("GameCommunityMessage");

const WorldQuery = z
  .object({
    qMin: z.string().regex(/^-?\d+$/).optional(),
    qMax: z.string().regex(/^-?\d+$/).optional(),
    rMin: z.string().regex(/^-?\d+$/).optional(),
    rMax: z.string().regex(/^-?\d+$/).optional(),
  })
  .openapi("GameWorldQuery");

const WorldOk = z.object({
  success: z.literal(true),
  tiles: z.array(GameTileSchema),
  owners: z
    .array(z.object({}).passthrough())
    .optional()
    .describe("Legacy mode only — present when the request omits a bbox"),
});

// ──────────────────── Contract router ────────────────────

const baseErrorResponses = {
  401: ApiErrorSchema.openapi({
    description: "Missing or invalid Firebase ID token",
  }),
  500: ApiErrorSchema,
} as const;

const actionErrorResponses = {
  ...baseErrorResponses,
  400: ApiErrorSchema.openapi({
    description:
      "Validation error or game-rules violation (insufficient turns, invalid target, etc.)",
  }),
} as const;

const adminErrorResponses = {
  ...actionErrorResponses,
  403: ApiErrorSchema.openapi({ description: "Admin access required" }),
} as const;

export const gameContract = c.router(
  {
    // List endpoints (already paginated as of #241)
    getLeaderboard: {
      method: "GET",
      path: "/api/game/leaderboard",
      summary: "Get the leaderboard ranked by tiles held",
      description:
        "Returns players ranked by `stats.tilesHeld` descending. Cursor-paginated; default page size is 20 (max 100). `audience` filters to `npc`, `real`, or `all` (default).",
      query: PaginationQuerySchema.extend({
        audience: LeaderboardAudienceEnum.optional(),
      }),
      responses: { 200: LeaderboardOk, ...baseErrorResponses },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    getAttacks: {
      method: "GET",
      path: "/api/game/attacks",
      summary: "List the player's attacks (sent/received/all)",
      description:
        "Cursor-paginated when `side=sent` or `side=received`. `side=all` merges the two views in memory and is bounded at 500 per side.",
      query: PaginationQuerySchema.extend({ side: AttackSideEnum.optional() }),
      responses: { 200: AttacksOk, ...baseErrorResponses },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    getArtifacts: {
      method: "GET",
      path: "/api/game/artifacts",
      summary: "List the player's artifact inventory",
      query: PaginationQuerySchema,
      responses: { 200: ArtifactsOk, ...baseErrorResponses },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },

    // Player lifecycle
    getPlayer: {
      method: "GET",
      path: "/api/game/player",
      summary: "Get the current user's game profile + visible tiles",
      responses: {
        200: z.object({
          success: z.literal(true),
          player: GamePlayerSchema.nullable(),
          tiles: z.array(GameTileSchema),
          isAdmin: z.boolean(),
        }),
        ...baseErrorResponses,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    createPlayer: {
      method: "POST",
      path: "/api/game/player",
      summary: "Create the current user's game profile",
      body: PlayerCreateBody,
      responses: {
        201: z.object({
          success: z.literal(true),
          player: GamePlayerSchema,
          tileIds: z.array(z.string()),
        }),
        ...actionErrorResponses,
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "VALIDATION_ERROR",
          "CONFLICT",
          "SERVER_ERROR",
        ] as const,
      },
    },
    renamePlayer: {
      method: "PATCH",
      path: "/api/game/player",
      summary: "Rename the current user's general (display name)",
      body: PlayerRenameBody,
      responses: { 200: PlayerOkResponse, ...actionErrorResponses },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },

    // World / tile
    getWorld: {
      method: "GET",
      path: "/api/game/world",
      summary: "Fetch tiles for the world map (full or bbox)",
      description:
        "When `qMin`/`qMax`/`rMin`/`rMax` are all provided, returns tiles within that axial bounding box. Otherwise returns the full visible world (legacy mode).",
      query: WorldQuery,
      responses: { 200: WorldOk, ...baseErrorResponses },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    getMyMap: {
      method: "GET",
      path: "/api/game/map/me",
      summary: "Get the current user's personal map view (own tiles + enemy ring)",
      description:
        "Returns the user's owned tiles plus the enemy-owned border ring touching them, with owner summaries for those enemies. Read cost scales with kingdom perimeter rather than world size.",
      responses: {
        200: z.object({
          success: z.literal(true),
          myTiles: z.array(GameTileSchema),
          borderTiles: z.array(GameTileSchema),
          owners: z.array(z.object({}).passthrough()),
        }),
        ...baseErrorResponses,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    getTile: {
      method: "GET",
      path: "/api/game/tile/:tileId",
      pathParams: TileParam,
      summary: "Get a single tile by id",
      responses: {
        200: z.object({
          success: z.literal(true),
          tile: GameTileSchema,
        }),
        404: ApiErrorSchema.openapi({ description: "Tile not found" }),
        ...baseErrorResponses,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "NOT_FOUND", "SERVER_ERROR"] as const,
      },
    },
    getEligibility: {
      method: "GET",
      path: "/api/game/eligibility",
      summary: "Get the current user's game eligibility state",
      responses: {
        200: z
          .object({ success: z.literal(true) })
          .passthrough()
          .openapi("GameEligibility", {
            description:
              "Eligibility flags (whether onboarding is complete, current week, allowed actions). Shape mirrors `lib/game/eligibility.ts`.",
          }),
        ...baseErrorResponses,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },

    // Setup phase
    setupCaste: {
      method: "POST",
      path: "/api/game/setup/caste",
      summary: "Choose initial caste during onboarding",
      body: SetupCasteBody,
      responses: { 200: PlayerOkResponse, ...actionErrorResponses },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "VALIDATION_ERROR",
          "CONFLICT",
          "SERVER_ERROR",
        ] as const,
      },
    },
    changeCaste: {
      method: "POST",
      path: "/api/game/caste/change",
      summary: "Switch castes (one-time, after reaching 1000 tiles)",
      description:
        "Allows a single permanent caste change once `stats.tilesHeld >= 1000`. The first caste pick is treated as experimental; this endpoint flips the player to a new caste and increments `casteChangesUsed` to 1. Subsequent attempts return CONFLICT.",
      body: SetupCasteBody,
      responses: { 200: PlayerOkResponse, ...actionErrorResponses },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "VALIDATION_ERROR",
          "CONFLICT",
          "SERVER_ERROR",
        ] as const,
      },
    },
    setupDistribute: {
      method: "POST",
      path: "/api/game/setup/distribute",
      summary: "Distribute land type to a tile during onboarding",
      body: SetupDistributeBody,
      responses: { 200: ActionOkResponse, ...actionErrorResponses },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
    setupExplore: {
      method: "POST",
      path: "/api/game/setup/explore",
      summary: "Frontier-explore tiles during onboarding",
      body: SetupExploreBody,
      responses: { 200: ActionOkResponse, ...baseErrorResponses },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },

    // In-game actions
    explore: {
      method: "POST",
      path: "/api/game/explore",
      summary: "Frontier-explore one or more new tiles",
      body: ExploreBody,
      responses: {
        200: ActionOkResponse.extend({
          frontier: z.object({}).passthrough().optional(),
        }),
        ...baseErrorResponses,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    farExpedition: {
      method: "POST",
      path: "/api/game/explore/far",
      summary:
        "Spend 2 turns to plant a tile adjacent to a random enemy tile (Far Expedition).",
      body: z.object({}).optional(),
      responses: {
        200: ActionOkResponse.extend({
          targetEnemyTileId: z.string(),
          // Returned so the client can patch its local map cache and have
          // the threat box reflect the new bordering general without a
          // full reload. Null only if the enemy tile was somehow not
          // captured during selection (defensive — should not happen).
          enemyTile: GameTileSchema.nullable(),
        }),
        ...baseErrorResponses,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    spy: {
      method: "POST",
      path: "/api/game/spy",
      summary: "Cast an intel ('spy') spell on an enemy tile.",
      body: z.object({
        spellId: z.string().min(1),
        targetTileId: z.string().min(1),
      }),
      responses: {
        200: ActionOkResponse.extend({
          intelReport: z.object({}).passthrough(),
          detected: z.boolean(),
        }),
        ...actionErrorResponses,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
    exploreBulk: {
      method: "POST",
      path: "/api/game/explore/bulk",
      summary: "Bulk frontier-explore (count required)",
      body: ExploreBulkBody,
      responses: {
        200: BulkActionOkResponse.extend({
          frontiers: z.array(z.object({}).passthrough()),
        }),
        ...actionErrorResponses,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
    build: {
      method: "POST",
      path: "/api/game/build",
      summary: "Build units on a tile",
      body: BuildBody,
      responses: {
        200: ActionOkResponse.extend({
          produced: z.number().int().nonnegative(),
        }),
        ...actionErrorResponses,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
    buildBulk: {
      method: "POST",
      path: "/api/game/build/bulk",
      summary: "Execute a bulk build plan across tiles",
      body: BuildBulkBody,
      responses: {
        200: BulkActionOkResponse.extend({
          produced: z.number().int().nonnegative(),
        }),
        ...actionErrorResponses,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
    distributeBulk: {
      method: "POST",
      path: "/api/game/distribute/bulk",
      summary: "Distribute one land type across multiple tiles",
      body: DistributeBulkBody,
      responses: { 200: BulkActionOkResponse, ...actionErrorResponses },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
    attack: {
      method: "POST",
      path: "/api/game/attack",
      summary: "Launch an attack from one of your tiles",
      body: AttackBody,
      responses: {
        200: z.object({
          success: z.literal(true),
          attack: GameAttackSchema,
          attackerPlayer: GamePlayerSchema,
          sourceTile: GameTileSchema,
          targetTile: GameTileSchema,
          report: TurnReportSchema,
          combat: CombatResultSchema.optional(),
          intelReport: z.object({}).passthrough().optional(),
        }),
        ...actionErrorResponses,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
    attackPreview: {
      method: "POST",
      path: "/api/game/attack/preview",
      summary: "Project the outcome of a hypothetical attack",
      description:
        "Runs the same combat math as `/api/game/attack` but with a fixed midpoint RNG seed and no writes / turn deduction. The resulting CombatResult is the 'expected' outcome a player would see if they swung now with the supplied stack. Active prep effects (siege, pre-cast, disarm, forge-sight, alert) are also reflected.",
      body: AttackPreviewBody,
      responses: {
        200: z.object({
          success: z.literal(true),
          combat: CombatResultSchema,
          source: GameTileSchema,
          target: GameTileSchema,
          defender: z.object({
            userId: z.string(),
            displayName: z.string(),
            caste: CasteEnum.nullable(),
            shielded: z.boolean(),
          }),
          effects: AttackPreviewEffectsSchema,
        }),
        ...actionErrorResponses,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
    siege: {
      method: "POST",
      path: "/api/game/siege",
      summary: "Soften a target tile's standing-defense floor",
      description:
        "Costs 5 turns. Records a `siege-debuff` IntelEffect on the target with magnitude `SIEGE_ACTION_MAGNITUDE` (0.10) and a 5-attacker-turn TTL. Stacks across calls until SIEGE_DEBUFF_MAX_MAGNITUDE (0.30). Source must be owned and adjacent to target.",
      body: SiegeBody,
      responses: {
        200: z.object({
          success: z.literal(true),
          player: GamePlayerSchema,
          report: TurnReportSchema,
          // Total siege debuff currently applied to the target after this
          // siege (capped at SIEGE_DEBUFF_MAX_MAGNITUDE).
          siegeTotalMagnitude: z.number(),
        }),
        ...actionErrorResponses,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
    flyover: {
      method: "POST",
      path: "/api/game/flyover",
      summary: "Air raid that attrits defenders without taking the tile",
      description:
        "Air-only attack with the capture branch disabled. Always resolves to 'repelled' or 'stalemate'; tile ownership never changes. Attacker losses are doubled (`2× resolveAttack` losses, clamped to deployed) — a deliberate suicide-mission trade. Costs `ATTACK_TURN_COST` (1 turn).",
      body: FlyoverBody,
      responses: {
        200: z.object({
          success: z.literal(true),
          attackerPlayer: GamePlayerSchema,
          sourceTile: GameTileSchema,
          targetTile: GameTileSchema,
          report: TurnReportSchema,
          combat: CombatResultSchema,
        }),
        ...actionErrorResponses,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
    castSpell: {
      method: "POST",
      path: "/api/game/spell/cast",
      summary:
        "Cast a standalone siege/disarm/attrition spell against a target tile",
      description:
        "Dispatches on the spell's `type`. Each kind rolls dice once (SPELL_RNG band 0.5–1.5) and either persists an IntelEffect (siege, disarm) or commits unit losses immediately (attrition). Validates ownership + adjacency + non-shield + caste-match + tier tile-min + turn budget.",
      body: CastSpellBody,
      responses: {
        200: z.object({
          success: z.literal(true),
          player: GamePlayerSchema,
          report: TurnReportSchema,
          // Kind-specific outcome payload. All optional so each kind can
          // populate the slice it cares about.
          siege: z
            .object({
              magnitudeApplied: z.number(),
              totalMagnitudeAfter: z.number(),
            })
            .optional(),
          disarm: z
            .object({
              fractionApplied: z.number(),
            })
            .optional(),
          attrition: z
            .object({
              unitsKilled: UnitStackSchema,
              targetTile: GameTileSchema,
            })
            .optional(),
        }),
        ...actionErrorResponses,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
    artifactUse: {
      method: "POST",
      path: "/api/game/artifact/use",
      summary: "Spend an artifact (optionally on a target tile)",
      body: ArtifactUseBody,
      responses: {
        200: z.object({
          success: z.literal(true),
          artifact: GameArtifactSchema,
          intelReport: z.object({}).passthrough().optional(),
        }),
        ...actionErrorResponses,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
    spellArm: {
      method: "POST",
      path: "/api/game/spell/arm",
      summary: "Arm a defense spell on one tile (single) or many (bulk)",
      description:
        "Pass `tileId` for single mode or `tileIds` for bulk mode. Bulk returns per-tile success/failure.",
      body: SpellArmBody,
      responses: {
        200: z
          .union([ActionOkResponse, SpellArmBulkOk])
          .openapi("GameSpellArmResponse"),
        ...actionErrorResponses,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
    spellProduce: {
      method: "POST",
      path: "/api/game/spell/produce",
      summary: "Cast a production spell (with optional batch count)",
      body: SpellProduceBody,
      responses: { 200: ActionOkResponse, ...actionErrorResponses },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
    upgradesApply: {
      method: "POST",
      path: "/api/game/upgrades/apply",
      summary: "Apply an upgrade to a target",
      body: UpgradesApplyBody,
      responses: { 200: PlayerOkResponse, ...actionErrorResponses },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
    upgradesRemove: {
      method: "POST",
      path: "/api/game/upgrades/remove",
      summary: "Remove an upgrade from a target",
      body: UpgradesRemoveBody,
      responses: { 200: PlayerOkResponse, ...actionErrorResponses },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },

    // Heroes (May 2026): caste-themed special-unit station / recall.
    specialUnitsSummon: {
      method: "POST",
      path: "/api/game/special-units/summon",
      summary: "Station a caste-themed special unit on one of your tiles",
      body: SpecialUnitSummonBody,
      responses: {
        200: z.object({
          success: z.literal(true),
          player: GamePlayerSchema,
          tileId: z.string(),
        }),
        ...actionErrorResponses,
      },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },
    specialUnitsUnsummon: {
      method: "POST",
      path: "/api/game/special-units/unsummon",
      summary: "Recall a stationed special unit back into your pool",
      body: SpecialUnitUnsummonBody,
      responses: { 200: PlayerOkResponse, ...actionErrorResponses },
      metadata: {
        errorCodes: ["UNAUTHORIZED", "VALIDATION_ERROR", "SERVER_ERROR"] as const,
      },
    },

    // Cron + admin
    rollover: {
      method: "POST",
      path: "/api/game/rollover",
      summary: "Cron-only weekly turn-grant rollover",
      description:
        "Authenticated by an `x-rollover-secret` header rather than Firebase Auth. Idempotent for a given `weekStartIso`.",
      query: RolloverQuery,
      body: z.object({}).optional(),
      responses: {
        200: z.object({
          success: z.literal(true),
          summary: z.object({}).passthrough(),
        }),
        403: ApiErrorSchema.openapi({
          description: "Missing/invalid rollover secret",
        }),
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["FORBIDDEN", "SERVER_ERROR"] as const },
    },
    npcWeekly: {
      method: "POST",
      path: "/api/game/npc-weekly",
      summary: "Cron-only weekly NPC turn-spender",
      description:
        "Authenticated by the same `x-rollover-secret` header used by the human rollover. Iterates every NPC, applies the weekly grant, and spends ~all 100 turns per persona-driven action plan. Idempotent for a given `weekStartIso`.",
      query: NpcWeeklyQuery,
      body: z.object({}).optional(),
      responses: {
        200: z.object({
          success: z.literal(true),
          summary: z.object({}).passthrough(),
        }),
        403: ApiErrorSchema.openapi({
          description: "Missing/invalid rollover secret",
        }),
        500: ApiErrorSchema,
      },
      metadata: { errorCodes: ["FORBIDDEN", "SERVER_ERROR"] as const },
    },
    adminGrant: {
      method: "POST",
      path: "/api/game/admin/grant",
      summary: "Admin: grant turns to a user (testing helper)",
      body: AdminGrantBody,
      responses: { 200: PlayerOkResponse, ...adminErrorResponses },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "FORBIDDEN",
          "VALIDATION_ERROR",
          "SERVER_ERROR",
        ] as const,
      },
    },
    adminUnits: {
      method: "POST",
      path: "/api/game/admin/units",
      summary: "Admin: drop units on a tile (bootstrap helper)",
      body: AdminUnitsBody,
      responses: { 200: PlayerTileOkResponse, ...adminErrorResponses },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "FORBIDDEN",
          "VALIDATION_ERROR",
          "SERVER_ERROR",
        ] as const,
      },
    },

    // Community feed + chat — append-only event log + global chat board
    // surfaced in the dashboard's CommunityPanel.
    getCommunityFeed: {
      method: "GET",
      path: "/api/game/community/feed",
      summary: "Recent community events (player joins, caste picks, attacks)",
      description:
        "Returns the most recent 50 community-events ordered by createdAt desc. CDN-cached for ~30s.",
      query: z.object({}).optional(),
      responses: {
        200: z.object({
          success: z.literal(true),
          events: z.array(CommunityEventSchema),
        }),
        ...baseErrorResponses,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    getCommunityChat: {
      method: "GET",
      path: "/api/game/community/chat",
      summary: "Recent community chat messages",
      description:
        "Returns the most recent 50 non-deleted chat messages ordered by createdAt desc.",
      query: z.object({}).optional(),
      responses: {
        200: z.object({
          success: z.literal(true),
          messages: z.array(CommunityMessageSchema),
        }),
        ...baseErrorResponses,
      },
      metadata: { errorCodes: ["UNAUTHORIZED", "SERVER_ERROR"] as const },
    },
    postCommunityChat: {
      method: "POST",
      path: "/api/game/community/chat",
      summary: "Post a chat message (rate-limited: 10 / 60s per user)",
      body: z.object({
        body: z.string().min(1).max(500),
      }),
      responses: {
        200: z.object({
          success: z.literal(true),
          message: CommunityMessageSchema,
        }),
        429: ApiErrorSchema.openapi({
          description: "Rate-limited; retry-after in body",
        }),
        ...actionErrorResponses,
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
    deleteCommunityChat: {
      method: "DELETE",
      path: "/api/game/community/chat/:messageId",
      summary: "Delete a chat message (own or admin)",
      description:
        "Soft-delete: sets deletedAt + deletedByAdmin. Author can delete their own; admins can delete any.",
      pathParams: z.object({ messageId: z.string().min(1) }),
      body: z.object({}).optional(),
      responses: {
        200: z.object({
          success: z.literal(true),
          message: CommunityMessageSchema,
        }),
        403: ApiErrorSchema.openapi({
          description: "Not the author and not an admin",
        }),
        404: ApiErrorSchema.openapi({ description: "Message not found" }),
        ...baseErrorResponses,
      },
      metadata: {
        errorCodes: [
          "UNAUTHORIZED",
          "FORBIDDEN",
          "NOT_FOUND",
          "SERVER_ERROR",
        ] as const,
      },
    },
  },
  {
    pathPrefix: "",
    strictStatusCodes: true,
  }
);
