# @eximia/web

App Next.js 15 (App Router) que é a plataforma eximIA Academy. Roda na porta 3000 e concentra
as quatro superfícies do produto: aluno, gestor, administrador e instrutor. É o maior artefato
do monorepo (~1.365 arquivos `ts`/`tsx`) e o único deploy que o cliente final acessa.

- Design system e componentes visuais: [`packages/ui`](../../packages/ui)
- Tipos compartilhados, `TenantConfig` e registro de módulos: [`packages/shared`](../../packages/shared)
- Acesso a dados e migrations: [`packages/database`](../../packages/database)

---

## Route groups

`src/app/` usa **três** route groups. Não existe `(app)` — se alguma documentação citar esse
nome, está desatualizada.

### `(auth)` — porta de entrada, sem sessão

Telas anônimas com um shell próprio (split-screen com logo e imagem de marca):

| Rota | Papel |
|:---|:---|
| `/entrar` | Login canônico de produção (formulário real, em `_components/login-form`) |
| `/login` | Alias legado; ainda ativo e usado como destino de redirect pelo middleware |
| `/accept-invite` | Provisionamento de usuário convidado |
| `/reset-password` | Redefinição de senha |

### `(platform)` — os mundos autenticados que compartilham o mesmo shell

É o grupo mais pesado (~30 seções de topo): `dashboard`, `courses`, `trails`, `jornada`,
`assessments`, `biblioteca`, `materiais`, `lives`, `comunidade`, `analytics`, `engagement`,
`team`, `leader`, `admin`, `super-admin`, `configuracoes`, `perfil`, entre outras.

O ponto não óbvio: `(platform)` **não é "o mundo do aluno"**. O layout resolve qual shell
renderizar em tempo de request via `resolvePlatformShell(activeWorkspace, roles)`
(`src/lib/workspace-resolver.ts`), porque páginas compartilhadas (`/courses`, `/materiais`,
`/lives`, `/trails`, `/analytics`) são navegadas também a partir do Estúdio. Quando o workspace
ativo é `studio` **e** o chapéu real confirma o alcance, o layout de `(platform)` monta o shell
do Estúdio, para que o instrutor não "troque de mundo sozinho" ao abrir uma página compartilhada.
A resolução é fail-closed: cookie forjado sem o chapéu correspondente cai no shell padrão.

### `(studio)` — o mundo do instrutor

Contém **apenas** `/instructor`. Todo o resto do Estúdio mora em `(platform)` (ver acima). O
layout é deliberadamente enxuto: só `QueryProvider`, `BrandProvider` e `SessionTimeoutProvider`
— sem `ContextProvider` (população), sem `AreaProvider` (o Estúdio não tem seletor de unidade).
Guarda de entrada com `canEnterStudio(roles)` (`instructor` ou `super_admin`), o mesmo predicado
usado pelo middleware e pela porta de workspaces, para que guard e porta nunca divirjam.

### Fora dos grupos

`api/` (135 route handlers, incluindo a API pública `/api/v1/*`), `workspace/` (o seletor de
mundo pós-login), `onboarding/`, `verify/[code]/`, `brandbook/` e `dev/` (páginas de preview
de UI, não fazem parte do produto).

---

## Os quatro mundos

O app modela acesso como **mundos (workspaces)**, derivados da união de chapéus reais do usuário
(tabela `user_roles`), nunca da coluna singular `users.role`:

| Mundo | Home | Quem alcança |
|:---|:---|:---|
| `standard` | `/dashboard` | `student`, `manager`, `leader` e todo admin-tier |
| `studio` | `/instructor` | `instructor`, `super_admin` |
| `admin` | `/admin` | `admin`, `super_admin` |
| `super` | `/super-admin` | `super_admin` |

Quem alcança mais de um mundo cai em `/workspace` (seletor explícito, sem default memorizado)
após o login; quem alcança um só vai direto para a home dele. O mundo ativo vive no cookie
efêmero `x-active-workspace`, que o middleware também seta em deep-link cross-world.

---

## Middleware (`src/middleware.ts`)

Roda em quase toda request (`matcher` exclui apenas `_next/static`, `_next/image` e `favicon.ico`)
e faz, nesta ordem:

1. **Bypass de assets públicos** — `/logos/*`, `/brand/*`, `manifest.json`, `robots.txt`, `sitemap.xml`.
2. **API pública `/api/v1/*`** — caminho separado, sem sessão Supabase. Autentica por
   `Authorization: Bearer exa_live_...`, valida escopo por prefixo de rota
   (`courses:read`, `blueprints:read`, `enrollments:read`, `analytics:read`), aplica rate limit
   por chave (RPM/RPD), trata CORS e **remove qualquer header `x-api-*` vindo do cliente** antes
   de reinjetá-los a partir do contexto validado — sem isso um caller poderia forjar o tenant.
3. **Rate limit por IP** para `/api/*` (Upstash Redis). Erro de Redis **falha aberto** por desenho:
   indisponibilidade do limitador não derruba a request.
4. **Sessão Supabase** via `@supabase/ssr` com repasse de cookies.
5. **Rate limit por usuário** em rotas caras (chat de sessão, geração de questões, criação de
   curso, privacidade).
6. **Chapéus efetivos** — lê a união de `user_roles`. A coluna `users.role` é cacheada em cookie
   por 5 min (`x-user-role`) **apenas como dica de UI**; nunca é a autoridade. No logout, os
   cookies de dica (`x-user-role`, `x-active-context`, `x-view-as-student`, `x-active-workspace`,
   `x-role-lens`) são limpos.
7. **Guards de rota** — `/dashboard`, `/courses`, `/admin`, `/analytics`, `/instructor` e
   `/super-admin` exigem sessão. `/instructor` exige `canEnterStudio`; `/super-admin` exige o
   chapéu `super_admin`; `/admin` e `/admin/configuracoes` exigem admin-tier. Todos fail-closed,
   e o redirect de negação devolve o usuário para a porta do **próprio** mundo, não para
   `/dashboard` (mandá-lo ao mundo padrão reescreveria o cookie de workspace e o expulsaria de
   onde ele estava).
8. **Redirect de rota de auth** — usuário logado em `/`, `/entrar` ou `/login` vai para
   `/workspace` (multi-acesso) ou direto para a home do único mundo acessível.

A autoridade final continua sendo a RLS do Postgres. O middleware é a primeira camada, não a única.

---

## Tenant e white-label

**O tenant é estático, resolvido em build time — o middleware não participa disso.**
`tenant.config.ts` na raiz do app exporta um `TenantConfig` (tipo de `@eximia/shared`) e
`getTenantConfig()` (`src/lib/tenant.ts`) apenas o devolve. Isso substituiu a resolução dinâmica
que antes consultava o Supabase por request.

Na prática cada branch de deploy carrega o seu arquivo — a branch `deploy/cory`, por exemplo,
traz a marca Argos Consultoria. O config carrega:

- `brand` — nome, slug, logo, favicon, `primaryColor`/`accentColor` (injetados como as CSS vars
  `--tenant-primary`/`--tenant-secondary` pelos layouts, com sanitização de hex), logo e nome do parceiro.
- `modules` — lista de módulos habilitados para o tenant. O registro de módulos e o significado
  de cada slug vivem em [`packages/shared`](../../packages/shared); não duplicar aqui.
- `settings` — `maxInteractionsPerSession`, `sessionTimeoutHours`, `footerText`, `supportEmail`,
  `customCSS` opcional (passa por `sanitizeCSS` antes de ser injetado).

---

## Rodar e testar

Os comandos abaixo são os scripts reais de `apps/web/package.json`. Do repositório, prefixe com
`pnpm --filter web`; de dentro de `apps/web/`, rode direto.

| Comando | O que faz |
|:---|:---|
| `pnpm dev` | `next dev --turbopack` na porta 3000 |
| `pnpm build` | `next build` (saída `standalone`, com upload de sourcemaps para o Sentry) |
| `pnpm start` | Serve o build de produção |
| `pnpm lint` | `biome check ./src` |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | `vitest run` (jsdom, setup em `src/test-setup.ts`, alias `@` → `./src`) |

Na raiz do monorepo, `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck` e `pnpm test`
disparam o Turbo sobre todos os workspaces.

**E2E não mora aqui.** Playwright é configurado na **raiz** do repositório (`playwright.config.ts`,
`testDir: ./tests/e2e`) e roda com `pnpm test:e2e` a partir da raiz. Ele sobe o próprio servidor
(`pnpm --filter web dev` em `localhost:3000`, com `E2E_TESTING=true` e chaves de IA falsas) e
executa em Chromium, Firefox e WebKit.

**Variáveis mínimas** para o app subir: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(o middleware não autentica sem elas). `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` habilitam
o rate limit — ausentes, ele falha aberto. Demais chaves (provedores de IA, Sentry, PostHog, Resend)
estão em `.env.example` na raiz.

---

## Estrutura de `src/`

**`app/`** — App Router: os três route groups descritos acima, mais `api/` (135 route handlers,
incluindo a API pública versionada `/api/v1/*` com autenticação por chave e escopos), o seletor
`workspace/`, `onboarding/`, `verify/[code]/` e as páginas de preview em `dev/` e `brandbook/`.
Cada rota mantém seus componentes locais em `_components/` e suas server actions em `actions.ts`,
colocados ao lado da página.

**`components/`** — componentes React organizados por domínio (`admin`, `analytics`, `auth`,
`dashboard`, `studio`, `quiz`, `trails`, `biblioteca`, `onboarding`, `verso`, `blueprint`,
`materiais`, `profile`), mais `layout/` (headers, sidebars, footer, progresso de navegação) e
`providers/` (Query, Brand, Module, Area, Context, SessionTimeout, PostHog). Componentes de
propósito geral e primitivos de design **não** ficam aqui — vêm de
[`packages/ui`](../../packages/ui).

**`lib/`** — a camada de regra do app (~68 módulos). Os que mais importam entender antes de mexer
em acesso: `workspace-resolver.ts` (quem alcança qual mundo — fonte única de `canEnterStudio`),
`admin-world.ts` (allowlist de rotas do mundo admin e redirects de negação), `auth.ts`
(`getAuthProfile`, escopo de tenant), `role-helpers.ts` (`hasRole`/`hasAnyRole` sobre a união de
chapéus — nunca comparar `profile.role` diretamente), `tenant.ts`, `rate-limit.ts`, `api-auth/`
e `supabase/` (clientes server/browser/middleware).

Completam o app: `hooks/` (hooks de cliente), `mocks/` (handlers MSW para testes), `types/`,
`styles/` (inclui `theme.css`, onde vive o acento por mundo), `middleware.ts` e
`instrumentation.ts` (Sentry).
