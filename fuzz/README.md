# Fuzz harnesses

Coverage-guided fuzz tests for input-handling code paths. Run by
ClusterFuzzLite in CI (see `.github/workflows/fuzz.yml`) on every PR
that touches a fuzz target or the code it covers.

Why these specific targets:

- **`sanitize.fuzz.ts`** — `lib/sanitize.ts` is the single point of
  contact between untrusted user input (display names, URLs, free-text)
  and Firestore writes / link rendering. Regression in any of its regex
  paths could open XSS or ReDoS. Fuzzed for both crashes and the
  documented invariants (no control chars in output, URLs always
  resolve to a valid `http(s)`/null result, doc IDs always match the
  Firestore charset).

How to add a new target:

1. Create `fuzz/<name>.fuzz.ts` that exports `fuzz(data: Buffer)`.
2. Add the new target file to the corpus matrix in
   `.github/workflows/fuzz.yml`.
3. Add a one-line description here so future maintainers know what
   each target proves.
