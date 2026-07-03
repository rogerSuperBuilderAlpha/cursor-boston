#!/usr/bin/env bash
set -euo pipefail

# Simulates a merged pull request webhook that closes task #3.
# Usage: ./scripts/simulate-github-merge.sh [issue_number] [port]

ISSUE_NUMBER="${1:-3}"
PORT="${2:-3001}"
PAYLOAD=$(cat <<EOF
{
  "action": "closed",
  "pull_request": {
    "merged": true,
    "title": "Implement auth flow",
    "body": "Fixes #${ISSUE_NUMBER}",
    "html_url": "https://github.com/example/repo/pull/42"
  }
}
EOF
)

curl -sS -X POST "http://localhost:${PORT}/api/webhooks/github" \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -d "${PAYLOAD}" | python3 -m json.tool

echo ""
echo "Task #${ISSUE_NUMBER} should move to Done on any open dashboard."
