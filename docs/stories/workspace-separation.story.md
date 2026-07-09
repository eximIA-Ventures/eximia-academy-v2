# Story: Workspace Separation (uma conta, dois mundos)

> **Status:** Draft · **Tier:** 1 (SDC, multi-arquivo, muda escopo de dado)
> **Branch:** `feat/workspace-separation` (worktree `eximia-academy-v2-workspaces`)
> **Fonte:** `JARVIS/apps/academy-workspaces/WORKSPACE-SEPARATION-BRIEF.md`
> **Coordenação:** agente irmão no branch `feat/manager-ux-wave2` sobrepõe `sidebar.tsx`/`layout.tsx`; sequenciar.

## Contexto

A plataforma deixa de filtrar UMA superfície por "lentes" (`x-role-lens`) e passa a ter
**dois workspaces fisicamente separados** sob uma única conta:

- **Estúdio do Instrutor** (`/instructor/*`): quem tem chapéu `instructor`. Bancada de autoria
  (cursos, conteúdo, sessões, acompanhamento). NUNCA contém Minha Trilha / Meu Time.
- **Workspace Padrão** (`/dashboard`, `/courses`, `/team`, ...): quem tem chapéu `student` e/ou
  `manager`. Jornada de aprendizagem + gestão de time. NUNCA contém autoria.

Quem tem os dois mundos escolhe por **porta explícita** (Workspace Picker), nunca por dropdown
escondido. A travessia limpa estado residual. O eixo lente (`x-role-lens`) morre por último, só
depois que os dois consumidores de escopo de dado vivo (analytics, notifications) forem religados
ao novo eixo (workspace ativo + chapéus + contexto).

Caso canônico de QA: **Rinaldo** (tenant ARGOS), multi-chapéu (`instructor` + `manager` + `student`),
cujo `users.role` singular NÃO é `instructor`, o que hoje o expulsaria do Estúdio.

## Decisões cravadas (Hugo, 2026-07-07)

- **D1:** multi-acesso SEMPRE passa pelo picker no login (sem lembrar último workspace, sem default).
- **D2:** lugar do admin (3º workspace vs área do padrão) = PENDENTE. Nesta fase o admin fica INTACTO.
- **D3:** instrutor que quer experiência de aluno: (a) preview global "Ver como Aluno" dentro do
  Estúdio (cookie `x-view-as-student`, nada registrado); (b) aprendizagem real matriculada atravessa
  para o Padrão via picker.

## Regras duras (invariantes de todos os pacotes)

1. URLs públicas NÃO mudam (`/instructor/*` continua `/instructor/*`; route groups não afetam URL).
2. Admin INTACTO nesta fase (nav e rotas de admin funcionam como hoje).
3. Todo gate de papel usa chapéus reais de `user_roles` via `hasAnyRole`/`hasRole`, NUNCA a coluna
   singular `users.role`.
4. Fronteira de UI sem fechadura no dado é cenografia: os guards server-side (WP1) entram de qualquer forma.
5. NUNCA `git push`; NUNCA tocar `.env*`.

## Pacotes (sequenciais)

| WP | Título | Depende de |
|:--|:---|:---|
| WP1 | guards-dado (server-side, independe de UI) | — |
| WP2 | workspace-plumbing (cookie + resolver + switchWorkspace + middleware) | WP1 |
| WP3 | picker (`/workspace`) | WP2 |
| WP4 | estúdio (route group `(studio)/instructor` + layout raiz próprio) | WP2 |
| WP5 | padrão + morte do lens (religar analytics/notifications, aposentar eixo lente) | WP2, WP4 |

## Acceptance Criteria

### WP1 — guards-dado
- AC1.1: `getStudentDetails` (roda em `createServiceClient`, sem RLS) só retorna dados após um gate
  de escopo por chapéu real; sem escopo válido → `[]`.
- AC1.2: `authorizeTenantAccess` distingue acesso BRUTO (verbatim individual) de AGREGADO; um gestor
  PURO (só chapéu `manager`, sem `instructor`/`admin`/`super_admin`) nunca recebe texto verbatim de aluno.
- AC1.3: guard de `/instructor` na página (`instructor/page.tsx:20`) usa `hasAnyRole(..., ["instructor"])`
  em vez de `profile.role !== "instructor"`; um multi-chapéu com `role` primário `manager` que TAMBÉM é
  `instructor` NÃO é expulso.
- AC1.4: `middleware.ts` NÃO é tocado neste pacote.

### WP2 — workspace-plumbing
- AC2.1: existe cookie de sessão efêmero `x-active-workspace` (sem `maxAge` persistente longo).
- AC2.2: `workspace-resolver` deriva os workspaces acessíveis dos chapéus (`instructor`→estúdio;
  `student`/`manager`→padrão); nunca inclui um mundo que os chapéus não concedem.
- AC2.3: `switchWorkspace` valida acesso, seta `x-active-workspace`, LIMPA `x-active-context`,
  `x-view-as-student` e `x-role-lens` na travessia, e redireciona.
- AC2.4: middleware guarda `/instructor` por chapéu real fail-closed; roteia pós-login (multi-acesso→
  `/workspace`; acesso único→direto); deep-link cross-world permitido entra setando o estado, sem acesso
  → redirect fail-closed; limpa `x-active-workspace` no logout junto da limpeza existente (~244-253).

### WP3 — picker
- AC3.1: rota `/workspace` renderiza os 2 cartões (Plataforma de Aprendizagem / Estúdio do Instrutor)
  conforme S1 do briefing; sem sidebar/header.
- AC3.2: sempre exibida para multi-acesso após login; consome `switchWorkspace` do WP2; tem estado de
  loading no cartão clicado; footnote de troca posterior; link "Sair".

### WP4 — estúdio
- AC4.1: `/instructor/*` movido para route group `(studio)/instructor` com layout raiz PRÓPRIO; URLs inalteradas.
- AC4.2: sidebar própria com badge "ESTÚDIO DO INSTRUTOR" e itens de instrutor; NADA do mundo padrão.
- AC4.3: header slim com botão global "Ver como Aluno" (promoção do toggle do presentation-viewer,
  cookie `x-view-as-student`, barra de preview + saída clara) e menu de conta com seção Workspace
  (troca via `switchWorkspace`).

### WP5 — padrão + morte do lens
- AC5.1: `RoleLensSwitcher` removido do header do padrão (`header.tsx:100`) e do `layout.tsx`.
- AC5.2: `analytics/page.tsx` (`isManagerLensView`) e `admin/notifications/page.tsx` (`managerLens`→
  `readScope`) religados ao novo eixo (workspace ativo + chapéus + contexto) ANTES de qualquer deleção;
  gestor vê o MESMO escopo de dado que via antes.
- AC5.3: `role-lens-context.ts`, `role-lens/actions.ts`, `role-lens-switcher.tsx` e o ramo lens do
  registry (`navRoleForRoleLens`, `navCtx.lens`, `eligibleRoleLenses`, `switchableRoleLenses`)
  aposentados SÓ se `grep` provar zero consumidores restantes.
- AC5.4: `ContextSwitcher` permanece (só no padrão); sidebar do padrão não mostra item de instrutor.

## Checklist

- [ ] WP1 guards-dado
  - [ ] gate de escopo em `getStudentDetails`
  - [ ] `authorizeTenantAccess` bruto × agregado (gestor puro sem verbatim)
  - [ ] guard por chapéu em `instructor/page.tsx:20`
  - [ ] `middleware.ts` intocado
- [ ] WP2 workspace-plumbing
  - [ ] cookie `x-active-workspace`
  - [ ] `workspace-resolver`
  - [ ] `switchWorkspace` (limpa 3 cookies na travessia)
  - [ ] middleware: guard fail-closed + roteamento pós-login + deep-link + logout cleanup
- [ ] WP3 picker
  - [ ] rota `/workspace` (page + componentes)
  - [ ] loading + footnote + logout, sem sidebar/header
- [ ] WP4 estúdio
  - [ ] route group `(studio)/instructor` + layout raiz próprio
  - [ ] sidebar do Estúdio (badge + itens)
  - [ ] header slim + "Ver como Aluno" global + menu Workspace
- [ ] WP5 padrão + morte do lens
  - [ ] remover `RoleLensSwitcher` do header/layout
  - [ ] religar analytics + notifications ao novo eixo
  - [ ] grep antes de deletar; aposentar eixo lente
  - [ ] sidebar padrão sem item de instrutor

## Verificação global

```
cd apps/web && pnpm lint && pnpm build   # (ou o comando de build do repo)
grep -rn "x-role-lens" apps/web/src packages/shared/src | grep -v node_modules   # após WP5: vazio ou só histórico
grep -rn "isManagerLensView\|managerLens" apps/web/src   # após WP5: nenhuma referência ao eixo lente antigo
```

## Change Log

| Data | Mudança | Autor |
|:---|:---|:---|
| 2026-07-07 | Story criada a partir do briefing Workspace Separation. | J.A.R.V.I.S. (arquiteto) |
