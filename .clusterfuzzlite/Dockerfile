# Pinned by digest for supply-chain integrity (OpenSSF Scorecard
# Pinned-Dependencies). The base-builder-javascript image carries the
# fuzzing toolchain (libFuzzer wrappers + Node.js) — it's the official
# ClusterFuzzLite base for JS projects and saves us from layering
# Node.js ourselves.
FROM gcr.io/oss-fuzz-base/base-builder-javascript@sha256:d7e4afe145a0898074facc5a44f2519e7c668dfb4a97f03615aa4a1126bf0979

WORKDIR $SRC
COPY . $SRC/cursor-boston
WORKDIR $SRC/cursor-boston

COPY .clusterfuzzlite/build.sh $SRC/build.sh
