/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function AdminIndexPage() {
  const { user, userProfile, loading } = useAuth();
  const router = useRouter();
  const isAdmin = Boolean((userProfile as { isAdmin?: boolean } | null)?.isAdmin);

  useEffect(() => {
    if (loading) return;
    if (!user || !isAdmin) router.push("/");
  }, [loading, user, isAdmin, router]);

  if (loading) return <p className="text-zinc-400">Loading…</p>;
  if (!user || !isAdmin) return null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-white">Admin</h1>
      <ul className="space-y-2 text-sm">
        <li>
          <Link href="/admin/moderation" className="text-emerald-400 hover:underline">
            Community moderation queue →
          </Link>
        </li>
        <li>
          <Link href="/admin/summer-cohort" className="text-emerald-400 hover:underline">
            Summer cohort dashboard →
          </Link>
        </li>
      </ul>
    </div>
  );
}
