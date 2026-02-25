FROM mcr.microsoft.com/devcontainers/base:noble

RUN useradd --shell /bin/bash --create-home coder || true \
    && echo "coder ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/coder \
    && chmod 0440 /etc/sudoers.d/coder

# Install Node.js
RUN apt-get update && apt-get install -y curl \
    && curl -sL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@latest

# Install other utilities and GitHub CLI
RUN apt-get update && apt-get install -y \
    git \
    ssh-client \
    openssh-client \
    iproute2 \
    net-tools \
    iputils-ping \
    gh \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y \
    libasound2-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Create services directory
RUN mkdir -p /workspaces/services && chown coder:coder /workspaces/services

COPY ./scripts/setup-desktop.sh /usr/local/bin/setup-desktop.sh
RUN chmod +x /usr/local/bin/setup-desktop.sh

COPY ./scripts/start-desktop.sh /usr/local/bin/start-desktop.sh

COPY ./scripts/setup-git.sh /usr/local/bin/setup-git.sh
RUN chmod +x /usr/local/bin/setup-git.sh

COPY ./scripts/setup-dev.sh /usr/local/bin/setup-dev.sh
RUN chmod +x /usr/local/bin/setup-dev.sh

COPY ./scripts/post-setup.sh /usr/local/bin/post-setup.sh
RUN chmod +x /usr/local/bin/post-setup.sh

USER coder