/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { Timestamp } from "firebase/firestore";

export type MentorshipRole = "mentor" | "mentee" | "both";

export type MentorshipRequestStatus = "pending" | "accepted" | "declined" | "cancelled";

export type PairingStatus = "active" | "completed" | "cancelled";

export type GoalStatus = "in-progress" | "completed" | "dropped";

export interface MentorshipAvailability {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}

export interface MentorshipProfile {
  userId: string;
  role: MentorshipRole;
  // Topics/skills the mentor can teach
  expertise: string[];
  // What the mentee wants to learn
  learningGoals: string[];
  preferredLanguages: string[];
  timezone: string;
  availability: MentorshipAvailability[];
  bio?: string;
  // Max concurrent mentees a mentor is willing to take on
  maxMentees?: number;
  isActive: boolean;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface MentorshipGoal {
  id: string;
  description: string;
  status: GoalStatus;
  completedAt?: Timestamp | Date;
}

export interface MentorshipRequest {
  id?: string;
  fromUserId: string;
  toUserId: string;
  // Goals the mentee wants to work toward in this pairing
  goals: string[];
  message: string;
  status: MentorshipRequestStatus;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface MentorshipPairing {
  id?: string;
  mentorId: string;
  menteeId: string;
  goals: MentorshipGoal[];
  status: PairingStatus;
  startedAt: Timestamp | Date;
  completedAt?: Timestamp | Date;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
}

export interface MentorshipCheckIn {
  id?: string;
  pairingId: string;
  authorId: string;
  progress: string;
  nextSteps?: string;
  goalUpdates?: { goalId: string; status: GoalStatus }[];
  createdAt: Timestamp | Date;
}

export interface MentorshipMatchScore {
  userId: string;
  score: number; // 0-100
  reasons: string[];
}
