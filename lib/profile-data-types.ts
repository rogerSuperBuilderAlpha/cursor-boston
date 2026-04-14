/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import type { UserStats } from "@/lib/registrations";
import type { BadgeEligibilityDataResult } from "@/lib/badges/getBadgeEligibilityInput";
import type { UserBadge } from "@/lib/badges/types";

/** JSON-safe registration row (ISO timestamps). */
export interface ProfileRegistrationJson {
  id: string;
  eventId: string;
  eventTitle: string;
  eventDate?: string;
  userId: string;
  userEmail: string;
  userName?: string;
  registeredAt: string | null;
  source: "luma" | "manual";
  lumaGuestId?: string;
  status: "registered" | "attended" | "cancelled";
}

export interface ProfileTalkJson {
  id: string;
  title: string;
  status: string;
  submittedAt: string | null;
}

/** Response shape for GET /api/profile/data (and shared client parsing). */
export interface ProfileDataApiResponse {
  stats: UserStats;
  registrations: ProfileRegistrationJson[];
  talks: ProfileTalkJson[];
  badgeEligibility: BadgeEligibilityDataResult;
  userBadgeMap: Record<string, UserBadge>;
}
