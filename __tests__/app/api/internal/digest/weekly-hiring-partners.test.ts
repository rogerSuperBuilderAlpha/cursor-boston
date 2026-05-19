/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/internal/digest/weekly-hiring-partners/route";
import { sendEmail } from "@/lib/mailgun";
import { getAdminDb } from "@/lib/firebase-admin";

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

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), logError: jest.fn() },
}));

const mockSendEmail = sendEmail as jest.MockedFunction<typeof sendEmail>;
const mockGetAdminDb = getAdminDb as jest.MockedFunction<typeof getAdminDb>;

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

  it("returns 500 when CRON_SECRET env is missing", async () => {
    const saved = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    try {
      const res = await GET(makeReq({ "x-cron-secret": "anything" }));
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toContain("CRON_SECRET not set");
    } finally {
      if (saved !== undefined) process.env.CRON_SECRET = saved;
    }
  });

  it("returns 500 when admin db is unavailable", async () => {
    mockGetAdminDb.mockReturnValueOnce(null as never);
    const res = await GET(makeReq({ "x-cron-secret": "test-secret" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Server not configured");
  });

  it("formats null appliedAtMs as '(unknown date)' in the rendered text", async () => {
    mockWhereGet.mockResolvedValue({
      docs: [
        {
          id: "user-no-date",
          data: () => ({
            contactName: "Carol",
            email: "carol@example.com",
            // No createdAt → toMillis undefined → appliedAtMs is null
          }),
        },
      ],
    });
    const res = await GET(makeReq({ "x-cron-secret": "test-secret" }));
    expect(res.status).toBe(200);
    const args = mockSendEmail.mock.calls[0][0];
    expect(args.text).toContain("(unknown date)");
  });

  it("returns 500 with the error message when the firestore query throws", async () => {
    mockWhereGet.mockRejectedValueOnce(new Error("firestore down"));
    const res = await GET(makeReq({ "x-cron-secret": "test-secret" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe("firestore down");
  });

  it("returns 500 with stringified non-Error throw", async () => {
    mockWhereGet.mockRejectedValueOnce("hard-failure-string");
    const res = await GET(makeReq({ "x-cron-secret": "test-secret" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("hard-failure-string");
  });

  it("escapes HTML special chars in row fields", async () => {
    mockWhereGet.mockResolvedValue({
      docs: [
        {
          id: "user-evil",
          data: () => ({
            contactName: "<script>alert(1)</script>",
            email: "evil@example.com",
            companyWebsite: "https://x.example.com?a=1&b=2",
            rolesHiring: "ops & \"engineering\"",
            notes: "needs 'help'",
            createdAt: { toMillis: () => 1_700_000_000_000 },
          }),
        },
      ],
    });
    const res = await GET(makeReq({ "x-cron-secret": "test-secret" }));
    expect(res.status).toBe(200);
    const args = mockSendEmail.mock.calls[0][0];
    const html = args.html ?? "";
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&amp;b=2");
    expect(html).toContain("&quot;engineering&quot;");
    expect(html).toContain("&#39;help&#39;");
  });
});

describe("POST /api/internal/digest/weekly-hiring-partners", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shares the same handler — accepts cron secret and returns 200", async () => {
    mockWhereGet.mockResolvedValue({ docs: [] });
    const res = await POST(makeReq({ "x-cron-secret": "test-secret" }));
    expect(res.status).toBe(200);
  });

  it("returns 401 unauthorized without secret", async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
  });
});
