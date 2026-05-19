/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { act, renderHook, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import type { UserProfile } from "@/contexts/AuthContext";
import { useProfileSettings } from "@/app/(auth)/profile/_hooks/useProfileSettings";
import { updateDoc } from "firebase/firestore";

const mockUpdateDoc = updateDoc as jest.Mock;

const mockUser = {
  uid: "settings-u",
  getIdToken: jest.fn().mockResolvedValue("settings-token"),
} as unknown as User;

const mockProfile: UserProfile = {
  uid: "settings-u",
  email: "u@test.com",
  displayName: "Settings User",
  bio: "Hello",
  location: "Boston",
  company: "CB",
  jobTitle: "Dev",
  socialLinks: {
    website: "https://site.test",
    linkedIn: "",
    twitter: "",
    github: "https://github.com/u",
    substack: "",
  },
  visibility: {
    isPublic: true,
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
} as UserProfile;

describe("useProfileSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  it("syncs settings from userProfile", async () => {
    const { result } = renderHook(() =>
      useProfileSettings(mockUser, mockProfile, jest.fn()),
    );

    await waitFor(() => {
      expect(result.current.settings.bio).toBe("Hello");
      expect(result.current.settings.visibility.isPublic).toBe(true);
    });
  });

  it("saves profile fields and visibility to Firestore", async () => {
    const refreshUserProfile = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useProfileSettings(mockUser, mockProfile, refreshUserProfile),
    );

    await act(async () => {
      result.current.setSettings((s) => ({
        ...s,
        bio: " Updated bio ",
        location: " Cambridge ",
      }));
    });

    await act(async () => {
      await result.current.save();
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/profile/update",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"bio":"Updated bio"'),
        }),
      );
      expect(mockUpdateDoc).toHaveBeenCalled();
      expect(refreshUserProfile).toHaveBeenCalled();
      expect(result.current.success).toBe(true);
    });
  });

  it("reverts public toggle when Firestore update fails", async () => {
    mockUpdateDoc.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() =>
      useProfileSettings(mockUser, mockProfile, jest.fn()),
    );

    await act(async () => {
      await result.current.togglePublic(false);
    });

    expect(result.current.settings.visibility.isPublic).toBe(true);
  });

  it("toggleAllVisibility sets every show* flag", async () => {
    const { result } = renderHook(() =>
      useProfileSettings(mockUser, mockProfile, jest.fn()),
    );

    await act(async () => {
      result.current.toggleAllVisibility(false);
    });

    expect(result.current.settings.visibility.showBio).toBe(false);
    expect(result.current.settings.visibility.showGithub).toBe(false);
  });
});
