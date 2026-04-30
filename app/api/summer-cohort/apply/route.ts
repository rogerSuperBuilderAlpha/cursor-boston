/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { withMiddleware, rateLimitConfigs } from "@/lib/middleware";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/mailgun";
import {
  SUMMER_COHORTS,
  SUMMER_COHORT_COLLECTION,
  SUMMER_COHORT_NOTIFY_EMAIL,
  SUMMER_COHORT_SITE_ID,
  isValidCohortId,
  type SummerCohortId,
} from "@/lib/summer-cohort";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NAME = 200;
const MAX_PHONE = 50;

function serializeApplication(data: Record<string, unknown>) {
  const createdAt = data.createdAt;
  const updatedAt = data.updatedAt;
  return {
    userId: data.userId ?? null,
    email: data.email ?? null,
    name: data.name ?? null,
    phone: data.phone ?? null,
    cohorts: Array.isArray(data.cohorts) ? data.cohorts : [],
    siteId: data.siteId ?? null,
    status: data.status ?? "pending",
    createdAt:
      createdAt && typeof (createdAt as { toMillis?: () => number }).toMillis === "function"
        ? (createdAt as { toMillis: () => number }).toMillis()
        : null,
    updatedAt:
      updatedAt && typeof (updatedAt as { toMillis?: () => number }).toMillis === "function"
        ? (updatedAt as { toMillis: () => number }).toMillis()
        : null,
  };
}

async function handleGet(request: NextRequest) {
  const user = await getVerifiedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const snap = await db.collection(SUMMER_COHORT_COLLECTION).doc(user.uid).get();
  if (!snap.exists) {
    return NextResponse.json({ application: null });
  }
  return NextResponse.json({ application: serializeApplication(snap.data() || {}) });
}

async function handlePost(request: NextRequest) {
  const user = await getVerifiedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!user.email) {
    return NextResponse.json(
      { error: "Your account is missing an email address." },
      { status: 400 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = (body || {}) as Record<string, unknown>;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const phone = typeof raw.phone === "string" ? raw.phone.trim() : "";
  const cohortsInput = Array.isArray(raw.cohorts) ? raw.cohorts : [];

  if (!name || name.length > MAX_NAME) {
    return NextResponse.json(
      { error: `Name is required and must be 1-${MAX_NAME} characters.` },
      { status: 400 }
    );
  }
  if (!phone || phone.length > MAX_PHONE) {
    return NextResponse.json(
      { error: `Phone is required and must be 1-${MAX_PHONE} characters.` },
      { status: 400 }
    );
  }

  const cohorts: SummerCohortId[] = [];
  const seen = new Set<SummerCohortId>();
  for (const value of cohortsInput) {
    if (isValidCohortId(value) && !seen.has(value)) {
      seen.add(value);
      cohorts.push(value);
    }
  }
  if (cohorts.length === 0) {
    return NextResponse.json(
      { error: "Pick at least one cohort." },
      { status: 400 }
    );
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  try {
    const ref = db.collection(SUMMER_COHORT_COLLECTION).doc(user.uid);
    const existing = await ref.get();
    const baseFields = {
      userId: user.uid,
      email: user.email,
      name,
      phone,
      cohorts,
      siteId: SUMMER_COHORT_SITE_ID,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (existing.exists) {
      await ref.set(baseFields, { merge: true });
    } else {
      await ref.set({
        ...baseFields,
        status: "pending",
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    const fresh = await ref.get();
    const isNew = !existing.exists;
    if (isNew) {
      // Fire-and-forget — never let a Mailgun blip fail the user's submission.
      sendNewApplicationEmail(db, {
        name,
        email: user.email,
        phone,
        cohorts,
      }).catch((error) => {
        logger.logError(error, {
          endpoint: "/api/summer-cohort/apply",
          stage: "notify_email",
        });
      });
    }
    return NextResponse.json({ application: serializeApplication(fresh.data() || {}) });
  } catch (error) {
    logger.logError(error, {
      endpoint: "/api/summer-cohort/apply",
      method: "POST",
    });
    return NextResponse.json(
      { error: "Failed to save application" },
      { status: 500 }
    );
  }
}

interface ApplicantRow {
  name: string;
  email: string;
  phone: string;
  cohorts: SummerCohortId[];
  appliedAtMs: number | null;
}

function formatAppliedAt(ms: number | null): string {
  if (!ms) return "(unknown)";
  const d = new Date(ms);
  return d.toLocaleString("en-US", {
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

async function sendNewApplicationEmail(
  db: Firestore,
  applicant: { name: string; email: string; phone: string; cohorts: SummerCohortId[] }
): Promise<void> {
  const snap = await db
    .collection(SUMMER_COHORT_COLLECTION)
    .orderBy("createdAt", "asc")
    .get();

  const all: ApplicantRow[] = snap.docs.map((doc) => {
    const data = doc.data();
    const createdAt = data.createdAt as { toMillis?: () => number } | undefined;
    return {
      name: typeof data.name === "string" ? data.name : "",
      email: typeof data.email === "string" ? data.email : "",
      phone: typeof data.phone === "string" ? data.phone : "",
      cohorts: Array.isArray(data.cohorts)
        ? data.cohorts.filter(isValidCohortId)
        : [],
      appliedAtMs:
        createdAt && typeof createdAt.toMillis === "function"
          ? createdAt.toMillis()
          : null,
    };
  });

  const cohortLabel = new Map(SUMMER_COHORTS.map((c) => [c.id, c.label] as const));
  const dateRange = new Map(
    SUMMER_COHORTS.map(
      (c) => [c.id, `${c.startLabel} – ${c.endLabel}`] as const
    )
  );

  const cohortBuckets = SUMMER_COHORTS.map((cohort) => ({
    id: cohort.id,
    label: cohort.label,
    range: dateRange.get(cohort.id) || "",
    rows: all.filter((row) => row.cohorts.includes(cohort.id)),
  }));

  // ---- Plain-text body
  const textLines: string[] = [];
  textLines.push("New Cursor Boston Summer Cohort application:");
  textLines.push("");
  textLines.push(`  Name:    ${applicant.name}`);
  textLines.push(`  Email:   ${applicant.email}`);
  textLines.push(`  Phone:   ${applicant.phone}`);
  textLines.push(
    `  Cohorts: ${applicant.cohorts
      .map((id) => cohortLabel.get(id) || id)
      .join(", ")}`
  );
  textLines.push("");
  textLines.push(`Total applications: ${all.length}`);
  textLines.push("");
  for (const bucket of cohortBuckets) {
    textLines.push(`---- ${bucket.label} (${bucket.range}) — ${bucket.rows.length} ----`);
    if (bucket.rows.length === 0) {
      textLines.push("  (no applicants yet)");
    } else {
      for (const row of bucket.rows) {
        textLines.push(
          `  • ${row.name} <${row.email}> — applied ${formatAppliedAt(row.appliedAtMs)}`
        );
      }
    }
    textLines.push("");
  }

  // ---- HTML body
  const htmlSections = cohortBuckets
    .map((bucket) => {
      const rowsHtml =
        bucket.rows.length === 0
          ? `<li style="color:#888">(no applicants yet)</li>`
          : bucket.rows
              .map(
                (row) =>
                  `<li><strong>${escapeHtml(row.name)}</strong> &lt;${escapeHtml(row.email)}&gt; — applied ${escapeHtml(formatAppliedAt(row.appliedAtMs))}</li>`
              )
              .join("");
      return `
        <h3 style="margin:24px 0 4px">${escapeHtml(bucket.label)} <span style="color:#666;font-weight:normal">(${escapeHtml(bucket.range)}) — ${bucket.rows.length}</span></h3>
        <ul style="margin:4px 0 0;padding-left:20px;line-height:1.6">${rowsHtml}</ul>
      `;
    })
    .join("");

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111;max-width:640px">
      <h2 style="margin:0 0 12px">New Summer Cohort application</h2>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:2px 12px 2px 0;color:#666">Name</td><td><strong>${escapeHtml(applicant.name)}</strong></td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#666">Email</td><td>${escapeHtml(applicant.email)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#666">Phone</td><td>${escapeHtml(applicant.phone)}</td></tr>
        <tr><td style="padding:2px 12px 2px 0;color:#666">Cohorts</td><td>${escapeHtml(applicant.cohorts.map((id) => cohortLabel.get(id) || id).join(", "))}</td></tr>
      </table>
      <p style="margin:20px 0 0;color:#444">Total applications: <strong>${all.length}</strong></p>
      ${htmlSections}
    </div>
  `;

  await sendEmail({
    to: SUMMER_COHORT_NOTIFY_EMAIL,
    subject: `Summer Cohort application: ${applicant.name}`,
    text: textLines.join("\n"),
    html,
  });
}

export const GET = withMiddleware(rateLimitConfigs.standard, handleGet);
export const POST = withMiddleware(rateLimitConfigs.standard, handlePost);
