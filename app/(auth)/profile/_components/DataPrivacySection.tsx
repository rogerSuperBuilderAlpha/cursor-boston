/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Privacy controls in the profile Security tab. Implements:
 *   - GDPR Article 20 data portability (Download my data)
 *   - GDPR Article 17 right to erasure (Delete account)
 *
 * The delete flow requires fresh re-authentication (the API enforces a
 * 5-minute auth_time window). If the request returns 403 with the
 * fresh-auth message we tell the user to sign out and sign back in.
 */
export function DataPrivacySection() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!user) return;
    setDownloadError(null);
    setDownloading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/profile/data?format=portable", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cursor-boston-data-${user.uid}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirmText }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403 && /re-auth/i.test(body.error ?? "")) {
        setDeleteError(
          "For security, please sign out and sign back in within the last 5 minutes, then retry."
        );
        return;
      }
      if (!res.ok) {
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      // Success — sign the user out and bounce them home.
      await signOut();
      router.push("/");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  if (!user) return null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Privacy &amp; your data</h3>
        <p className="text-sm text-zinc-400">
          Export a portable copy of your data, or permanently delete your account. See the{" "}
          <a href="/privacy" className="text-emerald-400 hover:underline">
            Privacy Policy
          </a>{" "}
          for what gets retained.
        </p>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-white">Download my data</h4>
        <p className="text-xs text-zinc-500">
          Returns a JSON file with your profile, contributions, and event participation in a
          schema documented at{" "}
          <code className="text-xs text-zinc-400">cursor-boston-data-export-v1</code>.
        </p>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          {downloading ? "Preparing…" : "Download my data"}
        </button>
        {downloadError && (
          <p className="text-red-400 text-sm" role="alert">
            {downloadError}
          </p>
        )}
      </div>

      <div className="space-y-3 border-t border-zinc-800 pt-6">
        <h4 className="text-sm font-medium text-red-400">Delete my account</h4>
        <p className="text-xs text-zinc-500">
          Removes your profile and all user-keyed records. Community messages, cookbook
          entries, and Q&amp;A posts are anonymized rather than deleted so other users&apos;
          threads aren&apos;t broken. This cannot be undone.
        </p>
        {!showConfirm ? (
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="px-4 py-2 bg-red-900/40 text-red-300 border border-red-700/40 rounded-lg text-sm font-medium hover:bg-red-900/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            Delete my account…
          </button>
        ) : (
          <div className="space-y-3 rounded-lg border border-red-700/40 bg-red-950/40 p-4">
            <p className="text-sm text-red-200">
              Type <strong>DELETE</strong> below to confirm.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-red-500"
              placeholder="DELETE"
              aria-label="Type DELETE to confirm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={confirmText !== "DELETE" || deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                {deleting ? "Deleting…" : "Permanently delete my account"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  setConfirmText("");
                  setDeleteError(null);
                }}
                disabled={deleting}
                className="px-4 py-2 bg-zinc-800 text-white rounded-lg text-sm font-medium hover:bg-zinc-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                Cancel
              </button>
            </div>
            {deleteError && (
              <p className="text-red-400 text-sm" role="alert">
                {deleteError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
