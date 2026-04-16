/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { notFound } from "next/navigation";
import { TREASURE_HUNT_PATHS } from "@/lib/treasure-hunt-paths";
import { HuntClaimForm } from "@/components/hunt/HuntClaimForm";

export const dynamic = "force-dynamic";

export default async function HuntClaimPage({
  params,
}: {
  params: Promise<{ pathId: string }>;
}) {
  const { pathId } = await params;
  const path = TREASURE_HUNT_PATHS[pathId];
  if (!path) notFound();

  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl font-bold">
        {path.emoji} {path.name}
      </h1>
      <p className="mt-4 text-zinc-400">{path.hint}</p>
      <div className="mt-8">
        <HuntClaimForm pathId={path.id} />
      </div>
      <p className="mt-8 text-xs text-zinc-500">
        One winner per path. You must be signed in, have GitHub and Discord
        linked, and have had a PR merged into the main repo in the last 24
        hours.
      </p>
    </main>
  );
}
