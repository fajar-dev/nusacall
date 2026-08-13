FROM node:22-alpine AS base
RUN corepack enable && apk add --no-cache tini
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/web/package.json apps/web/
COPY packages/ packages/
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS development
COPY . .
EXPOSE 3001 9229
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["pnpm", "--filter", "backend", "dev"]

FROM deps AS build
COPY . .
RUN pnpm --filter backend build

FROM node:22-alpine AS production
RUN apk add --no-cache tini && addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/apps/backend ./apps/backend
COPY --from=build --chown=app:app /app/packages ./packages
COPY --from=build --chown=app:app /app/package.json ./package.json
WORKDIR /app/apps/backend
USER app
ENV NODE_ENV=production APP_ROLE=api
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npx", "tsx", "src/main.ts"]
