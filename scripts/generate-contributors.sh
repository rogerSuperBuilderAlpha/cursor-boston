#!/usr/bin/env bash
# generate-contributors.sh — Builds CONTRIBUTORS.md from merged git history.
#
# Ranks contributors by merged PR count (requires `gh` CLI).
# Falls back to commit count if `gh` is unavailable.
#
# Files used:
#   .mailmap            — deduplicates git author identities
#   .github-usernames   — maps non-noreply emails → GitHub usernames
#
# Usage:
#   bash scripts/generate-contributors.sh
#   npm run generate-contributors

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

OUT="CONTRIBUTORS.md"
USERNAMES_FILE=".github-usernames"
EXCLUDE_PATTERN="dependabot\[bot\]|noreply@anthropic\.com"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

# ── Resolve GitHub username from an email address ────────────────
github_user() {
  local email="$1"
  # 1. noreply format: 12345+username@users.noreply.github.com
  if echo "$email" | grep -q 'users.noreply.github.com'; then
    echo "$email" | sed 's/^[0-9]*+//' | sed 's/@.*//'
    return
  fi
  # 2. .github-usernames mapping file
  if [ -f "$USERNAMES_FILE" ]; then
    local user
    user=$(grep "^${email} " "$USERNAMES_FILE" 2>/dev/null | awk '{print $2}' || true)
    if [ -n "$user" ]; then
      echo "$user"
      return
    fi
  fi
  echo ""
}

# ── Step 1: Gather merged PR counts per GitHub login ─────────────
HAS_PRS=false
if command -v gh &>/dev/null && gh auth status &>/dev/null 2>&1; then
  if gh pr list --state merged --limit 1000 --json author \
       --jq '.[].author.login' 2>/dev/null \
     | grep -v '^dependabot' \
     | sort | uniq -c | sort -rn > "$TMP_DIR/pr_counts.txt" 2>/dev/null; then
    HAS_PRS=true
  fi
fi

# Helper: look up PR count for a GitHub username
pr_count_for() {
  local ghuser="$1"
  if [ "$HAS_PRS" = true ] && [ -n "$ghuser" ]; then
    local count
    count=$(grep -w "$ghuser" "$TMP_DIR/pr_counts.txt" 2>/dev/null | awk '{print $1}' || true)
    echo "${count:-0}"
  else
    echo "0"
  fi
}

# ── Step 2: Gather commit counts per author ──────────────────────
git log --no-merges --use-mailmap --format='%aN|%aE' |
  grep -Ev "$EXCLUDE_PATTERN" |
  sort | uniq -c | sort -rn > "$TMP_DIR/commit_counts.txt"

# ── Step 3: Build contributor data ───────────────────────────────
# Output: pr_count|commit_count|name|github_user|first_date
> "$TMP_DIR/contributors.txt"

while read -r line; do
  commits=$(echo "$line" | awk '{print $1}')
  rest=$(echo "$line" | awk '{$1=""; print $0}' | sed 's/^ //')
  name=$(echo "$rest" | cut -d'|' -f1)
  email=$(echo "$rest" | cut -d'|' -f2)

  first_date=$(git log --no-merges --use-mailmap --author="$email" \
    --format='%ai' --reverse 2>/dev/null | head -1 | cut -d' ' -f1)

  ghuser=$(github_user "$email")
  prs=$(pr_count_for "$ghuser")

  echo "${prs}|${commits}|${name}|${ghuser}|${first_date}" >> "$TMP_DIR/contributors.txt"
done < "$TMP_DIR/commit_counts.txt"

# ── Step 4: Sort — by merged PRs desc, then commits desc ────────
if [ "$HAS_PRS" = true ]; then
  sort -t'|' -k1,1rn -k2,2rn "$TMP_DIR/contributors.txt" > "$TMP_DIR/sorted.txt"
else
  sort -t'|' -k2,2rn "$TMP_DIR/contributors.txt" > "$TMP_DIR/sorted.txt"
fi

# ── Step 5: Generate markdown ────────────────────────────────────
total_contributors=$(wc -l < "$TMP_DIR/sorted.txt" | tr -d ' ')

if [ "$HAS_PRS" = true ]; then
  HEADER_COLS="| Avatar | Name | Merged PRs | Commits | Since |"
  HEADER_SEP="|--------|------|----------:|--------:|-------|"
else
  HEADER_COLS="| Avatar | Name | Commits | Since |"
  HEADER_SEP="|--------|------|--------:|-------|"
fi

cat > "$OUT" <<EOF
# Contributors

<!-- CONTRIBUTORS:START - Do not remove or modify this section -->

${HEADER_COLS}
${HEADER_SEP}
EOF

while IFS='|' read -r prs commits name ghuser first_date; do
  if [ -n "$ghuser" ]; then
    url="https://github.com/${ghuser}"
    avatar="<img src=\"${url}.png?size=40\" width=\"40\" height=\"40\" alt=\"@${ghuser}\" />"
    display="[${name}](${url})"
  else
    avatar=""
    display="$name"
  fi

  if [ "$HAS_PRS" = true ]; then
    echo "| ${avatar} | ${display} | ${prs} | ${commits} | ${first_date} |" >> "$OUT"
  else
    echo "| ${avatar} | ${display} | ${commits} | ${first_date} |" >> "$OUT"
  fi
done < "$TMP_DIR/sorted.txt"

cat >> "$OUT" <<EOF

<!-- CONTRIBUTORS:END -->

**${total_contributors} contributors** &middot; Ranked by merged PRs &middot; _Updated $(date -u +%Y-%m-%d)_

---

Auto-generated from git history on every merge to \`main\`. To regenerate locally: \`bash scripts/generate-contributors.sh\`

To fix a name or merge duplicates, edit \`.mailmap\`. To add a GitHub username, edit \`.github-usernames\`.
EOF

echo "Wrote ${total_contributors} contributors to $OUT (PRs: $HAS_PRS)"
