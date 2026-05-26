/**
 * One-time seed: default workspace, board, columns, labels, empty scratch.
 *
 * Usage (from shipboard/):
 *   FIREBASE_SERVICE_ACCOUNT_JSON='...' COHORT_INVITE_CODE='your-code' npm run seed
 */

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  DEFAULT_BOARD_ID,
  DEFAULT_WORKSPACE_ID,
} from "../lib/pm/constants";

function initAdmin() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    console.error("Set FIREBASE_SERVICE_ACCOUNT_JSON");
    process.exit(1);
  }
  const sa = JSON.parse(raw) as { project_id?: string; projectId?: string };
  if (getApps().length === 0) {
    initializeApp({
      credential: cert(JSON.parse(raw)),
      projectId: sa.projectId ?? sa.project_id,
    });
  }
  return getFirestore();
}

const COLUMNS: { id: string; title: string; position: number }[] = [
  { id: "col-backlog", title: "Backlog", position: 0 },
  { id: "col-building", title: "Building", position: 1 },
  { id: "col-demo", title: "Ready for demo", position: 2 },
  { id: "col-shipped", title: "Shipped", position: 3 },
];

const DEFAULT_LABELS: { id: string; name: string; color: string }[] = [
  { id: "lbl-bug", name: "Bug", color: "#ef4444" },
  { id: "lbl-feature", name: "Feature", color: "#22c55e" },
  { id: "lbl-chore", name: "Chore", color: "#a1a1aa" },
  { id: "lbl-shipping", name: "Shipping", color: "#38bdf8" },
];

async function seed() {
  const db = initAdmin();
  const wsRef = db.collection(COLLECTIONS.WORKSPACES).doc(DEFAULT_WORKSPACE_ID);
  const seedUid = process.env.SEED_OWNER_UID || "seed";

  await wsRef.set(
    {
      name: "Cursor Boston cohort",
      slug: "cursor-boston-cohort-2026",
      memberIds: process.env.SEED_OWNER_UID ? [process.env.SEED_OWNER_UID] : [],
      createdBy: seedUid,
      defaultBoardId: DEFAULT_BOARD_ID,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  for (const lb of DEFAULT_LABELS) {
    await wsRef.collection(COLLECTIONS.LABELS).doc(lb.id).set(
      {
        name: lb.name,
        color: lb.color,
      },
      { merge: true },
    );
  }

  const boardRef = db.collection(COLLECTIONS.BOARDS).doc(DEFAULT_BOARD_ID);
  await boardRef.set(
    {
      workspaceId: DEFAULT_WORKSPACE_ID,
      title: "Week 1 — Shipboard",
      weekLabel: "Week 1",
      columnOrder: COLUMNS.map((c) => c.id),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  for (const c of COLUMNS) {
    await boardRef.collection(COLLECTIONS.COLUMNS).doc(c.id).set(
      {
        title: c.title,
        position: c.position,
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }

  await db.collection(COLLECTIONS.SCRATCH).doc(DEFAULT_BOARD_ID).set(
    {
      body: "## Running context\n\nUse the **Stream** tab for quick shipping updates; keep longer plans here.",
      updatedBy: seedUid,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  console.log("Seed complete:", DEFAULT_WORKSPACE_ID, DEFAULT_BOARD_ID);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
