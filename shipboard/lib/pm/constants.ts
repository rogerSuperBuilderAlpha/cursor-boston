export const COLLECTIONS = {
  WORKSPACES: "sb_workspaces",
  BOARDS: "sb_boards",
  COLUMNS: "columns",
  CARDS: "cards",
  NOTE_ENTRIES: "note_entries",
  SCRATCH: "sb_scratch_docs",
  LABELS: "labels",
} as const;

/** Seed IDs — must match `scripts/seed.ts` */
export const DEFAULT_WORKSPACE_ID =
  process.env.DEFAULT_WORKSPACE_ID || "cursor-boston-cohort-ws-1";
export const DEFAULT_BOARD_ID = process.env.DEFAULT_BOARD_ID || "cohort-week1-board";
