# ── Stage 1: Build ─────────────────────────────────────────────
FROM node:24.0.0-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install

COPY . .

RUN pnpm build

# ── Stage 2: Staging ────────────────────────────────────────
FROM node:24.0.0-alpine AS runner

ENV NODE_ENV=staging

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --prod --frozen-lockfile --ignore-scripts

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]
