/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * @jest-environment jsdom
 *
 * OpenSSF Gold coverage push #148 — `app/partners/page.tsx` (was 45.9%
 * branch / 46 uncovered branches). Covers auth loading gate, signed-out
 * gate, signed-in render with display-name prefill, GET happy + GET
 * error paths, all three StatusPanel tones (approved/rejected/pending),
 * CalendlyCard's approved-vs-pending text branch, submit happy path
 * (create + update), validation gates (missing name / missing phone),
 * submit error variants (string error from API, object error from API,
 * fetch reject, non-Error throw), and Likert radio toggle.
 */
import "@/__tests__/app/_shared/page-test-setup";

import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { useAuth } from "@/contexts/AuthContext";
import { makeAuthUser } from "@/__tests__/app/_shared/game-dashboard-mocks";
import PartnersPage from "@/app/partners/page";

const mockUseAuth = useAuth as jest.Mock;

type FetchMock = jest.Mock<Promise<Partial<Response>>, [RequestInfo | URL, RequestInit?]>;

function setFetch(handler: (url: string, init?: RequestInit) => Promise<Partial<Response>>) {
  const mock = jest.fn((url: RequestInfo | URL, init?: RequestInit) => {
    return handler(typeof url === "string" ? url : url.toString(), init);
  }) as unknown as FetchMock;
  global.fetch = mock as unknown as typeof fetch;
  return mock;
}

function defaultGetResponse(application: unknown = null): Partial<Response> {
  return {
    ok: true,
    status: 200,
    json: async () => ({ application }),
  };
}

function setAuth({
  user,
  loading = false,
}: { user?: ReturnType<typeof makeAuthUser> | null; loading?: boolean } = {}) {
  mockUseAuth.mockReturnValue({
    user: user ?? null,
    userProfile: null,
    loading,
    signInWithGoogle: jest.fn(),
    signInWithGithub: jest.fn(),
    signOut: jest.fn(),
    refreshProfile: jest.fn(),
  });
}

function makePartnerApp(overrides: Record<string, unknown> = {}) {
  return {
    userId: "u1",
    email: "u1@test.com",
    contactName: "Old Name",
    phone: "555-0000",
    companyName: "Acme AI",
    companyWebsite: "https://acme.example",
    contactRole: "Founder",
    rolesHiring: "Frontend, AI",
    notes: "We hire fast",
    engineerExpectations: { csFundamentals: 5 },
    engineerRequirements: "React + TS",
    status: "pending",
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  };
}

describe("partners page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows the loading gate while auth is still loading", () => {
    setAuth({ loading: true });
    render(<PartnersPage />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it("shows the signed-out gate with a sign-in link when no user is present", () => {
    setAuth({ user: null });
    render(<PartnersPage />);
    expect(screen.getByText(/Sign in to get started/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Sign in/i }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toContain("/login?redirect=");
  });

  it("renders the empty form when signed in with no existing application (Get started)", async () => {
    setAuth({ user: makeAuthUser("u1") });
    setFetch(async () => defaultGetResponse(null));
    render(<PartnersPage />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Get started/i })).toBeInTheDocument();
    });
    // Name pre-filled from displayName
    const nameInput = screen.getByLabelText(/Your name/i) as HTMLInputElement;
    expect(nameInput.value).toBe("Test User");
    // Email is the user's email and read-only
    const emailInput = screen.getByLabelText(/^Email$/i) as HTMLInputElement;
    expect(emailInput.value).toBe("u1@test.com");
    expect(emailInput.readOnly).toBe(true);
    // Submit button reads "Submit application" when no application exists yet
    expect(
      screen.getByRole("button", { name: /Submit application/i }),
    ).toBeInTheDocument();
  });

  it("renders approved StatusPanel + approved CalendlyCard text when application is approved", async () => {
    setAuth({ user: makeAuthUser("u1") });
    setFetch(async () => defaultGetResponse(makePartnerApp({ status: "approved" })));
    render(<PartnersPage />);

    await waitFor(() => {
      expect(screen.getByText(/Status: Approved/i)).toBeInTheDocument();
    });
    expect(
      screen.getByText(/approved Cursor Boston hiring partner/i),
    ).toBeInTheDocument();
    // CalendlyCard approved heading + body (may appear in StatusPanel body
    // copy too — just assert at least one occurrence)
    expect(screen.getAllByText(/Set up a call whenever/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Roger is your point of contact/i)).toBeInTheDocument();
    // "Your company profile" appears when an application is loaded
    expect(
      screen.getByRole("heading", { name: /Your company profile/i }),
    ).toBeInTheDocument();
    // Pre-filled fields from the existing application
    expect(screen.getByDisplayValue(/Acme AI/)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/^555-0000$/)).toBeInTheDocument();
    // Submit button reads "Save" in update mode
    expect(screen.getByRole("button", { name: /^Save$/i })).toBeInTheDocument();
  });

  it("renders rejected StatusPanel and pending-flavored CalendlyCard when status=rejected", async () => {
    setAuth({ user: makeAuthUser("u1") });
    setFetch(async () => defaultGetResponse(makePartnerApp({ status: "rejected" })));
    render(<PartnersPage />);

    await waitFor(() => {
      expect(screen.getByText(/Status: Not approved/i)).toBeInTheDocument();
    });
    // Rejected status uses the non-approved CalendlyCard headline
    expect(screen.getByText(/Book your intro call/i)).toBeInTheDocument();
  });

  it("renders pending StatusPanel for the default pending status", async () => {
    setAuth({ user: makeAuthUser("u1") });
    setFetch(async () => defaultGetResponse(makePartnerApp({ status: "pending" })));
    render(<PartnersPage />);

    await waitFor(() => {
      expect(screen.getByText(/Status: Pending/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/We got your application/i)).toBeInTheDocument();
  });

  it("shows the GET-failure error panel when the application load returns !ok", async () => {
    setAuth({ user: makeAuthUser("u1") });
    setFetch(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    render(<PartnersPage />);
    await waitFor(() => {
      expect(screen.getByText(/Couldn't load your application/i)).toBeInTheDocument();
    });
  });

  it("shows the GET-failure error panel when fetch itself rejects", async () => {
    setAuth({ user: makeAuthUser("u1") });
    global.fetch = jest.fn().mockRejectedValue(new Error("network")) as typeof fetch;
    render(<PartnersPage />);
    await waitFor(() => {
      expect(screen.getByText(/Couldn't load your application/i)).toBeInTheDocument();
    });
  });

  it("blocks submit when contactName is empty and surfaces 'Please enter your name'", async () => {
    setAuth({ user: makeAuthUser("u1") });
    const fetchMock = setFetch(async () => defaultGetResponse(null));
    render(<PartnersPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/Your name/i)).toBeInTheDocument();
    });

    // Clear the prefilled name then submit
    fireEvent.change(screen.getByLabelText(/Your name/i), { target: { value: "   " } });
    const form = screen
      .getByRole("button", { name: /Submit application/i })
      .closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(screen.getByText(/Please enter your name/i)).toBeInTheDocument();
    // Should not have triggered the POST (GET only)
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("blocks submit when phone is empty and surfaces 'Please enter a phone number'", async () => {
    setAuth({ user: makeAuthUser("u1") });
    setFetch(async () => defaultGetResponse(null));
    render(<PartnersPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/Your name/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Your name/i), { target: { value: "Alice" } });
    // Leave phone empty
    const form = screen
      .getByRole("button", { name: /Submit application/i })
      .closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(screen.getByText(/Please enter a phone number/i)).toBeInTheDocument();
  });

  it("submits successfully when no prior application exists and shows the create-success message", async () => {
    setAuth({ user: makeAuthUser("u1") });
    const fetchMock = setFetch(async (_url, init) => {
      if (init?.method === "POST") {
        return {
          ok: true,
          status: 200,
          json: async () => ({ application: makePartnerApp({ status: "pending" }) }),
        };
      }
      return defaultGetResponse(null);
    });
    render(<PartnersPage />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Your name/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Your name/i), { target: { value: "Alice" } });
    fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: "555-1212" } });
    // Click a Likert radio to exercise the radio onChange branch
    const radios = screen.getAllByRole("radio");
    fireEvent.click(radios[0]);

    const form = screen
      .getByRole("button", { name: /Submit application/i })
      .closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(
        screen.getByText(/Application received — see next steps below/i),
      ).toBeInTheDocument();
    });
    // POST was the second call
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("submits an update when an application already exists and shows 'Saved.'", async () => {
    setAuth({ user: makeAuthUser("u1") });
    setFetch(async (_url, init) => {
      if (init?.method === "POST") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            application: makePartnerApp({ status: "approved", contactName: "Alice" }),
          }),
        };
      }
      return defaultGetResponse(makePartnerApp({ status: "approved" }));
    });
    render(<PartnersPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Save$/i })).toBeInTheDocument();
    });

    const form = screen.getByRole("button", { name: /^Save$/i }).closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(screen.getByText(/^Saved\.$/)).toBeInTheDocument();
    });
  });

  it("renders submit error from API string error field", async () => {
    setAuth({ user: makeAuthUser("u1") });
    setFetch(async (_url, init) => {
      if (init?.method === "POST") {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: "rate_limited" }),
        };
      }
      return defaultGetResponse(null);
    });
    render(<PartnersPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/Your name/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Your name/i), { target: { value: "Alice" } });
    fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: "555-1212" } });
    const form = screen
      .getByRole("button", { name: /Submit application/i })
      .closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(screen.getByText(/rate_limited/)).toBeInTheDocument();
    });
  });

  it("falls back to 'Submit failed.' when API error field is not a string", async () => {
    setAuth({ user: makeAuthUser("u1") });
    setFetch(async (_url, init) => {
      if (init?.method === "POST") {
        return {
          ok: false,
          status: 400,
          json: async () => ({ error: { code: 42 } }),
        };
      }
      return defaultGetResponse(null);
    });
    render(<PartnersPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/Your name/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Your name/i), { target: { value: "Alice" } });
    fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: "555-1212" } });
    const form = screen
      .getByRole("button", { name: /Submit application/i })
      .closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(screen.getByText(/^Submit failed\.$/)).toBeInTheDocument();
    });
  });

  it("renders 'Network error.' when fetch rejects during submit", async () => {
    setAuth({ user: makeAuthUser("u1") });
    let callCount = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ application: null }),
        });
      }
      return Promise.reject(new Error("boom"));
    }) as typeof fetch;
    render(<PartnersPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/Your name/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Your name/i), { target: { value: "Alice" } });
    fireEvent.change(screen.getByLabelText(/Phone/i), { target: { value: "555-1212" } });
    const form = screen
      .getByRole("button", { name: /Submit application/i })
      .closest("form")!;
    await act(async () => {
      fireEvent.submit(form);
    });

    await waitFor(() => {
      expect(screen.getByText(/Network error\./i)).toBeInTheDocument();
    });
  });

  it("exercises every optional input onChange handler (company info + engineer requirements)", async () => {
    setAuth({ user: makeAuthUser("u1") });
    setFetch(async () => defaultGetResponse(null));
    render(<PartnersPage />);
    await waitFor(() => {
      expect(screen.getByLabelText(/Your name/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Company name/i), {
      target: { value: "Acme AI" },
    });
    fireEvent.change(screen.getByLabelText(/Company website/i), {
      target: { value: "https://acme.example" },
    });
    fireEvent.change(screen.getByLabelText(/Your role \/ title/i), {
      target: { value: "Founder" },
    });
    fireEvent.change(screen.getByLabelText(/What roles are you hiring for/i), {
      target: { value: "Frontend" },
    });
    fireEvent.change(screen.getByLabelText(/Anything else/i), {
      target: { value: "Sponsorship interest" },
    });
    fireEvent.change(screen.getByLabelText(/Specific hiring requirements/i), {
      target: { value: "React + TS" },
    });

    expect(
      (screen.getByLabelText(/Company name/i) as HTMLInputElement).value,
    ).toBe("Acme AI");
    expect(
      (screen.getByLabelText(/Specific hiring requirements/i) as HTMLTextAreaElement)
        .value,
    ).toBe("React + TS");
  });

  it("falls back to displayName-empty branch and missing companyName when application fields are null", async () => {
    setAuth({ user: makeAuthUser("u1") });
    setFetch(async () =>
      defaultGetResponse({
        userId: "u1",
        email: null,
        contactName: null,
        phone: null,
        companyName: null,
        companyWebsite: null,
        contactRole: null,
        rolesHiring: null,
        notes: null,
        engineerExpectations: null,
        engineerRequirements: null,
        status: "pending",
        createdAt: null,
        updatedAt: null,
      }),
    );
    render(<PartnersPage />);

    await waitFor(() => {
      expect(screen.getByText(/Status: Pending/i)).toBeInTheDocument();
    });
    // contactName fallback uses user.displayName ("Test User")
    const nameInput = screen.getByLabelText(/Your name/i) as HTMLInputElement;
    expect(nameInput.value).toBe("Test User");
  });
});
