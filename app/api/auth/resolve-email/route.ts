import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const adminDb = getAdminDb();
    const adminAuth = getAdminAuth();
    if (!adminDb || !adminAuth) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    // First, check if this email is a primary email in Firebase Auth
    try {
      const userRecord = await adminAuth.getUserByEmail(normalizedEmail);
      // Email is a primary email, return it as-is
      return NextResponse.json({
        primaryEmail: normalizedEmail,
        isAlias: false,
      });
    } catch {
      // Email not found as primary, continue to check aliases
    }

    // Check emailLookup collection
    const emailLookupRef = adminDb.collection("emailLookup").doc(normalizedEmail);
    const emailLookupDoc = await emailLookupRef.get();

    if (!emailLookupDoc.exists) {
      // Email not found anywhere
      return NextResponse.json({
        primaryEmail: null,
        isAlias: false,
        message: "Email not found",
      });
    }

    const lookupData = emailLookupDoc.data();
    if (!lookupData) {
      return NextResponse.json({
        primaryEmail: null,
        isAlias: false,
        message: "Email not found",
      });
    }

    // Get the primary email for this user
    const userRef = adminDb.collection("users").doc(lookupData.uid);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    if (!userData?.email) {
      return NextResponse.json({
        primaryEmail: null,
        isAlias: false,
        message: "User has no primary email",
      });
    }

    return NextResponse.json({
      primaryEmail: userData.email,
      isAlias: true,
    });
  } catch (error) {
    console.error("Error resolving email:", error);
    return NextResponse.json(
      { error: "Failed to resolve email" },
      { status: 500 }
    );
  }
}
