/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Constants + types for the May 13 Cursor Boston × PyData event at Moderna.
 *
 * The website registration captures the basics Moderna needs (first/last
 * name, email, organization) so we can hand the list to the host for
 * Envoy NDA + badge issuance. Status starts at "awaiting-badge" until
 * an organizer flips it to "badge-ready" or "checked-in" on the day-of.
 */

export const PYDATA_2026_EVENT_ID = "cursor-boston-pydata-2026";
export const PYDATA_2026_EVENT_SLUG = "cursor-boston-pydata-2026";
export const PYDATA_2026_LUMA_URL = "https://luma.com/ggjlxdnk";
export const PYDATA_2026_REGISTRATION_PATH = `/events/${PYDATA_2026_EVENT_SLUG}/register`;

export const PYDATA_2026_REGISTRATIONS_COLLECTION = "pydataHack2026Registrations";

export const PYDATA_2026_LIMITS = {
  firstName: 80,
  lastName: 80,
  email: 320,
  organization: 200,
} as const;

export type PydataRegistrationStatus =
  | "awaiting-badge"
  | "badge-ready"
  | "checked-in"
  | "cancelled";

export interface PydataRegistration {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  organization: string;
  attendingConfirmed: true;
  status: PydataRegistrationStatus;
  createdAt: number;
  updatedAt: number;
}

export interface PydataRegistrationInput {
  firstName: string;
  lastName: string;
  email: string;
  organization: string;
  attendingConfirmed: true;
}

export type PydataValidationError =
  | "firstName-required"
  | "lastName-required"
  | "email-required"
  | "email-invalid"
  | "organization-required"
  | "must-confirm-attendance";

function clamp(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max);
}

export function validatePydataRegistration(
  raw: unknown
):
  | { ok: true; data: PydataRegistrationInput }
  | { ok: false; errors: PydataValidationError[] } {
  const errors: PydataValidationError[] = [];
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const firstName = clamp(r.firstName, PYDATA_2026_LIMITS.firstName);
  const lastName = clamp(r.lastName, PYDATA_2026_LIMITS.lastName);
  const email = clamp(r.email, PYDATA_2026_LIMITS.email).toLowerCase();
  const organization = clamp(r.organization, PYDATA_2026_LIMITS.organization);
  const attendingConfirmed = r.attendingConfirmed === true;

  if (!firstName) errors.push("firstName-required");
  if (!lastName) errors.push("lastName-required");
  if (!email) errors.push("email-required");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("email-invalid");
  if (!organization) errors.push("organization-required");
  if (!attendingConfirmed) errors.push("must-confirm-attendance");

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: { firstName, lastName, email, organization, attendingConfirmed: true },
  };
}
