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
  engineerRequirements: 4000,
} as const;

/**
 * Likert items for the "what does a $150k/year engineer look like to you?"
 * survey. Captured per-partner so we can compare what each partner weights
 * when matching cohort builders to roles.
 *
 * Scale: 1 = nice to have, 7 = critical. Stored as a `Record<key, number>`
 * on the partner application; missing keys mean the partner skipped.
 */
export const PARTNER_ENGINEER_EXPECTATION_ITEMS = [
  {
    key: "yearsExperience",
    label: "Years of professional engineering experience",
  },
  {
    key: "csFundamentals",
    label: "CS fundamentals (algorithms, data structures, systems)",
  },
  {
    key: "systemDesign",
    label: "System design / architecture chops",
  },
  {
    key: "aiToolFluency",
    label: "AI-assisted coding fluency (Cursor, Claude Code, Copilot)",
  },
  {
    key: "shipsEndToEnd",
    label: "Ships features end-to-end with minimal supervision",
  },
  {
    key: "productionDebugging",
    label: "Production debugging + on-call ability",
  },
  {
    key: "communication",
    label: "Communication with non-engineers (PMs, founders, customers)",
  },
  {
    key: "domainExpertise",
    label: "Domain expertise in your stack or industry",
  },
  {
    key: "mentorship",
    label: "Mentoring or technical leadership",
  },
  {
    key: "businessImpact",
    label: "Track record of measurable business impact",
  },
] as const;

export type PartnerEngineerExpectationKey =
  (typeof PARTNER_ENGINEER_EXPECTATION_ITEMS)[number]["key"];

/**
 * Coerce a raw expectations payload into a `{ key: 1..7 }` map. Drops
 * unknown keys, non-integer values, and out-of-range numbers. Safe to call
 * on `unknown` from a request body.
 */
export function sanitizeEngineerExpectations(
  raw: unknown
): Record<PartnerEngineerExpectationKey, number> {
  const out = {} as Record<PartnerEngineerExpectationKey, number>;
  if (!raw || typeof raw !== "object") return out;
  const obj = raw as Record<string, unknown>;
  const validKeys = new Set<string>(
    PARTNER_ENGINEER_EXPECTATION_ITEMS.map((i) => i.key)
  );
  for (const [k, v] of Object.entries(obj)) {
    if (!validKeys.has(k)) continue;
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const n = Math.round(v);
    if (n < 1 || n > 7) continue;
    out[k as PartnerEngineerExpectationKey] = n;
  }
  return out;
}
