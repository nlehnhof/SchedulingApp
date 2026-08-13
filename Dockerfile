# Phase 4 (Integration) — container build for local dev parity and as an optional
# alternative to Render's native Node buildpack for production. See the "Deploying to
# Render" section of README.md for the buildpack path, which is the one actually
# verified against a live deployment.

# ---- deps: install once, reused by the build stage ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: compile the Next.js app ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `next build` needs *some* value for every env var lib/*.ts reads at import time
# (see lib/email.ts's fix for why that matters) plus network access to fetch the
# Fraunces/Inter fonts from Google Fonts — both satisfied automatically by
# docker-compose's env_file at build time. Building without real credentials still
# succeeds; the app just can't reach Supabase/Google/Resend until it's running with
# the real values from .env.local (or Render's env vars in production).
RUN npm run build

# ---- runner: minimal production image ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Standalone output (next.config.js `output: 'standalone'`) already includes a
# pruned node_modules, so nothing else needs copying in from the builder stage.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
