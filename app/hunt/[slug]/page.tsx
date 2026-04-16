/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { notFound } from "next/navigation";
import { HuntClaimForm } from "@/components/hunt/HuntClaimForm";
import { TREASURE_HUNT_PATHS } from "@/lib/treasure-hunt-paths";

export const dynamic = "force-dynamic";

/**
 * The Librarian path landing. The slug must match
 * TREASURE_HUNT_LIBRARIAN_SLUG (set via env). Any other slug 404s, so the
 * page itself gates discovery — a visitor who found the right slug gets the
 * claim form preloaded; anyone else sees nothing.
 */
export default async function HuntSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const expected = (process.env.TREASURE_HUNT_LIBRARIAN_SLUG || "open-sesame")
    .trim()
    .toLowerCase();
  if (slug.trim().toLowerCase() !== expected) notFound();
  const path = TREASURE_HUNT_PATHS["librarian"];
  if (!path) notFound();
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold">
        {path.emoji} {path.name}
      </h1>
      <p className="mt-4 text-zinc-400">
        You read between the lines. Confirm the slug below to claim.
      </p>
      <div className="mt-8">
        <HuntClaimForm pathId="librarian" initialAnswer={slug} />
      </div>
    </main>
  );
}
