import { createHmac, timingSafeEqual } from "node:crypto";

const CLOSING_KEYWORD_PATTERN =
  /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/gi;

export function extractLinkedIssueNumbers(...texts: Array<string | null | undefined>): number[] {
  const issueNumbers = new Set<number>();

  for (const text of texts) {
    if (!text) continue;

    for (const match of text.matchAll(CLOSING_KEYWORD_PATTERN)) {
      const issueNumber = Number.parseInt(match[1] ?? "", 10);
      if (Number.isFinite(issueNumber)) {
        issueNumbers.add(issueNumber);
      }
    }
  }

  return [...issueNumbers];
}

export function verifyGitHubSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const digest = signatureHeader.slice("sha256=".length);
  const expected = createHmacDigest(payload, secret);

  if (digest.length !== expected.length) {
    return false;
  }

  return timingSafeEqualHex(digest, expected);
}

function createHmacDigest(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

function timingSafeEqualHex(left: string, right: string): boolean {
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export type GitHubPullRequestPayload = {
  action?: string;
  pull_request?: {
    merged?: boolean;
    title?: string | null;
    body?: string | null;
    html_url?: string | null;
  };
};

export function isMergedPullRequest(payload: GitHubPullRequestPayload): boolean {
  return payload.action === "closed" && payload.pull_request?.merged === true;
}
