"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { submitTalkProposal, TalkSubmission } from "@/lib/submissions";
import Link from "next/link";

const categories = [
  { id: "academic-writing", name: "Academic Writing" },
  { id: "career", name: "Career" },
  { id: "software-development", name: "Software Dev" },
  { id: "startup-building", name: "Startups" },
  { id: "design", name: "Design" },
  { id: "other", name: "Other" },
];

const durations = [
  { id: "5-10", label: "5-10 min (Lightning)" },
  { id: "15-20", label: "15-20 min (Standard)" },
  { id: "30+", label: "30+ min (Deep Dive)" },
];

const experienceLevels = [
  { id: "beginner", label: "Beginner-friendly" },
  { id: "intermediate", label: "Intermediate" },
  { id: "advanced", label: "Advanced" },
];

export default function SubmitTalkPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<TalkSubmission>({
    name: "",
    email: "",
    title: "",
    description: "",
    category: "",
    duration: "",
    experience: "",
    bio: "",
    linkedIn: "",
    twitter: "",
    previousTalks: "",
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
      formData.bio?.trim() !== ""
    );
  }, [formData.title, formData.description, formData.bio]);

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
    const trimmedData: TalkSubmission = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      title: formData.title.trim(),
      description: formData.description.trim(),
      category: formData.category,
      duration: formData.duration,
      experience: formData.experience,
      bio: formData.bio?.trim(),
      linkedIn: formData.linkedIn?.trim(),
      twitter: formData.twitter?.trim(),
      previousTalks: formData.previousTalks?.trim(),
    };

    try {
      await submitTalkProposal(trimmedData, user?.uid);
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
              className="text-neutral-400"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Sign In Required</h2>
          <p className="text-neutral-400 mb-6">
            Please sign in to submit a talk proposal. This helps us keep track of submissions
            and follow up with you.
          </p>
          <Link
            href="/login?redirect=/talks/submit"
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
          <h2 className="text-xl font-semibold text-white mb-2">Talk Submitted!</h2>
          <p className="text-neutral-400 mb-6">
            Thanks for your submission! We&apos;ll review your proposal and get back to you
            at <span className="text-white">{formData.email}</span> soon.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/talks"
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-neutral-800 text-white rounded-lg text-sm font-semibold hover:bg-neutral-700 transition-colors"
            >
              Back to Talks
            </Link>
            <button
              onClick={() => {
                setIsSubmitted(false);
                setFormData({
                  name: "",
                  email: user?.email || "",
                  title: "",
                  description: "",
                  category: "",
                  duration: "",
                  experience: "",
                  bio: "",
                  linkedIn: "",
                  twitter: "",
                  previousTalks: "",
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
            Submit a Talk
          </h1>
          <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto">
            Share your knowledge with the Cursor Boston community. All experience levels
            and backgrounds are welcome!
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
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
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
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
                    placeholder="jane@example.com"
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="linkedIn" className="block text-sm font-medium text-neutral-300 mb-2">
                      LinkedIn (optional)
                    </label>
                    <input
                      type="url"
                      id="linkedIn"
                      name="linkedIn"
                      value={formData.linkedIn}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>
                  <div>
                    <label htmlFor="twitter" className="block text-sm font-medium text-neutral-300 mb-2">
                      Twitter/X (optional)
                    </label>
                    <input
                      type="text"
                      id="twitter"
                      name="twitter"
                      value={formData.twitter}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
                      placeholder="@username"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Talk Details */}
            <div className="bg-neutral-900 rounded-xl md:rounded-2xl p-4 md:p-6 border border-neutral-800">
              <h2 className="text-lg font-semibold text-white mb-4">Talk Details</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-neutral-300 mb-2">
                    Talk Title *
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-base placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
                    placeholder="How I Built X with Cursor"
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
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white text-base placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent resize-none"
                    placeholder="What will you cover? What will attendees learn?"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-neutral-300 mb-2">
                      Category *
                    </label>
                    <select
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
                    >
                      <option value="">Select...</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="duration" className="block text-sm font-medium text-neutral-300 mb-2">
                      Duration *
                    </label>
                    <select
                      id="duration"
                      name="duration"
                      value={formData.duration}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
                    >
                      <option value="">Select...</option>
                      {durations.map((dur) => (
                        <option key={dur.id} value={dur.id}>
                          {dur.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="experience" className="block text-sm font-medium text-neutral-300 mb-2">
                      Audience Level *
                    </label>
                    <select
                      id="experience"
                      name="experience"
                      value={formData.experience}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent"
                    >
                      <option value="">Select...</option>
                      {experienceLevels.map((exp) => (
                        <option key={exp.id} value={exp.id}>
                          {exp.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* About You */}
            <div className="bg-neutral-900 rounded-xl md:rounded-2xl p-4 md:p-6 border border-neutral-800">
              <h2 className="text-lg font-semibold text-white mb-4">About You (Optional)</h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="bio" className="block text-sm font-medium text-neutral-300 mb-2">
                    Short Bio
                  </label>
                  <textarea
                    id="bio"
                    name="bio"
                    value={formData.bio}
                    onChange={handleChange}
                    rows={3}
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent resize-none"
                    placeholder="Tell us a bit about yourself..."
                  />
                </div>
                <div>
                  <label htmlFor="previousTalks" className="block text-sm font-medium text-neutral-300 mb-2">
                    Previous Speaking Experience
                  </label>
                  <textarea
                    id="previousTalks"
                    name="previousTalks"
                    value={formData.previousTalks}
                    onChange={handleChange}
                    rows={2}
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent resize-none"
                    placeholder="Any previous talks or presentations (optional, first-time speakers welcome!)"
                  />
                </div>
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
                  Submit Talk Proposal
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
