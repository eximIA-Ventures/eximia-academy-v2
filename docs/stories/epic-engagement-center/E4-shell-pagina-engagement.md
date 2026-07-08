# E4: Página `/engagement` Shell (contexto, cards, tabs)

**Epic:** [00-EPIC-OVERVIEW](./00-EPIC-OVERVIEW.md)
**Status:** Draft
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

- [ ] **AC1:** `apps/web/src/app/(platform)/engagement/page.tsx` criado como Server Component, resolvendo contexto/recorte com o MESMO padrão de `analytics/page.tsx` (mesmos cookies, mesmas funções de `area-context.ts`).
- [ ] **AC2:** Header contextual exibe `Contexto: {valor}`, `Recorte: {valor}`, `{N} alunos analisados` — os 3 valores vêm do MESMO cálculo de escopo usado para os cards (nenhuma fonte de verdade duplicada entre header e cards).
- [ ] **AC3:** Cards de resumo renderizados a partir de `GET /api/engagement/overview` (E3): Ações pendentes, Alunos em atenção, Sem acesso recente, Mensagens enviadas, Taxa de leitura. Usar `packages/ui/src/components/card.tsx` seguindo o padrão visual de `triage-cards.tsx`.
- [ ] **AC4:** Estrutura de abas com `packages/ui/src/components/tabs.tsx`: Ações Sugeridas (default/inicial), Campanhas, Histórico, Templates. (Ação Individual é tratada como Sheet lateral em E6, não como aba própria — ver decisão de UX na Seção 11 do report: "Ela pode ser uma aba, modal, drawer lateral... o importante é preservar contexto". Esta story decide: Sheet lateral, consistente com E6.)
- [ ] **AC5:** Skeletons de loading para cards e para o conteúdo de cada aba enquanto os dados de `GET /api/engagement/overview` carregam (usar `packages/ui/src/components/` — CONFIRMAR se existe `skeleton.tsx` ou equivalente).
- [ ] **AC6:** Navegação do gestor (`apps/web/src/lib/navigation.ts`) ganha (ou atualiza) o item "Engajamento" apontando para `/engagement` — CONFIRMAR se já existe algo chamado "Engajamento" apontando para `/admin/notifications` que precisaria ser redirecionado para a nova rota (isto pode se sobrepor com E10, coordenar: se `navigation.ts` já tiver essa entrada, E10 é quem faz o ajuste final; se não tiver nenhuma, esta story cria a entrada básica e E10 refina).
- [ ] **AC7:** Layout visual segue a direção da Seção 17 do report: fundo claro levemente quente, cards grandes com bordas suaves, muito respiro, cantos arredondados, sombras leves, laranja/coral para ação principal, verde para sucesso/no ritmo, vermelho/rosa para risco, âmbar para atenção leve, azul para informação neutra.
- [ ] **AC8:** Regra Absoluta de Escopo (epic overview Seção 2) verificada manualmente: com um usuário de teste gestor com recorte pequeno (ex.: 6 alunos em `Meu Time`), nenhum card mostra um número maior que o universo do recorte atual.

## Tasks

- [ ] 1. Ler `analytics/page.tsx` por completo, extrair o padrão de resolução de contexto/cookies.
- [ ] 2. Criar `apps/web/src/app/(platform)/engagement/page.tsx` (Server Component) reaproveitando esse padrão.
- [ ] 3. Criar componente de header contextual (novo ou reaproveitando algo de `dashboard/`).
- [ ] 4. Criar/adaptar cards de resumo consumindo `GET /api/engagement/overview`.
- [ ] 5. Montar a estrutura de tabs com `packages/ui/src/components/tabs.tsx`.
- [ ] 6. Adicionar skeletons de loading.
- [ ] 7. Atualizar `navigation.ts` (AC6).
- [ ] 8. Validação visual manual contra a Seção 17 do report.
- [ ] 9. Teste manual do cenário Rinaldo/Meu Time (AC8).

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

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-08 | Story criada | River (SM Agent) |
| 2026-07-08 | PO: adicionadas Complexidade & Riscos + verificação de escopo. Validada GO (8/10). | Pax (@po) |

## PO Validation: GO

**Verdict:** GO — **8/10** — 2026-07-08 — @po (Pax)

Shell bem delimitado (entrega a casca, conteúdo das abas é E5-E9). Paths verificados: `analytics/page.tsx`, `triage-cards.tsx`, `teaching-plan-highlights.tsx`, `navigation.ts`, `theme.css`, `tabs.tsx`, `card.tsx`, `skeleton.tsx` — todos existem. Boa decisão de UX registrada (Ação Individual = Sheet, não aba). AC8 materializa a Regra de Escopo. Meio ponto a menos que E1-E3 porque depende de confirmar nomes de cookie e tokens de tema em tempo de implementação (incerteza honestamente sinalizada, não um defeito).
**Nota para devs:** AC6 (nav "Engajamento") pode sobrepor com E10 — coordenar: se `navigation.ts` já tem a entrada, E10 faz o ajuste final; senão, E4 cria o básico.
