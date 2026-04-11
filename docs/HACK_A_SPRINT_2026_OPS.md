# Hack-a-Sprint 2026 — organizer ops

## Environment

- `HACK_A_SPRINT_2026_EVENT_PASSCODE` — door code for `/hackathons/hack-a-sprint-2026` unlock (server-only).
- `HACK_A_SPRINT_2026_JUDGE_EMAILS` / `HACK_A_SPRINT_2026_JUDGE_UIDS` — judge accounts for 1–10 scores during the 7:15–7:45 PM ET window.
- `ADMIN_EMAIL` / `ADMIN_EMAILS` — for `POST /api/hackathons/showcase/hack-a-sprint-2026/ai-score` after merge review.

## Schedule (America/New_York, April 13, 2026)

| Time  | Phase             | Behavior |
|-------|-------------------|----------|
| 17:00 | Passcode          | Website signups see passcode field. |
| 18:30 | Submission copy   | PR instructions expand for unlocked users. |
| 19:15 | Peer voting       | Gallery + pick 6 + judge scoring (scores hidden publicly until 19:45). |
| 19:45 | Results           | Peer counts, judge averages, AI scores, raw score ranking. |

## Merge flow

1. Participant opens submission PR (`content/hackathons/hack-a-sprint-2026/submissions/<login>.json` with `loomVideoUrl`, etc.).
2. Review + run manual AI / Cursor evaluation.
3. `POST /api/hackathons/showcase/hack-a-sprint-2026/ai-score` with `submissionId` (GitHub login lowercased) and `aiScore` 1–10 (admin only).
4. Merge with label `hack-a-sprint-2026`. Webhook ensures a `hackathonShowcaseScores` row exists and bumps cache.

## Trust boundaries

- Unlock and scores are **Firestore Admin / API only**; clients cannot set `hackASprint2026Unlocked*` on `users`.

## AI evaluation

Score all submissions automatically using Claude with an Inkbox-specific rubric:

```bash
# Preview scores (no Firestore writes)
npm run ai-evaluate -- --dry-run

# Write scores to Firestore
npm run ai-evaluate -- --apply

# Evaluate a single submission
npm run ai-evaluate -- --dry-run --single alice
```

Requires `ANTHROPIC_API_KEY`. Implementation: [`scripts/ai-evaluate-submissions.ts`](../scripts/ai-evaluate-submissions.ts).

## Admin dashboard

Live event monitoring at [`/hackathons/hack-a-sprint-2026/admin`](https://cursorboston.com/hackathons/hack-a-sprint-2026/admin) (admin-only). Shows submissions, all scores (AI + per-judge + peer votes), voting progress, and judge coverage. Auto-refreshes every 15 seconds.

## Credit distribution

After the event, send Cursor credit redemption links to winners and participants:

```bash
# Export ranked list (no emails)
npm run distribute-credits -- --dry-run

# Preview emails with credit links
npm run distribute-credits -- --dry-run --credits credits.json

# Send credit emails
npm run distribute-credits -- --send --credits credits.json
```

`credits.json` is a flat array of redemption URLs assigned by rank order. Implementation: [`scripts/distribute-cursor-credits.ts`](../scripts/distribute-cursor-credits.ts).

## Discord notifications

Merges to main automatically send a Discord notification (via `DISCORD_WEBHOOK_URL_PR`) telling participants to rebase against `upstream/develop`. Submission merges highlight the new author(s).

## Luma guest export → personalized emails

From the repo root, with `.env.local` (or env) containing Firebase Admin + `GITHUB_TOKEN`, and for sends **Mailgun** (`MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, optional `MAILGUN_FROM`):

```bash
# Preview classifications (no email)
npm run send-hack-a-sprint-emails -- --dry-run --csv /path/to/luma-guests.csv

# Send (throttled)
npm run send-hack-a-sprint-emails -- --send --csv /path/to/luma-guests.csv

# Day-before reminder (confirmed / waitlist / finish-signup copy; mutually exclusive with --announce-list)
npm run send-hack-a-sprint-emails -- --dry-run --reminder --csv /path/to/luma-guests.csv
npm run send-hack-a-sprint-emails -- --send --reminder --csv /path/to/luma-guests.csv
```

Implementation: [`scripts/send-hack-a-sprint-emails.ts`](../scripts/send-hack-a-sprint-emails.ts).

**RSVP on site:** Confirmed attendees can mark “I’ll be late” and waitlisted users can mark “I’ll queue for a spot” on [`/hackathons/hack-a-sprint-2026/signup`](../app/hackathons/hack-a-sprint-2026/signup/page.tsx) (PATCH on the event signup API). Admins see **LATE** / **QUEUING** on the check-in tab.
