import { NextRequest, NextResponse } from "next/server";
import { getSubmission, updateSubmission } from "@/lib/store";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sub = getSubmission(params.id);
  if (!sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = updateSubmission(params.id, { status: "rejected" });
  return NextResponse.json(updated);
}
