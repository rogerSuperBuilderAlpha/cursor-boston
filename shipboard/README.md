# Shipboard

Cohort PM tool: **Kanban** (Trello / GitHub Projects style) plus **running notes** (Linear-style stream + Notion-style scratch doc). Manual cards only in v1 — no GitHub sync.

## Stack

- Next.js 16 (App Router), React 19, Tailwind v4
- Firebase Auth (Google + GitHub) and Firestore (all writes via Firebase Admin in API routes)
- [@dnd-kit](https://docs.dndkit.com) for drag-and-drop

## Setup

1. Create a Firebase project and enable **Google** and **GitHub** sign-in.
2. Create a **Firestore** database (production mode is fine; client rules deny direct access).
3. Copy env vars:

```bash
cp .env.example .env.local
```

Fill `NEXT_PUBLIC_FIREBASE_*`, paste a service account JSON into `FIREBASE_SERVICE_ACCOUNT_JSON` (single line string in `.env.local` or use `GOOGLE_APPLICATION_CREDENTIALS` path), set `COHORT_INVITE_CODE` to a secret join code, then seed Firestore:

```bash
npm install
npm run seed
```

4. Deploy `config/firestore.rules` to your Firebase project (CLI or console) so `sb_*` collections stay server-only.

5. Run locally:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in, enter the invite code, and you will be redirected to the default board (`/boards/cohort-week1-board`).

## Vercel

1. Import this folder as a **separate** Vercel project (root directory `shipboard` if the repo is the monorepo).
2. Set the same environment variables in Vercel (including `COHORT_INVITE_CODE` and `FIREBASE_SERVICE_ACCOUNT_JSON`).
3. Production URL → use it as `liveUrl` in your cohort `t-siddharth.json` submission.

## Scripts

| Script            | Purpose                                      |
| ----------------- | -------------------------------------------- |
| `npm run dev`     | Local development                            |
| `npm run build`   | Production build                             |
| `npm run seed`    | Seed workspace, board, columns, labels, scratch |
| `npm run validate-env` | Warn on missing env (used by `prebuild`) |

## Keyboard

- **`n`** — new card (first column); **`Esc`** — close modal
- Drag cards using the **⋮⋮** handle; click the title area to edit

## License

GPL-3.0-only (match parent repo if shipping inside cursor-boston).
