# Pinned by digest for supply-chain integrity (OpenSSF Scorecard
# Pinned-Dependencies). The ClusterFuzzLite base image carries the
# fuzzing toolchain (libFuzzer + AFL++ wrappers) we layer Node.js on top
# of in build.sh.
FROM gcr.io/oss-fuzz-base/base-builder-jvm@sha256:6dca54a0c8b7c9bafe7e4b1d8f547cae8a9d2cf2afe85bd0e1f54f2e5aa46128

# Install Node.js 22.x and npm so jazzer.js can be installed by build.sh.
# Pinned to a specific NodeSource setup script revision via the apt cache
# rather than the rolling `setup_22.x` to satisfy Scorecard's
# Pinned-Dependencies check.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates curl gnupg && \
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | \
      gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
      > /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR $SRC
COPY . $SRC/cursor-boston
WORKDIR $SRC/cursor-boston

COPY .clusterfuzzlite/build.sh $SRC/build.sh
