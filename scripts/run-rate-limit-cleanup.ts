/**
 * Operator script to invoke internal API rate-limit cleanup.
 *
 * Usage:
 *   CRON_SECRET=... npm run rate-limit-cleanup
 *
 * Optional env vars:
 *   RATE_LIMIT_CLEANUP_BASE_URL (default: http://localhost:3000)
 *   RATE_LIMIT_CLEANUP_DRY_RUN   ("true" | "false", default: false)
 *   RATE_LIMIT_CLEANUP_BATCH_SIZE (1-500, optional)
 *   RATE_LIMIT_CLEANUP_MAX_BATCHES (1-20, optional)
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadDotEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    if (process.env[key]) continue;
    const value = match[2].replace(/^["']|["']$/g, "").trim();
    process.env[key] = value;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

async function main() {
  loadDotEnvLocal();

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("Missing CRON_SECRET. Set it in env or .env.local.");
    process.exit(1);
  }

  const baseUrl = (process.env.RATE_LIMIT_CLEANUP_BASE_URL || "http://localhost:3000").replace(
    /\/$/,
    ""
  );

  const dryRun = process.env.RATE_LIMIT_CLEANUP_DRY_RUN === "true";
  const batchSizeRaw = process.env.RATE_LIMIT_CLEANUP_BATCH_SIZE;
  const maxBatchesRaw = process.env.RATE_LIMIT_CLEANUP_MAX_BATCHES;

  const search = new URLSearchParams();
  if (dryRun) search.set("dryRun", "true");

  if (batchSizeRaw) {
    const parsed = Number(batchSizeRaw);
    if (Number.isFinite(parsed) && parsed > 0) {
      search.set("batchSize", String(clamp(Math.floor(parsed), 1, 500)));
    }
  }

  if (maxBatchesRaw) {
    const parsed = Number(maxBatchesRaw);
    if (Number.isFinite(parsed) && parsed > 0) {
      search.set("maxBatches", String(clamp(Math.floor(parsed), 1, 20)));
    }
  }

  const cleanupUrl = `${baseUrl}/api/internal/rate-limits/cleanup${
    search.toString() ? `?${search.toString()}` : ""
  }`;

  const res = await fetch(cleanupUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": cronSecret,
    },
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    console.error("Rate-limit cleanup failed.", {
      status: res.status,
      statusText: res.statusText,
      body,
    });
    process.exit(1);
  }

  console.log("Rate-limit cleanup completed.", body);
}

main().catch((error) => {
  console.error("Rate-limit cleanup script crashed.", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
