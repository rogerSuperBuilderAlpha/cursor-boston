/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Avatar from "@/components/Avatar";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import { useProfileContext } from "../_contexts/ProfileContext";

interface ProfileHeaderProps {
  onEditProfile: () => void;
}

export function ProfileHeader({ onEditProfile }: ProfileHeaderProps) {
  const {
    user,
    profileSettings,
    handleSignOut,
    isSigningOut,
    signOutError,
  } = useProfileContext();

  return (
    <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800 mb-8">
      <div className="flex items-center gap-5">
        {/* Avatar */}
        <button
          onClick={onEditProfile}
          className="shrink-0 relative group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-full"
          aria-label="Edit profile photo"
        >
          <Avatar src={user.photoURL} name={user.displayName} email={user.email} size="xl" />
          <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white" aria-hidden="true">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
          </div>
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl md:text-2xl font-bold text-white truncate">
              {user.displayName || "Community Member"}
            </h1>
            <button
              onClick={() => profileSettings.togglePublic(!profileSettings.settings.visibility.isPublic)}
              className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 text-xs rounded-full transition-colors ${
                profileSettings.settings.visibility.isPublic
                  ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                  : "bg-neutral-700 text-neutral-400 hover:bg-neutral-600"
              }`}
            >
              {profileSettings.settings.visibility.isPublic ? (
                <><EyeIcon /> Public</>
              ) : (
                <><EyeOffIcon /> Private</>
              )}
            </button>
          </div>
          <p className="text-neutral-400 text-sm truncate">{user.email}</p>
          <p className="text-neutral-500 text-xs mt-1">
            Member since{" "}
            {user.metadata.creationTime
              ? new Date(user.metadata.creationTime).toLocaleDateString("en-US", { year: "numeric", month: "long" })
              : "Unknown"}
          </p>
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-2">
          <button
            onClick={onEditProfile}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="px-4 py-2 bg-neutral-800 text-neutral-300 rounded-lg text-sm font-medium hover:bg-neutral-700 transition-colors disabled:opacity-50"
          >
            {isSigningOut ? "..." : "Sign Out"}
          </button>
        </div>
      </div>

      {signOutError && (
        <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {signOutError}
        </div>
      )}
    </div>
  );
}
