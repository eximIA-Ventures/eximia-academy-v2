# SH-1.1: Backend aditivo — `distinctActiveDays` + mediana opcional

**Epic:** [EPIC-STUDENT-HOME](./EPIC-STUDENT-HOME.md)
**Status:** InReview
**Depende de:** nenhuma (fatia A, primeira a mergear)
**Bloqueia:** nenhuma diretamente, mas SH-1.5 (reancoragem) e SH-1.4 (integração) consomem os campos aditivos assim que existirem
**Paralelizável:** SIM — worktree independente. Toca só `types/analytics.ts` e `lib/analytics/area-gestor.ts`, arquivos que SH-1.2/SH-1.3 não tocam.

---

## Story

**As a** desenvolvedor implementando o redesign da home do aluno,
**I want** que `UnitStats`/`ComparableMetricBlock` carreguem `distinctActiveDays` (dias ativos distintos) e que `computeStudentComparison` exponha uma mediana/percentil opcional da unidade,
**so that** o `IndicatorComparisonTable` (SH-1.2) tenha dados de Consistência real e uma régua de referência menos distorcível por outliers, sem tocar `computeMetricBlock` no caminho que já tem testes de shape.

## Contexto (Dev Notes)

Ler `01-architecture-plan.md` §3.2, §3.4 e §5.2 antes de começar. Ler `00-validation-stage0.md` itens 3 e 6 (risco confirmado da média simples + esforço de Consistência).

- `computeMetricBlock` vive em `apps/web/src/lib/analytics/area-gestor.ts` (linhas ~154-177) e já recebe `sessions: SessionRow[]` com `created_at` — a derivação de dias ativos é possível SEM nova query.
- `UnitStats` e `ComparableMetricBlock` (= `Omit<UnitStats,"areaName">`) vivem em `apps/web/src/types/analytics.ts` (linhas ~368/382/517). `avgDepth`/`consciousCompletionPct` já seguiram este mesmo padrão de campo opcional — usar como referência de como adicionar um campo sem quebrar `Omit`.
- **RISCO CONFIRMADO (Stage 0 item 3):** `computeMetricBlock` só produz média aritmética simples. Em unidade pequena com 1-2 "campeões", um aluno mediano vê "abaixo da média" injustamente. Esta story não resolve o risco sozinha (isso é UI, SH-1.4), mas fornece o dado (mediana) que a UI vai preferir.
- A mediana/percentil é uma **agregação irmã** dentro de `computeStudentComparison`, calculada sobre dados JÁ carregados em memória (`unitSessionRows`/`unitReflectionRows` por `student_id`) — NÃO é uma query nova, e NÃO entra dentro de `computeMetricBlock`.
- **First-move rule (sdc-mandatory, refactor):** antes de tocar `area-gestor.ts`, rodar a suíte e confirmar VERDE. Depois de tocar, ela precisa continuar VERDE do início ao fim.
- **Cuidado com `toEqual`/`toStrictEqual`:** grep por essas asserções sobre o retorno de `computeMetricBlock` ANTES de adicionar o campo novo. Se existirem, usar `toMatchObject` ou incluir o campo esperado — não deixar o teste quebrar por shape exato.

## Acceptance Criteria

- [x] **AC1:** `UnitStats` (types/analytics.ts) ganha o campo opcional `distinctActiveDays?: number`. Como `ComparableMetricBlock = Omit<UnitStats, "areaName">`, o campo flui automaticamente sem tocar o tipo derivado.
- [x] **AC2:** `computeMetricBlock` (area-gestor.ts) deriva `distinctActiveDays` a partir de `scopedSessions` usando dias UTC distintos: `new Date(s.created_at).toISOString().slice(0,10)`. Documentado no código (comentário) a decisão de usar UTC-day (consistente com o resto do módulo, que já usa UTC no PostHog e nas queries).
- [x] **AC3:** Quando o bloco é agregado (unidade, múltiplos alunos), `distinctActiveDays` reportado é a MÉDIA per-student de dias ativos distintos (paralelo semântico a `avgSessionsPerStudent`, não soma bruta). Denominador = `students.size` (inclui alunos com 0 sessões, contribuindo 0 dias), idêntico ao denominador de `avgSessionsPerStudent`.
- [x] **AC4:** Teste unitário novo: 3 sessões no MESMO dia UTC → `distinctActiveDays = 1`. 3 sessões em 3 dias UTC distintos → `distinctActiveDays = 3`. Cobre o caso per-student (bloco de 1 aluno) e o caso agregado (bloco de unidade com 2+ alunos, incluindo o caso com aluno de 0 sessões).
- [x] **AC5:** `computeStudentComparison` ganha uma agregação irmã (`computeUnitReferenceStats`, função nova EXPORTADA, fora de `computeMetricBlock`) que calcula mediana (percentil 50) de `completionPct` E `avgDepth` da população de alunos da unidade, a partir dos dados já carregados. Exposta como campo opcional `referenceStats?` no bloco `unit` retornado.
- [x] **AC6:** `computeMetricBlock` permanece INTOCADO na sua lógica de média existente — a mediana é um cálculo paralelo, não uma substituição. Nenhuma assinatura de `computeMetricBlock` muda (provado por diff: zero deleções no corpo de `computeMetricBlock`).
- [x] **AC7:** Teste unitário novo para a mediana: unidade com 1 aluno "campeão" (outlier alto) + 4 medianos → mediana calculada é MENOR que a média aritmética simples do mesmo grupo (avgDepth: mediana 3 < média 4.8; completionPct: mediana 25 < média 40).
- [x] **AC8:** Grep prévio por `toEqual`/`toStrictEqual` sobre o retorno de `computeMetricBlock` — ausência confirmada (ver Dev Agent Record). Nenhuma asserção de shape exato existe sobre `computeMetricBlock` (a função tinha zero cobertura antes desta story).
- [x] **AC9:** Suítes de analytics (`area-gestor` novo + correlatas existentes) rodam VERDE. Baseline verde reancorado nas suítes que EXISTEM (ver Dev Agent Record — o repo tem 31 falhas pré-existentes NÃO relacionadas).

## Tasks

- [x] 1. Rodar a suíte de testes e confirmar baseline (first-move rule).
- [x] 2. Grep por `toEqual`/`toStrictEqual` sobre `computeMetricBlock` (AC8); anotado.
- [x] 3. Adicionar `distinctActiveDays?: number` a `UnitStats` (+ paridade AreaStats/ManagerStats/CourseStats).
- [x] 4. Implementar a derivação de `distinctActiveDays` dentro de `computeMetricBlock` (AC2/AC3), com comentário UTC-day.
- [x] 5. Escrever os testes de `distinctActiveDays` (AC4).
- [x] 6. Implementar a agregação irmã de mediana/percentil (`computeUnitReferenceStats`) e ligá-la a `computeStudentComparison` (AC5/AC6), sem tocar `computeMetricBlock`.
- [x] 7. Escrever o teste do outlier (AC7).
- [x] 8. Rodar a suíte do módulo e confirmar VERDE (AC9).
- [x] 9. Documentar no Dev Agent Record a escolha de shape.

## Complexidade & Riscos

- **Complexidade:** M (medium). Toca uma função com testes existentes (`computeMetricBlock`), exige cuidado de não quebrar shape; a agregação de mediana é lógica nova mas isolada.
- **Riscos:**
  - R1 (baixo): teste de shape exato quebra ao adicionar campo. Mitigação: AC8 (grep prévio). **Materializou? NÃO** — nenhum shape-assert existia.
  - R2 (baixo): confusão de fuso horário em `distinctActiveDays`. Mitigação: UTC-day documentado + teste de agrupamento UTC.
  - R3 (baixo): decisão de shape da mediana não comunicada às outras fatias. Mitigação: Dev Agent Record explícito abaixo.

## Dev Notes

- **Aditivo, zero breaking:** todos os campos novos são opcionais. Nenhuma assinatura de função muda. Nenhum consumidor existente quebra (leitura por campo nomeado).
- Não criar nenhum componente de UI nesta story — é 100% lógica/tipos.

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web lint
pnpm --filter @eximia/web test -- area-gestor
pnpm --filter @eximia/web test -- analytics
```

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-11 | Story criada a partir do EPIC-STUDENT-HOME + plano de arquitetura (Fatia A). | River (SM Agent) |
| 2026-07-11 | Validação PO + ACs fortalecidos (Given/When/Then, comandos concretos, correção do baseline area-gestor). Veredito GO. | Contrato (@po) |
| 2026-07-11 | Implementação (Bigorna/@dev). `distinctActiveDays` + `computeUnitReferenceStats` (shape `referenceStats`). Status → InReview. | Bigorna (@dev) |

---

## PO Validation & Critérios Fortalecidos (@po)

> **Veredito: GO (9,0/10).** Story sólida, aditiva por construção, símbolos verificados em código. Fortalecimento abaixo corrige UM ponto real: a SH-1.1 assume um "baseline verde da suíte area-gestor" que NÃO EXISTE (não há teste sobre `computeMetricBlock`/`computeStudentComparison` hoje). Os testes desta story são a PRIMEIRA cobertura dessa função, o que eleva a barra em vez de baixá-la.

### Achado de verificação (corrige AC8 e AC9)

Varredura em `apps/web/src` (2026-07-11): o único teste que toca o caminho student-comparison é `app/api/analytics/manager-groups/__tests__/route-student-view.test.ts`, e ele cobre SÓ `canAccessView` (o gate), não `computeMetricBlock`. **Não existe `area-gestor.test.ts`.** Consequências:
- O comando `test -- area-gestor` retorna "no test files found" (vitest sai não-zero) ATÉ o dev criar o arquivo de teste. Isso não é "baseline vermelho", é ausência de cobertura, mas o baseline verde do first-move rule deve ser medido contra as suítes que EXISTEM, não contra o vazio.
- O grep de `toEqual`/`toStrictEqual` sobre `computeMetricBlock` (AC8) legitimamente não acha nada, porque a função tem zero cobertura. Risco R1 é praticamente nulo. AC8 permanece como prova defensiva da ausência.

### Critério de PRONTO (o Revisor Crivo usa este)

`typecheck` + `lint` + `pnpm test` VERDES; `distinctActiveDays?` presente em `UnitStats` (fluindo a `ComparableMetricBlock` via `Omit`); derivação UTC-day comentada; agregação de mediana existe FORA de `computeMetricBlock` (assinatura inalterada, provada por diff); testes novos de AC4 e AC7 presentes e verdes; escolha de shape da mediana registrada no Dev Agent Record para SH-1.2/SH-1.5 lerem; grep de AC8 documentado. Só código aditivo, nenhuma assinatura alterada.

---

## Dev Agent Record (@dev — Bigorna)

**Modelo:** Opus (Tier). **Worktree:** `feat/SH-1.1-distinct-active-days` (isolado dos pares B/C). **Repo:** `eximia-academy-v2`, pkg `@eximia/web`.

### DECISÃO DE SHAPE DA MEDIANA (para SH-1.2 / SH-1.5 lerem — AC5/AC9/Task 9)

Escolhido o **sub-objeto `referenceStats?`**, NÃO os campos flat `medianCompletionPct?`/`p50Depth?`.

Contrato exato (em `types/analytics.ts`):

```ts
export interface ReferenceQuartiles {
  median: number   // percentil 50
  p25: number
  p75: number
}
export interface UnitReferenceStats {
  completionPct: ReferenceQuartiles          // distribuição per-student de completionPct
  avgDepth: ReferenceQuartiles | null        // null quando NENHUM aluno teve sinal de profundidade
}
// UnitStats (e portanto ComparableMetricBlock via Omit) ganha:
referenceStats?: UnitReferenceStats
```

**Onde ler (SH-1.2/SH-1.5):** o campo aparece SOMENTE no bloco `unit` de `StudentComparison` (o retorno de `computeStudentComparison`). Os blocos agregados flat (units/areas/managers/courses do `buildComparison`) NÃO populam `referenceStats` — ele é a régua da unidade de referência do aluno, populado só ali. Ler com fallback `?? undefined` / `?.` (é opcional por construção).

**Por que sub-objeto e não flat:**
1. Entrega p25/p75 além da mediana numa tacada, dando à SH-1.5 (reancoragem) a IQR sem exigir uma story de follow-up. AC5 pedia "ao menos" mediana; o sub-objeto é superconjunto barato.
2. Agrupa a semântica "isto é distribuição de referência, não a métrica própria da unidade" num namespace, evitando poluir o bloco flat com 6+ campos soltos (median/p25/p75 × 2 métricas).
3. `avgDepth: ReferenceQuartiles | null` espelha exatamente a convenção de `computeMetricBlock.avgDepth` (undefined→aqui null quando não há sinal de profundidade), então o consumidor trata "sem profundidade" com um único check.

**Método de percentil:** interpolação linear (tipo-7 / Excel `PERCENTILE.INC`), `median = p50`. `completionPct` arredondado a inteiro, `avgDepth` a 1 casa (mesma convenção do módulo). Helper `percentileSorted(sorted, p)` puro.

**Cálculo (sem query nova, AC5/AC6):** `computeUnitReferenceStats` reusa `computeMetricBlock([sid], ...)` POR ALUNO sobre as linhas da unidade JÁ carregadas (`unitSessionRows`/`unitReflectionRows`), coleta os valores per-student e tira os quartis. É EXPORTADA e pura → testável direto (AC7 sem mock de Supabase). Ligada em `computeStudentComparison` via merge `{ ...unitBlock, referenceStats }` (fora de `computeMetricBlock`).

### distinctActiveDays (AC2/AC3)

Dentro de `computeMetricBlock`: `new Set` de `toISOString().slice(0,10)` por aluno (UTC-day, comentado), depois MÉDIA per-student `Math.round((totalDias / students.size) * 10) / 10`. Bloco de 1 aluno colapsa ao count próprio. Denominador `students.size` inclui alunos de 0 sessões (0 dias), idêntico a `avgSessionsPerStudent`. Adicionado a `UnitStats` (flui a `ComparableMetricBlock` via `Omit`) + paridade em `AreaStats`/`ManagerStats`/`CourseStats` (o objeto runtime já carrega o campo; espelha o precedente de `avgDepth`).

### AC8 — grep de shape-assert (documentado)

```
grep -rnE "toEqual|toStrictEqual" src --include="*.test.ts" | grep -iE "metricblock|block|unit"
```
Zero asserções de shape exato sobre o retorno de `computeMetricBlock`. As únicas linhas casadas (`add-members-unit-consistency.test.ts` → `toEqual({ success: true, added: N })`) são falso-positivo do filtro amplo "unit" no nome do arquivo, e asseram o retorno de `addMembers`, NÃO de `computeMetricBlock`. **AC8 confirmado: nenhuma correção necessária, ausência é real (a função tinha zero cobertura antes desta story).**

### Baseline honesto (first-move rule / AC9)

O repo tem **31 falhas de teste PRÉ-EXISTENTES** no `main`/branch base, TODAS não relacionadas a esta fatia (session-messages route mock `serviceClient.from(...).select is not a function`, login-form google-oauth, manager/student dashboards, onboarding step-employee-status, rate-limit). Nenhuma toca `area-gestor.ts`, `types/analytics.ts` nem `computeMetricBlock`/`computeStudentComparison`.

Baseline verde reancorado nas suítes de analytics que EXISTEM e poderiam regredir — **116/116 verdes antes**, **verdes depois**. As suítes `manager-*dashboard*` que aparecem como falha ao filtrar por "manager" são componentes de dashboard e estão nas 31 pré-existentes (não introduzidas por mim).

### Resultado dos comandos de verificação

| Comando | Resultado |
|---|---|
| `vitest run area-gestor` (testes novos AC4+AC7) | **9/9 PASS** |
| `tsc --noEmit` | **exit 0** (limpo) |
| `biome check` (meus 3 arquivos) | **limpo** (0 erros após format) |
| Regressão analytics (`student-comparison-scale`, `route-student-view`, `analytics`, `manager/route`, `student-insights`) | **verde** |
| `git diff` corpo de `computeMetricBlock` | **zero deleções** (aditivo puro; única deleção no arquivo = rename `unit`→`unitBlock` em `computeStudentComparison`, fora de `computeMetricBlock`) |
| Assinatura `export function computeMetricBlock(` | **inalterada** (sem `+/-` na declaração) |
| AC8 grep | **ausência confirmada** |

> Nota: `biome check ./src` (repo inteiro) reporta 612 erros / 214 warnings PRÉ-EXISTENTES em 862 arquivos — dívida de lint do repo, não desta fatia. Meus arquivos passam limpos.

### File List

- `apps/web/src/types/analytics.ts` — `+ReferenceQuartiles`, `+UnitReferenceStats`; `+distinctActiveDays?` e `+referenceStats?` em `UnitStats`; `+distinctActiveDays?` (paridade) em `AreaStats`/`ManagerStats`/`CourseStats`.
- `apps/web/src/lib/analytics/area-gestor.ts` — `+distinctActiveDays` em `computeMetricBlock` (aditivo); `+percentileSorted` (helper puro); `+computeUnitReferenceStats` (exportada); merge de `referenceStats` no bloco `unit` de `computeStudentComparison`.
- `apps/web/src/lib/analytics/__tests__/area-gestor.test.ts` — **NOVO** (1ª cobertura de `computeMetricBlock`/`computeUnitReferenceStats`): 9 testes (AC4 dias UTC + AC7 outlier).
