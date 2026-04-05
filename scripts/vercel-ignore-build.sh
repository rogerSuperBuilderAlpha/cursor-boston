#!/usr/bin/env sh
# Vercel "Ignored Build Step": exit 0 = skip/cancel this deployment, exit 1 = run the build.
# https://vercel.com/docs/project-configuration/git-settings#ignored-build-step
#
# Goal: only deploy from `main` (production). No preview deployments from develop, Dependabot,
# or contributor/feature branches.
#
# To also allow previews for `develop`, change the condition to include that ref.

ref="${VERCEL_GIT_COMMIT_REF:-}"
if [ "$ref" = "main" ]; then
  exit 1
fi
exit 0
