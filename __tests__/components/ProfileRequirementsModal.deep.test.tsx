/**
 * @jest-environment jsdom
 */
import "@/__tests__/app/_shared/page-test-setup";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAuth } from "@/contexts/AuthContext";
import ProfileRequirementsModal from "@/components/ProfileRequirementsModal";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

const mockUseAuth = useAuth as jest.Mock;
const mockRefreshUserProfile = jest.fn();

const unmetProfile = {
  displayName: null,
  hasDisplayName: false,
  hasGithub: false,
  githubUsername: null,
  hasDiscord: false,
  discordUsername: null,
  visibility: { isPublic: false, showDiscord: false },
  photoURL: null,
};

const partialProfile = {
  displayName: "Alex Builder",
  hasDisplayName: true,
  hasGithub: true,
  githubUsername: "alex",
  hasDiscord: true,
  discordUsername: "alex#1234",
  visibility: { isPublic: false, showDiscord: false },
  photoURL: null,
};

const metProfile = {
  displayName: "Alex Builder",
  hasDisplayName: true,
  hasGithub: true,
  githubUsername: "alex",
  hasDiscord: true,
  discordUsername: "alex#1234",
  visibility: { isPublic: true, showDiscord: true },
  photoURL: null,
};

function installVisibilityFetch(
  profile: typeof unmetProfile,
  patchHandler?: (body: Record<string, unknown>) => unknown,
) {
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method || "GET").toUpperCase();

    if (url.includes("/api/profile/visibility") && method === "GET") {
      return {
        ok: true,
        json: async () => ({ success: true, profile }),
      };
    }
    if (url.includes("/api/profile/visibility") && method === "PATCH") {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      const patch = patchHandler?.(body);
      if (patch === null) {
        return {
          ok: true,
          json: async () => ({ success: false, error: "Visibility update failed" }),
        };
      }
      const visibility = {
        ...profile.visibility,
        ...(patch as object),
        ...(body as object),
      };
      return {
        ok: true,
        json: async () => ({ success: true, visibility }),
      };
    }
    if (url.includes("/api/profile/update") && method === "PATCH") {
      const body = JSON.parse(String(init?.body)) as { displayName?: string };
      if (!body.displayName) {
        return {
          ok: false,
          json: async () => ({ error: "Name required" }),
        };
      }
      return { ok: true, json: async () => ({ success: true }) };
    }
    return { ok: true, json: async () => ({}) };
  }) as typeof fetch;
}

describe("ProfileRequirementsModal deep", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: makeAuthUser(),
      refreshUserProfile: mockRefreshUserProfile,
      loading: false,
    });
  });

  it("toggles public profile visibility via PATCH", async () => {
    installVisibilityFetch(unmetProfile);
    const user = userEvent.setup();
    render(
      <ProfileRequirementsModal
        isOpen
        onClose={jest.fn()}
        requirements={["isPublic"]}
      />,
    );

    const toggle = await screen.findByRole("switch", {
      name: /toggle public profile/i,
    });
    await user.click(toggle);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/profile/visibility",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"isPublic":true'),
        }),
      );
    });
    expect(mockRefreshUserProfile).toHaveBeenCalled();
  });

  it("disables Discord visibility toggle when Discord is not connected", async () => {
    installVisibilityFetch(unmetProfile);
    render(
      <ProfileRequirementsModal
        isOpen
        onClose={jest.fn()}
        requirements={["showDiscord"]}
      />,
    );

    const toggle = await screen.findByRole("switch", {
      name: /toggle discord visibility/i,
    });
    expect(toggle).toBeDisabled();
  });

  it("saves display name from the input field", async () => {
    installVisibilityFetch(unmetProfile);
    const user = userEvent.setup();
    render(
      <ProfileRequirementsModal
        isOpen
        onClose={jest.fn()}
        requirements={["hasDisplayName"]}
      />,
    );

    const input = await screen.findByLabelText(/display name/i);
    await user.type(input, "Alex Builder");
    await user.click(screen.getByRole("button", { name: /^Save$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/profile/update",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining("Alex Builder"),
        }),
      );
    });
  });

  it("enters edit mode for an already-complete display name", async () => {
    installVisibilityFetch(metProfile);
    const user = userEvent.setup();
    render(
      <ProfileRequirementsModal
        isOpen
        onClose={jest.fn()}
        requirements={["hasDisplayName"]}
      />,
    );

    await screen.findByText("Alex Builder");
    await user.click(screen.getByRole("button", { name: /edit display name/i }));

    expect(screen.getByLabelText(/display name/i)).toHaveValue("Alex Builder");
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
  });

  it("closes on Escape key", async () => {
    installVisibilityFetch(unmetProfile);
    const onClose = jest.fn();
    render(
      <ProfileRequirementsModal
        isOpen
        onClose={onClose}
        requirements={["hasGithub"]}
      />,
    );

    await screen.findByText(/GitHub Connected/i);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes when backdrop is clicked", async () => {
    installVisibilityFetch(unmetProfile);
    const onClose = jest.fn();
    render(
      <ProfileRequirementsModal
        isOpen
        onClose={onClose}
        requirements={["hasGithub"]}
      />,
    );

    await screen.findByText(/GitHub Connected/i);
    const backdrop = document.querySelector(".backdrop-blur-sm");
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows visibility PATCH error message", async () => {
    installVisibilityFetch(unmetProfile, () => null);
    const user = userEvent.setup();
    render(
      <ProfileRequirementsModal
        isOpen
        onClose={jest.fn()}
        requirements={["isPublic"]}
      />,
    );

    await user.click(
      await screen.findByRole("switch", { name: /toggle public profile/i }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Visibility update failed/i,
    );
  });

  it("shows display name update error message", async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();
      if (url.includes("/api/profile/visibility") && method === "GET") {
        return {
          ok: true,
          json: async () => ({ success: true, profile: unmetProfile }),
        };
      }
      if (url.includes("/api/profile/update")) {
        return {
          ok: false,
          json: async () => ({ error: "Name required" }),
        };
      }
      return { ok: true, json: async () => ({}) };
    }) as typeof fetch;

    const user = userEvent.setup();
    render(
      <ProfileRequirementsModal
        isOpen
        onClose={jest.fn()}
        requirements={["hasDisplayName"]}
      />,
    );

    await user.type(await screen.findByLabelText(/display name/i), "   ");
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    expect(screen.getByRole("button", { name: /^Save$/i })).toBeDisabled();
  });

  it("renders completed requirements section for met items", async () => {
    installVisibilityFetch(metProfile);
    render(
      <ProfileRequirementsModal
        isOpen
        onClose={jest.fn()}
        requirements={["hasGithub", "hasDisplayName", "isPublic"]}
      />,
    );

    expect(await screen.findByText(/Completed \(3\)/i)).toBeInTheDocument();
    expect(screen.getByText(/@alex/i)).toBeInTheDocument();
  });

  it("shows Done button when all requirements are met", async () => {
    installVisibilityFetch(metProfile);
    const onClose = jest.fn();
    render(
      <ProfileRequirementsModal
        isOpen
        onClose={onClose}
        requirements={["hasGithub", "hasDisplayName", "isPublic"]}
      />,
    );

    const doneBtn = await screen.findByRole("button", { name: /^Done$/i });
    await userEvent.setup().click(doneBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it("shows connect links for GitHub and Discord when unmet", async () => {
    installVisibilityFetch(unmetProfile);
    render(
      <ProfileRequirementsModal
        isOpen
        onClose={jest.fn()}
        requirements={["hasGithub", "hasDiscord"]}
      />,
    );

    expect(
      await screen.findByRole("link", { name: /Connect GitHub/i }),
    ).toHaveAttribute("href", "/api/github/authorize");
    expect(screen.getByRole("link", { name: /Connect Discord/i })).toHaveAttribute(
      "href",
      "/api/discord/authorize",
    );
  });

  it("toggles showDiscord when Discord is connected", async () => {
    installVisibilityFetch(partialProfile);
    const user = userEvent.setup();
    render(
      <ProfileRequirementsModal
        isOpen
        onClose={jest.fn()}
        requirements={["showDiscord"]}
      />,
    );

    const toggle = await screen.findByRole("switch", {
      name: /toggle discord visibility/i,
    });
    expect(toggle).not.toBeDisabled();
    await user.click(toggle);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/profile/visibility",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining('"showDiscord":true'),
        }),
      );
    });
  });
});
