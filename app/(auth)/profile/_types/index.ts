export type Tab = "overview" | "events" | "talks" | "security" | "settings";

export interface TalkSubmission {
  id: string;
  title: string;
  status: string;
  submittedAt: { toDate: () => Date } | null;
}

export interface ConnectedAgent {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  claimedAt?: { _seconds: number };
}

export const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "events", label: "My Events" },
  { id: "talks", label: "My Talks" },
  { id: "security", label: "Security" },
  { id: "settings", label: "Public Profile" },
];
