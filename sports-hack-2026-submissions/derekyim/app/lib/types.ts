export type Mode = "hype" | "roast";

export type Status = "pending" | "scored" | "approved" | "rejected";

export interface Scores {
  energy: number;
  celtics_rep: number;
  originality: number;
  safety: number;
}

export interface Submission {
  id: string;
  mode: Mode;
  name: string;
  section: string;
  thumbnail: string; // base64 data URL
  createdAt: number;
  status: Status;

  scores: Scores | null;
  composite_score: number;
  safety_flagged: boolean;
  vision_description: string | null;

  roast_candidates: string[];
  roast_chosen: string | null;
  dunkinWinner: boolean;
}
