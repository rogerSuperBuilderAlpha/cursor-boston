import { NextRequest, NextResponse } from "next/server";
import { removeSubmission } from "@/lib/store";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const removed = removeSubmission(params.id);
  if (!removed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
