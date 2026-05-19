/**
 * @jest-environment node
 *
 * Coverage push #51 — lib/summer-cohort-intake.ts. Constants surface +
 * the validateIntakeSurvey coercer that the POST /summer-cohort/
 * intake-survey route runs every wire payload through.
 */
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
  SUMMER_COHORT_INTAKE_COLLECTION,
  SUMMER_COHORT_INTAKE_VERSION,
  YEARS_PROGRAMMING_OPTIONS,
  intakeSurveyDocId,
  validateIntakeSurvey,
} from "@/lib/summer-cohort-intake";

const VALID_PAYLOAD = {
  email: "STUDENT@EXAMPLE.COM",
  cohort: "cohort-1",
  consentToResearch: true,
  age: 25,
  gender: "woman",
  countryOfResidence: "USA",
  countryOfBirth: "USA",
  nativeLanguages: "English",
  englishProficiency: "native",
  highestDegree: "bachelors",
  degreeField: "CS",
  employmentStatus: "yes",
  yearsProgramming: "3-5",
  programmingLanguages: ["Python", "TypeScript"],
  priorEngineerEmployment: false,
  csCredential: "undergraduate",
  firstAiYear: 2023,
  llmFrequency: "daily",
  aiToolsUsed: ["cursor"],
  cursorExperience: "daily",
  shippedWithAi: true,
  shippedWithAiDescription: "Built a small SaaS",
  hoursPerWeekAi: 20,
  hoursPerWeekSocial: 10,
  postedAsCreator: false,
  gigPlatformWork: false,
  algorithmUnderstanding: 5,
  baselineEffective: 5,
  baselineUnderstanding: 5,
  whyJoined: "to learn",
  eightWeekGoal: "ship 3 features",
};

// Re-derive a sample legal value for each enum so we can pivot tests
// without hard-coding strings that might drift.
const A_GENDER = GENDER_OPTIONS[0];
const A_HIGHEST_DEGREE = HIGHEST_DEGREE_OPTIONS[0];

describe("lib/summer-cohort-intake — constants", () => {
  it("collection name + survey version are stable", () => {
    expect(SUMMER_COHORT_INTAKE_COLLECTION).toBe("summerCohortIntakeSurveys");
    expect(SUMMER_COHORT_INTAKE_VERSION).toBe("v2");
  });

  it("intakeSurveyDocId composes uid + cohort", () => {
    expect(intakeSurveyDocId("u1", "cohort-1")).toBe("u1_cohort-1");
  });

  it("INTAKE_LIMITS exposes positive caps", () => {
    expect(INTAKE_LIMITS.email).toBeGreaterThan(0);
    expect(INTAKE_LIMITS.shortText).toBeGreaterThan(0);
    expect(INTAKE_LIMITS.longText).toBeGreaterThan(INTAKE_LIMITS.shortText);
    expect(INTAKE_LIMITS.minAge).toBeLessThan(INTAKE_LIMITS.maxAge);
  });

  it("every enum option list contains the constants the validator references", () => {
    expect(GENDER_OPTIONS).toContain(A_GENDER);
    expect(GENDER_OPTIONS).toContain("prefer-self-describe");
    expect(HIGHEST_DEGREE_OPTIONS).toContain(A_HIGHEST_DEGREE);
    expect(HIGHEST_DEGREE_OPTIONS).toContain("other");
    expect(EMPLOYMENT_OPTIONS).toEqual(["yes", "no", "part-time"]);
    expect(LLM_FREQUENCY_OPTIONS.length).toBeGreaterThan(0);
    expect(CURSOR_EXPERIENCE_OPTIONS.length).toBeGreaterThan(0);
    expect(CS_CREDENTIAL_OPTIONS.length).toBeGreaterThan(0);
    expect(YEARS_PROGRAMMING_OPTIONS.length).toBeGreaterThan(0);
    expect(ENGLISH_PROFICIENCY_OPTIONS.length).toBeGreaterThan(0);
    expect(PROGRAMMING_LANGUAGE_OPTIONS.length).toBeGreaterThan(0);
    expect(AI_TOOL_OPTIONS.length).toBeGreaterThan(0);
    expect(SOCIAL_PLATFORM_OPTIONS.length).toBeGreaterThan(0);
  });
});

describe("validateIntakeSurvey", () => {
  it("rejects non-object payloads with a single 'Invalid payload' error", () => {
    expect(validateIntakeSurvey(null)).toEqual({
      ok: false,
      errors: ["Invalid payload"],
    });
    expect(validateIntakeSurvey("not-an-object")).toEqual({
      ok: false,
      errors: ["Invalid payload"],
    });
    expect(validateIntakeSurvey(42)).toEqual({
      ok: false,
      errors: ["Invalid payload"],
    });
  });

  it("accepts a fully-populated payload and lowercases email", () => {
    const out = validateIntakeSurvey(VALID_PAYLOAD);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.data.email).toBe("student@example.com");
      expect(out.data.cohort).toBe("cohort-1");
      expect(out.data.consentToResearch).toBe(true);
    }
  });

  it("accumulates required-field errors for an empty payload", () => {
    const out = validateIntakeSurvey({});
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.errors).toEqual(expect.arrayContaining([
        "email",
        "cohort",
        "age",
        "gender",
        "countryOfResidence",
        "whyJoined",
        "eightWeekGoal",
      ]));
    }
  });

  it("requires genderSelfDescribed when gender === 'prefer-self-describe'", () => {
    const out = validateIntakeSurvey({
      ...VALID_PAYLOAD,
      gender: "prefer-self-describe",
      genderSelfDescribed: "",
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors).toContain("genderSelfDescribed");
  });

  it("captures the self-described gender when supplied", () => {
    const out = validateIntakeSurvey({
      ...VALID_PAYLOAD,
      gender: "prefer-self-describe",
      genderSelfDescribed: "Custom",
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.genderSelfDescribed).toBe("Custom");
  });

  it("requires highestDegreeOther when highestDegree === 'other'", () => {
    const out = validateIntakeSurvey({
      ...VALID_PAYLOAD,
      highestDegree: "other",
      highestDegreeOther: "",
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors).toContain("highestDegreeOther");
  });

  it("requires priorEngineerYears when priorEngineerEmployment === true", () => {
    const out = validateIntakeSurvey({
      ...VALID_PAYLOAD,
      priorEngineerEmployment: true,
      // priorEngineerYears missing
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors).toContain("priorEngineerYears");
  });

  it("captures priorEngineerYears when valid", () => {
    const out = validateIntakeSurvey({
      ...VALID_PAYLOAD,
      priorEngineerEmployment: true,
      priorEngineerYears: 8,
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.priorEngineerYears).toBe(8);
  });

  it("clamps + trims string array values (max 30 items, 64 chars)", () => {
    const tooMany = Array.from({ length: 50 }, (_, i) => `lang-${i}`);
    tooMany[0] = "  Padded  ";
    const out = validateIntakeSurvey({
      ...VALID_PAYLOAD,
      programmingLanguages: tooMany,
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.data.programmingLanguages.length).toBe(30);
      expect(out.data.programmingLanguages[0]).toBe("Padded");
    }
  });

  it("filters non-string + empty entries from string arrays", () => {
    const out = validateIntakeSurvey({
      ...VALID_PAYLOAD,
      programmingLanguages: ["go", 42, "", "  ", "rust"],
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.data.programmingLanguages).toEqual(["go", "rust"]);
    }
  });

  it("clamps age to [minAge, maxAge] and rejects out-of-range", () => {
    const tooYoung = validateIntakeSurvey({ ...VALID_PAYLOAD, age: 5 });
    expect(tooYoung.ok).toBe(false);
    if (!tooYoung.ok) expect(tooYoung.errors).toContain("age");

    const tooOld = validateIntakeSurvey({ ...VALID_PAYLOAD, age: 999 });
    expect(tooOld.ok).toBe(false);
  });

  it("rounds non-integer age to int", () => {
    const out = validateIntakeSurvey({ ...VALID_PAYLOAD, age: 25.7 });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.age).toBe(26);
  });

  it("rejects non-finite age (NaN, Infinity)", () => {
    expect(validateIntakeSurvey({ ...VALID_PAYLOAD, age: NaN }).ok).toBe(false);
    expect(validateIntakeSurvey({ ...VALID_PAYLOAD, age: Infinity }).ok).toBe(false);
  });

  it("rejects out-of-range firstAiYear", () => {
    const out = validateIntakeSurvey({ ...VALID_PAYLOAD, firstAiYear: 1800 });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors).toContain("firstAiYear");
  });

  it("rejects out-of-range Likert (1..7) values", () => {
    const out = validateIntakeSurvey({
      ...VALID_PAYLOAD,
      algorithmUnderstanding: 99,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors).toContain("algorithmUnderstanding");
  });

  it("nulls conditional follow-ups when their trigger is not exactly true", () => {
    const out = validateIntakeSurvey({
      ...VALID_PAYLOAD,
      shippedWithAi: false,
      shippedWithAiDescription: "ignored",
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.shippedWithAiDescription).toBeNull();
  });

  it("requires postedAsCreator + gigPlatformWork as explicit booleans (null fails)", () => {
    const out = validateIntakeSurvey({
      ...VALID_PAYLOAD,
      postedAsCreator: null,
      gigPlatformWork: null,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.errors).toContain("postedAsCreator");
      expect(out.errors).toContain("gigPlatformWork");
    }
  });

  it("rejects unknown enum values (validation error on the field)", () => {
    const out = validateIntakeSurvey({
      ...VALID_PAYLOAD,
      employmentStatus: "freelance",
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors).toContain("employmentStatus");
  });

  it("treats boolean fields that aren't booleans as null", () => {
    const out = validateIntakeSurvey({
      ...VALID_PAYLOAD,
      consentToResearch: "yes",
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.consentToResearch).toBe(false);
  });

  it("captures highestDegreeOther when highestDegree === 'other'", () => {
    const out = validateIntakeSurvey({
      ...VALID_PAYLOAD,
      highestDegree: "other",
      highestDegreeOther: "Professional certificate",
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.highestDegreeOther).toBe("Professional certificate");
  });

  it("nulls postedAsCreatorWhich when postedAsCreator is true but the field is blank", () => {
    const out = validateIntakeSurvey({
      ...VALID_PAYLOAD,
      postedAsCreator: true,
      postedAsCreatorWhich: "",
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.postedAsCreatorWhich).toBeNull();
  });

  it("captures postedAsCreatorWhich when postedAsCreator === true", () => {
    const out = validateIntakeSurvey({
      ...VALID_PAYLOAD,
      postedAsCreator: true,
      postedAsCreatorWhich: "YouTube",
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.postedAsCreatorWhich).toBe("YouTube");
  });

  it("nulls postedAsCreatorWhich when postedAsCreator is not true", () => {
    const out = validateIntakeSurvey({
      ...VALID_PAYLOAD,
      postedAsCreator: false,
      postedAsCreatorWhich: "ignored",
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.postedAsCreatorWhich).toBeNull();
  });

  it("nulls gigPlatformDetails when gigPlatformWork is true but the field is blank", () => {
    const out = validateIntakeSurvey({
      ...VALID_PAYLOAD,
      gigPlatformWork: true,
      gigPlatformDetails: "",
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.gigPlatformDetails).toBeNull();
  });

  it("captures gigPlatformDetails when gigPlatformWork === true", () => {
    const out = validateIntakeSurvey({
      ...VALID_PAYLOAD,
      gigPlatformWork: true,
      gigPlatformDetails: "Freelance on Upwork",
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.gigPlatformDetails).toBe("Freelance on Upwork");
  });

  it("rejects hoursPerWeekAi above the weekly cap", () => {
    const out = validateIntakeSurvey({
      ...VALID_PAYLOAD,
      hoursPerWeekAi: INTAKE_LIMITS.maxHoursPerWeek + 1,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors).toContain("hoursPerWeekAi");
  });

  it("rejects hoursPerWeekSocial above the weekly cap", () => {
    const out = validateIntakeSurvey({
      ...VALID_PAYLOAD,
      hoursPerWeekSocial: 200,
    });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.errors).toContain("hoursPerWeekSocial");
  });

  it("clamps long free-text fields to INTAKE_LIMITS.longText", () => {
    const long = "x".repeat(INTAKE_LIMITS.longText + 50);
    const out = validateIntakeSurvey({
      ...VALID_PAYLOAD,
      whyJoined: long,
      eightWeekGoal: long,
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.data.whyJoined.length).toBe(INTAKE_LIMITS.longText);
      expect(out.data.eightWeekGoal.length).toBe(INTAKE_LIMITS.longText);
    }
  });

  it("coerces participatedInCohort1 from a boolean wire value", () => {
    const out = validateIntakeSurvey({
      ...VALID_PAYLOAD,
      participatedInCohort1: true,
    });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.data.participatedInCohort1).toBe(true);

    const ignored = validateIntakeSurvey({
      ...VALID_PAYLOAD,
      participatedInCohort1: "yes",
    });
    expect(ignored.ok).toBe(true);
    if (ignored.ok) expect(ignored.data.participatedInCohort1).toBeNull();
  });

  it("keeps shippedWithAiDescription when shippedWithAi === true", () => {
    const out = validateIntakeSurvey({
      ...VALID_PAYLOAD,
      shippedWithAi: true,
      shippedWithAiDescription: "  Shipped a CLI tool  ",
    });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.data.shippedWithAiDescription).toBe("Shipped a CLI tool");
    }
  });
});
