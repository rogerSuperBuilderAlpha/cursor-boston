"use client";

import { useAuth } from "@/contexts/AuthContext";

/** Authenticated fetch for client components */
export function useApi() {
  const { user } = useAuth();

  return async function api(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set("Content-Type", "application/json");
    if (user) {
      const token = await user.getIdToken();
      headers.set("Authorization", `Bearer ${token}`);
    }
    return fetch(path, { ...init, headers });
  };
}
