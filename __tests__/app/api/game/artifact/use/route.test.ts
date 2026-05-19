/**
 * @jest-environment node
 */
import { POST } from "@/app/api/game/artifact/use/route";
import { spendArtifactServer } from "@/lib/game/data-server";
import { getVerifiedUser } from "@/lib/server-auth";
import { makeAuthedRequest, readJson } from "@/__tests__/_helpers/route-test-utils";

jest.mock("@/lib/server-auth", () => ({ getVerifiedUser: jest.fn() }));
jest.mock("@/lib/game/data-server", () => ({
  spendArtifactServer: jest.fn(),
}));

describe("POST /api/game/artifact/use", () => {
  it("returns 200 when artifact is spent", async () => {
    (getVerifiedUser as jest.Mock).mockResolvedValue({ uid: "u1", email: "u@test.com", name: "U" });
    (spendArtifactServer as jest.Mock).mockResolvedValue({
      player: { userId: "u1" },
      report: { kind: "artifact" },
    });
    const { status } = await readJson(
      await POST(
        makeAuthedRequest({
          method: "POST",
          path: "/api/game/artifact/use",
          body: { artifactId: "art-1" },
        }),
      ),
    );
    expect(status).toBe(200);
  });
});
