/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import * as React from "react";
import { render, type RenderOptions } from "@testing-library/react";

/**
 * Render helpers for React component tests.
 *
 * The `useAuth()` mock is registered per-test via jest.mock() — see
 * __tests__/components/AppShell.test.tsx for the canonical pattern.
 *
 * This helper provides the *wrapper* shape so multiple tests don't have
 * to re-stub the same provider tree. Use it like:
 *
 * ```ts
 * jest.mock("@/contexts/AuthContext", () => ({
 *   useAuth: () => mockUseAuth(),
 * }));
 * const mockUseAuth = jest.fn();
 *
 * render(<MyComponent />, { wrapper: AllProviders });
 * ```
 */

export interface MockUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

/**
 * Pre-built useAuth() return shapes for common scenarios.
 */
export const authStates = {
  loading: () => ({ user: null, loading: true }),
  signedOut: () => ({ user: null, loading: false }),
  signedIn: (overrides: Partial<MockUser> = {}) => ({
    user: {
      uid: "u1",
      email: "u1@example.com",
      displayName: "Test User",
      photoURL: null,
      ...overrides,
    },
    loading: false,
  }),
};

/**
 * Optional all-providers wrapper. Re-export RTL so tests have one import
 * surface.
 */
export function AllProviders({ children }: { children: React.ReactNode }) {
  return React.createElement(React.Fragment, null, children);
}

/** Convenience render that uses AllProviders. */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper">,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

/**
 * Build a deterministic Firestore-User-like object for use in
 * `mockUseAuth.mockReturnValue({ user: makeMockUser(), loading: false })`.
 */
export function makeMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    uid: "u-test",
    email: "test@example.com",
    displayName: "Test User",
    photoURL: null,
    ...overrides,
  };
}

/**
 * Re-export common RTL primitives so consumers only need one import.
 */
export { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
