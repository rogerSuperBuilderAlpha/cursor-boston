/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/newsletter/tips/route";

jest.mock("@/lib/logger", () => ({
  logger: { logError: jest.fn() },
}));

const mockGetLatestScheduledTip = jest.fn();
const mockUpdateTipStatus = jest.fn();
jest.mock("@/lib/tips", () => ({
  getLatestScheduledTip: () => mockGetLatestScheduledTip(),
  updateTipStatus: (...args: unknown[]) => mockUpdateTipStatus(...args),
}));

const mockGetActiveSubscribers = jest.fn();
jest.mock("@/lib/tip-subscribers", () => ({
  getActiveSubscribers: () => mockGetActiveSubscribers(),
}));

const mockSendEmail = jest.fn();
jest.mock("@/lib/mailgun", () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

jest.mock("@/lib/unsubscribe-token", () => ({
  buildUnsubscribeUrl: jest.fn((email: string) => `https://cursorboston.com/unsub?email=${email}`),
}));

const CRON_SECRET = "test-secret";

function makeRequest() {
  return new NextRequest("http://localhost/api/newsletter/tips", {
    method: "POST",
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
}

describe("POST /api/newsletter/tips", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = CRON_SECRET;
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("returns 401 without valid secret", async () => {
    const req = new NextRequest("http://localhost/api/newsletter/tips", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-secret" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns success when no scheduled tip found", async () => {
    mockGetLatestScheduledTip.mockResolvedValue(null);
    const res = await POST(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toContain("No scheduled tip");
  });

  it("returns success when no subscribers", async () => {
    mockGetLatestScheduledTip.mockResolvedValue({
      id: "tip-1",
      title: "Test Tip",
      content: "Content",
      authorName: "Alice",
    });
    mockGetActiveSubscribers.mockResolvedValue([]);

    const res = await POST(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toContain("No active subscribers");
  });

  it("sends emails and updates tip status", async () => {
    mockGetLatestScheduledTip.mockResolvedValue({
      id: "tip-1",
      title: "Test Tip",
      content: "Content",
      authorName: "Alice",
    });
    mockGetActiveSubscribers.mockResolvedValue([
      { email: "bob@example.com" },
      { email: "carol@example.com" },
    ]);
    mockSendEmail.mockResolvedValue(undefined);
    mockUpdateTipStatus.mockResolvedValue(undefined);

    const res = await POST(makeRequest());
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.sent).toBe(2);
    expect(data.failed).toBe(0);
    expect(data.tipId).toBe("tip-1");
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    expect(mockUpdateTipStatus).toHaveBeenCalledWith(
      "tip-1",
      "published",
      expect.objectContaining({ publishedAt: expect.any(String) })
    );
  });

  it("counts failures without crashing", async () => {
    mockGetLatestScheduledTip.mockResolvedValue({
      id: "tip-2",
      title: "Tip",
      content: "Content",
      authorName: "Bob",
    });
    mockGetActiveSubscribers.mockResolvedValue([
      { email: "fail@example.com" },
      { email: "ok@example.com" },
    ]);
    mockSendEmail
      .mockRejectedValueOnce(new Error("Mailgun error"))
      .mockResolvedValueOnce(undefined);
    mockUpdateTipStatus.mockResolvedValue(undefined);

    const res = await POST(makeRequest());
    const data = await res.json();

    expect(data.sent).toBe(1);
    expect(data.failed).toBe(1);
  });
});
