import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { getDb, jsonErr } from "@/lib/api-helpers";
import { appendNote, listNotes } from "@/lib/pm/service";
import { createNoteSchema } from "@/lib/pm/schemas";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ boardId: string }> },
) {
  const user = await getVerifiedUser(request);
  if (!user) return jsonErr("Unauthorized", 401);

  const { boardId } = await context.params;
  const limit = Math.min(Number(new URL(request.url).searchParams.get("limit")) || 100, 200);

  const { db, response } = getDb();
  if (response) return response;

  try {
    const notes = await listNotes(db!, boardId, user.uid, limit);
    return NextResponse.json({ notes });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Forbidden")) return jsonErr("Forbidden", 403);
    return jsonErr(msg, 400);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ boardId: string }> },
) {
  const user = await getVerifiedUser(request);
  if (!user) return jsonErr("Unauthorized", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr("Invalid JSON", 400);
  }

  const parsed = createNoteSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr(parsed.error.flatten().formErrors.join(", "), 400);
  }

  const { boardId } = await context.params;
  const { db, response } = getDb();
  if (response) return response;

  const name = user.name || user.email || "Member";
  try {
    const note = await appendNote(db!, boardId, user.uid, parsed.data.body, name, user.picture ?? null);
    return NextResponse.json({ note });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Forbidden")) return jsonErr("Forbidden", 403);
    return jsonErr(msg, 400);
  }
}
