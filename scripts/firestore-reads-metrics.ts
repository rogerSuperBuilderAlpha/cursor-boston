#!/usr/bin/env node
/**
 * Firestore document reads from Google Cloud Monitoring (last N days).
 * Uses FIREBASE_SERVICE_ACCOUNT_JSON from .env.local — requires monitoring.viewer (or broader) on that SA.
 *
 * Usage:
 *   npx tsx scripts/firestore-reads-metrics.ts
 *   npx tsx scripts/firestore-reads-metrics.ts --days=14
 *   npx tsx scripts/firestore-reads-metrics.ts --inspect-labels
 */

import { loadEnvConfig } from "@next/env";
import { GoogleAuth } from "google-auth-library";

loadEnvConfig(process.cwd());

const MONITORING_READ_SCOPE = "https://www.googleapis.com/auth/monitoring.read";
const READ_METRIC = "firestore.googleapis.com/document/read_count";

function parseArgs(): { days: number; inspectLabels: boolean } {
  const raw = process.argv.find((a) => a.startsWith("--days="));
  const days = raw ? Math.max(1, Math.min(90, Number(raw.split("=")[1]) || 7)) : 7;
  const inspectLabels = process.argv.includes("--inspect-labels");
  return { days, inspectLabels };
}

async function main(): Promise<void> {
  const { days, inspectLabels } = parseArgs();
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!json || !projectId) {
    console.error("Missing FIREBASE_SERVICE_ACCOUNT_JSON or NEXT_PUBLIC_FIREBASE_PROJECT_ID (.env.local).");
    process.exit(1);
  }

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(json) as Record<string, unknown>;
  } catch {
    console.error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.");
    process.exit(1);
  }

  const auth = new GoogleAuth({
    credentials,
    scopes: [MONITORING_READ_SCOPE],
    projectId,
  });

  const client = await auth.getClient();
  const token = (await client.getAccessToken()).token;
  if (!token) {
    console.error("Could not obtain access token.");
    process.exit(1);
  }

  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    filter: `metric.type="${READ_METRIC}"`,
    "interval.endTime": end.toISOString(),
    "interval.startTime": start.toISOString(),
    pageSize: inspectLabels ? "25" : "100",
  });

  if (!inspectLabels) {
    params.set("aggregation.alignmentPeriod", `${86400}s`);
    params.set("aggregation.perSeriesAligner", "ALIGN_SUM");
    params.set("aggregation.crossSeriesReducer", "REDUCE_SUM");
    params.set("aggregation.groupByFields", "metric.label.database");
  }

  const url = `https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries?${params.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Monitoring API ${res.status}: ${text}`);
    if (res.status === 403) {
      console.error(
        "\nGrant the service account role roles/monitoring.viewer (or roles/viewer) on project",
        projectId,
      );
    }
    process.exit(1);
  }

  const body = (await res.json()) as {
    timeSeries?: Array<{
      metric?: { labels?: Record<string, string> };
      points?: Array<{ value?: { int64Value?: string; doubleValue?: number } }>;
    }>;
  };

  const series = body.timeSeries ?? [];
  if (inspectLabels) {
    console.log(
      `Sample time series (metric ${READ_METRIC}) — label keys available in Cloud Monitoring:\nProject: ${projectId}\n`,
    );
    const seen = new Set<string>();
    for (const s of series) {
      const labels = s.metric?.labels ?? {};
      const key = JSON.stringify(labels);
      if (seen.has(key)) continue;
      seen.add(key);
      console.log(" ", labels);
    }
    console.log(`\n(${seen.size} distinct label sets in first page; Firestore typically does not expose collection name here.)`);
    return;
  }

  console.log(
    `Firestore document reads (metric ${READ_METRIC})\nProject: ${projectId}\nWindow: last ${days} days (daily ALIGN_SUM, cross-series REDUCE_SUM per database label)\n`,
  );

  if (series.length === 0) {
    console.log("No time series returned (no data in window, or metric not available for this project).");
    return;
  }

  let grandTotal = 0;
  for (const s of series) {
    const db = s.metric?.labels?.database ?? "(default)";
    let sum = 0;
    for (const p of s.points ?? []) {
      const v = p.value?.int64Value ?? p.value?.doubleValue;
      if (typeof v === "string") sum += Number(v);
      else if (typeof v === "number") sum += v;
    }
    grandTotal += sum;
    console.log(`  ${db}: ${Math.round(sum).toLocaleString()} reads (aggregated over window)`);
  }
  console.log(`\nTotal (all series shown): ${Math.round(grandTotal).toLocaleString()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
