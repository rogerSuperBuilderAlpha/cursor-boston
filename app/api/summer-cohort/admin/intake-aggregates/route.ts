/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import { type NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import { isSummerCohortAdminEmail } from "@/lib/summer-cohort-admin-access";
import {
  AI_TOOL_OPTIONS,
  CS_CREDENTIAL_OPTIONS,
  CURSOR_EXPERIENCE_OPTIONS,
  EMPLOYMENT_OPTIONS,
  ENGLISH_PROFICIENCY_OPTIONS,
  GENDER_OPTIONS,
  HIGHEST_DEGREE_OPTIONS,
  LLM_FREQUENCY_OPTIONS,
  PROGRAMMING_LANGUAGE_OPTIONS,
  SUMMER_COHORT_INTAKE_COLLECTION,
  YEARS_PROGRAMMING_OPTIONS,
} from "@/lib/summer-cohort-intake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Bucket = Record<string, number>;
type NumericStats = {
  n: number;
  mean: number | null;
  min: number | null;
  max: number | null;
};
type LikertStats = NumericStats & { distribution: Record<string, number> };

function bucketCounts(values: unknown[]): Bucket {
  const out: Bucket = {};
  for (const v of values) {
    const key =
      v === null || v === undefined
        ? "(blank)"
        : typeof v === "string"
          ? v
          : String(v);
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

function multiSelectCounts(values: unknown[]): Bucket {
  const out: Bucket = {};
  for (const v of values) {
    if (!Array.isArray(v)) continue;
    for (const item of v) {
      if (typeof item !== "string") continue;
      out[item] = (out[item] ?? 0) + 1;
    }
  }
  return out;
}

function numericStats(values: unknown[]): NumericStats {
  const nums: number[] = [];
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) nums.push(v);
  }
  if (nums.length === 0) return { n: 0, mean: null, min: null, max: null };
  const sum = nums.reduce((a, b) => a + b, 0);
  return {
    n: nums.length,
    mean: Number((sum / nums.length).toFixed(2)),
    min: Math.min(...nums),
    max: Math.max(...nums),
  };
}

function likertStats(values: unknown[]): LikertStats {
  const base = numericStats(values);
  const distribution: Record<string, number> = {};
  for (let i = 1; i <= 7; i += 1) distribution[String(i)] = 0;
  for (const v of values) {
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    const k = String(Math.round(v));
    if (k in distribution) distribution[k] += 1;
  }
  return { ...base, distribution };
}

function topN(bucket: Bucket, n: number): Array<{ value: string; count: number }> {
  return Object.entries(bucket)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, n);
}

function yesNoCounts(values: unknown[]): { yes: number; no: number; blank: number } {
  let yes = 0;
  let no = 0;
  let blank = 0;
  for (const v of values) {
    if (v === true) yes += 1;
    else if (v === false) no += 1;
    else blank += 1;
  }
  return { yes, no, blank };
}

/**
 * GET /api/summer-cohort/admin/intake-aggregates
 *   ?cohort=cohort-1|cohort-2 (optional)
 *
 * Admin only. Reads `summerCohortIntakeSurveys` and returns aggregate stats
 * only — no individual rows, no PII, no free-text bodies. Free-text fields
 * (whyJoined / eightWeekGoal / *Other / *Description / nativeLanguages /
 * degreeField / postedAsCreatorWhich) are intentionally excluded; admins
 * who need those should pull from Firestore directly.
 */
export async function GET(request: NextRequest) {
  const user = await getVerifiedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSummerCohortAdminEmail(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getAdminDb();
  if (!db) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const cohort = request.nextUrl.searchParams.get("cohort");

  let query: FirebaseFirestore.Query = db.collection(
    SUMMER_COHORT_INTAKE_COLLECTION
  );
  if (cohort) {
    query = query.where("cohort", "==", cohort);
  }

  const snap = await query.get();
  const rows = snap.docs.map((doc) => doc.data());
  const total = rows.length;

  const pick = (key: string) => rows.map((r) => (r as Record<string, unknown>)[key]);

  const aggregates = {
    total,
    filter: { cohort: cohort ?? null },
    cohortDistribution: bucketCounts(pick("cohort")),

    demographics: {
      age: numericStats(pick("age")),
      gender: bucketCounts(pick("gender")),
      genderOptions: GENDER_OPTIONS,
      englishProficiency: bucketCounts(pick("englishProficiency")),
      englishProficiencyOptions: ENGLISH_PROFICIENCY_OPTIONS,
      highestDegree: bucketCounts(pick("highestDegree")),
      highestDegreeOptions: HIGHEST_DEGREE_OPTIONS,
      employmentStatus: bucketCounts(pick("employmentStatus")),
      employmentStatusOptions: EMPLOYMENT_OPTIONS,
      topCountriesOfResidence: topN(bucketCounts(pick("countryOfResidence")), 10),
      topCountriesOfBirth: topN(bucketCounts(pick("countryOfBirth")), 10),
    },

    programming: {
      yearsProgramming: bucketCounts(pick("yearsProgramming")),
      yearsProgrammingOptions: YEARS_PROGRAMMING_OPTIONS,
      programmingLanguages: multiSelectCounts(pick("programmingLanguages")),
      programmingLanguageOptions: PROGRAMMING_LANGUAGE_OPTIONS,
      priorEngineerEmployment: yesNoCounts(pick("priorEngineerEmployment")),
      priorEngineerYears: numericStats(pick("priorEngineerYears")),
      csCredential: bucketCounts(pick("csCredential")),
      csCredentialOptions: CS_CREDENTIAL_OPTIONS,
    },

    aiTools: {
      firstAiYear: numericStats(pick("firstAiYear")),
      llmFrequency: bucketCounts(pick("llmFrequency")),
      llmFrequencyOptions: LLM_FREQUENCY_OPTIONS,
      aiToolsUsed: multiSelectCounts(pick("aiToolsUsed")),
      aiToolOptions: AI_TOOL_OPTIONS,
      cursorExperience: bucketCounts(pick("cursorExperience")),
      cursorExperienceOptions: CURSOR_EXPERIENCE_OPTIONS,
      shippedWithAi: yesNoCounts(pick("shippedWithAi")),
      hoursPerWeekAi: numericStats(pick("hoursPerWeekAi")),
    },

    platforms: {
      hoursPerWeekSocial: numericStats(pick("hoursPerWeekSocial")),
      postedAsCreator: yesNoCounts(pick("postedAsCreator")),
      gigPlatformWork: yesNoCounts(pick("gigPlatformWork")),
      algorithmUnderstanding: likertStats(pick("algorithmUnderstanding")),
    },

    baselines: {
      baselineEffective: likertStats(pick("baselineEffective")),
      baselineUnderstanding: likertStats(pick("baselineUnderstanding")),
    },
  };

  return NextResponse.json(aggregates);
}
