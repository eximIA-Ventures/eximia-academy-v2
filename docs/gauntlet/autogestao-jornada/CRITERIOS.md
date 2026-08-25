# Régua visual — Autogestão da minha Jornada

> A barra do crítico cego. Cada linha é verificável **olhando o PNG**, sem ler código e
> sem saber qual imagem é a referência.
>
> **Barra: 90% (≥ 68 de 76).** Abaixo disso o loop continua.
>
> Referências (1440×1080, medidas): `referencia/01-visao-geral.png`,
> `02-padroes-tendencias.png`, `03-mapa-jornada.png`.

## Como o crítico julga

Ele recebe **duas imagens, A e B**, sem saber qual é a referência do dono e qual é o
artefato construído. Para cada critério, responde `SIM` ou `NÃO` sobre o artefato, e ao
final aponta **a maior lacuna** citando o ID do critério.

**O que NÃO é critério:** a origem dos dados; os valores literais (o cenário semeado é
diferente do mockup de propósito — o mockup mostra "Análise de Causa" como módulo ativo,
o cenário mostra "Ações Corretivas", e **os dois estão certos**); e a quantidade exata de
itens em listas que a spec limita a "máximo 3".

**O que É critério:** composição, hierarquia visual, presença de bloco, agrupamento,
alinhamento, respiro, consistência tipográfica e cromática, e as regras duras da
especificação (§2, §18, §20, §22).

---

## GLOBAL — vale para as 3 telas (G-01 a G-12)

| ID | Critério | Reprova quando |
|:---|:---|:---|
| G-01 | O título "Autogestão da minha Jornada" aparece no topo, em peso e tamanho de título de página | ausente, ou com o mesmo peso de um título de card |
| G-02 | O subtítulo de uma linha aparece logo abaixo, em cinza secundário | ausente, ou com a mesma cor do título |
| G-03 | As 3 abas aparecem em linha, na ordem: Visão Geral · Meus Padrões e Tendências · Meu Mapa da Jornada | ordem trocada, aba faltando, ou empilhadas |
| G-04 | A aba ativa é distinguível das outras por cor **e** por marcador (sublinhado) | só cor, ou nenhum dos dois |
| G-05 | O seletor de período aparece à direita, alinhado ao topo | ausente, ou à esquerda |
| G-06 | Nenhum conteúdo é cortado na borda direita do quadro | qualquer texto ou card truncado |
| G-07 | Nenhuma barra de rolagem horizontal | presença de scroll lateral |
| G-08 | Os cards têm cantos arredondados e fundo branco sobre fundo levemente acinzentado | fundo do card igual ao da página |
| G-09 | O espaçamento vertical entre blocos é constante | um bloco visivelmente mais colado que os vizinhos |
| G-10 | A paleta é a mesma nas 3 telas: laranja de ação, verde de positivo, azul de neutro/informativo | o mesmo estado com cores diferentes entre telas |
| G-11 | Nenhum texto de julgamento (§2): ranking, nota, aprovado/reprovado, "bom aluno", comparação com turma | qualquer ocorrência visível |
| G-12 | Nenhuma afirmação causal (§18): "isso causa", "porque você", "você aprende melhor" | qualquer ocorrência visível |

---

## TELA 1 — VISÃO GERAL (V-01 a V-22)

| ID | Critério | Reprova quando |
|:---|:---|:---|
| V-01 | Bloco "Como está minha jornada agora" com **4 tiles em linha** | 3 ou menos, ou empilhados em coluna |
| V-02 | Os 4 tiles são, na ordem: RITMO · REGULARIDADE · PROGRESSO · ÚLTIMA ATIVIDADE | ordem diferente |
| V-03 | O rótulo de cada tile é uma etiqueta pequena em caixa alta, acima do valor | rótulo do mesmo tamanho do valor |
| V-04 | O valor de cada tile é o elemento de maior peso visual dentro dele | valor menor ou igual ao rótulo |
| V-05 | Cada tile tem cor de fundo própria e suave, distinta dos vizinhos | todos iguais, ou saturados |
| V-06 | O tile RITMO exibe um estado por extenso ("No ritmo", "Retomando"), não um número | número puro |
| V-07 | Mensagem-síntese logo abaixo dos 4 tiles, em faixa de largura total com ícone à esquerda | ausente, ou dentro de um dos tiles |
| V-08 | Bloco "O que mudou comigo" com no máximo 3 sinais, cada um com seta de direção | mais de 3, ou sem indicador de direção |
| V-09 | Seta para cima em positivo e para baixo em negativo, com cores distintas | mesma cor ou mesma seta para os dois |
| V-10 | Bloco "Meu próximo movimento" visualmente destacado dos demais (fundo próprio) | igual aos outros cards |
| V-11 | "Meu próximo movimento" apresenta **uma única** recomendação | duas ou mais |
| V-12 | A recomendação tem título em destaque, uma linha de apoio, e botão de ação | falta qualquer um dos três |
| V-13 | O botão principal é sólido, em laranja de ação | contorno, ou outra cor |
| V-14 | Bloco "O que merece minha atenção" com ícone por item | sem ícone |
| V-15 | Cada item de atenção tem título, descrição e link de ação | falta o link |
| V-16 | Bloco "Resposta ao meu plano" com métricas em colunas | métricas empilhadas |
| V-17 | A ressalva de causalidade aparece em itálico e cinza, ao pé do bloco | ausente, ou em destaque |
| V-18 | Bloco "Sinais do meu momento" com cards de fundo verde suave e ícone | fundo branco ou sem ícone |
| V-19 | Rodapé "Dica Exímia" em faixa de fundo âmbar, distinta dos demais blocos | ausente, ou igual aos outros |
| V-20 | Onde falta lastro, aparece "Falta prova" com ícone de alerta e motivo legível | número, zero, ou traço mudo |
| V-21 | "Falta prova" é visualmente secundário ao dado real, não um alarme vermelho | tratado como erro |
| V-22 | A hierarquia geral vai do mais acionável (topo) ao mais contextual (rodapé) | invertida |

---

## TELA 2 — MEUS PADRÕES E TENDÊNCIAS (P-01 a P-18)

| ID | Critério | Reprova quando |
|:---|:---|:---|
| P-01 | Gráfico de **linha** ocupando a largura total no topo | barras, área, ou meia largura |
| P-02 | A série tem pontos marcados em cada semana | linha sem marcadores |
| P-03 | Legenda no canto superior direito do gráfico, com amostra de cor | ausente, ou sem amostra |
| P-04 | Eixo X rotulado por semana, legível, sem sobreposição | rótulos colididos |
| P-05 | Eixo Y com escala numérica e linhas de grade horizontais suaves | sem grade, ou grade dominante |
| P-06 | A linha da série é verde e contínua | outra cor, ou tracejada |
| P-07 | A meta, quando ausente de lastro, é **declarada por extenso** e nenhuma linha é desenhada | linha em zero, ou silêncio total |
| P-08 | Bloco "Meu padrão de continuidade" com **4 tiles em linha** | número diferente, ou empilhados |
| P-09 | Cada tile de continuidade tem rótulo acima, número grande no centro, unidade abaixo | ordem diferente dos três elementos |
| P-10 | Os números dos 4 tiles têm o mesmo tamanho entre si | tamanhos díspares |
| P-11 | Os tiles de continuidade usam fundo âmbar suave | branco, ou cores diferentes entre si |
| P-12 | Bloco "O que favorece meu ritmo" em lista vertical, um insight por linha | grade, ou parágrafo corrido |
| P-13 | Cada insight tem ícone circular à esquerda, com cor por natureza | sem ícone |
| P-14 | Cada insight tem uma frase principal e uma linha de apoio menor | uma linha só |
| P-15 | Bloco "Tendência atual" com pílula de estado colorida | texto puro |
| P-16 | A linha temporal do fim mostra períodos lado a lado, com o atual destacado | todos iguais |
| P-17 | Rodapé de mensagem em faixa de fundo azul suave, distinta | ausente |
| P-18 | O gráfico é o elemento dominante da tela | outro bloco maior que ele |

---

## TELA 3 — MEU MAPA DA JORNADA (M-01 a M-24)

| ID | Critério | Reprova quando |
|:---|:---|:---|
| M-01 | Trilha **horizontal** de módulos no topo, em largura total | vertical, ou matriz |
| M-02 | Cada módulo é um nó circular com ícone dentro | quadrado, ou sem ícone |
| M-03 | Os nós são ligados por segmentos de linha | soltos |
| M-04 | Módulo concluído: nó **verde** com ícone de confirmação | outra cor |
| M-05 | Módulo em andamento: nó **laranja**, visualmente destacado dos demais | igual aos vizinhos |
| M-06 | Módulo não iniciado: nó **cinza** com ícone de cadeado | qualquer outra cor |
| M-07 | **Nenhum nó usa vermelho** (§22 — não iniciado é futuro, não falha) | qualquer vermelho na trilha |
| M-08 | O segmento entre concluídos é sólido; até o não iniciado é tracejado | todos iguais |
| M-09 | Cada nó tem numeral acima, nome abaixo, estado e percentual embaixo | falta qualquer um |
| M-10 | A numeração começa em **1** | começa em 0 |
| M-11 | O numeral do nó é coerente com o prefixo "Módulo N" usado nos cards | numerais divergentes |
| M-12 | O estado sob cada nó usa a cor do próprio estado | tudo cinza |
| M-13 | Bloco "Onde estou agora" com barra de progresso horizontal | sem barra |
| M-14 | A barra tem preenchimento laranja e trilho cinza, com percentual ao lado | sem percentual |
| M-15 | Quatro metadados em colunas: início, sessões, última atividade, estimativa | empilhados |
| M-16 | Dois botões: um sólido (Continuar) e um de contorno (Ver conteúdo) | ambos sólidos, ou ambos de contorno |
| M-17 | Bloco "Meu próximo marco" ao lado do "Onde estou agora", não abaixo | empilhado |
| M-18 | "Meu próximo marco" tem ícone de bandeira e um botão de contorno | sem ícone |
| M-19 | Marco sem lastro de duração declara "Falta prova", nunca uma data inventada | data calculada sobre plano zerado |
| M-20 | Bloco "Onde costumo perder ritmo" com ícone circular à esquerda | sem ícone |
| M-21 | Sem histórico suficiente, o bloco declara ausência em vez de sumir | bloco desaparecido |
| M-22 | Tabela "Histórico dos últimos 3 módulos" com cabeçalho de colunas | sem cabeçalho |
| M-23 | Cada linha do histórico tem barra de progresso e etiqueta de estado | só texto |
| M-24 | Exatamente **3** linhas no histórico, sem numeral de posição ou mérito (§26) | número diferente, ou ranking |

---

## Placar

| Bloco | Critérios |
|:---|---:|
| Global | 12 |
| Tela 1 | 22 |
| Tela 2 | 18 |
| Tela 3 | 24 |
| **Total** | **76** |

**Barra: 68 de 76 (90%).**

## Armadilhas (o crítico só as falsifica se o caso existir na tela)

Estes critérios **exigem** que o caso esteja presente no artefato — se o cenário não o
contiver, o `SIM` é indistinguível de sorte e o critério deve ser marcado `N/A`, nunca
`SIM`. O cenário semeado planta os quatro de propósito:

| Critério | Caso que precisa existir |
|:---|:---|
| V-20, V-21, P-07 | ao menos um campo sem lastro na tela |
| M-07 | ao menos um módulo "não iniciado" |
| M-19 | um módulo com duração zerada no plano |
| M-05 | exatamente um módulo em andamento |
