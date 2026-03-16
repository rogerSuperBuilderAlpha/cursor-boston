import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logApiError } from "@/lib/logger";
import { sendEmail } from "@/lib/mailgun";

const CODE_LENGTH = 6;
const CODE_EXPIRY_MINUTES = 15;

function isValidEduEmail(email: string): boolean {
  return email.toLowerCase().trim().endsWith(".edu");
}

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (!isValidEduEmail(normalizedEmail)) {
      return NextResponse.json(
        { error: "Please enter a valid .edu email address" },
        { status: 400 }
      );
    }

    if (normalizedEmail.length > 254) {
      return NextResponse.json({ error: "Email is too long" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const adminAuth = getAdminAuth();
    if (!adminDb || !adminAuth) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    // Check if email is already used as primary by any account
    const usersWithEmail = await adminAuth.getUserByEmail(normalizedEmail).catch(() => null);
    if (usersWithEmail) {
      return NextResponse.json(
        { error: "This email is already associated with an account" },
        { status: 400 }
      );
    }

    const emailLookupRef = adminDb.collection("emailLookup").doc(normalizedEmail);
    const emailLookupDoc = await emailLookupRef.get();
    if (emailLookupDoc.exists) {
      return NextResponse.json(
        { error: "This email is already associated with an account" },
        { status: 400 }
      );
    }

    const userRef = adminDb.collection("users").doc(user.uid);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    if (userData?.email?.toLowerCase() === normalizedEmail) {
      return NextResponse.json(
        { error: "This is already your primary email" },
        { status: 400 }
      );
    }

    const additionalEmails = userData?.additionalEmails || [];
    if (additionalEmails.some((e: { email: string }) => e.email.toLowerCase() === normalizedEmail)) {
      return NextResponse.json(
        { error: "This email is already added to your account" },
        { status: 400 }
      );
    }

    // Generate 6-digit code
    const code = randomInt(0, 10 ** CODE_LENGTH)
      .toString()
      .padStart(CODE_LENGTH, "0");
    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

    const docId = `edu_${user.uid}_${normalizedEmail.replace(/[.@]/g, "_")}`;
    await adminDb.collection("eduVerificationCodes").doc(docId).set({
      uid: user.uid,
      email: normalizedEmail,
      code,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
    });

    await sendEmail({
      to: normalizedEmail,
      subject: "Your CFP verification code",
      text: `Your verification code for the Cursor Boston Graduate Student Conference CFP is: ${code}. This code expires in ${CODE_EXPIRY_MINUTES} minutes.`,
      html: `<p>Your verification code for the Cursor Boston Graduate Student Conference CFP is:</p><p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p><p>This code expires in ${CODE_EXPIRY_MINUTES} minutes.</p><p>If you didn't request this, you can ignore this email.</p>`,
    });

    return NextResponse.json({ success: true, message: "Verification code sent" });
  } catch (error) {
    logApiError("/api/cfp/send-edu-code", error);
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    );
  }
}
