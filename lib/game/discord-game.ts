/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

// Fire-and-forget Discord notifications for game events. Always wrapped so
// that a webhook hiccup never breaks combat — the calling site should not
// await this. Reuses lib/discord.ts via the webhookUrl override so the game
// uses its own webhook (GAME_DISCORD_WEBHOOK_URL), not the platform's.

import { sendDiscordNotification } from "@/lib/discord";
import { logger } from "@/lib/logger";
import type { Caste, GameAttack } from "./types";

const CASTE_COLOR: Record<Caste, number> = {
  white: 0xf2f2f2,
  blue: 0x5865f2,
  black: 0x2a2a2a,
  red: 0xed4245,
  green: 0x57f287,
};

function gameWebhookUrl(): string | null {
  return process.env.GAME_DISCORD_WEBHOOK_URL?.trim() || null;
}

function sumStack(s: { ground: number; siege: number; air: number }): number {
  return s.ground + s.siege + s.air;
}

export function notifyConquest(args: {
  attack: GameAttack;
  attackerName?: string;
  defenderName?: string;
}): void {
  const webhookUrl = gameWebhookUrl();
  if (!webhookUrl) return;

  const a = args.attack;
  const attacker = args.attackerName ?? a.attackerId.slice(0, 8);
  const defender = args.defenderName ?? a.defenderId.slice(0, 8);

  const embed = {
    title: `${attacker} took a tile from ${defender}`,
    description: `**${a.casteAttacker}** conquered tile \`${a.targetTileId}\` from **${a.casteDefender}**.`,
    color: CASTE_COLOR[a.casteAttacker],
    fields: [
      {
        name: "Sent",
        value: `G ${a.unitsSent.ground} · S ${a.unitsSent.siege} · A ${a.unitsSent.air}`,
        inline: true,
      },
      {
        name: "Attacker losses",
        value: String(sumStack(a.unitsLostAttacker)),
        inline: true,
      },
      {
        name: "Defender losses",
        value: String(sumStack(a.unitsLostDefender)),
        inline: true,
      },
      ...(a.offenseSpellId
        ? [{ name: "Offense spell", value: a.offenseSpellId, inline: false }]
        : []),
      ...(a.defenseSpellId
        ? [{ name: "Defense spell", value: a.defenseSpellId, inline: false }]
        : []),
    ],
    timestamp:
      a.createdAt instanceof Date ? a.createdAt.toISOString() : undefined,
  };

  // Fire-and-forget: never await; never let an error escape.
  void sendDiscordNotification(embed, {
    username: "Generals",
    webhookUrl,
  }).catch((e: unknown) => {
    logger.warn("Game conquest Discord notification failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  });
}
