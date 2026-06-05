# PulseLens Broadcast (Mock Demo)

Track: **01 Fan and Audience Experience**

## Project One-Liner

PulseLens Broadcast turns real-time sports subtitles into an interactive understanding layer with AI topic detection, live description summaries, term explanations, and evidence-grounded Q&A.

## One User · One Problem · One Product

- User: A solo fan watching a live game online.
- Problem: Live streams move fast, and tactical language is hard to follow in real time.
- Product: A stream companion UI that explains what is happening, why it matters, and where the evidence comes from.

## Mock Demo Layout

1. Top Bar
- Live score
- AI-generated current topic
- Current description summary

2. Main Content
- Left: fake live video player area
- Right: timestamped real-time transcription feed with highlighted terms

3. Bottom Area
- Fan chat + AI assistant
- Suggested prompts
- Evidence timeline with subtitle anchors and confidence score

## Core Interactions

1. Click **Next Moment** to simulate stream progression.
2. Auto mode updates subtitles and context every few seconds.
3. Click highlighted terms to view quick definitions.
4. Ask questions in chat and get AI answers grounded in subtitle evidence.

## Why It Is Useful

- Makes online viewing more immersive and interactive.
- Helps casual fans understand advanced commentary quickly.
- Improves trust by attaching timeline evidence to answers.

## Quick Start

No build step required.

1. Open `index.html` in a browser.
2. Watch the top context update as moments change.
3. Follow timestamped transcripts on the right.
4. Ask questions in the bottom chat area.

## 60-90s Demo Script

1. Show the top bar and explain score/topic/description updates.
2. Click **Next Moment** to simulate a new live event.
3. Point to the right panel with timestamped subtitles.
4. Click a highlighted term to show explainability.
5. Ask a tactical question and show grounded AI response + evidence timeline.

## Files

- `index.html`: website structure and module layout
- `styles.css`: responsive visual design and animations
- `app.js`: mock stream data and interactive logic
- `meta.json`: submission metadata
