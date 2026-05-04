/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST, GET } from "@/app/api/hiring-partners/apply/route";
import type { VerifiedUser } from "@/lib/server-auth";
import { getVerifiedUser } from "@/lib/server-auth";
import { sendEmail } from "@/lib/mailgun";

jest.mock("@/lib/server-auth", () => ({
  getVerifiedUser: jest.fn(),
}));

jest.mock("@/lib/mailgun", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

const mockDocGet = jest.fn();
const mockDocSet = jest.fn().mockResolvedValue(undefined);

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => ({
    collection: () => ({
      doc: () => ({ get: mockDocGet, set: mockDocSet }),
    }),
  })),
}));

jest.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => "__SERVER_TS__" },
}));

const mockGetVerifiedUser = getVerifiedUser as jest.MockedFunction<typeof getVerifiedUser>;
const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

const baseUser: VerifiedUser = {
  uid: "user-123",
  email: "partner@example.com",
  name: "Test Partner",
};

function makePost(body: unknown, opts?: { rawString?: string }) {
  return new NextRequest("https://cursorboston.com/api/hiring-partners/apply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://cursorboston.com",
    },
    body: opts?.rawString ?? JSON.stringify(body),
  });
}

function makeGet() {
  return new NextRequest("https://cursorboston.com/api/hiring-partners/apply", {
    method: "GET",
    headers: { Origin: "https://cursorboston.com" },
  });
}

const minimalBody = {
  contactName: "Test Partner",
  phone: "555-1234",
};

const fullBody = {
  contactName: "Test Partner",
  phone: "555-1234",
  companyName: "Acme Corp",
  companyWebsite: "https://acme.example.com",
  contactRole: "Head of Eng",
  rolesHiring: "Founding eng, AI eng",
  notes: "Pre-seed",
};

describe("POST /api/hiring-partners/apply", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(baseUser);
    mockDocGet.mockResolvedValue({
      exists: false,
      data: () => ({}),
    });
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await POST(makePost(minimalBody));
    expect(res.status).toBe(401);
  });

  it("returns 400 when the user has no email on their account", async () => {
    mockGetVerifiedUser.mockResolvedValue({ ...baseUser, email: undefined });
    const res = await POST(makePost(minimalBody));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid JSON", async () => {
    const res = await POST(makePost(undefined, { rawString: "not json" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when contactName is missing", async () => {
    const res = await POST(makePost({ ...minimalBody, contactName: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when phone is missing", async () => {
    const res = await POST(makePost({ ...minimalBody, phone: "   " }));
    expect(res.status).toBe(400);
  });

  it("creates a pending application and emails Roger on first submit", async () => {
    const res = await POST(makePost(minimalBody));
    expect(res.status).toBe(200);
    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-123",
        email: "partner@example.com",
        contactName: "Test Partner",
        phone: "555-1234",
        status: "pending",
      })
    );
    // Email is fire-and-forget — give the microtask a tick to fire.
    await Promise.resolve();
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: expect.arrayContaining([
          "rogerhunt02052@gmail.com",
          "aaron@cursorboston.com",
        ]),
        subject: expect.stringContaining("Test Partner"),
      })
    );
  });

  it("merges updates without re-emailing on subsequent submits", async () => {
    mockDocGet
      // First .get() (existence check) — application already exists.
      .mockResolvedValueOnce({ exists: true, data: () => ({}) })
      // Second .get() (post-write fetch).
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          userId: "user-123",
          email: "partner@example.com",
          contactName: "Test Partner",
          phone: "555-1234",
          companyName: "Acme Corp",
          status: "pending",
        }),
      });

    const res = await POST(makePost(fullBody));
    expect(res.status).toBe(200);
    expect(mockDocSet).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: "Acme Corp",
        companyWebsite: "https://acme.example.com",
      }),
      { merge: true }
    );
    await Promise.resolve();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("coerces non-string optional fields to empty (no crash)", async () => {
    const res = await POST(
      makePost({
        contactName: "Test Partner",
        phone: "555-1234",
        companyName: 12345, // wrong type
        companyWebsite: { not: "a string" },
        contactRole: null,
        rolesHiring: undefined,
        notes: ["array"],
      })
    );
    expect(res.status).toBe(200);
    const stored = mockDocSet.mock.calls[0][0];
    expect(stored.companyName).toBe("");
    expect(stored.companyWebsite).toBe("");
    expect(stored.contactRole).toBe("");
    expect(stored.rolesHiring).toBe("");
    expect(stored.notes).toBe("");
  });

  it("trims and clamps oversized fields", async () => {
    const longName = "a".repeat(500);
    const res = await POST(
      makePost({
        contactName: `  ${longName}  `,
        phone: "555-1234",
      })
    );
    expect(res.status).toBe(200);
    const stored = mockDocSet.mock.calls[0][0];
    expect(stored.contactName.length).toBe(200);
    expect(stored.contactName.startsWith("a")).toBe(true);
  });
});

describe("GET /api/hiring-partners/apply", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetVerifiedUser.mockResolvedValue(baseUser);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetVerifiedUser.mockResolvedValue(null);
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it("returns null application when none exists", async () => {
    mockDocGet.mockResolvedValue({ exists: false });
    const res = await GET(makeGet());
    const json = (await res.json()) as { application: unknown };
    expect(json.application).toBeNull();
  });

  it("returns the serialized application when one exists", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        userId: "user-123",
        email: "partner@example.com",
        contactName: "Test Partner",
        phone: "555-1234",
        status: "approved",
      }),
    });
    const res = await GET(makeGet());
    const json = (await res.json()) as { application: { status: string } };
    expect(json.application.status).toBe("approved");
  });

  it("converts firestore Timestamp.toMillis on createdAt/updatedAt", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        userId: "user-123",
        email: "partner@example.com",
        contactName: "Test Partner",
        phone: "555-1234",
        companyName: "Acme",
        companyWebsite: "https://acme.example.com",
        contactRole: "CEO",
        rolesHiring: "founding eng",
        notes: "hello",
        status: "pending",
        createdAt: { toMillis: () => 1_700_000_000_000 },
        updatedAt: { toMillis: () => 1_700_000_001_000 },
      }),
    });
    const res = await GET(makeGet());
    const json = (await res.json()) as {
      application: { createdAt: number; updatedAt: number; companyName: string };
    };
    expect(json.application.createdAt).toBe(1_700_000_000_000);
    expect(json.application.updatedAt).toBe(1_700_000_001_000);
    expect(json.application.companyName).toBe("Acme");
  });

  it("returns nulls for missing/non-string fields rather than crashing", async () => {
    mockDocGet.mockResolvedValue({
      exists: true,
      data: () => ({
        userId: 12345, // wrong type
        contactName: null,
        // missing all other fields
      }),
    });
    const res = await GET(makeGet());
    const json = (await res.json()) as {
      application: {
        userId: string | null;
        contactName: string | null;
        email: string | null;
        createdAt: number | null;
        status: string;
      };
    };
    expect(json.application.userId).toBeNull();
    expect(json.application.contactName).toBeNull();
    expect(json.application.email).toBeNull();
    expect(json.application.createdAt).toBeNull();
    expect(json.application.status).toBe("pending");
  });
});
