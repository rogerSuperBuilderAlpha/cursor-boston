import { NextRequest, NextResponse } from "next/server";
import {
  addSubmission,
  getAllSubmissions,
  getQueuePosition,
  updateSubmission,
} from "@/lib/store";
import { scoreAndRoast } from "@/lib/claude";
import { Submission, Mode } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { mode, name, section, thumbnail } = body as {
      mode: Mode;
      name: string;
      section: string;
      thumbnail: string;
    };

    if (!mode || !name || !thumbnail) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const id = crypto.randomUUID();
    const submission: Submission = {
      id,
      mode,
      name,
      section: section || "N/A",
      thumbnail,
      createdAt: Date.now(),
      status: "pending",
      scores: null,
      composite_score: 0,
      safety_flagged: false,
      vision_description: null,
      roast_candidates: [],
      roast_chosen: null,
      dunkinWinner: false,
    };

    addSubmission(submission);

    try {
      const result = await scoreAndRoast(thumbnail);
      const composite =
        Math.round(
          (result.energy + result.celtics_rep + result.originality) / 3
        );
      const isSafetyFlagged = result.safety < 70;

      updateSubmission(id, {
        scores: {
          energy: result.energy,
          celtics_rep: result.celtics_rep,
          originality: result.originality,
          safety: result.safety,
        },
        composite_score: composite,
        safety_flagged: isSafetyFlagged,
        vision_description: result.vision_description,
        roast_candidates: result.roast_candidates,
        status: isSafetyFlagged ? "rejected" : "scored",
      });
    } catch (aiErr) {
      console.error("Claude scoring failed:", aiErr);
      updateSubmission(id, {
        status: "scored",
        composite_score: 50,
        vision_description: "AI scoring unavailable",
        roast_candidates: [
          "This fan is too powerful for AI to roast.",
          "Even the algorithms are speechless.",
          "No roast needed — this energy speaks for itself.",
        ],
      });
    }

    const position = getQueuePosition(id);

    return NextResponse.json({ id, position, status: "scored" });
  } catch (err) {
    console.error("Submission error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const full = req.nextUrl.searchParams.get("full") === "1";
  const submissions = getAllSubmissions();

  if (full) {
    return NextResponse.json(submissions);
  }

  const sanitized = submissions.map((s) => ({
    ...s,
    thumbnail: s.thumbnail.substring(0, 80) + "...",
  }));
  return NextResponse.json(sanitized);
}
