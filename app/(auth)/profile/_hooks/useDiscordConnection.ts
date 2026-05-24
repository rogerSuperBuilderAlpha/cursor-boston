/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, serverTimestamp, deleteField } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User } from "firebase/auth";
import { useToast } from "@/components/Toast";
import { describeOAuthError } from "@/lib/oauth-errors";

const DISCORD_CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;

export interface DiscordInfo {
  id: string;
  username: string;
  avatar?: string;
}

export function useDiscordConnection(
  user: User | null,
  userProfileDiscord?: DiscordInfo | null,
  returnTo?: string
) {
  const router = useRouter();
  const toast = useToast();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedInfo, setConnectedInfo] = useState<DiscordInfo | null>(null);
  const [wasDisconnected, setWasDisconnected] = useState(false);

  const fallbackPath = returnTo || "/profile";

  // Priority: explicit disconnection > local state > userProfile
  const discordInfo = wasDisconnected ? null : (connectedInfo || userProfileDiscord || null);

  const connect = () => {
    if (!user || !DISCORD_CLIENT_ID) {
      setError("Discord connection is not configured");
      return;
    }
    setConnecting(true);
    const authorizeUrl = returnTo
      ? `/api/discord/authorize?returnTo=${encodeURIComponent(returnTo)}`
      : "/api/discord/authorize";
    window.location.href = authorizeUrl;
  };

  const disconnect = async () => {
    if (!user || !db) return;
    setDisconnecting(true);
    setError(null);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { discord: deleteField() });
      setWasDisconnected(true);
      setConnectedInfo(null);
    } catch {
      setError("Failed to disconnect Discord. Please try again.");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleOAuthSuccess = async (data: Record<string, string>) => {
    if (!user || !db) {
      setError("Please sign in to finish connecting Discord.");
      router.replace(`/login?redirect=${encodeURIComponent(fallbackPath)}`);
      return;
    }
    try {
      const discordUserInfo: DiscordInfo = {
        id: data.id,
        username: data.globalName || data.username,
        avatar: data.avatar,
      };
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        discord: { ...discordUserInfo, connectedAt: serverTimestamp() },
      });
      setConnectedInfo(discordUserInfo);
      setWasDisconnected(false);
      router.replace(fallbackPath, { scroll: false });
    } catch {
      setError("Failed to save Discord connection");
    }
  };

  // Surfaces the specific OAuth failure mode (rate-limited, state
  // mismatch, not a guild member, etc.) via the global toast with
  // auto-appended repo-fork CTA. See lib/oauth-errors.ts for the full
  // code→copy table. setError stays as a fallback so the inline banner
  // on the profile page keeps working.
  const handleOAuthError = (message: string | null) => {
    const describe = describeOAuthError("Discord", message);
    toast.error({
      title: describe.title,
      description: describe.description,
    });
    // Inline banner gets the full title+description so SR users hear the
    // same content the toast carries.
    setError(
      describe.description
        ? `${describe.title}. ${describe.description}`
        : describe.title
    );
    router.replace(fallbackPath);
  };

  return {
    discordInfo,
    connecting,
    disconnecting,
    error,
    setError,
    connect,
    disconnect,
    handleOAuthSuccess,
    handleOAuthError,
  };
}
