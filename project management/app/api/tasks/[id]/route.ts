import { NextResponse } from "next/server";
import { changeTaskStatus } from "@/lib/tasks-service";
import type { TaskStatus } from "@/lib/types";

export const runtime = "nodejs";

const VALID_STATUSES: TaskStatus[] = ["backlog", "in-progress", "review", "done"];

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json()) as { status?: TaskStatus };
  const status = body.status;

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid task status." }, { status: 400 });
  }

  const updatedTask = changeTaskStatus(id, status, "api");
  if (!updatedTask) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  return NextResponse.json({ task: updatedTask });
}
