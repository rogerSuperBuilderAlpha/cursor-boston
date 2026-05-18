# Documentation style guide

> Required reading for anyone writing or editing docs in this repo. Modeled on the [Next.js docs writing-style guide](https://github.com/vercel/next.js/blob/canary/contributing/docs/writing-style-guide.md) with adjustments for our community-platform context.

The goal of this guide is **consistency** — not authorial voice. Every doc should read as if one person wrote all of them. If a rule below conflicts with an existing doc, the doc is wrong; open a PR to fix it.

## Voice

### Second-person, active, present

- ✅ "Run `npm install` to set up your local environment."
- ❌ "The developer should run `npm install` to set up their local environment."
- ❌ "`npm install` will set up the local environment."

Second-person (`you`/`your`) is the default. Use first-person plural (`we`/`our`) only when describing project policy or community decisions (e.g., "We enforce DCO sign-off on every commit").

### Direct, not promotional

- ✅ "Cursor Boston is a community platform for Boston-area developers using AI-assisted workflows."
- ❌ "Cursor Boston is the premier community platform for Boston-area developers leveraging cutting-edge AI-assisted workflows."

Adjective inflation is the most common quality drop in docs as a project scales. Strip the word and re-read; if the sentence is weaker, keep the word — usually it isn't.

### Imperative for instructions

- ✅ "Open `lib/api-schemas/community.ts` and add the new route."
- ❌ "You'll want to open `lib/api-schemas/community.ts`..."

## Banned words and phrases

These are banned because they either (a) mislead (calling something "easy" when it isn't is condescending to the reader who's stuck) or (b) waste words.

| Don't | Use instead |
|---|---|
| easy / easily | (drop the word, or be specific: "Takes about 5 minutes") |
| just / simply | (drop the word) |
| obviously | (drop the word) |
| basically | (drop the word) |
| in order to | "to" |
| at this point in time | "now" |
| due to the fact that | "because" |
| utilize | "use" |
| leverage (as a verb) | "use" |
| robust / cutting-edge / world-class | (be specific: "X passes Y test", "X measured at Z") |
| please | (drop in instructions: "Run X" not "Please run X") |
| we recommend | "Do X" or "Prefer X" — be direct |
| should | (use only for genuine choice; otherwise "must") |

**Exception**: in error messages and Code-of-Conduct-adjacent prose, courtesy words like "please" stay. Banned only in instructions.

## Product vocabulary

These names are not interchangeable.

| Term | Meaning |
|---|---|
| **Cursor** | The editor product made by Anthropic-adjacent Cursor company at [cursor.com](https://cursor.com). |
| **Cursor Boston** | This community / this platform. Capitalize both words. |
| **the platform** | Synonym for Cursor Boston (use sparingly to avoid repetition). |
| **the project** | Synonym for the codebase + community when context is clear. |
| **CB** | ❌ Don't abbreviate. |
| **the site** | The deployed web product at cursorboston.com. |
| **the repo** | The Git repository at github.com/rogerSuperBuilderAlpha/cursor-boston. |

Subsystem names follow the canonical doc:

| Subsystem | Canonical spelling | Doc |
|---|---|---|
| The game | **Generals** (proper noun, capitalized) | [`docs/generals/`](generals/README.md) |
| Weekly cohort | **Summer Cohort** | `.github/ACTIVE_ISSUES.md` |
| Hackathon submissions | **PyData submissions**, **Hack-a-Sprint submissions** | per event |

## Doc-type conventions

Every new doc declares its [Diátaxis](https://diataxis.fr/) quadrant at the top. Pick one — docs that mix quadrants without internal separation produce drift.

### Tutorials (learning by doing)

- First-person plural ("we'll build…") is OK because the reader and writer are walking the same path.
- Every step has a verifiable outcome (a screenshot, a command output, a passing test).
- Open with "What you'll build" and "What you'll learn".
- Don't reference advanced concepts until they're needed.
- Example: [`docs/GET_STARTED.md`](GET_STARTED.md), [`docs/FIRST_CONTRIBUTION.md`](FIRST_CONTRIBUTION.md).

### How-to guides (goal-oriented recipes)

- Single goal per doc — name it in the title ("How to publish a hackathon", not "Hackathons").
- Bullet steps, not narrative.
- Assume reader competence — don't re-teach setup if they've reached this doc.
- Close with a "Next steps" pointer.
- Example: [`docs/RELEASING.md`](RELEASING.md), [`docs/HACK_A_SPRINT_2026_OPS.md`](HACK_A_SPRINT_2026_OPS.md).

### Reference (exhaustive facts)

- No prose between entries — tables, lists, code signatures.
- Alphabetize or group by structural similarity (e.g., `docs/API.md` is grouped by area, alphabetical within).
- Mark provenance — say "auto-generated" if it is.
- Example: [`docs/API.md`](API.md), [`docs/DEVELOPMENT.md`](DEVELOPMENT.md) reference sections.

### Explanation (concept-first prose)

- Narrative is allowed (this is the only quadrant where it is).
- Open with the question the doc answers.
- Cross-link to ADRs / RFCs / specs liberally.
- Example: [`docs/adr/`](adr/README.md), [`docs/security-incident-2026-04-11.md`](security-incident-2026-04-11.md).

## Markdown conventions

### Headings

- Single `#` (H1) per file, at the top, matching the file's purpose.
- Nest `##`, `###`, `####` cleanly. No skipped levels.
- Sentence case for headings: "How to publish a hackathon", not "How To Publish A Hackathon".

### Code blocks

- Always specify a language fence:
  - `bash` for shell commands.
  - `ts` / `tsx` for TypeScript (not `typescript`).
  - `js` / `jsx` for JavaScript.
  - `yaml` for YAML.
  - `json` for JSON.
  - Use ` ``` ` with no language for output / pasted logs / ASCII diagrams.
- One-liner commands use inline backticks (`` `npm run dev` ``), not a code fence.
- Don't include the `$` prompt in shell blocks. The reader knows.

### Links

- Use descriptive link text, not "click here" or bare URLs:
  - ✅ "See the [release runbook](RELEASING.md) for details."
  - ❌ "See [this doc](RELEASING.md) for details."
  - ❌ "See https://github.com/.../RELEASING.md for details."
- Cross-repo or external URLs: use full URL; don't shorten.
- Same-repo links: use relative paths from the linking file (`../README.md` from inside `docs/`).
- When linking to a section, use the GitHub-rendered slug: `[CONTRIBUTING.md#branching-model-develop-and-main](.github/CONTRIBUTING.md#branching-model-develop-and-main)`.

### Lists

- Use `-` for unordered lists, not `*` or `+`.
- Use `1.` for ordered lists; let Markdown re-number (write every line as `1.`).
- One-line items don't need terminal punctuation; multi-line items use full sentences.

### Tables

- Right-align numbers, left-align text.
- One word per cell when possible; multi-word entries indicate a row should split or move to prose.
- Include a header row.

### Callouts

GitHub renders `> **Note:**` and `> **Warning:**` blocks well. Use sparingly.

```
> **Note:** Firestore rules are deployed automatically on push to `main`.
> Don't `firebase deploy` them by hand.
```

### Frontmatter

Top-of-file frontmatter is required only for reviews (`docs/OPENSOURCE_REVIEW.md`, `docs/DOCUMENTATION_REVIEW.md`) where `review_date`, `commit_sha`, `previous_review` matter. Most docs don't need it.

## File naming

- Top-level governance / community docs: `UPPERCASE.md` (e.g., `README.md`, `CONTRIBUTING.md`, `MAINTAINERS.md`).
- Reference / how-to docs in `docs/`: `UPPERCASE_WITH_UNDERSCORES.md` (e.g., `docs/DEVELOPMENT.md`, `docs/RELEASING.md`).
- Tutorial / explanation docs in `docs/`: `kebab-case.md` once the Phase 5.3.2 Diátaxis-folder restructure lands.
- ADRs: `NNNN-kebab-case-title.md`.

## Things to never do

1. **Don't reference future work in instructions.** "Once Sentry is shipped, errors will land in Sentry" — fine in explanation; not in a how-to ("To debug errors, check Sentry" is wrong until Sentry exists).
2. **Don't link to private channels.** Discord links are fine (public invite); Slack links are not.
3. **Don't embed secrets, even fake ones.** Use `your-api-key-here` as the placeholder, not `sk-1234567890abcdef`.
4. **Don't AI-narrate.** Don't write "Here's a doc about X" — start the doc.
5. **Don't write commit messages or PR descriptions as docs.** They belong in commit/PR metadata, not in the repo's permanent doc surface.
6. **Don't add a `Last updated: …` line manually.** Git tracks this. The one exception: long-cycle policy docs (DESIGN.md, DCO.md) where stakeholders want a visible "last reviewed" date.

## Reviewing a docs PR

When you review someone else's docs PR:

1. **Does it match its quadrant?** If it's labeled how-to but reads like reference, ask for a split.
2. **Banned words?** Search for `easy`, `just`, `simply`, `obviously` — usually drop them.
3. **Vocabulary?** Cursor vs Cursor Boston used correctly?
4. **Links work?** Use the GitHub PR preview to click through.
5. **Code blocks have language fences?**
6. **Headings sentence-cased and properly nested?**
7. **Does it duplicate content already in another doc?** Link to the canonical home instead of restating.

If you're reviewing your own doc draft, read it aloud — the cadence will tell you when adjective-inflation creeps in.

## When this guide changes

Update this file by PR like any other doc. Material changes (banned words, vocabulary, file naming) warrant a brief note in the next release CHANGELOG so existing docs can be ratcheted to the new rule.

_Last reviewed: 2026-05-18._
