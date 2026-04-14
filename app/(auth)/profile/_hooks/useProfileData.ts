/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect, useState } from "react";
import type {
  EventRegistration,
  UserStats,
} from "@/lib/registrations";
import type { ProfileDataApiResponse, ProfileRegistrationJson, ProfileTalkJson } from "@/lib/profile-data-types";
import type { User } from "firebase/auth";
import type { TalkSubmission, ConnectedAgent } from "../_types";

function reviveRegistration(r: ProfileRegistrationJson): EventRegistration {
  const iso = r.registeredAt;
  return {
    ...r,
    registeredAt: iso
      ? ({ toDate: () => new Date(iso) } as EventRegistration["registeredAt"])
      : ({ toDate: () => new Date(0) } as EventRegistration["registeredAt"]),
  };
}

function reviveTalk(t: ProfileTalkJson): TalkSubmission {
  const submitted = t.submittedAt;
  return {
    id: t.id,
    title: t.title,
    status: t.status,
    submittedAt: submitted ? { toDate: () => new Date(submitted) } : null,
  };
}

export function useProfileData(user: User | null, githubLogin?: string | null) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [talkSubmissions, setTalkSubmissions] = useState<TalkSubmission[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [connectedAgents, setConnectedAgents] = useState<ConnectedAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [profileBundle, setProfileBundle] = useState<ProfileDataApiResponse | null>(null);

  useEffect(() => {
    if (!user) {
      setLoadingData(false);
      setStats(null);
      setRegistrations([]);
      setTalkSubmissions([]);
      setProfileBundle(null);
      return;
    }

    (async () => {
      setLoadingData(true);
      try {
        const token = await user.getIdToken();
        const headers = { Authorization: `Bearer ${token}` };
        let res = await fetch("/api/profile/data", { headers });
        if (!res.ok) {
          throw new Error(`profile data HTTP ${res.status}`);
        }
        let json = (await res.json()) as ProfileDataApiResponse;

        if (githubLogin && (json.stats.pullRequestsCount ?? 0) === 0) {
          const token2 = await user.getIdToken();
          const res2 = await fetch("/api/profile/data?reconcileGithub=1", {
            headers: { Authorization: `Bearer ${token2}` },
          });
          if (res2.ok) {
            json = (await res2.json()) as ProfileDataApiResponse;
          }
        }

        setStats(json.stats);
        setRegistrations(json.registrations.map(reviveRegistration));
        setTalkSubmissions(json.talks.map(reviveTalk));
        setProfileBundle(json);
      } catch (err) {
        console.error("Error fetching user data:", err);
        setStats(null);
        setRegistrations([]);
        setTalkSubmissions([]);
        setProfileBundle(null);
      } finally {
        setLoadingData(false);
      }
    })();
  }, [user, githubLogin]);

  useEffect(() => {
    if (!user) return;
    setLoadingAgents(true);
    (async () => {
      try {
        const res = await fetch("/api/agents/user", {
          headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        });
        const data = await res.json();
        if (data.success && data.agents) setConnectedAgents(data.agents);
      } catch (err) {
        console.error("Error fetching connected agents:", err);
      } finally {
        setLoadingAgents(false);
      }
    })();
  }, [user]);

  return {
    stats,
    registrations,
    talkSubmissions,
    connectedAgents,
    loadingData,
    loadingAgents,
    profileBundle,
  };
}
