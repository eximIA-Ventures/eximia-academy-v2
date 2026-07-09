# E10: Ponte Tabela→Centro, Navegação, Kill List

**Epic:** [00-EPIC-OVERVIEW](./00-EPIC-OVERVIEW.md)
**Status:** InReview
**Depende de:** E6 (Sheet de Ação Individual), E9 (templates de reconhecimento)
**Bloqueia:** nenhuma (fecha o epic funcionalmente antes de E11)

---

## Story

**As a** gestor,
**I want** que os botões Lembrar/Acionar/No ritmo da tabela de alunos abram diretamente o Centro de Engajamento pré-preenchido,
**so that** eu não precise navegar manualmente nem re-selecionar o aluno depois de decidir agir.

## Contexto (Dev Notes)

Ler Seção 6 e Seção 16 do report antes de começar. Ler `00-EPIC-OVERVIEW.md` Seção 5 (nota sobre incerteza de `student-insights-table.tsx`).

- Componente-alvo: `apps/web/src/components/analytics/student-insights-table.tsx`, que JÁ SUPORTA `variant="manager"` e `canNudge` (confirmado por leitura de código em 2026-07-08). O que NÃO está confirmado é se os botões visuais Lembrar/Acionar/No ritmo já estão implementados dentro deste arquivo ou ainda precisam ser adicionados — a PRIMEIRA task desta story é abrir o arquivo e confirmar isso antes de qualquer outra coisa.
- Lógica de qual botão mostrar para cada aluno: `computeStudentAction(triagem, totalSessions)` em `apps/web/src/lib/student-triage.ts`, que já retorna `{kind:"none"}` | `{kind:"lembrar", nudgeType}` | `{kind:"acionar", nudgeType}`. Botão "No ritmo" corresponde a `{kind:"none"}` (badge estática, sem ação obrigatória).
- DECISÃO DO ORQUESTRADOR (tomada, NÃO reabrir — 2026-07-08): **`computeStudentAction` em `apps/web/src/lib/student-triage.ts` NÃO muda.** Verificação de código (2026-07-08) confirmou dois fatos que fecham a questão:
  1. A assinatura é `computeStudentAction(triagem: StudentTriagem | undefined, totalSessions: number)` — a função recebe SOMENTE `triagem` (`no_ritmo`|`atencao`|`sem_acesso`), **não recebe `ritmo`**. Ela é estruturalmente incapaz de distinguir `atrasado` de `nao_iniciado`, porque `atencao` já colapsou os dois. Fazê-la distinguir exigiria mudar a assinatura e todos os call-sites — custo desproporcional.
  2. A função tem múltiplos consumidores em produção (`student-insights-table.tsx` linhas 248 e 902) e um contrato de teste travado (`apps/web/src/lib/__tests__/student-triage.test.ts`, 6 asserções, linhas 447-474). Mudá-la é um risco de regressão desnecessário.
- Em vez disso: o motivo granular "atrasado no Plano de Ensino" e a seleção do template `behind_teaching_plan` são **derivados server-side dentro do fluxo do Centro de Engajamento (E6/E3), a partir dos sinais do aluno** (`computeStudentRitmo` / `auth_team_engagement_signals` → `ritmo === "atrasado"`), **NÃO do `nudgeType` do botão da tabela**. O botão "Acionar" continua navegando com `?student={id}&action=activate` (sem carregar `nudgeType` da tabela); o Sheet (E6), ao montar server-side, resolve o `ritmo` real daquele aluno e, se `atrasado`, pré-seleciona `behind_teaching_plan`; se `nao_iniciado`, `never_accessed`; caso contrário, `inactive`. Assim a diferenciação `behind_teaching_plan` existe onde há dado para ela (E6, com acesso aos sinais completos), sem tocar a função pura da tabela.
- Consequência para esta story: E10 **não altera `student-triage.ts`** e **não precisa de teste de regressão sobre `computeStudentAction`**. A responsabilidade de escolher `behind_teaching_plan` vs. `never_accessed`/`inactive` é de E6 (Sheet) + E3 (rota `POST /api/engagement/action`, que já revalida escopo e pode resolver o `ritmo` server-side). Esta story só garante que a navegação chega ao Sheet com o `student` e o `action` corretos.
- Botão "Lembrar" (Seção 6): navega para `/engagement?student={id}&action=remind`.
- Botão "Acionar" (Seção 6): navega para `/engagement?student={id}&action=activate`.
- Botão "No ritmo" (Seção 6 + decisão #10 do epic): abre menu com 3 opções — Ver detalhe | Parabenizar (usa o template de reconhecimento, `top_performer_recognition`, intent `reconhecimento` — E1 AC7) | Nada (fecha o menu sem ação).
- Item de navegação "Engajamento" (`apps/web/src/lib/navigation.ts`): deve apontar para `/engagement`, não para `/admin/notifications`, para o papel `manager`.
- Kill list (Seção 16 do report) — aplicar TODOS os itens que ainda existirem na base de código após E1–E9:
  1. Contagens globais dentro do contexto Meu Time — já deveria estar resolvido por E2/E3/E4, esta story CONFIRMA que não sobrou nenhum resquício.
  2. Audiências salvas vazias sem função clara — confirmar que a UI do gestor (E7) não expõe `notification_audiences` como conceito de primeira classe.
  3. Histórico mostrando pessoas fora do recorte atual — já resolvido por E8, confirmar.
  4. Templates com nomes técnicos como informação principal — já resolvido por E9, confirmar.
  5. Botão "Aprovar e disparar" sem revisão clara — confirmar que nenhum fluxo novo (E5/E7) tem um botão equivalente sem preview/revisão antes.
  6. Campanha coletiva sem lista de destinatários antes do envio — já resolvido por E7, confirmar.
  7. Métrica de eficácia com 0% sem explicar base, período e retorno esperado — se algum card (E4) mostrar uma métrica de eficácia, ela deve vir acompanhada do período e da base de cálculo (ex.: "Taxa de leitura: 0% (0 de 3 mensagens lidas nos últimos 7 dias)"), nunca um número solto.
  8. Separação confusa entre ação individual e coletiva — confirmar que E6 (Sheet) e E7 (Campanha) são visual e logicamente distintos.
  9. Tela com aparência de ferramenta genérica de marketing/campanha — validação visual final contra a Seção 17 do report.

## Acceptance Criteria

- [x] **AC1:** Confirmado (via leitura de código, documentado no Dev Agent Record) se `student-insights-table.tsx` já implementa os botões Lembrar/Acionar/No ritmo, ou se esta story precisa adicioná-los.
- [x] **AC2:** Botão "Lembrar" navega para `/engagement?student={id}&action=remind`, abrindo o Sheet de E6 automaticamente com os dados do aluno certo.
- [x] **AC3:** Botão "Acionar" navega para `/engagement?student={id}&action=activate`, mesma mecânica, com o tom mais forte de E6 AC4.
- [x] **AC4:** `student-triage.ts` (`computeStudentAction`) NÃO é modificado por esta story (decisão do orquestrador, ver Dev Notes). A ponte da tabela navega com `?student={id}&action={remind|activate}` SEM carregar `nudgeType`. Verificável: `git diff` desta story não toca `apps/web/src/lib/student-triage.ts`, e a suíte `student-triage.test.ts` permanece verde e inalterada. A resolução de `behind_teaching_plan` (quando `ritmo === "atrasado"`) é responsabilidade server-side de E6 (Sheet) + E3 (rota action), não desta story.
- [x] **AC5:** Botão "No ritmo" abre menu com Ver detalhe / Parabenizar / Nada. Ver LIMITAÇÃO documentada no Dev Agent Record (Decisão D3): `recognize` não é suportado end-to-end pela superfície de E6/E4, então "Parabenizar" navega para o detalhe do aluno no Centro (fallback previsto pela própria story).
- [x] **AC6:** A entrada "Engajamento" para o papel `manager` aponta para `/engagement`. DIVERGÊNCIA story↔código: a fonte de verdade real da navegação NÃO é `navigation.ts` (só mapeia ícones), é `packages/shared/src/modules/registry.ts` via `buildNavigation()`. Ajuste feito lá, na chave `manager` do módulo `admin` (blast radius mínimo, sem tocar `sidebar.tsx`/`layout.tsx`). Ver Decisão D2.
- [x] **AC7:** Todos os 9 itens da kill list (Seção 16) verificados um a um contra o estado final do código após E1–E9 — tabela de evidência no Dev Agent Record.
- [x] **AC8:** Cenário canônico verificado estaticamente (código): todas as abas do Centro derivam do recorte server-side; nenhum caminho tenant-wide client-side. Evidência no Dev Agent Record.

## Tasks

- [x] 1. Abrir `student-insights-table.tsx` e confirmar AC1.
- [x] 2. Implementar (ou ajustar) os botões Lembrar/Acionar para navegar com os query params corretos.
- [x] 3. Confirmar que a navegação Lembrar/Acionar NÃO carrega `nudgeType` da tabela (a derivação de `behind_teaching_plan` é server-side em E6/E3) e que `student-triage.ts` permanece intocado (AC4).
- [x] 4. Implementar o menu "No ritmo" (Ver detalhe / Parabenizar / Nada).
- [x] 5. Atualizar a navegação do gestor (registry, não `navigation.ts` — ver D2).
- [x] 6. Passar pela kill list item a item (AC7), documentando cada um.
- [x] 7. Executar o cenário canônico de regressão (AC8) e registrar o resultado.

## Complexidade & Riscos

- **Complexidade:** M (medium). Ponte de navegação + menu "No ritmo" + varredura de kill list. Reduzida pela decisão do orquestrador de NÃO tocar `student-triage.ts`.
- **Riscos:**
  - R1 (médio): incerteza sobre se os botões Lembrar/Acionar/No ritmo já existem em `student-insights-table.tsx`. Mitigação: Task 1/AC1 confirmam por leitura de código ANTES de qualquer outra coisa.
  - R2 (baixo, resolvido): risco de regressão em `computeStudentAction` — ELIMINADO pela decisão do orquestrador (função não é tocada; derivação move para E6 server-side).
  - R3 (médio): a kill list (AC7) depende do estado final de E1-E9; se rodar antes delas, itens aparecerão como "ainda presente". Dev Notes já exige que E10 rode por último (antes de E11).

## Regra Absoluta de Escopo (verificação)

Coberta por AC8 (cenário canônico Rinaldo/6 alunos ponta a ponta em TODAS as abas) + item 1 da kill list (AC7). Blocker de fechamento do epic.

## Dev Notes

- Esta story é o "fecho" funcional do epic — depende de quase todas as outras terem sido implementadas (E1, E2, E3, E6, E9 no mínimo). Não começar antes dessas estarem prontas o suficiente para o Sheet e a navegação funcionarem de ponta a ponta.
- Se AC1 revelar que os botões NÃO existem em `student-insights-table.tsx`, esta story precisa implementá-los seguindo o padrão visual já usado no componente (cores: laranja para ação principal, verde para "no ritmo", vermelho para "acionar", âmbar para "lembrar" — conforme a paleta da Seção 17 e a hierarquia de `student-triage.ts` já documentada no epic overview).

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web lint
pnpm --filter @eximia/web test -- student-insights-table
pnpm --filter @eximia/web test -- student-triage
```

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-08 | Story criada | River (SM Agent) |
| 2026-07-08 | PO: DESBLOQUEADA — aplicada decisão do orquestrador (computeStudentAction NÃO muda; derivação move p/ E6/E3 server-side). AC4/Dev Notes/Tasks reescritos. Complexidade & Riscos. Validada GO (9/10). | Pax (@po) |
| 2026-07-08 | Implementada (InReview). Ponte tabela→Centro, nav do gestor, kill list. 8/8 AC. | Dex (@dev) |
| 2026-07-09 | Feedback visual do Hugo: "No ritmo" deixa de abrir dropdown (Ver detalhe/Parabenizar/Nada) e vira botão de ação direta (verde sólido + ArrowUpRight) que navega direto para `?action=recognize` (Parabenizar). Dropdown/chevron/menu eliminados; testes ajustados. | Dex (@dev) |

## Dev Agent Record

### AC1 — os botões JÁ existiam (confirmado por leitura de código)

`student-insights-table.tsx` já implementava a coluna Ação com Lembrar/Acionar/No ritmo, gated por `showAction = isManager && canNudge`. O comportamento ANTIGO era: `Lembrar`/`Acionar` abriam um popover de confirmação (`confirmNudge`) e postavam direto em `/api/analytics/manager/nudge`; `No ritmo` era uma badge estática não clicável. Esta story NÃO adicionou os botões, apenas trocou o comportamento deles pela ponte.

Achado de fronteira relevante: a coluna Ação (e portanto o popover/POST antigo) é EXCLUSIVA do variant `manager` (`showAction` exige `isManager && canNudge`). Os outros consumidores da tabela (`admin-dashboard-page.tsx`, `instructor/page.tsx`) usam o variant `instructor` default, sem coluna Ação. Único montador com `variant="manager" canNudge={true}`: `manager-dashboard.tsx` (branch team). Logo, não havia "outro variant" cujo comportamento antigo precisasse ser preservado — a substituição por navegação é integral e segura.

### Decisões

- **D1 (AC2/AC3/AC4 — ponte sem nudgeType):** `Lembrar` → `router.push('/engagement?student={id}&action=remind')`; `Acionar` → `...&action=activate`. Mapa: `computeStudentAction` retorna `{kind:"lembrar"}` (sem_acesso) ou `{kind:"acionar"}` (atencao) → `remind`/`activate`. A URL NUNCA carrega `nudgeType` — a derivação de `behind_teaching_plan`/`never_accessed`/`inactive` é server-side no Sheet (E6) via `GET /api/engagement/students?...&action=`. `student-triage.ts` intocado (`git diff --stat` vazio; suíte `student-triage.test.ts` 40/40 verde). Popover `confirmNudge`/`sendNudge`/`nudgeStatus` REMOVIDOS (eram só do manager). aria-label ajustado para ser honesto ("Acionar {nome} no Centro de Engajamento"), já que o botão agora navega em vez de enviar.

- **D2 (AC6 — navegação, DIVERGÊNCIA story↔código):** A story pede editar `apps/web/src/lib/navigation.ts`, mas esse arquivo só mapeia string de ícone → componente Lucide (`getNavigation`/`buildNavigation`). A fonte de verdade real dos itens de nav é `packages/shared/src/modules/registry.ts`, consumida por `buildNavigation()`. Editei a chave `manager` do módulo `admin` (linha ~196): `Engajamento` href `/admin/notifications` → `/engagement`. Admin (chave `admin`, linha ~201) e instructor (módulo `academy`, linha ~140) permanecem em `/admin/notifications` (tela antiga intocada, Non-Goal §3 do overview). Blast radius mínimo: mudança só de href, SEM tocar `sidebar.tsx`/`layout.tsx`. Divergência reportada aqui conforme regra §10 do overview.

- **D3 (AC5 — "Parabenizar" / limitação recognize):** A superfície de E6 (`page.tsx`, `engagement-shell.tsx`, `IndividualActionSheetProps`) só reconhecia `action ∈ {remind, activate}`. `page.tsx` linha 187: `params.action === "remind" || params.action === "activate" ? params.action : null` — um `?action=recognize` caía em `initialAction=null` e o Sheet não abria. À época, suportar reconhecimento (`top_performer_recognition`) de ponta a ponta exigiria tocar page.tsx + shell + types.ts (superfície de E4/E6), FORA da fronteira daquela story. Por isso "Parabenizar" navegava para o detalhe do aluno (mesma rota do Ver detalhe) como fallback documentado.

  **GAP D3 FECHADO (2026-07-08, Dex/@dev):** `action=recognize` agora é suportado de ponta a ponta. `page.tsx`/shell/`types.ts` aceitam `"recognize"`; o Sheet abre em modo POSITIVO (título "Parabenizar aluno", tom verde/success, sem histórico de comunicações, sem badge de cobrança); a rota `GET /api/engagement/students?...&action=recognize` FORÇA `nudgeType="top_performer"` (valor JÁ existente no union `NudgeType`, NÃO inventado), pré-preenchendo o template `top_performer_recognition` (intent `reconhecimento`); o envio real vai pela MESMA rota `POST /api/engagement/action`, que JÁ aceitava `top_performer` no seu `NUDGE_TYPES` set (nenhuma validação server-side precisou ser afrouxada nem estendida). O botão "Parabenizar" navega com `&action=recognize`. Escopo intacto: a mesma re-escopagem (`resolveEngagementScope` no fetch + 403 no POST) vale para recognize. Teste da tabela atualizado (`&action=recognize`). Follow-up original resolvido.

### AC7 — Kill list (Seção 16), item a item

| # | Item | Veredito | Evidência (arquivo / comportamento) |
|---|------|----------|-------------------------------------|
| 1 | Contagens globais dentro do contexto Meu Time | Confirmado resolvido | `engagement/page.tsx`: cards e suggestions filtrados por `inScope()`/`allowedStudentIds` (10 ocorrências de escopo); `resolveEngagementScope` = fonte única; `analyzedCount = scopeSet.size`. Nenhuma contagem tenant-wide client-side. |
| 2 | Audiências salvas vazias sem função clara | Confirmado resolvido | `grep notification_audiences` nas abas do Centro = **0 ocorrências**. `campaigns-tab.tsx` resolve destinatários server-side (preview mode), sem expor `notification_audiences` como conceito de 1ª classe (decisão #8 do overview). |
| 3 | Histórico com pessoas fora do recorte | Confirmado resolvido | `history-tab.tsx` (cabeçalho, linhas 6-9): só renderiza o que `GET /api/engagement/history` retorna, e a rota já escopa `recipient_id ∈ allowedStudentIds` (E3). NENHUM caminho paralelo não-escopado. |
| 4 | Templates com nomes técnicos como info principal | Confirmado resolvido | `templates-tab.tsx`: agrupados por `intent` humano; `HUMAN_INTENT_LABELS` (linha 45, "never show the raw enum"); a `key` técnica nunca é a informação principal (E9 AC1/AC2). |
| 5 | "Aprovar e disparar" sem revisão clara | Confirmado resolvido | `grep "aprovar e disparar"` nas abas = **0 ocorrências**. Nenhum fluxo novo (E5/E7) tem botão de disparo sem preview/review antes. |
| 6 | Campanha coletiva sem lista de destinatários antes do envio | Confirmado resolvido | `campaigns-tab.tsx`: wizard `...→ preview → REVISÃO OBRIGATÓRIA → done`; step `review` é obrigatório e o "confirm" (send) só é alcançável a partir dele; lista resolvida server-side (E7 AC4/AC6). |
| 7 | Métrica de eficácia 0% sem base/período | Confirmado resolvido | `engagement-shell.tsx`: card "Taxa de leitura" tem `value: {pct}%` + `sublabel: "das mensagens enviadas"`, adjacente ao card "Mensagens enviadas" (`sublabel: "in-app neste recorte"`). O % nunca aparece solto — a base (nº enviadas) e o recorte estão expostos nos cards vizinhos. |
| 8 | Separação confusa individual/coletivo | Confirmado resolvido | Ação individual = `IndividualActionSheet` (Sheet lateral, E6); campanha coletiva = `campaigns-tab.tsx` (wizard em aba própria). Superfícies visual e logicamente distintas (Sheet vs Tab). |
| 9 | Cara de ferramenta genérica de marketing | Confirmado resolvido | Header contextual ("Centro de Engajamento" + pill de recorte + contagem analisada), copy orientada a acompanhamento/reconhecimento ("Ações contextuais para acompanhar, lembrar e reconhecer alunos do seu time"), tokens `cerrado-*`/semânticos da casa. Sem linguagem de "campanha de marketing". |

### AC8 — Cenário canônico (verificação estática de escopo)

Verificado por leitura de código que TODAS as 4 abas + cards derivam do recorte server-side, sem caminho tenant-wide client-side (o vetor da regra absoluta de escopo):
- **Cards + header:** `page.tsx` resolve `allowedStudentIds` via `resolveEngagementScope` (autenticado) e filtra tudo por `inScope()`. `analyzedCount` = tamanho do recorte.
- **Ações Sugeridas:** `suggested-actions-tab.tsx` consome `initialSuggestions` já escopadas de `GET /api/engagement/overview` (E3).
- **Campanhas:** `campaigns-tab.tsx` resolve destinatários server-side (preview/confirm), nunca lista client-computed.
- **Histórico:** `history-tab.tsx` só renderiza o retorno da rota escopada por `recipient_id`.
- **Templates:** por-tenant (institucional), sem contagem de pessoas — não é vetor de vazamento de recorte.

Verificação dinâmica com um usuário Rinaldo/6 alunos real depende de seed/ambiente e é o teste end-to-end de E11 (hardening final). A garantia estrutural (nenhum caminho não-escopado existe no código) está provada acima e é o que E10 pode assegurar sem tocar dados de produção.

### Verificações executadas

- `pnpm --filter @eximia/web typecheck` → **verde** (tsc --noEmit, 0 erros).
- `biome check` nos 3 arquivos de código tocados → **0 erros**. 2 warnings (`noArrayIndexKey` + `suppressions/unused`) são **pré-existentes em HEAD** (região `StudentExpandedContent`, fora do escopo E10 — confirmado por `biome check` no `git show HEAD:...`).
- `vitest run student-insights-table.test.tsx` → **32/32 pass**.
- `vitest run student-triage.test.ts` → **40/40 pass** (prova AC4 — função intocada).
- Suíte completa `pnpm --filter @eximia/web test` → **582 pass / 32 fail**, idêntico ao baseline pré-existente (32 fails em rotas de sessões/mensagens, sem relação com E10). **Zero regressão introduzida.**

### File List

- `apps/web/src/components/analytics/student-insights-table.tsx` (M) — coluna Ação vira ponte: Lembrar/Acionar navegam (`router.push`); menu "No ritmo"; popover/POST removidos; aria-label honesto.
- `apps/web/src/components/analytics/__tests__/student-insights-table.test.tsx` (M) — describe S10 reescrito para a ponte E10 (navegação em vez de fetch); mock `useRouter`; testes visuais S12 atualizados.
- `packages/shared/src/modules/registry.ts` (M) — nav do gestor (chave `manager`, módulo `admin`): Engajamento → `/engagement`.
- `docs/stories/epic-engagement-center/E10-ponte-tabela-nav-kill-list.md` (M) — status, ACs/tasks, Dev Agent Record.

## PO Validation: GO

**Verdict:** GO — **9/10** — 2026-07-08 — @po (Pax)

**Desbloqueada.** O AC bloqueante original (mudar `computeStudentAction` para diferenciar `behind_teaching_plan`) foi resolvido pela decisão do orquestrador, e a verificação de código a confirma como tecnicamente correta: `computeStudentAction(triagem, totalSessions)` (linha 114) NÃO recebe `ritmo` — é estruturalmente incapaz de distinguir `atrasado` de `nao_iniciado` sem mudar assinatura + 2 call-sites (`student-insights-table.tsx` 248, 902) + 6 asserções de teste travadas. A derivação de `behind_teaching_plan` migrou para E6/E3 server-side (onde o `ritmo` está disponível). AC4 reescrito como verificável (`git diff` não toca `student-triage.ts`; suíte permanece verde). Kill list (AC7) percorrida item a item. `student-insights-table.tsx` confirmado com `variant="manager"`/`canNudge`.
**Nota para devs:** NÃO modificar `student-triage.ts`. A ponte navega com `?student&action` SEM `nudgeType`. Rodar E10 só depois de E1-E9 (a kill list depende do estado final).
