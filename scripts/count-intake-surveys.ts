import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { getAdminDb } from "../lib/firebase-admin";
import { SUMMER_COHORT_INTAKE_COLLECTION } from "../lib/summer-cohort-intake";
import { SUMMER_COHORT_COLLECTION } from "../lib/summer-cohort";

async function main() {
  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  const snap = await db.collection(SUMMER_COHORT_INTAKE_COLLECTION).get();
  console.log(`Total intake survey docs: ${snap.size}`);

  const byCohort: Record<string, number> = {};
  const versions: Record<string, number> = {};
  let consentYes = 0;
  let consentNo = 0;
  const emails = new Set<string>();
  for (const d of snap.docs) {
    const data = d.data();
    const c = (data.cohort as string) || "<missing>";
    byCohort[c] = (byCohort[c] || 0) + 1;
    const v = (data.surveyVersion as string) || "<missing>";
    versions[v] = (versions[v] || 0) + 1;
    if (data.consentToResearch === true) consentYes++;
    else consentNo++;
    if (typeof data.email === "string") emails.add(data.email.toLowerCase());
  }
  console.log("By cohort field:", byCohort);
  console.log("By surveyVersion:", versions);
  console.log(`Consent yes: ${consentYes} | consent no/missing: ${consentNo}`);
  console.log(`Unique emails on intake docs: ${emails.size}`);

  const appsSnap = await db.collection(SUMMER_COHORT_COLLECTION).get();
  let c1Eligible = 0;
  let c1WithSurvey = 0;
  let c1AdmittedEligible = 0;
  let c1AdmittedWithSurvey = 0;
  for (const d of appsSnap.docs) {
    const data = d.data();
    const cohorts = Array.isArray(data.cohorts) ? data.cohorts : [];
    if (!cohorts.includes("cohort-1")) continue;
    const status = (data.status as string) || "pending";
    if (status !== "pending" && status !== "admitted") continue;
    c1Eligible++;
    if (status === "admitted") c1AdmittedEligible++;
    const email = (data.email || "").toString().trim().toLowerCase();
    const has = !!email && emails.has(email);
    if (has) {
      c1WithSurvey++;
      if (status === "admitted") c1AdmittedWithSurvey++;
    }
  }
  console.log(
    `Cohort-1 (pending+admitted) with intake survey: ${c1WithSurvey} / ${c1Eligible}`
  );
  console.log(
    `Cohort-1 admitted with intake survey: ${c1AdmittedWithSurvey} / ${c1AdmittedEligible}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
