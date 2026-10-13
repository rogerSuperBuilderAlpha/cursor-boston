/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  assembleReferralUrl,
  linkFragmentHuntEnabled,
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

    const parsed = huntContract.linkFragmentAssemble.body.safeParse(
      await request.json().catch(() => ({}))
    );
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, reason: "validation_error" },
        { status: 400 }
      );
    }

    const result = assembleReferralUrl(
      parsed.data.tokens as Partial<Record<LinkFragmentPuzzleId, string>>
    );
    if (!result.ok) {
      return NextResponse.json({ ok: false, reason: result.reason }, { status: 400 });
    }

    return NextResponse.json({ ok: true, url: result.url });
  } catch (e) {
    console.error("[hunt/link-fragment/assemble]", e);
    return NextResponse.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
}
