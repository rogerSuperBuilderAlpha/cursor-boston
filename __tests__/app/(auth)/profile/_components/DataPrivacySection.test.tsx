/**
 * @jest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataPrivacySection } from "@/app/(auth)/profile/_components/DataPrivacySection";
import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";

const mockUseAuth = useAuth as jest.Mock;
const mockSignOut = jest.fn();
var mockPush = jest.fn();

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/profile",
  useParams: () => ({}),
  redirect: jest.fn(),
  notFound: jest.fn(),
}));

describe("DataPrivacySection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignOut.mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({
      user: makeAuthUser("privacy-user"),
      signOut: mockSignOut,
    });

    global.URL.createObjectURL = jest.fn(() => "blob:mock");
    global.URL.revokeObjectURL = jest.fn();
  });

  it("downloads a portable data export", async () => {
    const blob = new Blob(['{"ok":true}'], { type: "application/json" });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      blob: async () => blob,
    }) as typeof fetch;

    const user = userEvent.setup();
    render(<DataPrivacySection />);

    await user.click(screen.getByRole("button", { name: /Download my data/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/profile/data?format=portable",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Bearer /),
          }),
        }),
      );
    });
  });

  it("surfaces download errors from the API", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "export_failed" }),
    }) as typeof fetch;

    const user = userEvent.setup();
    render(<DataPrivacySection />);

    await user.click(screen.getByRole("button", { name: /Download my data/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("export_failed");
    });
  });

  it("requires DELETE confirmation before removing the account", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as typeof fetch;

    const user = userEvent.setup();
    render(<DataPrivacySection />);

    await user.click(screen.getByRole("button", { name: /Delete my account/i }));
    const confirmBtn = screen.getByRole("button", {
      name: /Permanently delete my account/i,
    });
    expect(confirmBtn).toBeDisabled();

    await user.type(screen.getByLabelText(/Type DELETE to confirm/i), "DELETE");
    await user.click(confirmBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/account",
        expect.objectContaining({
          method: "DELETE",
          body: JSON.stringify({ confirmText: "DELETE" }),
        }),
      );
    });
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/");
  });

  it("shows re-auth guidance when delete is blocked", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "Please re-auth within 5 minutes" }),
    }) as typeof fetch;

    const user = userEvent.setup();
    render(<DataPrivacySection />);

    await user.click(screen.getByRole("button", { name: /Delete my account/i }));
    await user.type(screen.getByLabelText(/Type DELETE to confirm/i), "DELETE");
    await user.click(
      screen.getByRole("button", { name: /Permanently delete my account/i }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/sign out and sign back in/i);
    });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("returns null when there is no signed-in user", () => {
    mockUseAuth.mockReturnValue({ user: null, signOut: mockSignOut });
    const { container } = render(<DataPrivacySection />);
    expect(container).toBeEmptyDOMElement();
  });
});
