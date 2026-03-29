import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getVerifiedUser } from "@/lib/server-auth";
import {
  HACK_A_SPRINT_2026_EVENT_ID,
  fetchShowcaseSubmissionsFromGitHub,
} from "@/lib/hackathon-showcase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShowcaseChannel = "participant" | "community" | "judge";

type VoteAgg = { up: number; down: number; net: number };

function emptyAgg(): VoteAgg {
  return { up: 0, down: 0, net: 0 };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getVerifiedUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const submissions = await fetchShowcaseSubmissionsFromGitHub();

    const db = getAdminDb();
    const aggregates: Record<
      string,
      Record<ShowcaseChannel, VoteAgg>
    > = {};

    for (const s of submissions) {
      aggregates[s.submissionId] = {
        participant: emptyAgg(),
        community: emptyAgg(),
        judge: emptyAgg(),
      };
    }

    if (db) {
      const snap = await db
        .collection("hackathonShowcaseVotes")
        .where("eventId", "==", HACK_A_SPRINT_2026_EVENT_ID)
        .get();

      for (const doc of snap.docs) {
        const d = doc.data() as {
          submissionId?: string;
          channel?: string;
          value?: number;
        };
        const sid = d.submissionId;
        const ch = d.channel as ShowcaseChannel | undefined;
        const v = d.value;
        if (
          !sid ||
          !aggregates[sid] ||
          (ch !== "participant" && ch !== "community" && ch !== "judge") ||
          typeof v !== "number"
        ) {
          continue;
        }
        if (v === 1) aggregates[sid][ch].up += 1;
        else if (v === -1) aggregates[sid][ch].down += 1;
        aggregates[sid][ch].net = aggregates[sid][ch].up - aggregates[sid][ch].down;
      }
    }

    const uid = user.uid;
    const myVotes: Record<
      string,
      Partial<Record<ShowcaseChannel, number>>
    > = {};

    if (db) {
      const mine = await db
        .collection("hackathonShowcaseVotes")
        .where("eventId", "==", HACK_A_SPRINT_2026_EVENT_ID)
        .where("userId", "==", uid)
        .get();
      for (const doc of mine.docs) {
        const d = doc.data() as {
          submissionId?: string;
          channel?: string;
          value?: number;
        };
        if (
          d.submissionId &&
          (d.channel === "participant" ||
            d.channel === "community" ||
            d.channel === "judge") &&
          typeof d.value === "number"
        ) {
          if (!myVotes[d.submissionId]) myVotes[d.submissionId] = {};
          myVotes[d.submissionId]![d.channel] = d.value;
        }
      }
    }

    return NextResponse.json({
      submissions,
      aggregates,
      myVotes,
    });
  } catch (e) {
    console.error("[showcase submissions]", e);
    return NextResponse.json(
      { error: "Failed to load submissions" },
      { status: 500 }
    );
  }
}
