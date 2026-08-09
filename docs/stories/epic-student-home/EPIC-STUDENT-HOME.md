# EPIC: Home do Aluno — Progresso-Primeiro, Comparação como Contexto (EPIC-STUDENT-HOME)

**Repo:** `eximia-academy-v2`
**Criado:** 2026-07-11
**Autor:** Bob (@pm, Strategist)
**Insumos obrigatórios (LEITURA antes de qualquer story deste epic):**
- `docs/stories/epic-student-home/01-architecture-plan.md` (plano técnico — Aria/@architect)
- `docs/stories/epic-student-home/00-validation-stage0.md` (validação de dados — Atlas/@analyst)
**Direção:** aprovada pelo Hugo (Refinada), convergida por painel de 4 especialistas.
**Status:** Draft (todas as stories em Draft)

---

## 1. Tese

A home do ALUNO (título visível "Meu desempenho", rota `(platform)/dashboard/` → `student-dashboard`) deixa de abrir pelo VEREDITO comparativo ("você está acima/abaixo da média") e passa a liderar pelo **progresso próprio do aluno + o próximo passo dele**. O CTA "Continuar agora" vira MANCHETE, não rodapé. A comparação com a média da unidade continua existindo e ganha status de 1ª classe, mas atrás de um **toggle de intenção** ("Meu progresso" / "Como me comparo"), com default em "Meu progresso".

O porquê é o DNA do produto. eximIA Academy v2 é uma LMS B2B multi-tenant cujo DNA é a **IA socrática**: o aluno pensa, a IA provoca perguntas, nunca entrega resposta pronta. O foco é reflexão e aprendizado consciente, não consumo. Uma home que abre acusando o aluno de estar "abaixo da média" é dissonante desse DNA: pune em vez de convidar à reflexão, e o faz sobre uma base estatística frágil (§4). Uma home progresso-primeiro alinha a superfície de entrada ao valor central: o aluno vê o próprio avanço consciente e o próximo ganho, e a comparação vira **contexto que ele escolhe abrir**, nunca julgamento que ele recebe na porta.

## 2. Métricas-núcleo Reancoradas (confirmadas no Stage 0)

A home passa a ancorar em métricas de qualidade socrática, não de vaidade. As duas centrais **já chegam ao cliente hoje** pela rota `?view=student` (`computeStudentComparison` → `ComparableMetricBlock`); a UI apenas não as lia (Stage 0 §1, plano §3.1).

| Métrica | Campo | Papel | Estado |
|---|---|---|---|
| Conclusão Consciente | `consciousCompletionPct` | North Star candidate (concluiu E refletiu) | JÁ no cliente |
| Profundidade | `avgDepth` (escala 1-7 de profundidade socrática, NÃO contagem de palavras) | qualidade da reflexão | JÁ no cliente |
| % Conclusão | `completionPct` | progresso bruto, contexto (não manchete) | JÁ existe |
| Consistência | `distinctActiveDays` (dias ativos DISTINTOS, não contagem bruta de sessão) | ritmo real | A CONSTRUIR (aditivo) |
| Reflexões | `reflectionCount` | contexto puro, SEM destaque de cor | JÁ existe |

## 3. Premissas do Painel (fixadas — não reabrir nas stories)

Estas premissas são fruto da Direção Refinada + convergência do painel. Cada story deste epic as respeita como invariantes.

1. **Comparação NÃO lidera.** O veredito de entrada é o progresso próprio + próximo passo. Comparação é a segunda intenção do toggle, com default em "Meu progresso".
2. **Toggle é de PERGUNTA, não de formato.** "Meu progresso" e "Como me comparo" são duas intenções de 1ª classe, não dois layouts do mesmo dado.
3. **Comparação renderiza como TABELA INDICADOR-POR-LINHA**, não duas linhas chapadas. Cada indicador é uma linha (`rótulo | Você | Média Org | barra comparativa embutida`).
4. **Destaque QUENTE só onde o aluno se sobressai.** "Abaixo" fica NEUTRO (cinza), nunca vermelho/punitivo. A linha/coluna da referência é RÉGUA neutra e mais leve.
5. **Componente-espinha REAPROVEITÁVEL aluno↔gestor.** A mesma comparação indicador-por-linha (um sujeito × uma régua) serve o aluno (aluno × média da unidade) e o gestor (time × org), porque `AreaStats`/`ManagerStats` já carregam o mesmo `ComparableMetricBlock`.
6. **Banir o "+525%".** Percentual relativo sobre base baixa engana; só aparece quando a referência tem massa estatística mínima. Preferir percentil/mediana à média crua onde possível.
7. **Os gráficos atuais NÃO somem.** As barras `SignalRow` de hoje viram a "vista detalhada" atrás do mesmo toggle.
8. **CTA "Continuar agora" é INVARIANTE entre as vistas.** Mesmo destino, mesmo texto, renderizado fora do switch de vistas.

## 4. Risco Estrutural Confirmado (não hipotético) — Stage 0 §2

`computeMetricBlock` só produz **média aritmética simples** (sem mediana, percentil ou desvio). Em unidade pequena (comum em tenant B2B recém-onboardado) com 1-2 "campeões", um aluno mediano vê "abaixo da média" injustamente. `toMetricBar` protege só divisão por zero, não variância. Este é o cenário exato que a Direção quer evitar. Mitigação em duas alavancas, ambas ADITIVAS (§ decisão 5).

## 5. Escopo

### In-scope (esta wave)
- Nova manchete "Meu progresso" (progresso próprio + CTA "Continuar agora" promovido a manchete).
- Toggle de intenção "Meu progresso" / "Como me comparo" (estado local, default "Meu progresso").
- Componente-espinha `IndicatorComparisonTable` (comparação indicador-por-linha, reaproveitável aluno↔gestor).
- Preservação das barras atuais (`SignalRow`) como vista detalhada dentro do toggle.
- Reancoragem das métricas-núcleo na UI (ler `avgDepth`/`consciousCompletionPct` que já chegam; rótulo-âncora `/7` para Profundidade).
- Campo aditivo `distinctActiveDays` (Consistência) derivado dentro de `computeMetricBlock`, sem query nova.
- `suppressComparison` (só UI) para neutralizar o risco §4 em unidade pequena.
- Mediana/percentil da unidade como campo opcional + agregação irmã (NÃO toca `computeMetricBlock`).
- Instrumentação de 2 eventos PostHog (fecha o loop de eficácia do Stage 0).

### Out-of-scope (Non-Goals desta wave)
- Alterar assinatura de `computeMetricBlock`, `toMetricBar` ou `computeStudentComparison` (tudo é aditivo por campo opcional; ver Stage 1 §3.5).
- Redesenhar o card do GESTOR (`student-insights-table.tsx`) ou o send-center (`/engagement`) — estão fora do blast radius (plano §5.1).
- Expor a "% de sessões classificadas" (cobertura do classificador de profundidade) na UI — débito anotado, não bloqueia (Stage 0 §1 ressalva, plano §6.1).
- Provar causalidade retenção↔comparação — exige pipeline de correlação Supabase↔PostHog inexistente hoje; a instrumentação apenas ABRE o loop para revisão futura (Stage 0 §4).
- Deep-link por URL param para o toggle (estado efêmero basta; promover a `?intent=` só se surgir requisito, aditivo — plano §2.2).
- Novo canal WhatsApp, testes A/B, ou qualquer superfície de gestor/instrutor.

## 6. Decisões de Arquitetura (já tomadas — não reabrir nas stories)

Derivadas do plano do @architect (Stage 1). Cada uma tem classificação aditivo/breaking cravada.

1. **`IndicatorComparisonTable`** (novo, `components/analytics/indicator-comparison-table.tsx`, apresentação pura) é a espinha reaproveitável. Reusa `toMetricBar` de `student-comparison-scale.ts`. Destaque quente só onde `highlight === true`; behind = neutro; régua de referência leve; `neutral: true` (Reflexões) suprime cor. ADITIVO (arquivo novo).
2. **Toggle de intenção** é estado local (`useState<'progress' | 'compare'>('progress')`) no novo container `StudentHomeCard`, sem URL param. Sub-vista detalhada é segundo estado local (`compareView: 'table' | 'bars'`, default `'table'`). ADITIVO.
3. **CTA invariante:** `NextStepBar` (destino = `resolveContinueHref`) renderizado FORA do switch de vistas, no `StudentHomeCard`. Travado por teste de invariância. ADITIVO.
4. **Wiring de dados — achado central:** `avgDepth` e `consciousCompletionPct` JÁ fluem ao cliente via `Omit` em `ComparableMetricBlock`; expor é trabalho SÓ de apresentação, zero backend. ADITIVO (só UI).
5. **Mitigação do risco §4 em duas alavancas:** (a) `suppressComparison` quando `unit.totalStudents < 5` (calibrável) — só UI, zero backend; (b) mediana/percentil como campo opcional + agregação IRMÃ em `computeStudentComparison` sobre dados já em memória, `computeMetricBlock` intocado. Ambas ADITIVAS.
6. **`distinctActiveDays?`** adicionado a `UnitStats` (flui a `ComparableMetricBlock` via `Omit`), derivado dentro de `computeMetricBlock` a partir de `created_at` já disponível (Set de dias UTC distintos). ADITIVO (campo opcional).
7. **"Meu progresso"** reusa `buildVerdict`/`pickFocusMetric`/`resolveContinueHref`; adiciona função irmã `buildProgressHeadline(bars)` em `-scale.ts` com copy centrada no aluno (sem mencionar "média"). Não altera `buildVerdict`. ADITIVO (função nova, testável).
8. **`StudentComparisonView` NÃO é deletado.** É decomposto em `StudentHomeCard` (container: manchete + toggle + vistas), preservando o export `StudentComparisonView` estável para o dev harness `preview-desempenho`. As barras `SignalRow` são movidas para uma sub-vista, não removidas.
9. **Refactor de passagem (opcional, coberto por teste):** mover `buildSignalRows`/`completionBar`/`activePct` de `-view.tsx` para `-scale.ts`, ou re-exportar. Aditivo. First-move rule de refactor: suíte VERDE antes de mexer.

## 7. Blast Radius (do plano §5)

- **Rota `GET /api/analytics/manager-groups`** é multi-view; `?view=student` é só o card do aluno. Toda mudança de tipo aqui é aditiva (campo opcional) → views do gestor/admin (`unit-comparison.tsx`) intactas. Padrão do repo é ler campos nomeados, não `Object.keys` estrito → seguro.
- **Testes que ficam verdes por construção:** `student-comparison-scale.test.ts` (funções puras cobertas NÃO são alteradas) e `route-student-view.test.ts` (o gate `canAccessView` NÃO é tocado).
- **Único cuidado:** asserção `toEqual`/`toStrictEqual` sobre o retorno de `computeMetricBlock` quebra ao adicionar `distinctActiveDays`. Mitigação: grep antes, usar `toMatchObject` ou incluir o campo esperado.
- **Fora do blast radius:** `student-insights-table.tsx`, `ritmo-badge.tsx`, send-center (`/engagement`).

## 8. Critérios de Sucesso (mensuráveis)

O epic é considerado correto se, e somente se, TODOS os critérios abaixo forem verdadeiros:

1. A home do aluno abre em "Meu progresso" (default), com "Continuar agora" como manchete — a comparação NÃO é o veredito de entrada.
2. Alternar o toggle "Meu progresso" ↔ "Como me comparo" NÃO altera o destino nem o texto do CTA "Continuar agora" (teste de invariância verde).
3. A vista "Como me comparo" renderiza uma tabela indicador-por-linha (cada indicador uma linha, com `Você`, régua de referência e barra comparativa), não duas linhas chapadas.
4. Destaque quente aparece SOMENTE onde o aluno se sobressai; nenhum indicador "abaixo" é pintado de vermelho/punitivo; Reflexões nunca recebe cor de delta.
5. As métricas Conclusão Consciente (`consciousCompletionPct`) e Profundidade (`avgDepth`, rotulada `/7`) aparecem na UI, lidas do payload que já chega hoje.
6. Consistência aparece como dias ativos DISTINTOS (`distinctActiveDays`): 3 sessões no mesmo dia = 1 dia ativo; 3 dias distintos = 3.
7. Em unidade com `totalStudents < 5`, a comparação é suprimida/atenuada (`suppressComparison`): valores e barra proporcional aparecem, mas sem pintar "abaixo" nem delta relativo — o "+525%" está banido.
8. As barras `SignalRow` atuais permanecem acessíveis como vista detalhada dentro do toggle (não foram deletadas).
9. O componente `IndicatorComparisonTable` é reaproveitável: renderiza aluno (aluno × média da unidade) e gestor (time × org) a partir do mesmo `ComparableMetricBlock`, sem adaptação de dados.
10. Nenhuma assinatura de `computeMetricBlock`/`toMetricBar`/`computeStudentComparison`/gate muda; as suítes `student-comparison-scale.test.ts` e `route-student-view.test.ts` seguem verdes.
11. Os 2 eventos PostHog (`student_home_comparison_toggled`, `student_home_metric_viewed`) são emitidos, fechando o loop de eficácia.

## 9. Mapa de Dependências e Fatias Paralelas (do plano §6.2)

Três fatias verticais tocam arquivos majoritariamente disjuntos, com um único ponto de integração montado por último. O único arquivo de contato B↔C é `student-comparison-scale.ts` (apêndices em regiões distintas).

```
Fatia A (backend aditivo) ──┐
Fatia B (espinha tabela) ────┼─> Integração final (StudentHomeCard + PostHog)
Fatia C (manchete + toggle) ─┘
```

Sequência de merge sugerida: A → B → C → integração (A primeiro reduz o `?? undefined` temporário em B). A/B/C são paralelizáveis em worktrees; B/C só coordenam apêndices em `-scale.ts`.

## 10. Lista de Stories Previstas

| # | Story | 1 linha |
|---|-------|---------|
| SH-1 | Backend aditivo: `distinctActiveDays` + mediana opcional | Adicionar `distinctActiveDays?` a `UnitStats` (derivado em `computeMetricBlock` via dias UTC distintos, sem query nova) e a mediana/percentil da unidade como agregação irmã em `computeStudentComparison`, sem tocar `computeMetricBlock`; testes novos, suíte verde antes. |
| SH-2 | Componente-espinha `IndicatorComparisonTable` | Criar o componente de comparação indicador-por-linha (props `IndicatorRow[]`, `suppressComparison`, `colorScheme`) com destaque quente só onde `highlight`, behind neutro, régua leve, `neutral` sem cor; reusa `toMetricBar`; testes de destaque/neutralidade/supressão. |
| SH-3 | Manchete "Meu progresso" + `buildProgressHeadline` | Criar `StudentProgressHeadline` (Conclusão Consciente North Star + % Conclusão + Profundidade + CTA "Continuar agora" promovido) e a função irmã `buildProgressHeadline` em `-scale.ts` com copy centrada no aluno, sem mencionar "média"; testes de copy (sem "média", sem travessão). |
| SH-4 | Toggle de intenção + container `StudentHomeCard` (integração) | Decompor `StudentComparisonView` em `StudentHomeCard` (manchete + toggle `progress`/`compare` + sub-vista `table`/`bars`), preservar export estável para o dev harness, montar `IndicatorComparisonTable` (com `suppressComparison` derivado de `totalStudents`) e as barras `SignalRow` como vista detalhada, CTA invariante fora do switch; teste de invariância do CTA. |
| SH-5 | ~~Reancoragem de métricas na UI + rótulo-âncora da Profundidade~~ (superseded) | Descrição original superada pela evolução real do produto (toggle de intenção removido, tabela virou formato transposto). Ver **SH-1.5** para o escopo real e atual desta linha: reordenar/renomear linhas, frações X/Y, nova linha Engajamento com rank real, coluna "Como estou", parágrafo-resumo. |
| SH-6 | Instrumentação PostHog (loop de eficácia) | Emitir `student_home_comparison_toggled` e `student_home_metric_viewed {metric, above_avg}` a partir do `StudentHomeCard`, fechando o loop de causalidade retenção↔comparação que o Stage 0 não pôde provar; aditivo, não bloqueia design. |

## 11. Regras de Execução Para Quem Implementar

- Cada story é autossuficiente: um dev sem acesso a esta conversa deve conseguir implementar só com a story + os paths do plano `01-architecture-plan.md`.
- **Todo requisito rastreia ao plano (`01-`) ou à validação (`00-`)** — Constitution Art. IV (No Invention). Nenhuma feature inventada fora desses dois documentos.
- First-move rule de refactor (sdc-mandatory): qualquer mover/decompor exige a suíte VERDE antes de tocar, e verde do início ao fim.
- Nenhuma story fecha sem `lint`, `typecheck` e `test` verdes (confirmar os comandos exatos do `apps/web/package.json` na Dev Notes de cada story).
- Onde este overview e uma story divergirem em detalhe técnico, a Dev Notes da story vence (verificada por último), mas a divergência é reportada de volta ao PO/SM.

---

## Change Log

| Data | Mudança | Autor |
|---|---|---|
| 2026-07-11 | Epic criado a partir do plano `01-architecture-plan.md` (Aria) + validação `00-validation-stage0.md` (Atlas). Direção Refinada aprovada pelo Hugo, convergida por painel de 4. | Bob (@pm) |
