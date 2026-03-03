"use client";

import { useEffect, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { EmailAuthProvider, linkWithCredential, updatePassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Avatar from "@/components/Avatar";
import {
  getUserRegistrations,
  getUserStats,
  EventRegistration,
  UserStats,
} from "@/lib/registrations";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  DiscordIcon,
  GitHubIcon,
  UserCardIcon,
  EyeIcon,
  EyeOffIcon,
} from "@/components/icons";

// Hooks
import { useDiscordConnection } from "./_hooks/useDiscordConnection";
import { useGithubConnection } from "./_hooks/useGithubConnection";
import { useGoogleConnection } from "./_hooks/useGoogleConnection";
import { useMfaEnrollment } from "./_hooks/useMfaEnrollment";
import { useEmailManagement } from "./_hooks/useEmailManagement";
import { useProfileSettings } from "./_hooks/useProfileSettings";

// Components
import { OverviewTab } from "./_components/OverviewTab";
import { EventsTab } from "./_components/EventsTab";
import { TalksTab } from "./_components/TalksTab";
import { SecurityTab } from "./_components/SecurityTab";
import { SettingsTab } from "./_components/SettingsTab";
import { EditProfileModal } from "./_components/EditProfileModal";

type Tab = "overview" | "events" | "talks" | "security" | "settings";

interface TalkSubmission {
  id: string;
  title: string;
  status: string;
  submittedAt: { toDate: () => Date } | null;
}

interface ConnectedAgent {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  claimedAt?: { _seconds: number };
}

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "events", label: "My Events" },
  { id: "talks", label: "My Talks" },
  { id: "security", label: "Security" },
  { id: "settings", label: "Public Profile" },
];

function ProfilePageContent() {
  const {
    user,
    userProfile,
    loading,
    signOut,
    updateUserProfile,
    sendAddEmailVerification,
    removeAdditionalEmail,
    changePrimaryEmail,
    refreshUserProfile,
  } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  // ── Data state ────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<UserStats | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [talkSubmissions, setTalkSubmissions] = useState<TalkSubmission[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [connectedAgents, setConnectedAgents] = useState<ConnectedAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // ── Password state (kept here because it needs user from auth context) ────
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // ── Custom hooks ──────────────────────────────────────────────────────────
  const discord = useDiscordConnection(user, userProfile?.discord);
  const github = useGithubConnection(user, userProfile?.github, userProfile?.provider);
  const google = useGoogleConnection(user);
  const mfa = useMfaEnrollment(user);
  const email = useEmailManagement({ user, sendAddEmailVerification, removeAdditionalEmail, changePrimaryEmail });
  const profileSettings = useProfileSettings(user, userProfile, refreshUserProfile);

  // ── Redirect if not authed ────────────────────────────────────────────────
  useEffect(() => {
    if (!loading && !user) router.push("/login?redirect=/profile");
  }, [user, loading, router]);

  // ── Reset Google disconnected flag when provider reappears ────────────────
  useEffect(() => {
    google.resetIfReconnected();
  }, [user?.providerData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cleanup recaptcha on unmount ──────────────────────────────────────────
  useEffect(() => () => mfa.clearRecaptcha(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle Discord OAuth callback ─────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    const status = searchParams.get("discord");
    const data = searchParams.get("data");
    if (status === "success" && data) {
      discord.handleOAuthSuccess(JSON.parse(decodeURIComponent(data)));
    } else if (status === "error") {
      discord.handleOAuthError(searchParams.get("message"));
    }
  }, [searchParams, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle GitHub OAuth callback ──────────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    const status = searchParams.get("github");
    const data = searchParams.get("data");
    if (status === "success" && data) {
      github.handleOAuthSuccess(JSON.parse(decodeURIComponent(data)));
    } else if (status === "error") {
      github.handleOAuthError();
    }
  }, [searchParams, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle email verification callback ────────────────────────────────────
  useEffect(() => {
    if (loading) return;
    const emailVerification = searchParams.get("emailVerification");
    const message = searchParams.get("message");
    const tab = searchParams.get("tab");

    if (emailVerification === "success") {
      email.setVerificationStatus({ type: "success", message: "Email verified and added to your account successfully!" });
      refreshUserProfile();
      if (tab === "security") setActiveTab("security");
      router.replace("/profile", { scroll: false });
    } else if (emailVerification === "error") {
      const errorMessages: Record<string, string> = {
        missing_token: "Invalid verification link.",
        invalid_token: "This verification link is invalid or has already been used.",
        token_expired: "This verification link has expired. Please request a new one.",
        email_taken: "This email is already associated with another account.",
        server_error: "An error occurred. Please try again.",
      };
      email.setVerificationStatus({ type: "error", message: errorMessages[message || ""] || "Failed to verify email." });
      setActiveTab("security");
      router.replace("/profile", { scroll: false });
    }
  }, [searchParams, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch user data ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setLoadingData(false); return; }
    (async () => {
      try {
        const [userStats, userRegistrations] = await Promise.all([
          getUserStats(user.uid),
          getUserRegistrations(user.uid),
        ]);
        setStats(userStats);
        setRegistrations(userRegistrations);

        if (db) {
          const talksQuery = query(collection(db, "talkSubmissions"), where("userId", "==", user.uid));
          const snap = await getDocs(talksQuery);
          setTalkSubmissions(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as TalkSubmission[]);
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      } finally {
        setLoadingData(false);
      }
    })();
  }, [user]);

  // ── Fetch connected agents ────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    setLoadingAgents(true);
    (async () => {
      try {
        const res = await fetch("/api/agents/user", {
          headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        });
        const data = await res.json();
        if (data.success && data.agents) setConnectedAgents(data.agents);
      } catch (err) {
        console.error("Error fetching connected agents:", err);
      } finally {
        setLoadingAgents(false);
      }
    })();
  }, [user]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSignOut = async () => {
    setSignOutError(null);
    setIsSigningOut(true);
    try {
      await signOut();
      router.push("/");
    } catch (err) {
      setSignOutError(err instanceof Error ? err.message : "Failed to sign out. Please try again.");
      setIsSigningOut(false);
    }
  };

  const handleSetPassword = async (password: string) => {
    if (!user || !auth) return;
    setPasswordError(null);
    setPasswordSuccess(false);
    if (!user.email) { setPasswordError("No email is associated with this account."); return; }
    setPasswordSaving(true);
    try {
      if (google.hasPasswordProvider) {
        await updatePassword(user, password);
      } else {
        const credential = EmailAuthProvider.credential(user.email, password);
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

  // ── Loading / auth guard ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white" />
      </div>
    );
  }
  if (!user) return null;

  const discordInfo = discord.discordInfo;
  const githubInfo = github.githubInfo;

  return (
    <div className="min-h-[80vh] px-6 py-8 md:py-12">
      <div className="max-w-4xl mx-auto">

        {/* ── Profile Header ─────────────────────────────────────────────── */}
        <div className="bg-neutral-900 rounded-2xl p-6 md:p-8 border border-neutral-800 mb-6">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            {/* Avatar */}
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="shrink-0 relative group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 rounded-full"
              aria-label="Edit profile photo"
            >
              <Avatar src={user.photoURL} name={user.displayName} email={user.email} size="xl" />
              <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white" aria-hidden="true">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
              </div>
            </button>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-1">
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  {user.displayName || "Community Member"}
                </h1>
                {/* Public/Private badge */}
                <button
                  onClick={() => profileSettings.togglePublic(!profileSettings.settings.visibility.isPublic)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 ${
                    profileSettings.settings.visibility.isPublic
                      ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 focus-visible:ring-emerald-400"
                      : "bg-neutral-700 text-neutral-400 hover:bg-neutral-600 focus-visible:ring-neutral-400"
                  }`}
                >
                  {profileSettings.settings.visibility.isPublic ? (
                    <><EyeIcon /> Public Profile</>
                  ) : (
                    <><EyeOffIcon /> Private Profile</>
                  )}
                </button>
              </div>

              <p className="text-neutral-400 mb-3">{user.email}</p>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-sm rounded-full">Community Member</span>
                {userProfile?.provider && (
                  <span className="px-3 py-1 bg-neutral-800 text-neutral-300 text-sm rounded-full capitalize">
                    {userProfile.provider} Account
                  </span>
                )}
                {/* Discord badge */}
                {discordInfo ? (
                  <button
                    onClick={discord.disconnect}
                    disabled={discord.disconnecting}
                    className="px-3 py-1 bg-[#5865F2]/10 text-[#5865F2] text-sm rounded-full inline-flex items-center gap-1 hover:bg-[#5865F2]/20 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2] group"
                  >
                    <DiscordIcon size={14} aria-hidden="true" />
                    <span className="group-hover:hidden">{discordInfo.username}</span>
                    <span className="hidden group-hover:inline">{discord.disconnecting ? "Disconnecting..." : "Disconnect"}</span>
                  </button>
                ) : (
                  <button
                    onClick={discord.connect}
                    disabled={discord.connecting}
                    className="px-3 py-1 bg-[#5865F2] text-white text-sm rounded-full inline-flex items-center gap-1 hover:bg-[#4752C4] transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2]"
                  >
                    <DiscordIcon size={14} aria-hidden="true" />
                    {discord.connecting ? "Connecting..." : "Connect Discord"}
                  </button>
                )}
                {/* GitHub badge */}
                {githubInfo ? (
                  <button
                    onClick={github.disconnect}
                    disabled={github.disconnecting}
                    className="px-3 py-1 bg-neutral-800/50 text-white text-sm rounded-full inline-flex items-center gap-1 hover:bg-neutral-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white group"
                  >
                    <GitHubIcon size={14} aria-hidden="true" />
                    <span className="group-hover:hidden">{githubInfo.login}</span>
                    <span className="hidden group-hover:inline">{github.disconnecting ? "Disconnecting..." : "Disconnect"}</span>
                  </button>
                ) : (
                  <button
                    onClick={github.connect}
                    disabled={github.connecting}
                    className="px-3 py-1 bg-neutral-800 text-white text-sm rounded-full inline-flex items-center gap-1 hover:bg-neutral-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <GitHubIcon size={14} aria-hidden="true" />
                    {github.connecting ? "Connecting..." : "Connect GitHub"}
                  </button>
                )}
                {connectedAgents.length > 0 && (
                  <span className="px-3 py-1 bg-purple-500/10 text-purple-400 text-sm rounded-full inline-flex items-center gap-1">
                    <UserCardIcon size={14} />
                    {connectedAgents.length} Agent{connectedAgents.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {discord.error && <p className="text-red-400 text-xs mt-2">{discord.error}</p>}
              {github.error && <p className="text-red-400 text-xs mt-2">{github.error}</p>}

              {/* GitHub open source callout */}
              {github.hasGithubConnection && (
                <div className="mt-4 p-4 bg-neutral-800/60 rounded-xl border border-neutral-700">
                  <h2 className="text-sm font-semibold text-white mb-2">Contribute to the Open Source</h2>
                  <ol className="list-decimal list-inside space-y-1 text-neutral-300 text-sm">
                    <li>Pick an issue labeled &quot;good first issue&quot;.</li>
                    <li>Fork the repo, make your change, and open a PR.</li>
                    <li>Add a short test plan to your PR.</li>
                  </ol>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href="https://github.com/rogerSuperBuilderAlpha/cursor-boston" target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-neutral-700 text-white rounded-lg text-xs font-medium hover:bg-neutral-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                      Visit GitHub Repo
                    </Link>
                    <Link href="https://github.com/rogerSuperBuilderAlpha/cursor-boston?tab=contributing-ov-file#readme" target="_blank" rel="noopener noreferrer" className="px-3 py-2 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
                      Contributing Guide
                    </Link>
                  </div>
                </div>
              )}

              <p className="text-neutral-400 text-sm mt-3">
                Member since{" "}
                {user.metadata.creationTime
                  ? new Date(user.metadata.creationTime).toLocaleDateString("en-US", { year: "numeric", month: "long" })
                  : "Unknown"}
              </p>
            </div>

            {/* Actions */}
            <div className="shrink-0 flex flex-col gap-2">
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
              >
                Edit Profile
              </button>
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="px-4 py-2 bg-neutral-800 text-white rounded-lg text-sm font-medium hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
              >
                {isSigningOut ? "Signing out..." : "Sign Out"}
              </button>
            </div>
          </div>

          {signOutError && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {signOutError}
            </div>
          )}
        </div>

        {/* ── Stats ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          {[
            { label: "Events Registered", value: stats?.eventsRegistered },
            { label: "Events Attended", value: stats?.eventsAttended },
            { label: "Talks Submitted", value: stats?.talksSubmitted },
            { label: "Talks Given", value: stats?.talksGiven },
            { label: "Pull Requests", value: stats?.pullRequestsCount },
          ].map(({ label, value }) => (
            <div key={label} className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 text-center">
              <p className="text-3xl font-bold text-white">{loadingData ? "-" : value || 0}</p>
              <p className="text-neutral-400 text-sm">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Tabs ──────────────────────────────────────────────────────── */}
        <div className="border-b border-neutral-800 mb-6">
          <nav className="flex gap-6 overflow-x-auto" aria-label="Profile sections">
            {TAB_LABELS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`pb-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:text-white whitespace-nowrap ${
                  activeTab === id
                    ? "text-white border-b-2 border-emerald-500"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* ── Tab Content ───────────────────────────────────────────────── */}
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
            mfa={mfa}
            email={email}
            primaryEmail={user.email}
            additionalEmails={userProfile?.additionalEmails || []}
            hasPasswordProvider={google.hasPasswordProvider}
            connectedAgents={connectedAgents}
            loadingAgents={loadingAgents}
            onSetPassword={handleSetPassword}
            passwordSaving={passwordSaving}
            passwordError={passwordError}
            passwordSuccess={passwordSuccess}
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

      {/* ── Edit Profile Modal ──────────────────────────────────────────── */}
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
        <ProfilePageContent />
      </Suspense>
    </ErrorBoundary>
  );
}
