/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { randomInt } from "crypto";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logApiError, logger } from "@/lib/logger";
import { sendEmail } from "@/lib/mailgun";

const CODE_LENGTH = 6;
const CODE_EXPIRY_MINUTES = 15;

function isValidEduEmail(email: string): boolean {
  return email.toLowerCase().trim().endsWith(".edu");
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization") || "";
  const tokenFromAuth = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const tokenFromHeader = request.headers.get("x-firebase-id-token")?.trim() || "";
  logger.info("CFP send-edu-code request received", {
    hasAuthorizationHeader: Boolean(authHeader),
    hasBearerToken: Boolean(tokenFromAuth),
    hasFirebaseIdTokenHeader: Boolean(tokenFromHeader),
  });
  if (!tokenFromAuth && !tokenFromHeader) {
    logger.warn("CFP send-edu-code rejected: missing auth token");
    return NextResponse.json(
      { error: "Sign in required. Please sign in and try again." },
      { status: 401 }
    );
  }

  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      logger.warn("CFP send-edu-code rejected: token did not resolve to user");
      return NextResponse.json(
        { error: "Invalid or expired session. Please sign in again." },
        { status: 401 }
      );
    }

    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      logger.warn("CFP send-edu-code rejected: missing email payload", {
        uid: user.uid,
      });
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const emailDomain = normalizedEmail.split("@")[1] || "";

    if (!isValidEduEmail(normalizedEmail)) {
      logger.warn("CFP send-edu-code rejected: non-edu email", {
        uid: user.uid,
        emailDomain,
      });
      return NextResponse.json(
        { error: "Please enter a valid .edu email address" },
        { status: 400 }
      );
    }

    if (normalizedEmail.length > 254) {
      logger.warn("CFP send-edu-code rejected: email too long", {
        uid: user.uid,
        emailDomain,
      });
      return NextResponse.json({ error: "Email is too long" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      logger.warn("CFP send-edu-code rejected: invalid email format", {
        uid: user.uid,
        emailDomain,
      });
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const adminAuth = getAdminAuth();
    if (!adminDb || !adminAuth) {
      logger.error("CFP send-edu-code failed: Firebase Admin not configured");
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    // Check if email is already used as primary by any account
    const usersWithEmail = await adminAuth.getUserByEmail(normalizedEmail).catch(() => null);
    if (usersWithEmail) {
      logger.warn("CFP send-edu-code rejected: email already primary on account", {
        uid: user.uid,
        emailDomain,
      });
      return NextResponse.json(
        { error: "This email is already associated with an account" },
        { status: 400 }
      );
    }

    const emailLookupRef = adminDb.collection("emailLookup").doc(normalizedEmail);
    const emailLookupDoc = await emailLookupRef.get();
    if (emailLookupDoc.exists) {
      logger.warn("CFP send-edu-code rejected: email already in lookup", {
        uid: user.uid,
        emailDomain,
      });
      return NextResponse.json(
        { error: "This email is already associated with an account" },
        { status: 400 }
      );
    }

    const userRef = adminDb.collection("users").doc(user.uid);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    if (userData?.email?.toLowerCase() === normalizedEmail) {
      logger.warn("CFP send-edu-code rejected: email already primary for user", {
        uid: user.uid,
        emailDomain,
      });
      return NextResponse.json(
        { error: "This is already your primary email" },
        { status: 400 }
      );
    }

    const additionalEmails = userData?.additionalEmails || [];
    if (additionalEmails.some((e: { email: string }) => e.email.toLowerCase() === normalizedEmail)) {
      logger.warn("CFP send-edu-code rejected: email already additional", {
        uid: user.uid,
        emailDomain,
      });
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
    logger.info("CFP send-edu-code saved verification code", {
      uid: user.uid,
      emailDomain,
      hasMailgunApiKey: Boolean(process.env.MAILGUN_API_KEY),
      mailgunDomain: process.env.MAILGUN_DOMAIN || null,
      mailgunFrom: process.env.MAILGUN_FROM || null,
    });

    await sendEmail({
      to: normalizedEmail,
      subject: "Your CFP verification code",
      text: `Your verification code for the Cursor Boston Graduate Student Conference CFP is: ${code}. This code expires in ${CODE_EXPIRY_MINUTES} minutes.`,
      html: `<p>Your verification code for the Cursor Boston Graduate Student Conference CFP is:</p><p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${code}</p><p>This code expires in ${CODE_EXPIRY_MINUTES} minutes.</p><p>If you didn't request this, you can ignore this email.</p>`,
    });
    logger.info("CFP send-edu-code email sent", {
      uid: user.uid,
      emailDomain,
    });

    return NextResponse.json({ success: true, message: "Verification code sent" });
  } catch (error) {
    const err = error as { code?: string; message?: string };
    logger.error("CFP send-edu-code caught error", {
      code: err?.code || null,
      message: err?.message || null,
      name: error instanceof Error ? error.name : null,
    });
    logApiError("/api/cfp/send-edu-code", error);
    const isAuthError =
      err?.code?.startsWith?.("auth/") ||
      err?.message?.toLowerCase().includes("unauthorized") ||
      err?.message?.toLowerCase().includes("expired") ||
      err?.message?.toLowerCase().includes("decoding");
    if (isAuthError) {
      return NextResponse.json(
        { error: "Invalid or expired session. Please sign in again." },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "Failed to send verification code" },
      { status: 500 }
    );
  }
}
