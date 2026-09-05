# Motor Socrático

O Motor Socrático é o tutor de IA da eximIA Academy. Quando o aluno termina um capítulo, ele não recebe um resumo nem um quiz de múltipla escolha: recebe uma pergunta, responde com as próprias palavras, e a IA devolve um comentário específico sobre o que ele disse mais uma nova pergunta que aprofunda o raciocínio.

A IA nunca entrega a resposta. Essa é a feature, e é também a restrição. Uma plataforma que explica bem o conteúdo já existe às centenas; o que a Academy vende é o aluno saindo da sessão tendo pensado, não tendo lido.

Este documento é o **contrato de produto**: o que o tutor pode e não pode fazer. Para o "como funciona por dentro" (cadeia de agentes, roteamento de modelo, retries), ver [`packages/agents/README.md`](../../packages/agents/README.md).

---

## A regra central

> **"SE o aluno pedir resposta direta, ENTÃO reformule como pergunta que guia ao caminho."**

Essa é a primeira das dez invariantes escritas no prompt do tutor (`packages/agents/src/prompts/socrates.ts`), e é a mais difícil de honrar, porque o caso duro não é o aluno passivo, é o aluno que pede explicitamente para a IA responder. O produto diz não, com elegância, e devolve outra pergunta.

As outras invariantes que sustentam a mesma regra:

- se a resposta do aluno estiver **errada**, o tutor faz perguntas que expõem a inconsistência, nunca corrige diretamente;
- se estiver **certa**, o tutor não valida e encerra, aprofunda em nuances, exceções ou aplicações;
- se for **superficial**, o tutor pede exemplos, contra-argumentos ou mecanismos.

Não existe caminho em que o aluno recebe a conclusão pronta. Errado, certo ou raso, o movimento seguinte é sempre uma pergunta.

### A Roda do Aprendizado

Há uma segunda regra, menos óbvia e igualmente inegociável: **nos três primeiros turnos de uma sessão, o tutor não pode oferecer conceito nenhum.** Nem explicação teórica, nem a validação "isso está correto". Só a partir do quarto turno ele começa a introduzir nuance conceitual, e ainda assim como complemento à reflexão do aluno.

A justificativa está escrita no próprio prompt: *"o conhecimento emerge da reflexão sobre a experiência, não da transmissão de informação. Se o aluno não refletiu profundamente, ele não está pronto para receber conceitos."* A sessão tem um orçamento finito de interações, e o desenho é deliberado: a primeira metade é percepção, observação e significação; a segunda é conceituação e experimentação.

O efeito prático para quem opera o produto: uma sessão em que a IA "resolveu rápido" nos dois primeiros turnos não é uma sessão eficiente, é uma sessão quebrada.

---

## O que operacionaliza a regra

A regra não é uma diretriz de tom que se espera que o modelo respeite. Ela é **verificada por um segundo agente antes de qualquer texto chegar ao aluno**, contra seis critérios explícitos (`packages/agents/src/prompts/tester.ts`):

| | Critério | Severidade | O que reprova |
|---|---|---|---|
| **C1** | Sem resposta direta | CRITICAL | Explicar o conceito por completo, listar os fatores, definir o termo que o aluno deveria elaborar, ou usar linguagem de veredito ("a resposta é", "o correto é", "na verdade") |
| **C2** | Pergunta aberta ao final | CRITICAL | Não terminar em pergunta, ou terminar em pergunta de sim/não ("Concorda?", "Faz sentido?"), ou pergunta retórica |
| **C3** | Feedback construtivo presente | MAJOR | Não citar nada específico que o aluno disse, ou elogiar no vazio ("Boa resposta!"), ou já começar perguntando |
| **C4** | Sem rótulos artificiais | MAJOR | Marcadores tipo `[Feedback]`, `**Pergunta:**`, numeração, headers, separadores |
| **C5** | Texto fluido e natural | MINOR | Soar robótico a ponto de atrapalhar |
| **C6** | Conexão com o tema | MINOR | Fugir do capítulo |

C1 e C2 são CRITICAL, e a consequência é dura: **um único CRITICAL reprovado zera o score e rejeita a resposta inteira**, por melhor que ela esteja nos outros cinco critérios. Nenhuma quantidade de bom feedback compra o direito de entregar a conclusão.

C1 e C2 juntos formam a definição operacional de "socrático" neste produto: não fechar o raciocínio (C1) e devolver a bola (C2). C3 é o que separa um tutor de um gerador de perguntas genéricas: a resposta precisa mostrar que alguém leu o que o aluno escreveu.

O validador tem uma regra de desempate declarada: **na dúvida sobre C1, ser mais rigoroso.** É melhor rejeitar uma resposta boa do que deixar passar uma que entrega. Ao mesmo tempo, ele é explicitamente proibido de ser pedante com imperfeição cosmética, porque um validador que reprova tudo trava o produto tanto quanto um que aprova tudo.

---

## Como Editor e Tester se encaixam

Toda resposta do tutor passa por uma cadeia fixa de três papéis antes de existir para o aluno: o **Socrates** escreve, o **Editor** pole (tira rótulos, força os dois parágrafos, sem poder alterar o significado) e o **Tester** julga contra os seis critérios acima, aprovando ou rejeitando. Se o Tester rejeita, a crítica dele volta como entrada para o Socrates, que reescreve sabendo o que reprovou, e o ciclo se repete até um teto de tentativas. A divisão de papéis é intencional: quem escreve não é quem aprova, e quem aprova não pode editar (o Tester emite veredito, nunca conserta a frase). Os detalhes de implementação, incluindo o número de tentativas e o que acontece quando elas se esgotam, estão em [`packages/agents/README.md`](../../packages/agents/README.md#orchestrator--o-pipeline-socrático).

---

## Quem vê o quê

**O aluno é o único que vê o diálogo.** O Motor Socrático é a superfície de aprendizagem, e ela existe dentro do capítulo, no fim do conteúdo. O aluno vê apenas o texto final aprovado: nunca as tentativas descartadas, nunca a nota que o validador deu, nunca o fato de que houve retrabalho. Do lado dele, é uma conversa.

**Instrutores e gestores veem o julgamento, não o diálogo como material de nota.** O veredito e o score de cada resposta do tutor são persistidos e aparecem nas telas de analytics de sessão e de aluno. É importante ler isso pelo que é: **essa nota avalia a qualidade da IA, não o desempenho do aluno.** O tutor não atribui notas nem pontuações ao estudante, isso está entre as coisas que ele explicitamente não faz.

Em paralelo, e invisível para os dois lados, roda uma análise da mensagem do aluno (padrões cognitivos, indícios de texto gerado por IA, perfil de aprendizagem). Ela nunca bloqueia, nunca penaliza e nunca interfere na resposta que o aluno recebe.

---

## O que acontece se a regra for violada

O `AGENTS.md` na raiz do repositório é explícito sobre o peso disso:

> "uma feature tecnicamente correta mas que quebra o 'a IA nunca entrega resposta pronta' é **bug de produto, mesmo passando no gate mecânico**."

A frase existe porque essa é uma classe de defeito que nenhum teste automatizado pega. Typecheck, lint e build passam perfeitamente numa versão do tutor que responde tudo de bandeja. O produto continua funcionando: as mensagens chegam, o layout está certo, a sessão fecha. E ainda assim a coisa que a Academy vende deixou de existir.

O modo de falha concreto é sempre uma variação de "afrouxar o gate para destravar alguma coisa":

- baixar C1 de CRITICAL para MAJOR, porque o tutor estava reprovando demais e a latência incomodava;
- deixar o tutor validar cedo ("exatamente, é isso mesmo") para a conversa parecer mais fluida;
- pular a Roda do Aprendizado e ir direto ao conceito no turno 1, porque o aluno pediu;
- suavizar o prompt para reduzir custo de retry.

Cada um desses parece uma melhoria de engenharia isolada. Juntos, transformam o produto num chatbot de FAQ com identidade visual de LMS, e o diferencial que justifica o preço evapora sem que nenhum alarme dispare.

A consequência prática para quem for mexer aqui: **mudança em `socrates.ts` ou `tester.ts` é mudança de produto, não refactor.** Passar no gate mecânico é condição necessária e insuficiente. A pergunta que decide é outra: depois desta mudança, o aluno ainda precisa pensar para avançar?

---

## Onde o contrato vive

Vale registrar uma característica incomum desta feature: **o contrato de produto está escrito em código, em português, dentro de dois arquivos de prompt.** As regras pedagógicas não moram num PRD, moram em `socrates.ts` (o que o tutor faz) e `tester.ts` (o que conta como válido). Este documento descreve esses arquivos, não os substitui. Em caso de divergência entre o que está escrito aqui e o que está nos prompts, **os prompts vencem**, porque são eles que rodam.

| Onde | O que define |
|---|---|
| `packages/agents/src/prompts/socrates.ts` | Identidade do tutor, as 10 invariantes, a Roda do Aprendizado, padrões de pergunta, circuit breakers |
| `packages/agents/src/prompts/tester.ts` | Os 6 critérios, as severidades e a regra de veredito |
| `packages/agents/README.md` | A mecânica: cadeia de agentes, retries, roteamento de modelo, pipeline shadow |
| `AGENTS.md` (raiz) | O enquadramento do produto e a regra do "bug de produto" |

---

## Ponto em aberto

O prompt do tutor afirma que "cada sessão tem até 6 interações" e organiza a Roda do Aprendizado em cima desse número (3 para reflexão, 3 para conceituação). O schema do banco, porém, cria sessões com um orçamento padrão maior. Enquanto os dois não forem reconciliados, o tutor calibra a profundidade com base em um total que pode não ser o real da sessão. Vale confirmar qual é a intenção de produto antes de mexer em qualquer um dos dois lados.
