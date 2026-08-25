# Régua de FIDELIDADE VISUAL — Autogestão da minha Jornada

> **Por que esta régua existe.** A `CRITERIOS.md` mede **composição, hierarquia e presença
> de bloco**, e as 3 telas fecharam nela em 100%, 100% e 97,1%. O dono olhou e disse que
> ainda não estão parecidas com a referência. Os dois estão certos: aquela régua pergunta
> *"o bloco existe e está no lugar?"*; esta pergunta *"o bloco tem a MESMA FORMA?"*.
>
> Um loop que rodasse de novo contra a régua antiga daria 100% outra vez sem mover um
> pixel. Convergir contra a régua não é convergir contra a referência.
>
> **Barra: 90%.** Referências (1440×1080): `referencia/0{1,2,3}-*.png`.

## Como o crítico julga

Duas imagens, A e B, sem saber qual é a referência. Para cada critério, `SIM` ou `NÃO`
sobre o artefato. **Aqui, ao contrário da régua de composição, a FORMA é o objeto.**

**Continua NÃO sendo critério:** os valores literais. Os cenários são diferentes de
propósito — nomes de módulo, datas e números divergem e isso está certo. Um número na
posição certa, com a tipografia certa, passa mesmo exibindo outro valor.

**PASSA a ser critério:** presença e posição de ícone, número de colunas dentro de um
card, existência de linha de apoio, peso e cor de cada nível de texto, quantidade de
botões, presença de affordance de navegação (chevron, link "ver todos"), e o formato do
controle (dropdown contra grupo de pílulas).

---

## TELA 1 — VISÃO GERAL (F-V-01 a F-V-20)

| ID | Critério | Reprova quando |
|:---|:---|:---|
| F-V-01 | Cada um dos 4 tiles tem **ícone circular colorido à esquerda**, com o texto à direita (2 colunas) | texto empilhado sem ícone |
| F-V-02 | O ícone de cada tile tem cor própria, coerente com o tema do tile | todos iguais ou monocromáticos |
| F-V-03 | Cada tile tem **linha de apoio** abaixo do valor ("Você está no ritmo do plano", "Meta do plano: 2x por semana") | valor solto, sem apoio |
| F-V-04 | O rótulo do tile é caixa alta pequena; o valor é grande; o apoio é menor e cinza — **três níveis distintos** | menos de três níveis |
| F-V-05 | Cada título de bloco tem **ícone ⓘ** ao lado | ausente |
| F-V-06 | "O que mudou comigo" usa **caixas** (uma por sinal), não linhas de lista | lista corrida |
| F-V-07 | Cada caixa de mudança tem **seta grande colorida à esquerda** (↑ verde / ↓ vermelha) | seta pequena inline |
| F-V-08 | Dentro da caixa: valor em destaque + rótulo, e abaixo a comparação em cinza ("vs. 30 dias anteriores") | uma linha só |
| F-V-09 | Itens de "O que merece minha atenção" têm **ícone quadrado colorido** à esquerda | ícone circular ou ausente |
| F-V-10 | Cada item de atenção tem **chevron › à direita**, indicando navegação | sem affordance de clique |
| F-V-11 | O bloco de atenção termina com o link **"Ver todos os pontos de atenção →"** | ausente |
| F-V-12 | "Meu próximo movimento" tem **DOIS botões**: um sólido e um de contorno | um só |
| F-V-13 | O título da recomendação vem entre aspas e em peso forte, com o texto de apoio em duas linhas abaixo | tudo no mesmo peso |
| F-V-14 | "Resposta aos meus últimos ajustes" tem **mini gráfico de linha** no canto superior direito | sem gráfico |
| F-V-15 | As métricas desse bloco ficam em **4 colunas separadas por divisória vertical** | sem divisória |
| F-V-16 | Cada sinal de "Sinais do meu momento" tem **ícone grande colorido**, título próprio em verde, e descrição em 2–3 linhas | ícone pequeno com uma linha só |
| F-V-17 | O rodapé "Dica Exímia" tem **ícone à esquerda**, título em negrito e texto na linha seguinte | uma linha só |
| F-V-18 | O seletor de período é um **dropdown único** ("Últimos 30 dias") com ícone de calendário | grupo de 3 pílulas |
| F-V-19 | Há **avatar do usuário** no canto superior direito | ausente |
| F-V-20 | Há a linha **"Atualizado há Xh"** com ícone de recarregar, sob o seletor | ausente |

## TELA 2 — MEUS PADRÕES E TENDÊNCIAS (F-P-01 a F-P-12)

| ID | Critério | Reprova quando |
|:---|:---|:---|
| F-P-01 | O gráfico tem **linha de referência tracejada horizontal** atravessando a área | ausente |
| F-P-02 | A legenda distingue **duas séries** (realizado e meta) com amostras de cor distintas | uma só |
| F-P-03 | A área de plotagem ocupa **altura generosa** — o gráfico domina o card, não é uma faixa fina | série achatada na base |
| F-P-04 | Os rótulos do eixo X aparecem em **todas** as semanas, sem omissão alternada | rótulos pulados |
| F-P-05 | Cada tile de continuidade tem número grande, rótulo acima e unidade abaixo — **três níveis** | menos de três |
| F-P-06 | Os 4 tiles de continuidade têm **fundo âmbar suave**, não branco | branco |
| F-P-07 | Cada insight de "O que favorece meu ritmo" tem **ícone circular colorido** à esquerda | sem ícone |
| F-P-08 | Cada insight tem frase principal em peso normal e **subtítulo categórico** menor abaixo | uma linha |
| F-P-09 | "Tendência atual" tem **pílula colorida** com o estado, ao lado do título | texto puro |
| F-P-10 | A linha temporal do fim é uma **linha contínua** com marcadores **apenas nos pontos de virada** (parou / retomou), anotados | uma caixa ou rótulo por semana |
| F-P-11 | Há **mini gráfico ou seta de tendência** ao lado do bloco de tendência | ausente |
| F-P-12 | O rodapé tem **ícone/mascote à esquerda** com título e frase | texto solto |

## TELA 3 — MEU MAPA DA JORNADA (F-M-01 a F-M-14)

| ID | Critério | Reprova quando |
|:---|:---|:---|
| F-M-01 | **Os segmentos encostam nos nós** — a trilha lê como linha contínua, não como ilhas soltas | vão visível entre segmento e círculo |
| F-M-02 | O nó em andamento é **maior** que os demais, ou tem anel/realce que o destaca | mesmo tamanho |
| F-M-03 | Sob cada nó: numeral, nome, estado e percentual — **quatro níveis tipográficos distintos** | menos de quatro |
| F-M-04 | O nome do módulo aparece **sem prefixo "Módulo N"** sob o nó (o numeral já está acima) | prefixo duplicado |
| F-M-05 | "Onde estou agora" tem a barra de progresso **em largura total**, com percentual à direita | barra curta |
| F-M-06 | Os 4 metadados ficam em **colunas com rótulo acima e valor abaixo** | empilhados ou em linha corrida |
| F-M-07 | Dois botões: um **sólido** e um de **contorno**, lado a lado | ambos iguais |
| F-M-08 | "Meu próximo marco" tem **ícone de bandeira** ao lado do título | sem ícone |
| F-M-09 | O marco tem a data/afirmação em **peso forte** e o texto de apoio abaixo em cinza | mesmo peso |
| F-M-10 | "Onde costumo perder ritmo" tem **ícone circular** à esquerda do texto | sem ícone |
| F-M-11 | Esse bloco tem **ilustração decorativa à direita** | ausente |
| F-M-12 | A tabela de histórico tem **cabeçalho de colunas** visível e alinhado | sem cabeçalho |
| F-M-13 | Cada linha tem **barra de progresso** e **etiqueta de estado** em pílula colorida | só texto |
| F-M-14 | O rodapé tem **ícone/mascote à esquerda** com título em negrito e frase | texto solto |

---

## Placar

| Bloco | Critérios |
|:---|---:|
| Tela 1 | 20 |
| Tela 2 | 12 |
| Tela 3 | 14 |
| **Total** | **46** |

**Barra: 42 de 46 (90%).**

## Emenda de 2026-08-24 — F-P-10 invertido, por decisão do dono

`F-P-10` exigia "caixas lado a lado" na linha temporal, copiando a referência. O dono
olhou o resultado e disse: *"desse jeito ficou muito ruim e difícil de entender"* — as 12
caixas exibiam **nove "0 dias ativos"** repetidos, gastando a largura inteira para
comunicar quase nada. Pediu linha contínua com marcos anotados. O critério foi invertido
para descrever o novo alvo.

**Quem pode mexer nesta régua, e quem não pode.** Um construtor **nunca** afrouxa ou
reescreve um critério para o próprio trabalho passar — é a pior forma de trapaça, porque
o placar sobe e nada melhora. Mas quando o **dono muda o alvo**, a régua tem de acompanhar:
uma régua congelada contra a decisão de quem manda deixa de medir fidelidade e passa a
defender um mockup contra o produto.

A diferença está na origem da mudança, não no seu efeito no placar. Aqui a mudança veio do
dono, sobre o artefato que ele mesmo pediu, e o agente que a detectou **sinalizou em vez de
editar a régua por conta própria** — que era exatamente o comportamento correto.

## O que NÃO deve ser copiado da referência

A referência é um mockup, e três coisas nela **não** são alvo:

1. **O mascote/robô** do canto inferior direito da Tela 1 — é arte de apresentação, não
   componente do produto. Ignorar, sem penalizar.
2. **Os valores literais** — outro cenário, de propósito.
3. **Qualquer elemento que exija dado inexistente.** Se a referência mostra um número que
   o banco não tem (ex.: "Meta do plano: 2x por semana"), o critério de FORMA continua
   valendo — a linha de apoio deve existir, exibindo "Falta prova" com o motivo. A forma é
   alvo; o valor inventado nunca é.
