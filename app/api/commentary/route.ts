/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextResponse } from "next/server";

import { CommentaryBody } from "@/lib/api-schemas/commentary";

const glazeLines = [
  "Boston is playing with main character energy right now. That possession had receipts.",
  "That was pure green-light basketball. The whole arena felt that one.",
  "The Celtics are moving like every pass already knows where it belongs.",
];

const roastLines = [
  "New York's defense looked decorative on that play. Nice colors, zero resistance.",
  "The Knicks just turned that possession into a cautionary tale.",
  "That sequence had the confidence of a team that forgot the Celtics can also jump.",
];

export async function POST(request: Request) {
  const raw = await request.json().catch(() => ({}));
  const parsed = CommentaryBody.safeParse(raw);
  const body = parsed.success ? parsed.data : {};
  const isGlaze = body.mode === "glaze";
  const lines = isGlaze ? glazeLines : roastLines;
  const selected = lines[Math.floor(Math.random() * lines.length)];

  return NextResponse.json({
    commentary: selected,
    sentiment: isGlaze ? "glaze" : "roast",
    crowdEnergy: isGlaze ? 94 : 88,
    event: body.event ?? "Live play update",
    targetTeam: body.targetTeam ?? "Knicks",
    persona: body.persona ?? "Boston superfan",
    intensity: body.intensity ?? "savage but clean",
    homeTeam: body.homeTeam ?? "Celtics",
  });
}
