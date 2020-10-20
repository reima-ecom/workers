FROM mcr.microsoft.com/vscode/devcontainers/base:0-buster

ARG VERSION=1.11.0

ENV DENO_INSTALL=/deno
RUN mkdir -p /deno \
    && curl -fsSL https://deno.land/x/install/install.sh | sh \
    && chown -R vscode /deno

ENV PATH=${DENO_INSTALL}/bin:${PATH} \
    DENO_DIR=${DENO_INSTALL}/.cache/deno

# [Optional] Uncomment this section to install additional OS packages.
# RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
#    && apt-get -y install --no-install-recommends <package list>

# Manual bin install of wrangler
RUN wget -q -O wrangler-${VERSION}.tar.gz \
    https://github.com/cloudflare/wrangler/releases/download/v${VERSION}/wrangler-v${VERSION}-x86_64-unknown-linux-musl.tar.gz \
    && tar xf wrangler-${VERSION}.tar.gz -C /usr/local/bin --strip-components=1 dist/wrangler \
    && rm wrangler-${VERSION}.tar.gz

# Install cloudflared for wrangler log tailing
ARG CLOUDFLARED_VERSION=VdrWdbjqyF
RUN wget https://bin.equinox.io/c/${CLOUDFLARED_VERSION}/cloudflared-stable-linux-amd64.deb \
    && dpkg -i cloudflared-stable-linux-amd64.deb