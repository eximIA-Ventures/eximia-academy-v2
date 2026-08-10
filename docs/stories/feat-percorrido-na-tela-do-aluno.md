# Story: Percorrido na tela do aluno, ajuda que não é cortada e leitura que separa percorrer de elaborar

**Version:** 1.0
**Created:** 2026-07-31
**Author:** River (@sm)
**Status:** Ready for Review
**Priority:** P2
**Branch:** `deploy/cory`
**Type:** Feature (brownfield) + bug fix
**Tier:** 2 (story leve, sem epic)
**Predecessora:** `docs/stories/feat-percorrido-elaborado-captura.md` (ciclo fechado: captura, cálculo e coluna na tela do GESTOR)
**Contrato de arquitetura:** `docs/architecture/percorrido-progressao-conclusao.md`

---

## User Story

**As a** aluno da eximIA Academy olhando "Meu ritmo",
**I want** ver separado o que eu **percorri** (passei pelos slides) do que eu de
fato **preenchi** (reflexões e interações),
**so that** eu entenda por que "cheguei ao fim do curso" não é a mesma coisa que
"fiz o curso", sem precisar que alguém me explique numa conversa constrangedora.

---

## Por que esta story existe

A predecessora entregou a medição e a coluna PERCORRIDO na tela do **gestor**.
Ficou faltando o outro lado do balcão: **o aluno continua sem ver a distinção**.

O Hugo explicitou o propósito real da medida, e ele não é o óbvio:

> "O percorrido só existe porque mesmo existindo e cobrando, tem pessoas que
> ainda não interagem, mas 'brigam' pois '''completaram o curso'''."

Isto reposiciona tudo. O Percorrido **não é uma etapa a cumprir**. É a
**evidência** que desarma a reclamação: sim, você percorreu tudo, e é
justamente por isso que dá para afirmar com precisão o que faltou. Toda decisão
de UI desta story deriva daí, e é por isso que cada uma vem com o porquê
escrito, não só o quê.

O vocabulário foi cortado pelo Hugo em 2026-07-31, e vale para todo o produto:

> "Percorrido = passar os slides ; progresso = preencher as interações;
> progressão não existe"

---

## Escopo

Três blocos independentes. Podem ser implementados e verificados separadamente.

| # | Bloco | Estado | Commit |
|:--|:---|:---|:---|
| A | Ajuda de coluna cortada pelo overflow | Entregue | `1d80776` |
| B | Tela do aluno: linhas Percorrido e Conclusão | Entregue | `f5bf0a8` |
| C | Leitura do resumo distingue percorrer de elaborar | Entregue | `1c96db7` |

**Gates na entrega:** suíte completa em **7 falhas = baseline herdado exato**
(2056 passando, eram 2053), typecheck exit 0, `turbo build` 2/2, Biome limpo
nos arquivos tocados. Nada pushed ainda.

---

## Bloco A — Ajuda de coluna cortada pelo overflow (BUG, afeta produção)

### O defeito

`apps/web/src/components/analytics/column-help-popover.tsx`

A primeira versão posicionava o balão com `absolute left-1/2 -translate-x-1/2`.
Funcionava nas colunas do meio e **quebrava na primeira**: o balão estourava a
borda esquerda e era **cortado pelo `overflow` do container da tabela**. O Hugo
reportou com screenshot em 2026-07-31.

**Nenhum `z-index` resolve isto** — `overflow` recorta antes de empilhar. Este é
o ponto que precisa ficar registrado, porque é exatamente o "conserto" que
alguém tentaria primeiro no futuro.

### A correção

`position: fixed`, o que tira o balão do fluxo de recorte por completo, com a
posição calculada a partir do gatilho e **clamp nas bordas da janela**. Custo
aceito: precisa reposicionar em `scroll` e `resize`, e isso está implementado.

### Por que entra nesta story e não fica solto

O componente **já está em produção** na tabela do gestor. O bug é real para
quem usa hoje, independente do resto. E o Bloco B vai reusar o mesmo componente
na tela do aluno, onde a tabela também tem `overflow` — sem esta correção, o
bug se multiplica em vez de ser corrigido.

### Critérios de aceite

- **A1.** O balão renderiza com `position: fixed`.
  Verificação: `expect(screen.getByRole("note")).toHaveClass("fixed")`
- **A2.** Com o gatilho a 4px da borda esquerda, o `left` calculado é `>= 0`
  (antes ia para coordenada negativa, que era o que se via cortado).
  Verificação: teste com `getBoundingClientRect` sobrescrito.
- **A3.** Nenhum comportamento anterior regride: abre por clique, fecha por
  clique no ícone / fora / `Escape`, só um aberto por vez, gatilho é `button`
  com rótulo acessível.
  Verificação: `pnpm vitest run column-help-popover` → **9 passando**.
- **A4.** O `aria-label` continua sendo `Sobre a coluna {label}`. A explicação
  vive no conteúdo do balão, não no rótulo do botão.

---

## Bloco B — Tela do aluno "Meu ritmo"

Arquivo: `apps/web/src/components/analytics/comparison-insights-table.tsx`
(visão Turma, variante do aluno).

### B.1 — "Progresso - conclusão" passa a se chamar "Conclusão"

A linha mostra `enrollments.progress`, que é **o clique no botão "Módulo
Concluído"**. É a mesma conclusão declarada que já **saiu da tabela do gestor
por enganar**. Mantê-la chamada de "Progresso" hoje colide de frente com o
significado novo da palavra: no vocabulário cortado pelo Hugo, *progresso =
preencher as interações*, que é precisamente o que esta linha **não** mede.

### B.2 — Entra a linha "Percorrido"

Ordem final das linhas na visão Turma:

`Última sessão de estudo` · **`Percorrido`** · **`Conclusão`** ·
`Interações realizadas` · `Reflexões realizadas` · `Engajamento`

As linhas de Interações e Reflexões **ficam como estão**: elas já são a
decomposição do que o gestor vê agregado.

### B.3 — O Percorrido NÃO tem botão de ação

**Esta é a decisão mais importante do bloco, e a mais fácil de alguém
"corrigir" por engano depois.** Todas as outras linhas têm CTA; a ausência aqui
vai parecer esquecimento. Não é.

**Justificativa (Hugo, 2026-07-31):** o Percorrido é **evidência, não meta**.
Ele existe para responder a quem afirma ter completado o curso sem ter
interagido. Dar a ele um botão "Continuar sessão" o transformaria em mais uma
barra a encher, ou seja, em algo a **perseguir** — e ensinaria exatamente o
comportamento que a medida existe para expor: passar slides.

Efeito colateral bem-vindo: elimina a duplicação de "Continuar sessão", que no
protótipo aparecia em duas linhas seguidas (Percorrido e Conclusão).

> **Se você veio aqui para "consertar a linha sem botão": pare.** A ausência é
> deliberada. Mudar isto exige decisão nova do Hugo, não um ajuste de UI.

### B.4 — Ícones de ajuda clicáveis nos rótulos

Reusar `ColumnHelpPopover` (Bloco A) nos rótulos de Percorrido, Conclusão,
Interações e Reflexões. Clique, nunca hover: hover não existe em toque, e o
aluno no celular nunca veria a explicação.

O texto do Percorrido e o da Conclusão precisam explicar **a diferença entre
si**, não apenas se definirem isoladamente — a confusão que motiva a ajuda é
justamente entre os dois.

### B.5 — Botões de ação voltam a espelhar o tom da linha

Verde / amarelo / vermelho conforme o chip "Como estou" daquela linha.

> ⚠️ **Isto REVERTE conscientemente o "ROUND 27"**, registrado no código como
> *"classe única (identidade do mundo), não mais indexada por tone"*. A reversão
> foi pedida diretamente pelo Hugo: *"gostaria que os botões de ação voltassem
> para as cores do status, ou seja, se naquela análise está amarelo, coloca o
> botão amarelo"*. **Não é desconhecimento do histórico.** Quem for mexer nisto
> no futuro precisa saber que existiram as duas decisões, nesta ordem.

### B.6 — O dado precisa existir de verdade (não é só UI)

O protótipo atual lê `percorridoPct` / `percorridoAvgPct` via
`as unknown as { percorridoPct?: number }` porque **os campos não existem no
tipo**. Isso é aceitável em protótipo descartável e **inaceitável em produção**.

O trabalho real:

1. Campos **opcionais e aditivos** em `StudentHomeSubject` (`percorridoPct?`) e
   `StudentHomeReference` (`percorridoAvgPct?`), em
   `apps/web/src/types/analytics.ts`.
2. Parâmetro **opcional, apendado ao FINAL** da assinatura de
   `buildStudentHomeIndicators` (`lib/analytics/student-home-indicators.ts:243`).
   Este arquivo já tem o padrão estabelecido de crescer por sufixo justamente
   para não tocar em call sites posicionais existentes — seguir o padrão, não
   inventar outro.
3. O chamador (`lib/analytics/area-gestor.ts:1709`) alimenta os valores. A
   leitura em lote **já existe**: `lib/analytics/view-progress-read.ts`. Reusar,
   não reimplementar.
4. **Ausente vira "sem dado", nunca `0%`.** Zero mentiria sobre quem estudou
   antes da instrumentação. É a mesma regra já valendo na tabela do gestor.

### Critérios de aceite

- **B1.** A linha antes rotulada "Progresso - conclusão" agora exibe
  exatamente `Conclusão`.
  Verificação: teste de render + `grep -n '"Conclusão"' comparison-insights-table.tsx`
- **B2.** Existe uma linha `Percorrido` **imediatamente antes** de `Conclusão`.
  Verificação: teste que lê a ordem dos rótulos renderizados.
- **B3.** A linha `Percorrido` **não renderiza botão de ação algum**.
  Verificação: teste explícito, com o porquê no comentário do próprio teste
  (para que quem o vir falhar entenda que ele guarda uma decisão, não um
  detalhe).
- **B4.** "Continuar sessão" aparece **no máximo uma vez** na tabela.
  Verificação: `screen.getAllByText("Continuar sessão")` → length ≤ 1.
- **B5.** Rótulos de Percorrido, Conclusão, Interações e Reflexões têm gatilho
  de ajuda acessível (`Sobre a coluna X`), que abre por clique.
- **B6.** O texto de ajuda do Percorrido menciona a Conclusão, e vice-versa.
  Verificação: assertion de conteúdo nos dois sentidos.
- **B7.** A cor do botão de ação varia com o `tone` da linha (`win`/`tie`/
  `behind` produzem classes distintas).
  Verificação: teste parametrizado por tone.
- **B8.** **Zero `as unknown as`** e **zero `!` (non-null assertion)** no código
  final desta tabela.
  Verificação: `grep -n "as unknown as\|ROW_HELP\[row.key\]!" comparison-insights-table.tsx` → vazio.
- **B9.** Aluno sem dado de percorrido exibe "sem dado", **não** `0%`.
- **B10.** Suíte da tabela segue verde e o baseline herdado de 7 falhas do
  repositório **não aumenta**.
  Verificação: `pnpm vitest run` + `pnpm typecheck` (exit 0) + `npx turbo build` (2/2).
- **B11.** A rota de protótipo `apps/web/src/app/preview-meu-ritmo/` **não
  existe** ao final (era descartável).
  Verificação: `test ! -d apps/web/src/app/preview-meu-ritmo`

---

## Bloco C — A leitura do resumo distingue percorrer de elaborar

Arquivo: `apps/web/src/lib/analytics/ritmo-summary.ts`

### O que ele é, e o que continua sendo

Um **compositor puro e determinístico**. O próprio arquivo declara: *"A PURE,
DETERMINISTIC composer (no LLM, no I/O, no RNG)"*. **Não é IA e não passa a
ser.** Os mesmos indicadores produzem sempre o mesmo parágrafo, e é isso que o
torna testável por igualdade exata.

### O defeito

Hoje dois alunos **opostos** recebem a mesma frase:

| Caso | Percorrido | Reflexões | Problema real | Intervenção certa |
|:---|---:|---:|:---|:---|
| Não chegou ao conteúdo | 20% | 2/41 | Não estudou | Retomar os estudos |
| Percorreu tudo, não elaborou | 100% | 8/41 | Passou por cima do exercício | Voltar e registrar |

Sem o Percorrido como variável, o compositor não consegue separá-los. Com ele,
consegue.

### C.1 — Regra dura: NUNCA sequenciar

**Proibido** gerar frase do tipo *"primeiro avance no conteúdo, depois volte
para refletir"*.

**Razão estrutural, não estilística:** a reflexão mora **dentro** do slide (é um
blockquote no meio do conteúdo). Quem percorreu sem refletir **passou por cima
do exercício** — não deixou uma etapa posterior para depois. Sequenciar
ensinaria o comportamento errado, e legitimaria exatamente a leitura que o
Percorrido existe para desmontar.

O Hugo foi explícito ao rejeitar a variante sequencial: *"não queremos que ele
faça um depois o outro"*.

### C.2 — A redação aprovada, palavra por palavra

> "Rinaldo, você percorreu o conteúdo inteiro, isso é bom. Só que parou aí: 8 de
> 41 reflexões. O material você já tem na cabeça, falta transformar em registro."

Veredito do Hugo: *"acho que esse foi o melhor até agora."*

**A fórmula por trás**, que as demais variações devem seguir:

| Passo | O que faz | No exemplo |
|:--|:---|:---|
| a | Constata com **fato**, não adjetivo | "você percorreu o conteúdo inteiro" |
| b | Valida em **três palavras** | "isso é bom" |
| c | Vira com o **número cru** | "Só que parou aí: 8 de 41 reflexões" |
| d | Fecha ligando ao que a pessoa **já tem** | "o material você já tem na cabeça" |

O passo (d) é o que torna a frase **desarmante em vez de acusatória**. Sem ele,
sobra cobrança.

### C.3 — O tom foi calibrado de propósito

O Hugo pediu *"um tom um pouco mais de cobrança"*, avaliou **três gradações mais
duras** e escolheu **manter esta**.

> Registro explícito para o futuro: o tom atual **não é falta de coragem nem
> esquecimento**. Foi testado contra alternativas mais duras e escolhido.
> Endurecer depois exige decisão nova do Hugo.

### Critérios de aceite

- **C1.** `percorridoPct` entra como variável de decisão do compositor
  (opcional: ausente → comportamento atual, sem regressão).
- **C2.** Os dois casos da tabela do defeito produzem parágrafos **diferentes**.
  Verificação: teste com os dois conjuntos de indicadores, `expect(a).not.toBe(b)`.
- **C3.** O caso "percorreu tudo, elaborou pouco" produz **exatamente** a
  redação aprovada, com os números vindos dos indicadores.
  Verificação: igualdade exata de string, no mesmo padrão dos testes existentes
  do arquivo.
- **C4.** **Nenhuma saída do compositor contém linguagem sequencial.**
  Verificação: teste varrendo as saídas de uma matriz de casos contra os padrões
  `/depois (volte|refl)/i`, `/primeiro .* depois/i` → nenhuma ocorrência.
- **C5.** O compositor permanece **puro**: sem I/O, sem RNG, sem chamada de
  modelo. Duas execuções com a mesma entrada devolvem a mesma string.
- **C6.** A casa continua sem travessão (`—`) na copy, conforme a regra já
  declarada no arquivo.

---

## Decisão confirmada — o Percorrido fica na tela do aluno

> **Hugo, 2026-07-31:** *"acredito que sim, deve permanecer na tela do aluno."*

Isto entrou nesta story primeiro como **assunção declarada**, não como decisão
dada: a implementação foi feita assumindo o "sim" (porque o Hugo já havia
aprovado uma redação que fala diretamente ao aluno, *"Rinaldo, você percorreu o
conteúdo inteiro"*), mas com a ressalva de que a pergunta seguia sem resposta.
Ele confirmou. A assunção está resolvida.

### A preocupação que foi levantada, e por que ela não se concretiza

O risco apontado era real e merece ficar registrado: se o Percorrido é munição
para a **conversa difícil**, mostrar "você percorreu 100%" ao próprio aluno
poderia virar o argumento **dele** — exatamente a reclamação que a medida
existia para desarmar.

O que neutraliza isso é o **Bloco C**. O Percorrido nunca aparece sozinho na
tela do aluno: vem sempre acompanhado da leitura que o contextualiza, e a
redação aprovada faz precisamente esse trabalho, usando o "percorreu tudo" como
**abertura** e virando na frase seguinte:

> "Rinaldo, você percorreu o conteúdo inteiro, isso é bom. Só que parou aí: 8 de
> 41 reflexões."

Ou seja: o número que poderia virar defesa é entregue já **respondido**. Quem lê
recebe o dado e a leitura dele no mesmo fôlego, e não sobra espaço para o "mas
eu completei o curso".

> ⚠️ **Consequência de projeto, e não detalhe de layout:** o Bloco C não é um
> complemento opcional do Bloco B. É o que torna o Bloco B seguro. Remover ou
> esvaziar a leitura deixaria o Percorrido exposto sem contexto na tela do
> aluno, e aí sim ele viraria munição do lado errado do balcão.

---

## Fora de escopo (registrado para não se perder)

| # | Pendência | Por que fica de fora |
|:--|:---|:---|
| 1 | Marcar a **origem** (`telemetry` vs `inferred`) dos 262 registros de backfill | Exige migration nova. Era a etapa 6 do desenho anterior. Sem isso, não dá para distinguir percorrido medido de percorrido inferido. |
| 2 | **Colisão de vocabulário**: na variante `instructor` da tabela do gestor, o rótulo "Progressão" ainda nomeia `courseProgressPct` | O Hugo cortou que *"progressão não existe"*. Renomear exige decisão de produto sobre o novo rótulo, não é ajuste mecânico. |
| 3 | **Dívida de segurança**: `saveReflection` (`reflection-actions.ts`) aceita `tenantId` **do cliente** e escreve com **service client** (bypass de RLS) | Relatada e não corrigida. Não é regressão desta story, mas é a mais grave da lista e merece story própria. |
| 4 | Desigualdade de denominador de Reflexões entre "Meu plano" (24) e "Turma" (41) | Precisa de decisão sobre qual é o denominador correto antes de qualquer código. |

---

## Riscos

| Risco | Mitigação |
|:---|:---|
| Alguém "conserta" a ausência de CTA no Percorrido | B3 é teste explícito com o porquê no comentário; §B.3 tem aviso direto |
| Alguém "endurece" o tom da leitura achando que foi esquecimento | §C.3 registra que três versões mais duras foram avaliadas e rejeitadas |
| Alguém restaura o "ROUND 27" sem saber que foi revertido de propósito | §B.5 registra as duas decisões na ordem em que ocorreram |
| Alguém volta o popover para `absolute` ao "simplificar" | §A registra que `z-index` não resolve e por quê; A1/A2 são testes de regressão |
| Percorrido ausente virar `0%` e acusar quem estudou antes da medição | B9 |

---

## Notas de implementação para o @dev

1. O working tree tem **7 arquivos modificados e 22 untracked que NÃO são deste
   trabalho**. Não use `git add -A`, não faça stash, não limpe nada.
2. O protótipo do Bloco B tem defeitos conhecidos que **não devem ser
   commitados como estão**: indentação fora do padrão do Biome (`    percorrido:`
   com 4 espaços), casts `as unknown as`, non-null assertion `!` e o botão de
   ação no Percorrido, que deve **sair**.
3. A rota `apps/web/src/app/preview-meu-ritmo/` é descartável: remover.
4. Push é autoridade exclusiva do **@devops**. Não empurre.

---

## Change Log

| Data | Versão | Mudança | Autor |
|:---|:---|:---|:---|
| 2026-07-31 | 1.0 | Story criada a partir do levantamento pós-predecessora. Blocos A/B/C, decisões com justificativa, assunção declarada, pendências fora de escopo. | River (@sm) |
| 2026-07-31 | 1.1 | Blocos A/B/C entregues e verificados. Auditoria encontrou o Bloco C **sem nenhum teste** e B3/B4/B9 descobertos (22 testes escritos), mais **3 regressões** de contrato de cache: a leitura do percorrido do sujeito rodava fresca por request e varria `chapters` (tabela ORG), quebrando AC4/AC6 — corrigida lendo do mapa que a leitura em lote do org já produz. Teto de scans de `chapter_slides` elevado de 2 para 3 **com justificativa**, e a assertion de escopo ficou mais estrita (passou a proibir também `in student_id`). | J.A.R.V.I.S. |
| 2026-07-31 | 1.2 | Assunção RESOLVIDA: Hugo confirmou que o Percorrido permanece na tela do aluno. Registrado por que a preocupação levantada não se concretiza (o Bloco C entrega o número já respondido) e que o Bloco C, por isso, não é opcional em relação ao B. | J.A.R.V.I.S. |
| 2026-08-04 | 1.3 | **Defeito corrigido — "sem dado" para quem TEM dado (caso Rinaldo).** A leitura em lote do Percorrido rodava só sobre `activeOrgStudentIds`, que nasce de `users … .eq("role","student")`. Rinaldo é `role='manager'` (multi-hat: gestor que também estuda) com 6 linhas de `chapter_view_progress`, todas no curso da própria matrícula — nunca entrava no `.in("student_id", …)`, e o que não é perguntado volta como ausência. Mesma classe do BUG-1 já documentado em `student-home-indicators.ts`, que o Percorrido (B.6) não herdou. Correção: a POPULAÇÃO DA LEITURA passa a ser quem tem matrícula no tenant (`orgCourseIdsByStudent`, já derivado, sem consulta nova), enquanto a MÉDIA da Turma segue sobre `activeOrgStudentIds` — ler o próprio número não matricula ninguém na Turma. `null` continua sendo "sem dado", nunca 0% (B9). Teste vermelho antes do fix em `__tests__/view-progress-multihat.test.ts` (mock que APLICA filtros; sob o `makeMockDb` de `area-gestor.test.ts` o bug era inexprimível). Arredondamento do valor do sujeito adicionado: `courseProgressPct` devolve a razão crua (5/8 = 62.5) e a célula renderiza `${pct}%`. | Dex (@dev) |
| 2026-08-04 | 1.5 | **O piso vira CUMULATIVO por curso, e a evidência passa a incluir sessão socrática.** A v1.4 era estreita demais: aplicava piso só DENTRO do capítulo e, medida em produção, resgatava **0 pares e 0 alunos** — inerte. O Hugo corrigiu o escopo: *"se ela interagiu no módulo 4, até o módulo 4, naquela interação tem que estar concluído pelo menos no percorrido"*. Agora, por (aluno, curso), o maior `chapters.order` com evidência é o TETO: todo capítulo estritamente abaixo conta como percorrido completo, e o capítulo do teto recebe só o piso de SLIDE (a interação pode ser no slide 3 de 25; marcar o módulo inteiro afirmaria o que não se sabe). Evidência = reflexão (dá teto E piso de slide) + sessão socrática de **qualquer status** (dá só o teto; a pergunta é "chegou até aqui?", não "terminou?", a mesma régua de `whereStoppedChapterIdOf`). Medido em produção: **287 pares (aluno, capítulo) de 104 alunos** abaixo do teto e sem nenhuma linha de `chapter_view_progress`; efeitos reais 13%→88%, 63%→100%, 25%→75%, 0%→25%. `max()` preservado (telemetria maior vence), linhas sintéticas SÓ em memória (nada escrito no banco), e `slides_total_at_last_view` da linha sintética grava o total de HOJE para não acender `hasNewContent` falsamente para as 104 pessoas. **Ressalva registrada no código:** não há travamento sequencial de capítulos neste repositório (verificado), logo "interagiu no 4 ⇒ passou por 1..3" é heurística de produto decidida pelo Hugo com o 287 na mesa, não dedução lógica. `chapters."order"` e `sessions.chapter_id` entram em varreduras que já existiam: **zero consulta nova** nas três superfícies. 20 testes no leitor (mutação dupla derruba 8). | Dex (@dev) |
| 2026-08-04 | 1.4 | **Piso por evidência de exercício** (pedido do Hugo): interagir com um ponto prova presença nele, logo a reflexão no slide N é piso do percorrido do capítulo. `applyExerciseFloor` (puro, exportado) aplica com `max()` — onde há telemetria, a maior vence — e a linha sintética nasce com `reached_last_slide_at: null` (chegar ao slide N não é ter chegado ao fim). Ligado nas TRÊS superfícies pela mesma porta (`readViewProgressByStudent`), com `slide_id` entrando na projeção de varreduras que já existiam: zero consulta nova. **Medido em produção antes de escrever: 0 alunos e 0 pares (aluno, capítulo) seriam resgatados hoje** — é seguro por invariante, NÃO a explicação do "sem dado" acima; o número está comentado no código para ninguém concluir o contrário. 3 casos sintéticos exigidos + borda de capítulo fora da trilha e de reflexão sem `slide_id`. | Dex (@dev) |
