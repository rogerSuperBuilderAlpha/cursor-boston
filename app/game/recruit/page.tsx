/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import {
  RecruitEnlistScreen,
  RecruitLoadingScreen,
  RecruitSignInScreen,
} from "./_components/RecruitGates";
import { RecruitView } from "./_components/RecruitView";
import { useRecruitAction } from "./_lib/use-recruit-action";
import { useRecruitData } from "./_lib/use-recruit-data";

export default function RecruitPage() {
  const data = useRecruitData();
  const {
    user,
    authLoading,
    player,
    setPlayer,
    tiles,
    setTiles,
    borderTiles,
    owners,
    loading,
    error,
    setError,
  } = data;

  const action = useRecruitAction({ user, setError, setPlayer, setTiles });

  if (authLoading || loading) return <RecruitLoadingScreen />;
  if (!user) return <RecruitSignInScreen />;
  if (!player) return <RecruitEnlistScreen />;

  return (
    <RecruitView
      player={player}
      tiles={tiles}
      borderTiles={borderTiles}
      owners={owners}
      error={error}
      setError={setError}
      action={action}
    />
  );
}
