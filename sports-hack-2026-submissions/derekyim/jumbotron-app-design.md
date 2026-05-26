# Jumbotron — Hackathon PRD

A web app for fans at Boston Celtics games. Fans submit a short selfie video and choose one of two modes: **Hype** (get featured on the jumbotron during a commercial break) or **Roast** (get an AI-generated caption + voiceover that lovingly roasts them, also playing on the jumbotron). Same submission flow, two output reels.
there is also an "I'm feeling lucky" where randomly they get one or the other..

The demo: judges scan a QR code → submit a clip from their phones → within 60 seconds, a generated Hype reel and a Roast reel play on the projector.

---

## User flow

1. Fan scans QR code in their section → opens web app (no login).
2. Picks a mode: **Hype Me** or **Roast Me**.
3. Records a 5-second selfie video in-browser, enters their first name and section (e.g., "Derek, Sec 312").
4. Hits submit. Sees a "you're in the queue" screen with their position.
5. If selected, their clip plays on the jumbotron. They get a notification ("you're up next!") with a screen-record link to share.

Operator view (the arena ops person):
- Live queue of submissions, sorted by AI score.
- One-click **Approve & Queue** to add to the next break's reel.
- **Build Reel** button auto-assembles 4–6 approved clips into a 30-second jumbotron-ready MP4.

---

## Two modes, one pipeline

### Mode 1: Hype

Goal: pick the most jumbotron-worthy fan clips and stitch them into a hype reel.

AI scoring on each clip (0–100):
- **Energy** — movement, facial expression intensity
- **Celtics rep** — green/white visible, team apparel, signs
- **Originality** — celebration / chant / dance vs. generic wave
- **Safety** — no profanity, no inappropriate gestures (auto-reject if flagged)

Top scorers go into the queue. Operator approves; reel builder concatenates clips with lower-third name + section graphics ("DEREK · SEC 312") and a Celtics-branded transition.

### Mode 2: Roast

Goal: generate a kind-but-funny caption + voiceover for each clip, overlay it on their video.

Pipeline per clip:
1. Vision model describes what's in the frame (clothing, expression, vibe, what they're doing).
2. LLM generates 3 candidate roasts under a strict prompt: **playful, not mean; punching up or sideways, never down; no comments on body, race, gender, or anything someone can't change in 5 seconds.**
3. Operator picks one (or regenerates).
4. Caption overlays on the video; TTS reads the roast in a "PA announcer" voice.
5. Goes into the Roast reel for the next break.

Sample roast vibe (to calibrate the prompt):
- "Section 304 came correct tonight — and this guy brought THREE jerseys. Pick a player, sir."
- "I have been informed this is the loudest person in her row. Her row is also empty."
- "This man has been holding the same beer for the entire third quarter. Respect."

---

## Tech stack (suggested)

- **Frontend (fan):** Next.js + React, MediaRecorder API for in-browser video capture, Tailwind for the Celtics-green UI.
- **Frontend (operator):** Same Next.js app, separate `/ops` route, simple password gate.
- **Backend:** Next.js API routes or a small FastAPI service. Redis for submissions queue.  local disk for the demo, for video blobs.
- **AI:**
  - Vision + scoring + roast generation: **Claude Sonnet 4** via the Anthropic API (`claude-sonnet-4-20250514`). Pass the video as sampled frames (3–5 stills) — vision-capable models handle this well.
  - TTS: ElevenLabs (announcer voice) or OpenAI TTS as a fallback.
  - Safety classifier: Claude prompt with strict rejection criteria, run before scoring.
- **Reel assembly:** `ffmpeg` server-side. Pre-baked intro/outro/transition clips. Lower-third name graphics rendered as PNG overlays from a template.
- **Realtime:** WebSockets (or Pusher) so the operator queue updates live and submitters see queue position.

---

## Data model

```
Submission {
  id: uuid
  mode: "hype" | "roast"
  name: string
  section: string
  video_url: string
  created_at: timestamp
  status: "pending" | "scored" | "approved" | "rejected" | "played"

  // Populated by AI pipeline
  scores: { energy, celtics_rep, originality, safety } // 0-100 each
  composite_score: number
  safety_flagged: boolean
  vision_description: string

  // Roast-mode only
  roast_candidates: string[]   // 3 options
  roast_chosen: string | null
  roast_audio_url: string | null
}

Reel {
  id: uuid
  mode: "hype" | "roast"
  submission_ids: uuid[]
  output_url: string
  built_at: timestamp
}
```

---

## API endpoints

```
POST /api/submissions           // upload video + metadata, returns submission_id
GET  /api/submissions/:id       // poll status / queue position
POST /api/ops/score/:id         // trigger AI scoring (auto on upload)
POST /api/ops/approve/:id       // operator approves
POST /api/ops/reject/:id
POST /api/ops/regenerate-roast/:id
POST /api/ops/build-reel        // body: { mode, submission_ids[] } → returns reel_url
GET  /api/ops/queue?mode=hype   // sorted by composite_score desc
```

---

## AI prompts (drop-in starters)

### Scoring (Hype mode)

```
You are scoring a 5-second selfie video from a Boston Celtics fan submitted for
the in-arena jumbotron. You'll see 3–5 sampled frames.

Score 0–100 on each dimension:
- energy: visible movement, expression intensity, clear hype
- celtics_rep: green/white/Celtics gear, signs, team colors
- originality: unique celebration, dance, chant vs. generic
- safety: 100 = clean; 0 = profanity, gestures, anything you wouldn't show on a family-friendly jumbotron

Also return:
- vision_description: 1 sentence of what you see
- safety_flagged: true if safety < 70

Return JSON only.
```

### Roast generation

```
You are an arena PA announcer with a warm, playful sense of humor, writing a
one-line roast for a Boston Celtics fan submitted to the jumbotron. You'll
see 3–5 sampled frames of the fan.

RULES — non-negotiable:
- Punching up or sideways, never down.
- No comments on body, weight, race, gender, age, or anything they can't change.
- No profanity. Family-friendly (kids are in the building).
- Affectionate, not cruel. The fan should laugh and want to share it.
- 15 words or fewer. Built for a single PA-announcer breath.
- Specific to what you actually see — generic roasts are boring.

Generate 3 distinct options. Return JSON: { "roasts": ["...", "...", "..."] }
```

---

## Build order (24-hour hackathon)

**Hour 0–4: Skeleton**
- Next.js app scaffolded, two routes: `/` (fan) and `/ops` (operator).
- MediaRecorder capture working in-browser, upload to S3 (or `/tmp` for demo).
- Submissions table + basic API.

**Hour 4–10: AI pipeline**
- Frame sampling with `ffmpeg` (5 frames from each 5-sec clip).
- Claude vision call for scoring (Hype) and roast generation (Roast).
- Wire scores into the ops queue UI.

**Hour 10–16: Reel builder**
- ffmpeg concat with lower-third overlays.
- TTS for roasts, mux audio into the clip.
- Pre-bake a Celtics-themed intro/outro/transition (3 short MP4s).

**Hour 16–20: Polish**
- Operator UI: queue with thumbnails, approve/reject, regenerate-roast button, build-reel button.
- Submitter UI: queue position, "you're up" notification.
- Celtics green theme, "TD Garden" mock branding.

**Hour 20–24: Demo prep**
- QR code for judges to submit live.
- Pre-load 5–10 dummy submissions in case the room is shy.
- Practice the 3-minute demo: QR scan → submit → reel plays on the projector.

---

## Demo script (3 minutes)

1. (0:00) "Commercial breaks at the Garden are dead air. 18,000 people staring at their phones. We turn that time into the best part of the game." Show the slide / one-liner.
2. (0:30) QR code on screen. Judges scan, submit clips. Show submissions hitting the ops queue in real time with AI scores.
3. (1:30) Operator clicks **Build Hype Reel**. 20 seconds later, play the reel on the projector — judges see themselves on the "jumbotron."
4. (2:15) Switch to Roast mode. Show the 3 candidate roasts for one judge's clip. Pick one. Play the Roast reel with TTS.
5. (2:45) Close: "Two reels per break. Eight breaks per game. Multiply by 30 arenas. The first AI-native in-venue product."

---

## Stretch goals (only if ahead)

- Section leaderboard — which section submitted the best clips tonight.
- "Battle mode" — Hype reel pits two sections' clips head-to-head, fans vote on phones.
- Sponsor overlay slot — "This jumbotron moment brought to you by [brand]."
- Auto-pull the top clip into a social-ready vertical video for the team's TikTok.

---

## Things that will bite you

- **iOS Safari MediaRecorder quirks** — test on iPhone day 1, not hour 23. Fallback to `<input type="file" accept="video/*" capture="user">` if recording is flaky.
- **Roast taste calibration** — budget an hour to tune the prompt with real test clips. The default LLM tone will be too tame or too mean; you want the middle.
- **Video processing time** — ffmpeg + TTS per clip can take 10–20 seconds. Queue async, never block the submitter's UI.
- **Safety auto-reject** — be aggressive. One bad clip on the jumbotron kills the product.
