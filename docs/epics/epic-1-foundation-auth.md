# Epic 1: Foundation & Auth

**Version:** 1.3
**Created:** 2026-02-07
**Updated:** 2026-02-07 (Separated epic from stories; inline content moved to individual story files)
**Author:** Morgan (PM Agent)
**Status:** Ready for Development
**PRD Reference:** `docs/prd.md` — Epic 1
**Architecture Reference:** `docs/architecture.md` v1.2

---

## Epic Goal

Estabelecer a base tecnica do projeto com monorepo funcional, banco de dados com schema inicial, autenticacao operacional e layout base com resolucao de tenant. Ao final deste epic, um usuario pode fazer login, ver um dashboard vazio com branding do tenant, e o sistema esta pronto para receber funcionalidades dos Epics 2-5.

## Epic Context

| Item | Detalhe |
|------|---------|
| **Stack** | Next.js 15 (App Router) + Supabase + Vercel + Drizzle ORM + Tailwind CSS 4 + shadcn/ui |
| **Monorepo** | Turborepo + pnpm workspaces |
| **Auth** | Supabase Auth (email/password), invite-only model |
| **Multi-tenant** | RLS on PostgreSQL, tenant resolution via subdomain |
| **Testing** | Vitest + Testing Library (unit), Playwright (E2E) |
| **CI/CD** | GitHub Actions + Vercel (preview per PR) |
| **Design Tokens** | `Benchmarks/Design/design-tokens.json` v1.2.2 |

---

## Dependency Graph

```
Story 1.1 (Monorepo) ─────┬──────────────── Story 1.5 (CI/CD)
                           │                    [pode rodar em paralelo]
                           ▼
                    Story 1.2 (Supabase)
                           │
                           ▼
                    Story 1.3 (Auth)
                           │
                           ▼
                    Story 1.4 (Layout + Tenant)
```

---

## Stories

| Story | File | SP | Priority | Blocked By |
|-------|------|----|----------|------------|
| 1.1 Monorepo Setup | [`story-1.1-monorepo-setup.md`](../stories/story-1.1-monorepo-setup.md) | 5 | P0 | — |
| 1.2 Supabase Schema | [`story-1.2-supabase-schema.md`](../stories/story-1.2-supabase-schema.md) | 8 | P0 | 1.1 |
| 1.3 Auth Flow | [`story-1.3-auth-flow.md`](../stories/story-1.3-auth-flow.md) | 5 | P0 | 1.1, 1.2 |
| 1.4 Layout + Tenant | [`story-1.4-layout-tenant.md`](../stories/story-1.4-layout-tenant.md) | 8 | P1 | 1.2, 1.3 |
| 1.5 CI/CD Pipeline | [`story-1.5-cicd-pipeline.md`](../stories/story-1.5-cicd-pipeline.md) | 3 | P1 | 1.1 |

**Total:** 29 story points

> Each story file contains: user story, acceptance criteria, technical implementation guide with code snippets, tasks, agent assignments, quality gates, risk assessment, and Definition of Done.

---

## Risk Mitigation

| Risco | Impacto | Mitigacao | Rollback |
|-------|---------|-----------|----------|
| RLS policies incorretas permitem data leak | CRITICAL | QA audit obrigatorio (Quinn) antes de merge da Story 1.2 | Reverter migration |
| Supabase Auth breaking change | HIGH | Pin versao `@supabase/ssr`, testar localmente antes | Rollback package version |
| Tailwind CSS 4 incompatibilidade com shadcn | MEDIUM | Verificar compatibilidade na Story 1.1 antes de avancar | Fallback para Tailwind 3 |
| Subdomain tenant resolution no Vercel | MEDIUM | Testar wildcard domain early na Story 1.4 | Fallback para query param ?tenant= |

---

## Epic Compatibility Requirements

- [x] Architecture v1.2 com todos os P0 resolvidos
- [x] Design tokens v1.2.2 finalizados
- [x] PRD v1.0 com 5 epics definidos
- [x] Screens map v1.0 com 12 telas

---

## Definition of Done (Epic Level)

- [ ] Todas as 5 stories completadas com ACs atendidos
- [ ] Developer pode clonar repo, rodar `pnpm install && pnpm dev` e ter app funcional
- [ ] Login funcional com usuario seed (tenant Demo)
- [ ] Dashboard exibe branding do tenant com navegacao por role
- [ ] CI/CD verde com preview deploys por PR
- [ ] Nenhuma regressao (nao aplicavel — greenfield)
- [ ] Security review das RLS policies passou

---

## Development Handoff

> **Para @dev (Dex):** Stories detalhadas com guia tecnico completo em arquivos individuais (`story-1.x-*.md`). Consideracoes:
>
> - Projeto greenfield — stack definida em `docs/architecture.md` v1.2
> - Story 1.2 e a mais critica (schema + RLS) — requer security review por @qa (Quinn)
> - Story 1.3 tem correcao ARCH-3: modelo invite-only (nao self-registration)
> - Story 1.3 requer `createServiceClient()` (service_role_key) para invite flow — nao usar anon client para `.auth.admin.*`
> - Story 1.5 pode rodar em paralelo com 1.2/1.3/1.4
> - Design tokens canonicos: `Benchmarks/Design/design-tokens.json` v1.2.2 — paths usam `{value, description}` structure
> - Cada story contem Technical Implementation Guide com code snippets prontos para uso

---

*Epic criado por Morgan (PM Agent) — eximIA Academy v1.0*
