import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { getAdminDb } from "@/lib/firebase-admin";
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

    const adminDb = getAdminDb();
    if (!adminDb) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    // Get user document
    const userRef = adminDb.collection("users").doc(user.uid);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if the email is in additionalEmails
    const additionalEmails = userData.additionalEmails || [];
    const emailToRemove = additionalEmails.find(
      (e: { email: string }) => e.email.toLowerCase() === normalizedEmail
    );

    if (!emailToRemove) {
      return NextResponse.json(
        { error: "Email not found in your additional emails" },
        { status: 400 }
      );
    }

    // Remove from additionalEmails
    await userRef.update({
      additionalEmails: FieldValue.arrayRemove(emailToRemove),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Remove from emailLookup
    const emailLookupRef = adminDb.collection("emailLookup").doc(normalizedEmail);
    await emailLookupRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing email:", error);
    return NextResponse.json(
      { error: "Failed to remove email" },
      { status: 500 }
    );
  }
}
