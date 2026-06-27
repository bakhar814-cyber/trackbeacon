# syntax=docker/dockerfile:1
# ============================================================================
# ToonFactory — multi-stage build for the Next.js 14 app.
#
# The SAME image runs both processes:
#   • web    → `npm start`   (next start, serves the dashboard + API routes)
#   • worker → `npm run worker` (tsx src/worker/index.ts, drains the job queue)
# See docker-compose.yml for how each service overrides the command.
# ============================================================================

# ---- Stage 1: dependencies -------------------------------------------------
FROM node:20-bookworm-slim AS deps
WORKDIR /app
# Prisma needs openssl at install/generate time.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
# Use a reproducible install when a lockfile exists, fall back otherwise.
RUN npm ci || npm install

# ---- Stage 2: build --------------------------------------------------------
FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Ensure a public dir always exists so the runtime COPY below never fails.
RUN mkdir -p public
# Generate the Prisma client against the committed schema, then build Next.js.
# A dummy DATABASE_URL satisfies tooling; no DB connection is made at build time.
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV PIPELINE_MODE=mock
RUN npx prisma generate
RUN npm run build

# ---- Stage 3: runtime ------------------------------------------------------
FROM node:20-bookworm-slim AS runner
WORKDIR /app
# ffmpeg is required by the worker's video-editing stage (VIDEO_PROVIDER=ffmpeg)
# to assemble the finished MP4; openssl for Prisma, curl for healthchecks.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl ffmpeg \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Bring over the built app, deps (including the generated Prisma client),
# Prisma schema/migrations and the worker entrypoint.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json

EXPOSE 3000

# Default command runs the web server. The worker service in docker-compose.yml
# overrides this with `npm run worker`.
CMD ["npm", "start"]
