/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import Link from "next/link";
import { useProfileContext } from "../_contexts/ProfileContext";

export function ActivitySection() {
  const {
    data: { registrations, talkSubmissions, loadingData },
  } = useProfileContext();

  if (loadingData) {
    return (
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">
          Activity
        </h2>
        <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800 text-center">
          <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-neutral-400 mx-auto" />
        </div>
      </div>
    );
  }

  const hasEvents = registrations.length > 0;
  const hasTalks = talkSubmissions.length > 0;

  if (!hasEvents && !hasTalks) {
    return (
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">
          Activity
        </h2>
        <div className="bg-neutral-900 rounded-xl p-8 border border-neutral-800 text-center">
          <p className="text-neutral-400 text-sm mb-3">No activity yet</p>
          <div className="flex justify-center gap-3">
            <Link
              href="/events"
              className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 transition-colors"
            >
              Browse Events
            </Link>
            <Link
              href="/talks/submit"
              className="px-4 py-2 bg-neutral-800 text-white rounded-lg text-sm font-medium hover:bg-neutral-700 transition-colors"
            >
              Submit a Talk
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const statusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "attended":
      case "approved":
      case "completed":
        return "bg-emerald-500/10 text-emerald-400";
      case "cancelled":
      case "rejected":
        return "bg-red-500/10 text-red-400";
      case "registered":
        return "bg-blue-500/10 text-blue-400";
      default:
        return "bg-amber-500/10 text-amber-400";
    }
  };

  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">
        Activity
      </h2>
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 divide-y divide-neutral-800">
        {/* Events */}
        {hasEvents && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-neutral-300">Events</h3>
              <Link href="/events" className="text-xs text-emerald-400 hover:text-emerald-300">
                Browse all
              </Link>
            </div>
            <div className="space-y-2">
              {registrations.slice(0, 5).map((reg) => (
                <div key={reg.id} className="flex items-center justify-between py-1.5">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{reg.eventTitle}</p>
                    {reg.eventDate && (
                      <p className="text-xs text-neutral-500">{reg.eventDate}</p>
                    )}
                  </div>
                  <span className={`shrink-0 ml-3 px-2 py-0.5 text-xs rounded-full ${statusColor(reg.status)}`}>
                    {reg.status}
                  </span>
                </div>
              ))}
              {registrations.length > 5 && (
                <p className="text-xs text-neutral-500 pt-1">
                  +{registrations.length - 5} more event{registrations.length - 5 > 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Talks */}
        {hasTalks && (
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-neutral-300">Talks</h3>
              <Link href="/talks/submit" className="text-xs text-emerald-400 hover:text-emerald-300">
                Submit a talk
              </Link>
            </div>
            <div className="space-y-2">
              {talkSubmissions.slice(0, 5).map((talk) => (
                <div key={talk.id} className="flex items-center justify-between py-1.5">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{talk.title}</p>
                    {talk.submittedAt && (
                      <p className="text-xs text-neutral-500">
                        {talk.submittedAt.toDate().toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <span className={`shrink-0 ml-3 px-2 py-0.5 text-xs rounded-full ${statusColor(talk.status)}`}>
                    {talk.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
