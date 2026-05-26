# Celtics Green or Mean — AI Fan Cam for TD Garden

Fans at TD Garden scan a QR code, snap a selfie, and pick **Green** (Hype Me) or **Mean** (Roast Me). Claude Vision scores each submission for energy, Celtics spirit, and originality. In Mean mode it writes three playful PA-announcer one-liners. An operator dashboard queues the best fans for the next commercial-break jumbotron reel.

---

## Deploy

### Local development

```bash
cd sports-hack-2026-submissions/derekyim/app
cp .env.local.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the fan view and [http://localhost:3000/ops](http://localhost:3000/ops) for the operator dashboard.

### Phone access for demo (ngrok)

The camera requires HTTPS. Use ngrok to tunnel your local dev server:

```bash
ngrok http 3000
```

Copy the HTTPS URL (e.g. `https://abc123.ngrok-free.app`) and generate a QR code from it (any free QR generator). Scan from your phone to submit selfies.

### Vercel

1. Import the repo on [vercel.com](https://vercel.com).
2. Set **Root Directory** to `sports-hack-2026-submissions/derekyim/app`.
3. Add environment variable: `ANTHROPIC_API_KEY`.
4. Set the production branch to your working branch.
5. Deploy.

> **Note:** Vercel serverless functions use in-memory state. The queue resets on cold starts. For the live demo, prefer running locally with ngrok.

---

## Usage

### Fan flow (phone)

1. Open the app URL (or scan the QR code).
2. Pick a mode: **HYPE ME**, **ROAST ME**, or **I'M FEELING LUCKY**.
3. Take a selfie (or pick from photo library).
4. Enter your first name and section number.
5. Tap **SUBMIT**. Claude scores your selfie in ~3 seconds.
6. You see your queue position. Watch the jumbotron!

### Operator flow (laptop)

1. Open `/ops` in a browser.
2. Submissions appear automatically, sorted by composite AI score.
3. Each card shows: thumbnail, scores (energy / celtics rep / originality / safety), and a composite score.
4. For Roast submissions: pick one of three AI-generated roast lines.
5. Click **Approve** to queue a fan for the jumbotron, or **Reject** to skip.
6. Safety-flagged submissions are auto-rejected (safety score < 70).

---

## Demo script (~2 minutes)

| Time | Action |
|------|--------|
| 0:00 | "Commercial breaks at the Garden are dead air. 18,000 people staring at their phones. We turn that time into the best part of the game." |
| 0:20 | Show QR code on the projector. Judges scan from their phones and submit selfies. |
| 0:50 | Pivot to `/ops` on the projector. Show submissions arriving with AI scores in real time. |
| 1:20 | Approve a Hype submission. Switch to a Roast submission — pick one of the three AI-generated lines. |
| 1:50 | Close: "Two reels per break. Eight breaks per game. Multiply by 30 arenas. The first AI-native in-venue product." |

---

## Known shortcuts (hackathon scope)

- **Snapshot only, no video.** MediaRecorder removed for cross-browser reliability. The PRD spec'd 5-second video; the MVP uses a single photo analyzed by Claude Vision.
- **No ffmpeg reel assembly.** The "reel" is the curated operator queue — no video concatenation, lower-thirds, or transitions.
- **No TTS.** Roast text is displayed on screen; the operator reads it aloud for the demo.
- **In-memory queue.** Resets on server restart or cold start. No Redis, no database.
- **No WebSockets.** Ops page polls every 2 seconds.
- **No operator auth.** `/ops` is open — it's a hackathon.

## What's next

- ElevenLabs TTS with PA-announcer voice for roast playback
- ffmpeg reel assembly with Celtics-branded intro/outro and lower-third name overlays
- Vercel KV (Redis) for persistent queue across cold starts
- WebSocket real-time updates for both fan and operator views
- Section leaderboard and Battle Mode (two sections head-to-head)
- Sponsor overlay slots on the reel

---

## Tech stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** (Celtics green #007A33 + gold theme)
- **Claude Sonnet 4** via Anthropic API (vision scoring + roast generation)
- **In-memory Map** for submission state
