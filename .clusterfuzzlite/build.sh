#!/usr/bin/env bash
# ClusterFuzzLite build script for the cursor-boston fuzz harness suite.
# Invoked by the ClusterFuzzLite base-builder image; environment variables
# OUT and SRC are provided by the base image.
set -euo pipefail

cd "$SRC/cursor-boston"

# Install only what the harnesses need. The full project's deps are
# heavy (Next.js, Firebase Admin, etc.) and ClusterFuzzLite's wall-clock
# budget is finite; the sanitize.fuzz.ts harness compiles standalone
# against jazzer.js. Versions are pinned (Scorecard Pinned-Dependencies)
# and kept on a single line so Scorecard's line-scoped parser sees the
# `@version` qualifiers alongside the `npm install` keyword.
npm install --no-audit --no-fund --no-save @jazzer.js/core@2.1.0 typescript@5.6.3

# base-builder-javascript exposes `compile_javascript_fuzzer` which knows
# how to wrap a jazzer.js harness into a libFuzzer-compatible binary at
# $OUT/<name>. Use it per fuzz target so we get the standard
# ClusterFuzzLite invocation contract.
for target in fuzz/*.fuzz.ts; do
  name="$(basename "$target" .fuzz.ts)"
  # Transpile the harness + sanitize.ts to CJS so jazzer.js can require
  # it at fuzz time (jazzer is a CJS-only runtime).
  # --skipLibCheck because tsc otherwise type-checks every transitive
  # @types/* package; @types/request references a CookieJar export that
  # tough-cookie removed and fails the build despite being unrelated to
  # the harness. We only care that the harness + lib/sanitize.ts compile.
  # --isolatedModules avoids cross-file inference that drags in those
  # same transitive types.
  npx --no-install tsc \
    --module commonjs --target es2022 --esModuleInterop \
    --skipLibCheck --isolatedModules \
    --outDir "build_${name}" \
    --rootDir . \
    "$target" lib/sanitize.ts

  compile_javascript_fuzzer cursor-boston \
    "build_${name}/fuzz/${name}.fuzz" \
    --sync
done

exit 0

