/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getLinkFragmentPuzzle,
  getLinkFragmentSlices,
  linkFragmentHuntEnabled,
  signLinkFragmentToken,
  type LinkFragmentPuzzleId,
} from "@/lib/link-fragment-hunt";
import { huntContract } from "@/lib/api-schemas/hunt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    if (!linkFragmentHuntEnabled()) {
      return NextResponse.json({ ok: false, reason: "disabled" }, { status: 403 });
    }

    const parsed = huntContract.linkFragmentVerify.body.safeParse(
      await request.json().catch(() => ({}))
    );
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, reason: "validation_error" },
        { status: 400 }
      );
    }

    const puzzle = getLinkFragmentPuzzle(parsed.data.puzzleId);
    if (!puzzle) {
      return NextResponse.json({ ok: false, reason: "unknown_puzzle" }, { status: 404 });
    }

    if (!puzzle.verify(parsed.data.answer)) {
      return NextResponse.json({ ok: false, reason: "wrong_answer" });
    }

    const slices = getLinkFragmentSlices();
    const fragment = slices[puzzle.index];
    if (!fragment) {
      return NextResponse.json({ ok: false, reason: "server_error" }, { status: 500 });
    }

    const token = signLinkFragmentToken(
      puzzle.id as LinkFragmentPuzzleId,
      fragment
    );

    return NextResponse.json({
      ok: true,
      puzzleId: puzzle.id,
      fragment,
      index: puzzle.index,
      token,
    });
  } catch (e) {
    console.error("[hunt/link-fragment/verify]", e);
    return NextResponse.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
