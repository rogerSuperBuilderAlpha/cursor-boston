/**
 * @jest-environment node
 *
 * OpenSSF Silver coverage — game npc-weekly cron secret guards.
 */
import { POST } from "@/app/api/game/npc-weekly/route";
import { runNpcWeeklyServer } from "@/lib/game/npc-weekly";
import { makeCronRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/game/npc-weekly", () => ({
  runNpcWeeklyServer: jest.fn(),
}));

const mockRunNpcWeekly = runNpcWeeklyServer as jest.MockedFunction<typeof runNpcWeeklyServer>;

const ROLLOVER_SECRET = "test-rollover-secret";

describe("POST /api/game/npc-weekly", () => {
  const prevSecret = process.env.GAME_ROLLOVER_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GAME_ROLLOVER_SECRET = ROLLOVER_SECRET;
    mockRunNpcWeekly.mockResolvedValue({ processed: 3, skipped: 1 } as never);
  });

  afterAll(() => {
    if (prevSecret === undefined) delete process.env.GAME_ROLLOVER_SECRET;
    else process.env.GAME_ROLLOVER_SECRET = prevSecret;
  });

  it("returns 500 when rollover secret is not configured", async () => {
    delete process.env.GAME_ROLLOVER_SECRET;
    const res = await POST(
      makeCronRequest({
        method: "POST",
        path: "/api/game/npc-weekly",
        secret: ROLLOVER_SECRET,
        headers: { "x-rollover-secret": ROLLOVER_SECRET },
      }),
    );
    expect(res.status).toBe(500);
  });

  it("returns 403 when secret header is wrong", async () => {
    const res = await POST(
      makeCronRequest({
        method: "POST",
        path: "/api/game/npc-weekly",
        headers: { "x-rollover-secret": "wrong-secret" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 200 summary when secret matches", async () => {
    const { status, body } = await readJson(
      await POST(
        makeCronRequest({
          method: "POST",
          path: "/api/game/npc-weekly",
          searchParams: { dryRun: "1" },
          headers: { "x-rollover-secret": ROLLOVER_SECRET },
        }),
      ),
    );

    expect(status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      summary: { processed: 3, skipped: 1 },
    });
    expect(mockRunNpcWeekly).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: true }),
    );
  });
});
