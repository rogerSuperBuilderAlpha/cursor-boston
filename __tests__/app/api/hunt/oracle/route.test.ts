/**
 * @jest-environment node
 */

import { createHash } from "crypto";
import { GET as getOracle } from "@/app/api/hunt/oracle/route";
import { GET as getKonami } from "@/app/api/hunt/oracle/konami/route";
import { getKonamiToken, getOracleAnswer } from "@/lib/treasure-hunt-paths";

const KONAMI_SEQUENCE = "UUDDLRLRBA";

function konamiRequest(sequence?: string) {
  const headers: Record<string, string> = {};
  if (sequence !== undefined) {
    headers["X-Konami-Sequence"] = sequence;
  }
  return new Request("http://localhost/api/hunt/oracle/konami", { headers });
}

describe("GET /api/hunt/oracle", () => {
  it("returns 200 with riddle, dateUtc, and answerFingerprint", async () => {
    const res = await getOracle();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(typeof body.riddle).toBe("string");
    expect(body.riddle.length).toBeGreaterThan(0);
    expect(body.dateUtc).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof body.answerFingerprint).toBe("string");
    expect(body.answerFingerprint).toHaveLength(16);
  });

  it("uses today's UTC date", async () => {
    const res = await getOracle();
    const body = await res.json();
    const expected = new Date().toISOString().slice(0, 10);
    expect(body.dateUtc).toBe(expected);
  });

  it("fingerprints the daily oracle answer (first 16 hex of sha256)", async () => {
    const res = await getOracle();
    const body = await res.json();
    const expected = createHash("sha256")
      .update(getOracleAnswer())
      .digest("hex")
      .slice(0, 16);
    expect(body.answerFingerprint).toBe(expected);
  });

  it("does not expose the full oracle answer in the response", async () => {
    const res = await getOracle();
    const body = await res.json();
    const fullAnswer = getOracleAnswer();
    expect(body).not.toHaveProperty("answer", fullAnswer);
    expect(body).not.toHaveProperty("token", fullAnswer);
  });
});

describe("GET /api/hunt/oracle/konami", () => {
  it("returns 404 when X-Konami-Sequence header is missing", async () => {
    const res = await getKonami(konamiRequest());
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("Not found");
  });

  it("returns 404 for an incorrect sequence", async () => {
    const res = await getKonami(konamiRequest("WRONG"));
    expect(res.status).toBe(404);
  });

  it("returns the daily token when sequence is correct", async () => {
    const res = await getKonami(konamiRequest(KONAMI_SEQUENCE));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.token).toBe(getKonamiToken());
    expect(body.token).toMatch(/^[0-9a-f]{12}$/);
  });

  it("is case-sensitive for the Konami sequence header", async () => {
    const res = await getKonami(konamiRequest(KONAMI_SEQUENCE.toLowerCase()));
    expect(res.status).toBe(404);
  });
});
