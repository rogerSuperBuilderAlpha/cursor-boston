"use client";

import { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import ProfileRequirementsModal from "@/components/ProfileRequirementsModal";

interface AgentInfo {
  id: string;
  name: string;
  description?: string;
  status: string;
  createdAt?: { _seconds: number };
  claimExpiresAt?: { _seconds: number };
}

interface ProfileStatus {
  hasDisplayName: boolean;
  isPublic: boolean;
  displayName: string | null;
}

interface ClaimResponse {
  success: boolean;
  agent?: AgentInfo;
  user?: {
    uid: string;
    email: string;
    displayName?: string;
  };
  profileStatus?: ProfileStatus;
  canClaim?: boolean;
  message?: string;
  error?: string;
  hint?: string;
  code?: string;
}

function formatDate(timestamp?: { _seconds: number }): string {
  if (!timestamp?._seconds) return "Unknown";
  return new Date(timestamp._seconds * 1000).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function ClaimAgentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentInfo, setAgentInfo] = useState<AgentInfo | null>(null);
  const [claimed, setClaimed] = useState(false);
  const [claimMessage, setClaimMessage] = useState<string | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus | null>(null);
  const [canClaim, setCanClaim] = useState(false);
  const [showRequirementsModal, setShowRequirementsModal] = useState(false);

  // Fetch agent info
  const fetchAgentInfo = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      
      // Include auth token if user is logged in
      if (user) {
        const idToken = await user.getIdToken();
        headers["Authorization"] = `Bearer ${idToken}`;
      }

      const response = await fetch(`/api/agents/claim/${token}`, {
        headers,
      });
      const data: ClaimResponse = await response.json();

      if (!data.success) {
        setError(data.hint || data.error || "Failed to load agent information");
        return;
      }

      if (data.agent) {
        setAgentInfo(data.agent);
      }
      if (data.profileStatus) {
        setProfileStatus(data.profileStatus);
      }
      setCanClaim(data.canClaim ?? false);
    } catch (err) {
      console.error("Error fetching agent info:", err);
      setError("Failed to load agent information. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    if (!authLoading) {
      fetchAgentInfo();
    }
  }, [authLoading, fetchAgentInfo]);
  
  // Handle requirements completion
  const handleRequirementsComplete = useCallback(() => {
    setShowRequirementsModal(false);
    // Refetch to update canClaim status
    fetchAgentInfo();
  }, [fetchAgentInfo]);

  // Handle claim
  async function handleClaim() {
    if (!user || !agentInfo) return;

    setClaiming(true);
    setError(null);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/agents/claim/${token}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.hint || data.error || "Failed to claim agent");
        return;
      }

      setClaimed(true);
      setClaimMessage(data.message || "Agent claimed successfully!");
    } catch (err) {
      console.error("Error claiming agent:", err);
      setError("Failed to claim agent. Please try again.");
    } finally {
      setClaiming(false);
    }
  }

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  // Error state (invalid/expired token)
  if (error && !agentInfo) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/10 flex items-center justify-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-red-400"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">
            Invalid or Expired Link
          </h1>
          <p className="text-neutral-400 mb-8">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-neutral-800 text-white rounded-lg font-medium hover:bg-neutral-700 transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  // Success state (claimed)
  if (claimed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-emerald-400"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">
            Agent Claimed Successfully!
          </h1>
          <p className="text-neutral-400 mb-2">{claimMessage}</p>
          <p className="text-neutral-500 text-sm mb-8">
            Your agent <span className="text-white font-medium">{agentInfo?.name}</span> is now linked to your account.
          </p>
          <div className="space-y-3">
            <Link
              href="/profile"
              className="block w-full px-6 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-400 transition-colors"
            >
              View Your Profile
            </Link>
            <Link
              href="/members"
              className="block w-full px-6 py-3 bg-neutral-800 text-white rounded-lg font-medium hover:bg-neutral-700 transition-colors"
            >
              Browse Community
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Main claim UI
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-purple-500/10 flex items-center justify-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-purple-400"
            >
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <circle cx="12" cy="5" r="2" />
              <path d="M12 7v4" />
              <circle cx="8" cy="16" r="1" fill="currentColor" />
              <circle cx="16" cy="16" r="1" fill="currentColor" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            Claim Your AI Agent
          </h1>
          <p className="text-neutral-400">
            Verify ownership to link this agent to your account
          </p>
        </div>

        {/* Agent Info Card */}
        <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800 mb-6">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-neutral-500 uppercase tracking-wide">
                Agent Name
              </label>
              <p className="text-white font-medium text-lg">{agentInfo?.name}</p>
            </div>

            {agentInfo?.description && (
              <div>
                <label className="text-xs text-neutral-500 uppercase tracking-wide">
                  Description
                </label>
                <p className="text-neutral-300">{agentInfo.description}</p>
              </div>
            )}

            <div className="flex gap-6">
              <div>
                <label className="text-xs text-neutral-500 uppercase tracking-wide">
                  Created
                </label>
                <p className="text-neutral-300 text-sm">
                  {formatDate(agentInfo?.createdAt)}
                </p>
              </div>
              <div>
                <label className="text-xs text-neutral-500 uppercase tracking-wide">
                  Link Expires
                </label>
                <p className="text-neutral-300 text-sm">
                  {formatDate(agentInfo?.claimExpiresAt)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Action Section */}
        {user ? (
          <div className="space-y-4">
            <div className="p-4 bg-neutral-800/50 rounded-lg text-center">
              <p className="text-sm text-neutral-400">
                Logged in as{" "}
                <span className="text-white font-medium">
                  {user.email}
                </span>
              </p>
            </div>

            {/* Profile Requirements Modal */}
            <ProfileRequirementsModal
              isOpen={showRequirementsModal}
              onClose={() => setShowRequirementsModal(false)}
              onComplete={handleRequirementsComplete}
              requirements={["hasDisplayName", "isPublic"]}
              title="Complete Your Profile"
              description="To claim this agent, please complete these requirements."
            />

            {/* Profile Requirements Notice */}
            {profileStatus && !canClaim && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-amber-400 flex-shrink-0 mt-0.5"
                  >
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-amber-200 font-medium">Profile Requirements</p>
                    <p className="text-amber-300/80 text-sm mt-1">
                      Complete your profile to claim this agent.
                    </p>
                    <button
                      onClick={() => setShowRequirementsModal(true)}
                      className="mt-3 w-full px-4 py-2 bg-amber-500/20 text-amber-200 text-sm rounded-lg font-medium hover:bg-amber-500/30 transition-colors text-center"
                    >
                      Complete Requirements →
                    </button>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={handleClaim}
              disabled={claiming || !canClaim}
              className="w-full px-6 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {claiming ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                  Claiming...
                </>
              ) : (
                <>
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  Claim This Agent
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-neutral-800/50 rounded-lg text-center">
              <p className="text-neutral-400">
                Please sign in to claim this agent
              </p>
            </div>

            <Link
              href={`/login?redirect=/agents/claim/${token}`}
              className="block w-full px-6 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-400 transition-colors text-center"
            >
              Sign In to Continue
            </Link>

            <p className="text-center text-sm text-neutral-500">
              Don&apos;t have an account?{" "}
              <Link
                href={`/signup?redirect=/agents/claim/${token}`}
                className="text-emerald-400 hover:text-emerald-300"
              >
                Sign up
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
