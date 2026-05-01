/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import { getLudwittErrorMessage } from "../../login/_lib/ludwitt-errors";

export interface LudwittInfo {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

export function useLudwittConnection(
  user: User | null,
  userProfileLudwitt?: LudwittInfo | null,
  refreshUserProfile?: () => Promise<void>,
  returnTo?: string
) {
  const router = useRouter();
  const fallbackPath = returnTo || "/profile";
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasDisconnected, setWasDisconnected] = useState(false);
  const [localInfo, setLocalInfo] = useState<LudwittInfo | null>(null);

  const ludwittInfo = wasDisconnected
    ? null
    : (localInfo || userProfileLudwitt || null);

  const connect = async () => {
    if (!user) {
      setError("Please sign in first.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/ludwitt/connect-start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ returnTo: fallbackPath }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(
          (j as { error?: string }).error === "not_configured"
            ? "Ludwitt sign-in isn't configured."
            : "Couldn't start the Ludwitt connection. Please try again."
        );
        return;
      }
      const { authorizeUrl } = (await res.json()) as { authorizeUrl: string };
      window.location.href = authorizeUrl;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!user) return;
    setDisconnecting(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/ludwitt/disconnect", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError("Failed to disconnect Ludwitt. Please try again.");
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

  // Connect-flow callback redirects to returnTo with ?ludwitt=success.
  // The page-level useOAuthCallbacks calls these on detection.
  const handleOAuthSuccess = async () => {
    setWasDisconnected(false);
    if (refreshUserProfile) await refreshUserProfile();
    router.replace(fallbackPath, { scroll: false });
  };

  const handleOAuthError = (message: string | null) => {
    setError(getLudwittErrorMessage(message));
    router.replace(fallbackPath, { scroll: false });
  };

  return {
    ludwittInfo,
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
