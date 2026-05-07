/**
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 *
 * @jest-environment node
 */

/**
 * Fail-loud guard for the account-deletion cascade registry.
 *
 * This test parses `config/firebase/firestore.rules` and extracts every
 * top-level `match /<collection>/{...}` block. Each collection name must
 * appear in EITHER:
 *   - `userOwnedCollections` in `lib/account-deletion/registry.ts`, OR
 *   - `KNOWN_NON_USER_COLLECTIONS` in the same file.
 *
 * Asymmetry is the point: forgetting either side fails CI loudly, on the
 * same PR that introduced the new collection. A contributor cannot ship
 * a new user-keyed collection without explicitly deciding whether it
 * should be cascaded on deletion.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import {
  userOwnedCollectionNames,
  KNOWN_NON_USER_COLLECTIONS,
} from "@/lib/account-deletion/registry";

const RULES_PATH = resolve(__dirname, "../../../config/firebase/firestore.rules");

/**
 * Extract every collection name from the rules file. Catches both
 * top-level matches (`match /communityMessages/{messageId}`) and nested
 * subcollections (`match /votes/{voteId}` inside a parent block).
 *
 * The regex permits optional whitespace and tolerates the variety of
 * wildcard names used (e.g. `{userId}`, `{messageId}`, `{tokenId}`).
 */
function extractCollectionsFromRules(rules: string): Set<string> {
  // Skip the literal `match /databases/{database}/documents` outer match,
  // which isn't a user-data collection.
  const matchRe = /match\s+\/([A-Za-z][A-Za-z0-9_]*)\/\{[^}]+\}/g;
  const collections = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = matchRe.exec(rules)) !== null) {
    const name = m[1];
    if (name === "databases" || name === "documents") continue;
    collections.add(name);
  }
  return collections;
}

describe("account-deletion registry self-check", () => {
  const rulesText = readFileSync(RULES_PATH, "utf-8");
  const collectionsInRules = extractCollectionsFromRules(rulesText);

  it("parses at least 30 collections from firestore.rules (sanity)", () => {
    // The rules file currently declares ~50 collections. If parsing breaks
    // and we get 0, every other assertion below would pass vacuously.
    expect(collectionsInRules.size).toBeGreaterThanOrEqual(30);
  });

  it("every collection in firestore.rules is either cascaded or explicitly allowlisted", () => {
    const unclassified: string[] = [];
    for (const c of collectionsInRules) {
      const isCascaded = userOwnedCollectionNames.has(c);
      const isAllowlisted = KNOWN_NON_USER_COLLECTIONS.has(c);
      if (!isCascaded && !isAllowlisted) {
        unclassified.push(c);
      }
    }

    if (unclassified.length > 0) {
      const msg = [
        "",
        "Found collections in firestore.rules that are not classified for account deletion:",
        ...unclassified.map((c) => `  - ${c}`),
        "",
        "Each must be either:",
        "  (a) added to `userOwnedCollections` in lib/account-deletion/registry.ts",
        "      with the correct mode (docIdIsUid / fieldEqualsUid / twoSidedField / arrayContains),",
        "      OR",
        "  (b) added to `KNOWN_NON_USER_COLLECTIONS` in the same file with a brief",
        "      comment explaining why deletion does not need to touch it.",
        "",
        "This guard exists because a forgotten collection means user data leaks past",
        "the GDPR Article 17 right-to-delete. See docs/OPENSOURCE_REVIEW.md §4.",
        "",
      ].join("\n");
      throw new Error(msg);
    }
  });

  it("every registry entry corresponds to a real collection in firestore.rules", () => {
    const orphaned: string[] = [];
    for (const c of userOwnedCollectionNames) {
      if (!collectionsInRules.has(c)) {
        orphaned.push(c);
      }
    }
    if (orphaned.length > 0) {
      throw new Error(
        `Registry references collections that no longer exist in firestore.rules: ${orphaned.join(", ")}.\n` +
          `Either re-add them to the rules file, or remove them from the registry.`
      );
    }
  });

  it("allowlist entries that are also collections in firestore.rules do not duplicate the registry", () => {
    const conflicts: string[] = [];
    for (const c of KNOWN_NON_USER_COLLECTIONS) {
      if (userOwnedCollectionNames.has(c)) {
        conflicts.push(c);
      }
    }
    expect(conflicts).toEqual([]);
  });
});
