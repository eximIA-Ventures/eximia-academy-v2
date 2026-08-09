# Plano de Correções Técnicas — eximIA Academy

> Gerado: 2026-05-17 | Fonte: Análise completa + Red Team J.A.R.V.I.S.
> Status: APROVAÇÃO PENDENTE
> Escopo: 4 waves, 23 correções, ~45h estimadas

---

## Sumário Executivo

| Wave | Foco | Itens | Esforço | Timeline |
|:---|:---|:---|:---|:---|
| 1 | Observabilidade (CRÍTICO) | 5 | ~5h | Imediato |
| 2 | Arquitetura & Data | 6 | ~14h | Semana 1-2 |
| 3 | Engagement & UX | 7 | ~16h | Semana 3-4 |
| 4 | Escala & Enterprise | 5 | ~10h | Mês 2 |

---

## WAVE 1 — OBSERVABILIDADE (Crítico, Bloqueia Tudo)

> Sem dados, todas as outras decisões são chute. Esta wave é pré-requisito.

### 1.1 Configurar PostHog no Deploy

**Problema:** PostHog SDK implementado corretamente (`posthog-provider.tsx`, `analytics.ts`, `analytics-server.ts`) mas `NEXT_PUBLIC_POSTHOG_KEY` NÃO está configurada no EasyPanel. Zero eventos em 90 dias.

**Fix:**
```bash
# No EasyPanel → App → Environment Variables, adicionar:
NEXT_PUBLIC_POSTHOG_KEY=phc_XXXXXXX        # Project API Key (do PostHog Cloud)
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
POSTHOG_API_KEY=phx_XXXXXXX                # Server-side key (para analytics-server.ts)
```

**Verificação:** Após deploy, abrir DevTools → Network → filtrar "us.i.posthog.com". Deve ver requests de `$pageview`.

**Arquivos:** Nenhuma alteração de código. Apenas env vars no deploy.
**Esforço:** 15 min
**Risco:** Zero (código já está pronto)

---

### 1.2 Verificar Projeto PostHog Correto

**Problema:** O projeto PostHog "Default project" (id: 398221) em "exímIA Ventures" está vazio. Pode ser que a API key aponte para outro projeto, ou que o projeto nunca foi configurado.

**Fix:**
1. Login em PostHog → Settings → Project API Key
2. Confirmar que a key usada no deploy corresponde ao projeto "Default project" (ou criar projeto dedicado "eximIA Academy")
3. Se precisar criar projeto novo: PostHog → Organization → Create Project → "eximIA Academy"
4. Copiar a nova key para o EasyPanel

**Esforço:** 15 min
**Dependência:** Nenhuma

---

### 1.3 Adicionar Tracking de Login e Atividade

**Problema:** O `analytics.ts` atual cobre course lifecycle e sessions, mas falta tracking de:
- Login (para medir DAU/WAU/MAU)
- Navegação em features (quais páginas são visitadas)
- Erros do usuário (form validation failures, timeouts)

**Fix:** Extender `apps/web/src/lib/analytics.ts`:

```typescript
// Adicionar ao analytics object:

// Auth
loggedIn: (role: string, tenantId: string) =>
  safeCapture("logged_in", { role, tenant_id: tenantId }),

// Feature usage (para medir adoção)
featureViewed: (feature: string) =>
  safeCapture("feature_viewed", { feature }),

// Errors
clientError: (error: string, context: string) =>
  safeCapture("client_error", { error, context }),

// Assessment lifecycle
assessmentStarted: (type: string) =>
  safeCapture("assessment_started", { assessment_type: type }),

// Library
bookOpened: (bookId: string) =>
  safeCapture("book_opened", { book_id: bookId }),

// Quiz
quizSubmitted: (quizId: string, score: number) =>
  safeCapture("quiz_submitted", { quiz_id: quizId, score }),

// Trail
trailStarted: (trailId: string) =>
  safeCapture("trail_started", { trail_id: trailId }),

trailCompleted: (trailId: string) =>
  safeCapture("trail_completed", { trail_id: trailId }),
```

**Arquivos afetados:**
- `apps/web/src/lib/analytics.ts` — adicionar novos eventos
- `apps/web/src/app/(auth)/login/page.tsx` — chamar `analytics.loggedIn()`
- `apps/web/src/app/(auth)/entrar/page.tsx` — chamar `analytics.loggedIn()`
- `apps/web/src/app/(platform)/assessments/*/page.tsx` — chamar `assessmentStarted`
- `apps/web/src/app/(platform)/biblioteca/[bookId]/page.tsx` — chamar `bookOpened`

**Esforço:** 2h
**Dependência:** 1.1 e 1.2 (PostHog precisa estar recebendo dados)

---

### 1.4 Dashboard PostHog — North Star Metrics

**Problema:** Mesmo com dados fluindo, sem dashboard configurado o time não vai olhar.

**Fix:** Criar dashboard "Academy — North Star" no PostHog com:

| Insight | Tipo | Métrica |
|:---|:---|:---|
| DAU / WAU / MAU | Trends | `$pageview` unique users (day/week/month) |
| Sessions por semana | Trends | `session_started` total count |
| Taxa de conclusão | Formula | `session_completed / session_started * 100` |
| Feature adoption | Trends | `feature_viewed` breakdown by feature |
| Login por role | Trends | `logged_in` breakdown by role |
| Erros | Trends | `client_error` total count |

**Esforço:** 1h (via PostHog UI ou API)
**Dependência:** 1.1, 1.2, 1.3

---

### 1.5 Sentry — Verificar Integração

**Problema:** Sentry existe no codebase mas precisa verificar se DSN está configurado no deploy e se erros estão chegando.

**Fix:**
1. Verificar env var `SENTRY_DSN` ou `NEXT_PUBLIC_SENTRY_DSN` no EasyPanel
2. Se não configurado, criar projeto no Sentry e adicionar DSN
3. Verificar que `apps/web/sentry.client.config.ts` e `sentry.server.config.ts` existem

**Esforço:** 30 min
**Dependência:** Nenhuma (paralelo com 1.1)

---

## WAVE 2 — ARQUITETURA & DATA (Semana 1-2)

> Correções estruturais que melhoram qualidade e reduzem dívida técnica.

### 2.1 Desduplicar Cursos — Compartilhamento entre Áreas

**Problema:** Curso "Análise e Solução de Problemas" existe duplicado (ID `4711c03e` para Ribeirão Preto, ID `d948fea5` para MG). Manutenção duplicada, risco de inconsistência.

**Fix:** Dissociar a relação curso↔área para usar enrollment por área em vez de duplicação.

**Abordagem técnica:**
1. Criar tabela `course_areas` (many-to-many): `course_id, area_id`
2. Migrar cursos duplicados para um único curso com enrollments nas duas áreas
3. Alterar lógica de listagem para filtrar por `area_id` do enrollment, não do curso
4. Remover campo `area_id` da tabela `courses` (ou tornar nullable como fallback)

**Migrations necessárias:**
```sql
-- Migration: add course_areas junction table
CREATE TABLE course_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  area_id uuid REFERENCES areas(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(course_id, area_id)
);

-- Populate from existing data
INSERT INTO course_areas (course_id, area_id)
SELECT id, area_id FROM courses WHERE area_id IS NOT NULL;

-- RLS
ALTER TABLE course_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON course_areas
  USING (course_id IN (SELECT id FROM courses WHERE tenant_id = current_setting('app.tenant_id')::uuid));
```

**Arquivos afetados:**
- `supabase/migrations/` — nova migration
- `packages/database/` — schema types
- `apps/web/src/app/(platform)/courses/` — listagem por área
- `apps/web/src/app/(platform)/admin/areas/` — associar cursos a áreas
- MCP `eximia-academy` — atualizar queries

**Esforço:** 4h
**Risco:** Médio (alterar modelo de dados com client ativo). Fazer em branch, testar com dados de staging.
**Dependência:** Nenhuma

---

### 2.2 Video Player Nativo

**Problema:** Sessões referenciam vídeos apenas como links externos. Sem controle de watch-time, sem progresso de vídeo, sem analytics de engagement com vídeo.

**Fix:** Integrar player via `media-chrome` (já tem dependências `youtube-video-element`, `vimeo-video-element` no monorepo).

**Implementação:**
1. Criar componente `<VideoPlayer url={url} onProgress={fn} onComplete={fn} />`
2. Suportar YouTube, Vimeo, e HLS (já tem deps instaladas)
3. Emitir eventos de progresso: `video_started`, `video_25`, `video_50`, `video_75`, `video_completed`
4. Salvar watch progress no enrollment metadata

**Arquivos afetados:**
- `apps/web/src/components/` — novo `video-player.tsx`
- `apps/web/src/lib/analytics.ts` — novos eventos de vídeo
- `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/` — integrar player

**Esforço:** 3h
**Dependência:** 1.1 (para analytics de vídeo)

---

### 2.3 Rate Limiting — Graceful Degradation

**Problema:** Rate limiting depende de Upstash Redis externo. Se Upstash cair, requests falham em vez de passar sem rate limit.

**Fix:** Adicionar fallback in-memory quando Redis não responde.

```typescript
// apps/web/src/lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

// Fallback: in-memory map com TTL simples
const memoryStore = new Map<string, { count: number; expires: number }>()

export async function checkRateLimit(identifier: string, limit: number, window: number) {
  try {
    const redis = Redis.fromEnv()
    const ratelimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(limit, `${window}s`) })
    return await ratelimit.limit(identifier)
  } catch (error) {
    // Graceful degradation: in-memory fallback
    const now = Date.now()
    const key = identifier
    const entry = memoryStore.get(key)
    
    if (!entry || entry.expires < now) {
      memoryStore.set(key, { count: 1, expires: now + window * 1000 })
      return { success: true, remaining: limit - 1 }
    }
    
    entry.count++
    if (entry.count > limit) {
      return { success: false, remaining: 0 }
    }
    return { success: true, remaining: limit - entry.count }
  }
}
```

**Esforço:** 1.5h
**Dependência:** Nenhuma

---

### 2.4 Middleware — Performance em Rotas Públicas

**Problema:** Commit `ac73b826` (já feito) corrigiu auth skip em rotas públicas para eximia-forms. Verificar se Academy tem o mesmo padrão — middleware pesado rodando em rotas que não precisam de auth.

**Fix:**
1. Auditar `apps/web/src/middleware.ts`
2. Garantir que rotas públicas (`/login`, `/entrar`, `/reset-password`, `/accept-invite`, `/api/v1/*`, assets) fazem early-return sem consultar Supabase
3. Medir tempo do middleware antes e depois (via header `Server-Timing`)

**Esforço:** 1h
**Dependência:** Nenhuma

---

### 2.5 MFA/2FA — Supabase Auth Factor

**Problema:** Sem autenticação multi-fator. Red flag para compliance enterprise (ISO 27001, SOC 2).

**Fix:** Supabase suporta TOTP MFA nativamente.

**Implementação:**
1. Habilitar MFA no dashboard Supabase (Auth → Settings → MFA)
2. Criar página `/configuracoes/seguranca` com setup de TOTP
3. Usar `supabase.auth.mfa.enroll()`, `verify()`, `challenge()`
4. Tornar MFA obrigatório para roles `admin` e `super_admin`, opcional para `student`
5. Adicionar verificação no middleware para roles que exigem MFA

**Arquivos afetados:**
- `apps/web/src/app/(platform)/configuracoes/` — nova tab "Segurança"
- `apps/web/src/middleware.ts` — check MFA para admin routes
- Supabase dashboard — habilitar feature

**Esforço:** 4h
**Dependência:** Nenhuma
**Prioridade justificada:** Necessário antes de vender para empresas maiores

---

### 2.6 API Versioning & Mutation Support

**Problema:** API v1 é apenas read-only. Nenhuma operação de escrita exposta. Limita integrações (ex: HR system que cria enrollments automaticamente).

**Fix:**
1. Adicionar endpoints POST: `/api/v1/enrollments` (criar enrollment), `/api/v1/users` (convidar user)
2. Adicionar scope `enrollments:write`, `users:write` ao sistema de API keys
3. Documentar via OpenAPI spec (`/api/v1/openapi.json`)

**Arquivos afetados:**
- `apps/web/src/app/api/v1/enrollments/route.ts` — novo POST handler
- `apps/web/src/app/api/v1/users/route.ts` — novo POST handler
- `apps/web/src/lib/api-auth/scopes.ts` — novos scopes
- `apps/web/src/app/(platform)/admin/api-keys/page.tsx` — UI para novos scopes

**Esforço:** 3h
**Dependência:** Nenhuma

---

## WAVE 3 — ENGAGEMENT & UX (Semana 3-4)

> Features que aumentam retenção e valor percebido pelo cliente.

### 3.1 Certificado Automático de Conclusão

**Problema:** Alunos completam cursos sem reconhecimento formal. Certificados são o #1 do engagement roadmap e o mais pedido por clientes corporativos.

**Fix:**
1. Criar template de certificado (PDF gerado server-side via `@react-pdf/renderer` ou `puppeteer`)
2. Gerar automaticamente quando `enrollment.status = 'completed'`
3. Armazenar em Supabase Storage (`certificates/{userId}/{courseId}.pdf`)
4. Disponibilizar download no perfil do aluno e no dashboard do gestor
5. Permitir branding por tenant (logo, cores, assinatura do instrutor)

**Dados necessários no certificado:**
- Nome do aluno
- Nome do curso
- Carga horária (calculada pelo total de sessões)
- Data de conclusão
- Logo do tenant
- Assinatura digital do instrutor
- QR code de verificação (link público)

**Arquivos afetados:**
- `apps/web/src/lib/certificates/` — nova lib de geração
- `apps/web/src/app/api/certificates/[enrollmentId]/route.ts` — endpoint de download
- `apps/web/src/app/(platform)/perfil/` — seção "Meus Certificados"
- `apps/web/src/components/dashboard/` — link de download no dashboard gestor
- Supabase Storage — bucket `certificates`
- Database trigger ou webhook — auto-gerar ao completar

**Esforço:** 4h
**Dependência:** Nenhuma

---

### 3.2 Notificações de Inatividade (Email + WhatsApp)

**Problema:** Alunos que param de acessar não recebem nenhum nudge de retorno. Sem engagement loop.

**Fix:**
1. **Cron job (microservice):** Query diária para alunos com `last_login_at > 7 dias` e enrollment em progresso
2. **Email via Resend:** Template "Sentimos sua falta" com progresso parcial e CTA
3. **WhatsApp (fase 2):** Integrar Twilio ou Z-API para nudges via WhatsApp Business

**Implementação (Email - fase 1):**
```python
# microservice/app/tasks/inactivity_nudge.py
async def check_inactivity():
    inactive_users = await db.query("""
        SELECT u.email, u.full_name, e.course_id, c.title
        FROM users u
        JOIN enrollments e ON e.user_id = u.id
        JOIN courses c ON c.id = e.course_id
        WHERE u.last_login_at < NOW() - INTERVAL '7 days'
        AND e.status = 'active'
        AND u.role = 'student'
    """)
    for user in inactive_users:
        await send_email(template="inactivity_nudge", to=user.email, data={...})
```

**Arquivos afetados:**
- `microservice/app/tasks/` — novo `inactivity_nudge.py`
- `apps/web/src/app/(platform)/admin/notifications/` — UI para configurar frequência
- Email templates no Resend
- Database — adicionar `last_login_at` tracking (se não existir com trigger)

**Esforço:** 3h
**Dependência:** Resend API key configurada (já existe no .env.example)

---

### 3.3 PWA + Offline Básico

**Problema:** Alunos de fábrica (Cory) acessam de celular. Sem PWA = sem ícone na home screen, sem push notifications, sem cache offline.

**Fix:**
1. Adicionar `manifest.json` com branding dinâmico por tenant
2. Implementar Service Worker com cache de app shell (Workbox via `next-pwa` ou `@ducanh2912/next-pwa`)
3. Cache offline para páginas já visitadas (read-only)
4. Push notifications via Web Push API (para nudges de deadline)

**Implementação mínima (PWA shell):**
```json
// apps/web/public/manifest.json
{
  "name": "eximIA Academy",
  "short_name": "Academy",
  "start_url": "/dashboard",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#e07a2f",
  "icons": [
    { "src": "/logos/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/logos/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Arquivos afetados:**
- `apps/web/public/manifest.json` — novo
- `apps/web/src/app/layout.tsx` — link para manifest
- `apps/web/next.config.ts` — configurar next-pwa
- `package.json` — adicionar `@ducanh2912/next-pwa`

**Esforço:** 2h (PWA básico, sem offline-first completo)
**Dependência:** Nenhuma

---

### 3.4 Gamificação Leve — Progresso Visual + Streaks

**Problema:** Sem senso de progressão. Aluno não sabe onde está nem se está "indo bem".

**Fix:** Adicionar ao dashboard do aluno:
1. **Progress bar global** — % de conclusão do curso
2. **Streak counter** — "5 dias consecutivos" (usando `last_login_at`)
3. **Milestone badges** — marcos visuais (25%, 50%, 75%, 100%)
4. **XP simples** — pontos por session completada, assessment feito, streak mantido

**Database:**
```sql
CREATE TABLE user_gamification (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  xp integer DEFAULT 0,
  current_streak integer DEFAULT 0,
  max_streak integer DEFAULT 0,
  last_activity_date date,
  badges jsonb DEFAULT '[]'
);
```

**Arquivos afetados:**
- `supabase/migrations/` — nova migration
- `apps/web/src/components/dashboard/student-dashboard.tsx` — adicionar widgets
- `apps/web/src/lib/gamification.ts` — lógica de XP e streaks
- API route para calcular/atualizar gamification

**Esforço:** 3h
**Dependência:** 1.1 (analytics para medir impacto)

---

### 3.5 Ranking por Área (Leaderboard)

**Problema:** Sem competição social. Em contexto corporativo, ranking por área/setor gera engajamento natural.

**Fix:**
1. Leaderboard por área mostrando: nome, % conclusão, XP, streak
2. Anonimizar opcionalmente (configurável pelo admin)
3. Atualizar ranking via materialized view ou cron (não real-time para performance)

**Esforço:** 2h
**Dependência:** 3.4 (precisa de XP/gamification)

---

### 3.6 Quiz — Multiple Choice (além de open-ended)

**Problema:** Todas as questions são open-ended (avaliadas por IA). Para corporate training, multiple-choice é essencial (avaliação objetiva, compliance, certificação).

**Fix:**
1. Adicionar tipo `question.type = 'multiple_choice' | 'open_ended'`
2. Criar UI de criação com opções + marcação da correta
3. Auto-grade imediato para MC (sem depender de LLM)
4. Score final = % de acertos

**Esforço:** 3h
**Dependência:** Nenhuma

---

### 3.7 Acessibilidade — WCAG 2.1 AA Baseline

**Problema:** Sem auditoria de acessibilidade documentada. Risk para contratos com governo e grandes empresas.

**Fix:**
1. Rodar `axe-core` (via `@axe-core/playwright`) nos testes E2E existentes
2. Corrigir issues de contraste, labels, keyboard nav
3. Adicionar `aria-labels` em componentes interativos
4. Testar com VoiceOver (macOS) nas 5 pages mais usadas
5. Documentar conformidade em `/docs/accessibility.md`

**Esforço:** 2h (audit + fixes imediatos)
**Dependência:** Nenhuma

---

## WAVE 4 — ESCALA & ENTERPRISE (Mês 2)

> Preparação para vender para empresas maiores e múltiplos clientes.

### 4.1 LTI 1.3 Integration

**Problema:** Empresas com LMS existente (SAP SuccessFactors, Cornerstone, Moodle) não conseguem integrar. LTI é o padrão universal.

**Fix:**
1. Implementar LTI 1.3 Tool Provider (server-side)
2. Aceitar Deep Linking (permitir embed de cursos em LMS externo)
3. Retornar grades via AGS (Assignment and Grade Services)

**Referência:** `ltijs` (npm package) simplifica implementação.

**Esforço:** 4h
**Dependência:** 2.6 (API precisa suportar operations)

---

### 4.2 SSO — SAML 2.0 / OIDC

**Problema:** Empresas enterprise exigem SSO corporativo. Supabase Auth só suporta social logins nativamente.

**Fix:**
1. Supabase suporta SAML via add-on enterprise OU usar custom auth provider
2. Alternativa: proxy com `next-auth` na frente do Supabase para SAML/OIDC
3. Configurar por tenant (cada empresa com seu IdP)

**Esforço:** 3h (usando Supabase SAML nativo se disponível)
**Dependência:** Nenhuma

---

### 4.3 Tenant Quotas & Billing

**Problema:** Sem controle de quota por tenant (storage, users, API calls). Sem self-serve billing.

**Fix:**
1. Tabela `tenant_plans` com limites: `max_users`, `max_courses`, `max_storage_mb`, `max_api_calls_day`
2. Enforcement no middleware/API
3. Dashboard de uso para admin (`/admin/plans`)
4. Integrar Stripe para billing self-serve (fase 2)

**Esforço:** 2h (quota enforcement sem Stripe)
**Dependência:** Nenhuma

---

### 4.4 Multi-Tenant Isolation Testing

**Problema:** 66 migrations, RLS em todas tabelas, mas sem testes automatizados que provem isolamento entre tenants.

**Fix:**
1. Criar test suite `tests/e2e/tenant-isolation.spec.ts`
2. Criar 2 tenants de teste com dados distintos
3. Provar que tenant A NUNCA vê dados de tenant B em todas as rotas
4. Rodar em CI a cada PR

**Cenários:**
```typescript
test('tenant A cannot see tenant B courses', async () => { ... })
test('tenant A cannot see tenant B users', async () => { ... })
test('tenant A cannot access tenant B sessions', async () => { ... })
test('super_admin can see all tenants', async () => { ... })
```

**Esforço:** 2h
**Dependência:** Nenhuma

---

### 4.5 CI/CD Pipeline

**Problema:** Sem pipeline de CI/CD visível no repo. Deploy manual via EasyPanel.

**Fix:**
1. Criar `.github/workflows/ci.yml` com: lint, typecheck, test (unit + E2E), build
2. Criar `.github/workflows/deploy.yml` com: build Docker → push → trigger EasyPanel redeploy
3. Adicionar quality gates obrigatórios no PR

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

**Esforço:** 2h
**Dependência:** Nenhuma

---

## DEPENDÊNCIAS ENTRE WAVES

```
WAVE 1 (Observabilidade)
  ├── 1.1 PostHog Key → 1.3 Tracking → 1.4 Dashboard
  ├── 1.2 Projeto PostHog → 1.1
  └── 1.5 Sentry (paralelo)

WAVE 2 (Arquitetura)
  ├── 2.1 Desduplicação (independente)
  ├── 2.2 Video Player ← 1.1
  ├── 2.3 Rate Limit (independente)
  ├── 2.4 Middleware (independente)
  ├── 2.5 MFA (independente)
  └── 2.6 API Mutations (independente)

WAVE 3 (Engagement)
  ├── 3.1 Certificado (independente)
  ├── 3.2 Notificações (independente)
  ├── 3.3 PWA (independente)
  ├── 3.4 Gamificação ← 1.1
  ├── 3.5 Ranking ← 3.4
  ├── 3.6 Quiz MC (independente)
  └── 3.7 Acessibilidade (independente)

WAVE 4 (Enterprise)
  ├── 4.1 LTI ← 2.6
  ├── 4.2 SSO (independente)
  ├── 4.3 Quotas (independente)
  ├── 4.4 Isolation Tests (independente)
  └── 4.5 CI/CD (independente)
```

---

## MÉTRICAS DE SUCESSO

| Wave | Métrica | Target |
|:---|:---|:---|
| 1 | Eventos PostHog por dia | > 100 (com 46 users ativos) |
| 1 | Dashboard North Star configurado | Sim/Não |
| 2 | Cursos duplicados | 0 |
| 2 | Video watch-time rastreado | Sim/Não |
| 3 | Taxa de conclusão de curso | +20% (baseline precisa de Wave 1) |
| 3 | DAU (7 dias após engagement) | +30% vs baseline |
| 4 | Tenants ativos | >= 3 (vs 1 atual) |
| 4 | CI/CD bloqueando PRs com falha | Sim/Não |

---

## PRIORIZAÇÃO POR IMPACTO/ESFORÇO

```
IMPACTO ALTO + ESFORÇO BAIXO (FAZER PRIMEIRO):
  • 1.1 PostHog Key (15 min, impacto máximo)
  • 1.2 Projeto correto (15 min)
  • 3.3 PWA básico (2h, mobile experience)

IMPACTO ALTO + ESFORÇO MÉDIO:
  • 1.3 Tracking expandido (2h)
  • 3.1 Certificados (4h, valor percebido)
  • 2.1 Desduplicação (4h, sanidade arquitetural)
  • 2.5 MFA (4h, desbloqueio enterprise)

IMPACTO MÉDIO + ESFORÇO BAIXO:
  • 2.3 Rate limit fallback (1.5h)
  • 2.4 Middleware perf (1h)
  • 3.7 Acessibilidade (2h)
  • 4.5 CI/CD (2h)

IMPACTO ALTO + ESFORÇO ALTO (PLANEJAR):
  • 4.1 LTI (4h, desbloqueio mercado)
  • 4.2 SSO (3h, desbloqueio enterprise)
  • 3.4 + 3.5 Gamificação + Ranking (5h, retenção)
```

---

## NOTAS DE EXECUÇÃO

1. **Wave 1 pode ser feita HOJE** — são apenas configurações de ambiente + código incremental
2. **Wave 2 e 3 são paralelas** — podem ser executadas simultaneamente por devs diferentes
3. **Wave 4 é bloqueada por vendas** — só faz sentido se houver pipeline de novos clientes
4. **SEMPRE medir antes de otimizar** — Wave 1 primeiro, depois medir baseline, depois executar Waves 2-4 com dados
5. **Cada item é uma Story SDC** — pode ser criada via `*create-story` quando aprovado

---

*Plano gerado por J.A.R.V.I.S. — Análise + Red Team + PostHog + Academy MCP + Codebase Exploration*
