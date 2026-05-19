import {
  COHORT_WINNER_CERT_NAMES,
  buildLinkedInAddToProfileUrl,
  getCohortWinnerCertDocId,
  getCohortWinnerCertName,
  listCertificatesForUser,
  parseCertificateFromFirestore,
} from "@/lib/certificate";

describe("cohort winner certificates", () => {
  it("maps cohort-1 week-1 to the PM winner LinkedIn title", () => {
    expect(getCohortWinnerCertName("cohort-1", "week-1")).toBe(
      COHORT_WINNER_CERT_NAMES["cohort-1"]?.["week-1"]
    );
    expect(getCohortWinnerCertName("cohort-1", "week-1")).toBe(
      "Cohort 1 Week 1 Best Project Management Tool"
    );
  });

  it("builds a unique doc id per cohort/week/user", () => {
    expect(getCohortWinnerCertDocId("cohort-1", "week-1", "uid123")).toBe(
      "cert_cohort-1_week-1_uid123"
    );
  });

  it("parses cohort winner certificates without pullRequestsCount", () => {
    const cert = parseCertificateFromFirestore("cert_cohort-1_week-1_uid123", {
      id: "cert_cohort-1_week-1_uid123",
      userId: "uid123",
      displayName: "Ying Chen",
      githubLogin: "ProductChameleon",
      issuedAt: "2026-05-18T00:00:00.000Z",
      certName: "Cohort 1 Week 1 Best Project Management Tool",
      certUrl: "https://cursorboston.com/certificate/verify/cert_cohort-1_week-1_uid123",
      kind: "cohort-winner",
      cohortId: "cohort-1",
      weekId: "week-1",
      voteCount: 9,
    });

    expect(cert).toMatchObject({
      kind: "cohort-winner",
      voteCount: 9,
      cohortId: "cohort-1",
      weekId: "week-1",
    });
    expect(cert?.pullRequestsCount).toBeUndefined();
  });

  it("builds a LinkedIn add-to-profile URL for cohort winner certs", () => {
    const linkedInUrl = buildLinkedInAddToProfileUrl({
      id: "cert_cohort-1_week-1_uid123",
      userId: "uid123",
      displayName: "Ying Chen",
      githubLogin: "ProductChameleon",
      issuedAt: "2026-05-18T00:00:00.000Z",
      certName: "Cohort 1 Week 1 Best Project Management Tool",
      certUrl: "https://cursorboston.com/certificate/verify/cert_cohort-1_week-1_uid123",
      kind: "cohort-winner",
      cohortId: "cohort-1",
      weekId: "week-1",
      voteCount: 9,
    });

    expect(linkedInUrl).toContain("linkedin.com/profile/add");
    expect(linkedInUrl).toContain("name=Cohort+1+Week+1+Best+Project+Management+Tool");
  });

  it("sorts cohort winner certificates ahead of contributor certificates", async () => {
    const db: any = {
      collection: jest.fn(() => ({
        where: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            docs: [
              {
                id: "cert_u1",
                data: () => ({
                  userId: "u1",
                  displayName: "Pat",
                  githubLogin: "pat",
                  pullRequestsCount: 12,
                  issuedAt: "2026-04-01T00:00:00.000Z",
                  kind: "contributor",
                }),
              },
              {
                id: "cert_cohort-1_week-1_u1",
                data: () => ({
                  userId: "u1",
                  displayName: "Pat",
                  githubLogin: "pat",
                  issuedAt: "2026-05-18T00:00:00.000Z",
                  certName: "Cohort 1 Week 1 Best Project Management Tool",
                  kind: "cohort-winner",
                  cohortId: "cohort-1",
                  weekId: "week-1",
                  voteCount: 9,
                }),
              },
            ],
          }),
        })),
      })),
    };

    const certs = await listCertificatesForUser(db, "u1");
    expect(certs.map((c) => c.kind)).toEqual(["cohort-winner", "contributor"]);
  });

  it("parseCertificateFromFirestore: returns null when required fields are missing", () => {
    expect(
      parseCertificateFromFirestore("c1", {
        userId: "u1",
        displayName: "Alice",
        // missing githubLogin
        issuedAt: "2026-05-19T00:00:00.000Z",
      }),
    ).toBeNull();
    expect(
      parseCertificateFromFirestore("c2", {
        userId: "u1",
        displayName: "Alice",
        githubLogin: "alice",
        // missing issuedAt
      }),
    ).toBeNull();
  });

  it("parseCertificateFromFirestore: accepts a Firestore Timestamp via toDate()", () => {
    const cert = parseCertificateFromFirestore("c3", {
      userId: "u1",
      displayName: "Alice",
      githubLogin: "alice",
      issuedAt: { toDate: () => new Date("2026-05-19T00:00:00.000Z") },
      kind: "contributor",
      pullRequestsCount: 4,
    });
    expect(cert?.issuedAt).toBe("2026-05-19T00:00:00.000Z");
  });

  it("parseCertificateFromFirestore: accepts a `seconds` epoch shape", () => {
    const cert = parseCertificateFromFirestore("c4", {
      userId: "u1",
      displayName: "Alice",
      githubLogin: "alice",
      issuedAt: { seconds: 1_700_000_000 },
      kind: "contributor",
      pullRequestsCount: 7,
    });
    expect(cert?.issuedAt).toBe(new Date(1_700_000_000 * 1000).toISOString());
  });

  it("parseCertificateFromFirestore: contributor missing pullRequestsCount returns null", () => {
    expect(
      parseCertificateFromFirestore("c5", {
        userId: "u1",
        displayName: "Alice",
        githubLogin: "alice",
        issuedAt: "2026-05-19T00:00:00.000Z",
        kind: "contributor",
      }),
    ).toBeNull();
  });

  it("parseCertificateFromFirestore: cohort-winner missing cohortId/weekId returns null", () => {
    expect(
      parseCertificateFromFirestore("c6", {
        userId: "u1",
        displayName: "Alice",
        githubLogin: "alice",
        issuedAt: "2026-05-19T00:00:00.000Z",
        kind: "cohort-winner",
        weekId: "week-1",
      }),
    ).toBeNull();
  });

  it("listCertificatesForUser: sorts contributor certs by issuedAt desc when kinds equal", async () => {
    const db: any = {
      collection: jest.fn(() => ({
        where: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({
            docs: [
              {
                id: "cert_old",
                data: () => ({
                  userId: "u1",
                  displayName: "Pat",
                  githubLogin: "pat",
                  pullRequestsCount: 5,
                  issuedAt: "2026-01-01T00:00:00.000Z",
                  kind: "contributor",
                }),
              },
              {
                id: "cert_new",
                data: () => ({
                  userId: "u1",
                  displayName: "Pat",
                  githubLogin: "pat",
                  pullRequestsCount: 12,
                  issuedAt: "2026-04-01T00:00:00.000Z",
                  kind: "contributor",
                }),
              },
            ],
          }),
        })),
      })),
    };
    const certs = await listCertificatesForUser(db, "u1");
    expect(certs.map((c) => c.id)).toEqual(["cert_new", "cert_old"]);
  });
});
