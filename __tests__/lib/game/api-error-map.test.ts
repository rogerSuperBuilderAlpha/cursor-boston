/**
 * @jest-environment node
 */
import { mapGameError } from "@/lib/game/api-error-map";
import {
  GameAlreadyRevealedError,
  GameArmageddonInProgressError,
  GameArtifactAlreadyUsedError,
  GameArtifactNotFoundError,
  GameCasteAlreadySetError,
  GameCasteChangeUnavailableError,
  GameDefensiveStanceBlockedError,
  GameDefensiveStanceCapError,
  GameDefensiveStanceLockedError,
  GameFrontierExhaustedError,
  GameHeroAlreadyMeditatingError,
  GameHeroNotFoundError,
  GameHeroNotOwnedError,
  GameInscriptionTooLongError,
  GameInsufficientTurnsError,
  GameInsufficientUnitsError,
  GameInvalidCasteError,
  GameInvalidLandTypeError,
  GameInvalidNameError,
  GameInvalidPhaseError,
  GameInvalidSpellError,
  GameLastStandCooldownError,
  GameLastStandNoThreatError,
  GameLastStandRequiresZeroTurnsError,
  GameMeditationSlotFullError,
  GameNameTakenError,
  GameNoEnemyKingdomsError,
  GameNoUnrevealedTilesError,
  GameNotAdjacentError,
  GamePepTalkRequiresZeroTurnsError,
  GamePlayerAlreadyExistsError,
  GamePlayerBioTooLongError,
  GamePlayerNotFoundError,
  GameRedistributeRateLimitError,
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
} from "@/lib/game/data-server";
import {
  UpgradeAlreadyActiveError,
  UpgradeNotActiveError,
  UpgradeNotFoundError,
  UpgradeUnknownTargetError,
  UpgradeWrongCasteError,
} from "@/lib/game/upgrades";
import {
  QueuedOrderForbiddenError,
  QueuedOrderInvalidParamsError,
  QueuedOrderNotFoundError,
  QueuedOrderQueueFullError,
} from "@/lib/game/orders";

async function statusOf(err: unknown): Promise<number> {
  return mapGameError(err).status;
}

describe("game/api-error-map — mapGameError", () => {
  describe("404 Not Found", () => {
    it.each([
      ["GamePlayerNotFoundError", new GamePlayerNotFoundError("x")],
      ["GameTileNotFoundError", new GameTileNotFoundError("x")],
      ["GameArtifactNotFoundError", new GameArtifactNotFoundError("x")],
      ["GameSpecialUnitNotFoundError", new GameSpecialUnitNotFoundError("x")],
      ["UpgradeNotFoundError", new UpgradeNotFoundError("x")],
      ["UpgradeUnknownTargetError", new UpgradeUnknownTargetError("x")],
      ["GameHeroNotFoundError", new GameHeroNotFoundError("x")],
      ["QueuedOrderNotFoundError", new QueuedOrderNotFoundError("x")],
    ])("maps %s → 404", async (_name, err) => {
      expect(await statusOf(err)).toBe(404);
    });
  });

  describe("403 Forbidden", () => {
    it.each([
      ["GameTileNotOwnedError", new GameTileNotOwnedError("x")],
      ["GameShieldedError", new GameShieldedError("x")],
      ["GameHeroNotOwnedError", new GameHeroNotOwnedError("x")],
      ["QueuedOrderForbiddenError", new QueuedOrderForbiddenError("x")],
    ])("maps %s → 403", async (_name, err) => {
      expect(await statusOf(err)).toBe(403);
    });
  });

  describe("409 Conflict", () => {
    it.each([
      ["GamePlayerAlreadyExistsError", new GamePlayerAlreadyExistsError("x")],
      ["GameAlreadyRevealedError", new GameAlreadyRevealedError("x")],
      ["GameCasteAlreadySetError", new GameCasteAlreadySetError("x")],
      ["GameCasteChangeUnavailableError", new GameCasteChangeUnavailableError("x")],
      ["GameInvalidPhaseError", new GameInvalidPhaseError("x")],
      ["GameInsufficientTurnsError", new GameInsufficientTurnsError("x")],
      ["GameInsufficientUnitsError", new GameInsufficientUnitsError("x")],
      ["GameTileUnrevealedError", new GameTileUnrevealedError("x")],
      ["GameNoUnrevealedTilesError", new GameNoUnrevealedTilesError("x")],
      ["GameTileFullError", new GameTileFullError("x")],
      ["GameUnitCapExceededError", new GameUnitCapExceededError("x")],
      ["GameTileTypeError", new GameTileTypeError("x")],
      ["GameFrontierExhaustedError", new GameFrontierExhaustedError("x")],
      ["GameNoEnemyKingdomsError", new GameNoEnemyKingdomsError("x")],
      ["GameArtifactAlreadyUsedError", new GameArtifactAlreadyUsedError("x")],
      ["GameNameTakenError", new GameNameTakenError("x")],
      ["GameArmageddonInProgressError", new GameArmageddonInProgressError("x")],
      ["GameStaleSeasonError", new GameStaleSeasonError("x")],
      ["GameSealsExhaustedError", new GameSealsExhaustedError("x")],
      ["GameSpecialUnitAlreadyStationedError", new GameSpecialUnitAlreadyStationedError("x")],
      ["UpgradeAlreadyActiveError", new UpgradeAlreadyActiveError("x")],
      ["UpgradeNotActiveError", new UpgradeNotActiveError("x")],
      ["GameDefensiveStanceBlockedError", new GameDefensiveStanceBlockedError("x")],
      ["GameDefensiveStanceCapError", new GameDefensiveStanceCapError("x")],
      ["GameDefensiveStanceLockedError", new GameDefensiveStanceLockedError("x")],
      ["GameHeroAlreadyMeditatingError", new GameHeroAlreadyMeditatingError("x")],
      ["GameMeditationSlotFullError", new GameMeditationSlotFullError("x")],
      ["GamePepTalkRequiresZeroTurnsError", new GamePepTalkRequiresZeroTurnsError("x")],
      ["GameLastStandRequiresZeroTurnsError", new GameLastStandRequiresZeroTurnsError("x")],
      ["GameLastStandNoThreatError", new GameLastStandNoThreatError("x")],
      ["QueuedOrderQueueFullError", new QueuedOrderQueueFullError("x")],
    ])("maps %s → 409", async (_name, err) => {
      expect(await statusOf(err)).toBe(409);
    });
  });

  describe("400 Bad Request", () => {
    it.each([
      ["GameInvalidLandTypeError", new GameInvalidLandTypeError("x")],
      ["GameInvalidCasteError", new GameInvalidCasteError("x")],
      ["GameInvalidSpellError", new GameInvalidSpellError("x")],
      ["GameNotAdjacentError", new GameNotAdjacentError("x")],
      ["GameSelfAttackError", new GameSelfAttackError("x")],
      ["GameInvalidNameError", new GameInvalidNameError("x")],
      ["GamePlayerBioTooLongError", new GamePlayerBioTooLongError("x")],
      ["GameInscriptionTooLongError", new GameInscriptionTooLongError("x")],
      ["UpgradeWrongCasteError", new UpgradeWrongCasteError("x")],
      ["QueuedOrderInvalidParamsError", new QueuedOrderInvalidParamsError("x")],
    ])("maps %s → 400", async (_name, err) => {
      expect(await statusOf(err)).toBe(400);
    });
  });

  describe("429 Rate Limited", () => {
    it.each([
      ["GameRedistributeRateLimitError", new GameRedistributeRateLimitError("x")],
      ["GameLastStandCooldownError", new GameLastStandCooldownError("x")],
    ])("maps %s → 429", async (_name, err) => {
      expect(await statusOf(err)).toBe(429);
    });
  });

  describe("500 Server Error (unhandled)", () => {
    it("maps an unknown Error → 500", async () => {
      expect(await statusOf(new Error("some unknown error"))).toBe(500);
    });

    it("maps a non-Error value → 500", async () => {
      expect(await statusOf("a string thrown")).toBe(500);
      expect(await statusOf({ weird: "object" })).toBe(500);
      expect(await statusOf(null)).toBe(500);
    });
  });
});
