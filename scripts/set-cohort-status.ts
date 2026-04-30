#!/usr/bin/env node
/**
 * Admin script: flip the status field on Summer Cohort applications.
 *
 * Usage:
 *   # show every applicant + current status
 *   npx tsx scripts/set-cohort-status.ts --list
 *
 *   # flip a set of people to "admitted" (or waitlist / rejected / pending)
 *   npx tsx scripts/set-cohort-status.ts --status=admitted \
 *     --emails=alice@example.com,bob@example.com --dry-run
 *   npx tsx scripts/set-cohort-status.ts --status=admitted \
 *     --emails=alice@example.com,bob@example.com --apply
 *
 *   # or use a file (one email or uid per line, # comments allowed)
 *   npx tsx scripts/set-cohort-status.ts --status=admitted \
 *     --file=admit-may10.txt --apply
 *
 *   # match by uid instead of email
 *   npx tsx scripts/set-cohort-status.ts --status=waitlist --uids=abc,def --apply
 *
 * Idempotent: if the status is already what you're setting, no write happens.
 * Stamps `statusUpdatedAt` on every actual write.
 *
 * Requires: FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { readFileSync } from "node:fs";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { SUMMER_COHORT_COLLECTION } from "../lib/summer-cohort";

type Status = "pending" | "admitted" | "rejected" | "waitlist";
const ALLOWED_STATUSES: ReadonlySet<Status> = new Set([
  "pending",
  "admitted",
  "rejected",
  "waitlist",
]);

function getArg(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function readIdentifiersFromFile(path: string): string[] {
  const text = readFileSync(path, "utf8");
  return text
    .split(/\r?\n/)
    .map((line) => line.split("#")[0].trim())
    .filter((line) => line.length > 0);
}

async function listAll() {
  const db = getAdminDb();
  if (!db) throw new Error("Firebase Admin not configured");

  const snap = await db
    .collection(SUMMER_COHORT_COLLECTION)
    .orderBy("createdAt", "asc")
    .get();

  const counts: Record<string, number> = {};
  console.log(`\n${snap.size} application(s):\n`);
  console.log(
    `  ${"NAME".padEnd(26)}  ${"EMAIL".padEnd(36)}  ${"COHORTS".padEnd(20)}  STATUS`
  );
  for (const doc of snap.docs) {
    const d = doc.data();
    const status = (d.status || "pending") as string;
    counts[status] = (counts[status] || 0) + 1;
    const name = (d.name || "").toString().slice(0, 26).padEnd(26);
    const email = (d.email || "").toString().slice(0, 36).padEnd(36);
    const cohorts = (Array.isArray(d.cohorts) ? d.cohorts : [])
      .join(", ")
      .padEnd(20);
    console.log(`  ${name}  ${email}  ${cohorts}  ${status}`);
  }
  console.log("\nBy status:");
  for (const [s, n] of Object.entries(counts)) console.log(`  ${s}: ${n}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--list")) {
    await listAll();
    return;
  }

  const status = getArg("status") as Status | null;
  if (!status || !ALLOWED_STATUSES.has(status)) {
    console.error(
      `--status is required and must be one of: ${Array.from(ALLOWED_STATUSES).join(", ")}`
    );
    process.exit(1);
  }

  const dryRun = args.includes("--dry-run");
  const apply = args.includes("--apply");
  if (dryRun === apply) {
    console.error("Specify exactly one of: --dry-run | --apply");
    process.exit(1);
  }

  const emailsArg = getArg("emails");
  const uidsArg = getArg("uids");
  const fileArg = getArg("file");
  const identifiers = new Set<string>();
  if (emailsArg) emailsArg.split(",").forEach((e) => identifiers.add(e.trim().toLowerCase()));
  if (uidsArg) uidsArg.split(",").forEach((u) => identifiers.add(u.trim()));
  if (fileArg) readIdentifiersFromFile(fileArg).forEach((v) => identifiers.add(v.trim().toLowerCase()));
  if (identifiers.size === 0) {
    console.error("Provide --emails=, --uids=, or --file=");
    process.exit(1);
  }

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured");
    process.exit(1);
  }

  const snap = await db.collection(SUMMER_COHORT_COLLECTION).get();
  const byEmail = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  const byUid = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  for (const doc of snap.docs) {
    const data = doc.data();
    const email = (data.email || "").toString().trim().toLowerCase();
    if (email) byEmail.set(email, doc);
    byUid.set(doc.id, doc);
    if (typeof data.userId === "string") byUid.set(data.userId, doc);
  }

  const matched: { id: string; email: string; name: string; current: string }[] = [];
  const missing: string[] = [];
  for (const ident of identifiers) {
    const doc = byEmail.get(ident) ?? byUid.get(ident);
    if (!doc) {
      missing.push(ident);
      continue;
    }
    const d = doc.data();
    matched.push({
      id: doc.id,
      email: (d.email || "").toString(),
      name: (d.name || "").toString(),
      current: (d.status || "pending").toString(),
    });
  }

  console.log(`Target status: ${status}`);
  console.log(`Identifiers given: ${identifiers.size}`);
  console.log(`Matched: ${matched.length}`);
  console.log(`Missing: ${missing.length}`);
  if (missing.length > 0) {
    console.log("\n  No matching application found for:");
    for (const m of missing) console.log(`    - ${m}`);
  }

  const noChange = matched.filter((m) => m.current === status);
  const willChange = matched.filter((m) => m.current !== status);

  console.log(`\nAlready ${status}: ${noChange.length}`);
  console.log(`Will change to ${status}: ${willChange.length}\n`);
  for (const m of willChange) {
    console.log(`  ${m.name || "(no name)"} <${m.email}>: ${m.current} → ${status}`);
  }

  if (dryRun) {
    console.log(`\n--dry-run: no writes.`);
    return;
  }

  let written = 0;
  for (const m of willChange) {
    await db.collection(SUMMER_COHORT_COLLECTION).doc(m.id).set(
      { status, statusUpdatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    written++;
  }
  console.log(`\nWrote ${written} update(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
