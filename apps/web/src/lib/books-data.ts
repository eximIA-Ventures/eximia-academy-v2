export interface BookChapter {
  id: string
  title: string
  content: string
}

export interface Book {
  id: string
  title: string
  author: string
  category: string
  description: string
  coverUrl: string
  coverColor: string
  rating: number
  year: number
  pages: number
  tags: string[]
  synopsis: string
  authorBio: string
  chapters: BookChapter[]
  summaryChapters: BookChapter[]
}

export const BOOKS: Book[] = [
  {
    id: "3",
    title: "The Toyota Way",
    author: "Jeffrey K. Liker",
    category: "Lean",
    description:
      "Os 14 principios de gestao que fizeram da Toyota a maior montadora do mundo. Um dos livros mais influentes sobre Lean Manufacturing e excelencia operacional.",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780071392310-L.jpg",
    coverColor: "from-semantic-error/80 to-accent-gold-dark",
    rating: 5,
    year: 2004,
    pages: 352,
    tags: ["Toyota", "Lean Manufacturing", "14 Principios"],
    synopsis:
      "The Toyota Way revela os 14 princípios de gestão que transformaram a Toyota de uma pequena empresa japonesa na maior e mais lucrativa montadora do mundo. Jeffrey Liker, após mais de 20 anos estudando a Toyota, organiza esses princípios em quatro categorias: Filosofia de Longo Prazo, Processos Corretos Produzem Resultados Corretos, Desenvolvimento de Pessoas e Parceiros, e Solução Contínua de Problemas Fundamentais. O livro vai além das ferramentas Lean para revelar a filosofia de gestão subjacente, mostrando como o pensamento de longo prazo, a eliminação de desperdícios, o respeito pelas pessoas e a resolução rigorosa de problemas se combinam para criar uma organização de aprendizado contínuo.",
    authorBio:
      "Jeffrey K. Liker é professor de Engenharia Industrial e Operações na Universidade de Michigan. Dedicou mais de duas décadas ao estudo da Toyota e é autor de diversos livros sobre o tema. Recebeu onze vezes o Prêmio Shingo de Excelência em Pesquisa e é considerado uma das maiores autoridades mundiais em Lean Manufacturing e no Sistema Toyota de Produção.",
    chapters: [
      {
        id: "3-1",
        title: "Filosofia de Longo Prazo",
        content: `O primeiro princípio do Toyota Way é fundamentar suas decisões de gestão em uma **filosofia de longo prazo**, mesmo que isso signifique sacrificar metas financeiras de curto prazo.

A Toyota opera com uma missão que vai além de ganhar dinheiro. O propósito da empresa é **gerar valor para o cliente, a sociedade e a economia**. Essa filosofia é o alicerce sobre o qual todos os outros princípios se sustentam.

## Princípio 1: Baseie suas decisões em uma filosofia de longo prazo

> "O fator mais importante no sucesso da Toyota é a paciência. A maioria das empresas americanas se preocupa com os resultados trimestrais. A Toyota se preocupa com os resultados de longo prazo."

### O que isso significa na prática:

- **Investir em pessoas** mesmo durante crises econômicas — a Toyota historicamente evitou demissões em massa
- **Desenvolver tecnologia internamente** em vez de buscar soluções rápidas de terceiros
- **Aceitar lucros menores hoje** para construir capacidade superior amanhã
- **Pensar em gerações**, não em trimestres

### A diferença fundamental

Enquanto empresas ocidentais tipicamente medem sucesso por métricas financeiras trimestrais, a Toyota mede sucesso pela capacidade de **melhorar continuamente** e **agregar valor ao longo de décadas**. Quando Akio Toyoda fala sobre "o próximo século da Toyota", não é retórica — é planejamento real.

Essa mentalidade cria uma organização que toma decisões fundamentalmente diferentes. Uma empresa focada no trimestre pode cortar investimentos em qualidade para melhorar margens. A Toyota nunca faria isso, porque entende que qualidade é o caminho para o sucesso sustentável.`,
      },
      {
        id: "3-2",
        title: "Processos Corretos, Resultados Corretos",
        content: `A segunda categoria do Toyota Way abrange os princípios 2 a 8, todos focados em **criar processos que produzam resultados corretos**. A crença fundamental é que se você acertar o processo, os resultados virão naturalmente.

## Princípio 2: Crie fluxo contínuo para trazer problemas à tona

O fluxo contínuo (one-piece flow) é o ideal da produção Lean. Em vez de processar grandes lotes, cada peça move-se individualmente através do processo. Isso:

- **Reduz o tempo de espera** de dias para minutos
- **Expõe problemas imediatamente** — não há estoque para escondê-los
- **Força a resolução rápida** — o fluxo para se houver defeito

## Princípio 3: Use sistemas puxados para evitar superprodução

A superprodução é o **pior dos sete desperdícios** porque gera todos os outros. O sistema puxado (kanban) garante que você só produz o que o próximo processo precisa, quando precisa.

> "Superprodução é como veneno para um sistema de produção. Ela esconde todos os problemas."

## Princípio 4: Nivele a carga de trabalho (Heijunka)

Heijunka significa nivelar o mix e o volume de produção. Em vez de produzir grandes lotes de um produto e depois trocar, a Toyota produz **pequenas quantidades de tudo, o tempo todo**. Isso reduz variabilidade e permite um fluxo mais estável.

## O poder da combinação

Esses princípios não funcionam isoladamente. Fluxo contínuo + sistema puxado + nivelamento criam um sistema onde:

1. Problemas são visíveis imediatamente
2. A causa raiz deve ser encontrada e eliminada
3. O sistema melhora continuamente como resultado

É um **sistema de aprendizado**, não apenas um sistema de produção.`,
      },
      {
        id: "3-3",
        title: "Desenvolvimento de Pessoas e Parceiros",
        content: `A terceira categoria do Toyota Way — princípios 9 a 11 — trata do **investimento em pessoas**. Para a Toyota, pessoas não são recursos descartáveis, mas o ativo mais valioso da organização.

## Princípio 9: Desenvolva líderes que vivam a filosofia

A Toyota não contrata CEOs de fora. **Todos os líderes são desenvolvidos internamente** ao longo de décadas. Um líder Toyota deve:

- Ter profundo entendimento do trabalho no gemba (chão de fábrica)
- Ser um professor e mentor, não apenas um gestor
- Tomar decisões baseadas em **observação direta**, não em relatórios

> "Antes de construir carros, nós construímos pessoas." — Provérbio Toyota

## Princípio 10: Desenvolva pessoas e equipes excepcionais

O desenvolvimento não é responsabilidade do RH — é responsabilidade de **cada líder, todos os dias**. O modelo Toyota de desenvolvimento inclui:

- **Rotação de funções** para criar visão sistêmica
- **Desafios progressivos** que esticam capacidades
- **Trabalho em equipe** como unidade fundamental (não indivíduos)
- **Resolução de problemas como habilidade central** ensinada a todos

## Princípio 11: Respeite sua rede de parceiros e fornecedores

A Toyota trata fornecedores como **extensões da família**. Isso significa:

- Contratos de longo prazo baseados em confiança mútua
- Enviar equipes Toyota para ajudar fornecedores a melhorar
- Compartilhar ganhos de produtividade
- Nunca trocar de fornecedor apenas por preço

### O resultado

Essa abordagem cria um **ecossistema de aprendizado** onde todos — funcionários, líderes e parceiros — estão continuamente melhorando. O investimento em pessoas é o que torna o sistema Toyota sustentável ao longo de gerações.`,
      },
    ],
    summaryChapters: [
      {
        id: "3-s1",
        title: "Resumo Executivo",
        content: `**The Toyota Way** de Jeffrey K. Liker organiza os 14 principios de gestao da Toyota em quatro categorias fundamentais que explicam por que a Toyota se tornou a maior e mais lucrativa montadora do mundo.

## As Quatro Categorias

### 1. Filosofia de Longo Prazo (Principio 1)
Basear decisoes em proposito de longo prazo, mesmo sacrificando resultados financeiros de curto prazo. A Toyota pensa em **geracoes**, nao em trimestres.

### 2. Processos Corretos (Principios 2-8)
- **Fluxo continuo** para expor problemas
- **Sistemas puxados** (kanban) para evitar superprodução
- **Nivelamento** (heijunka) para estabilidade
- **Qualidade na fonte** (jidoka) — parar para resolver
- **Padronizacao** como base para melhoria
- **Gestao visual** para transparencia
- **Tecnologia confiavel** testada a servico das pessoas

### 3. Pessoas e Parceiros (Principios 9-11)
- Desenvolver **lideres internos** que vivam a filosofia
- Respeitar e **desafiar** pessoas e equipes
- Tratar fornecedores como **extensoes da familia**

### 4. Resolucao de Problemas (Principios 12-14)
- **Genchi genbutsu** — ir ver pessoalmente
- Decisoes por **consenso** (nemawashi), implementacao rapida
- **Hansei e kaizen** — reflexao e melhoria continua

## A Mensagem Central

> "O Toyota Way nao e sobre ferramentas. E sobre uma cultura onde cada pessoa, em cada nivel, esta continuamente melhorando."

A diferenca fundamental entre a Toyota e seus concorrentes nao esta nas ferramentas Lean visiveis, mas na **filosofia de gestao invisivel** que as sustenta. Empresas que copiam as ferramentas sem a filosofia consistentemente falham.`,
      },
    ],
  },
  {
    id: "4",
    title: "Lean Thinking",
    author: "James P. Womack & Daniel T. Jones",
    category: "Lean",
    description:
      "O livro que popularizou o conceito Lean no ocidente. Apresenta os 5 principios do pensamento enxuto: valor, fluxo de valor, fluxo continuo, producao puxada e perfeicao.",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780743249270-L.jpg",
    coverColor: "from-varzea-dark to-varzea",
    rating: 5,
    year: 2003,
    pages: 396,
    tags: ["Lean", "5 Principios", "Fluxo de Valor"],
    synopsis:
      "Lean Thinking é a obra que codificou o pensamento enxuto para o mundo ocidental, estabelecendo os cinco princípios fundamentais que qualquer organização pode aplicar: definir Valor a partir da perspectiva do cliente, identificar o Fluxo de Valor completo, criar Fluxo Contínuo eliminando interrupções, implementar Produção Puxada pelo cliente, e buscar a Perfeição através da melhoria contínua. Com exemplos detalhados de empresas como Porsche, Pratt & Whitney e Lantech, os autores demonstram como esses princípios transformam radicalmente a eficiência e a qualidade em qualquer setor, desde manufatura até serviços.",
    authorBio:
      "James P. Womack é fundador e presidente do Lean Enterprise Institute. Daniel T. Jones é fundador da Lean Enterprise Academy no Reino Unido. Juntos, são os autores mais influentes do movimento Lean no ocidente, tendo cunhado o próprio termo 'Lean' em seu trabalho anterior 'The Machine That Changed the World'.",
    chapters: [
      {
        id: "4-1",
        title: "Valor: O Ponto de Partida",
        content: `O primeiro princípio do pensamento Lean parece simples mas é profundamente contra-intuitivo: **valor só pode ser definido pelo cliente final**. Não pelo engenheiro, não pelo CEO, não pelo departamento financeiro — pelo cliente.

## O erro mais comum

A maioria das organizações começa pela pergunta errada. Elas perguntam: "O que nós sabemos fazer?" ou "Como podemos usar nossos equipamentos?". O pensamento Lean inverte essa lógica:

> "A pergunta correta é: o que o cliente realmente precisa, e quanto ele está disposto a pagar por isso?"

## Definindo valor corretamente

Valor é um **produto ou serviço específico**, que atende às **necessidades específicas do cliente**, a um **preço específico**, em um **momento específico**. Qualquer atividade que não contribui diretamente para entregar esse valor é **desperdício** (muda).

### Os três tipos de atividade

1. **Atividades que agregam valor** — transformam o produto/serviço de forma que o cliente está disposto a pagar
2. **Desperdício tipo 1** (muda necessário) — não agrega valor mas é necessário com os sistemas atuais (ex: inspeção de qualidade)
3. **Desperdício tipo 2** (muda puro) — não agrega valor e pode ser eliminado imediatamente

## O caso da Porsche

Quando a Porsche aplicou o pensamento Lean nos anos 90, descobriu que **apenas 3% do tempo total** de seus processos agregava valor ao cliente. Os outros 97% eram espera, transporte, retrabalho e burocracia. Essa descoberta foi o catalisador de uma transformação que salvou a empresa da falência.

A lição é universal: não importa quão eficiente você pense que é, a análise de valor sempre revela oportunidades enormes de melhoria.`,
      },
      {
        id: "4-2",
        title: "Fluxo de Valor e Fluxo Contínuo",
        content: `Os princípios dois e três do pensamento Lean — **identificar o fluxo de valor** e **criar fluxo contínuo** — trabalham juntos para transformar como o trabalho realmente acontece.

## Princípio 2: Identifique o Fluxo de Valor

O fluxo de valor é o **conjunto completo de ações** necessárias para levar um produto ou serviço do conceito ao cliente. Isso inclui três tarefas críticas de gestão:

1. **Resolução de problemas** — do conceito ao lançamento
2. **Gestão da informação** — do pedido à entrega
3. **Transformação física** — da matéria-prima ao produto acabado

### A revelação do mapeamento

Quando você mapeia o fluxo de valor completo pela primeira vez, a descoberta é sempre chocante. Na empresa típica:

- O produto passa **95% do tempo esperando** (filas, lotes, aprovações)
- Apenas **5% é tempo de processamento real**
- Desse tempo de processamento, apenas uma fração agrega valor

## Princípio 3: Crie Fluxo Contínuo

Uma vez que você enxerga o fluxo de valor, o próximo passo é fazer o valor **fluir continuamente**, sem interrupções. Isso desafia o pensamento convencional de produção em lotes.

### Por que lotes parecem eficientes mas não são

A lógica de lotes diz: "Se eu vou preparar a máquina, é melhor produzir muitas peças de uma vez." Mas isso ignora que:

- Peças ficam paradas esperando o lote completar
- Defeitos só são descobertos muito depois
- O tempo total do pedido à entrega explode

### O caso da Lantech

A Lantech, fabricante de máquinas de embalar, transformou sua produção de lotes para fluxo contínuo. Os resultados:

| Métrica | Antes | Depois |
|---------|-------|--------|
| Tempo de entrega | 16 semanas | 14 horas |
| Espaço | 100.000 ft² | 55.000 ft² |
| Defeitos | significativos | quase zero |

A mensagem é clara: **fazer fluir é sempre melhor que fazer em lotes**, independentemente do setor.`,
      },
      {
        id: "4-3",
        title: "Produção Puxada e Perfeição",
        content: `Os dois princípios finais do pensamento Lean — **produção puxada** e **busca pela perfeição** — completam o sistema e criam o ciclo de melhoria contínua.

## Princípio 4: Deixe o cliente puxar

Com fluxo contínuo estabelecido, o próximo passo é deixar o cliente **puxar** o valor do processo, em vez de a empresa **empurrar** produtos para o mercado.

> "Produzir somente o que o próximo processo precisa, quando precisa, na quantidade que precisa."

### O efeito cascata

Quando cada etapa do processo só produz quando a próxima etapa sinaliza necessidade:

- **Estoque despenca** — não há produção especulativa
- **Cash flow melhora** — dinheiro não fica preso em inventário
- **Flexibilidade aumenta** — mudanças de demanda são absorvidas rapidamente
- **Obsolescência desaparece** — nada é produzido "por precaução"

### Do varejo à manufatura

O conceito de puxar funciona em qualquer contexto. Um supermercado "puxa" reposição quando a prateleira esvazia. Um hospital pode "puxar" suprimentos quando o nível mínimo é atingido. Um time de software "puxa" histórias do backlog quando tem capacidade.

## Princípio 5: Busque a Perfeição

O quinto princípio é o mais radical: **não existe um estado final satisfatório**. A perfeição — zero defeitos, zero desperdício, entrega instantânea — é um horizonte a ser perseguido, nunca alcançado.

### Por que isso funciona

Quando você aplica os quatro primeiros princípios, algo mágico acontece: **as melhorias revelam mais oportunidades de melhoria**. Cada redução de desperdício expõe desperdícios que antes estavam escondidos.

É um ciclo virtuoso:

1. Defina valor → encontre desperdício
2. Mapeie o fluxo → veja onde o fluxo para
3. Crie fluxo → problemas emergem
4. Puxe → elimine superprodução
5. Repita → cada ciclo revela o próximo nível

### A mensagem central

Lean não é um projeto com data de término. É uma **jornada infinita de descoberta e melhoria**. As organizações que entendem isso — como Toyota, Danaher e Illinois Tool Works — são as que sustentam resultados extraordinários por décadas.`,
      },
    ],
    summaryChapters: [
      {
        id: "4-s1",
        title: "Resumo Executivo",
        content: `**Lean Thinking** de Womack e Jones codifica o pensamento enxuto em cinco principios universais aplicaveis a qualquer organizacao.

## Os Cinco Principios

### 1. Valor
Definido exclusivamente pelo **cliente final**. Qualquer atividade que nao contribui para o que o cliente esta disposto a pagar e desperdicio (muda).

### 2. Fluxo de Valor
Mapear a **sequencia completa** de acoes necessarias para entregar valor. A maioria das organizacoes descobre que 95% do tempo e desperdicado em esperas, filas e retrabalho.

### 3. Fluxo Continuo
Fazer o valor **fluir sem interrupcoes** eliminando lotes, filas e departamentos isolados. A Lantech reduziu o tempo de entrega de 16 semanas para 14 horas.

### 4. Producao Puxada
O cliente **puxa** o valor, em vez da empresa empurrar produtos. Produzir apenas o que o proximo processo precisa, quando precisa.

### 5. Perfeicao
Buscar incansavelmente **zero defeitos e zero desperdicio**. Cada melhoria revela novas oportunidades — e um ciclo virtuoso sem fim.

## Casos de Sucesso

| Empresa | Resultado |
|---------|-----------|
| Porsche | De quase falencia a lider global |
| Lantech | Entrega de 16 semanas → 14 horas |
| Pratt & Whitney | Reducao dramatica de custos e lead time |

## Conclusao

Lean nao e um projeto — e uma **jornada infinita de descoberta e melhoria**. As organizacoes que sustentam resultados extraordinarios são as que nunca param de buscar a perfeicao.`,
      },
    ],
  },
  {
    id: "5",
    title: "The Machine That Changed the World",
    author: "James P. Womack, Daniel T. Jones & Daniel Roos",
    category: "Lean",
    description:
      "O estudo pioneiro do MIT que revelou ao mundo o sistema de producao enxuta da Toyota. Compara a producao em massa com a producao Lean e seu impacto global.",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780743299794-L.jpg",
    coverColor: "from-cerrado-500 to-varzea-dark",
    rating: 4,
    year: 1990,
    pages: 336,
    tags: ["MIT", "Sistema Toyota", "Producao Enxuta"],
    synopsis:
      "Baseado no International Motor Vehicle Program (IMVP) do MIT — o maior e mais detalhado estudo já realizado sobre a indústria automotiva — este livro revelou ao mundo pela primeira vez como o sistema de produção da Toyota superava drasticamente a produção em massa ocidental. O estudo comparou fábricas em todo o mundo, demonstrando que a produção enxuta (lean production) usava metade do esforço humano, metade do espaço, metade do investimento e metade das horas de engenharia para desenvolver um novo produto na metade do tempo. O livro é considerado o marco fundador do movimento Lean global.",
    authorBio:
      "James P. Womack, Daniel T. Jones e Daniel Roos lideraram o International Motor Vehicle Program no MIT durante cinco anos. Este estudo internacional envolveu pesquisadores de diversos países e estabeleceu os fundamentos para o que viria a ser conhecido como o movimento Lean. Womack e Jones continuaram sua parceria em obras subsequentes como 'Lean Thinking'.",
    chapters: [
      {
        id: "5-1",
        title: "A Ascensão da Produção Enxuta",
        content: `O International Motor Vehicle Program (IMVP) do MIT foi o maior estudo já realizado sobre uma única indústria. Ao longo de cinco anos, pesquisadores visitaram fábricas em 14 países, cobrindo praticamente toda a indústria automotiva global. O que descobriram mudou o mundo.

## A pergunta que iniciou tudo

No início dos anos 80, a indústria automotiva mundial estava em crise. As fábricas japonesas — especialmente a Toyota — produziam carros melhores, mais rápido e mais barato que suas concorrentes ocidentais. A pergunta era: **como?**

A resposta convencional era simples: mão de obra barata, cultura japonesa, automação. O estudo do MIT provou que **todas essas explicações estavam erradas**.

## Os números que chocaram o mundo

Quando os pesquisadores compararam a fábrica da Toyota em Takaoka com a da GM em Framingham, os resultados foram devastadores:

| Métrica | GM Framingham | Toyota Takaoka |
|---------|:------------:|:--------------:|
| Horas de montagem por carro | 40,7 | 18,0 |
| Defeitos por 100 carros | 130 | 45 |
| Espaço (ft² por carro/ano) | 8,1 | 4,8 |
| Estoque de peças | 2 semanas | 2 horas |

A Toyota não era apenas um pouco melhor — era **duas vezes mais produtiva com um terço dos defeitos**. E não era apenas a Toyota: fábricas japonesas consistentemente superavam as ocidentais em todas as métricas.

## Além da manufatura

O estudo revelou que a superioridade japonesa ia muito além da linha de montagem. O desenvolvimento de novos veículos era igualmente superior:

- **Tempo de desenvolvimento**: 46 meses (Japão) vs. 60 meses (EUA/Europa)
- **Horas de engenharia**: 1,7 milhão (Japão) vs. 3,1 milhões (EUA)
- **Qualidade no lançamento**: significativamente menor quantidade de problemas

A conclusão era inescapável: não se tratava de vantagens culturais ou tecnológicas, mas de um **sistema de produção fundamentalmente superior**.`,
      },
      {
        id: "5-2",
        title: "Produção em Massa vs. Produção Enxuta",
        content: `Para entender a revolução Lean, é preciso entender o sistema que ela substituiu. A produção em massa, inventada por Henry Ford e aperfeiçoada por Alfred Sloan na GM, dominou a indústria por quase um século.

## A lógica da produção em massa

O sistema de Ford/Sloan se baseava em premissas claras:

- **Trabalhadores são intercambiáveis** — qualquer um pode fazer qualquer tarefa simples
- **Profissionais pensam, operários executam** — a inteligência fica no topo
- **Volume reduz custos** — quanto maior o lote, menor o custo unitário
- **Inspeção garante qualidade** — inspecione no final e separe os defeitos
- **Estoque é segurança** — mais estoque = menos risco de parada

Essas premissas criaram um sistema que funcionou extraordinariamente bem por décadas. A produção em massa transformou o automóvel de brinquedo de ricos em commodity acessível.

## O problema oculto

Mas o sistema tinha falhas profundas que só se tornaram visíveis quando uma alternativa surgiu:

### 1. Desperdício institucionalizado
Grandes lotes significam grandes estoques, longos tempos de espera e enormes areas de retrabalho. Na GM Framingham, **20% da área da fábrica** era dedicada a corrigir defeitos.

### 2. Alienação dos trabalhadores
Quando operários são tratados como peças intercambiáveis, eles se comportam como tal. Não reportam problemas, não sugerem melhorias, não se importam com qualidade. O resultado: **absenteísmo crônico e alta rotatividade**.

### 3. Rigidez fatal
A produção em massa otimiza para volume, não para variedade. Trocar de modelo era tão caro que empresas mantinham designs obsoletos por anos.

## O caminho de Ohno

Taiichi Ohno, engenheiro-chefe da Toyota, enfrentou um problema que Ford nunca teve: o **mercado japonês era pequeno e diverso**. Não havia escala para produção em massa. Ohno precisava produzir pequenos volumes de muitos modelos, com qualidade alta e custo baixo.

A solução dele foi inverter cada premissa da produção em massa:

- Trabalhadores devem **pensar e melhorar**, não apenas executar
- **Pequenos lotes** são mais eficientes que grandes lotes
- Qualidade é construída **no processo**, não inspecionada no final
- Estoque é **desperdício**, não segurança

Essa inversão criou o Sistema Toyota de Produção — que o estudo do MIT batizou de **Lean Production**.`,
      },
    ],
    summaryChapters: [
      {
        id: "5-s1",
        title: "Resumo Executivo",
        content: `**The Machine That Changed the World** e o estudo do MIT que revelou ao mundo o sistema de producao enxuta e cunhou o termo "Lean Production".

## O Estudo IMVP

O International Motor Vehicle Program comparou fabricas em **14 paises** durante 5 anos. A descoberta central: a Toyota usava **metade dos recursos** para produzir carros com **um terco dos defeitos** da producao em massa.

## Numeros-Chave

| Metrica | GM (EUA) | Toyota (Japao) |
|---------|:--------:|:--------------:|
| Horas por carro | 40,7 | 18,0 |
| Defeitos/100 carros | 130 | 45 |
| Estoque de pecas | 2 semanas | 2 horas |

## Producao em Massa vs. Lean

**Producao em massa** (Ford/Sloan): trabalhadores intercambiaveis, grandes lotes, inspecao no final, estoque como seguranca.

**Producao enxuta** (Ohno/Toyota): trabalhadores pensantes, pequenos lotes, qualidade no processo, estoque como desperdicio.

## Impacto

O livro provou que a superioridade japonesa **nao era cultural** — era um sistema de producao superior que qualquer empresa poderia aprender. Isso lancou o movimento Lean global que transformou industrias no mundo inteiro.`,
      },
    ],
  },
  {
    id: "6",
    title: "Learning to See",
    author: "Mike Rother & John Shook",
    category: "Lean",
    description:
      "O guia pratico para mapeamento do fluxo de valor (VSM). Ensina a enxergar o fluxo de materiais e informações, identificar desperdicios e projetar estados futuros.",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780966784305-L.jpg",
    coverColor: "from-accent-gold to-accent-gold-light",
    rating: 5,
    year: 2003,
    pages: 143,
    tags: ["VSM", "Mapeamento", "Fluxo de Valor"],
    synopsis:
      "Learning to See é o guia prático definitivo para o Mapeamento do Fluxo de Valor (Value Stream Mapping — VSM), a ferramenta mais poderosa do Lean para visualizar e melhorar processos. Através de um tutorial passo a passo usando a fictícia Acme Stamping, o livro ensina como mapear o estado atual de um fluxo de valor, identificar fontes de desperdício, projetar um estado futuro otimizado e criar um plano de implementação. O formato de workbook com exercícios práticos permite que o leitor aprenda fazendo, tornando-o indispensável para qualquer praticante Lean.",
    authorBio:
      "Mike Rother é engenheiro industrial e pesquisador da Universidade de Michigan, conhecido por seus trabalhos sobre Lean e Toyota Kata. John Shook trabalhou diretamente na Toyota por mais de 10 anos, sendo o primeiro gerente americano da empresa no Japão. Juntos, combinam experiência acadêmica e prática direta no sistema Toyota.",
    chapters: [
      {
        id: "6-1",
        title: "Aprendendo a Enxergar",
        content: `A maioria das organizações tenta melhorar processos **ponto a ponto** — otimizando uma máquina aqui, acelerando uma etapa ali. Isso raramente produz resultados significativos. O Mapeamento do Fluxo de Valor (VSM) oferece uma abordagem radicalmente diferente: **enxergar o todo antes de melhorar as partes**.

## O que é um Fluxo de Valor?

Um fluxo de valor é a **sequência completa de ações** — tanto as que agregam valor quanto as que não agregam — necessárias para levar um produto da matéria-prima ao cliente. Inclui:

- Fluxo de **materiais** (transformação física)
- Fluxo de **informação** (o que diz a cada processo o que fazer a seguir)

> "Sempre que há um produto para um cliente, há um fluxo de valor. O desafio é enxergá-lo."

## Por que mapear?

O mapeamento revela o que **nenhum dado de ERP ou indicador individual** consegue mostrar:

1. **Como o trabalho realmente flui** (vs. como achamos que flui)
2. **Onde o tempo é desperdiçado** — esperas, filas, retrabalho
3. **Como as decisões de informação** afetam o fluxo físico
4. **A relação entre processos** individuais e o resultado total

### A métrica reveladora

O indicador mais poderoso do VSM é a comparação entre:

- **Tempo de processamento** (soma dos tempos que realmente agregam valor)
- **Lead time total** (tempo do pedido à entrega)

Na Acme Stamping, caso do livro:
- Tempo de processamento: **188 segundos**
- Lead time total: **23,6 dias**

Isso significa que o produto passa **99,99% do tempo esperando** e apenas 0,01% sendo transformado. Essa revelação é o primeiro passo para a transformação.

## As regras do mapeamento

1. **Sempre caminhe pessoalmente** pelo fluxo — nunca confie apenas em dados de sistemas
2. **Comece pelo cliente** e volte até a matéria-prima
3. **Use lápis e papel** — não software (pelo menos no primeiro mapa)
4. **Uma pessoa mapeia o fluxo inteiro** — não divida entre departamentos
5. **Mapeie o fluxo de informação** com o mesmo cuidado que o fluxo de materiais`,
      },
      {
        id: "6-2",
        title: "Estado Atual e Estado Futuro",
        content: `O VSM acontece em duas fases distintas: mapear o **estado atual** (como as coisas são hoje) e projetar o **estado futuro** (como queremos que sejam). A tentação de pular direto para soluções é grande, mas o estado atual é inegociável.

## Mapeando o Estado Atual

### Passo 1: Dados do cliente
Comece com a demanda: quantas peças o cliente precisa, com que frequência, em que embalagem? Esses dados definem o **takt time** — o ritmo que o fluxo precisa manter.

> **Takt time = Tempo disponível / Demanda do cliente**

Se o cliente precisa de 460 peças por turno e o turno tem 460 minutos, o takt time é 1 minuto. Isso significa que o fluxo precisa produzir **uma peça a cada 60 segundos** para atender a demanda.

### Passo 2: Processos básicos
Para cada processo no fluxo, registre:
- **Tempo de ciclo** (C/T) — quanto tempo leva para processar uma peça
- **Tempo de troca** (C/O) — quanto tempo para mudar de um produto para outro
- **Disponibilidade** — percentual do tempo que a máquina está funcionando
- **Estoque entre processos** — quanto material espera entre cada etapa

### Passo 3: Fluxo de informação
Como cada processo sabe o que produzir? Há programação centralizada (MRP)? Kanban? Supervisores gritando instruções? O fluxo de informação frequentemente **é** o problema.

## Projetando o Estado Futuro

Com o mapa atual em mãos, aplique **sete perguntas-guia**:

1. Qual é o takt time?
2. Você vai produzir para um supermercado ou diretamente para expedição?
3. Onde você pode introduzir fluxo contínuo?
4. Onde vai precisar de supermercados puxados?
5. Qual é o processo pacemaker (que define o ritmo)?
6. Como vai nivelar o mix de produção no pacemaker?
7. Qual incremento de trabalho vai liberar consistentemente?

### O resultado

O mapa do estado futuro não é um sonho — é um **plano de implementação concreto**. Cada melhoria projetada tem responsável, prazo e métricas de verificação. O livro enfatiza: um bom VSM é inútil sem um plano de ação.`,
      },
    ],
    summaryChapters: [
      {
        id: "6-s1",
        title: "Resumo Executivo",
        content: `**Learning to See** e o guia pratico definitivo para o Mapeamento do Fluxo de Valor (VSM), a ferramenta mais poderosa do Lean.

## O Que e VSM

Mapear o **fluxo completo** de materiais e informações, do pedido a entrega, para enxergar onde o valor e criado — e onde e desperdicado.

## A Revelacao

Na empresa tipica, o produto passa **99,99% do tempo esperando** e apenas 0,01% sendo transformado. O caso Acme Stamping: 188 segundos de processamento vs. 23,6 dias de lead time.

## O Processo

1. **Mapa do Estado Atual** — caminhar pessoalmente pelo fluxo, medir tempos, contar estoques
2. **Sete perguntas-guia** — incluindo takt time, onde introduzir fluxo continuo, onde usar puxada
3. **Mapa do Estado Futuro** — projetar o fluxo ideal eliminando desperdicios
4. **Plano de Implementacao** — responsaveis, prazos e metricas

## Regras de Ouro

- Sempre va ao gemba pessoalmente (nao confie apenas em dados de sistemas)
- Comece pelo cliente e volte ate a materia-prima
- Use lapis e papel — nao software
- Uma pessoa mapeia o fluxo inteiro

## Conclusao

Um bom VSM nao e um exercicio academico — e um **plano de acao concreto**. Cada melhoria projetada tem responsavel, prazo e verificacao.`,
      },
    ],
  },
  {
    id: "7",
    title: "Toyota Kata",
    author: "Mike Rother",
    category: "Lean",
    description:
      "Revela as rotinas de gestao (kata) que sustentam a cultura de melhoria continua da Toyota. Apresenta o Kata de Melhoria e o Kata de Coaching como praticas diarias.",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780071635233-L.jpg",
    coverColor: "from-cerrado-600 to-cerrado-400",
    rating: 5,
    year: 2009,
    pages: 306,
    tags: ["Kata", "Coaching", "Melhoria Continua"],
    synopsis:
      "Toyota Kata representa uma mudança de paradigma na compreensão do sucesso da Toyota. Mike Rother descobriu que o verdadeiro segredo não está nas ferramentas Lean, mas nas rotinas invisíveis de pensamento e comportamento — os 'kata' — que são praticados diariamente por todos na organização. O livro apresenta dois kata fundamentais: o Kata de Melhoria (um padrão científico de quatro passos para navegar em direção a condições-alvo) e o Kata de Coaching (o padrão pelo qual líderes desenvolvem as habilidades de resolução de problemas em suas equipes). Juntos, eles criam uma organização que aprende e se adapta continuamente.",
    authorBio:
      "Mike Rother é engenheiro industrial, pesquisador e autor baseado na Universidade de Michigan. Passou mais de duas décadas estudando as práticas de gestão da Toyota, resultando em insights únicos sobre os padrões comportamentais que sustentam a melhoria contínua. É também coautor de 'Learning to See' e palestrante internacional sobre Lean e Kata.",
    chapters: [
      {
        id: "7-1",
        title: "Além das Ferramentas",
        content: `Durante duas décadas, o mundo tentou copiar a Toyota replicando suas **ferramentas**: kanban, andon, 5S, células de produção. E durante duas décadas, a maioria falhou. Mike Rother queria entender por quê.

## A pergunta errada

A maioria dos estudos sobre a Toyota perguntava: **"O que a Toyota faz?"** Rother decidiu perguntar algo diferente: **"Como as pessoas na Toyota pensam e agem no dia a dia?"**

Essa mudança de perspectiva revelou algo invisível: por trás de todas as ferramentas e práticas visíveis, existiam **rotinas de pensamento e comportamento** — padrões tão enraizados que os próprios funcionários da Toyota não conseguiam articulá-los conscientemente.

Rother chamou essas rotinas de **kata** — um termo emprestado das artes marciais que significa "padrão de prática".

> "As ferramentas Lean são o resultado visível de um modo de pensar invisível. Copiar as ferramentas sem o modo de pensar é como copiar a receita de um chef sem entender os princípios da culinária."

## O que realmente diferencia a Toyota

A diferença fundamental não está em **o que** a Toyota faz, mas em **como** as pessoas abordam o trabalho diariamente:

### Na maioria das empresas:
- Gestores definem metas e cobram resultados
- Problemas são vistos como falhas
- Soluções são implementadas de uma vez
- "Melhoria" acontece em projetos especiais

### Na Toyota:
- Gestores guiam o processo de descoberta
- Problemas são vistos como oportunidades de aprendizado
- Soluções emergem de experimentação iterativa
- Melhoria é o trabalho normal de todos, todos os dias

## Os dois kata

Rother identificou dois padrões fundamentais que sustentam tudo:

1. **Kata de Melhoria** — o padrão pelo qual indivíduos e equipes navegam em direção a condições-alvo, através de experimentação científica
2. **Kata de Coaching** — o padrão pelo qual gestores desenvolvem a capacidade de melhoria em suas equipes

Esses dois kata trabalham juntos: o Kata de Melhoria é o "o quê" e o Kata de Coaching é o "como" ele é ensinado e sustentado.`,
      },
      {
        id: "7-2",
        title: "O Kata de Melhoria",
        content: `O Kata de Melhoria é um padrão de **quatro passos** que qualquer pessoa pode seguir para navegar sistematicamente em direção a uma condição-alvo. É o coração do sistema Toyota.

## Os quatro passos

### 1. Entenda a Direção
Comece com uma **visão de longo prazo** ou desafio. Na Toyota, cada área tem uma direção clara derivada da estratégia da empresa. Isso dá propósito e contexto para a melhoria diária.

### 2. Compreenda a Condição Atual
Antes de melhorar qualquer coisa, você precisa entender profundamente **como as coisas funcionam agora**. Não por dados de relatórios — por observação direta, medição e análise no gemba.

> "Se você não sabe onde está, não pode saber como chegar onde quer ir."

### 3. Estabeleça a Próxima Condição-Alvo
Defina uma condição-alvo específica e mensurável que represente o **próximo passo** em direção à visão. A condição-alvo deve ser:

- Desafiadora (fora da zona de conforto)
- Alcançável (não tão distante que paralise)
- Com prazo definido (tipicamente 1-4 semanas)
- Descritiva de um **padrão de operação**, não apenas um número

### 4. Experimente em Direção à Condição-Alvo
Aqui está a parte crucial: você **não sabe como** chegar à condição-alvo. O caminho é descoberto através de **experimentação rápida** — ciclos PDCA (Plan-Do-Check-Act):

1. **Plan**: "O que esperamos que aconteça se fizermos X?"
2. **Do**: Execute o experimento (pequeno e rápido)
3. **Check**: "O que realmente aconteceu?"
4. **Act**: "O que aprendemos? Qual é o próximo experimento?"

## A zona cinzenta

O espaço entre a condição atual e a condição-alvo é o que Rother chama de **zona cinzenta** — território desconhecido onde obstáculos imprevisíveis surgem. É exatamente nessa zona que o aprendizado acontece.

A maioria das organizações tenta **evitar** a zona cinzenta planejando tudo antecipadamente. A Toyota **abraça** a zona cinzenta como o local onde a verdadeira melhoria acontece.

## Na prática

Um ciclo típico do Kata de Melhoria pode ser:

- **Segunda**: "Nosso takt time é 60s, mas estamos em 75s. Condição-alvo: 65s em duas semanas."
- **Terça**: "Observei que o operador espera 8s pela peça. Experimento: mover o container 30cm mais perto."
- **Quarta**: "Resultado: espera caiu para 3s. Tempo de ciclo agora é 70s. Próximo obstáculo: a ferramenta demora 12s para trocar."
- E assim por diante, **todos os dias**.`,
      },
      {
        id: "7-3",
        title: "O Kata de Coaching",
        content: `O Kata de Coaching é o mecanismo pelo qual gestores **desenvolvem a capacidade** de melhoria em suas equipes. Sem ele, o Kata de Melhoria não se sustenta.

## As cinco perguntas do coaching

O coach (tipicamente o gestor direto) conduz uma conversa estruturada com o aprendiz, usando cinco perguntas:

1. **"Qual é a condição-alvo?"** — Garante que o aprendiz tem clareza sobre para onde está indo
2. **"Qual é a condição atual?"** — Verifica se o aprendiz entende a realidade baseado em fatos
3. **"Quais obstáculos estão impedindo?"** — Foca a atenção nos problemas reais
4. **"Qual é o seu próximo experimento?"** — Verifica o pensamento científico
5. **"Quando podemos ver o resultado?"** — Mantém o ritmo de aprendizado

### O poder da rotina

Essas cinco perguntas são feitas **diariamente**, no gemba, em conversas de 10-15 minutos. Não é uma reunião formal — é um **ritual de aprendizado**.

> "O papel do gestor não é resolver problemas, mas desenvolver pessoas que resolvam problemas."

## O que o coach NÃO faz

- **Não dá respostas** — mesmo quando sabe a solução
- **Não pune erros** — experimentos que "falham" são aprendizado
- **Não pula etapas** — cada pergunta tem um propósito
- **Não aceita suposições** — "vá ver" é a resposta para qualquer afirmação sem evidência

## A cadeia de coaching

Na Toyota, todos praticam coaching:

- O **supervisor** faz coaching com o operador
- O **gerente** faz coaching com o supervisor
- O **diretor** faz coaching com o gerente
- E assim por diante, até o topo

Cada nível prática o mesmo padrão, criando uma **cadeia ininterrupta de desenvolvimento**.

## Por que isso é revolucionário

A maioria dos sistemas de gestão trata melhoria como algo **separado** do trabalho normal — projetos Six Sigma, kaizen events, task forces. O Kata de Coaching integra melhoria ao **trabalho diário** de cada gestor.

O resultado: em vez de depender de especialistas ou consultores, a organização desenvolve **capacidade distribuída de melhoria**. Cada pessoa, em cada nível, está aprendendo a melhorar o trabalho — todos os dias.`,
      },
    ],
    summaryChapters: [
      {
        id: "7-s1",
        title: "Resumo Executivo",
        content: `**Toyota Kata** de Mike Rother revela que o verdadeiro segredo da Toyota nao são as ferramentas Lean, mas as **rotinas invisiveis de pensamento** praticadas diariamente.

## A Descoberta

Duas decadas tentando copiar ferramentas Toyota (kanban, 5S, celulas) falharam porque copiavam o **resultado visivel** sem o **modo de pensar invisivel** que o gerava.

## Os Dois Kata

### Kata de Melhoria (4 passos)
1. **Entenda a direcao** — visão de longo prazo
2. **Compreenda a condicao atual** — observação direta no gemba
3. **Estabeleca a proxima condicao-alvo** — desafiadora mas alcancavel, com prazo
4. **Experimente** — ciclos PDCA rapidos, aprendendo na "zona cinzenta"

### Kata de Coaching (5 perguntas diarias)
1. Qual e a condicao-alvo?
2. Qual e a condicao atual?
3. Quais obstaculos estao impedindo?
4. Qual e o proximo experimento?
5. Quando podemos ver o resultado?

## A Diferenca Fundamental

| Empresas convencionais | Toyota |
|----------------------|--------|
| Gestores cobram resultados | Gestores guiam descoberta |
| Problemas são falhas | Problemas são aprendizado |
| Melhoria em projetos especiais | Melhoria e o trabalho diario |

## Conclusao

O Kata transforma melhoria de algo que "especialistas fazem em projetos" para algo que **todos fazem, todos os dias**. E isso que cria uma organizacao que aprende continuamente.`,
      },
    ],
  },
  {
    id: "8",
    title: "Good to Great",
    author: "Jim Collins",
    category: "Excelencia",
    description:
      "Pesquisa de 5 anos que identificou o que diferencia empresas boas de empresas excelentes. Conceitos como o Ourico, Lideranca Nivel 5 e o Volante se tornaram referencias em gestao.",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780066620992-L.jpg",
    coverColor: "from-accent-gold-dark to-semantic-warning",
    rating: 5,
    year: 2001,
    pages: 300,
    tags: ["Collins", "Lideranca", "Estrategia"],
    synopsis:
      "Good to Great apresenta os resultados de uma pesquisa rigorosa de cinco anos que analisou 1.435 empresas para identificar apenas 11 que fizeram a transição de resultados bons para resultados excepcionais — e sustentaram essa excelência por pelo menos 15 anos. Jim Collins e sua equipe descobriram padrões surpreendentes: Liderança Nível 5 (líderes humildes mas determinados), o Conceito do Ouriço (foco disciplinado na interseção de paixão, competência e motor econômico), Cultura de Disciplina, e o efeito Volante (momentum cumulativo). O livro desafia convenções mostrando que grandeza não é função de circunstância, mas de escolha consciente e disciplina.",
    authorBio:
      "Jim Collins é pesquisador, autor e palestrante especializado em gestão empresarial e sustentabilidade de grandes empresas. Formado em Stanford, onde também lecionou, Collins opera um laboratório de pesquisa em gestão em Boulder, Colorado. Seus livros, incluindo 'Built to Last' e 'Great by Choice', venderam mais de 10 milhões de cópias e são referência em escolas de negócio globalmente.",
    chapters: [
      {
        id: "8-1",
        title: "Lideranca Nivel 5",
        content: `A descoberta mais surpreendente da pesquisa Good to Great foi sobre liderança. As empresas que fizeram a transição de boas para excelentes não eram lideradas por celebridades carismáticas — eram lideradas por pessoas que Collins classificou como **Líderes Nível 5**.

## A hierarquia de liderança

Collins identificou cinco níveis de liderança:

1. **Nível 1**: Indivíduo capaz — contribui com talento e conhecimento
2. **Nível 2**: Membro de equipe — contribui para objetivos do grupo
3. **Nível 3**: Gerente competente — organiza pessoas e recursos
4. **Nível 4**: Líder eficaz — catalisa comprometimento com visão clara
5. **Nível 5**: Executivo de Nível 5 — combina humildade pessoal com vontade profissional

## O paradoxo do Nível 5

Líderes Nível 5 são um **paradoxo**: são simultaneamente humildes e ferozmente determinados. São modestos pessoalmente mas implacáveis quando se trata dos resultados da empresa.

> "Os líderes Nível 5 canalizam suas necessidades de ego para longe de si mesmos e em direção ao objetivo maior de construir uma grande empresa. Não é que não tenham ego — é que seu ego é direcionado para a instituição, não para si mesmos."

### Características dos Líderes Nível 5:

- **Creditam o sucesso** a fatores externos e outras pessoas
- **Assumem responsabilidade** pessoal por resultados ruins
- **Nunca se autopromovem** — são frequentemente descritos como "quietos" e "reservados"
- **São fanaticamente dedicados** a produzir resultados sustentáveis
- **Preparam sucessores** para serem ainda mais bem-sucedidos

### O contraste com líderes Nível 4

As empresas de comparação (que não fizeram a transição) frequentemente tinham líderes carismáticos e famosos — Nível 4 "de alto perfil". Esses líderes produziam resultados impressionantes no curto prazo, mas os resultados não se sustentavam após sua saída.

## O caso de Darwin Smith (Kimberly-Clark)

Darwin Smith liderou a Kimberly-Clark por 20 anos, transformando-a de uma empresa medíocre de papel em a líder mundial de produtos de consumo (Kleenex, Huggies). Sob sua liderança, as ações da empresa superaram o mercado em 4,1 vezes.

Quando perguntado sobre seu estilo de gestão, Smith respondeu: **"Eu nunca parei de tentar me qualificar para o trabalho."**

Smith vendeu as fábricas de papel — o negócio histórico da empresa — para investir em produtos de consumo. Foi uma decisão que a mídia chamou de estúpida. Vinte anos depois, a Kimberly-Clark era dona de Scott Paper e superava a Procter & Gamble em seis das oito categorias de produtos.

A lição: **grandeza não requer grandiosidade pessoal**. Na verdade, a busca por grandiosidade pessoal frequentemente impede a grandeza organizacional.`,
      },
      {
        id: "8-2",
        title: "O Conceito do Ourico",
        content: `O Conceito do Ouriço é talvez a ideia mais influente de Good to Great. É baseado em uma fábula grega: **"A raposa sabe muitas coisas, mas o ouriço sabe uma grande coisa."**

## As três perguntas

O Conceito do Ouriço é a interseção de três perguntas fundamentais:

### 1. No que você pode ser o melhor do mundo?
Não no que você **quer** ser o melhor, ou no que seu negócio **atual** é — mas no que você **pode** genuinamente ser o melhor do mundo. Igualmente importante: **no que você NÃO pode ser o melhor** — e ter a disciplina de abandonar.

### 2. O que impulsiona seu motor econômico?
Cada empresa good-to-great descobriu um **denominador econômico único** — uma métrica por X (lucro por empregado, lucro por região, lucro por cliente) que melhor capturava sua lógica econômica.

### 3. Pelo que você é profundamente apaixonado?
As empresas good-to-great não **escolhiam** ser apaixonadas por algo — elas descobriam o que genuinamente as **apaixonava** e então focavam nisso.

> "O Conceito do Ouriço não é uma meta, estratégia ou intenção de ser o melhor. É um entendimento de no que você PODE ser o melhor."

## Disciplina dentro dos três círculos

O poder do Conceito do Ouriço vem não apenas de encontrar a interseção, mas de **manter disciplina** para operar apenas dentro dela:

- **Dizer não** a oportunidades fora dos três círculos — por mais atraentes que pareçam
- **Investir consistentemente** em fortalecer a interseção
- **Parar de fazer** tudo que cai fora da interseção

### O caso da Walgreens

A Walgreens descobriu seu Conceito do Ouriço: ser a melhor **farmácia de conveniência** da América, medida por **lucro por visita de cliente**. Isso significou:

- Recusar diversificação em outros negócios (mesmo lucrativos)
- Investir massivamente em localizações de esquina de alto tráfego
- Desenvolver sistemas que maximizassem o valor de cada visita

O resultado: de 1975 a 2000, as ações da Walgreens superaram as da GE — o conglomerado mais admirado do mundo na época — por mais de **15 vezes**.

## O processo de descoberta

O Conceito do Ouriço não é decidido em um retiro estratégico. É **descoberto** ao longo de meses ou anos de debate honesto, tentativa e aprendizado. As empresas good-to-great levaram em média **quatro anos** para cristalizar seu Conceito do Ouriço.`,
      },
      {
        id: "8-3",
        title: "O Efeito Volante",
        content: `O Efeito Volante é a metáfora que Collins usa para descrever como as transformações good-to-great realmente acontecem — não com um momento dramático de ruptura, mas com **acúmulo persistente de momentum**.

## A imagem do volante

Imagine um volante maciço — um disco de metal enorme, pesando toneladas. Sua tarefa é fazê-lo girar o mais rápido possível.

Você empurra. Nada acontece. Empurra de novo. O volante se move quase imperceptivelmente. Continua empurrando, consistentemente, na mesma direção. Aos poucos, o volante ganha velocidade. Um giro completo. Dois. Cinco. O momentum cresce.

Em algum momento, o volante está girando com força própria. As pessoas olham e dizem: **"Uau, quando aconteceu a virada?"** Mas não houve um momento único — foi o efeito cumulativo de milhares de empurrões consistentes.

> "Não há um momento mágico que define a transformação. É um processo cumulativo — passo a passo, ação sobre ação, decisão sobre decisão — que produz resultados grandiosos."

## O anti-padrão: o Doom Loop

As empresas de comparação seguiam um padrão oposto — o **Doom Loop** (Ciclo da Destruição):

1. Nova direção com grande fanfarra
2. Resultados decepcionantes
3. Reação: mudar de direção
4. Nova direção com grande fanfarra
5. Repetir indefinidamente

Enquanto as empresas good-to-great mantinham direção consistente por décadas, as empresas de comparação **mudavam de estratégia a cada poucos anos**, nunca construindo momentum real.

## Construindo o volante

### O que "empurrar na mesma direção" significa:

- Cada decisão reforça as anteriores
- Cada contratação fortalece o Conceito do Ouriço
- Cada investimento aprofunda a competência central
- Cada sucesso gera confiança para o próximo passo

### O papel da comunicação

Collins descobriu algo contra-intuitivo: as empresas good-to-great **não gastavam energia vendendo a visão**. Quando o volante estava girando e as pessoas podiam ver resultados tangíveis, o comprometimento vinha naturalmente.

O volante em si é o melhor comunicador. Resultados tangíveis + consistência > discursos inspiradores.

## A lição prática

Não procure o "grande momento de transformação". Em vez disso:

1. Encontre seu Conceito do Ouriço
2. Comece a empurrar o volante — decisões consistentes, dia após dia
3. Celebre o progresso incremental
4. Mantenha disciplina quando a pressão para mudar aparecer
5. Confie no processo cumulativo`,
      },
    ],
    summaryChapters: [
      {
        id: "8-s1",
        title: "Resumo Executivo",
        content: `**Good to Great** de Jim Collins identifica os padroes que diferenciam empresas boas de empresas excelentes, baseado em pesquisa rigorosa com 1.435 empresas.

## Os Padroes da Excelencia

### Lideranca Nivel 5
Lideres **humildes mas determinados**. Creditam sucesso aos outros, assumem responsabilidade por fracassos. Darwin Smith transformou a Kimberly-Clark silenciosamente, superando o mercado em 4,1x.

### Primeiro Quem, Depois O Que
Colocar as **pessoas certas no onibus** antes de decidir para onde ir. As pessoas certas nao precisam ser motivadas — elas se auto-motivam.

### Confrontar os Fatos Brutais
Manter fe inabalavel no sucesso final **enquanto confronta a realidade** mais dura do momento presente (Paradoxo de Stockdale).

### Conceito do Ourico
A intersecao de tres circulos:
1. No que você **pode ser o melhor** do mundo?
2. O que impulsiona seu **motor economico**?
3. Pelo que você e **profundamente apaixonado**?

A Walgreens focou nessa intersecao e superou a GE em 15x.

### Cultura de Disciplina
Pessoas disciplinadas + pensamento disciplinado + acao disciplinada. Nao burocracia — **disciplina interna**.

### Efeito Volante
Nao ha momento magico. Grandeza vem do **acumulo persistente** de decisoes consistentes, dia apos dia, na mesma direcao.

## O Anti-Padrao: Doom Loop
Empresas medíocres mudam de estrategia a cada poucos anos, nunca construindo momentum. O oposto do Volante.

## Conclusao

Grandeza nao e funcao de circunstancia — e de **escolha consciente e disciplina**.`,
      },
    ],
  },
  {
    id: "9",
    title: "Out of the Crisis",
    author: "W. Edwards Deming",
    category: "Excelencia",
    description:
      "A obra-prima de Deming que apresenta seus 14 pontos para a gestao e a transformacao da industria ocidental. Fundamental para entender a gestao da qualidade total.",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780262541152-L.jpg",
    coverColor: "from-bg-elevated to-cerrado-800",
    rating: 5,
    year: 1986,
    pages: 507,
    tags: ["Deming", "14 Pontos", "Qualidade Total"],
    synopsis:
      "Out of the Crisis é a obra seminal de W. Edwards Deming, o estatístico americano creditado como um dos arquitetos da recuperação industrial japonesa pós-guerra. O livro apresenta seus famosos 14 Pontos para a Gestão, as Sete Doenças Mortais da administração ocidental, e o Sistema de Conhecimento Profundo. Deming argumenta que a crise da indústria ocidental não é causada por trabalhadores preguiçosos, mas por falhas sistêmicas de gestão. Ele demonstra como a variação estatística, a falta de constância de propósito e a gestão por medo destroem a qualidade e a produtividade, oferecendo um caminho de transformação baseado em cooperação, aprendizado e melhoria contínua.",
    authorBio:
      "W. Edwards Deming (1900-1993) foi um estatístico, professor e consultor americano. Após a Segunda Guerra Mundial, foi convidado pelo Japão para ensinar controle estatístico de qualidade, contribuindo decisivamente para o 'milagre econômico japonês'. O Prêmio Deming, criado em sua homenagem, é a mais alta distinção de qualidade no Japão. Deming é considerado o pai da gestão da qualidade total.",
    chapters: [
      {
        id: "9-1",
        title: "Os 14 Pontos para a Gestao",
        content: `Os 14 Pontos de Deming não são uma lista de dicas — são um **sistema integrado de transformação** da gestão ocidental. Cada ponto desafia uma suposição profundamente enraizada na prática empresarial convencional.

## Os 14 Pontos

### 1. Crie constância de propósito
Dedique-se à melhoria contínua de produtos e serviços com o objetivo de se tornar competitivo, permanecer no negócio e gerar empregos.

### 2. Adote a nova filosofia
Estamos em uma nova era econômica. A gestão ocidental deve acordar para o desafio, aprender suas responsabilidades e assumir a liderança da mudança.

### 3. Cesse a dependência da inspeção em massa
Elimine a necessidade de inspeção como meio de alcançar qualidade. Construa qualidade no produto desde o início.

### 4. Acabe com a prática de premiar negócios com base no preço
Em vez disso, minimize o custo total. Caminhe em direção a um fornecedor único para cada item, com base em um relacionamento de longo prazo de lealdade e confiança.

### 5. Melhore constantemente o sistema de produção e serviço
Isso melhora qualidade e produtividade e assim diminui constantemente os custos.

### 6. Institua treinamento no trabalho
Treinamento deve ser reconstruído completamente.

### 7. Institua liderança
O objetivo da supervisão deve ser ajudar pessoas, máquinas e dispositivos a fazer um trabalho melhor.

### 8. Elimine o medo
Para que todos possam trabalhar efetivamente para a empresa.

### 9. Quebre barreiras entre departamentos
Pessoas de pesquisa, design, vendas e produção devem trabalhar em equipe.

### 10. Elimine slogans e exortações
Eles criam relações adversariais. A maioria das causas de baixa qualidade pertencem ao sistema.

### 11. Elimine cotas numéricas e gestão por objetivos
Substitua por liderança.

### 12. Remova barreiras ao orgulho do trabalho
O sistema de avaliação anual de mérito deve ser eliminado.

### 13. Institua um programa vigoroso de educação
Auto-melhoria para todos.

### 14. Coloque todos para trabalhar na transformação
A transformação é trabalho de todos.

> "Não é suficiente que você faça o seu melhor. Primeiro você precisa saber O QUE fazer, e então fazer o seu melhor."`,
      },
      {
        id: "9-2",
        title: "As Doencas Mortais e o Conhecimento Profundo",
        content: `Além dos 14 Pontos, Deming identificou **Sete Doenças Mortais** da gestão ocidental e propôs o **Sistema de Conhecimento Profundo** como antídoto.

## As Sete Doenças Mortais

### 1. Falta de constância de propósito
Empresas que pulam de estratégia em estratégia, nunca construindo competência profunda em nada.

### 2. Ênfase em lucros de curto prazo
A obsessão com resultados trimestrais sacrifica investimentos em qualidade, inovação e pessoas.

### 3. Avaliação de desempenho e classificação por mérito
Deming argumentou que **90% dos problemas são do sistema**, não das pessoas. Avaliar indivíduos pelo desempenho de um sistema que eles não controlam é injusto e destrutivo.

> "Avaliação de desempenho nutre pensamento de curto prazo, destrói trabalho em equipe, alimenta rivalidade e medo, e deixa as pessoas amargas."

### 4. Mobilidade da administração
Gestores que mudam de empresa a cada poucos anos nunca desenvolvem conhecimento profundo dos processos que gerenciam.

### 5. Administração baseada apenas em números visíveis
Os dados mais importantes — satisfação do cliente, moral dos funcionários, valor da marca — são frequentemente invisíveis nos relatórios financeiros.

### 6. Custos médicos excessivos
(Específico ao contexto americano dos anos 80)

### 7. Custos de litígio excessivos
(Específico ao contexto americano dos anos 80)

## O Sistema de Conhecimento Profundo

Deming propôs que a transformação requer quatro areas de conhecimento:

### 1. Apreciação de um sistema
Uma organização é um **sistema**, não um conjunto de departamentos independentes. Otimizar partes isoladamente frequentemente sub-otimiza o todo.

### 2. Conhecimento sobre variação
Todo processo tem variação. A chave é distinguir entre:
- **Variação de causa comum** — inerente ao sistema (requer mudança sistêmica)
- **Variação de causa especial** — eventos pontuais (requer investigação específica)

Tratar causas comuns como especiais (ou vice-versa) piora o sistema.

### 3. Teoria do conhecimento
Sem teoria, experiência não ensina nada. Gestores devem entender como o conhecimento é construído e testado.

### 4. Psicologia
Entender pessoas — motivação intrínseca vs. extrínseca, diferenças individuais, interação entre pessoas e o sistema em que trabalham.

### A mensagem central

A crise da indústria ocidental não é causada por trabalhadores preguiçosos, concorrência desleal ou falta de tecnologia. É causada por **falhas sistêmicas de gestão** que só podem ser corrigidas por uma transformação fundamental na forma como pensamos sobre organizações, pessoas e trabalho.`,
      },
    ],
    summaryChapters: [
      {
        id: "9-s1",
        title: "Resumo Executivo",
        content: `**Out of the Crisis** de W. Edwards Deming apresenta uma transformacao radical da gestao ocidental atraves dos 14 Pontos, das Sete Doencas Mortais e do Sistema de Conhecimento Profundo.

## Os 14 Pontos (Essencia)

1. **Constancia de proposito** — compromisso de longo prazo com melhoria
2. **Nova filosofia** — aceitar a responsabilidade da mudanca
3. **Fim da inspecao em massa** — qualidade no processo, nao no final
4. **Fim do preco como criterio** — parcerias de longo prazo
5. **Melhoria continua** do sistema de producao e servico
6. **Treinamento** reconstruido completamente
7. **Lideranca** que ajuda, nao que controla
8. **Eliminar o medo** para liberar potencial
9. **Quebrar barreiras** entre departamentos
10. **Eliminar slogans** — resolver o sistema, nao pressionar pessoas
11. **Eliminar cotas numericas** — substituir por lideranca
12. **Remover barreiras** ao orgulho do trabalho
13. **Educacao vigorosa** e auto-melhoria
14. **Todos na transformacao** — e trabalho de todos

## As Doencas Mortais

- Falta de constancia de proposito
- Enfase em lucros de curto prazo
- Avaliacao de desempenho por merito (90% dos problemas são do sistema)
- Mobilidade da administracao

## Conhecimento Profundo

Quatro areas: apreciacao de **sistemas**, conhecimento sobre **variacao**, **teoria do conhecimento** e **psicologia**.

## A Mensagem Central

> "Nao e suficiente fazer o seu melhor. Primeiro você precisa saber O QUE fazer."

A crise nao e causada por trabalhadores — e por **falhas sistemicas de gestao**.`,
      },
    ],
  },
  {
    id: "10",
    title: "The Fifth Discipline",
    author: "Peter Senge",
    category: "Excelencia",
    description:
      "Introduz o conceito de organizacao que aprende e as cinco disciplinas: domínio pessoal, modelos mentais, visão compartilhada, aprendizagem em equipe e pensamento sistemico.",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9780385517256-L.jpg",
    coverColor: "from-varzea to-varzea-light",
    rating: 4,
    year: 1990,
    pages: 445,
    tags: ["Organizacao que Aprende", "Pensamento Sistemico", "5 Disciplinas"],
    synopsis:
      "The Fifth Discipline introduz o conceito revolucionário de 'organização que aprende' — organizações onde as pessoas expandem continuamente sua capacidade de criar os resultados que realmente desejam. Peter Senge apresenta cinco disciplinas essenciais: Domínio Pessoal (crescimento individual contínuo), Modelos Mentais (examinar e desafiar suposições profundas), Visão Compartilhada (construir comprometimento genuíno com objetivos comuns), Aprendizagem em Equipe (pensar juntos de forma mais inteligente) e Pensamento Sistêmico — a quinta disciplina que integra todas as outras. O livro demonstra que a maioria dos problemas organizacionais são causados por padrões sistêmicos, não por eventos isolados.",
    authorBio:
      "Peter Senge é diretor do Centro para Aprendizagem Organizacional do MIT Sloan School of Management e fundador da Society for Organizational Learning (SoL). É reconhecido como um dos pensadores de gestão mais influentes do mundo, tendo sido nomeado pela Harvard Business Review como um dos mais importantes estrategistas de gestão da última década.",
    chapters: [
      {
        id: "10-1",
        title: "Pensamento Sistemico",
        content: `O Pensamento Sistêmico é a **quinta disciplina** — aquela que integra todas as outras. Sem ele, as outras quatro disciplinas são ferramentas isoladas. Com ele, formam um conjunto coerente de prática e teoria.

## Por que pensamento linear falha

A maioria de nós foi educada para pensar de forma **linear**: A causa B, B causa C. Mas os sistemas reais são **circulares**: A causa B, B causa C, C causa A. Essa circularidade cria comportamentos que são impossíveis de entender com pensamento linear.

### O exemplo da cerveja

Senge apresenta o famoso "Beer Game" — um jogo de simulação onde participantes gerenciam uma cadeia de suprimentos de cerveja. Sem exceção, os jogadores produzem oscilações enormes de estoque e pedidos, mesmo quando a demanda do consumidor é quase estável.

> "A estrutura do sistema causa o comportamento. Pessoas diferentes na mesma estrutura produzem resultados qualitativamente semelhantes."

### As lições do Beer Game:
1. **A estrutura influencia comportamento** — não culpe as pessoas, mude a estrutura
2. **A estrutura dos sistemas humanos é sutil** — não vemos as conexões
3. **Ações de alto alavancagem** frequentemente não são óbvias

## Arquétipos sistêmicos

Senge identificou padrões recorrentes — **arquétipos** — que aparecem repetidamente em organizações:

### Limites ao Crescimento
Um esforço que produz crescimento encontra um limite. Mais esforço não ajuda — o limite precisa ser removido.

*Exemplo*: Uma startup cresce rapidamente, mas a cultura de startup não escala. Mais contratações rápidas pioram a cultura, que freia o crescimento.

### Transferência de Responsabilidade
Um sintoma é tratado com uma solução paliativa que funciona no curto prazo mas enfraquece a capacidade de resolver o problema real.

*Exemplo*: Bugs são corrigidos com patches rápidos em vez de refatoração, criando dívida técnica crescente que gera mais bugs.

### Tragédia dos Comuns
Indivíduos usam um recurso compartilhado baseados em necessidade individual, esgotando o recurso para todos.

## A arte de ver o todo

O pensamento sistêmico não é um modelo matemático — é uma **disciplina de ver**:

- Ver **inter-relações** em vez de cadeias causais lineares
- Ver **processos de mudança** em vez de snapshots
- Ver **padrões de estrutura** que geram eventos específicos

Quando uma organização domina o pensamento sistêmico, ela para de reagir a eventos e começa a **projetar estruturas** que produzem os resultados desejados.`,
      },
      {
        id: "10-2",
        title: "As Cinco Disciplinas",
        content: `As cinco disciplinas de uma organização que aprende não são cinco ferramentas independentes — são cinco **práticas** que se reforçam mutuamente para criar uma organização fundamentalmente diferente.

## 1. Domínio Pessoal

Domínio pessoal é a disciplina de **esclarecer continuamente** o que é importante para nós e de **ver a realidade** com mais clareza.

- Não é sobre dominar pessoas ou coisas
- É sobre aprender a gerar e sustentar **tensão criativa** — a lacuna entre visão e realidade
- Organizações aprendem apenas através de **indivíduos que aprendem**

> "Pessoas com alto domínio pessoal vivem em modo de aprendizado contínuo. Elas nunca 'chegam'. A jornada É a recompensa."

## 2. Modelos Mentais

Modelos mentais são **suposições profundas** que influenciam como entendemos o mundo e como agimos. Frequentemente são inconscientes.

A disciplina de modelos mentais envolve:
- **Trazer suposições à superfície** — tornar o implícito explícito
- **Examinar rigorosamente** — testar contra evidências
- **Estar disposto a mudar** — quando as evidências contradizem

O maior obstáculo ao aprendizado organizacional não é falta de informação — é a rigidez de modelos mentais que filtram informação inconvenientemente.

## 3. Visão Compartilhada

Uma visão compartilhada genuína é uma **imagem do futuro** que gera comprometimento real (não apenas compliance).

Características de visão compartilhada genuína:
- Emerge de visões pessoais, não é imposta de cima
- Gera **energia e coragem** para correr riscos
- Transforma a relação das pessoas com a organização — de "a empresa deles" para "a nossa empresa"

### Compliance vs. Comprometimento
A maioria das organizações confunde compliance com comprometimento. Compliance é "eu faço o que me pedem". Comprometimento é "eu faço porque acredito profundamente".

## 4. Aprendizagem em Equipe

Aprendizagem em equipe é o processo de **alinhar e desenvolver a capacidade** de uma equipe para criar resultados que seus membros realmente desejam.

A ferramenta central é o **diálogo** (no sentido grego: *dia* = através, *logos* = significado):
- Suspender suposições
- Pensar juntos
- Explorar questões complexas de múltiplas perspectivas

> "O QI de uma equipe pode ser muito maior que o QI de seus membros — mas frequentemente é muito menor."

## 5. Pensamento Sistêmico (A Quinta Disciplina)

O pensamento sistêmico integra as outras quatro porque:

- **Sem pensamento sistêmico**, visão compartilhada cria bonitas imagens do futuro sem entender as forças que impedem o progresso
- **Sem pensamento sistêmico**, modelos mentais permanecem como exercícios acadêmicos
- **Sem pensamento sistêmico**, aprendizagem em equipe é limitada a resolver problemas superficiais

Juntas, as cinco disciplinas criam uma organização que **aprende mais rápido que seus concorrentes** — a única vantagem competitiva sustentável no longo prazo.`,
      },
    ],
    summaryChapters: [
      {
        id: "10-s1",
        title: "Resumo Executivo",
        content: `**The Fifth Discipline** de Peter Senge introduz o conceito de "organizacao que aprende" e as cinco disciplinas que a sustentam.

## As Cinco Disciplinas

### 1. Dominio Pessoal
Esclarecer continuamente o que importa e ver a realidade com clareza. Organizacoes aprendem apenas atraves de **individuos que aprendem**.

### 2. Modelos Mentais
Examinar e desafiar **suposicoes profundas** que influenciam decisoes. O maior obstaculo ao aprendizado nao e falta de informacao — e rigidez mental.

### 3. Visão Compartilhada
Construir comprometimento genuino (nao compliance) com objetivos comuns. Emerge de visoes pessoais, nao e imposta de cima.

### 4. Aprendizagem em Equipe
Alinhar a capacidade coletiva atraves do **dialogo** — suspender suposicoes e pensar juntos. O QI de uma equipe pode ser maior ou menor que o de seus membros.

### 5. Pensamento Sistemico (A Quinta Disciplina)
Ver **inter-relacoes** em vez de cadeias causais lineares. Integra todas as outras disciplinas em um todo coerente.

## Arquetipos Sistemicos

- **Limites ao Crescimento** — mais esforco nao ajuda; remova o limite
- **Transferencia de Responsabilidade** — paliativos enfraquecem a capacidade real
- **Tragedia dos Comuns** — uso individual esgota recurso compartilhado

## O Beer Game

Simulacao que demonstra: **a estrutura do sistema causa o comportamento**. Pessoas diferentes na mesma estrutura produzem resultados semelhantes.

## Conclusao

A unica vantagem competitiva sustentavel e a capacidade de **aprender mais rapido** que os concorrentes.`,
      },
    ],
  },
  {
    id: "11",
    title: "Creating a Lean Culture",
    author: "David Mann",
    category: "Lean",
    description:
      "Aborda o lado cultural e gerencial do Lean. Mostra como sustentar a transformacao Lean atraves de lideranca, gestao visual e trabalho padronizado para lideres.",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9781482243239-L.jpg",
    coverColor: "from-cerrado-800 to-accent-gold-dark",
    rating: 4,
    year: 2014,
    pages: 328,
    tags: ["Cultura Lean", "Gestao Visual", "Lideranca"],
    synopsis:
      "Creating a Lean Culture aborda o aspecto mais desafiador e frequentemente negligenciado da transformação Lean: a mudança cultural e o papel da liderança. David Mann argumenta que a maioria das iniciativas Lean falha não por problemas técnicos, mas por falta de um sistema de gestão Lean que sustente as melhorias. O livro apresenta três elementos essenciais: liderança disciplinada com comportamentos diários específicos, gestão visual que torna o desempenho transparente em tempo real, e trabalho padronizado para líderes que garante consistência. Com exemplos práticos e ferramentas aplicáveis, é o guia definitivo para sustentar a transformação Lean.",
    authorBio:
      "David Mann é consultor e autor especializado em gestão Lean e transformação cultural. Com décadas de experiência em implementações Lean em diversos setores, Mann é reconhecido por seu foco pragmático na sustentabilidade das transformações, enfatizando o papel crítico dos líderes e gestores no dia a dia da operação Lean.",
    chapters: [
      {
        id: "11-1",
        title: "O Sistema de Gestao Lean",
        content: `A maioria das transformações Lean falha. Não porque as ferramentas não funcionem, mas porque **não há um sistema de gestão** para sustentar as melhorias. David Mann argumenta que o elo perdido é o **Lean Management System** — o conjunto de práticas diárias que mantém o sistema vivo.

## Por que melhorias não se sustentam

O padrão é previsível:
1. Consultores implementam ferramentas Lean (5S, kanban, células)
2. Resultados impressionantes nas primeiras semanas
3. Gradualmente, as práticas voltam ao normal
4. Em 6-12 meses, quase tudo desapareceu

> "Ferramentas Lean sem gestão Lean são como exercício sem dieta. Você vai suar muito e não mudar nada permanentemente."

### A raiz do problema

A gestão convencional é projetada para sustentar a **produção em massa**. Seus reflexos — reuniões semanais, relatórios mensais, gestão por exceção — são incompatíveis com a produção Lean. Se você implementa ferramentas Lean mas mantém a gestão convencional, o sistema de gestão **vai erodir** as melhorias Lean.

## Os três pilares do sistema de gestão Lean

### 1. Comportamento disciplinado de líderes
- Presença diária no gemba (não no escritório)
- Observação direta de processos (não relatórios)
- Coaching de resolução de problemas (não dar ordens)
- Follow-up rigoroso de ações (não "vamos ver depois")

### 2. Gestão visual
- Quadros de acompanhamento **atualizados em tempo real**
- Indicadores visíveis para todos (não escondidos em dashboards)
- Desvios identificáveis **instantaneamente** por qualquer pessoa
- Status de ações de melhoria transparente

### 3. Trabalho padronizado para líderes
- Rotina diária definida para cada nível de liderança
- Horários específicos para gemba walks
- Reuniões de accountability com cadência fixa
- Checklists de verificação documentados

## A mudança de mentalidade

O sistema de gestão Lean requer uma mudança fundamental no papel do líder:

| Gestão Convencional | Gestão Lean |
|---------------------|-------------|
| Gerenciar resultados | Gerenciar processos |
| Resolver problemas | Ensinar a resolver problemas |
| Decidir no escritório | Decidir no gemba |
| Reuniões semanais | Interações diárias |
| Relatórios mensais | Gestão visual em tempo real |

A mensagem é clara: **você não pode ter uma operação Lean com gestão convencional**. O sistema de gestão deve mudar tanto quanto a operação.`,
      },
      {
        id: "11-2",
        title: "Trabalho Padronizado para Lideres",
        content: `Se existe um conceito que mais surpreende gestores no Lean, é o de **trabalho padronizado para líderes**. Operadores têm trabalho padronizado há décadas — mas a ideia de que gestores também precisam de uma rotina estruturada é contra-intuitiva para muitos.

## O que é trabalho padronizado para líderes?

É uma **rotina diária documentada** que define:
- **Onde** o líder deve estar em cada momento
- **O que** deve observar e verificar
- **Com quem** deve interagir
- **Quais perguntas** deve fazer
- **Como** deve registrar e acompanhar desvios

### Exemplo: Supervisor de primeira linha

| Horário | Atividade |
|---------|-----------|
| 6:00-6:15 | Verificar quadro de turnos, revisar desvios da noite |
| 6:15-6:45 | Gemba walk — verificar 5S, WIP, fluxo |
| 6:45-7:00 | Reunião de startup com equipe |
| 7:00-9:00 | Processo de accountability: follow-up de ações |
| 9:00-9:30 | Coaching de resolução de problemas com operadores |
| 9:30-10:00 | Atualizar quadros visuais |
| 10:00-11:00 | Participar de reunião de nível com gerente |

## A cadência em camadas

O trabalho padronizado se organiza em camadas, cada uma com cadência diferente:

### Camada 1: Líder de equipe / Supervisor (cadência: horária/por turno)
- Verifica o fluxo de trabalho a cada hora
- Identifica e escala desvios imediatamente
- Faz coaching direto com operadores

### Camada 2: Gerente de area (cadência: diária)
- Revisa o desempenho do dia anterior
- Faz gemba walk com foco em processos-chave
- Conduz reunião de accountability com supervisores
- Verifica progresso das ações de melhoria

### Camada 3: Diretor / Planta (cadência: semanal)
- Revisa tendências e padrões (não eventos individuais)
- Gemba walk com foco estratégico
- Desbloqueia obstáculos organizacionais
- Alinha prioridades de melhoria

## Por que funciona

### 1. Cria presença
Quando líderes seguem uma rotina no gemba, problemas são detectados **horas** após surgir — não semanas.

### 2. Garante consistência
O sistema Lean funciona porque é **previsível**. Trabalho padronizado para líderes garante que a gestão também seja previsível.

### 3. Liberta tempo
Paradoxalmente, a rotina estruturada **libera** tempo. Em vez de apagar incêndios o dia todo (gestão reativa), o líder investe em prevenção (gestão proativa).

> "Gestores sem trabalho padronizado gastam 80% do tempo reagindo. Com trabalho padronizado, gastam 80% do tempo melhorando."`,
      },
    ],
    summaryChapters: [
      {
        id: "11-s1",
        title: "Resumo Executivo",
        content: `**Creating a Lean Culture** de David Mann revela o **elo perdido** das transformacoes Lean: o sistema de gestao que sustenta as melhorias.

## Por Que Lean Falha

A maioria das iniciativas Lean falha porque implementa **ferramentas Lean com gestao convencional**. Sem um sistema de gestao compativel, as melhorias se erodem em 6-12 meses.

> "Ferramentas Lean sem gestao Lean são como exercicio sem dieta."

## Os Tres Pilares

### 1. Comportamento Disciplinado de Lideres
- Presenca **diaria** no gemba (nao no escritorio)
- Observacao direta (nao relatorios)
- Coaching de resolucao de problemas (nao dar ordens)
- Follow-up rigoroso

### 2. Gestao Visual
- Quadros atualizados **em tempo real**
- Desvios identificaveis instantaneamente por qualquer pessoa
- Transparencia total de desempenho

### 3. Trabalho Padronizado para Lideres
- Rotina diaria definida para cada nivel
- Horarios especificos para gemba walks
- Cadencia em camadas: horaria (supervisor), diaria (gerente), semanal (diretor)

## A Mudanca de Mentalidade

| Convencional | Lean |
|-------------|------|
| Gerenciar resultados | Gerenciar processos |
| Resolver problemas | Ensinar a resolver |
| Reunioes semanais | Interacoes diarias |
| Relatorios mensais | Gestao visual em tempo real |

## Conclusao

Você nao pode ter uma **operacao Lean com gestao convencional**. O sistema de gestao deve mudar tanto quanto a operacao.`,
      },
    ],
  },
  {
    id: "12",
    title: "Gemba Walks",
    author: "Jim Womack",
    category: "Lean",
    description:
      "Coletanea de reflexoes sobre idas ao gemba (local de trabalho). Mostra como lideres devem observar, perguntar e aprender diretamente onde o valor e criado.",
    coverUrl: "https://covers.openlibrary.org/b/isbn/9781934109380-L.jpg",
    coverColor: "from-semantic-success/80 to-varzea-dark",
    rating: 4,
    year: 2013,
    pages: 312,
    tags: ["Gemba", "Lideranca Lean", "Observacao"],
    synopsis:
      "Gemba Walks reúne as reflexões de Jim Womack, um dos fundadores do movimento Lean, sobre suas visitas a 'gembas' (locais de trabalho) ao redor do mundo. Cada capítulo traz observações perspicazes sobre como o valor é criado — e desperdiçado — em organizações reais. Womack demonstra a arte de 'ir ver' (genchi genbutsu): como caminhar pelo gemba com olhos treinados, fazer as perguntas certas, e ajudar as equipes a enxergarem seus próprios processos com clareza. O livro é tanto um guia prático para líderes que querem se conectar com a realidade operacional quanto uma meditação sobre o que significa realmente entender e melhorar o trabalho.",
    authorBio:
      "James P. Womack é fundador e consultor sênior do Lean Enterprise Institute (LEI), a principal organização de pesquisa e educação Lean nos Estados Unidos. Coautor de 'The Machine That Changed the World' e 'Lean Thinking', Womack é amplamente reconhecido como um dos pais do movimento Lean no ocidente.",
    chapters: [
      {
        id: "12-1",
        title: "A Arte de Ir Ver",
        content: `"Ir ver" — ou **genchi genbutsu** em japonês — é talvez o princípio mais simples e mais difícil do pensamento Lean. Simples porque é literalmente ir ao local de trabalho e observar. Difícil porque desafia tudo que a gestão moderna nos ensinou sobre como liderar.

## Por que gestores não vão ao gemba?

A gestão moderna criou uma separação profunda entre **quem decide** e **quem executa**. Gestores:

- Passam 80% do tempo em reuniões e respondendo emails
- Tomam decisões baseadas em relatórios, dashboards e KPIs
- Visitam o "chão de fábrica" apenas em emergências ou com visitantes
- Consideram trabalho operacional como algo "abaixo" de seu nível

> "Os dados mais importantes para um gestor não estão no ERP. Estão no gemba — visíveis para quem se dispõe a ir ver."

## O que significa realmente "ir ver"

Gemba walk não é uma inspeção. Não é uma auditoria. Não é management by walking around. É uma **prática disciplinada de observação e aprendizado**.

### O que observar:

1. **O fluxo de trabalho** — o produto/serviço está fluindo ou está parado?
2. **Os desperdícios** — espera, transporte, movimento, retrabalho, superprodução
3. **O estado de ânimo** — as pessoas estão engajadas ou alienadas?
4. **Os desvios do padrão** — o trabalho real corresponde ao trabalho planejado?
5. **Os obstáculos** — o que impede as pessoas de fazer seu melhor trabalho?

### Como perguntar:

- **"O que deveria estar acontecendo agora?"** (entender o padrão)
- **"O que realmente está acontecendo?"** (entender a realidade)
- **"Por que há diferença?"** (entender a causa)
- **"O que você tentou fazer para resolver?"** (entender a capacidade)
- **"Como posso ajudar?"** (demonstrar respeito e suporte)

### O que NÃO fazer:

- Não critique, não julgue, não dê ordens
- Não vá com uma agenda predefinida para "pegar" alguém
- Não ofereça soluções imediatas (mesmo que sejam óbvias)
- Não delegue a observação a subordinados
- Não confunda "estar presente" com "ir ver" — presença sem intenção é turismo

## A transformação pessoal

Womack observa que a prática regular de gemba walks transforma não apenas a organização, mas o **próprio líder**:

- Desenvolve **humildade** — ver a complexidade do trabalho real
- Cria **empatia** — entender os desafios das pessoas
- Gera **conhecimento profundo** — saber como as coisas realmente funcionam
- Constrói **confiança** — as pessoas veem que o líder se importa

A arte de ir ver é, no fundo, a arte de **aprender a ver o que sempre esteve lá**, mas que nossa formação e nossos preconceitos nos impediam de enxergar.`,
      },
      {
        id: "12-2",
        title: "Proposito, Processo, Pessoas",
        content: `Womack propõe um framework simples para estruturar gemba walks e para pensar sobre qualquer transformação: **Propósito, Processo, Pessoas** — sempre nessa ordem.

## Propósito: Comece pelo "por quê"

Antes de observar qualquer processo, a primeira pergunta é: **qual é o propósito deste trabalho?** Que valor está sendo criado para quem?

Surpreendentemente, muitas atividades organizacionais não conseguem articular seu propósito com clareza. Reuniões que existem por hábito. Relatórios que ninguém lê. Aprovações que não aprovam nada. Processos que servem ao processo, não ao cliente.

> "Se você não consegue definir o propósito de uma atividade em uma frase simples, a atividade provavelmente não deveria existir."

### Perguntas de propósito:
- Quem é o cliente deste processo?
- O que o cliente realmente precisa?
- Como saberíamos se estivéssemos entregando valor?
- Se parássemos de fazer isso, quem sentiria falta?

## Processo: Depois, observe o "como"

Só depois de clarificar o propósito, observe o processo. **O processo atual serve ao propósito?**

### A análise de processo no gemba:

1. **Siga o produto** — caminhe com o produto/serviço desde o início até a entrega
2. **Cronometre** — meça tempos de processamento e tempos de espera
3. **Conte os passos** — quantas etapas, quantas transferências, quantas aprovações
4. **Identifique os loops** — onde há retrabalho, vai-e-volta, esclarecimentos

### Os sete desperdícios (aplicados no gemba):

| Desperdício | O que procurar |
|-------------|---------------|
| Superprodução | Material/trabalho esperando downstream |
| Espera | Pessoas ociosas, filas, aprovações pendentes |
| Transporte | Material movendo-se longas distâncias |
| Superprocessamento | Etapas que não agregam valor ao cliente |
| Estoque | Acúmulo entre etapas do processo |
| Movimento | Pessoas caminhando, buscando ferramentas |
| Defeitos | Retrabalho, correções, reclamações |

## Pessoas: Por último, "quem"

Só depois de entender propósito e processo, foque nas pessoas. Não para avaliá-las, mas para **entender como o sistema as afeta**.

### Perguntas sobre pessoas:
- As pessoas têm as ferramentas e informações necessárias?
- O treinamento é adequado para o trabalho esperado?
- Há obstáculos que frustram as pessoas diariamente?
- As pessoas têm voz para reportar problemas e sugerir melhorias?
- O sistema permite que elas façam seu melhor trabalho?

### A ordem importa

A sequência Propósito → Processo → Pessoas é deliberada:

1. Se o **propósito** está errado, processo e pessoas são irrelevantes
2. Se o **processo** é ruim, mesmo pessoas excelentes produzirão resultados ruins
3. Se **pessoas** estão desmotivadas, verifique propósito e processo antes de culpá-las

> "95% dos problemas de desempenho das pessoas são, na verdade, problemas de propósito ou processo."`,
      },
    ],
    summaryChapters: [
      {
        id: "12-s1",
        title: "Resumo Executivo",
        content: `**Gemba Walks** de Jim Womack reune reflexoes sobre a prática de "ir ver" (genchi genbutsu) — o principio mais simples e mais dificil do pensamento Lean.

## A Arte de Ir Ver

Gemba walk **nao e** inspecao, auditoria ou management by walking around. E uma **prática disciplinada de observação e aprendizado** no local onde o valor e criado.

### O Que Observar
1. O fluxo de trabalho — esta fluindo ou esta parado?
2. Os desperdicios — espera, transporte, retrabalho
3. O estado de animo — engajamento ou alienacao?
4. Desvios do padrao — o real corresponde ao planejado?
5. Obstaculos — o que impede as pessoas?

### Como Perguntar
- "O que deveria estar acontecendo agora?"
- "O que realmente esta acontecendo?"
- "Por que ha diferenca?"
- "Como posso ajudar?"

## Framework: Proposito, Processo, Pessoas

Sempre nessa ordem:

1. **Proposito** — qual o valor sendo criado? Para quem? Se nao consegue definir em uma frase, a atividade provavelmente nao deveria existir.
2. **Processo** — o processo serve ao proposito? Siga o produto, cronometre, conte os passos, identifique loops.
3. **Pessoas** — como o sistema afeta as pessoas? Tem ferramentas adequadas? Voz para reportar problemas?

> "95% dos problemas de desempenho são problemas de proposito ou processo."

## Os Sete Desperdicios no Gemba

| Desperdicio | O Que Procurar |
|-------------|---------------|
| Superproducao | Trabalho esperando downstream |
| Espera | Filas, aprovacoes pendentes |
| Transporte | Longas distancias |
| Superprocessamento | Etapas sem valor |
| Estoque | Acumulo entre etapas |
| Movimento | Busca de ferramentas |
| Defeitos | Retrabalho, correcoes |

## Conclusao

A arte de ir ver e a arte de **aprender a ver o que sempre esteve la**, mas que formacao e preconceitos impediam de enxergar.`,
      },
    ],
  },
]

export const CATEGORIES = ["Todos", "Lean", "Excelencia"]

export function getBookById(id: string): Book | undefined {
  return BOOKS.find((book) => book.id === id)
}
