import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { getDb, jsonErr } from "@/lib/api-helpers";
import { deleteColumnSvc, patchColumnSvc } from "@/lib/pm/service";
import { patchColumnSchema } from "@/lib/pm/schemas";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ boardId: string; columnId: string }> },
) {
  const user = await getVerifiedUser(request);
  if (!user) return jsonErr("Unauthorized", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr("Invalid JSON", 400);
  }

  const parsed = patchColumnSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr(parsed.error.flatten().formErrors.join(", "), 400);
  }

  const { boardId, columnId } = await context.params;
  const { db, response } = getDb();
  if (response) return response;

  try {
    await patchColumnSvc(db!, boardId, columnId, user.uid, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Forbidden")) return jsonErr("Forbidden", 403);
    return jsonErr(msg, 400);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ boardId: string; columnId: string }> },
) {
  const user = await getVerifiedUser(request);
  if (!user) return jsonErr("Unauthorized", 401);

  const { boardId, columnId } = await context.params;
  const { db, response } = getDb();
  if (response) return response;

  try {
    await deleteColumnSvc(db!, boardId, columnId, user.uid);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Forbidden")) return jsonErr("Forbidden", 403);
    return jsonErr(msg, 400);
  }
}
