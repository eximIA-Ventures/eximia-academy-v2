-- Seed: Regra de 3 article as draft in verso_posts
-- Uses dollar-quoting to avoid escaping issues with markdown content

INSERT INTO verso_posts (
  tenant_id,
  title,
  slug,
  excerpt,
  content,
  author,
  category,
  cover_color,
  tags,
  reading_time,
  status,
  sources
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'A Regra de 3: Por Que o Melhor Time do Mundo Tem Menos Gente do Que Você Imagina',
  'regra-de-3-tamanho-ideal-de-times',
  'A cada pessoa que você adiciona a um grupo, a complexidade não soma — multiplica. A ciência explica por que 3 é o número que separa times que funcionam de times que só parecem funcionar. E por que isso vale para humanos e para agentes de IA.',
  $body$Existe uma fórmula que deveria ser ensinada em toda escola de negócios, todo curso de liderança e toda reunião de planejamento. Ela tem cinco caracteres:

**n(n-1)/2**

Onde *n* é o número de pessoas no seu grupo.

Essa fórmula calcula quantas conexões diretas existem entre os membros de um time. E o que ela revela é contra-intuitivo: a complexidade de um grupo não cresce na mesma velocidade que o número de pessoas. Ela **explode**.

**Cinco caracteres. Essa é a distância entre um time que funciona e um time que finge funcionar.**

## A matemática que ninguém te mostrou

Vamos ao concreto:

| Pessoas | Conexões | O que acontece |
|:---:|:---:|:---|
| 2 | 1 | Uma conversa. Simples. |
| 3 | 3 | Três diálogos possíveis. Ainda gerenciável. |
| 4 | 6 | Seis linhas de comunicação. Começa a complicar. |
| 5 | 10 | Dez. Já é difícil manter todos alinhados. |
| 6 | 15 | Quinze canais. Precisa de processos formais. |
| 10 | 45 | Quarenta e cinco. Reuniões viraram o trabalho. |
| 20 | 190 | Cento e noventa. Ninguém sabe o que o outro faz. |
| 50 | 1.225 | Burocracia não é escolha — é inevitabilidade. |

Releia a tabela. Dobrar um time de 5 para 10 pessoas não dobra a complexidade — multiplica por **4,5x**. Ir de 10 para 50 multiplica por **27x**.

> *E o pior? Esse número não é o único problema. O esforço de cada pessoa também cai. Continue lendo.*

É por isso que adicionar gente a um projeto atrasado o atrasa *ainda mais*. Não é intuição — é matemática. Frederick Brooks formalizou isso em 1975 no clássico *The Mythical Man-Month* e chamou de **Lei de Brooks**. Quase 50 anos depois, a maioria dos gestores ainda não internalizou.

## O que acontece com o esforço individual

Em 1913, o engenheiro agrícola francês Maximilien Ringelmann conduziu um experimento simples: pediu a pessoas que puxassem uma corda, sozinhas e em grupo. O resultado deveria ser óbvio — mais gente, mais força. Mas não foi o que ele encontrou.

Quando uma pessoa puxava sozinha, dava 100% do esforço. Em dupla, cada uma dava ~93%. Em trio, ~85%. Em grupo de oito, cada indivíduo contribuía apenas ~49% da sua capacidade.

**Metade.**

**Você não contratou 8 pessoas. Você contratou 4 — e pagou por 8.**

Esse fenômeno — batizado de **Efeito Ringelmann** — foi depois destrinchado por Bibb Latané, Kipling Williams e Stephen Harkins em 1979, que cunharam o termo que todo gestor deveria conhecer: **social loafing** (preguiça social).

A descoberta mais importante? A queda de esforço segue uma curva, não uma linha reta. O maior impacto acontece de 1 para 2 e de 2 para 3 pessoas. Depois de 4 ou 5, a perda marginal por pessoa adicionada diminui — mas o dano já está feito.

Karau e Williams confirmaram isso em 1993 com uma meta-análise de **78 estudos**. O padrão é universal: quanto maior o grupo, menor o esforço individual. Eles propuseram o *Collective Effort Model* para explicar por quê — quando a contribuição individual se dilui no coletivo, a motivação para se esforçar diminui.

A lição é dura: **cada pessoa que você adiciona ao grupo torna todas as outras um pouco menos produtivas.** Não por preguiça consciente — por diluição inconsciente de responsabilidade.

> *"Ok, o esforço cai. Mas pelo menos o cérebro dá conta de coordenar todo mundo, certo?" Errado.*

## O cérebro tem um limite — e ele é menor do que você pensa

Robin Dunbar é um antropólogo britânico que, nos anos 1990, fez uma descoberta que mudou nossa compreensão de relações humanas. Ao estudar a correlação entre o tamanho do cérebro de primatas e o tamanho dos seus grupos sociais, ele extrapolou para humanos e chegou a um número: **150**.

É o limite cognitivo de relacionamentos estáveis que o cérebro humano consegue manter — o famoso **Número de Dunbar**, confirmado por 23 estudos independentes, em culturas diversas, ao longo de 2.000 anos de história humana. Da Roma antiga a redes sociais digitais, o número se mantém.

Mas o que pouca gente sabe é que 150 é apenas uma camada. Dunbar descobriu uma estrutura **fractal** de relacionamentos, onde cada nível é aproximadamente 3 vezes maior que o anterior:

| Camada | Tamanho | Significado |
|:---:|:---:|:---|
| 1 | **5** | Círculo íntimo — as pessoas que você liga às 3 da manhã |
| 2 | **15** | Amigos próximos — você sabe o que acontece na vida deles |
| 3 | **50** | Amigos casuais — você os convida para uma festa |
| 4 | **150** | Conhecidos estáveis — sabe quem são e como se relacionam |
| 5 | **500** | Rostos conhecidos |
| 6 | **1.500** | Nomes reconhecíveis |

A mesma estrutura aparece em bandos de primatas, golfinhos e elefantes. Não é cultural — é biológico.

**Seu cérebro não evoluiu para gerenciar 20 pessoas. Evoluiu para sobreviver com 5.**

Para times de trabalho, o número que importa é o primeiro: **5**. É o núcleo operacional. É o tamanho no qual o cérebro humano consegue rastrear todas as relações, todas as dinâmicas, todas as intenções — sem processos formais, sem ferramentas de gestão, sem burocracia.

## Harvard confirma: menos é mais

J. Richard Hackman passou décadas estudando times em Harvard. Sua conclusão é direta:

> "Nenhum time de trabalho deveria ter membros em dois dígitos. Meu número preferido é seis."

Hackman não chegou a esse número por gosto pessoal. Ele observou que conforme o time cresce, o problema não é a quantidade de pessoas — é a **complexidade de coordenação**. Cada novo membro não soma capacidade linearmente; ele multiplica interfaces de comunicação exponencialmente.

Com 6 pessoas, são 15 conexões. Com 10, são 45. **Triplicou a complexidade para adicionar 67% mais gente.** O retorno é decrescente. O custo é crescente. A produtividade paga a conta.

> *Hackman disse isso em Harvard. Bezos provou na Amazon. E o Google confirmou com dados de 180 times. Spoiler: nenhum deles discorda.*

## O que o Google descobriu estudando 180 times

Em 2012, o Google lançou o **Projeto Aristotle** — um estudo ambicioso para descobrir o que faz times funcionarem. Analisaram mais de 180 equipes internas com dados, entrevistas e métricas de performance.

A descoberta central derrubou uma crença popular: **quem** está no time importa menos do que **como** o time interage.

O fator número um de performance? **Segurança psicológica** — a crença de que você pode errar, questionar e ser vulnerável sem ser punido. Esse único fator explicava **43% da variância** em performance entre times.

Times com alta segurança psicológica apresentaram:

| Métrica | Impacto |
|:---|:---:|
| Produtividade | **+19%** |
| Inovação | **+31%** |
| Turnover | **-27%** |
| Engajamento | **3.6x** |

E aqui está a conexão com tamanho de grupo: segurança psicológica é **inversamente proporcional** ao tamanho do time. Em grupos pequenos, cada pessoa tem voz. Em grupos grandes, as pessoas se escondem. A vulnerabilidade exige intimidade — e intimidade exige poucos.

**Não é o talento. É o tamanho. Times pequenos não precisam de permissão para serem vulneráveis.**

## Bezos sabia disso antes de ser Jeff Bezos

Nos primeiros anos da Amazon, Jeff Bezos instituiu uma regra que parecia excêntrica: **nenhum time deveria ser grande o suficiente para precisar de mais de duas pizzas para alimentá-lo**.

A "Regra das Duas Pizzas" limita times a 5-7 pessoas. Bezos a justificava com uma frase provocativa:

> "Comunicação excessiva é sinal de disfunção."

Não é que ele não valorizasse comunicação. É que ele entendia que times pequenos não *precisam* de tanta comunicação formal — eles se comunicam organicamente. A necessidade de processos, reuniões de alinhamento e documentação excessiva é sintoma, não solução. É o time gritando que é grande demais.

A Amazon se tornou uma das empresas mais valiosas do mundo operando com essa lógica. Não apesar dos times pequenos — **por causa deles**.

**Até aqui, temos um engenheiro francês de 1913, um antropólogo de Oxford, um professor de Harvard, a maior empresa de tecnologia do mundo e o homem mais rico do planeta dizendo a mesma coisa. Coincidência?**

## 700 anos de evidência política

C. Northcote Parkinson não estudou startups — estudou governos. Em 1958, ele analisou **700 anos de gabinetes britânicos**, de 1257 a 1955, e identificou um padrão que chamou de "coeficiente de ineficiência":

Todo conselho começa pequeno e eficaz. Cresce gradualmente. Ao ultrapassar ~20 membros, se torna tão ineficiente que é substituído por um novo conselho menor. Que cresce. Que se torna ineficiente. Que é substituído.

O ciclo se repetiu por **sete séculos**.

**Sete séculos. O mesmo erro. Repetido por gente que governava impérios.**

Parkinson concluiu que o tamanho ótimo para um corpo decisório fica entre **3 e 20** membros, com o sweet spot na faixa de **5 a 8**. Acima de 20, nenhuma engenharia de gestão salva — a ineficiência é estrutural.

## Os Navy SEALs e o número 4

Se alguém entende de performance sob pressão, são as forças especiais. E é revelador que as unidades militares mais eficazes do mundo operam com o menor número possível de pessoas.

O **fire team** dos Navy SEALs — a menor unidade operacional — tem **4 pessoas**. Não 10. Não 20. Quatro.

Por quê? Porque em combate, não há tempo para reuniões de alinhamento. Cada membro precisa saber exatamente o que os outros farão, o que pensam, como reagem. Esse nível de sincronia só é possível em grupos pequenos o suficiente para que cada um conheça profundamente os outros.

O **Scrum** — metodologia ágil usada em desenvolvimento de software — chegou à mesma conclusão por outro caminho. O tamanho ideal é **3 a 9 pessoas**, com o ponto ótimo em **4 a 5**. Dados empíricos mostram que times de 9-11 levam **2,5 a 3,5 vezes mais tempo** para entregar projetos do que times de 3-5.

Leia de novo: quase o triplo do tempo. Com o dobro de gente.

> *Se parasse aqui, já seria um dos artigos mais bem fundamentados que você leu sobre gestão de times. Mas não vou parar. Porque a parte mais surpreendente vem agora.*

## E quando os "membros" do time são IAs?

Tudo o que você leu até aqui se aplica a humanos. Mas aqui vai a parte que ninguém está discutindo: **a Regra de 3 vale para agentes de inteligência artificial também.**

Estamos em 2026. Sistemas multi-agentes — onde múltiplas IAs colaboram para resolver problemas complexos — são a nova fronteira da tecnologia. O Google, a Anthropic, a OpenAI e dezenas de startups estão construindo frameworks para orquestrar "times de IAs". E sabe o que estão descobrindo?

**A mesma matemática da corda de Ringelmann.**

### O estudo do Google que mudou o jogo

Em dezembro de 2025, o Google DeepMind publicou *"Towards a Science of Scaling Agent Systems"* — o primeiro estudo rigoroso sobre quando e por que sistemas multi-agentes funcionam. Avaliaram **180 configurações diferentes** de agentes de IA em tarefas variadas.

Os resultados:

- Em tarefas que exigem raciocínio sequencial, **cada variante multi-agente degradou a performance em 39% a 70%**. O custo de coordenação entre agentes "fragmenta o orçamento cognitivo" — a IA gasta tokens se comunicando em vez de pensando.

- Agentes independentes podem **amplificar erros em até 17x** quando falhas se propagam sem supervisão. Com coordenação centralizada, a amplificação cai para ~4,4x.

- Em tarefas paralelizáveis (análise financeira, pesquisa em múltiplas fontes), a coordenação centralizada **melhorou a performance em 80,9%** comparada a um agente único.

O padrão é idêntico ao dos humanos: mais agentes ajudam quando as tarefas são independentes. Quando precisam colaborar sequencialmente, a complexidade de coordenação come o ganho.

**1913: humanos puxando corda. 2025: IAs processando tokens. A matemática não mudou.**

### A recomendação da Anthropic

A Anthropic — criadora do Claude — chegou à mesma conclusão de Hackman e Bezos, mas para IAs:

> **"Comece com 3 a 5 agentes por workflow. Esse intervalo equilibra trabalho paralelo com coordenação gerenciável."**

Soa familiar?

3 a 5 agentes. 3 a 5 pessoas. O mesmo número. Não por coincidência — porque a complexidade de coordenação segue a mesma fórmula matemática, seja a comunicação feita por linguagem natural entre humanos ou por tokens entre modelos de linguagem.

### "Mas e quem opera com 160+ agentes?"

Se você leu nosso primeiro artigo — *"A Empresa de Uma Pessoa com +160 Agentes"* — pode estar pensando: isso não contradiz tudo o que acabou de ser dito?

Não. E entender por que não é a parte mais importante deste artigo.

Esse princípio foi central na formação do meu sistema. Alan Nicolas, criador do AIOX e do Squad Creator, ensina que a arquitetura de squads com 3 a 5 agentes por tarefa não é preferência, é consequência direta da fórmula n(n-1)/2. Foi nessa mentoria que conectei a ciência dos times humanos à engenharia de sistemas multi-agentes.

Ter **160+ agentes no elenco** não significa colocar 160 agentes na mesma sala. Significa ter **160 especialistas disponíveis** — organizados em squads de 3 a 7 membros, cada um com seu domínio. Quando uma tarefa chega, um orquestrador central seleciona o squad certo e ativa apenas **3 a 5 agentes por vez**.

É exatamente o modelo Amazon. A Amazon tem 1,5 milhão de funcionários, mas nenhum time interno tem mais que 7 pessoas. O poder não está no número total — está na **arquitetura de organização**.

A diferença entre "ter 160 agentes" e "usar 160 agentes ao mesmo tempo" é a diferença entre ter uma biblioteca com 10 mil livros e tentar ler 10 mil livros simultaneamente. O valor da biblioteca está na curadoria: saber **qual livro abrir** para cada problema.

Na prática, funciona assim:

- **Elenco (roster):** 160+ agentes com expertises distintas — cada um construído com frameworks reais, vocabulário verificado, anti-patterns documentados. Gary Halbert não escreve como David Ogilvy. Warren Buffett não analisa como Nassim Taleb. Essa diversidade é o ativo.

- **Squad ativo (por tarefa):** 3 a 5 agentes selecionados por relevância. Um chief coordena. Os membros executam em paralelo ou sequência, conforme a natureza da tarefa.

- **Orquestrador:** Uma camada central (no meu caso, o J.A.R.V.I.S.) que nunca fala com todos os 160 ao mesmo tempo. Ele fala com **chiefs de squad**, que falam com seus membros. Hierarquia fractal — a mesma que Dunbar descobriu na biologia.

Essa arquitetura respeita todas as leis que discutimos:

| Princípio | Como se aplica |
|:---|:---|
| Fórmula n(n-1)/2 | Cada squad tem no máximo 21 conexões internas (7 membros). Nunca 12.720 (160 membros). |
| Efeito Ringelmann | Esforço individual preservado — cada agente sabe que seu output é rastreável e atribuível. |
| Dunbar | Orquestrador mantém ~26 relações (com chiefs). Chiefs mantêm ~5 (com membros). Fractal. |
| Hackman | Nenhum squad ativo ultrapassa dois dígitos. |
| Bezos | Cada squad caberia em duas pizzas. |

**A escala está no roster. A eficiência está no squad.**

#### "Mas e um único squad com 16 agentes?"

Boa pergunta. O squad Hormozi $100M, por exemplo, tem 16 agentes especializados — desde copy e offers até pricing e retention. Pela fórmula, seriam 120 conexões possíveis. Parece uma violação frontal de tudo o que discutimos.

Não é. Porque o orquestrador tem a Regra de 3 **embutida em sua arquitetura**.

Quando uma tarefa chega ao squad Hormozi — digamos, criar uma oferta irresistível — o chief não ativa os 16 agentes. Ele seleciona 3: hormozi-offers para estruturar a oferta, hormozi-pricing para calibrar o preço e hormozi-copy para escrever a página de vendas. Os outros 13? Dormem. Estão disponíveis, não ativos.

O squad de 16 é um **departamento**. O time que executa cada tarefa é um **trio** ou **quarteto**. A diferença é crucial:

- 16 agentes no roster = 120 conexões **potenciais**
- 3 agentes ativos por tarefa = 3 conexões **reais**

A Regra de 3 não limita o tamanho do departamento. Limita o tamanho do **time ativo por tarefa**. O orquestrador nunca precisa ser instruído sobre isso — a regra está no código-fonte. Quando recebe uma demanda, ele automaticamente decompõe, seleciona e limita. Não por restrição arbitrária — porque a fórmula n(n-1)/2 é lei, e o sistema a respeita por design.

**120 conexões possíveis. 3 conexões reais. Essa é a diferença entre arquitetura e caos.**

É como um hospital com 500 médicos. Quando você precisa de uma cirurgia, não entram 500 na sala. Entra um cirurgião, um anestesista, um instrumentador e dois assistentes. Cinco. O hospital é grande para ter o especialista certo disponível para cada caso — não para colocar todos no mesmo procedimento.

> *No artigo anterior, detalhamos como o J.A.R.V.I.S. orquestra esses 160+ agentes na prática — a arquitetura fractal por trás do caso. Se a Regra de 3 te intrigou, vale entender o sistema que a aplica em escala.*

### O solopreneur de 2026 entendeu

Enquanto empresas tradicionais continuam contratando equipes de 20 para fazer o trabalho de 5, uma nova classe de empreendedores está aplicando a Regra de 3 de forma radical.

O **solopreneur com IA** opera com um time híbrido: 1 humano + múltiplos agentes especializados. O stack completo custa entre $3.000 e $12.000 por ano — uma redução de **95-98%** comparada a uma equipe tradicional equivalente.

Mas os que têm sucesso não são os que acumulam mais ferramentas. São os que mantêm seus "squads" de IA enxutos: 3 a 5 agentes com papéis claros, cada um dono de um domínio específico. Um para pesquisa. Um para redação. Um para análise. Não trinta fazendo tudo ao mesmo tempo e nada direito.

A mesma regra. Aplicada a um contexto que não existia há dois anos.

## Por que 3 é o número

Todos esses dados — de Ringelmann em 1913 ao Google DeepMind em 2025 — convergem para um ponto. Não é coincidência. É biologia, psicologia, matemática e agora ciência da computação dizendo a mesma coisa de formas diferentes.

**113 anos de pesquisa. Seis disciplinas. Uma conclusão.**

**3 é o número onde:**

**1. Há diversidade sem caos.** Uma pessoa é monólogo. Duas é debate (e empate). Três é deliberação — perspectivas suficientes para enriquecer, poucas o bastante para decidir. Vale para humanos numa sala. Vale para agentes de IA num workflow.

**2. A complexidade ainda é humana.** Com 3 conexões (versus 6 em grupo de 4, ou 10 em grupo de 5), cada membro consegue rastrear todas as dinâmicas sem esforço cognitivo extra. Para IAs, 3 conexões significam menos tokens gastos em coordenação e mais em raciocínio.

**3. O social loafing não se instalou.** Em trios, ainda não há onde se esconder. Cada contribuição é visível. Cada ausência, notada. Em sistemas multi-agentes, cada output é rastreável e atribuível.

**4. A segurança psicológica é natural.** Você não precisa de "sessões de team building" para que 3 pessoas se conheçam e confiem umas nas outras. Em times híbridos humano-IA, 3 ferramentas são memorizáveis; 15 são um pesadelo de integração.

**5. O cérebro processa sem sobrecarregar.** Pesquisas em persuasão (Shu & Carlson, 2014) confirmam: 3 é o número ótimo de informações antes do ceticismo. Com 4 ou mais argumentos, o ouvinte ativa defesas — o cérebro para de absorver e começa a duvidar. É por isso que os melhores slogans têm 3 palavras, os melhores discursos têm 3 atos e as melhores estratégias têm 3 pilares.

> *"Veni, vidi, vici."* — Júlio César não precisou de um quarto verbo.

Não é que times de 5, 7 ou 15 não funcionem. Funcionam — para certas tarefas, com certos processos. Mas o **núcleo decisório**, o grupo que realmente *pensa junto*, raramente deveria passar de 3.

## O que isso muda na prática

Se você lidera um time, uma empresa ou até uma família, a implicação é clara:

> *Se você leu até aqui, já sabe mais sobre dinâmica de grupos do que 90% dos gestores. Agora a parte que importa: o que fazer com isso.*

**Pare de adicionar gente — ou ferramentas — como solução padrão.**

Quando um projeto atrasa, o instinto é colocar mais pessoas. Quando a qualidade cai, o instinto é contratar. Quando a comunicação falha, o instinto é criar mais canais. Quando a IA não entrega, o instinto é adicionar mais agentes.

Cada um desses instintos piora o problema que tenta resolver.

### Para times humanos:

- **Decisão:** máximo 3 pessoas. Quem decide, decide rápido.
- **Execução:** 4 a 6 pessoas. Pequeno o bastante para sincronia orgânica.
- **Coordenação:** divida em sub-times de 3-5, cada um com autonomia real.
- **Reuniões:** se tem mais de 5 pessoas, alguém não deveria estar lá.

### Para times de IA:

- **Agentes por workflow:** 3 a 5. Especialistas, não generalistas.
- **Tarefas sequenciais:** prefira 1 agente forte a 3 fracos se comunicando.
- **Tarefas paralelas:** distribua com coordenação centralizada e outputs claros.
- **Solopreneurs:** 1 humano estratégico + 3-5 agentes especialistas > 1 humano + 30 ferramentas.

### Para times híbridos (humano + IA):

- **O humano é o estrategista.** IA executa, humano direciona.
- **Menos ferramentas, mais profundidade.** Domine 3 ferramentas ao invés de assinar 15.
- **A orquestração é a habilidade.** O valor não está em usar IA — está em saber *como* orquestrar poucos agentes para máximo impacto.

A Amazon não é eficiente porque tem 1,5 milhão de funcionários. É eficiente porque opera como milhares de times pequenos, cada um com autonomia para decidir e executar. O solopreneur de 2026 não é produtivo porque tem 30 ferramentas de IA. É produtivo porque sabe usar 3 com maestria.

## A síntese

Três é um número mágico. Não por superstição, mas por matemática pura, biologia evolutiva, décadas de pesquisa em psicologia organizacional — e agora confirmado pela ciência de sistemas multi-agentes.

A complexidade de comunicação cresce exponencialmente com o tamanho do grupo. O esforço individual cai. A segurança psicológica se dilui. A capacidade decisória congela. Isso vale para pessoas puxando uma corda em 1913, para gabinetes britânicos em 1257, para times do Google em 2012 e para agentes de IA em 2025.

Cada pessoa — ou agente — que você adiciona a um time tem um custo invisível. Medido não em salário ou tokens, mas em conexões, coordenação e complexidade. E esse custo cresce mais rápido do que qualquer benefício que o novo membro traz.

A próxima vez que alguém sugerir "precisamos de mais gente" — ou "precisamos de mais ferramentas" — faça a conta:

**n(n-1)/2**

E pergunte: precisamos de mais gente — ou de menos ruído?

---

*Esse é o tipo de perspectiva que o Verso publica. Não o que fazer — mas como pensar sobre o que fazer.*$body$,
  'eximIA',
  'Negócios & Empreendedorismo',
  '#0d4f4f',
  ARRAY['times', 'gestão', 'psicologia organizacional', 'produtividade', 'liderança', 'Dunbar', 'Amazon', 'multi-agent AI', 'inteligência artificial'],
  20,
  'draft',
  '[
    {"title": "Ringelmann Effect: Studies of Group Size and Group Performance — ScienceDirect", "url": "https://www.sciencedirect.com/science/article/abs/pii/002210317490033X"},
    {"title": "Dunbar''s Number — 30 Years of Scrutiny — The Conversation", "url": "https://theconversation.com/dunbars-number-why-my-theory-that-humans-can-only-maintain-150-friendships-has-withstood-30-years-of-scrutiny-160676"},
    {"title": "The Social Brain Hypothesis — Robin Dunbar", "url": "https://cognitionandculture.net/wp-content/uploads/Evolutionary-Anthropology-1998-Dunbar-The-social-brain-hypothesis.pdf"},
    {"title": "Hackman''s Law — Leading Teams (Harvard)", "url": "https://sergiocaredda.eu/organisation/hackmans-law/"},
    {"title": "Google''s Project Aristotle — re:Work", "url": "https://rework.withgoogle.com/intl/en/guides/understanding-team-effectiveness"},
    {"title": "Amazon Two-Pizza Teams — AWS Executive Insights", "url": "https://aws.amazon.com/executive-insights/content/amazon-two-pizza-team/"},
    {"title": "Social Loafing: A Meta-Analytic Review — Karau & Williams (1993)", "url": "https://psycnet.apa.org/getdoi.cfm?doi=10.1037%2F0022-3514.65.4.681"},
    {"title": "Parkinson''s Coefficient of Inefficiency — Physics World", "url": "https://physicsworld.com/a/physicists-quantify-the-coefficient-of-inefficiency/"},
    {"title": "Two-Pizza Teams: The Science Behind Jeff Bezos'' Rule — Nuclino", "url": "https://blog.nuclino.com/two-pizza-teams-the-science-behind-jeff-bezos-rule"},
    {"title": "Shu & Carlson (2014) — When Three Charms but Four Alarms", "url": "https://piotrgarlej.com/the-rule-of-3-in-persuasive-writing-and-presentations-how-to-persuade-inspire-motivate-with-triplets/"},
    {"title": "Google DeepMind (2025) — Towards a Science of Scaling Agent Systems", "url": "https://research.google/blog/towards-a-science-of-scaling-agent-systems-when-and-why-agent-systems-work/"},
    {"title": "Anthropic — Building Multi-Agent Systems: When and How to Use Them", "url": "https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them"},
    {"title": "Anthropic — Orchestrate Teams of Claude Code Sessions", "url": "https://code.claude.com/docs/en/agent-teams"},
    {"title": "Alan Nicolas, Mentoria AIOX Cohort Advanced: Squad Creator, orquestração multi-agente e Regra de 3 aplicada", "url": "https://www.instagram.com/oalannicolas/"}
  ]'::jsonb
)
ON CONFLICT DO NOTHING;
