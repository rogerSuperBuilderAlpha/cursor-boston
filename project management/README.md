# Project Management Dashboard

A minimalist project management dashboard with a visual **Milestone Battery** — a spring-animated progress ring and battery bar that glows green when you hit 100%.

## Stack

- Next.js 15 (App Router)
- Tailwind CSS 4
- Framer Motion (spring animations)

## Getting started

```bash
cd "project management"
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

## Features

- **Milestone Battery** — circular progress ring + thick segmented battery bar
- **Kanban workspace** — drag-and-drop board with Backlog, In Progress, Review, and Done columns
- **Live milestone sync** — dropping a card into Done instantly updates the battery
- **Spring animations** — smooth, responsive transitions on progress and card moves
- **Completion glow** — pulsing green glow when all tasks are done
- **Priority badges** — low / medium / high on each card

Drag cards between columns to track work. Drop into **Done** to fill the milestone battery — no reload needed.

## GitHub webhook automation

When a pull request is merged with a closing keyword (e.g. `Fixes #3`), the task linked to issue `#3` moves to **Done** and every open dashboard updates live via Server-Sent Events.

### Setup

1. Copy env template and set a webhook secret:

```bash
cp .env.local.example .env.local
```

2. Expose your local server (e.g. [ngrok](https://ngrok.com)) or deploy the app.

3. In GitHub → **Settings → Webhooks → Add webhook**:
   - **Payload URL:** `https://your-host/api/webhooks/github`
   - **Content type:** `application/json`
   - **Secret:** same value as `GITHUB_WEBHOOK_SECRET`
   - **Events:** Pull requests

4. Reference tasks in PR titles or bodies using GitHub closing keywords:

```
Fixes #3
Closes #4
Resolves #5
```

Task `#3` maps to the task whose id or `github_issue_number` is `3`.

### Local simulation

With `npm run dev` running:

```bash
chmod +x scripts/simulate-github-merge.sh
./scripts/simulate-github-merge.sh 3
```

The Kanban board and Milestone Battery update instantly without a page reload.

## API

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/tasks` | GET | List all tasks |
| `/api/tasks/[id]` | PATCH | Update task status |
| `/api/webhooks/github` | POST | GitHub PR merge webhook |
| `/api/events` | GET | SSE stream for live updates |
