/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  CURSOR_BOSTON_DISCORD_INVITE_URL,
  getDiscordAuthorizeUrl,
} from "@/lib/event-signup-discord";
import { DiscordIcon } from "@/components/icons";

export function EventSignupDiscordMissingCopy() {
  return (
    <>
      Join the Cursor Boston Discord first, then connect so we can verify
      membership.
    </>
  );
}

export function EventSignupDiscordJoinHint({
  className = "text-xs text-neutral-500 dark:text-neutral-400",
}: {
  className?: string;
}) {
  return (
    <p className={className}>
      Not in the server yet?{" "}
      <a
        href={CURSOR_BOSTON_DISCORD_INVITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-emerald-600 underline hover:text-emerald-500 dark:text-emerald-400"
      >
        Join Discord first
      </a>
      , then come back and connect your account.
    </p>
  );
}

export function EventSignupDiscordConnectLink({
  returnTo,
  className = "inline-flex items-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-medium text-white hover:bg-[#4752C4] transition-colors",
}: {
  returnTo?: string | null;
  className?: string;
}) {
  return (
    <a href={getDiscordAuthorizeUrl(returnTo)} className={className}>
      <DiscordIcon size={16} />
      Connect Discord
    </a>
  );
}

