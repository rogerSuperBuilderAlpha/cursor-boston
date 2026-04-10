/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect } from "react";
import type { ReadonlyURLSearchParams } from "next/navigation";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { useDiscordConnection } from "./useDiscordConnection";
import type { useGithubConnection } from "./useGithubConnection";
import type { useEmailManagement } from "./useEmailManagement";
import type { Tab } from "../_types";

interface OAuthCallbackDeps {
  loading: boolean;
  searchParams: ReadonlyURLSearchParams;
  router: AppRouterInstance;
  discord: ReturnType<typeof useDiscordConnection>;
  github: ReturnType<typeof useGithubConnection>;
  email: ReturnType<typeof useEmailManagement>;
  refreshUserProfile: () => Promise<void>;
  setActiveTab: (tab: Tab) => void;
}

export function useOAuthCallbacks({
  loading,
  searchParams,
  router,
  discord,
  github,
  email,
  refreshUserProfile,
  setActiveTab,
}: OAuthCallbackDeps) {
  useEffect(() => {
    if (loading) return;

    // Discord callback
    const discordStatus = searchParams.get("discord");
    if (discordStatus) {
      const data = searchParams.get("data");
      if (discordStatus === "success" && data) {
        discord.handleOAuthSuccess(JSON.parse(decodeURIComponent(data)));
      } else if (discordStatus === "error") {
        discord.handleOAuthError(searchParams.get("message"));
      }
    }

    // GitHub callback
    const githubStatus = searchParams.get("github");
    if (githubStatus) {
      const data = searchParams.get("data");
      if (githubStatus === "success" && data) {
        github.handleOAuthSuccess(JSON.parse(decodeURIComponent(data)));
      } else if (githubStatus === "error") {
        github.handleOAuthError();
      }
    }

    // Email verification callback
    const emailVerification = searchParams.get("emailVerification");
    if (emailVerification) {
      const message = searchParams.get("message");
      const tab = searchParams.get("tab");

      if (emailVerification === "success") {
        email.setVerificationStatus({
          type: "success",
          message: "Email verified and added to your account successfully!",
        });
        refreshUserProfile();
        if (tab === "security") setActiveTab("security");
      } else if (emailVerification === "error") {
        const errorMessages: Record<string, string> = {
          missing_token: "Invalid verification link.",
          invalid_token:
            "This verification link is invalid or has already been used.",
          token_expired:
            "This verification link has expired. Please request a new one.",
          email_taken:
            "This email is already associated with another account.",
          server_error: "An error occurred. Please try again.",
        };
        email.setVerificationStatus({
          type: "error",
          message: errorMessages[message || ""] || "Failed to verify email.",
        });
        setActiveTab("security");
      }

      router.replace("/profile", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading]);
}
