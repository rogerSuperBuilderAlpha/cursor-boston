# UI and graphics

The Generals UI is six client pages plus shared layout. Everything is React 18 / Next.js 16 App Router / Tailwind. There's no Generals-specific design system yet — we use the project's overall palette and component conventions.

This doc tells you where each page lives, what the visual conventions are, and how to add an icon or a color without breaking the existing pages.

---

## Page map

```
app/game/
├── page.tsx                      → /game (dashboard, frontier explore, bulk distribute/unassign)
├── setup/page.tsx                → /game/setup (caste pick, starting territory)
├── tiles/page.tsx                → /game/tiles (hex map, all owned tiles)
├── tiles/[tileId]/page.tsx       → /game/tiles/[tileId] (tile detail; assign on own, attack on enemy)
├── recruit/page.tsx              → /game/recruit (bulk recruit units)
├── spells/page.tsx               → /game/spells (cast production spells, arm defense spells)
├── attacks/page.tsx              → /game/attacks (attack log)
├── artifacts/page.tsx            → /game/artifacts (inventory of found artifacts)
└── leaderboard/page.tsx          → /game/leaderboard (player rankings)
```

Each page is a server-rendered shell with `"use client"` data-fetching components inside. They all follow the same shape:

1. Top: page header, back link, error/loading state
2. Middle: data section (cards, lists, hex map)
3. Bottom: action panel (forms, buttons that call `/api/game/*`)

If you're adding a page, copy `app/game/recruit/page.tsx` as a starting template — it's simple, modern, and exercises every common pattern (auth, callApi, busy state, a report log).

---

## Calling the server

Every page uses the same `callApi(path, body)` pattern:

```ts
const callApi = async (path: string, body: object) => {
  const token = await user.getIdToken();
  const res = await fetch(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.json();
};
```

Don't re-invent this. Don't add error-handling library wrappers. Trust the shape: every game API route returns `{ success: true, ...data }` or `{ success: false, error: string | { message: string } }`.

---

## Styling conventions

### Tailwind, not CSS-in-JS

The whole project uses Tailwind utility classes. Don't import `styled-components` or write CSS modules — they'll be removed in review. The only inline styling allowed is for SVG fill/stroke values (the hex map uses raw hex codes for performance).

### Dark mode is mandatory

Every component must work in light AND dark mode. This means:

```tsx
// Every text color and background needs both variants
<div className="text-neutral-900 dark:text-neutral-100">
<div className="bg-white dark:bg-neutral-900">
<div className="border-neutral-200 dark:border-neutral-800">
```

Don't ship a component that's only legible in light mode. There is no "default" mode — the user's system preference decides.

### Color tokens for game state

| Concept | Class pattern | Hex (for SVG) |
|---|---|---|
| Unassigned tile | `bg-neutral-500` | `#525252` |
| Military tile | `bg-red-600 text-white` | `#dc2626` |
| Food tile | `bg-green-600 text-white` | `#16a34a` |
| Magic tile | `bg-blue-600 text-white` | `#2563eb` |
| Unrevealed tile | `bg-neutral-800` | `#262626` |
| Action button | `bg-emerald-500 hover:bg-emerald-400 text-white` | — |
| Destructive button | `bg-rose-500 hover:bg-rose-400 text-white` | — |
| Info banner | `bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-900/50` | — |

The hex codes for tile types are pinned in `app/game/tiles/page.tsx` as `TYPE_FILL` / `TYPE_STROKE` / `TYPE_TEXT`. **If you change them, update everywhere they're referenced** — the tile-type swatch in the hex-map filter bar uses the same constants.

### Caste colors (current convention)

The setup page (`app/game/setup/page.tsx`) currently uses Tailwind's `capitalize` plus emerald-on-select for the caste picker — caste-specific colors aren't fully wired yet. If you implement them, the convention should be:

| Caste | Tailwind class | Why |
|---|---|---|
| white | `bg-stone-100 text-stone-900 border-stone-300` | Light, clean, functional |
| blue | `bg-blue-600 text-white` | Matches magic tile |
| black | `bg-stone-900 text-stone-100 border-stone-700` | Dark, restrained |
| red | `bg-red-700 text-white` | Slightly darker than military tile to differentiate |
| green | `bg-emerald-700 text-white` | Slightly darker than food tile |

(These are recommendations, not committed code yet. If you write a caste-color helper, put it in a new file at `lib/game/ui-colors.ts` and export a `casteColorClasses(caste): string` function so all pages can pick it up consistently.)

---

## Icons

The project uses [`lucide-react`](https://lucide.dev) (already installed in `package.json`). To add an icon:

```tsx
import { Sword, Shield, Sparkles } from "lucide-react";

<Sword className="w-4 h-4" />
```

Common icons used elsewhere in the codebase: `Award`, `Calendar`, `Trophy`, `Users`, `Video`, `ExternalLink`, `GitMerge`, `Sun`, `CheckCircle`. Reuse those before reaching for new ones — visual consistency across pages matters.

For Generals specifically, reasonable picks:
- Attack: `Sword`
- Defense: `Shield`
- Spells: `Sparkles` or `Wand2`
- Units: `Users` (already used elsewhere) or `Sword` for combat units
- Artifacts: `Gem` or `Star`
- Buildings: `Building2` or `Home`
- Explore: `Compass`
- Map: `Map` or `Hexagon`

If you need an icon that isn't in `lucide-react`, prefer adding it to `lucide-react` upstream rather than introducing a second icon library. We don't want a mix.

---

## Hex map specifically

`app/game/tiles/page.tsx` renders the territory as an inline SVG. Tiles are pointy-top hexagons. The math (axial → cartesian, hex point list) is in the same file.

If you want to enhance the hex map:
- **Tile labels:** Currently shows total unit count and an "armed" indicator if a defense spell is up. Don't add more visual complexity — the map is meant to be skimmable at a glance.
- **Hover tooltip:** Already wired via local `hovered` state. To add a new field to the tooltip, edit the `<div>` rendered conditionally near the bottom of the file.
- **Click navigation:** Each `<g>` element navigates to `/game/tiles/[tileId]` on click. Keep that behavior — it's how attack initiation works.

For background on attacks specifically, see [the contributing README's "How to test" section](README.md#how-to-test-your-changes-locally).

---

## Graphics assets

The `public/` directory currently has no Generals-specific imagery. The hex map renders pure SVG; unit/spell/artifact items are text-only with a description.

If you want to **add illustrations** (unit portraits, spell glyphs, artifact iconography):

1. Create `public/game/` and put assets there.
2. Use these conventions:
   - **PNG or SVG.** Avoid JPEG (banding on dark backgrounds). SVG preferred where possible.
   - **128×128 px** for unit/spell/artifact item icons. Larger illustrations: 512×512.
   - **Transparent background.** Don't bake in a card frame; the UI handles framing.
   - **Filename: `${id}.png` or `${id}.svg`.** A unit's id is its kebab-case `id` field, e.g., `public/game/units/black-ground-reaver.png`.

3. To wire an asset, extend the relevant page's render to look up `/game/units/${unit.id}.png` and render an `<Image>` next to the description. Fall back to no image if the file is missing.

4. **Keep file sizes small.** Under 30 KB per icon, under 200 KB per illustration. The `public/` directory is shipped to every page-load on Next.js — bloat there hurts every visitor.

5. Style: there is no committed style guide for Generals art. If you contribute illustrations, propose a style in your PR (e.g., "ink-and-watercolor in the manner of medieval marginalia") and the project can adopt it as a convention going forward.

---

## Things to ask before submitting a UI PR

- Does it work in dark mode?
- Does it work on mobile (320–480px wide)?
- Are all colors using Tailwind tokens or the existing TYPE_FILL constants?
- Is there a back-link to `/game` at the top of any new page?
- Does it call `/api/game/*` via the existing pattern, with `Authorization: Bearer ${idToken}`?
- Did you run `npm run lint` and `npm run type-check` before pushing?

If your PR is a substantial UI redesign (not just a new page), open an issue first. The current visual language is restrained and consistent across pages — a flashy redesign of one page will create dissonance with the others.
