"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { submitEventRequest, EventRequest } from "@/lib/submissions";
import Link from "next/link";

const eventTypes = [
  { id: "workshop", name: "Workshop", description: "Hands-on learning session" },
  { id: "meetup", name: "Meetup", description: "Networking and demos" },
  { id: "hackathon", name: "Hackathon", description: "Build projects together" },
  { id: "university-session", name: "University Session", description: "Campus event" },
  { id: "other", name: "Other", description: "Something different" },
];

const attendeeRanges = [
  { id: "10-25", label: "10-25 people" },
  { id: "25-50", label: "25-50 people" },
  { id: "50-100", label: "50-100 people" },
  { id: "100+", label: "100+ people" },
];

export default function RequestEventPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<EventRequest>({
    name: "",
    email: "",
    organization: "",
    eventType: "",
    title: "",
    description: "",
    proposedDate: "",
    expectedAttendees: "",
    venue: "",
    additionalInfo: "",
  });

  // Pre-fill email and name from authenticated user
  useEffect(() => {
    if (user) {
      // Try to get name from user.displayName, then userProfile, then empty
      const userName = user.displayName || userProfile?.displayName || "";
      setFormData((prev) => ({
        ...prev,
        email: prev.email || user.email || "",
        name: prev.name || userName,
      }));
    }
  }, [user, userProfile]);

  // Check if form has unsaved changes
  const hasUnsavedChanges = useCallback(() => {
    return (
      formData.title.trim() !== "" ||
      formData.description.trim() !== "" ||
      formData.organization?.trim() !== ""
    );
  }, [formData.title, formData.description, formData.organization]);

  // Warn user before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges() && !isSubmitted) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges, isSubmitted]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Trim all string values before submission
    const trimmedData: EventRequest = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      organization: formData.organization?.trim(),
      eventType: formData.eventType,
      title: formData.title.trim(),
      description: formData.description.trim(),
      proposedDate: formData.proposedDate?.trim(),
      expectedAttendees: formData.expectedAttendees,
      venue: formData.venue?.trim(),
      additionalInfo: formData.additionalInfo?.trim(),
    };

    try {
      await submitEventRequest(trimmedData, user?.uid);
      setIsSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="bg-neutral-900 rounded-2xl p-8 max-w-md w-full text-center border border-neutral-800">
          <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-neutral-500"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Sign In Required</h2>
          <p className="text-neutral-400 mb-6">
            Please sign in to submit an event request. This helps us follow up with you
            about your event idea.
          </p>
          <Link
            href="/login?redirect=/events/request"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-black rounded-lg text-sm font-semibold hover:bg-neutral-200 transition-colors w-full"
          >
            Sign In to Continue
          </Link>
        </div>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6">
        <div className="bg-neutral-900 rounded-2xl p-8 max-w-md w-full text-center border border-neutral-800">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-500"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Request Submitted!</h2>
          <p className="text-neutral-400 mb-6">
            Thanks for your event idea! We&apos;ll review it and reach out to you at{" "}
            <span className="text-white">{formData.email}</span> to discuss next steps.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/events"
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-neutral-800 text-white rounded-lg text-sm font-semibold hover:bg-neutral-700 transition-colors"
            >
              Back to Events
            </Link>
            <button
              onClick={() => {
                setIsSubmitted(false);
                setFormData({
                  name: "",
                  email: user?.email || "",
                  organization: "",
                  eventType: "",
                  title: "",
                  description: "",
                  proposedDate: "",
                  expectedAttendees: "",
                  venue: "",
                  additionalInfo: "",
                });
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-black rounded-lg text-sm font-semibold hover:bg-neutral-200 transition-colors"
            >
              Submit Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-12 md:py-24 px-4 md:px-6 border-b border-neutral-800">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-white mb-4 md:mb-6">
            Request an Event
          </h1>
          <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto">
            Have an idea for a Cursor workshop, meetup, or hackathon? Let us know and
            we&apos;ll help make it happen!
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="py-8 md:py-16 px-4 md:px-6">
        <div className="max-w-2xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
            {/* Your Info */}
            <div className="bg-neutral-900 rounded-xl md:rounded-2xl p-4 md:p-6 border border-neutral-800">
              <h2 className="text-lg font-semibold text-white mb-4">Your Information</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-neutral-300 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-neutral-300 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
                    placeholder="jane@example.com"
                  />
                </div>
                <div>
                  <label htmlFor="organization" className="block text-sm font-medium text-neutral-300 mb-2">
                    Organization / University (optional)
                  </label>
                  <input
                    type="text"
                    id="organization"
                    name="organization"
                    value={formData.organization}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
                    placeholder="MIT, Hult, Company name, etc."
                  />
                </div>
              </div>
            </div>

            {/* Event Details */}
            <div className="bg-neutral-900 rounded-xl md:rounded-2xl p-4 md:p-6 border border-neutral-800">
              <h2 className="text-lg font-semibold text-white mb-4">Event Details</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-3">
                    Event Type *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {eventTypes.map((type) => (
                      <label
                        key={type.id}
                        className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                          formData.eventType === type.id
                            ? "bg-white/5 border-white/30"
                            : "bg-neutral-800 border-neutral-700 hover:border-neutral-600"
                        }`}
                      >
                        <input
                          type="radio"
                          name="eventType"
                          value={type.id}
                          checked={formData.eventType === type.id}
                          onChange={handleChange}
                          required
                          className="mt-1"
                        />
                        <div>
                          <span className="block text-white font-medium">{type.name}</span>
                          <span className="block text-neutral-400 text-sm">{type.description}</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-neutral-300 mb-2">
                    Event Title / Topic *
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
                    placeholder="Cursor for Beginners, AI Hackathon, etc."
                  />
                </div>
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-neutral-300 mb-2">
                    Description *
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    required
                    rows={4}
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent resize-none"
                    placeholder="What's the event about? What would attendees learn or do?"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="proposedDate" className="block text-sm font-medium text-neutral-300 mb-2">
                      Proposed Date (optional)
                    </label>
                    <input
                      type="text"
                      id="proposedDate"
                      name="proposedDate"
                      value={formData.proposedDate}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-base placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
                      placeholder="February 2026, flexible, etc."
                    />
                  </div>
                  <div>
                    <label htmlFor="expectedAttendees" className="block text-sm font-medium text-neutral-300 mb-2">
                      Expected Attendees *
                    </label>
                    <select
                      id="expectedAttendees"
                      name="expectedAttendees"
                      value={formData.expectedAttendees}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-base focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
                    >
                      <option value="">Select...</option>
                      {attendeeRanges.map((range) => (
                        <option key={range.id} value={range.id}>
                          {range.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="venue" className="block text-sm font-medium text-neutral-300 mb-2">
                    Venue / Location (optional)
                  </label>
                  <input
                    type="text"
                    id="venue"
                    name="venue"
                    value={formData.venue}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
                    placeholder="We can host at..., Need help finding a venue, etc."
                  />
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="bg-neutral-900 rounded-xl md:rounded-2xl p-4 md:p-6 border border-neutral-800">
              <h2 className="text-lg font-semibold text-white mb-4">Additional Information</h2>
              <div>
                <label htmlFor="additionalInfo" className="block text-sm font-medium text-neutral-300 mb-2">
                  Anything else we should know?
                </label>
                <textarea
                  id="additionalInfo"
                  name="additionalInfo"
                  value={formData.additionalInfo}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent resize-none"
                  placeholder="Special requirements, collaboration ideas, etc."
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-white text-black rounded-lg font-semibold hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-black"></div>
                  Submitting...
                </>
              ) : (
                <>
                  Submit Event Request
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
