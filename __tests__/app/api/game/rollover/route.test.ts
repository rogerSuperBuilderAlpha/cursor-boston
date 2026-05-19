/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — cron POST /api/game/rollover secret guard + summary.
 */
import { POST } from "@/app/api/game/rollover/route";
import { runWeeklyRolloverServer } from "@/lib/game/data-server";
import { makeRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/game/data-server", () => ({
  runWeeklyRolloverServer: jest.fn(),
}));

const mockRunRollover = runWeeklyRolloverServer as jest.MockedFunction<typeof runWeeklyRolloverServer>;

const SECRET = "weekly-rollover-test-secret";

describe("POST /api/game/rollover", () => {
  const prev = process.env.GAME_ROLLOVER_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GAME_ROLLOVER_SECRET = SECRET;
    mockRunRollover.mockResolvedValue({ playersGranted: 2 } as never);
  });

  afterAll(() => {
    if (prev === undefined) delete process.env.GAME_ROLLOVER_SECRET;
    else process.env.GAME_ROLLOVER_SECRET = prev;
  });

  it("returns 500 when GAME_ROLLOVER_SECRET is not configured", async () => {
    delete process.env.GAME_ROLLOVER_SECRET;
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/rollover",
        headers: { "x-rollover-secret": SECRET },
      }),
    );
    expect(res.status).toBe(500);
    expect(mockRunRollover).not.toHaveBeenCalled();
    process.env.GAME_ROLLOVER_SECRET = SECRET;
  });

  it("returns 403 when secret does not match", async () => {
    const res = await POST(
      makeRequest({
        method: "POST",
        path: "/api/game/rollover",
        headers: { "x-rollover-secret": "wrong" },
      }),
    );
    expect(res.status).toBe(403);
    expect(mockRunRollover).not.toHaveBeenCalled();
  });

  it("returns 200 with summary when secret matches", async () => {
    const { status, body } = await readJson(
      await POST(
        makeRequest({
          method: "POST",
          path: "/api/game/rollover",
          searchParams: { weekStartIso: "2026-05-11" },
          headers: { "x-rollover-secret": SECRET },
        }),
      ),
    );
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, summary: { playersGranted: 2 } });
    expect(mockRunRollover).toHaveBeenCalledWith("2026-05-11");
  });
});
