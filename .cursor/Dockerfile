# Cloud Agent base image: Ubuntu (required for Cursor Computer Use with Dockerfiles).
# Do not COPY the project — Cursor checks out the workspace separately.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    git \
    gnupg \
    openjdk-21-jdk-headless \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Node.js 22.x (includes npm), matching package.json engines.
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

########################################################
# Docker (Cursor Cloud Agent — nested Docker)
########################################################
RUN install -m 0755 -d /etc/apt/keyrings && \
    curl --retry 3 --retry-delay 5 -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg && \
    chmod a+r /etc/apt/keyrings/docker.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null && \
    apt-get update && \
    apt-get install -y \
    docker-ce=5:28.* \
    docker-ce-cli=5:28.* \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y --no-install-recommends \
    fuse-overlayfs \
    iptables \
    && mkdir -p /etc/docker \
    && printf '%s\n' '{' \
    '  "storage-driver": "fuse-overlayfs"' \
    '}' > /etc/docker/daemon.json \
    && update-alternatives --set iptables /usr/sbin/iptables-legacy \
    && update-alternatives --set ip6tables /usr/sbin/ip6tables-legacy \
    && rm -rf /var/lib/apt/lists/*

########################################################
# gitleaks
########################################################
ARG GITLEAKS_VERSION=8.24.3
ARG TARGETARCH=amd64
RUN set -eux; \
    case "$TARGETARCH" in \
      amd64) GITLEAKS_ARCH=x64 ;; \
      arm64) GITLEAKS_ARCH=arm64 ;; \
      *) echo "unsupported TARGETARCH=$TARGETARCH" >&2; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_${GITLEAKS_ARCH}.tar.gz" \
 | tar -xzv -C /usr/local/bin gitleaks

########################################################
# Firebase CLI (global)
########################################################
RUN npm install -g firebase-tools

########################################################
# ubuntu user (matches Cursor Cloud Agent Docker docs)
########################################################
RUN mkdir -p /etc/ssh/sshd_config.d && \
    printf '%s\n' \
      'PasswordAuthentication no' \
      'ChallengeResponseAuthentication no' \
      'UsePAM no' \
      > /etc/ssh/sshd_config.d/disable_password_auth.conf && \
    (id -u ubuntu &>/dev/null || useradd -m -s /bin/bash ubuntu) && \
    groupadd -f docker && usermod -aG docker ubuntu && \
    usermod -aG sudo ubuntu && \
    echo "ubuntu ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/ubuntu && \
    echo "ubuntu:ubuntu" | chpasswd

RUN JAVA_HOME="$(dirname "$(dirname "$(readlink -f "$(command -v java)")")")" && \
    printf 'JAVA_HOME=%s\n' "$JAVA_HOME" >> /etc/environment && \
    printf 'export JAVA_HOME=%s\n' "$JAVA_HOME" > /etc/profile.d/java-home.sh
