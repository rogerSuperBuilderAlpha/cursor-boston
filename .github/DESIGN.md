# Design and logo usage

## Logo size scale

Use these canonical sizes for the Cursor Boston brand logo (`/cursor-boston-logo.png`) so the site stays consistent.

| Context | Size (px) | Tailwind | Use |
|--------|-----------|----------|-----|
| **Header / Footer** | 44–48 | `w-11 h-11` (44px) or `w-12 h-12` (48px) | Nav bar and footer brand link. Minimum 44×44px clickable area (WCAG touch target). |
| **Page hero (secondary)** | 96–112 | `w-24 h-24` (96px) or `w-28 h-28` (112px) | About, about-cursor, and other non-homepage heroes. |
| **Homepage hero** | 160 base, 192 md+ | `w-40 h-40 md:w-48 md:h-48` | Main hero on the homepage only. |

## Implementation

- Use the shared `Logo` component in `components/Logo.tsx` with size prop `header` | `footer` | `hero` | `heroHome`.
- All logo links (header, footer) must have a minimum 44×44px touch target: use `min-h-[44px] min-w-[44px]` or padding so the interactive area meets WCAG 2.1.
- Prefer Next.js `Image` without `unoptimized` where the asset works with the image optimizer.
