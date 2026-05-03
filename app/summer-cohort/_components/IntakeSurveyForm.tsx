/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useMemo, useState } from "react";
import {
  AI_TOOL_OPTIONS,
  CS_CREDENTIAL_OPTIONS,
  CURSOR_EXPERIENCE_OPTIONS,
  EMPLOYMENT_OPTIONS,
  ENGLISH_PROFICIENCY_OPTIONS,
  GENDER_OPTIONS,
  HIGHEST_DEGREE_OPTIONS,
  INTAKE_LIMITS,
  LLM_FREQUENCY_OPTIONS,
  PROGRAMMING_LANGUAGE_OPTIONS,
  SOCIAL_PLATFORM_OPTIONS,
  YEARS_PROGRAMMING_OPTIONS,
  type CsCredential,
  type CursorExperience,
  type EmploymentStatus,
  type EnglishProficiency,
  type GenderOption,
  type HighestDegree,
  type IntakeSurveyResponse,
  type LlmFrequency,
  type YearsProgramming,
} from "@/lib/summer-cohort-intake";

// Display labels for the enum string values. Keep these in the form layer —
// the lib is data-only.
const ENUM_LABELS = {
  gender: {
    woman: "Woman",
    man: "Man",
    "non-binary": "Non-binary",
    "prefer-self-describe": "Prefer to self-describe",
    "prefer-not-to-say": "Prefer not to say",
  } satisfies Record<GenderOption, string>,
  englishProficiency: {
    beginner: "Beginner",
    intermediate: "Intermediate",
    advanced: "Advanced",
    native: "Native",
  } satisfies Record<EnglishProficiency, string>,
  highestDegree: {
    none: "None",
    "high-school": "High school",
    associate: "Associate",
    bachelors: "Bachelor's",
    masters: "Master's",
    doctorate: "Doctorate",
    other: "Other",
  } satisfies Record<HighestDegree, string>,
  employment: {
    yes: "Yes",
    no: "No",
    "part-time": "Part-time",
  } satisfies Record<EmploymentStatus, string>,
  yearsProgramming: {
    none: "None",
    "less-than-1": "Less than 1",
    "1-3": "1–3",
    "3-5": "3–5",
    "5-10": "5–10",
    "more-than-10": "More than 10",
  } satisfies Record<YearsProgramming, string>,
  csCredential: {
    none: "None",
    "self-taught": "Self-taught",
    bootcamp: "Bootcamp",
    undergraduate: "Undergraduate",
    graduate: "Graduate",
    "industry-cert": "Industry certification",
  } satisfies Record<CsCredential, string>,
  llmFrequency: {
    never: "Never",
    monthly: "Monthly",
    weekly: "Weekly",
    "several-times-week": "Several times a week",
    daily: "Daily",
    "multi-hours-day": "Multiple hours per day",
  } satisfies Record<LlmFrequency, string>,
  cursorExperience: {
    never: "Never used",
    tried: "Tried it",
    regular: "Regular use",
    daily: "Daily user",
  } satisfies Record<CursorExperience, string>,
};

const INPUT_CLASS =
  "mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-neutral-700 dark:bg-neutral-950";
const READONLY_INPUT_CLASS =
  "mt-1 w-full cursor-not-allowed rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-2 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-800/60 dark:text-neutral-400";

type Props = {
  /** Email pre-filled from the user's auth profile (editable). */
  defaultEmail: string;
  /** Cohort id from the application (read-only display). */
  cohortId: string;
  /** Called after a successful submit so the parent can re-fetch + show the dashboard. */
  onComplete: () => void;
};

const EMPTY: IntakeSurveyResponse = {
  email: "",
  participantCode: "",
  cohort: "",
  consentToResearch: false,

  age: null,
  gender: null,
  genderSelfDescribed: null,
  countryOfResidence: "",
  countryOfBirth: "",
  nativeLanguages: "",
  englishProficiency: null,
  highestDegree: null,
  highestDegreeOther: null,
  degreeField: "",
  employmentStatus: null,

  yearsProgramming: null,
  programmingLanguages: [],
  programmingLanguagesOther: null,
  priorEngineerEmployment: null,
  priorEngineerYears: null,
  csCredential: null,

  firstAiYear: null,
  llmFrequency: null,
  aiToolsUsed: [],
  aiToolsOther: null,
  cursorExperience: null,
  shippedWithAi: null,
  shippedWithAiDescription: null,
  hoursPerWeekAi: null,

  hoursPerWeekSocial: null,
  postedAsCreator: null,
  postedAsCreatorWhich: null,
  gigPlatformWork: null,
  gigPlatformDetails: null,
  algorithmUnderstanding: null,

  baselineEffective: null,
  baselineUnderstanding: null,

  whyJoined: "",
  eightWeekGoal: "",
};

export function IntakeSurveyForm({ defaultEmail, cohortId, onComplete }: Props) {
  const [r, setR] = useState<IntakeSurveyResponse>(() => ({
    ...EMPTY,
    email: defaultEmail,
    cohort: cohortId,
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);

  const update = <K extends keyof IntakeSurveyResponse>(
    key: K,
    value: IntakeSurveyResponse[K]
  ) => {
    setR((prev) => ({ ...prev, [key]: value }));
  };

  const toggleInArray = (key: "programmingLanguages" | "aiToolsUsed", value: string) => {
    setR((prev) => {
      const arr = prev[key];
      const next = arr.includes(value)
        ? arr.filter((v) => v !== value)
        : [...arr, value];
      return { ...prev, [key]: next };
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMissingFields([]);
    try {
      const res = await fetch("/api/summer-cohort/intake-survey", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(r),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        if (Array.isArray(j.missingFields)) {
          setMissingFields(j.missingFields);
          setError(`Missing or invalid: ${j.missingFields.join(", ")}`);
        } else {
          setError(j.error || `Submit failed (${res.status})`);
        }
        return;
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  const isMissing = useMemo(
    () => (field: string) => missingFields.includes(field),
    [missingFields]
  );

  return (
    <section className="rounded-xl border border-emerald-300 bg-emerald-50/50 p-6 dark:border-emerald-900 dark:bg-emerald-950/20">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          Required before kickoff
        </div>
        <h2 className="mt-3 text-xl font-bold">Intake Survey</h2>
        <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
          You&apos;ve been admitted to Cohort 1. Before you see the cohort
          dashboard, we need ~5 minutes for an intake survey. This is a research
          instrument — your responses help us study how the program changes
          participants&apos; experience with AI tools.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          You can update your answers later from this page if anything changes
          before kickoff. Required fields are marked with{" "}
          <span className="text-red-500">*</span>.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-10">
        {/* ----------------------------------------------------------------
            Section 1: Linkage and consent
           ---------------------------------------------------------------- */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            1. Linkage &amp; consent
          </legend>

          <FieldEmail
            value={r.email}
            onChange={(v) => update("email", v)}
            invalid={isMissing("email")}
          />

          <Field label="Self-generated participant code" required invalid={isMissing("participantCode")}>
            <input
              type="text"
              required
              maxLength={INTAKE_LIMITS.participantCode}
              value={r.participantCode}
              onChange={(e) => update("participantCode", e.target.value)}
              placeholder="e.g. last 4 of phone + first 2 letters of mother's first name"
              className={INPUT_CLASS}
            />
            <p className="mt-1 text-xs text-neutral-500">
              Pick a rule and use the same code on every wave so we can match
              your responses across the program even if your email changes.
            </p>
          </Field>

          <Field label="Cohort" required invalid={isMissing("cohort")}>
            <input
              type="text"
              value={r.cohort}
              readOnly
              className={READONLY_INPUT_CLASS}
            />
          </Field>

          <label className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${isMissing("consentToResearch") ? "border-red-400 bg-red-50 dark:bg-red-950/30" : "border-neutral-300 dark:border-neutral-700"}`}>
            <input
              type="checkbox"
              checked={r.consentToResearch}
              onChange={(e) => update("consentToResearch", e.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="font-medium">I consent to research use of program data.</span>{" "}
              <span className="text-neutral-600 dark:text-neutral-400">
                Responses are aggregated and de-identified for analysis. The IRB
                protocol summary will be shared with respondents before
                publication.
              </span>{" "}
              <span className="text-red-500">*</span>
            </span>
          </label>
        </fieldset>

        {/* ----------------------------------------------------------------
            Section 2: Demographics
           ---------------------------------------------------------------- */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            2. Demographics
          </legend>

          <Field label="Age" required invalid={isMissing("age")}>
            <input
              type="number"
              min={INTAKE_LIMITS.minAge}
              max={INTAKE_LIMITS.maxAge}
              value={r.age ?? ""}
              onChange={(e) => update("age", e.target.value === "" ? null : Number(e.target.value))}
              className={INPUT_CLASS}
            />
          </Field>

          <Field label="Gender" required invalid={isMissing("gender")}>
            <select
              value={r.gender ?? ""}
              onChange={(e) => update("gender", (e.target.value || null) as GenderOption | null)}
              className={INPUT_CLASS}
            >
              <option value="">Select…</option>
              {GENDER_OPTIONS.map((g) => (
                <option key={g} value={g}>{ENUM_LABELS.gender[g]}</option>
              ))}
            </select>
          </Field>
          {r.gender === "prefer-self-describe" ? (
            <Field label="Self-describe" required invalid={isMissing("genderSelfDescribed")}>
              <input
                type="text"
                maxLength={INTAKE_LIMITS.shortText}
                value={r.genderSelfDescribed ?? ""}
                onChange={(e) => update("genderSelfDescribed", e.target.value)}
                className={INPUT_CLASS}
              />
            </Field>
          ) : null}

          <Field label="Country of residence" required invalid={isMissing("countryOfResidence")}>
            <input
              type="text"
              maxLength={INTAKE_LIMITS.shortText}
              value={r.countryOfResidence}
              onChange={(e) => update("countryOfResidence", e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>

          <Field label="Country of birth" required invalid={isMissing("countryOfBirth")}>
            <input
              type="text"
              maxLength={INTAKE_LIMITS.shortText}
              value={r.countryOfBirth}
              onChange={(e) => update("countryOfBirth", e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>

          <Field label="Native language(s)" required invalid={isMissing("nativeLanguages")}>
            <input
              type="text"
              maxLength={INTAKE_LIMITS.shortText}
              value={r.nativeLanguages}
              onChange={(e) => update("nativeLanguages", e.target.value)}
              placeholder="Comma-separated if multiple"
              className={INPUT_CLASS}
            />
          </Field>

          <Field label="English proficiency (self-rated)" required invalid={isMissing("englishProficiency")}>
            <select
              value={r.englishProficiency ?? ""}
              onChange={(e) => update("englishProficiency", (e.target.value || null) as EnglishProficiency | null)}
              className={INPUT_CLASS}
            >
              <option value="">Select…</option>
              {ENGLISH_PROFICIENCY_OPTIONS.map((p) => (
                <option key={p} value={p}>{ENUM_LABELS.englishProficiency[p]}</option>
              ))}
            </select>
          </Field>

          <Field label="Highest degree completed" required invalid={isMissing("highestDegree")}>
            <select
              value={r.highestDegree ?? ""}
              onChange={(e) => update("highestDegree", (e.target.value || null) as HighestDegree | null)}
              className={INPUT_CLASS}
            >
              <option value="">Select…</option>
              {HIGHEST_DEGREE_OPTIONS.map((d) => (
                <option key={d} value={d}>{ENUM_LABELS.highestDegree[d]}</option>
              ))}
            </select>
          </Field>
          {r.highestDegree === "other" ? (
            <Field label="Specify other degree" required invalid={isMissing("highestDegreeOther")}>
              <input
                type="text"
                maxLength={INTAKE_LIMITS.shortText}
                value={r.highestDegreeOther ?? ""}
                onChange={(e) => update("highestDegreeOther", e.target.value)}
                className={INPUT_CLASS}
              />
            </Field>
          ) : null}

          <Field label="Field of that degree" required invalid={isMissing("degreeField")}>
            <input
              type="text"
              maxLength={INTAKE_LIMITS.shortText}
              value={r.degreeField}
              onChange={(e) => update("degreeField", e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>

          <Field label="Currently employed full-time" required invalid={isMissing("employmentStatus")}>
            <select
              value={r.employmentStatus ?? ""}
              onChange={(e) => update("employmentStatus", (e.target.value || null) as EmploymentStatus | null)}
              className={INPUT_CLASS}
            >
              <option value="">Select…</option>
              {EMPLOYMENT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{ENUM_LABELS.employment[opt]}</option>
              ))}
            </select>
          </Field>
        </fieldset>

        {/* ----------------------------------------------------------------
            Section 3: Programming background
           ---------------------------------------------------------------- */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            3. Programming background
          </legend>

          <Field label="Years of programming experience" required invalid={isMissing("yearsProgramming")}>
            <select
              value={r.yearsProgramming ?? ""}
              onChange={(e) => update("yearsProgramming", (e.target.value || null) as YearsProgramming | null)}
              className={INPUT_CLASS}
            >
              <option value="">Select…</option>
              {YEARS_PROGRAMMING_OPTIONS.map((y) => (
                <option key={y} value={y}>{ENUM_LABELS.yearsProgramming[y]}</option>
              ))}
            </select>
          </Field>

          <Field label="Primary programming languages used in the past year">
            <CheckboxGrid
              options={PROGRAMMING_LANGUAGE_OPTIONS}
              selected={r.programmingLanguages}
              onToggle={(v) => toggleInArray("programmingLanguages", v)}
            />
            <input
              type="text"
              maxLength={INTAKE_LIMITS.shortText}
              value={r.programmingLanguagesOther ?? ""}
              onChange={(e) => update("programmingLanguagesOther", e.target.value)}
              placeholder="Other (free text, comma-separated)"
              className={`${INPUT_CLASS} mt-3`}
            />
          </Field>

          <YesNo
            label="Prior employment as a software engineer or developer"
            required
            invalid={isMissing("priorEngineerEmployment")}
            value={r.priorEngineerEmployment}
            onChange={(v) => update("priorEngineerEmployment", v)}
          />
          {r.priorEngineerEmployment === true ? (
            <Field label="Total years of engineering employment" required invalid={isMissing("priorEngineerYears")}>
              <input
                type="number"
                min={0}
                max={INTAKE_LIMITS.maxYearsExperience}
                value={r.priorEngineerYears ?? ""}
                onChange={(e) => update("priorEngineerYears", e.target.value === "" ? null : Number(e.target.value))}
                className={INPUT_CLASS}
              />
            </Field>
          ) : null}

          <Field label="Highest CS-related credential" required invalid={isMissing("csCredential")}>
            <select
              value={r.csCredential ?? ""}
              onChange={(e) => update("csCredential", (e.target.value || null) as CsCredential | null)}
              className={INPUT_CLASS}
            >
              <option value="">Select…</option>
              {CS_CREDENTIAL_OPTIONS.map((c) => (
                <option key={c} value={c}>{ENUM_LABELS.csCredential[c]}</option>
              ))}
            </select>
          </Field>
        </fieldset>

        {/* ----------------------------------------------------------------
            Section 4: AI tool exposure
           ---------------------------------------------------------------- */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            4. AI tool exposure
          </legend>

          <Field label="Year you first used a generative AI tool" required invalid={isMissing("firstAiYear")}>
            <input
              type="number"
              min={INTAKE_LIMITS.minFirstAiYear}
              max={INTAKE_LIMITS.maxFirstAiYear}
              value={r.firstAiYear ?? ""}
              onChange={(e) => update("firstAiYear", e.target.value === "" ? null : Number(e.target.value))}
              placeholder="e.g. 2022"
              className={INPUT_CLASS}
            />
          </Field>

          <Field label="Frequency of LLM use over the past 6 months" required invalid={isMissing("llmFrequency")}>
            <select
              value={r.llmFrequency ?? ""}
              onChange={(e) => update("llmFrequency", (e.target.value || null) as LlmFrequency | null)}
              className={INPUT_CLASS}
            >
              <option value="">Select…</option>
              {LLM_FREQUENCY_OPTIONS.map((f) => (
                <option key={f} value={f}>{ENUM_LABELS.llmFrequency[f]}</option>
              ))}
            </select>
          </Field>

          <Field label="Primary AI tools used regularly">
            <CheckboxGrid
              options={AI_TOOL_OPTIONS}
              selected={r.aiToolsUsed}
              onToggle={(v) => toggleInArray("aiToolsUsed", v)}
            />
            <input
              type="text"
              maxLength={INTAKE_LIMITS.shortText}
              value={r.aiToolsOther ?? ""}
              onChange={(e) => update("aiToolsOther", e.target.value)}
              placeholder="Other (free text, comma-separated)"
              className={`${INPUT_CLASS} mt-3`}
            />
          </Field>

          <Field label="Cursor experience entering the program" required invalid={isMissing("cursorExperience")}>
            <select
              value={r.cursorExperience ?? ""}
              onChange={(e) => update("cursorExperience", (e.target.value || null) as CursorExperience | null)}
              className={INPUT_CLASS}
            >
              <option value="">Select…</option>
              {CURSOR_EXPERIENCE_OPTIONS.map((c) => (
                <option key={c} value={c}>{ENUM_LABELS.cursorExperience[c]}</option>
              ))}
            </select>
          </Field>

          <YesNo
            label="Have you shipped a working product built with substantial AI assistance?"
            required
            invalid={isMissing("shippedWithAi")}
            value={r.shippedWithAi}
            onChange={(v) => update("shippedWithAi", v)}
          />
          {r.shippedWithAi === true ? (
            <Field label="Brief description">
              <textarea
                maxLength={INTAKE_LIMITS.longText}
                rows={3}
                value={r.shippedWithAiDescription ?? ""}
                onChange={(e) => update("shippedWithAiDescription", e.target.value)}
                className={INPUT_CLASS}
              />
            </Field>
          ) : null}

          <Field label="Hours/week using AI tools (work or projects) — past month" required invalid={isMissing("hoursPerWeekAi")}>
            <input
              type="number"
              min={0}
              max={INTAKE_LIMITS.maxHoursPerWeek}
              value={r.hoursPerWeekAi ?? ""}
              onChange={(e) => update("hoursPerWeekAi", e.target.value === "" ? null : Number(e.target.value))}
              className={INPUT_CLASS}
            />
          </Field>
        </fieldset>

        {/* ----------------------------------------------------------------
            Section 5: Algorithmic platform exposure
           ---------------------------------------------------------------- */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            5. Algorithmic platform exposure
          </legend>

          <Field label="Hours/week, average across social platforms — past 3 months" required invalid={isMissing("hoursPerWeekSocial")}>
            <input
              type="number"
              min={0}
              max={INTAKE_LIMITS.maxHoursPerWeek}
              value={r.hoursPerWeekSocial ?? ""}
              onChange={(e) => update("hoursPerWeekSocial", e.target.value === "" ? null : Number(e.target.value))}
              className={INPUT_CLASS}
            />
            <p className="mt-1 text-xs text-neutral-500">
              {SOCIAL_PLATFORM_OPTIONS.join(", ")}, etc.
            </p>
          </Field>

          <YesNo
            label="Posted content as a creator on any algorithmic platform in the past 2 years"
            required
            invalid={isMissing("postedAsCreator")}
            value={r.postedAsCreator}
            onChange={(v) => update("postedAsCreator", v)}
          />
          {r.postedAsCreator === true ? (
            <Field label="Which platforms?">
              <input
                type="text"
                maxLength={INTAKE_LIMITS.shortText}
                value={r.postedAsCreatorWhich ?? ""}
                onChange={(e) => update("postedAsCreatorWhich", e.target.value)}
                placeholder="Comma-separated"
                className={INPUT_CLASS}
              />
            </Field>
          ) : null}

          <YesNo
            label="Worked on a gig labor platform (Uber, Lyft, DoorDash, Instacart, Upwork, Fiverr, etc.) in the past 3 years"
            required
            invalid={isMissing("gigPlatformWork")}
            value={r.gigPlatformWork}
            onChange={(v) => update("gigPlatformWork", v)}
          />
          {r.gigPlatformWork === true ? (
            <Field label="Which platforms + approximate hours?">
              <textarea
                rows={2}
                maxLength={INTAKE_LIMITS.longText}
                value={r.gigPlatformDetails ?? ""}
                onChange={(e) => update("gigPlatformDetails", e.target.value)}
                className={INPUT_CLASS}
              />
            </Field>
          ) : null}

          <LikertField
            label="Self-rated understanding of how recommendation algorithms decide what to show users"
            leftLabel="No understanding"
            rightLabel="Expert understanding"
            value={r.algorithmUnderstanding}
            onChange={(v) => update("algorithmUnderstanding", v)}
            invalid={isMissing("algorithmUnderstanding")}
          />
        </fieldset>

        {/* ----------------------------------------------------------------
            Section 6: Self-rated baseline (single items, NOT a scale)
           ---------------------------------------------------------------- */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            6. Self-rated baseline
          </legend>
          <p className="text-xs text-neutral-500">
            Two single items, kept deliberately separate from construct
            measurement. 1 = strongly disagree, 7 = strongly agree.
          </p>

          <LikertField
            label='"I am effective at getting useful results from AI tools."'
            leftLabel="Strongly disagree"
            rightLabel="Strongly agree"
            value={r.baselineEffective}
            onChange={(v) => update("baselineEffective", v)}
            invalid={isMissing("baselineEffective")}
          />

          <LikertField
            label='"I understand what AI tools can and cannot do."'
            leftLabel="Strongly disagree"
            rightLabel="Strongly agree"
            value={r.baselineUnderstanding}
            onChange={(v) => update("baselineUnderstanding", v)}
            invalid={isMissing("baselineUnderstanding")}
          />
        </fieldset>

        {/* ----------------------------------------------------------------
            Section 7: Program intent
           ---------------------------------------------------------------- */}
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold uppercase tracking-wider text-neutral-500">
            7. Program intent
          </legend>

          <Field label="Why did you join the program? (one paragraph)" required invalid={isMissing("whyJoined")}>
            <textarea
              rows={4}
              maxLength={INTAKE_LIMITS.longText}
              value={r.whyJoined}
              onChange={(e) => update("whyJoined", e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>

          <Field label="Your primary goal at the end of 8 weeks (1–2 sentences)" required invalid={isMissing("eightWeekGoal")}>
            <textarea
              rows={3}
              maxLength={INTAKE_LIMITS.longText}
              value={r.eightWeekGoal}
              onChange={(e) => update("eightWeekGoal", e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
        </fieldset>

        {/* ----------------------------------------------------------------
            Submit
           ---------------------------------------------------------------- */}
        {error ? (
          <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit & unlock dashboard"}
          </button>
        </div>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function Field({
  label,
  required,
  invalid,
  children,
}: {
  label: string;
  required?: boolean;
  invalid?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={invalid ? "rounded-lg border border-red-400 bg-red-50/40 p-2 dark:bg-red-950/20" : ""}>
      <label className="block text-sm font-medium">
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function FieldEmail({
  value,
  onChange,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  invalid: boolean;
}) {
  return (
    <Field label="Email address" required invalid={invalid}>
      <input
        type="email"
        required
        maxLength={INTAKE_LIMITS.email}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_CLASS}
      />
      <p className="mt-1 text-xs text-neutral-500">
        Pre-filled from your account. Edit if a different address is better for
        research correspondence.
      </p>
    </Field>
  );
}

function YesNo({
  label,
  required,
  invalid,
  value,
  onChange,
}: {
  label: string;
  required?: boolean;
  invalid?: boolean;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <Field label={label} required={required} invalid={invalid}>
      <div className="mt-1 flex gap-4 text-sm">
        <label className="inline-flex items-center gap-2">
          <input
            type="radio"
            checked={value === true}
            onChange={() => onChange(true)}
          />
          Yes
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="radio"
            checked={value === false}
            onChange={() => onChange(false)}
          />
          No
        </label>
      </div>
    </Field>
  );
}

function CheckboxGrid({
  options,
  selected,
  onToggle,
}: {
  options: readonly string[];
  selected: readonly string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {options.map((opt) => (
        <label key={opt} className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={selected.includes(opt)}
            onChange={() => onToggle(opt)}
          />
          {opt}
        </label>
      ))}
    </div>
  );
}

function LikertField({
  label,
  leftLabel,
  rightLabel,
  value,
  onChange,
  invalid,
}: {
  label: string;
  leftLabel: string;
  rightLabel: string;
  value: number | null;
  onChange: (v: number) => void;
  invalid?: boolean;
}) {
  return (
    <Field label={label} required invalid={invalid}>
      <div className="mt-2 flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
        <span className="w-32 text-right">{leftLabel}</span>
        <div className="flex flex-1 justify-between">
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <label key={n} className="flex flex-col items-center gap-1">
              <input
                type="radio"
                checked={value === n}
                onChange={() => onChange(n)}
              />
              <span className="text-xs text-neutral-500">{n}</span>
            </label>
          ))}
        </div>
        <span className="w-32">{rightLabel}</span>
      </div>
    </Field>
  );
}
