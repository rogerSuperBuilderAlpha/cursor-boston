/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";

function Finalizer() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    const returnTo = searchParams.get("returnTo") || "/";
    (async () => {
      try {
        const res = await fetch("/api/ludwitt/finalize-token", { method: "POST" });
        if (!res.ok) throw new Error("finalize_failed");
        const { token } = (await res.json()) as { token?: string };
        if (!token) throw new Error("finalize_failed");
        if (!auth) throw new Error("firebase_not_initialized");
        await signInWithCustomToken(auth, token);
        if (!cancelled) router.replace(returnTo);
      } catch {
        if (!cancelled) {
          router.replace("/login?ludwitt=error&message=finalize_failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-sm text-neutral-500 dark:text-neutral-400">
        Signing you in with Ludwitt…
      </div>
    </div>
  );
}

export default function LudwittFinalizePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center px-4 text-sm text-neutral-500">
          Signing you in with Ludwitt…
        </div>
      }
    >
      <Finalizer />
    </Suspense>
  );
}
