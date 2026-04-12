/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a {...props}>{children}</a>,
}));

const mockPathname = jest.fn(() => "/");
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => mockPathname(),
}));

jest.mock("@/lib/firebase", () => ({ db: null, auth: null }));
jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));
jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  onSnapshot: jest.fn(),
}));

const mockUseAuth = jest.fn(() => ({ user: null, loading: false }));
jest.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("@/components/Avatar", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => (
    <div data-testid="avatar" data-name={props.name} />
  ),
}));

jest.mock("@/components/Footer", () => ({
  __esModule: true,
  default: () => <footer data-testid="footer" />,
}));

jest.mock("@/components/ThemeToggle", () => ({
  ThemeToggle: () => <button data-testid="theme-toggle" />,
}));

import AppShell from "@/components/AppShell";

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  mockPathname.mockReturnValue("/");
  mockUseAuth.mockReturnValue({ user: null, loading: false });
  Storage.prototype.getItem = jest.fn(() => null);
  Storage.prototype.setItem = jest.fn();
});

describe("AppShell", () => {
  it("renders without crashing", () => {
    render(<AppShell>Hello</AppShell>);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders the site navigation sidebar", () => {
    render(<AppShell>Content</AppShell>);
    expect(screen.getByLabelText("Site navigation")).toBeInTheDocument();
  });

  it("renders all nav group headers when sidebar is expanded", () => {
    render(<AppShell>Content</AppShell>);
    expect(screen.getByText("Community")).toBeInTheDocument();
    expect(screen.getByText("Participate")).toBeInTheDocument();
    expect(screen.getByText("Resources")).toBeInTheDocument();
  });

  it("renders expected navigation links", () => {
    render(<AppShell>Content</AppShell>);
    expect(screen.getByText("Events")).toBeInTheDocument();
    expect(screen.getByText("Talks")).toBeInTheDocument();
    expect(screen.getByText("Members")).toBeInTheDocument();
    expect(screen.getByText("Hackathons")).toBeInTheDocument();
    expect(screen.getByText("Showcase")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.getByText("About")).toBeInTheDocument();
  });

  it("renders the Cursor Boston home link", () => {
    render(<AppShell>Content</AppShell>);
    const homeLinks = screen.getAllByTitle("Cursor Boston home");
    expect(homeLinks.length).toBeGreaterThan(0);
  });

  it("renders Sign In and Get Started when user is null", () => {
    render(<AppShell>Content</AppShell>);
    expect(screen.getByText("Sign In")).toBeInTheDocument();
    expect(screen.getByText("Get Started")).toBeInTheDocument();
  });

  it("renders avatar when user is authenticated", () => {
    mockUseAuth.mockReturnValue({
      user: {
        photoURL: "https://example.com/photo.jpg",
        displayName: "Test User",
        email: "test@example.com",
      },
      loading: false,
    });

    render(<AppShell>Content</AppShell>);
    expect(screen.getByTestId("avatar")).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("shows loading skeleton when auth is loading", () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true });
    render(<AppShell>Content</AppShell>);
    // Loading state shows a pulsing div, no Sign In or avatar
    expect(screen.queryByText("Sign In")).not.toBeInTheDocument();
    expect(screen.queryByTestId("avatar")).not.toBeInTheDocument();
  });

  it("renders the mobile header with open menu button", () => {
    render(<AppShell>Content</AppShell>);
    expect(screen.getByLabelText("Open menu")).toBeInTheDocument();
  });

  it("renders the footer", () => {
    render(<AppShell>Content</AppShell>);
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("renders the theme toggle", () => {
    render(<AppShell>Content</AppShell>);
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
  });

  it("renders children inside main content area", () => {
    render(
      <AppShell>
        <div data-testid="child">Child content</div>
      </AppShell>
    );
    const main = screen.getByRole("main");
    expect(main).toContainElement(screen.getByTestId("child"));
  });

  it("renders the collapse sidebar button", () => {
    render(<AppShell>Content</AppShell>);
    expect(screen.getByLabelText("Collapse navigation")).toBeInTheDocument();
  });

  it("toggles nav group sections on click", async () => {
    const user = userEvent.setup();
    render(<AppShell>Content</AppShell>);

    // Community section should be open by default (multi-item group)
    expect(screen.getByText("Events")).toBeInTheDocument();

    // Click the Community group header to collapse it
    const communityBtn = screen.getByText("Community");
    await user.click(communityBtn);

    // Events should no longer be visible
    expect(screen.queryByText("Events")).not.toBeInTheDocument();

    // Click again to expand
    await user.click(communityBtn);
    expect(screen.getByText("Events")).toBeInTheDocument();
  });

  it("highlights the active nav link based on pathname", () => {
    mockPathname.mockReturnValue("/events");
    render(<AppShell>Content</AppShell>);

    const eventsLink = screen.getByText("Events").closest("a");
    expect(eventsLink?.className).toContain("emerald");
  });

  it("reads collapsed state from localStorage", () => {
    Storage.prototype.getItem = jest.fn(() => "1");
    render(<AppShell>Content</AppShell>);

    // When collapsed, the "Cursor Boston" text should not be visible
    // and the expand navigation button should exist
    expect(screen.getByLabelText("Expand navigation")).toBeInTheDocument();
  });
});
