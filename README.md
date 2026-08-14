# eximIA Academy v2

LMS (Learning Management System) B2B multi-tenant onde cada empresa cliente tem seu espaço isolado, branding próprio e uma IA que guia o aprendizado de forma socrática.

## Diferenciais

- **IA Socrática**, o aluno pensa, a IA provoca com perguntas e nunca entrega resposta pronta. É o diferencial nº 1 do produto, e o contrato pedagógico está em [`docs/features/motor-socratico.md`](./docs/features/motor-socratico.md).
- **Multi-tenant isolado**, dados de um tenant nunca vazam para outro (Row Level Security no Supabase). Ver [`docs/features/multi-tenant.md`](./docs/features/multi-tenant.md).
- **White-label**, cada tenant pode ter cores, logo e domínio próprios.
- **Plataforma modular**, 9 módulos (academy, analytics, admin, assessments, biblioteca, community, course-designer, units, integrations) ligados por plano e por tenant no registro em `packages/shared/src/modules/registry.ts`.

## Hierarquia de acesso

```
Super Admin (eximIA)
  └── Tenant (empresa cliente, ex.: "Harven Agribusiness")
        └── Unidade / Área (filial, departamento)
              └── Usuários
```

Seis papéis (`UserRole` em `@eximia/shared`): `student`, `leader`, `manager`, `instructor`, `admin`, `super_admin`.

## Planos de tenant

Os planos não são texto fixo: cada capacidade é uma linha em `plan_features` (`plan` × `feature_key` × `is_enabled` × `quota`), semeada em `supabase/migrations/20260229100000_plan_features.sql` e editável pelo super admin.

| Feature | essencial | standard | premium |
|:---|:---|:---|:---|
| courses | 5 | 50 | ilimitado |
| quizzes | 10 | ilimitado | ilimitado |
| course_designer | não | sim | sim |
| trails | não | 10 | ilimitado |
| assessments | não | sim | sim |
| webhooks | não | 5 | ilimitado |
| api_access | não | sim | sim |

## Workspaces

Monorepo Turborepo + pnpm: `apps/*` e `packages/*` são workspaces; `microservice/` é um serviço Python fora do pnpm.

| Path | O que é | Dev |
|:---|:---|:---|
| [`apps/web`](./apps/web/README.md) | App principal Next.js 15, as 4 superfícies (aluno, gestor, admin, instrutor) | `pnpm --filter @eximia/web dev` (:3000) |
| [`apps/central`](./apps/central/README.md) | Central administrativa | `pnpm --filter @eximia/central dev` (:3001) |
| [`packages/ui`](./packages/ui/README.md) | Design system (atoms, molecules, organisms, tokens) | — |
| [`packages/shared`](./packages/shared/README.md) | Tipos de domínio, schemas Zod, registro de módulos, sem runtime | — |
| [`packages/database`](./packages/database/README.md) | Schema e tipos de acesso a dados | — |
| [`packages/supabase`](./packages/supabase/README.md) | Clientes Supabase (browser, server, service role) | — |
| [`packages/agents`](./packages/agents/README.md) | Pipeline de IA: prompts, schemas, roteamento de modelo | — |
| [`packages/course-designer`](./packages/course-designer/README.md) | Pipeline de criação de curso | — |
| [`microservice`](./microservice/README.md) | Serviço FastAPI de blueprint de curso | — |

## Features

Documentação de produto por feature vive em [`docs/features/`](./docs/features/README.md). Arquitetura completa em [`docs/architecture.md`](./docs/architecture.md); guia de deploy em [`docs/DEPLOY-GUIDE.md`](./docs/DEPLOY-GUIDE.md).

## Rodando localmente

Requer Node >= 20 (CI usa 22) e pnpm 10.29.1.

```bash
pnpm install
cp .env.example apps/web/.env.local   # preencher credenciais Supabase
pnpm dev                              # http://localhost:3000
```

| Comando | O que faz |
|:---|:---|
| `pnpm dev` | Sobe todos os apps em modo dev |
| `pnpm build` | Build de produção (turbo) |
| `pnpm lint` | Biome via turbo |
| `pnpm typecheck` | `tsc --noEmit` por workspace |
| `pnpm test` | Testes unitários (turbo) |
| `pnpm test:e2e` | Playwright |
| `pnpm check` | `biome check --write .` |
| `pnpm format` | `biome format --write .` |

`.maestri/gate.sh` roda typecheck + lint + build nessa ordem e para no primeiro erro. É ele que decide se uma tarefa está pronta.

## Deploy

Docker + EasyPanel na VPS do projeto. **Não usa Vercel.** O `docker-compose.yml` sobe o app junto com o microserviço de blueprint e o Docling.

```bash
docker build -t eximia-academy-v2 .
```

Variáveis obrigatórias em produção: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`, `OPENAI_API_KEY`. O restante (Sentry, PostHog, Upstash, chaves de outros provedores de IA) é opcional, ver `docker-compose.yml` e `.env.example`.

## Contribuindo

1. Branch a partir de `main`: `git checkout -b feat/nome-da-feature`.
2. Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`.
3. Rodar `pnpm check` e `.maestri/gate.sh` antes de commitar.
4. PR para `main`, que tem branch protection: revisão obrigatória e CI verde (lint, typecheck, test, build).

Convenções para agentes de IA: [`AGENTS.md`](./AGENTS.md).

## Licença

Proprietário, eximIA Ventures. Todos os direitos reservados.
