# Stage 0 — Validação de Dados (Home do Aluno)

**Data:** 2026-07-11
**Autor:** Atlas (@analyst)
**Escopo:** DOCS ONLY. Nenhum código de app foi editado. Nenhum commit/push.

---

## 1. Como avgDepth e consciousCompletionPct são calculados (confirmado no código)

Fonte: `apps/web/src/lib/analytics/area-gestor.ts`, função `computeMetricBlock` (linhas 133-191),
reusada tanto para o bloco UNIDADE quanto para o bloco do próprio aluno em
`computeStudentComparison` (linha 988+).

### avgDepth (linhas 154-163)

```ts
const depths = scopedSessions.map((s) => s.analytics?.depth_reached ?? 0).filter((d) => d > 0)
const avgDepth =
  depths.length > 0
    ? Math.round((depths.reduce((a, b) => a + b, 0) / depths.length) * 10) / 10
    : undefined
```

- `depth_reached` vem do JSONB `sessions.analytics`, que é preenchido por um classificador
  (ver `apps/web/src/app/api/analytics/semantic/classify.ts`, `classifyWithHeuristics`,
  linhas 288-344) que também deriva `emotional_density_progression`, `breakthrough_moments`
  e um `engagementLevel` 1-4 ("Indiferente" → "Transformado") a partir da densidade emocional,
  breakthroughs e profundidade máxima.
- `depth_reached` é usado em `classify.ts` linha 327 com thresholds explícitos
  (`avgDensity > 0.7 && totalBreakthroughs >= 2 && maxDepth >= 6` → nível 4), confirmando que a
  escala é de **profundidade de raciocínio/reflexão socrática**, não contagem de mensagens ou
  palavras. Sessões com `analytics` nulo/ausente ou `depth_reached <= 0` são **excluídas** do
  cálculo (não poluem a média com zero).

**Veredito: avgDepth é sinal de QUALIDADE, não vaidade.** Ele mede o quão fundo a sessão
socrática efetivamente foi (via classificador de emoção/breakthrough/profundidade), não volume
bruto de interação. Isso valida a Direção Refinada item 4 (usar avgDepth como métrica-núcleo).

**Ressalva:** o cálculo depende de o classificador ter rodado sobre a sessão E ter escrito
`analytics` no banco. Se o pipeline de classificação falhar silenciosamente ou não rodar para
uma fatia de sessões, essas sessões somem do denominador (não viram zero, apenas não contam) —
o que é matematicamente correto, mas significa que `avgDepth` só é confiável se a cobertura do
classificador for alta. Não há, no código revisado, uma métrica de "% de sessões classificadas"
exposta na UI — seria prudente adicionar isso como guardrail interno (não necessariamente na
home do aluno).

### consciousCompletionPct (linhas 165-177)

```ts
const completedStudentIds = new Set(
  scopedSessions.filter((s) => s.status === "completed").map((s) => s.student_id),
)
const reflectedStudentIds = new Set(scopedReflections.map((r) => r.student_id))
let consciousCount = 0
for (const sid of completedStudentIds) {
  if (reflectedStudentIds.has(sid)) consciousCount++
}
const consciousCompletionPct =
  students.size > 0 ? Math.round((consciousCount / students.size) * 100) : undefined
```

- Conta alunos (não sessões) que têm **pelo menos 1 sessão completed E pelo menos 1
  reflection** em `slide_reflections`. Denominador é o total de alunos no escopo, não o total
  de sessões — então é uma métrica de "alcance consciente" da coorte, coerente com o nome.
- Reflexões são contadas por presença de linha (`ReflectionRow`), sem checagem de tamanho ou
  substância do texto — ou seja, mede "refletiu pelo menos uma vez", não "refletiu bem". Isso é
  aceitável como proxy de comportamento consciente (concluiu + parou pra refletir), mas não deve
  ser confundido com qualidade de reflexão (essa é coberta por `avgDepth`).

**Veredito: consciousCompletionPct é candidato legítimo a North Star** — é o único indicador
que combina comportamento (completar) com intenção reflexiva (parar pra refletir), o núcleo do
DNA socrático do produto. Confirma a Direção Refinada.

## 2. Como a média da unidade é agregada (risco de mascarar distribuição)

`computeMetricBlock` é chamado com o Set completo de `studentIds` da unidade e devolve **uma
média/percentual único** (`avgDepth` é média aritmética simples; `consciousCompletionPct` é
percentual simples de contagem). Não há mediana, não há percentil, não há desvio-padrão, não há
quartis em nenhum lugar do módulo `area-gestor.ts` nem em `student-comparison-scale.ts`.

**Risco confirmado, não hipotético:** com média aritmética simples, uma unidade pequena (comum
em tenants B2B recém-onboardados) pode ter 1-2 alunos "campeões" (avgDepth 6-7) puxando a média
para cima enquanto a maioria está em avgDepth 2-3. Um aluno mediano nessa unidade veria "você
está abaixo da média" mesmo estando no centro real da distribuição — exatamente o cenário que a
Direção Refinada quer evitar ao banir o "+525%" e pedir percentil/mediana.

**Achado adicional:** `toMetricBar` em `student-comparison-scale.ts` (linha ~70) já implementa
uma salvaguarda parcial — `deltaPct` retorna `null` quando `unitValue === 0` (evita divisão por
zero / "∞%"), mas **não protege contra unidade pequena com variância alta**, que é o risco real
aqui. Recomendação prática para Stage 1: se a query já retorna `totalStudents` da unidade
(retorna, ver `ComparableMetricBlock`), a UI pode pelo menos suprimir ou suavizar a comparação
quando `totalStudents < N` (ex.: N=5), e o backend poderia expor mediana como campo adicional
sem grande esforço (os dados brutos de `depths` já estão computados em memória, bastaria não
descartá-los antes de persistir estatísticas de distribuição). Isso é trabalho de Stage 1+, não
desta validação.

## 3. PostHog — disponibilidade e resultado da consulta

**Tentativa de consulta real:** como subagente desta tarefa, meu toolset não incluía as tools
`mcp__posthog__*` (não foram passadas ao subagente, apenas Read/Write/Edit/Bash/WebSearch/
WebFetch/StructuredOutput). Não consegui rodar queries live contra o projeto PostHog (id
398221, org exímIA Ventures) para confirmar volume de eventos, retenção ou correlação.
**Isso é uma limitação de acesso desta execução, não uma constatação de que o PostHog esteja
vazio** — não afirmo `posthogAvailable=false` por ausência de dado, afirmo por ausência de
ferramenta nesta sessão.

Dado isso, a resposta às 3 perguntas-chave é baseada em **evidência de código (o que É
instrumentado)**, não em consulta ao PostHog:

**(a) Os eventos que sustentam essas métricas estão sendo capturados?**
Parcialmente, e de forma DESACOPLADA. `apps/web/src/lib/analytics.ts` (o client `analytics.*`
que chama `posthog.capture`) tem eventos genéricos de produto: `logged_in`, `course_enrolled`,
`course_completed`, `chapter_viewed`, `chapter_completed`, `session_started`,
`session_completed` (com `interactions_count` e `duration_ms`, mas SEM `depth_reached`),
`video_started/completed`, `quiz_started/submitted`, `feature_viewed`, `csv_exported`, etc.
**Não há nenhum evento PostHog para `depth_reached`, `breakthrough_moments`,
`emotional_density_progression` ou para a criação de uma `slide_reflection`.** Essas métricas
vivem inteiramente no banco (Supabase, tabelas `sessions.analytics` JSONB e
`slide_reflections`), calculadas sob demanda pela API (`area-gestor.ts`), não replicadas como
eventos de produto no PostHog. `session_completed` é o evento mais próximo, mas mede volume
(interações, duração), não profundidade nem reflexão.

**(b) Há sinal de que esses indicadores correlacionam com retenção/conclusão de trilha?**
Não verificável nesta sessão (sem acesso à ferramenta PostHog). Mesmo que o PostHog tivesse os
eventos de produto (`course_completed`, `trail_completed`), a correlação com `avgDepth`/
`consciousCompletionPct` exigiria juntar dado do Supabase com dado do PostHog por
`student_id`/`session_id` — não há, no código revisado, nenhum pipeline de export dessas
métricas do Supabase PARA o PostHog (nem via server-side capture em
`apps/web/src/lib/analytics-server.ts`, que hoje só tem 2 chamadas `capture()`, ambas fora do
escopo de profundidade/reflexão). Sem esse pipeline, a correlação não pode ser medida no
PostHog hoje, precisaria ser calculada diretamente no Supabase (join entre `sessions`,
`slide_reflections` e conclusão de trilha) — o que é viável, mas é trabalho de análise separado,
não coberto por esta tarefa.

**(c) Há sinal de que "abaixo da média" associa-se a evasão do quartil de baixo?**
Não verificável — mesma limitação de (b), agravada pelo fato de que a comparação
"abaixo/acima da média" nem sequer é um evento capturado (é renderizado client-side em
`student-comparison-scale.ts`, efêmero, sem log de exposição). Não há registro de "aluno viu
'você está abaixo da média'" em lugar nenhum, então essa correlação específica está fora de
alcance com a instrumentação atual, mesmo com acesso pleno ao PostHog.

## 4. Veredito

**directionSignal: INSUFFICIENT_DATA** (não é um NO-GO — é "construam, mas sem dado de produto
para provar causalidade ainda").

Razão: a lógica de cálculo de `avgDepth` e `consciousCompletionPct` está **bem fundamentada e
validada no código** (Achado 1: são sinais de qualidade genuínos, não vaidade). A Direção
Refinada é estruturalmente sólida (progressão CTA-primeiro, toggle de intenção, tabela
indicador-por-linha, banir "+525%"). **O que falta é o pipeline de instrumentação que provaria
que essas métricas movem o comportamento certo** (retenção, conclusão, ausência de efeito
punitivo do "abaixo da média"). Essa prova não existe hoje nem no PostHog (que não recebe esses
eventos) nem em nenhum outro lugar do código revisado. Construir a home é seguro do ponto de
vista de correção matemática; o ponto cego é medir DEPOIS se ela funciona.

**Recomendação de ação, não bloqueante para Stage 1+:** ao entregar a nova home, instrumentar
pelo menos 2 eventos novos no PostHog: `student_home_comparison_toggled` (quando o aluno abre
"Como me comparo") e `student_home_metric_viewed` com `{metric, above_avg: boolean}` — isso
fecha o loop de medição para uma revisão futura de causalidade, sem bloquear o design agora.

**Confiança:** 72%. Alta confiança na leitura do código (verificação direta, linha a linha).
Confiança reduzida pela impossibilidade de consultar o PostHog nesta sessão — se uma consulta
real mostrasse eventos de profundidade/reflexão já capturados por outro caminho não encontrado
na varredura de código, o veredito subiria para GO. Recomendo repetir a pergunta (b)/(c) numa
sessão com acesso às tools `mcp__posthog__*` antes de investir em Stage 2+ (correlação com
retenção), mas isso não deveria atrasar Stage 1 (a reestruturação visual em si, que não depende
de causalidade provada).

## 5. Métricas-núcleo recomendadas (confirmando/ajustando a lista da Direção Refinada)

A lista da Direção Refinada (Conclusão Consciente, Profundidade, % Conclusão, Consistência,
Reflexões) é **confirmada com 1 ajuste de nomenclatura** e 1 ressalva estrutural:

1. **Conclusão Consciente** (`consciousCompletionPct`) — candidato a North Star. Confirmado,
   sem ajuste.
2. **Profundidade** (`avgDepth`, escala 1-7) — confirmado como sinal de qualidade real (Achado
   1). Recomendo exibir com rótulo que ancore a escala (ex.: "Profundidade 4,2 / 7"), não como
   número solto, para não parecer arbitrário.
3. **% Conclusão** (`completionPct`) — confirmado, é o indicador de progresso bruto mais
   legível. Mantém como métrica de contexto, não de liderança (a Direção já resolve isso ao
   pôr "Continuar agora" como manchete).
4. **Consistência** — a Direção pede "dias ativos distintos, NÃO contagem bruta de sessão".
   **Ressalva:** o código atual (`computeMetricBlock`) NÃO calcula dias ativos distintos hoje;
   ele calcula `activeStudents` (booleano por aluno: teve sessão nos últimos 30 dias) e
   `avgSessionsPerStudent` (contagem bruta). Não há, no bloco revisado, nenhum campo que já
   seja "contagem de dias-calendário distintos com atividade" para um único aluno. Isso é
   **trabalho novo de backend**, não um campo existente renomeado — sinalizar para Stage 1
   antes de assumir que "só é reaproveitar o dado".
5. **Reflexões** (`reflectionCount`, contextual, sem destaque de cor) — confirmado, existe e é
   direto (contagem de linhas em `slide_reflections` no escopo).

**Ajuste de nomenclatura:** trocar "média" por "mediana"/percentil onde a UI expuser a
comparação de unidade É recomendado pela Direção, mas **o backend hoje só calcula média
aritmética simples** (Achado 2). Adicionar mediana/percentil é mudança de cálculo no
`computeMetricBlock`, não apenas de rótulo — teria que entrar no escopo de Stage 1 como item de
backend, não só de copy.

**Lista final recomendada (4-6, confirmando 5):**
`consciousCompletionPct` (North Star) · `avgDepth` · `completionPct` · Consistência (dias
ativos distintos — A CONSTRUIR) · `reflectionCount` (contexto). Nenhuma métrica nova fora da
lista da Direção Refinada é necessária.
