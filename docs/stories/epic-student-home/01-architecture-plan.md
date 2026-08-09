# Student Home Redesign — Architecture Plan (Stage 1)

> **Author:** Aria (Architect) · **Date:** 2026-07-11 · **Status:** DOCS ONLY (no app code changed)
> **Predecessor:** `00-validation-stage0.md` (verdict INSUFFICIENT_DATA, not NO-GO — build is safe, measuring efficacy is the gap)
> **Product:** eximIA Academy v2 — LMS B2B multi-tenant, DNA "IA socrática" (reflection over consumption)
> **Direção aprovada pelo Hugo (Refinada):** home lidera por PROGRESSO PRÓPRIO + PRÓXIMO PASSO; comparação vira 1ª classe por TOGGLE DE INTENÇÃO; comparação renderiza como TABELA INDICADOR-POR-LINHA reaproveitável; métricas reancoradas; gráficos atuais viram vista detalhada.

---

## 0. Mantra & guardrails aplicados

"Arquitetura perfeita, execução pragmática, qualidade garantida por testes." Este plano é **aditivo por construção**: nenhuma capacidade atual do card "Meu desempenho" é perdida, e todo contrato de tipos/rota muda por **campo opcional**, nunca por breaking change. Onde há risco de quebra (variância da média, renomear "média"→mediana), o plano isola a mudança atrás de um campo novo e mantém o caminho antigo verde até a UI migrar.

**Regra de ouro do redesign:** a home do aluno tem UMA manchete nova (Progresso próprio + Próximo passo) e a comparação é uma SEGUNDA vista, atrás de um toggle. O `StudentComparisonView` de hoje **não é deletado** — ele é decomposto: sua espinha vira o componente reaproveitável de comparação, e a lógica de verdict/coach migra para alimentar a manchete.

---

## 1. Arquitetura de componentes

### 1.1 Estado atual (mapa antes de modificar)

```
components/dashboard/student-dashboard.tsx        (server-consumed shell; monta o card via <StudentComparison/>)
  └─ components/analytics/student-comparison.tsx   (FETCH wrapper: loading/error/empty/ok → GET ?view=student)
       └─ student-comparison-view.tsx              (APRESENTAÇÃO PURA: Card, Header, HeroPanel, SignalRow×4, NextStepBar, OwnMetricsOnly)
            └─ student-comparison-scale.ts          (LÓGICA testável: toMetricBar, buildSignalRows*, buildVerdict, pickFocusMetric, COACH_TEMPLATES, completionBar)
                                                    (*buildSignalRows/completionBar vivem HOJE em -view.tsx, não em -scale.ts — ver nota 1.6)
```

Ponto de montagem REAL do card: `student-dashboard.tsx` linha ~63, `<StudentComparison continueHref={...} />`, dentro de `StudentDashboard` que a `student-dashboard-page.tsx` (RSC) renderiza para o papel `student`. A rota `(platform)/dashboard/page.tsx` roteia por papel até aqui.

### 1.2 O componente-ESPINHA reaproveitável (o coração do pedido 3 do Hugo)

**Nome:** `IndicatorComparisonTable`
**Onde vive:** `apps/web/src/components/analytics/indicator-comparison-table.tsx` (novo, apresentação pura)
**Lógica de escala associada:** reusa `student-comparison-scale.ts` (o `toMetricBar` já existe e é exatamente a geometria indicador-por-linha).

**Contrato de props (proposto):**

```ts
export interface IndicatorRow {
  key: string
  label: string
  /** valor do sujeito (aluno, OU um time/gestor no reuso do gestor). */
  subjectValue: number
  /** valor da régua de referência (média/mediana/percentil da unidade). */
  referenceValue: number
  format: "pct" | "decimal" | "int"
  /** rótulo semântico da referência ("média", "mediana", "percentil 50"). Default "média". */
  referenceLabel?: string
  /** true quando ESTE indicador é o de destaque quente (aluno se sobressai). */
  highlight?: boolean
  /** contexto puro, sem destaque de cor (ex.: Reflexões). Suprime delta/quente. */
  neutral?: boolean
}

export interface IndicatorComparisonTableProps {
  rows: IndicatorRow[]
  /** rótulo da coluna do sujeito ("Você" no aluno; nome do time no gestor). */
  subjectLabel: string
  /** rótulo da coluna de referência ("Média da unidade", "Org"). */
  referenceLabel: string
  /**
   * Suprime/atenua a comparação quando a população de referência é pequena
   * (RISCO CONFIRMADO no Stage 0: média aritmética simples em unidade de 1-2
   * campeões distorce). Quando true, a tabela mostra os valores mas NÃO pinta
   * "abaixo da média" nem delta relativo. Ver §3.4.
   */
  suppressComparison?: boolean
  /** modo de cor: aluno usa biome-por-indicador; reuso genérico usa neutro. */
  colorScheme?: "biome" | "neutral"
}
```

**Regras visuais embutidas no componente (da Direção Refinada §3):**
- Cada indicador é UMA LINHA: `rótulo | Você | Média Org | barra comparativa embutida`.
- Destaque QUENTE (biome color) **só** onde `highlight === true` (aluno se sobressai). "Abaixo" fica NEUTRO — nunca vermelho/punitivo. Isto muda a semântica do `DeltaChip` atual (que hoje pinta vermelho quando behind): no novo componente, behind = cinza neutro.
- A linha/coluna da referência (média) é RÉGUA neutra e mais leve (mirror do `BAR_AVG_FILL` atual, já cinza).
- `neutral: true` (Reflexões) → sem cor de delta, contexto puro.

**Por que isto é a ESPINHA compartilhada aluno↔gestor:** o gestor hoje tem `student-insights-table.tsx` (tabela POR ALUNO, colunas fixas). Isto NÃO é a mesma espinha — é uma tabela de N alunos. A espinha compartilhada é a comparação INDICADOR-POR-LINHA de UM sujeito contra uma régua. No gestor, o reuso é: "este time × unidade" ou "este gestor × org", onde `subjectValue` = métrica do time e `referenceValue` = métrica da org. O `AreaStats`/`ManagerStats` já carregam o mesmo bloco métrico (`ComparableMetricBlock`), então a mesma linha renderiza os dois sem adaptação de dados.

### 1.3 Convivência com a "vista detalhada" (as barras atuais)

As barras de hoje (`SignalRow` dual-bar dentro de `student-comparison-view.tsx`) **não somem** (Direção §5). Elas passam a ser a **vista detalhada**, um terceiro estado do toggle de intenção (ver §2). Estrutura proposta:

```
student-comparison-view.tsx  (mantém o export, vira o "container de vistas" do card comparação)
  ├─ IndicatorComparisonTable      ← vista "Como me comparo" (tabela indicador-por-linha, o novo default da comparação)
  └─ SignalRow[] (as barras atuais) ← vista "detalhada" (mesma espinha de dados, layout dual-bar preservado)
```

Decisão: **não deletar `SignalRow`**. Ele é movido para dentro de uma sub-vista. `buildSignalRows` continua alimentando ambos (a tabela e as barras leem `MetricBar[]`).

### 1.4 O componente da nova MANCHETE: "Meu progresso"

**Nome:** `StudentProgressHeadline`
**Onde vive:** `apps/web/src/components/analytics/student-progress-headline.tsx` (novo, apresentação pura)
**Alimentado por:** `buildVerdict` + `pickFocusMetric` + `resolveContinueHref` (já existentes; ver §4).

Conteúdo: progresso próprio (Conclusão Consciente como North Star candidate + % Conclusão + Profundidade) e o CTA "Continuar agora" como MANCHETE (não rodapé). Reusa `NextStepBar` (já existe) promovendo-o visualmente.

### 1.5 Árvore final proposta

```
student-dashboard.tsx
  └─ StudentComparison (fetch wrapper — inalterado no contrato, ganha 1 estado de toggle)
       └─ StudentHomeCard (NOVO container — orquestra manchete + toggle + vistas)
            ├─ StudentProgressHeadline           (default: "Meu progresso" + CTA manchete)
            └─ [toggle "Como me comparo"]
                 ├─ IndicatorComparisonTable      (ESPINHA reaproveitável — vista comparação 1ª classe)
                 └─ SignalRow[] (vista detalhada) (barras atuais, preservadas)
```

`OwnMetricsOnly` (estado sem unidade) permanece — ele já é "só progresso próprio", então na prática vira um caso degenerado da manchete sem o toggle de comparação.

### 1.6 Nota de refactor (dívida a pagar de passagem, com teste)

`buildSignalRows`, `completionBar`, `activePct`, `perStudent` vivem HOJE em `student-comparison-view.tsx` (apresentação), não em `student-comparison-scale.ts` (lógica testável). O redesign é a oportunidade de mover essas funções puras para `-scale.ts` (onde já moram `toMetricBar`/`buildVerdict`), para que o novo `IndicatorComparisonTable` as consuma sem importar do arquivo de apresentação. **Isto é aditivo + coberto por teste** (mover + re-exportar + testar), não um breaking change. Se preferir minimizar diff nesta fatia, re-exportar de `-scale.ts` sem mover fisicamente também satisfaz a dependência.

---

## 2. Toggle de intenção ("Meu progresso" / "Como me comparo")

### 2.1 Natureza (Direção §2)

É toggle de **PERGUNTA**, não de formato. Duas intenções de 1ª classe:
- **"Meu progresso"** (default) → `StudentProgressHeadline`.
- **"Como me comparo"** → `IndicatorComparisonTable` (+ sub-toggle opcional para a vista detalhada de barras).

### 2.2 Estado

- **Onde vive:** estado local do container `StudentHomeCard` (`useState<'progress' | 'compare'>('progress')`). Client component (o card já é client via `student-comparison.tsx`).
- **Default:** `'progress'` (Direção §1: comparação NÃO é o veredito de entrada).
- **Persistência:** NÃO usar URL param nesta fatia (a home do aluno é uma tela só; o gestor usa `?teams=`/`?view=` porque tem deep-linking, o aluno não precisa). Estado efêmero é suficiente. Se surgir requisito de deep-link, promover a `?intent=` depois (aditivo).
- **Sub-vista detalhada:** segundo estado local dentro de `'compare'` (`compareView: 'table' | 'bars'`, default `'table'`).

### 2.3 Invariância do CTA entre as vistas (requisito explícito do Hugo §1)

O CTA "Continuar agora" (`NextStepBar`, destino = `continueHref` resolvido por `resolveContinueHref`) é **INVARIANTE**: aparece igual nas duas vistas do toggle, mesmo destino, mesmo texto. Implementação: o `NextStepBar` é renderizado pelo `StudentHomeCard` FORA do switch de vistas (é rodapé/manchete comum), não dentro de cada vista. Assim trocar o toggle nunca move nem muda o CTA. Um teste de invariância trava isso (§5.3).

---

## 3. Wiring de dados

### 3.1 O que JÁ existe (nada a fazer)

- `computeStudentComparison` (area-gestor.ts) já retorna `student` e `unit` como `ComparableMetricBlock`.
- `ComparableMetricBlock` (= `Omit<UnitStats,"areaName">`) **já carrega** `avgDepth?` e `consciousCompletionPct?` (types/analytics.ts:517 + 368/382). Ambos já são **computados** por `computeMetricBlock` (area-gestor.ts:154-177) e fluem pela rota `?view=student` **sem nenhuma mudança de contrato**.
- Portanto, **avgDepth e consciousCompletionPct já chegam ao cliente hoje.** A UI simplesmente não os lê. Expor na UI é trabalho SÓ de apresentação — zero backend. (Confirmado linha a linha no Stage 0, itens 1 e 2.)

### 3.2 O que FALTA (aditivo)

**Consistência = dias ativos distintos.** É campo NOVO de backend (Stage 0 item 6, ressalva de esforço). `computeMetricBlock` já recebe `sessions: SessionRow[]` com `created_at`, então é derivável **dentro da função existente**, sem nova query:

```
// dentro de computeMetricBlock, aditivo:
const activeDays = new Set(
  scopedSessions.map(s => new Date(s.created_at).toISOString().slice(0,10))
).size
// per-student quando o bloco é agregado (unidade): activeDays / students.size
```

- **Tipo:** adicionar `distinctActiveDays?: number` a `UnitStats` (flui automático para `ComparableMetricBlock` via `Omit`, exatamente como avgDepth fez). **Opcional & aditivo** — nenhum consumidor existente quebra.
- **Semântica agregada:** no bloco da unidade, reportar média per-student de dias ativos distintos (paralelo a `avgSessionsPerStudent`), para o `IndicatorComparisonTable` comparar maçã-com-maçã.
- **Fuso:** cuidado com `toISOString` (UTC) vs fuso do tenant — o projeto é UTC no PostHog e nas queries (`now`/`created_at` já em UTC no módulo), então UTC-day é consistente com o resto. Documentar como decisão.

Classificação: **ADITIVO** (novo campo opcional + nova derivação numa função já invocada).

### 3.3 Métricas-núcleo reancoradas (Direção §4) e o mapeamento de linhas

O `IndicatorComparisonTable` do aluno recebe estas linhas (ordem = importância pedagógica):

| Linha (label) | Fonte no bloco | Papel | Destaque |
|:---|:---|:---|:---|
| Conclusão Consciente | `consciousCompletionPct` | North Star candidate | quente se acima |
| Profundidade (1-7) | `avgDepth` | qualidade socrática (NÃO contagem de palavras) | quente se acima; **precisa âncora de rótulo** (Stage 0) |
| % Conclusão | `completionPct` | contextual, NÃO manchete | quente se acima |
| Consistência (dias ativos) | `distinctActiveDays` (novo) | ritmo real, não volume bruto | quente se acima |
| Reflexões | `reflectionCount` | contexto, **sem destaque de cor** (`neutral: true`) | nunca quente |

Banir o "+525%" (Direção §4): o `DeltaChip` atual mostra `deltaPct` relativo, que sobre base baixa engana. No `IndicatorComparisonTable`, delta relativo só aparece quando a referência tem massa estatística mínima (§3.4); caso contrário mostra só a barra comparativa proporcional (que já é honesta por construção — `toMetricBar` usa max compartilhado).

**Âncora de rótulo da Profundidade (Stage 0):** avgDepth é escala 1-7 de profundidade socrática. A UI DEVE rotular a escala (ex.: "3.2 / 7 · profundidade da reflexão") para o número não ser lido como palavras/contagem. Isto é copy + um sufixo `/7`, sem mudança de dado.

### 3.4 Trocar "média crua" por percentil/mediana (Direção §4 + RISCO Stage 0 item 3)

**RISCO CONFIRMADO (Stage 0 item 3):** `computeMetricBlock` só produz MÉDIA ARITMÉTICA SIMPLES. Em unidade pequena com 1-2 campeões, um aluno mediano vê "abaixo da média" injustamente. `toMetricBar` só protege divisão por zero, não variância.

Duas alavancas, ambas ADITIVAS (não tocam `computeMetricBlock` no caminho existente):

1. **Curto prazo (só UI, zero backend) — `suppressComparison`:** quando `unit.totalStudents` for pequeno (limiar proposto: `< 5`, calibrável), o `IndicatorComparisonTable` recebe `suppressComparison: true`: mostra os valores e a barra proporcional, mas **não pinta "abaixo"** nem exibe delta relativo. Isto neutraliza o pior do risco imediatamente, sem mudar cálculo. `totalStudents` já vem no bloco.

2. **Médio prazo (backend aditivo) — expor mediana/percentil:** adicionar campos opcionais ao bloco de referência da unidade, ex.: `medianCompletionPct?`, `p50Depth?` (ou um sub-objeto `referenceStats?: { median, p25, p75 }`). Requer que `computeStudentComparison` calcule distribuição per-student da unidade (os dados já estão carregados: `unitSessionRows`/`unitReflectionRows` por `student_id`), então é uma agregação a mais sobre dados JÁ em memória — **não** uma query nova. **`computeMetricBlock` permanece intocado** (a mediana é calculada num passo IRMÃO, não dentro dele), preservando os testes existentes e todos os outros consumidores (units/areas/managers/courses). A UI passa a preferir mediana quando presente, com fallback para média. NOTA de nomenclatura (Stage 0 item 6): trocar "média"→"mediana" na UI exige o cálculo novo, não só copy; por isso a régua neutra do `IndicatorComparisonTable` carrega `referenceLabel` como prop.

Classificação: alavanca 1 = **ADITIVO (só UI)**. Alavanca 2 = **ADITIVO (novo campo opcional + nova agregação irmã)**, `computeMetricBlock` e seus testes ficam verdes.

### 3.5 Resumo aditivo vs breaking

| Mudança | Classificação | Arquivo | Risco |
|:---|:---|:---|:---|
| Ler avgDepth/consciousCompletionPct na UI | ADITIVO (só apresentação) | components/analytics/* | nenhum |
| `distinctActiveDays?` em UnitStats + derivação em computeMetricBlock | ADITIVO (campo opcional) | types/analytics.ts, area-gestor.ts | baixo (mexe em função com testes → §5) |
| `suppressComparison` em unidade pequena | ADITIVO (só UI) | novo componente | nenhum |
| Mediana/percentil da unidade | ADITIVO (campo opcional + agregação irmã) | types + area-gestor.ts | baixo (NÃO toca computeMetricBlock) |
| Novo `IndicatorComparisonTable` + `StudentProgressHeadline` + `StudentHomeCard` | ADITIVO (componentes novos) | components/analytics/* | nenhum |
| Instrumentar 2 eventos PostHog (Stage 0 item 5) | ADITIVO (fecha loop de eficácia) | lib/analytics.ts + card | nenhum |
| **Nada** renomeia campo, remove campo, ou muda assinatura de `computeMetricBlock`/`toMetricBar`/`computeStudentComparison` | — | — | **zero breaking** |

**Instrumentação recomendada (Stage 0 item 5, não bloqueia design):** `student_home_comparison_toggled` e `student_home_metric_viewed {metric, above_avg}` — fecham o loop de causalidade (retenção vs comparação) que o Stage 0 não pôde provar. Emitir do `StudentHomeCard` no toggle.

---

## 4. "Meu progresso" (a nova manchete) — dados

Reaproveitamento máximo, zero lógica nova de negócio:

- **Verdict/coach:** `buildVerdict([completionBar, ...buildSignalRows])` já produz `headline`, `coachLine`, `nextStep`, `focusKey`. A manchete usa `headline` + `coachLine` em tom de progresso próprio. **Cuidado:** hoje `buildVerdict` é fraseado como "acima/abaixo da média" (comparativo). Para a manchete "Meu progresso" (não-comparativa por design §1), ou (a) adicionar um segundo conjunto de headlines não-comparativas em `-scale.ts` (`buildProgressHeadline`, aditivo, testável), ou (b) reusar `pickFocusMetric` + `COACH_TEMPLATES` (que já são "próximo ganho", não "vs média") e derivar só o próximo passo. **Recomendo (a):** uma função irmã `buildProgressHeadline(bars)` que reusa `pickFocusMetric` mas emite copy centrada no aluno ("Você concluiu X com reflexão", "Seu próximo ganho é aprofundar"), sem mencionar média. Aditivo, coberto por teste, não altera `buildVerdict`.
- **Próximo passo / CTA:** `resolveContinueHref(data.courses)` (student-dashboard.tsx:44) já resolve o destino "continuar de onde parou". A manchete promove esse CTA. `NextStepBar` já renderiza (só muda a hierarquia visual).
- **North Star na manchete:** `consciousCompletionPct` do bloco `student` é o número de destaque próprio (não comparado). % Conclusão e Profundidade entram como suporte.

Nenhuma query nova. Tudo já está no payload `?view=student` + no `data.courses` do RSC.

---

## 5. Blast radius

### 5.1 Consumidores dos mesmos tipos/rotas

**Rota `GET /api/analytics/manager-groups`** — multi-view. `?view=student` é SÓ o card do aluno. As demais views (`comparison/areas/managers/units/courses`) servem o GESTOR/ADMIN via `unit-comparison.tsx` e afins. **Toda mudança de tipo aqui é aditiva (campo opcional)**, então essas views continuam funcionando. Confirmar que nenhum consumidor faz `Object.keys`/validação estrita de shape que rejeite campos extras (padrão do repo é ler campos nomeados → seguro).

**`ComparableMetricBlock` / `UnitStats`** — consumido por: `unit-comparison.tsx` (gestor), `area-gestor.ts` (motor), `student-comparison*` (aluno), `preview-desempenho/page.tsx` (dev harness), `route.ts`, testes. Adicionar `distinctActiveDays?`/mediana como **opcional** não quebra nenhum (todos leem campos nomeados; o dev harness precisa só não falhar em type-check, e campo opcional não obriga preenchimento).

**`computeMetricBlock`** — invocado por units/areas/managers/courses/subtree/student. Adicionar `distinctActiveDays` ao retorno é aditivo para TODOS (é um campo a mais no objeto). O RISCO é só nos TESTES que fazem asserção de shape exato (ver §5.2).

**`student-insights-table.tsx` / `ritmo-badge.tsx`** (referência visual do gestor) — **NÃO são consumidores do card do aluno.** `RitmoBadge` é fonte única de "ritmo" e pode ser reaproveitado como enfeite na manchete se útil, mas não há acoplamento obrigatório. Send-center (`/engagement`) consome `student-triage`, órbita diferente — **fora do blast radius** deste redesign.

**`preview-desempenho/page.tsx`** (dev harness) — importa `StudentComparisonView` + `ComparableMetricBlock`. Se `StudentComparisonView` for decomposto, o harness precisa apontar para o novo `StudentHomeCard`/`IndicatorComparisonTable` OU manter `StudentComparisonView` como export estável (recomendo: manter o export, só mudar internals). Atualizar os mocks para incluir os novos campos opcionais (não obrigatório, mas desejável para preview fiel).

### 5.2 Testes que precisam continuar verdes

- **`student-comparison-scale.test.ts`** (226 linhas): cobre `toMetricBar`, `formatMetric`, `countLeads`, `pickFocusMetric`, `buildVerdict`. **NÃO alterar essas funções** → todos passam sem tocar. Se mover `buildSignalRows`/`completionBar` para `-scale.ts` (§1.6), ADICIONAR testes; não remover os existentes. Novas funções (`buildProgressHeadline`, `distinctActiveDays`) → novos testes irmãos.
- **`route-student-view.test.ts`**: cobre `canAccessView` (gate role×view). **Não tocamos o gate** → passa intacto. `view=student` continua self-view para qualquer papel.
- **`dashboard/__tests__/error.test.tsx`**: não relacionado ao card; sem impacto.
- **Risco em `computeMetricBlock`:** se houver teste que faça `expect(block).toEqual({...campos exatos})`, adicionar `distinctActiveDays` quebra o `toEqual`. Mitigação: buscar por `toEqual`/`toStrictEqual` sobre o retorno de `computeMetricBlock` antes de implementar; usar `toMatchObject` ou adicionar o campo esperado. (First-move rule de refactor: rodar a suíte e confirmar VERDE antes de mexer.)

### 5.3 Testes NOVOS a escrever (safety net do redesign)

1. `IndicatorComparisonTable`: destaque quente só quando `highlight`; behind = neutro (não vermelho); `neutral: true` suprime cor; `suppressComparison` esconde delta.
2. `buildProgressHeadline` (se adotado §4a): copy não menciona "média"; sem em-dash (regra da casa, já testada em scale).
3. `distinctActiveDays`: 3 sessões no mesmo dia = 1 dia ativo; 3 dias distintos = 3.
4. **Invariância do CTA (§2.3):** trocar o toggle não muda `href` nem texto do `NextStepBar`.
5. Mediana (se adotado §3.4-2): unidade com 1 campeão + 4 medianos → mediana < média; aluno mediano não fica "abaixo" contra a mediana.

---

## 6. Riscos e ordem de implementação

### 6.1 Riscos

| Risco | Severidade | Mitigação |
|:---|:---|:---|
| Média simples distorce comparação (unidade pequena) | ALTA (confirmado Stage 0) | `suppressComparison` (fatia 1, imediato) + mediana opcional (fatia 3) |
| avgDepth menos confiável se classificador falha silencioso (Stage 0 item 1) | MÉDIA | fora de escopo do redesign; anotar débito: expor cobertura do classificador. Não bloqueia. |
| Eficácia (retenção vs comparação) não medível hoje (Stage 0 item 4/5) | MÉDIA | instrumentar 2 eventos PostHog na entrega; revisão futura, não bloqueia design |
| `computeMetricBlock` tem testes de shape exato | BAIXA | grep `toEqual` antes; `toMatchObject`; campo opcional |
| Decompor `StudentComparisonView` quebra o dev harness | BAIXA | manter export estável, mudar só internals |
| Fuso UTC-day em `distinctActiveDays` | BAIXA | UTC é consistente com o resto do módulo; documentar |

### 6.2 Fatias verticais para 3 coders em paralelo (worktrees, mínimo conflito de arquivo)

Objetivo: cada fatia toca arquivos **majoritariamente disjuntos**, com um único ponto de integração (`StudentHomeCard`) montado por último.

**Fatia A — Backend aditivo (1 coder, worktree A)**
- Arquivos: `types/analytics.ts` (add `distinctActiveDays?`, opcional mediana), `lib/analytics/area-gestor.ts` (derivar `distinctActiveDays` em `computeMetricBlock`; agregação irmã de mediana em `computeStudentComparison`).
- Testes: novos em `__tests__` de scale/area; garantir suíte verde ANTES (first-move de refactor).
- Não toca componentes. Ponto de conflito: só `types/analytics.ts` (campo aditivo, merge trivial).

**Fatia B — Espinha de comparação (1 coder, worktree B)**
- Arquivos: `components/analytics/indicator-comparison-table.tsx` (NOVO), mover/re-exportar puros para `student-comparison-scale.ts` (§1.6), testes do novo componente.
- Consome tipos da Fatia A por **campo opcional** (se A ainda não mergeou, usa fallback `?? undefined` → não bloqueia). Arquivo novo = zero conflito.

**Fatia C — Manchete + toggle (1 coder, worktree C)**
- Arquivos: `components/analytics/student-progress-headline.tsx` (NOVO), `buildProgressHeadline` em `-scale.ts`, testes.
- Arquivo novo + função irmã em scale. Único ponto de coordenação com B: ambos tocam `-scale.ts`. Mitigação: A/B/C adicionam funções em BLOCOS SEPARADOS de `-scale.ts` (append no fim), ou combinar B+C num worktree se o conflito em `-scale.ts` incomodar. Recomendo: `-scale.ts` é o ÚNICO arquivo de contato entre B e C → apêndices em regiões distintas + merge simples.

**Integração final (após A+B+C) — 1 coder**
- `components/analytics/student-comparison-view.tsx` → decompor em `StudentHomeCard` (container: manchete + toggle + vistas), preservando `StudentComparisonView` export para o dev harness.
- `student-comparison.tsx` (wrapper) e `student-dashboard.tsx`: nenhuma mudança de contrato; o card novo entra pelo mesmo `<StudentComparison/>`.
- Instrumentação PostHog no `StudentHomeCard`.
- Teste de invariância do CTA (§5.3-4).
- Atualizar `preview-desempenho/page.tsx` para o novo container + mocks com campos novos.

**Ordem de dependência:** A e B e C são paralelos (worktrees independentes; B/C só coordenam apêndices em `-scale.ts`). A integração final depende dos três. Sugestão de sequência de merge: A → B → C → integração (A primeiro reduz o `?? undefined` temporário em B).

### 6.3 First-move rules aplicáveis

- Qualquer refactor (mover puros para `-scale.ts`, decompor `StudentComparisonView`): **rodar a suíte e confirmar VERDE antes de tocar** (sdc-mandatory: refactor mantém verde do início ao fim).
- Novo campo em `computeMetricBlock`: escrever o teste de `distinctActiveDays` primeiro, ver falhar, então implementar.

---

## 7. Resumo executivo (para o próximo agente)

**O que muda:** a home do aluno passa a liderar por "Meu progresso" (manchete + CTA "Continuar agora" promovido), com a comparação virando uma segunda intenção atrás de um toggle. A comparação renderiza como TABELA INDICADOR-POR-LINHA (`IndicatorComparisonTable`, componente novo e reaproveitável aluno↔gestor), com destaque quente só onde o aluno se sobressai e "abaixo" em neutro. As barras atuais viram a vista detalhada, preservadas.

**O que é aditivo (zero breaking):** `avgDepth` e `consciousCompletionPct` JÁ chegam ao cliente hoje (só falta a UI lê-los). `distinctActiveDays` (Consistência) é campo opcional novo, derivável dentro de `computeMetricBlock` sem query nova. Mediana/percentil é campo opcional + agregação irmã que NÃO toca `computeMetricBlock`. `suppressComparison` (UI) neutraliza imediatamente o risco de variância em unidade pequena. Nenhuma assinatura de `computeMetricBlock`/`toMetricBar`/`computeStudentComparison`/gate muda.

**Blast radius controlado:** rota multi-view e tipos compartilhados mudam só por campo opcional → gestor/admin views intactos. Testes existentes (`student-comparison-scale.test.ts`, `route-student-view.test.ts`) ficam verdes porque as funções puras cobertas e o gate NÃO são alterados; único cuidado é `toEqual` sobre `computeMetricBlock`.

**3 coders em paralelo:** Fatia A (backend aditivo — types + area-gestor), Fatia B (espinha `IndicatorComparisonTable` — arquivo novo), Fatia C (manchete + toggle — arquivo novo + `buildProgressHeadline`). Único arquivo de contato B↔C é `student-comparison-scale.ts` (apêndices em regiões distintas). Integração final decompõe `StudentComparisonView` em `StudentHomeCard` e instrumenta PostHog.

**Débitos anotados (não bloqueiam):** cobertura do classificador de profundidade (Stage 0 item 1); instrumentar 2 eventos PostHog para fechar o loop de causalidade retenção↔comparação (Stage 0 item 5).

**Path deste plano:** `/Users/hugocapitelli/Dev/eximia/eximia-academy-v2/docs/stories/epic-student-home/01-architecture-plan.md`
