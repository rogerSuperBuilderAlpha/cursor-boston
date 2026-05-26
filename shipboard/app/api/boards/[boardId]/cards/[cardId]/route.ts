import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { getDb, jsonErr } from "@/lib/api-helpers";
import { deleteCardSvc, patchCardSvc } from "@/lib/pm/service";
import { patchCardSchema } from "@/lib/pm/schemas";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ boardId: string; cardId: string }> },
) {
  const user = await getVerifiedUser(request);
  if (!user) return jsonErr("Unauthorized", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr("Invalid JSON", 400);
  }

  const parsed = patchCardSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr(parsed.error.flatten().formErrors.join(", "), 400);
  }

  const { boardId, cardId } = await context.params;
  const { db, response } = getDb();
  if (response) return response;

  try {
    const card = await patchCardSvc(db!, boardId, cardId, user.uid, parsed.data);
    return NextResponse.json({ card });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Forbidden")) return jsonErr("Forbidden", 403);
    return jsonErr(msg, 400);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ boardId: string; cardId: string }> },
) {
  const user = await getVerifiedUser(request);
  if (!user) return jsonErr("Unauthorized", 401);

  const { boardId, cardId } = await context.params;
  const { db, response } = getDb();
  if (response) return response;

  try {
    await deleteCardSvc(db!, boardId, cardId, user.uid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Forbidden")) return jsonErr("Forbidden", 403);
    return jsonErr(msg, 400);
  }
}
