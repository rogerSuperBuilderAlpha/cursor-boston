"use client";

import { useEffect, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import type { Tab } from "./_types";
import { TAB_LABELS } from "./_types";
import { useOAuthCallbacks } from "./_hooks/useOAuthCallbacks";
import { ProfileProvider, useProfileContext } from "./_contexts/ProfileContext";

import { ProfileHeader } from "./_components/ProfileHeader";
import { StatsGrid } from "./_components/StatsGrid";
import { EarnedBadgesSection } from "./_components/EarnedBadgesSection";
import { ProfileTabs } from "./_components/ProfileTabs";
import { OverviewTab } from "./_components/OverviewTab";
import { EventsTab } from "./_components/EventsTab";
import { TalksTab } from "./_components/TalksTab";
import { SecurityTab } from "./_components/SecurityTab";
import { SettingsTab } from "./_components/SettingsTab";
import { EditProfileModal } from "./_components/EditProfileModal";

function ProfilePageContent() {
  const ctx = useProfileContext();
  const {
    user,
    userProfile,
    data: { registrations, talkSubmissions, connectedAgents, loadingData, loadingAgents },
    discord,
    github,
    google,
    profileSettings,
    password,
  } = ctx;

  const { updateUserProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = (searchParams.get("tab") as Tab) || "overview";
  const [activeTab, setActiveTab] = useState<Tab>(
    TAB_LABELS.some((t) => t.id === initialTab) ? initialTab : "overview"
  );
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

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
    setActiveTab,
  });

  return (
    <div className="min-h-[80vh] px-6 py-8 md:py-12">
      <div className="max-w-4xl mx-auto">
        <ProfileHeader onEditProfile={() => setIsEditModalOpen(true)} />
        <StatsGrid />
        <EarnedBadgesSection />
        <ProfileTabs activeTab={activeTab} setActiveTab={setActiveTab} />

        {activeTab === "overview" && (
          <OverviewTab
            registrations={registrations}
            talkSubmissions={talkSubmissions}
            connectedAgents={connectedAgents}
            loadingData={loadingData}
            loadingAgents={loadingAgents}
          />
        )}
        {activeTab === "events" && (
          <EventsTab registrations={registrations} loadingData={loadingData} />
        )}
        {activeTab === "talks" && (
          <TalksTab talkSubmissions={talkSubmissions} loadingData={loadingData} />
        )}
        {activeTab === "security" && (
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
        {activeTab === "settings" && (
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
