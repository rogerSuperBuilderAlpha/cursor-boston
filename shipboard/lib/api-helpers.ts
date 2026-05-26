import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";

export function jsonErr(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export function getDb() {
  const db = getAdminDb();
  if (!db) {
    return { db: null as null, response: jsonErr("Database unavailable", 500) };
  }
  return { db, response: null };
}
