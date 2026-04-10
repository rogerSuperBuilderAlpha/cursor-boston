/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import { useOAuthCallbacks } from "./_hooks/useOAuthCallbacks";
import { ProfileProvider, useProfileContext } from "./_contexts/ProfileContext";

import { ProfileHeader } from "./_components/ProfileHeader";
import { OnboardingChecklist } from "./_components/OnboardingChecklist";
import { ConnectionsSection } from "./_components/ConnectionsSection";
import { StatsGrid } from "./_components/StatsGrid";
import { EarnedBadgesSection } from "./_components/EarnedBadgesSection";
import { ActivitySection } from "./_components/ActivitySection";
import { SecurityTab } from "./_components/SecurityTab";
import { SettingsTab } from "./_components/SettingsTab";
import { EditProfileModal } from "./_components/EditProfileModal";

function ProfilePageContent() {
  const ctx = useProfileContext();
  const {
    user,
    userProfile,
    data: { connectedAgents, loadingAgents },
    discord,
    github,
    google,
    profileSettings,
    password,
  } = ctx;

  const { updateUserProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const initialSection = searchParams.get("section");
  const [settingsOpen, setSettingsOpen] = useState(initialSection === "settings");
  const [securityOpen, setSecurityOpen] = useState(initialSection === "security");

  // Google reconnection reset
  useEffect(() => {
    google.resetIfReconnected();
  }, [user?.providerData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup recaptcha on unmount
  useEffect(() => () => ctx.mfa.clearRecaptcha(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // OAuth callbacks
  useOAuthCallbacks({
    loading: false,
    searchParams,
    router,
    discord,
    github,
    email: ctx.email,
    refreshUserProfile: ctx.refreshUserProfile,
    setActiveTab: (tab) => {
      if (tab === "security") setSecurityOpen(true);
    },
  });

  return (
    <div className="min-h-[80vh] px-6 py-8 md:py-12">
      <div className="max-w-3xl mx-auto">
        <ProfileHeader onEditProfile={() => setIsEditModalOpen(true)} />
        <OnboardingChecklist />
        <ConnectionsSection />
        <StatsGrid />
        <EarnedBadgesSection />
        <ActivitySection />

        {/* Settings — collapsible */}
        <div className="mb-8">
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="w-full flex items-center justify-between text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3 hover:text-neutral-300 transition-colors"
          >
            <span>Profile Settings</span>
            <svg
              className={`w-4 h-4 transition-transform ${settingsOpen ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {settingsOpen && (
            <SettingsTab
              settings={profileSettings.settings}
              setSettings={profileSettings.setSettings}
              saving={profileSettings.saving}
              error={profileSettings.error}
              success={profileSettings.success}
              onSave={profileSettings.save}
              onToggleAllVisibility={profileSettings.toggleAllVisibility}
            />
          )}
        </div>

        {/* Security — collapsible */}
        <div className="mb-8">
          <button
            onClick={() => setSecurityOpen(!securityOpen)}
            className="w-full flex items-center justify-between text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3 hover:text-neutral-300 transition-colors"
          >
            <span>Security</span>
            <svg
              className={`w-4 h-4 transition-transform ${securityOpen ? "rotate-180" : ""}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {securityOpen && (
            <SecurityTab
              discord={discord}
              github={github}
              google={google}
              mfa={ctx.mfa}
              email={ctx.email}
              primaryEmail={user.email}
              additionalEmails={userProfile?.additionalEmails || []}
              hasPasswordProvider={google.hasPasswordProvider}
              connectedAgents={connectedAgents}
              loadingAgents={loadingAgents}
              onSetPassword={password.setPassword}
              passwordSaving={password.saving}
              passwordError={password.error}
              passwordSuccess={password.success}
            />
          )}
        </div>
      </div>

      {isEditModalOpen && (
        <EditProfileModal
          user={user}
          onSave={(name, photo) => updateUserProfile(name || undefined, photo)}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}
    </div>
  );
}

function ProfilePageShell() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push("/login?redirect=/profile");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white" />
      </div>
    );
  }
  if (!user) return null;

  return (
    <ProfileProvider user={user}>
      <ProfilePageContent />
    </ProfileProvider>
  );
}

export default function ProfilePage() {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <div className="min-h-[80vh] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white" />
          </div>
        }
      >
        <ProfilePageShell />
      </Suspense>
    </ErrorBoundary>
  );
}
