/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Registry of every Firestore collection that holds user-owned data.
 *
 * The cascade executor (`./cascade.ts`) iterates this list to delete or
 * anonymize a user's records when they delete their account. A separate
 * test (`__tests__/lib/account-deletion/registry.test.ts`) parses
 * `config/firebase/firestore.rules`, extracts every `match /<collection>/{...}`
 * block, and asserts that every non-allowlisted collection appears here.
 * That makes the registry self-defending: a contributor who adds a new
 * user-keyed collection in the rules file but forgets to extend this
 * file fails CI on the same PR that introduced the collection.
 */

export type DeletionBehavior =
  | { type: "delete" }
  | { type: "anonymize"; scrubFields?: readonly string[] };

/**
 * Classification of how a collection identifies its owning user.
 *
 *  - `docIdIsUid` — the doc's ID is the user's UID (e.g. `users/{uid}`).
 *    Always `delete` — Firestore cannot rename docs, so anonymize is
 *    not coherent for this mode.
 *  - `fieldEqualsUid` — a single field stores the UID
 *    (e.g. `communityMessages.authorId`). Supports anonymize.
 *  - `twoSidedField` — either of two fields might store the UID
 *    (e.g. `mentorship_pairings.{mentorId|menteeId}`).
 *  - `arrayContains` — an array field contains the UID
 *    (e.g. `pair_sessions.participantIds`).
 *  - `userSubcollectionDoc` — a fixed document inside `users/{uid}`.
 *    Firestore does not cascade subcollections when the parent user doc is
 *    deleted, so these entries must be cleaned up explicitly.
 */
export type UserOwnedCollection =
  | {
      collection: string;
      mode: "docIdIsUid";
      behavior: { type: "delete" };
    }
  | {
      collection: string;
      mode: "fieldEqualsUid";
      field: string;
      behavior: DeletionBehavior;
    }
  | {
      collection: string;
      mode: "twoSidedField";
      fields: readonly [string, string];
      behavior: DeletionBehavior;
    }
  | {
      collection: string;
      mode: "arrayContains";
      field: string;
      behavior: DeletionBehavior;
    }
  | {
      collection: string;
      mode: "userSubcollectionDoc";
      parentCollection: "users";
      docId: string;
      behavior: { type: "delete" };
    };

/**
 * Collections that hold user-owned data and must be cleaned up on account
 * deletion. Order is unimportant; the cascade is idempotent and per-step.
 */
export const userOwnedCollections: ReadonlyArray<UserOwnedCollection> = [
  // ---------------------------------------------------------------------
  // docIdIsUid — single doc per user
  // ---------------------------------------------------------------------
  { collection: "users", mode: "docIdIsUid", behavior: { type: "delete" } },
  { collection: "cfpSubmissions", mode: "docIdIsUid", behavior: { type: "delete" } },
  { collection: "mentorship_profiles", mode: "docIdIsUid", behavior: { type: "delete" } },
  { collection: "pair_profiles", mode: "docIdIsUid", behavior: { type: "delete" } },
  { collection: "treasureHuntProgress", mode: "docIdIsUid", behavior: { type: "delete" } },
  { collection: "ludwittTokens", mode: "docIdIsUid", behavior: { type: "delete" } },
  { collection: "game_players", mode: "docIdIsUid", behavior: { type: "delete" } },

  // ---------------------------------------------------------------------
  // fieldEqualsUid — delete (rows belong to the user, no orphan concern)
  // ---------------------------------------------------------------------
  { collection: "talkSubmissions", mode: "fieldEqualsUid", field: "userId", behavior: { type: "delete" } },
  { collection: "eventRequests", mode: "fieldEqualsUid", field: "userId", behavior: { type: "delete" } },
  { collection: "eventRegistrations", mode: "fieldEqualsUid", field: "userId", behavior: { type: "delete" } },
  { collection: "messageReactions", mode: "fieldEqualsUid", field: "userId", behavior: { type: "delete" } },
  { collection: "user_badges", mode: "fieldEqualsUid", field: "userId", behavior: { type: "delete" } },
  { collection: "showcaseSubmissions", mode: "fieldEqualsUid", field: "userId", behavior: { type: "delete" } },
  { collection: "hackathonPool", mode: "fieldEqualsUid", field: "userId", behavior: { type: "delete" } },
  { collection: "hackathonLeftTeam", mode: "fieldEqualsUid", field: "userId", behavior: { type: "delete" } },
  { collection: "hackathonJoinRequests", mode: "fieldEqualsUid", field: "fromUserId", behavior: { type: "delete" } },
  { collection: "agents", mode: "fieldEqualsUid", field: "ownerId", behavior: { type: "delete" } },
  { collection: "coworkingRegistrations", mode: "fieldEqualsUid", field: "userId", behavior: { type: "delete" } },
  { collection: "mentorship_check_ins", mode: "fieldEqualsUid", field: "authorId", behavior: { type: "delete" } },
  { collection: "cookbook_user_votes", mode: "fieldEqualsUid", field: "userId", behavior: { type: "delete" } },
  { collection: "question_votes", mode: "fieldEqualsUid", field: "userId", behavior: { type: "delete" } },
  { collection: "answer_votes", mode: "fieldEqualsUid", field: "userId", behavior: { type: "delete" } },
  { collection: "game_artifacts", mode: "fieldEqualsUid", field: "ownerId", behavior: { type: "delete" } },
  { collection: "cursorAgentRuns", mode: "fieldEqualsUid", field: "userId", behavior: { type: "delete" } },
  // Deleted players: drop their intel effects on both sides — owner-as-attacker
  // (forge-sight) and owner-as-defender-of-an-alert. fieldEqualsUid only
  // covers ownerId; the casterId column is a foreign key so it'll naturally
  // disappear when the caster's effects are deleted on their side.
  { collection: "game_intel_effects", mode: "fieldEqualsUid", field: "ownerId", behavior: { type: "delete" } },
  // Community feed: events authored by the deleted user (player join,
  // caste pick, attacks they initiated). Hard-delete so the deleted
  // user's name + UID don't continue to appear in the public feed.
  { collection: "game_community_events", mode: "fieldEqualsUid", field: "actorUserId", behavior: { type: "delete" } },
  // Community chat: messages authored by the deleted user. Hard-delete
  // so private messages don't linger after a GDPR Article 17 request.
  { collection: "game_community_messages", mode: "fieldEqualsUid", field: "userId", behavior: { type: "delete" } },

  // ---------------------------------------------------------------------
  // fieldEqualsUid — anonymize (preserve thread/content; scrub author)
  // ---------------------------------------------------------------------
  {
    collection: "communityMessages",
    mode: "fieldEqualsUid",
    field: "authorId",
    behavior: {
      type: "anonymize",
      scrubFields: ["authorName", "authorAvatarUrl", "authorEmail", "authorHandle"],
    },
  },
  {
    collection: "cookbook_entries",
    mode: "fieldEqualsUid",
    field: "authorId",
    behavior: {
      type: "anonymize",
      scrubFields: ["authorName", "authorAvatarUrl", "authorEmail"],
    },
  },
  {
    collection: "questions",
    mode: "fieldEqualsUid",
    field: "authorId",
    behavior: {
      type: "anonymize",
      scrubFields: ["authorName", "authorAvatarUrl"],
    },
  },

  // ---------------------------------------------------------------------
  // twoSidedField — delete (relationship records, both sides participate)
  // ---------------------------------------------------------------------
  {
    collection: "hackathonInvites",
    mode: "twoSidedField",
    fields: ["fromUserId", "toUserId"],
    behavior: { type: "delete" },
  },
  {
    collection: "mentorship_requests",
    mode: "twoSidedField",
    fields: ["fromUserId", "toUserId"],
    behavior: { type: "delete" },
  },
  {
    collection: "mentorship_pairings",
    mode: "twoSidedField",
    fields: ["mentorId", "menteeId"],
    behavior: { type: "delete" },
  },
  {
    collection: "pair_requests",
    mode: "twoSidedField",
    fields: ["fromUserId", "toUserId"],
    behavior: { type: "delete" },
  },
  {
    collection: "game_attacks",
    mode: "twoSidedField",
    fields: ["attackerId", "defenderId"],
    behavior: { type: "delete" },
  },
  // Zero-turn gameplay: queued battle plans the player has not yet
  // executed. On account deletion these have no meaning — delete them.
  {
    collection: "game_order_queue",
    mode: "fieldEqualsUid",
    field: "playerId",
    behavior: { type: "delete" },
  },
  // Phase 7 non-turn activities: reactions (⚔️ / 🛡️ / 📜) the user
  // has placed on chat/feed/hero-event rows. Hard-delete so the
  // deleted user's UID does not continue to appear in reaction
  // counters or per-reaction tracker docs.
  {
    collection: "game_reactions",
    mode: "fieldEqualsUid",
    field: "userId",
    behavior: { type: "delete" },
  },
  // Phase 7: public non-aggression pacts. Two-sided: deleting the
  // author should remove pacts they wrote; deleting the target
  // should also remove pacts where they were the named target so
  // their UID doesn't linger in others' contracts. Field paths are
  // nested (author.userId) — Firestore supports dotted-path queries.
  {
    collection: "game_pacts",
    mode: "twoSidedField",
    fields: ["author.userId", "targetId"],
    behavior: { type: "delete" },
  },
  // Phase 7: pre-filed Armageddon prophecies. Hard-delete the
  // deleted user's predictions; resolved prophecies pointing at
  // them as the fulfiller become stale pointers (acceptable —
  // similar to currentOwnerId references in game_heroes).
  {
    collection: "game_prophecies",
    mode: "fieldEqualsUid",
    field: "author.userId",
    behavior: { type: "delete" },
  },

  // ---------------------------------------------------------------------
  // arrayContains — delete (sessions where user is one of N participants)
  // ---------------------------------------------------------------------
  {
    collection: "pair_sessions",
    mode: "arrayContains",
    field: "participantIds",
    behavior: { type: "delete" },
  },

  // ---------------------------------------------------------------------
  // userSubcollectionDoc — fixed docs below users/{uid}
  // ---------------------------------------------------------------------
  {
    collection: "secrets",
    mode: "userSubcollectionDoc",
    parentCollection: "users",
    docId: "cursor",
    behavior: { type: "delete" },
  },
];

/**
 * Collections that exist in `firestore.rules` but are intentionally
 * NOT user-keyed. The registry-guard test requires every rules-file
 * collection to be either in `userOwnedCollections` above or in this
 * allowlist. Adding a collection here is a deliberate statement that
 * deleting a user's account does NOT need to touch it (e.g. system
 * tables, public reference data, server-only buckets, or business
 * objects keyed by something other than user identity).
 */
export const KNOWN_NON_USER_COLLECTIONS: ReadonlySet<string> = new Set([
  // Email + auth lookups (not keyed to a single uid; PII purge handled separately)
  "emailLookup",
  "emailVerifications",
  "eduVerificationCodes",

  // Server-only event/audit tables
  "pullRequests",
  "apiRateLimits",
  "analytics_snapshots",
  "members_snapshots",

  // Public reference / system data
  "badges",
  "certificates", // verification artifacts retained per docs/RELEASING.md cadence
  "coworkingSessions",
  "hackathonTeams", // multi-member team objects; member removal is a separate flow
  "hackathonSubmissions", // team-keyed; deletion would damage other team members' work

  // Showcase / scoring server-only audit (anonymizing here would falsify scores)
  "hackathonShowcaseVotes",
  "hackathonShowcaseScores",
  "hackathonASprint2026PeerVotes",
  "hackathonASprint2026ParticipantScores",

  // Event signup ledgers — keyed by email/event, retained for ops; PII-purge
  // happens via a separate event-side cleanup
  "hackathonEventSignups",
  "eventContacts",

  // Treasure hunt system tables
  "treasureHuntPrizes",
  "treasureHuntPathWinners",
  "treasureHuntRateLimit",
  "treasureHuntRuntime",

  // Game world singletons / reference
  "game_tiles",
  "game_world_meta",
  // Denormalized world snapshot doc rebuilt from game_tiles + game_players
  // by a periodic cron and post-action triggers. Contains a derived view
  // of player+tile data; deleting the source player doc + tile docs (which
  // ARE handled above) drops them out of the next snapshot rebuild
  // automatically.
  "game_world_snapshots",
  // Public Armageddon event log — world-history audit, not user data.
  // Keyed by event id; an actor's account deletion doesn't rewrite
  // the recorded history of past seasons.
  "game_armageddon_events",
  // Persistent hero registry (v2 Heroes). Heroes are public lore
  // characters with a permanent record that survives season wipes; a
  // deleted user's `currentOwnerId` reference becomes a stale pointer
  // but the hero's history (and any contributed backstory) is preserved
  // as community lore. Behaves like the Hall of Fame entries above.
  "game_heroes",
  // Subcollection under game_heroes/{heroId}/events — append-only
  // per-hero history. Inherits the lore-not-user-data classification
  // from its parent; allowlisted explicitly because firestore.rules
  // declares it as a named collection.
  "events",
  // Subcollections under game_heroes/{heroId}/ — chapters and epitaphs
  // are community-authored lore content attached to heroes. Inherit
  // the lore-preservation classification from the parent game_heroes
  // entry (heroes are public lore characters with permanent records
  // that survive account deletion; an author's contributed lore is
  // preserved as community content with the author identity scrubbed
  // by the normal authoring flow when the parent hero is read).
  "chapters",
  "epitaphs",

  // Q&A nested collections (handled via parent `questions` registry entry)
  "answers",
  // Cookbook nested votes (handled via parent `cookbook_entries` entry)
  "votes",

  // Internal: where deletion progress is tracked. Must not cascade itself.
  "accountDeletions",

  // Internal: report flow (admin-managed; reporter records survive deletion)
  "communityReports",
  "userBlocks",
]);

/**
 * Convenience: list of just the collection names that get cascaded.
 */
export const userOwnedCollectionNames: ReadonlySet<string> = new Set(
  userOwnedCollections.map((c) => c.collection)
);
