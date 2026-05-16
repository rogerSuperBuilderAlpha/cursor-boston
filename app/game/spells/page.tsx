/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import {
  CasteRequiredScreen,
  SpellsEnlistScreen,
  SpellsLoadingScreen,
  SpellsSignInScreen,
} from "./_components/SpellsGates";
import { SpellsView } from "./_components/SpellsView";
import { useSpellActions } from "./_lib/use-spell-actions";
import { useSpellsData } from "./_lib/use-spells-data";

export default function SpellsPage() {
  const data = useSpellsData();
  const {
    user,
    authLoading,
    player,
    setPlayer,
    tiles,
    setTiles,
    borderTiles,
    owners,
    worldMeta,
    refreshPlayer,
    loading,
    error,
    setError,
  } = data;

  const actions = useSpellActions({ user, setError, setPlayer, setTiles });

  if (authLoading || loading) return <SpellsLoadingScreen />;
  if (!user) return <SpellsSignInScreen />;
  if (!player) return <SpellsEnlistScreen />;
  if (!player.caste) return <CasteRequiredScreen />;

  return (
    <SpellsView
      user={user}
      player={player}
      tiles={tiles}
      borderTiles={borderTiles}
      owners={owners}
      worldMeta={worldMeta}
      onAfterArmageddon={refreshPlayer}
      error={error}
      actions={actions}
    />
  );
}
