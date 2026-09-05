# LOOP-3 — Auditoria visual com aplicação viva

> **Papel:** revisor (maker ≠ checker). Nenhum arquivo de código foi alterado.
> **Data:** 2026-08-28 · **Repo:** `/Users/hugocapitelli/Dev/eximia/eximia-academy-v2`
> **Branch:** `integra/main-cory` · **HEAD:** `d2b8083`
> **Prova de não-intervenção:** no momento em que esta auditoria terminou de medir,
> `git diff --stat -- apps/web/src` saía **vazio**, e a única modificação rastreada na
> árvore era o `GABARITO.json` — que **já estava modificado antes desta auditoria
> começar** (analisado na §1 e na §11.4).
>
> **Correção posterior, para não afirmar mais do que se mediu.** Numa reconferência
> final, `apps/web/src/lib/__tests__/rate-limit.test.ts` apareceu modificado
> (+8/−2: inventário de limiters de 16 → 18, `courseDesignerAuditLimiter` e
> `courseDesignerApplyLimiter`), junto com `docs/stories/.../story-9.1-*.md`. **Nada
> disso é desta auditoria** — são trabalhos de outros agentes na mesma árvore, feitos
> em paralelo. Esta auditoria não escreveu uma linha de código de produção nem de
> teste; os únicos arquivos que ela criou estão sob
> `docs/auditoria/consolidacao-2026-08-28/`, e seu harness vive em `/tmp/loop3/`.
> Registro isto em vez de deixar a frase "diff vazio" de pé, porque ela deixou de ser
> verdadeira depois que eu a escrevi.

---

## 0. Como a aplicação subiu (e por que não foi pela porta 3000)

O comando do briefing **falha neste checkout**:

```
$ pnpm --filter @eximia/web dev
FATAL: An unexpected Turbopack error occurred.
Error [TurbopackInternalError]: Next.js package not found
- Execution of get_next_package failed
```

Causa provada, não suposta: o `node_modules` deste repositório está **cruzado com
o worktree `wt-baseline`**, num ciclo que o Turbopack se recusa a seguir por sair
da raiz do projeto:

```
apps/web/node_modules/next
  -> ../../../../wt-baseline/node_modules/.pnpm/next@15.5.12_.../node_modules/next

/Users/hugocapitelli/Dev/eximia/wt-baseline/node_modules
  -> /Users/hugocapitelli/Dev/eximia/eximia-academy-v2/node_modules   (symlink de volta)
```

O `.modules.yaml` foi reescrito em **28/08 18:41**, ou seja, um `pnpm install`
rodado de dentro do `wt-baseline` hoje religou os links do repositório principal
para caminhos que passam pelo worktree. Os arquivos existem e resolvem no nível
do SO — só o Turbopack reprova.

**Contorno usado (sem tocar em nenhum arquivo):** subir o mesmo Next em modo
webpack, invocando o binário direto.

| Rodada | Comando | Porta | Para quê |
|:---|:---|:---:|:---|
| 1 | `./node_modules/.bin/next dev -p 3311` | **3311** | primeiro contato; expôs o defeito de tenant |
| 2 | `NEXT_PUBLIC_TENANT_SLUG=gauntlet-descartavel ./node_modules/.bin/next dev -p 3312` | **3312** | **rodada oficial** — todas as capturas e medições deste laudo |

Confirmação de 200 antes de qualquer medição, nas 6 rotas:

```
autogestao-visao-geral              200  0.838470s
autogestao-padroes                  200  2.131576s
autogestao-mapa                     200  1.573230s
aprendizagem-visao-geral            200  0.967393s
aprendizagem-padroes-evolucao       200  1.013272s
aprendizagem-mapa-capacidades       200  1.017748s
```

> **Atenção ao ler `200` neste laudo.** As três rotas de Aprendizagem devolvem
> `200` e mesmo assim exibem uma tela de erro (§3). HTTP 200 aqui **não é sinal
> de tela viva** — foi exatamente por isso que a medição de DOM existiu.

O servidor de dev subido por esta auditoria foi **encerrado ao final**.

---

## 1. Veredito sobre o `GABARITO.json` não commitado

**Classificação: NEUTRO quanto ao rigor. Não houve afrouxamento.**

```
$ git diff --stat docs/gauntlet/autogestao-jornada/GABARITO.json
 1 file changed, 13 insertions(+), 13 deletions(-)
```

As 13 linhas trocadas são **exclusivamente UUIDs**: `courseId`, os 8 `capituloIds`,
e o par `studentId`/`enrollmentId` de `alunoA` e `alunoB`. **Nenhum valor esperado
mudou** — `chapterAtualIndex` (4 e 2), `temPlano` (true e false), e os 19 elementos
numéricos de cada aluno (`1.4_progresso_real_percentual: 50`, `2.4_maior_intervalo_dias: 15`,
`3.6_marco_modulo6_duracao_zero.faltaProva: true`, etc.) estão byte a byte idênticos
nos dois lados do diff.

Ou seja: a régua **não** foi ajustada para caber no resultado. O que aconteceu foi
uma **re-semeadura do tenant descartável** — o `semear.mjs` rodou de novo e gerou
novas chaves, e o gabarito foi reapontado para elas.

**O que ainda assim está errado nisto:** o gabarito **commitado** aponta para UUIDs
que não existem mais. Qualquer pessoa que faça checkout limpo e rode a prova está
medindo contra linhas mortas. A régua versionada e a régua em uso divergem, e a
divergência é invisível até alguém rodar. **Recomendação:** commitar o reaponte, ou
(melhor) fazer a prova resolver os IDs por `slug`/`code` em tempo de execução, para
que a régua pare de carregar chaves de uma semeadura específica.

---

## 2. Autogestão da Jornada — as 3 telas estão vivas

Medição de DOM ao vivo, viewport 1440×900, dado real do tenant `gauntlet-descartavel`.

### 2.1 Nenhum overlay cobre a tela (a regressão do `CtaRodape` não reincidiu)

`document.elementFromPoint()` no centro e nos 4 quadrantes devolve **elementos
diferentes** em todas as 3 telas — não há um único elemento sequestrando o viewport:

```
autogestao-visao-geral  centro=div.mt-[12px] | supEsq=div.pb-24 | supDir=div.pb-24
                        infEsq=li.flex       | infDir=div.mt-[14px]
                        overlaySuspeito=false   todosOsPontosIguais=false

autogestao-padroes      centro=svg           | supEsq=div.pb-24 | supDir=div.pb-24
                        infEsq=div.flex      | infDir=div.flex
                        overlaySuspeito=false   todosOsPontosIguais=false

autogestao-mapa         centro=div.relative  | supEsq=div.pb-24 | supDir=div.pb-24
                        infEsq=div.mt-[10px] | infDir=section.bg-white
                        overlaySuspeito=false   todosOsPontosIguais=false
```

### 2.2 A página rola de verdade

Não bastou comparar alturas; `window.scrollTo(0,800)` foi executado e `window.scrollY`
lido depois:

| Tela | `scrollHeight` | `clientHeight` | `scrollY` após `scrollTo(0,800)` | rolou? |
|:---|---:|---:|---:|:---:|
| autogestao-visao-geral | 1246 | 900 | **346** | sim |
| autogestao-padroes | 1520 | 900 | **620** | sim |
| autogestao-mapa | 1237 | 900 | **337** | sim |

(`scrollY` para em `scrollHeight − clientHeight`, o fim legítimo do documento.)

### 2.3 Todo controle visível é alcançável por clique

Hit-test em cada controle interativo: pega o centro da caixa do controle e confere
se `elementFromPoint` devolve ele mesmo ou um descendente. **Zero bloqueados** nas 3 telas.

| Tela | controles | visíveis | alcançáveis | **bloqueados** |
|:---|---:|---:|---:|---:|
| autogestao-visao-geral | 15 | 13 | 13 | **0** |
| autogestao-padroes | 12 | 10 | 10 | **0** |
| autogestao-mapa | 12 | 10 | 10 | **0** |

### 2.4 Conteúdo real, zero placeholder pendurado

`skeletons = 0` nas 3 telas (nenhum `.animate-pulse`, `[class*=skeleton]` ou
`aria-busy=true` sobrou na tela). O vazio, onde existe, é **declarado**: 2, 3 e 1
ocorrências de "Falta prova" respectivamente, cada uma com o motivo escrito ao lado
— que é exatamente o comportamento que a `CRITERIOS-FIDELIDADE.md` manda ("a linha
de apoio deve existir, exibindo 'Falta prova' com o motivo").

---

## 3. Aprendizagem do Time — as 3 telas NÃO renderizam contra o motor

Este é o achado central da rodada.

### 3.1 O sintoma

As 3 rotas devolvem `200` e desenham **uma tela quase em branco com um erro cru de
banco impresso na cara do usuário**:

> **Não foi possível carregar a Aprendizagem do Time**
> `column capabilities.title does not exist`

Medição, viewport 1440×900, modo motor (o **default** destas rotas):

| Tela | `scrollHeight` | `clientHeight` | rolou? | chars de texto | headings |
|:---|---:|---:|:---:|---:|---:|
| aprendizagem-visao-geral | 900 | 900 | **não** | 499 | **1** |
| aprendizagem-padroes-evolucao | 900 | 900 | **não** | 495 | **1** |
| aprendizagem-mapa-capacidades | 900 | 900 | **não** | 498 | **1** |

Comparação honesta: as telas de Autogestão têm 1200–1597 chars e **8 headings**.
As de Aprendizagem têm **1 heading** — o próprio título do domínio. Não há conteúdo.

### 3.2 A causa, provada contra o banco

Não é falta de dado e não é o tenant. É **incompatibilidade de esquema**. A consulta
em `apps/web/src/lib/analytics/aprendizagem-time/fonte-supabase.ts:97` pede:

```js
.from("capabilities")
.select("id, course_id, title, slug")
.eq("tenant_id", p.tenantId)
.eq("is_active", true)
.order("display_order")
```

Sondagem coluna a coluna contra o banco (leitura apenas):

```
AUSENTE title           <- column capabilities.title does not exist
AUSENTE slug            <- column capabilities.slug does not exist
AUSENTE is_active       <- column capabilities.is_active does not exist
AUSENTE display_order   <- column capabilities.display_order does not exist
existe  name
existe  code
existe  order
linhas em capabilities: 15
```

Colunas reais: `id, tenant_id, course_id, code, name, description, focus_text, order, created_at, updated_at`.

**São 4 divergências, não 1.** O Postgres só reporta a primeira, então corrigir
`title` apenas move o erro para `slug`, depois `is_active`, depois `display_order`.
A tabela tem **15 linhas** — o dado existe; a consulta é que está falando outro idioma.

Segundo sítio com o mesmo defeito: `.../classificador/fontes-evidencia.ts:143`
também filtra por `is_active`.

Isto contradiz o commit `5c3c57b` *"reconciliacao de Aprendizagem do Time com o
schema que ja existia"*: o caminho de leitura **não** foi reconciliado.

### 3.3 Por que uma auditoria só de screenshot teria aprovado isto

Com `?fonte=fixture` as mesmas 3 rotas renderizam completas e bonitas — Placar da
aprendizagem com 78%/64%/51%/64%, "O que merece atenção agora?", "O que fazer agora",
"Capacidades com maior evolução", "Gaps prioritários" (ver
`capturas/aprendizagem-visao-geral--fonte-fixture--desktop.png`).

A UI está construída. **O que não funciona é ela contra o banco.** Um gauntlet rodado
em modo fixture fotografa a tela rica, marca os critérios estruturais e fecha em
verde — enquanto o produto contra o banco real mostra um erro de SQL. É o precedente
"115/118 numa tela que não fazia nada", com a fixture no papel de álibi.

### 3.4 Defeito secundário: vazamento de erro de banco para o usuário

A tela imprime literalmente `column capabilities.title does not exist`. Isso é
mensagem de motor de banco exposta ao usuário final: divulga nome de tabela e de
coluna, e não diz nada acionável a um gestor. As telas de Autogestão fazem o oposto
e certo ("Falta prova." + motivo em português). Além disso não há ação de recuperação
— nem "tentar de novo", nem caminho alternativo. É um beco sem saída.

---

## 4. Tabela de vereditos por critério

### 4.1 Tela 1 — Visão Geral da Autogestão (`CRITERIOS-FIDELIDADE.md`, F-V-01..20)

| Critério | Veredito | Evidência |
|:---|:---:|:---|
| F-V-01 ícone circular à esquerda, texto à direita (2 col) | **PASSA** | 4 tiles com ícone circular; captura desktop |
| F-V-02 ícone com cor própria por tile | **PASSA** | azul / âmbar / azul / roxo |
| F-V-03 linha de apoio abaixo do valor | **PASSA** | "Você voltou a estudar…", "Falta prova. não existe meta…" |
| F-V-04 três níveis (rótulo caixa alta / valor grande / apoio cinza) | **PASSA** | "REGULARIDADE" / "1,9x por semana" / apoio |
| F-V-05 ícone ⓘ ao lado de cada título de bloco | **PASSA** | zoom `zoom-atencao.png` mostra o ⓘ |
| F-V-06 "O que mudou comigo" em caixas | **PASSA** | 3 caixas, não lista |
| F-V-07 seta grande colorida à esquerda | **PASSA** | ↑ verdes |
| F-V-08 valor + rótulo, comparação em cinza abaixo | **PASSA** | "+8 sessões" / "em relação ao período anterior." |
| F-V-09 ícone **quadrado** colorido nos itens de atenção | **PASSA** | zoom: quadrado de cantos arredondados, fundo âmbar |
| F-V-10 chevron › à direita | **PASSA** | visível no zoom |
| F-V-11 link **"Ver todos os pontos de atenção →"** | **FALHA** | busca textual: `false`. Existe "Ver meu mapa da jornada ›" no lugar |
| F-V-12 DOIS botões, um sólido e um de contorno | **PASSA** | "Retomar sessão" sólido + "Ajustar meu plano" contorno |
| F-V-13 título entre aspas, peso forte, apoio abaixo | **PASSA** | Retome "Ações Corretivas" |
| F-V-14 mini gráfico de linha no canto sup. dir. | **PASSA** | 3 `<svg>` no bloco; linha verde visível |
| F-V-15 4 colunas com divisória vertical | **PASSA** | 4 colunas divididas |
| F-V-16 ícone grande, título em verde, descrição 2–3 linhas | **PASSA** (com ressalva) | ícone grande e título verde presentes; descrição tem **1** linha, não 2–3 |
| F-V-17 rodapé com ícone, título negrito, texto na linha seguinte | **PASSA** | "Dica Exímia" |
| F-V-18 dropdown único com ícone de calendário | **PASSA** | "Últimos 30 dias" com ícone |
| F-V-19 avatar no canto superior direito | **PASSA** | avatar "E" |
| F-V-20 linha **"Atualizado há Xh"** com ícone de recarregar | **FALHA** | busca textual `/Atualizado h[áa]/i` → `false`; ausente na captura, presente na referência |

**Placar Tela 1: 18 PASSA / 2 FALHA de 20.**

### 4.2 Tela 2 — Meus Padrões e Tendências (F-P-01..12)

| Critério | Veredito | Evidência |
|:---|:---:|:---|
| F-P-01 linha de referência tracejada horizontal | **PASSA** | tracejado em y=1 |
| F-P-02 legenda com duas séries distintas | **PASSA** | "Dias ativos por semana" (sólida) + "Média das semanas exibidas: 1,1" (tracejada) |
| F-P-03 área de plotagem generosa | **PASSA** | gráfico domina o card |
| F-P-04 rótulos do eixo X em **todas** as semanas | **PASSA** | 12 de 12 rótulos, sem omissão alternada |
| F-P-05 tile com três níveis | **PASSA** | "Frequência média" / "1,9x" / "por semana" |
| F-P-06 4 tiles com fundo âmbar suave | **PASSA** | âmbar, não branco |
| F-P-07 ícone circular colorido por insight | **PASSA** | check verde, relógio âmbar |
| F-P-08 frase principal + subtítulo categórico menor | **PASSA** | "Distribuição ao longo da semana", "Pausas prolongadas" |
| F-P-09 pílula colorida com o estado | **PASSA** | pílula "Retomando" |
| F-P-10 linha contínua, marcadores só nos pontos de virada (emenda de 24/08) | **PASSA** | "parou aqui"/"retomou aqui" anotados sobre linha contínua |
| F-P-11 mini gráfico ou seta de tendência | **PASSA** | seta de tendência no canto sup. dir. |
| F-P-12 rodapé com ícone à esquerda | **PASSA** | "Para você." com ícone |

**Placar Tela 2: 12 PASSA / 0 FALHA de 12.**

### 4.3 Tela 3 — Meu Mapa da Jornada (F-M-01..14)

| Critério | Veredito | Evidência |
|:---|:---:|:---|
| F-M-01 segmentos encostam nos nós | **PASSA** | trilha contínua |
| F-M-02 nó em andamento maior/realçado | **PASSA** | nó 5 laranja, maior |
| F-M-03 quatro níveis sob o nó | **PASSA** | "5" / "Ações Corretivas" / "Em andamento" / "60%" |
| F-M-04 nome sem prefixo "Módulo N" sob o nó | **PASSA** | "Ações Corretivas" |
| F-M-05 barra em largura total com % à direita | **PASSA** | barra cheia + "60%" |
| F-M-06 4 metadados em colunas rótulo/valor | **PASSA** | Iniciado em / Sessões / Última atividade / Tempo estimado |
| F-M-07 dois botões, sólido + contorno | **PASSA** | "Continuar módulo" + "Ver conteúdo" |
| F-M-08 ícone de bandeira no marco | **PASSA** | bandeira laranja |
| F-M-09 afirmação em peso forte, apoio em cinza | **PASSA** | "Concluir Ações Corretivas" + "Falta prova." |
| F-M-10 ícone circular em "Onde costumo perder ritmo" | **PASSA** | círculo azul |
| F-M-11 ilustração decorativa à direita | **PASSA** | ilustração presente |
| F-M-12 cabeçalho de colunas visível | **PASSA** | Módulo / Progresso / Última atividade / Status |
| F-M-13 barra de progresso + pílula de estado por linha | **PASSA** | "Em andamento" âmbar, "Concluído" verde |
| F-M-14 rodapé com ícone e título em negrito | **PASSA** | "Lembre-se" |

**Placar Tela 3: 14 PASSA / 0 FALHA de 14.**

### 4.4 Placar de fidelidade da Autogestão

| Bloco | Critérios | PASSA | FALHA |
|:---|---:|---:|---:|
| Tela 1 | 20 | 18 | 2 |
| Tela 2 | 12 | 12 | 0 |
| Tela 3 | 14 | 14 | 0 |
| **Total** | **46** | **44** | **2** |

**44/46 = 95,7%. A barra da régua é 42/46 (90%). PASSA.**

### 4.5 Aprendizagem do Time — INVERIFICÁVEL, por dois motivos independentes

| Critério | Veredito | Por quê |
|:---|:---:|:---|
| E-01..E-04 e seguintes, Tela 1 (Visão geral), **contra o motor** | **INVERIFICÁVEL** | a tela não renderiza contra o banco (§3.2). Só existe render em `?fonte=fixture`, e fixture não é o produto |
| Qualquer critério da Tela 2 (Padrões e evolução) | **INVERIFICÁVEL** | **não existe régua**. `CRITERIOS-aprendizagem.md` declara: *"Escopo desta rodada (Entrega 2): só a Tela 1 […] Telas 2 e 3 […] não foram construídas ainda"*. As telas passaram a existir; a régua não acompanhou |
| Qualquer critério da Tela 3 (Mapa de capacidades) | **INVERIFICÁVEL** | idem |
| Fidelidade pixel de qualquer tela de Aprendizagem | **INVERIFICÁVEL** | a própria régua admite: *"Não existe PNG de referência na resolução real do app (1672×941) para este domínio"* |

> Estas linhas são **INVERIFICÁVEL, não PASSA**. Aprovar por não conseguir medir é
> o modo de falha desta casa, e aqui havia três razões distintas para não medir.

---

## 5. A dobra

Medida por conta própria. **`scripts/auditoria-dobra-real.mjs` não serve para esta
rodada** e não foi usado: ele tem a porta `3000` cravada e a lista de rotas fixa em
`["visao-geral", "padroes-tendencias", "mapa-jornada"]` (linha 17) — o trio **antigo**
de Ativação da Jornada. **Nenhuma das 6 telas novas está no alcance dele.** A régua
de dobra não foi estendida junto com o trabalho.

Viewport 1440×900:

| Tela | altura total | % visível sem rolar | blocos acima da dobra |
|:---|---:|---:|---:|
| autogestao-visao-geral | 1246 | **72%** | 7 de 8 |
| autogestao-mapa | 1237 | **73%** | 8 de 8 |
| autogestao-padroes | 1520 | **59%** | 4 de 7 |
| aprendizagem-* (3 telas) | 900 | 100% | 1 de 1 — *porque não há conteúdo* |

**A primeira dobra comunica o que a tela faz?** Sim, nas 3 de Autogestão:

- **Visão Geral** entrega, sem rolar: título, "Como está minha jornada agora" (os 4
  tiles inteiros), "O que mudou comigo?", "Meu próximo movimento" com os 2 botões,
  "O que merece minha atenção?" e "Resposta ao meu plano". Só "Sinais do meu momento"
  fica abaixo. Excelente.
- **Meu Mapa** entrega os 8 blocos acima da dobra — a trilha de 8 módulos, "Onde estou
  agora", o marco e o histórico. Excelente.
- **Meus Padrões** é a mais fraca: 59%, 4 de 7 blocos. O gráfico de regularidade come
  a dobra quase inteira. Ainda assim o gráfico **é** a proposta da tela, então a dobra
  comunica corretamente. Aceitável.

Os 100% das telas de Aprendizagem são um **falso positivo de instrumento**: a página
cabe na dobra porque está vazia. Registrado aqui para que ninguém leia esse número
como qualidade.

---

## 6. Estado vazio ("o vazio como caminho principal", `fada8d5`)

Sondado com relógio congelado num período sem atividade (`?agora=2019-01-01T12:00:00Z`).

**Autogestão: PASSA.** A tela não quebra, não fica branca e não mostra erro. Degrada
para caminho: "0x por semana" com *"Falta prova. não existe meta de frequência semanal
definida no seu plano"* e o CTA **"Definir agora"**; "Meu próximo movimento" vira
"Você sustentou seu ritmo / Mantenha o padrão." com o botão "Ver meu plano". O vazio
tem motivo escrito e uma ação de saída. É o comportamento declarado no commit.

**Aprendizagem: FALHA.** O estado sem dado não chega a ser exercitado, porque a tela
morre antes, no erro de esquema. O que o usuário vê não é vazio-com-caminho, é
`column capabilities.title does not exist` (§3.4).

*Ressalva honesta sobre a minha própria sonda:* com relógio em 2019 e atividade em
2026, "ÚLTIMA ATIVIDADE: hoje" e "PROGRESSO: 50%" aparecem porque um delta negativo
é grampeado em zero. Isso é artefato do meu probe sintético (relógio anterior ao
dado), **não** um defeito de produção, e não entra na lista de defeitos.

---

## 7. Mobile (390×844) — a medição é do harness, não do produto

**As 6 rotas de preview têm largura PINADA**: 1440px nas de Autogestão, 1672px nas de
Aprendizagem (declarado nos próprios comentários de `page.tsx`). Em viewport de 390px
o resultado é inevitável e idêntico em todas:

```
autogestao-visao-geral  mobile: scrollWidth=1440  clientWidth=390  transbordaHorizontal=true
aprendizagem-*          mobile: scrollWidth=1672  clientWidth=390  transbordaHorizontal=true
```

A queda de controles alcançáveis no mobile (13→5, 10→4) **não é overlay**: `bloqueados = 0`
em todas as telas nos dois viewports. Os controles simplesmente estão fora do recorte
de 390px de uma página de 1440/1672px.

**Veredito: a responsividade mobile é INVERIFICÁVEL por estas rotas.** O que as
capturas mobile provam é que o harness é desktop-pinado por projeto — medir
responsividade aqui seria medir o chrome, não o produto. As 6 capturas mobile ficam
no diretório como registro, não como aprovação nem como reprovação. Avaliar mobile
exige a rota real ou um harness sem pino de largura.

---

## 8. Defeitos, por gravidade

### D1 — GRAVE — As 3 telas de Aprendizagem do Time não renderizam contra o banco
`fonte-supabase.ts:97` consulta 4 colunas que não existem em `capabilities`
(`title`, `slug`, `is_active`, `display_order`; reais: `name`, `code`, —, `order`).
Segundo sítio: `classificador/fontes-evidencia.ts:143` (`is_active`). A tabela tem 15
linhas. **Corrigir só `title` não resolve** — o erro vai andar para a coluna seguinte.
O commit `5c3c57b` declara reconciliação de esquema que o caminho de leitura não teve.
*Evidência:* `capturas/aprendizagem-*--desktop.png`, sondagem coluna a coluna na §3.2.

### D1-bis — GRAVE — A frente inteira roda contra um esquema nunca aplicado
Verificado em §12.1/§12.2: além das 4 colunas de `capabilities`, faltam **9 colunas**
em `capability_evidence` (que tem 12 reais) e **5 tabelas inteiras** (`concepts`,
`capability_concepts`, `capability_assessments`, `capability_assessment_evidence`,
`capability_assessment_criteria`, todas `PGRST205`). São 3 paredes em série: **corrigir
o D1 apenas move o erro para a segunda.**

### D1-ter — GRAVE — A falha é invisível aos 3 canais de monitoramento
HTTP `200`, console do navegador vazio, log do servidor sem uma linha de erro (§12.3).
O erro é capturado e devolvido como dado (`estado: "erro"`), nunca lançado — não sobe
para o Sentry configurado no app. Health check e uptime monitor dão **verde** com as 3
telas quebradas.

### D2 — MÉDIO (rebaixado de GRAVE) — Erro cru de banco exposto ao usuário final
**Rebaixado após medição em §12.3:** o card é **honesto** — declara a falha e não exibe
número nenhum. A busca por 10 formulações de "vazio mentiroso" voltou **vazia** nas 3
telas, e não há error boundary do Next. O gestor **não** decide sobre dado falso. Resta
o defeito de **forma**, não de veracidade:
A tela imprime `column capabilities.title does not exist`, sem tradução, sem ação de
recuperação e sem caminho alternativo. Vaza nome de tabela e coluna. Contrasta com o
padrão correto já em uso na Autogestão ("Falta prova." + motivo em português).

### D3 — MÉDIO — A régua de Aprendizagem cobre 1 tela de 3
`CRITERIOS-aprendizagem.md` declara escopo "só a Tela 1" e afirma que as Telas 2 e 3
"não foram construídas ainda". Elas existem e estão em rota. Duas telas entregues sem
nenhum critério que as reprove.

### D4 — MÉDIO — A régua de dobra não alcança nenhuma tela nova
`scripts/auditoria-dobra-real.mjs` tem porta 3000 e as 3 rotas antigas cravadas.
Roda, dá resultado, e o resultado não fala das 6 telas desta entrega.

### D5 — MÉDIO — `GABARITO.json` versionado aponta para dados mortos
O commitado referencia UUIDs de uma semeadura anterior. Checkout limpo mede contra
linhas inexistentes. (Sem afrouxamento de rigor — ver §1.)

### D6 — BAIXO — F-V-20: falta a linha "Atualizado há Xh"
Presente na referência, ausente no build. Busca textual: `false`.

### D7 — BAIXO — F-V-11: link de fecho com rótulo divergente
A régua pede "Ver todos os pontos de atenção →"; o build traz "Ver meu mapa da jornada ›".
A afordância existe, o destino é outro.

### D8 — BAIXO — Vazio declarado de forma inconsistente na Tela 3
Convivem dois idiomas para "não tenho esse dado": "Falta prova." + motivo (correto) e
travessão nu — "Tempo estimado —", e "Última atividade —" em 2 linhas do histórico.
O travessão não diz por quê. 4 ocorrências medidas.

### D9 — BAIXO (ambiente, não produto) — `pnpm --filter @eximia/web dev` não sobe
`node_modules` cruzado com `wt-baseline` derruba o Turbopack (§0). Afeta qualquer
pessoa que siga o comando documentado.

---

## 9. O que esta auditoria NÃO provou

- **Fidelidade das telas de Aprendizagem** — impossível: não renderizam contra o motor,
  faltam réguas para 2 das 3, e não existe PNG de referência na resolução real.
- **Responsividade mobile** — as rotas de preview pinam a largura (§7).
- **Comportamento sob dado de produção real** — tudo foi medido contra o tenant
  `gauntlet-descartavel`. Leitura apenas; nenhuma escrita foi feita em lugar nenhum.
- **Que os cliques produzem o efeito certo** — foi provado que os controles são
  *alcançáveis* (nada os cobre), não que suas ações levam ao destino correto. Muitos
  são inertes por projeto no harness.

## 10. Caveat sobre o instrumento desta auditoria

O harness (`/tmp/loop3/medir.mjs`) parametriza o diretório de saída, mas **rodei duas
levas para o mesmo `OUT` e a segunda sobrescreveu o `relatorio.json` da primeira** —
exatamente a armadilha contra a qual eu tinha sido avisado. Detectado e corrigido:
os relatórios finais foram regerados em caminhos separados,
`relatorio-motor.json` (as 6 telas, modo motor, porta 3312) e `relatorio-fixture.json`
(as 3 de Aprendizagem em modo fixture). Os números deste laudo vêm do `relatorio-motor.json`.

Além disso, uma sonda de DOM que escrevi para os critérios estruturais produziu
**falsos negativos** em F-V-12, F-V-18, F-V-19, F-V-09 e F-V-05 (seletores de seção
mal ancorados). Foram resolvidos por inspeção visual e por recorte ampliado
(`zoom-atencao.png`), e **não** entraram como falha. Só F-V-11 e F-V-20 foram
reprovados, ambos por busca textual em `document.body.innerText`, que é robusta a
erro de seletor.

---

## 11. Adendo — o tenant descartável é reusado? (3 perguntas)

### 11.1 O tenant é descartável de fato, ou o ID está fixo?

**Nem uma coisa nem outra: o ID não está fixo em lugar nenhum, e o tenant é
deliberadamente PERMANENTE.** Ninguém escreveu `b483c98b-...` no código — o ID é
sempre resolvido por `slug` em tempo de execução:

```js
// trava-de-tenant.mjs:30
export const SLUG_DESCARTAVEL = "gauntlet-descartavel"
// trava-de-tenant.mjs:54-59  — resolve por slug, nunca por ID literal
.from("tenants").select("id,slug,name").eq("slug", SLUG_DESCARTAVEL).maybeSingle()
```

`grep -rn "b483c98b" apps/web/scripts/gauntlet/` → **nenhuma ocorrência**. O único
lugar onde esse UUID aparece é o `GABARITO.json`, que é arquivo gerado.

O que `criar-tenant-descartavel.mjs` implementa é **idempotência, não descarte**:

```js
// criar-tenant-descartavel.mjs:80-83
if (existente) {
  console.log(`[tenant] já existe: ${existente.id} — "${existente.name}". Idempotente, nada feito.`)
  process.exit(0)
}
```

O tenant só some se alguém rodar `--remover` explicitamente. Confirmado no banco:
criado em **2026-08-21T18:31:50Z**, vivo há 7 dias e reusado desde então.

**"Descartável" aqui significa "não é de cliente", não "efêmero".** É uma escolha de
projeto defensável e está documentada: `trava-de-tenant.mjs` explica que o banco do
`.env.local` é produção compartilhada com dois clientes pagantes, que houve vazamento
cross-tenant real em 18/08/2026, e que criar linha em produção precisa ser ato
deliberado — por isso o semeador **não** cria tenant, e o criador é arquivo separado.
O nome é que engana: um tenant permanente chamado "descartável" convida exatamente a
suspeita que originou este adendo.

### 11.2 Quanto resíduo acumulou? Zero.

Contagem de leitura, hoje, escopada em `tenant_id = b483c98b-...`:

```
--- TABELAS QUE O SEMEADOR LIMPA (TABELAS_TENANT) ---
  sessions                21 linhas
  chapter_view_progress    8 linhas
  slide_reflections        0 linhas
  study_plans              1 linhas
  enrollments              2 linhas
  chapters                 8 linhas
  courses                  1 linhas
  users                    2 linhas
```

Isto é **exatamente um cenário**, não N cenários empilhados: 1 curso, 8 capítulos
(= os 8 `capituloIds` do gabarito), 2 alunos, 2 matrículas, e 1 `study_plan` (aluno A
tem plano, B não — `temPlano: true/false`). Se os runs acumulassem desde 21/08,
haveria vários cursos e dezenas de matrículas. **Não há resíduo.**

A causa é mecânica, não sorte — `semear.mjs` **limpa antes de semear**:

```js
// semear.mjs:224-225
// Estado zerado primeiro: idempotente mesmo após um run anterior interrompido.
await limparTudo({ db, url, serviceKey })
```

e `limpar()` (`trava-de-tenant.mjs:117-145`) faz `DELETE ... .eq("tenant_id", id)` nas
8 tabelas, depois de **reconfirmar pelo banco** que o id pertence mesmo ao slug
descartável (linhas 122-134). É isso que explica o diff do gabarito: IDs novos a cada
run porque as linhas antigas foram apagadas e reinseridas.

**Ressalva:** a limpeza cobre **só** as 8 tabelas de `TABELAS_TENANT` (`semear.mjs:65-74`).
Qualquer tabela do tenant fora dessa lista nunca é limpa. Hoje isso é inofensivo
porque o semeador também não escreve fora dela — mas a lista é manual, e uma tabela
nova escrita pelo semeador sem ser adicionada ali vira resíduo silencioso.

### 11.3 Dois runs em sequência: o segundo mede dado do primeiro?

**NÃO — em sequência.** Evidência: `semear.mjs:225` chama `limparTudo` antes de
qualquer insert, e a contagem medida em 11.2 é de exatamente um cenário após 7 dias
de uso. Um run que herdasse o anterior deixaria rastro contável, e não há.

**SIM — em paralelo, e isso é risco vivo.** A "trava" é guarda de **escopo de tenant**,
não de concorrência: `trava-de-tenant.mjs` inteiro é sobre *onde* se pode escrever
(`guardar()` inspeciona linha a linha, `SLUGS_PROIBIDOS` é a lista negra), e **não há
lockfile, advisory lock, mutex ou marca de run em lugar nenhum**. Dois runs
simultâneos compartilham o mesmo tenant único: o `limparTudo` do run B apaga o cenário
recém-semeado do run A no meio da medição de A. O nome "trava" sugere proteção que ela
não oferece nesta dimensão.

**Defeito adicional achado no caminho:** o tenant descartável tem **0 linhas em
`capabilities`**, enquanto as 15 linhas da tabela pertencem a tenants de produção
(`cory-alimentos: 5`, `eximia-academy: 5`, `vertice-industria: 5`). `capabilities` não
está em `TABELAS_TENANT` e o semeador não a popula. Ou seja: **mesmo depois de
corrigir as 4 colunas do D1, as telas de Aprendizagem continuariam vazias contra o
tenant descartável**, por falta de caminho de semeadura. Corrigir D1 é necessário e
não é suficiente.

### 11.4 Achado não solicitado: o gabarito tem dois geradores, e um deles é tautológico

`GABARITO.json` é **arquivo gerado**, nunca editado à mão — o que fecha em definitivo
o veredito NEUTRO da §1. Mas ele tem **dois escritores no mesmo caminho**:

| Escritor | Origem dos valores esperados | Natureza |
|:---|:---|:---|
| `semear.mjs:687` | as **linhas que acabaram de ser escritas** no banco | oráculo **independente** — legítimo |
| `provar-elo4-nucleo.ts:562` (`--gerar-gabarito`) | `montarVisaoGeralAutogestao/Padroes/Mapa(...)` → `extrairElementosProducao()` | **o próprio código de produção sob teste** — tautologia |

O leitor é um só: `provar-elo4-nucleo.ts:592`. Ou seja, existe um caminho em que o
verificador **regera a própria régua a partir da saída do artefato que ele deveria
julgar** — rodar `--gerar-gabarito` depois de uma falha faz a falha desaparecer. Isso
viola o poka-yoke de "o gerador não toca o verificador".

O comentário em `semear.mjs:509` afirma que o gabarito usa "as MESMAS fórmulas que
`provar-elo4.mjs` reusa"; na prática `provar-elo4.mjs` não importa
`calculos-elo4.mjs` (só `spawnSync`), então a afirmação está desatualizada.

**Qual dos dois produziu o arquivo de hoje?** O de `semear.mjs`, o legítimo. Dá para
discriminar pelo formato, e eu discriminei: o arquivo atual tem `elementos` e
`enrollmentId`, e **não** tem `elementosProducao` nem `divergenciasCalculosVsProducao`
— chaves que só a versão do prover emite. **Mas nada dentro do arquivo declara sua
própria procedência**, e os dois escrevem no mesmo path. Quem abrir o `GABARITO.json`
daqui a um mês não terá como saber se está lendo um oráculo independente ou um
autorretrato, a não ser conferindo nomes de chave.

**Recomendação:** gravar a procedência dentro do próprio arquivo (`"origem":
"semear" | "producao"`), e fazer o prover **recusar** um gabarito de origem
`producao` como base de veredito.

---

## 12. Adendo 2 — o que o gestor vê de fato nas 3 telas de Aprendizagem

> Medido em `localhost:3313`, `NEXT_PUBLIC_TENANT_SLUG=gauntlet-descartavel`,
> **caminho real (`fonte=motor`, o default destas rotas)**. Ver §12.4 sobre fixture.

### 12.1 Verificação independente do schema (não aceitei o relato de terceiro)

Reconferi no banco antes de incorporar. **O relato procede, em cheio:**

```
--- select real, limit 1 ---
  capabilities                      OK, 1 linha(s)
  capability_evidence               OK, 1 linha(s)
  concepts                          ERRO [PGRST205] Could not find the table 'public.concepts'
  capability_concepts               ERRO [PGRST205] Could not find the table 'public.capability_concepts'
  capability_assessments            ERRO [PGRST205] Could not find the table 'public.capability_assessments'
  capability_assessment_evidence    ERRO [PGRST205] Could not find the table 'public.capability_assessment_evidence'
  capability_assessment_criteria    ERRO [PGRST205] Could not find the table 'public.capability_assessment_criteria'

--- colunas que o código assume em capability_evidence ---
  comprehension AUSENTE [42703]   depth_level AUSENTE [42703]   application_level AUSENTE [42703]
  confidence    AUSENTE [42703]   source_table AUSENTE [42703]  evidence_category AUSENTE [42703]
  concept_id    AUSENTE [42703]   occurred_at  AUSENTE [42703]  classified_at     AUSENTE [42703]

  colunas REAIS (12): id, tenant_id, student_id, capability_id, criterion_id,
                      course_id, chapter_id, category, source_type, source_id,
                      observed_at, created_at
```

**Correção de um erro meu:** na §11.3 eu havia sondado com
`select('*', {count:'exact', head:true})` e reportei `capability_assessments`,
`learning_signals` e `engagement_actions` como "existe". **Estava errado** — aquele
formato devolve `count: null` **sem erro** para tabela inexistente. `select('*').limit(1)`
devolve `PGRST205` corretamente. Sonda com `head:true` é um instrumento que aprova por
vacuidade; não repetir.

### 12.2 São TRÊS paredes de esquema, não uma. A primeira esconde as outras duas.

O erro que chega à tela é `capabilities.title`, e ele acontece **antes** de o código
chegar perto de `capability_evidence` ou das 5 tabelas ausentes:

| Ordem | Parede | Onde | Estado |
|:---:|:---|:---|:---|
| 1ª | `capabilities`: 4 colunas ausentes (`title`, `slug`, `is_active`, `display_order`) | `fonte-supabase.ts:97` | **é a que aparece hoje** |
| 2ª | `capability_evidence`: 9 colunas ausentes, tabela tem 12 reais | camada de evidência | atrás da 1ª |
| 3ª | 5 tabelas inexistentes (`concepts`, `capability_concepts`, `capability_assessments`, `capability_assessment_evidence`, `capability_assessment_criteria`) | classificador | atrás da 2ª |

**Consequência prática:** corrigir os 4 nomes de coluna da 1ª parede **não conserta a
tela** — apenas move o erro para a 2ª. O D1 deste laudo era, portanto, um sintoma; a
doença é que a frente inteira roda contra um esquema que nunca foi aplicado.

### 12.3 Resposta às 3 perguntas

**(1) O que o usuário vê, literalmente.** Um **card de erro**, não tela branca e não
boundary do Next. `<main>` tem 29 nós. Saída literal de `main.innerText`, as 3 telas:

```
"…Visão geral\nPadrões e evolução\nMapa de capacidades\n\n
 Não foi possível carregar a Aprendizagem do Time\n\ncolumn capabilities.title does not exist"

"…Não foi possível carregar Padrões e Evolução\n\ncolumn capabilities.title does not exist"

"…Não foi possível carregar o Mapa de Capacidades\n\ncolumn capabilities.title does not exist"
```

**Console do navegador — VAZIO.** Única mensagem nas 3 telas:
`[info] Download the React DevTools…`. Zero `error`, zero `pageerror`, zero
`requestfailed`.

**Log do servidor — nenhuma linha de erro:**
```
✓ Compiled /gauntlet-preview/aprendizagem-visao-geral in 1829ms (3884 modules)
 GET /gauntlet-preview/aprendizagem-visao-geral 200 in 3372ms
 GET /gauntlet-preview/aprendizagem-padroes-evolucao 200 in 1759ms
 GET /gauntlet-preview/aprendizagem-mapa-capacidades 200 in 827ms
```

> **Este é o achado mais sério do adendo.** A falha é invisível nos **três** canais de
> monitoramento: HTTP devolve `200`, o console fica limpo, e o log do servidor só
> registra sucesso. O erro é capturado e **devolvido como dado** (`estado: "erro"`),
> nunca lançado — então não sobe para o Sentry, que está configurado neste app. O único
> lugar do mundo onde essa falha existe é o texto renderizado na página. Um alerta de
> disponibilidade, um health check ou um uptime monitor dariam **verde** com as 3 telas
> quebradas.

**(2) Erro honesto ou vazio mentiroso? — ERRO HONESTO. O pior caso NÃO ocorre.**

Busca por 10 formulações de vazio enganoso (`"sem dados"`, `"nenhum dado"`,
`"ainda não há"`, `"amostra insuficiente"`, `"insuficiente"`, `"aguardando dados"`,
`"0%"`, entre outras) no corpo das 3 telas:

```
strings de 'vazio mentiroso' achadas: []      (nas 3 telas)
error boundary do Next? false | diz que falhou? true | nodes no <main>: 29
```

A tela **declara que falhou** e não apresenta número nenhum. **O gestor não decide em
cima de dado falso**, porque não há dado na tela — há um aviso de falha. Isso é o
comportamento certo, e vale registrar como acerto: a preocupação de que a tela dissesse
"sem dados ainda" (fazendo o gestor concluir que a equipe não estudou) **não se
materializou em nenhuma das três**.

O que resta de defeito é **só a forma**: a segunda linha do card imprime
`column capabilities.title does not exist` — mensagem de motor de banco, em inglês,
vazando nome de tabela e coluna, sem ação de recuperação. Honesto, porém cru. É o D2,
agora corretamente dimensionado: **falha de forma, não de veracidade.**

**(3) Autogestão medida em separado — SADIA.** Frente e schema distintos, veredito
independente e já dado nas §2 e §4: sem overlay, rolagem real, 33 controles alcançáveis
e 0 bloqueados, `skeletons = 0`, e **44/46 (95,7%)** na régua de fidelidade contra barra
de 90%. As duas frentes **não** compartilham veredito e não foram misturadas em momento
algum deste laudo.

### 12.4 Fixture x caminho real — o que exatamente foi medido

Medi o **caminho real**. `fonte=motor` é o **default** destas rotas (declarado no
cabeçalho de `page.tsx`), e é ele que produz todos os números das §3, §12.1 e §12.3.
O `leitura-real.ts` chama `carregarVisaoGeralAprendizagem` de
`@/lib/analytics/aprendizagem-time` — o motor de produção, com `createServiceClient()`
contra o banco real.

As capturas em modo **fixture** existem no diretório (6 arquivos com `--fonte-fixture--`
no nome) e estão **rotuladas como contraste, nunca como aprovação**. Elas provam
exatamente uma coisa: que a UI está construída e é rica (placar 78/64/51/64, cinco
blocos) — e é precisamente por isso que uma auditoria em fixture teria dado verde numa
frente que não sobe contra o banco. A pergunta (1) **tem resposta**, e a resposta veio
do caminho de produção.

---

## Anexos

- `capturas/` — 18 PNGs: 6 telas × 2 viewports (modo motor) + 3 telas de Aprendizagem
  × 2 viewports (modo fixture).
- `relatorio-motor.json` — medição bruta das 6 telas, 2 viewports.
- `relatorio-fixture.json` — medição bruta das 3 telas de Aprendizagem em fixture.
- Referências comparadas: `docs/gauntlet/autogestao-jornada/referencia/0{1,2,3}-*.png`.
