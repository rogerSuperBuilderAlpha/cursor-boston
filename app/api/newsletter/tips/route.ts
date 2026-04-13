/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest } from "next/server";
import { getLatestScheduledTip, updateTipStatus } from "@/lib/tips";
import { getActiveSubscribers } from "@/lib/tip-subscribers";
import { sendEmail } from "@/lib/mailgun";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe-token";
import { apiSuccess, apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_APP_URL || "https://cursorboston.com"
).replace(/\/$/, "");

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildTipEmailHtml(tip: { title: string; content: string; authorName: string }, unsubUrl: string): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,Segoe UI,sans-serif;line-height:1.6;color:#111;max-width:640px;margin:0 auto;">
<h2 style="color:#10b981;margin-bottom:4px;">Tip of the Week</h2>
<h3 style="margin-top:0;">${escapeHtml(tip.title)}</h3>
<p>${escapeHtml(tip.content)}</p>
<p style="font-size:14px;color:#666;">— ${escapeHtml(tip.authorName)}</p>
<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
<p style="font-size:14px;">
  <a href="${SITE_ORIGIN}/tips" style="color:#10b981;font-weight:600;">Browse all tips</a> · 
  <a href="${SITE_ORIGIN}/tips/submit" style="color:#10b981;font-weight:600;">Submit your own tip</a>
</p>
<p style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;font-size:12px;color:#888;">
You're receiving this because you subscribed to Cursor Boston weekly tips.<br/>
<a href="${escapeHtml(unsubUrl)}" style="color:#888;">Unsubscribe</a>
</p>
</body></html>`;
}

function buildTipEmailText(tip: { title: string; content: string; authorName: string }, unsubUrl: string): string {
  return `TIP OF THE WEEK: ${tip.title}

${tip.content}

— ${tip.authorName}

Browse all tips: ${SITE_ORIGIN}/tips
Submit your own: ${SITE_ORIGIN}/tips/submit

---
Unsubscribe: ${unsubUrl}`;
}

export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get("authorization") || "";

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return apiError("Unauthorized", 401);
    }

    const tip = await getLatestScheduledTip();
    if (!tip) {
      return apiSuccess({ message: "No scheduled tip found, nothing to send" });
    }

    const subscribers = await getActiveSubscribers();
    if (subscribers.length === 0) {
      return apiSuccess({ message: "No active subscribers" });
    }

    let sent = 0;
    let failed = 0;

    for (const sub of subscribers) {
      try {
        const unsubUrl = buildUnsubscribeUrl(sub.email);
        await sendEmail({
          to: sub.email,
          subject: `Cursor Boston Tip: ${tip.title}`,
          html: buildTipEmailHtml(tip, unsubUrl),
          text: buildTipEmailText(tip, unsubUrl),
        });
        sent++;
      } catch (err) {
        failed++;
        logger.logError(err, { subscriber: sub.email, tipId: tip.id });
      }
    }

    await updateTipStatus(tip.id, "published", {
      publishedAt: new Date().toISOString(),
    });

    return apiSuccess({ sent, failed, tipId: tip.id });
  } catch (error) {
    logger.logError(error, { endpoint: "/api/newsletter/tips POST" });
    return apiError("Internal server error", 500);
  }
}
