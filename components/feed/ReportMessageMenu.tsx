/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const REASONS: { value: string; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "hate", label: "Hate speech" },
  { value: "self-harm", label: "Self-harm" },
  { value: "other", label: "Other" },
];

const MAX_NOTES_LENGTH = 500;

/**
 * Per-message report menu. Renders a three-dot trigger that, when
 * clicked, shows a form with reason + optional notes. Submits to
 * `POST /api/community/report`. Only the message author and admins
 * see action buttons in MessageCard; everyone else gets this menu.
 */
export function ReportMessageMenu({ messageId }: { messageId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("spam");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!user) return;
    setSubmitting(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/community/report", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ targetMessageId: messageId, reason, notes }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  if (submitted) {
    return (
      <span className="text-xs text-emerald-400" role="status">
        ✓ Reported
      </span>
    );
  }

  return (
    <div className="relative">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Report message"
          className="text-neutral-500 hover:text-neutral-300 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        </button>
      ) : (
        <div className="absolute right-0 top-full mt-1 w-72 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-zinc-900 p-3 shadow-lg z-10 space-y-2">
          <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">Report this message</p>
          <label className="block text-xs text-neutral-500">
            Reason
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full px-2 py-1 bg-neutral-100 dark:bg-zinc-800 border border-neutral-300 dark:border-neutral-700 rounded text-sm text-neutral-900 dark:text-white"
            >
              {REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-neutral-500">
            Notes (optional)
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, MAX_NOTES_LENGTH))}
              rows={2}
              className="mt-1 w-full px-2 py-1 bg-neutral-100 dark:bg-zinc-800 border border-neutral-300 dark:border-neutral-700 rounded text-sm text-neutral-900 dark:text-white"
              placeholder="Anything that helps a moderator decide…"
            />
          </label>
          {error && (
            <p className="text-xs text-red-400" role="alert">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              disabled={submitting}
              className="px-3 py-1 text-xs text-neutral-500 hover:text-neutral-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting}
              className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-500 disabled:opacity-50"
            >
              {submitting ? "Sending…" : "Submit report"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
