/**
 * @jest-environment node
 *
 * Smoke test: every ts-rest contract module must load and expose its
 * router with the expected shape (method + path on every endpoint).
 * Importing the modules executes their c.router(...) calls — that's
 * what bumps these previously-0%-statement files into coverage, but
 * the assertions also catch accidental router-shape regressions.
 */

import { accountContract } from "@/lib/api-schemas/account";
import { agentsContract } from "@/lib/api-schemas/agents";
import { analyticsContract } from "@/lib/api-schemas/analytics";
import { authContract } from "@/lib/api-schemas/auth";
import { badgesContract } from "@/lib/api-schemas/badges";
import { certificateContract } from "@/lib/api-schemas/certificate";
import { cfpContract } from "@/lib/api-schemas/cfp";
import { communityContract } from "@/lib/api-schemas/community";
import { cookbookContract } from "@/lib/api-schemas/cookbook";
import { cursorContract } from "@/lib/api-schemas/cursor";
import { discordContract } from "@/lib/api-schemas/discord";
import { eventsContract } from "@/lib/api-schemas/events";
import { gameContract } from "@/lib/api-schemas/game";
import { githubContract } from "@/lib/api-schemas/github";
import { hackathonsContract } from "@/lib/api-schemas/hackathons";
import { healthContract } from "@/lib/api-schemas/health";
import { hiringPartnersContract } from "@/lib/api-schemas/hiring-partners";
import { huntContract } from "@/lib/api-schemas/hunt";
import { internalContract } from "@/lib/api-schemas/internal";
import { liveContract } from "@/lib/api-schemas/live";
import { ludwittContract } from "@/lib/api-schemas/ludwitt";
import { maintainersContract } from "@/lib/api-schemas/maintainers";
import { membersContract } from "@/lib/api-schemas/members";
import { mentorshipContract } from "@/lib/api-schemas/mentorship";
import { notificationsContract } from "@/lib/api-schemas/notifications";
import { notifyAdminContract } from "@/lib/api-schemas/notify-admin";
import { pairContract } from "@/lib/api-schemas/pair";
import { profileContract } from "@/lib/api-schemas/profile";
import { questionsContract } from "@/lib/api-schemas/questions";
import { showcaseContract } from "@/lib/api-schemas/showcase";
import { summerCohortContract } from "@/lib/api-schemas/summer-cohort";
import { talksContract } from "@/lib/api-schemas/talks";
import { apiContract } from "@/lib/api-schemas";

type AnyRouter = Record<string, { method?: string; path?: string }>;

const ALL_CONTRACTS: Array<[string, AnyRouter]> = [
  ["accountContract", accountContract as unknown as AnyRouter],
  ["agentsContract", agentsContract as unknown as AnyRouter],
  ["analyticsContract", analyticsContract as unknown as AnyRouter],
  ["authContract", authContract as unknown as AnyRouter],
  ["badgesContract", badgesContract as unknown as AnyRouter],
  ["certificateContract", certificateContract as unknown as AnyRouter],
  ["cfpContract", cfpContract as unknown as AnyRouter],
  ["communityContract", communityContract as unknown as AnyRouter],
  ["cookbookContract", cookbookContract as unknown as AnyRouter],
  ["cursorContract", cursorContract as unknown as AnyRouter],
  ["discordContract", discordContract as unknown as AnyRouter],
  ["eventsContract", eventsContract as unknown as AnyRouter],
  ["gameContract", gameContract as unknown as AnyRouter],
  ["githubContract", githubContract as unknown as AnyRouter],
  ["hackathonsContract", hackathonsContract as unknown as AnyRouter],
  ["healthContract", healthContract as unknown as AnyRouter],
  ["hiringPartnersContract", hiringPartnersContract as unknown as AnyRouter],
  ["huntContract", huntContract as unknown as AnyRouter],
  ["internalContract", internalContract as unknown as AnyRouter],
  ["liveContract", liveContract as unknown as AnyRouter],
  ["ludwittContract", ludwittContract as unknown as AnyRouter],
  ["maintainersContract", maintainersContract as unknown as AnyRouter],
  ["membersContract", membersContract as unknown as AnyRouter],
  ["mentorshipContract", mentorshipContract as unknown as AnyRouter],
  ["notificationsContract", notificationsContract as unknown as AnyRouter],
  ["notifyAdminContract", notifyAdminContract as unknown as AnyRouter],
  ["pairContract", pairContract as unknown as AnyRouter],
  ["profileContract", profileContract as unknown as AnyRouter],
  ["questionsContract", questionsContract as unknown as AnyRouter],
  ["showcaseContract", showcaseContract as unknown as AnyRouter],
  ["summerCohortContract", summerCohortContract as unknown as AnyRouter],
  ["talksContract", talksContract as unknown as AnyRouter],
];

const VALID_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

describe("api-schemas — contract registry", () => {
  it.each(ALL_CONTRACTS)("%s loads and is a non-empty router object", (name, contract) => {
    expect(contract).toBeDefined();
    expect(typeof contract).toBe("object");
    // Subroutes can be either endpoints or nested routers; just ensure non-empty.
    expect(Object.keys(contract).length).toBeGreaterThan(0);
  });

  it.each(ALL_CONTRACTS)(
    "%s endpoints declare a known HTTP method and a path",
    (_name, contract) => {
      // Walk the contract and assert every leaf endpoint has a method + path.
      const walk = (node: unknown, trail: string[] = []) => {
        if (!node || typeof node !== "object") return;
        const obj = node as Record<string, unknown>;
        if (typeof obj.method === "string" && typeof obj.path === "string") {
          expect(VALID_METHODS.has(obj.method.toUpperCase())).toBe(true);
          expect(obj.path.length).toBeGreaterThan(0);
          return;
        }
        for (const [k, v] of Object.entries(obj)) {
          walk(v, [...trail, k]);
        }
      };
      walk(contract);
    }
  );

  describe("the umbrella apiContract", () => {
    it("exposes all sub-routers under expected keys", () => {
      const root = apiContract as unknown as Record<string, unknown>;
      // Spot check a sampling — full enumeration is on each sub-contract above.
      const expectedKeys = [
        "account",
        "auth",
        "community",
        "events",
        "game",
        "hackathons",
        "talks",
      ];
      for (const k of expectedKeys) {
        expect(root[k]).toBeDefined();
      }
    });
  });
});
