import { NextRequest, NextResponse } from "next/server";
import { getVerifiedUser } from "@/lib/server-auth";
import { getDb, jsonErr } from "@/lib/api-helpers";
import { listWorkspacesForUser } from "@/lib/pm/service";
import { DEFAULT_BOARD_ID, DEFAULT_WORKSPACE_ID } from "@/lib/pm/constants";

export async function GET(request: NextRequest) {
  const user = await getVerifiedUser(request);
  if (!user) return jsonErr("Unauthorized", 401);

  const { db, response } = getDb();
  if (response) return response;

  const list = await listWorkspacesForUser(db!, user.uid);
  const defaultBoard =
    list.find((w) => w.id === DEFAULT_WORKSPACE_ID)?.defaultBoardId ?? DEFAULT_BOARD_ID;

  return NextResponse.json({
    workspaces: list,
    defaultWorkspaceId: DEFAULT_WORKSPACE_ID,
    suggestedBoardId: defaultBoard,
  });
}
