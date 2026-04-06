"use client";

import Link from "next/link";
import Avatar from "@/components/Avatar";
import {
  DiscordIcon,
  GitHubIcon,
  UserCardIcon,
  EyeIcon,
  EyeOffIcon,
} from "@/components/icons";
import { useProfileContext } from "../_contexts/ProfileContext";

interface ProfileHeaderProps {
  onEditProfile: () => void;
}

export function ProfileHeader({ onEditProfile }: ProfileHeaderProps) {
  const {
    user,
    userProfile,
    data: { connectedAgents },
    discord,
    github,
    profileSettings,
    handleSignOut,
    isSigningOut,
    signOutError,
  } = useProfileContext();

  const discordInfo = discord.discordInfo;
  const githubInfo = github.githubInfo;

  return (
    <div className="bg-neutral-900 rounded-2xl p-6 md:p-8 border border-neutral-800 mb-6">
      <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
        {/* Avatar */}
        <button
          onClick={onEditProfile}
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

          {/* Badge pills */}
          <div className="flex flex-wrap gap-2 justify-center md:justify-start">
            <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-sm rounded-full">Community Member</span>
            {userProfile?.provider && (
              <span className="px-3 py-1 bg-neutral-800 text-neutral-300 text-sm rounded-full capitalize">
                {userProfile.provider} Account
              </span>
            )}
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
            {(userProfile?.eduBadge ||
              userProfile?.additionalEmails?.some(
                (e) => e.verified && e.email.toLowerCase().endsWith(".edu")
              )) && (
              <span className="px-3 py-1 bg-amber-500/10 text-amber-400 text-sm rounded-full">
                .edu
              </span>
            )}
            {userProfile?.hackASprint2026ShowcaseBadge && (
              <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 text-sm rounded-full">
                Hack-a-Sprint &apos;26 showcase
              </span>
            )}
          </div>

          {discord.error && <p className="text-red-400 text-xs mt-2">{discord.error}</p>}
          {github.error && <p className="text-red-400 text-xs mt-2">{github.error}</p>}

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
            onClick={onEditProfile}
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
  );
}
