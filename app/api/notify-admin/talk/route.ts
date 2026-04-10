/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/mailgun";

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
    const body = await request.json();
    const { name, email, title, description, category, duration, experience, bio, linkedIn, twitter, previousTalks, submissionId } = body;

    if (!name || !email || !title) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `New Talk Submission: ${escapeHtml(title)}`,
      html: `
        <h2>New Talk Submission</h2>
        <p>Someone has submitted a talk idea for Cursor Boston!</p>
        <h3>Submitter Info</h3>
        <ul>
          <li><strong>Name:</strong> ${escapeHtml(name)}</li>
          <li><strong>Email:</strong> ${escapeHtml(email)}</li>
          ${linkedIn ? `<li><strong>LinkedIn:</strong> ${escapeHtml(linkedIn)}</li>` : ""}
          ${twitter ? `<li><strong>Twitter:</strong> ${escapeHtml(twitter)}</li>` : ""}
        </ul>
        <h3>Talk Details</h3>
        <ul>
          <li><strong>Title:</strong> ${escapeHtml(title)}</li>
          <li><strong>Category:</strong> ${escapeHtml(category)}</li>
          <li><strong>Duration:</strong> ${escapeHtml(duration)}</li>
          <li><strong>Experience Level:</strong> ${escapeHtml(experience)}</li>
        </ul>
        <h3>Description</h3>
        <p>${escapeHtml(description)}</p>
        ${bio ? `<h3>Speaker Bio</h3><p>${escapeHtml(bio)}</p>` : ""}
        ${previousTalks ? `<h3>Previous Speaking Experience</h3><p>${escapeHtml(previousTalks)}</p>` : ""}
        <hr><p><small>Submission ID: ${escapeHtml(submissionId)}</small></p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[notify-admin/talk]", error);
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
  }
}
