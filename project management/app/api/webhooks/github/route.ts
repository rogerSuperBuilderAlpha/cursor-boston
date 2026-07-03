import { NextResponse } from "next/server";
import { markTaskDoneByGitHubIssue } from "@/lib/db";
import { publishTaskEvent } from "@/lib/events";
import {
  extractLinkedIssueNumbers,
  isMergedPullRequest,
  verifyGitHubSignature,
  type GitHubPullRequestPayload,
} from "@/lib/github";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const payload = await request.text();

  if (secret) {
    const signature = request.headers.get("x-hub-signature-256");
    if (!verifyGitHubSignature(payload, signature, secret)) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    }
  }

  const eventName = request.headers.get("x-github-event");
  if (eventName !== "pull_request") {
    return NextResponse.json({ ok: true, ignored: true, reason: "Unsupported event." });
  }

  let body: GitHubPullRequestPayload;
  try {
    body = JSON.parse(payload) as GitHubPullRequestPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!isMergedPullRequest(body)) {
    return NextResponse.json({ ok: true, ignored: true, reason: "Pull request was not merged." });
  }

  const issueNumbers = extractLinkedIssueNumbers(
    body.pull_request?.title,
    body.pull_request?.body,
  );

  if (issueNumbers.length === 0) {
    return NextResponse.json({
      ok: true,
      ignored: true,
      reason: "No closing keywords (e.g. Fixes #12) found in pull request.",
    });
  }

  const updatedTasks = issueNumbers
    .map((issueNumber) => markTaskDoneByGitHubIssue(issueNumber))
    .filter((task): task is NonNullable<typeof task> => task !== null);

  for (const task of updatedTasks) {
    publishTaskEvent({
      type: "task.updated",
      task,
      source: "webhook",
    });
  }

  return NextResponse.json({
    ok: true,
    linkedIssues: issueNumbers,
    updatedTaskIds: updatedTasks.map((task) => task.id),
    pullRequestUrl: body.pull_request?.html_url ?? null,
  });
}
