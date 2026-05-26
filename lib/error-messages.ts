/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

import {
  COMMUNITY_CONTENT_MAX_LENGTH,
  COMMUNITY_CONTENT_MIN_LENGTH,
} from "@/lib/constants/community";

/**
 * Build the standard API validation message for fields with inclusive
 * character-count bounds.
 */
/** @internal */
export function lengthBetweenError(
  label: string,
  min: number,
  max: number
): string {
  return `${label} must be between ${min} and ${max} characters`;
}

/**
 * Build the standard API validation message for minimum character counts.
 */
/** @internal */
export function minLengthError(label: string, min: number): string {
  return `${label} must be at least ${min} characters`;
}

/**
 * Build the standard schema validation message for maximum character counts.
 */
/** @internal */
export function maxLengthError(label: string, max: number): string {
  return `${label} must be at most ${max} characters`;
}

/**
 * Build the route-level validation message used by legacy profile endpoints.
 */
/** @internal */
export function lengthOrLessError(label: string, max: number): string {
  return `${label} must be ${max} characters or less`;
}

export const COMMUNITY_CONTENT_LENGTH_ERROR = lengthBetweenError(
  "Content",
  COMMUNITY_CONTENT_MIN_LENGTH,
  COMMUNITY_CONTENT_MAX_LENGTH
);

/** @internal */
export const QUESTION_TITLE_MIN_LENGTH_ERROR = minLengthError("Title", 10);
/** @internal */
export const QUESTION_TITLE_MAX_LENGTH_ERROR = maxLengthError("Title", 200);
export const QUESTION_TITLE_RANGE_ERROR = lengthBetweenError(
  "Title",
  10,
  200
);

/** @internal */
export const QUESTION_BODY_MIN_LENGTH_ERROR = minLengthError("Body", 20);
/** @internal */
export const QUESTION_BODY_MAX_LENGTH_ERROR = maxLengthError("Body", 5000);
export const QUESTION_BODY_RANGE_ERROR = lengthBetweenError("Body", 20, 5000);

/** @internal */
export const QUESTION_ANSWER_MIN_LENGTH_ERROR = minLengthError("Answer", 20);
/** @internal */
export const QUESTION_ANSWER_MAX_LENGTH_ERROR = maxLengthError(
  "Answer",
  5000
);
export const QUESTION_ANSWER_RANGE_ERROR = lengthBetweenError(
  "Answer",
  20,
  5000
);

export const PROFILE_DISPLAY_NAME_MIN_LENGTH_ERROR = minLengthError(
  "Display name",
  2
);
export const PROFILE_DISPLAY_NAME_MAX_LENGTH_ERROR = lengthOrLessError(
  "Display name",
  50
);
export const PROFILE_BIO_MAX_LENGTH_ERROR = lengthOrLessError("Bio", 500);
export const PROFILE_LOCATION_MAX_LENGTH_ERROR = lengthOrLessError(
  "Location",
  100
);
export const PROFILE_COMPANY_MAX_LENGTH_ERROR = lengthOrLessError(
  "Company",
  100
);
export const PROFILE_JOB_TITLE_MAX_LENGTH_ERROR = lengthOrLessError(
  "Job title",
  100
);
