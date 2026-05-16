/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";

export interface CursorInfo {
  apiKeyFingerprint: string;
  modelsAvailable?: string[];
  defaultModel?: string;
  monthlyCapUsd: number;
  scopesConsented: string[];
  connectedAt: Date;
  lastUsedAt?: Date | null;
  revokedAt?: Date | null;
}

export function useCursorConnection(
  user: User | null,
  userProfileCursor?: CursorInfo | null,
  refreshUserProfile?: () => Promise<void>,
  returnTo?: string
) {
  const router = useRouter();
  const fallbackPath = returnTo || "/profile";
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasDisconnected, setWasDisconnected] = useState(false);
  const [localInfo, setLocalInfo] = useState<CursorInfo | null>(null);

  const cursorInfo = wasDisconnected
    ? null
    : (localInfo || userProfileCursor || null);

  const connect = () => {
    if (!user) {
      setError("Please sign in first.");
      return;
    }
    setConnecting(true);
    setError(null);
    router.push("/profile/cursor");
  };

  const disconnect = async () => {
    if (!user) return;
    setDisconnecting(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/cursor/disconnect", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError("Failed to disconnect Cursor. Please try again.");
        return;
      }
      setWasDisconnected(true);
      setLocalInfo(null);
      if (refreshUserProfile) await refreshUserProfile();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleOAuthSuccess = async () => {
    setWasDisconnected(false);
    if (refreshUserProfile) await refreshUserProfile();
    router.replace(fallbackPath, { scroll: false });
  };

  const handleOAuthError = (message: string | null) => {
    setError(
      message === "invalid_key"
        ? "That Cursor API key could not be validated."
        : "Failed to connect Cursor. Please try again."
    );
    router.replace(fallbackPath, { scroll: false });
  };

  return {
    cursorInfo,
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
