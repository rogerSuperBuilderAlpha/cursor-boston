#!/usr/bin/env node
/**
 * Build and store the definitive Hack-a-Sprint 2026 ranking.
 *
 * Ranking criteria:
 *   1. Merged PRs to the community repo through April 9, 2026 (descending)
 *   2. Luma signup date (ascending — earlier = higher)
 *
 * Top 50 = confirmed (frozen), rest = waitlisted.
 * Waitlisted participants can jockey based on PRs merged after April 9.
 *
 * Usage:
 *   npx tsx scripts/build-hack-a-sprint-ranking.ts [--csv path/to/luma.csv]
 *
 * Outputs: scripts/data/hack-a-sprint-2026-ranking.json
 */
import { readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join, resolve } from "path";

const REPO_OWNER = "rogerSuperBuilderAlpha";
const REPO_NAME = "cursor-boston";
const PR_CUTOFF = "2026-04-09T23:59:59Z";
const TOP_N = 50;

const JUDGE_LOGINS = new Set(["rogersuperbuilderalpha", "rayruizhiliao"]);
const BOT_SUFFIXES = ["[bot]"];
const JUDGE_EMAILS = new Set(["regorhunt02052@gmail.com", "rayruizhiliao@gmail.com"]);
const DECLINED_EMAILS = new Set([
  "nasit.v@northeastern.edu",
  "renganathan.b@northeastern.edu",
  "revoftc@gmail.com",
  "sakhare.c@northeastern.edu",
  "lnu.ava@northeastern.edu",
  "harrychow8888@gmail.com",
  "brucejia@bu.edu",
]);

/**
 * Known GitHub login corrections: Luma free-text → actual GitHub OAuth login.
 * Populated from cross-referencing Luma CSV usernames with the repo's merged PR authors.
 */
const GITHUB_LOGIN_CORRECTIONS: Record<string, string> = {
  mhoniseus: "smrifaki",
  chloezzxzzc: "chloezhangzzc",
  aakashmkj: "aakashm1712",
  dannygarciadev: "DannyGarciaDEV",
};

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
        if (content[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\r") { /* skip */ }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else field += c;
  }
  row.push(field);
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  if (rows.length < 2) return [];
  const header = rows[0]!.map((h) => h.trim());
  return rows.slice(1).map((line) => {
    const obj: CsvRow = {};
    for (let j = 0; j < header.length; j++) obj[header[j]!] = (line[j] ?? "").trim();
    return obj;
  });
}

function parseGithubLogin(raw: string): string | null {
  if (!raw) return null;
  let s = raw.trim();
  const lower = s.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    try {
      const u = new URL(s);
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

function resolveGithubLogin(lumaLogin: string): string {
  const corrected = GITHUB_LOGIN_CORRECTIONS[lumaLogin.toLowerCase()];
  return corrected ?? lumaLogin;
}

async function fetchAllMergedPrs(): Promise<
  Array<{ login: string; merged_at: string }>
> {
  const prs: Array<{ login: string; merged_at: string }> = [];
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  for (let page = 1; page <= 30; page++) {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/pulls?state=closed&per_page=100&page=${page}&sort=created&direction=asc`;
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) { console.error(`GitHub API error: ${res.status} page ${page}`); break; }
    const items = (await res.json()) as Array<{
      merged_at?: string | null;
      user?: { login?: string } | null;
    }>;
    if (items.length === 0) break;
    for (const pr of items) {
      if (!pr.merged_at || !pr.user?.login) continue;
      prs.push({ login: pr.user.login.toLowerCase(), merged_at: pr.merged_at });
    }
    if (items.length < 100) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  return prs;
}

function countPrs(
  prs: Array<{ login: string; merged_at: string }>,
  cutoffMs?: number
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const pr of prs) {
    if (JUDGE_LOGINS.has(pr.login)) continue;
    if (BOT_SUFFIXES.some((s) => pr.login.endsWith(s))) continue;
    if (cutoffMs !== undefined && new Date(pr.merged_at).getTime() > cutoffMs) continue;
    counts.set(pr.login, (counts.get(pr.login) ?? 0) + 1);
  }
  return counts;
}

const GITHUB_COL = "What is your GitHub username?";

type RankedEntry = {
  rank: number;
  status: "confirmed" | "waitlisted";
  email: string;
  name: string;
  githubLogin: string | null;
  resolvedGithubLogin: string | null;
  prsThruApr9: number;
  prsAllTime: number;
  lumaCreatedAt: string;
  lumaSignupMs: number;
};

async function main() {
  const csvIdx = process.argv.indexOf("--csv");
  const csvPath =
    csvIdx >= 0 && process.argv[csvIdx + 1]
      ? process.argv[csvIdx + 1]!
      : join(homedir(), "Downloads", "Cursor Boston Hack-a-Sprint - Guests - 2026-04-11-12-28-29.csv");

  const raw = readFileSync(csvPath, "utf8");
  const csvRows = parseCsv(raw);
  console.log(`Loaded ${csvRows.length} rows from ${csvPath}`);

  console.log("Fetching all merged PRs from GitHub…");
  const allPrs = await fetchAllMergedPrs();
  console.log(`Fetched ${allPrs.length} merged PRs total.`);

  const cutoffMs = new Date(PR_CUTOFF).getTime();
  const prsThruApr9 = countPrs(allPrs, cutoffMs);
  const prsAllTime = countPrs(allPrs);

  console.log("\nPR counts through April 9:");
  const sortedApr9 = [...prsThruApr9.entries()].sort((a, b) => b[1] - a[1]);
  for (const [login, count] of sortedApr9) console.log(`  ${login}: ${count}`);

  console.log("\nPost-April 9 changes:");
  for (const [login, total] of prsAllTime) {
    const before = prsThruApr9.get(login) ?? 0;
    if (total > before) console.log(`  ${login}: ${before} → ${total} (+${total - before})`);
  }

  const seen = new Set<string>();
  const entries: Omit<RankedEntry, "rank" | "status">[] = [];

  for (const row of csvRows) {
    const email = (row.email ?? "").trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    if (JUDGE_EMAILS.has(email) || DECLINED_EMAILS.has(email)) continue;
    if ((row.approval_status || "").toLowerCase() === "declined") continue;
    seen.add(email);

    const rawGh = parseGithubLogin(row[GITHUB_COL] ?? "");
    const resolved = rawGh ? resolveGithubLogin(rawGh) : null;
    const resolvedLower = resolved?.toLowerCase() ?? null;

    const fn = row.first_name?.trim();
    const ln = row.last_name?.trim();
    const name = [fn, ln].filter(Boolean).join(" ") || row.name?.trim() || "there";
    const lumaCreatedAt = row.created_at ?? "";

    entries.push({
      email,
      name,
      githubLogin: rawGh,
      resolvedGithubLogin: resolved,
      prsThruApr9: resolvedLower ? (prsThruApr9.get(resolvedLower) ?? 0) : 0,
      prsAllTime: resolvedLower ? (prsAllTime.get(resolvedLower) ?? 0) : 0,
      lumaCreatedAt,
      lumaSignupMs: lumaCreatedAt ? new Date(lumaCreatedAt).getTime() : Infinity,
    });
  }

  // Sort: PRs through Apr 9 desc, then Luma signup asc
  entries.sort((a, b) => {
    if (b.prsThruApr9 !== a.prsThruApr9) return b.prsThruApr9 - a.prsThruApr9;
    return a.lumaSignupMs - b.lumaSignupMs;
  });

  const ranked: RankedEntry[] = entries.map((e, i) => ({
    ...e,
    rank: i + 1,
    status: i < TOP_N ? ("confirmed" as const) : ("waitlisted" as const),
  }));

  // For waitlisted people, re-rank by all-time PRs + Luma date
  const confirmed = ranked.filter((r) => r.status === "confirmed");
  const waitlisted = ranked.filter((r) => r.status === "waitlisted");
  waitlisted.sort((a, b) => {
    if (b.prsAllTime !== a.prsAllTime) return b.prsAllTime - a.prsAllTime;
    return a.lumaSignupMs - b.lumaSignupMs;
  });
  for (let i = 0; i < waitlisted.length; i++) {
    waitlisted[i]!.rank = TOP_N + 1 + i;
  }

  const final = [...confirmed, ...waitlisted];

  console.log("\n=== DEFINITIVE RANKING ===");
  const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);
  for (const r of final) {
    const prInfo =
      r.prsAllTime > r.prsThruApr9
        ? `apr9=${r.prsThruApr9} now=${r.prsAllTime}`
        : `pr=${r.prsThruApr9}`;
    console.log(
      [
        pad(`#${r.rank}`, 5),
        pad(r.status.toUpperCase(), 12),
        pad(r.email, 42),
        pad(prInfo, 20),
        r.resolvedGithubLogin ? `@${r.resolvedGithubLogin}` : "—",
        r.githubLogin !== r.resolvedGithubLogin ? `(luma: @${r.githubLogin})` : "",
      ]
        .filter(Boolean)
        .join("  ")
    );
  }

  const outPath = resolve(__dirname, "data/hack-a-sprint-2026-ranking.json");
  const output = {
    generatedAt: new Date().toISOString(),
    prCutoffDate: "2026-04-09",
    topN: TOP_N,
    totalParticipants: final.length,
    confirmedCount: confirmed.length,
    waitlistedCount: waitlisted.length,
    githubLoginCorrections: GITHUB_LOGIN_CORRECTIONS,
    ranking: final.map((r) => ({
      rank: r.rank,
      status: r.status,
      email: r.email,
      name: r.name,
      githubLogin: r.resolvedGithubLogin,
      lumaGithubLogin: r.githubLogin !== r.resolvedGithubLogin ? r.githubLogin : undefined,
      prsThruApr9: r.prsThruApr9,
      prsAllTime: r.prsAllTime,
      lumaCreatedAt: r.lumaCreatedAt,
    })),
  };

  writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`\nStored ranking to ${outPath}`);
  console.log(`Confirmed: ${confirmed.length}, Waitlisted: ${waitlisted.length}, Total: ${final.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
