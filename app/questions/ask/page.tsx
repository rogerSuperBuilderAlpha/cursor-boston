/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";
import { AskQuestionForm } from "./AskQuestionForm";

export const metadata: Metadata = {
  title: "Ask a Question | Community Q&A | Cursor Boston",
  description: "Ask the Cursor Boston community a question about AI-assisted development.",
};

export default function AskQuestionPage() {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <AskQuestionForm />
    </main>
  );
}
