import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { getDb, jsonErr } from "@/lib/api-helpers";
import { assertBoardAccess, patchScratch } from "@/lib/pm/service";
import { COLLECTIONS } from "@/lib/pm/constants";
import { patchScratchSchema } from "@/lib/pm/schemas";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ boardId: string }> },
) {
  const user = await getVerifiedUser(request);
  if (!user) return jsonErr("Unauthorized", 401);

  const { boardId } = await context.params;
  const { db, response } = getDb();
  if (response) return response;

  try {
    await assertBoardAccess(db!, boardId, user.uid);
    const snap = await db!.collection(COLLECTIONS.SCRATCH).doc(boardId).get();
    const d = snap.data();
    return NextResponse.json({
      scratch: {
        body: typeof d?.body === "string" ? d.body : "",
        updatedBy: d?.updatedBy ?? null,
        updatedAt: d?.updatedAt
          ? (d.updatedAt as { toDate?: () => Date }).toDate?.()?.toISOString?.() ?? null
          : null,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Forbidden")) return jsonErr("Forbidden", 403);
    return jsonErr(msg, 400);
  }
}

export async function PATCH(
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

  const parsed = patchScratchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr(parsed.error.flatten().formErrors.join(", "), 400);
  }

  const { boardId } = await context.params;
  const { db, response } = getDb();
  if (response) return response;

  try {
    const scratch = await patchScratch(db!, boardId, user.uid, parsed.data.body);
    return NextResponse.json({ scratch });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Forbidden")) return jsonErr("Forbidden", 403);
    return jsonErr(msg, 400);
  }
}
