/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/mailgun";
import { parseRequestBody } from "@/lib/api-response";
import { notifyAdminContract } from "@/lib/api-schemas/notify-admin";

function escapeHtml(text: string | undefined): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "hello@cursorboston.com";

export async function POST(request: NextRequest) {
  try {
    const bodyOrError = await parseRequestBody(request);
    if (bodyOrError instanceof NextResponse) return bodyOrError;
    const parsed = notifyAdminContract.event.body.safeParse(bodyOrError);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }
    const { name, email, organization, eventType, title, description, proposedDate, expectedAttendees, venue, additionalInfo, requestId } = parsed.data;

    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `New Event Request: ${escapeHtml(title)}`,
      html: `
        <h2>New Event Request</h2>
        <p>Someone wants to host or request an event with Cursor Boston!</p>
        <h3>Requester Info</h3>
        <ul>
          <li><strong>Name:</strong> ${escapeHtml(name)}</li>
          <li><strong>Email:</strong> ${escapeHtml(email)}</li>
          ${organization ? `<li><strong>Organization:</strong> ${escapeHtml(organization)}</li>` : ""}
        </ul>
        <h3>Event Details</h3>
        <ul>
          <li><strong>Type:</strong> ${escapeHtml(eventType)}</li>
          <li><strong>Title:</strong> ${escapeHtml(title)}</li>
          ${proposedDate ? `<li><strong>Proposed Date:</strong> ${escapeHtml(proposedDate)}</li>` : ""}
          <li><strong>Expected Attendees:</strong> ${escapeHtml(expectedAttendees)}</li>
          ${venue ? `<li><strong>Venue:</strong> ${escapeHtml(venue)}</li>` : ""}
        </ul>
        <h3>Description</h3>
        <p>${escapeHtml(description)}</p>
        ${additionalInfo ? `<h3>Additional Info</h3><p>${escapeHtml(additionalInfo)}</p>` : ""}
        <hr><p><small>Request ID: ${escapeHtml(requestId)}</small></p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[notify-admin/event]", error);
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
  }
}
