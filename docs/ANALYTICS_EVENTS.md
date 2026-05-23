# Analytics Event Taxonomy

Cursor Boston uses Firebase Analytics for lightweight product instrumentation.
Client code should emit events through `lib/analytics.ts` so unsupported
environments, missing Firebase Analytics support, and unsafe properties are
handled consistently.

## Property Rules

- Do not send email addresses, user ids, display names, phone numbers, tokens,
  or raw free-form user input.
- Prefer stable surface names, route paths, event ids, issue numbers, counts,
  and boolean state.
- Keep strings short. The shared helper truncates string properties at 120
  characters and drops PII-shaped keys.

## Events

| Event | Trigger | Required properties | Notes |
| --- | --- | --- | --- |
| `feature_banner_view` | A `NeedsWorkBanner` renders. | `area`, `path` | Tracks contributor-improvement banner exposure. |
| `feature_banner_cta_click` | A `NeedsWorkBanner` link is clicked. | `area`, `path`, `cta` | `cta` is one of `open_source_roadmap`, `edit_github`, `open_issue`, `browse_repo`. |
| `sign_in_cta_click` | A signed-out user clicks a sign-in CTA. | `surface`, `cta` | Hackathon signup pages also include `event_id`. |
| `sign_up_cta_click` | A signed-out user clicks a create-account CTA. | `surface`, `cta` | Hackathon signup pages also include `event_id`. |
| `issue_claimed` | PR Studio successfully launches a run from a GitHub issue. | `source`, `issue_number`, `label_count` | Does not include issue title, body, user id, or user input. |

## Instrumented Surfaces

- `components/NeedsWorkBanner.tsx`: banner view plus four contributor CTAs.
- `app/hackathons/hack-a-sprint-2026/signup/page.tsx`: sign-in and create-account CTAs.
- `app/hackathons/sports-hack-2026/signup/page.tsx`: sign-in and create-account CTAs.
- `app/pr-ideas/_hooks/useIdeaRuns.ts`: successful issue-backed PR Studio launch.
