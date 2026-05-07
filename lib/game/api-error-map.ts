/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import {
  GameAlreadyRevealedError,
  GameArtifactAlreadyUsedError,
  GameArtifactNotFoundError,
  GameCasteAlreadySetError,
  GameFrontierExhaustedError,
  GameInsufficientTurnsError,
  GameInsufficientUnitsError,
  GameInvalidCasteError,
  GameInvalidLandTypeError,
  GameInvalidNameError,
  GameInvalidPhaseError,
  GameInvalidSpellError,
  GameNameTakenError,
  GameNoUnrevealedTilesError,
  GameNotAdjacentError,
  GamePlayerAlreadyExistsError,
  GamePlayerNotFoundError,
  GameSelfAttackError,
  GameShieldedError,
  GameTileFullError,
  GameTileNotFoundError,
  GameTileNotOwnedError,
  GameTileTypeError,
  GameTileUnrevealedError,
  GameUnitCapExceededError,
} from "./data-server";
import {
  UpgradeAlreadyActiveError,
  UpgradeNotActiveError,
  UpgradeNotFoundError,
  UpgradeUnknownTargetError,
  UpgradeWrongCasteError,
} from "./upgrades";

export function mapGameError(error: unknown): NextResponse {
  if (
    error instanceof GamePlayerNotFoundError ||
    error instanceof GameTileNotFoundError ||
    error instanceof GameArtifactNotFoundError ||
    error instanceof UpgradeNotFoundError ||
    error instanceof UpgradeUnknownTargetError
  ) {
    return apiError(error.message, 404);
  }
  if (
    error instanceof GameTileNotOwnedError ||
    error instanceof GameShieldedError
  ) {
    return apiError(error.message, 403);
  }
  if (
    error instanceof GamePlayerAlreadyExistsError ||
    error instanceof GameAlreadyRevealedError ||
    error instanceof GameCasteAlreadySetError ||
    error instanceof GameInvalidPhaseError ||
    error instanceof GameInsufficientTurnsError ||
    error instanceof GameInsufficientUnitsError ||
    error instanceof GameTileUnrevealedError ||
    error instanceof GameNoUnrevealedTilesError ||
    error instanceof GameTileFullError ||
    error instanceof GameUnitCapExceededError ||
    error instanceof GameTileTypeError ||
    error instanceof GameFrontierExhaustedError ||
    error instanceof GameArtifactAlreadyUsedError ||
    error instanceof GameNameTakenError ||
    error instanceof UpgradeAlreadyActiveError ||
    error instanceof UpgradeNotActiveError
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
    error instanceof UpgradeWrongCasteError
  ) {
    return apiError(error.message, 400);
  }
  logger.error("Unhandled game API error", {
    message: error instanceof Error ? error.message : String(error),
  });
  return apiError("Internal server error", 500);
}
