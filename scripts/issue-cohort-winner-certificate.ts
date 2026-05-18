/**
 * Issue a LinkedIn-ready Summer Cohort weekly winner certificate.
 *
 * Tallies votes for the given cohort/week (or accepts --handle override),
 * resolves the winner's Firebase user profile, and writes a unique certificate
 * doc to Firestore.
 *
 * Usage:
 *   npx tsx scripts/issue-cohort-winner-certificate.ts --cohort-id=cohort-1 --week-id=week-1 --dry-run
 *   npx tsx scripts/issue-cohort-winner-certificate.ts --cohort-id=cohort-1 --week-id=week-1 --apply
 *   npx tsx scripts/issue-cohort-winner-certificate.ts --cohort-id=cohort-1 --week-id=week-1 --handle=productchameleon --apply
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import {
  CERTIFICATES_COLLECTION,
  buildLinkedInAddToProfileUrl,
  getCertVerifyUrl,
  getCohortWinnerCertDocId,
  getCohortWinnerCertName,
  parseCertificateFromFirestore,
} from "../lib/certificate";
import {
  SUMMER_COHORT_VOTES_COLLECTION,
  isValidCohortId,
  type SummerCohortId,
} from "../lib/summer-cohort";

const VALID_WEEK_IDS = new Set(["week-1", "week-2", "week-3"]);

function readArg(name: string): string | null {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

function voteDocMatchesCohort(
  data: Record<string, unknown>,
  cohortId: SummerCohortId
): boolean {
  const docCohort =
    typeof data.cohortId === "string" ? data.cohortId : "cohort-1";
  return docCohort === cohortId;
}

async function tallyVotes(
  cohortId: SummerCohortId,
  weekId: string
): Promise<Array<[handle: string, count: number]>> {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin not configured");

  const snap = await db
    .collection(SUMMER_COHORT_VOTES_COLLECTION)
    .where("weekId", "==", weekId)
    .get();

  const counts: Record<string, number> = {};
  for (const doc of snap.docs) {
    const data = doc.data();
    if (!voteDocMatchesCohort(data, cohortId)) continue;
    const handle =
      typeof data.submitterHandle === "string"
        ? data.submitterHandle.toLowerCase()
        : null;
    if (!handle) continue;
    counts[handle] = (counts[handle] ?? 0) + 1;
  }

  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

async function findUserByGithubHandle(handle: string) {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin not configured");

  const target = handle.toLowerCase();
  const snap = await db.collection("users").get();
  for (const doc of snap.docs) {
    const data = doc.data();
    const login =
      data.github &&
      typeof data.github === "object" &&
      typeof (data.github as { login?: string }).login === "string"
        ? (data.github as { login: string }).login.trim().toLowerCase()
        : "";
    if (login === target) {
      return { uid: doc.id, data };
    }
  }
  return null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");
  if (dryRun === apply) {
    console.error("Pass exactly one of --dry-run or --apply");
    process.exit(1);
  }

  const rawCohort = readArg("cohort-id") ?? "cohort-1";
  if (!isValidCohortId(rawCohort)) {
    console.error("cohort-id must be cohort-1 or cohort-2");
    process.exit(1);
  }
  const cohortId = rawCohort;

  const weekId = readArg("week-id");
  if (!weekId || !VALID_WEEK_IDS.has(weekId)) {
    console.error("week-id must be one of week-1, week-2, week-3");
    process.exit(1);
  }

  const certName = getCohortWinnerCertName(cohortId, weekId);
  if (!certName) {
    console.error(`No LinkedIn cert name configured for ${cohortId} ${weekId}`);
    process.exit(1);
  }

  const handleOverride = readArg("handle")?.trim().toLowerCase() ?? null;
  const ranked = await tallyVotes(cohortId, weekId);
  const winnerHandle = handleOverride ?? ranked[0]?.[0] ?? null;
  const voteCount =
    ranked.find(([handle]) => handle === winnerHandle)?.[1] ?? ranked[0]?.[1] ?? 0;

  if (!winnerHandle) {
    console.error("No votes found for this cohort/week");
    process.exit(1);
  }

  const user = await findUserByGithubHandle(winnerHandle);
  if (!user) {
    console.error(
      `Winner @${winnerHandle} has no linked Firebase user — they must sign in and connect GitHub first`
    );
    process.exit(1);
  }

  const githubLogin =
    user.data.github &&
    typeof user.data.github === "object" &&
    typeof (user.data.github as { login?: string }).login === "string"
      ? (user.data.github as { login: string }).login.trim()
      : winnerHandle;
  const displayName =
    (typeof user.data.displayName === "string" && user.data.displayName.trim()) ||
    githubLogin;

  const certDocId = getCohortWinnerCertDocId(cohortId, weekId, user.uid);
  const certUrl = getCertVerifyUrl(certDocId);

  const payload = {
    id: certDocId,
    userId: user.uid,
    displayName,
    githubLogin,
    issuedAt: FieldValue.serverTimestamp(),
    certName,
    certUrl,
    kind: "cohort-winner" as const,
    cohortId,
    weekId,
    voteCount,
  };

  const summary = {
    mode: dryRun ? "dry-run" : "apply",
    cohortId,
    weekId,
    certName,
    winnerHandle,
    voteCount,
    displayName,
    githubLogin,
    userId: user.uid,
    certDocId,
    certUrl,
    voteTally: ranked,
  };

  if (dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured");
    process.exit(1);
  }

  const existing = await db.collection(CERTIFICATES_COLLECTION).doc(certDocId).get();
  if (existing.exists) {
    const parsed = parseCertificateFromFirestore(
      certDocId,
      existing.data() as Record<string, unknown>
    );
    if (parsed) {
      console.log(
        JSON.stringify(
          {
            ...summary,
            alreadyIssued: true,
            linkedInAddToProfileUrl: buildLinkedInAddToProfileUrl(parsed),
          },
          null,
          2
        )
      );
      return;
    }
  }

  await db.collection(CERTIFICATES_COLLECTION).doc(certDocId).set(payload);
  const created = await db.collection(CERTIFICATES_COLLECTION).doc(certDocId).get();
  const certificate = parseCertificateFromFirestore(
    certDocId,
    created.data() as Record<string, unknown>
  );
  if (!certificate) {
    console.error("Certificate write succeeded but read-back failed");
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        ...summary,
        alreadyIssued: false,
        linkedInAddToProfileUrl: buildLinkedInAddToProfileUrl(certificate),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
