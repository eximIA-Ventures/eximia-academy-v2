# EPIC-MANAGER-UX / S7, Motor de triagem por aluno + 4 cards de resumo da visão Meu Time

> Status: DRAFT PARA REVISÃO, NÃO IMPLEMENTAR até GO de Hugo.
> Onda: 2 · Data: 2026-07-07 · Executor: @dev · Tipo: feature (fundação da onda)
> Referências de design: R1 `docs/stories/epic-manager-ux/design/01-diagnostico-detalhes-alunos.pdf`, R2 `docs/stories/epic-manager-ux/design/02-proposta-detalhes-alunos.pdf`, R3 `docs/stories/epic-manager-ux/design/03-mockup-tela-principal.png`

## User Story

Como gestor na visão Meu Time, quero ver, abaixo do recorte da equipe, 4 cards que respondem "quantos alunos estou analisando e quantos estão bem, precisam de atenção ou estão sem acesso", com contagens e percentuais derivados da MESMA classificação que a tabela usará, para entender o estado do time em segundos sem interpretar a tabela linha a linha.

FUNDAÇÃO da Onda 2: cria o helper puro `student-triage.ts` com a taxonomia canônica (RitmoAluno e TriagemAluno), enriquece as rows do roster server-side e materializa o primeiro consumidor visível (os 4 cards). S8, S9, S10 e S11 consomem o MESMO helper, nunca recalculam por conta própria.

## Referência de design

- R1 (diagnóstico): resolve #8 (tabela exige interpretação manual: o gestor cruza Último Acesso, Sessões e Progressão de cabeça) e #9 (falta de hierarquia visual: sem sumário de estado antes do detalhe).
- R2 (proposta): camada de DADOS compartilhada dos 5 blocos + o bloco de sumário.
- R3 (mockup): faixa de 4 cards abaixo de "Quem estou analisando?": "Alunos analisados 6", "No ritmo 3 (50%)", "Atenção 1 (17%)", "Sem acesso 2 (33%)". As demais partes do mockup (3ª coluna dos destaques, colunas Ritmo e Ação) são S8, S9 e S10.

## Estado atual (recon arquivo:linha)

Fonte de verdade lida integralmente em 2026-07-07. Ponteiros conferidos contra o código real.

1. `apps/web/src/app/(platform)/dashboard/_components/manager-dashboard-page.tsx` (RSC, server):
   - linhas 93-102: `teamStudentIds` via RPCs SECURITY DEFINER (`getSubtreeStudentIdsAtNode` / `getManagedTeamStudentIds includeSubtree` / `getDirectTeamStudentIds`, em `apps/web/src/lib/area-context.ts`, fail-closed: `null` colapsa para `[]`). `teamScope` = universo do recorte ativo (Diretos vs Hierarquia vs drill `?focus=`).
   - linha 140: `getStudentDetails(tenantId, activeAreaId, { restrictToStudentIds: teamScope })`.
   - linhas 151-172: `studentDetails` = pós-filtro `teamSet` + strip LGPD server-side (`recentSessions: [], recentReflections: []`, linha 159) + `subteam` quando Hierarquia.
   - linhas 199-265: bloco de pace. `serviceClient` (199), cursos com `deadline_days` (201-205), enrollments `.eq("status", "active")` (223) `.in("student_id", highlightScope...)` (226). Loop (238-258): `expectedPct` (244), `pct` (245), `status` (253). O select da linha 221 TEM `student_id`, mas o loop hoje o descarta. Enrollment `completed` fica fora (223). Não há detecção de "não iniciado": progress null vira 0 e cai em behind.
   - linhas 277-295: `<ManagerDashboard ... studentDetails={studentDetails} teamRecortePanel={teamRecortePanel} ... />`.
2. `apps/web/src/components/dashboard/manager-dashboard.tsx`: linhas 92-99, `<SummaryCards items={[Cursos, Sessões Concluídas, Alunos Ativos, Engajamento%]} />` (KPIs genéricos a substituir na visão Meu Time). Slots `{teamRecortePanel}` (86) e `{teachingPlanHighlights}` (89); `<StudentInsightsTable ... expandable={false} />` (152-154).
3. `apps/web/src/components/dashboard/summary-cards.tsx`: `SummaryCardItem = { icon, label, value, trend?, iconBg?, iconColor? }` (linhas 3-10). Reutilizado sem mudança.
4. `apps/web/src/components/analytics/student-insights-table.tsx` (client): `StudentInsightRow` (linhas 37-53) com `id, full_name, email, subteam?, lastSessionDate: string | null, totalSessions, completedSessions, courseProgressPct?, reflectionsCount, ...`. S7 SÓ adiciona campos opcionais ao tipo.
5. `apps/web/src/lib/engagement-helpers.ts`: `INACTIVE_DAYS = 14` (linha 67), `AT_RISK_DAYS = 5` (linha 68), `getTeamEngagementBuckets` (linha 160), buckets `accessed | devendo | inativos` (prioridade inativos > devendo > accessed), sinais via RPC `auth_team_engagement_signals` (migration `supabase/migrations/20260703010000_auth_team_engagement_signals.sql`).
6. `apps/web/src/app/(platform)/dashboard/_components/manager-team-dashboard-page.tsx`: linhas 87-93 chamam `getTeamEngagementBuckets(..., "direct")` para a strip de membros (modo FIXO direct, Iteração 6). Linhas 102-115 montam `teamRecortePanel`.
7. `apps/web/src/lib/student-triage.ts`: NÃO EXISTE. Criado por esta spec.

## Escopo decidido

E1. Criar o helper puro `apps/web/src/lib/student-triage.ts` com a TAXONOMIA CANÔNICA da Onda 2 (regras literais na seção Mudanças de código): types `StudentRitmo`/`StudentTriagem`, funções puras `computeStudentRitmo`/`computeStudentTriagem` (row + mapa de pace, sem I/O), limiares espelhados de `engagement-helpers.ts` e `computeTriageSummary`.

E2. Em `manager-dashboard-page.tsx`: construir `paceByStudent: Map<string, StudentPace>` DENTRO do loop existente do paceHighlights (pior status do aluno vence, behind no topo), enriquecer cada row de `studentDetails` com `ritmo` e `triagem`, e computar `triageSummary` (analisados, noRitmo, atencao, semAcesso + percentuais `Math.round(n / analisados * 100)`).

E3. Campos OPCIONAIS em `StudentInsightRow` (`student-insights-table.tsx`): `ritmo?: StudentRitmo` e `triagem?: StudentTriagem`. Nesta story são só transporte tipado, nenhuma coluna nova (S9/S10).

E4. UI dos cards em `manager-dashboard.tsx`: prop nova opcional `triageSummary`. Presente (visão Meu Time, `teamRecortePanel` presente): os SummaryCards genéricos das linhas 92-99 são SUBSTITUÍDOS pelos 4 cards de triagem. Ausente (admin/unidade): NADA muda.

E5. Consistência por construção: cards e futuras colunas Ritmo/Ação partem do MESMO helper sobre as MESMAS rows. O universo dos cards segue o RECORTE ativo (Diretos vs Hierarquia vs drill `?focus=`), pois `studentDetails` já é resolvido pelo `teamScope` do modo ativo. Decisão registrada: o filtro fino `?teams=` (S6) NÃO afeta os cards.

E6. `getTeamEngagementBuckets` continua alimentando a strip de membros com a MESMA semântica (limiares 5/14; accessed→no_ritmo, devendo→atencao, inativos→sem_acesso). S7 não o toca.

## Fora de escopo

F1. Mudar buckets ou limiares de `engagement-helpers.ts` (5/14 dias) ou a RPC `auth_team_engagement_signals`. S7 espelha, não redefine.
F2. Refletir o filtro `?teams=` (S6) nos cards. Decisão explícita: cards seguem só o recorte.
F3. Tocar a visão instrutor (`instructor/page.tsx`) ou o gate LGPD do perfil de aluno.
F4. Renderizar as colunas Ritmo (S9) e Ação (S10), a 3ª coluna dos destaques (S8) e qualquer chamada ao endpoint de nudge (S10 consome T3). S7 só entrega o dado.
F5. Mudanças de banco, migrations ou RLS. S7 é 100% camada de aplicação sobre dados já autorizados.

## Mudanças de código (POR ARQUIVO, com assinatura/shape/pseudocódigo)

### A) `apps/web/src/lib/student-triage.ts` (NOVO)

Módulo puro, sem "use client", sem imports de supabase/next. Conteúdo integral esperado:

```ts
// Taxonomia canônica da Onda 2 (EPIC-MANAGER-UX). Fonte única de Ritmo/Triagem
// por aluno. S7 cria; S8/S9/S10/S11 consomem. Limiares ESPELHAM
// engagement-helpers.ts:67-68; mudança futura de limiar DEVE tocar os dois.

export type StudentRitmo = "no_ritmo" | "atrasado" | "nao_iniciado"
export type StudentTriagem = "no_ritmo" | "atencao" | "sem_acesso"
export type StudentPace = "ahead" | "on_track" | "behind"

export const SEM_ACESSO_DAYS = 14 // espelho de INACTIVE_DAYS (engagement-helpers.ts:67)
export const ATENCAO_DAYS = 5 // espelho de AT_RISK_DAYS (engagement-helpers.ts:68)

// Subconjunto de StudentInsightRow que a triagem precisa (mantém a função pura).
export interface TriageInput {
  id: string
  totalSessions: number
  lastSessionDate: string | null
  courseProgressPct?: number
}

// Dias inteiros desde a última sessão. null => Infinity (nunca acessou).
export function daysSinceLastSession(lastSessionDate: string | null, now = Date.now()): number {
  if (!lastSessionDate) return Number.POSITIVE_INFINITY
  return Math.floor((now - new Date(lastSessionDate).getTime()) / 86_400_000)
}

// T1, RitmoAluno (coluna Ritmo, POR ALUNO):
//   nao_iniciado = totalSessions === 0 && (courseProgressPct ?? 0) === 0
//   atrasado     = NAO nao_iniciado && existe enrollment ATIVO em curso com
//                  deadline com pct < expectedPct (mesma formula do
//                  paceHighlights; chega aqui como paceByStudent === "behind")
//   no_ritmo     = caso contrario (inclui ahead, on_track e concluidos)
export function computeStudentRitmo(row: TriageInput, paceByStudent: Map<string, StudentPace>): StudentRitmo {
  if (row.totalSessions === 0 && (row.courseProgressPct ?? 0) === 0) return "nao_iniciado"
  if (paceByStudent.get(row.id) === "behind") return "atrasado"
  return "no_ritmo"
}

// T2, TriagemAluno (cards + coluna Acao + 3a lista dos destaques, particao
// exaustiva; espelha os buckets accessed/devendo/inativos com os limiares 5/14):
//   sem_acesso = totalSessions === 0 OU daysSince(lastSessionDate) > 14
//   atencao    = NAO sem_acesso && (ritmo === "atrasado" OU daysSince > 5)
//   no_ritmo   = resto
// Mapeamento conceitual: accessed -> no_ritmo, devendo -> atencao,
// inativos -> sem_acesso.
export function computeStudentTriagem(row: TriageInput, ritmo: StudentRitmo, now = Date.now()): StudentTriagem {
  const days = daysSinceLastSession(row.lastSessionDate, now)
  if (row.totalSessions === 0 || days > SEM_ACESSO_DAYS) return "sem_acesso"
  if (ritmo === "atrasado" || days > ATENCAO_DAYS) return "atencao"
  return "no_ritmo"
}

export interface TriageSummary {
  analisados: number
  noRitmo: number; atencao: number; semAcesso: number
  noRitmoPct: number; atencaoPct: number; semAcessoPct: number
}

export function computeTriageSummary(triagens: StudentTriagem[]): TriageSummary {
  const analisados = triagens.length
  const count = (t: StudentTriagem) => triagens.filter((x) => x === t).length
  const pct = (n: number) => (analisados > 0 ? Math.round((n / analisados) * 100) : 0)
  const [noRitmo, atencao, semAcesso] = [count("no_ritmo"), count("atencao"), count("sem_acesso")]
  return { analisados, noRitmo, atencao, semAcesso,
    noRitmoPct: pct(noRitmo), atencaoPct: pct(atencao), semAcessoPct: pct(semAcesso) }
}
```

### B) `apps/web/src/components/analytics/student-insights-table.tsx`

Só o tipo. Em `StudentInsightRow` (linhas 37-53), adicionar ao final:

```ts
import type { StudentRitmo, StudentTriagem } from "@/lib/student-triage"
// ... dentro de StudentInsightRow:
  /** Onda 2 (S7): triagem canônica server-side. Opcional para não quebrar chamadores existentes. */
  ritmo?: StudentRitmo
  triagem?: StudentTriagem
```

Nenhuma coluna, nenhum render novo. A visão instrutor continua passando rows sem esses campos.

### C) `apps/web/src/app/(platform)/dashboard/_components/manager-dashboard-page.tsx`

1. Import: `import { type StudentPace, computeStudentRitmo, computeStudentTriagem, computeTriageSummary } from "@/lib/student-triage"`.
2. Mapa de pace: declarar `const paceByStudent = new Map<string, StudentPace>()` antes do `if (deadlineCourses ...)` (linha 217) e alimentá-lo DENTRO do loop existente (238-258), após o cálculo de `status` (253), com pior status vencendo (behind > on_track > ahead):

```ts
const paceRank: Record<StudentPace, number> = { ahead: 0, on_track: 1, behind: 2 }
// dentro do for (const e of activeEnrollments ?? []):
const status = pct >= expectedPct ? (pct > expectedPct + 10 ? "ahead" : "on_track") : "behind"
const prev = paceByStudent.get(e.student_id)
if (!prev || paceRank[status] > paceRank[prev]) paceByStudent.set(e.student_id, status)
```

   O select da linha 221 já traz `student_id`; nenhum campo novo na query. A fórmula de pace NÃO muda.
3. Enriquecimento, APÓS o bloco de pace (linha 265), antes do return:

```ts
const triagedStudentDetails = studentDetails.map((s) => {
  const ritmo = computeStudentRitmo(s, paceByStudent)
  return { ...s, ritmo, triagem: computeStudentTriagem(s, ritmo) }
})
const triageSummary = teamRecortePanel
  ? computeTriageSummary(triagedStudentDetails.map((s) => s.triagem))
  : undefined
```

4. No JSX (linhas 277-295): trocar `studentDetails={studentDetails}` por `studentDetails={triagedStudentDetails}` e adicionar `triageSummary={triageSummary}`. `triageSummary` só é passado quando `teamRecortePanel` existe, garantindo E4.

### D) `apps/web/src/components/dashboard/manager-dashboard.tsx`

1. Import: `import type { TriageSummary } from "@/lib/student-triage"` + ícones lucide `AlertTriangle, TrendingUp, UserX` (Users já importado na linha 3).
2. Prop nova em `ManagerDashboardProps`: `triageSummary?: TriageSummary` (presente somente na visão Meu Time; presença decide o set de cards).
3. Substituição condicional do bloco de Stats (linhas 92-99):

```tsx
{triageSummary ? (
  <SummaryCards items={cardsTriagem /* tabela abaixo */} />
) : (
  <SummaryCards items={[ /* os 4 itens genéricos atuais das linhas 93-98, inalterados */ ]} />
)}
```

   Itens de `cardsTriagem` (todos `icon` com `size={20}`, mesmo padrão dos genéricos; `t = triageSummary`):

   | label (texto exato) | icon | value | trend | iconBg / iconColor |
   |:--|:--|:--|:--|:--|
   | "Alunos analisados" | Users | `t.analisados` | (sem trend) | `bg-varzea/15` / `text-varzea` |
   | "No ritmo" | TrendingUp | `t.noRitmo` | `` `${t.noRitmoPct}% do recorte` `` | `bg-semantic-success/15` / `text-semantic-success` |
   | "Atenção" | AlertTriangle | `t.atencao` | `` `${t.atencaoPct}% do recorte` `` | `bg-accent-gold/15` / `text-accent-gold` |
   | "Sem acesso" | UserX | `t.semAcesso` | `` `${t.semAcessoPct}% do recorte` `` | `bg-semantic-error/15` / `text-semantic-error` |

   Cores conforme T4, tokens semânticos da casa. `SummaryCards` reutilizado sem alteração (o campo `trend` já existe, summary-cards.tsx:7 e 36).

## Dados-RLS-Segurança

1. Nenhuma superfície de dados nova. Cards e campos `ritmo`/`triagem` derivam exclusivamente de `studentDetails` (escopado por `restrictToStudentIds: teamScope` + pós-filtro `teamSet`, linhas 140 e 151-152) e do loop de pace (escopado por `highlightScope`, linha 226). `teamScope` vem das RPCs SECURITY DEFINER fail-closed: escopo ausente ou erro colapsa para `[]`, que produz cards zerados, nunca tenant-wide.
2. O `serviceClient` no loop de pace é PRÉ-EXISTENTE (justificativa nas linhas 188-198: ids já autorizados). S7 não adiciona query nova a esse client.
3. LGPD (D-C): o strip server-side de `recentSessions`/`recentReflections` (linha 159) permanece intacto e é AC explícito. `ritmo`/`triagem` são metadados derivados de contagens e datas, sem texto de aluno. `expandable={false}` (manager-dashboard.tsx:153) não muda.
4. Threat model do delta: os campos novos trafegam no payload RSC do gestor, que já recebe as métricas base (totalSessions, lastSessionDate, courseProgressPct) das quais derivam. Nenhuma informação nova, só classificação.

## Acceptance Criteria

- AC1. `apps/web/src/lib/student-triage.ts` existe, exporta `StudentRitmo`, `StudentTriagem`, `StudentPace`, `SEM_ACESSO_DAYS = 14`, `ATENCAO_DAYS = 5`, `daysSinceLastSession`, `computeStudentRitmo`, `computeStudentTriagem`, `computeTriageSummary`, e não importa supabase, next ou react.
- AC2. Regras EXATAMENTE T1/T2 (código da seção A). `lastSessionDate: null` com `totalSessions > 0` classifica `sem_acesso` (daysSince = Infinity).
- AC3. Partição exaustiva: para qualquer conjunto de rows, `noRitmo + atencao + semAcesso === analisados` (coberta por teste).
- AC4. `paceByStudent` é alimentado no MESMO loop do paceHighlights, `behind` vence outro status do mesmo aluno, e a fórmula das linhas 244-253 permanece byte-a-byte inalterada.
- AC5. Toda row da visão gestor carrega `ritmo` e `triagem` computados server-side; os campos são OPCIONAIS em `StudentInsightRow` e a visão instrutor (que não os passa) compila sem mudança.
- AC6. Na visão Meu Time, os 4 cards "Alunos analisados" / "No ritmo" / "Atenção" / "Sem acesso" aparecem com value = contagem, trend "{N}% do recorte", cores T4; os KPIs genéricos NÃO aparecem nessa visão.
- AC7. Sem `teamRecortePanel` (admin/unidade), `triageSummary` é `undefined` e os genéricos renderizam como hoje (zero diff visual).
- AC8. Percentuais `Math.round(n / analisados * 100)`, valendo 0 quando `analisados === 0` (sem NaN).
- AC9. Counts dos cards consistentes por construção com os campos `triagem` das rows (mesmo helper, mesmas rows).
- AC10. Cards seguem o recorte ativo (Diretos/Hierarquia/`?focus=` mudam o universo); o futuro `?teams=` (S6) NÃO os afeta.
- AC11. LGPD intacta: o strip da linha 159 permanece; nenhum payload do gestor expõe `recentSessions`/`recentReflections` preenchidos.
- AC12. `pnpm --filter @eximia/web typecheck`, `pnpm --filter @eximia/web lint` e `pnpm --filter @eximia/web test` verdes.

## Plano de testes

First-move rule (feature com lógica de classificação nova): escrever PRIMEIRO os testes do helper, vê-los vermelhos (módulo inexistente), depois implementar até verde.

1. NOVO `apps/web/src/lib/__tests__/student-triage.test.ts` (vitest, mesmo diretório de `engagement-helpers.test.ts`). Casos mínimos:
   - `daysSinceLastSession`: null => Infinity; hoje => 0; 6 dias => 6; 15 dias => 15.
   - `computeStudentRitmo`: (0 sessões, 0%) => nao_iniciado, inclusive com pace behind (nao_iniciado vence); (3 sessões, pace behind) => atrasado; (0 sessões, 40%, sem pace) => no_ritmo (pct > 0 afasta nao_iniciado); (5 sessões, pace ahead) => no_ritmo; fora do mapa => no_ritmo.
   - `computeStudentTriagem` (`now` fixo): totalSessions 0 => sem_acesso; 15 dias => sem_acesso; 6 dias + no_ritmo => atencao; 2 dias + atrasado => atencao; 2 dias + no_ritmo => no_ritmo; lastSessionDate null com totalSessions 3 => sem_acesso; fronteiras: exatamente 14 dias NÃO é sem_acesso, exatamente 5 dias NÃO é atencao (limiar estritamente maior).
   - Partição exaustiva (AC3): matriz de ~20 rows sintéticas, soma dos 3 grupos === total.
   - `computeTriageSummary`: [] => tudo 0 (AC8); [no_ritmo x3, atencao x1, sem_acesso x2] => {6, 3 (50%), 1 (17%), 2 (33%)}, batendo de fato com o mockup R3 (Alunos analisados 6, No ritmo 3 (50%), Atenção 1 (17%), Sem acesso 2 (33%)).
   - Trava de limiares: `SEM_ACESSO_DAYS === 14`, `ATENCAO_DAYS === 5` (anti-drift).
2. Suíte existente permanece verde (mudança aditiva nos demais arquivos): rodar completa antes e depois.
3. Comandos literais: `pnpm --filter @eximia/web test` (vermelho no passo 1, verde ao final); `pnpm --filter @eximia/web typecheck`; `pnpm --filter @eximia/web lint`.
4. Verificação manual (testbed tenant Cory, gestor Rinaldo): na visão Meu Time os 4 cards substituem os genéricos, soma dos 3 últimos = primeiro; alternar Diretos/Hierarquia muda os números; em admin/unidade os genéricos permanecem; o strip LGPD (`recentSessions: []`) segue em manager-dashboard-page.tsx.

## Dependências

- Nenhuma: S7 é a fundação da onda e não consome S6 (decisão E5: `?teams=` não afeta os cards).
- Dependentes de S7 (consomem `student-triage.ts` e os campos enriquecidos): S8 (3ª coluna dos destaques), S9 (coluna Ritmo), S10 (coluna Ação + nudge individual via T3) e S11.
- Convive com S1-S5 (Onda 1) sem interseção semântica; conflito possível só textual em `manager-dashboard-page.tsx`.

## Riscos

1. Duplicação de limiares (MÉDIO, aceito): 5/14 dias vivem em `engagement-helpers.ts:67-68` (strip via RPC) E em `student-triage.ts` (cards/tabela). Mudar um sem o outro dessincroniza. Mitigação: comentário cruzado + teste-trava. Unificação adiada (o helper antigo copia do roster canônico, `analytics/page.tsx:~502-508`; ponteiro corrigido, o comentário-fonte em `engagement-helpers.ts` que cita as linhas antigas está stale; unificar 3 pontos é refactor à parte).
2. Divergência strip vs cards (BAIXO): a strip usa a RPC em modo FIXO direct (manager-team-dashboard-page.tsx:87-93); os cards usam o recorte ATIVO. Em Hierarquia os números legitimamente diferem (Iteração 6). Não é bug; registrar no PR.
3. Aluno sem enrollment com deadline não tem pace e cai em `no_ritmo` por T1 (BAIXO, canônico): tenant sem `deadline_days` nunca produz "atrasado". Aceito.
4. `progress.percentage` null vira 0 e marca behind (herdado, BAIXO): pré-existente do paceHighlights (linha 245), não alterado por S7.
5. Fuso/relógio (BAIXO): `daysSinceLastSession` usa `Date.now()` UTC; fronteira de 5/14 dias pode divergir em até 1 dia da percepção local. Igual às superfícies atuais; `now` injetável para teste determinístico.
