# @eximia/shared

Código sem dependência de runtime (sem React, sem Next, sem Supabase) compartilhado por todos os apps e packages do monorepo: o **registro de módulos da plataforma**, os schemas Zod de validação, os tipos de domínio, constantes e alguns utilitários puros.

É um package **interno, não publicado e sem build step**: `main`/`types` apontam direto para `./src/index.ts`, e quem consome compila o TypeScript junto (Next transpila, os packages irmãos são `workspace:*`). Não existe `dist/` publicado — editar `src/` já reflete no consumidor.

## Consumidores

| Consumidor | Arquivos que importam |
|:---|---:|
| `apps/web` | 79 |
| `apps/central` | 5 |
| `packages/course-designer` | 5 |
| `packages/agents` | 1 |

Exemplos reais:

```ts
// apps/web/src/components/providers/module-provider.tsx
import { type ModuleId, getEnabledModules, isRouteAllowed } from "@eximia/shared"

// apps/web/src/lib/navigation.ts
import { type ModuleId, type NavContext, type Role, buildNavigation } from "@eximia/shared"
```

## O que o package exporta

Tudo passa pelo barrel `src/index.ts`. Nunca importe caminho profundo (`@eximia/shared/src/...`) de fora do package.

| Área | Arquivo | Conteúdo |
|:---|:---|:---|
| Registro de módulos | `src/modules/registry.ts` | `MODULE_IDS`, `MODULE_DEFINITIONS`, `buildNavigation`, `isRouteAllowed`, `isApiRouteAllowed`, `isCapabilityEnabled`, `getEnabledModules`, `navRoleForContext`, `navKeysForContext` e os tipos (`ModuleId`, `Role`, `NavContext`, ...) |
| Config de tenant | `src/modules/tenant-config.ts` | Tipos `TenantConfig` / `TenantBrand` — o formato do `apps/web/tenant.config.ts` |
| Validators | `src/validators/*.ts` | Schemas Zod + tipos inferidos por domínio (`courses`, `chapters`, `questions`, `quiz`, `trails`, `auth`, `api-keys`, `webhooks`, `whitelabel`, `job-roles`, `instructor-permissions`, `plan-features`, `public-api`) |
| Tipos de domínio | `src/types/models.ts` | Modelos compartilhados entre app e agentes (ex.: `AILearningProfile`, `InteractionType`) |
| Constantes | `src/constants/limits.ts`, `src/constants/labels.ts` | `LIMITS`, `PLATFORM_LABELS` |
| Utilitários | `src/utils/*.ts` | `sanitizeStudentMessage`, `buildAdaptationHints`, `cn` |

`src/modules/analytics-config.ts` é um **placeholder declarado**: não está no barrel, não é um módulo do registry e nenhum arquivo o importa. O cabeçalho do próprio arquivo explica o porquê.

---

## `modules/registry.ts` — o registro de módulos

É a fonte canônica dos **9 módulos toggleáveis** da plataforma. Um "módulo" agrupa quatro coisas: os itens de navegação que ele contribui (por papel), os prefixos de rota de página que ele possui, os prefixos de rota de API que ele possui, e capabilities opcionais de exposição de UI.

O registry é **puro**: sem I/O, sem banco, sem React. Todas as funções são determinísticas sobre os argumentos recebidos.

### Módulos e a distinção core / opt-in

```
academy · analytics · admin          → core: true   (sempre ligados, não desligáveis)
assessments · biblioteca · community
course-designer · units · integrations → core: false (opt-in por tenant)
```

Os add-ons são ligados no `apps/web/tenant.config.ts`, no campo `modules`:

```ts
const config: TenantConfig = {
  brand: { /* ... */ },
  modules: ["biblioteca", "units"],
}
```

`getEnabledModules(enabledIds)` faz a união `core ∪ enabledIds` e devolve as definições **ordenadas pelo índice em `MODULE_IDS`** — não pela ordem em que foram habilitadas. Essa ordem é o que determina a ordem visual da sidebar, então mexer em `MODULE_IDS` reordena a navegação de todo mundo.

### Anatomia de um módulo

Definição real, de `MODULE_DEFINITIONS`:

```ts
biblioteca: {
  id: "biblioteca",
  name: "Biblioteca",
  description: "Livros e materiais de referência para consulta",
  core: false,
  nav: {
    // Biblioteca is a LEARNER surface: it belongs to the student nav, reached
    // via the `personal` ("Minha Trilha") context. It is intentionally NOT on
    // the `manager` key — the team workspace stays pure management (WP5).
    student: [{ label: "Biblioteca", href: "/biblioteca", icon: "Library" }],
    admin: [{ label: "Gerenciar Livros", href: "/admin/biblioteca", icon: "BookOpen" }],
    instructor: [{ label: "Biblioteca", href: "/biblioteca", icon: "Library" }],
  },
  routes: ["/biblioteca", "/admin/biblioteca"],
  apiRoutes: ["/api/admin/books"],
},
```

Campos:

- **`nav`** — `Partial<Record<Role, ModuleNavEntry[]>>`. Uma entrada é um item (`{ label, href, icon, badge? }`) ou um cabeçalho de seção (`{ section }`). `icon` é uma **string** com o nome do ícone Lucide, resolvida no app (ver "Adicionar um módulo", passo 4).
- **`routes`** — prefixos de rota de página que o módulo possui. Consumido por `isRouteAllowed`.
- **`apiRoutes`** — idem para rotas de API. Consumido por `isApiRouteAllowed`.
- **`capabilities`** — opcional, flags nomeadas de exposição de UI (ver adiante).

O casamento por prefixo é exato — a rota bate se for igual ou se for um segmento abaixo:

```ts
pathname === route || pathname.startsWith(`${route}/`)
```

Ou seja, `/admin` **não** casa `/administracao`.

### Como a navegação é montada

A nav **não** é função de um único `profile.role`. É função de `(união de chapéus, contexto ativo, workspace ativo)`:

```ts
interface NavContext {
  roles: Role[]                                        // todos os chapéus reais da pessoa
  context: { type: "personal" | "team" | "organization" }
  workspace?: "standard" | "studio" | "admin" | "super" // ausente = comportamento legado
}
```

O caminho é sempre o mesmo, em três etapas:

1. **`navRoleForContext`** escolhe o *view role*. Contexto `personal` sempre devolve `student`. Contexto `team`/`organization` devolve o chapéu de gestão mais alto, na mesma precedência do banco: `super_admin > admin > manager > instructor > leader > student`.
2. **`navKeysForContext`** decide quais chaves de `nav` realmente renderizam, com **gate pela união de chapéus**. O contexto escolhe a lente, nunca destrava o que o chapéu não concede: as chaves admin-tier (`admin`, `super_admin`) só são emitidas se a pessoa literalmente tem o chapéu em `roles[]`. Cada workspace tem sua regra (mundo `super` só emite `super_admin`; mundo `admin` só emite `admin`; mundo `standard` nunca emite chave admin-tier e nunca emite `instructor`).
3. **`buildNavigation(enabledIds, navCtx)`** itera os módulos habilitados na ordem de `MODULE_IDS`, concatena as entradas das chaves escolhidas e **deduplica por `href`** — a primeira ocorrência vence, preservando ordem e cabeçalhos de seção da primeira chave. Cabeçalhos `{ section }` não são deduplicados (não têm destino, marcam posição).

Consequência prática que costuma pegar quem mexe: um item **sem** `{ section }` cai visualmente dentro da seção aberta pelo módulo anterior na ordem de `MODULE_IDS`. Adicionar ou remover um cabeçalho num módulo muda o agrupamento dos módulos seguintes.

O Estúdio (workspace `studio`) **não usa este registry** — ele renderiza a própria nav estática em `apps/web/src/components/studio/studio-sidebar.tsx`.

### Gate de rota

```ts
isRouteAllowed(enabledIds, "/biblioteca")        // false se o módulo biblioteca estiver off
isApiRouteAllowed(enabledIds, "/api/admin/books")
```

Estado real hoje, que vale saber antes de mexer: `isRouteAllowed` é repassado pelo `ModuleProvider` através do hook `useModules()`, mas **nenhuma tela o chama** — fora dos testes, o único consumidor real do provider é `isEnabled`. `isApiRouteAllowed` não tem consumidor nenhum fora deste package. Quem de fato barra tela de módulo desligado é o componente `ModuleGate` (`apps/web/src/components/module-gate.tsx`), usado no `layout.tsx` da rota e gateando por **id de módulo**, não por prefixo:

```tsx
// apps/web/src/app/(platform)/assessments/layout.tsx
return <ModuleGate module="assessments">{children}</ModuleGate>
```

Em qualquer caso, gate de módulo **não é** autorização. Quem autoriza é o guard da página e a RLS no banco.

### Capabilities

```ts
isCapabilityEnabled(moduleId, capability, tenantFlags?)
```

Uma capability é uma flag de **visibilidade de UI**, nunca de permissão. Precedência: override por tenant > default do módulo > `false`. Hoje existe uma só: `"org-tree"`, no módulo `admin`, default `false`, ligável por tenant via `TenantConfig.features.orgTree`.

A regra que o próprio arquivo documenta e que deve ser preservada: renderizar uma capability para quem não tem o papel produz, no pior caso, uma tela vazia — porque a **RLS nega as linhas**. A trava é o banco; isto aqui é exposição.

### O que o registry *não* faz

Não faz gating por **plano** (`essencial`/`standard`/`premium`). Isso é outro mecanismo, orientado a banco, cuja validação vive em `src/validators/plan-features.ts` (`featureKeySchema`, `updatePlanFeatureSchema`). Módulo é por tenant e declarativo; feature de plano é por linha em `plan_features`. Não misture os dois.

---

## Adicionar um módulo novo

1. Acrescentar o id em `MODULE_IDS`. **A posição importa** — é a ordem de renderização na sidebar.
2. Acrescentar a entrada correspondente em `MODULE_DEFINITIONS` (o `Record<ModuleId, ModuleDefinition>` é exaustivo: esquecer isto quebra o `typecheck`, que é o comportamento desejado).
3. Definir `core`. Se `core: false`, o módulo só liga quando o id entra em `modules` no `tenant.config.ts` do app.
4. Para cada `icon` novo usado em `nav`, adicionar o par no `ICON_MAP` de `apps/web/src/lib/navigation.ts`. **O resolver tem fallback silencioso para `LayoutDashboard`** — o build não quebra, o ícone só sai errado.
5. Preencher `routes`/`apiRoutes` com os prefixos que o módulo possui. Isso é declaração de posse — hoje só `isRouteAllowed`/`isApiRouteAllowed` leem esses campos, e ambos estão sem chamador de produção (ver "Gate de rota"). Para barrar de fato a tela quando o módulo está desligado, envolver a rota em `<ModuleGate module="...">` no `layout.tsx` dela.
6. Cobrir o comportamento em `src/__tests__/registry-nav.test.ts`, que já testa o invariante central: contexto `personal` nunca traz item de gestão e contexto `team`/`organization` nunca traz item de aluno.

Remover a porta de um item da nav **não** remove a tela: `routes` continua intocado e a URL segue acessível com os mesmos guards. Esse desacoplamento é deliberado e há vários casos assim no arquivo (integrações, unidades, usuários), sempre com o motivo registrado em comentário.

## Rodar e testar

```bash
pnpm --filter @eximia/shared test        # vitest run — 5 arquivos, 80 testes
pnpm --filter @eximia/shared typecheck   # tsc --noEmit
pnpm --filter @eximia/shared lint        # biome check ./src
```

Da raiz, `pnpm test` / `pnpm typecheck` / `pnpm lint` rodam via Turbo em todo o monorepo. Os testes ficam em dois lugares por herança: `src/__tests__/` (registry e labels) e `tests/` (sanitize e validators). Não há servidor nem banco envolvido — o package é puro e os testes rodam em milissegundos.
