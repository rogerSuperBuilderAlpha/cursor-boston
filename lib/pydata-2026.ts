/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Constants + types for the May 13 Cursor Boston × PyData event at Moderna.
 *
 * Captures the four columns Moderna needs in their CSV (full name, email,
 * phone, company). Name parts must each be ≥2 chars because government-ID
 * matching is enforced at the door — single-letter "F. Lastname" fails.
 * Status starts "awaiting-badge" until an organizer flips it.
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
  phone: 40,
  organization: 200,
  nameMin: 2,
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
  phone: string;
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
  phone: string;
  organization: string;
  attendingConfirmed: true;
}

export type PydataValidationError =
  | "firstName-required"
  | "firstName-too-short"
  | "lastName-required"
  | "lastName-too-short"
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
  const phone = clamp(r.phone, PYDATA_2026_LIMITS.phone);
  const organization = clamp(r.organization, PYDATA_2026_LIMITS.organization);
  const attendingConfirmed = r.attendingConfirmed === true;

  if (!firstName) errors.push("firstName-required");
  else if (firstName.length < PYDATA_2026_LIMITS.nameMin)
    errors.push("firstName-too-short");
  if (!lastName) errors.push("lastName-required");
  else if (lastName.length < PYDATA_2026_LIMITS.nameMin)
    errors.push("lastName-too-short");
  if (!email) errors.push("email-required");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("email-invalid");
  if (!organization) errors.push("organization-required");
  if (!attendingConfirmed) errors.push("must-confirm-attendance");

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: {
      firstName,
      lastName,
      email,
      phone,
      organization,
      attendingConfirmed: true,
    },
  };
}
