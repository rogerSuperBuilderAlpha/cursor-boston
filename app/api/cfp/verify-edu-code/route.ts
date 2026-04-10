/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { logApiError } from "@/lib/logger";

function isValidEduEmail(email: string): boolean {
  return email.toLowerCase().trim().endsWith(".edu");
}

export async function POST(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, code } = await request.json();
    if (!email || typeof email !== "string" || !code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Email and code are required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedCode = code.trim().replace(/\s/g, "");

    if (!isValidEduEmail(normalizedEmail)) {
      return NextResponse.json(
        { error: "Please enter a valid .edu email address" },
        { status: 400 }
      );
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const docId = `edu_${user.uid}_${normalizedEmail.replace(/[.@]/g, "_")}`;
    const codeRef = adminDb.collection("eduVerificationCodes").doc(docId);
    const codeDoc = await codeRef.get();

    if (!codeDoc.exists) {
      return NextResponse.json(
        { error: "Invalid or expired code. Please request a new one." },
        { status: 400 }
      );
    }

    const data = codeDoc.data();
    const expiresAt = data?.expiresAt?.toDate?.() || data?.expiresAt;
    if (new Date() > new Date(expiresAt)) {
      await codeRef.delete();
      return NextResponse.json(
        { error: "Code has expired. Please request a new one." },
        { status: 400 }
      );
    }

    if (data?.code !== normalizedCode) {
      return NextResponse.json(
        { error: "Invalid code. Please check and try again." },
        { status: 400 }
      );
    }

    if (data?.uid !== user.uid || data?.email !== normalizedEmail) {
      return NextResponse.json({ error: "Invalid verification" }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(user.uid);
    const emailLookupRef = adminDb.collection("emailLookup").doc(normalizedEmail);

    // Add to additionalEmails and set eduBadge
    await userRef.update({
      additionalEmails: FieldValue.arrayUnion({
        email: normalizedEmail,
        verified: true,
        addedAt: new Date(),
      }),
      eduBadge: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await emailLookupRef.set({
      uid: user.uid,
      isPrimary: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    await codeRef.delete();

    return NextResponse.json({ success: true, email: normalizedEmail });
  } catch (error) {
    logApiError("/api/cfp/verify-edu-code", error);
    return NextResponse.json(
      { error: "Failed to verify code" },
      { status: 500 }
    );
  }
}
