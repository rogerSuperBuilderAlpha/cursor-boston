/**
 * @jest-environment node
 */
jest.mock("@/lib/logger", () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    logError: jest.fn(),
  },
}));

const originalFetch = global.fetch;

async function loadDiscord(envWebhook: string | null) {
  if (envWebhook === null) {
    delete process.env.DISCORD_WEBHOOK_URL_PR;
  } else {
    process.env.DISCORD_WEBHOOK_URL_PR = envWebhook;
  }
  let mod: typeof import("@/lib/discord");
  await jest.isolateModulesAsync(async () => {
    mod = await import("@/lib/discord");
  });
  return mod!;
}

describe("lib/discord", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
    delete process.env.DISCORD_WEBHOOK_URL_PR;
  });

  describe("DISCORD_COLORS", () => {
    it("exposes BLUE / GREEN / RED / YELLOW as numeric color codes", async () => {
      const { DISCORD_COLORS } = await loadDiscord(null);
      expect(DISCORD_COLORS).toEqual({
        BLUE: 0x5865f2,
        GREEN: 0x57f287,
        RED: 0xed4245,
        YELLOW: 0xfee75c,
      });
    });
  });

  describe("sendDiscordNotification", () => {
    it("returns false when no webhook URL is configured (env unset, no override)", async () => {
      const { sendDiscordNotification } = await loadDiscord(null);
      const ok = await sendDiscordNotification({ title: "T" });
      expect(ok).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("uses the env webhook URL when no override is given", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
      });
      const { sendDiscordNotification } = await loadDiscord("https://discord/env");
      const ok = await sendDiscordNotification({ title: "Hi" });
      expect(ok).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://discord/env",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("accepts an explicit webhookUrl override", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });
      const { sendDiscordNotification } = await loadDiscord(null);
      await sendDiscordNotification(
        { title: "Hi" },
        { webhookUrl: "https://discord/override" },
      );
      expect(global.fetch).toHaveBeenCalledWith(
        "https://discord/override",
        expect.anything(),
      );
    });

    it("sets default username='Cursor Boston Bot' when none provided", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });
      const { sendDiscordNotification } = await loadDiscord(null);
      await sendDiscordNotification(
        { title: "Hi" },
        { webhookUrl: "https://discord/x" },
      );
      const body = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body as string,
      );
      expect(body.username).toBe("Cursor Boston Bot");
      expect(body.embeds).toEqual([{ title: "Hi" }]);
    });

    it("honors explicit username + avatarUrl overrides", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });
      const { sendDiscordNotification } = await loadDiscord(null);
      await sendDiscordNotification(
        { title: "Hi" },
        {
          webhookUrl: "https://discord/x",
          username: "Tester",
          avatarUrl: "https://x/a.png",
        },
      );
      const body = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body as string,
      );
      expect(body.username).toBe("Tester");
      expect(body.avatar_url).toBe("https://x/a.png");
    });

    it("returns false when the webhook responds non-2xx", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      });
      const { sendDiscordNotification } = await loadDiscord(null);
      const ok = await sendDiscordNotification(
        { title: "Hi" },
        { webhookUrl: "https://discord/x" },
      );
      expect(ok).toBe(false);
    });

    it("returns false and logs when fetch throws", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("ECONNRESET"));
      const { sendDiscordNotification } = await loadDiscord(null);
      const ok = await sendDiscordNotification(
        { title: "Hi" },
        { webhookUrl: "https://discord/x" },
      );
      expect(ok).toBe(false);
    });
  });

  describe("notifyPROpened", () => {
    it("builds the BLUE-colored embed with Author + Repository fields", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });
      const { notifyPROpened, DISCORD_COLORS } = await loadDiscord("https://d");
      await notifyPROpened({
        number: 7,
        title: "Feat: add X",
        authorLogin: "alice",
        url: "https://github.com/x/y/pull/7",
        repository: "x/y",
      });
      const body = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body as string,
      );
      const embed = body.embeds[0];
      expect(embed.title).toBe("New Pull Request #7");
      expect(embed.color).toBe(DISCORD_COLORS.BLUE);
      expect(embed.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: "Author",
            value: "[@alice](https://github.com/alice)",
          }),
          expect.objectContaining({
            name: "Repository",
            value: "[x/y](https://github.com/x/y)",
          }),
        ]),
      );
      expect(embed.author).toBeUndefined();
    });

    it("attaches author block when authorAvatarUrl is provided", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });
      const { notifyPROpened } = await loadDiscord("https://d");
      await notifyPROpened({
        number: 7,
        title: "T",
        authorLogin: "alice",
        authorAvatarUrl: "https://avatar/a.png",
        url: "https://x",
        repository: "x/y",
      });
      const body = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body as string,
      );
      expect(body.embeds[0].author).toEqual({
        name: "alice",
        url: "https://github.com/alice",
        icon_url: "https://avatar/a.png",
      });
    });
  });

  describe("notifyPRMerged", () => {
    it("builds the GREEN-colored embed and uses prData.mergedAt as the timestamp", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });
      const { notifyPRMerged, DISCORD_COLORS } = await loadDiscord("https://d");
      const mergedAt = "2026-05-01T12:00:00.000Z";
      await notifyPRMerged({
        number: 99,
        title: "M",
        authorLogin: "bob",
        url: "https://github.com/x/y/pull/99",
        repository: "x/y",
        mergedAt,
      });
      const body = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body as string,
      );
      const embed = body.embeds[0];
      expect(embed.title).toBe("Pull Request Merged #99");
      expect(embed.color).toBe(DISCORD_COLORS.GREEN);
      expect(embed.timestamp).toBe(mergedAt);
    });

    it("falls back to current time when mergedAt is omitted", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });
      const { notifyPRMerged } = await loadDiscord("https://d");
      await notifyPRMerged({
        number: 1,
        title: "T",
        authorLogin: "a",
        url: "https://x",
        repository: "x/y",
      });
      const body = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body as string,
      );
      expect(body.embeds[0].timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      );
    });

    it("attaches author block when authorAvatarUrl is provided", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });
      const { notifyPRMerged } = await loadDiscord("https://d");
      await notifyPRMerged({
        number: 1,
        title: "T",
        authorLogin: "a",
        authorAvatarUrl: "https://avatar/a.png",
        url: "https://x",
        repository: "x/y",
      });
      const body = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body as string,
      );
      expect(body.embeds[0].author).toMatchObject({ name: "a" });
    });
  });

  describe("notifyHackASprintSubmissionMerged", () => {
    it("emits the submission-style title + emerald color when submissionLogins is non-empty", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });
      const { notifyHackASprintSubmissionMerged } = await loadDiscord("https://d");
      await notifyHackASprintSubmissionMerged({
        number: 200,
        title: "merge submission",
        authorLogin: "bot",
        url: "https://x",
        repository: "r",
        submissionLogins: ["alice", "bob"],
      });
      const body = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body as string,
      );
      const embed = body.embeds[0];
      expect(embed.title).toBe("Hack-a-Sprint Submission Merged — PR #200");
      expect(embed.color).toBe(0x10b981);
      const descLines = embed.description.split("\n");
      expect(descLines[0]).toContain("submissions from");
      expect(descLines[0]).toContain("**alice**, **bob**");
      expect(embed.description).toContain("git rebase upstream/develop");
      expect(embed.fields.some((f: { name: string }) => f.name === "Submissions")).toBe(true);
    });

    it("singular description when exactly one submission login", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });
      const { notifyHackASprintSubmissionMerged } = await loadDiscord("https://d");
      await notifyHackASprintSubmissionMerged({
        number: 201,
        title: "t",
        authorLogin: "bot",
        url: "https://x",
        repository: "r",
        submissionLogins: ["alice"],
      });
      const body = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body as string,
      );
      expect(body.embeds[0].description.split("\n")[0]).toMatch(
        /^New submission from \*\*alice\*\*/,
      );
    });

    it("emits the merged-to-main fallback title + GREEN color when no submissions", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });
      const { notifyHackASprintSubmissionMerged, DISCORD_COLORS } =
        await loadDiscord("https://d");
      await notifyHackASprintSubmissionMerged({
        number: 300,
        title: "regular merge",
        authorLogin: "bot",
        url: "https://x",
        repository: "r",
        submissionLogins: [],
      });
      const body = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body as string,
      );
      const embed = body.embeds[0];
      expect(embed.title).toBe("Merged to Main — PR #300");
      expect(embed.color).toBe(DISCORD_COLORS.GREEN);
      expect(embed.fields.some((f: { name: string }) => f.name === "Submissions")).toBe(false);
    });

    it("attaches author block when authorAvatarUrl provided", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });
      const { notifyHackASprintSubmissionMerged } = await loadDiscord("https://d");
      await notifyHackASprintSubmissionMerged({
        number: 200,
        title: "T",
        authorLogin: "bot",
        authorAvatarUrl: "https://avatar/b.png",
        url: "https://x",
        repository: "r",
        submissionLogins: [],
      });
      const body = JSON.parse(
        (global.fetch as jest.Mock).mock.calls[0][1].body as string,
      );
      expect(body.embeds[0].author).toMatchObject({ name: "bot" });
    });
  });
});
