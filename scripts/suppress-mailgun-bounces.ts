#!/usr/bin/env node
/**
 * Pull Mailgun's permanent-failure list (bounces + complaints) and mark
 * those addresses as unsubscribed in our system so future sends skip them.
 *
 * Two source modes:
 *   - API (default): delegates to lib/mailgun-suppressions.syncMailgunSuppressions.
 *     Requires MAILGUN_PRIVATE_API_KEY (sending key returns 401 on /bounces)
 *     and MAILGUN_DOMAIN. Bulk-send scripts call the same library at the
 *     top of main(), so this script is mainly for ad-hoc inspection.
 *   - CSV: when --csv-bounces / --csv-complaints are passed, reads files
 *     exported from the Mailgun dashboard (Sending → Suppressions). Useful
 *     when the API key isn't available.
 *
 * Marks:
 *   eventContacts/<email>.unsubscribed = true (+ bouncedAt, suppressionReason)
 *   users/<uid>.unsubscribed           = true (when email matches a CB user)
 *
 * Usage:
 *   npx tsx scripts/suppress-mailgun-bounces.ts --dry-run
 *   npx tsx scripts/suppress-mailgun-bounces.ts --apply
 *   npx tsx scripts/suppress-mailgun-bounces.ts --dry-run --csv-bounces <path>
 *   npx tsx scripts/suppress-mailgun-bounces.ts --apply --csv-bounces <path> --csv-complaints <path>
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { readFileSync } from "node:fs";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../lib/firebase-admin";
import { syncMailgunSuppressions } from "../lib/mailgun-suppressions";

interface SuppressionItem {
  address: string;
  code?: string | number;
  error?: string;
  created_at?: string;
}

function getArg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return null;
  const v = process.argv[i + 1];
  return v && !v.startsWith("--") ? v : null;
}

// CSV parser that handles quoted fields with embedded commas / newlines.
function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); field = "";
      if (row.length > 0 && !(row.length === 1 && row[0] === "")) rows.push(row);
      row = [];
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (!(row.length === 1 && row[0] === "")) rows.push(row);
  }
  return rows;
}

function loadSuppressionsFromCsv(path: string): SuppressionItem[] {
  const content = readFileSync(path, "utf-8");
  const rows = parseCsv(content);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.toLowerCase().trim());
  const addrIdx = header.indexOf("address");
  if (addrIdx === -1) {
    throw new Error(`CSV at ${path} is missing an "address" column.`);
  }
  const codeIdx = header.indexOf("code");
  const errorIdx = header.indexOf("error");
  const createdIdx = header.indexOf("created_at");
  const out: SuppressionItem[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const address = (r[addrIdx] || "").trim();
    if (!address) continue;
    out.push({
      address,
      code: codeIdx !== -1 ? r[codeIdx] : undefined,
      error: errorIdx !== -1 ? r[errorIdx] : undefined,
      created_at: createdIdx !== -1 ? r[createdIdx] : undefined,
    });
  }
  return out;
}

async function applyCsv(
  csvBouncesPath: string | null,
  csvComplaintsPath: string | null,
  dryRun: boolean
) {
  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  const bounces = csvBouncesPath ? loadSuppressionsFromCsv(csvBouncesPath) : [];
  const complaints = csvComplaintsPath
    ? loadSuppressionsFromCsv(csvComplaintsPath)
    : [];
  console.log(
    `Loaded from CSV: bounces=${bounces.length} (${csvBouncesPath ?? "none"}), complaints=${complaints.length} (${csvComplaintsPath ?? "none"})`
  );

  const byAddress = new Map<
    string,
    { reason: "bounce" | "complaint"; code: string; error: string }
  >();
  for (const b of bounces) {
    const k = (b.address || "").trim().toLowerCase();
    if (!k) continue;
    byAddress.set(k, {
      reason: "bounce",
      code: String(b.code ?? ""),
      error: String(b.error ?? "").slice(0, 200),
    });
  }
  for (const c of complaints) {
    const k = (c.address || "").trim().toLowerCase();
    if (!k) continue;
    if (!byAddress.has(k)) {
      byAddress.set(k, {
        reason: "complaint",
        code: String(c.code ?? ""),
        error: String(c.error ?? "").slice(0, 200),
      });
    }
  }
  console.log(`  unique addresses to suppress: ${byAddress.size}`);

  const eventContactsToFlag: Array<{
    docId: string;
    email: string;
    reason: "bounce" | "complaint";
    code: string;
    error: string;
  }> = [];
  const usersToFlag: Array<{ uid: string; email: string }> = [];

  for (const [email, meta] of byAddress) {
    let ecDoc = await db.collection("eventContacts").doc(email).get();
    if (!ecDoc.exists) {
      const q = await db
        .collection("eventContacts")
        .where("email", "==", email)
        .limit(1)
        .get();
      if (!q.empty) ecDoc = q.docs[0];
    }
    if (ecDoc.exists) {
      const d = ecDoc.data() ?? {};
      if (d.unsubscribed !== true || !d.bouncedAt) {
        eventContactsToFlag.push({
          docId: ecDoc.id,
          email,
          reason: meta.reason,
          code: meta.code,
          error: meta.error,
        });
      }
    }

    const uq = await db
      .collection("users")
      .where("email", "==", email)
      .limit(1)
      .get();
    if (!uq.empty) {
      const d = uq.docs[0].data() ?? {};
      if (d.unsubscribed !== true) {
        usersToFlag.push({ uid: uq.docs[0].id, email });
      }
    }
  }

  console.log(
    `  eventContacts to flag: ${eventContactsToFlag.length}\n  users to flag:         ${usersToFlag.length}`
  );

  if (dryRun) {
    console.log("\n--dry-run: no Firestore writes.");
    return;
  }

  const ops: Array<() => Promise<void>> = [];
  for (const r of eventContactsToFlag) {
    ops.push(async () => {
      await db.collection("eventContacts").doc(r.docId).set(
        {
          unsubscribed: true,
          bouncedAt: FieldValue.serverTimestamp(),
          suppressionReason:
            r.reason === "bounce" ? "mailgun-bounce" : "mailgun-complaint",
          suppressionCode: r.code || null,
          suppressionError: r.error || null,
        },
        { merge: true }
      );
    });
  }
  for (const u of usersToFlag) {
    ops.push(async () => {
      await db.collection("users").doc(u.uid).set(
        {
          unsubscribed: true,
          unsubscribedAt: FieldValue.serverTimestamp(),
          unsubscribedReason: "mailgun-suppression",
        },
        { merge: true }
      );
    });
  }
  const concurrency = 10;
  for (let i = 0; i < ops.length; i += concurrency) {
    await Promise.all(ops.slice(i, i + concurrency).map((fn) => fn()));
  }
  console.log(
    `\nDone. ${eventContactsToFlag.length} eventContacts flagged, ${usersToFlag.length} users flagged.`
  );
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const apply = args.includes("--apply");
  if ((dryRun && apply) || (!dryRun && !apply)) {
    console.error("Specify exactly one of: --dry-run | --apply");
    process.exit(1);
  }

  const csvBouncesPath = getArg("csv-bounces");
  const csvComplaintsPath = getArg("csv-complaints");
  const useCsv = csvBouncesPath || csvComplaintsPath;

  if (useCsv) {
    await applyCsv(csvBouncesPath, csvComplaintsPath, dryRun);
    return;
  }

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }
  if (!process.env.MAILGUN_PRIVATE_API_KEY || !process.env.MAILGUN_DOMAIN) {
    console.error(
      "MAILGUN_PRIVATE_API_KEY and MAILGUN_DOMAIN must be set, or pass --csv-bounces <path> [--csv-complaints <path>]."
    );
    process.exit(1);
  }

  if (dryRun) {
    // We don't have a no-write mode in the library — for inspection,
    // just point the user at the CSV mode, which uses the same code path
    // we'd otherwise use here.
    console.error(
      "API-source --dry-run is not supported (the library writes as it goes).\n" +
        "Use --csv-bounces to inspect a dashboard export, or run --apply on the API."
    );
    process.exit(1);
  }

  const result = await syncMailgunSuppressions(db, { force: true });
  if (result.skipped) {
    console.log(`Skipped: ${result.skippedReason}`);
    return;
  }
  console.log(
    `\nDone. bounces=${result.bouncedCount} complaints=${result.complaintsCount} → ${result.flaggedEventContacts} eventContacts flagged, ${result.flaggedUsers} users flagged.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
