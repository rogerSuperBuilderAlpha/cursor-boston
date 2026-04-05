import { getGithubRepoPair } from "@/lib/github-recent-merged-prs";

export const HACK_A_SPRINT_2026_EVENT_ID = "hack-a-sprint-2026";
export const HACK_A_SPRINT_2026_LABEL = "hack-a-sprint-2026";
export const HACK_A_SPRINT_2026_SUBMISSIONS_PATH =
  "content/hackathons/hack-a-sprint-2026/submissions";

export type ShowcaseSubmissionPayload = {
  projectRepoUrl: string;
  deployedUrl: string;
  title: string;
  description: string;
  /** Required Loom (or other) walkthrough URL for Hack-a-Sprint 2026. */
  loomVideoUrl: string;
  demoVideoUrl?: string;
};

export type ShowcaseSubmission = {
  submissionId: string;
  githubLogin: string;
  payload: ShowcaseSubmissionPayload;
};

type GitHubContentItem = {
  name: string;
  type: string;
  download_url: string | null;
};

const LOGIN_JSON = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9]))*\.json$/;
const SKIP_FILES = new Set(["readme.md", "example-login.json"]);

function githubHeaders(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

/**
 * List submission JSON files from GitHub API (public repo works without token).
 */
export async function fetchShowcaseSubmissionsFromGitHub(): Promise<
  ShowcaseSubmission[]
> {
  const { owner, repo } = getGithubRepoPair();
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${HACK_A_SPRINT_2026_SUBMISSIONS_PATH}`;
  const res = await fetch(url, { headers: githubHeaders(), next: { revalidate: 60 } });
  if (res.status === 404) {
    return [];
  }
  if (!res.ok) {
    throw new Error(`GitHub contents API failed: ${res.status}`);
  }
  const items = (await res.json()) as GitHubContentItem[];
  if (!Array.isArray(items)) {
    return [];
  }

  const jsonFiles = items.filter(
    (item) =>
      item.type === "file" &&
      item.name &&
      LOGIN_JSON.test(item.name) &&
      !SKIP_FILES.has(item.name.toLowerCase())
  );

  const results: ShowcaseSubmission[] = [];
  for (const file of jsonFiles) {
    if (!file.download_url) continue;
    const githubLogin = file.name.replace(/\.json$/i, "");
    try {
      const raw = await fetch(file.download_url, {
        headers: githubHeaders(),
        next: { revalidate: 60 },
      });
      if (!raw.ok) continue;
      const payload = (await raw.json()) as ShowcaseSubmissionPayload;
      if (
        typeof payload?.projectRepoUrl !== "string" ||
        typeof payload?.deployedUrl !== "string" ||
        typeof payload?.title !== "string" ||
        typeof payload?.description !== "string" ||
        typeof payload?.loomVideoUrl !== "string"
      ) {
        continue;
      }
      results.push({
        submissionId: githubLogin.toLowerCase(),
        githubLogin,
        payload: {
          projectRepoUrl: payload.projectRepoUrl,
          deployedUrl: payload.deployedUrl,
          title: payload.title,
          description: payload.description,
          loomVideoUrl: payload.loomVideoUrl,
          demoVideoUrl:
            typeof payload.demoVideoUrl === "string"
              ? payload.demoVideoUrl
              : undefined,
        },
      });
    } catch {
      // skip invalid
    }
  }

  results.sort((a, b) => a.githubLogin.localeCompare(b.githubLogin, "en"));
  return results;
}

export function getJudgeUidSet(): Set<string> {
  const raw = process.env.HACK_A_SPRINT_2026_JUDGE_UIDS || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/** Comma-separated list, case-insensitive (e.g. judge@org.com,judge2@org.com). */
export function getJudgeEmailSet(): Set<string> {
  const raw = process.env.HACK_A_SPRINT_2026_JUDGE_EMAILS || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Whether the GitHub user has a merged PR with the showcase label in the community repo.
 */
export async function githubUserHasMergedLabeledShowcasePr(
  githubLogin: string
): Promise<boolean> {
  if (!githubLogin) return false;
  const { owner, repo } = getGithubRepoPair();
  const q = encodeURIComponent(
    `repo:${owner}/${repo} is:pr is:merged label:${HACK_A_SPRINT_2026_LABEL} author:${githubLogin}`
  );
  const url = `https://api.github.com/search/issues?q=${q}&per_page=1`;
  const res = await fetch(url, { headers: githubHeaders() });
  if (!res.ok) {
    return false;
  }
  const data = (await res.json()) as { total_count?: number };
  return typeof data.total_count === "number" && data.total_count > 0;
}
