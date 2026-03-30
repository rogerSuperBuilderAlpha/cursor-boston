import { getGithubRepoPair } from "@/lib/github-recent-merged-prs";
import { logger } from "@/lib/logger";

/**
 * Merged PR count for a GitHub user to the configured community repo (GitHub Search API).
 * Returns null if the request failed (caller should fall back to another source).
 */
export async function fetchMergedPrCountForLogin(githubLogin: string): Promise<number | null> {
  const trimmed = githubLogin.trim();
  if (!trimmed) return null;

  const { owner, repo } = getGithubRepoPair();
  const q = `repo:${owner}/${repo} type:pr author:${trimmed} is:merged`;
  const url = new URL("https://api.github.com/search/issues");
  url.searchParams.set("q", q);
  url.searchParams.set("per_page", "1");

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(url.toString(), { headers, cache: "no-store" });
    if (!res.ok) {
      logger.warn("GitHub search for merged PR count failed", {
        status: res.status,
        githubLogin: trimmed,
      });
      return null;
    }
    const data = (await res.json()) as { total_count?: unknown };
    return typeof data.total_count === "number" ? data.total_count : null;
  } catch (error) {
    logger.warn("GitHub search merged PR count error", {
      githubLogin: trimmed,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * One search per login (sequential to avoid secondary rate limits on burst traffic).
 * Keys are lowercased GitHub logins; only successful API responses are stored.
 */
export async function fetchMergedPrCountsForLogins(
  githubLogins: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const unique = [...new Set(githubLogins.map((l) => l.trim()).filter(Boolean))];
  for (const login of unique) {
    const count = await fetchMergedPrCountForLogin(login);
    if (count !== null) {
      map.set(login.toLowerCase(), count);
    }
  }
  return map;
}
