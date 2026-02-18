# Feature Ideas

Standalone feature proposals for expanding the Cursor Boston platform. Each is fully isolated — new routes, new collections, no entanglement with existing code — giving contributors creative freedom to build.

---

## 1. Prompt & Rules Cookbook — share and discover Cursor workflows

### Summary

A dedicated section where community members can share, browse, and rate Cursor IDE prompts, `.cursorrules` files, and AI-assisted development workflows. Think of it as a recipe book for AI-native coding.

### Motivation

The Cursor Boston community's core identity is AI-powered development, but there's no place on the platform to share the actual techniques people use daily. A cookbook would become the go-to resource for prompt engineering in Cursor and drive repeat visits.

### Proposed Features

- **Browse & search** a library of community-submitted prompts/rules files
- **Categories**: debugging, refactoring, code generation, testing, documentation, architecture, etc.
- **Submission form** with title, description, prompt content (code block), category, and tags
- **Upvote/downvote** system (similar to existing showcase voting)
- **Copy-to-clipboard** button on each prompt
- **"Works with" tags** (e.g., Python, TypeScript, React, Next.js)
- **Author attribution** linked to member profile

### Technical Notes

- New route: `app/cookbook/page.tsx`
- New Firestore collection: `cookbook_entries`
- Can reuse the existing voting API pattern from `/api/showcase/vote`
- Fully self-contained — no modifications to existing features required

### Design Guidance

- Card-based grid layout with syntax-highlighted code previews
- Filter sidebar with category and language selectors
- Dark mode support via existing Tailwind theme tokens

---

## 2. Achievement Badge System with Gamified Milestones

### Summary

A gamification layer that awards badges to members based on community activity — event attendance, hackathon participation, contributions, profile completeness, and more. Badges display on member profiles and the member directory.

### Motivation

Gamification increases engagement and gives members visible recognition. It also creates natural onboarding goals (e.g., "Complete your profile to earn the **Identity** badge").

### Proposed Badges (Starter Set)

| Badge | Criteria |
|-------|----------|
| **First Steps** | Complete profile with bio and avatar |
| **Connected** | Link Discord + GitHub accounts |
| **Speaker** | Submit and deliver a talk |
| **Hacker** | Participate in a hackathon |
| **Showcase Star** | Submit a project to the showcase |
| **Conversation Starter** | Post 5 messages in the community feed |
| **Regular** | Attend 3+ events |
| **Mentor** | Matched as a mentor (future feature) |
| **Contributor** | Get a PR merged to this repo |

### Technical Notes

- New Firestore collection: `badges` (badge definitions) and `user_badges` (awarded instances)
- New components: `BadgeCard`, `BadgeGrid`, `BadgePopover` (shows how-to-earn info)
- New route: `app/badges/page.tsx` (browse all badges)
- Badge display component to embed in member profiles and member cards
- Badge awarding can be triggered via Cloud Functions or checked on-demand
- Self-contained system — only touches existing code to render badges on profile/member cards

### Design Guidance

- Each badge: circular icon + name + description + earned date
- Unearned badges shown greyed out with progress hints
- Profile section: horizontal scrollable row of earned badges

---

## 3. AI Pair Programming Matchmaker — find your coding partner

### Summary

A matchmaking system that pairs community members for pair programming sessions based on complementary skills, shared interests, and availability. Built specifically for the AI-native development community.

### Motivation

Cursor Boston is about community — but the platform currently has no way for members to find collaborators outside of hackathon teams. A matchmaker encourages ongoing 1:1 connections and skill-sharing between events.

### Proposed Features

- **Opt-in matching profile**: skills you can teach, skills you want to learn, preferred languages/frameworks, timezone, availability windows
- **Smart matching**: suggest partners based on complementary skill gaps (e.g., someone who wants to learn React matched with someone who teaches React)
- **Session types**: "Teach me", "Build together", "Code review swap", "Explore a topic"
- **Request & accept flow**: send a pairing request with a short message, other person accepts/declines
- **Session log**: optional post-session notes (what you worked on, what you learned)
- **Active pairings dashboard**: see your upcoming and past sessions

### Technical Notes

- New routes: `app/pair/page.tsx` (browse & match), `app/pair/[sessionId]/page.tsx` (session detail)
- New Firestore collections: `pair_profiles`, `pair_requests`, `pair_sessions`
- New API routes: `/api/pair/profile`, `/api/pair/request`, `/api/pair/respond`
- Matching algorithm can start simple (tag overlap scoring) and evolve
- Completely standalone — no changes to existing features

### Design Guidance

- Profile cards showing skills offered/wanted with visual skill tags
- Match score indicator (e.g., "85% match")
- Clean request/accept UI with status indicators

---

## 4. Public Community Analytics Dashboard

### Summary

A public-facing analytics dashboard that visualizes community growth and activity — member signups over time, event attendance trends, hackathon stats, popular skills, and more. Makes the community's momentum visible and inspires participation.

### Motivation

Communities thrive on visible momentum. A dashboard showing growth metrics builds confidence for new members ("this community is active"), provides talking points for organizers, and creates a sense of shared progress.

### Proposed Metrics & Visualizations

- **Member growth**: line chart of signups over time
- **Skill distribution**: bar chart or word cloud of most common member skills
- **Event attendance**: bar chart of attendance per event
- **Hackathon stats**: teams formed, projects submitted, participation rate
- **Community feed activity**: posts/replies per week
- **Showcase projects**: submissions over time, total votes cast
- **Top contributors**: leaderboard of most active members (opt-in)
- **Platform health**: active members this month, returning members

### Technical Notes

- New route: `app/analytics/page.tsx`
- Charting library: [Recharts](https://recharts.org/) (lightweight, React-native) or [Chart.js](https://www.chartjs.org/) via react-chartjs-2
- Data aggregation: new API route `/api/analytics/summary` that queries Firestore collections and computes aggregate stats
- Consider caching aggregated stats in a `analytics_snapshots` collection to avoid expensive queries on every page load
- Fully self-contained — reads from existing collections but doesn't modify them

### Design Guidance

- Clean grid of chart cards, responsive layout
- Accent colors from the existing Tailwind theme
- Subtle animations on number counters (count-up effect)
- Dark mode compatible charts

---

## 5. Interactive Community Event Map

### Summary

An interactive map page showing all past and upcoming Cursor Boston event venues across the city. Click a pin to see event details, photos, and attendance. Gives the community a geographic identity and helps newcomers discover events near them.

### Motivation

Cursor Boston is inherently local — the city is part of the brand. A map makes the community feel tangible, helps people find nearby events, and creates a visual archive of where the community has gathered.

### Proposed Features

- **Interactive map** centered on Boston with pins for each event venue
- **Pin popups**: event name, date, venue name, attendance count, link to event page
- **Color coding**: upcoming events (green), past events (blue)
- **Venue detail sidebar**: full address, transit directions, past events held there, photos
- **List/map toggle**: switch between map view and traditional list view
- **Neighborhood filter**: Back Bay, Cambridge, Seaport, etc.

### Technical Notes

- New route: `app/map/page.tsx`
- Map library: [Leaflet](https://leafletjs.com/) via `react-leaflet` (free, no API key) or [Mapbox GL](https://www.mapbox.com/) for a more polished look
- Venue coordinates stored in existing `events.json` or a new `venues` Firestore collection
- Geocoding: can hardcode coordinates for known venues or use a free geocoding API
- Completely standalone page — reads event data but doesn't modify existing routes

### Design Guidance

- Dark-themed map tiles to match the platform aesthetic
- Smooth zoom/pan with clustered markers when zoomed out
- Mobile-friendly: full-screen map with bottom sheet for details

---

## 6. Lightning Talk Timer & Speaker Queue

### Summary

A real-time lightning talk management tool for use during Cursor Boston events. Speakers join a queue, an emcee controls the timer, and the audience can see who's up next — all from their phones. Perfect for demo nights and open-mic sessions.

### Motivation

Lightning talks and demo sessions are a staple of Cursor Boston events, but managing speaker order and time is always ad-hoc. A purpose-built tool makes events run smoother and gives the platform a unique "live event" capability.

### Proposed Features

- **Speaker queue**: members sign up to present with a talk title and estimated duration (3 or 5 min)
- **Real-time timer**: large countdown display visible to speaker and audience
- **Emcee controls**: start/pause/skip timer, reorder queue, remove speakers
- **Audience view**: see current speaker, time remaining, and upcoming queue
- **Visual/audio alerts**: warning at 1 minute, 30 seconds; time-up indicator
- **Session history**: log of all talks given during the event with timestamps
- **QR code join**: audience scans a QR code to see the live queue on their phone

### Technical Notes

- New route: `app/live/[sessionId]/page.tsx` (audience view), `app/live/[sessionId]/emcee/page.tsx` (host controls)
- **Firebase Realtime Database** is ideal here for sub-second sync (already in the stack)
- New collections: `live_sessions`, `live_queue_entries`
- QR code generation: `qrcode` package is already a dependency
- Role-based access: emcee (creator) gets controls, everyone else gets read-only view
- Fully isolated — no dependencies on existing features

### Design Guidance

- Timer: large, centered countdown with color transitions (green > yellow > red)
- Queue: numbered list with speaker avatars, drag-to-reorder for emcee
- Mobile-first: designed to be used on phones at events
- Minimal UI — should be glanceable from across a room
