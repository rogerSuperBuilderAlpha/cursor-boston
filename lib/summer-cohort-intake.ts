/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Summer Cohort intake survey (c1-v1).
 *
 * **NOT a research instrument.** Cursor Boston's research IRB is still
 * pending; this form is collected for operational use only — the team uses
 * the responses to build tools that help cohort participants ship faster
 * (track progress, surface stuck points, route help, etc.).
 *
 * Once the IRB is approved we'll send a separate, fully-optional research
 * survey. This form is not that.
 *
 * `consentToResearch` remains in the schema for forward compatibility but
 * is NOT required at submit time on this wave; operational submissions
 * persist it as false.
 *
 * Target completion time: ~5 minutes.
 */

export const SUMMER_COHORT_INTAKE_COLLECTION = "summerCohortIntakeSurveys";
/** Bumped to v2 with the per-cohort split: docs now keyed by
 *  `{uid}_{cohortId}` and carry `participatedInCohort1` for c2 docs. */
export const SUMMER_COHORT_INTAKE_VERSION = "v2";

/** Firestore doc id for the (user, cohort) intake survey. Cohort 1 surveys
 *  written before v2 were keyed by uid only — see the GET route's fallback
 *  lookup for back-compat. */
export function intakeSurveyDocId(uid: string, cohortId: string): string {
  return `${uid}_${cohortId}`;
}

// ---------------------------------------------------------------------------
// Enums (string literal unions)
// ---------------------------------------------------------------------------

export const GENDER_OPTIONS = [
  "woman",
  "man",
  "non-binary",
  "prefer-self-describe",
  "prefer-not-to-say",
] as const;
export type GenderOption = (typeof GENDER_OPTIONS)[number];

export const ENGLISH_PROFICIENCY_OPTIONS = [
  "beginner",
  "intermediate",
  "advanced",
  "native",
] as const;
export type EnglishProficiency = (typeof ENGLISH_PROFICIENCY_OPTIONS)[number];

export const HIGHEST_DEGREE_OPTIONS = [
  "none",
  "high-school",
  "associate",
  "bachelors",
  "masters",
  "doctorate",
  "other",
] as const;
export type HighestDegree = (typeof HIGHEST_DEGREE_OPTIONS)[number];

export const EMPLOYMENT_OPTIONS = ["yes", "no", "part-time"] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_OPTIONS)[number];

export const YEARS_PROGRAMMING_OPTIONS = [
  "none",
  "less-than-1",
  "1-3",
  "3-5",
  "5-10",
  "more-than-10",
] as const;
export type YearsProgramming = (typeof YEARS_PROGRAMMING_OPTIONS)[number];

export const CS_CREDENTIAL_OPTIONS = [
  "none",
  "self-taught",
  "bootcamp",
  "undergraduate",
  "graduate",
  "industry-cert",
] as const;
export type CsCredential = (typeof CS_CREDENTIAL_OPTIONS)[number];

export const LLM_FREQUENCY_OPTIONS = [
  "never",
  "monthly",
  "weekly",
  "several-times-week",
  "daily",
  "multi-hours-day",
] as const;
export type LlmFrequency = (typeof LLM_FREQUENCY_OPTIONS)[number];

export const CURSOR_EXPERIENCE_OPTIONS = [
  "never",
  "tried",
  "regular",
  "daily",
] as const;
export type CursorExperience = (typeof CURSOR_EXPERIENCE_OPTIONS)[number];

// Suggested options for multi-select fields. Form also includes "other" free text.
export const PROGRAMMING_LANGUAGE_OPTIONS = [
  "Python",
  "JavaScript",
  "TypeScript",
  "Java",
  "C/C++",
  "C#",
  "Go",
  "Rust",
  "Ruby",
  "PHP",
  "Swift",
  "Kotlin",
  "SQL",
  "R",
  "MATLAB",
  "Shell/Bash",
] as const;

export const AI_TOOL_OPTIONS = [
  "ChatGPT",
  "Claude",
  "Gemini",
  "Copilot",
  "Claude Code",
  "Cursor",
] as const;

export const SOCIAL_PLATFORM_OPTIONS = [
  "Instagram",
  "TikTok",
  "YouTube",
  "X",
  "Reddit",
  "LinkedIn",
] as const;

// ---------------------------------------------------------------------------
// Field length / range limits — server-side validation enforces these
// ---------------------------------------------------------------------------

export const INTAKE_LIMITS = {
  email: 320,
  shortText: 200,
  longText: 2000,
  maxAge: 120,
  minAge: 13,
  maxYearsExperience: 80,
  minFirstAiYear: 1990,
  maxFirstAiYear: 2030,
  maxHoursPerWeek: 168,
} as const;

// ---------------------------------------------------------------------------
// Wire shape — what the client POSTs and what we persist (sans timestamps)
// ---------------------------------------------------------------------------

export type IntakeSurveyResponse = {
  // Section 1: Linkage and consent
  email: string;
  cohort: string;
  consentToResearch: boolean;
  /** Only meaningful on cohort-2 surveys. The server fills this from the
   *  application record (was the user admitted to cohort-1?) and ignores any
   *  client-supplied value — the form renders it pre-selected + disabled so
   *  the participant can see the linkage. Null on cohort-1 surveys. */
  participatedInCohort1: boolean | null;

  // Section 2: Demographics
  age: number | null;
  gender: GenderOption | null;
  genderSelfDescribed: string | null;
  countryOfResidence: string;
  countryOfBirth: string;
  nativeLanguages: string;
  englishProficiency: EnglishProficiency | null;
  highestDegree: HighestDegree | null;
  highestDegreeOther: string | null;
  degreeField: string;
  employmentStatus: EmploymentStatus | null;

  // Section 3: Programming background
  yearsProgramming: YearsProgramming | null;
  programmingLanguages: string[];
  programmingLanguagesOther: string | null;
  priorEngineerEmployment: boolean | null;
  priorEngineerYears: number | null;
  csCredential: CsCredential | null;

  // Section 4: AI tool exposure
  firstAiYear: number | null;
  llmFrequency: LlmFrequency | null;
  aiToolsUsed: string[];
  aiToolsOther: string | null;
  cursorExperience: CursorExperience | null;
  shippedWithAi: boolean | null;
  shippedWithAiDescription: string | null;
  hoursPerWeekAi: number | null;

  // Section 5: Algorithmic platform exposure
  hoursPerWeekSocial: number | null;
  postedAsCreator: boolean | null;
  postedAsCreatorWhich: string | null;
  gigPlatformWork: boolean | null;
  gigPlatformDetails: string | null;
  algorithmUnderstanding: number | null; // 1–7

  // Section 6: Self-rated baseline (single items, NOT a scale)
  baselineEffective: number | null; // 1–7
  baselineUnderstanding: number | null; // 1–7

  // Section 7: Program intent
  whyJoined: string;
  eightWeekGoal: string;
};

export type IntakeSurveyDoc = IntakeSurveyResponse & {
  uid: string;
  surveyVersion: string;
  submittedAt: number; // ms
  lastUpdatedAt: number; // ms
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isStr(v: unknown): v is string {
  return typeof v === "string";
}

function clampStr(v: unknown, max: number): string {
  if (!isStr(v)) return "";
  return v.trim().slice(0, max);
}

function intOrNull(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  if (n < min || n > max) return null;
  return n;
}

function likertOrNull(v: unknown): number | null {
  return intOrNull(v, 1, 7);
}

function inEnum<T extends string>(
  v: unknown,
  options: readonly T[]
): T | null {
  if (!isStr(v)) return null;
  return (options as readonly string[]).includes(v) ? (v as T) : null;
}

function boolOrNull(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function strArrayClamped(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(isStr)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, maxItems)
    .map((s) => s.slice(0, maxLen));
}

/**
 * Coerce + validate a wire payload into an IntakeSurveyResponse. Returns
 * { ok: true, data } on success, or { ok: false, errors } with a list of
 * required-field violations so the client can highlight them.
 */
export function validateIntakeSurvey(
  raw: unknown
): { ok: true; data: IntakeSurveyResponse } | { ok: false; errors: string[] } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, errors: ["Invalid payload"] };
  }
  const r = raw as Record<string, unknown>;

  const data: IntakeSurveyResponse = {
    email: clampStr(r.email, INTAKE_LIMITS.email).toLowerCase(),
    cohort: clampStr(r.cohort, 64),
    consentToResearch: r.consentToResearch === true,
    // Server fills this from the application lookup; the validator just
    // coerces what came in. POST handler overwrites with the authoritative
    // value derived from `summerCohortApplications`.
    participatedInCohort1: boolOrNull(r.participatedInCohort1),

    age: intOrNull(r.age, INTAKE_LIMITS.minAge, INTAKE_LIMITS.maxAge),
    gender: inEnum(r.gender, GENDER_OPTIONS),
    genderSelfDescribed: r.gender === "prefer-self-describe"
      ? clampStr(r.genderSelfDescribed, INTAKE_LIMITS.shortText) || null
      : null,
    countryOfResidence: clampStr(r.countryOfResidence, INTAKE_LIMITS.shortText),
    countryOfBirth: clampStr(r.countryOfBirth, INTAKE_LIMITS.shortText),
    nativeLanguages: clampStr(r.nativeLanguages, INTAKE_LIMITS.shortText),
    englishProficiency: inEnum(r.englishProficiency, ENGLISH_PROFICIENCY_OPTIONS),
    highestDegree: inEnum(r.highestDegree, HIGHEST_DEGREE_OPTIONS),
    highestDegreeOther: r.highestDegree === "other"
      ? clampStr(r.highestDegreeOther, INTAKE_LIMITS.shortText) || null
      : null,
    degreeField: clampStr(r.degreeField, INTAKE_LIMITS.shortText),
    employmentStatus: inEnum(r.employmentStatus, EMPLOYMENT_OPTIONS),

    yearsProgramming: inEnum(r.yearsProgramming, YEARS_PROGRAMMING_OPTIONS),
    programmingLanguages: strArrayClamped(r.programmingLanguages, 30, 64),
    programmingLanguagesOther: clampStr(r.programmingLanguagesOther, INTAKE_LIMITS.shortText) || null,
    priorEngineerEmployment: boolOrNull(r.priorEngineerEmployment),
    priorEngineerYears: r.priorEngineerEmployment === true
      ? intOrNull(r.priorEngineerYears, 0, INTAKE_LIMITS.maxYearsExperience)
      : null,
    csCredential: inEnum(r.csCredential, CS_CREDENTIAL_OPTIONS),

    firstAiYear: intOrNull(r.firstAiYear, INTAKE_LIMITS.minFirstAiYear, INTAKE_LIMITS.maxFirstAiYear),
    llmFrequency: inEnum(r.llmFrequency, LLM_FREQUENCY_OPTIONS),
    aiToolsUsed: strArrayClamped(r.aiToolsUsed, 30, 64),
    aiToolsOther: clampStr(r.aiToolsOther, INTAKE_LIMITS.shortText) || null,
    cursorExperience: inEnum(r.cursorExperience, CURSOR_EXPERIENCE_OPTIONS),
    shippedWithAi: boolOrNull(r.shippedWithAi),
    shippedWithAiDescription: r.shippedWithAi === true
      ? clampStr(r.shippedWithAiDescription, INTAKE_LIMITS.longText) || null
      : null,
    hoursPerWeekAi: intOrNull(r.hoursPerWeekAi, 0, INTAKE_LIMITS.maxHoursPerWeek),

    hoursPerWeekSocial: intOrNull(r.hoursPerWeekSocial, 0, INTAKE_LIMITS.maxHoursPerWeek),
    postedAsCreator: boolOrNull(r.postedAsCreator),
    postedAsCreatorWhich: r.postedAsCreator === true
      ? clampStr(r.postedAsCreatorWhich, INTAKE_LIMITS.shortText) || null
      : null,
    gigPlatformWork: boolOrNull(r.gigPlatformWork),
    gigPlatformDetails: r.gigPlatformWork === true
      ? clampStr(r.gigPlatformDetails, INTAKE_LIMITS.longText) || null
      : null,
    algorithmUnderstanding: likertOrNull(r.algorithmUnderstanding),

    baselineEffective: likertOrNull(r.baselineEffective),
    baselineUnderstanding: likertOrNull(r.baselineUnderstanding),

    whyJoined: clampStr(r.whyJoined, INTAKE_LIMITS.longText),
    eightWeekGoal: clampStr(r.eightWeekGoal, INTAKE_LIMITS.longText),
  };

  // Required-field check. The instrument is short; everything except the
  // conditional follow-ups is required so the dataset is analyzable.
  const errors: string[] = [];
  if (!data.email) errors.push("email");
  if (!data.cohort) errors.push("cohort");
  // consentToResearch is intentionally NOT required on this wave — the form
  // is operational, not research. See file header.
  if (data.age == null) errors.push("age");
  if (!data.gender) errors.push("gender");
  if (data.gender === "prefer-self-describe" && !data.genderSelfDescribed) {
    errors.push("genderSelfDescribed");
  }
  if (!data.countryOfResidence) errors.push("countryOfResidence");
  if (!data.countryOfBirth) errors.push("countryOfBirth");
  if (!data.nativeLanguages) errors.push("nativeLanguages");
  if (!data.englishProficiency) errors.push("englishProficiency");
  if (!data.highestDegree) errors.push("highestDegree");
  if (data.highestDegree === "other" && !data.highestDegreeOther) {
    errors.push("highestDegreeOther");
  }
  if (!data.degreeField) errors.push("degreeField");
  if (!data.employmentStatus) errors.push("employmentStatus");
  if (!data.yearsProgramming) errors.push("yearsProgramming");
  if (data.priorEngineerEmployment === null) errors.push("priorEngineerEmployment");
  if (data.priorEngineerEmployment === true && data.priorEngineerYears === null) {
    errors.push("priorEngineerYears");
  }
  if (!data.csCredential) errors.push("csCredential");
  if (data.firstAiYear == null) errors.push("firstAiYear");
  if (!data.llmFrequency) errors.push("llmFrequency");
  if (!data.cursorExperience) errors.push("cursorExperience");
  if (data.shippedWithAi === null) errors.push("shippedWithAi");
  if (data.hoursPerWeekAi == null) errors.push("hoursPerWeekAi");
  if (data.hoursPerWeekSocial == null) errors.push("hoursPerWeekSocial");
  if (data.postedAsCreator === null) errors.push("postedAsCreator");
  if (data.gigPlatformWork === null) errors.push("gigPlatformWork");
  if (data.algorithmUnderstanding == null) errors.push("algorithmUnderstanding");
  if (data.baselineEffective == null) errors.push("baselineEffective");
  if (data.baselineUnderstanding == null) errors.push("baselineUnderstanding");
  if (!data.whyJoined) errors.push("whyJoined");
  if (!data.eightWeekGoal) errors.push("eightWeekGoal");

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, data };
}
