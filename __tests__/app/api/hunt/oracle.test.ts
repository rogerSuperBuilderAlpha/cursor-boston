/**
 * @jest-environment node
 */

import { createHash } from "crypto";
import { GET as getOracle } from "@/app/api/hunt/oracle/route";
import { GET as getKonamiOracle } from "@/app/api/hunt/oracle/konami/route";
import { getKonamiToken, getOracleAnswer } from "@/lib/treasure-hunt-paths";

function todayUtcDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

describe("GET /api/hunt/oracle", () => {
  it("returns 200 with riddle, dateUtc, and answerFingerprint", async () => {
    const res = await getOracle();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(typeof body.riddle).toBe("string");
    expect(body.riddle.length).toBeGreaterThan(0);
    expect(body.dateUtc).toBe(todayUtcDateStr());
    expect(typeof body.answerFingerprint).toBe("string");
    expect(body.answerFingerprint).toMatch(/^[a-f0-9]{16}$/);
  });

  it("derives answerFingerprint from today's oracle answer", async () => {
    const res = await getOracle();
    const body = await res.json();

    const expected = createHash("sha256")
      .update(getOracleAnswer())
      .digest("hex")
      .slice(0, 16);

    expect(body.answerFingerprint).toBe(expected);
  });

  it("points submitters at the oracle submit path", async () => {
    const res = await getOracle();
    const body = await res.json();

    expect(body.riddle).toContain("/api/hunt/paths/oracle/submit");
  });

  it("does not require authentication", async () => {
    const res = await getOracle();
    expect(res.status).toBe(200);
  });
});

describe("GET /api/hunt/oracle/konami", () => {
  it("returns 404 when the Konami sequence header is missing", async () => {
    const res = await getKonamiOracle(new Request("http://localhost/api/hunt/oracle/konami"));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Not found");
  });

  it("returns 404 when the Konami sequence header is wrong", async () => {
    const res = await getKonamiOracle(
      new Request("http://localhost/api/hunt/oracle/konami", {
        headers: { "x-konami-sequence": "WRONG" },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Not found");
  });

  it("returns 404 for a partial Konami sequence", async () => {
    const res = await getKonamiOracle(
      new Request("http://localhost/api/hunt/oracle/konami", {
        headers: { "x-konami-sequence": "UUDDLR" },
      }),
    );

    expect(res.status).toBe(404);
  });

  it("returns the daily token when the correct sequence header is sent", async () => {
    const res = await getKonamiOracle(
      new Request("http://localhost/api/hunt/oracle/konami", {
        headers: { "x-konami-sequence": "UUDDLRLRBA" },
      }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.token).toBe(getKonamiToken());
    expect(body.token).toMatch(/^[a-f0-9]{12}$/);
  });

  it("does not require Firebase authentication", async () => {
    const res = await getKonamiOracle(
      new Request("http://localhost/api/hunt/oracle/konami", {
        headers: { "x-konami-sequence": "UUDDLRLRBA" },
      }),
    );

    expect(res.status).toBe(200);
  });
});
