const moments = [
  {
    ts: "00:01:10",
    quarterClock: "Pregame",
    score: { home: 0, away: 0 },
    segment: "National Anthem",
    subtitle:
      "Ladies and gentlemen, please rise for the national anthem as both teams stand along the sideline.",
    speaker: "arena-pa",
    courtFrame: "CAM-A | center court wide",
    topic: "Ceremonial Opening Moment",
    description:
      "The anthem marks the final pre-tip ceremony before player introductions and opening tip.",
    terms: ["national anthem", "pregame ceremony", "opening tip"],
  },
  {
    ts: "00:04:32",
    quarterClock: "Q1 · 12:00",
    score: { home: 0, away: 0 },
    segment: "Starting Lineup Introductions",
    subtitle:
      "And now your Boston starting five, led by their All-Star guard, and you can hear this building come alive.",
    speaker: "arena-pa",
    courtFrame: "CAM-B | player tunnel pan",
    topic: "Lineup Reveal and Matchup Setup",
    description:
      "Broadcast focus shifts to opening matchups and expected defensive assignments.",
    terms: ["starting lineup", "matchup", "tip-off"],
  },
  {
    ts: "00:09:18",
    quarterClock: "Q1 · 08:44",
    score: { home: 12, away: 9 },
    segment: "Active Gameplay",
    subtitle:
      "Boston goes high pick-and-roll, gets the switch they want, and that's a clean elbow jumper right there.",
    speaker: "commentator",
    courtFrame: "CAM-C | half-court tactical view",
    topic: "Early Pick-and-Roll Execution",
    description:
      "The offense is testing switch coverage and targeting mid-range space behind the screen.",
    terms: ["high pick-and-roll", "switch", "mid-range"],
  },
  {
    ts: "00:17:40",
    quarterClock: "Q2 · 05:12",
    score: { home: 41, away: 39 },
    segment: "Timeout and Bench Discussion",
    subtitle:
      "Timeout New York. It looks like they're setting up a sideline out-of-bounds action coming out of the break.",
    speaker: "commentator",
    courtFrame: "CAM-D | bench close-up",
    topic: "Set-Play Adjustment During Timeout",
    description:
      "Both benches are adjusting pace and play-calling before the final two minutes of the half.",
    terms: ["timeout", "sideline out-of-bounds", "bench unit"],
  },
  {
    ts: "00:19:05",
    quarterClock: "Q2 · 03:54",
    score: { home: 44, away: 42 },
    segment: "Replay and Slow-Motion Highlight",
    subtitle:
      "On the replay, weak-side help is late, and that leaves the corner shooter wide open for three.",
    speaker: "commentator",
    courtFrame: "CAM-E | replay telestration",
    topic: "Defensive Rotation Breakdown",
    description:
      "The production team uses slow motion to explain why the corner three was available.",
    terms: ["replay", "weak-side help", "corner three"],
  },
  {
    ts: "00:24:30",
    quarterClock: "Halftime",
    score: { home: 52, away: 49 },
    segment: "Halftime Show",
    subtitle:
      "Halftime entertainment is on the floor, and we'll be back with second-half adjustments in just a moment.",
    speaker: "sideline",
    courtFrame: "CAM-F | center court stage",
    topic: "Entertainment Break Between Halves",
    description:
      "Halftime show content keeps fan engagement high while analysts prepare tactical recap.",
    terms: ["halftime show", "second-half adjustments", "fan engagement"],
  },
  {
    ts: "00:38:12",
    quarterClock: "Q4 · 01:11",
    score: { home: 98, away: 97 },
    segment: "Final Moments / Clutch Time",
    subtitle:
      "Big defensive stop by Boston, they push in transition, and they draw contact at the rim with 1:11 left.",
    speaker: "commentator",
    courtFrame: "CAM-G | full-court tracking",
    topic: "Clutch Transition Decision-Making",
    description:
      "Late-game possessions are being decided by defensive rebounds and quick attacks before help arrives.",
    terms: ["clutch time", "transition push", "rim pressure"],
  },
  {
    ts: "00:41:52",
    quarterClock: "Final",
    score: { home: 104, away: 101 },
    segment: "Game End and Player Celebration",
    subtitle:
      "Final buzzer. Boston closes on a 9-4 run, and they're celebrating at center court.",
    speaker: "commentator",
    courtFrame: "CAM-H | final buzzer wide",
    topic: "Game End Result and Closing Run",
    description:
      "The game ends with a defensive stand and controlled final-possession execution.",
    terms: ["final buzzer", "closing run", "postgame reaction"],
  },
];

const termDictionary = {
  "national anthem": "A ceremonial song performed before the game officially begins.",
  "pregame ceremony": "Formal pregame sequence such as anthem, introductions, and honors.",
  "opening tip": "The first jump ball that starts play.",
  "starting lineup": "The first five players each team puts on the court.",
  matchup: "The direct player-versus-player assignment on offense and defense.",
  "tip-off": "Another term used in broadcasts for the official game start.",
  "high pick-and-roll": "A screen action near the top of the floor to create driving or switching advantages.",
  switch: "A defensive exchange where a new defender picks up the ball-handler.",
  "mid-range": "The scoring area between the paint and the three-point line.",
  timeout: "A coached stoppage used to reset strategy, tempo, or substitutions.",
  "sideline out-of-bounds": "A set play executed from a sideline inbound situation.",
  "bench unit": "The group of non-starters on the floor.",
  "corner three": "A three-point shot from the corner area, usually high-efficiency when open.",
  replay: "A repeated video segment used to review a previous action.",
  "weak-side help": "Secondary defensive support from the side away from the ball.",
  "halftime show": "Entertainment segment during the break between two halves.",
  "second-half adjustments": "Strategic changes made by coaches after halftime.",
  "fan engagement": "How actively viewers and attendees interact with the broadcast experience.",
  "clutch time": "Late-game period when each possession has high impact on the result.",
  "transition push": "Attacking quickly after a defensive stop before defense is set.",
  "rim pressure": "Repeated attacks toward the basket to draw fouls or high-value shots.",
  "final buzzer": "The signal that the game has ended.",
  "closing run": "A decisive scoring stretch near the end of the game.",
  "postgame reaction": "Immediate player and crowd response after the final result.",
};

const state = {
  index: 0,
  autoMode: false,
  autoTimer: null,
  progress: 42,
};

const homeScoreEl = document.getElementById("homeScore");
const awayScoreEl = document.getElementById("awayScore");
const gameClockEl = document.getElementById("gameClock");
const topicTitleEl = document.getElementById("topicTitle");
const topicDescriptionEl = document.getElementById("topicDescription");
const overlayTitleEl = document.getElementById("overlayTitle");
const overlaySubEl = document.getElementById("overlaySub");
const streamTimeEl = document.getElementById("streamTime");
const progressFillEl = document.getElementById("progressFill");
const transcriptListEl = document.getElementById("transcriptList");
const termPanelEl = document.getElementById("termPanel");
const termDetailEl = document.getElementById("termDetail");
const toggleAutoEl = document.getElementById("toggleAuto");
const nextMomentEl = document.getElementById("nextMoment");
const chatLogEl = document.getElementById("chatLog");
const suggestionsEl = document.getElementById("suggestions");
const questionInputEl = document.getElementById("questionInput");
const askBtnEl = document.getElementById("askBtn");
const answerBoxEl = document.getElementById("answerBox");
const timelineEl = document.getElementById("timeline");
const confidencePillEl = document.getElementById("confidencePill");
const vllmCommentaryEl = document.getElementById("vllmCommentary");
const vllmFrameEl = document.getElementById("vllmFrame");
const sceneImageEl = document.getElementById("sceneImage");

const speakerLabel = {
  commentator: "Commentator",
  "arena-pa": "Arena PA",
  sideline: "Sideline",
};

const suggestionPrompts = [
  "What does this subtitle tell us tactically?",
  "How did halftime change the game flow?",
  "Which transcript line supports the current AI topic?",
];

function highlightTerms(text, terms) {
  let result = text;
  terms.forEach((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(escaped, "gi"), (match) => `<mark>${match}</mark>`);
  });
  return result;
}

function pushTranscript(frame) {
  const li = document.createElement("li");
  const speaker = frame.speaker || "commentator";
  const tagClass = speaker === "commentator" ? "speaker-tag commentator" : "speaker-tag";
  li.classList.toggle("commentator-line", speaker === "commentator");
  li.innerHTML = `<span class="stamp">${frame.ts}</span><span class="${tagClass}">${speakerLabel[speaker] || "Feed"}</span><p>${highlightTerms(frame.subtitle, frame.terms)}</p>`;
  transcriptListEl.prepend(li);

  while (transcriptListEl.children.length > 8) {
    transcriptListEl.removeChild(transcriptListEl.lastChild);
  }
}

function updateVllmPayload(frame) {
  if (frame.speaker === "commentator") {
    vllmCommentaryEl.textContent = frame.subtitle;
    vllmFrameEl.textContent = `${frame.ts} · ${frame.courtFrame}`;
    return;
  }

  vllmCommentaryEl.textContent = "No commentator line in this moment. Waiting for the next tactical commentary segment.";
  vllmFrameEl.textContent = `${frame.ts} · ${frame.courtFrame}`;
}

function renderTerms(frame) {
  termPanelEl.innerHTML = "";
  frame.terms.forEach((term) => {
    const button = document.createElement("button");
    button.className = "term";
    button.textContent = term;
    button.addEventListener("click", () => {
      const contextText = buildTermContext(term, frame);
      termDetailEl.textContent = contextText;
    });
    termPanelEl.appendChild(button);
  });
}

function getNearestCommentatorMoment(frame) {
  if (frame.speaker === "commentator") {
    return frame;
  }

  for (let i = state.index; i >= 0; i -= 1) {
    if (moments[i].speaker === "commentator") {
      return moments[i];
    }
  }

  for (let i = state.index + 1; i < moments.length; i += 1) {
    if (moments[i].speaker === "commentator") {
      return moments[i];
    }
  }

  return null;
}

function buildTermContext(term, frame) {
  const definition = termDictionary[term] || "Definition coming soon.";
  const anchor = getNearestCommentatorMoment(frame);

  if (!anchor) {
    return `${term}: ${definition} Current game context: ${frame.segment} (${frame.quarterClock}). No commentator line is available yet for this moment.`;
  }

  return `${term}: ${definition} Game context: ${frame.segment} (${frame.quarterClock}, ${frame.score.home}-${frame.score.away}). Commentator evidence: "${anchor.subtitle}" Visual evidence: ${anchor.courtFrame}. In this possession window, the term is used to explain the tactical decision happening on court.`;
}

function renderTop(frame) {
  homeScoreEl.textContent = String(frame.score.home);
  awayScoreEl.textContent = String(frame.score.away);
  gameClockEl.textContent = frame.quarterClock;
  topicTitleEl.textContent = frame.topic;
  topicDescriptionEl.textContent = frame.description;
  overlayTitleEl.textContent = `Current Segment: ${frame.segment}`;
  overlaySubEl.textContent = frame.description;
  streamTimeEl.textContent = frame.ts;
}

function slugifySegment(segment) {
  return segment
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function updateSceneImage(frame) {
  const index = state.index + 1;
  const imageName = `scene_${String(index).padStart(2, "0")}_${slugifySegment(frame.segment)}.png`;
  const imagePath = `mock_stream_images/${imageName}`;

  sceneImageEl.src = imagePath;
  sceneImageEl.alt = `Generated scene for ${frame.segment}`;
  sceneImageEl.onerror = () => {
    sceneImageEl.removeAttribute("src");
  };
}

function addTimelineEvidence(frame, confidence) {
  const li = document.createElement("li");
  li.innerHTML = `<strong>${frame.ts}</strong> · Subtitle evidence: ${frame.subtitle}<br>Video anchor: ${frame.ts} - ${shiftTime(frame.ts, 7)} (mock visual lookup)`;
  timelineEl.prepend(li);
  confidencePillEl.textContent = `Answer Confidence: ${confidence}%`;
}

function shiftTime(ts, plusSeconds) {
  const [h, m, s] = ts.split(":").map(Number);
  const total = h * 3600 + m * 60 + s + plusSeconds;
  const hh = String(Math.floor(total / 3600)).padStart(2, "0");
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function buildAiAnswer(question, frame) {
  const q = question.toLowerCase();

  if (q.includes("anthem") || q.includes("ceremony")) {
    return {
      text:
        "The anthem subtitle marks a ceremonial scene, not tactical play. It confirms the broadcast is still in pregame protocol before lineup announcements and tip-off.",
      confidence: 93,
    };
  }

  if (q.includes("halftime") || q.includes("show")) {
    return {
      text:
        "The halftime subtitle indicates a break in gameplay while the show runs and analysts prepare second-half adjustments. This usually resets pace and substitution planning for Q3.",
      confidence: 90,
    };
  }

  if (
    q.includes("pick-and-roll") ||
    q.includes("switch") ||
    q.includes("tactic") ||
    q.includes("tactical")
  ) {
    return {
      text:
        "The gameplay subtitle describes high pick-and-roll usage to trigger a switch. That is a common way to hunt favorable matchups and create cleaner mid-range or paint looks.",
      confidence: 88,
    };
  }

  if (q.includes("replay") || q.includes("highlight") || q.includes("corner three")) {
    return {
      text:
        "The replay subtitle points to late weak-side help, which explains why the corner shooter was uncovered. The slow-motion sequence supports that defensive timing issue.",
      confidence: 87,
    };
  }

  if (q.includes("clutch") || q.includes("final") || q.includes("end")) {
    return {
      text:
        "In clutch time, the transcript highlights transition pressure and rim attacks, then confirms the final buzzer result. The sequence is consistent with a late closing run.",
      confidence: 89,
    };
  }

  return {
    text:
      `From the current topic (${frame.topic}), the most relevant subtitle evidence is: "${frame.subtitle}". If you ask with a tactical term, I can return a more precise explanation.`,
    confidence: 74,
  };
}

function appendChat(role, text) {
  const div = document.createElement("div");
  div.className = "msg";
  div.innerHTML = `<strong>${role}:</strong> ${text}`;
  chatLogEl.appendChild(div);
  chatLogEl.scrollTop = chatLogEl.scrollHeight;
}

function renderSuggestions() {
  suggestionsEl.innerHTML = "";
  suggestionPrompts.forEach((prompt) => {
    const chip = document.createElement("button");
    chip.className = "suggestion";
    chip.textContent = prompt;
    chip.addEventListener("click", () => {
      questionInputEl.value = prompt;
      questionInputEl.focus();
    });
    suggestionsEl.appendChild(chip);
  });
}

function nextMoment() {
  state.index = (state.index + 1) % moments.length;
  const frame = moments[state.index];
  state.progress = Math.min(96, state.progress + 11);
  progressFillEl.style.width = `${state.progress}%`;

  renderTop(frame);
  updateSceneImage(frame);
  renderTerms(frame);
  pushTranscript(frame);
  updateVllmPayload(frame);
}

function askQuestion() {
  const question = questionInputEl.value.trim();
  if (!question) {
    answerBoxEl.textContent = "Please type a question first.";
    return;
  }

  const frame = moments[state.index];
  const result = buildAiAnswer(question, frame);

  appendChat("Fan", question);
  appendChat("AI", result.text);
  answerBoxEl.textContent = result.text;
  addTimelineEvidence(frame, result.confidence);

  questionInputEl.value = "";
}

function setAutoMode(enabled) {
  state.autoMode = false;
  if (state.autoTimer) {
    clearInterval(state.autoTimer);
    state.autoTimer = null;
  }
  toggleAutoEl.textContent = "Auto: Disabled";
}

nextMomentEl.addEventListener("click", nextMoment);
askBtnEl.addEventListener("click", askQuestion);
questionInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    askQuestion();
  }
});

toggleAutoEl.addEventListener("click", () => {
  setAutoMode(false);
});

function initialize() {
  const first = moments[0];
  renderTop(first);
  updateSceneImage(first);
  renderTerms(first);
  transcriptListEl.innerHTML = "";
  pushTranscript(first);
  updateVllmPayload(first);

  timelineEl.innerHTML = "<li><strong>System</strong> · Timeline evidence will appear after the first AI answer.</li>";
  appendChat("System", "Welcome to PulseLens Broadcast Mock. Ask anything about the live moment.");
  renderSuggestions();
  setAutoMode(false);
}

initialize();
