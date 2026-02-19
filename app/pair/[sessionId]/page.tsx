"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getPairSessionsForUser } from "@/lib/pair-programming/data";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PairSession, SessionNotes } from "@/lib/pair-programming/types";

interface PublicUser {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
}

export default function SessionDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const [session, setSession] = useState<PairSession | null>(null);
  const [otherUser, setOtherUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<SessionNotes | null>(null);
  const [savingNotes, setSavingNotes] = useState(false);

  useEffect(() => {
    async function fetchSession() {
      if (!user || !db || !sessionId) {
        setLoading(false);
        return;
      }

      try {
        const sessionDoc = await getDoc(doc(db, "pair_sessions", sessionId));
        if (!sessionDoc.exists()) {
          setLoading(false);
          return;
        }

        const sessionData = { id: sessionDoc.id, ...sessionDoc.data() } as PairSession;
        
        // Verify user is a participant
        if (!sessionData.participantIds.includes(user.uid)) {
          alert("You don't have access to this session");
          router.push("/pair");
          return;
        }

        setSession(sessionData);

        // Fetch other participant's profile
        const otherUserId = sessionData.participantIds.find((id) => id !== user.uid);
        if (otherUserId) {
          const userDoc = await getDoc(doc(db, "users", otherUserId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setOtherUser({
              uid: otherUserId,
              displayName: userData.displayName || null,
              photoURL: userData.photoURL || null,
            });
          }
        }

        // Load user's notes if they exist
        if (sessionData.notes && sessionData.notes.participantId === user.uid) {
          setNotes(sessionData.notes);
        }
      } catch (error) {
        console.error("Error fetching session:", error);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading && user) {
      fetchSession();
    }
  }, [user, authLoading, sessionId, router]);

  const handleStartSession = async () => {
    if (!db || !sessionId) return;

    try {
      await updateDoc(doc(db, "pair_sessions", sessionId), {
        status: "in-progress",
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setSession((prev) => prev ? { ...prev, status: "in-progress" } : null);
    } catch (error) {
      console.error("Error starting session:", error);
      alert("Failed to start session");
    }
  };

  const handleCompleteSession = async () => {
    if (!db || !sessionId || !notes) {
      alert("Please add session notes before completing");
      return;
    }

    try {
      await updateDoc(doc(db, "pair_sessions", sessionId), {
        status: "completed",
        completedAt: serverTimestamp(),
        notes,
        updatedAt: serverTimestamp(),
      });
      setSession((prev) => prev ? { ...prev, status: "completed" } : null);
      alert("Session completed!");
    } catch (error) {
      console.error("Error completing session:", error);
      alert("Failed to complete session");
    }
  };

  const handleSaveNotes = async () => {
    if (!db || !sessionId || !notes) return;

    setSavingNotes(true);
    try {
      await updateDoc(doc(db, "pair_sessions", sessionId), {
        notes,
        updatedAt: serverTimestamp(),
      });
      alert("Notes saved!");
    } catch (error) {
      console.error("Error saving notes:", error);
      alert("Failed to save notes");
    } finally {
      setSavingNotes(false);
    }
  };

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
          <h1 className="text-2xl font-bold mb-4">Session Details</h1>
          <p className="text-neutral-600 dark:text-neutral-300 mb-6">
            Sign in to view session details.
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

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-4">Session Not Found</h1>
          <Link
            href="/pair"
            className="text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            ← Back to Pair Programming
          </Link>
        </div>
      </div>
    );
  }

  const sessionTypeLabels: Record<PairSession["sessionType"], string> = {
    "teach-me": "Teach Me",
    "build-together": "Build Together",
    "code-review": "Code Review Swap",
    "explore-topic": "Explore a Topic",
  };

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/pair"
          className="text-emerald-600 dark:text-emerald-400 hover:underline mb-6 inline-block"
        >
          ← Back to Pair Programming
        </Link>

        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold mb-2">Pair Programming Session</h1>
              <p className="text-neutral-600 dark:text-neutral-300">
                {sessionTypeLabels[session.sessionType]}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                session.status === "scheduled"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  : session.status === "in-progress"
                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                    : session.status === "completed"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              {session.status}
            </span>
          </div>

          {/* Partner Info */}
          {otherUser && (
            <div className="flex items-center gap-4 mb-6 p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
              {otherUser.photoURL ? (
                <img
                  src={otherUser.photoURL}
                  alt={otherUser.displayName || "Partner"}
                  className="w-16 h-16 rounded-full"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
                  <span className="text-2xl text-neutral-500">
                    {otherUser.displayName?.[0]?.toUpperCase() || "?"}
                  </span>
                </div>
              )}
              <div>
                <h3 className="font-semibold text-lg">
                  {otherUser.displayName || "Anonymous User"}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">Your Pair Partner</p>
              </div>
            </div>
          )}

          {/* Session Actions */}
          {session.status === "scheduled" && (
            <button
              onClick={handleStartSession}
              className="w-full px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors mb-6"
            >
              Start Session
            </button>
          )}

          {/* Session Notes */}
          {(session.status === "in-progress" || session.status === "completed") && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Session Notes</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    What We Worked On
                  </label>
                  <textarea
                    value={notes?.whatWeWorkedOn || ""}
                    onChange={(e) =>
                      setNotes({
                        participantId: user.uid,
                        whatWeWorkedOn: e.target.value,
                        whatILearned: notes?.whatILearned || "",
                        nextSteps: notes?.nextSteps,
                      })
                    }
                    rows={4}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg"
                    placeholder="Describe what you worked on together..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    What I Learned
                  </label>
                  <textarea
                    value={notes?.whatILearned || ""}
                    onChange={(e) =>
                      setNotes({
                        participantId: user.uid,
                        whatWeWorkedOn: notes?.whatWeWorkedOn || "",
                        whatILearned: e.target.value,
                        nextSteps: notes?.nextSteps,
                      })
                    }
                    rows={4}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg"
                    placeholder="What did you learn from this session?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Next Steps (Optional)
                  </label>
                  <textarea
                    value={notes?.nextSteps || ""}
                    onChange={(e) =>
                      setNotes({
                        participantId: user.uid,
                        whatWeWorkedOn: notes?.whatWeWorkedOn || "",
                        whatILearned: notes?.whatILearned || "",
                        nextSteps: e.target.value,
                      })
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg"
                    placeholder="Any follow-up actions or topics to explore..."
                  />
                </div>
              </div>
              {session.status === "in-progress" && (
                <div className="flex gap-3">
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="px-6 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                  >
                    {savingNotes ? "Saving..." : "Save Notes"}
                  </button>
                  <button
                    onClick={handleCompleteSession}
                    className="px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors"
                  >
                    Complete Session
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
