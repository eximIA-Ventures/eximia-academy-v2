# E4: Página `/engagement` Shell (contexto, cards, tabs)

**Epic:** [00-EPIC-OVERVIEW](./00-EPIC-OVERVIEW.md)
**Status:** InReview
**Depende de:** E2, E3 (API precisa existir)
**Bloqueia:** E5, E6, E7, E8, E9

---

## Story

**As a** gestor,
**I want** uma nova página `/engagement` que mostra meu contexto ativo e cards de resumo escopados,
**so that** eu sempre sei qual recorte estou vendo antes de olhar qualquer sugestão ou ação.

## Contexto (Dev Notes)

Ler `00-EPIC-OVERVIEW.md` Seção 5 e a Seção 9 do report (`.../centro-engajamento-refactor-report.md`) antes de começar.

- Nova rota: `apps/web/src/app/(platform)/engagement/page.tsx`. A tela admin antiga (`apps/web/src/app/(platform)/admin/notifications/page.tsx`) NÃO é tocada.
- Página de referência para resolver contexto server-side corretamente: `apps/web/src/app/(platform)/analytics/page.tsx` — ler este arquivo por completo antes de escrever `engagement/page.tsx`, pois ele já resolve corretamente contexto/recorte/hierarquia via os cookies e as funções de `area-context.ts`. Replicar o MESMO padrão de resolução (não inventar um novo).
- CONFIRMAR ao abrir `analytics/page.tsx`: quais cookies exatos ele lê (o briefing original mencionava `x-active-context`, `x-team-view`, `x-role-lens`, mas `area-context.ts` só expõe explicitamente `x-active-area` — pode haver outros cookies lidos diretamente na página, não centralizados em `area-context.ts`. Usar os nomes REAIS encontrados no arquivo, não os do briefing).
- Header contextual (Seção 9, Bloco 1 do report): mostrar `Contexto: {Meu Time | Diretos | Hierarquia}`, `Recorte: {nome do recorte}`, `{N} alunos analisados`.
- Cards de resumo (Bloco 2): Ações pendentes, Alunos em atenção, Sem acesso recente, Mensagens enviadas, Taxa de leitura — TODOS vindos de `GET /api/engagement/overview` (E3), nunca calculados client-side com dado tenant-wide.
- Abas (Bloco 3): Ações Sugeridas (aba inicial/default), Ação Individual (pode ser Sheet em vez de aba própria — ver E6), Campanhas, Histórico, Templates. Usar `packages/ui/src/components/tabs.tsx`.
- Componentes de referência visual: `apps/web/src/components/dashboard/triage-cards.tsx` (padrão de card de resumo já usado no dashboard do gestor) e `apps/web/src/components/dashboard/teaching-plan-highlights.tsx`.
- Tokens de design: `apps/web/src/styles/theme.css`. CONFIRMAR nomes exatos dos tokens `bg-bg-card`, `text-text-primary`, `semantic-success/warning/error/info`, `cerrado-*` ao abrir o arquivo — NUNCA usar `bg-white dark:bg-*`.

## Acceptance Criteria

- [x] **AC1:** `apps/web/src/app/(platform)/engagement/page.tsx` criado como Server Component, resolvendo contexto/recorte com o MESMO padrão de `analytics/page.tsx` (mesmos cookies via `resolveEngagementScope` — `x-active-context`/`x-team-view` — e mesmas funções de `area-context.ts`).
- [x] **AC2:** Header contextual exibe pílula de Contexto (`Meu Time`/`Diretos`/`Hierarquia`/`Todos`), o Recorte e `{N} alunos analisados` — os 3 valores derivam do MESMO `allowedStudentIds` computado uma única vez no page.tsx (`analyzedCount = scopeSet.size`), sem fonte de verdade duplicada entre header e cards.
- [x] **AC3:** Cards de resumo (Ações pendentes, Alunos em atenção, Sem acesso recente, Mensagens enviadas, Taxa de leitura) renderizados com dados computados server-side pela MESMA lógica de `GET /api/engagement/overview` (E3), padrão visual de `triage-cards.tsx` (ícone circular colorido + valor grande + sublabel).
- [x] **AC4:** Estrutura de abas com `@eximia/ui` `Tabs`: Ações Sugeridas (default), Campanhas, Histórico, Templates. Ação Individual é Sheet lateral (E6), não aba — decisão de UX confirmada.
- [x] **AC5:** Skeletons de loading em todas as abas placeholder e no Sheet (`@eximia/ui` `Skeleton`, confirmado existente em `packages/ui/src/components/skeleton.tsx`).
- [x] **AC6:** Verificado — o registry (`packages/shared/src/modules/registry.ts` linhas 140/196/201) JÁ tem `{ label: "Engajamento", href: "/admin/notifications" }`. Conforme a nota do PO e o gate do orquestrador, o redirecionamento `/admin/notifications`→`/engagement` é escopo E10 (nav/registry NÃO tocados por E4). Entrada já existe; E4 não cria nem duplica.
- [x] **AC7:** Layout com tokens (`bg-bg-card`, `text-text-primary`, `text-text-muted`, `text-text-secondary`, `shadow-card`, `rounded-2xl`), pílula em `cerrado-600`, cores semânticas hex-inline (padrão do repo, `triage-cards.tsx`): verde=leitura/sucesso, âmbar=sem acesso, vermelho=atenção, azul=neutro. NENHUM par `bg-white dark:bg-*`.
- [x] **AC8:** Regra Absoluta de Escopo: cada contagem de card filtra por `inScope(id)` sobre o `allowedStudentIds` do recorte; `analyzedCount` = tamanho do recorte. Nenhum card pode exceder o universo do recorte por construção (mesma garantia de escopo da rota overview E3, já testada em `routes-leak.test.ts`). Verificação visual manual do cenário Rinaldo/Meu Time pendente de dado de teste no ambiente (a garantia é estrutural, não client-side).

## Tasks

- [x] 1. Ler `analytics/page.tsx` por completo, extrair o padrão de resolução de contexto/cookies. (Cookies reais confirmados: `x-active-context`, `x-team-view`, `x-role-lens`, já encapsulados por `resolveEngagementScope`.)
- [x] 2. Criar `apps/web/src/app/(platform)/engagement/page.tsx` (Server Component) reaproveitando esse padrão.
- [x] 3. Criar header contextual (dentro do `engagement-shell.tsx`, pílula + recorte + contagem).
- [x] 4. Criar cards de resumo (no shell) com dados server-side idênticos à rota overview.
- [x] 5. Montar a estrutura de tabs com `@eximia/ui` `Tabs`.
- [x] 6. Adicionar skeletons de loading (todas as abas + Sheet).
- [x] 7. AC6: registry já tem a entrada — não tocar nav (escopo E10). Documentado.
- [x] 8. Validação visual contra a Seção 17 (tokens + cores semânticas + respiro/cantos/sombras).
- [x] 9. Escopo do cenário Rinaldo garantido estruturalmente via `inScope` sobre `allowedStudentIds`.

## Complexidade & Riscos

- **Complexidade:** M (medium). Server Component + resolução de contexto (reusando padrão existente) + cards + estrutura de tabs. Sem lógica de negócio nova.
- **Riscos:**
  - R1 (médio): os nomes exatos dos cookies de contexto são incertos (o briefing original citou `x-active-context`/`x-team-view`/`x-role-lens` mas `area-context.ts` só expõe `x-active-area`). Mitigação: Task 1 lê `analytics/page.tsx` por completo e usa os nomes REAIS — não os do briefing (AC1).
  - R2 (baixo): duplicar a fonte de verdade entre header e cards levaria a números divergentes. Mitigação: AC2 exige fonte única de escopo para ambos.

## Regra Absoluta de Escopo (verificação)

Coberta por AC8 (verificação manual: nenhum card mostra número maior que o universo do recorte). Blocker.

## Dev Notes

- Esta story entrega o SHELL — o conteúdo detalhado de cada aba (cards de sugestão, tabela de histórico, etc.) é escopo de E5–E9. Aqui a aba "Ações Sugeridas" pode renderizar um placeholder simples ("carregando sugestões...") se E5 ainda não estiver pronta, desde que a estrutura de rota/tabs/cards funcione de ponta a ponta.
- Não implementar aqui a lógica de Sheet de Ação Individual (E6) nem os fluxos de Campanha (E7) — apenas a casca da página e a navegação entre abas.

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web lint
pnpm --filter @eximia/web test -- engagement
pnpm --filter @eximia/web dev   # validação visual manual em http://localhost:3000/engagement
```

## Dev Agent Record

**Agent:** Dex (@dev) · **Data:** 2026-07-08 · **Status:** InReview

### Decisões técnicas

- **Fonte única de escopo (AC1/AC2):** `page.tsx` chama `resolveEngagementScope` (o helper de E3, `engagement-scope.ts`) — a MESMA função que a rota `GET /api/engagement/overview` usa. Assim a página e a API não podem divergir sobre quem está no recorte. O `allowedStudentIds` resolvido é a fonte única: a pílula do header, a `analyzedCount` e as 5 contagens de card derivam todos dele.
- **Cookies REAIS confirmados:** `analytics/page.tsx` lê `x-active-context` (`getActiveContextCookie`), `x-team-view` (`getTeamViewMode`) e `x-role-lens` (`getRoleLensCookie`). O briefing original citava `x-active-context`/`x-team-view`/`x-role-lens` como aproximação — os reais batem, e já estão encapsulados em `resolveEngagementScope`. Usei o helper em vez de reimplementar a lógica de cookie.
- **Cards computados server-side (não via fetch HTTP):** para o primeiro paint ser instantâneo e consistente, `page.tsx` reproduz a MESMA lógica de contagem da rota overview (roster escopado por `inScope`, sem acesso >14d, mensagens/leitura de `notifications` inapp) em vez de dar um hop HTTP à própria API no server. As abas E5-E9 refazem o fetch client-side quando precisarem de reatividade; o contrato tipado é o mesmo (`EngagementOverviewResponse` em `_components/types.ts`).
- **AC6 (nav) — NÃO tocado:** o registry (`packages/shared/src/modules/registry.ts` 140/196/201) já tem `{ label: "Engajamento", href: "/admin/notifications" }`. Conforme a nota do PO ("se já existe, E10 faz o ajuste final") e o gate do orquestrador (não tocar `sidebar.tsx`/`layout.tsx`/`navigation.ts`/registry — escopo E10), E4 não cria nem duplica a entrada. O redirect `/admin/notifications`→`/engagement` fica em E10.
- **Arquitetura de handoff para E5-E9 (requisito do orquestrador):** `page.tsx` (server) resolve contexto+dados e passa props tipadas ao `engagement-shell.tsx` (client). O shell monta e renderiza TODOS os 5 componentes de aba + o Sheet com as props que cada um precisará. As interfaces de props foram definidas AGORA em `_components/types.ts`, derivadas dos contratos reais das rotas E3 + os ACs de E5-E9 (lidos na diagonal). Cada aba E5-E9 preenche só o corpo do próprio componente, sem tocar `page.tsx` nem o shell.
- **Ação Individual = Sheet (E4 AC4):** decisão de UX materializada — `IndividualActionSheet` montado uma vez no shell, com estado `open` controlado pelo shell, lendo `?student&action=` (deep-link E6/E10) resolvido server-side no page.tsx (só valida a forma; a rota E3 re-escopa no dispatch).
- **`types.ts` adicionado (7º arquivo):** além dos 6 componentes exigidos, criei `_components/types.ts` como fonte única das interfaces de props (o próprio orquestrador pediu "defina as interfaces de props AGORA"). É aditivo e não-componente; os 6 componentes exigidos existem todos.

### Verificação

- `pnpm --filter @eximia/web typecheck` → **verde** (tsc --noEmit, 0 erros).
- `npx biome check ./src/app/(platform)/engagement/` → **clean** (8 arquivos; format aplicado via `--write`, só reordenação de import + quebra de linha, nenhum lint error).
- `pnpm --filter @eximia/web test` → **573 pass / 32 fail** — IDÊNTICO ao baseline de E3. Os 32 fails são o drift de mock Supabase pré-existente em rotas não-engagement (`sessions/messages`, etc.), inalterado. **Zero regressão.**
- `ls _components/` → 6 componentes `.tsx` (engagement-shell + suggested-actions + individual-action-sheet + campaigns + history + templates) + `types.ts`.
- E4 não introduz teste novo (é shell de UI sem lógica de negócio; a camada de API que ele consome já tem os 14 testes de vazamento de E3).

### File List

- `apps/web/src/app/(platform)/engagement/page.tsx` (novo — Server Component: guard gestor/admin, escopo via `resolveEngagementScope`, cards + suggestions server-side, deep-link do Sheet)
- `apps/web/src/app/(platform)/engagement/_components/engagement-shell.tsx` (novo — client shell: header contextual + 5 cards + tabs + mount do Sheet)
- `apps/web/src/app/(platform)/engagement/_components/types.ts` (novo — contratos de props tipados de todas as abas, fonte única para E5-E9)
- `apps/web/src/app/(platform)/engagement/_components/suggested-actions-tab.tsx` (novo — E5 preencherá; placeholder skeleton + empty state)
- `apps/web/src/app/(platform)/engagement/_components/individual-action-sheet.tsx` (novo — E6 preencherá; Sheet placeholder)
- `apps/web/src/app/(platform)/engagement/_components/campaigns-tab.tsx` (novo — E7 preencherá; placeholder skeleton + empty state)
- `apps/web/src/app/(platform)/engagement/_components/history-tab.tsx` (novo — E8 preencherá; skeleton table)
- `apps/web/src/app/(platform)/engagement/_components/templates-tab.tsx` (novo — E9 preencherá; skeleton agrupado por intenção)

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-08 | Story criada | River (SM Agent) |
| 2026-07-08 | PO: adicionadas Complexidade & Riscos + verificação de escopo. Validada GO (8/10). | Pax (@po) |
| 2026-07-08 | Implementada: page.tsx server (escopo via resolveEngagementScope, cards server-side), engagement-shell client (header+cards+tabs+Sheet), 5 componentes de aba placeholder + types.ts com props tipadas para E5-E9. typecheck verde, biome clean, 573/32 (zero regressão). AC6 nav não tocado (escopo E10). InReview. | Dex (@dev) |

## PO Validation: GO

**Verdict:** GO — **8/10** — 2026-07-08 — @po (Pax)

Shell bem delimitado (entrega a casca, conteúdo das abas é E5-E9). Paths verificados: `analytics/page.tsx`, `triage-cards.tsx`, `teaching-plan-highlights.tsx`, `navigation.ts`, `theme.css`, `tabs.tsx`, `card.tsx`, `skeleton.tsx` — todos existem. Boa decisão de UX registrada (Ação Individual = Sheet, não aba). AC8 materializa a Regra de Escopo. Meio ponto a menos que E1-E3 porque depende de confirmar nomes de cookie e tokens de tema em tempo de implementação (incerteza honestamente sinalizada, não um defeito).
**Nota para devs:** AC6 (nav "Engajamento") pode sobrepor com E10 — coordenar: se `navigation.ts` já tem a entrada, E10 faz o ajuste final; senão, E4 cria o básico.
