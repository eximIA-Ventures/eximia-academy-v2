# EPIC-MANAGER-UX / S11, Reorganização do layout da visão Meu Time no funil de decisão (recorte, cards, destaques, tabela)

> Status: DRAFT PARA REVISÃO, NÃO IMPLEMENTAR até GO de Hugo.
> Onda: 2 · Data: 2026-07-07 · Executor: @dev · Tipo: refactor (reorganização de JSX, zero mudança de dados)
> Referências de design: R1 `docs/stories/epic-manager-ux/design/01-diagnostico-detalhes-alunos.pdf`, R2 `docs/stories/epic-manager-ux/design/02-proposta-detalhes-alunos.pdf`, R3 `docs/stories/epic-manager-ux/design/03-mockup-tela-principal.png`

## User Story

Como gestor abrindo a visão Meu Time, quero que a tela se apresente como um funil de decisão (primeiro QUEM estou analisando, depois O CENÁRIO GERAL em cards e destaques, e só então A INVESTIGAÇÃO INDIVIDUAL na tabela), para que eu leia a saúde do time de cima para baixo sem precisar caçar a informação em blocos genéricos espalhados.

Decisão D-A (Hugo, 2026-07-07): REORGANIZAÇÃO da leitura, não reconstrução. Nenhum bloco é removido; Quick actions, Motor Socrático e Analytics apenas descem. A visão SEM recorte de time (admin/unidade) permanece byte-a-byte na ordem atual.

## Referência de design

Esta spec implementa a "Visão geral, Tela Principal" da proposta R2, bloco 1: "primeiro recorte, depois destaques e por fim investigação individual". Resolve o problema #9 do diagnóstico R1 (falta de hierarquia na apresentação: KPIs genéricos e atalhos administrativos competem visualmente com a informação de gestão do time). O mockup R3 mostra a ordem-alvo da tela: header, bloco "Quem estou analisando?" (pills de recorte), 4 cards de triagem (Alunos analisados / No ritmo / Atenção / Sem acesso), Destaques em 3 colunas, e por último a tabela "Detalhes dos Alunos" com a coluna Ação.

S11 é dona SOMENTE da ORDEM dos blocos e do subtítulo da área de investigação. O conteúdo dos cards de triagem é propriedade de S7; a 3ª coluna dos destaques é de S8; colunas Ritmo/Ação da tabela são de S9/S10.

## Estado atual (recon arquivo:linha)

Fonte de verdade lida integralmente em 2026-07-07. Ponteiros conferidos contra o código real.

1. `apps/web/src/components/dashboard/manager-dashboard.tsx` (RSC, componente `ManagerDashboard`), ordem atual dos blocos dentro de `<div className="space-y-6">` + `<div className="space-y-8">`:
   - L62-82: Hero "Olá, {firstName}" (section com background e gradiente).
   - L86: slot `{teamRecortePanel}` (presente APENAS na visão Meu Time; ver item 3).
   - L89: slot `{teachingPlanHighlights}`.
   - L92-99: `<SummaryCards>` com 4 KPIs genéricos: Cursos (`courses.length`), Sessões Concluídas (`summary.sessionsThisMonth`), Alunos Ativos (`summary.activeStudents`), Engajamento (`${summary.engagementRate}%`). Componente em `apps/web/src/components/dashboard/summary-cards.tsx`.
   - L102-122: Quick actions, grid `grid-cols-2 lg:grid-cols-4` com 4 links (Cursos, Analytics, Usuários, Configurações).
   - L125-140: Socratic KPIs (condicional `socraticKpis &&`), heading "Motor Socrático" + `<SummaryCards>` de 2 itens.
   - L143-149: `<ManagerDashboardClient>` (client, `apps/web/src/components/dashboard/manager-dashboard-client.tsx`): heading "Analytics" (L70 desse arquivo), `PeriodFilter` (L85), filtro de curso, CSV, `EngagementChart` (L94), `CourseAnalyticsTable` (L96).
   - L152-154: `<StudentInsightsTable students={studentDetails} showSubteam={showSubteam} expandable={false} />` (condicional `studentDetails && studentDetails.length > 0`).
   - L156: spacer `<div className="h-6" />`.
   - Props relevantes (L9-41): `teamRecortePanel?: React.ReactNode` (L24), `teachingPlanHighlights?: React.ReactNode` (L32), `teamViewMode`, `focusUserId`.

2. `apps/web/src/components/analytics/student-insights-table.tsx` (client): `CardHeader` L297-316 com `CardTitle` "Detalhes dos Alunos" (L299-302) + busca. A tabela é COMPARTILHADA com a visão instrutor (`apps/web/src/app/(platform)/instructor/page.tsx`, que a renderiza com `expandable` default true). Qualquer texto exclusivo de gestor NÃO pode viver dentro dela sem prop nova; a decisão desta spec é não tocá-la (ver Escopo, item c).

3. `apps/web/src/app/(platform)/dashboard/_components/manager-team-dashboard-page.tsx`: monta o `teamRecortePanel` (L102-115: `<TeamScopeControl>` + `<TeamMemberList>`) e delega para `ManagerDashboardPage` passando o slot (L129). É a ÚNICA origem de `teamRecortePanel`; portanto `Boolean(teamRecortePanel)` é um discriminador confiável de "visão Meu Time" dentro de `ManagerDashboard`.

4. `apps/web/src/app/(platform)/dashboard/_components/manager-dashboard-page.tsx`: resolve dados server-side e renderiza `<ManagerDashboard>` (L277-295). Strip LGPD server-side em L153-159 (`recentSessions: [], recentReflections: []` para gestor); `paceHighlights` em L215-265; o slot `teachingPlanHighlights` é passado quando `paceHighlights.length > 0 || teamRecortePanel` (L287-291). Ou seja: na visão admin/unidade SEM pace ativo, o slot vem `undefined`; na visão team ele SEMPRE vem (com empty state). S11 NÃO altera nada neste arquivo.

5. `apps/web/src/app/(platform)/dashboard/_components/team-scope-control.tsx`: eyebrow "Recorte da equipe" (L44), `OrgDrilldownBreadcrumb` (L49), `TeamViewSwitch` (L50). Intocado por S11.

6. `apps/web/src/components/dashboard/teaching-plan-highlights.tsx`: card "Destaques do Plano de Ensino" (headings L36 e L52), props `{ highlights: StudentPaceStatus[], showEmptyState?: boolean }`. Intocado por S11 (a 3ª coluna "Sem acesso recente" do mockup R3 é de S8).

7. Contexto Onda 2 (specs irmãs): S7 introduz os cards de triagem (Alunos analisados / No ritmo / Atenção / Sem acesso, taxonomia `StudentTriagem` de `apps/web/src/lib/student-triage.ts`) que SUBSTITUEM os `SummaryCards` genéricos na visão team; S8 adiciona a 3ª lista aos destaques; S9/S10 adicionam colunas Ritmo e Ação à tabela. S11 apenas ORDENA esses blocos.

## Escopo decidido

S11 faz APENAS o seguinte, tudo em `apps/web/src/components/dashboard/manager-dashboard.tsx`:

E1. Nova ordem de render QUANDO `teamRecortePanel` está presente (visão Meu Time):
   1. Hero (mantém, sempre primeiro).
   2. `teamRecortePanel` (recorte: quem estou analisando, S6/atual).
   3. Cards de triagem (contrato de S7: prop de DADOS `triageSummary?: TriageSummary` com render condicional interno em `manager-dashboard.tsx`; fallback defensivo: com `triageSummary` ausente, os `SummaryCards` genéricos renderizam NESTA posição, para que S11 possa landar antes de S7 sem buraco visual).
   4. `teachingPlanHighlights` (destaques, S8).
   5. `StudentInsightsTable` (SOBE de último bloco para logo após os destaques), precedida do heading de contexto (E3).
   6. `ManagerDashboardClient` (Analytics: chart + tabela de cursos, desce).
   7. Quick actions (desce).
   8. Socratic KPIs (desce).
   9. Spacer.

E2. Visão SEM `teamRecortePanel` (admin/unidade): ordem atual 100% intacta (hero, destaques quando existirem, KPIs genéricos, quick actions, socratic, analytics, tabela, spacer). Implementação: extrair cada bloco numa constante JSX nomeada e ordenar num `if/else` legível (uma expressão condicional única), SEM duplicar o markup de nenhum bloco.

E3. Heading de contexto da tabela, exclusivo da visão team, ACIMA do call-site da tabela em `manager-dashboard.tsx` (decisão cravada: NÃO adicionar prop `subtitle` à tabela compartilhada, para não tocar `student-insights-table.tsx` nem a visão instrutor). Texto exato:

   "Área de investigação individual: depois do cenário geral, verifique cada aluno."

E4. Nenhum bloco é REMOVIDO da visão team (D-A). Quick actions, Motor Socrático e Analytics apenas descem. Os `SummaryCards` genéricos deixam de aparecer na visão team SOMENTE quando `triageSummary` está presente e os cards de triagem de S7 os substituem (E1.3); na visão admin/unidade eles permanecem sempre.

## Fora de escopo

F1. Sidebar e navegação. Nenhum item de menu muda.
F2. Visão instrutor (`apps/web/src/app/(platform)/instructor/page.tsx`) e qualquer outra superfície que use `StudentInsightsTable`. Zero diff fora de `manager-dashboard.tsx` (+ teste novo).
F3. Remover blocos da tela (Quick actions, Socratic, Analytics ficam, apenas reordenados).
F4. Conteúdo dos cards de triagem, helper `student-triage.ts`, taxonomia `StudentRitmo`/`StudentTriagem`. PROPRIEDADE DE S7. S11 só reserva a POSIÇÃO 3 do funil para o slot.
F5. 3ª coluna/lista dos destaques ("Sem acesso recente"). PROPRIEDADE DE S8.
F6. Colunas Ritmo, Ação, botões Lembrar/Acionar e a ligação com `POST /api/analytics/manager/nudge`. PROPRIEDADE DE S9/S10 (D-B).
F7. Qualquer mudança em `manager-dashboard-page.tsx`, `manager-team-dashboard-page.tsx`, `team-scope-control.tsx`, `teaching-plan-highlights.tsx`, `summary-cards.tsx`, `manager-dashboard-client.tsx` ou `student-insights-table.tsx`. S11 é um refactor de UM componente.
F8. Detalhe do aluno para gestor (expansão de linha, perfil completo). PROIBIDO por D-C; `expandable={false}` e o strip LGPD server-side permanecem exatamente como estão.

## Mudanças de código (POR ARQUIVO)

### A) `apps/web/src/components/dashboard/manager-dashboard.tsx` (único arquivo de produção tocado)

1. NENHUMA prop nova. S11 consome o contrato que S7 crava (S7 §C.4/§D): prop de DADOS `triageSummary?: TriageSummary` (de `@/lib/student-triage`), passada por `manager-dashboard-page.tsx` e renderizada condicionalmente DENTRO de `manager-dashboard.tsx`. S11 apenas extrai esse condicional de S7 numa constante e governa a POSIÇÃO dela no funil:

```tsx
// Condicional criado por S7 (mover, não reescrever):
const triageCardsBlock = triageSummary ? (
  <SummaryCards items={cardsTriagem /* itens definidos por S7 */} />
) : (
  genericKpisBlock
)
```

2. Discriminador da visão e extração dos blocos em constantes JSX (dentro do corpo do componente, antes do `return`; o markup de cada bloco é MOVIDO das linhas atuais, não reescrito):

```tsx
const isTeamView = Boolean(teamRecortePanel)

// Blocos extraídos 1:1 do JSX atual (mover, não editar):
const genericKpisBlock = (
  <SummaryCards items={[/* os mesmos 4 itens de L92-99, inalterados */]} />
)
const quickActionsBlock = (/* grid atual de L102-122, inalterado */)
const socraticBlock = socraticKpis ? (/* bloco atual de L125-140 */) : null
const analyticsBlock = (
  <ManagerDashboardClient
    initialData={data}
    aiDetectionEnabled={aiDetectionEnabled}
    courses={courses}
    teamViewMode={teamViewMode}
    focusUserId={focusUserId}
  />
)
const studentTableBlock =
  studentDetails && studentDetails.length > 0 ? (
    <StudentInsightsTable
      students={studentDetails}
      showSubteam={showSubteam}
      expandable={false}
      variant="manager"   // S9
      canNudge={true}     // S10
    />
  ) : null
```

   Nota: o snippet acima reflete o estado pós-S9/S10 (S11 landa por último). Mover o call-site 1:1 com TODAS as props que S9/S10 tiverem adicionado no momento do merge, sem remover nenhuma; copiar uma versão antiga do call-site regrediria as colunas Ritmo/Ação e o hard guard LGPD.

3. Render condicional por visão (substitui o miolo atual de L84-157; o Hero L62-82 permanece fora do condicional, sempre primeiro):

```tsx
<div className="space-y-8">
  {isTeamView ? (
    <>
      {/* Funil de decisão (R2 bloco 1): recorte -> cenário geral -> investigação */}
      {teamRecortePanel}
      {triageCardsBlock}
      {teachingPlanHighlights}
      {studentTableBlock && (
        <div className="space-y-3">
          <p className="text-xs text-text-muted">
            Área de investigação individual: depois do cenário geral, verifique cada aluno.
          </p>
          {studentTableBlock}
        </div>
      )}
      {analyticsBlock}
      {quickActionsBlock}
      {socraticBlock}
    </>
  ) : (
    <>
      {/* Ordem legada intacta (admin/unidade), byte-a-byte */}
      {teachingPlanHighlights}
      {genericKpisBlock}
      {quickActionsBlock}
      {socraticBlock}
      {analyticsBlock}
      {studentTableBlock}
    </>
  )}
  <div className="h-6" />
</div>
```

   Notas de implementação:
   - No branch legado, `teamRecortePanel` é sempre `undefined` (única origem: `manager-team-dashboard-page.tsx:102-115`); mantê-lo fora desse branch é seguro.
   - O heading de E3 usa tokens da casa (`text-text-muted`), nunca classes de cor default do Tailwind (tema oklch próprio em `apps/web/src/styles/theme.css`).
   - O wrapper `<div className="space-y-3">` agrupa heading + tabela para o espaçamento interno ser menor que o `space-y-8` entre blocos do funil.
   - Discriminador dos cards é `triageSummary` (contrato de S7): ausente, `triageCardsBlock` cai no fallback `genericKpisBlock`; quando S7 landar e a page passar `triageSummary`, os cards de triagem assumem a posição sem novo diff em S11.

4. Produtor do dado (fora do escopo de S11): `manager-dashboard-page.tsx` já passa `triageSummary` a `<ManagerDashboard>` quando S7 landa (S7 §C.4). S11 não cria produtor nem prop nova, apenas posiciona o bloco consumidor no funil.

### B) `apps/web/src/components/dashboard/__tests__/manager-dashboard-order.test.tsx` (NOVO, teste)

Teste de ordem com Vitest + Testing Library (padrão já existente em `apps/web/src/components/__tests__/`). Shape:

```tsx
// mocks leves de ManagerDashboardClient / StudentInsightsTable / SummaryCards
// (vi.mock) rendendo marcadores textuais, para o teste ser de ORDEM, não de conteúdo.
function domOrder(container: HTMLElement, markers: string[]): string[] {
  const text = container.textContent ?? ""
  return [...markers].sort((a, b) => text.indexOf(a) - text.indexOf(b))
}

it("visão team ordena funil: recorte, cards, destaques, tabela, analytics, actions, socratic", ...)
it("visão team sem triageSummary usa SummaryCards genéricos na posição 3 (fallback)", ...)
it("visão admin/unidade preserva a ordem legada", ...)
it("heading de investigação individual só existe na visão team", ...)
```

## Dados-RLS-Segurança

- ZERO mudança de dados. S11 não adiciona query, não altera props de dados, não muda payload servidor-cliente. É reordenação de JSX já renderizado.
- LGPD (D-C) preservada por construção: o strip server-side de `recentSessions`/`recentReflections` (`manager-dashboard-page.tsx:153-159`) e o `expandable={false}` do call-site da tabela (hoje L153 de `manager-dashboard.tsx`) são MOVIDOS intactos para `studentTableBlock`. O diff não pode alterar o valor de `expandable` nem de `showSubteam`.
- Nenhum gate de papel/lente é tocado: o discriminador `isTeamView` deriva da PRESENÇA do slot `teamRecortePanel`, que só é montado pelo caminho já gated de `manager-team-dashboard-page.tsx` (focus validado contra `auth_subtree_user_ids()`, RPCs SECURITY DEFINER fail-closed em `apps/web/src/lib/area-context.ts`). S11 não cria superfície nova de decisão de acesso.
- A visão instrutor não é afetada: `student-insights-table.tsx` fica sem diff, então o comportamento `expandable` default true do instrutor (`instructor/page.tsx`) permanece.

## Acceptance Criteria

AC1. Na visão Meu Time (com `teamRecortePanel`), a ordem visual do DOM é exatamente: Hero, painel de recorte ("Recorte da equipe"), cards de triagem (ou `SummaryCards` genéricos enquanto S7 não landa), "Destaques do Plano de Ensino", heading de investigação + tabela "Detalhes dos Alunos", "Analytics" (chart + tabela de cursos), Quick actions, "Motor Socrático", spacer.

AC2. Na visão admin/unidade (sem `teamRecortePanel`), a ordem visual é idêntica à atual: Hero, destaques (quando o slot existir), KPIs genéricos, Quick actions, Motor Socrático, Analytics, tabela, spacer. Nenhuma mudança perceptível nessa visão.

AC3. O texto "Área de investigação individual: depois do cenário geral, verifique cada aluno." aparece imediatamente acima do card da tabela APENAS na visão Meu Time; não aparece na visão admin/unidade nem na visão instrutor. Verificável: grep do literal retorna exatamente 2 ocorrências, 1 em `manager-dashboard.tsx` (produção) e 1 no teste `manager-dashboard-order.test.tsx`; nenhuma em `student-insights-table.tsx` ou `instructor/page.tsx`.

AC4. Nenhum bloco foi removido da visão team: Quick actions, Motor Socrático e Analytics continuam renderizando (D-A). Quando `triageSummary` está presente, os `SummaryCards` genéricos NÃO renderizam na visão team; quando ausente, renderizam na posição 3 (fallback).

AC5. `apps/web/src/components/analytics/student-insights-table.tsx` tem ZERO diff. O call-site preserva `expandable={false}`, `showSubteam={showSubteam}`, `variant="manager"` e `canNudge={true}` byte-a-byte (todas as props vigentes pós-S9/S10 no momento do merge).

AC6. Nenhum arquivo de produção além de `manager-dashboard.tsx` tem diff (`git diff --stat` mostra apenas ele + o teste novo). Nenhuma query nova, nenhum fetch novo, nenhuma prop de dados alterada (S11 consome `triageSummary` já criada por S7, sem prop nova).

AC7. Quando `studentDetails` é vazio/ausente, o heading de E3 também não renderiza (heading sem tabela é ruído; o wrapper condicional `studentTableBlock &&` cobre isto).

AC8. `pnpm --filter @eximia/web typecheck`, `pnpm --filter @eximia/web lint` e `pnpm --filter @eximia/web test` passam.

## Plano de testes (first-move rule)

Tipo: refactor. First-move rule de refactor: confirmar a suíte VERDE antes de qualquer mudança estrutural e mantê-la verde do início ao fim (nenhuma janela intencional de vermelho).

T0 (antes de tocar código). Baseline verde:
```
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web lint
pnpm --filter @eximia/web test
```

T1 (AC1). `manager-dashboard-order.test.tsx`: render com `teamRecortePanel` (nó marcador) e `triageSummary` (fixture de dados); assert de que os índices textuais no DOM seguem: recorte < triagem < destaques < heading de investigação < tabela < Analytics < Quick actions < Socrático.

T2 (AC4, fallback). Mesmo render SEM `triageSummary`: o marcador dos `SummaryCards` genéricos aparece entre recorte e destaques; com `triageSummary`, os genéricos NÃO aparecem.

T3 (AC2, não-regressão). Render SEM `teamRecortePanel`: ordem legada (destaques < KPIs genéricos < Quick actions < Socrático < Analytics < tabela) e AUSÊNCIA do heading de E3.

T4 (AC3/AC7). Heading presente só quando `isTeamView && studentTableBlock`; render team com `studentDetails=[]` não mostra o heading.

T5 (AC5/AC6, verificação estática). Comandos literais:
```
git diff --stat            # apenas manager-dashboard.tsx + teste novo
git diff -- apps/web/src/components/analytics/student-insights-table.tsx   # vazio
grep -rn "Área de investigação individual" apps/web/src | wc -l            # 2 (1 em manager-dashboard.tsx + 1 no teste)
grep -n "expandable={false}" apps/web/src/components/dashboard/manager-dashboard.tsx  # presente
grep -n 'variant="manager"' apps/web/src/components/dashboard/manager-dashboard.tsx   # presente (S9 preservada)
grep -n "canNudge" apps/web/src/components/dashboard/manager-dashboard.tsx            # presente (S10 preservada)
```

T6 (smoke manual). `pnpm --filter @eximia/web dev`, logar como gestor com time (visão Meu Time) e como admin: conferir as duas ordens e que nada sumiu.

## Dependências

- S7 (cards de triagem) e S8 (3ª lista dos destaques): a ordem do funil só entrega o valor completo com elas; por isso S11 pode ser a ÚLTIMA da onda a landar. O fallback de E1.3 remove a dependência DURA de S7 (S11 não quebra se landar antes), mas o GO de merge recomendado é após S7/S8.
- Alinhamento de contrato com S7: S11 adota o mecanismo de S7 (prop de dados `triageSummary?: TriageSummary` + condicional interno em `manager-dashboard.tsx`), sem criar slot ReactNode próprio; a posição no funil é o contrato de S11, o mecanismo dos cards é de S7.
- S9 e S10: S11 landa DEPOIS delas (sequenciamento do overview), porque MOVE o call-site da tabela que ambas alteram (`variant="manager"` de S9, `canNudge={true}` de S10); o move deve preservar essas props 1:1 (AC5/T5).
- Consome sem alterar: `manager-team-dashboard-page.tsx` (origem única de `teamRecortePanel`), `manager-dashboard-page.tsx` (produtor dos slots), `teaching-plan-highlights.tsx`, `summary-cards.tsx`, `manager-dashboard-client.tsx`, `student-insights-table.tsx`.

## Riscos

R1. Divergência silenciosa entre os dois branches ao longo do tempo (alguém edita um bloco só num branch). Mitigação: blocos extraídos em CONSTANTES únicas reutilizadas pelos dois branches (E2 proíbe duplicar markup); o teste de ordem T1/T3 pega remoção acidental.
R2. Divergência de contrato com S7 se as duas stories forem implementadas em paralelo. Mitigação: o contrato dos cards é o de S7 (`triageSummary` + condicional interno) e S11 apenas o reposiciona; quem landar segundo move o condicional vigente, sem criar mecanismo novo.
R3. Regressão sutil na visão admin/unidade por reordenar o JSX (ex.: perder o `teachingPlanHighlights` do branch legado, que hoje renderiza para admin quando há pace ativo, `manager-dashboard-page.tsx:287-291`). Mitigação: T3 trava a ordem legada incluindo os destaques; AC2 exige identidade visual.
R4. O heading de E3 duplicar semanticamente o `CardTitle` "Detalhes dos Alunos". Mitigação: heading em `text-xs text-text-muted` (hierarquia abaixo do título do card); a alternativa de prop na tabela foi descartada de propósito para não tocar a superfície compartilhada com instrutor.
R5. Quick actions descerem pode reduzir o uso dos atalhos administrativos. Aceito por decisão de produto (D-A); a visão admin/unidade mantém os atalhos no topo.
