/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  jobId: string;
  applyUrl?: string | null;
}

export default function ApplySection({ jobId, applyUrl }: Props) {
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.displayName ?? "");
      setEmail(user.email ?? "");
    }
  }, [user]);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!user || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const { getIdToken } = await import("firebase/auth");
      const token = await getIdToken(user);

      const res = await fetch("/api/careers/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jobId, name, email, message }),
      });

      if (res.ok) {
        setSubmitted(true);
      } else {
        const data = (await res.json()) as { error?: string };
        setSubmitError(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (applyUrl) {
    return (
      <a
        href={applyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
      >
        Apply Now
        <ExternalLink className="h-4 w-4" strokeWidth={2} aria-hidden />
      </a>
    );
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-6 text-center">
        <p className="text-emerald-700 dark:text-emerald-400 font-semibold text-lg">
          Application submitted!
        </p>
        <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-2">
          The company will be in touch if there&apos;s a match.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 p-6 text-center">
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          Sign in to apply for this role.
        </p>
        <Link
          href={`/login?redirect=/careers/${jobId}`}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-400 transition-colors"
        >
          Sign in to apply
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={(e) => void handleApply(e)} className="space-y-5">
      <div>
        <label
          htmlFor="apply-name"
          className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5"
        >
          Name
        </label>
        <input
          id="apply-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={100}
          className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-foreground placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          placeholder="Your full name"
        />
      </div>

      <div>
        <label
          htmlFor="apply-email"
          className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5"
        >
          Email
        </label>
        <input
          id="apply-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          maxLength={254}
          className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-foreground placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label
          htmlFor="apply-message"
          className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5"
        >
          Cover message
        </label>
        <textarea
          id="apply-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          maxLength={2000}
          rows={6}
          className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-foreground placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-y"
          placeholder="Tell the company why you're a great fit…"
        />
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1 text-right">
          {message.length}/2000
        </p>
      </div>

      {submitError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full sm:w-auto px-8 py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
      >
        {submitting ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
            Submitting…
          </span>
        ) : (
          "Submit Application"
        )}
      </button>
    </form>
  );
}
