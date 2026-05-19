/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import {
  GameAlreadyRevealedError,
  GameArmageddonInProgressError,
  GameArtifactAlreadyUsedError,
  GameArtifactNotFoundError,
  GameCasteAlreadySetError,
  GameCasteChangeUnavailableError,
  GameFrontierExhaustedError,
  GameInsufficientTurnsError,
  GameInsufficientUnitsError,
  GameInvalidCasteError,
  GameInvalidLandTypeError,
  GameInvalidNameError,
  GameInvalidPhaseError,
  GameInvalidSpellError,
  GameInscriptionTooLongError,
  GameNameTakenError,
  GameNoEnemyKingdomsError,
  GamePlayerBioTooLongError,
  GameNoUnrevealedTilesError,
  GameNotAdjacentError,
  GamePlayerAlreadyExistsError,
  GamePlayerNotFoundError,
  GameSealsExhaustedError,
  GameSelfAttackError,
  GameShieldedError,
  GameSpecialUnitAlreadyStationedError,
  GameSpecialUnitNotFoundError,
  GameStaleSeasonError,
  GameTileFullError,
  GameTileNotFoundError,
  GameTileNotOwnedError,
  GameTileTypeError,
  GameTileUnrevealedError,
  GameUnitCapExceededError,
  // Zero-turn gameplay errors
  GameDefensiveStanceBlockedError,
  GameDefensiveStanceCapError,
  GameDefensiveStanceLockedError,
  GameHeroAlreadyMeditatingError,
  GameHeroNotFoundError,
  GameHeroNotOwnedError,
  GameLastStandCooldownError,
  GameLastStandNoThreatError,
  GameLastStandRequiresZeroTurnsError,
  GameMeditationSlotFullError,
  GamePepTalkRequiresZeroTurnsError,
  GameRedistributeRateLimitError,
} from "./data-server";
import {
  UpgradeAlreadyActiveError,
  UpgradeNotActiveError,
  UpgradeNotFoundError,
  UpgradeUnknownTargetError,
  UpgradeWrongCasteError,
} from "./upgrades";
import {
  QueuedOrderForbiddenError,
  QueuedOrderInvalidParamsError,
  QueuedOrderNotFoundError,
  QueuedOrderQueueFullError,
} from "./orders";

export function mapGameError(error: unknown): NextResponse {
  if (
    error instanceof GamePlayerNotFoundError ||
    error instanceof GameTileNotFoundError ||
    error instanceof GameArtifactNotFoundError ||
    error instanceof GameSpecialUnitNotFoundError ||
    error instanceof UpgradeNotFoundError ||
    error instanceof UpgradeUnknownTargetError ||
    error instanceof GameHeroNotFoundError ||
    error instanceof QueuedOrderNotFoundError
  ) {
    return apiError(error.message, 404);
  }
  if (
    error instanceof GameTileNotOwnedError ||
    error instanceof GameShieldedError ||
    error instanceof GameHeroNotOwnedError ||
    error instanceof QueuedOrderForbiddenError
  ) {
    return apiError(error.message, 403);
  }
  if (
    error instanceof GamePlayerAlreadyExistsError ||
    error instanceof GameAlreadyRevealedError ||
    error instanceof GameCasteAlreadySetError ||
    error instanceof GameCasteChangeUnavailableError ||
    error instanceof GameInvalidPhaseError ||
    error instanceof GameInsufficientTurnsError ||
    error instanceof GameInsufficientUnitsError ||
    error instanceof GameTileUnrevealedError ||
    error instanceof GameNoUnrevealedTilesError ||
    error instanceof GameTileFullError ||
    error instanceof GameUnitCapExceededError ||
    error instanceof GameTileTypeError ||
    error instanceof GameFrontierExhaustedError ||
    error instanceof GameNoEnemyKingdomsError ||
    error instanceof GameArtifactAlreadyUsedError ||
    error instanceof GameNameTakenError ||
    error instanceof GameArmageddonInProgressError ||
    error instanceof GameStaleSeasonError ||
    error instanceof GameSealsExhaustedError ||
    error instanceof GameSpecialUnitAlreadyStationedError ||
    error instanceof UpgradeAlreadyActiveError ||
    error instanceof UpgradeNotActiveError ||
    error instanceof GameDefensiveStanceBlockedError ||
    error instanceof GameDefensiveStanceCapError ||
    error instanceof GameDefensiveStanceLockedError ||
    error instanceof GameHeroAlreadyMeditatingError ||
    error instanceof GameMeditationSlotFullError ||
    error instanceof GamePepTalkRequiresZeroTurnsError ||
    error instanceof GameLastStandRequiresZeroTurnsError ||
    error instanceof GameLastStandNoThreatError ||
    error instanceof QueuedOrderQueueFullError
  ) {
    return apiError(error.message, 409);
  }
  if (
    error instanceof GameInvalidLandTypeError ||
    error instanceof GameInvalidCasteError ||
    error instanceof GameInvalidSpellError ||
    error instanceof GameNotAdjacentError ||
    error instanceof GameSelfAttackError ||
    error instanceof GameInvalidNameError ||
    error instanceof GamePlayerBioTooLongError ||
    error instanceof GameInscriptionTooLongError ||
    error instanceof UpgradeWrongCasteError ||
    error instanceof QueuedOrderInvalidParamsError
  ) {
    return apiError(error.message, 400);
  }
  if (
    error instanceof GameRedistributeRateLimitError ||
    error instanceof GameLastStandCooldownError
  ) {
    return apiError(error.message, 429);
  }
  logger.error("Unhandled game API error", {
    message: error instanceof Error ? error.message : String(error),
  });
  return apiError("Internal server error", 500);
}
