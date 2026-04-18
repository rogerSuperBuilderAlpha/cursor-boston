/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getQuestionsService } from "@/lib/questions/service";
import { QuestionDetail } from "@/components/questions/QuestionDetail";

interface PageProps {
  params: Promise<{ questionId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const { questionId } = await params;
    const service = getQuestionsService();
    const question = await service.getQuestion(questionId);
    if (!question) return { title: "Question Not Found | Cursor Boston" };
    return {
      title: `${question.title} | Community Q&A | Cursor Boston`,
      description: question.body.slice(0, 160),
    };
  } catch {
    return { title: "Community Q&A | Cursor Boston" };
  }
}

export default async function QuestionDetailPage({ params }: PageProps) {
  let question, answers, relatedCookbook;

  try {
    const { questionId } = await params;
    const service = getQuestionsService();
    question = await service.getQuestion(questionId);
    if (!question) notFound();

    [answers, relatedCookbook] = await Promise.all([
      service.getAnswersForQuestion(questionId, "top"),
      service.getRelatedCookbookEntries(question.tags),
    ]);
  } catch {
    notFound();
  }

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <QuestionDetail
        questionId={question.id}
        initialQuestion={question}
        initialAnswers={answers}
        initialRelatedCookbook={relatedCookbook}
      />
    </main>
  );
}
