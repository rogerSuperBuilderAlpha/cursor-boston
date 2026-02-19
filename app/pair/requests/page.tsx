"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import type { PairRequest, SessionType } from "@/lib/pair-programming/types";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface PublicUser {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
}

export default function PairRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const [sentRequests, setSentRequests] = useState<PairRequest[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<PairRequest[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, PublicUser>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"sent" | "received">("received");

  useEffect(() => {
    async function fetchRequests() {
      if (!user || !db) {
        setLoading(false);
        return;
      }

      try {
        const token = await user.getIdToken();

        // Fetch sent requests
        const sentResponse = await fetch("/api/pair/request?type=sent", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const sentData = await sentResponse.json();
        if (sentData.success) {
          setSentRequests(sentData.requests || []);
        }

        // Fetch received requests
        const receivedResponse = await fetch("/api/pair/request?type=received", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const receivedData = await receivedResponse.json();
        if (receivedData.success) {
          setReceivedRequests(receivedData.requests || []);
        }

        // Fetch user profiles
        const allUserIds = [
          ...(sentData.requests || []).map((r: PairRequest) => r.toUserId),
          ...(receivedData.requests || []).map((r: PairRequest) => r.fromUserId),
        ];
        const uniqueIds = [...new Set(allUserIds)];
        const profilePromises = uniqueIds.map(async (uid: string) => {
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
        console.error("Error fetching requests:", error);
      } finally {
        setLoading(false);
      }
    }

    if (!authLoading && user) {
      fetchRequests();
    }
  }, [user, authLoading]);

  const handleRespond = async (requestId: string, action: "accept" | "decline") => {
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/pair/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ requestId, action }),
      });

      const data = await response.json();
      if (data.success) {
        if (action === "accept" && data.sessionId) {
          alert("Request accepted! Session created.");
          window.location.href = `/pair/${data.sessionId}`;
        } else {
          alert(`Request ${action === "accept" ? "accepted" : "declined"}`);
        }
        // Refresh requests
        window.location.reload();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Error responding to request:", error);
      alert("Failed to respond. Please try again.");
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
          <h1 className="text-2xl font-bold mb-4">Pair Requests</h1>
          <p className="text-neutral-600 dark:text-neutral-300 mb-6">
            Sign in to view your pair programming requests.
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

  const requests = activeTab === "sent" ? sentRequests : receivedRequests;

  return (
    <div className="min-h-screen py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Pair Requests</h1>
          <Link
            href="/pair"
            className="text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            ← Back to Matches
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setActiveTab("received")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === "received"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-neutral-600 dark:text-neutral-400"
            }`}
          >
            Received ({receivedRequests.length})
          </button>
          <button
            onClick={() => setActiveTab("sent")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              activeTab === "sent"
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-neutral-600 dark:text-neutral-400"
            }`}
          >
            Sent ({sentRequests.length})
          </button>
        </div>

        {/* Requests List */}
        <div className="space-y-4">
          {requests.length === 0 ? (
            <div className="text-center py-12 text-neutral-600 dark:text-neutral-300">
              <p>No {activeTab} requests yet.</p>
            </div>
          ) : (
            requests.map((request) => {
              const otherUser =
                activeTab === "sent"
                  ? userProfiles[request.toUserId]
                  : userProfiles[request.fromUserId];
              return (
                <RequestCard
                  key={request.id}
                  request={request}
                  otherUser={otherUser}
                  isReceived={activeTab === "received"}
                  onRespond={handleRespond}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function RequestCard({
  request,
  otherUser,
  isReceived,
  onRespond,
}: {
  request: PairRequest;
  otherUser?: PublicUser;
  isReceived: boolean;
  onRespond: (requestId: string, action: "accept" | "decline") => void;
}) {
  const sessionTypeLabels: Record<SessionType, string> = {
    "teach-me": "Teach Me",
    "build-together": "Build Together",
    "code-review": "Code Review Swap",
    "explore-topic": "Explore a Topic",
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
      <div className="flex items-start gap-4">
        {otherUser?.photoURL ? (
          <img
            src={otherUser.photoURL}
            alt={otherUser.displayName || "User"}
            className="w-12 h-12 rounded-full"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
            <span className="text-neutral-500">
              {otherUser?.displayName?.[0]?.toUpperCase() || "?"}
            </span>
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">
              {otherUser?.displayName || "Anonymous User"}
            </h3>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                request.status === "pending"
                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                  : request.status === "accepted"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}
            >
              {request.status}
            </span>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
            Session Type: {sessionTypeLabels[request.sessionType]}
          </p>
          <p className="text-neutral-700 dark:text-neutral-300 mb-4">{request.message}</p>
          {isReceived && request.status === "pending" && (
            <div className="flex gap-2">
              <button
                onClick={() => onRespond(request.id!, "accept")}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-400 transition-colors"
              >
                Accept
              </button>
              <button
                onClick={() => onRespond(request.id!, "decline")}
                className="px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Decline
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
