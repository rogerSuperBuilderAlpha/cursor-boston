/**
 * @jest-environment node
 *
 * Wave 1a chunk 2 of the Silver coverage backlog — every Game*Error class
 * in lib/game/data-server.ts (lines 362-664). Each class is essentially
 * `class FooError extends Error { constructor() { super(...); this.name = "Foo"; } }`,
 * so coverage just needs `new FooError(...)` plus a `.message` / `.name`
 * assertion to drive the constructor.
 *
 * 46 error classes covered. No Firestore mocks.
 */
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

describe("lib/game/data-server — error classes (zero-arg constructors)", () => {
  // These all extend Error with a fixed message and a `name` set to the
  // class name. Each test exercises the constructor body to drive coverage.
  const zeroArg: Array<[string, new () => Error]> = [
    ["GamePlayerNotFoundError", GamePlayerNotFoundError],
    ["GamePlayerAlreadyExistsError", GamePlayerAlreadyExistsError],
    ["GameTileNotFoundError", GameTileNotFoundError],
    ["GameTileNotOwnedError", GameTileNotOwnedError],
    ["GameNoUnrevealedTilesError", GameNoUnrevealedTilesError],
    ["GameAlreadyRevealedError", GameAlreadyRevealedError],
    ["GameTileUnrevealedError", GameTileUnrevealedError],
    ["GameCasteAlreadySetError", GameCasteAlreadySetError],
    ["GameInsufficientUnitsError", GameInsufficientUnitsError],
    ["GameFrontierExhaustedError", GameFrontierExhaustedError],
    ["GameArtifactNotFoundError", GameArtifactNotFoundError],
    ["GameArtifactAlreadyUsedError", GameArtifactAlreadyUsedError],
    ["GamePlayerBioTooLongError", GamePlayerBioTooLongError],
    ["GameInscriptionTooLongError", GameInscriptionTooLongError],
    ["GameNameTakenError", GameNameTakenError],
    ["GameNoEnemyKingdomsError", GameNoEnemyKingdomsError],
    ["GameArmageddonInProgressError", GameArmageddonInProgressError],
    ["GameSealsExhaustedError", GameSealsExhaustedError],
    ["GameSpecialUnitAlreadyStationedError", GameSpecialUnitAlreadyStationedError],
    ["GameDefensiveStanceBlockedError", GameDefensiveStanceBlockedError],
    ["GameDefensiveStanceLockedError", GameDefensiveStanceLockedError],
    ["GameMeditationSlotFullError", GameMeditationSlotFullError],
    ["GameHeroAlreadyMeditatingError", GameHeroAlreadyMeditatingError],
    ["GameHeroNotOwnedError", GameHeroNotOwnedError],
    ["GameHeroNotFoundError", GameHeroNotFoundError],
    ["GamePepTalkRequiresZeroTurnsError", GamePepTalkRequiresZeroTurnsError],
    ["GameLastStandRequiresZeroTurnsError", GameLastStandRequiresZeroTurnsError],
    ["GameLastStandNoThreatError", GameLastStandNoThreatError],
    ["GameSelfAttackError", GameSelfAttackError],
    ["GameNotAdjacentError", GameNotAdjacentError],
  ];

  it.each(zeroArg)("%s — extends Error, has name=%s, non-empty message", (name, Ctor) => {
    const err = new Ctor();
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe(name);
    expect(typeof err.message).toBe("string");
    expect(err.message.length).toBeGreaterThan(0);
  });
});

describe("lib/game/data-server — error classes (formatted constructors)", () => {
  it("GameInvalidPhaseError formats expected vs actual into the message", () => {
    const err = new GameInvalidPhaseError("cast", "build");
    expect(err.name).toBe("GameInvalidPhaseError");
    expect(err.message).toMatch(/expected cast/);
    expect(err.message).toMatch(/got build/);
  });

  it("GameInsufficientTurnsError formats required + have into the message", () => {
    const err = new GameInsufficientTurnsError(5, 2);
    expect(err.message).toMatch(/need 5/);
    expect(err.message).toMatch(/have 2/);
  });

  it("GameCasteChangeUnavailableError includes the reason", () => {
    const err = new GameCasteChangeUnavailableError("under tile threshold");
    expect(err.message).toContain("under tile threshold");
  });

  it("GameInvalidLandTypeError includes the supplied land type", () => {
    const err = new GameInvalidLandTypeError("ocean");
    expect(err.message).toContain("ocean");
  });

  it("GameInvalidCasteError includes the supplied caste", () => {
    const err = new GameInvalidCasteError("rainbow");
    expect(err.message).toContain("rainbow");
  });

  it("GameShieldedError takes either 'attacker' or 'defender' side", () => {
    expect(new GameShieldedError("attacker").name).toBe("GameShieldedError");
    expect(new GameShieldedError("defender").name).toBe("GameShieldedError");
  });

  it("GameTileFullError exposes availableSpace + requested as public fields", () => {
    const err = new GameTileFullError(3, 10);
    expect(err.availableSpace).toBe(3);
    expect(err.requested).toBe(10);
    expect(err.message).toMatch(/3 units/);
    expect(err.message).toMatch(/sent 10/);
  });

  it("GameInvalidSpellError prefixes the reason", () => {
    const err = new GameInvalidSpellError("not unlocked");
    expect(err.message).toBe("Invalid spell: not unlocked");
  });

  it("GameUnitCapExceededError exposes cap + currentTotal as public fields", () => {
    const err = new GameUnitCapExceededError(100, 105);
    expect(err.cap).toBe(100);
    expect(err.currentTotal).toBe(105);
    expect(err.message).toMatch(/105\/100/);
  });

  it("GameTileTypeError formats expected vs got", () => {
    const err = new GameTileTypeError("food", "magic");
    expect(err.message).toBe("Tile must be food, got magic");
  });

  it("GameInvalidNameError prefixes the reason", () => {
    const err = new GameInvalidNameError("too short");
    expect(err.message).toBe("Invalid general name: too short");
  });

  it("GameStaleSeasonError formats playerSeason + worldSeason", () => {
    const err = new GameStaleSeasonError(2, 5);
    expect(err.message).toMatch(/season 2/);
    expect(err.message).toMatch(/season is 5/);
  });

  it("GameSpecialUnitNotFoundError includes the instance id", () => {
    const err = new GameSpecialUnitNotFoundError("inst-abc");
    expect(err.message).toContain("inst-abc");
  });

  it("GameDefensiveStanceCapError exposes the cap as a public field", () => {
    const err = new GameDefensiveStanceCapError(3);
    expect(err.cap).toBe(3);
    expect(err.message).toContain("3 tile");
  });

  it("GameRedistributeRateLimitError exposes retryAfterMs as a public field", () => {
    const err = new GameRedistributeRateLimitError(60_000);
    expect(err.retryAfterMs).toBe(60_000);
  });

  it("GameLastStandCooldownError exposes retryAfterMs as a public field", () => {
    const err = new GameLastStandCooldownError(120_000);
    expect(err.retryAfterMs).toBe(120_000);
  });
});

describe("lib/game/data-server — error classes (instanceof + classification)", () => {
  it("every Game*Error is also an instanceof Error", () => {
    const samples: Error[] = [
      new GamePlayerNotFoundError(),
      new GameInvalidPhaseError("a", "b"),
      new GameTileFullError(1, 2),
      new GameStaleSeasonError(1, 2),
      new GameLastStandCooldownError(0),
    ];
    for (const e of samples) {
      expect(e).toBeInstanceOf(Error);
      expect(typeof e.name).toBe("string");
      expect(typeof e.message).toBe("string");
    }
  });
});
