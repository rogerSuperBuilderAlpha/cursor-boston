/**
 * @jest-environment node
 */
import type { GameAttack } from "@/lib/game/types";

jest.mock("@/lib/discord", () => ({
  sendDiscordNotification: jest.fn(() => Promise.resolve()),
}));
jest.mock("@/lib/logger", () => ({
  logger: { warn: jest.fn(), error: jest.fn() },
}));

import { sendDiscordNotification } from "@/lib/discord";
import { notifyConquest } from "@/lib/game/discord-game";

const mockSend = sendDiscordNotification as jest.MockedFunction<typeof sendDiscordNotification>;

const baseAttack = (
  overrides: Partial<GameAttack> = {}
): GameAttack =>
  ({
    attackerId: "u-attacker",
    defenderId: "u-defender",
    targetTileId: "tile-1",
    casteAttacker: "red",
    casteDefender: "blue",
    unitsSent: { ground: 100, siege: 0, air: 0 },
    unitsLostAttacker: { ground: 10, siege: 0, air: 0 },
    unitsLostDefender: { ground: 50, siege: 0, air: 0 },
    createdAt: new Date("2026-05-18T12:00:00Z"),
    ...overrides,
  } as unknown as GameAttack);

describe("game/discord-game — notifyConquest", () => {
  const originalEnv = process.env.GAME_DISCORD_WEBHOOK_URL;

  afterEach(() => {
    mockSend.mockClear();
    if (originalEnv === undefined) delete process.env.GAME_DISCORD_WEBHOOK_URL;
    else process.env.GAME_DISCORD_WEBHOOK_URL = originalEnv;
  });

  it("no-ops when GAME_DISCORD_WEBHOOK_URL is unset", () => {
    delete process.env.GAME_DISCORD_WEBHOOK_URL;
    notifyConquest({ attack: baseAttack() });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("no-ops when GAME_DISCORD_WEBHOOK_URL is whitespace", () => {
    process.env.GAME_DISCORD_WEBHOOK_URL = "   ";
    notifyConquest({ attack: baseAttack() });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("sends a Discord embed when the webhook is configured", () => {
    process.env.GAME_DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/x/y";
    notifyConquest({
      attack: baseAttack(),
      attackerName: "Alice",
      defenderName: "Bob",
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    const [embed, opts] = mockSend.mock.calls[0];
    expect(embed.title).toBe("Alice took a tile from Bob");
    expect(embed.description).toContain("red");
    expect(embed.description).toContain("blue");
    expect(opts).toMatchObject({
      username: "Generals",
      webhookUrl: "https://discord.com/api/webhooks/x/y",
    });
  });

  it("falls back to a uid prefix when names are not provided", () => {
    process.env.GAME_DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/x/y";
    notifyConquest({
      attack: baseAttack({ attackerId: "u-attackerX", defenderId: "u-defenderX" } as Partial<GameAttack>),
    });
    const embed = mockSend.mock.calls[0][0] as { title: string };
    expect(embed.title).toContain("u-attac"); // first 8 chars of attackerId
    expect(embed.title).toContain("u-defen"); // first 8 chars of defenderId
  });

  it("includes optional offense spell field when present", () => {
    process.env.GAME_DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/x/y";
    notifyConquest({
      attack: baseAttack({ offenseSpellId: "fireball" } as Partial<GameAttack>),
    });
    const embed = mockSend.mock.calls[0][0] as { fields: Array<{ name: string; value: string }> };
    const offense = embed.fields.find((f) => f.name === "Offense spell");
    expect(offense?.value).toBe("fireball");
  });

  it("includes optional defense spell field when present", () => {
    process.env.GAME_DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/x/y";
    notifyConquest({
      attack: baseAttack({ defenseSpellId: "shield" } as Partial<GameAttack>),
    });
    const embed = mockSend.mock.calls[0][0] as { fields: Array<{ name: string; value: string }> };
    const def = embed.fields.find((f) => f.name === "Defense spell");
    expect(def?.value).toBe("shield");
  });

  it("sums the loss stacks correctly for the loss field", () => {
    process.env.GAME_DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/x/y";
    notifyConquest({
      attack: baseAttack({
        unitsLostAttacker: { ground: 10, siege: 5, air: 2 },
        unitsLostDefender: { ground: 50, siege: 25, air: 25 },
      } as Partial<GameAttack>),
    });
    const embed = mockSend.mock.calls[0][0] as { fields: Array<{ name: string; value: string }> };
    const attLoss = embed.fields.find((f) => f.name === "Attacker losses");
    const defLoss = embed.fields.find((f) => f.name === "Defender losses");
    expect(attLoss?.value).toBe("17"); // 10 + 5 + 2
    expect(defLoss?.value).toBe("100"); // 50 + 25 + 25
  });

  it("omits timestamp when createdAt is not a Date", () => {
    process.env.GAME_DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/x/y";
    notifyConquest({
      attack: baseAttack({ createdAt: "not-a-date" as unknown as Date } as Partial<GameAttack>),
    });
    const embed = mockSend.mock.calls[0][0] as { timestamp?: string };
    expect(embed.timestamp).toBeUndefined();
  });
});
