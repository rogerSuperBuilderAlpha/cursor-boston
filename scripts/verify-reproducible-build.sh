#!/usr/bin/env bash
#
# Verify that `npm run build` produces byte-identical output across two
# consecutive runs at the same commit. OpenSSF Best Practices Gold
# criterion `build_reproducible` requires this.
#
# Usage:
#   bash scripts/verify-reproducible-build.sh
#
# Strategy:
#   1. Build twice into separate output directories (.next-1 / .next-2).
#   2. Diff the build artifacts that matter for "is this the same app":
#      .next/BUILD_ID, .next/server/, .next/static/.
#   3. Document the known irreducibles that this script ignores
#      (see docs/REPRODUCIBLE_BUILD.md).
#
# Exit codes:
#   0 — builds match (modulo documented irreducibles)
#   1 — builds differ in a way that breaks reproducibility
#   2 — build itself failed (compile error)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

OUT1=".next-1"
OUT2=".next-2"
TMP_NEXT=".next"

cleanup() {
  rm -rf "$OUT1" "$OUT2" "$TMP_NEXT" .next-saved
}
trap cleanup EXIT

cleanup

# Seed Next.js's per-build secrets so two builds at the same commit produce
# byte-identical output. In production each deploy gets fresh values by
# design — this seeding is only for the reproducibility test.
export NEXT_TELEMETRY_DISABLED=1
export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="${NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=}"
export __NEXT_PREVIEW_MODE_ID="${__NEXT_PREVIEW_MODE_ID:-00000000000000000000000000000000}"
export __NEXT_PREVIEW_MODE_SIGNING_KEY="${__NEXT_PREVIEW_MODE_SIGNING_KEY:-0000000000000000000000000000000000000000000000000000000000000000}"
export __NEXT_PREVIEW_MODE_ENCRYPTION_KEY="${__NEXT_PREVIEW_MODE_ENCRYPTION_KEY:-0000000000000000000000000000000000000000000000000000000000000000}"
# SOURCE_DATE_EPOCH anchors any "now()"-style timestamps to the HEAD commit.
SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-$(git log -1 --format=%ct HEAD 2>/dev/null || echo 1700000000)}"
export SOURCE_DATE_EPOCH

echo "==> Build 1/2"
npm run build > /dev/null || exit 2
mv "$TMP_NEXT" "$OUT1"

echo "==> Build 2/2"
npm run build > /dev/null || exit 2
mv "$TMP_NEXT" "$OUT2"

echo "==> Diffing"
# Hard gate on deterministic deploy artifacts:
#   - BUILD_ID (commit-derived)
#   - static JS chunks
#   - server JS chunks
CORE_DIFF=""
if ! cmp -s "$OUT1/BUILD_ID" "$OUT2/BUILD_ID"; then
  CORE_DIFF="${CORE_DIFF}diff -r ${OUT1}/BUILD_ID ${OUT2}/BUILD_ID"$'\n'
fi

STATIC_CHUNK_DIFF=$(
  diff -r "$OUT1/static/chunks" "$OUT2/static/chunks" 2>&1 || true
)
if [ -n "$STATIC_CHUNK_DIFF" ]; then
  CORE_DIFF="${CORE_DIFF}${STATIC_CHUNK_DIFF}"$'\n'
fi

SERVER_CHUNK_DIFF=$(
  diff -r "$OUT1/server/chunks" "$OUT2/server/chunks" 2>&1 || true
)
if [ -n "$SERVER_CHUNK_DIFF" ]; then
  CORE_DIFF="${CORE_DIFF}${SERVER_CHUNK_DIFF}"$'\n'
fi

if [ -n "$CORE_DIFF" ]; then
  echo "::error::Deterministic build artifacts differ (BUILD_ID or chunk outputs)."
  sed -n '1,80p' <<<"$CORE_DIFF"
  exit 1
fi

# Report the broader tree diff as warning-only because Next.js 16 injects
# per-build security secrets and route-manifest ordering differences into
# generated app/server outputs (documented in docs/REPRODUCIBLE_BUILD.md).
DIFF=$(
  diff -r \
    --exclude='*.map' \
    --exclude='trace' \
    --exclude='trace-build' \
    --exclude='*.nft.json' \
    --exclude='webpack-stats*.json' \
    --exclude='cache' \
    --exclude='package.json' \
    "$OUT1" "$OUT2" 2>&1 || true
)

if [ -n "$DIFF" ]; then
  echo "::warning::Build output differs in known volatile Next.js artifacts (see docs/REPRODUCIBLE_BUILD.md):"
  # Avoid SIGPIPE exit 141 under `set -o pipefail` when truncating long diff output.
  sed -n '1,30p' <<<"$DIFF"
  DIFF_LINES=$(echo "$DIFF" | wc -l)
  if [ "$DIFF_LINES" -gt 30 ]; then
    echo "...(${DIFF_LINES} total diff lines)"
  fi
  ONLY_IN=$(echo "$DIFF" | grep -c "^Only in" || true)
  REAL_DIFF=$(echo "$DIFF" | grep -c "^diff -r" || true)
  echo "==> Warning summary: ${ONLY_IN} added/removed files, ${REAL_DIFF} content diffs"
fi

echo "==> OK — deterministic deploy artifacts are byte-identical"
