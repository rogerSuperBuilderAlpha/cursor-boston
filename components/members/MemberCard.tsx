/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import Image from "next/image";
import type { PublicMember } from "@/types/members";
import { getInitials } from "@/lib/utils";
import { DiscordIcon, GitHubIcon } from "@/components/icons";
import { BADGE_DEFINITIONS } from "@/lib/badges/definitions";
import { evaluateBadgeEligibility } from "@/lib/badges/eligibility";
import type { BadgeEligibilityInput, BadgeId } from "@/lib/badges/types";
import { getBaseBadgeEligibilityInput } from "@/lib/badges/getBadgeEligibilityInput";
import { getEarnedBadgeIds } from "@/lib/badges/utils";
import { BadgeGrid } from "@/components/badges/BadgeGrid";

interface MemberCardProps {
  member: PublicMember;
}

export function MemberCard({ member }: MemberCardProps) {
  const v = member.visibility;
  const isAgent = member.memberType === "agent";
  const badgeInput = {
    ...getBaseBadgeEligibilityInput({
      displayName: member.displayName,
      bio: member.bio ?? null,
      photoURL: member.photoURL,
      discord: member.discord,
      github: member.github,
    }),
    eventsAttendedCount: member.eventsAttended ?? 0,
    talksGivenCount: member.talksGiven ?? 0,
    pullRequestsCount: member.pullRequestsCount ?? 0,
  } satisfies BadgeEligibilityInput;

  const badgeEligibilityMap = evaluateBadgeEligibility(badgeInput);
  const persistedBadgeOverlay = (member.earnedBadgeIds || []).reduce<
    Partial<Record<BadgeId, true>>
  >((acc, badgeId) => {
    const matchingDefinition = BADGE_DEFINITIONS.find(
      (definition) => definition.id === badgeId
    );
    if (matchingDefinition) {
      acc[matchingDefinition.id] = true;
    }
    return acc;
  }, {});
  const earnedBadgeIds = getEarnedBadgeIds(
    BADGE_DEFINITIONS,
    badgeEligibilityMap,
    persistedBadgeOverlay
  );
  const previewDefinitions = [
    ...BADGE_DEFINITIONS.filter((definition) => earnedBadgeIds.includes(definition.id)),
    ...BADGE_DEFINITIONS.filter((definition) => !earnedBadgeIds.includes(definition.id)),
  ].slice(0, 3);

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        <div className="relative shrink-0">
          {member.photoURL ? (
            <Image
              src={member.photoURL}
              alt={member.displayName || "Member"}
              width={56}
              height={56}
              className="rounded-full object-cover"
            />
          ) : (
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-foreground font-semibold text-lg ${
              isAgent ? "bg-purple-900/50" : "bg-neutral-100 dark:bg-neutral-800"
            }`}>
              {isAgent ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="10" rx="2" />
                  <circle cx="12" cy="5" r="2" />
                  <path d="M12 7v4" />
                  <circle cx="8" cy="16" r="1" fill="currentColor" />
                  <circle cx="16" cy="16" r="1" fill="currentColor" />
                </svg>
              ) : (
                getInitials(member.displayName)
              )}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-foreground font-semibold text-lg truncate">
              {member.displayName || "Anonymous"}
            </h3>
            {/* Member Type Tag */}
            <span className={`shrink-0 px-2 py-0.5 text-xs rounded-full font-medium ${
              isAgent 
                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30" 
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
            }`}>
              {isAgent ? "Agent" : "Human"}
            </span>
          </div>
          {!isAgent && v?.showJobTitle && member.jobTitle && (
            <p className="text-neutral-600 dark:text-neutral-400 text-sm truncate">{member.jobTitle}</p>
          )}
          {!isAgent && v?.showCompany && member.company && (
            <p className="text-neutral-600 dark:text-neutral-400 text-sm truncate">{member.company}</p>
          )}
          {isAgent && member.owner?.displayName && v?.showOwner && (
            <p className="text-neutral-600 dark:text-neutral-400 text-sm truncate">
              Owned by {member.owner.displayName}
            </p>
          )}
        </div>
      </div>

      {/* Bio */}
      {v?.showBio && member.bio && (
        <p className="text-neutral-700 dark:text-neutral-300 text-sm mb-4 line-clamp-3">{member.bio}</p>
      )}

      {/* Location */}
      {v?.showLocation && member.location && (
        <div className="flex items-center gap-2 text-neutral-600 dark:text-neutral-400 text-sm mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {member.location}
        </div>
      )}

      {/* Badges */}
      <div className="flex flex-wrap gap-2 mb-4">
        {v?.showDiscord && member.discord && (
          <span className="px-2 py-1 bg-[#5865F2]/10 text-[#5865F2] text-xs rounded-full inline-flex items-center gap-1">
            <DiscordIcon size={12} />
            Discord
          </span>
        )}
        {v?.showGithubBadge && member.github && (
          <span className="px-2 py-1 bg-neutral-100 text-neutral-900 dark:bg-neutral-800/50 dark:text-white text-xs rounded-full inline-flex items-center gap-1">
            <GitHubIcon size={12} />
            GitHub
          </span>
        )}
        {v?.showEventsAttended && member.eventsAttended && member.eventsAttended > 0 && (
          <span className="px-2 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs rounded-full">
            {member.eventsAttended} event{member.eventsAttended !== 1 ? "s" : ""} attended
          </span>
        )}
        {v?.showTalksGiven && member.talksGiven && member.talksGiven > 0 && (
          <span className="px-2 py-1 bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs rounded-full">
            {member.talksGiven} talk{member.talksGiven !== 1 ? "s" : ""} given
          </span>
        )}
        {member.pullRequestsCount && member.pullRequestsCount > 0 && (
          <span className="px-2 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs rounded-full">
            {member.pullRequestsCount} PR{member.pullRequestsCount !== 1 ? "s" : ""}
          </span>
        )}
        {member.hackASprint2026ShowcaseBadge && (
          <span className="px-2 py-1 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 text-xs rounded-full">
            Hack-a-Sprint &apos;26
          </span>
        )}
      </div>

      <div className="mb-4">
        <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
          Preview only. Final badge status appears on profile.
        </p>
        <BadgeGrid
          definitions={previewDefinitions}
          eligibilityMap={badgeEligibilityMap}
          earnedBadgeIds={earnedBadgeIds}
          compact
        />
      </div>

      {/* Social Links */}
      <div className="flex items-center gap-1 pt-4 border-t border-neutral-200 dark:border-neutral-800 -ml-2">
        {v?.showWebsite && member.socialLinks?.website && (
          <a
            href={member.socialLinks.website}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Website (opens in new tab)"
            className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white rounded p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
              <path d="M2 12h20" />
            </svg>
          </a>
        )}
        {v?.showLinkedIn && member.socialLinks?.linkedIn && (
          <a
            href={member.socialLinks.linkedIn}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn (opens in new tab)"
            className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white rounded p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a>
        )}
        {v?.showTwitter && member.socialLinks?.twitter && (
          <a
            href={member.socialLinks.twitter}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X/Twitter (opens in new tab)"
            className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white rounded p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>
        )}
        {v?.showGithub && member.socialLinks?.github && (
          <a
            href={member.socialLinks.github}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub (opens in new tab)"
            className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white rounded p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
        )}
        {v?.showSubstack && member.socialLinks?.substack && (
          <a
            href={member.socialLinks.substack}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Substack (opens in new tab)"
            className="text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 dark:focus-visible:ring-white rounded p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z"/>
            </svg>
          </a>
        )}
        {v?.showMemberSince && member.createdAt && typeof member.createdAt.toDate === "function" && (
          <span className="text-neutral-400 text-xs ml-auto">
            Member since{" "}
            {member.createdAt.toDate().toLocaleDateString("en-US", {
              month: "short",
              year: "numeric",
            })}
          </span>
        )}
      </div>
    </div>
  );
}
