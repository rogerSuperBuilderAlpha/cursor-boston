import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

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

    // Validate email format
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

    // Check if email exists in emailLookup (already added to another account)
    const emailLookupRef = adminDb.collection("emailLookup").doc(normalizedEmail);
    const emailLookupDoc = await emailLookupRef.get();
    if (emailLookupDoc.exists) {
      return NextResponse.json(
        { error: "This email is already associated with an account" },
        { status: 400 }
      );
    }

    // Check if user already has this email
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

    // Generate a verification token
    const verificationToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store pending verification in Firestore
    await adminDb.collection("emailVerifications").doc(verificationToken).set({
      uid: user.uid,
      email: normalizedEmail,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
    });

    // Create verification URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;

    // Send verification email using Firebase's mail extension or similar
    // For now, we'll use the mail collection (assuming Firebase Extension for email)
    await adminDb.collection("mail").add({
      to: normalizedEmail,
      template: {
        name: "email-verification",
        data: {
          verificationUrl,
          userName: userData?.displayName || "there",
        },
      },
    });

    return NextResponse.json({ 
      success: true,
      message: "Verification email sent" 
    });
  } catch (error) {
    console.error("Error sending email verification:", error);
    return NextResponse.json(
      { error: "Failed to send verification email" },
      { status: 500 }
    );
  }
}
