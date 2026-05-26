import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { getDb, jsonErr } from "@/lib/api-helpers";
import { joinWorkspaceWithInvite } from "@/lib/pm/service";
import { joinWorkspaceSchema } from "@/lib/pm/schemas";

export async function POST(request: NextRequest) {
  const user = await getVerifiedUser(request);
  if (!user) return jsonErr("Unauthorized", 401);

  const code = process.env.COHORT_INVITE_CODE;
  if (!code?.trim()) {
    return jsonErr("Invite not configured on server", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErr("Invalid JSON", 400);
  }

  const parsed = joinWorkspaceSchema.safeParse(body);
  if (!parsed.success) {
    return jsonErr(parsed.error.flatten().formErrors.join(", "), 400);
  }

  const { db, response } = getDb();
  if (response) return response;

  try {
    const result = await joinWorkspaceWithInvite(db!, user.uid, parsed.data.inviteCode, code);
    return NextResponse.json({
      workspaceId: result.workspaceId,
      boardId: result.boardId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Join failed";
    const status =
      msg === "Invalid invite code" ? 403 : msg.includes("not seeded") ? 404 : 400;
    return jsonErr(msg, status);
  }
}
