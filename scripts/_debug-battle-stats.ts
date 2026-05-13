#!/usr/bin/env node
/**
 * Read-only battle analytics. Pulls every doc from game_attacks and
 * surfaces the stats we'll want before tuning combat mechanics:
 *   - Overall outcome distribution (captured / repelled / stalemate)
 *   - Attacker-win % by force-ratio bucket (does sending 2× units feel
 *     decisive? are coin flips happening at 1×? are 5×+ ever upset?)
 *   - Bloodiness: average attacker/defender loss as % of units committed
 *   - Caste matchup matrix (attacker caste → win % vs each defender caste)
 *   - NPC↔NPC vs NPC↔human vs human↔human breakdowns
 *   - Spell + modifier prevalence
 *   - Recent-vs-all comparison (today's blitz vs full history)
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getAdminDb } from "../lib/firebase-admin";
import type { Caste, GameAttack, GamePlayer, UnitStack } from "../lib/game/types";

const CASTES: Caste[] = ["black", "red", "white", "green", "blue"];

function sumStack(s: UnitStack | undefined | null): number {
  if (!s) return 0;
  return (s.ground ?? 0) + (s.siege ?? 0) + (s.air ?? 0);
}

function toMs(t: GameAttack["createdAt"]): number {
  if (!t) return 0;
  if (t instanceof Date) return t.getTime();
  // Firestore Timestamp shape
  const ts = t as { toMillis?: () => number; seconds?: number };
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  return 0;
}

async function main(): Promise<void> {
  const db = getAdminDb();
  if (!db) throw new Error("no db");

  // Load players first so we can label by NPC/human and grab caste backstop.
  const playersSnap = await db.collection("game_players").get();
  const isNpc = new Map<string, boolean>();
  const nameByUid = new Map<string, string>();
  for (const d of playersSnap.docs) {
    const p = d.data() as GamePlayer & { isNpc?: boolean };
    isNpc.set(d.id, p.isNpc === true);
    nameByUid.set(d.id, p.displayName ?? d.id.slice(0, 6));
  }

  const attacksSnap = await db.collection("game_attacks").get();
  const attacks: GameAttack[] = attacksSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as GameAttack),
  }));
  attacks.sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));

  if (attacks.length === 0) {
    console.log("No attacks recorded yet.");
    return;
  }

  console.log(`=== Battle Analytics — ${attacks.length} total attacks ===\n`);

  // ── Time range
  const firstMs = toMs(attacks[0].createdAt);
  const lastMs = toMs(attacks[attacks.length - 1].createdAt);
  console.log(
    `First: ${new Date(firstMs).toISOString()}  Last: ${new Date(lastMs).toISOString()}`
  );

  // ── Overall outcome distribution
  const outcomeCount = { captured: 0, repelled: 0, stalemate: 0 };
  for (const a of attacks) outcomeCount[a.outcome]++;
  const pct = (n: number) => ((100 * n) / attacks.length).toFixed(1);
  console.log("\n── Overall outcomes");
  console.log(
    `  captured:  ${String(outcomeCount.captured).padStart(5)}  ${pct(outcomeCount.captured)}%`
  );
  console.log(
    `  repelled:  ${String(outcomeCount.repelled).padStart(5)}  ${pct(outcomeCount.repelled)}%`
  );
  console.log(
    `  stalemate: ${String(outcomeCount.stalemate).padStart(5)}  ${pct(outcomeCount.stalemate)}%`
  );

  // ── Attacker-side counts: NPC vs Human
  const buckets = {
    npcVsNpc: { total: 0, captured: 0, repelled: 0, stalemate: 0 },
    npcVsHuman: { total: 0, captured: 0, repelled: 0, stalemate: 0 },
    humanVsNpc: { total: 0, captured: 0, repelled: 0, stalemate: 0 },
    humanVsHuman: { total: 0, captured: 0, repelled: 0, stalemate: 0 },
  };
  for (const a of attacks) {
    const aIsNpc = isNpc.get(a.attackerId) ?? false;
    const dIsNpc = isNpc.get(a.defenderId) ?? false;
    const key = aIsNpc
      ? dIsNpc
        ? "npcVsNpc"
        : "npcVsHuman"
      : dIsNpc
        ? "humanVsNpc"
        : "humanVsHuman";
    buckets[key].total++;
    buckets[key][a.outcome]++;
  }
  console.log("\n── NPC vs Human (attacker→defender)");
  for (const [k, b] of Object.entries(buckets)) {
    if (b.total === 0) continue;
    const winRate = ((100 * b.captured) / b.total).toFixed(1);
    console.log(
      `  ${k.padEnd(14)}: ${String(b.total).padStart(5)} attacks · cap=${b.captured} rep=${b.repelled} sta=${b.stalemate} · attacker-win ${winRate}%`
    );
  }

  // ── Force-ratio bucket vs outcome
  // Ratio = units sent / (defender units on the tile at moment of attack).
  // We approximate "defender units" from defenderLosses + (we don't have
  // post-tile state here, just GameAttack record). Best estimate: defender
  // had at least `unitsLostDefender` units, and on capture they had exactly
  // that many; on repel they had more but we can't recover the exact figure
  // from the attack doc. Use unitsLostDefender as the floor.
  console.log(
    "\n── Force-ratio (units-sent / defender-units-lost) vs outcome"
  );
  const ratioBuckets = [
    { label: "≤0.5×  (outnumbered 2:1+)", min: 0, max: 0.5 },
    { label: "0.5–0.9× (underdog)", min: 0.5, max: 0.9 },
    { label: "0.9–1.1× (even)", min: 0.9, max: 1.1 },
    { label: "1.1–2×  (favored)", min: 1.1, max: 2.0 },
    { label: "2–5×   (overwhelming)", min: 2.0, max: 5.0 },
    { label: "5×+    (steamroll)", min: 5.0, max: Infinity },
  ];
  const ratioRows = ratioBuckets.map((b) => ({
    ...b,
    total: 0,
    captured: 0,
    repelled: 0,
    stalemate: 0,
  }));
  let undefRatio = 0;
  for (const a of attacks) {
    const sent = sumStack(a.unitsSent);
    const defLost = sumStack(a.unitsLostDefender);
    if (defLost === 0) {
      undefRatio++;
      continue;
    }
    const r = sent / defLost;
    for (const row of ratioRows) {
      if (r >= row.min && r < row.max) {
        row.total++;
        row[a.outcome]++;
        break;
      }
    }
  }
  for (const r of ratioRows) {
    if (r.total === 0) continue;
    const winRate = ((100 * r.captured) / r.total).toFixed(1);
    console.log(
      `  ${r.label.padEnd(28)}: n=${String(r.total).padStart(5)} cap=${r.captured} rep=${r.repelled} · win ${winRate}%`
    );
  }
  if (undefRatio > 0) {
    console.log(
      `  (skipped ${undefRatio} attacks where defenderLost=0 — empty-tile claims or instant repels)`
    );
  }

  // ── Bloodiness: average attacker loss / sent, defender loss / lost
  console.log("\n── Bloodiness (per-outcome averages)");
  for (const outcome of ["captured", "repelled", "stalemate"] as const) {
    const subset = attacks.filter((a) => a.outcome === outcome);
    if (subset.length === 0) continue;
    let aLostPctSum = 0;
    let aLostCount = 0;
    let dLostSum = 0;
    let sentSum = 0;
    let aLostSum = 0;
    for (const a of subset) {
      const sent = sumStack(a.unitsSent);
      const aLost = sumStack(a.unitsLostAttacker);
      const dLost = sumStack(a.unitsLostDefender);
      sentSum += sent;
      aLostSum += aLost;
      dLostSum += dLost;
      if (sent > 0) {
        aLostPctSum += aLost / sent;
        aLostCount++;
      }
    }
    const avgAttackerLossPct = aLostCount > 0 ? (100 * aLostPctSum) / aLostCount : 0;
    console.log(
      `  ${outcome.padEnd(10)}: n=${String(subset.length).padStart(5)}  ` +
        `avg sent=${(sentSum / subset.length).toFixed(1)}  ` +
        `avg attacker-lost=${(aLostSum / subset.length).toFixed(1)} (${avgAttackerLossPct.toFixed(1)}% of sent)  ` +
        `avg defender-lost=${(dLostSum / subset.length).toFixed(1)}`
    );
  }

  // ── Caste matchup matrix (attacker → defender win %)
  console.log("\n── Caste matchup: attacker-win % (rows=attacker, cols=defender, n in parens)");
  const matrix = new Map<string, { total: number; cap: number }>();
  for (const a of attacks) {
    if (!a.casteAttacker || !a.casteDefender) continue;
    const k = `${a.casteAttacker}|${a.casteDefender}`;
    const cur = matrix.get(k) ?? { total: 0, cap: 0 };
    cur.total++;
    if (a.outcome === "captured") cur.cap++;
    matrix.set(k, cur);
  }
  const headerCells = CASTES.map((c) => c.padStart(11));
  console.log(`            ${headerCells.join(" ")}`);
  for (const atk of CASTES) {
    const cells: string[] = [];
    for (const def of CASTES) {
      const cell = matrix.get(`${atk}|${def}`);
      if (!cell || cell.total === 0) {
        cells.push("       —   ");
      } else {
        const wr = ((100 * cell.cap) / cell.total).toFixed(0);
        cells.push(`${wr}% (n=${cell.total})`.padStart(11));
      }
    }
    console.log(`  ${atk.padEnd(9)} ${cells.join(" ")}`);
  }

  // ── Spell prevalence
  let withOffense = 0;
  let withDefense = 0;
  const offenseById = new Map<string, number>();
  const defenseById = new Map<string, number>();
  for (const a of attacks) {
    if (a.offenseSpellId) {
      withOffense++;
      offenseById.set(a.offenseSpellId, (offenseById.get(a.offenseSpellId) ?? 0) + 1);
    }
    if (a.defenseSpellId) {
      withDefense++;
      defenseById.set(a.defenseSpellId, (defenseById.get(a.defenseSpellId) ?? 0) + 1);
    }
  }
  console.log("\n── Spell prevalence");
  console.log(`  with offense spell: ${withOffense}  (${pct(withOffense)}%)`);
  console.log(`  with defense spell: ${withDefense}  (${pct(withDefense)}%)`);
  if (offenseById.size > 0) {
    console.log("  offense spells used:");
    for (const [id, n] of [...offenseById.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${id.padEnd(30)} ${n}`);
    }
  }
  if (defenseById.size > 0) {
    console.log("  defense spells triggered:");
    for (const [id, n] of [...defenseById.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${id.padEnd(30)} ${n}`);
    }
  }

  // ── Top attackers
  console.log("\n── Top 10 attackers (by attack count)");
  const byAttacker = new Map<string, { total: number; cap: number; rep: number }>();
  for (const a of attacks) {
    const cur = byAttacker.get(a.attackerId) ?? { total: 0, cap: 0, rep: 0 };
    cur.total++;
    if (a.outcome === "captured") cur.cap++;
    else if (a.outcome === "repelled") cur.rep++;
    byAttacker.set(a.attackerId, cur);
  }
  const sortedAttackers = [...byAttacker.entries()].sort((a, b) => b[1].total - a[1].total);
  for (const [uid, s] of sortedAttackers.slice(0, 10)) {
    const tag = isNpc.get(uid) ? "[NPC]" : "[hum]";
    const wr = ((100 * s.cap) / s.total).toFixed(0);
    console.log(
      `  ${tag} ${(nameByUid.get(uid) ?? uid).padEnd(28)} n=${String(s.total).padStart(4)}  cap=${s.cap} rep=${s.rep}  win ${wr}%`
    );
  }

  // ── Top defenders (most attacked)
  console.log("\n── Top 10 defenders (most attacked)");
  const byDefender = new Map<string, { total: number; lost: number; held: number }>();
  for (const a of attacks) {
    const cur = byDefender.get(a.defenderId) ?? { total: 0, lost: 0, held: 0 };
    cur.total++;
    if (a.outcome === "captured") cur.lost++;
    else if (a.outcome === "repelled") cur.held++;
    byDefender.set(a.defenderId, cur);
  }
  const sortedDefenders = [...byDefender.entries()].sort((a, b) => b[1].total - a[1].total);
  for (const [uid, s] of sortedDefenders.slice(0, 10)) {
    const tag = isNpc.get(uid) ? "[NPC]" : "[hum]";
    const lossRate = ((100 * s.lost) / s.total).toFixed(0);
    console.log(
      `  ${tag} ${(nameByUid.get(uid) ?? uid).padEnd(28)} attacked=${String(s.total).padStart(4)}  tiles-lost=${s.lost}  held=${s.held}  loss-rate ${lossRate}%`
    );
  }

  // ── Today's blitz subset vs full history
  // Today started ~2026-05-13 00:00 UTC.
  const todayStart = new Date("2026-05-13T00:00:00Z").getTime();
  const todayAttacks = attacks.filter((a) => toMs(a.createdAt) >= todayStart);
  if (todayAttacks.length > 0 && todayAttacks.length < attacks.length) {
    console.log(`\n── Today's subset (${todayAttacks.length}/${attacks.length} attacks since 2026-05-13)`);
    const t = { captured: 0, repelled: 0, stalemate: 0 };
    for (const a of todayAttacks) t[a.outcome]++;
    const tPct = (n: number) => ((100 * n) / todayAttacks.length).toFixed(1);
    console.log(`  captured ${t.captured} (${tPct(t.captured)}%)  repelled ${t.repelled} (${tPct(t.repelled)}%)  stalemate ${t.stalemate} (${tPct(t.stalemate)}%)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
