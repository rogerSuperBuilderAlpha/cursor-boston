import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { getDb, jsonErr } from "@/lib/api-helpers";
import { applyLayoutSvc } from "@/lib/pm/service";
import { layoutPatchSchema } from "@/lib/pm/schemas";

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

  const parsed = layoutPatchSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr(parsed.error.flatten().formErrors.join(", "), 400);
  }

  const { boardId } = await context.params;
  const { db, response } = getDb();
  if (response) return response;

  try {
    await applyLayoutSvc(db!, boardId, user.uid, parsed.data.cards);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("Forbidden")) return jsonErr("Forbidden", 403);
    return jsonErr(msg, 400);
  }
}
