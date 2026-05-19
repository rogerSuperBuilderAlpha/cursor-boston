/**
 * SPDX-License-Identifier: GPL-3.0-only
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

import { accountContract } from "./account";
import { agentsContract } from "./agents";
import { analyticsContract } from "./analytics";
import { authContract } from "./auth";
import { badgesContract } from "./badges";
import { certificateContract } from "./certificate";
import { cfpContract } from "./cfp";
import { communityContract } from "./community";
import { cookbookContract } from "./cookbook";
import { cursorContract } from "./cursor";
import { discordContract } from "./discord";
import { eventsContract } from "./events";
import { gameContract } from "./game";
import { githubContract } from "./github";
import { hackathonsContract } from "./hackathons";
import { healthContract } from "./health";
import { hiringPartnersContract } from "./hiring-partners";
import { huntContract } from "./hunt";
import { internalContract } from "./internal";
import { liveContract } from "./live";
import { ludwittContract } from "./ludwitt";
import { maintainersContract } from "./maintainers";
import { membersContract } from "./members";
import { mentorshipContract } from "./mentorship";
import { notificationsContract } from "./notifications";
import { notifyAdminContract } from "./notify-admin";
import { pairContract } from "./pair";
import { profileContract } from "./profile";
import { questionsContract } from "./questions";
import { showcaseContract } from "./showcase";
import { summerCohortContract } from "./summer-cohort";
import { talksContract } from "./talks";

const c = initContract();

export const apiContract = c.router({
  account: accountContract,
  agents: agentsContract,
  analytics: analyticsContract,
  auth: authContract,
  badges: badgesContract,
  certificate: certificateContract,
  cfp: cfpContract,
  community: communityContract,
  cookbook: cookbookContract,
  cursor: cursorContract,
  discord: discordContract,
  events: eventsContract,
  game: gameContract,
  github: githubContract,
  hackathons: hackathonsContract,
  health: healthContract,
  hiringPartners: hiringPartnersContract,
  hunt: huntContract,
  internal: internalContract,
  live: liveContract,
  ludwitt: ludwittContract,
  maintainers: maintainersContract,
  members: membersContract,
  mentorship: mentorshipContract,
  notifications: notificationsContract,
  notifyAdmin: notifyAdminContract,
  pair: pairContract,
  profile: profileContract,
  questions: questionsContract,
  showcase: showcaseContract,
  summerCohort: summerCohortContract,
  talks: talksContract,
});

export type ApiContract = typeof apiContract;

export * from "./common";
