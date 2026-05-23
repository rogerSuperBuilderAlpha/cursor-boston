<!--
SPDX-License-Identifier: GPL-3.0-only
Copyright (C) 2026 Cursor Boston
This file is part of Cursor Boston, licensed under GPL-3.0.
See LICENSE file for details.
-->

# Next/Image Optimization Audit

This audit covers `next/image` usage under `app/` and `components/`.

## Policy

- Every `next/image` component declares `sizes`.
- `fill` images use responsive viewport sizes that match their layout columns.
- Fixed-size icons, avatars, logos, QR codes, and sponsor marks use exact pixel `sizes`.
- Only above-the-fold brand or event hero images should use `priority`.
- Other images rely on the Next.js default lazy loading behavior.

## Inventory

| Surface | Image usage | Sizing |
| --- | --- | --- |
| `components/Logo.tsx` | Header, footer, and hero logo | Existing exact logo sizes |
| `components/Avatar.tsx` | Member profile avatars | Exact resolved avatar pixel size |
| `components/Footer.tsx` | Gauntlet sponsor mark | `32px` |
| `components/events/EventsBrowse.tsx` | Featured event art | Existing responsive column sizes |
| `components/events/EventsBrowse.tsx` | Luma QR overlay | Mobile viewport overlay size, capped near `96px` |
| `app/events/[slug]/page.tsx` | Event hero art | Full width on mobile, half viewport on desktop |
| `app/events/[slug]/page.tsx` | Luma QR overlay | `96px` |
| `app/events/[slug]/page.tsx` | Speaker headshots | `96px` |
| `app/events/[slug]/page.tsx` | Sponsor logos | `120px` |
| `app/showcase/page.tsx` | Project cards | One, two, or three columns by breakpoint |
| `app/live/[sessionId]/emcee/page.tsx` | Live-session QR code | `224px` |
| Profile agent/previews | Avatar and preview images | Exact rendered pixel sizes |

## Regression Guard

`__tests__/app/next-image-sizes-audit.test.ts` scans `app/` and
`components/` for `next/image` usage and fails if any `<Image />` is missing a
`sizes` prop.
