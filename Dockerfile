# LensAI engine — capture + derive + agent API as ONE always-on service.
# (The Next.js web app is deployed separately; this image never builds it.)
FROM node:24-bookworm-slim

# Node 24 is REQUIRED: better-sqlite3's binary is ABI-locked to it (see the spec).
# Build tools are only a fallback for when no prebuilt addon matches.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates wget python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

# Litestream: continuous off-box replication of the corpus. The corpus cannot be
# rebuilt retroactively, so a platform volume alone is not an acceptable backup.
ARG LITESTREAM_VERSION=0.3.13
RUN wget -qO /tmp/litestream.deb "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-v${LITESTREAM_VERSION}-linux-amd64.deb" \
 && dpkg -i /tmp/litestream.deb \
 && rm /tmp/litestream.deb

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY config ./config
COPY db ./db
COPY scripts ./scripts
COPY src/lib ./src/lib
COPY deploy/start.sh deploy/litestream.railway.yml ./deploy/
RUN chmod +x deploy/start.sh

ENV NODE_ENV=production \
    CAPTURE_DB_PATH=/data/capture.db
EXPOSE 8788
CMD ["./deploy/start.sh"]
