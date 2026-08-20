# ---- Base ----
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.11.0 --activate
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
ARG NEXT_PUBLIC_BLUEPRINT_MICROSERVICE_URL
ARG SENTRY_ORG
ARG SENTRY_PROJECT
ARG SENTRY_AUTH_TOKEN

# ---- Marca do cliente (white-label) ----------------------------------------
# A identidade visual e de tenant sai do GIT e passa a entrar por AQUI.
# Build sem nenhuma delas = build NEUTRO (eximIA Academy), byte a byte igual
# ao que `main` produzia antes desta mudanca. Ver apps/web/tenant.config.ts.
#
# Precisam ser NEXT_PUBLIC_* porque `workspace-picker.tsx` e "use client" e
# importa `@/lib/tenant`: a config viaja para o bundle do navegador, e so
# `NEXT_PUBLIC_*` sobrevive ao inline do Next.
ARG NEXT_PUBLIC_TENANT_SLUG
ARG NEXT_PUBLIC_TENANT_NAME
ARG NEXT_PUBLIC_TENANT_LOGO
ARG NEXT_PUBLIC_TENANT_LOGO_LIGHT
ARG NEXT_PUBLIC_TENANT_FAVICON
ARG NEXT_PUBLIC_TENANT_PRIMARY_COLOR
ARG NEXT_PUBLIC_TENANT_ACCENT_COLOR
ARG NEXT_PUBLIC_TENANT_MODULES
ARG NEXT_PUBLIC_TENANT_PARTNER_NAME
ARG NEXT_PUBLIC_TENANT_PARTNER_LOGO
ARG NEXT_PUBLIC_TENANT_FOOTER_TEXT
ARG NEXT_PUBLIC_TENANT_SUPPORT_EMAIL
ARG NEXT_PUBLIC_TENANT_ORG_TREE
ARG NEXT_PUBLIC_TENANT_MAX_INTERACTIONS
ARG NEXT_PUBLIC_TENANT_SESSION_TIMEOUT_HOURS
# Ancora opcional: se preenchida, o verificador reprova o build cujo slug
# divergir dela. Serve para o servico do cliente travar a propria identidade.
ARG MARCA_ESPERADA_SLUG

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST
ENV NEXT_PUBLIC_BLUEPRINT_MICROSERVICE_URL=$NEXT_PUBLIC_BLUEPRINT_MICROSERVICE_URL
ENV SENTRY_ORG=$SENTRY_ORG
ENV SENTRY_PROJECT=$SENTRY_PROJECT
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN

ENV NEXT_PUBLIC_TENANT_SLUG=$NEXT_PUBLIC_TENANT_SLUG
ENV NEXT_PUBLIC_TENANT_NAME=$NEXT_PUBLIC_TENANT_NAME
ENV NEXT_PUBLIC_TENANT_LOGO=$NEXT_PUBLIC_TENANT_LOGO
ENV NEXT_PUBLIC_TENANT_LOGO_LIGHT=$NEXT_PUBLIC_TENANT_LOGO_LIGHT
ENV NEXT_PUBLIC_TENANT_FAVICON=$NEXT_PUBLIC_TENANT_FAVICON
ENV NEXT_PUBLIC_TENANT_PRIMARY_COLOR=$NEXT_PUBLIC_TENANT_PRIMARY_COLOR
ENV NEXT_PUBLIC_TENANT_ACCENT_COLOR=$NEXT_PUBLIC_TENANT_ACCENT_COLOR
ENV NEXT_PUBLIC_TENANT_MODULES=$NEXT_PUBLIC_TENANT_MODULES
ENV NEXT_PUBLIC_TENANT_PARTNER_NAME=$NEXT_PUBLIC_TENANT_PARTNER_NAME
ENV NEXT_PUBLIC_TENANT_PARTNER_LOGO=$NEXT_PUBLIC_TENANT_PARTNER_LOGO
ENV NEXT_PUBLIC_TENANT_FOOTER_TEXT=$NEXT_PUBLIC_TENANT_FOOTER_TEXT
ENV NEXT_PUBLIC_TENANT_SUPPORT_EMAIL=$NEXT_PUBLIC_TENANT_SUPPORT_EMAIL
ENV NEXT_PUBLIC_TENANT_ORG_TREE=$NEXT_PUBLIC_TENANT_ORG_TREE
ENV NEXT_PUBLIC_TENANT_MAX_INTERACTIONS=$NEXT_PUBLIC_TENANT_MAX_INTERACTIONS
ENV NEXT_PUBLIC_TENANT_SESSION_TIMEOUT_HOURS=$NEXT_PUBLIC_TENANT_SESSION_TIMEOUT_HOURS
ENV MARCA_ESPERADA_SLUG=$MARCA_ESPERADA_SLUG

# GATE DA MARCA — roda ANTES do build, nunca dentro dele.
# `tenant.config.ts` NUNCA lanca (ele e lido pelo bundle do navegador; um throw
# la cairia em tempo de REQUISICAO e derrubaria producao). Quem reprova e este
# verificador: um exit != 0 aqui so pode derrubar o BUILD. O estado que ele
# impede nao e "sem marca" nem "com marca", e a MARCA PELA METADE — slug do
# cliente com nome/logo neutros, que faz a telemetria atribuir ao tenant certo
# enquanto a tela mostra a marca errada.
RUN node apps/web/scripts/verificar-marca.mjs

RUN pnpm turbo run build --filter=@eximia/web

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
