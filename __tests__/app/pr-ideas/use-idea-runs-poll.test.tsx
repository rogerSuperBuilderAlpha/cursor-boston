/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import { useIdeaRuns } from "@/app/pr-ideas/_hooks/useIdeaRuns";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: jest.fn(),
  }),
}));

describe("useIdeaRuns polling backoff", () => {
  const mockUser = {
    getIdToken: jest.fn().mockResolvedValue("test-token"),
  } as unknown as User;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("pauses polling message after three consecutive 500 responses on loadRuns", async () => {
    global.fetch = jest.fn().mockImplementation(async () => ({
      ok: false,
      status: 500,
      headers: { get: () => null },
      json: async () => ({ error: "list_failed", errorId: "e1" }),
    })) as unknown as typeof fetch;

    const { result } = renderHook(() =>
      useIdeaRuns({ user: mockUser, cursorConnected: true })
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());

    await act(async () => {
      await result.current.loadRuns(true, "refreshing");
    });
    await act(async () => {
      await result.current.loadRuns(true, "refreshing");
    });

    await waitFor(() => {
      expect(result.current.error ?? "").toContain("Polling paused");
    });
  });
});
