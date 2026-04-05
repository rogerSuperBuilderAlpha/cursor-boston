"use client";

import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import showcaseData from "@/content/showcase.json";

interface ProjectContact {
  github?: string;
  website?: string;
  email?: string;
  twitter?: string;
  linkedin?: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  image: string;
  categories: string[];
  contact: ProjectContact;
  submittedBy: string;
  submittedDate: string;
}

interface VoteCounts {
  [projectId: string]: { upCount: number; downCount: number };
}

interface UserVotes {
  [projectId: string]: string;
}

interface SubmissionFeedback {
  type: "success" | "error";
  message: string;
}

type SubmissionStatus = "pending" | "approved" | "rejected";
type TalkModerationStatus = "pending" | "approved" | "completed" | "unknown";
type ShowcaseModerationAction = "approve" | "reject";
type TalkModerationAction = "approve" | "complete";

interface PendingSubmission {
  submissionId: string;
  userId: string;
  projectId: string;
  createdAt?: string;
  resubmittedAt?: string;
}

interface TalkModerationSubmission {
  submissionId: string;
  userId: string;
  title: string;
  status: TalkModerationStatus;
  createdAt?: string;
}

function getNetScore(votes: VoteCounts, projectId: string): number {
  const v = votes[projectId];
  if (!v) return 0;
  return v.upCount - v.downCount;
}

export default function ShowcasePage() {
  const { user } = useAuth();
  const [votes, setVotes] = useState<VoteCounts>({});
  const [userVotes, setUserVotes] = useState<UserVotes>({});
  const [votingId, setVotingId] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [submittedProjects, setSubmittedProjects] = useState<Record<string, SubmissionStatus>>({});
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<SubmissionFeedback | null>(null);
  const [adminFeedback, setAdminFeedback] = useState<SubmissionFeedback | null>(null);
  const [isAdminOperator, setIsAdminOperator] = useState(false);
  const [loadingPendingSubmissions, setLoadingPendingSubmissions] = useState(false);
  const [pendingSubmissions, setPendingSubmissions] = useState<PendingSubmission[]>([]);
  const [talkModerationSubmissions, setTalkModerationSubmissions] = useState<
    TalkModerationSubmission[]
  >([]);
  const [moderatingSubmissionId, setModeratingSubmissionId] = useState<string | null>(null);

  // Fetch vote data
  useEffect(() => {
    async function fetchVotes() {
      try {
        const headers: Record<string, string> = {};
        if (user) {
          const { getIdToken } = await import("firebase/auth");
          const token = await getIdToken(user);
          headers["Authorization"] = `Bearer ${token}`;
        }
        const res = await fetch("/api/showcase/vote", { headers });
        if (res.ok) {
          const data = await res.json();
          setVotes(data.votes || {});
          setUserVotes(data.userVotes || {});
        }
      } catch {
        // Silently fail - votes just won't load
      }
    }
    fetchVotes();
  }, [user]);

  const handleVote = useCallback(
    async (projectId: string, type: "up" | "down") => {
      if (!user) return;
      if (votingId) return;

      setVotingId(projectId);
      try {
        const { getIdToken } = await import("firebase/auth");
        const token = await getIdToken(user);
        const res = await fetch("/api/showcase/vote", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ projectId, type }),
        });

        if (res.ok) {
          const data = await res.json();
          setVotes((prev) => ({
            ...prev,
            [projectId]: {
              upCount: data.upCount,
              downCount: data.downCount,
            },
          }));

          if (data.action === "removed") {
            setUserVotes((prev) => {
              const next = { ...prev };
              delete next[projectId];
              return next;
            });
          } else {
            setUserVotes((prev) => ({ ...prev, [projectId]: type }));
          }
        }
      } catch {
        // Silently fail
      } finally {
        setVotingId(null);
      }
    },
    [user, votingId]
  );

  const handleMarkSubmitted = useCallback(
    async (projectId: string) => {
      if (!user || submittingId) return;

      setSubmittingId(projectId);
      setSubmissionFeedback(null);
      try {
        const { getIdToken } = await import("firebase/auth");
        const token = await getIdToken(user);
        const res = await fetch("/api/showcase/submission", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ projectId }),
        });

        const payload = (await res.json().catch(() => ({}))) as {
          created?: boolean;
          resubmitted?: boolean;
          error?: string;
          status?: SubmissionStatus;
        };

        if (!res.ok) {
          setSubmissionFeedback({
            type: "error",
            message: payload.error || "Could not record submission. Please try again.",
          });
          return;
        }

        const status =
          payload.status === "approved"
            ? "approved"
            : payload.status === "rejected"
            ? "rejected"
            : "pending";
        setSubmittedProjects((prev) => ({ ...prev, [projectId]: status }));
        setSubmissionFeedback({
          type: "success",
          message: payload.resubmitted
            ? "Submission re-sent for review. It does not count toward Showcase Star until approved."
            : payload.created
            ? "Submission received. It is pending review and does not count toward Showcase Star until approved."
            : status === "approved"
            ? "This submission is already approved."
            : status === "rejected"
            ? "This submission was rejected. You can resubmit after making changes."
            : "This submission is already pending review.",
        });
      } catch {
        setSubmissionFeedback({
          type: "error",
          message: "Could not record submission. Please try again.",
        });
      } finally {
        setSubmittingId(null);
      }
    },
    [user, submittingId]
  );

  useEffect(() => {
    if (!user) {
      setSubmittedProjects({});
      return;
    }

    let active = true;
    (async () => {
      try {
        const { getIdToken } = await import("firebase/auth");
        const token = await getIdToken(user);
        const res = await fetch("/api/showcase/submission", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error("Failed to fetch showcase submission state.");
        }

        const data = (await res.json()) as {
          submissions?: Array<{ projectId: string; status: SubmissionStatus }>;
        };
        if (!active) return;

        const submittedMap = (data.submissions || []).reduce<Record<string, SubmissionStatus>>(
          (acc, submission) => {
            acc[submission.projectId] = submission.status;
            return acc;
          },
          {}
        );
        setSubmittedProjects(submittedMap);
      } catch {
        if (!active) return;
        setSubmissionFeedback({
          type: "error",
          message: "Could not load your showcase submission statuses.",
        });
      }
    })();

    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setIsAdminOperator(false);
      setPendingSubmissions([]);
      setTalkModerationSubmissions([]);
      setAdminFeedback(null);
      return;
    }

    let active = true;
    setLoadingPendingSubmissions(true);
    (async () => {
      try {
        const { getIdToken } = await import("firebase/auth");
        const token = await getIdToken(user);
        const res = await fetch("/api/showcase/submission/approve", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 403) {
          if (!active) return;
          setIsAdminOperator(false);
          setPendingSubmissions([]);
          setTalkModerationSubmissions([]);
          return;
        }

        if (!res.ok) {
          throw new Error("Failed to fetch pending showcase submissions.");
        }

        const payload = (await res.json()) as {
          pendingSubmissions?: PendingSubmission[];
        };

        if (!active) return;
        setIsAdminOperator(true);
        setPendingSubmissions(
          Array.isArray(payload.pendingSubmissions) ? payload.pendingSubmissions : []
        );

        const talkRes = await fetch("/api/talks/submission/moderate", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (talkRes.ok) {
          const talkPayload = (await talkRes.json()) as {
            talkSubmissions?: TalkModerationSubmission[];
          };
          setTalkModerationSubmissions(
            Array.isArray(talkPayload.talkSubmissions) ? talkPayload.talkSubmissions : []
          );
        } else {
          setTalkModerationSubmissions([]);
        }
      } catch {
        if (!active) return;
        setIsAdminOperator(false);
      } finally {
        if (active) {
          setLoadingPendingSubmissions(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [user]);

  const handleModerationAction = useCallback(
    async (submissionId: string, action: ShowcaseModerationAction) => {
      if (!user || !isAdminOperator || moderatingSubmissionId) return;

      setModeratingSubmissionId(submissionId);
      setAdminFeedback(null);

      try {
        const { getIdToken } = await import("firebase/auth");
        const token = await getIdToken(user);
        const res = await fetch("/api/showcase/submission/approve", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ submissionId, action }),
        });

        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };

        if (!res.ok) {
          setAdminFeedback({
            type: "error",
            message: payload.error || "Could not update submission status. Please try again.",
          });
          return;
        }

        setPendingSubmissions((prev) =>
          prev.filter((submission) => submission.submissionId !== submissionId)
        );
        setAdminFeedback({
          type: "success",
          message: action === "approve"
            ? "Submission approved."
            : "Submission rejected.",
        });
      } catch {
        setAdminFeedback({
          type: "error",
          message: "Could not update submission status. Please try again.",
        });
      } finally {
        setModeratingSubmissionId(null);
      }
    },
    [isAdminOperator, moderatingSubmissionId, user]
  );

  const handleTalkModerationAction = useCallback(
    async (submissionId: string, action: TalkModerationAction) => {
      if (!user || !isAdminOperator || moderatingSubmissionId) return;

      setModeratingSubmissionId(submissionId);
      setAdminFeedback(null);

      try {
        const { getIdToken } = await import("firebase/auth");
        const token = await getIdToken(user);
        const res = await fetch("/api/talks/submission/moderate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ submissionId, action }),
        });

        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };

        if (!res.ok) {
          setAdminFeedback({
            type: "error",
            message: payload.error || "Could not update talk status. Please try again.",
          });
          return;
        }

        if (action === "approve") {
          setTalkModerationSubmissions((prev) =>
            prev.map((submission) =>
              submission.submissionId === submissionId
                ? { ...submission, status: "approved" }
                : submission
            )
          );
          setAdminFeedback({
            type: "success",
            message: "Talk submission approved.",
          });
        } else {
          setTalkModerationSubmissions((prev) =>
            prev.map((submission) =>
              submission.submissionId === submissionId
                ? { ...submission, status: "completed" }
                : submission
            )
          );
          setAdminFeedback({
            type: "success",
            message: "Talk marked as delivered.",
          });
        }
      } catch {
        setAdminFeedback({
          type: "error",
          message: "Could not update talk status. Please try again.",
        });
      } finally {
        setModeratingSubmissionId(null);
      }
    },
    [isAdminOperator, moderatingSubmissionId, user]
  );

  // Sort projects by net votes (descending)
  const sortedProjects = [...(showcaseData.projects as Project[])].sort(
    (a, b) => getNetScore(votes, b.id) - getNetScore(votes, a.id)
  );

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="py-16 md:py-24 px-6 border-b border-neutral-800">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block px-3 py-1 bg-emerald-500/10 text-emerald-400 text-sm font-semibold rounded-full mb-6">
            Community Projects
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Showcase
          </h1>
          <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mx-auto mb-8">
            Promote your projects to the Cursor Boston community. Vote for the ones you love, discover what others are building, and get inspired.
          </p>
        </div>
      </section>

      {/* How to Submit Banner */}
      <section className="px-6 py-10 border-b border-neutral-800 bg-neutral-950">
        <div className="max-w-6xl mx-auto">
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 overflow-hidden">
            <button
              onClick={() => setInstructionsOpen(!instructionsOpen)}
              className="w-full flex items-center justify-between p-6 md:p-8 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-2xl"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">
                    Add Your Project
                  </h2>
                  <p className="text-neutral-400 text-sm mt-1">
                    Submit a pull request to feature your project here
                  </p>
                </div>
              </div>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`text-neutral-400 transition-transform shrink-0 ${instructionsOpen ? "rotate-180" : ""}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {instructionsOpen && (
              <div className="px-6 md:px-8 pb-8 border-t border-neutral-800">
                <div className="grid md:grid-cols-3 gap-6 mt-8">
                  {/* Step 1 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-bold flex items-center justify-center shrink-0">
                        1
                      </span>
                      <h3 className="text-white font-semibold">Set Up Your Profile</h3>
                    </div>
                    <div className="ml-11 space-y-2 text-sm text-neutral-400">
                      <p>
                        Create an account on Cursor Boston if you haven&apos;t already, and complete your profile.
                      </p>
                      <p>
                        Go to your <a href="/profile" className="text-emerald-400 hover:text-emerald-300 underline">Profile Settings</a> and connect your GitHub account. This verifies your identity and links your contributions.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-bold flex items-center justify-center shrink-0">
                        2
                      </span>
                      <h3 className="text-white font-semibold">Fork &amp; Edit</h3>
                    </div>
                    <div className="ml-11 space-y-2 text-sm text-neutral-400">
                      <p>
                        Fork the <a href="https://github.com/cursorboston/cursor-boston" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 underline">Cursor Boston repo</a> on GitHub.
                      </p>
                      <p>
                        Open <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-300 text-xs">content/showcase.json</code> and add your project entry to the <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-300 text-xs">projects</code> array with your name, description, image, categories, and contact info.
                      </p>
                      <p>
                        Add your project image to the <code className="bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-300 text-xs">public/showcase/</code> directory.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 text-sm font-bold flex items-center justify-center shrink-0">
                        3
                      </span>
                      <h3 className="text-white font-semibold">Submit a PR</h3>
                    </div>
                    <div className="ml-11 space-y-2 text-sm text-neutral-400">
                      <p>
                        Open a pull request from your fork to the main repo. In your PR description, briefly explain what your project does.
                      </p>
                      <p>
                        Once reviewed and merged, your project will appear here for the community to see and vote on!
                      </p>
                    </div>
                  </div>
                </div>

                {/* JSON template */}
                <div className="mt-8 bg-neutral-800/50 rounded-xl p-6 border border-neutral-700">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-white font-semibold text-sm">Project Entry Template</h4>
                  </div>
                  <pre className="text-sm text-neutral-300 overflow-x-auto">
{`{
  "id": "your-project-slug",
  "name": "Your Project Name",
  "description": "A short description of what your project does.",
  "image": "/showcase/your-image.png",
  "categories": ["AI/ML", "Developer Tools"],
  "contact": {
    "github": "https://github.com/you/your-repo",
    "website": "https://yoursite.com",
    "email": "you@example.com",
    "twitter": "https://twitter.com/you"
  },
  "submittedBy": "Your Name",
  "submittedDate": "2026-02-11"
}`}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Projects Grid */}
      <section className="py-12 md:py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white">
              Projects
            </h2>
            <span className="text-sm text-neutral-500">
              {sortedProjects.length} project{sortedProjects.length !== 1 ? "s" : ""}
            </span>
          </div>

          {submissionFeedback && (
            <div
              role={submissionFeedback.type === "error" ? "alert" : "status"}
              className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
                submissionFeedback.type === "error"
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              {submissionFeedback.message}
            </div>
          )}

          {isAdminOperator && (
            <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-sm font-semibold text-white">Submission Moderation</h3>
                {loadingPendingSubmissions && (
                  <span className="text-xs text-neutral-400">Loading pending...</span>
                )}
              </div>

              {adminFeedback && (
                <div
                  role={adminFeedback.type === "error" ? "alert" : "status"}
                  className={`mb-3 rounded-lg border px-3 py-2 text-xs ${
                    adminFeedback.type === "error"
                      ? "border-red-500/30 bg-red-500/10 text-red-300"
                      : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  }`}
                >
                  {adminFeedback.message}
                </div>
              )}

              {pendingSubmissions.length === 0 ? (
                <p className="text-xs text-neutral-400">No pending submissions.</p>
              ) : (
                <div className="space-y-2">
                  {pendingSubmissions.map((submission) => (
                    <div
                      key={submission.submissionId}
                      className="rounded-lg border border-neutral-800 bg-neutral-950 p-3"
                    >
                      <p className="text-sm text-white mb-1">
                        {submission.projectId || "(unknown project)"}
                      </p>
                      <p className="text-xs text-neutral-400 mb-2">
                        User: {submission.userId || "(unknown user)"}
                        {submission.resubmittedAt
                          ? ` • Resubmitted ${new Date(
                              submission.resubmittedAt
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}`
                          : submission.createdAt
                          ? ` • Submitted ${new Date(
                              submission.createdAt
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}`
                          : ""}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleModerationAction(submission.submissionId, "approve")
                          }
                          disabled={moderatingSubmissionId === submission.submissionId}
                          className="px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleModerationAction(submission.submissionId, "reject")
                          }
                          disabled={moderatingSubmissionId === submission.submissionId}
                          className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-neutral-800">
                <h4 className="text-xs font-semibold text-neutral-300 mb-2">Talk Moderation</h4>
                {talkModerationSubmissions.length === 0 ? (
                  <p className="text-xs text-neutral-400">No talks requiring moderation.</p>
                ) : (
                  <div className="space-y-2">
                    {talkModerationSubmissions.map((submission) => (
                      <div
                        key={submission.submissionId}
                        className="rounded-lg border border-neutral-800 bg-neutral-950 p-3"
                      >
                        <p className="text-sm text-white mb-1">
                          {submission.title || "(untitled talk)"}
                        </p>
                        <p className="text-xs text-neutral-400 mb-2">
                          User: {submission.userId || "(unknown user)"}
                          {submission.createdAt
                            ? ` • Submitted ${new Date(submission.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                }
                              )}`
                            : ""}
                          {` • ${submission.status}`}
                        </p>
                        <div className="flex gap-2">
                          {submission.status === "pending" ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleTalkModerationAction(submission.submissionId, "approve")
                              }
                              disabled={moderatingSubmissionId === submission.submissionId}
                              className="px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              Approve
                            </button>
                          ) : submission.status === "approved" ? (
                            <button
                              type="button"
                              onClick={() =>
                                handleTalkModerationAction(submission.submissionId, "complete")
                              }
                              disabled={moderatingSubmissionId === submission.submissionId}
                              className="px-3 py-1.5 rounded-md text-xs font-medium bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              Mark Delivered
                            </button>
                          ) : submission.status === "completed" ? (
                            <span className="px-3 py-1.5 rounded-md text-xs font-medium bg-neutral-800 text-neutral-400">
                              Resolved
                            </span>
                          ) : (
                            <span className="px-3 py-1.5 rounded-md text-xs font-medium bg-neutral-800 text-neutral-400">
                              No action
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {sortedProjects.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-neutral-400 text-lg">
                No projects yet. Be the first to submit one!
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  votes={votes[project.id]}
                  userVote={userVotes[project.id]}
                  isLoggedIn={!!user}
                  isVoting={votingId === project.id}
                  isSubmitting={submittingId === project.id}
                  submissionStatus={submittedProjects[project.id]}
                  onVote={handleVote}
                  onMarkSubmitted={handleMarkSubmitted}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ProjectCard({
  project,
  votes,
  userVote,
  isLoggedIn,
  isVoting,
  isSubmitting,
  submissionStatus,
  onVote,
  onMarkSubmitted,
}: {
  project: Project;
  votes?: { upCount: number; downCount: number };
  userVote?: string;
  isLoggedIn: boolean;
  isVoting: boolean;
  isSubmitting: boolean;
  submissionStatus?: SubmissionStatus;
  onVote: (projectId: string, type: "up" | "down") => void;
  onMarkSubmitted: (projectId: string) => void;
}) {
  const upCount = votes?.upCount || 0;
  const downCount = votes?.downCount || 0;
  const netScore = upCount - downCount;
  const [imgError, setImgError] = useState(false);

  const isSubmitted = Boolean(submissionStatus);
  const isPending = submissionStatus === "pending";
  const isApproved = submissionStatus === "approved";
  const isRejected = submissionStatus === "rejected";

  return (
    <div className="bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800 flex flex-col hover:border-neutral-700 transition-colors">
      {/* Image */}
      <div className="relative w-full h-48 bg-neutral-800">
        {!imgError ? (
          <Image
            src={project.image}
            alt={project.name}
            fill
            className="object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#525252" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col flex-1">
        <h3 className="text-lg font-bold text-white mb-2">{project.name}</h3>
        <p className="text-neutral-400 text-sm leading-relaxed mb-4 line-clamp-3 flex-1">
          {project.description}
        </p>

        {/* Categories */}
        <div className="flex flex-wrap gap-2 mb-4">
          {project.categories.map((cat) => (
            <span
              key={cat}
              className="px-2.5 py-1 bg-neutral-800 text-neutral-300 text-xs font-medium rounded-full"
            >
              {cat}
            </span>
          ))}
        </div>

        {/* Contact Links */}
        <div className="flex items-center gap-2 mb-4">
          {project.contact.github && (
            <a
              href={project.contact.github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-white transition-colors"
              aria-label="GitHub"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
          )}
          {project.contact.website && (
            <a
              href={project.contact.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-white transition-colors"
              aria-label="Website"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </a>
          )}
          {project.contact.twitter && (
            <a
              href={project.contact.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-white transition-colors"
              aria-label="Twitter"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
          )}
          {project.contact.linkedin && (
            <a
              href={project.contact.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-white transition-colors"
              aria-label="LinkedIn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
          )}
          {project.contact.email && (
            <a
              href={`mailto:${project.contact.email}`}
              className="text-neutral-500 hover:text-white transition-colors"
              aria-label="Email"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M22 7l-10 6L2 7" />
              </svg>
            </a>
          )}
        </div>

        {/* Divider + Voting */}
        <div className="pt-4 border-t border-neutral-800 flex items-center justify-between">
          <span className="text-xs text-neutral-500">
            by {project.submittedBy}
          </span>

          <div className="flex items-center gap-1">
            {/* Thumbs up */}
            <button
              onClick={() => onVote(project.id, "up")}
              disabled={!isLoggedIn || isVoting}
              title={isLoggedIn ? "Upvote" : "Sign in to vote"}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm transition-colors ${
                userVote === "up"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 10v12" />
                <path d="M15 5.88L14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88z" />
              </svg>
              <span>{upCount}</span>
            </button>

            {/* Net score */}
            <span
              className={`text-sm font-semibold min-w-8 text-center ${
                netScore > 0
                  ? "text-emerald-400"
                  : netScore < 0
                  ? "text-red-400"
                  : "text-neutral-500"
              }`}
            >
              {netScore > 0 ? `+${netScore}` : netScore}
            </span>

            {/* Thumbs down */}
            <button
              onClick={() => onVote(project.id, "down")}
              disabled={!isLoggedIn || isVoting}
              title={isLoggedIn ? "Downvote" : "Sign in to vote"}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-sm transition-colors ${
                userVote === "down"
                  ? "bg-red-500/10 text-red-400"
                  : "text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 14V2" />
                <path d="M9 18.12L10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88z" />
              </svg>
              <span>{downCount}</span>
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onMarkSubmitted(project.id)}
          disabled={!isLoggedIn || isSubmitting || isApproved || isPending}
          title={isLoggedIn ? "Mark this project as your submission" : "Sign in to mark submissions"}
          className={`mt-3 w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            isApproved
              ? "bg-emerald-500/10 text-emerald-400"
              : isRejected
              ? "bg-red-500/10 text-red-300 hover:bg-red-500/20"
              : isSubmitted
              ? "bg-amber-500/10 text-amber-300"
              : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          {isApproved
            ? "Submission Approved"
            : isRejected
            ? "Resubmit for Review"
            : isSubmitted
            ? "Pending Review"
            : isSubmitting
            ? "Recording..."
            : "Submit for Review"}
        </button>
      </div>
    </div>
  );
}
