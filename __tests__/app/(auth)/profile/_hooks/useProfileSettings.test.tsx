/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { act, renderHook, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import type { UserProfile } from "@/contexts/AuthContext";
import { useProfileSettings } from "@/app/(auth)/profile/_hooks/useProfileSettings";

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

  it("saves profile and visibility via API and refreshes profile", async () => {
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
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/profile/visibility",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"isPublic":true'),
        }),
      );
      expect(refreshUserProfile).toHaveBeenCalled();
      expect(result.current.success).toBe(true);
    });
  });

  it("reverts public toggle when visibility API update fails", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "offline" }),
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
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
