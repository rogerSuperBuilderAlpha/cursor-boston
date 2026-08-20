/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 *
 * @jest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EventRsvpCard } from "@/components/events/EventRsvpCard";
import { useAuth } from "@/contexts/AuthContext";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

describe("EventRsvpCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: null } as never);
    global.fetch = jest.fn(() =>
      jsonResponse({
        success: true,
        configured: true,
        capacity: 50,
        confirmedCount: 12,
        waitlistCount: 0,
        remaining: 38,
        myStatus: "none",
        waitlistPosition: null,
      })
    ) as jest.Mock;
  });

  it("shows capacity counts and a sign-in CTA when logged out", async () => {
    render(
      <EventRsvpCard eventId="cafe-cursor-boston-2026" eventSlug="cafe-cursor-boston" capacity={50} />
    );

    expect(await screen.findByText("12/50")).toBeInTheDocument();
    const login = screen.getByRole("link", { name: "Sign in to RSVP" });
    expect(login).toHaveAttribute("href", "/login?redirect=%2Fevents%2Fcafe-cursor-boston");
  });

  it("RSVPs when the signed-in user clicks the button", async () => {
    mockUseAuth.mockReturnValue({
      user: { getIdToken: jest.fn().mockResolvedValue("token") },
    } as never);
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockImplementationOnce(() =>
        jsonResponse({
          success: true,
          configured: true,
          capacity: 50,
          confirmedCount: 12,
          waitlistCount: 0,
          remaining: 38,
          myStatus: "none",
          waitlistPosition: null,
        })
      )
      .mockImplementationOnce(() =>
        jsonResponse({
          success: true,
          configured: true,
          capacity: 50,
          confirmedCount: 13,
          waitlistCount: 0,
          remaining: 37,
          myStatus: "confirmed",
          waitlistPosition: null,
        })
      );

    render(
      <EventRsvpCard eventId="cafe-cursor-boston-2026" eventSlug="cafe-cursor-boston" capacity={50} />
    );
    fireEvent.click(await screen.findByRole("button", { name: "RSVP — confirmed spot" }));

    await waitFor(() => {
      expect(screen.getByText("You have a confirmed spot.")).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/events/cafe-cursor-boston-2026/rsvp",
      expect.objectContaining({ method: "POST" })
    );
  });
});
