# ---- Base ----
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.29.1 --activate
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/agents/package.json ./packages/agents/package.json
COPY packages/course-designer/package.json ./packages/course-designer/package.json
RUN pnpm install --frozen-lockfile

# ---- Builder ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/ ./
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_AUTH_TOKEN

# Domínio base do serviço único multi-tenant (D1). Todo host `{slug}.{este
# valor}` resolve por string, sem banco; é o que `remotePatterns` do
# next.config.ts e o middleware usam para derivar o host canônico de cada
# empresa. Ausente = o app não sabe compor host nenhum.
ARG NEXT_PUBLIC_APP_BASE_DOMAIN

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST
ENV SENTRY_ORG=$SENTRY_ORG
ENV SENTRY_PROJECT=$SENTRY_PROJECT
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN
ENV NEXT_PUBLIC_APP_BASE_DOMAIN=$NEXT_PUBLIC_APP_BASE_DOMAIN

RUN pnpm turbo run build --filter=@eximia/web

# GATE DAS ROTAS DE MARCA — o que o Next REALMENTE pré-renderizou, medido no
# artefato (D17, substitui os dois gates de marca por build-arg do D18: a
# marca agora vem do BANCO em runtime, não mais de env inlinada em build).
# O risco deixou de ser "bundle com marca errada" e passou a ser "esta rota
# saiu como HTML estático no build" — esse HTML é servido para QUALQUER host
# depois, sem olhar o tenant da requisição.
#
# A POSIÇÃO É PARTE DO CONTRATO: DEPOIS do build, nunca antes. Este gate mede
# bytes que só existem quando o `next build` termina (`.next/prerender-manifest.json`).
# Movido para cima, mediria o artefato da imagem anterior, ou nada — e "nada a
# verificar" é o resultado mais perigoso que um gate pode dar, porque some sem
# barulho.
#
# NAO NEUTRALIZE ESTA CHAMADA. `|| true`, `; true`, `|| exit 0`, `| tee log`,
# `&` no fim, ou `set +e` na mesma instrução deixam o RUN na posição certa e
# matam o veredito — o build fica verde por construção.
RUN node apps/web/scripts/verificar-rotas-de-marca-dinamicas.mjs

# ---- Runner ----
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
