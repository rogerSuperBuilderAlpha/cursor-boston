#!/usr/bin/env node
/**
 * Seed Luma registrants into Firestore for the combined leaderboard.
 *
 * Imports approved Luma registrants who don't yet have a website signup into
 * `hackathonLumaRegistrants` so the signup API can show a unified list.
 *
 * Usage:
 *   npx tsx scripts/seed-luma-registrants.ts --dry-run [--csv path]
 *   npx tsx scripts/seed-luma-registrants.ts --apply [--csv path] [--prune]
 *
 * --prune (with --apply): deletes hackathonLumaRegistrants for this event whose
 *   email is not in the CSV as non-declined (and not judge/declined list).
 */
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { FieldValue } from "firebase-admin/firestore";
import { DECLINED_EMAILS, JUDGE_EMAILS } from "../lib/hackathon-event-signup";
import { getAdminDb } from "../lib/firebase-admin";
import { HACK_A_SPRINT_2026_EVENT_ID } from "../lib/hackathon-showcase";

const GITHUB_COL_KEY = "What is your GitHub username?";

const INVALID_LOGIN_TOKENS = new Set([
  "", "n", "no", "none", "na", "n/a", "-", ".", "unknown",
]);

type CsvRow = Record<string, string>;

function parseCsv(content: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else { field += c; }
    } else if (c === '"') { inQuotes = true; }
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else { field += c; }
  }
  row.push(field);
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  if (rows.length < 2) return [];
  const header = rows[0]!.map((h) => h.trim());
  const out: CsvRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const line = rows[r]!;
    const obj: CsvRow = {};
    for (let j = 0; j < header.length; j++) obj[header[j]!] = (line[j] ?? "").trim();
    out.push(obj);
  }
  return out;
}

function parseGithubLogin(raw: string | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  let s = raw.trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    try {
      const u = new URL(s.startsWith("http") ? s : `https://${s}`);
      if (!u.hostname.includes("github.com")) return null;
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length === 0) return null;
      s = parts[0]!;
    } catch { return null; }
  } else if (lower.includes("github.com")) {
    const idx = lower.indexOf("github.com");
    const rest = s.slice(idx + "github.com".length).replace(/^[/:]+/, "");
    const parts = rest.split("/").filter(Boolean);
    if (parts.length === 0) return null;
    s = parts[0]!;
  }
  s = s.replace(/^@+/, "");
  if (INVALID_LOGIN_TOKENS.has(s.toLowerCase()) || s.length < 2) return null;
  return s;
}

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply");
  const prune = argv.includes("--prune");
  const csvIdx = argv.indexOf("--csv");
  const csvPath =
    csvIdx >= 0 && argv[csvIdx + 1]
      ? argv[csvIdx + 1]!
      : join(
          homedir(),
          "Downloads",
          "Cursor Boston Hack-a-Sprint - Guests - 2026-04-11-12-28-29.csv"
        );
  if ((dryRun && apply) || (!dryRun && !apply)) {
    console.error("Specify exactly one of: --dry-run | --apply");
    process.exit(1);
  }
  if (prune && dryRun) {
    console.error("--prune requires --apply (cannot prune on --dry-run).");
    process.exit(1);
  }
  return { dryRun, apply, prune, csvPath };
}

async function main() {
  const { dryRun, prune, csvPath } = parseArgs(process.argv.slice(2));

  let raw: string;
  try { raw = readFileSync(csvPath, "utf8"); }
  catch (e) { console.error(`Cannot read CSV: ${csvPath}`, e); process.exit(1); }

  const db = getAdminDb();
  if (!db) { console.error("Firebase Admin not configured."); process.exit(1); }

  const csvRows = parseCsv(raw);
  console.log(`Loaded ${csvRows.length} rows from ${csvPath}`);

  // Get existing website signups to skip
  const signupSnap = await db
    .collection("hackathonEventSignups")
    .where("eventId", "==", HACK_A_SPRINT_2026_EVENT_ID)
    .get();
  const signupUserIds = new Set(signupSnap.docs.map((d) => d.data().userId as string));

  // Map emails to user IDs from Firestore
  const usersByEmail = new Map<string, string>();
  const usersSnap = await db.collection("users").get();
  for (const doc of usersSnap.docs) {
    const email = doc.data().email;
    if (typeof email === "string") usersByEmail.set(email.toLowerCase(), doc.id);
  }

  let seeded = 0;
  let skippedSignup = 0;
  let skippedDeclined = 0;
  let skippedJudge = 0;

  const approvedEmailsForPrune = new Set<string>();

  for (const row of csvRows) {
    const email = row.email?.trim().toLowerCase();
    if (!email) continue;

    const approval = (row.approval_status || "").toLowerCase();
    if (approval === "declined") { skippedDeclined++; continue; }
    if (JUDGE_EMAILS.has(email) || DECLINED_EMAILS.has(email)) {
      skippedJudge++;
      continue;
    }
    approvedEmailsForPrune.add(email);

    // Check if already has a website signup
    const uid = usersByEmail.get(email);
    if (uid && signupUserIds.has(uid)) { skippedSignup++; continue; }

    const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || row.name?.trim() || "";
    const githubLogin = parseGithubLogin(row[GITHUB_COL_KEY]);
    const lumaCreatedAt = row.created_at || "";

    const docId = `${HACK_A_SPRINT_2026_EVENT_ID}__${email}`;

    if (dryRun) {
      console.log(`  WOULD SEED: ${email} | ${name} | gh:${githubLogin || "—"} | luma:${lumaCreatedAt.slice(0, 10)}`);
    } else {
      await db.collection("hackathonLumaRegistrants").doc(docId).set({
        eventId: HACK_A_SPRINT_2026_EVENT_ID,
        email,
        name,
        githubLogin,
        lumaCreatedAt,
        lumaApprovalStatus: approval,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    seeded++;
  }

  let pruned = 0;
  if (prune && !dryRun) {
    const existing = await db
      .collection("hackathonLumaRegistrants")
      .where("eventId", "==", HACK_A_SPRINT_2026_EVENT_ID)
      .get();
    for (const doc of existing.docs) {
      const em = String(doc.data().email ?? "").toLowerCase();
      if (!approvedEmailsForPrune.has(em)) {
        await doc.ref.delete();
        pruned++;
      }
    }
  }

  console.log(
    `\nSeeded: ${seeded}, skipped (already on website): ${skippedSignup}, declined: ${skippedDeclined}, skipped (judge/ops email): ${skippedJudge}` +
      (prune && !dryRun ? `, pruned stale Luma rows: ${pruned}` : "")
  );
  if (dryRun) console.log("--dry-run: nothing written to Firestore.");
  else console.log("--apply: written to hackathonLumaRegistrants collection.");
}

main().catch((e) => { console.error(e); process.exit(1); });
