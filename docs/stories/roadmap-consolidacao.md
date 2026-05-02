# Roadmap de Consolidação — exímIA Academy

**Data:** 2026-02-08
**Autor:** Aria (Architect Agent)
**Objetivo:** Mapear tudo que falta para a plataforma ir a produção

---

## Estado Atual dos Épicos

| Épico | Progresso | Status |
|-------|-----------|--------|
| Epic 1: Foundation & Auth | 100% | ✅ Completo |
| Epic 2: Content Management | 95% | 🟡 Task 2.5-T6 deferida |
| Epic 3: Socratic Learning Engine | 100% | ✅ Completo |
| Epic 4: Dashboards & Analytics | 100% | ✅ Completo (QA 85/100) |
| Epic 5: Multi-tenant & Enterprise | 100% | ✅ Completo (Stories 5.1-5.4) |

**Nota:** O Sprint de Remoção do Dual-Mode está planejado em `docs/stories/sprint-remove-dual-mode/sprint-overview.md`

## Épicos de Consolidação

| Épico | Stories | SP | Prioridade | Status |
|-------|---------|-----|-----------|--------|
| [Epic 6: Simplificação & Segurança](../epics/epic-6-simplificacao-seguranca.md) | 6.1-6.4 | 18 | P0 | Draft |
| [Epic 7: Observabilidade & Qualidade](../epics/epic-7-observabilidade-qualidade.md) | 7.1-7.3 | 14 | P1 | Draft |
| [Epic 8: Autenticação Enterprise](../epics/epic-8-autenticacao-enterprise.md) | 8.1-8.2 | 11 | P1-P2 | Draft |
| **Total** | **9 stories** | **43** | | |

---

## Gaps Identificados por Prioridade

### P0 — CRÍTICO (Bloqueadores de produção)

#### 1. Sprint: Remoção do Dual-Mode
- **Escopo:** Remover modo universidade, hardcodar corporativo
- **Estimativa:** ~5h
- **Detalhes:** `docs/stories/sprint-remove-dual-mode/sprint-overview.md`

#### 2. Rate Limiting (SEC-3)
- **Status:** ✅ Implementado
- **Risco:** Vulnerabilidade de segurança — sem proteção contra abuso de API
- **Escopo:**
  - Adicionar `@upstash/ratelimit` + Redis
  - Atualizar `middleware.ts` com rate limits:
    - `/api/sessions/*/messages` → 10 req/min por usuário
    - `/api/auth/*` → 5 req/min por IP
    - `/api/generate-questions` → 5 req/5min por usuário
- **Arquivos:** `middleware.ts`, `.env.local`
- **Estimativa:** ~3h

#### 3. LGPD — Endpoints de Privacidade (SEC-2)
- **Status:** ✅ Implementado
- **Risco:** Não-conformidade legal (LGPD Art. 18)
- **Escopo:**
  - `GET /api/privacy/export` → Exportação de dados pessoais (DSAR)
  - `DELETE /api/privacy/delete` → Direito ao apagamento (soft delete + 30 dias retenção)
- **Arquivos novos:**
  - `apps/web/src/app/api/privacy/export/route.ts`
  - `apps/web/src/app/api/privacy/delete/route.ts`
- **Estimativa:** ~5h

---

### P1 — IMPORTANTE (Pré-lançamento)

#### 4. Error Monitoring (Sentry)
- **Status:** ✅ Configurado
- **Impacto:** Zero visibilidade de erros em produção
- **Escopo:**
  - Configurar Sentry com Next.js 15
  - Error boundaries nas páginas críticas (chat, dashboards)
  - Source maps para debugging
- **Arquivos novos:**
  - `sentry.client.config.ts`
  - `sentry.server.config.ts`
- **Estimativa:** ~2h

#### 5. Product Analytics (PostHog)
- **Status:** ✅ Configurado
- **Impacto:** Sem dados de comportamento do usuário
- **Escopo:**
  - PostHog provider no layout
  - Eventos: enroll, session_start, session_complete, question_generated
- **Arquivos novos:**
  - `apps/web/src/providers/posthog-provider.tsx`
- **Estimativa:** ~2h

#### 6. E2E Tests (Playwright)
- **Status:** ✅ Implementado
- **Impacto:** Sem proteção contra regressão nos fluxos críticos
- **Escopo (3 fluxos do PRD):**
  1. Login → Dashboard → Curso → Chat (3 turnos) → Sessão completa
  2. Professor: Criar curso → Capítulo → Gerar perguntas → Publicar
  3. Gestor: Dashboard → Filtrar → Exportar
- **Arquivos novos:**
  - `playwright.config.ts`
  - `tests/e2e/student-journey.spec.ts`
  - `tests/e2e/teacher-course-creation.spec.ts`
  - `tests/e2e/manager-dashboard.spec.ts`
- **Estimativa:** ~10h

#### 7. OAuth/SSO
- **Status:** ✅ Implementado (Google OAuth + SAML SSO)
- **Impacto:** Limitação para adoção enterprise
- **Escopo:**
  - Google OAuth (nativo do Supabase)
  - SAML SSO (Supabase Auth Pro — requer plano)
- **Estimativa:** ~6h (Google OAuth), ~8h (SAML)

---

### P2 — NICE-TO-HAVE (Pós-MVP)

#### 8. Status de Progresso do Aluno nos Capítulos (Story 2.5-T6)
- **Status:** 🟡 Deferido
- **Escopo:** Indicadores de progresso (locked/available/completed) na view do aluno
- **Dependência:** Dados de sessão do Epic 3
- **Estimativa:** ~5h

#### 9. REST API para Consumidores Externos
- **Status:** Server Actions suficientes para MVP
- **Escopo:** Endpoints REST para chapters, enrollments, sessions, questions
- **Quando:** Se houver necessidade de API pública/mobile
- **Estimativa:** ~10h

#### 10. Cache Layer (Vercel KV / Upstash Redis)
- **Status:** PostgreSQL suficiente para MVP
- **Escopo:** Cache de sessões e queries frequentes
- **Estimativa:** ~4h

---

### P3 — FUTURO

#### 11. Internacionalização (i18n)
- PT-BR hardcoded é aceitável para MVP
- Adicionar `next-intl` para EN/ES quando necessário

#### 12. PWA / Modo Offline
- Service worker para acesso offline
- Sync de sessões quando reconectar

#### 13. "Prove que Aprendeu" (Desafio de Role Reversal)
- Aluno ensina o conceito de volta para a IA
- Citado no PRD como feature futura

#### 14. Diário de Aprendizado
- Registro automático de insights do aluno
- Integração com Organizer Agent

#### 15. Certificados por Competência
- Emissão baseada em demonstração prática, não provas
- PDF/digital badge

#### 16. Marketplace de Conteúdo
- Criadores vendem trilhas
- Revenue sharing

#### 17. Integrações (Moodle, Canvas, SAP, Workday)
- LTI para universidades
- API para enterprise

---

## Proposta de Sprints

### Sprint 1: Limpeza & Segurança (~13h)
1. ~~Remoção do Dual-Mode~~ (R.1, R.2, R.3) — 5h
2. Rate Limiting — 3h
3. LGPD Endpoints — 5h

### Sprint 2: Observabilidade (~4h)
4. Sentry — 2h
5. PostHog — 2h

### Sprint 3: Qualidade (~16h)
6. E2E Tests — 10h
7. OAuth (Google) — 6h

### Sprint 4: Polish (~9h)
8. Student chapter progress — 5h
9. Cache layer — 4h

---

## Critérios de "Production-Ready"

- [x] Auth com multi-tenancy e RLS
- [x] Socratic Engine operacional (4 agentes)
- [x] CRUD completo (cursos, capítulos, perguntas)
- [x] Dashboards por role
- [x] Onboarding de aluno
- [x] Admin panel (tenant + users)
- [x] CI/CD pipeline
- [x] **Rate limiting** (middleware + @upstash/ratelimit, 9 limiters)
- [x] **LGPD compliance** (export + soft-delete endpoints)
- [x] **Error monitoring** (Sentry client/server/edge)
- [x] **Analytics** (PostHog provider + identify)
- [x] **E2E tests** (3 Playwright specs: student, teacher, manager)
- [x] **OAuth/SSO** (Google OAuth + SAML SSO)
- [x] **Remoção do dual-mode** (migration 20260208000001)

---

*Roadmap gerado por Aria, arquitetando o futuro 🏗️*
