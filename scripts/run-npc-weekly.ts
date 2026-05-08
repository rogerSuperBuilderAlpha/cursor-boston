#!/usr/bin/env node
/**
 * CLI wrapper for runNpcWeeklyServer. Useful for ad-hoc / backfill runs;
 * the production schedule invokes the same logic via /api/game/npc-weekly.
 *
 * Usage:
 *   npx tsx scripts/run-npc-weekly.ts [--week=YYYY-MM-DD] [--dry-run] [--limit=N]
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { runNpcWeeklyServer } from "../lib/game/npc-weekly";

function parseArgs(argv: string[]): {
  weekStartIso: string | undefined;
  dryRun: boolean;
  limit: number | null;
} {
  let weekStartIso: string | undefined;
  let dryRun = false;
  let limit: number | null = null;
  for (const a of argv) {
    if (a.startsWith("--week=")) weekStartIso = a.slice("--week=".length);
    else if (a === "--dry-run") dryRun = true;
    else if (a.startsWith("--limit=")) limit = Number.parseInt(a.slice("--limit=".length), 10);
  }
  return { weekStartIso, dryRun, limit };
}

async function main() {
  const { weekStartIso, dryRun, limit } = parseArgs(process.argv.slice(2));
  console.log(
    `[npc-weekly] week=${weekStartIso ?? "(auto)"} dryRun=${dryRun} limit=${limit ?? "all"}`
  );

  const summary = await runNpcWeeklyServer({ weekStartIso, dryRun, limit });

  for (const p of summary.perPlayer) {
    console.log(
      `[npc-weekly] ${p.displayName} (${p.persona}, ${p.caste}): ` +
        `builds=${p.builds} attacks=${p.attacks} ` +
        `(cap=${p.captured}/rep=${p.repelled}/sta=${p.stalemate}) ` +
        `spells=${p.spellsCast} errors=${p.errorCount}`
    );
  }

  console.log(
    `\n[npc-weekly] Done. week=${summary.weekStartIso} scanned=${summary.scanned} ` +
      `granted=${summary.granted} skipped=${summary.skippedAlreadyGranted}`
  );
  console.log(
    `  builds=${summary.totals.builds} attacks=${summary.totals.attacks} ` +
      `(captured=${summary.totals.captured}, repelled=${summary.totals.repelled}, stalemate=${summary.totals.stalemate}) ` +
      `spells=${summary.totals.spellsCast} errors=${summary.totals.errors}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
