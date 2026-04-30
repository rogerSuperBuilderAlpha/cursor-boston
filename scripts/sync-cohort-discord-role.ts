#!/usr/bin/env node
/**
 * Sync the Discord role for an admitted cohort to every admitted applicant
 * who has connected their Discord account.
 *
 * Idempotent: Discord's PUT /guilds/{g}/members/{u}/roles/{r} returns 204
 * whether the user already had the role or not, so re-running is safe.
 *
 * Usage:
 *   # required: pick a role to grant
 *   npx tsx scripts/sync-cohort-discord-role.ts --role-id=<role-id> --dry-run
 *   npx tsx scripts/sync-cohort-discord-role.ts --role-id=<role-id> --apply
 *
 *   # filter to one cohort (recommended — match the role)
 *   npx tsx scripts/sync-cohort-discord-role.ts --role-id=<role-id> --cohort=cohort-1 --apply
 *
 * Required env:
 *   DISCORD_BOT_TOKEN              — bot token from discord.com/developers
 *   CURSOR_BOSTON_DISCORD_SERVER_ID — guild id (already present in env)
 *
 * Optional env (lets you skip --role-id=):
 *   DISCORD_S261_ROLE_ID           — Cohort 1 / S261 role
 *   DISCORD_S262_ROLE_ID           — Cohort 2 / S262 role
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import {
  SUMMER_COHORT_COLLECTION,
  SUMMER_COHORTS,
  isValidCohortId,
  type SummerCohortId,
} from "../lib/summer-cohort";

interface Target {
  uid: string;
  name: string;
  email: string;
  cohorts: SummerCohortId[];
  discordId: string;
  discordUsername: string;
}

const DISCORD_API = "https://discord.com/api/v10";

function getArg(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

interface DiscordResult {
  status: number;
  retryAfterMs?: number;
  body?: string;
}

async function putRole(args: {
  guildId: string;
  userId: string;
  roleId: string;
  token: string;
}): Promise<DiscordResult> {
  const url = `${DISCORD_API}/guilds/${args.guildId}/members/${args.userId}/roles/${args.roleId}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${args.token}`,
      "Content-Length": "0",
      "X-Audit-Log-Reason": "Cohort admission sync",
    },
  });
  if (res.status === 429) {
    let retryAfterMs = 1000;
    try {
      const j = (await res.json()) as { retry_after?: number };
      if (typeof j.retry_after === "number") retryAfterMs = Math.ceil(j.retry_after * 1000);
    } catch {
      // ignore parse failures
    }
    return { status: 429, retryAfterMs };
  }
  if (res.status >= 400) {
    const body = await res.text().catch(() => "");
    return { status: res.status, body };
  }
  return { status: res.status };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const apply = args.includes("--apply");
  if (dryRun === apply) {
    console.error("Specify exactly one of: --dry-run | --apply");
    process.exit(1);
  }

  const cohortArg = getArg("cohort");
  const cohortFilter: SummerCohortId | null = cohortArg
    ? (cohortArg as SummerCohortId)
    : null;
  if (cohortFilter && !isValidCohortId(cohortFilter)) {
    console.error(
      `Invalid --cohort. Pick one of: ${SUMMER_COHORTS.map((c) => c.id).join(", ")}`
    );
    process.exit(1);
  }

  // Resolve role id: explicit flag > env shortcut for the chosen cohort.
  let roleId = getArg("role-id");
  if (!roleId && cohortFilter === "cohort-1") roleId = process.env.DISCORD_S261_ROLE_ID || null;
  if (!roleId && cohortFilter === "cohort-2") roleId = process.env.DISCORD_S262_ROLE_ID || null;
  if (!roleId) {
    console.error("Provide --role-id=<id> (or set DISCORD_S261_ROLE_ID / DISCORD_S262_ROLE_ID).");
    process.exit(1);
  }

  const guildId = process.env.CURSOR_BOSTON_DISCORD_SERVER_ID;
  if (!guildId) {
    console.error("CURSOR_BOSTON_DISCORD_SERVER_ID is not set.");
    process.exit(1);
  }
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.error("DISCORD_BOT_TOKEN is not set.");
    process.exit(1);
  }

  const db = getAdminDb();
  if (!db) {
    console.error("Firebase Admin not configured.");
    process.exit(1);
  }

  // Pull admitted applicants.
  const snap = await db
    .collection(SUMMER_COHORT_COLLECTION)
    .where("status", "==", "admitted")
    .get();

  const targets: Target[] = [];
  let skippedCohort = 0;
  let skippedNoDiscord = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    const cohorts = (Array.isArray(data.cohorts) ? data.cohorts : []).filter(
      isValidCohortId
    ) as SummerCohortId[];
    if (cohorts.length === 0) continue;
    if (cohortFilter && !cohorts.includes(cohortFilter)) {
      skippedCohort++;
      continue;
    }
    const uid = (data.userId || doc.id).toString();
    const userSnap = await db.collection("users").doc(uid).get();
    const discord = userSnap.data()?.discord as
      | { id?: string; username?: string }
      | undefined;
    if (!discord?.id) {
      skippedNoDiscord++;
      continue;
    }
    targets.push({
      uid,
      name: typeof data.name === "string" ? data.name : "",
      email: typeof data.email === "string" ? data.email : "",
      cohorts,
      discordId: discord.id,
      discordUsername: discord.username || "",
    });
  }

  console.log(`Cohort filter: ${cohortFilter ?? "(any)"}`);
  console.log(`Role to grant: ${roleId}`);
  console.log(`Guild:         ${guildId}`);
  console.log(`Admitted matches: ${targets.length}`);
  console.log(`Skipped (other cohort):  ${skippedCohort}`);
  console.log(`Skipped (no Discord):    ${skippedNoDiscord}\n`);

  if (targets.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  if (dryRun) {
    console.log("--- Would grant role to: ---");
    for (const t of targets) {
      console.log(
        `  ${t.name || "(no name)"} <${t.email}> → @${t.discordUsername} (${t.discordId})`
      );
    }
    console.log(`\n--dry-run: no Discord API calls made.`);
    return;
  }

  let succeeded = 0;
  let notInGuild = 0;
  let forbidden = 0;
  let failed = 0;
  const failures: { target: Target; status: number; body?: string }[] = [];

  for (const t of targets) {
    let attempt = 0;
    while (attempt < 5) {
      attempt++;
      const r = await putRole({ guildId, userId: t.discordId, roleId, token });
      if (r.status === 429) {
        const wait = r.retryAfterMs ?? 1000;
        console.log(`  rate-limited, sleeping ${wait}ms…`);
        await sleep(wait);
        continue;
      }
      if (r.status >= 200 && r.status < 300) {
        succeeded++;
        console.log(`  ✓ ${t.name || t.email} (@${t.discordUsername})`);
      } else if (r.status === 404) {
        notInGuild++;
        console.log(
          `  ✗ NOT IN SERVER: ${t.name || t.email} (@${t.discordUsername}) — ask them to join the Discord server first`
        );
        failures.push({ target: t, status: r.status, body: r.body });
      } else if (r.status === 403) {
        forbidden++;
        console.log(
          `  ✗ FORBIDDEN: ${t.name || t.email} — bot lacks permission. Likely the bot's role is not above ${roleId} in the hierarchy.`
        );
        failures.push({ target: t, status: r.status, body: r.body });
      } else {
        failed++;
        console.log(
          `  ✗ FAIL ${r.status}: ${t.name || t.email} — ${r.body || "(no body)"}`
        );
        failures.push({ target: t, status: r.status, body: r.body });
      }
      break;
    }
    // Small spacing between calls to be nice to the API.
    await sleep(150);
  }

  console.log(
    `\nDone. Succeeded: ${succeeded} | Not in server: ${notInGuild} | Forbidden: ${forbidden} | Failed: ${failed}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
