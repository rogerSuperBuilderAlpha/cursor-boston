# Adding content via pull request

Several pages on cursorboston.com are backed by plain files in the repo — no database, no admin tools. If you see something missing or want to share something, you can add it yourself by opening a pull request.

This doc covers the three PR-based content flows:

- **Blog posts** → markdown in `content/blog/`
- **Opportunities** (jobs, co-founder roles) → entries in `content/opportunities.json`
- **Ecosystem entries** (universities, accelerators, AI orgs, VCs in the Mass tech scene) → entries in `content/ecosystem.json`

Not sure how to open a pull request? Start with [docs/FIRST_CONTRIBUTION.md](FIRST_CONTRIBUTION.md). Every PR follows the same fork → branch → commit → push → PR flow.

All PRs target the `develop` branch.

---

## Add a blog post

Blog posts are Markdown files in `content/blog/`. The filename becomes the slug.

**Steps:**

1. Create a file at `content/blog/your-post-slug.md`.
2. Start with YAML frontmatter, then your post body:

   ```markdown
   ---
   title: "How I Shipped a Feature in One Night With Cursor"
   date: "2026-04-20"
   author: "Jane Doe"
   excerpt: "A short teaser shown on the blog index (1–2 sentences)."
   ---

   Your post body here. Markdown is fine — headings, lists, code blocks, links, images.
   ```

3. Commit, push your fork, open a PR against `develop` with title `blog: add "your title"`.

**Tips:**

- Keep the excerpt under ~160 characters so it fits on the blog index cleanly.
- Use the repo's existing `welcome-to-cursor-boston.md` as a reference.
- Images live in `public/blog/` and are referenced as `/blog/your-image.png`.

---

## Add an opportunity

Opportunities (jobs, co-founder roles, contracts, internships) are entries in `content/opportunities.json`.

**Steps:**

1. Open `content/opportunities.json`.
2. Add a new entry to the `opportunities` array, copying an existing entry as a template. Required fields:

   ```json
   {
     "id": "unique-slug-here",
     "slug": "unique-slug-here",
     "title": "Senior Full-Stack Engineer",
     "company": "Example Co.",
     "type": "full-time",
     "compensation": "$150k–$200k + equity",
     "location": "Boston, MA",
     "remote": "Hybrid",
     "postedDate": "2026-04-20",
     "description": "1–3 sentence pitch for the role.",
     "aboutCompany": "1–2 sentences on the company.",
     "tags": ["React", "TypeScript", "AI"],
     "contactEmail": "jobs@example.com",
     "applyUrl": "https://example.com/jobs/123"
   }
   ```

3. Valid `type` values: `co-founder`, `full-time`, `contract`, `internship`.
4. Commit, push, open a PR against `develop` with title `opportunities: add <role> at <company>`.

**Tips:**

- Keep descriptions honest and short. No marketing fluff.
- Use `postedDate` in `YYYY-MM-DD` format so sorting works.
- If you don't have a public `applyUrl`, an `contactEmail` is enough.

---

## Add an ecosystem entry

The `/ecosystem` page lists universities, accelerators, AI orgs, VCs, and research labs across the Massachusetts tech scene. Data lives in `content/ecosystem.json`.

**Steps:**

1. Open `content/ecosystem.json`.
2. Add a new entry to the `entries` array:

   ```json
   {
     "id": "maic",
     "name": "MAIC",
     "fullName": "Massachusetts AI Consortium",
     "category": "ai_org",
     "location": "Boston, MA",
     "website": "https://maic.ai",
     "description": "1–2 sentences on what they do and why they matter.",
     "tags": ["AI", "policy", "community"]
   }
   ```

3. Valid `category` values: `university`, `accelerator`, `ai_org`, `vc`, `research_lab`, `nonprofit`.
4. Commit, push, open a PR against `develop` with title `ecosystem: add <name>`.

**Tips:**

- Prefer the official name in `fullName` and a short handle in `name`.
- Descriptions should be concise and factual — this is a directory, not editorial.
- Keep the list Massachusetts-focused. Out-of-state orgs without a significant local presence are out of scope.

---

## Not sure where your contribution fits?

Open an issue describing what you want to add and we'll help you figure out the right flow. Or ping us in Discord (`#contributors`).
