"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  getUserRegistrations,
  getUserStats,
  type EventRegistration,
  type UserStats,
} from "@/lib/registrations";
import type { User } from "firebase/auth";
import type { TalkSubmission, ConnectedAgent } from "../_types";

export function useProfileData(user: User | null) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [talkSubmissions, setTalkSubmissions] = useState<TalkSubmission[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [connectedAgents, setConnectedAgents] = useState<ConnectedAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Fetch stats, registrations, and talks
  useEffect(() => {
    if (!user) {
      setLoadingData(false);
      return;
    }
    (async () => {
      try {
        const [userStats, userRegistrations] = await Promise.all([
          getUserStats(user.uid),
          getUserRegistrations(user.uid),
        ]);
        setStats(userStats);
        setRegistrations(userRegistrations);

        if (db) {
          const talksQuery = query(
            collection(db, "talkSubmissions"),
            where("userId", "==", user.uid)
          );
          const snap = await getDocs(talksQuery);
          setTalkSubmissions(
            snap.docs.map((d) => ({ id: d.id, ...d.data() })) as TalkSubmission[]
          );
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
      } finally {
        setLoadingData(false);
      }
    })();
  }, [user]);

  // Fetch connected agents
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

  return { stats, registrations, talkSubmissions, connectedAgents, loadingData, loadingAgents };
}
