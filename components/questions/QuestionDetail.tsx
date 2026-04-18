/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, ThumbsUp, ThumbsDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { Question, Answer, VoteType } from "@/types/questions";
import type { CookbookEntry } from "@/types/cookbook";
import { AnswerCard } from "./AnswerCard";
import { AnswerComposer } from "./AnswerComposer";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

async function fetchIdToken(firebaseUser: import("firebase/auth").User) {
  const { getIdToken } = await import("firebase/auth");
  return getIdToken(firebaseUser);
}

export function QuestionDetail({
  questionId,
  initialQuestion,
  initialAnswers,
  initialRelatedCookbook,
}: {
  questionId: string;
  initialQuestion: Question;
  initialAnswers: Answer[];
  initialRelatedCookbook: CookbookEntry[];
}) {
  const { user } = useAuth();
  const [question, setQuestion] = useState(initialQuestion);
  const [answers, setAnswers] = useState(initialAnswers);
  const [userVotes, setUserVotes] = useState<Record<string, VoteType>>({});
  const [votingId, setVotingId] = useState<string | null>(null);

  const isLoggedIn = !!user;
  const isQuestionAuthor = user?.uid === question.authorId;

  const fetchVotes = useCallback(async () => {
    if (!user) return;
    try {
      const token = await fetchIdToken(user);
      const res = await fetch("/api/questions/vote", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setUserVotes(data.userVotes || {});
      }
    } catch {
      // Non-critical — UI still works without user vote state
    }
  }, [user]);

  useEffect(() => {
    fetchVotes();
  }, [fetchVotes]);

  const handleVote = useCallback(
    async (targetType: "question" | "answer", targetId: string, voteType: VoteType) => {
      if (!user || votingId) return;
      setVotingId(targetId);
      try {
        const token = await fetchIdToken(user);
        const res = await fetch("/api/questions/vote", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            targetType,
            targetId,
            type: voteType,
            ...(targetType === "answer" ? { questionId } : {}),
          }),
        });
        if (res.ok) {
          const result = await res.json();
          if (targetType === "question") {
            setQuestion((prev) => ({
              ...prev,
              upCount: result.upCount,
              downCount: result.downCount,
              netScore: result.netScore,
            }));
          } else {
            setAnswers((prev) =>
              prev.map((a) =>
                a.id === targetId
                  ? { ...a, upCount: result.upCount, downCount: result.downCount, netScore: result.netScore }
                  : a
              )
            );
          }
          setUserVotes((prev) => {
            const next = { ...prev };
            if (result.action === "removed") {
              delete next[targetId];
            } else {
              next[targetId] = result.type;
            }
            return next;
          });
        }
      } finally {
        setVotingId(null);
      }
    },
    [user, votingId, questionId]
  );

  const handleAccept = useCallback(
    async (answerId: string) => {
      if (!user) return;
      try {
        const token = await fetchIdToken(user);
        const res = await fetch("/api/questions/accept", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ questionId, answerId }),
        });
        if (res.ok) {
          setAnswers((prev) =>
            prev.map((a) => ({
              ...a,
              isAccepted: a.id === answerId ? !a.isAccepted : false,
            }))
          );
        }
      } catch {
        // Non-critical
      }
    },
    [user, questionId]
  );

  const handleSubmitAnswer = useCallback(
    async (body: string) => {
      if (!user) throw new Error("Sign in to answer");
      const token = await fetchIdToken(user);
      const res = await fetch("/api/questions/answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ questionId, body }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to post answer");
      }
      // Refetch answers
      const detailRes = await fetch(`/api/questions/${questionId}`);
      if (detailRes.ok) {
        const detail = await detailRes.json();
        setAnswers(detail.answers);
        setQuestion((prev) => ({ ...prev, answerCount: detail.question.answerCount }));
      }
    },
    [user, questionId]
  );

  const netScore = question.upCount - question.downCount;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/questions"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        Back to Q&A
      </Link>

      {/* Question */}
      <div className="flex gap-4">
        <div className="flex flex-col items-center gap-1 min-w-[48px]">
          <button
            type="button"
            onClick={() => handleVote("question", question.id, "up")}
            disabled={!isLoggedIn || !!votingId}
            aria-label="Upvote question"
            className={[
              "p-1.5 rounded transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
              userVotes[question.id] === "up"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300",
              (!isLoggedIn || !!votingId) ? "opacity-50 cursor-not-allowed" : "",
            ].join(" ")}
          >
            <ThumbsUp size={20} />
          </button>
          <span
            className={[
              "text-lg font-bold",
              netScore > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : netScore < 0
                  ? "text-red-500"
                  : "text-neutral-500",
            ].join(" ")}
          >
            {netScore > 0 ? `+${netScore}` : netScore}
          </span>
          <button
            type="button"
            onClick={() => handleVote("question", question.id, "down")}
            disabled={!isLoggedIn || !!votingId}
            aria-label="Downvote question"
            className={[
              "p-1.5 rounded transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
              userVotes[question.id] === "down"
                ? "text-red-500"
                : "text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300",
              (!isLoggedIn || !!votingId) ? "opacity-50 cursor-not-allowed" : "",
            ].join(" ")}
          >
            <ThumbsDown size={20} />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{question.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-neutral-500">
            <span>Asked by {question.authorName}</span>
            <span>&middot;</span>
            <span>{timeAgo(question.createdAt)}</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {question.tags.map((tag) => (
              <Link
                key={tag}
                href={`/questions?tag=${tag}`}
                className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 rounded text-xs hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                {tag}
              </Link>
            ))}
          </div>
          <div className="mt-4 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {question.body}
          </div>
        </div>
      </div>

      {/* Answers section */}
      <div className="mt-10">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          {answers.length} {answers.length === 1 ? "Answer" : "Answers"}
        </h2>
        <div className="space-y-4">
          {answers.map((answer) => (
            <AnswerCard
              key={answer.id}
              answer={answer}
              userVote={userVotes[answer.id]}
              isLoggedIn={isLoggedIn}
              isVoting={votingId === answer.id}
              isQuestionAuthor={isQuestionAuthor}
              onVote={(answerId, type) => handleVote("answer", answerId, type)}
              onAccept={handleAccept}
            />
          ))}
        </div>
      </div>

      {/* Answer composer */}
      <div className="mt-8">
        <AnswerComposer isLoggedIn={isLoggedIn} onSubmit={handleSubmitAnswer} />
      </div>

      {/* Related cookbook entries */}
      {initialRelatedCookbook.length > 0 && (
        <div className="mt-10 border border-neutral-200 dark:border-neutral-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Related Cookbook Entries</h3>
          <ul className="space-y-2">
            {initialRelatedCookbook.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={`/cookbook/${entry.id}`}
                  className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  {entry.title}
                </Link>
                <p className="text-xs text-neutral-500 line-clamp-1">{entry.description}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
