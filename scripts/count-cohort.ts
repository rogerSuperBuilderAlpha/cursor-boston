import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { getAdminDb } from "../lib/firebase-admin";
import { SUMMER_COHORT_COLLECTION } from "../lib/summer-cohort";

async function main() {
  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }
  const snap = await db.collection(SUMMER_COHORT_COLLECTION).get();
  let total = 0;
  let cohort1 = 0;
  let cohort1Admitted = 0;
  let cohort1Pending = 0;
  let cohort1Withdrawn = 0;
  let cohort1Other: Record<string, number> = {};
  let withdrawn = 0;
  for (const doc of snap.docs) {
    total++;
    const d = doc.data();
    const cohorts: string[] = Array.isArray(d.cohorts) ? d.cohorts : [];
    const status: string = typeof d.status === "string" ? d.status : "";
    if (status === "withdrawn") withdrawn++;
    if (cohorts.includes("cohort-1")) {
      cohort1++;
      if (status === "admitted") cohort1Admitted++;
      else if (status === "pending") cohort1Pending++;
      else if (status === "withdrawn") cohort1Withdrawn++;
      else cohort1Other[status || "<empty>"] = (cohort1Other[status || "<empty>"] || 0) + 1;
    }
  }
  console.log(JSON.stringify({
    total,
    withdrawnAll: withdrawn,
    cohort1,
    cohort1Admitted,
    cohort1Pending,
    cohort1Withdrawn,
    cohort1Other,
  }, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
