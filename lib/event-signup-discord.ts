/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export const CURSOR_BOSTON_DISCORD_INVITE_URL = "https://discord.gg/Wsncg8YYqc";

export function getHackathonEventSignupReturnTo(eventId: string): string {
  return `/hackathons/${eventId}/signup`;
}

export function getDiscordAuthorizeUrl(returnTo?: string | null): string {
  if (!returnTo) return "/api/discord/authorize";
  return `/api/discord/authorize?returnTo=${encodeURIComponent(returnTo)}`;
}

