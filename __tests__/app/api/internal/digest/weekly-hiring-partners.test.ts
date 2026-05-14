/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/internal/digest/weekly-hiring-partners/route";
import { sendEmail } from "@/lib/mailgun";

jest.mock("@/lib/mailgun", () => ({
  sendEmail: jest.fn().mockResolvedValue(undefined),
}));

const mockWhereGet = jest.fn();

jest.mock("@/lib/firebase-admin", () => ({
  getAdminDb: jest.fn(() => ({
    collection: () => ({
      where: () => ({ get: mockWhereGet }),
    }),
  })),
}));

const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;

const ORIGINAL_CRON_SECRET = process.env.CRON_SECRET;

beforeAll(() => {
  process.env.CRON_SECRET = "test-secret";
});

afterAll(() => {
  if (ORIGINAL_CRON_SECRET === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = ORIGINAL_CRON_SECRET;
  }
});

function makeReq(headers: Record<string, string> = {}) {
  return new NextRequest(
    "https://cursorboston.com/api/internal/digest/weekly-hiring-partners",
    { method: "GET", headers }
  );
}

describe("GET /api/internal/digest/weekly-hiring-partners", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 without the cron secret", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 401 with a wrong cron secret", async () => {
    const res = await GET(makeReq({ "x-cron-secret": "wrong" }));
    expect(res.status).toBe(401);
  });

  it("accepts the secret in an Authorization Bearer header", async () => {
    mockWhereGet.mockResolvedValue({ docs: [] });
    const res = await GET(makeReq({ authorization: "Bearer test-secret" }));
    expect(res.status).toBe(200);
  });

  it("skips sending email when there are no pending applications", async () => {
    mockWhereGet.mockResolvedValue({ docs: [] });
    const res = await GET(makeReq({ "x-cron-secret": "test-secret" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { emailSent: boolean; pendingCount: number };
    expect(json.emailSent).toBe(false);
    expect(json.pendingCount).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("emails the digest when pending applications exist", async () => {
    mockWhereGet.mockResolvedValue({
      docs: [
        {
          id: "user-1",
          data: () => ({
            contactName: "Alice",
            email: "alice@example.com",
            phone: "555-0001",
            companyName: "Acme",
            companyWebsite: "https://acme.example.com",
            contactRole: "CEO",
            rolesHiring: "Founding eng",
            notes: "Pre-seed",
            createdAt: { toMillis: () => 1_700_000_000_000 },
          }),
        },
        {
          id: "user-2",
          data: () => ({
            contactName: "Bob",
            email: "bob@example.com",
            phone: "555-0002",
            createdAt: { toMillis: () => 1_700_000_001_000 },
          }),
        },
      ],
    });

    const res = await GET(makeReq({ "x-cron-secret": "test-secret" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { emailSent: boolean; pendingCount: number };
    expect(json.pendingCount).toBe(2);
    expect(json.emailSent).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const args = mockSendEmail.mock.calls[0][0];
    expect(args.to).toEqual(
      expect.arrayContaining([
        "rogerhunt02052@gmail.com",
        "aaron@cursorboston.com",
      ])
    );
    expect(args.subject).toContain("2 pending");
    expect(args.text).toContain("Alice");
    expect(args.text).toContain("Bob");
  });
});
