/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { render, screen, waitFor } from "@testing-library/react";

const mockUseAuth = jest.fn();
const mockReplace = jest.fn();

// Mock useAuth + useRouter BEFORE importing the component so the
// boundary's effect picks up the mock.
jest.mock("@/contexts/AuthContext", () => ({
  __esModule: true,
  useAuth: () => mockUseAuth(),
}));

jest.mock("next/navigation", () => ({
  __esModule: true,
  useRouter: () => ({ replace: mockReplace }),
}));

import { PyDataAccessGate } from "@/components/events/PyDataAccessGate";

describe("PyDataAccessGate", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockReplace.mockReset();
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("shows the loading state while auth resolves", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    render(
      <PyDataAccessGate>
        <p>secret content</p>
      </PyDataAccessGate>
    );
    expect(screen.getByText(/Checking access/i)).toBeInTheDocument();
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
  });

  it("redirects to the locked URL when there's no signed-in user", async () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false });
    render(
      <PyDataAccessGate>
        <p>secret content</p>
      </PyDataAccessGate>
    );
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/events?pydataLocked=1")
    );
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
  });

  it("renders children when the API confirms allowed=true", async () => {
    mockUseAuth.mockReturnValue({
      user: { getIdToken: () => Promise.resolve("test-token") },
      loading: false,
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ allowed: true }),
    });
    render(
      <PyDataAccessGate>
        <p>secret content</p>
      </PyDataAccessGate>
    );
    await waitFor(() =>
      expect(screen.getByText("secret content")).toBeInTheDocument()
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("redirects when the API returns allowed=false", async () => {
    mockUseAuth.mockReturnValue({
      user: { getIdToken: () => Promise.resolve("test-token") },
      loading: false,
    });
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ allowed: false }),
    });
    render(
      <PyDataAccessGate>
        <p>secret content</p>
      </PyDataAccessGate>
    );
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/events?pydataLocked=1")
    );
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
  });

  it("redirects when the API throws (network/transport error)", async () => {
    mockUseAuth.mockReturnValue({
      user: { getIdToken: () => Promise.resolve("test-token") },
      loading: false,
    });
    (global.fetch as jest.Mock).mockRejectedValue(new Error("network down"));
    render(
      <PyDataAccessGate>
        <p>secret content</p>
      </PyDataAccessGate>
    );
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("/events?pydataLocked=1")
    );
    expect(screen.queryByText("secret content")).not.toBeInTheDocument();
  });
});
