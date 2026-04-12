/**
 * @jest-environment node
 */

/* ------------------------------------------------------------------ */
/*  Mocks – must be declared before any import that touches them      */
/* ------------------------------------------------------------------ */

const mockDoc = jest.fn();
const mockSetDoc = jest.fn();
const mockGetDoc = jest.fn();
const mockServerTimestamp = jest.fn(() => "SERVER_TS");

jest.mock("firebase/firestore", () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  serverTimestamp: () => mockServerTimestamp(),
  Timestamp: {},
}));

jest.mock("@/lib/firebase", () => ({
  db: "MOCK_DB",
}));

jest.mock("@/lib/sanitize", () => ({
  sanitizeText: (s: string) => s.trim(),
  sanitizeName: (s: string) => s.trim(),
}));

// Mock fetch for the admin notification call
const mockFetch = jest.fn().mockResolvedValue({ ok: true });
global.fetch = mockFetch;

import {
  countWords,
  isValidEduEmail,
  hasVerifiedEduEmail,
  getVerifiedEduEmail,
  validateCfpSubmission,
  submitCfpProposal,
  getCfpSubmission,
  CfpSubmissionInput,
} from "@/lib/cfp-submissions";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function makeValidInput(overrides: Partial<CfpSubmissionInput> = {}): CfpSubmissionInput {
  // Generate abstract with enough words (1500+)
  const words = Array.from({ length: 1600 }, (_, i) => `word${i}`).join(" ");
  return {
    abstract: words,
    name: "Jane Doe",
    email: "jane@mit.edu",
    school: "MIT",
    department: "CS",
    advisor: "Dr. Smith",
    thesisTitle: "On Testing",
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  countWords                                                         */
/* ------------------------------------------------------------------ */

describe("countWords", () => {
  it("counts space-separated words", () => {
    expect(countWords("hello world foo")).toBe(3);
  });

  it("returns 0 for empty or falsy input", () => {
    expect(countWords("")).toBe(0);
    expect(countWords(null as unknown as string)).toBe(0);
    expect(countWords(undefined as unknown as string)).toBe(0);
  });

  it("handles extra whitespace", () => {
    expect(countWords("  a   b   c  ")).toBe(3);
  });
});

/* ------------------------------------------------------------------ */
/*  isValidEduEmail                                                    */
/* ------------------------------------------------------------------ */

describe("isValidEduEmail", () => {
  it("accepts .edu emails", () => {
    expect(isValidEduEmail("student@harvard.edu")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isValidEduEmail("Student@MIT.EDU")).toBe(true);
  });

  it("rejects non-.edu emails", () => {
    expect(isValidEduEmail("user@gmail.com")).toBe(false);
  });

  it("returns false for falsy values", () => {
    expect(isValidEduEmail("")).toBe(false);
    expect(isValidEduEmail(null as unknown as string)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  hasVerifiedEduEmail                                                */
/* ------------------------------------------------------------------ */

describe("hasVerifiedEduEmail", () => {
  it("returns true when primary email is .edu", () => {
    expect(hasVerifiedEduEmail("u@mit.edu", null)).toBe(true);
  });

  it("returns true when an additional verified email is .edu", () => {
    const profile = {
      additionalEmails: [{ email: "u@harvard.edu", verified: true }],
    };
    expect(hasVerifiedEduEmail("u@gmail.com", profile)).toBe(true);
  });

  it("returns false when additional .edu is not verified", () => {
    const profile = {
      additionalEmails: [{ email: "u@harvard.edu", verified: false }],
    };
    expect(hasVerifiedEduEmail("u@gmail.com", profile)).toBe(false);
  });

  it("returns false when no .edu at all", () => {
    expect(hasVerifiedEduEmail("u@gmail.com", null)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  getVerifiedEduEmail                                                */
/* ------------------------------------------------------------------ */

describe("getVerifiedEduEmail", () => {
  it("returns primary .edu email lowercased", () => {
    expect(getVerifiedEduEmail("U@MIT.EDU", null)).toBe("u@mit.edu");
  });

  it("falls back to first verified additional .edu", () => {
    const profile = {
      additionalEmails: [
        { email: "X@HARVARD.EDU", verified: true },
        { email: "Y@YALE.EDU", verified: true },
      ],
    };
    expect(getVerifiedEduEmail("u@gmail.com", profile)).toBe("x@harvard.edu");
  });

  it("returns null when none available", () => {
    expect(getVerifiedEduEmail("u@gmail.com", null)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  validateCfpSubmission                                              */
/* ------------------------------------------------------------------ */

describe("validateCfpSubmission", () => {
  it("returns null for valid submission", () => {
    expect(validateCfpSubmission(makeValidInput())).toBeNull();
  });

  it("rejects abstract with too few words", () => {
    const result = validateCfpSubmission(makeValidInput({ abstract: "short" }));
    expect(result).toContain("at least 1500");
  });

  it("rejects abstract with too many words", () => {
    const long = Array.from({ length: 3000 }, (_, i) => `w${i}`).join(" ");
    const result = validateCfpSubmission(makeValidInput({ abstract: long }));
    expect(result).toContain("at most 2500");
  });

  it("rejects non-.edu email", () => {
    const result = validateCfpSubmission(makeValidInput({ email: "user@gmail.com" }));
    expect(result).toContain(".edu");
  });

  it("rejects missing name", () => {
    const result = validateCfpSubmission(makeValidInput({ name: "" }));
    expect(result).toContain("Name");
  });

  it("rejects missing school", () => {
    const result = validateCfpSubmission(makeValidInput({ school: "  " }));
    expect(result).toContain("School");
  });

  it("rejects missing department", () => {
    const result = validateCfpSubmission(makeValidInput({ department: "" }));
    expect(result).toContain("Department");
  });

  it("rejects missing advisor", () => {
    const result = validateCfpSubmission(makeValidInput({ advisor: "" }));
    expect(result).toContain("Advisor");
  });

  it("rejects missing thesis title", () => {
    const result = validateCfpSubmission(makeValidInput({ thesisTitle: "" }));
    expect(result).toContain("Thesis");
  });
});

/* ------------------------------------------------------------------ */
/*  submitCfpProposal                                                  */
/* ------------------------------------------------------------------ */

describe("submitCfpProposal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockReturnValue("DOC_REF");
    mockSetDoc.mockResolvedValue(undefined);
    mockFetch.mockResolvedValue({ ok: true });
  });

  it("creates a new document with createdAt when doc does not exist", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    await submitCfpProposal(makeValidInput(), "user-1");

    expect(mockDoc).toHaveBeenCalledWith("MOCK_DB", "cfpSubmissions", "user-1");
    expect(mockSetDoc).toHaveBeenCalledWith(
      "DOC_REF",
      expect.objectContaining({
        userId: "user-1",
        createdAt: "SERVER_TS",
        updatedAt: "SERVER_TS",
      }),
      { merge: true }
    );
  });

  it("omits createdAt when doc already exists", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => true });

    await submitCfpProposal(makeValidInput(), "user-1");

    const payload = mockSetDoc.mock.calls[0][1];
    expect(payload.createdAt).toBeUndefined();
    expect(payload.updatedAt).toBe("SERVER_TS");
  });

  it("throws on validation error", async () => {
    await expect(
      submitCfpProposal(makeValidInput({ abstract: "too short" }), "user-1")
    ).rejects.toThrow("at least 1500");
  });

  it("still succeeds when admin notification fetch fails", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });
    mockFetch.mockRejectedValue(new Error("network"));

    // Should not throw
    await submitCfpProposal(makeValidInput(), "user-1");
    expect(mockSetDoc).toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  getCfpSubmission                                                   */
/* ------------------------------------------------------------------ */

describe("getCfpSubmission", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockReturnValue("DOC_REF");
  });

  it("returns data when document exists", async () => {
    const fakeData = { abstract: "...", name: "Test" };
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => fakeData });

    const result = await getCfpSubmission("user-1");
    expect(result).toEqual(fakeData);
  });

  it("returns null when document does not exist", async () => {
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const result = await getCfpSubmission("user-1");
    expect(result).toBeNull();
  });
});
