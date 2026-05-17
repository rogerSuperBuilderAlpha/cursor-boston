/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

export const TABS = [
  { id: "overview", label: "Overview" },
  { id: "phases", label: "Phases" },
  { id: "castes", label: "Castes" },
  { id: "combat", label: "Combat" },
  { id: "heroes", label: "Heroes" },
  { id: "endgame", label: "Endgame" },
  { id: "community", label: "Community" },
  { id: "world", label: "World & Lore" },
  { id: "contributor", label: "Contributor" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export function resolveTabId(raw: string | null | undefined): TabId {
  return (TABS.find((t) => t.id === raw)?.id as TabId) ?? "overview";
}
