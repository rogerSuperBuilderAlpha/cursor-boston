/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { withMiddleware, rateLimitConfigs } from "@/lib/middleware";
import { logger } from "@/lib/logger";
import { sendEmail } from "@/lib/mailgun";
import {
  HIRING_PARTNERS_CALENDLY_URL,
  HIRING_PARTNERS_COLLECTION,
  HIRING_PARTNERS_MAX,
  HIRING_PARTNERS_NOTIFY_EMAIL,
  type HiringPartnerStatus,
} from "@/lib/hiring-partners";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PartnerApplicationDto {
  userId: string | null;
  email: string | null;
  contactName: string | null;
  phone: string | null;
  companyName: string | null;
  companyWebsite: string | null;
  contactRole: string | null;
  rolesHiring: string | null;
  notes: string | null;
  status: HiringPartnerStatus;
  createdAt: number | null;
  updatedAt: number | null;
}

function toMillis(value: unknown): number | null {
  if (value && typeof (value as { toMillis?: () => number }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

function serializeApplication(data: Record<string, unknown>): PartnerApplicationDto {
  const status = (data.status as HiringPartnerStatus) || "pending";
  return {
    userId: typeof data.userId === "string" ? data.userId : null,
    email: typeof data.email === "string" ? data.email : null,
    contactName: typeof data.contactName === "string" ? data.contactName : null,
    phone: typeof data.phone === "string" ? data.phone : null,
    companyName: typeof data.companyName === "string" ? data.companyName : null,
    companyWebsite: typeof data.companyWebsite === "string" ? data.companyWebsite : null,
    contactRole: typeof data.contactRole === "string" ? data.contactRole : null,
    rolesHiring: typeof data.rolesHiring === "string" ? data.rolesHiring : null,
    notes: typeof data.notes === "string" ? data.notes : null,
    status,
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
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

  const snap = await db.collection(HIRING_PARTNERS_COLLECTION).doc(user.uid).get();
  if (!snap.exists) {
    return NextResponse.json({ application: null });
  }
  return NextResponse.json({
    application: serializeApplication(snap.data() || {}),
  });
}

function trimOrEmpty(raw: unknown, max: number): string {
  if (typeof raw !== "string") return "";
  const trimmed = raw.trim();
  return trimmed.slice(0, max);
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
  const contactName = trimOrEmpty(raw.contactName, HIRING_PARTNERS_MAX.contactName);
  const phone = trimOrEmpty(raw.phone, HIRING_PARTNERS_MAX.phone);
  const companyName = trimOrEmpty(raw.companyName, HIRING_PARTNERS_MAX.companyName);
  const companyWebsite = trimOrEmpty(raw.companyWebsite, HIRING_PARTNERS_MAX.companyWebsite);
  const contactRole = trimOrEmpty(raw.contactRole, HIRING_PARTNERS_MAX.contactRole);
  const rolesHiring = trimOrEmpty(raw.rolesHiring, HIRING_PARTNERS_MAX.rolesHiring);
  const notes = trimOrEmpty(raw.notes, HIRING_PARTNERS_MAX.notes);

  if (!contactName) {
    return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: "Please enter a phone number." }, { status: 400 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  try {
    const ref = db.collection(HIRING_PARTNERS_COLLECTION).doc(user.uid);
    const existing = await ref.get();
    const baseFields = {
      userId: user.uid,
      email: user.email,
      contactName,
      phone,
      companyName,
      companyWebsite,
      contactRole,
      rolesHiring,
      notes,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (existing.exists) {
      await ref.set(baseFields, { merge: true });
    } else {
      await ref.set({
        ...baseFields,
        status: "pending" satisfies HiringPartnerStatus,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    const fresh = await ref.get();
    if (!existing.exists) {
      sendNewApplicationEmail({
        contactName,
        email: user.email,
        phone,
        companyName,
        companyWebsite,
        contactRole,
        rolesHiring,
        notes,
      }).catch((error) => {
        logger.logError(error, {
          endpoint: "/api/hiring-partners/apply",
          stage: "notify_email",
        });
      });
    }
    return NextResponse.json({
      application: serializeApplication(fresh.data() || {}),
    });
  } catch (error) {
    logger.logError(error, {
      endpoint: "/api/hiring-partners/apply",
      method: "POST",
    });
    return NextResponse.json(
      { error: "Failed to save application" },
      { status: 500 }
    );
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface NewApplicantPayload {
  contactName: string;
  email: string;
  phone: string;
  companyName: string;
  companyWebsite: string;
  contactRole: string;
  rolesHiring: string;
  notes: string;
}

async function sendNewApplicationEmail(applicant: NewApplicantPayload): Promise<void> {
  const fields: Array<[string, string]> = [
    ["Name", applicant.contactName],
    ["Email", applicant.email],
    ["Phone", applicant.phone],
    ["Company", applicant.companyName || "(not provided yet)"],
    ["Website", applicant.companyWebsite || "(not provided yet)"],
    ["Role / title", applicant.contactRole || "(not provided yet)"],
    ["Roles hiring", applicant.rolesHiring || "(not provided yet)"],
    ["Notes", applicant.notes || "(none)"],
  ];

  const textLines = ["New Cursor Boston hiring partner application:", ""];
  for (const [label, value] of fields) {
    textLines.push(`  ${label}: ${value}`);
  }
  textLines.push("");
  textLines.push(`Their next step: book a call at ${HIRING_PARTNERS_CALENDLY_URL}`);
  textLines.push("");
  textLines.push("Approve via Firebase CLI when ready:");
  textLines.push(
    `  firebase firestore:documents:update ${HIRING_PARTNERS_COLLECTION}/<userId> --data '{"status":"approved"}'`
  );

  const rowsHtml = fields
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:4px 12px 4px 0;color:#666;vertical-align:top">${escapeHtml(label)}</td>
          <td style="padding:4px 0;white-space:pre-wrap">${escapeHtml(value)}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111;max-width:640px">
      <h2 style="margin:0 0 12px">New hiring partner application</h2>
      <table style="border-collapse:collapse;font-size:14px">${rowsHtml}</table>
      <p style="margin:20px 0 0">
        Their next step: book a call at
        <a href="${HIRING_PARTNERS_CALENDLY_URL}">${escapeHtml(HIRING_PARTNERS_CALENDLY_URL)}</a>.
      </p>
      <p style="margin:12px 0 0;color:#444">Approve via Firebase CLI when ready.</p>
    </div>
  `;

  await sendEmail({
    to: HIRING_PARTNERS_NOTIFY_EMAIL,
    subject: `Hiring partner application: ${applicant.contactName}${applicant.companyName ? ` (${applicant.companyName})` : ""}`,
    text: textLines.join("\n"),
    html,
  });
}

export const GET = withMiddleware(rateLimitConfigs.standard, handleGet);
export const POST = withMiddleware(rateLimitConfigs.standard, handlePost);
