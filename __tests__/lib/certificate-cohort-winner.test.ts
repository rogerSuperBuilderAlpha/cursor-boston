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
});
