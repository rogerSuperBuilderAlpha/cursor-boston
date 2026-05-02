/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export const HIRING_PARTNERS_COLLECTION = "hiringPartnerApplications";
export const HIRING_PARTNERS_NOTIFY_EMAIL = "rogerhunt02052@gmail.com";
export const HIRING_PARTNERS_CALENDLY_URL = "https://calendly.com/rogerhunt";
export const HIRING_PARTNERS_RETURN_TO = "/partners";

export type HiringPartnerStatus = "pending" | "approved" | "rejected";

export const HIRING_PARTNERS_MAX = {
  contactName: 200,
  phone: 50,
  companyName: 200,
  companyWebsite: 500,
  contactRole: 200,
  rolesHiring: 2000,
  notes: 4000,
} as const;
