# Guia de POPs — como executar as issues deste board

> Este guia existe para que qualquer pessoa (você, ou um colaborador com IA) entenda
> **por que** cada issue pede um método específico antes de começar a codar — não é
> burocracia, é a diferença entre consertar uma tela que já existe e desenhar uma do
> zero, que são trabalhos com formato diferente.

## O problema que isto resolve

Antes de escrever uma linha de código, existe uma pergunta que decide tudo o que vem
depois: **a coisa que a issue pede já existe, ou não?** E se existe, **ela faz o que
deveria?** Errar essa pergunta faz você gastar horas desenhando do zero algo que já
está pronto (ou, pior, "consertar" algo que nunca existiu). As 43 issues deste board
já vêm classificadas — cada uma diz explicitamente qual POP seguir e por quê, numa
seção "POP aplicável" no corpo da issue.

## Os 4 POPs, em uma frase cada

| Pergunta | Resposta | POP | Ideia central |
|:---|:---|:---|:---|
| A coisa existe? | **Não** | `POP-BUILD-001` | Construir do zero: entender o problema antes de desenhar a solução |
| A coisa existe e faz o que deveria? | **Não** | `POP-FIX-001` | Achar a causa raiz de um desvio, provar com teste antes/depois |
| A coisa existe e faz o que deveria, **mas mal**? | Sim | `POP-IMPR-001` | Medir o custo real, melhorar sem mudar o comportamento |
| A coisa existe, presume-se que funciona, **ninguém verificou recentemente**? | Sim | `POP-QA-001` | Auditar um conjunto de coisas e decidir o destino de cada achado |

Se você olhar para uma issue e não tiver certeza de qual POP se aplica, a régua é
sempre a mesma tabela acima, respondida nesta ordem. A classificação já feita em cada
issue seguiu exatamente essas 4 perguntas.

## POP-BUILD-001 — Construir algo que não existe

**Quando:** a issue pede uma tela, rota, agregação de dados ou fluxo que **não tem
nenhum código correspondente no repositório hoje**.

**A armadilha que este método evita:** cair direto para "vou fazer uma tela com X, Y,
Z campos" sem antes confirmar quem sofre com a ausência disso e por quê. Meia hora
entendendo o problema evita retrabalho de dias construindo a solução errada.

**Passos essenciais (versão prática, não o processo formal completo):**
1. **Entenda o problema antes da solução.** Quem exatamente precisa disso e o que
   ele não consegue fazer hoje sem essa tela/dado? Escreva isso em 2-3 frases antes
   de abrir o editor.
2. **Verifique o que já existe perto dali.** Muita coisa neste board (ver #42, por
   exemplo) mostrou que "não existe" às vezes significa "existe só que ninguém
   ligou os pontos". Procure antes de construir.
3. **Desenhe o mínimo que resolve o problema**, não o máximo que você consegue
   imaginar. A issue já lista o critério de saída — ele é o alvo, não um piso.
4. **Implemente com teste cobrindo o critério de saída.**
5. **Rode os comandos de verificação** listados na issue antes de considerar pronto.

## POP-FIX-001 — Consertar algo que existe mas não faz o que devia

**Quando:** a issue pede para expor, corrigir ou religar algo que **já está
construído e funcionando**, só que não está acessível, ou está com comportamento
errado. Exemplo neste board: as telas de API Keys, Webhooks e Integrações
(`#34`, `#35`, `#36`) já existem prontas no código — o problema é que o hub de
Configurações mostra "Em breve" para elas. Isso é um desvio (a interface promete uma
coisa, o código já entrega outra), não uma construção nova.

**A armadilha que este método evita:** redesenhar do zero algo que só precisa de um
ajuste pontual — o que custa muito mais tempo do que precisa.

**Passos essenciais:**
1. **Escreva o teste vermelho primeiro.** Prove que o desvio existe antes de tocar
   no código de correção (ex.: um teste que confirma que a rota do hub mostra "Em
   breve" quando deveria mostrar a tela real).
2. **Ache a causa raiz**, não o sintoma. Na maioria dos casos deste board, a causa é
   literalmente "o componente `HubItemSoon` nunca foi trocado por `HubItem`" — é
   simples, mas prove isso lendo o código, não assumindo.
3. **Corrija a causa**, rode o teste, confirme que virou verde.
4. **Rode os comandos de verificação** da issue.

## POP-IMPR-001 — Melhorar algo que funciona, mas custa caro

**Quando:** nada quebrado, nada novo — só uma coisa que funciona mas é lenta,
confusa, cara de manter ou difícil de entender. **Nenhuma issue deste lote de 4
frentes é deste tipo hoje**, mas pode aparecer depois (ex.: se uma dashboard ficar
lenta com volume real de dados).

**A ideia central:** medir o "antes" com um número real, melhorar, medir o "depois"
com o mesmo número, e o comportamento observável pro usuário final **não pode
mudar** — só o custo de rodar/manter.

## POP-QA-001 — Auditar algo que existe e presumivelmente funciona

**Quando:** a issue pede para **confirmar** que algo continua funcionando, não para
construir ou consertar nada — porque ninguém checou recentemente. Exemplos neste
board: `#39` (Auditoria) e `#40` (Plano & Cobrança) já estão vivas em produção, mas
o README do épico dizia o contrário — a issue existe para confirmar isso e corrigir
o registro. `#21` e `#42` são do mesmo tipo: confirmar se o que os documentos dizem
bate com o código antes de qualquer trabalho de construção em cima.

**A ideia central:** **não presuma, verifique por comando.** Rode o comando exato
que a issue pede, registre o resultado, e se algo estiver errado, **essa descoberta
vira uma issue nova** (provavelmente `POP-FIX-001`) — a auditoria em si não conserta
nada, ela só decide o destino do que encontrou.

## Onde encontrar isso em cada issue

Toda issue classificada tem uma seção **"POP aplicável"** perto do topo do corpo,
com: o POP, o gatilho literal que a fez cair nessa categoria, e o primeiro passo
prático. Se você usa Claude Code ou Cursor com os skills do ecossistema eximIA
disponíveis, os comandos `/pop-build`, `/pop-fix`, `/pop-improve` e `/pop-qa`
conduzem o processo formal completo passo a passo. Se não tiver esses skills
disponíveis nesta sessão, os passos essenciais resumidos acima neste guia bastam
para seguir o mesmo raciocínio manualmente.

## Fonte completa (se precisar do detalhe formal)

Este guia é a versão prática, resumida para execução. O procedimento formal
completo (gates, papéis, critérios de saída detalhados) vive no repositório
`JARVIS`, em `docs/sop/POP-BUILD-001-construcao.md`,
`docs/sop/POP-FIX-001-solucao-de-problemas.md`,
`docs/sop/POP-IMPROVE-001-melhoria.md` e `docs/sop/POP-QA-001-auditoria.md`. Se você
não tem acesso a esse repositório, este guia já cobre o essencial para executar
qualquer issue deste board corretamente.
