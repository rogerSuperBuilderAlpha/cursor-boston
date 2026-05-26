import { NextRequest, NextResponse } from "next/server";
import {
  getSubmission,
  updateSubmission,
  getApprovedRoastCount,
} from "@/lib/store";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sub = getSubmission(params.id);
  if (!sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  updateSubmission(params.id, { status: "approved" });

  let dunkinWinner = false;
  if (sub.mode === "roast") {
    const roastCount = getApprovedRoastCount();
    dunkinWinner = roastCount % 5 === 0 && roastCount > 0;
  }

  if (dunkinWinner) {
    updateSubmission(params.id, { dunkinWinner: true });
  }

  const updated = getSubmission(params.id);
  return NextResponse.json({ ...updated, dunkinWinner });
}
