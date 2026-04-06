#!/usr/bin/env sh
# Vercel "Ignored Build Step": exit 0 = skip/cancel this deployment, exit 1 = run the build.
# https://vercel.com/docs/builds/ignored-build-step
#
# Goal: only run a real build for **production** deployments on **main** (merge to production).
# All preview deployments (PRs, pushes to develop/feature branches) are skipped.
#
# Also configure `git.deploymentEnabled` in vercel.json so non-main branches do not queue deploys
# by default (see docs/VERCEL.md).
#
# System env: https://vercel.com/docs/environment-variables/system-environment-variables

ref="${VERCEL_GIT_COMMIT_REF:-}"
env="${VERCEL_ENV:-}"

# Anything that is not the production branch: do not build.
if [ "$ref" != "main" ]; then
  exit 0
fi

# On main: still skip **preview** deployments (e.g. GitHub PR previews). Only **production** runs.
if [ "$env" = "preview" ]; then
  exit 0
fi

# Production deployment to main (or legacy runs where VERCEL_ENV is unset)
exit 1
