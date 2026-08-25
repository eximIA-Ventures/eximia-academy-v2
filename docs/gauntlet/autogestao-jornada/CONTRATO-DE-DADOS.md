# Contrato de dados — Autogestão da minha Jornada

> Fase 1.5 do `/gauntlet-2`. Uma linha por elemento da referência que **muda quando a
> realidade muda**. Elemento decorativo não entra. "De onde vem" é rota, nunca componente.
> "Como se prova" tem valor concreto — *semear X, esperar X* — nunca "testar o endpoint".
>
> Esta tabela vira, sem tradução, a régua funcional (`INVARIANTES.md`).

## Estado do terreno, medido em 2026-08-21

Sonda read-only contra o banco de produção (`vaguswivhqnlbgqvnjch`), com controle positivo
e negativo em toda checagem de existência.

| Tabela | Linhas | Papel neste módulo |
|:---|---:|:---|
| `sessions` | 1.179 | regularidade, ritmo, sessão em aberto, retomadas, sequências, horários |
| `chapter_view_progress` | 737 | progresso por módulo, última atividade, mapa da jornada |
| `slide_reflections` | 553 | reflexões realizadas |
| `chapters` | 95 | módulos ordenados (`order`, `name`) |
| `enrollments` | 302 | matrículas |
| `study_plans` | **5** | plano individual |
| `users` | 184 | identidade |
| `courses` | 6 | curso |

**Tabelas de evento não existem.** `events`, `analytics_events`, `activity_log`,
`plan_history`, `study_plan_history` — todas devolvem 404. Verificado com controle
negativo (`tabela_que_nao_existe_xyz`) e positivo (`sessions`) na mesma sonda, porque
`select(count, head:true)` devolve `count: null` **sem erro** para tabela inexistente, e
essa é a forma de a checagem sair verde sem ter medido nada.

Os sete eventos que a especificação §5 exige são **todos deriváveis** dos timestamps
existentes, sem nenhuma migration:

| Evento da spec | Derivação real |
|:---|:---|
| `session_started` | `sessions.created_at` |
| `session_completed` | `sessions.completed_at` |
| `module_started` | `chapter_view_progress.first_viewed_at` |
| `module_completed` | `chapter_view_progress.reached_last_slide_at` |
| `interaction_completed` | `sessions.turn_number` / `interactions_remaining` |
| `reflection_submitted` | `slide_reflections.created_at` |
| `plan_updated` | `study_plans.recalculated_at` + `study_plans.baseline.capturedAt` |

## Os dois estados que nascem juntos (decisão do dono, 2026-08-21)

Todo bloco abaixo tem **duas linhas de prova**: com plano e sem plano. O pré-voo G2 exige
caso discriminante para os dois, e nenhum bloco fecha com um só.

O motivo é medido: **5 planos ativos para 302 matrículas (1,7%)**, e **4 dos 5 têm
`module_durations` com `days: 0`** em quase todos os módulos. Sem plano é o caminho
majoritário, e plano degenerado é a maioria de quem tem plano. Tratar isso como caso de
borda entrega uma tela vazia para 297 dos 302 alunos.

## Regra de lastro (decisão do dono, 2026-08-21)

Onde a especificação exibe um número que **não tem fonte no banco**, o bloco não inventa e
não some: ele mostra **falta prova**, com o motivo legível. Isso vale, hoje, para dois
elementos, e os dois estão marcados `SEM LASTRO` na coluna de veredito.

---

## TELA 1 — VISÃO GERAL

| # | O que se vê | O que significa | De onde vem (rota) | Tabela/campo | Como se prova | Lastro |
|:---|:---|:---|:---|:---|:---|:---|
| 1.1 | `No ritmo` | estado do realizado contra o planejado para hoje | `GET /api/analytics/autogestao/visao-geral` | `chapter_view_progress`, `study_plans.module_durations`, `.start_date` | semear plano de 4 módulos × 7d iniciado há 14d + 2 módulos concluídos, esperar `No ritmo`; concluir 0, esperar `Abaixo do ritmo` | OK |
| 1.2 | `1,8x / semana` | dias **distintos** com atividade ÷ semanas do período | mesma rota, campo `regularidade.realizado` | `sessions.created_at`, `slide_reflections.created_at`, `chapter_view_progress.last_viewed_at` | semear 3 sessões no MESMO dia + 1 em outro, em 1 semana → esperar `2`, nunca `4` | OK |
| 1.3 | `Meta do plano: 2x por semana` | frequência semanal combinada | — | **não existe campo** | — | **SEM LASTRO** |
| 1.4 | `50%` | progresso real do curso | mesma rota, `progresso.real` | `chapter_view_progress.reached_last_slide_at` ÷ `chapters` do curso | semear 4 de 8 capítulos com `reached_last_slide_at`, esperar `50%` | OK |
| 1.5 | `Meta do plano: 50%` | onde o plano previa estar hoje | mesma rota, `progresso.planejado` | `study_plans.module_durations` + `start_date` + hoje | semear plano 8×10d iniciado há 40d, esperar `50%` | OK |
| 1.6 | `Há 3 dias` | dias desde a atividade mais recente | mesma rota, `ultimaAtividade.dias` | `max()` dos 3 timestamps de 1.2 | semear última sessão há 3d, com clock injetado, esperar `3` | OK |
| 1.7 | `Próxima sessão recomendada` | data-alvo do próximo passo | mesma rota, `ultimaAtividade.proxima` | derivado de 1.5 + cadência observada | semear atraso de 1d, esperar data ≤ fim da semana corrente | OK |
| 1.8 | `Você está 1 dia atrás do seu plano…` | mensagem-síntese, sem julgamento | mesma rota, `sintese` | derivado de 1.1 | semear cada um dos 4 estados, esperar as 4 mensagens distintas da spec §9 | OK |
| 1.9 | `↑ 1 sessão vs. 30 dias anteriores` | delta da janela atual contra a anterior equivalente | mesma rota, `mudancas[]` | `sessions` nas duas janelas | semear 5 na janela atual e 4 na anterior, esperar `+1` | OK |
| 1.10 | `↓ 15% frequência` | delta de regularidade entre janelas | mesma rota, `mudancas[]` | idem 1.2, duas janelas | semear 2,0 → 1,7, esperar `−15%` | OK |
| 1.11 | `↑ 5% progresso` | delta de progresso em pontos percentuais | mesma rota, `mudancas[]` | idem 1.4, duas janelas | semear 45% → 50%, esperar `+5 p.p.` | OK |
| 1.12 | `Reflexões abaixo do plano — 0 de 15 previstas` | reflexões feitas contra as previstas | mesma rota, `atencao[]` | `slide_reflections` (feitas) · **previstas não existem** | feitas: semear 8, esperar 8 | **SEM LASTRO** (denominador) |
| 1.13 | `Regularidade abaixo do plano` | comparação contra a meta semanal | mesma rota, `atencao[]` | depende de 1.3 | — | **SEM LASTRO** |
| 1.14 | `Sessão em aberto — há 3 dias` | sessão iniciada e não concluída | mesma rota, `atencao[]` | `sessions.status`, `completed_at IS NULL`, `created_at` | semear 1 sessão aberta há 5d, esperar o card com `5`; concluí-la, esperar o card sumir | OK |
| 1.15 | `Retome "Análise de Causa"` | a **única** recomendação prioritária | mesma rota, `proximoMovimento` | prioridade determinística da spec §12.1 | semear sessão parada + atraso de plano juntos, esperar a de **sessão parada** (prioridade 1), nunca duas | OK |
| 1.16 | `Desde que confirmei meu plano: há 80 dias` | quando o plano foi **confirmado** | mesma rota, `resposta.ultimoAjuste` | `study_plans.baseline.capturedAt` | semear `capturedAt` há 80d, esperar `80` | OK (rótulo corrigido) |
| 1.17 | `1,1 → 1,9x/semana` | regularidade antes e depois do ajuste | mesma rota, `resposta.frequencia` | `study_plans.baseline.capturedAt` como divisor + `sessions` dos dois lados | semear 1,1 antes de `capturedAt` e 1,9 depois, esperar o par | OK |
| 1.18 | `+12% progresso` | progresso desde o ajuste | mesma rota, `resposta.progresso` | `baseline.progressPct` contra o real de hoje | semear baseline 38 e real 50, esperar `+12` | OK |
| 1.19 | `2 de 3 semanas dentro do plano` | semanas cumpridas desde o ajuste | mesma rota, `resposta.semanas` | depende de 1.3 para "dentro" | — | **SEM LASTRO** |
| 1.20 | `Você costuma estudar mais no período de 19h–22h` | faixa horária de maior atividade | mesma rota, `sinais[]` | `sessions.created_at`, hora local do tenant | semear 6 sessões entre 19h e 22h e 2 pela manhã, esperar a faixa da noite | OK |

> Correção 2026-08-21 (revisão adversarial, Annie Duke): a redação original ("Seu
> melhor horário") usava "melhor" — juízo de valor/causal que a §2 Regra 2 e o §18
> proíbem. A faixa é uma CONCENTRAÇÃO observada, não uma avaliação de qual horário é
> superior; a coluna acima e `montagem.ts` (`sinaisDoMomento`) foram atualizados
> juntos.
| 1.21 | `Terça e quinta são seus dias` | dias da semana de maior atividade | mesma rota, `sinais[]` | `sessions.created_at`, dia da semana | semear concentração em ter/qui, esperar os dois; distribuição plana, esperar supressão do sinal | OK |
| 1.22 | `Leva 4 dias para retomar` | latência média de retomada após 7+ dias parado | mesma rota, `sinais[]` | `sessions`, intervalos | semear 2 pausas de 8d com retomada em 4d, esperar `4`; com 1 só ocorrência, esperar supressão por n insuficiente | OK |

## TELA 2 — MEUS PADRÕES E TENDÊNCIAS

| # | O que se vê | O que significa | De onde vem | Tabela/campo | Como se prova | Lastro |
|:---|:---|:---|:---|:---|:---|:---|
| 2.1 | série verde por semana | dias ativos por semana ao longo do tempo | `GET /api/analytics/autogestao/padroes` | `sessions` agrupadas por semana ISO | semear 12 semanas com valores conhecidos, esperar os 12 pontos na ordem | OK |
| 2.2 | linha tracejada `Meta do plano` | referência semanal | — | depende de 1.3 | — | **SEM LASTRO** |
| 2.3 | `1,8x por semana` | frequência média do período | mesma rota, `continuidade.frequencia` | idem 1.2 | semear 18 dias ativos em 10 semanas, esperar `1,8` | OK |
| 2.4 | `12 dias` maior intervalo | maior lacuna entre **atividades** | mesma rota, `continuidade.maiorIntervalo` | união de `sessions.created_at` + `slide_reflections.created_at` + `chapter_view_progress.last_viewed_at` | semear lacunas de 5, 12 e 9 dias, esperar `12` | OK |
| 2.5 | `3 semanas ativo` | sequência corrente sem semana zerada | mesma rota, `continuidade.sequencia` | semanas ISO com ≥1 atividade (mesma união) | semear 3 semanas ativas após 1 zerada, esperar `3`; zerar a semana corrente, esperar `0` | OK |
| 2.6 | `2 vezes` retomadas | retornos após ≥14 dias **sem atividade** (spec §17) | mesma rota, `continuidade.retomadas` | mesma união, intervalos ≥14d seguidos de atividade | semear pausa de 13d (**não** conta) e de 15d (conta), esperar `1` | OK |

> **Correção de 2026-08-21, achada pelo segundo par de olhos do elo 4.** As linhas 2.4,
> 2.5 e 2.6 declaravam `sessions.created_at` **puro**, e a produção usa a **união** de
> sessões, reflexões e progresso. Medido no cenário semeado: `last_viewed_at` de dois
> módulos cai em dias que nenhuma sessão tocou, e o resultado muda de verdade —
> **retomadas = 3 contando só sessões, contra 2 contando toda atividade.**
>
> **O contrato estava errado, não o código.** A spec §17 define retomada como "retorno
> após período de pelo menos 14 dias **sem atividade**", e §16 fala em "sessões/dias
> ativos". Ler só `sessions` contaria como "parado" um aluno que passou a semana lendo
> capítulo e registrando reflexão — e diria a ele que interrompeu a jornada quando não
> interrompeu. Também romperia a coerência com a linha 1.2, que já usa a união.
>
> Esta divergência só apareceu porque o cenário planta **bases distintas de propósito**
> para as duas fórmulas. Com dado onde sessão e atividade coincidem, os dois cálculos
> dariam o mesmo número e a discordância ficaria invisível até chegar num aluno real.
| 2.7 | 3 insights de ritmo | associações observadas, nunca causais | mesma rota, `favorece[]` | `sessions`, `slide_reflections`, `chapter_view_progress` | semear n abaixo do mínimo, esperar supressão; acima, esperar o texto com "nas semanas em que", nunca "porque" | OK |
| 2.8 | `Retomando` + linha temporal | estado dominante do período | mesma rota, `tendencia` | derivado de 2.1 | semear cada um dos 4 estados da spec §19, esperar os 4 rótulos distintos, incluindo `Sem padrão suficiente` | OK |

## TELA 3 — MEU MAPA DA JORNADA

| # | O que se vê | O que significa | De onde vem | Tabela/campo | Como se prova | Lastro |
|:---|:---|:---|:---|:---|:---|:---|
| 3.1 | trilha de 7 módulos com status | percurso pessoal ordenado | `GET /api/analytics/autogestao/mapa` | `chapters.order`, `.name` + `chapter_view_progress` | semear 3 concluídos, 1 em andamento, 3 não iniciados, esperar a trilha exata e **nenhum vermelho** (spec §22) | OK |
| 3.2 | `60%` no módulo atual | progresso dentro do módulo | mesma rota, `atual.progresso` | `max_slide_index` ÷ `slides_total_at_last_view` | semear 6 de 10 slides, esperar `60%` | OK |
| 3.3 | `Iniciado em 02/08/2025` | primeiro acesso ao módulo | mesma rota, `atual.iniciadoEm` | `chapter_view_progress.first_viewed_at` | semear data conhecida, esperar a mesma data no fuso do tenant | OK |
| 3.4 | `2 de 4` sessões concluídas | sessões fechadas no módulo | mesma rota, `atual.sessoes` | `sessions` por `chapter_id`, `completed_at NOT NULL` | semear 2 concluídas e 1 aberta, esperar `2 de 3` | OK |
| 3.5 | `~1h 20m` restante | estimativa do que falta | mesma rota, `atual.estimativa` | slides restantes × duração média medida | semear 4 slides restantes com média conhecida, esperar o produto | OK |
| 3.6 | `Concluir até 21/08/2025` | próximo marco | mesma rota, `marco` | `study_plans.module_durations` + `start_date` acumulados | semear plano com 20d no módulo 4, esperar a data; com `days: 0`, esperar **falta prova** e não uma data inventada | OK |
| 3.7 | `perdeu ritmo ao iniciar módulos novos` | onde as interrupções acontecem | mesma rota, `perdaDeRitmo` | cruzar pausas ≥7d com `first_viewed_at` de módulo | semear 2 pausas logo após início de módulo, esperar o texto; 1 só, esperar supressão | OK |
| 3.8 | `Média de pausa: 9 dias` | duração média dessas pausas | mesma rota, `perdaDeRitmo.mediaDias` | idem 3.7 | semear pausas de 8 e 10, esperar `9` | OK |
| 3.9 | tabela dos últimos 3 módulos | histórico, nunca ranking | mesma rota, `historico[]` | `chapter_view_progress` ordenado por `first_viewed_at` | semear 5 módulos iniciados, esperar exatamente os **3** mais recentes, na ordem | OK |

---

## NAVEGAÇÃO — como o aluno chega (escopo acrescido pelo dono, 2026-08-21)

Tela sem entrada de navegação é tela que ninguém encontra, e isto não é hipótese nesta
casa. Duas provas em disco, hoje:

- `packages/shared/src/modules/registry.ts` carrega o comentário *"2026-08-01 — /jornada
  entra na navegacao. Ate aqui a tela existia sem…"*. Já aconteceu uma vez.
- **`/meu-plano` existe, tem 6 arquivos, e não está em nenhum item de navegação.** Uma
  tela inteira ("Monte o seu plano de estudo", SH-3.1, jul/2026) que o aluno só alcança
  digitando a URL.

Por isso a navegação entra no contrato com verificador próprio, e não como acabamento.

**Decisão do dono:** a Autogestão **não** ganha item novo na sidebar. Ela entra **dentro
de `/jornada`**, e o que hoje mora ali ("Minha Jornada") será remanejado para o que de
fato é — o **plano**. O guarda-chuva "Minha Jornada" passa a abrigar as duas coisas: o
plano, e a leitura do plano.

Estrutura assumida (dois níveis, para preservar a referência visual intacta):

```
/jornada
├── vista=plano       "Meu Plano"      ← o conteúdo atual, sem alteração nesta rodada
└── vista=autogestao  "Autogestão da minha Jornada"   ← título da referência
    ├── aba=visao-geral
    ├── aba=padroes
    └── aba=mapa
```

| # | O que se vê | O que significa | De onde vem | Como se prova | Lastro |
|:---|:---|:---|:---|:---|:---|
| N.1 | as duas vistas no topo de `/jornada` | plano e leitura do plano convivem | `app/(platform)/jornada/page.tsx` | requisição real a `/jornada?vista=autogestao` devolve 200 e o título "Autogestão da minha Jornada"; a `vista=plano` continua devolvendo a tela atual **sem alteração de comportamento** | OK |
| N.2 | as 3 abas da Autogestão | as três telas da referência | idem | `?aba=` de cada uma devolve 200 e o `<h*>` correspondente; `aba` inválida cai na primeira, nunca em branco | OK |
| N.3 | o aluno alcança sem digitar URL | a tela é acessível pela navegação | `registry.ts` (módulo `academy`) | partindo de `/dashboard`, existe caminho de cliques até a Autogestão; provado por asserção sobre o item de nav que aponta para `/jornada`, não por inspeção visual | OK |
| N.4 | o gestor NÃO vê a Autogestão do aluno | privacidade da spec §30 | guarda de rota | requisição autenticada como gestor a `/jornada?vista=autogestao` de outro aluno **reprova**; a spec §30 permite ao gestor ver progresso e ritmo, nunca a leitura íntima da jornada alheia | OK |

**N.4 é o único desta seção que reprova por segurança, não por acabamento.** Ele existe
porque o módulo do aluno espelha o do gestor, e "espelhar a tela" é a maneira mais fácil
de espelhar junto o acesso que a spec §30 proíbe.

**Fora do escopo desta rodada, registrado para não se perder:** o remanejamento de
`/jornada` para "Meu Plano" e a reconciliação com a rota órfã `/meu-plano`. O dono
declarou a intenção ("lá a gente remaneja"), e mexer nisso agora misturaria um refactor
de navegação com a construção de três telas novas.

## Placar de lastro

| | Elementos | Com lastro | Sem lastro |
|:---|---:|---:|---:|
| Tela 1 — Visão Geral | 22 | 18 | **4** |
| Tela 2 — Padrões | 8 | 7 | **1** |
| Tela 3 — Mapa | 9 | 9 | 0 |
| **Total** | **39** | **34** | **5** |

Os 5 sem lastro têm **uma única causa**: não existe meta de frequência semanal nem meta de
reflexões em `study_plans`. Uma coluna resolveria os cinco. Enquanto ela não existir, os
cinco exibem *falta prova* com o motivo, por decisão do dono — e essa é a diferença entre
uma tela honesta e uma tela que inventa denominador.

## O que NÃO entra (spec §20, e vale como critério de reprovação)

Ranking de turma · profundidade de aprendizagem · avaliação de competência · qualidade das
reflexões · comparação competitiva · interpretação psicológica. Um bloco que exiba qualquer
um destes reprova o run, mesmo pixel-fiel: pertence a outra camada da Exímia.

E a regra transversal da spec §18: **nunca afirmar causalidade.** "Nas semanas em que",
"observamos que", "há associação" — jamais "isso causa" ou "você aprende melhor porque".
