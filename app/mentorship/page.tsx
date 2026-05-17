/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getMentorshipProfile } from "@/lib/mentorship/data";
import { SectionHelp } from "@/components/SectionHelp";
import type {
  MentorshipProfile,
  MentorshipMatchScore,
  MentorshipAvailability,
  MentorshipRole,
} from "@/lib/mentorship/types";

interface PublicUser {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MentorshipPage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<MentorshipProfile | null>(null);
  const [matches, setMatches] = useState<MentorshipMatchScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [userProfiles, setUserProfiles] = useState<Record<string, PublicUser>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function fetchProfile() {
      if (!user || !db) { setLoading(false); return; }
      try {
        const userProfile = await getMentorshipProfile(user.uid);
        setProfile(userProfile);
        setShowProfileForm(!userProfile);
      } catch (error) {
        console.error("Error fetching mentorship profile:", error);
      } finally {
        setLoading(false);
      }
    }
    if (!authLoading && user) fetchProfile();
  }, [user, authLoading, refreshKey]);

  useEffect(() => {
    async function fetchMatches() {
      if (!user || !profile || !profile.isActive || !db) return;
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/mentorship/matches", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!data.success) {
          console.error("Error fetching matches:", data.error);
          return;
        }
        const topMatches: MentorshipMatchScore[] = data.matches;
        setMatches(topMatches);

        const profileMap: Record<string, PublicUser> = {};
        await Promise.all(
          topMatches.map(async (m) => {
            if (!db) return;
            const snap = await getDoc(doc(db, "users", m.userId));
            if (snap.exists()) {
              const d = snap.data();
              profileMap[m.userId] = { uid: m.userId, displayName: d.displayName || null, photoURL: d.photoURL || null };
            } else {
              profileMap[m.userId] = { uid: m.userId, displayName: null, photoURL: null };
            }
          })
        );
        setUserProfiles(profileMap);
      } catch (error) {
        console.error("Error fetching mentorship matches:", error);
      }
    }
    if (profile?.isActive) fetchMatches();
  }, [user, profile]);

  const handleSendRequest = useCallback(
    async (toUserId: string, goals: string[], message: string) => {
      if (!user) return;
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/mentorship/request", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ toUserId, goals, message }),
        });
        const data = await res.json();
        if (data.success) {
          alert("Mentorship request sent!");
        } else {
          alert(`Error: ${data.error}`);
        }
      } catch {
        alert("Failed to send request. Please try again.");
      }
    },
    [user]
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-4">Mentorship Matching</h1>
          <p className="text-neutral-600 dark:text-neutral-300 mb-6">
            Sign in to find a mentor or offer your expertise as a mentor.
          </p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (!profile || showProfileForm) {
    return (
      <div className="min-h-screen py-12 px-6">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">
            {profile ? "Edit Your Mentorship Profile" : "Set Up Your Mentorship Profile"}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mb-8">
            Tell us your role and what you want to teach or learn.
          </p>
          <ProfileForm
            user={user}
            existingProfile={profile}
            onSave={() => { setShowProfileForm(false); setRefreshKey((k) => k + 1); }}
            onCancel={profile ? () => setShowProfileForm(false) : undefined}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Mentorship Matching</h1>
            <p className="text-neutral-600 dark:text-neutral-300">
              {profile.role === "mentor"
                ? "Mentees who could benefit from your expertise"
                : profile.role === "mentee"
                  ? "Mentors who can help you reach your goals"
                  : "Top matches based on your expertise and goals"}
            </p>
          </div>
          <button
            onClick={() => setShowProfileForm(true)}
            className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-sm"
          >
            Edit Profile
          </button>
        </div>

        <SectionHelp
          title="How mentorship matching works"
          intro={
            <>
              Set up a profile as a mentor, mentee, or both. We surface the
              top matches based on shared expertise, learning goals, and
              overlapping availability. You initiate the connection — there
              are no automatic introductions.
            </>
          }
          faq={[
            {
              q: "How is mentorship different from pair programming?",
              a: "Mentorship is an ongoing relationship aimed at growth in specific skills. Pair sessions in /pair are one-off and focused on a shared task or block.",
            },
            {
              q: "What if I don't get a response?",
              a: "Mentors are volunteers and may be at capacity. Send focused requests with clear goals; if you hear nothing in 7 days, reach out to another good match.",
            },
            {
              q: "Can I be both a mentor and a mentee?",
              a: "Yes — pick the \"Both\" role when setting up your profile. You'll appear in matches for both sides.",
            },
          ]}
          links={[
            { label: "Try pair programming instead", href: "/pair" },
            {
              label: "Discord — #mentorship channel",
              href: "https://discord.gg/Wsncg8YYqc",
              external: true,
            },
          ]}
        />

        {/* Profile summary badge */}
        <div className="mb-8 flex items-center gap-3 p-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl">
          <RoleBadge role={profile.role} />
          {profile.expertise.length > 0 && (
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              Expertise: {profile.expertise.slice(0, 3).join(", ")}{profile.expertise.length > 3 ? ` +${profile.expertise.length - 3}` : ""}
            </span>
          )}
          {profile.learningGoals.length > 0 && (
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              Goals: {profile.learningGoals.slice(0, 2).join(", ")}{profile.learningGoals.length > 2 ? ` +${profile.learningGoals.length - 2}` : ""}
            </span>
          )}
        </div>

        {/* Matches Grid */}
        {matches.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {matches.map((match) => (
              <MatchCard
                key={match.userId}
                match={match}
                userProfile={userProfiles[match.userId]}
                onSendRequest={(goals, message) => handleSendRequest(match.userId, goals, message)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-neutral-500">
            <p className="text-lg mb-2">No matches found yet.</p>
            <p className="text-sm">Add more expertise or learning goals to your profile to improve matching.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: MentorshipRole }) {
  const config = {
    mentor: { label: "Mentor", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
    mentee: { label: "Mentee", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
    both: { label: "Mentor & Mentee", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  };
  const { label, className } = config[role];
  return <span className={`px-3 py-1 rounded-full text-xs font-semibold ${className}`}>{label}</span>;
}

function MatchCard({
  match,
  userProfile,
  onSendRequest,
}: {
  match: MentorshipMatchScore;
  userProfile?: PublicUser;
  onSendRequest: (goals: string[], message: string) => void;
}) {
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const addGoal = () => {
    const trimmed = goalInput.trim();
    if (trimmed && !goals.includes(trimmed) && goals.length < 5) {
      setGoals([...goals, trimmed]);
      setGoalInput("");
    }
  };

  const handleSubmit = () => {
    if (goals.length === 0) { alert("Add at least one goal"); return; }
    if (!message.trim()) { alert("Please enter a message"); return; }
    onSendRequest(goals, message);
    setShowRequestForm(false);
    setGoals([]);
    setMessage("");
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Avatar
            src={userProfile?.photoURL}
            name={userProfile?.displayName}
            size={48}
            className="shrink-0"
          />
          <div>
            <h3 className="font-semibold">{userProfile?.displayName || "Anonymous"}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  match.score >= 80
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : match.score >= 60
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                }`}
              >
                {match.score}% match
              </span>
            </div>
          </div>
        </div>
      </div>

      <ul className="text-sm space-y-1 mb-4 flex-1">
        {match.reasons.slice(0, 3).map((reason, idx) => (
          <li key={idx} className="text-neutral-600 dark:text-neutral-400">• {reason}</li>
        ))}
      </ul>

      {showRequestForm ? (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Goals (up to 5)</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addGoal(); } }}
                placeholder="e.g. Learn TypeScript"
                className="flex-1 px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
              />
              <button type="button" onClick={addGoal} className="px-3 py-1.5 text-sm bg-neutral-100 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700">
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1">
              {goals.map((g, i) => (
                <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-xs">
                  {g}
                  <button type="button" onClick={() => setGoals(goals.filter((_, j) => j !== i))} className="hover:text-red-500">×</button>
                </span>
              ))}
            </div>
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Introduce yourself and why you'd like to connect..."
            className="w-full px-3 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
            rows={3}
          />
          <div className="flex gap-2">
            <button onClick={handleSubmit} className="flex-1 px-4 py-2 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-400 transition-colors">
              Send Request
            </button>
            <button onClick={() => setShowRequestForm(false)} className="px-4 py-2 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowRequestForm(true)}
          className="w-full px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors text-sm"
        >
          Request Mentorship
        </button>
      )}
    </div>
  );
}

function ProfileForm({
  user,
  existingProfile,
  onSave,
  onCancel,
}: {
  user: { getIdToken: () => Promise<string> };
  existingProfile: MentorshipProfile | null;
  onSave: () => void;
  onCancel?: () => void;
}) {
  const [role, setRole] = useState<MentorshipRole>(existingProfile?.role || "mentee");
  const [expertise, setExpertise] = useState<string[]>(existingProfile?.expertise || []);
  const [learningGoals, setLearningGoals] = useState<string[]>(existingProfile?.learningGoals || []);
  const [preferredLanguages, setPreferredLanguages] = useState<string[]>(existingProfile?.preferredLanguages || []);
  const [timezone, setTimezone] = useState(existingProfile?.timezone || "America/New_York");
  const [availability, setAvailability] = useState<MentorshipAvailability[]>(existingProfile?.availability || []);
  const [newDay, setNewDay] = useState(1);
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("17:00");
  const [availabilityError, setAvailabilityError] = useState("");
  const [maxMentees, setMaxMentees] = useState<number>(existingProfile?.maxMentees ?? 2);
  const [bio, setBio] = useState(existingProfile?.bio || "");
  const [isActive, setIsActive] = useState(existingProfile?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const [newExpertise, setNewExpertise] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [newLanguage, setNewLanguage] = useState("");

  const addTag = (
    value: string,
    list: string[],
    setList: (v: string[]) => void,
    setInput: (v: string) => void
  ) => {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) {
      setList([...list, trimmed]);
      setInput("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/mentorship/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          role,
          expertise,
          learningGoals,
          preferredLanguages,
          timezone,
          availability,
          bio,
          maxMentees: role !== "mentee" ? maxMentees : undefined,
          isActive,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onSave();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Role */}
      <div>
        <label className="block text-sm font-medium mb-2">I want to</label>
        <div className="flex gap-3">
          {(["mentor", "mentee", "both"] as MentorshipRole[]).map((r) => (
            <label
              key={r}
              className={`flex-1 text-center px-4 py-3 rounded-xl border-2 cursor-pointer transition-colors ${
                role === r
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                  : "border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600"
              }`}
            >
              <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="sr-only" />
              <span className="text-sm font-medium capitalize">
                {r === "both" ? "Both (mentor & mentee)" : r === "mentor" ? "Be a mentor" : "Find a mentor"}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Expertise */}
      {(role === "mentor" || role === "both") && (
        <div>
          <label className="block text-sm font-medium mb-2">My Expertise</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newExpertise}
              onChange={(e) => setNewExpertise(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(newExpertise, expertise, setExpertise, setNewExpertise); } }}
              placeholder="e.g. React, System Design (press Enter)"
              className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {expertise.map((s, i) => (
              <span key={i} className="flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm">
                {s}
                <button type="button" onClick={() => setExpertise(expertise.filter((_, j) => j !== i))} className="hover:text-red-500">×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Learning Goals */}
      {(role === "mentee" || role === "both") && (
        <div>
          <label className="block text-sm font-medium mb-2">What I Want to Learn</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(newGoal, learningGoals, setLearningGoals, setNewGoal); } }}
              placeholder="e.g. Machine Learning, Architecture (press Enter)"
              className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {learningGoals.map((g, i) => (
              <span key={i} className="flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                {g}
                <button type="button" onClick={() => setLearningGoals(learningGoals.filter((_, j) => j !== i))} className="hover:text-red-500">×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Languages */}
      <div>
        <label className="block text-sm font-medium mb-2">Preferred Languages / Frameworks</label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newLanguage}
            onChange={(e) => setNewLanguage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(newLanguage, preferredLanguages, setPreferredLanguages, setNewLanguage); } }}
            placeholder="e.g. TypeScript, Next.js (press Enter)"
            className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {preferredLanguages.map((l, i) => (
            <span key={i} className="flex items-center gap-1 px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded text-sm">
              {l}
              <button type="button" onClick={() => setPreferredLanguages(preferredLanguages.filter((_, j) => j !== i))} className="ml-1 hover:text-red-500">×</button>
            </span>
          ))}
        </div>
      </div>

      {/* Timezone */}
      <div>
        <label className="block text-sm font-medium mb-2">Timezone</label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
        >
          <option value="America/New_York">Eastern Time (ET)</option>
          <option value="America/Chicago">Central Time (CT)</option>
          <option value="America/Denver">Mountain Time (MT)</option>
          <option value="America/Los_Angeles">Pacific Time (PT)</option>
          <option value="UTC">UTC</option>
        </select>
      </div>

      {/* Availability */}
      <fieldset>
        <legend className="block text-sm font-medium mb-2">Availability</legend>
        <div className="flex flex-wrap gap-2 mb-3">
          <select
            value={newDay}
            onChange={(e) => { setNewDay(Number(e.target.value)); setAvailabilityError(""); }}
            className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
          >
            {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
          <input
            type="time"
            value={newStart}
            onChange={(e) => { setNewStart(e.target.value); setAvailabilityError(""); }}
            className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
          />
          <span className="self-center text-sm text-neutral-500">to</span>
          <input
            type="time"
            value={newEnd}
            onChange={(e) => { setNewEnd(e.target.value); setAvailabilityError(""); }}
            className="px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
          />
          <button
            type="button"
            onClick={() => {
              if (newStart >= newEnd) { setAvailabilityError("End time must be after start time"); return; }
              const isDupe = availability.some((w) => w.dayOfWeek === newDay && w.startTime === newStart && w.endTime === newEnd);
              if (isDupe) { setAvailabilityError("This window has already been added"); return; }
              setAvailability([...availability, { dayOfWeek: newDay, startTime: newStart, endTime: newEnd }]);
              setNewDay(1); setNewStart("09:00"); setNewEnd("17:00"); setAvailabilityError("");
            }}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors"
          >
            Add
          </button>
        </div>
        {availabilityError && <p className="text-sm text-red-500 mb-2">{availabilityError}</p>}
        <div className="space-y-2">
          {availability.map((w) => (
            <div key={`${w.dayOfWeek}-${w.startTime}-${w.endTime}`} className="flex items-center justify-between px-3 py-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg text-sm">
              <span>{DAY_SHORT[w.dayOfWeek]} {w.startTime}–{w.endTime}</span>
              <button
                type="button"
                aria-label={`Remove ${DAY_SHORT[w.dayOfWeek]} ${w.startTime}–${w.endTime}`}
                onClick={() => setAvailability(availability.filter((a) => !(a.dayOfWeek === w.dayOfWeek && a.startTime === w.startTime && a.endTime === w.endTime)))}
                className="text-neutral-400 hover:text-red-500 transition-colors"
              >
                ×
              </button>
            </div>
          ))}
          {availability.length === 0 && <p className="text-sm text-neutral-400">No availability windows added yet.</p>}
        </div>
      </fieldset>

      {/* Max Mentees (mentor/both only) */}
      {(role === "mentor" || role === "both") && (
        <div>
          <label className="block text-sm font-medium mb-2">
            Max concurrent mentees
          </label>
          <input
            type="number"
            min={1}
            max={10}
            value={maxMentees}
            onChange={(e) => setMaxMentees(Number(e.target.value))}
            className="w-24 px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
          />
        </div>
      )}

      {/* Bio */}
      <div>
        <label className="block text-sm font-medium mb-2">Bio (Optional)</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          maxLength={1000}
          className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
          placeholder="Share your background, what you're working on, or what kind of mentorship you're looking for..."
        />
        <p className="text-xs text-neutral-400 mt-1 text-right">{bio.length}/1000</p>
      </div>

      {/* Active toggle */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isActive"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="rounded"
        />
        <label htmlFor="isActive" className="text-sm">
          Make my profile active (visible to others for matching)
        </label>
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Profile"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-3 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
