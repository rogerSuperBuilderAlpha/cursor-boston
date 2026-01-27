import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.redirect(
        new URL("/profile?emailVerification=error&message=missing_token", request.url)
      );
    }

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.redirect(
        new URL("/profile?emailVerification=error&message=server_error", request.url)
      );
    }

    // Get and validate the verification token
    const verificationRef = adminDb.collection("emailVerifications").doc(token);
    const verificationDoc = await verificationRef.get();

    if (!verificationDoc.exists) {
      return NextResponse.redirect(
        new URL("/profile?emailVerification=error&message=invalid_token", request.url)
      );
    }

    const verification = verificationDoc.data();
    if (!verification) {
      return NextResponse.redirect(
        new URL("/profile?emailVerification=error&message=invalid_token", request.url)
      );
    }

    // Check if token is expired
    const expiresAt = verification.expiresAt?.toDate?.() || verification.expiresAt;
    if (new Date() > new Date(expiresAt)) {
      await verificationRef.delete();
      return NextResponse.redirect(
        new URL("/profile?emailVerification=error&message=token_expired", request.url)
      );
    }

    const { uid, email } = verification;
    const normalizedEmail = email.toLowerCase().trim();

    // Double-check email isn't already taken
    const emailLookupRef = adminDb.collection("emailLookup").doc(normalizedEmail);
    const emailLookupDoc = await emailLookupRef.get();
    if (emailLookupDoc.exists) {
      await verificationRef.delete();
      return NextResponse.redirect(
        new URL("/profile?emailVerification=error&message=email_taken", request.url)
      );
    }

    // Add email to user's additionalEmails
    const userRef = adminDb.collection("users").doc(uid);
    await userRef.update({
      additionalEmails: FieldValue.arrayUnion({
        email: normalizedEmail,
        verified: true,
        addedAt: new Date(),
      }),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Create emailLookup entry for login resolution
    await emailLookupRef.set({
      uid,
      isPrimary: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Delete the verification token
    await verificationRef.delete();

    return NextResponse.redirect(
      new URL("/profile?emailVerification=success&tab=security", request.url)
    );
  } catch (error) {
    console.error("Error verifying email:", error);
    return NextResponse.redirect(
      new URL("/profile?emailVerification=error&message=server_error", request.url)
    );
  }
}
