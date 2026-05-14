#!/usr/bin/env node
/**
 * One-shot analysis script: pull last 10 days of Firestore + Auth metrics from
 * Google Cloud Monitoring, broken out per-day, per-metric. Writes JSON to
 * scripts/data/analysis-2026-05-12/gcp-metrics.json for follow-up analysis.
 *
 * Requires FIREBASE_SERVICE_ACCOUNT_JSON + NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local,
 * with monitoring.viewer on the SA.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { GoogleAuth } from "google-auth-library";

loadEnvConfig(process.cwd());

const SCOPE = "https://www.googleapis.com/auth/monitoring.read";

const METRICS: Array<{
  key: string;
  metric: string;
  groupBy?: string[];
  aligner?: string;
  reducer?: string;
}> = [
  { key: "firestore_reads", metric: "firestore.googleapis.com/document/read_count", groupBy: ["metric.label.database"] },
  { key: "firestore_writes", metric: "firestore.googleapis.com/document/write_count", groupBy: ["metric.label.database"] },
  { key: "firestore_deletes", metric: "firestore.googleapis.com/document/delete_count", groupBy: ["metric.label.database"] },
  { key: "firestore_active_connections", metric: "firestore.googleapis.com/network/active_connections", aligner: "ALIGN_MEAN", reducer: "REDUCE_MEAN" },
  { key: "firestore_snapshot_listeners", metric: "firestore.googleapis.com/network/snapshot_listeners", aligner: "ALIGN_MEAN", reducer: "REDUCE_MEAN" },
  { key: "firestore_request_count", metric: "firestore.googleapis.com/api/request_count", groupBy: ["metric.label.method", "metric.label.response_code"] },
  // Realtime DB
  { key: "rtdb_storage_bytes", metric: "firebasedatabase.googleapis.com/network/sent_bytes_count" },
  { key: "rtdb_active_connections", metric: "firebasedatabase.googleapis.com/network/active_connections", aligner: "ALIGN_MEAN", reducer: "REDUCE_MEAN" },
  // Storage
  { key: "storage_bytes_total", metric: "storage.googleapis.com/storage/total_bytes", aligner: "ALIGN_MEAN", reducer: "REDUCE_MEAN" },
  { key: "storage_request_count", metric: "storage.googleapis.com/api/request_count", groupBy: ["metric.label.response_code"] },
  // Hosting (Firebase Hosting may not be in use, but try)
  { key: "hosting_network_bytes", metric: "firebasehosting.googleapis.com/network/sent_bytes_count" },
];

const DAYS = Number(process.env.DAYS || 10);
const ALIGNMENT_SECS = 86400;

async function main(): Promise<void> {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!json || !projectId) {
    console.error("Missing FIREBASE_SERVICE_ACCOUNT_JSON or NEXT_PUBLIC_FIREBASE_PROJECT_ID.");
    process.exit(1);
  }
  const credentials = JSON.parse(json) as Record<string, unknown>;
  const auth = new GoogleAuth({ credentials, scopes: [SCOPE], projectId });
  const client = await auth.getClient();
  const token = (await client.getAccessToken()).token;
  if (!token) throw new Error("no token");

  const end = new Date();
  const start = new Date(end.getTime() - DAYS * 86400 * 1000);

  const out: Record<string, unknown> = {
    project: projectId,
    window: { start: start.toISOString(), end: end.toISOString(), days: DAYS },
    metrics: {},
  };

  for (const m of METRICS) {
    const params = new URLSearchParams({
      filter: `metric.type="${m.metric}"`,
      "interval.endTime": end.toISOString(),
      "interval.startTime": start.toISOString(),
      pageSize: "200",
      "aggregation.alignmentPeriod": `${ALIGNMENT_SECS}s`,
      "aggregation.perSeriesAligner": m.aligner ?? "ALIGN_SUM",
    });
    if (m.reducer) params.set("aggregation.crossSeriesReducer", m.reducer);
    else params.set("aggregation.crossSeriesReducer", "REDUCE_SUM");
    for (const g of m.groupBy ?? []) params.append("aggregation.groupByFields", g);

    const url = `https://monitoring.googleapis.com/v3/projects/${projectId}/timeSeries?${params.toString()}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const text = await res.text();
      (out.metrics as Record<string, unknown>)[m.key] = { error: `${res.status}`, detail: text.slice(0, 300) };
      console.log(`! ${m.key}: ${res.status}`);
      continue;
    }
    const body = (await res.json()) as {
      timeSeries?: Array<{
        metric?: { labels?: Record<string, string> };
        resource?: { labels?: Record<string, string> };
        points?: Array<{
          interval?: { startTime?: string; endTime?: string };
          value?: { int64Value?: string; doubleValue?: number };
        }>;
      }>;
    };
    const series = (body.timeSeries ?? []).map((s) => ({
      labels: { ...s.metric?.labels, ...s.resource?.labels },
      points: (s.points ?? [])
        .map((p) => ({
          t: p.interval?.startTime,
          v: Number(p.value?.int64Value ?? p.value?.doubleValue ?? 0),
        }))
        .sort((a, b) => (a.t ?? "").localeCompare(b.t ?? "")),
    }));
    (out.metrics as Record<string, unknown>)[m.key] = { series };
    const total = series.reduce((acc, s) => acc + s.points.reduce((a, p) => a + p.v, 0), 0);
    console.log(`✓ ${m.key}: ${series.length} series, total=${Math.round(total).toLocaleString()}`);
  }

  const dir = path.join(process.cwd(), "scripts/data/analysis-2026-05-12");
  mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, "gcp-metrics.json");
  writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
