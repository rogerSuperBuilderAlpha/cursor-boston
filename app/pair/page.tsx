"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import type {
  PairProfile,
  MatchScore,
  PairRequest,
  SessionType,
} from "@/lib/pair-programming/types";
import Image from "next/image";
import { getPairProfile, getAllActiveProfiles } from "@/lib/pair-programming/data";
import { getTopMatches } from "@/lib/pair-programming/matching";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface PublicUser {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
}

export default function PairProgrammingPage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<PairProfile | null>(null);
  const [matches, setMatches] = useState<MatchScore[]>([]);
  const [requests, setRequests] = useState<PairRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [userProfiles, setUserProfiles] = useState<Record<string, PublicUser>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch user's pair profile
  useEffect(() => {
    async function fetchProfile() {
      if (!user || !db) {
        setLoading(false);
        return;
      }

      try {
        const userProfile = await getPairProfile(user.uid);
        setProfile(userProfile);
        setShowProfileForm(!userProfile);
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading && user) {
      fetchProfile();
    }
  }, [user, authLoading, refreshKey]);

  // Fetch matches
  useEffect(() => {
    async function fetchMatches() {
      if (!user || !profile || !profile.isActive || !db) return;

      try {
        const allProfiles = await getAllActiveProfiles();
        const topMatches = await getTopMatches(profile, allProfiles, 20);
        setMatches(topMatches);

        // Fetch user profiles for display names/photos
        const userIds = topMatches.map((m) => m.userId);
        const profilePromises = userIds.map(async (uid) => {
          if (!db) return { uid, displayName: null, photoURL: null };
          const userDoc = await getDoc(doc(db, "users", uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            return {
              uid,
              displayName: data.displayName || null,
              photoURL: data.photoURL || null,
            };
          }
          return { uid, displayName: null, photoURL: null };
        });
        const profiles = await Promise.all(profilePromises);
        const profileMap: Record<string, PublicUser> = {};
        profiles.forEach((p) => {
          profileMap[p.uid] = p;
        });
        setUserProfiles(profileMap);
      } catch (error) {
        console.error("Error fetching matches:", error);
      }
    }

    if (profile && profile.isActive) {
      fetchMatches();
    }
  }, [user, profile]);

  // Fetch requests
  useEffect(() => {
    async function fetchRequests() {
      if (!user) return;

      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/pair/request?type=received", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        if (data.success) {
          setRequests(data.requests || []);
        }
      } catch (error) {
        console.error("Error fetching requests:", error);
      }
    }

    if (user) {
      fetchRequests();
    }
  }, [user]);

  const handleSendRequest = useCallback(
    async (toUserId: string, sessionType: SessionType, message: string) => {
      if (!user) return;

      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/pair/request", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            toUserId,
            sessionType,
            message,
          }),
        });

        const data = await response.json();
        if (data.success) {
          alert("Pair request sent successfully!");
        } else {
          alert(`Error: ${data.error}`);
        }
      } catch (error) {
        console.error("Error sending request:", error);
        alert("Failed to send request. Please try again.");
      }
    },
    [user]
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-4">Pair Programming Matchmaker</h1>
          <p className="text-neutral-600 dark:text-neutral-300 mb-6">
            Sign in to find your perfect pair programming partner.
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
          <h1 className="text-3xl font-bold mb-6">Create Your Pair Programming Profile</h1>
          <ProfileForm
            user={user}
            existingProfile={profile}
            onSave={() => {
              setShowProfileForm(false);
              setRefreshKey((k) => k + 1);
            }}
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
            <h1 className="text-3xl font-bold mb-2">Pair Programming Matchmaker</h1>
            <p className="text-neutral-600 dark:text-neutral-300">
              Find your perfect coding partner based on complementary skills
            </p>
          </div>
          <button
            onClick={() => setShowProfileForm(true)}
            className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            Edit Profile
          </button>
        </div>

        {/* Pending Requests */}
        {requests.length > 0 && (
          <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h2 className="font-semibold mb-2">You have {requests.length} pending request(s)</h2>
            <Link
              href="/pair/requests"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              View requests →
            </Link>
          </div>
        )}

        {/* Matches Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {matches.map((match) => {
            const userProfile = userProfiles[match.userId];
            return (
              <MatchCard
                key={match.userId}
                match={match}
                userProfile={userProfile}
                onSendRequest={(sessionType, message) =>
                  handleSendRequest(match.userId, sessionType, message)
                }
              />
            );
          })}
        </div>

        {matches.length === 0 && (
          <div className="text-center py-12 text-neutral-600 dark:text-neutral-300">
            <p>No matches found yet. Check back later or update your profile!</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MatchCard({
  match,
  userProfile,
  onSendRequest,
}: {
  match: MatchScore;
  userProfile?: PublicUser;
  onSendRequest: (sessionType: SessionType, message: string) => void;
}) {
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [sessionType, setSessionType] = useState<SessionType>("build-together");
  const [message, setMessage] = useState("");

  const handleSubmit = () => {
    if (!message.trim()) {
      alert("Please enter a message");
      return;
    }
    onSendRequest(sessionType, message);
    setShowRequestForm(false);
    setMessage("");
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {userProfile?.photoURL ? (
            <Image
              src={userProfile.photoURL}
              alt={userProfile.displayName || "User"}
              width={48}
              height={48}
              className="w-12 h-12 rounded-full"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
              <span className="text-neutral-500">
                {userProfile?.displayName?.[0]?.toUpperCase() || "?"}
              </span>
            </div>
          )}
          <div>
            <h3 className="font-semibold">
              {userProfile?.displayName || "Anonymous User"}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <div
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  match.score >= 80
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : match.score >= 60
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                }`}
              >
                {match.score}% match
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
          Why you match:
        </p>
        <ul className="text-sm space-y-1">
          {match.reasons.slice(0, 3).map((reason, idx) => (
            <li key={idx} className="text-neutral-700 dark:text-neutral-300">
              • {reason}
            </li>
          ))}
        </ul>
      </div>

      {showRequestForm ? (
        <div className="space-y-3">
          <select
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value as SessionType)}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
          >
            <option value="teach-me">Teach Me</option>
            <option value="build-together">Build Together</option>
            <option value="code-review">Code Review Swap</option>
            <option value="explore-topic">Explore a Topic</option>
          </select>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Send a message..."
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
            rows={3}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors"
            >
              Send Request
            </button>
            <button
              onClick={() => setShowRequestForm(false)}
              className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowRequestForm(true)}
          className="w-full px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors"
        >
          Send Pair Request
        </button>
      )}
    </div>
  );
}

function ProfileForm({
  user,
  existingProfile,
  onSave,
}: {
  user: { getIdToken: () => Promise<string> };
  existingProfile: PairProfile | null;
  onSave: () => void;
}) {
  const [skillsCanTeach, setSkillsCanTeach] = useState<string[]>(
    existingProfile?.skillsCanTeach || []
  );
  const [skillsWantToLearn, setSkillsWantToLearn] = useState<string[]>(
    existingProfile?.skillsWantToLearn || []
  );
  const [preferredLanguages, setPreferredLanguages] = useState<string[]>(
    existingProfile?.preferredLanguages || []
  );
  const [preferredFrameworks, setPreferredFrameworks] = useState<string[]>(
    existingProfile?.preferredFrameworks || []
  );
  const [timezone, setTimezone] = useState(existingProfile?.timezone || "America/New_York");
  const [sessionTypes, setSessionTypes] = useState<SessionType[]>(
    existingProfile?.sessionTypes || []
  );
  const [bio, setBio] = useState(existingProfile?.bio || "");
  const [isActive, setIsActive] = useState(existingProfile?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const [newSkillTeach, setNewSkillTeach] = useState("");
  const [newSkillLearn, setNewSkillLearn] = useState("");
  const [newLanguage, setNewLanguage] = useState("");
  const [newFramework, setNewFramework] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionTypes.length === 0) {
      alert("Please select at least one session type");
      return;
    }

    setSaving(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/pair/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          skillsCanTeach,
          skillsWantToLearn,
          preferredLanguages,
          preferredFrameworks,
          timezone,
          availability: existingProfile?.availability || [],
          sessionTypes,
          bio,
          isActive,
        }),
      });

      const data = await response.json();
      if (data.success) {
        onSave();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      alert("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Skills Can Teach */}
      <div>
        <label className="block text-sm font-medium mb-2">Skills I Can Teach</label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newSkillTeach}
            onChange={(e) => setNewSkillTeach(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (newSkillTeach.trim() && !skillsCanTeach.includes(newSkillTeach.trim())) {
                  setSkillsCanTeach([...skillsCanTeach, newSkillTeach.trim()]);
                  setNewSkillTeach("");
                }
              }
            }}
            placeholder="Add skill (press Enter)"
            className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {skillsCanTeach.map((skill, idx) => (
            <span
              key={idx}
              className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-sm flex items-center gap-2"
            >
              {skill}
              <button
                type="button"
                onClick={() => setSkillsCanTeach(skillsCanTeach.filter((_, i) => i !== idx))}
                className="hover:text-emerald-900"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Skills Want to Learn */}
      <div>
        <label className="block text-sm font-medium mb-2">Skills I Want to Learn</label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newSkillLearn}
            onChange={(e) => setNewSkillLearn(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (newSkillLearn.trim() && !skillsWantToLearn.includes(newSkillLearn.trim())) {
                  setSkillsWantToLearn([...skillsWantToLearn, newSkillLearn.trim()]);
                  setNewSkillLearn("");
                }
              }
            }}
            placeholder="Add skill (press Enter)"
            className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {skillsWantToLearn.map((skill, idx) => (
            <span
              key={idx}
              className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm flex items-center gap-2"
            >
              {skill}
              <button
                type="button"
                onClick={() => setSkillsWantToLearn(skillsWantToLearn.filter((_, i) => i !== idx))}
                className="hover:text-blue-900"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Languages & Frameworks */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Preferred Languages</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newLanguage}
              onChange={(e) => setNewLanguage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (newLanguage.trim() && !preferredLanguages.includes(newLanguage.trim())) {
                    setPreferredLanguages([...preferredLanguages, newLanguage.trim()]);
                    setNewLanguage("");
                  }
                }
              }}
              placeholder="e.g., TypeScript"
              className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {preferredLanguages.map((lang, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded text-sm"
              >
                {lang}
                <button
                  type="button"
                  onClick={() => setPreferredLanguages(preferredLanguages.filter((_, i) => i !== idx))}
                  className="ml-1"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Preferred Frameworks</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newFramework}
              onChange={(e) => setNewFramework(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (newFramework.trim() && !preferredFrameworks.includes(newFramework.trim())) {
                    setPreferredFrameworks([...preferredFrameworks, newFramework.trim()]);
                    setNewFramework("");
                  }
                }
              }}
              placeholder="e.g., Next.js"
              className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {preferredFrameworks.map((fw, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800 rounded text-sm"
              >
                {fw}
                <button
                  type="button"
                  onClick={() => setPreferredFrameworks(preferredFrameworks.filter((_, i) => i !== idx))}
                  className="ml-1"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Timezone */}
      <div>
        <label className="block text-sm font-medium mb-2">Timezone</label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg"
        >
          <option value="America/New_York">Eastern Time (ET)</option>
          <option value="America/Chicago">Central Time (CT)</option>
          <option value="America/Denver">Mountain Time (MT)</option>
          <option value="America/Los_Angeles">Pacific Time (PT)</option>
          <option value="UTC">UTC</option>
        </select>
      </div>

      {/* Session Types */}
      <div>
        <label className="block text-sm font-medium mb-2">Session Types I&apos;m Interested In</label>
        <div className="space-y-2">
          {(["teach-me", "build-together", "code-review", "explore-topic"] as SessionType[]).map(
            (type) => (
              <label key={type} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={sessionTypes.includes(type)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSessionTypes([...sessionTypes, type]);
                    } else {
                      setSessionTypes(sessionTypes.filter((t) => t !== type));
                    }
                  }}
                />
                <span className="capitalize">{type.replace("-", " ")}</span>
              </label>
            )
          )}
        </div>
      </div>

      {/* Bio */}
      <div>
        <label className="block text-sm font-medium mb-2">Bio (Optional)</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg"
          placeholder="Tell potential partners about yourself..."
        />
      </div>

      {/* Active Toggle */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="isActive"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        <label htmlFor="isActive" className="text-sm">
          Make my profile active (visible to others)
        </label>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="w-full px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Profile"}
      </button>
    </form>
  );
}
