/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { QuestionsListing } from "@/components/questions/QuestionsListing";
import { SectionHelp } from "@/components/SectionHelp";

export const metadata: Metadata = {
  title: "Community Q&A | Cursor Boston",
  description:
    "Ask and answer questions about Cursor workflows, prompting patterns, and AI-assisted development.",
};

export default function QuestionsPage() {
  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <SectionHelp
        title="How Q&A works"
        intro={
          <>
            Ask anything about Cursor, AI-assisted workflows, or the
            community. Anyone signed in can answer; askers can accept the
            answer that solved their problem, and votes surface the best
            answers.
          </>
        }
        faq={[
          {
            q: "What makes a good question?",
            a: "Be specific. Include what you tried, what failed, and the Cursor version or model where relevant. Short, focused questions get answered faster.",
          },
          {
            q: "How does \"accepted answer\" work?",
            a: "Only the asker can accept. Accepting one answer doesn't downvote the others — it just marks which one solved the problem.",
          },
          {
            q: "Where should I ask vs. Discord?",
            a: "Use Q&A for questions whose answers benefit others later. Use Discord for real-time troubleshooting and casual chat.",
          },
        ]}
        links={[
          { label: "Ask a question", href: "/questions/ask" },
          {
            label: "Discord — real-time help",
            href: "https://discord.gg/Wsncg8YYqc",
            external: true,
          },
        ]}
      />
      <ErrorBoundary
        title="Failed to load questions"
        description="Failed to load questions. Please refresh."
      >
        <QuestionsListing />
      </ErrorBoundary>
    </main>
  );
}
