# Contributing to Generals

Generals is the turn-based strategy game shipped at `/game`. The game world, castes, units, spells, artifacts, lore, and UI are all open to outside contribution. This is a guide for landing those contributions safely — without breaking balance, the multiplayer integrity model, or each other's PRs.

If you have not yet sent a PR to this repo, read [docs/FIRST_CONTRIBUTION.md](../FIRST_CONTRIBUTION.md) first. All Generals PRs target the `develop` branch.

---

## Where you can contribute

| Area | Doc | What you change |
|---|---|---|
| Lore (descriptions, narratives, flavor text) | [LORE.md](LORE.md) | `lib/game/content/{units,spells,artifacts}/**`, `lib/game/content/narratives/*.ts` |
| Units (per-caste ground/siege/air) | [UNITS.md](UNITS.md) | `lib/game/content/units/{caste}/{type}.ts` |
| Spells (per-caste offense/defense/production) | [SPELLS.md](SPELLS.md) | `lib/game/content/spells/{caste}/{type}.ts` |
| Artifacts (single-use, found on turn-spend) | [ARTIFACTS.md](ARTIFACTS.md) | `lib/game/content/artifacts/{common,rare,epic,legendary}.ts` |
| Buildings / tile upgrades | [BUILDINGS.md](BUILDINGS.md) | `lib/game/content/buildings/index.ts` + the v2 upgrade content (see doc) |
| **Heroes** (registry, classes, stamina, kill/spare/convert, backstories) | [HEROES.md](HEROES.md) | `lib/game/content/heroes.ts`, `lib/game/heroes.ts`, `lib/game/hero-registry.ts`, `lib/game/content/hero-backstories/*.md` |
| **Armageddon** (7 seals, lottery, hall of fame, prophecies) | [ARMAGEDDON.md](ARMAGEDDON.md) | `lib/game/content/armageddon.ts`, `lib/game/armageddon-resolve.ts`, `lib/game/prophecies.ts` |
| **Non-turn activities** (profiles, titles, reactions, chapters, epitaphs, inscriptions, caste chat, dispatches, pacts) | [NON_TURN_ACTIVITIES.md](NON_TURN_ACTIVITIES.md) | `lib/game/{titles,reactions,hero-lore,pacts,prophecies}.ts` |
| Castes (rename, redesign, add new) | [CASTES.md](CASTES.md) | `lib/game/content/castes.ts` + cascade edits |
| UI pages, components, icons, color palette | [UI_AND_GRAPHICS.md](UI_AND_GRAPHICS.md) | `app/game/**`, `components/**`, `public/**` |
| Cross-cutting balance principles | [BALANCE.md](BALANCE.md) | Read before touching numbers anywhere |

---

## How to test your changes locally

1. `npm install`
2. `npm run dev` — the dashboard is at `http://localhost:3000/game`
3. Sign in with a test Google account, click **Start playing** to spawn a starting territory.
4. Exercise whatever you changed:
   - New unit → recruit it on `/game/recruit` and attack with it
   - New spell → arm/cast it on `/game/spells`, then attack or wait for production tick
   - New artifact → run frontier explore (`/game` → "Explore frontier") repeatedly; artifacts roll at a 3% rate per turn
   - New caste → reset your player on `/game/setup` and pick the new caste

5. Run the static checks before pushing:
   ```bash
   npm run type-check
   npm run lint
   npm test -- __tests__/lib/game
   ```

The game tests are pure — they cover content schema, combat math, RNG determinism, exploration, and turn reports. If your PR breaks a content invariant, those tests will catch it.

---

## Things that will get a PR rejected

- **Numbers outside the documented bands** in [BALANCE.md](BALANCE.md). A new "Black Dragon" with attack 9999 isn't going to ship. If you genuinely need to push outside a band, open the discussion in your PR description and link to the band you're breaking.
- **Caste-specific names that read as racially or politically loaded.** Castes are color-coded (white/blue/black/red/green) inheriting from a tabletop tradition. Lore and renames must stay clear of real-world ethnic, religious, or political mappings.
- **Editing other people's lore for flavor reasons alone.** Add new narrative lines to the `HUMAN_*` blocks; don't rewrite existing curated ones unless you spot a typo or factual error.
- **Touching the data layer for content changes.** `lib/game/data-server.ts`, the API routes, and Firestore rules are not content surface. If your idea seems to need them, open an issue first to discuss.
- **Unsigned commits.** This repo enforces DCO. Use `git commit -s`.

---

## Multiplayer integrity (read this once)

Generals is multiplayer; the **server is the source of truth**. Combat resolution, artifact RNG, turn-cost validation, and capacity caps all run inside Firestore transactions on the server. The client is a thin presenter — anything visible in the UI can be inspected by an attacker, anything sent in a request body can be forged.

This means:
- Content (units, spells, artifacts, castes) ships **as code** in `lib/game/content/`. The server imports the same module the client does, so your numbers are authoritative.
- You cannot add a unit/spell/artifact/caste via "data only" — it's a TypeScript const. That's intentional.
- If your contribution is a UI affordance only (a new page, a new component), the server doesn't change. You just consume the existing API.
- If your contribution would need a new server endpoint or a Firestore rule change, open an issue first — that crosses the trust boundary and needs review beyond a content PR.
