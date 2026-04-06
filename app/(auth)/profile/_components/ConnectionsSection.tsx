"use client";

import {
  DiscordIcon,
  GitHubIcon,
  UserCardIcon,
} from "@/components/icons";
import { useProfileContext } from "../_contexts/ProfileContext";

export function ConnectionsSection() {
  const {
    userProfile,
    data: { connectedAgents },
    discord,
    github,
  } = useProfileContext();

  const discordInfo = discord.discordInfo;
  const githubInfo = github.githubInfo;

  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">
        Connections
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* GitHub */}
        <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-neutral-800 flex items-center justify-center">
              <GitHubIcon size={18} />
            </div>
            <div>
              <p className="text-sm font-medium text-white">GitHub</p>
              {githubInfo ? (
                <p className="text-xs text-neutral-400">{githubInfo.login}</p>
              ) : (
                <p className="text-xs text-neutral-500">Not connected</p>
              )}
            </div>
          </div>
          {githubInfo ? (
            <button
              onClick={github.disconnect}
              disabled={github.disconnecting}
              className="text-xs text-neutral-400 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              {github.disconnecting ? "..." : "Disconnect"}
            </button>
          ) : (
            <button
              onClick={github.connect}
              disabled={github.connecting}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors disabled:opacity-50"
            >
              {github.connecting ? "..." : "Connect"}
            </button>
          )}
        </div>

        {/* Discord */}
        <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#5865F2]/10 flex items-center justify-center">
              <DiscordIcon size={18} className="text-[#5865F2]" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Discord</p>
              {discordInfo ? (
                <p className="text-xs text-neutral-400">{discordInfo.username}</p>
              ) : (
                <p className="text-xs text-neutral-500">Not connected</p>
              )}
            </div>
          </div>
          {discordInfo ? (
            <button
              onClick={discord.disconnect}
              disabled={discord.disconnecting}
              className="text-xs text-neutral-400 hover:text-red-400 transition-colors disabled:opacity-50"
            >
              {discord.disconnecting ? "..." : "Disconnect"}
            </button>
          ) : (
            <button
              onClick={discord.connect}
              disabled={discord.connecting}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors disabled:opacity-50"
            >
              {discord.connecting ? "..." : "Connect"}
            </button>
          )}
        </div>
      </div>

      {/* Status badges */}
      {(connectedAgents.length > 0 ||
        userProfile?.eduBadge ||
        userProfile?.additionalEmails?.some((e) => e.verified && e.email.toLowerCase().endsWith(".edu")) ||
        userProfile?.hackASprint2026ShowcaseBadge) && (
        <div className="flex flex-wrap gap-2 mt-3">
          {connectedAgents.length > 0 && (
            <span className="px-3 py-1 bg-purple-500/10 text-purple-400 text-xs rounded-full inline-flex items-center gap-1">
              <UserCardIcon size={12} />
              {connectedAgents.length} Agent{connectedAgents.length > 1 ? "s" : ""}
            </span>
          )}
          {(userProfile?.eduBadge ||
            userProfile?.additionalEmails?.some((e) => e.verified && e.email.toLowerCase().endsWith(".edu"))) && (
            <span className="px-3 py-1 bg-amber-500/10 text-amber-400 text-xs rounded-full">.edu verified</span>
          )}
          {userProfile?.hackASprint2026ShowcaseBadge && (
            <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 text-xs rounded-full">Hack-a-Sprint &apos;26</span>
          )}
        </div>
      )}

      {(discord.error || github.error) && (
        <p className="text-red-400 text-xs mt-2">{discord.error || github.error}</p>
      )}
    </div>
  );
}
