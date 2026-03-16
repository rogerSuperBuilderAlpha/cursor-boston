"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  submitCfpProposal,
  getCfpSubmission,
  countWords,
  isValidEduEmail,
  type CfpSubmissionInput,
} from "@/lib/cfp-submissions";
import Link from "next/link";

const SUBMISSION_DEADLINE = new Date("2026-05-01T23:59:59");
const ABSTRACT_MIN_WORDS = 1500;
const ABSTRACT_MAX_WORDS = 2500;

const inputClass =
  "w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-transparent";
const labelClass = "block text-sm font-medium text-neutral-300 mb-2";

export default function CfpPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingSubmission, setLoadingSubmission] = useState(true);
  const [formData, setFormData] = useState<CfpSubmissionInput>({
    abstract: "",
    name: "",
    email: "",
    school: "",
    department: "",
    advisor: "",
    thesisTitle: "",
  });

  const isBeforeDeadline = new Date() < SUBMISSION_DEADLINE;
  const userEmail = user?.email || "";
  const hasEduEmail = isValidEduEmail(userEmail);

  // Pre-fill from auth and load existing submission
  useEffect(() => {
    if (!user) {
      setLoadingSubmission(false);
      return;
    }

    const load = async () => {
      setLoadingSubmission(true);
      const userName = user.displayName || userProfile?.displayName || "";
      setFormData((prev) => ({
        ...prev,
        email: prev.email || userEmail,
        name: prev.name || userName,
      }));

      try {
        const existing = await getCfpSubmission(user.uid);
        if (existing) {
          setFormData({
            abstract: existing.abstract,
            name: existing.name,
            email: existing.email,
            school: existing.school,
            department: existing.department,
            advisor: existing.advisor,
            thesisTitle: existing.thesisTitle,
          });
        }
      } catch {
        // Ignore load errors
      } finally {
        setLoadingSubmission(false);
      }
    };

    load();
  }, [user, userProfile, userEmail]);

  const hasUnsavedChanges = useCallback(() => {
    return (
      formData.abstract.trim() !== "" ||
      formData.name.trim() !== "" ||
      formData.thesisTitle.trim() !== ""
    );
  }, [formData.abstract, formData.name, formData.thesisTitle]);

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
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    setError(null);

    const trimmed: CfpSubmissionInput = {
      abstract: formData.abstract.trim(),
      name: formData.name.trim(),
      email: formData.email.trim(),
      school: formData.school.trim(),
      department: formData.department.trim(),
      advisor: formData.advisor.trim(),
      thesisTitle: formData.thesisTitle.trim(),
    };

    try {
      await submitCfpProposal(trimmed, user.uid);
      setIsSubmitted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const wordCount = countWords(formData.abstract);
  const abstractInRange =
    wordCount >= ABSTRACT_MIN_WORDS && wordCount <= ABSTRACT_MAX_WORDS;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col">
        <CfpHero />
        <section className="py-12 md:py-16 px-4 md:px-6">
          <div className="max-w-2xl mx-auto">
            <div className="bg-neutral-900 dark:bg-neutral-900 rounded-2xl p-8 text-center border border-neutral-800">
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
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Sign In Required
              </h2>
              <p className="text-neutral-400 mb-6">
                Please sign in to submit a paper. Submissions are limited to
                students with .edu email addresses.
              </p>
              <Link
                href="/login?redirect=/cfp"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-foreground text-background rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity w-full"
              >
                Sign In to Continue
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!hasEduEmail) {
    return (
      <div className="flex flex-col">
        <CfpHero />
        <section className="py-12 md:py-16 px-4 md:px-6">
          <div className="max-w-2xl mx-auto">
            <div className="bg-neutral-900 dark:bg-neutral-900 rounded-2xl p-8 text-center border border-neutral-800">
              <div className="w-16 h-16 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
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
                  className="text-amber-500"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                .edu Email Required
              </h2>
              <p className="text-neutral-400 mb-6">
                Submissions are limited to students with .edu email addresses.
                Please sign in with your institutional email to submit a paper.
              </p>
              <Link
                href="/profile"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-neutral-800 text-foreground rounded-lg text-sm font-semibold hover:bg-neutral-700 transition-colors"
              >
                Account Settings
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!isBeforeDeadline) {
    return (
      <div className="flex flex-col">
        <CfpHero />
        <section className="py-12 md:py-16 px-4 md:px-6">
          <div className="max-w-2xl mx-auto">
            <div className="bg-neutral-900 dark:bg-neutral-900 rounded-2xl p-8 text-center border border-neutral-800">
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Submissions Closed
              </h2>
              <p className="text-neutral-400 mb-6">
                The submission deadline was May 1, 2026. Notifications will be
                sent by June 1, 2026.
              </p>
              <Link
                href="/"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-foreground text-background rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="flex flex-col">
        <CfpHero />
        <section className="py-12 md:py-16 px-4 md:px-6">
          <div className="max-w-2xl mx-auto">
            <div className="bg-neutral-900 dark:bg-neutral-900 rounded-2xl p-8 text-center border border-neutral-800">
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
              <h2 className="text-xl font-semibold text-foreground mb-2">
                Submission Received!
              </h2>
              <p className="text-neutral-400 mb-6">
                Thanks for your submission. We&apos;ll review your abstract and
                notify you at <span className="text-foreground">{formData.email}</span> by
                June 1, 2026. You can edit your submission until May 1, 2026.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-neutral-800 text-foreground rounded-lg text-sm font-semibold hover:bg-neutral-700 transition-colors"
                >
                  Back to Home
                </Link>
                <button
                  onClick={() => setIsSubmitted(false)}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-foreground text-background rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  Edit Submission
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <CfpHero />
      <section className="py-8 md:py-16 px-4 md:px-6">
        <div className="max-w-2xl mx-auto">
          {loadingSubmission ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-foreground" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8">
              <div className="bg-neutral-900 dark:bg-neutral-900 rounded-xl md:rounded-2xl p-4 md:p-6 border border-neutral-800">
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  Abstract
                </h2>
                <p className="text-neutral-400 text-sm mb-3">
                  Paste your extended abstract (1,500–2,500 words) with no
                  identifiers for blind review. Make it accessible to readers
                  outside your discipline; define jargon; state your assumptions
                  about AI early.
                </p>
                <div>
                  <textarea
                    id="abstract"
                    name="abstract"
                    value={formData.abstract}
                    onChange={handleChange}
                    required
                    rows={12}
                    className={`${inputClass} resize-y`}
                    placeholder="Your abstract..."
                  />
                  <p
                    className={`mt-2 text-sm ${
                      abstractInRange ? "text-neutral-400" : "text-amber-500"
                    }`}
                  >
                    {wordCount} words (1,500–2,500 required)
                  </p>
                </div>
              </div>

              <div className="bg-neutral-900 dark:bg-neutral-900 rounded-xl md:rounded-2xl p-4 md:p-6 border border-neutral-800">
                <h2 className="text-lg font-semibold text-foreground mb-4">
                  Your Information
                </h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="name" className={labelClass}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      className={inputClass}
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className={labelClass}>
                      .edu Email *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      className={inputClass}
                      placeholder="jane@university.edu"
                    />
                  </div>
                  <div>
                    <label htmlFor="school" className={labelClass}>
                      School / University *
                    </label>
                    <input
                      type="text"
                      id="school"
                      name="school"
                      value={formData.school}
                      onChange={handleChange}
                      required
                      className={inputClass}
                      placeholder="Your institution"
                    />
                  </div>
                  <div>
                    <label htmlFor="department" className={labelClass}>
                      Department *
                    </label>
                    <input
                      type="text"
                      id="department"
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      required
                      className={inputClass}
                      placeholder="e.g. Computer Science, Philosophy"
                    />
                  </div>
                  <div>
                    <label htmlFor="advisor" className={labelClass}>
                      Advisor *
                    </label>
                    <input
                      type="text"
                      id="advisor"
                      name="advisor"
                      value={formData.advisor}
                      onChange={handleChange}
                      required
                      className={inputClass}
                      placeholder="Advisor name"
                    />
                  </div>
                  <div>
                    <label htmlFor="thesisTitle" className={labelClass}>
                      Thesis Title / Topic *
                    </label>
                    <input
                      type="text"
                      id="thesisTitle"
                      name="thesisTitle"
                      value={formData.thesisTitle}
                      onChange={handleChange}
                      required
                      className={inputClass}
                      placeholder="Title or topic of your thesis"
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
                disabled={isSubmitting || !abstractInRange}
                className="w-full py-4 bg-foreground text-background rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-background" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Paper
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
          )}
        </div>
      </section>
    </div>
  );
}

function CfpHero() {
  return (
    <section className="py-12 md:py-24 px-4 md:px-6 border-b border-neutral-200 dark:border-neutral-800">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-4 md:mb-6">
          Call for Papers
        </h1>
        <p className="text-xl md:text-2xl text-neutral-500 dark:text-neutral-400 mb-8">
          What is AI?
        </p>
        <p className="text-lg text-neutral-600 dark:text-neutral-400 mb-8">
          Graduate Student Conference · September 23–24, 2026 · Boston, MA
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-neutral-600 dark:text-neutral-400">
          <p>
            Cursor Boston invites graduate students from technical and
            theoretical disciplines to discuss their definitions of AI. The goal
            is not consensus but productive confrontation—encouraging machine
            learning researchers to explain what their models actually learn and
            social theorists to specify what they mean by &quot;AI.&quot;
          </p>

          <h2 className="text-lg font-semibold text-foreground mt-8 mb-2">
            Format
          </h2>
          <p>
            A 2-day conference with 6 panels of 4 participants each. Each panel
            will ideally feature 2 participants working on technical topics and 2
            on theory-based topics. One panel is reserved strictly for
            undergraduate students; some undergraduates may also be invited to
            join graduate student panels.
          </p>

          <h2 className="text-lg font-semibold text-foreground mt-8 mb-2">
            Submission Guidelines
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Extended abstracts: 1,500–2,500 words</li>
            <li>Original research, theoretical arguments, or work in progress</li>
            <li>Accessible to readers outside your discipline; define jargon</li>
            <li>State your assumptions about AI early and explicitly</li>
            <li>Abstract must have no identifiers (blind review)</li>
            <li>All submissions receive written feedback from at least two reviewers from different disciplines</li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground mt-8 mb-2">
            Disciplines
          </h2>
          <p>
            We welcome submissions from computer science, information systems,
            organizational theory, communication studies, philosophy,
            sociology, linguistics, cognitive science, and adjacent fields.
            Particular interest in work that crosses disciplinary boundaries or
            makes implicit assumptions about AI explicit.
          </p>

          <h2 className="text-lg font-semibold text-foreground mt-8 mb-2">
            Important Dates
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Submission deadline: May 1, 2026 (edits allowed until then)</li>
            <li>Notifications: June 1, 2026</li>
            <li>Conference: September 23–24, 2026</li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground mt-8 mb-2">
            Logistics
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Travel and accommodations are <strong>not</strong> provided</li>
            <li>Refreshments and snacks during the conference</li>
            <li>One conference dinner for participants and organizers only</li>
            <li>Attendance is open to the public</li>
            <li>All participants receive 1 year of Cursor Pro</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
