/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { Metadata } from "next";
import TipSubmitPage from "./TipSubmitPage";

export const metadata: Metadata = {
  title: "Submit a Tip — Weekly AI Dev Tips",
  description: "Share your favorite Cursor workflow hack with the community.",
};

export default function Page() {
  return (
    <main id="main-content" className="min-h-screen bg-white dark:bg-neutral-950">
      <TipSubmitPage />
    </main>
  );
}
