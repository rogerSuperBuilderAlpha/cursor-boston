"use client";

import { useEffect, useMemo, useRef, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import Avatar from "@/components/Avatar";
import { FormInput, FormTextarea, ToggleSwitch } from "@/components/ui/FormField";
import {
  getUserRegistrations,
  getUserStats,
  EventRegistration,
  UserStats,
} from "@/lib/registrations";
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp, deleteField } from "firebase/firestore";
import { EmailAuthProvider, PhoneAuthProvider, PhoneMultiFactorGenerator, RecaptchaVerifier, linkWithCredential, multiFactor, unlink, updatePassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";

const DISCORD_CLIENT_ID = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID;
const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

// Get initials from name or email
function getInitials(
  name: string | null | undefined,
  email: string | null | undefined
): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  }
  if (email) {
    return email[0].toUpperCase();
  }
  return "U";
}

interface TalkSubmission {
  id: string;
  title: string;
  status: string;
  submittedAt: { toDate: () => Date } | null;
}

interface ConnectedAgent {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  claimedAt?: { _seconds: number };
}

function ProfilePageContent() {
  const { user, userProfile, loading, signOut, updateUserProfile, sendAddEmailVerification, removeAdditionalEmail, changePrimaryEmail, refreshUserProfile } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "events" | "talks" | "security" | "settings">(
    "overview"
  );
  const [stats, setStats] = useState<UserStats | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [talkSubmissions, setTalkSubmissions] = useState<TalkSubmission[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Edit profile state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Discord connection state
  const [discordConnecting, setDiscordConnecting] = useState(false);
  const [discordDisconnecting, setDiscordDisconnecting] = useState(false);
  const [discordError, setDiscordError] = useState<string | null>(null);
  const [connectedDiscord, setConnectedDiscord] = useState<{ id: string; username: string; avatar?: string } | null>(null);
  const [wasDisconnected, setWasDisconnected] = useState(false);
  
  // GitHub connection state
  const [githubConnecting, setGithubConnecting] = useState(false);
  const [githubDisconnecting, setGithubDisconnecting] = useState(false);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [connectedGithub, setConnectedGithub] = useState<{ id: string; login: string; name?: string; avatar_url?: string; html_url: string } | null>(null);
  const [wasGithubDisconnected, setWasGithubDisconnected] = useState(false);
  const searchParams = useSearchParams();

  // Connected agents state
  const [connectedAgents, setConnectedAgents] = useState<ConnectedAgent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Get Discord info: prioritize local state changes over userProfile
  const discordInfo = wasDisconnected ? null : (connectedDiscord || userProfile?.discord);
  
  // Get GitHub info: prioritize local state changes over userProfile
  const githubInfo = wasGithubDisconnected ? null : (connectedGithub || userProfile?.github);
  const hasGithubConnection = Boolean(githubInfo || userProfile?.provider === "github");

  const providerIds = useMemo(
    () => user?.providerData?.map((provider) => provider.providerId) || [],
    [user?.providerData]
  );
  const [wasGoogleDisconnected, setWasGoogleDisconnected] = useState(false);
  // Use strict equality check to avoid CodeQL false positive about substring matching
  const hasGoogleProvider = !wasGoogleDisconnected && providerIds.some((id) => id === "google.com");
  const hasPasswordProvider = providerIds.some((id) => id === "password");
  const canDisconnectGoogle = hasGoogleProvider && providerIds.length > 1;

  // Safely get enrolled factors with error handling using useMemo
  const enrolledFactors = useMemo(() => {
    try {
      if (!user) return [];
      return multiFactor(user).enrolledFactors;
    } catch (error) {
      // Silently handle error - multiFactor may not be available yet
      return [];
    }
  }, [user]);

  const hasPhoneMfa = enrolledFactors.some(
    (factor) => factor?.factorId === PhoneMultiFactorGenerator.FACTOR_ID
  );

  const [googleDisconnecting, setGoogleDisconnecting] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [mfaVerificationId, setMfaVerificationId] = useState<string | null>(null);
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaSuccess, setMfaSuccess] = useState<string | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // Public profile settings state
  const [profileSettings, setProfileSettings] = useState({
    bio: "",
    location: "",
    company: "",
    jobTitle: "",
    socialLinks: {
      website: "",
      linkedIn: "",
      twitter: "",
      github: "",
      substack: "",
    },
    visibility: {
      isPublic: false,
      showEmail: false,
      showBio: true,
      showLocation: true,
      showCompany: true,
      showJobTitle: true,
      showDiscord: true,
      showGithubBadge: true,
      showEventsAttended: true,
      showTalksGiven: true,
      showWebsite: true,
      showLinkedIn: true,
      showTwitter: true,
      showGithub: true,
      showSubstack: true,
      showMemberSince: true,
    },
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Email management state
  const [newEmail, setNewEmail] = useState("");
  const [emailAddLoading, setEmailAddLoading] = useState(false);
  const [emailAddError, setEmailAddError] = useState<string | null>(null);
  const [emailAddSuccess, setEmailAddSuccess] = useState<string | null>(null);
  const [emailRemoveLoading, setEmailRemoveLoading] = useState<string | null>(null);
  const [primaryEmailLoading, setPrimaryEmailLoading] = useState<string | null>(null);
  const [emailVerificationStatus, setEmailVerificationStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login?redirect=/profile");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (providerIds.some((id) => id === "google.com")) {
      setWasGoogleDisconnected(false);
    }
  }, [providerIds]);

  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
    };
  }, []);

  // Handle Discord OAuth callback
  useEffect(() => {
    if (loading) return;
    const discordStatus = searchParams.get("discord");
    const discordData = searchParams.get("data");

    if (discordStatus === "success" && discordData) {
      if (!user || !db) {
        setDiscordError("Please sign in to finish connecting Discord.");
        router.replace("/login?redirect=/profile");
        return;
      }
      // Save Discord data to Firestore
      const firestore = db; // Capture for TypeScript
      const saveDiscord = async () => {
        try {
          const data = JSON.parse(decodeURIComponent(discordData));
          const discordUserInfo = {
            id: data.id,
            username: data.globalName || data.username,
            avatar: data.avatar,
          };
          const userRef = doc(firestore, "users", user.uid);
          await updateDoc(userRef, {
            discord: {
              ...discordUserInfo,
              connectedAt: serverTimestamp(),
            },
          });
          // Update local state immediately for smooth UI
          setConnectedDiscord(discordUserInfo);
          setWasDisconnected(false);
          // Clear URL params without reload
          router.replace("/profile", { scroll: false });
        } catch (error) {
          console.error("Error saving Discord data:", error);
          setDiscordError("Failed to save Discord connection");
        }
      };
      saveDiscord();
    } else if (discordStatus === "error") {
      const message = searchParams.get("message");
      if (message === "not_member") {
        setDiscordError(
          "You need to join the Cursor Boston Discord server first! Join at discord.gg/Wsncg8YYqc then try again."
        );
      } else {
        setDiscordError("Failed to connect Discord. Please try again.");
      }
      router.replace("/profile");
    }
  }, [searchParams, user, router, loading]);

  // Handle email verification callback
  useEffect(() => {
    if (loading) return;
    const emailVerification = searchParams.get("emailVerification");
    const message = searchParams.get("message");
    const tab = searchParams.get("tab");

    if (emailVerification === "success") {
      setEmailVerificationStatus({
        type: "success",
        message: "Email verified and added to your account successfully!",
      });
      refreshUserProfile();
      if (tab === "security") {
        setActiveTab("security");
      }
      // Clear URL params
      router.replace("/profile", { scroll: false });
    } else if (emailVerification === "error") {
      const errorMessages: Record<string, string> = {
        missing_token: "Invalid verification link.",
        invalid_token: "This verification link is invalid or has already been used.",
        token_expired: "This verification link has expired. Please request a new one.",
        email_taken: "This email is already associated with another account.",
        server_error: "An error occurred. Please try again.",
      };
      setEmailVerificationStatus({
        type: "error",
        message: errorMessages[message || ""] || "Failed to verify email.",
      });
      setActiveTab("security");
      router.replace("/profile", { scroll: false });
    }
  }, [searchParams, loading, router, refreshUserProfile]);

  // Handle GitHub OAuth callback
  useEffect(() => {
    if (loading) return;
    const githubStatus = searchParams.get("github");
    const githubData = searchParams.get("data");

    if (githubStatus === "success" && githubData) {
      if (!user || !db) {
        setGithubError("Please sign in to finish connecting GitHub.");
        router.replace("/login?redirect=/profile");
        return;
      }
      // Save GitHub data to Firestore
      const firestore = db; // Capture for TypeScript
      const saveGithub = async () => {
        try {
          const data = JSON.parse(decodeURIComponent(githubData));
          const githubUserInfo = {
            id: data.id,
            login: data.login,
            name: data.name,
            avatar_url: data.avatar_url,
            html_url: data.html_url,
          };
          const userRef = doc(firestore, "users", user.uid);
          await updateDoc(userRef, {
            github: {
              ...githubUserInfo,
              connectedAt: serverTimestamp(),
            },
          });
          // Update local state immediately for smooth UI
          setConnectedGithub(githubUserInfo);
          setWasGithubDisconnected(false);
          // Clear URL params without reload
          router.replace("/profile", { scroll: false });
        } catch (error) {
          console.error("Error saving GitHub data:", error);
          setGithubError("Failed to save GitHub connection");
        }
      };
      saveGithub();
    } else if (githubStatus === "error") {
      const message = searchParams.get("message");
      setGithubError("Failed to connect GitHub. Please try again.");
      router.replace("/profile");
    }
  }, [searchParams, user, router, loading]);

  const connectDiscord = () => {
    if (!user || !DISCORD_CLIENT_ID) {
      setDiscordError("Discord connection is not configured");
      return;
    }
    setDiscordConnecting(true);
    window.location.href = "/api/discord/authorize";
  };

  const disconnectDiscord = async () => {
    if (!user || !db) return;
    
    setDiscordDisconnecting(true);
    setDiscordError(null);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        discord: deleteField(),
      });
      // Update local state immediately for smooth UI
      setWasDisconnected(true);
      setConnectedDiscord(null);
      setDiscordDisconnecting(false);
    } catch (error) {
      console.error("Error disconnecting Discord:", error);
      setDiscordError("Failed to disconnect Discord. Please try again.");
      setDiscordDisconnecting(false);
    }
  };

  const connectGithub = () => {
    if (!user || !GITHUB_CLIENT_ID) {
      setGithubError("GitHub connection is not configured");
      return;
    }
    setGithubConnecting(true);
    window.location.href = "/api/github/authorize";
  };

  const disconnectGithub = async () => {
    if (!user || !db) return;
    
    setGithubDisconnecting(true);
    setGithubError(null);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        github: deleteField(),
      });
      // Update local state immediately for smooth UI
      setWasGithubDisconnected(true);
      setConnectedGithub(null);
      setGithubDisconnecting(false);
    } catch (error) {
      console.error("Error disconnecting GitHub:", error);
      setGithubError("Failed to disconnect GitHub. Please try again.");
      setGithubDisconnecting(false);
    }
  };

  const disconnectGoogle = async () => {
    if (!user || !auth) return;
    setGoogleError(null);
    setGoogleDisconnecting(true);
    if (!canDisconnectGoogle) {
      setGoogleError("You need at least one other login method before disconnecting Google.");
      setGoogleDisconnecting(false);
      return;
    }
    try {
      await unlink(user, "google.com");
      await user.reload();
      setWasGoogleDisconnected(true);
      setGoogleDisconnecting(false);
    } catch (error) {
      console.error("Error disconnecting Google:", error);
      setGoogleError("Failed to disconnect Google. Please try again.");
      setGoogleDisconnecting(false);
    }
  };

  // Load profile settings from userProfile
  useEffect(() => {
    if (userProfile) {
      setProfileSettings({
        bio: userProfile.bio || "",
        location: userProfile.location || "",
        company: userProfile.company || "",
        jobTitle: userProfile.jobTitle || "",
        socialLinks: {
          website: userProfile.socialLinks?.website || "",
          linkedIn: userProfile.socialLinks?.linkedIn || "",
          twitter: userProfile.socialLinks?.twitter || "",
          github: userProfile.socialLinks?.github || "",
          substack: userProfile.socialLinks?.substack || "",
        },
        visibility: {
          isPublic: userProfile.visibility?.isPublic || false,
          showEmail: userProfile.visibility?.showEmail || false,
          showBio: userProfile.visibility?.showBio ?? true,
          showLocation: userProfile.visibility?.showLocation ?? true,
          showCompany: userProfile.visibility?.showCompany ?? true,
          showJobTitle: userProfile.visibility?.showJobTitle ?? true,
          showDiscord: userProfile.visibility?.showDiscord ?? true,
          showGithubBadge: userProfile.visibility?.showGithubBadge ?? true,
          showEventsAttended: userProfile.visibility?.showEventsAttended ?? true,
          showTalksGiven: userProfile.visibility?.showTalksGiven ?? true,
          showWebsite: userProfile.visibility?.showWebsite ?? true,
          showLinkedIn: userProfile.visibility?.showLinkedIn ?? true,
          showTwitter: userProfile.visibility?.showTwitter ?? true,
          showGithub: userProfile.visibility?.showGithub ?? true,
          showSubstack: userProfile.visibility?.showSubstack ?? true,
          showMemberSince: userProfile.visibility?.showMemberSince ?? true,
        },
      });
    }
  }, [userProfile]);

  const saveProfileSettings = async () => {
    if (!user) return;

    setSavingSettings(true);
    setSettingsError(null);
    setSettingsSuccess(false);

    try {
      // Use API route instead of direct Firestore update
      const token = await user.getIdToken();
      const response = await fetch("/api/profile/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bio: profileSettings.bio.trim(),
          location: profileSettings.location.trim(),
          company: profileSettings.company.trim(),
          jobTitle: profileSettings.jobTitle.trim(),
          socialLinks: {
            website: profileSettings.socialLinks.website.trim(),
            linkedIn: profileSettings.socialLinks.linkedIn.trim(),
            twitter: profileSettings.socialLinks.twitter.trim(),
            github: profileSettings.socialLinks.github.trim(),
            substack: profileSettings.socialLinks.substack.trim(),
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save settings");
      }

      // Save visibility settings separately (not handled by API yet)
      if (db) {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          visibility: profileSettings.visibility,
          updatedAt: serverTimestamp(),
        });
      }

      // Refresh user profile to get updated data
      await refreshUserProfile();

      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving profile settings:", error);
      setSettingsError(error instanceof Error ? error.message : "Failed to save settings. Please try again.");
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleAllVisibility = (show: boolean) => {
    setProfileSettings((prev) => ({
      ...prev,
      visibility: {
        ...prev.visibility,
        showEmail: show,
        showBio: show,
        showLocation: show,
        showCompany: show,
        showJobTitle: show,
        showDiscord: show,
        showGithubBadge: show,
        showEventsAttended: show,
        showTalksGiven: show,
        showWebsite: show,
        showLinkedIn: show,
        showTwitter: show,
        showGithub: show,
        showSubstack: show,
        showMemberSince: show,
      },
    }));
  };

  const handleAddEmail = async () => {
    if (!newEmail.trim()) {
      setEmailAddError("Please enter an email address");
      return;
    }

    setEmailAddLoading(true);
    setEmailAddError(null);
    setEmailAddSuccess(null);

    try {
      await sendAddEmailVerification(newEmail);
      setEmailAddSuccess("Verification email sent! Check your inbox.");
      setNewEmail("");
    } catch (error) {
      setEmailAddError(error instanceof Error ? error.message : "Failed to send verification email");
    } finally {
      setEmailAddLoading(false);
    }
  };

  const handleRemoveEmail = async (emailToRemove: string) => {
    setEmailRemoveLoading(emailToRemove);
    try {
      await removeAdditionalEmail(emailToRemove);
    } catch (error) {
      console.error("Error removing email:", error);
    } finally {
      setEmailRemoveLoading(null);
    }
  };

  const handleMakePrimary = async (email: string) => {
    setPrimaryEmailLoading(email);
    try {
      await changePrimaryEmail(email);
      // Reload the page to refresh auth state
      window.location.reload();
    } catch (error) {
      console.error("Error changing primary email:", error);
    } finally {
      setPrimaryEmailLoading(null);
    }
  };

  const handleSetPassword = async () => {
    if (!user || !auth) return;
    setPasswordError(null);
    setPasswordSuccess(false);

    if (!password || password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    if (!user.email) {
      setPasswordError("No email is associated with this account.");
      return;
    }

    setPasswordSaving(true);
    try {
      if (hasPasswordProvider) {
        await updatePassword(user, password);
      } else {
        const credential = EmailAuthProvider.credential(user.email, password);
        await linkWithCredential(user, credential);
      }
      setPassword("");
      setConfirmPassword("");
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch (error) {
      console.error("Error setting password:", error);
      setPasswordError("Failed to set password. Please re-authenticate and try again.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const initializeRecaptcha = () => {
    if (!auth) return null;
    if (!recaptchaVerifierRef.current) {
      recaptchaVerifierRef.current = new RecaptchaVerifier(
        auth,
        "mfa-recaptcha-container",
        {
          size: "invisible",
        }
      );
    }
    return recaptchaVerifierRef.current;
  };

  const sendMfaCode = async () => {
    if (!user || !auth) return;
    setMfaError(null);
    setMfaSuccess(null);
    if (hasPhoneMfa) {
      setMfaError("Phone 2FA is already enabled.");
      return;
    }
    if (!phoneNumber.trim()) {
      setMfaError("Enter a phone number in E.164 format (e.g. +15551234567).");
      return;
    }
    setMfaLoading(true);
    try {
      const verifier = initializeRecaptcha();
      if (!verifier) throw new Error("Recaptcha not initialized");
      const session = await multiFactor(user).getSession();
      const phoneInfoOptions = {
        phoneNumber: phoneNumber.trim(),
        session,
      };
      const provider = new PhoneAuthProvider(auth);
      const verificationId = await provider.verifyPhoneNumber(phoneInfoOptions, verifier);
      setMfaVerificationId(verificationId);
      setMfaSuccess("Verification code sent.");
    } catch (error) {
      console.error("Error sending MFA code:", error);
      setMfaError("Failed to send verification code. Please try again.");
    } finally {
      setMfaLoading(false);
    }
  };

  const confirmMfaEnrollment = async () => {
    if (!user || !auth || !mfaVerificationId) return;
    setMfaError(null);
    setMfaSuccess(null);
    if (!smsCode.trim()) {
      setMfaError("Enter the SMS code.");
      return;
    }
    setMfaLoading(true);
    try {
      const cred = PhoneAuthProvider.credential(mfaVerificationId, smsCode.trim());
      const multiFactorAssertion = PhoneMultiFactorGenerator.assertion(cred);
      await multiFactor(user).enroll(multiFactorAssertion, "Phone");
      await user.reload();
      setMfaVerificationId(null);
      setSmsCode("");
      setPhoneNumber("");
      setMfaSuccess("Two-factor authentication enabled.");
    } catch (error) {
      console.error("Error enrolling MFA:", error);
      setMfaError("Failed to enable 2FA. Please try again.");
    } finally {
      setMfaLoading(false);
    }
  };

  const disableMfa = async () => {
    if (!user) return;
    setMfaError(null);
    setMfaSuccess(null);
    setMfaLoading(true);
    try {
      const enrolled = multiFactor(user).enrolledFactors;
      const phoneFactor = enrolled.find(
        (factor) => factor.factorId === PhoneMultiFactorGenerator.FACTOR_ID
      );
      if (!phoneFactor) {
        setMfaError("No phone-based 2FA is enabled.");
        setMfaLoading(false);
        return;
      }
      await multiFactor(user).unenroll(phoneFactor.uid);
      await user.reload();
      setMfaSuccess("Two-factor authentication disabled.");
    } catch (error) {
      console.error("Error disabling MFA:", error);
      setMfaError("Failed to disable 2FA. Please try again.");
    } finally {
      setMfaLoading(false);
    }
  };

  // Fetch user data
  useEffect(() => {
    async function fetchUserData() {
      if (!user || !db) {
        setLoadingData(false);
        return;
      }

      try {
        // Fetch stats
        const userStats = await getUserStats(user.uid);
        setStats(userStats);

        // Fetch registrations
        const userRegistrations = await getUserRegistrations(user.uid);
        setRegistrations(userRegistrations);

        // Fetch talk submissions
        const talksRef = collection(db, "talkSubmissions");
        const talksQuery = query(talksRef, where("userId", "==", user.uid));
        const talksSnapshot = await getDocs(talksQuery);
        const talks = talksSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as TalkSubmission[];
        setTalkSubmissions(talks);
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoadingData(false);
      }
    }

    if (user) {
      fetchUserData();
    }
  }, [user]);

  // Fetch connected agents
  useEffect(() => {
    async function fetchConnectedAgents() {
      if (!user) return;

      setLoadingAgents(true);
      try {
        const response = await fetch("/api/agents/user", {
          headers: {
            Authorization: `Bearer ${await user.getIdToken()}`,
          },
        });
        const data = await response.json();
        if (data.success && data.agents) {
          setConnectedAgents(data.agents);
        }
      } catch (error) {
        console.error("Error fetching connected agents:", error);
      } finally {
        setLoadingAgents(false);
      }
    }

    if (user) {
      fetchConnectedAgents();
    }
  }, [user]);

  const handleSignOut = async () => {
    setSignOutError(null);
    setIsSigningOut(true);
    try {
      await signOut();
      router.push("/");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to sign out. Please try again.";
      setSignOutError(errorMessage);
      setIsSigningOut(false);
    }
  };

  const openEditModal = () => {
    setEditName(user?.displayName || "");
    setSelectedPhoto(null);
    setPhotoPreview(null);
    setEditError(null);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedPhoto(null);
    setPhotoPreview(null);
    setEditError(null);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        setEditError("Please select an image file");
        return;
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setEditError("Image must be less than 5MB");
        return;
      }
      setSelectedPhoto(file);
      setPhotoPreview(URL.createObjectURL(file));
      setEditError(null);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setEditError(null);
    try {
      await updateUserProfile(
        editName.trim() || undefined,
        selectedPhoto || undefined
      );
      closeEditModal();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to update profile. Please try again.";
      setEditError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-[80vh] px-6 py-8 md:py-12">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="bg-neutral-900 rounded-2xl p-6 md:p-8 border border-neutral-800 mb-6">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            {/* Avatar - Clickable to edit */}
            <button
              onClick={openEditModal}
              className="shrink-0 relative group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 rounded-full"
              aria-label="Edit profile photo"
            >
              <Avatar
                src={user.photoURL}
                name={user.displayName}
                email={user.email}
                size="xl"
              />
              {/* Edit overlay */}
              <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-white"
                  aria-hidden="true"
                >
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  <path d="m15 5 4 4" />
                </svg>
              </div>
            </button>

            {/* User Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-1">
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  {user.displayName || "Community Member"}
                </h1>
                {/* Public Profile Toggle */}
                <button
                  onClick={async () => {
                    if (!db || !user) return;
                    const newIsPublic = !profileSettings.visibility.isPublic;
                    setProfileSettings((prev) => ({
                      ...prev,
                      visibility: { ...prev.visibility, isPublic: newIsPublic },
                    }));
                    try {
                      const userRef = doc(db, "users", user.uid);
                      await updateDoc(userRef, {
                        "visibility.isPublic": newIsPublic,
                        updatedAt: serverTimestamp(),
                      });
                    } catch (error) {
                      console.error("Error updating visibility:", error);
                      // Revert on error
                      setProfileSettings((prev) => ({
                        ...prev,
                        visibility: { ...prev.visibility, isPublic: !newIsPublic },
                      }));
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 text-sm rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900 ${
                    profileSettings.visibility.isPublic
                      ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 focus-visible:ring-emerald-400"
                      : "bg-neutral-700 text-neutral-400 hover:bg-neutral-600 focus-visible:ring-neutral-400"
                  }`}
                >
                  {profileSettings.visibility.isPublic ? (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      Public Profile
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                      Private Profile
                    </>
                  )}
                </button>
              </div>
              <p className="text-neutral-400 mb-3">{user.email}</p>

              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 text-sm rounded-full">
                  Community Member
                </span>
                {userProfile?.provider && (
                  <span className="px-3 py-1 bg-neutral-800 text-neutral-300 text-sm rounded-full capitalize">
                    {userProfile.provider} Account
                  </span>
                )}
                {discordInfo ? (
                  <button
                    onClick={disconnectDiscord}
                    disabled={discordDisconnecting}
                    className="px-3 py-1 bg-[#5865F2]/10 text-[#5865F2] text-sm rounded-full inline-flex items-center gap-1 hover:bg-[#5865F2]/20 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2] group"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                    <span className="group-hover:hidden">{discordInfo.username}</span>
                    <span className="hidden group-hover:inline">{discordDisconnecting ? "Disconnecting..." : "Disconnect"}</span>
                  </button>
                ) : (
                  <button
                    onClick={connectDiscord}
                    disabled={discordConnecting}
                    className="px-3 py-1 bg-[#5865F2] text-white text-sm rounded-full inline-flex items-center gap-1 hover:bg-[#4752C4] transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2]"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                    {discordConnecting ? "Connecting..." : "Connect Discord"}
                  </button>
                )}
                {githubInfo ? (
                  <button
                    onClick={disconnectGithub}
                    disabled={githubDisconnecting}
                    className="px-3 py-1 bg-neutral-800/50 text-white text-sm rounded-full inline-flex items-center gap-1 hover:bg-neutral-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white group"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path
                        fillRule="evenodd"
                        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="group-hover:hidden">{githubInfo.login}</span>
                    <span className="hidden group-hover:inline">{githubDisconnecting ? "Disconnecting..." : "Disconnect"}</span>
                  </button>
                ) : (
                  <button
                    onClick={connectGithub}
                    disabled={githubConnecting}
                    className="px-3 py-1 bg-neutral-800 text-white text-sm rounded-full inline-flex items-center gap-1 hover:bg-neutral-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path
                        fillRule="evenodd"
                        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {githubConnecting ? "Connecting..." : "Connect GitHub"}
                  </button>
                )}
                {connectedAgents.length > 0 && (
                  <span className="px-3 py-1 bg-purple-500/10 text-purple-400 text-sm rounded-full inline-flex items-center gap-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="10" rx="2" />
                      <circle cx="12" cy="5" r="2" />
                      <path d="M12 7v4" />
                    </svg>
                    {connectedAgents.length} Agent{connectedAgents.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              {discordError && (
                <p className="text-red-400 text-xs mt-2">{discordError}</p>
              )}
              {githubError && (
                <p className="text-red-400 text-xs mt-2">{githubError}</p>
              )}
              {hasGithubConnection && (
                <div className="mt-4 p-4 bg-neutral-800/60 rounded-xl border border-neutral-700">
                  <h2 className="text-sm font-semibold text-white mb-2">
                    Contribute to the Open Source
                  </h2>
                  <ol className="list-decimal list-inside space-y-1 text-neutral-300 text-sm">
                    <li>Pick an issue labeled “good first issue”.</li>
                    <li>Fork the repo, make your change, and open a PR.</li>
                    <li>Add a short test plan to your PR.</li>
                  </ol>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href="https://github.com/rogerSuperBuilderAlpha/cursor-boston"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-neutral-700 text-white rounded-lg text-xs font-medium hover:bg-neutral-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      Visit GitHub Repo
                    </Link>
                    <Link
                      href="https://github.com/rogerSuperBuilderAlpha/cursor-boston?tab=contributing-ov-file#readme"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-emerald-500 text-white rounded-lg text-xs font-medium hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      Contributing Guide
                    </Link>
                  </div>
                </div>
              )}

              <p className="text-neutral-400 text-sm mt-3">
                Member since{" "}
                {user.metadata.creationTime
                  ? new Date(user.metadata.creationTime).toLocaleDateString(
                      "en-US",
                      {
                        year: "numeric",
                        month: "long",
                      }
                    )
                  : "Unknown"}
              </p>
            </div>

            {/* Actions */}
            <div className="shrink-0 flex flex-col gap-2">
              <button
                onClick={openEditModal}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
              >
                Edit Profile
              </button>
              <button
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="px-4 py-2 bg-neutral-800 text-white rounded-lg text-sm font-medium hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
              >
                {isSigningOut ? "Signing out..." : "Sign Out"}
              </button>
            </div>
          </div>

          {signOutError && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {signOutError}
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 text-center">
            <p className="text-3xl font-bold text-white">
              {loadingData ? "-" : stats?.eventsRegistered || 0}
            </p>
            <p className="text-neutral-400 text-sm">Events Registered</p>
          </div>
          <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 text-center">
            <p className="text-3xl font-bold text-white">
              {loadingData ? "-" : stats?.eventsAttended || 0}
            </p>
            <p className="text-neutral-400 text-sm">Events Attended</p>
          </div>
          <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 text-center">
            <p className="text-3xl font-bold text-white">
              {loadingData ? "-" : stats?.talksSubmitted || 0}
            </p>
            <p className="text-neutral-400 text-sm">Talks Submitted</p>
          </div>
          <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 text-center">
            <p className="text-3xl font-bold text-white">
              {loadingData ? "-" : stats?.talksGiven || 0}
            </p>
            <p className="text-neutral-400 text-sm">Talks Given</p>
          </div>
          <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800 text-center">
            <p className="text-3xl font-bold text-white">
              {loadingData ? "-" : stats?.pullRequestsCount || 0}
            </p>
            <p className="text-neutral-400 text-sm">Pull Requests</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-neutral-800 mb-6">
          <nav className="flex gap-6 overflow-x-auto" aria-label="Profile sections">
            <button
              onClick={() => setActiveTab("overview")}
              className={`pb-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:text-white whitespace-nowrap ${
                activeTab === "overview"
                  ? "text-white border-b-2 border-emerald-500"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("events")}
              className={`pb-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:text-white whitespace-nowrap ${
                activeTab === "events"
                  ? "text-white border-b-2 border-emerald-500"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              My Events
            </button>
            <button
              onClick={() => setActiveTab("talks")}
              className={`pb-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:text-white whitespace-nowrap ${
                activeTab === "talks"
                  ? "text-white border-b-2 border-emerald-500"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              My Talks
            </button>
            <button
              onClick={() => setActiveTab("security")}
              className={`pb-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:text-white whitespace-nowrap ${
                activeTab === "security"
                  ? "text-white border-b-2 border-emerald-500"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Security
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`pb-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:text-white whitespace-nowrap ${
                activeTab === "settings"
                  ? "text-white border-b-2 border-emerald-500"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Public Profile
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
              <h2 className="text-lg font-semibold text-white mb-4">
                Quick Actions
              </h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <Link
                  href="/events"
                  className="flex items-center gap-3 p-4 bg-neutral-800 rounded-xl hover:bg-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-emerald-400"
                      aria-hidden="true"
                    >
                      <rect
                        x="3"
                        y="4"
                        width="18"
                        height="18"
                        rx="2"
                        ry="2"
                      />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium">Browse Events</p>
                    <p className="text-neutral-400 text-sm">
                      Find upcoming meetups & workshops
                    </p>
                  </div>
                </Link>

                <Link
                  href="/talks/submit"
                  className="flex items-center gap-3 p-4 bg-neutral-800 rounded-xl hover:bg-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-emerald-400"
                      aria-hidden="true"
                    >
                      <polygon points="12 2 2 7 12 12 22 7 12 2" />
                      <polyline points="2 17 12 22 22 17" />
                      <polyline points="2 12 12 17 22 12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium">Submit a Talk</p>
                    <p className="text-neutral-400 text-sm">
                      Share your knowledge with the community
                    </p>
                  </div>
                </Link>

                <a
                  href="https://discord.gg/Wsncg8YYqc"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 bg-neutral-800 rounded-xl hover:bg-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <div className="w-10 h-10 bg-[#5865F2]/10 rounded-lg flex items-center justify-center">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="text-[#5865F2]"
                      aria-hidden="true"
                    >
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium">Join Discord</p>
                    <p className="text-neutral-400 text-sm">
                      Connect with the community
                    </p>
                  </div>
                </a>

                <Link
                  href="/events/request"
                  className="flex items-center gap-3 p-4 bg-neutral-800 rounded-xl hover:bg-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-emerald-400"
                      aria-hidden="true"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-white font-medium">Request an Event</p>
                    <p className="text-neutral-400 text-sm">
                      Suggest a workshop or meetup
                    </p>
                  </div>
                </Link>
              </div>
            </div>

            {/* Your AI Agents */}
            {(connectedAgents.length > 0 || loadingAgents) && (
              <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-purple-400"
                    >
                      <rect x="3" y="11" width="18" height="10" rx="2" />
                      <circle cx="12" cy="5" r="2" />
                      <path d="M12 7v4" />
                    </svg>
                    Your AI Agents
                  </h2>
                  <span className="px-2 py-1 bg-purple-500/10 text-purple-400 text-xs rounded-full">
                    {connectedAgents.length} connected
                  </span>
                </div>
                {loadingAgents ? (
                  <div className="flex justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-400"></div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {connectedAgents.map((agent) => (
                      <div
                        key={agent.id}
                        className="flex items-center gap-4 p-4 bg-neutral-800/50 rounded-xl"
                      >
                        <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                          {agent.avatarUrl ? (
                            <Image
                              src={agent.avatarUrl}
                              alt={agent.name}
                              width={48}
                              height={48}
                              className="rounded-full"
                            />
                          ) : (
                            <svg
                              width="24"
                              height="24"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="text-purple-400"
                            >
                              <rect x="3" y="11" width="18" height="10" rx="2" />
                              <circle cx="12" cy="5" r="2" />
                              <path d="M12 7v4" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium">{agent.name}</p>
                          {agent.description && (
                            <p className="text-neutral-400 text-sm truncate">
                              {agent.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded-full">
                            Active
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Recent Activity */}
            <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
              <h2 className="text-lg font-semibold text-white mb-4">
                Recent Activity
              </h2>
              {loadingData ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white"></div>
                </div>
              ) : registrations.length === 0 && talkSubmissions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-neutral-400 mb-4">No activity yet</p>
                  <Link
                    href="/events"
                    className="text-emerald-400 hover:text-emerald-300 font-medium focus-visible:outline-none focus-visible:underline"
                  >
                    Browse upcoming events &rarr;
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {registrations.slice(0, 3).map((reg) => (
                    <div
                      key={reg.id}
                      className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg"
                    >
                      <div className="w-8 h-8 bg-emerald-500/10 rounded-full flex items-center justify-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-emerald-400"
                          aria-hidden="true"
                        >
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">
                          Registered for {reg.eventTitle}
                        </p>
                        <p className="text-neutral-400 text-xs">
                          {reg.registeredAt?.toDate
                            ? reg.registeredAt.toDate().toLocaleDateString()
                            : "Recently"}
                        </p>
                      </div>
                    </div>
                  ))}
                  {talkSubmissions.slice(0, 3).map((talk) => (
                    <div
                      key={talk.id}
                      className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg"
                    >
                      <div className="w-8 h-8 bg-blue-500/10 rounded-full flex items-center justify-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-blue-400"
                          aria-hidden="true"
                        >
                          <polygon points="12 2 2 7 12 12 22 7 12 2" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm truncate">
                          Submitted talk: {talk.title}
                        </p>
                        <p className="text-neutral-400 text-xs capitalize">
                          Status: {talk.status || "pending"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "events" && (
          <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">
                My Event Registrations
              </h2>
              <Link
                href="/events"
                className="text-emerald-400 hover:text-emerald-300 text-sm font-medium focus-visible:outline-none focus-visible:underline"
              >
                Browse Events
              </Link>
            </div>

            {loadingData ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white"></div>
              </div>
            ) : registrations.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-neutral-600"
                    aria-hidden="true"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <p className="text-neutral-400 mb-4">
                  You haven&apos;t registered for any events yet
                </p>
                <Link
                  href="/events"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  Browse Events
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {registrations.map((reg) => (
                  <div
                    key={reg.id}
                    className="flex items-center justify-between p-4 bg-neutral-800/50 rounded-xl"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-emerald-400"
                          aria-hidden="true"
                        >
                          <rect
                            x="3"
                            y="4"
                            width="18"
                            height="18"
                            rx="2"
                            ry="2"
                          />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white font-medium">
                          {reg.eventTitle}
                        </p>
                        <p className="text-neutral-400 text-sm">
                          {reg.eventDate || "Date TBD"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 text-sm rounded-full ${
                        reg.status === "attended"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : reg.status === "cancelled"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-blue-500/10 text-blue-400"
                      }`}
                    >
                      {reg.status === "attended"
                        ? "Attended"
                        : reg.status === "cancelled"
                        ? "Cancelled"
                        : "Registered"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "talks" && (
          <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">
                My Talk Submissions
              </h2>
              <Link
                href="/talks/submit"
                className="text-emerald-400 hover:text-emerald-300 text-sm font-medium focus-visible:outline-none focus-visible:underline"
              >
                Submit a Talk
              </Link>
            </div>

            {loadingData ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white"></div>
              </div>
            ) : talkSubmissions.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    className="text-neutral-600"
                    aria-hidden="true"
                  >
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                    <polyline points="2 17 12 22 22 17" />
                    <polyline points="2 12 12 17 22 12" />
                  </svg>
                </div>
                <p className="text-neutral-400 mb-4">
                  You haven&apos;t submitted any talks yet
                </p>
                <Link
                  href="/talks/submit"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-semibold hover:bg-emerald-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  Submit a Talk
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {talkSubmissions.map((talk) => (
                  <div
                    key={talk.id}
                    className="flex items-center justify-between p-4 bg-neutral-800/50 rounded-xl"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-blue-400"
                          aria-hidden="true"
                        >
                          <polygon points="12 2 2 7 12 12 22 7 12 2" />
                          <polyline points="2 17 12 22 22 17" />
                          <polyline points="2 12 12 17 22 12" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white font-medium">{talk.title}</p>
                        <p className="text-neutral-400 text-sm">
                          {talk.submittedAt?.toDate
                            ? talk.submittedAt
                                .toDate()
                                .toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })
                            : "Recently submitted"}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 text-sm rounded-full capitalize ${
                        talk.status === "approved"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : talk.status === "completed"
                          ? "bg-purple-500/10 text-purple-400"
                          : talk.status === "rejected"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-yellow-500/10 text-yellow-400"
                      }`}
                    >
                      {talk.status || "pending"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Security Tab */}
        {activeTab === "security" && (
          <div className="space-y-6">
            {/* Email Verification Status */}
            {emailVerificationStatus && (
              <div
                className={`p-4 rounded-lg ${
                  emailVerificationStatus.type === "success"
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                    : "bg-red-500/10 border border-red-500/20 text-red-400"
                }`}
              >
                {emailVerificationStatus.message}
                <button
                  onClick={() => setEmailVerificationStatus(null)}
                  className="ml-2 text-sm underline hover:no-underline"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Email Management */}
            <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
              <h2 className="text-lg font-semibold text-white mb-4">
                Email Addresses
              </h2>
              <p className="text-neutral-400 text-sm mb-4">
                Manage the email addresses associated with your account. You can use any verified email to sign in.
              </p>

              {/* Primary Email */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-500/10 rounded-full flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="text-emerald-400"
                        aria-hidden="true"
                      >
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white text-sm">{user.email}</p>
                      <p className="text-neutral-400 text-xs">Primary email</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 text-xs rounded-full">
                    Primary
                  </span>
                </div>

                {/* Additional Emails */}
                {userProfile?.additionalEmails?.map((emailEntry) => (
                  <div
                    key={emailEntry.email}
                    className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-neutral-700 rounded-full flex items-center justify-center">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="text-neutral-400"
                          aria-hidden="true"
                        >
                          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                          <polyline points="22,6 12,13 2,6" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white text-sm">{emailEntry.email}</p>
                        <p className="text-neutral-400 text-xs">
                          {emailEntry.verified ? "Verified" : "Pending verification"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {emailEntry.verified && (
                        <button
                          onClick={() => handleMakePrimary(emailEntry.email)}
                          disabled={primaryEmailLoading === emailEntry.email}
                          className="px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50"
                        >
                          {primaryEmailLoading === emailEntry.email ? "..." : "Make Primary"}
                        </button>
                      )}
                      <button
                        onClick={() => handleRemoveEmail(emailEntry.email)}
                        disabled={emailRemoveLoading === emailEntry.email}
                        className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                      >
                        {emailRemoveLoading === emailEntry.email ? "..." : "Remove"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add New Email */}
              <div>
                <label htmlFor="new-email" className="block text-sm font-medium text-neutral-300 mb-2">
                  Add another email
                </label>
                <div className="flex gap-3">
                  <input
                    id="new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Enter email address"
                    className="flex-1 px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent"
                  />
                  <button
                    onClick={handleAddEmail}
                    disabled={emailAddLoading || !newEmail.trim()}
                    className="px-4 py-3 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    {emailAddLoading ? "Sending..." : "Add Email"}
                  </button>
                </div>
                {emailAddError && (
                  <p className="text-red-400 text-sm mt-2">{emailAddError}</p>
                )}
                {emailAddSuccess && (
                  <p className="text-emerald-400 text-sm mt-2">{emailAddSuccess}</p>
                )}
              </div>
            </div>

            {/* Account Security */}
            <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
              <h2 className="text-lg font-semibold text-white mb-4">
                Account Security
              </h2>
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-white font-medium">Google Login</p>
                    <p className="text-neutral-400 text-sm">
                      {hasGoogleProvider ? "Connected" : "Not connected"}
                    </p>
                  </div>
                  {hasGoogleProvider && (
                    <button
                      onClick={disconnectGoogle}
                      disabled={googleDisconnecting}
                      className="px-3 py-2 bg-neutral-800/50 text-white text-sm rounded-lg inline-flex items-center gap-2 hover:bg-neutral-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      {googleDisconnecting ? "Disconnecting..." : "Disconnect Google"}
                    </button>
                  )}
                </div>
                {googleError && (
                  <p className="text-red-400 text-sm">{googleError}</p>
                )}

                <div>
                  <p className="text-white font-medium mb-2">
                    {hasPasswordProvider ? "Update Password" : "Set a Password"}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <FormInput
                      id="new-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="New password"
                    />
                    <FormInput
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm password"
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={handleSetPassword}
                      disabled={passwordSaving}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                    >
                      {passwordSaving ? "Saving..." : "Save Password"}
                    </button>
                    {passwordSuccess && (
                      <p className="text-emerald-400 text-sm">Password updated.</p>
                    )}
                  </div>
                  {passwordError && (
                    <p className="text-red-400 text-sm mt-2">{passwordError}</p>
                  )}
                </div>

                <div>
                  <p className="text-white font-medium mb-2">Two-Factor Authentication</p>
                  <p className="text-neutral-400 text-sm mb-3">
                    {hasPhoneMfa ? "Enabled with SMS." : "Use SMS to add an extra layer of security."}
                  </p>
                  <div className="space-y-3">
                    <FormInput
                      id="phone-number"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+15551234567"
                      disabled={hasPhoneMfa}
                    />
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={sendMfaCode}
                        disabled={mfaLoading || hasPhoneMfa}
                        className="px-4 py-2 bg-neutral-800 text-white rounded-lg text-sm font-medium hover:bg-neutral-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      >
                        {mfaLoading ? "Sending..." : "Send Code"}
                      </button>
                      <button
                        onClick={disableMfa}
                        disabled={mfaLoading || !hasPhoneMfa}
                        className="px-4 py-2 bg-neutral-800/50 text-white rounded-lg text-sm font-medium hover:bg-neutral-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                      >
                        Disable 2FA
                      </button>
                    </div>
                    {mfaVerificationId && (
                      <div className="space-y-3">
                        <FormInput
                          id="sms-code"
                          type="text"
                          value={smsCode}
                          onChange={(e) => setSmsCode(e.target.value)}
                          placeholder="Enter SMS code"
                        />
                        <button
                          onClick={confirmMfaEnrollment}
                          disabled={mfaLoading}
                          className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                        >
                          {mfaLoading ? "Verifying..." : "Enable 2FA"}
                        </button>
                      </div>
                    )}
                    {mfaError && (
                      <p className="text-red-400 text-sm">{mfaError}</p>
                    )}
                    {mfaSuccess && (
                      <p className="text-emerald-400 text-sm">{mfaSuccess}</p>
                    )}
                    <div id="mfa-recaptcha-container" />
                  </div>
                </div>
              </div>
            </div>

            {/* Connected Accounts */}
            <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
              <h2 className="text-lg font-semibold text-white mb-4">
                Connected Accounts
              </h2>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-white font-medium">Discord</p>
                    <p className="text-neutral-400 text-sm">
                      {discordInfo ? `Connected as ${discordInfo.username}` : "Not connected"}
                    </p>
                  </div>
                  {discordInfo ? (
                    <button
                      onClick={disconnectDiscord}
                      disabled={discordDisconnecting}
                      className="px-3 py-2 bg-[#5865F2]/10 text-[#5865F2] text-sm rounded-lg inline-flex items-center gap-2 hover:bg-[#5865F2]/20 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2]"
                    >
                      {discordDisconnecting ? "Disconnecting..." : "Disconnect Discord"}
                    </button>
                  ) : (
                    <button
                      onClick={connectDiscord}
                      disabled={discordConnecting}
                      className="px-3 py-2 bg-[#5865F2] text-white text-sm rounded-lg inline-flex items-center gap-2 hover:bg-[#4752C4] transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5865F2]"
                    >
                      {discordConnecting ? "Connecting..." : "Connect Discord"}
                    </button>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-white font-medium">GitHub</p>
                    <p className="text-neutral-400 text-sm">
                      {githubInfo ? `Connected as ${githubInfo.login}` : "Not connected"}
                    </p>
                  </div>
                  {githubInfo ? (
                    <button
                      onClick={disconnectGithub}
                      disabled={githubDisconnecting}
                      className="px-3 py-2 bg-neutral-800/50 text-white text-sm rounded-lg inline-flex items-center gap-2 hover:bg-neutral-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      {githubDisconnecting ? "Disconnecting..." : "Disconnect GitHub"}
                    </button>
                  ) : (
                    <button
                      onClick={connectGithub}
                      disabled={githubConnecting}
                      className="px-3 py-2 bg-neutral-800 text-white text-sm rounded-lg inline-flex items-center gap-2 hover:bg-neutral-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      {githubConnecting ? "Connecting..." : "Connect GitHub"}
                    </button>
                  )}
                </div>

                {/* AI Agents Section */}
                <div className="pt-4 border-t border-neutral-800">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-white font-medium">AI Agents</p>
                      <p className="text-neutral-400 text-sm">
                        {loadingAgents
                          ? "Loading..."
                          : connectedAgents.length > 0
                          ? `${connectedAgents.length} agent${connectedAgents.length > 1 ? "s" : ""} connected`
                          : "No agents connected"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {connectedAgents.length > 0 && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-purple-500/10 rounded-lg">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="text-purple-400"
                          >
                            <rect x="3" y="11" width="18" height="10" rx="2" />
                            <circle cx="12" cy="5" r="2" />
                            <path d="M12 7v4" />
                          </svg>
                          <span className="text-purple-400 text-xs font-medium">
                            {connectedAgents.length}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* List of connected agents */}
                  {connectedAgents.length > 0 && (
                    <div className="space-y-2">
                      {connectedAgents.map((agent) => (
                        <div
                          key={agent.id}
                          className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-lg"
                        >
                          <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                            {agent.avatarUrl ? (
                              <Image
                                src={agent.avatarUrl}
                                alt={agent.name}
                                width={32}
                                height={32}
                                className="rounded-full"
                              />
                            ) : (
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="text-purple-400"
                              >
                                <rect x="3" y="11" width="18" height="10" rx="2" />
                                <circle cx="12" cy="5" r="2" />
                                <path d="M12 7v4" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">
                              {agent.name}
                            </p>
                            {agent.description && (
                              <p className="text-neutral-400 text-xs truncate">
                                {agent.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 rounded text-xs text-emerald-400">
                            Active
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            {/* Profile Visibility Toggle */}
            <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-white">
                  Public Profile
                </h2>
                <ToggleSwitch
                  size="md"
                  label="Public profile"
                  checked={profileSettings.visibility.isPublic}
                  onChange={(checked) =>
                    setProfileSettings((prev) => ({
                      ...prev,
                      visibility: { ...prev.visibility, isPublic: checked },
                    }))
                  }
                />
              </div>
              <p className="text-neutral-400 text-sm">
                {profileSettings.visibility.isPublic
                  ? "Your profile is visible on the Members page"
                  : "Your profile is hidden from the Members page"}
              </p>
            </div>

            {/* Profile Information */}
            <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
              <h2 className="text-lg font-semibold text-white mb-4">
                Profile Information
              </h2>
              <div className="space-y-4">
                <FormTextarea
                  id="bio"
                  label="Bio"
                  value={profileSettings.bio}
                  onChange={(e) =>
                    setProfileSettings((prev) => ({ ...prev, bio: e.target.value }))
                  }
                  placeholder="Tell us about yourself..."
                  rows={3}
                />
                <div className="grid sm:grid-cols-2 gap-4">
                  <FormInput
                    id="location"
                    label="Location"
                    value={profileSettings.location}
                    onChange={(e) =>
                      setProfileSettings((prev) => ({ ...prev, location: e.target.value }))
                    }
                    placeholder="Boston, MA"
                  />
                  <FormInput
                    id="company"
                    label="Company"
                    value={profileSettings.company}
                    onChange={(e) =>
                      setProfileSettings((prev) => ({ ...prev, company: e.target.value }))
                    }
                    placeholder="Acme Inc."
                  />
                </div>
                <FormInput
                  id="jobTitle"
                  label="Job Title"
                  value={profileSettings.jobTitle}
                  onChange={(e) =>
                    setProfileSettings((prev) => ({ ...prev, jobTitle: e.target.value }))
                  }
                  placeholder="Software Engineer"
                />
              </div>
            </div>

            {/* Social Links */}
            <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
              <h2 className="text-lg font-semibold text-white mb-4">
                Social Links
              </h2>
              <div className="space-y-4">
                <FormInput
                  type="url"
                  id="website"
                  label="Website"
                  value={profileSettings.socialLinks.website}
                  onChange={(e) =>
                    setProfileSettings((prev) => ({
                      ...prev,
                      socialLinks: { ...prev.socialLinks, website: e.target.value },
                    }))
                  }
                  placeholder="https://yourwebsite.com"
                />
                <FormInput
                  type="url"
                  id="linkedIn"
                  label="LinkedIn"
                  value={profileSettings.socialLinks.linkedIn}
                  onChange={(e) =>
                    setProfileSettings((prev) => ({
                      ...prev,
                      socialLinks: { ...prev.socialLinks, linkedIn: e.target.value },
                    }))
                  }
                  placeholder="https://linkedin.com/in/username"
                />
                <FormInput
                  type="url"
                  id="twitter"
                  label="X (Twitter)"
                  value={profileSettings.socialLinks.twitter}
                  onChange={(e) =>
                    setProfileSettings((prev) => ({
                      ...prev,
                      socialLinks: { ...prev.socialLinks, twitter: e.target.value },
                    }))
                  }
                  placeholder="https://x.com/username"
                />
                <FormInput
                  type="url"
                  id="github"
                  label="GitHub"
                  value={profileSettings.socialLinks.github}
                  onChange={(e) =>
                    setProfileSettings((prev) => ({
                      ...prev,
                      socialLinks: { ...prev.socialLinks, github: e.target.value },
                    }))
                  }
                  placeholder="https://github.com/username"
                />
                <FormInput
                  type="url"
                  id="substack"
                  label="Substack"
                  value={profileSettings.socialLinks.substack}
                  onChange={(e) =>
                    setProfileSettings((prev) => ({
                      ...prev,
                      socialLinks: { ...prev.socialLinks, substack: e.target.value },
                    }))
                  }
                  placeholder="https://yourname.substack.com"
                />
              </div>
            </div>

            {/* Visibility Toggles */}
            <div className="bg-neutral-900 rounded-2xl p-6 border border-neutral-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">
                  What to Show on Your Public Profile
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => toggleAllVisibility(true)}
                    className="px-4 py-2 text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded min-h-[44px] flex items-center"
                  >
                    Show All
                  </button>
                  <button
                    onClick={() => toggleAllVisibility(false)}
                    className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-neutral-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded min-h-[44px] flex items-center"
                  >
                    Hide All
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { key: "showBio", label: "Bio" },
                  { key: "showLocation", label: "Location" },
                  { key: "showCompany", label: "Company" },
                  { key: "showJobTitle", label: "Job Title" },
                  { key: "showEmail", label: "Email" },
                  { key: "showDiscord", label: "Discord Badge" },
                  { key: "showGithubBadge", label: "GitHub Badge" },
                  { key: "showEventsAttended", label: "Events Attended" },
                  { key: "showTalksGiven", label: "Talks Given" },
                  { key: "showWebsite", label: "Website" },
                  { key: "showLinkedIn", label: "LinkedIn" },
                  { key: "showTwitter", label: "X (Twitter)" },
                  { key: "showGithub", label: "GitHub" },
                  { key: "showSubstack", label: "Substack" },
                  { key: "showMemberSince", label: "Member Since" },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between py-2">
                    <span className="text-neutral-300 text-sm">{label}</span>
                    <ToggleSwitch
                      label={label}
                      checked={profileSettings.visibility[key as keyof typeof profileSettings.visibility] as boolean}
                      onChange={(checked) =>
                        setProfileSettings((prev) => ({
                          ...prev,
                          visibility: { ...prev.visibility, [key]: checked },
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between">
              {settingsError && (
                <p className="text-red-400 text-sm">{settingsError}</p>
              )}
              {settingsSuccess && (
                <p className="text-emerald-400 text-sm">Settings saved successfully!</p>
              )}
              {!settingsError && !settingsSuccess && <div />}
              <button
                onClick={saveProfileSettings}
                disabled={savingSettings}
                className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900"
              >
                {savingSettings ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-profile-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={closeEditModal}
            aria-hidden="true"
          />

          {/* Modal */}
          <div className="relative bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl">
            {/* Close button */}
            <button
              onClick={closeEditModal}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white transition-colors p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Close"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <h2
              id="edit-profile-title"
              className="text-xl font-bold text-white mb-6"
            >
              Edit Profile
            </h2>

            {/* Photo Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-neutral-400 mb-3">
                Profile Photo
              </label>
              <div className="flex items-center gap-4">
                {/* Preview */}
                <div className="shrink-0">
                  {photoPreview ? (
                    <Image
                      src={photoPreview}
                      alt="Preview"
                      width={80}
                      height={80}
                      className="rounded-full object-cover w-20 h-20"
                    />
                  ) : (
                    <Avatar
                      src={user.photoURL}
                      name={user.displayName}
                      email={user.email}
                      size="lg"
                    />
                  )}
                </div>

                {/* Upload Button */}
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                    id="photo-upload"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 bg-neutral-800 text-white rounded-lg text-sm font-medium hover:bg-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    Choose Photo
                  </button>
                  <p className="text-neutral-400 text-xs mt-2">
                    JPG, PNG or GIF. Max 5MB.
                  </p>
                </div>
              </div>
            </div>

            {/* Name Input */}
            <div className="mb-6">
              <FormInput
                id="edit-name"
                label="Display Name"
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            {/* Error Message */}
            {editError && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {editError}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={closeEditModal}
                className="flex-1 px-4 py-3 bg-neutral-800 text-white rounded-lg font-medium hover:bg-neutral-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="flex-1 px-4 py-3 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[80vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
        </div>
      }
    >
      <ProfilePageContent />
    </Suspense>
  );
}
