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

const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

export interface GithubInfo {
  id: string;
  login: string;
  name?: string;
  avatar_url?: string;
  html_url: string;
}

export function useGithubConnection(
  user: User | null,
  userProfileGithub?: GithubInfo | null,
  userProvider?: string,
  refreshUserProfile?: () => Promise<void>,
  returnTo?: string
) {
  const router = useRouter();
  const toast = useToast();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectedInfo, setConnectedInfo] = useState<GithubInfo | null>(null);
  const [wasDisconnected, setWasDisconnected] = useState(false);

  const fallbackPath = returnTo || "/profile";

  // Priority: explicit disconnection > local state > userProfile
  const githubInfo = wasDisconnected ? null : (connectedInfo || userProfileGithub || null);
  const hasGithubConnection = Boolean(githubInfo || userProvider === "github");

  const connect = () => {
    if (!user || !GITHUB_CLIENT_ID) {
      setError("GitHub connection is not configured");
      return;
    }
    setConnecting(true);
    const authorizeUrl = returnTo
      ? `/api/github/authorize?returnTo=${encodeURIComponent(returnTo)}`
      : "/api/github/authorize";
    window.location.href = authorizeUrl;
  };

  const disconnect = async () => {
    if (!user || !db) return;
    setDisconnecting(true);
    setError(null);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { github: deleteField() });
      setWasDisconnected(true);
      setConnectedInfo(null);
    } catch {
      setError("Failed to disconnect GitHub. Please try again.");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleOAuthSuccess = async (data: Record<string, string>) => {
    if (!user || !db) {
      setError("Please sign in to finish connecting GitHub.");
      router.replace(`/login?redirect=${encodeURIComponent(fallbackPath)}`);
      return;
    }
    try {
      const githubUserInfo: GithubInfo = {
        id: data.id,
        login: data.login,
        name: data.name,
        avatar_url: data.avatar_url,
        html_url: data.html_url,
      };
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        github: { ...githubUserInfo, connectedAt: serverTimestamp() },
      });

      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/profile/github/reconcile", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          setError("GitHub connected, but merged PR history could not be synced yet.");
        }
      } catch {
        setError("GitHub connected, but merged PR history could not be synced yet.");
      }

      await refreshUserProfile?.();
      setConnectedInfo(githubUserInfo);
      setWasDisconnected(false);
      router.replace(fallbackPath, { scroll: false });
    } catch {
      setError("Failed to save GitHub connection");
    }
  };

  // OAuth callback redirected us back with `?github=error&message=<code>`.
  // Surface the exact code via a toast (with the auto-appended "fork the
  // repo and send a fix" footer the ToastProvider adds for errors) so
  // users know whether they were rate-limited, hit a state mismatch,
  // etc. — and have a path to file the bug if it's something we don't
  // know about yet. setError stays as a fallback so the existing inline
  // banner on the profile page still works.
  const handleOAuthError = (code?: string | null) => {
    const describe = describeOAuthError("GitHub", code);
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
    githubInfo,
    hasGithubConnection,
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
