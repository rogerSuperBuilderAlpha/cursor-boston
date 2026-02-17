"use client";

import Image from "next/image";
import Link from "next/link";
import { User } from "firebase/auth";
import { getInitials } from "@/lib/utils";

interface PostComposerProps {
  user: User | null;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  posting: boolean;
  placeholder?: string;
  submitLabel?: string;
  minLength?: number;
  maxLength?: number;
}

export function PostComposer({
  user,
  value,
  onChange,
  onSubmit,
  posting,
  placeholder = "What's on your mind?",
  submitLabel = "Post",
  minLength = 100,
  maxLength = 500,
}: PostComposerProps) {
  const trimmed = value.trim();
  const isValid = trimmed.length >= minLength && trimmed.length <= maxLength;

  if (!user) {
    return (
      <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800 mb-6 text-center">
        <p className="text-neutral-400 mb-4">Sign in to post messages</p>
        <Link
          href="/login?redirect=/members"
          className="inline-block px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 transition-colors"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 mb-6">
      <div className="flex gap-3">
        <div className="shrink-0">
          {user.photoURL ? (
            <Image
              src={user.photoURL}
              alt={user.displayName || "You"}
              width={40}
              height={40}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-white font-semibold">
              {getInitials(user.displayName || user.email)}
            </div>
          )}
        </div>
        <div className="flex-1">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={3}
            maxLength={maxLength}
            className="w-full bg-transparent text-white placeholder-neutral-400 resize-none focus:outline-none"
          />
          <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
            <span className={`text-xs ${
              trimmed.length < minLength
                ? "text-red-400"
                : trimmed.length > maxLength
                ? "text-red-400"
                : "text-neutral-500"
            }`}>
              {value.length}/{maxLength} (minimum {minLength})
            </span>
            <button
              onClick={onSubmit}
              disabled={posting || !isValid}
              className="px-5 py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 min-h-[44px]"
            >
              {posting ? "Posting..." : submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
