import { NextRequest, NextResponse } from "next/server";
import { getSubmission, updateSubmission } from "@/lib/store";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const sub = getSubmission(params.id);
  if (!sub) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const { roast } = body as { roast: string };

  if (!roast) {
    return NextResponse.json(
      { error: "Missing roast selection" },
      { status: 400 }
    );
  }

  const updated = updateSubmission(params.id, { roast_chosen: roast });
  return NextResponse.json(updated);
}
