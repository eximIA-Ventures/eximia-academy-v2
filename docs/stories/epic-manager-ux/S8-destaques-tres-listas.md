# EPIC-MANAGER-UX / S8, Destaques do Plano de Ensino em 3 listas (No ritmo / Atenção / Sem acesso recente)

> Status: DRAFT PARA REVISÃO, NÃO IMPLEMENTAR até GO de Hugo.
> Onda: 2 · Data: 2026-07-07 · Executor: @dev · Tipo: feature de UI (dashboard do gestor)
> Referências de design: R1 `docs/stories/epic-manager-ux/design/01-diagnostico-detalhes-alunos.pdf`, R2 `docs/stories/epic-manager-ux/design/02-proposta-detalhes-alunos.pdf`, R3 `docs/stories/epic-manager-ux/design/03-mockup-tela-principal.png`

## User Story

Como gestor na visão "Meu Time", quero que o card "Destaques do Plano de Ensino" tenha uma terceira lista, "Sem acesso recente", ao lado das duas listas de ritmo, para que o funil da tela (recorte, depois destaques, depois tabela) me entregue de imediato QUEM nunca entrou ou sumiu da plataforma. Hoje o card só fala de ritmo de curso, e um aluno que NUNCA acessou aparece, no máximo, diluído como "atrasado": é o problema #8 do R1, ausência de acesso é sinal de triagem distinto de atraso de cronograma e merece coluna própria, como no mockup R3.

## Referência de design

- R1 (diagnóstico): problema **#8**, o card de destaques não separa "sem acesso" de "atrasado", escondendo o sinal mais urgente do gestor.
- R2 (proposta): bloco **"destaques"** dos 5 blocos de "Possíveis mudanças": destaques passam a espelhar a triagem em 3 grupos.
- R3 (mockup): seção "Destaques do Plano de Ensino" em **3 colunas**, a terceira **"SEM ACESSO RECENTE"** com sublabels "Nunca acessou" ou "14+ dias sem acesso". Nota: o formato decidido aqui é "Nunca acessou" ou "Xd sem acesso" (número real de dias), refinamento da Onda 2 sobre o texto genérico do mockup.
- Alinhamento com D-A (Hugo, 2026-07-07): REORGANIZAÇÃO da leitura, o card muda de layout e ganha uma lista, a arquitetura da tela (slots em `manager-dashboard.tsx`) não muda.

## Estado atual (recon arquivo:linha, verificado em 2026-07-07)

- `apps/web/src/components/dashboard/teaching-plan-highlights.tsx`: componente do card.
  - L3-10: `interface StudentPaceStatus { studentName; courseTitle; status: "ahead" | "on_track" | "behind"; progressPct; daysLeft; daysAhead }`.
  - L12-24: props `{ highlights: StudentPaceStatus[]; showEmptyState?: boolean }`.
  - L30-43: empty state global: se `highlights.length === 0` retorna `null`, ou o card com o texto "Nenhum aluno com plano de ensino ativo neste recorte." quando `showEmptyState` é true.
  - L45-46: partição em `completedOnTime` (ahead ou on_track) e `behind`.
  - L50-52: header do card com ícone `Award` (accent-gold) e título "Destaques do Plano de Ensino".
  - L55: grid `grid grid-cols-1 lg:grid-cols-2 gap-4 items-start`.
  - L56-76: coluna 1 (verde, `semantic-success`, ícone `TrendingUp`, label uppercase "No ritmo ou adiantados", `slice(0, 5)` na L61), renderizada só se `completedOnTime.length > 0`.
  - L78-98: coluna 2 (vermelha, `semantic-error`, ícone `AlertTriangle`, label uppercase de atenção/atrasados, `slice(0, 5)` na L83), renderizada só se `behind.length > 0`.
- `apps/web/src/app/(platform)/dashboard/_components/manager-dashboard-page.tsx`: server component que monta os dados.
  - L140: `getStudentDetails(tenantId, activeAreaId, { restrictToStudentIds: teamScope })`, roster já escopado pelo time (RPCs SECURITY DEFINER, fail-closed).
  - L151-172: `studentDetails`: post-filter `teamSet` + strip LGPD server-side (`recentSessions: []`, `recentReflections: []` na L159) + enriquecimento de `subteam`.
  - L185: `highlightScope = teamScope`.
  - L207-214: `type PaceStatus` local (mesmo shape do componente).
  - L215-265: cálculo de `paceHighlights` por enrollment ATIVO em curso com `deadline_days` (L244 `expectedPct`, L253 classificação ahead/on_track/behind, L260-264 sort com behind primeiro).
  - L287-291: render do slot: `paceHighlights.length > 0 || teamRecortePanel ? <TeachingPlanHighlights highlights={paceHighlights} showEmptyState={!!teamRecortePanel} /> : undefined`.
- `apps/web/src/components/dashboard/manager-dashboard.tsx`: L32 prop `teachingPlanHighlights?: React.ReactNode`, L89 renderizada logo após o `teamRecortePanel` (L86). Nada muda aqui.
- `apps/web/src/app/(platform)/instructor/page.tsx`: **segundo consumidor**. L3 import, L149 `<TeachingPlanHighlights highlights={paceHighlights} />` SEM `showEmptyState` e, após S8, SEM `noAccess`. O instrutor NÃO ganha a terceira coluna nesta spec.
- `apps/web/src/lib/engagement-helpers.ts`: L67 `INACTIVE_DAYS = 14`, L68 `AT_RISK_DAYS = 5`, L250-253 `daysSinceLastActivity` (null sem sessão). Limiares canônicos que a taxonomia da Onda 2 espelha.
- `apps/web/src/components/analytics/student-insights-table.tsx`: L37-53 `StudentInsightRow` (campos usados aqui: `full_name` L39, `lastSessionDate: string | null` L42, `totalSessions` L43).
- S7 (Onda 2, dependência): cria `apps/web/src/lib/student-triage.ts` com `computeStudentRitmo` / `computeStudentTriagem` / `daysSinceLastSession` puros e, em `manager-dashboard-page.tsx`, produz APÓS o bloco de pace (pós-L265) a variável NOVA `triagedStudentDetails` (cópia das rows enriquecida com `ritmo?: StudentRitmo` e `triagem?: StudentTriagem`; a const `studentDetails` original nunca ganha `triagem`). S8 CONSOME `triagem` de `triagedStudentDetails`, não recalcula.

## Escopo decidido

1. **`teaching-plan-highlights.tsx` ganha a prop opcional `noAccess`** (`Array<{ studentName: string; detail: string }>`). Quando fornecida (mesmo vazia), o card entra em modo 3 colunas: grid passa de `lg:grid-cols-2` para `lg:grid-cols-3` e as 3 colunas são SEMPRE renderizadas, cada uma com empty state próprio quando vazia. Quando ausente (`undefined`, caso do instrutor), o comportamento atual é preservado byte a byte: grid 2 colunas, colunas condicionais.
2. **Coluna 3 "Sem acesso recente"**: label uppercase no mesmo padrão tipográfico das outras, header em âmbar (`text-accent-gold/70`), itens NEUTROS (fundo `bg-bg-elevated`, ring `ring-border-subtle`, ícone e detail em `text-text-muted`), ícone lucide `UserX`, `slice(0, 5)` igual às outras colunas.
3. **`manager-dashboard-page.tsx` constrói `noAccessHighlights`** a partir das rows de `triagedStudentDetails` (variável enriquecida criada por S7) com `triagem === "sem_acesso"` (taxonomia T2): `detail = "Nunca acessou"` quando `totalSessions === 0` OU `lastSessionDate === null`, senão `daysSinceLastSession(lastSessionDate) + "d sem acesso"`. Ordenação: nunca-acessou primeiro, depois por dias sem acesso decrescente. A condição de render do slot NÃO muda (`paceHighlights.length > 0 || teamRecortePanel` já cobre o caso team); `noAccess` só é passada quando `teamRecortePanel` está presente (gate do modo 3 colunas).
4. **As colunas 1 e 2 NÃO mudam de regra**: partição ahead/on_track (verde) vs behind (vermelho) sobre `paceHighlights`, granularidade por aluno·curso, fórmula de pace intacta (L244-253). Labels, cores, ícones e o subtítulo de cada item permanecem com o texto atual do arquivo, sem alteração.
5. **Diferença de granularidade, registrada e aceita**: colunas 1-2 são por **aluno·curso** (um aluno pode aparecer 2x, uma por curso com deadline); coluna 3 é por **aluno** (triagem T2, uma entrada por pessoa). Consequência esperada, NÃO é bug: um aluno com enrollment adiantado mas 15+ dias sem sessão aparece na coluna 1 E na coluna 3. O mockup R3 aceita essa diferença.
6. **Empty state GLOBAL inalterado**: mesmo gatilho semântico (nada para mostrar em NENHUMA lista) e mesmo texto "Nenhum aluno com plano de ensino ativo neste recorte."; a condição interna passa a considerar também `noAccess` (ver Mudanças de código). Título do card e ícone `Award` não mudam.

## Fora de escopo

- **Lista própria de concluídos** (alunos com enrollment `completed`): registrar como IDEIA FUTURA, o Senhor não pediu. Hoje concluídos ficam fora de `paceHighlights` (filtro `.eq("status", "active")` na L223) e permanecem fora.
- **Clique/navegação nos itens** das listas (nenhum item vira link; detalhe de aluno é exclusivo instructor/admin por D-C).
- Terceira coluna na visão do INSTRUTOR (`instructor/page.tsx` não passa `noAccess`).
- Qualquer mudança na fórmula de pace, nos limiares 5/14 dias, na RPC `auth_team_engagement_signals` ou em `engagement-helpers.ts`.
- Cards KPI de triagem, coluna Ritmo/Ação da tabela e nudges (specs S7/S9/S10 da onda).

## Mudanças de código

### 1. `apps/web/src/components/dashboard/teaching-plan-highlights.tsx`

Novo tipo exportado e prop:

```tsx
import { AlertTriangle, Award, TrendingUp, UserX } from "lucide-react"

export interface NoAccessHighlight {
  studentName: string
  /** "Nunca acessou" ou "Xd sem acesso" (X = dias inteiros desde a última sessão) */
  detail: string
}

interface TeachingPlanHighlightsProps {
  highlights: StudentPaceStatus[]
  showEmptyState?: boolean
  /**
   * S8 (Onda 2): terceira lista, "Sem acesso recente" (triagem sem_acesso, por ALUNO,
   * enquanto highlights é por aluno·curso). Quando a prop é fornecida (mesmo []),
   * o card entra em modo 3 colunas com empty state por coluna. Quando undefined
   * (visão do instrutor), o layout 2 colunas atual é preservado sem mudança.
   */
  noAccess?: NoAccessHighlight[]
}
```

Lógica (pseudocódigo do corpo, preservando o que existe):

```tsx
export function TeachingPlanHighlights({ highlights, showEmptyState, noAccess }: TeachingPlanHighlightsProps) {
  const triageMode = noAccess !== undefined
  const noAccessItems = noAccess ?? []

  // Empty state GLOBAL: só quando NENHUMA lista tem itens (antes: só highlights).
  if (highlights.length === 0 && noAccessItems.length === 0) {
    // bloco atual das L30-43 INALTERADO (null sem showEmptyState; card com o
    // texto "Nenhum aluno com plano de ensino ativo neste recorte." com ele)
  }

  const completedOnTime = highlights.filter((h) => h.status === "ahead" || h.status === "on_track")
  const behind = highlights.filter((h) => h.status === "behind")

  // Grid: 3 colunas no triageMode, 2 no modo legado.
  <div className={`grid grid-cols-1 ${triageMode ? "lg:grid-cols-3" : "lg:grid-cols-2"} gap-4 items-start`}>

  // Colunas 1 e 2: no modo legado (instructor), manter o render CONDICIONAL atual
  // (só aparecem se length > 0). No triageMode, renderizar SEMPRE as duas, e quando
  // vazias mostrar o empty state por coluna abaixo do label:
  //   coluna 1 vazia: <p className="text-xs text-text-muted">Nenhum aluno no ritmo neste recorte.</p>
  //   coluna 2 vazia: <p className="text-xs text-text-muted">Nenhum aluno atrasado neste recorte.</p>
  // Labels, cores, ícones e subtítulos dos ITENS das colunas 1-2: texto atual, sem alteração.

  // Coluna 3 (só no triageMode), sempre renderizada:
  <div className="space-y-2">
    <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-accent-gold/70">
      Sem acesso recente
    </p>
    {noAccessItems.length === 0 ? (
      <p className="text-xs text-text-muted">Todos os alunos acessaram recentemente.</p>
    ) : (
      noAccessItems.slice(0, 5).map((h, i) => (
        <div
          key={`noaccess-${h.studentName}-${i}`}
          className="flex items-center gap-3 rounded-xl bg-bg-elevated px-3 py-2 ring-1 ring-border-subtle"
        >
          <UserX size={14} className="text-text-muted shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{h.studentName}</p>
            <p className="text-xs text-text-muted truncate">{h.detail}</p>
          </div>
        </div>
      ))
    )}
  </div>
```

Notas: `UserX` entra no import lucide existente (L1). Os tokens `bg-bg-elevated`, `ring-border-subtle`, `text-text-muted`, `text-accent-gold` existem no tema (`apps/web/src/styles/theme.css`, L38-39, L183-191, L211-219); NÃO usar classes de cor default do Tailwind. Âmbar no header + itens neutros: "sem acesso" é sinal de triagem, não o vermelho de atraso de cronograma.

### 2. `apps/web/src/app/(platform)/dashboard/_components/manager-dashboard-page.tsx`

Depois do bloco de `paceHighlights` (L215-265) e do enriquecimento feito por S7 APÓS o bloco de pace (pós-L265), que cria a variável `triagedStudentDetails`, construir a lista da coluna 3:

```tsx
import type { NoAccessHighlight } from "@/components/dashboard/teaching-plan-highlights"
import { daysSinceLastSession } from "@/lib/student-triage" // export real de S7

// S8: terceira lista dos destaques, POR ALUNO (triagem T2), derivada das rows já
// escopadas/enriquecidas. Nenhuma query nova: sem_acesso = nunca acessou OU >14d.
const noAccessHighlights: NoAccessHighlight[] = triagedStudentDetails
  .filter((s) => s.triagem === "sem_acesso")
  .map((s) => {
    const never = s.totalSessions === 0 || s.lastSessionDate === null
    const days = never ? null : daysSinceLastSession(s.lastSessionDate)
    return {
      studentName: s.full_name,
      detail: never ? "Nunca acessou" : `${days}d sem acesso`,
      _never: never,
      _days: days ?? 0,
    }
  })
  .sort((a, b) => (a._never !== b._never ? (a._never ? -1 : 1) : b._days - a._days))
  .map(({ studentName, detail }) => ({ studentName, detail }))
```

E atualizar as props do slot (L287-291), MANTENDO a condição de render atual (`paceHighlights.length > 0 || teamRecortePanel`, que já cobre o caso team). O modo 3 colunas é gated pela presença do recorte: a visão gestor de contexto ORGANIZAÇÃO (kind "manager" em `dashboard/page.tsx:97`, que renderiza `ManagerDashboardPage` SEM `teamRecortePanel`) NÃO recebe `noAccess` e permanece 2 colunas:

```tsx
teachingPlanHighlights={
  paceHighlights.length > 0 || teamRecortePanel ? (
    <TeachingPlanHighlights
      highlights={paceHighlights}
      showEmptyState={!!teamRecortePanel}
      noAccess={teamRecortePanel ? noAccessHighlights : undefined}
    />
  ) : undefined
}
```

Contrato real do helper de S7 (reusado aqui, NÃO duplicar): `daysSinceLastSession(lastSessionDate: string | null, now?: number): number`, retornando `Infinity` para `null`. Por isso o guard `never` acima trata `lastSessionDate === null` como nunca-acessou no detail, cobrindo o edge `totalSessions > 0` com `lastSessionDate === null` (que T2 classifica como `sem_acesso`) sem interpolar `Infinity` no texto. Para rows `sem_acesso` com data conhecida, `daysSinceLastSession > 14` é garantido pela definição de T2.

### 3. `apps/web/src/app/(platform)/instructor/page.tsx`

**Nenhuma mudança.** L149 continua `<TeachingPlanHighlights highlights={paceHighlights} />`; sem `noAccess`, o componente fica no modo 2 colunas atual.

## Dados-RLS-Segurança

- **Zero queries novas e zero superfícies novas.** `noAccessHighlights` é derivação em memória de `studentDetails`, que já chega escopado pelo time via `getStudentDetails(restrictToStudentIds: teamScope)` (L140), com `teamScope` resolvido pelas RPCs SECURITY DEFINER fail-closed de `apps/web/src/lib/area-context.ts` e defence-in-depth pelo `teamSet` (L151-152). Nada desta spec toca RLS, migrations ou service client.
- **LGPD (D-C) preservada**: a coluna 3 exibe apenas `full_name` e um detail derivado de METADADOS (`totalSessions`, `lastSessionDate`). Nenhum texto escrito por aluno participa; o strip server-side de `recentSessions`/`recentReflections` (L153-159) permanece intocado e roda ANTES de qualquer derivação. Itens não são clicáveis (perfil/expansão são exclusivos de instructor/admin).
- **Consistência de taxonomia**: `sem_acesso` vem exclusivamente do helper de S7 (`student-triage.ts`), mesma fonte dos cards KPI e da coluna Ação; S8 NÃO reimplementa a regra (limiares canônicos 5/14 de `engagement-helpers.ts` L67-68), evitando drift entre destaques, cards e tabela.

## Acceptance Criteria

- **AC1**: Na visão Meu Time (com `noAccess` fornecida), o card "Destaques do Plano de Ensino" renderiza grid `lg:grid-cols-3` com as 3 colunas SEMPRE presentes; título "Destaques do Plano de Ensino" e ícone `Award` inalterados.
- **AC2**: A coluna 3 tem label uppercase exato "Sem acesso recente" com classe `text-accent-gold/70`, ícone `UserX` em `text-text-muted`, itens com `bg-bg-elevated` e `ring-border-subtle` (neutros, sem verde/vermelho).
- **AC3**: Cada item da coluna 3 mostra `studentName` e o detail exato: "Nunca acessou" quando `totalSessions === 0` OU `lastSessionDate === null`, senão "Xd sem acesso" com X = `daysSinceLastSession(lastSessionDate)`. Máximo de 5 itens (`slice(0, 5)`).
- **AC4**: Ordenação da coluna 3: todos os nunca-acessaram primeiro, depois os demais por dias sem acesso decrescente.
- **AC5**: Apenas rows com `triagem === "sem_acesso"` (campo do S7) entram na coluna 3; a lista é por ALUNO (no máximo 1 entrada por pessoa).
- **AC6**: Colunas 1 e 2 mantêm regra, cores, ícones, labels e subtítulos atuais (partição ahead/on_track vs behind sobre `paceHighlights`, por aluno·curso, `slice(0, 5)`). Nenhuma linha do cálculo de pace (L215-265) muda.
- **AC7**: No modo 3 colunas, coluna vazia mostra seu empty state próprio: "Nenhum aluno no ritmo neste recorte." (col 1), "Nenhum aluno atrasado neste recorte." (col 2), "Todos os alunos acessaram recentemente." (col 3).
- **AC8**: Empty state GLOBAL só aparece quando `highlights` E `noAccess` estão vazios, com o texto atual "Nenhum aluno com plano de ensino ativo neste recorte." e o mesmo gate `showEmptyState`. Em particular: na visão Meu Time com `paceHighlights` vazio mas `noAccessHighlights` com itens, o card RENDERIZA com a coluna 3 populada (`teamRecortePanel` presente já satisfaz a condição atual do slot, que não muda).
- **AC9**: Backward compat: `instructor/page.tsx` (sem `noAccess`) renderiza exatamente como hoje: grid `lg:grid-cols-2`, colunas condicionais, sem coluna 3, sem empty state por coluna.
- **AC10**: Nenhum item das 3 listas é clicável e nenhum conteúdo textual de aluno (reflexão/mensagem) aparece no payload ou na UI do gestor.
- **AC11**: `pnpm --filter @eximia/web typecheck`, `pnpm --filter @eximia/web lint` e `pnpm --filter @eximia/web test` verdes.
- **AC12**: Na visão gestor de contexto ORGANIZAÇÃO (sem `teamRecortePanel`), o card permanece 2 colunas (sem `noAccess`) e a condição de render do slot não muda: nenhuma mudança perceptível nessa visão.

## Plano de testes

First-move rule: esta é uma FEATURE de UI com refactor leve de um componente compartilhado. Primeiro movimento: confirmar a suíte existente VERDE antes de tocar no componente (protege o consumidor instructor); em seguida, escrever os testes novos VERMELHOS da coluna 3 e só então implementar.

1. **Baseline verde (antes de qualquer edição)**: `pnpm --filter @eximia/web test` e `pnpm --filter @eximia/web typecheck`.
2. **Testes novos (vermelhos primeiro)**: criar `apps/web/src/components/dashboard/__tests__/teaching-plan-highlights.test.tsx` (vitest + testing-library, padrão de `summary-cards.test.tsx`):
   - `noAccess` com itens: renderiza label "Sem acesso recente", os details "Nunca acessou" e "17d sem acesso", e o container do grid contém `lg:grid-cols-3`.
   - `noAccess` com 7 itens: apenas 5 renderizados.
   - `noAccess: []` com `highlights` populado: coluna 3 presente com "Todos os alunos acessaram recentemente."; colunas 1-2 vazias mostram seus empty states por coluna quando a partição correspondente é vazia.
   - `highlights: []` e `noAccess` com itens: card renderiza (NÃO cai no empty global) com coluna 3 populada.
   - `highlights: []`, `noAccess: []`, `showEmptyState: true`: texto global "Nenhum aluno com plano de ensino ativo neste recorte."; com `showEmptyState` ausente: render `null`.
   - SEM `noAccess` (modo instructor): grid contém `lg:grid-cols-2`, coluna "Sem acesso recente" AUSENTE, colunas condicionais como hoje.
3. **Ordenação (unit, na página)**: teste puro da construção de `noAccessHighlights` (extrair a derivação para função pura local ou testar via fixture no teste do helper de S7): nunca-acessou antes de 20d, 20d antes de 15d.
4. **Regressão**: `pnpm --filter @eximia/web test` (suíte inteira, incluindo `manager-dashboard.test.tsx`), `pnpm --filter @eximia/web typecheck`, `pnpm --filter @eximia/web lint`.
5. **Smoke manual**: login como gestor no tenant de teste, visão Meu Time em Diretos e Hierarquia: conferir 3 colunas, sublabels e que o instrutor segue com 2 colunas.

## Dependências

- **S7 (motor de triagem + 4 cards, cria `student-triage.ts`)**: BLOQUEANTE. S8 consome (a) a variável `triagedStudentDetails` (rows enriquecidas com `triagem?: StudentTriagem`, criada por S7 em `manager-dashboard-page.tsx` após o bloco de pace) e (b) o helper puro `daysSinceLastSession` exportado de `apps/web/src/lib/student-triage.ts` (contrato de S7: `null` retorna `Infinity`). Nunca duplicar a função em S8.
- **S9 (tabela simplificada da visão gestor)**: NÃO bloqueante, mas as contagens do card "Sem acesso" de S7 e os itens da coluna 3 de S8 DEVEM bater (mesma fonte `triagem`), critério de coerência da onda.
- Nenhuma dependência de migration, RPC ou endpoint.

## Riscos

- **Aluno em duas colunas ao mesmo tempo** (col 1 por pace de curso, col 3 por triagem de acesso): comportamento ESPERADO pela diferença de granularidade, documentado no Escopo item 5 e aceito pelo mockup R3. Registro aqui para o QA não abrir bug.
- **Drift de taxonomia** se alguém recalcular "sem acesso" localmente em vez de usar `triagem` do S7: mitigado pelo AC5 e pela regra de single source em Dependências.
- **Regressão no instrutor** (componente compartilhado): mitigada pela prop opcional com modo legado intocado (AC9) e pelo baseline verde antes da edição.
- **Nomes homônimos como key** na coluna 3: mitigado pelo sufixo de índice no `key`, padrão das colunas atuais.
- **Coluna 3 densa em times grandes**: `slice(0, 5)` limita o card; a lista completa vive na tabela (S7), o card é vitrine, não inventário.
- **Ideia futura registrada (fora de escopo)**: quarta lista de concluídos (enrollments `completed`, filtrados fora na L223); só entra se o Senhor pedir.
