# FIX-D — defeitos de superfície das 6 telas novas

> **Papel:** corretor. Área: camada de apresentação.
> **Data:** 2026-08-29 · **Repo:** `/Users/hugocapitelli/Dev/eximia/eximia-academy-v2`
> **Branch:** `integra/main-cory` · **Laudo de origem:** `LOOP-3-visual.md` §8
> **Método:** para cada defeito, o teste que reprova o comportamento atual foi
> escrito e rodado ANTES da correção. A saída vermelha está colada abaixo,
> item a item. Nenhum arquivo de `docs/gauntlet/**` foi tocado.

---

## Placar

| Defeito | Estado | Teste que trava a regressão |
|:---|:---:|:---|
| D2 — erro cru de banco exposto ao usuário | **corrigido** | `components/analytics/aprendizagem-time/__tests__/falha-de-leitura-nao-vaza-sql.test.tsx` (9) |
| D6 — F-V-20, falta "Atualizado há Xh" | **corrigido** | `app/(platform)/jornada/_autogestao/__tests__/moldura-atualizado-em.test.tsx` (5) |
| D7 — F-V-11, rótulo do link de fecho | **corrigido, com tensão reportada** | `components/analytics/autogestao/__tests__/fecho-do-bloco-de-atencao.test.tsx` (3) |
| D8 — travessão mudo na Tela 3 | **corrigido, com limite declarado** | `app/(platform)/jornada/_autogestao/_mapa/__tests__/vazio-nao-usa-travessao-mudo.test.tsx` (6) |
| `/perfil` sem entrada de navegação | **corrigido** | `components/layout/__tests__/menu-de-conta-alcanca-perfil.test.tsx` (4) |

**27 testes novos.** Suítes de verificação, depois das correções:

```
pnpm --filter @eximia/web test src/components/analytics   →  24 arquivos, 423 passed | 3 skipped
pnpm --filter @eximia/web test src/components/layout      →   4 arquivos,  15 passed
pnpm --filter @eximia/web test "src/app/(platform)/jornada" → 18 arquivos, 181 passed
pnpm --filter @eximia/web test src/app                    →  97 arquivos, 1011 passed
```

`npx tsc --noEmit` não acusa nenhum erro em arquivo desta correção.
`npx biome check` nos arquivos tocados: limpo (os 5 restantes em
`components/layout/` são de `tenant-selector.tsx`, `platform-footer.tsx` e
`navigation-progress.tsx`, arquivos que esta correção não tocou).

---

## D2 — erro cru de banco exposto ao usuário final

### O que estava errado

As 3 telas de Aprendizagem do Time desenhavam, cada uma, o próprio card de
erro, e as 3 imprimiam `data.erro.mensagem` — a mensagem literal do Postgres:

```
Não foi possível carregar a Aprendizagem do Time
column capabilities.title does not exist
```

Três defeitos numa linha: vaza nome de tabela e de coluna; fala inglês de
banco a quem quer decidir sobre gente; e é beco sem saída, sem "tentar de
novo" e sem caminho alternativo.

**O sintoma não aparece hoje** — o schema foi reconciliado em 28/08 e as 3
telas voltaram a renderizar. O que se corrigiu é o **tratamento**: o caminho
de erro continua vivo no código, e a próxima falha de leitura voltaria a
vazar SQL. Sintoma que sumiu não é caminho que sumiu.

### O vermelho, antes da correção

```
 ❯ src/components/analytics/aprendizagem-time/__tests__/falha-de-leitura-nao-vaza-sql.test.tsx
 Test Files  1 failed (1)
      Tests  9 failed (9)

 ❯ .../falha-de-leitura-nao-vaza-sql.test.tsx:99:21
      99|  expect(screen.getByRole("button", { name: /tentar de novo/i }))…
        |                ^
TestingLibraryElementError: Unable to find an accessible element with the role "button"

Ignored nodes: comments, script, style
<body>
  <div>
    <div class="pr-[16px] pl-[31px] 2xl:pr-[56px] py-[24px]">
      <section class="bg-white max-w-[640px] p-[20px]" …>
        <p class="text-[14px] font-semibold" …>
          Não foi possível carregar o Mapa de Capacidades
        </p>
        <p class="mt-[6px] text-[13px]" …>
          column capabilities.title does not exist          ← o vazamento, na árvore
        </p>
      </section>
    </div>
  </div>
</body>
```

### O que mudou

Um componente para as 3 telas, `components/analytics/aprendizagem-time/falha-de-leitura.tsx`
(`CardFalhaDeLeitura`), no idioma que a **Autogestão** já usava — não um
terceiro idioma de erro. Sendo um só componente, a próxima tela do domínio não
tem como recriar o vazamento.

O card diz, em ordem:

1. o escopo que falhou (por tela: "…a Aprendizagem do Time" / "…Padrões e
   Evolução" / "…o Mapa de Capacidades");
2. **"Nenhum número é exibido enquanto a leitura não for confiável."** — o
   literal que a Autogestão já usa, palavra por palavra;
3. **"A falha é na leitura dos dados, não uma medida sobre a sua equipe."** —
   o esclarecimento que a mensagem crua não dava e que muda a decisão: sem
   ele, um gestor conclui que a equipe não estudou, e age em cima disso;
4. duas saídas reais: **"Tentar de novo"** (`router.refresh()`, que re-executa
   o componente de servidor, não só o cliente) e **"Ver Ativação da Jornada"**
   (`hrefDoDominio("ativacao")` → `/analytics`, o domínio irmão, que não
   depende deste schema).

A mensagem do motor **não some do mundo**: vai para `data-erro-codigo` no DOM,
legível por quem inspeciona ou coleta, invisível para quem lê a tela.

**Nota, fora do meu escopo mas relevante:** o D1-ter do laudo (a falha é
invisível aos 3 canais de monitoramento, porque o erro é devolvido como dado e
nunca lançado) **não é resolvido por esta correção** — ela é de apresentação.
Continua com quem cuida do pipeline.

---

## D6 — F-V-20: a linha "Atualizado há Xh"

### O que estava errado

`CRITERIOS-FIDELIDADE.md`, F-V-20: *"Há a linha **'Atualizado há Xh'** com
ícone de recarregar, sob o seletor"*. A auditoria buscou `/Atualizado h[áa]/i`
no `innerText` e obteve `false`.

### O vermelho, antes da correção

```
 × F-V-20 … > a linha existe, e diz 'Atualizado há'
   → Unable to find an element with the text: /Atualizado h[áa]/i
 × F-V-20 … > a linha traz o ícone de recarregar ao lado
   → Unable to find an element by: [data-testid="atualizado-em"]
 × F-V-20 … > fica SOB o seletor de período, não em outro canto da moldura
   → Unable to find an element by: [data-testid="atualizado-em"]
 × F-V-20 … > com carimbo real, reporta a defasagem MEDIDA — nunca um número fixo
   → Unable to find an element by: [data-testid="atualizado-em"]
 × F-V-20 … > sem defasagem a reportar (leitura desta requisição), diz 'há instantes'
   → Unable to find an element by: [data-testid="atualizado-em"]
 Test Files  1 failed (1)
      Tests  5 failed (5)
```

### O que mudou

A linha nasceu em `app/(platform)/jornada/_autogestao/moldura.tsx`, logo
abaixo do seletor, com o ícone `RotateCw`. Ela vive na **moldura**, e não na
Tela 1, pelo mesmo motivo do próprio seletor (F-V-18): as 3 abas compartilham
este cabeçalho, e um carimbo de frescor que só existisse numa delas diria que
as outras duas não têm frescor nenhum.

**Sobre o "Xh" da régua, e por que ele não vira literal.** A régua declara no
próprio cabeçalho que *"os valores literais continuam NÃO sendo critério"* — o
que ela mede é a presença da linha e do ícone. E o "3h" da referência do dono
não existe neste produto: estas páginas são renderizadas por requisição (auth
por cookie ⇒ sem cache estático) e a leitura do banco acontece dentro da
própria requisição. Cravar "há 3h" seria inventar uma defasagem que não
aconteceu — exatamente o que `FaltaProva` existe para impedir no resto desta
tela.

Então a linha faz as duas coisas: sem carimbo (o caminho de hoje) diz
**"Atualizado há instantes"**; com o par opcional `atualizadoEm`/`agora`,
reporta a defasagem **medida** (`min` abaixo de uma hora, `h` acima). No dia
em que houver cache a reportar, o número aparece sem esta linha mudar. O teste
`com carimbo real, reporta a defasagem MEDIDA` é o par de variância que
impede uma string cravada de passar.

---

## D7 — F-V-11: rótulo do link de fecho · **TENSÃO REPORTADA, decisão do dono**

### O que estava errado

F-V-11 pede que o bloco de atenção termine com **"Ver todos os pontos de
atenção →"**. O build trazia **"Ver meu mapa da jornada ›"**.

### O vermelho, antes da correção

```
 × F-V-11 … > com itens: o link de fecho usa o rótulo da régua
   → Unable to find an accessible element with the role "link"
     and name `/Ver todos os pontos de atenção/i`
 × F-V-11 … > o rótulo antigo não sobrevive ao lado do novo
   → expect(element).not.toBeInTheDocument()
 ✓ F-V-11 … > SEM itens: nenhum fecho é oferecido
 Test Files  1 failed (1)
      Tests  2 failed | 1 passed (3)
```

### O que mudou, e o que precisa da sua decisão

O rótulo passou a ser o da régua. **O destino não mudou**: continua
`/jornada?vista=autogestao&aba=mapa`, onde os módulos abertos que originam
estes pontos aparecem por extenso. A seta "→" que a régua cita é a affordance
que `CtaRodape` já desenha (chevron), não um glifo digitado no texto.

**A divergência anterior era deliberada, e o argumento dela é bom.** Estava
escrito no próprio arquivo: `montagem.ts` §11 produz **no máximo três itens**
(reflexões, regularidade, sessão em aberto) e a lista renderiza **todos**, sem
corte. Um "ver todos" não revela nada além do que já está na tela — e prometer
revelação sem revelar é porta pintada na parede, a mesma família de defeito
que um número inventado.

**O que decidiu não foi o mérito, foi a autoridade.** A régua fica fora do
alcance de quem é medido por ela; afrouxar um critério porque a tela discorda
dele é o movimento que a régua existe para impedir. Por isso a tela se ajustou
e o critério não foi tocado.

> **Fica para o dono da régua, com os dois lados na mesa:**
> ou F-V-11 é relaxado (o rótulo passa a ser o do destino, e a régua registra
> por quê), ou a tela ganha de fato uma lista completa de pontos de atenção que
> justifique o "ver todos". Hoje ela promete revelação e entrega navegação.
> **Nenhuma das duas saídas é minha para tomar** — e a atual, que é a da régua,
> está em pé e testada.

---

## D8 — o travessão mudo da Tela 3

### O que estava errado

Dois idiomas para "não tenho esse dado" convivendo na mesma tela: `"Falta
prova." + motivo` (o idioma da casa, `CONTRATO-DE-DADOS.md`: *"nunca um número
inventado, nunca '0', nunca travessão mudo"*) e um `—` nu, que não diz por
quê. O leitor não tem como saber se o travessão significa "não temos", "é
zero" ou "não se aplica" — e as três levam a decisões diferentes.

A auditoria mediu 4 ocorrências. **A varredura do teste achou 5.**

### O vermelho, antes da correção

```
 × D8 … > 'Tempo estimado' sem estimativa: diz 'Falta prova.' com o motivo, não '—'
   → Unable to find an element with the text: /Falta prova\./
 × D8 … > 'Iniciado em' sem data: diz 'Falta prova.' com o motivo, não '—'
   → Unable to find an element with the text: /data de início/i
 × D8 … > 'Última atividade' sem registro: diz 'Falta prova.' com o motivo, não '—'
   → Unable to find an element with the text: /visualização registrada/i
 × D8 … > no histórico, as linhas concluídas dizem POR QUE não há última atividade
   → Unable to find an element with the text: /módulo concluído/i
 × D8 … > VARREDURA — nenhum travessão nu sobra em toda a Tela 3
   → expected [ <span …(2)></span>, …(4) ] to have a length of +0 but got 5
 ✓ D8 … > PAR DE CONTROLE — quando o dado existe, ele aparece como valor, sem 'Falta prova.'
 Test Files  1 failed (1)
      Tests  5 failed | 1 passed (6)
```

### O que mudou

`EstatModulo` deixou de aceitar uma string pronta e passa a receber o valor
**mais o motivo da ausência**. Ele trata `null`, `""` e `"—"` como ausência e
desenha `FaltaProva` com o motivo — nunca o travessão. O motivo mora no ponto
de chamada porque é lá que ele ainda é conhecido: a string `"—"` que chega do
montador já perdeu essa informação.

| Campo | O que a tela diz agora |
|:---|:---|
| Iniciado em | *não há data de início registrada para este módulo* |
| Sessões concluídas | *não há sessões registradas para este módulo* |
| Última atividade | *nenhuma visualização registrada neste módulo* |
| Tempo estimado | *ainda não há duração média por slide para estimar* |
| Histórico, linha concluída | *módulo concluído — não há atividade em curso a reportar* |
| Histórico, demais linhas | *nenhuma visualização registrada neste módulo* |

O teste de **varredura** (nenhum elemento cujo texto seja exatamente `—`) é o
que impede a correção pontual de deixar um caso para trás: a asserção é sobre
a tela, não sobre o campo que alguém lembrou de corrigir.

### Limite honesto desta correção

Na linha de histórico de um módulo **concluído**, o `—` nasce em `montagem.ts`
(`status === "concluido" ? "—" : rotuloUltimaAtividade(diasUltima)`), que
descarta uma data que o banco **tem** (`last_viewed_at`). Pior: a mesma string
`"—"` também representa "sem visualização registrada", então duas causas
distintas chegam à apresentação colapsadas numa só — aqui elas só se separam
porque o **estado da linha** ainda está disponível.

A camada de apresentação consegue dizer **por que** não há número. Devolver o
número (ou parar de colapsar as duas causas numa string) é trabalho da camada
de dados, que não é minha nesta rodada. **Fica registrado para não virar
dívida invisível.**

### Um teste existente foi reescopado (declarado, não escondido)

`mapa-jornada-tab.test.tsx > "plano com duração real → renderiza a DATA"`
afirmava, sobre o **documento inteiro**, que nenhum "Falta prova." aparecia. A
asserção só passava porque nenhum outro bloco desta tela falava — e passou a
reprovar a correção do travessão, sem ter nada a ver com o marco, que é o que
o teste mede. Foi escopado à seção "Meu próximo marco" com `within(marco)`,
**exatamente como o teste irmão logo abaixo já fazia**. O que o teste afirma
sobre o marco não mudou; o que ele afirmava por acidente sobre o resto da
tela, sim.

---

## `/perfil` — a terceira porta trancada por dentro

### O que estava errado

`grep -rn "perfil" apps/web/src/components/layout/` voltava **vazio**: sidebar,
rodapé e menu de conta. A rota `app/(platform)/perfil/page.tsx` (cadastro da
pessoa: nome, e-mail, avatar, onboarding) só era alcançável por URL digitada
ou pelo botão de voltar de um wizard. Terceira ocorrência do mesmo defeito na
mesma safra, depois de `/jornada` (`790298e`) e de Aprendizagem do Time
(`c6ed19c`).

**A colisão de nome que escondia o buraco.** O menu de conta já tinha um item
chamado **"Perfil"** — mas ele aponta para `/profile/learning`, que é o
**perfil de aprendizagem** (Big Five, DISC), outra tela. Um rótulo genérico
ocupando o nome da tela que falta é pior que nenhum item: quem procura o
próprio cadastro clica ali, não encontra, e conclui que a tela não existe.
Isto não estava no laudo — apareceu ao procurar onde a entrada deveria morar.

### O vermelho, antes da correção

```
 × menu de conta … > existe um link para `/perfil`
   → expected [ '/profile/learning', …(1) ] to include '/perfil'
 × menu de conta … > o link de `/perfil` se anuncia como o cadastro da pessoa
   → Unable to find an accessible element with the role "link" and name `/meu perfil/i`
 × menu de conta … > o perfil de APRENDIZAGEM continua alcançável, e com nome próprio
   → Unable to find an accessible element with the role "link" and name `/perfil de aprendizagem/i`
 × menu de conta … > nenhum item genérico chamado só 'Perfil' sobra, disputando os dois destinos
   → expected [ Array(1) ] to have a length of +0 but got 1
 Test Files  1 failed (1)
      Tests  4 failed (4)
```

### O que mudou

No menu de conta (`components/layout/header.tsx`), onde os itens de conta já
moram (Configurações, Sair), os **dois** destinos passam a se chamar pelo que
são, em vez de o novo disputar o nome do antigo:

| Rótulo | Destino |
|:---|:---|
| **Meu perfil** (ícone `User`) | `/perfil` |
| **Perfil de aprendizagem** (ícone `GraduationCap`) | `/profile/learning` |

O quarto teste é o que impede a troca de uma porta trancada por outra: se
alguém renomear ou derrubar o item de aprendizagem para abrir espaço ao novo,
a suíte reprova.

**Por que o menu de conta e não a barra lateral.** A barra monta a navegação a
partir do registry de módulos (`@eximia/shared` via `lib/navigation.ts`) — o
perfil da pessoa não é um módulo do produto, é conta. E é no menu de conta que
o vizinho natural dele (Configurações) já vive.

```
$ grep -rn "perfil" apps/web/src/components/layout/ | head -3
apps/web/src/components/layout/header.tsx:143: A PORTA PARA `/perfil` (28/08). A rota do cadastro da pessoa …
apps/web/src/components/layout/header.tsx:159: <Link href={"/perfil"}>
apps/web/src/components/layout/header.tsx:163:   Meu perfil
```

---

## Arquivos tocados

**Produção (7):**

```
apps/web/src/components/analytics/aprendizagem-time/falha-de-leitura.tsx   (novo)
apps/web/src/components/analytics/aprendizagem-time/visao-geral-tab.tsx
apps/web/src/components/analytics/aprendizagem-time/padroes-tab.tsx
apps/web/src/components/analytics/aprendizagem-time/mapa-tab.tsx
apps/web/src/components/analytics/autogestao/visao-geral-tab.tsx
apps/web/src/components/layout/header.tsx
apps/web/src/app/(platform)/jornada/_autogestao/moldura.tsx
apps/web/src/app/(platform)/jornada/_autogestao/_mapa/mapa-jornada-tab.tsx
```

**Testes (5 novos + 1 reescopado):**

```
apps/web/src/components/analytics/aprendizagem-time/__tests__/falha-de-leitura-nao-vaza-sql.test.tsx
apps/web/src/components/analytics/autogestao/__tests__/fecho-do-bloco-de-atencao.test.tsx
apps/web/src/components/layout/__tests__/menu-de-conta-alcanca-perfil.test.tsx
apps/web/src/app/(platform)/jornada/_autogestao/__tests__/moldura-atualizado-em.test.tsx
apps/web/src/app/(platform)/jornada/_autogestao/_mapa/__tests__/vazio-nao-usa-travessao-mudo.test.tsx
apps/web/src/app/(platform)/jornada/_autogestao/_mapa/__tests__/mapa-jornada-tab.test.tsx  (1 asserção reescopada)
```

**`docs/gauntlet/**`: nenhum arquivo tocado.** `git diff --name-only
docs/gauntlet/` acusa `autogestao-jornada/GABARITO.json`, que **já estava
modificado antes desta correção começar** — é o mesmo arquivo analisado na §1
e na §11.4 do `LOOP-3-visual.md`, e não foi editado aqui.

---

## O que esta correção NÃO fez

- **Não mediu contra a aplicação viva.** As provas são de árvore renderizada
  em jsdom. Uma reconferência visual das 6 telas contra o motor continua
  sendo trabalho de quem audita, não de quem corrige.
- **Não tocou a camada de dados.** O colapso de duas causas num único `"—"`
  (D8) e a invisibilidade da falha aos canais de monitoramento (D1-ter)
  continuam de pé.
- **Não decidiu o mérito de F-V-11.** A tensão está posta acima, com os dois
  argumentos, para o dono da régua.
- **Não estendeu a régua de fidelidade a nada** — D3, D4 e D5 do laudo (régua
  de Aprendizagem cobrindo 1 tela de 3, régua de dobra apontando para rotas
  antigas, gabarito versionado com UUIDs mortos) permanecem abertos.
