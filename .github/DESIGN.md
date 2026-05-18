# Design and brand

> Source of truth for product design lives in the codebase: Tailwind tokens in
> [`tailwind.config.ts`](../tailwind.config.ts), shared UI primitives under
> [`components/`](../components), and the [accessibility commitment](ACCESSIBILITY.md)
> (WCAG 2.1 AA). This document covers brand assets and the few cross-cutting
> design constraints that aren't already encoded in code.

## Logo

### Size scale

Use these canonical sizes for the Cursor Boston brand logo (`/cursor-boston-logo.png`) so the site stays consistent.

| Context | Size (px) | Tailwind | Use |
|---|---|---|---|
| **Header / Footer** | 44–48 | `w-11 h-11` (44px) or `w-12 h-12` (48px) | Nav bar and footer brand link. Minimum 44×44px clickable area (WCAG touch target). |
| **Page hero (secondary)** | 96–112 | `w-24 h-24` (96px) or `w-28 h-28` (112px) | About, about-cursor, and other non-homepage heroes. |
| **Homepage hero** | 160 base, 192 md+ | `w-40 h-40 md:w-48 md:h-48` | Main hero on the homepage only. |

### Implementation

- Use the shared `Logo` component in `components/Logo.tsx` with size prop `header` | `footer` | `hero` | `heroHome`.
- All logo links (header, footer) require a minimum 44×44px touch target — use `min-h-[44px] min-w-[44px]` or padding so the interactive area meets WCAG 2.1.
- Prefer Next.js `Image` without `unoptimized` where the asset works with the image optimizer.

## Color, type, spacing

Defined in [`tailwind.config.ts`](../tailwind.config.ts). The palette is intentionally narrow (slate-neutral surface, emerald accent, red error). Add a new color only if a design need can't be met by the existing scale; prefer extending a shade range over introducing a new hue.

## Components

UI primitives live in [`components/`](../components/). Before adding a new primitive:

1. Search `components/` for an existing component that fits.
2. If extending an existing primitive, propose the API change in the PR description.
3. If introducing a new primitive, ensure it follows the a11y rules in [`ACCESSIBILITY.md`](ACCESSIBILITY.md) (keyboard navigation, focus visible, ARIA labeling).

## Trademark and brand usage

See [`TRADEMARK.md`](TRADEMARK.md) for how the "Cursor Boston" name and logo may be used by third parties.

## Maintenance

- Brand-adjacent assets (logo, footer, partner pages) are reviewed by `@AaronGrace978` per [`CODEOWNERS`](CODEOWNERS).
- Component primitives are reviewed by the frontend rotation (`@nebullii` co-primary).

_Last reviewed: 2026-05-18._
