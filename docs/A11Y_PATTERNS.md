# Client island accessibility patterns

Diátaxis: How-to guide.

Use this guide when you add or edit a `"use client"` component with search,
filters, status chips, badges, progress indicators, or other interactive UI.
It captures the patterns tracked in #1401 and #1402 so new client islands do
not need a separate accessibility pass after review.

## When this guide applies

Apply these patterns when a component:

- filters or sorts visible records on the client
- renders a result count or no-results state after interaction
- has a reset or clear action that changes several controls at once
- uses color to show status, progress, or completion
- draws a custom control where a native control would work

Prefer native controls first. Use custom listboxes, menus, toggle groups, and
roving-tabindex widgets only when the design requires behavior that a native
`<select>`, checkbox, radio group, or button cannot provide.

## Pattern 1: Announce result counts and no-results states

Filter islands such as roadmap and opportunity lists change visible results
without a page navigation. Add a polite, atomic status region near the filters
so screen reader users hear the new count without being interrupted.

```tsx
<p
  aria-atomic="true"
  aria-live="polite"
  className="mt-2 text-sm text-neutral-600 dark:text-neutral-400"
  role="status"
>
  Showing {resultCount} of {totalCount} roadmap ideas.
</p>
```

Use `polite` because a count update is useful context, not an error or blocking
alert. Use `aria-atomic="true"` so the whole sentence is announced when the
numbers change.

If the current filters return no results, the empty state also needs status
semantics:

```tsx
{resultCount === 0 && (
  <div
    aria-atomic="true"
    aria-live="polite"
    className="rounded-lg border border-dashed p-8 text-center"
    role="status"
  >
    <p className="font-medium">No roadmap ideas match those filters.</p>
    <p className="mt-2 text-sm text-neutral-600">
      Reset filters or try a broader search.
    </p>
  </div>
)}
```

Test the semantics and the copy that changes:

```tsx
expect(screen.getByText(/Showing 2 of 8 roadmap ideas/i)).toHaveAttribute(
  "role",
  "status"
);

expect(
  screen.getByText(/No roadmap ideas match those filters/i)
).toBeInTheDocument();
```

## Pattern 2: Return focus after reset

Reset buttons often clear search text, selects, and derived lists together. Do
not leave focus on a button that no longer explains the updated context. Return
focus to the primary search field after state has been cleared.

```tsx
const searchInputRef = useRef<HTMLInputElement>(null);

const resetFilters = () => {
  setQuery("");
  setCategory("all");
  setDifficulty("all");
  requestAnimationFrame(() => searchInputRef.current?.focus());
};

return (
  <input
    id={searchInputId}
    ref={searchInputRef}
    value={query}
    onChange={(event) => setQuery(event.target.value)}
  />
);
```

`requestAnimationFrame` waits for React to commit the cleared input value before
moving focus. Use the most useful starting control for the island; for search
and filter panels, that is usually the search input.

Test focus with `userEvent`:

```tsx
const user = userEvent.setup();
const searchInput = screen.getByLabelText(/Search roadmap ideas/i);

await user.type(searchInput, "design");
await user.click(screen.getByRole("button", { name: /Reset filters/i }));

await waitFor(() => expect(searchInput).toHaveFocus());
```

## Pattern 3: Do not rely on color for status

WCAG 2.1 SC 1.4.1 requires information to be available without color. Status
chips and badges need visible text or an icon in addition to color. The Skills
Passport badge pattern uses all three:

- visible status text, such as `Earned` or `In progress`
- a decorative icon that supports quick scanning
- an `aria-label` that combines the badge name and state

```tsx
const stateLabel = earned ? "Earned" : "In progress";

<span
  aria-label={`${badge.name}: ${stateLabel}`}
  className={cn(
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
    earned
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
      : "border-neutral-200 bg-neutral-50 text-neutral-600"
  )}
>
  {earned ? (
    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
  ) : (
    <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />
  )}
  <span>{badge.name}</span>
  <span className="text-[10px] font-semibold">{stateLabel}</span>
</span>
```

Keep icons `aria-hidden` when the text and label already communicate the state.
That avoids duplicate announcements such as "check circle Earned".

Test both visible and programmatic state:

```tsx
expect(screen.getByText("Earned")).toBeInTheDocument();
expect(screen.getByLabelText(/First PR: Earned/i)).toBeInTheDocument();
expect(screen.getByLabelText(/Review helper: In progress/i)).toBeInTheDocument();
```

## Pattern 4: Add contextual text to progress bars

`aria-valuenow` gives the numeric value. Add `aria-valuetext` when the number
needs units or context to make sense on its own.

```tsx
function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div
      aria-label={`${label} progress`}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={value}
      aria-valuetext={`${value}% complete`}
      className="h-2 overflow-hidden rounded-full bg-neutral-200"
      role="progressbar"
    >
      <div
        className="h-full rounded-full bg-emerald-600"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}
```

Test the accessible name and value:

```tsx
expect(screen.getByRole("progressbar", { name: /AI fundamentals progress/i }))
  .toHaveAttribute("aria-valuetext", "75% complete");
```

## Pattern 5: Use native controls before custom controls

A native `<select>` already gives keyboard support, focus behavior, and expected
screen reader semantics. Use it for category, difficulty, type, and work-mode
filters unless the design needs multi-select or rich option content.

```tsx
<label htmlFor={categorySelectId} className="relative block">
  <span className="sr-only">Filter by category</span>
  <SlidersHorizontal aria-hidden="true" className="pointer-events-none" />
  <select
    id={categorySelectId}
    value={category}
    onChange={(event) => setCategory(event.target.value)}
  >
    <option value="all">All categories</option>
    <option value="content">Content</option>
  </select>
</label>
```

If you build a custom listbox or toggle group, include keyboard behavior in the
same PR. Tab-only navigation is not enough for a widget that visually behaves
like a single composite control.

## Testing checklist

Before review, add focused Testing Library coverage for each changed island:

- Inputs and selects have labels reachable by `getByLabelText`.
- Result counts or empty states expose `role="status"` with polite, atomic
  announcements.
- Reset actions return focus to the primary control with `toHaveFocus()`.
- Status chips expose visible non-color text and an accessible name.
- Progress indicators have `role="progressbar"`, numeric values, and contextual
  `aria-valuetext` when the raw number is ambiguous.
- Decorative Lucide icons use `aria-hidden="true"`.
- Native controls stay native unless a custom widget includes keyboard tests.

Keep tests scoped to user-observable behavior. Do not snapshot Tailwind class
strings for accessibility changes unless the class itself creates visible,
non-color state.
