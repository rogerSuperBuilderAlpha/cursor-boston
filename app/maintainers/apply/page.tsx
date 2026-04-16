/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { DiscordIcon, GitHubIcon } from "@/components/icons";
import {
  MAINTAINER_APPLICATION_BRANCH,
  buildMaintainerApplicationDraft,
  formatMaintainerApplicationJson,
  getMaintainerApplicationBranchTreeUrl,
  getMaintainerApplicationFilePath,
  getMaintainerApplicationRepoBaseUrl,
} from "@/lib/maintainer-application";

const panelClass =
  "rounded-xl border border-neutral-800 bg-neutral-950/60 p-6 md:p-8";

export default function MaintainerApplyPage() {
  const router = useRouter();
  const { user, userProfile, loading } = useAuth();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/maintainers/status", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as { eligible?: boolean };
        if (data.eligible) {
          router.replace("/maintainers/dashboard");
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user, router]);

  const githubLogin = userProfile?.github?.login?.trim() ?? "";
  const hasGithub = Boolean(githubLogin);
  const hasDiscord = Boolean(userProfile?.discord?.username);
  const discordUsername = userProfile?.discord?.username ?? "";
  const requirementsMet = Boolean(user && githubLogin && hasDiscord);

  const repoBase = getMaintainerApplicationRepoBaseUrl();
  const branchTreeUrl = getMaintainerApplicationBranchTreeUrl();
  const filePath = githubLogin ? getMaintainerApplicationFilePath(githubLogin) : "maintainer-applications/<your-github-username>.json";

  const jsonBody = useMemo(() => {
    if (!requirementsMet || !githubLogin || !discordUsername) {
      return "";
    }
    const displayName =
      userProfile?.displayName?.trim() ||
      user?.displayName?.trim() ||
      githubLogin;
    const draft = buildMaintainerApplicationDraft({
      githubLogin,
      discordUsername,
      displayName,
      siteEmail: user?.email ?? null,
    });
    return formatMaintainerApplicationJson(draft);
  }, [
    requirementsMet,
    githubLogin,
    discordUsername,
    user?.displayName,
    user?.email,
    userProfile?.displayName,
  ]);

  const copyJson = async () => {
    if (!jsonBody) return;
    try {
      await navigator.clipboard.writeText(jsonBody);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-col">
      <section className="py-14 md:py-20 px-6 border-b border-neutral-800">
        <div className="max-w-3xl mx-auto text-center">
          <p className="mb-6 text-left sm:text-center">
            <Link
              href="/maintainers"
              className="text-sm text-neutral-500 hover:text-emerald-400 transition-colors"
            >
              ← Maintainers
            </Link>
          </p>
          <div className="inline-flex items-center justify-center w-14 h-14 bg-violet-500/10 rounded-2xl mb-5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-violet-400"
              aria-hidden
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Apply to be a maintainer</h1>
          <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
            Maintainers help review contributions, keep CI healthy, and guide Cursor Boston&apos;s open
            source work. Applications are a small JSON file merged via pull request.
          </p>
        </div>
      </section>

      <section className="py-10 md:py-14 px-6">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className={panelClass}>
            <h2 className="text-lg font-semibold text-white mb-3">How it works</h2>
            <ol className="list-decimal list-inside space-y-2 text-neutral-300 text-sm md:text-base">
              <li>
                Sign in to{" "}
                <Link href="/login?redirect=/maintainers/apply" className="text-emerald-400 hover:underline">
                  cursorboston.com
                </Link>
                .
              </li>
              <li>
                On your{" "}
                <Link href="/profile" className="text-emerald-400 hover:underline">
                  profile
                </Link>
                , connect <strong className="text-white">GitHub</strong> and{" "}
                <strong className="text-white">Discord</strong> so we can verify identity across the site,
                Discord, and GitHub.
              </li>
              <li>
                Fork{" "}
                <a
                  href={repoBase}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:underline"
                >
                  the Cursor Boston repository
                </a>
                , branch from <code className="text-violet-300">{MAINTAINER_APPLICATION_BRANCH}</code>, and add
                your JSON file at the path shown below (only visible once both accounts are connected).
              </li>
              <li>
                Open a pull request <strong className="text-white">into</strong>{" "}
                <code className="text-violet-300">{MAINTAINER_APPLICATION_BRANCH}</code> (not{" "}
                <code className="text-neutral-500">develop</code> or <code className="text-neutral-500">main</code>
                ).
              </li>
            </ol>
            <p className="mt-4 text-sm text-neutral-500">
              Base branch in the repo:{" "}
              <a
                href={branchTreeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline"
              >
                {MAINTAINER_APPLICATION_BRANCH}
              </a>
              .
            </p>
          </div>

          <div className={panelClass}>
            <h2 className="text-lg font-semibold text-white mb-4">Connection checklist</h2>
            {loading ? (
              <p className="text-neutral-400 text-sm">Loading your profile…</p>
            ) : !user ? (
              <p className="text-neutral-300 text-sm">
                <Link href="/login?redirect=/maintainers/apply" className="text-emerald-400 font-medium hover:underline">
                  Sign in
                </Link>{" "}
                to see whether your GitHub and Discord connections are complete.
              </p>
            ) : (
              <ul className="space-y-3">
                <li className="flex flex-wrap items-center gap-2 text-sm">
                  <GitHubIcon size={18} />
                  <span className={hasGithub ? "text-emerald-400" : "text-neutral-400"}>
                    {hasGithub ? `GitHub connected as @${githubLogin || "…"}` : "GitHub not connected"}
                  </span>
                  {!hasGithub && (
                    <Link
                      href="/profile"
                      className="text-emerald-400 hover:underline text-sm font-medium"
                    >
                      Connect on profile
                    </Link>
                  )}
                </li>
                <li className="flex flex-wrap items-center gap-2 text-sm">
                  <DiscordIcon size={18} />
                  <span className={hasDiscord ? "text-emerald-400" : "text-neutral-400"}>
                    {hasDiscord
                      ? `Discord connected as ${discordUsername}`
                      : "Discord not connected"}
                  </span>
                  {!hasDiscord && (
                    <Link
                      href="/profile"
                      className="text-emerald-400 hover:underline text-sm font-medium"
                    >
                      Connect on profile
                    </Link>
                  )}
                </li>
              </ul>
            )}

            {!loading && user && !requirementsMet && (
              <p className="mt-4 text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                Connect both GitHub and Discord on your profile to unlock the JSON template, exact file path,
                and copy button.
              </p>
            )}
          </div>

          {requirementsMet && jsonBody && (
            <div className={panelClass}>
              <h2 className="text-lg font-semibold text-white mb-2">Your application file</h2>
              <p className="text-sm text-neutral-400 mb-4">
                Add this file in your branch (paths are case-sensitive). Replace the empty strings and set{" "}
                <code className="text-violet-300">agreedToCodeOfConduct</code> to{" "}
                <code className="text-violet-300">true</code> after you have read our{" "}
                <Link href="/code-of-conduct" className="text-emerald-400 hover:underline">
                  Code of Conduct
                </Link>
                . Update <code className="text-violet-300">submittedAt</code> when you open the PR.
              </p>
              <p className="text-sm font-mono text-violet-200/90 bg-neutral-900/80 border border-neutral-800 rounded-lg px-3 py-2 mb-4 break-all">
                {filePath}
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => void copyJson()}
                  className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                >
                  {copied ? "Copied" : "Copy JSON"}
                </button>
                <Link
                  href="/profile"
                  className="px-4 py-2 bg-neutral-800 text-white text-sm font-medium rounded-lg hover:bg-neutral-700 transition-colors inline-flex items-center"
                >
                  Edit profile
                </Link>
              </div>
              <pre className="text-xs md:text-sm text-neutral-300 bg-neutral-900 border border-neutral-800 rounded-lg p-4 overflow-x-auto whitespace-pre">
                {jsonBody}
              </pre>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
