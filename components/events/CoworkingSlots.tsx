"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";
import ProfileRequirementsModal from "@/components/ProfileRequirementsModal";

interface Attendee {
  displayName: string;
  photoUrl?: string;
  github?: string;
}

interface Session {
  id: string;
  eventId: string;
  startTime: string;
  endTime: string;
  label: string;
  maxSlots: number;
  currentBookings: number;
}

interface SlotStatus {
  session: Session;
  availableSlots: number;
  isUserRegistered: boolean;
  userRegistrationId?: string;
  attendees: Attendee[];
}

interface CoworkingSlotsProps {
  eventId: string;
}

export default function CoworkingSlots({ eventId }: CoworkingSlotsProps) {
  const { user } = useAuth();
  const [slots, setSlots] = useState<SlotStatus[]>([]);
  const [eligibility, setEligibility] = useState<{ eligible: boolean; reason?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [showRequirementsModal, setShowRequirementsModal] = useState(false);

  const fetchSlots = useCallback(async (signal?: AbortSignal) => {
    try {
      const token = user ? await user.getIdToken() : null;
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch(`/api/events/${eventId}/coworking/slots`, { headers, signal });
      const data = await res.json();

      if (data.success) {
        setSlots(data.sessions);
      } else {
        setError(data.error || "Failed to load slots");
      }
    } catch (err) {
      console.error("Error fetching slots:", err);
      setError("Failed to load coworking slots");
    }
  }, [eventId, user]);

  const fetchEligibility = useCallback(async (signal?: AbortSignal) => {
    if (!user) {
      setEligibility({ eligible: false, reason: "Please sign in to register for coworking." });
      return;
    }

    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/events/${eventId}/coworking/eligibility`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      const data = await res.json();
      setEligibility(data);
    } catch (err) {
      console.error("Error fetching eligibility:", err);
      setEligibility({ eligible: false, reason: "Could not check eligibility." });
    }
  }, [eventId, user]);

  useEffect(() => {
    const controller = new AbortController();
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchSlots(controller.signal),
        fetchEligibility(controller.signal),
      ]);
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    };
    loadData();
    return () => controller.abort();
  }, [fetchSlots, fetchEligibility]);

  // Must be defined before any conditional returns (React hooks rule)
  const handleRequirementsComplete = useCallback(() => {
    // Refetch eligibility and slots when requirements are completed
    fetchEligibility();
    fetchSlots();
    setShowRequirementsModal(false);
  }, [fetchEligibility, fetchSlots]);

  const handleRegister = async (sessionId: string) => {
    if (!user) {
      setError("Please sign in to register");
      return;
    }

    setActionLoading(sessionId);
    setError(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/events/${eventId}/coworking/register`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json();

      if (data.success) {
        await fetchSlots();
      } else {
        setError(data.error || "Failed to register");
      }
    } catch (err) {
      console.error("Error registering:", err);
      setError("Failed to register");
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!user) return;

    setActionLoading("cancel");
    setError(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/events/${eventId}/coworking/register`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (data.success) {
        await fetchSlots();
      } else {
        setError(data.error || "Failed to cancel");
      }
    } catch (err) {
      console.error("Error canceling:", err);
      setError("Failed to cancel registration");
    } finally {
      setActionLoading(null);
    }
  };

  // Check if user is registered for any session
  const userRegistration = slots.find((s) => s.isUserRegistered);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-neutral-800 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Profile Requirements Modal */}
      <ProfileRequirementsModal
        isOpen={showRequirementsModal}
        onClose={() => setShowRequirementsModal(false)}
        onComplete={handleRequirementsComplete}
        requirements={["isPublic", "hasGithub"]}
        title="Complete Your Profile"
        description="To register for a coworking session, please complete these requirements."
      />

      {/* Eligibility Notice */}
      {!eligibility?.eligible && eligibility?.reason && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
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
              className="text-amber-400 shrink-0 mt-0.5"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div className="flex-1">
              <p className="text-amber-200 font-medium">Registration Requirements</p>
              <p className="text-amber-300/80 text-sm mt-1">{eligibility.reason}</p>
              {!user ? (
                <a
                  href="/login"
                  className="inline-block mt-3 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-sm font-medium rounded-lg transition-colors"
                >
                  Sign in to continue →
                </a>
              ) : (
                <button
                  onClick={() => setShowRequirementsModal(true)}
                  className="inline-block mt-3 px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-sm font-medium rounded-lg transition-colors"
                >
                  Complete Requirements →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* User's Current Registration */}
      {userRegistration && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
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
                className="text-emerald-400"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <div>
                <p className="text-emerald-200 font-medium">You&apos;re registered!</p>
                <p className="text-emerald-300/80 text-sm">
                  {userRegistration.session.label}
                </p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              disabled={actionLoading === "cancel"}
              className="px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
            >
              {actionLoading === "cancel" ? "Canceling..." : "Cancel"}
            </button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Session List */}
      <div className="space-y-4">
        {slots.map((slot) => {
          const isFull = slot.availableSlots === 0;
          const isRegistered = slot.isUserRegistered;
          const canRegister = eligibility?.eligible && !userRegistration && !isFull;
          const isExpanded = expandedSession === slot.session.id;

          return (
            <div
              key={slot.session.id}
              className={`border rounded-xl overflow-hidden transition-colors ${
                isRegistered
                  ? "border-emerald-500/30 bg-emerald-500/5"
                  : isFull
                  ? "border-neutral-700 bg-neutral-900/50"
                  : "border-neutral-700 bg-neutral-900"
              }`}
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="text-white font-medium">{slot.session.label}</h4>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span
                        className={`${
                          isFull ? "text-red-400" : "text-neutral-400"
                        }`}
                      >
                        {slot.availableSlots} of {slot.session.maxSlots} spots available
                      </span>
                      {slot.attendees.length > 0 && (
                        <button
                          onClick={() =>
                            setExpandedSession(isExpanded ? null : slot.session.id)
                          }
                          className="text-neutral-400 hover:text-white flex items-center gap-1 transition-colors"
                        >
                          <span>{slot.attendees.length} registered</span>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className={`transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="hidden sm:block w-32 mx-4">
                    <div className="h-2 bg-neutral-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          isFull ? "bg-red-500" : "bg-emerald-500"
                        }`}
                        style={{
                          width: `${
                            (slot.session.currentBookings / slot.session.maxSlots) * 100
                          }%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="ml-4">
                    {isRegistered ? (
                      <span className="px-4 py-2 text-sm text-emerald-400 font-medium">
                        ✓ Registered
                      </span>
                    ) : isFull ? (
                      <span className="px-4 py-2 text-sm text-neutral-500">
                        Full
                      </span>
                    ) : canRegister ? (
                      <button
                        onClick={() => handleRegister(slot.session.id)}
                        disabled={actionLoading === slot.session.id}
                        className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading === slot.session.id
                          ? "Registering..."
                          : "Register"}
                      </button>
                    ) : userRegistration ? (
                      <span className="px-4 py-2 text-sm text-neutral-500">
                        —
                      </span>
                    ) : (
                      <span className="px-4 py-2 text-sm text-neutral-500">
                        Unavailable
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Attendees List (Expanded) */}
              {isExpanded && slot.attendees.length > 0 && (
                <div className="px-4 pb-4 border-t border-neutral-800">
                  <p className="text-sm text-neutral-500 py-3">Registered Attendees</p>
                  <div className="flex flex-wrap gap-2">
                    {slot.attendees.map((attendee, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 rounded-full"
                      >
                        {attendee.photoUrl ? (
                          <Image
                            src={attendee.photoUrl}
                            alt={attendee.displayName}
                            width={20}
                            height={20}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-5 h-5 bg-neutral-700 rounded-full flex items-center justify-center text-xs text-neutral-400">
                            {attendee.displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-sm text-neutral-300">
                          {attendee.displayName}
                        </span>
                        {attendee.github && (
                          <a
                            href={`https://github.com/${attendee.github}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-neutral-500 hover:text-white transition-colors"
                            title={`@${attendee.github}`}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="currentColor"
                            >
                              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                            </svg>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Info Note */}
      <p className="text-sm text-neutral-500 text-center">
        You can only register for one session per event. Cancel your registration to
        switch sessions.
      </p>
    </div>
  );
}
