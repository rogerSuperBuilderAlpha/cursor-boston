/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Metadata } from "next";
import { LinkFragmentAssembler } from "@/components/hunt/LinkFragmentAssembler";

export const metadata: Metadata = {
  title: "Link Fragment Hunt",
  robots: { index: false, follow: false },
};

export default function LinkFragmentHuntPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold">Complete the link</h1>
      <p className="mt-3 text-zinc-400">
        Cursor Boston × Hult Summer Hackathon attendees: the referral URL you
        received is missing its code. Hunt six fragments across the site, then
        paste them together here.
      </p>
      <div className="mt-10">
        <LinkFragmentAssembler />
      </div>
    </main>
  );
}
