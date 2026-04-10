/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { createContext, useContext, useState } from "react";
import type { User } from "firebase/auth";
import { EmailAuthProvider, linkWithCredential, updatePassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import type { UserProfile } from "@/contexts/AuthContext";

import { useProfileData } from "../_hooks/useProfileData";
import { useBadges } from "../_hooks/useBadges";
import { useDiscordConnection } from "../_hooks/useDiscordConnection";
import { useGithubConnection } from "../_hooks/useGithubConnection";
import { useGoogleConnection } from "../_hooks/useGoogleConnection";
import { useMfaEnrollment } from "../_hooks/useMfaEnrollment";
import { useEmailManagement } from "../_hooks/useEmailManagement";
import { useProfileSettings } from "../_hooks/useProfileSettings";

interface PasswordState {
  saving: boolean;
  error: string | null;
  success: boolean;
  setPassword: (password: string) => Promise<void>;
}

export interface ProfileContextValue {
  user: User;
  userProfile: UserProfile | null;
  refreshUserProfile: () => Promise<void>;

  data: ReturnType<typeof useProfileData>;
  badges: ReturnType<typeof useBadges>;

  discord: ReturnType<typeof useDiscordConnection>;
  github: ReturnType<typeof useGithubConnection>;
  google: ReturnType<typeof useGoogleConnection>;
  mfa: ReturnType<typeof useMfaEnrollment>;
  email: ReturnType<typeof useEmailManagement>;
  profileSettings: ReturnType<typeof useProfileSettings>;
  password: PasswordState;

  signOut: () => Promise<void>;
  signOutError: string | null;
  isSigningOut: boolean;
  handleSignOut: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function useProfileContext() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfileContext must be used within ProfileProvider");
  return ctx;
}

export function ProfileProvider({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const {
    userProfile,
    signOut,
    sendAddEmailVerification,
    removeAdditionalEmail,
    changePrimaryEmail,
    refreshUserProfile,
  } = useAuth();

  // Data hooks
  const data = useProfileData(user, userProfile?.github?.login);
  const badges = useBadges(user, userProfile);

  // Connection hooks
  const discord = useDiscordConnection(user, userProfile?.discord);
  const github = useGithubConnection(
    user,
    userProfile?.github,
    userProfile?.provider,
    refreshUserProfile
  );
  const google = useGoogleConnection(user);
  const mfa = useMfaEnrollment(user);
  const emailMgmt = useEmailManagement({
    user,
    sendAddEmailVerification,
    removeAdditionalEmail,
    changePrimaryEmail,
  });
  const profileSettings = useProfileSettings(user, userProfile, refreshUserProfile);

  // Password state
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const setPassword = async (pw: string) => {
    if (!user || !auth) return;
    setPasswordError(null);
    setPasswordSuccess(false);
    if (!user.email) {
      setPasswordError("No email is associated with this account.");
      return;
    }
    setPasswordSaving(true);
    try {
      if (google.hasPasswordProvider) {
        await updatePassword(user, pw);
      } else {
        const credential = EmailAuthProvider.credential(user.email, pw);
        await linkWithCredential(user, credential);
      }
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch {
      setPasswordError("Failed to set password. Please re-authenticate and try again.");
    } finally {
      setPasswordSaving(false);
    }
  };

  // Sign out
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setSignOutError(null);
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (err) {
      setSignOutError(
        err instanceof Error ? err.message : "Failed to sign out. Please try again."
      );
      setIsSigningOut(false);
    }
  };

  const value: ProfileContextValue = {
    user,
    userProfile,
    refreshUserProfile,
    data,
    badges,
    discord,
    github,
    google,
    mfa,
    email: emailMgmt,
    profileSettings,
    password: {
      saving: passwordSaving,
      error: passwordError,
      success: passwordSuccess,
      setPassword,
    },
    signOut,
    signOutError,
    isSigningOut,
    handleSignOut,
  };

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}
