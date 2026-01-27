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

    const { newPrimaryEmail } = await request.json();
    if (!newPrimaryEmail || typeof newPrimaryEmail !== "string") {
      return NextResponse.json({ error: "New primary email is required" }, { status: 400 });
    }

    const normalizedEmail = newPrimaryEmail.toLowerCase().trim();

    const adminDb = getAdminDb();
    const adminAuth = getAdminAuth();
    if (!adminDb || !adminAuth) {
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    // Get user document
    const userRef = adminDb.collection("users").doc(user.uid);
    const userDoc = await userRef.get();
    const userData = userDoc.data();

    if (!userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentPrimaryEmail = userData.email?.toLowerCase();

    // Check if the new email is in additionalEmails and verified
    const additionalEmails = userData.additionalEmails || [];
    const emailEntry = additionalEmails.find(
      (e: { email: string; verified: boolean }) => 
        e.email.toLowerCase() === normalizedEmail && e.verified
    );

    if (!emailEntry) {
      return NextResponse.json(
        { error: "Email must be a verified additional email on your account" },
        { status: 400 }
      );
    }

    // Update Firebase Auth email
    await adminAuth.updateUser(user.uid, {
      email: normalizedEmail,
    });

    // Update Firestore: swap primary and additional emails
    const updatedAdditionalEmails = additionalEmails
      .filter((e: { email: string }) => e.email.toLowerCase() !== normalizedEmail)
      .concat(currentPrimaryEmail ? [{
        email: currentPrimaryEmail,
        verified: true,
        addedAt: new Date(),
      }] : []);

    await userRef.update({
      email: normalizedEmail,
      additionalEmails: updatedAdditionalEmails,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Update emailLookup entries
    // Remove old primary lookup if it exists
    if (currentPrimaryEmail) {
      const oldPrimaryLookupRef = adminDb.collection("emailLookup").doc(currentPrimaryEmail);
      const oldPrimaryLookup = await oldPrimaryLookupRef.get();
      if (oldPrimaryLookup.exists && oldPrimaryLookup.data()?.uid === user.uid) {
        await oldPrimaryLookupRef.delete();
      }
      // Add old primary as alias
      await adminDb.collection("emailLookup").doc(currentPrimaryEmail).set({
        uid: user.uid,
        isPrimary: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // Remove new primary from aliases lookup (it's now the primary in Firebase Auth)
    const newPrimaryLookupRef = adminDb.collection("emailLookup").doc(normalizedEmail);
    await newPrimaryLookupRef.delete();

    return NextResponse.json({ 
      success: true,
      message: "Primary email changed successfully" 
    });
  } catch (error) {
    console.error("Error changing primary email:", error);
    return NextResponse.json(
      { error: "Failed to change primary email" },
      { status: 500 }
    );
  }
}
