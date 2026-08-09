# Plano de estudo escopado por curso + IA analisando estrutura curricular — pesquisa de arquitetura

> **Autor:** Atlas (analyst) · **Data:** 2026-07-20
> **Contexto:** O fundador Hugo Capitelli trouxe duas ideias que mudam a **ARQUITETURA** do conceito de "plano de estudo" na tela `/meu-plano` (não a ciência comportamental, essa já está coberta):
> 1. O plano deve ser **escopado por curso** (não um plano único global cobrindo todos os cursos do aluno). No início de cada curso, a IA analisa como o curso funciona (módulos, estrutura) e a pessoa monta um plano individual PARA AQUELE curso.
> 2. O plano precisa ser **moldado pela estrutura real de conteúdo** daquele curso (interações, módulos, reflexões etc.), não uma fórmula genérica de "N sessões" igual para qualquer curso.
> **Fronteira deliberada:** Este documento é PESQUISA. NÃO desenha tela, UI ou mockup. Ele traz o que a prática de produto real (LMS/EdTech) e a literatura já sabem sobre esses dois movimentos arquiteturais, para municiar a decisão de design.
> **Relação com pesquisas anteriores (não repetir):**
> - `meu-plano-metodologia-pesquisa.md` — cobre a CIÊNCIA de goal-setting, recuperação de atraso, autonomia (SDT), self-regulated learning, spaced repetition. Este documento **assume** aquela ciência e trata só da arquitetura de escopo e de geração por estrutura.
> - `apps/hub-discovery/meu-plano-semanal-discovery.html` (JARVIS) — cobre UX patterns de sugestão-vs-livre, específico-vs-genérico e loop fechado (Duolingo/Khan/WHOOP). Não repetido aqui.
> **Método:** WebSearch + WebFetch reais, fontes citadas com URL.

---

## Sumário executivo (o red pill moment)

A prática de produto e a literatura convergem num veredito que valida a intuição do fundador, com uma ressalva de custo:

1. **LMS reais operam nos DOIS níveis ao mesmo tempo, não em um ou outro.** Coursera, Docebo e cia. têm ferramentas de planejamento **por curso** (progresso semana-a-semana, próximo passo, prazos daquele curso) E um **dashboard agregado** que só consolida barras de progresso. O plano de execução real mora no nível do curso; o agregado é um índice de navegação, não um plano.
2. **Há lastro científico para escopar por curso, não só ergonomia:** o *Dilution Model* (Zhang & Fishbach) mostra que aumentar o número de metas que um mesmo meio serve **enfraquece** a força associativa meio→meta e reduz a probabilidade de a pessoa agir. Um plano único global que mistura 5 cursos dilui cada um; um plano por curso mantém o vínculo forte.
3. **A IA que lê estrutura de curso e gera plano JÁ EXISTE — mas quase toda voltada ao PROFESSOR/autor, não ao aluno.** Geradores de currículo (Junia AI, Unifire, Brisk, TeachQuill) transformam módulos/objetivos num cronograma semana-a-semana. O produto raro é o inverso: IA gerando o *plano do aluno* a partir da estrutura do curso. É espaço em branco relativo.
4. **Decompor um curso em unidades de esforço estimável é prática consolidada em instructional design.** O *Course Workload Estimator* de Rice (usado por LSU, UMBC, Ohio) converte páginas de leitura, gênero de escrita, reflexões e assessments em tempo estimado, com coeficientes concretos (ex.: uma reflexão de 250 palavras sem revisão ≈ **45 min/página**). É o modelo mais próximo de "quanto tempo um módulo com N interações e M reflexões demanda".
5. **Personalização granular por curso tem custo real e assimétrico.** A literatura de produto é firme: cada camada de personalização é um passivo de longo prazo (manutenção, dados, sobrecarga cognitiva), não um "quick win". O veredito prático: personalização vale quando reduz esforço do aluno e tem dado confiável por baixo; não vale quando só adiciona configuração e complexidade de manutenção.

---

## Eixo 1 — Planos escopados por curso vs. plano único global do aluno

### 1.1 Como os LMS/EdTech reais dividem esse escopo

**Coursera — os dois níveis coexistem, com papéis distintos.** A Coursera introduziu ferramentas de planejamento explicitamente **no nível do curso** (progress bars por curso, guias de planejamento semana-a-semana, "próximo passo" que aponta o vídeo/leitura/assignment específico a fazer). O **dashboard do aluno** (visão cross-curso) consolida apenas uma barra de progresso por curso ativo mais o link de "resume". Ou seja: o *plano* mora no curso; o *dashboard* é um índice agregado de navegação, não um plano unificado. A própria Coursera relata ter chegado a esse desenho ouvindo alunos que pediam "progress tracking e planning para se manterem orientados dentro de um curso", inspirando-se em fitness trackers e apps de planejamento financeiro (produtos onde o usuário rastreia progresso e identifica o próximo passo rumo a uma meta específica).
Fontes: [What's New on Coursera: Dashboard and Course Home Page Updates](https://blog.coursera.org/whats-new-on-coursera-dashboard-and-course-home/) · [New progress tracking features on Coursera](https://blog.coursera.org/new-progress-tracking-features-on-coursera)

**Docebo (LMS corporativo) — "learning plans" são sequências de cursos, com prazos e automação POR item.** No Docebo, um *learning plan* é uma sequência curada de cursos (e-learning + ILT) que forma a jornada. Os prazos (due dates) e lembretes são configurados **por curso/assignment dentro do plano**, não como uma meta global agregada. A IA (copiloto Harmony) é contextual à página/curso em que o aluno está, e o sistema pode detectar que um aluno está ficando para trás **num item específico** e atribuir um refresher ou enviar um nudge. Isto é escopo granular, não um plano único difuso.
Fontes: [Docebo — Creating and managing learning plans](https://help.docebo.com/hc/en-us/articles/360020083980-Creating-and-managing-learning-plans) · [Docebo vs. 360Learning (schoox)](https://www.schoox.com/blog/docebo-vs-360learning-which-lms-is-right-for-your-business-2026/)

**360Learning — filosofia oposta (conteúdo por SME/peers), mas ainda escopado ao curso.** O 360Learning aposta em conteúdo criado por especialistas internos e revisado por pares; a IA apoia o *autor*, não personaliza a experiência do aluno. Feedback público relata que "as funções de IA não são muito úteis no momento". Relevância para a decisão: mesmo a plataforma que menos personaliza o aluno ainda organiza a jornada por curso/trilha, não por um plano-guarda-chuva único.
Fonte: [Docebo vs. 360Learning (schoox)](https://www.schoox.com/blog/docebo-vs-360learning-which-lms-is-right-for-your-business-2026/)

**Udemy — lembretes de estudo configuráveis, ligados ao ato de retomar cursos.** A Udemy oferece *learning reminders* (recorrentes/semanais ou pontuais, com sync para Google/Apple/Outlook Calendar) para "manter o aluno no rumo das metas de aprendizado e lembrar quando retomar seus cursos". É um mecanismo leve de cadência ligado a cursos, não um plano diagnóstico global.
Fonte: [Udemy — How to Schedule Learning Reminders on a Browser](https://support.udemy.com/hc/en-us/articles/4501093209367-How-to-Schedule-Learning-Reminders-on-a-Browser)

### 1.2 Lastro científico para escopar por curso (não só ergonomia): o Dilution Model

O argumento mais forte a favor do plano por curso não é de UX, é de teoria de motivação. **Zhang, Fishbach & Kruglanski — "The Dilution Model" (JPSP, 2007)**: em seis experimentos, aumentar o número de metas que um único meio serve **reduz a instrumentalidade percebida** desse meio para cada meta individual. O mecanismo é associativo: quanto mais metas salientes um mesmo meio ("estudar/planejar") atende, mais **fraca** fica a força associativa entre esse meio e cada meta específica, e menos provável que a pessoa (a) lembre daquela meta ao agir e (b) escolha aquela ação para atingir a meta.

Tradução para o produto: um **plano único global** que mistura "avançar em 5 cursos diferentes" trata os cursos como metas concorrentes de um mesmo meio (o "estudar da semana"), e dilui o vínculo com cada curso. Um **plano por curso** mantém o vínculo meio→meta forte e específico. Convergente: pesquisa de multiple-goal pursuit mostra que competição por recursos cognitivos limitados exige prioridade explícita (inibição cognitiva das outras metas) para não haver interferência — exatamente o que um plano por curso faz por design (foco em um curso de cada vez).
Fontes: [The Dilution Model (ResearchGate)](https://www.researchgate.net/publication/6453730_The_Dilution_Model_How_Additional_Goals_Undermine_the_Perceived_Instrumentality_of_a_Shared_Path) · [Dynamics of Multiple-Goal Pursuit (ResearchGate)](https://www.researchgate.net/publication/6194028_Dynamics_of_Multiple-Goal_Pursuit) · [Multiple Goals — Fishbach, Chicago Booth](https://www.chicagobooth.edu/review/tiny-course/ayelet-fishbach-get-it-done/multiple-goals)

### 1.3 Trade-offs conhecidos (o aluno com 5 cursos ativos)

- **A favor do plano por curso:** clareza e foco (Dilution Model), próximo passo específico, cadência ligada ao ato de retomar aquele curso. É o padrão que Coursera e Docebo convergiram.
- **Contra (o risco de 5 planos separados):** sobrecarga se cada curso exigir uma cerimônia de planejamento pesada. A mitigação que os produtos reais usam é manter o **agregado como índice leve** (só barras de progresso + resume, como o dashboard Coursera), sem transformá-lo num sexto plano. O aluno decide qual curso "abrir o plano" agora; os outros ficam em espera visível, não competindo.
- **Síntese:** o padrão de mercado não é "um ou outro" — é **plano por curso (onde mora a execução) + dashboard agregado enxuto (índice de navegação)**. A arquitetura que o fundador propôs está alinhada com o consenso, desde que o agregado permaneça um índice, não vire um plano concorrente.

---

## Eixo 2 — IA analisando estrutura de curso para gerar plano personalizado

### 2.1 Produtos reais onde a IA lê o syllabus/módulos e GERA um cronograma

Existe uma categoria madura de geradores — mas quase toda **voltada ao professor/autor**, produzindo o cronograma do CURSO, não o plano do ALUNO:

- **Junia AI — Syllabus Generator com modo module-based.** Tem modos "Standard" (curso tradicional calendário), "Module-Based" (curso self-paced/online organizado por unidades em vez de semanas de calendário) e "Outcomes-First". O gerador produz um plano **semana-a-semana** com temas de sessão, conceitos-chave, atividades sugeridas e due dates. O modo module-based é o mais próximo do caso Academy (curso por módulos, não por calendário fixo). Fonte: [Junia AI — Syllabus Generator](https://www.junia.ai/tools/syllabus-generator)
- **Unifire — module-to-schedule mapping.** Você insere os tópicos dos módulos e recebe um outline estruturado com descrições de lição, milestones e checkpoints de assessment mapeados. Achado importante para o Academy: **objetivos específicos produzem planos específicos** ("students will implement a functional REST API" → plano semanal específico); objetivos vagos produzem planos vagos. Fonte: [Unifire — AI Syllabus Generator](https://www.unifire.ai/tools/ai-syllabus-generator/)
- **Brisk Teaching / TeachQuill — pacing para não "estourar o tempo".** Brisk organiza objetivos, unidades e assessments num syllabus coeso a partir de uma descrição curta do curso; TeachQuill explicitamente ajuda a "visualizar o pacing para não faltar tempo no fim". São ferramentas de *design de curso* (professor), não de plano do aluno. Fontes: [Brisk — AI Syllabus Generator](https://www.briskteaching.com/ai-tools/syllabus-generator) · [TeachQuill — Plan](https://teachquill.com/plan)

**Leitura estratégica:** a capacidade técnica de "IA lê estrutura de curso → gera cronograma com milestones" está **provada e comoditizada** no lado do autor. O que é raro é apontá-la ao **aluno** para gerar o *plano de execução pessoal* a partir da estrutura real do curso em que ele está matriculado. Essa é a inovação de arquitetura do fundador — reusar um mecanismo maduro numa direção pouco explorada.

### 2.2 Adaptive learning: o precedente mais forte de "estrutura do domínio molda o caminho"

As plataformas adaptativas são o exemplo mais maduro de "a estrutura do conteúdo determina o caminho personalizado", ainda que operem por knowledge graph, não por plano de calendário:

- **ALEKS (Knowledge Space Theory).** Mantém um mapa detalhado e evolutivo do conhecimento de cada aluno e o guia por estados de conhecimento não-lineares, gerando um plano personalizado a partir de uma avaliação inicial. A estrutura do domínio (o "knowledge space") é o que molda o caminho. Fonte: [ALEKS — McGraw Hill](https://www.mheducation.com/highered/digital-products/aleks.html) · [ALEKS AI (Medium)](https://medium.com/@nimbo9446/aleks-ai-an-adaptive-learning-system-54582258c79c)
- **Squirrel AI (knowledge graphs nano-granulares).** Decompõe uma matéria em >10.000 "knowledge points" e constrói knowledge graphs dinâmicos que apontam exatamente onde o aluno trava, montando pathways em tempo real. Fonte: [Squirrel AI](https://squirrelai.com/) · [Squirrel AI (choppingblock)](https://www.choppingblock.ai/companies/squirrel-ai)

**Ponte para o Academy:** o Academy não precisa (nem deveria, ver Eixo 4) de knowledge graph nano-granular. Mas o princípio arquitetural é o mesmo e transferível: **a estrutura real do conteúdo (módulos, interações, reflexões) é o insumo que molda o plano — não uma fórmula fixa aplicada por fora.** É a versão leve e viável do que ALEKS/Squirrel fazem no extremo pesado.

### 2.3 IA generativa em LMS voltada ao aluno (Coursera Coach)

O **Coursera Coach** (powered by Gemini) é o mais próximo de IA aluno-facing, mas com uma ressalva honesta: ele faz Q&A socrático, resumos de vídeo, prática pré-assessment e tracking de progresso cross-curso — **mas as fontes NÃO confirmam** um gerador de "plano de estudo com pacing a partir do syllabus". A geração de plano por estrutura no lado do aluno permanece um gap de mercado, não um recurso já entregue pelos grandes.
Fontes: [Coursera Coach — Leveraging GenAI](https://blog.coursera.org/coursera-coach-leveraging-genai-to-empower-learners/) · [Announcing AI-powered Coursera Coach for educators](https://blog.coursera.org/announcing-ai-powered-capabilities-enabling-educators-to-use-coursera-coach-to-deliver-interactive-personalized-instruction/)

---

## Eixo 3 — Curriculum/content structure analysis (decompor curso em unidades de esforço estimável)

Sim, existe prática consolidada. O termo âncora é **course workload estimation / time-on-task estimation**, e a ferramenta de referência é o **Course Workload Estimator** de Rice (adotado por LSU, UMBC, Ohio University).

### 3.1 O modelo Rice — como decompõe um curso em tempo estimado

O estimador converte a estrutura do curso em tempo estimado usando coeficientes concretos por tipo de atividade:

**Leitura** — 3 fatores combinados:
- *Densidade da página:* 450 palavras (paperback/artigos), 600 (monografias), 750 (textbooks com imagens).
- *Dificuldade:* nenhum conceito novo / alguns / muitos.
- *Propósito:* survey (skim), understand (compreender cada frase), engage (resolver problemas, questionar, avaliar).
- Coeficiente resultante (matriz 9×3): de **67 páginas/hora** (survey, sem conceito novo, 450 palavras) a **5 páginas/hora** (engage, muitos conceitos novos, 750 palavras).

**Escrita** — 3 fatores:
- *Densidade:* 250 palavras (double-spaced) ou 500 (single-spaced).
- *Gênero:* **reflexão/narrativa**, argumento, pesquisa.
- *Nível de rascunho:* nenhum / mínimo / extenso.
- Coeficiente: uma **reflexão de 250 palavras sem revisão ≈ 45 min/página**; no extremo, um ensaio de pesquisa de 500 palavras com revisão extensa ≈ 10 horas/página.

**Unidade base (Carnegie).** O padrão subjacente é a Carnegie unit: ~3 horas de engajamento/semana por hora-crédito. Um curso de 3 créditos ≈ 135 horas totais de time-on-task, independente da duração — e a diretriz de tempo de aprendizado deve valer igual seja online, blended ou presencial.
Fontes: [Rice Course Workload Estimator (via cte.rice.edu/workload)](https://cte.rice.edu/workload) · [LSU Time-on-Task Calculator](https://facultysupport.lsu.edu/resources/time-on-task-calculator/) · [UMBC Course Workload Estimator](https://pivot.umbc.edu/course-design/course-workload-estimator/)

### 3.2 Seat time em e-learning: interações contam, mas medição real vence proxy

A prática de instructional design em e-learning tem regras próprias para estimar *seat time* (tempo do aluno para completar), diretamente aplicáveis a "quanto tempo um módulo com N interações demanda":
- **Interações são peça explícita do cálculo** — a interação do aluno com o curso é um dos componentes do seat time e deve entrar na estimativa.
- **Proxies grosseiros enganam** — "1 slide = 1 minuto" ou contagem de palavras são só ponto de partida; alunos tech-savvy passam muito mais rápido que o estimado.
- **Medição real é o padrão-ouro** — a melhor estimativa vem de rodar o curso com alunos reais e medir o seat time médio; e é aceitável dar uma janela ("20 a 25 min") em vez de número exato.
Fontes: [How to Calculate Seat Time (E-Learning Heroes / Articulate)](https://community.articulate.com/articles/how-to-calculate-the-seat-time-for-your-e-learning-course) · [How to Plan for Seat Time (Maestro)](https://maestrolearning.com/blogs/seat-time/) · [6 Tips to Calculate Seat Time (eLearning Industry)](https://elearningindustry.com/calculate-seat-time-in-elearning)

### 3.3 Implicação direta para o Academy

O Academy tem uma vantagem sobre os estimadores acadêmicos: ele **conhece a estrutura real do curso no banco** (módulos, número de interações, número de reflexões) e **observa o comportamento real** (o Meu ritmo já calcula gap por dimensão — progresso, interações, reflexões). Isso significa dois caminhos combináveis:
1. **Estimativa a priori (modelo Rice adaptado):** atribuir um coeficiente de tempo/esforço por tipo de unidade (uma reflexão ≈ X min, uma interação ≈ Y min), somando por módulo. Simples, explicável, imediato.
2. **Calibração a posteriori (seat time real):** o padrão-ouro do e-learning — usar o tempo/comportamento real observado dos alunos para refinar os coeficientes. Alinha com o "loop fechado à la WHOOP" da discovery HTML e com o self-regulated learning (ciclo planejar→executar→refletir) da pesquisa de metodologia.

O achado central do Eixo: **a reflexão é a unidade mais cara** (45 min/página no modelo Rice, gênero mais lento que argumento simples). Isso dá base quantitativa ao que o Meu ritmo já observa qualitativamente (Rinaldo/Angelo atrasados justamente em reflexões) — um plano por curso deveria **pesar reflexões mais que interações** ao estimar esforço, não tratá-las como unidades equivalentes.

---

## Eixo 4 — Trade-off explícito: personalização granular por curso vs. modelo único simples

### 4.1 O que a prática de produto real diz

A literatura de produto é consistente e serve de contrapeso ao entusiasmo pela personalização profunda:

- **Personalização é passivo de longo prazo, não quick win.** Cada camada de customização aumenta a complexidade da base de código, desacelera trabalho futuro, exige mais gente e reduz a flexibilidade do sistema. A armadilha do "quick win" é insidiosa: uma exceção "one-off" (ex.: desligar um elemento para um caso) tem que ser considerada toda vez que se toca naquela área, e isso multiplica por 5 ou 10 pedidos. Fonte: [Avoiding Over-Customization in B2B SaaS (Julia Bastian)](https://juliabastian.medium.com/avoiding-over-customization-in-b2b-saas-24676082124c)
- **Cálculos de ROI subestimam o custo real.** Faltam nos cálculos os custos ocultos: oportunidade (desvio de foco de projetos de maior impacto) e custo de UX/design contínuo, não só engenharia inicial. Fonte: [Avoiding Over-Customization (Julia Bastian)](https://juliabastian.medium.com/avoiding-over-customization-in-b2b-saas-24676082124c)
- **Customização em excesso vira sobrecarga cognitiva, não valor.** Liberdade demais causa cognitive overload; usuários querem design simples, intuitivo e orientado a resultado, não configurar. Sinal de alerta: se o usuário precisa aprender/configurar mais, você adicionou fricção, não valor. Fonte: [What Is Overpersonalization in UX (Eleken)](https://www.eleken.co/blog-posts/how-much-personalization-is-enough-in-ux-design)
- **Personalização é tão boa quanto o dado por baixo.** Dado fraco/desatualizado faz a personalização repelir o usuário, não encantar. Tratar como "chore one-off" em vez de processo contínuo é causa comum de falha. Fonte: [The 7 pitfalls of retail personalization (Optimizely)](https://www.optimizely.com/insights/blog/the-7-hidden-pitfalls-of-retail-personalization-and-how-to-avoid-them/)

### 4.2 Quando vale o investimento em granularidade por curso

Sintetizando as fontes, a personalização por curso **vale** quando:
1. **Reduz o esforço do aluno** (default calculado que ele só ajusta) em vez de exigir configuração — coerente com o "sugestão computada" da discovery HTML e com autonomia percebida da pesquisa de metodologia.
2. **Tem dado confiável por baixo** — e o Academy tem: a estrutura do curso no banco e o comportamento real observado (Meu ritmo). Este é o pré-requisito que a literatura mais cobra, e o Academy passa nele.
3. **A dimensão personalizada é acionável** — pesar reflexões vs. interações muda o que o aluno faz; personalizar por vaidade (cores, ordem) não.

E **não vale** quando:
1. Vira 5 cerimônias de planejamento pesadas para um aluno com 5 cursos (mitigar com agregado enxuto — ver Eixo 1.3).
2. Cada curso novo exige lógica de manutenção customizada — o antídoto é um **modelo único de estimativa parametrizado** (coeficientes por tipo de unidade, ver Eixo 3), aplicado uniformemente a qualquer curso. Isso dá personalização *do resultado* sem fragmentar o *código*: a estrutura de cada curso alimenta a mesma fórmula, então "moldado pelo curso" não significa "código diferente por curso".

### 4.3 O ponto de equilíbrio recomendado

O desenho de menor risco que honra as duas ideias do fundador: **um único motor de estimativa parametrizado (não código por curso), alimentado pela estrutura real de cada curso, que produz um plano escopado àquele curso.** A personalização vive nos *dados de entrada* (a estrutura de cada curso), não na *lógica* (que permanece única e mantível). Isso captura o benefício de "moldado pelo curso" (Eixo 2/3) evitando a armadilha de manutenção do Eixo 4.

---

## Implicações práticas (conexão com a pesquisa de metodologia existente)

> Estas implicações são de ARQUITETURA. Elas se somam aos princípios de conteúdo já estabelecidos em `meu-plano-metodologia-pesquisa.md` (referenciado por nome, não repetido). Onde há ligação direta, aponto o princípio de lá.

- **A1 — Escopar por curso está alinhado ao mercado E à ciência.** O padrão consolidado (Coursera, Docebo) é plano por curso + dashboard agregado enxuto; o Dilution Model dá o porquê teórico. Isto **reforça** o princípio de autonomia/foco de `meu-plano-metodologia-pesquisa.md` (P4): um plano por curso é mais fácil de o aluno "possuir" com agência do que um plano global difuso. *Confiança: alta.*

- **A2 — O agregado deve permanecer um índice, nunca um sexto plano.** O risco do "aluno com 5 cursos = 5 planos = sobrecarga" é real; a mitigação de mercado é manter a visão cross-curso como navegação leve (barras + resume), não como plano concorrente. Conecta com o princípio de "começar pequeno / make it easy" (P5 da metodologia): o agregado não pode intimidar. *Confiança: alta.*

- **A3 — A IA que lê estrutura e gera plano é tecnicamente madura, mas rara no lado do aluno.** Reusar um mecanismo comoditizado (geradores de currículo) numa direção pouco explorada (plano de execução do ALUNO a partir da estrutura do curso) é a inovação de arquitetura defensável. Alinha com a filosofia da casa: "reusar mecanismo maduro em direção nova" > construir do zero. *Confiança: média-alta.*

- **A4 — Moldar pela estrutura significa pesar reflexões mais que interações.** O modelo Rice quantifica o que o Meu ritmo já observa: reflexão é a unidade mais cara (≈45 min/página). Um plano moldado pelo curso deve atribuir peso de esforço por tipo de unidade, não tratar "N sessões" como fórmula plana. Isto operacionaliza o princípio de "pacing por unidades atômicas" (P8 da metodologia) descendo ao nível de tipo de unidade. *Confiança: alta para a lógica; os coeficientes exatos precisam de calibração local.*

- **A5 — Combinar estimativa a priori (Rice) com calibração a posteriori (seat time real).** Comece com coeficientes explicáveis por tipo de unidade; refine com o comportamento real observado. Isto fecha o ciclo self-regulated learning (planejar→executar→refletir) da metodologia e ecoa o "loop fechado à la WHOOP" da discovery HTML — mas como fase evolutiva, não requisito da v1. *Confiança: alta.*

- **A6 — Personalização por curso vale porque o Academy tem o dado; o custo se controla mantendo LÓGICA única.** A literatura de over-personalization aprova personalizar quando reduz esforço e há dado confiável (Academy passa nos dois). O antídoto ao custo de manutenção é um motor único parametrizado: a estrutura do curso é o *input*, a fórmula é *única*. "Moldado pelo curso" ≠ "código por curso". *Confiança: alta.*

- **A7 — Tensão declarada (não escondida):** granularidade por curso (A4) tem trade-off com leveza/autonomia (A2) — o mesmo trade-off que a pesquisa de metodologia já sinalizou entre sub-metas granulares (P3) e autonomia (P4). A arquitetura não resolve isso sozinha; a próxima rodada de design (UI, fora do escopo desta pesquisa) precisa equilibrar profundidade de estimativa com uma experiência que não pese. A pesquisa apenas garante que ambos os lados têm base real.

---

## Referências consolidadas

**Eixo 1 — Escopo por curso vs. global:**
- Coursera — dashboard e course home updates. [link](https://blog.coursera.org/whats-new-on-coursera-dashboard-and-course-home/) · [progress tracking](https://blog.coursera.org/new-progress-tracking-features-on-coursera)
- Docebo — creating/managing learning plans. [link](https://help.docebo.com/hc/en-us/articles/360020083980-Creating-and-managing-learning-plans)
- Docebo vs. 360Learning (schoox). [link](https://www.schoox.com/blog/docebo-vs-360learning-which-lms-is-right-for-your-business-2026/)
- Udemy — learning reminders. [link](https://support.udemy.com/hc/en-us/articles/4501093209367-How-to-Schedule-Learning-Reminders-on-a-Browser)
- Zhang, Fishbach & Kruglanski (2007), *The Dilution Model*, JPSP. [link](https://www.researchgate.net/publication/6453730_The_Dilution_Model_How_Additional_Goals_Undermine_the_Perceived_Instrumentality_of_a_Shared_Path)
- Dynamics of Multiple-Goal Pursuit. [link](https://www.researchgate.net/publication/6194028_Dynamics_of_Multiple-Goal_Pursuit)

**Eixo 2 — IA lendo estrutura de curso:**
- Junia AI — Syllabus Generator (module-based). [link](https://www.junia.ai/tools/syllabus-generator)
- Unifire — module-to-schedule. [link](https://www.unifire.ai/tools/ai-syllabus-generator/)
- Brisk Teaching — Syllabus Generator. [link](https://www.briskteaching.com/ai-tools/syllabus-generator)
- TeachQuill — Plan. [link](https://teachquill.com/plan)
- ALEKS (Knowledge Space Theory). [link](https://www.mheducation.com/highered/digital-products/aleks.html)
- Squirrel AI (knowledge graphs). [link](https://squirrelai.com/)
- Coursera Coach (GenAI aluno-facing). [link](https://blog.coursera.org/coursera-coach-leveraging-genai-to-empower-learners/)

**Eixo 3 — Workload/seat-time estimation:**
- Rice Course Workload Estimator. [link](https://cte.rice.edu/workload)
- LSU Time-on-Task Calculator. [link](https://facultysupport.lsu.edu/resources/time-on-task-calculator/)
- UMBC Course Workload Estimator. [link](https://pivot.umbc.edu/course-design/course-workload-estimator/)
- E-Learning Heroes / Articulate — seat time. [link](https://community.articulate.com/articles/how-to-calculate-the-seat-time-for-your-e-learning-course)
- Maestro — planning for seat time. [link](https://maestrolearning.com/blogs/seat-time/)

**Eixo 4 — Trade-off personalização vs. simplicidade:**
- Avoiding Over-Customization in B2B SaaS (Julia Bastian). [link](https://juliabastian.medium.com/avoiding-over-customization-in-b2b-saas-24676082124c)
- What Is Overpersonalization in UX (Eleken). [link](https://www.eleken.co/blog-posts/how-much-personalization-is-enough-in-ux-design)
- The 7 pitfalls of retail personalization (Optimizely). [link](https://www.optimizely.com/insights/blog/the-7-hidden-pitfalls-of-retail-personalization-and-how-to-avoid-them/)

---

*Documento de pesquisa de ARQUITETURA. Não contém desenho de tela, UI ou mockup — apenas o que a prática de produto real e a literatura sabem sobre planos escopados por curso e geração de plano por estrutura curricular. Complementa (não substitui) `meu-plano-metodologia-pesquisa.md`. Fontes via WebSearch/WebFetch reais em 2026-07-20.*
</content>
</invoke>
