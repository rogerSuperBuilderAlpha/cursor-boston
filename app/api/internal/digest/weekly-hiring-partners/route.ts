/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * Weekly digest of pending hiring partner applications.
 * Invoke via Vercel cron with CRON_SECRET — never from user browsers.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/mailgun";
import {
  HIRING_PARTNERS_CALENDLY_URL,
  HIRING_PARTNERS_COLLECTION,
  HIRING_PARTNERS_NOTIFY_EMAIL,
} from "@/lib/hiring-partners";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function getCronSecret(request: NextRequest): string | null {
  return (
    request.headers.get("x-cron-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    null
  );
}

interface PendingRow {
  userId: string;
  contactName: string;
  email: string;
  phone: string;
  companyName: string;
  companyWebsite: string;
  contactRole: string;
  rolesHiring: string;
  notes: string;
  appliedAtMs: number | null;
}

function strField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function formatAppliedAt(ms: number | null): string {
  if (!ms) return "(unknown date)";
  return new Date(ms).toLocaleString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function handleDigest(request: NextRequest): Promise<NextResponse> {
  const invocationId = crypto.randomUUID();
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    logger.error("Hiring partners digest rejected: CRON_SECRET missing", {
      endpoint: "/api/internal/digest/weekly-hiring-partners",
      invocationId,
    });
    return NextResponse.json(
      { error: "Server not configured: CRON_SECRET not set" },
      { status: 500 }
    );
  }

  const secret = getCronSecret(request);
  if (!secret || secret !== cronSecret) {
    logger.warn("Hiring partners digest unauthorized", {
      endpoint: "/api/internal/digest/weekly-hiring-partners",
      invocationId,
    });
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing cron secret" },
      { status: 401 }
    );
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  try {
    const snap = await db
      .collection(HIRING_PARTNERS_COLLECTION)
      .where("status", "==", "pending")
      .get();

    const rows: PendingRow[] = snap.docs.map((doc) => {
      const data = doc.data();
      const createdAt = data.createdAt as { toMillis?: () => number } | undefined;
      return {
        userId: doc.id,
        contactName: strField(data.contactName),
        email: strField(data.email),
        phone: strField(data.phone),
        companyName: strField(data.companyName),
        companyWebsite: strField(data.companyWebsite),
        contactRole: strField(data.contactRole),
        rolesHiring: strField(data.rolesHiring),
        notes: strField(data.notes),
        appliedAtMs:
          createdAt && typeof createdAt.toMillis === "function"
            ? createdAt.toMillis()
            : null,
      };
    });
    rows.sort((a, b) => (a.appliedAtMs ?? 0) - (b.appliedAtMs ?? 0));

    if (rows.length === 0) {
      return NextResponse.json({
        ok: true,
        invocationId,
        pendingCount: 0,
        emailSent: false,
        reason: "no pending applications",
      });
    }

    const textLines: string[] = [];
    textLines.push(`Pending hiring partner applications: ${rows.length}`);
    textLines.push("");
    textLines.push(`Calendly (share with applicants): ${HIRING_PARTNERS_CALENDLY_URL}`);
    textLines.push("");
    for (const row of rows) {
      textLines.push(
        `• ${row.contactName || "(no name)"}${row.companyName ? ` — ${row.companyName}` : ""}`
      );
      textLines.push(`    Email:   ${row.email || "(none)"}`);
      textLines.push(`    Phone:   ${row.phone || "(none)"}`);
      if (row.contactRole) textLines.push(`    Role:    ${row.contactRole}`);
      if (row.companyWebsite) textLines.push(`    Site:    ${row.companyWebsite}`);
      if (row.rolesHiring) textLines.push(`    Hiring:  ${row.rolesHiring}`);
      if (row.notes) textLines.push(`    Notes:   ${row.notes}`);
      textLines.push(`    Applied: ${formatAppliedAt(row.appliedAtMs)}`);
      textLines.push(`    Doc:     ${HIRING_PARTNERS_COLLECTION}/${row.userId}`);
      textLines.push("");
    }
    textLines.push("Approve via Firebase CLI:");
    textLines.push(
      `  firebase firestore:documents:update ${HIRING_PARTNERS_COLLECTION}/<userId> --data '{"status":"approved"}'`
    );

    const rowsHtml = rows
      .map(
        (row) => `
          <li style="margin-bottom:18px;padding:12px;border:1px solid #e5e5e5;border-radius:8px">
            <div style="font-size:15px"><strong>${escapeHtml(row.contactName || "(no name)")}</strong>${row.companyName ? ` — ${escapeHtml(row.companyName)}` : ""}</div>
            <table style="margin-top:6px;border-collapse:collapse;font-size:13px">
              <tr><td style="padding:2px 12px 2px 0;color:#666">Email</td><td>${escapeHtml(row.email || "(none)")}</td></tr>
              <tr><td style="padding:2px 12px 2px 0;color:#666">Phone</td><td>${escapeHtml(row.phone || "(none)")}</td></tr>
              ${row.contactRole ? `<tr><td style="padding:2px 12px 2px 0;color:#666">Role</td><td>${escapeHtml(row.contactRole)}</td></tr>` : ""}
              ${row.companyWebsite ? `<tr><td style="padding:2px 12px 2px 0;color:#666">Site</td><td><a href="${escapeHtml(row.companyWebsite)}">${escapeHtml(row.companyWebsite)}</a></td></tr>` : ""}
              ${row.rolesHiring ? `<tr><td style="padding:2px 12px 2px 0;color:#666;vertical-align:top">Hiring</td><td style="white-space:pre-wrap">${escapeHtml(row.rolesHiring)}</td></tr>` : ""}
              ${row.notes ? `<tr><td style="padding:2px 12px 2px 0;color:#666;vertical-align:top">Notes</td><td style="white-space:pre-wrap">${escapeHtml(row.notes)}</td></tr>` : ""}
              <tr><td style="padding:2px 12px 2px 0;color:#666">Applied</td><td>${escapeHtml(formatAppliedAt(row.appliedAtMs))}</td></tr>
              <tr><td style="padding:2px 12px 2px 0;color:#666">Doc</td><td><code>${escapeHtml(HIRING_PARTNERS_COLLECTION)}/${escapeHtml(row.userId)}</code></td></tr>
            </table>
          </li>`
      )
      .join("");

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111;max-width:720px">
        <h2 style="margin:0 0 8px">Pending hiring partner applications: ${rows.length}</h2>
        <p style="margin:0 0 16px;color:#444">
          Calendly to share:
          <a href="${HIRING_PARTNERS_CALENDLY_URL}">${escapeHtml(HIRING_PARTNERS_CALENDLY_URL)}</a>
        </p>
        <ul style="list-style:none;padding:0;margin:0">${rowsHtml}</ul>
        <p style="margin:24px 0 0;color:#444">Approve via Firebase CLI when ready:</p>
        <pre style="background:#f5f5f5;padding:10px;border-radius:6px;font-size:12px;overflow:auto">firebase firestore:documents:update ${escapeHtml(HIRING_PARTNERS_COLLECTION)}/&lt;userId&gt; --data '{"status":"approved"}'</pre>
      </div>
    `;

    await sendEmail({
      to: HIRING_PARTNERS_NOTIFY_EMAIL,
      subject: `Hiring partners: ${rows.length} pending`,
      text: textLines.join("\n"),
      html,
    });

    return NextResponse.json({
      ok: true,
      invocationId,
      pendingCount: rows.length,
      emailSent: true,
    });
  } catch (error) {
    logger.logError(error, {
      endpoint: "/api/internal/digest/weekly-hiring-partners",
      invocationId,
    });
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        invocationId,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleDigest(request);
}

export async function POST(request: NextRequest) {
  return handleDigest(request);
}
