"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  signInWithPopup,
  GoogleAuthProvider,
  GithubAuthProvider,
  sendPasswordResetEmail,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "@/lib/firebase";

interface ProfileVisibility {
  isPublic: boolean;
  showEmail: boolean;
  showBio: boolean;
  showLocation: boolean;
  showCompany: boolean;
  showJobTitle: boolean;
  showDiscord: boolean;
  showGithubBadge: boolean;
  showEventsAttended: boolean;
  showTalksGiven: boolean;
  showWebsite: boolean;
  showLinkedIn: boolean;
  showTwitter: boolean;
  showGithub: boolean;
  showSubstack: boolean;
  showMemberSince: boolean;
}

interface SocialLinks {
  website?: string;
  linkedIn?: string;
  twitter?: string;
  github?: string;
  substack?: string;
}

interface AdditionalEmail {
  email: string;
  verified: boolean;
  addedAt: Date;
}

interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt?: Date;
  provider?: string;
  additionalEmails?: AdditionalEmail[];
  discord?: {
    id: string;
    username: string;
    avatar?: string;
    connectedAt: Date;
  };
  github?: {
    id: string;
    login: string;
    name?: string;
    avatar_url?: string;
    html_url: string;
    connectedAt: Date;
  };
  // Public profile fields
  bio?: string;
  location?: string;
  company?: string;
  jobTitle?: string;
  socialLinks?: SocialLinks;
  visibility?: ProfileVisibility;
  pullRequestsCount?: number;
}

export type { UserProfile, ProfileVisibility, SocialLinks, AdditionalEmail };

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithGithub: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (displayName?: string, photoFile?: File) => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  sendAddEmailVerification: (newEmail: string) => Promise<void>;
  removeAdditionalEmail: (emailToRemove: string) => Promise<void>;
  changePrimaryEmail: (newPrimaryEmail: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Create or update user profile in Firestore
  const createUserProfile = async (user: User, provider: string) => {
    if (!db) return;
    
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      // Create new user profile
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        provider,
        createdAt: serverTimestamp(),
      });
    } else {
      // Update existing profile with OAuth data if available
      const existingData = userSnap.data();
      const updates: Record<string, unknown> = {
        lastLoginAt: serverTimestamp(),
      };

      // Update photo if user has one from OAuth but not in Firestore
      if (user.photoURL && !existingData.photoURL) {
        updates.photoURL = user.photoURL;
      }

      // Update display name if user has one from OAuth but not in Firestore
      if (user.displayName && !existingData.displayName) {
        updates.displayName = user.displayName;
      }

      // Always update photo/name from OAuth providers (Google/GitHub) as they're authoritative
      if (provider === "google" || provider === "github") {
        if (user.photoURL) {
          updates.photoURL = user.photoURL;
        }
        if (user.displayName) {
          updates.displayName = user.displayName;
        }
      }

      await updateDoc(userRef, updates);
    }

    // Fetch and set user profile
    const updatedSnap = await getDoc(userRef);
    if (updatedSnap.exists()) {
      setUserProfile(updatedSnap.data() as UserProfile);
    }
  };

  useEffect(() => {
    // If auth is not configured, just set loading to false
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user && db) {
        // Fetch user profile from Firestore
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserProfile(userSnap.data() as UserProfile);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error("Firebase is not configured");
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    if (!auth) throw new Error("Firebase is not configured");
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });
    await createUserProfile(result.user, "email");
  };

  const signInWithGoogle = async () => {
    if (!auth) throw new Error("Firebase is not configured");
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    await createUserProfile(result.user, "google");
  };

  const signInWithGithub = async () => {
    if (!auth) throw new Error("Firebase is not configured");
    const provider = new GithubAuthProvider();
    const result = await signInWithPopup(auth, provider);
    await createUserProfile(result.user, "github");
  };

  const signOut = async () => {
    if (!auth) throw new Error("Firebase is not configured");
    await firebaseSignOut(auth);
    setUserProfile(null);
  };

  const resetPassword = async (email: string) => {
    if (!auth) throw new Error("Firebase is not configured");
    await sendPasswordResetEmail(auth, email);
  };

  const updateUserProfile = async (displayName?: string, photoFile?: File) => {
    if (!auth || !auth.currentUser) throw new Error("Not authenticated");
    if (!db) throw new Error("Firebase is not configured");

    const updates: { displayName?: string; photoURL?: string } = {};
    
    // Upload photo if provided
    if (photoFile && storage) {
      const fileRef = ref(storage, `profile-photos/${auth.currentUser.uid}`);
      await uploadBytes(fileRef, photoFile);
      const photoURL = await getDownloadURL(fileRef);
      updates.photoURL = photoURL;
    }

    // Update display name if provided
    if (displayName !== undefined) {
      updates.displayName = displayName;
    }

    // Update Firebase Auth profile
    if (Object.keys(updates).length > 0) {
      await updateProfile(auth.currentUser, updates);
    }

    // Update Firestore profile
    const userRef = doc(db, "users", auth.currentUser.uid);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    // Refresh user profile state from Firestore
    const updatedSnap = await getDoc(userRef);
    if (updatedSnap.exists()) {
      setUserProfile(updatedSnap.data() as UserProfile);
    }

    // Force reload the Firebase Auth user to get updated photoURL
    await auth.currentUser.reload();
    
    // Create a new user object with the updated values to trigger re-render
    const updatedUser = auth.currentUser;
    setUser(Object.assign(Object.create(Object.getPrototypeOf(updatedUser)), updatedUser, updates));
  };

  const refreshUserProfile = async () => {
    if (!auth?.currentUser || !db) return;
    
    const userRef = doc(db, "users", auth.currentUser.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      setUserProfile(userSnap.data() as UserProfile);
    }
  };

  const sendAddEmailVerification = async (newEmail: string) => {
    if (!auth?.currentUser) throw new Error("Not authenticated");
    
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch("/api/auth/send-email-verification", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
      body: JSON.stringify({ email: newEmail.toLowerCase().trim() }),
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to send verification email");
    }
  };

  const removeAdditionalEmail = async (emailToRemove: string) => {
    if (!auth?.currentUser) throw new Error("Not authenticated");
    
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch("/api/auth/remove-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
      body: JSON.stringify({ email: emailToRemove.toLowerCase().trim() }),
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to remove email");
    }
    
    await refreshUserProfile();
  };

  const changePrimaryEmail = async (newPrimaryEmail: string) => {
    if (!auth?.currentUser) throw new Error("Not authenticated");
    
    const idToken = await auth.currentUser.getIdToken();
    const response = await fetch("/api/auth/change-primary-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
      body: JSON.stringify({ newPrimaryEmail: newPrimaryEmail.toLowerCase().trim() }),
    });
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Failed to change primary email");
    }
  };

  const value = {
    user,
    userProfile,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithGithub,
    signOut,
    resetPassword,
    updateUserProfile,
    refreshUserProfile,
    sendAddEmailVerification,
    removeAdditionalEmail,
    changePrimaryEmail,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
