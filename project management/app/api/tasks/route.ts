import { NextResponse } from "next/server";
import { getAllTasks } from "@/lib/tasks-service";

export const runtime = "nodejs";

export async function GET() {
  const tasks = getAllTasks();
  return NextResponse.json({ tasks });
}
