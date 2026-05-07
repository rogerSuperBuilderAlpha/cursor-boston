/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Root API contract — composes per-area contracts so the OpenAPI generator
 * can emit a single spec from a single import.
 *
 * Each area contract lives in its own file (`game.ts`, `community.ts`,
 * `auth.ts`, …) and is added to `apiContract` here. New areas should be
 * added in alphabetical order to keep diffs predictable.
 */

import { initContract } from "@ts-rest/core";

import { authContract } from "./auth";
import { communityContract } from "./community";
import { gameContract } from "./game";
import { hackathonsContract } from "./hackathons";
import { questionsContract } from "./questions";

const c = initContract();

export const apiContract = c.router({
  auth: authContract,
  community: communityContract,
  game: gameContract,
  hackathons: hackathonsContract,
  questions: questionsContract,
});

export type ApiContract = typeof apiContract;

export * from "./common";
