/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Pull Mailgun bounces + complaints and mirror them onto our Firestore
 * `eventContacts.unsubscribed` / `users.unsubscribed` flags. Bulk-send
 * scripts call this at the top of main() so the recipient list never
 * includes addresses Mailgun has already given up on.
 *
 * Memoized per process: repeat calls within a single script invocation
 * skip the network round-trip and reuse the same result.
 *
 * Required for the network sync:
 *   MAILGUN_PRIVATE_API_KEY  (sending key returns 401 on /bounces)
 *   MAILGUN_DOMAIN
 *
 * If MAILGUN_PRIVATE_API_KEY is missing, the function logs a warning
 * and returns an empty result — callers proceed without sync rather
 * than crashing crons.
 */
import type { Firestore } from "firebase-admin/firestore";
import { FieldValue } from "firebase-admin/firestore";

type SuppressionType = "bounces" | "complaints";

interface SuppressionItem {
  address: string;
  code?: string | number;
  error?: string;
  created_at?: string;
}

export interface SyncResult {
  /** Lowercased addresses Mailgun has flagged (bounce or complaint). */
  allSuppressed: Set<string>;
  bouncedCount: number;
  complaintsCount: number;
  /** New writes performed this run (zero on memoized re-calls). */
  flaggedEventContacts: number;
  flaggedUsers: number;
  /** True when the sync was skipped (no key, or already ran this process). */
  skipped: boolean;
  skippedReason?: string;
}

const MAILGUN_API =
  process.env.MAILGUN_EU === "true"
    ? "https://api.eu.mailgun.net"
    : "https://api.mailgun.net";

let memo: Promise<SyncResult> | null = null;

async function fetchAllSuppressions(
  domain: string,
  apiKey: string,
  type: SuppressionType
): Promise<SuppressionItem[]> {
  const auth = "Basic " + Buffer.from(`api:${apiKey}`).toString("base64");
  const all: SuppressionItem[] = [];
  let url: string | undefined = `${MAILGUN_API}/v3/${domain}/${type}?limit=1000`;
  let pages = 0;
  while (url) {
    pages++;
    const res = await fetch(url, { headers: { Authorization: auth } });
    if (!res.ok) {
      throw new Error(
        `Mailgun ${type} fetch failed: ${res.status} ${await res.text()}`
      );
    }
    const json = (await res.json()) as {
      items: SuppressionItem[];
      paging?: { next?: string };
    };
    all.push(...(json.items ?? []));
    const next = json.paging?.next;
    if (!next || (json.items ?? []).length === 0) break;
    url = next;
    if (pages > 50) break;
  }
  return all;
}

interface SyncOptions {
  /** Set true to refetch even if a previous call in this process succeeded. */
  force?: boolean;
  /** When false, suppress per-step console output. Defaults to true. */
  verbose?: boolean;
}

export async function syncMailgunSuppressions(
  db: Firestore,
  opts: SyncOptions = {}
): Promise<SyncResult> {
  if (!opts.force && memo) return memo;
  memo = doSync(db, opts);
  try {
    return await memo;
  } catch (e) {
    memo = null;
    throw e;
  }
}

async function doSync(db: Firestore, opts: SyncOptions): Promise<SyncResult> {
  const verbose = opts.verbose !== false;
  const log = (...args: unknown[]) => {
    if (verbose) console.log(...args);
  };

  const apiKey = process.env.MAILGUN_PRIVATE_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  if (!apiKey || !domain) {
    const reason = !apiKey
      ? "MAILGUN_PRIVATE_API_KEY not set"
      : "MAILGUN_DOMAIN not set";
    log(`[mailgun-suppressions] Skipping sync: ${reason}.`);
    return {
      allSuppressed: new Set(),
      bouncedCount: 0,
      complaintsCount: 0,
      flaggedEventContacts: 0,
      flaggedUsers: 0,
      skipped: true,
      skippedReason: reason,
    };
  }

  log(`[mailgun-suppressions] Fetching bounces + complaints for ${domain}…`);
  const [bounces, complaints] = await Promise.all([
    fetchAllSuppressions(domain, apiKey, "bounces"),
    fetchAllSuppressions(domain, apiKey, "complaints"),
  ]);
  log(
    `[mailgun-suppressions]   bounces=${bounces.length} complaints=${complaints.length}`
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

  const allSuppressed = new Set(byAddress.keys());

  const eventContactWrites: Array<{
    docId: string;
    reason: "bounce" | "complaint";
    code: string;
    error: string;
  }> = [];
  const userWrites: Array<{ uid: string }> = [];

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
        eventContactWrites.push({
          docId: ecDoc.id,
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
        userWrites.push({ uid: uq.docs[0].id });
      }
    }
  }

  if (eventContactWrites.length === 0 && userWrites.length === 0) {
    log(
      `[mailgun-suppressions]   no new flags needed (${allSuppressed.size} already mirrored).`
    );
    return {
      allSuppressed,
      bouncedCount: bounces.length,
      complaintsCount: complaints.length,
      flaggedEventContacts: 0,
      flaggedUsers: 0,
      skipped: false,
    };
  }

  log(
    `[mailgun-suppressions]   flagging ${eventContactWrites.length} eventContact(s) + ${userWrites.length} user(s)…`
  );

  const ops: Array<() => Promise<void>> = [];
  for (const r of eventContactWrites) {
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
  for (const u of userWrites) {
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

  return {
    allSuppressed,
    bouncedCount: bounces.length,
    complaintsCount: complaints.length,
    flaggedEventContacts: eventContactWrites.length,
    flaggedUsers: userWrites.length,
    skipped: false,
  };
}

/** Test-only: clear the per-process memo. */
export function __resetMailgunSuppressionsMemo(): void {
  memo = null;
}
