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

## Luma guest export → personalized emails

From the repo root, with `.env.local` (or env) containing Firebase Admin + `GITHUB_TOKEN`, and for sends **Mailgun** (`MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, optional `MAILGUN_FROM`):

```bash
# Preview classifications (no email)
npm run send-hack-a-sprint-emails -- --dry-run --csv /path/to/luma-guests.csv

# Send (throttled)
npm run send-hack-a-sprint-emails -- --send --csv /path/to/luma-guests.csv
```

Implementation: [`scripts/send-hack-a-sprint-emails.ts`](../scripts/send-hack-a-sprint-emails.ts).
