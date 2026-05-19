/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

type GateState = "checking" | "allowed" | "denied";

const ACCESS_API_PATH = "/api/events/pydata-2026/access";
const LOCKED_REDIRECT = "/events?pydataLocked=1";

/**
 * Client-side gate for the May 13 PyData event page. Children mount only
 * once the server confirms the signed-in user's email is on Moderna's
 * 150-person door list. Anyone else is redirected to /events with a
 * `pydataLocked=1` query the events page reads to render a banner.
 *
 * We intentionally render a neutral placeholder while checking or
 * redirecting — never the event content — so denied users don't briefly
 * see the page before the router replaces the URL.
 */
export function PyDataAccessGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<GateState>("checking");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot transition once auth resolves to "signed-out"
      setState("denied");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(ACCESS_API_PATH, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json().catch(() => ({}))) as { allowed?: boolean };
        if (cancelled) return;
        setState(json.allowed === true ? "allowed" : "denied");
      } catch {
        if (!cancelled) setState("denied");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  useEffect(() => {
    if (state === "denied") {
      router.replace(LOCKED_REDIRECT);
    }
  }, [state, router]);

  if (state === "allowed") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        {state === "checking"
          ? "Checking access…"
          : "Attendance is locked — redirecting you to the events list…"}
      </p>
    </div>
  );
}
