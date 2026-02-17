import { useEffect, useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { User } from "firebase/auth";

export interface ProfileSettings {
  bio: string;
  location: string;
  company: string;
  jobTitle: string;
  socialLinks: {
    website: string;
    linkedIn: string;
    twitter: string;
    github: string;
    substack: string;
  };
  visibility: {
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
  };
}

const DEFAULT_SETTINGS: ProfileSettings = {
  bio: "",
  location: "",
  company: "",
  jobTitle: "",
  socialLinks: { website: "", linkedIn: "", twitter: "", github: "", substack: "" },
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
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useProfileSettings(user: User | null, userProfile: any, refreshUserProfile: () => Promise<void>) {
  const [settings, setSettings] = useState<ProfileSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Sync from userProfile whenever it changes
  useEffect(() => {
    if (!userProfile) return;
    setSettings({
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
  }, [userProfile]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/profile/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          bio: settings.bio.trim(),
          location: settings.location.trim(),
          company: settings.company.trim(),
          jobTitle: settings.jobTitle.trim(),
          socialLinks: {
            website: settings.socialLinks.website.trim(),
            linkedIn: settings.socialLinks.linkedIn.trim(),
            twitter: settings.socialLinks.twitter.trim(),
            github: settings.socialLinks.github.trim(),
            substack: settings.socialLinks.substack.trim(),
          },
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save settings");
      }
      if (db) {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { visibility: settings.visibility, updatedAt: serverTimestamp() });
      }
      await refreshUserProfile();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const togglePublic = async (isPublic: boolean) => {
    if (!db || !user) return;
    const prev = settings.visibility.isPublic;
    setSettings((s) => ({ ...s, visibility: { ...s.visibility, isPublic } }));
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { "visibility.isPublic": isPublic, updatedAt: serverTimestamp() });
    } catch {
      // Revert on error
      setSettings((s) => ({ ...s, visibility: { ...s.visibility, isPublic: prev } }));
    }
  };

  const toggleAllVisibility = (show: boolean) => {
    setSettings((s) => ({
      ...s,
      visibility: {
        ...s.visibility,
        showEmail: show, showBio: show, showLocation: show, showCompany: show,
        showJobTitle: show, showDiscord: show, showGithubBadge: show,
        showEventsAttended: show, showTalksGiven: show, showWebsite: show,
        showLinkedIn: show, showTwitter: show, showGithub: show,
        showSubstack: show, showMemberSince: show,
      },
    }));
  };

  return { settings, setSettings, saving, error, success, save, togglePublic, toggleAllVisibility };
}
