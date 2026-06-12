# QuickQuiz — Ludwitt Education Tool (Week 4)

**Author:** Paramjeet Singh ([@Paramjeet-singh-neu](https://github.com/Paramjeet-singh-neu))  
**Repo:** [Paramjeet-singh-neu/QuickQuiz](https://github.com/Paramjeet-singh-neu/QuickQuiz)  
**Live API:** [https://quickquiz-api-162b.onrender.com](https://quickquiz-api-162b.onrender.com)  
**Ludwitt app:** `le_6aba9be6fdd339bf42d04e` (hosted-storage, in review)

## What it does

QuickQuiz converts lecture PDFs into interactive quizzes for students. Upload a PDF, and the app extracts key passages, runs AI analysis for concepts and learning objectives, generates MCQ / True-False / Cloze questions, and saves quiz history per user.

## How it plugs into Ludwitt

QuickQuiz is built as a **hosted-storage Learning Engineer app** on Ludwitt:

| Ludwitt surface | QuickQuiz implementation |
|---|---|
| OAuth (`profile`, `credits:read`, `credits:spend`, `data:read`, `data:write`) | FastAPI `/auth/login` → `/auth/callback` with server-side token exchange and HttpOnly session cookies |
| Credit balance | Gates online AI on `spendableCents` via `/api/credits/balance` |
| AI proxy | Content analysis calls `POST /api/v1/ai/messages` (no direct OpenAI key in production) |
| Hosted data | Saves compact quiz runs to `quiz_runs` collection (`createdAt`, `sourceName` indexed) |

**Revenue share:** 35% engineer / 65% Ludwitt (hosted-storage tier).

## Architecture

```
Student browser → React/Vite frontend → FastAPI backend → Ludwitt OAuth / AI / Data APIs
                                              ↘ ECS quiz pipeline (PDF → quiz, 0–1 LLM call)
```

- **Frontend:** React + Vite marketplace UI (login, upload, quiz results, history)
- **Backend:** FastAPI with Ludwitt OAuth, credit billing, and hosted-data clients
- **Quiz engine:** Existing Python multi-agent pipeline (`DocumentProcessor`, `ContentAnalyzer`, `QuizGenerator`, `StatisticalAnalyzer`)

## Ludwitt registration

- **Tier:** Hosted storage (locked at creation)
- **Collection:** `quiz_runs`
- **Indexed fields:** `createdAt`, `sourceName`
- **Redirect URI:** `https://quickquiz-api-162b.onrender.com/auth/callback`
- **Scopes:** `profile credits:read credits:spend data:read data:write`

## Deployment

| Component | Host | URL |
|---|---|---|
| API | Render | `https://quickquiz-api-162b.onrender.com` |
| Frontend | Vercel | _(set `VITE_API_BASE_URL` to Render API)_ |

Health check: `GET /health` → `{"status":"ok","service":"quickquiz-api"}`

## Student flow

1. Sign in with Ludwitt from the web app
2. Upload a lecture PDF and choose question count
3. Online mode: Ludwitt credits fund one AI analysis call; offline mode skips AI (free)
4. View generated quiz, learning objectives, and statistics
5. Quiz run saved to Ludwitt hosted storage for history

## Status

- Ludwitt app submitted and **in review** (Test mode available for sandbox token verification)
- Live backend deployed on Render
- Frontend deployed on Vercel
- OAuth blocked until Ludwitt approves the app; integration code is complete

## Links

- [QuickQuiz GitHub](https://github.com/Paramjeet-singh-neu/QuickQuiz)
- [Live API](https://quickquiz-api-162b.onrender.com)
- [Ludwitt LE docs](https://pitchrise.ludwitt.com/docs/le/quickstart.md)
