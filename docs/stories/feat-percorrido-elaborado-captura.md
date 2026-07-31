# Story: Percorrido x Elaborado — captura da exposição por módulo

**Version:** 1.0
**Created:** 2026-07-30
**Author:** Dex (@dev)
**Status:** Ready for Review (parcial — ver §Escopo entregue)
**Priority:** P2
**Branch:** `deploy/cory`
**Type:** Feature (brownfield)
**Contrato:** `docs/architecture/medicao-percorrido-vs-elaborado.md`

---

## User Story

**As a** gestor da eximIA Academy,
**I want** distinguir quem completou um curso elaborando (exercícios, reflexões,
interações socráticas) de quem apenas passou os slides,
**so that** eu intervenha com a pessoa certa antes que o investimento em
treinamento vire desperdício.

---

## Escopo entregue nesta story

| # | Entrega | Status |
|---|---------|:------:|
| 1 | Route handler de escrita da marca d'água | **Feito** |
| 2 | Captura no viewer (observador de `currentIndex`) | **Feito** |
| 3a | Motor de cálculo derivado + testes | **Feito** |
| 3b | Fiação na tabela do gestor (UI) | **Feito** (rodada 2) |
| 4 | Aplicação da migration em produção | **Não feito** (decisão de Hugo + @devops) |

A ordem não é acidental: o documento de arquitetura (§9) registra que a métrica
só vale prospectivamente, então **cada dia sem a captura no ar é um dia de série
perdido**. Captura primeiro, leitura depois, é o que preserva dado.

---

## Implementação

### 1. Route handler

`apps/web/src/app/api/chapter-view-progress/route.ts` (novo)

Recebe `{ chapterId, maxSlideIndex, slidesTotal, reachedLastSlide }` e faz upsert
em `chapter_view_progress`.

Invariantes de segurança, conforme §6 do contrato:

- `tenant_id` resolvido **no servidor** a partir da sessão. O payload nunca o
  informa; aceitá-lo permitiria semear linhas em outra empresa.
- O `chapterId` é validado contra o tenant da sessão (`chapters` tem `tenant_id`
  direto), pelo mesmo motivo.
- **Zero uso de service client.** É escrita do próprio aluno sobre o próprio
  dado; a RLS vale integralmente. Verificado:
  `grep -c "createServiceClient" route.ts` → `0`.
- Monotonicidade **não** é reimplementada aqui: o trigger
  `chapter_view_progress_invariants` faz o clamp no banco, o que mantém a
  invariante válida mesmo com requisições fora de ordem (condição normal, já que
  o cliente coalesce e usa `sendBeacon`).

### 2. Captura no viewer

`.../present/_components/use-chapter-view-tracker.ts` (novo) +
2 linhas em `presentation-viewer.tsx`.

O efeito observa o **estado** `currentIndex`, não a função de navegação. Motivo
verificado no código: existem **dois** caminhos que trocam o slide —
`goToSlide` (`presentation-viewer.tsx:190`, navegação deliberada) e o
auto-advance por timestamp de áudio (`presentation-viewer.tsx:273`,
`setCurrentIndex` direto). Um gancho na navegação perderia todo o segundo
caminho, e observar o estado é imune a caminhos que ainda não existem.

Comportamento:

| Gatilho | Ação |
|---------|------|
| Índice supera a marca d'água local | Agenda escrita com debounce de 3s |
| Índice **não** supera (revisita) | Nada é escrito |
| Alcança o último slide | **Flush imediato, sem debounce** — é o evento que define o percorrido e não pode depender de timer |
| `visibilitychange` (hidden) / `pagehide` | Flush via `navigator.sendBeacon` |
| Falha de rede | Silenciosa. Telemetria nunca degrada a aula |

**Decisão de Hugo honrada:** o avanço automático por áudio **conta** como
percorrido. Não há checagem de visibilidade da aba nem ramificação por origem do
avanço (contrário à recomendação técnica original, registrado em §8 do contrato).

### 3a. Motor de cálculo

`apps/web/src/lib/analytics/view-progress.ts` (novo)

Puro, sem I/O, sem armazenar percentual. Expõe `moduleProgressPct`,
`courseProgressPct`, `hasNewContentSince`, `shouldAdvanceWatermark` e
`summarizeCourseView`.

O `pct` do curso é **`null` quando não há dado**, e `null` deve virar
"sem dado" na UI, jamais "0%": a métrica nasce vazia para todos, e um zero
mentiria sobre quem estudou antes de a instrumentação existir.

---

## Divergência — RESOLVIDA (Hugo, 2026-07-30: "manda ver, finaliza")

Na rodada 1 o trabalho parou aqui de propósito. O contrato pedia desdobrar a
célula "Progresso" em PERCORRIDO e ELABORADO, mas o ELABORADO **já existe** como
a coluna "ENGAJ." (`N interações · M reflexões`), e o desdobramento literal
duplicaria informação em colunas vizinhas.

**Resolução:** a célula passa a mostrar **DECLARADO** (o `courseProgressPct`
atual, que é o clique no botão "Módulo Concluído") contra **PERCORRIDO** (a
exposição real). É o contraste entre esses dois que expõe quem clicou sem ver;
o elaborado permanece na coluna ao lado, sem duplicação.

Efeito visível, com os alunos reais do caso:

| Aluno | Declarado | Percorrido | O que a célula revela |
|-------|:---------:|:----------:|-----------------------|
| Caio Pinheiro | 100% | 100% | Concluiu e percorreu |
| Neusa Jorge | 100% | 25% | **Declarou conclusão tendo percorrido um quarto** |
| Oziel Silva | 100% | 88% + "conteúdo novo" | Percorreu quase tudo; o capítulo mudou depois |
| Venilton Amaral | 0% | sem dado | Nunca iniciou; "sem dado" e não "0%" |

## Implementação da leitura (rodada 2)

- `lib/analytics/view-progress-read.ts` (novo): busca as linhas, resolve o
  denominador ATUAL por capítulo e agrega com `summarizeCourseView`.
  **Degradação graciosa é requisito, não zelo:** a tabela
  `chapter_view_progress` ainda NÃO existe em produção (REST 404), então
  qualquer erro ou exceção devolve "sem dado" e a página do gestor continua de
  pé — ela é usada por cliente pagante.
- `app/api/engagement/students/route.ts`: leitura ligada, dois campos aditivos
  na saída (`viewProgressPct`, `viewHasNewContent`).
- `components/analytics/student-insights-table.tsx`: célula desdobrada, contrato
  da linha estendido com campos OPCIONAIS (não quebra `instructor/actions.ts`,
  o outro chamador), header e linhas do CSV com a coluna "Percorrido".

Um detalhe de tipos: o cliente Supabase gerado estoura o limite de instanciação
do TS (TS2589) ao casar com a interface estrutural mínima do leitor. Resolvido
com cast explícito e comentado no ponto de chamada; o contrato real fica
garantido pelos testes do leitor, que injetam um duplo.

## Rodada 3 (Hugo, 2026-07-30): coluna própria e backfill

**Coluna própria.** Hugo, vendo a tela: "estava pensando ele como uma nova coluna
entre ritmo e progresso". O percorrido saiu de dentro da célula "Progresso" (que
voltou ao formato original) e virou coluna ordenável entre RITMO e PROGRESSO.
Na ordenação, "sem dado" resolve como `-1`, indo sempre depois de qualquer
medição real — ausência de dado não pode se confundir com zero. O CSV seguiu a
mesma ordem visual.

**Backfill retroativo — o histórico é PARCIALMENTE recuperável.**

Correção de uma afirmação anterior desta própria story: eu havia registrado que
o dado "não é reconstruível retroativamente". Está errado. `slide_reflections`
guarda `slide_id`, e isso **prova** que o aluno esteve naquele slide. Cruzando
com `chapter_slides.order`, o maior order com reflexão é uma marca d'água
mínima comprovada.

Medição real contra produção (dry-run do script):

| Medida | Valor |
|--------|------:|
| Reflexões com slide | 539 |
| Pares (aluno, capítulo) recuperáveis | 262 |
| Alunos alcançados | 92 |
| Capítulos cobertos | 15 |
| Pares com o ÚLTIMO slide provado | 67 |

Script: `scripts/backfill-chapter-view-progress.mjs`, dry-run por default,
idempotente, e **dado real de telemetria sempre vence o inferido**.

**A limitação, dita sem maquiagem:** isto é um PISO, não a verdade. Subestima
sempre (quem refletiu no slide 5 de 20 pode ter visto os 20) e não cobre quem
passou os slides sem refletir. Nunca superestima, e é isso que o torna seguro.
Os alunos da tela mostram o efeito com honestidade: Caio 62%, Cintia 50%,
Oziel 62%, enquanto **Artur e Neusa continuam "sem dado"** por terem zero
reflexões — não deixaram rastro de presença em slide nenhum.

## Rodada 4 (2026-07-31): o defeito que fez a coluna nascer vazia

Hugo abriu a tela depois do deploy e a coluna mostrava **"sem dado" para todos**,
com 263 linhas já no banco. Não era dado, migration nem backfill.

**Causa raiz: instrumentei um caminho e a tela usava outro.** `StudentInsightsTable`
tem múltiplos consumidores, e a leitura só havia sido ligada em
`/api/engagement/students`. A tela do dashboard do gestor é servida por outro
fluxo inteiro, server-side:

```
manager-dashboard-page.tsx:148  →  getStudentDetails()  (instructor/actions.ts)
        →  studentDetails  →  <ManagerDashboard>  →  <StudentInsightsTable>
```

**Segundo defeito, independente:** o adaptador `toInsightRow` em `roster-tab.tsx`
monta a linha campo a campo e **não copiava** `viewProgressPct`. Ou seja, mesmo
no caminho instrumentado, o valor era descartado antes de chegar ao componente.

Pior: o teste `to-insight-row.test.ts` **já existia** justamente para pegar esta
classe de erro, e traz o comentário "a silent field typo here would break a
column without breaking tsc". Eu adicionei o campo ao contrato e não estendi o
teste. O teste estava certo; faltou usá-lo.

**Correção:** a leitura foi ligada dentro de `getStudentDetails`, e não em cada
página. Essa função alimenta as **três** superfícies que mostram a tabela
(dashboard do gestor, página do instrutor e dashboard do admin), então um ponto
só corrige as três, e o `serviceClient` e os enrollments já estavam em mãos ali
(o `course_id` já vinha no select; era o map que o descartava). O adaptador do
roster-tab passou a propagar os dois campos.

**Regressão coberta:** 4 casos novos no teste que já existia, incluindo o campo
ausente do contrato degradando para `null` e a garantia explícita de que `null`
nunca vira `0`.

## Etapa 1 do novo desenho (2026-07-31): interação alimenta a marca d'água

Contrato: `docs/architecture/percorrido-progressao-conclusao.md` §2.1.

**A tese:** todo ponto de interação vive num slide, então interagir com ele PROVA
presença naquele slide. Com isso, a invariante `progressão ≤ percorrido` deixa de
ser uma regra a lembrar e passa a ser **impossível de violar**: não existe caminho
de código que registre interação sem registrar presença.

Dois caminhos ligados, ambos em `lib/analytics/record-slide-presence.ts` (novo):

| Caminho | Função | Carimba o fim? |
|---------|--------|----------------|
| Salvar reflexão de slide | `recordSlidePresence(slideId)` | Só se o slide for o último |
| Concluir interação socrática | `recordChapterEndPresence(chapterId)` | Sim — a socrática só existe no último slide |

**A regra mais importante, e o teste existe para ela:** telemetria é
SUBORDINADA. Nenhuma das duas funções lança, em nenhuma circunstância. Se a
escrita de presença falhar, a reflexão do aluno é salva do mesmo jeito. Um aluno
perder a própria reflexão por causa de uma métrica seria muito pior do que a
métrica faltar.

**Segurança, melhor do que o código vizinho:** o `tenant_id` é resolvido do banco
a partir da sessão, nunca aceito por parâmetro, e o tenant do slide precisa bater
com o do usuário. Usa client com RLS, nunca service client.

**Observação registrada sobre o deep link:** existe `?focus=interaction`, que abre
o capítulo direto no último slide. Quem usa esse atalho e faz a socrática ganha o
carimbo sem passar pelos slides do meio. Isso NÃO foi introduzido aqui — nesse
fluxo a navegação já alcança o último slide e o tracker já carimbaria igual. Se
um dia se quiser fechar o flanco, o lugar é o deep link, não este registro.

### Achado de segurança fora do escopo, relatado e NÃO corrigido

`saveReflection` (`reflection-actions.ts`) aceita `tenantId` **vindo do cliente**
e escreve com **service client** (bypass de RLS). Um aluno poderia, em tese,
gravar reflexão carimbada com o tenant de outra empresa. Não toquei porque está
fora do escopo desta etapa e mexer ali exige verificar os chamadores, mas fica
registrado como dívida de segurança conhecida.

## Etapa 3 (2026-07-31): heurística extraída e progressão calculada

**Parte A — a heurística virou fonte única.** `isReflectionBlock` saiu de dentro
de `presentation-viewer.tsx` (componente client, avaliada em tempo de render) e
foi para `lib/analytics/interaction-points.ts`, **sem mudança de comportamento**:
os cinco padrões, na mesma ordem. O viewer passou a importar de lá.

Junto veio `extractBlockquotes`, que agrupa linhas `>` consecutivas num único
bloco — que é como o `react-markdown` entrega ao componente. Sem esse
agrupamento, um bloco de três linhas seria testado como três textos e a
classificação poderia divergir do que a tela decide.

**Validação cruzada que dá confiança na extração:** o dry-run do recálculo
encontrou **123 pontos** em 698 slides. Uma consulta SQL independente, feita
antes e com regex diferente, tinha dado **exatamente 123**.

**Parte B — `lib/analytics/progression.ts`**, puro e sem I/O:

```
progressão = pontos respondidos / pontos EXISTENTES
```

- Capítulo sem nenhum ponto **não entra no denominador**. Não se pode exigir
  "interagiu com tudo" onde não há nada a fazer.
- Curso sem ponto algum devolve **`null` = "sem dado"**, jamais 0% (que acusaria
  o aluno de não fazer o que não existe) e jamais 100% (que daria mérito por
  nada).
- A invariante `progressão ≤ percorrido` **não é imposta no cálculo**, e isso é
  deliberado: ela é garantida na ESCRITA pela etapa 1. Um cálculo que
  "corrigisse" o número estaria escondendo defeito de captura em vez de expô-lo.
  Há um teste que documenta a relação.

**Script de recálculo** (`scripts/recompute-interaction-points.mjs`): varre a
fila de stale, classifica e grava. Dry-run por padrão, idempotente. **Não
executado contra produção ainda.**

Dívida registrada no próprio script: a heurística está replicada nele porque é
`.mjs` puro, rodado sem bundler. Importar o módulo TS exigiria pipeline de build
para um utilitário de manutenção. Se um dia virar mais que uma função, o certo é
extrair para pacote compartilhado, não deixar duas cópias crescerem.

## Etapas 4, 5 e 6 (2026-07-31): a progressão chega à tela

**Etapa 4 — leitura.** `lib/analytics/progression-read.ts` monta os insumos e
chama `courseProgression`. Pontos existentes = slides com `interaction_type` não
nulo, mais um ponto socrático por capítulo com pergunta ativa. Respondidos =
`slide_reflections` do aluno e `sessions` concluídas. Ligada em
`getStudentDetails`, ao lado do percorrido — um ponto só serve as três
superfícies da tabela. Degradação graciosa mantida: qualquer falha vira Map
vazio ⇒ "sem dado".

**Etapa 5 — coluna.** Ordem final: `RITMO | PERCORRIDO | PROGRESSÃO | PROGRESSO
| ENGAJ. | AÇÃO`. Ordenável, com "sem dado" no lugar de "0%", e sem nenhum rótulo
classificando a pessoa. CSV alinhado. O adaptador `toInsightRow` propaga o campo,
com 3 casos novos no teste que existe justamente para pegar campo perdido — foi
esse adaptador que fez a coluna anterior nascer vazia.

### COLISÃO DE VOCABULÁRIO encontrada e registrada

O rótulo "Progressão" **já estava em uso**: na variant `instructor`, ele nomeia
exatamente o mesmo dado que a variant `manager` chama de "Progresso"
(`courseProgressPct`, a conclusão declarada). Existe um teste que garantia isso.

Resultado hoje: **"Progressão" significa coisas diferentes conforme a tela.** No
gestor é "interagiu com todos os pontos"; no instrutor é "conclusão declarada".
Não renomeei nada por conta própria — a decisão é do dono do produto. Registrado
no teste e aqui. Sugestão: a variant instructor adotar "Progresso", igualando ao
gestor, e "Progressão" ficar reservada ao conceito novo.

### Etapa 6 — origem do backfill: RELATADA, não implementada

Marcar os 262 registros inferidos exige **coluna nova em
`chapter_view_progress`**, portanto migration. Fica como pendência deliberada em
vez de ser empurrada junto: esta rodada já entrega leitura, coluna e adaptador, e
misturar mais uma migration aqui aumentaria o blast radius sem necessidade. A
informação não se perde — os registros de backfill são identificáveis hoje por
não terem `first_viewed_at` vindo de sessão real, e o script que os criou está
versionado.

## Arquivos

| Arquivo | Mudança |
|---------|---------|
| `apps/web/src/app/api/chapter-view-progress/route.ts` | Novo: escrita da marca d'água |
| `apps/web/src/app/(platform)/courses/.../present/_components/use-chapter-view-tracker.ts` | Novo: captura no cliente |
| `apps/web/src/app/(platform)/courses/.../present/_components/presentation-viewer.tsx` | 2 linhas: import + chamada do hook |
| `apps/web/src/lib/analytics/view-progress.ts` | Novo: cálculo derivado |
| `apps/web/src/lib/analytics/__tests__/view-progress.test.ts` | Novo: 17 testes |
| `apps/web/src/lib/analytics/view-progress-read.ts` | Novo: leitura com degradação graciosa |
| `apps/web/src/lib/analytics/__tests__/view-progress-read.test.ts` | Novo: 5 testes de leitura |
| `apps/web/src/app/api/engagement/students/route.ts` | Leitura ligada + 2 campos aditivos |
| `apps/web/src/components/analytics/student-insights-table.tsx` | Célula desdobrada + CSV |
| `apps/web/src/components/analytics/__tests__/student-insights-table.test.tsx` | 5 asserções de CSV atualizadas para a coluna nova |
| `docs/stories/feat-percorrido-elaborado-captura.md` | Novo: esta story |

---

## Validações

| Gate | Resultado |
|------|-----------|
| Testes novos | **22/22 passam** (17 de cálculo + 5 de leitura) |
| Suíte completa | **7 falhas** / 2002 passam — idêntico ao baseline herdado, zero regressão |
| Typecheck | exit 0, limpo |
| Lint (arquivos novos) | Limpo |
| Build (`turbo build`) | **2/2 tasks successful** |
| Service client na escrita do aluno | **0 ocorrências** |

Cobertura dos testes: curto-circuito do `reached_last_slide_at`; capítulo que
ganha slides (não rebaixa, mas sinaliza); capítulo que perde slides (clamp em
100%); denominador ausente; marca d'água que não escreve em revisita; e o
`null` que nunca pode virar 0%.

---

## Pendências

1. **Migration não aplicada.** `20260730000000_chapter_view_progress.sql` está
   escrita e não aplicada. **Enquanto ela não subir, o route handler responde 500
   em toda escrita** (tabela inexistente). Isso é silencioso para o aluno por
   contrato, mas significa que a captura só começa a colher depois da aplicação.
2. **Push** não executado — autoridade exclusiva do @devops.
3. ~~Decisão de UI~~ — resolvida, ver §Divergência.
4. **Gate adversarial do @qa**, com prova explícita de isolamento cross-tenant
   (positivo + os dois controles negativos descritos na migration).
