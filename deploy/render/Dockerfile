# Single-container image for Render. The C++ API listens on 127.0.0.1 inside the container and the
# Next.js server is the only public process, bound to Render's $PORT.
# Build context: the repository root.   docker build -f deploy/render/Dockerfile .

FROM debian:bookworm-slim AS native
RUN apt-get update && apt-get install -y --no-install-recommends cmake ninja-build g++ libpq-dev libssl-dev \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY CMakeLists.txt .
COPY services/core services/core
# One compile job at a time keeps peak memory low on small build machines.
RUN cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release \
    && cmake --build build --parallel 1 \
    && ctest --test-dir build --output-on-failure

FROM node:24-bookworm-slim AS web
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:24-bookworm-slim
# ca-certificates lets libpq verify the database server when sslmode is verify-ca or verify-full.
RUN apt-get update && apt-get install -y --no-install-recommends libpq5 libssl3 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=native /src/build/services/core/credwise /usr/local/bin/credwise
COPY --from=web --chown=node:node /app /app
COPY database database
COPY scripts/seed-demo.mjs scripts/seed-demo-extras.mjs scripts/
COPY tests/helpers.mjs tests/helpers.mjs
COPY deploy/render/entrypoint.sh deploy/render/entrypoint.sh
RUN sed -i 's/\r$//' deploy/render/entrypoint.sh && chmod +x deploy/render/entrypoint.sh
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    COOKIE_SECURE=1 \
    PORT=10000
EXPOSE 10000
USER node
CMD ["/app/deploy/render/entrypoint.sh"]
