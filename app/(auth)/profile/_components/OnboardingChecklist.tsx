"use client";

import Link from "next/link";
import { useProfileContext } from "../_contexts/ProfileContext";

interface ChecklistItem {
  label: string;
  done: boolean;
  action?: () => void;
  href?: string;
  description: string;
}

export function OnboardingChecklist() {
  const {
    user,
    userProfile,
    data: { stats },
    discord,
    github,
    profileSettings,
  } = useProfileContext();

  const items: ChecklistItem[] = [
    {
      label: "Create your account",
      done: true,
      description: "You're in!",
    },
    {
      label: "Add a profile photo",
      done: Boolean(user.photoURL),
      description: "Help the community recognize you",
    },
    {
      label: "Write a short bio",
      done: Boolean(userProfile?.bio?.trim()),
      description: "Tell people what you're building",
    },
    {
      label: "Connect GitHub",
      done: Boolean(github.githubInfo),
      action: github.githubInfo ? undefined : github.connect,
      description: github.githubInfo
        ? `Connected as ${github.githubInfo.login}`
        : "Link your GitHub to track contributions",
    },
    {
      label: "Connect Discord",
      done: Boolean(discord.discordInfo),
      action: discord.discordInfo ? undefined : discord.connect,
      description: discord.discordInfo
        ? `Connected as ${discord.discordInfo.username}`
        : "Join the Cursor Boston community server",
    },
    {
      label: "Make your profile public",
      done: profileSettings.settings.visibility.isPublic,
      action: profileSettings.settings.visibility.isPublic
        ? undefined
        : () => profileSettings.togglePublic(true),
      description: "Show up on the Members page",
    },
    {
      label: "Submit a pull request",
      done: (stats?.pullRequestsCount ?? 0) > 0,
      href: "https://github.com/rogerSuperBuilderAlpha/cursor-boston",
      description: "Contribute to the community repo",
    },
  ];

  const completed = items.filter((i) => i.done).length;
  const total = items.length;
  const allDone = completed === total;

  if (allDone) return null;

  const pct = Math.round((completed / total) * 100);

  return (
    <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Get Started</h2>
        <span className="text-sm text-neutral-400">
          {completed}/{total} complete
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-neutral-800 rounded-full mb-5 overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Checklist */}
      <div className="space-y-1">
        {items.map((item) => {
          const content = (
            <div
              className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                item.done
                  ? "opacity-60"
                  : "hover:bg-neutral-800/60 cursor-pointer"
              }`}
            >
              {/* Checkbox */}
              <div
                className={`shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  item.done
                    ? "bg-emerald-500 border-emerald-500"
                    : "border-neutral-600"
                }`}
              >
                {item.done && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${item.done ? "text-neutral-400 line-through" : "text-white"}`}>
                  {item.label}
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">{item.description}</p>
              </div>

              {!item.done && (item.action || item.href) && (
                <span className="shrink-0 text-xs text-emerald-400 font-medium mt-0.5">
                  {item.href ? "Open" : "Connect"} &rarr;
                </span>
              )}
            </div>
          );

          if (!item.done && item.href) {
            return (
              <Link key={item.label} href={item.href} target="_blank" rel="noopener noreferrer">
                {content}
              </Link>
            );
          }

          if (!item.done && item.action) {
            return (
              <button key={item.label} onClick={item.action} className="w-full text-left">
                {content}
              </button>
            );
          }

          return <div key={item.label}>{content}</div>;
        })}
      </div>
    </div>
  );
}
