import { Timestamp } from "firebase/firestore";

export type SessionType = "teach-me" | "build-together" | "code-review" | "explore-topic";

export type RequestStatus = "pending" | "accepted" | "declined" | "cancelled";

export interface PairProfile {
  userId: string;
  // Skills user can teach
  skillsCanTeach: string[];
  // Skills user wants to learn
  skillsWantToLearn: string[];
  // Preferred languages/frameworks
  preferredLanguages: string[];
  preferredFrameworks: string[];
  // Timezone (e.g., "America/New_York")
  timezone: string;
  // Availability windows (day of week + time ranges)
  availability: AvailabilityWindow[];
  // Session types user is interested in
  sessionTypes: SessionType[];
  // Optional bio/notes
  bio?: string;
  // When profile was created/updated
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  // Whether profile is active (opt-in)
  isActive: boolean;
}

export interface AvailabilityWindow {
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime: string; // HH:mm format (e.g., "09:00")
  endTime: string; // HH:mm format (e.g., "17:00")
}

export interface PairRequest {
  id?: string;
  fromUserId: string;
  toUserId: string;
  sessionType: SessionType;
  message: string;
  status: RequestStatus;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  // Optional proposed time
  proposedTime?: Timestamp | Date;
}

export interface PairSession {
  id?: string;
  participantIds: string[]; // Array of 2 user IDs
  sessionType: SessionType;
  status: "scheduled" | "in-progress" | "completed" | "cancelled";
  scheduledTime?: Timestamp | Date;
  startedAt?: Timestamp | Date;
  completedAt?: Timestamp | Date;
  // Optional post-session notes
  notes?: SessionNotes;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface SessionNotes {
  participantId: string;
  whatWeWorkedOn: string;
  whatILearned: string;
  nextSteps?: string;
}

export interface MatchScore {
  userId: string;
  score: number; // 0-100
  reasons: string[]; // Why they matched (e.g., "You teach React, they want to learn React")
}
