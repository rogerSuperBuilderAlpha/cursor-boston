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
    const { name, email, school, department, advisor, thesisTitle, abstract, userId } = body;

    if (!name || !email || !thesisTitle) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await sendEmail({
      to: ADMIN_EMAIL,
      subject: `CFP Submission: ${escapeHtml(thesisTitle)}`,
      html: `
        <h2>New CFP Submission</h2>
        <p>A graduate student has submitted to the "What is AI?" conference.</p>
        <h3>Submitter Info</h3>
        <ul>
          <li><strong>Name:</strong> ${escapeHtml(name)}</li>
          <li><strong>Email:</strong> ${escapeHtml(email)}</li>
          <li><strong>School:</strong> ${escapeHtml(school)}</li>
          <li><strong>Department:</strong> ${escapeHtml(department)}</li>
          <li><strong>Advisor:</strong> ${escapeHtml(advisor)}</li>
          <li><strong>Thesis Title:</strong> ${escapeHtml(thesisTitle)}</li>
        </ul>
        <h3>Abstract</h3>
        <p>${escapeHtml(abstract)}</p>
        <hr><p><small>User ID: ${escapeHtml(userId)}</small></p>
      `,
    });

    await sendEmail({
      to: email,
      subject: `CFP Submission Received: ${escapeHtml(thesisTitle)}`,
      text: `Hi ${escapeHtml(name)},\n\nWe've received your submission to the Cursor Boston Graduate Student Conference "What is AI?"\n\nThesis Title: ${escapeHtml(thesisTitle)}\n\nYou can edit your submission until May 1, 2026. We'll notify you at this email by June 1, 2026.\n\n— Cursor Boston`,
      html: `
        <p>Hi ${escapeHtml(name)},</p>
        <p>We've received your submission to the Cursor Boston Graduate Student Conference "What is AI?"</p>
        <p><strong>Thesis Title:</strong> ${escapeHtml(thesisTitle)}</p>
        <p>You can edit your submission until May 1, 2026. We'll notify you at this email by June 1, 2026.</p>
        <p>— Cursor Boston</p>
      `,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[notify-admin/cfp]", error);
    return NextResponse.json({ error: "Failed to send notification" }, { status: 500 });
  }
}
