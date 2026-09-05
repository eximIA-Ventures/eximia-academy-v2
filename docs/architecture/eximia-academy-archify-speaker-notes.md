# Roteiro de 30 min, mapa exímIA Academy v2

Artefato ao vivo: `docs/architecture/eximia-academy-archify.html`
Versão com o visual jovial do mastermind: `eximia-academy-archify-jovial.html` (gerada por `tema-jovial.mjs`, ver estudo em `-tema-jovial.md`)
Fonte: `eximia-academy-archify.json` (Archify showcase, 9/9 checks, 0 erro, 0 warning)

Capítulos organizados **por quem usa**, não por camada técnica.

---

## ⚠ LEIA ANTES DE TUDO: duas correções de fato

Uma varredura no código de `eximia-academy-v2` mudou duas coisas que o Senhor precisa saber antes de subir ao palco.

**1. "O gestor valida a prova" não tem lastro no código hoje.**
A cena 11 do roteiro do mastermind diz: *"a pessoa não conclui enquanto não tiver prova de que aplicou aquilo no trabalho. E quem valida essa prova não é o sistema. É o gestor dela."* A busca por evidência/aprovação em `apps`, `packages` e `supabase` **não achou tabela, coluna nem rota** de validação de evidência de aluno. `slide_reflections` tem `student_id`, `slide_id`, `response`, e nenhum campo de aprovação ou revisor. Os únicos `approved_by` do schema são de **conteúdo** (`blueprints`) e de **nudge** (`engagement_suggestions`). O mais próximo que existe é leitura e comentário: `/api/leader/comments` (só papel `leader`) e um painel read-only do instrutor.

> Isso não invalida o HCI como método, mas hoje é **desenho, não software rodando**. Numa sala de C-levels, dizer "o gestor valida" como se fosse funcionalidade viva é o tipo de frase que um CTO na plateia pede para ver. Recomendo trocar para o tempo verbal honesto: *"o desenho do HCI põe o gestor como quem valida a evidência, e é o próximo elo que a gente está fechando"*. Vale mais, e não custa nada.

**2. "Gestor" e "quem cria o curso" são pessoas diferentes neste sistema.**
O app tem quatro mundos (`standard`, `studio`, `admin`, `super`) e o gestor de time (`manager`) **não alcança o Estúdio**: `canEnterStudio` é `instructor` ou `super_admin`. Os três nós exclusivos do mapa (`course-designer`, `docling-serve`, `Blueprint API`) pertencem à **autoria**, não à gestão de time. Por isso o Capítulo 2 chama-se "quem cria e administra o conteúdo", e não "visão do gestor". Se o Senhor disser "gestor" apontando para essas caixas, está descrevendo outra pessoa.

**3. A honestidade que virou trunfo.** Dos 12 nós, **9 são atravessados pelos dois papéis**, e o caminho do aluno é subconjunto do de autoria. Isso poderia ser um problema. Virou a nota do Capítulo 3, e é um insight melhor do que qualquer separação bonita: *"o que separa os dois não é a caixa desenhada, é o guarda de papel em cada rota."*

---

## Tabela de tempo

| Bloco | Duração | Capítulo | Tecla |
|:---|:---|:---|:---|
| Abertura | 3 min | fora do diagrama | `F` antes de a sala ver a tela |
| Cap. 1 · o aluno | 8 min | `aluno` | `]`, depois `R` |
| Cap. 2 · quem cria | 8 min | `autoria` | `]` |
| Cap. 3 · o sistema inteiro | 5 min | `tudo` | `]` |
| Fecho | 3 min | volta ao inteiro | `[` ou `0` |
| Buffer / perguntas | 3 min | livre | `/` |

Total: 30 min.

---

## Como funcionam os quadrinhos explicativos

Foi o pedido do Senhor: ler "Upstash Redis" em voz alta e ter um texto ali dizendo o que é. Três camadas, e vale saber qual aparece quando.

| Camada | O que mostra | Quando aparece |
|:---|:---|:---|
| **sublabel** (abaixo do nome) | a explicação curta em português chão: "trava excesso de pedidos" | **sempre**, com zoom em 100% ou mais |
| **"Na vida real"** (card rosa, canto direito) | **a metáfora do mundo real**: "A catraca. Impede que uma pessoa só passe quinhentas vezes e trave a fila de todo mundo." | ao **clicar** no nó, e troca sozinho quando o Senhor clica em outro. **Funciona também no Presentation Stage.** |
| **Passaporte** (painel branco, esquerda) | o lado técnico: nome, tipo, fronteira, quantas conexões entram e saem | ao clicar no nó, junto com o card acima |
| **tag** (rodapé da caixa) | o dado de stack: "Supabase · 96 migrations" | só com zoom ≥175%, ou ao passar o mouse |

**O gesto de palco é este:** clique no nó → à esquerda abre o técnico, à direita abre a metáfora. Leia a metáfora em voz alta, ela foi escrita para ser dita. Os doze nós têm a sua.

> Exemplos prontos: portaria (middleware), catraca (Redis), balcão de atendimento (apps/web), central de pedidos (Route Handlers), **o professor que responde com pergunta** (@eximia/agents), os consultores externos alugados por hora (OpenAI + Google), o arquiteto (Blueprint API), o estagiário que lê a papelada (docling), o almoxarifado (Storage), o arquivo com cadeado (Postgres).

**Os cards de dicionário (embaixo do diagrama) somem no Presentation Stage** — `html[data-present="true"] .cards { display: none }`. O card "Na vida real" **não**, ele foi feito por fora justamente para sobreviver ao `F`. Se quiser os dicionários visíveis para a sala, apresente sem `F`, em tela cheia do navegador.

> **Se o Senhor renomear um nó no JSON, atualize `VIDA_REAL_MAPA` em `tema-jovial.mjs`.** O card casa pelo `id` do componente; id que não bate simplesmente não abre o card, sem erro nenhum.

---

## Abertura (3 min), fora do diagrama

> "Todo mundo hoje amarra um prompt a uma API e chama de IA no produto. Eu vou abrir o que existe entre esses dois pontos quando é orquestração de verdade. E vou abrir por quem usa, não por camada técnica, senão vira aula de engenharia."

---

## Capítulo 1 · o que acontece quando o aluno pensa (8 min)

**Tecla:** `]` · **Título na tela:** "Cap. 1 · o que acontece quando o aluno pensa"

**Fala de contraste:**
> **What Is:** "O comum é o app entregar a resposta pronta."
> **What Could Be:** "Aqui o aluno faz um turno socrático: o sistema pergunta, trava o turno no banco e devolve."

**Onde parar, e o que o quadrinho já diz por você:**
- `Next Middleware` → *"confere quem é, antes"*. O porteiro. Nada carrega antes dele.
- `Upstash Redis` → *"trava excesso de pedidos"*. Aqui vale a mão na massa: o chat do aluno tem cota própria, 10 por minuto, uma chave separada de tudo. Não é um limite genérico, é um limite pensado para aquele fluxo.
- `@eximia/agents` → *"pergunta, não responde"*. **É a caixa que prova a tese da noite.** Não corra.
- `OpenAI + Google` → *"os cérebros alugados"*. Emenda direto com a sua frase do fecho: a inteligência eu aluguei igual a todo mundo.

**Traçado ao vivo:** `R`, rota **`browser` → `llm_providers`**. Resolve em 5 saltos autorais (`browser → middleware → web_app → api_routes → agents_pkg → llm_providers`). Nada é inferido por proximidade, todos os elos existem no desenho.

> Enquanto a rota acende: "Esse é o caminho inteiro de uma pergunta de aluno até o modelo. Cinco decisões antes de qualquer palavra ser gerada. Nenhuma delas mora num prompt."

**Se a rota de 5 saltos poluir o projetor:** usar `api_routes` → `llm_providers`, 2 saltos, mesmo capítulo.

**Virada:** "Isso é o lado de quem consome. Agora o lado de quem produz."

---

## Capítulo 2 · quem cria e administra o conteúdo (8 min)

**Tecla:** `]` · **Título na tela:** "Cap. 2 · quem cria e administra o conteúdo"

**Fala de contraste:**
> **What Is:** "O comum é alguém escrever o curso na mão, num Word, e subir num player."
> **What Could Be:** "Aqui um pipeline lê o documento, desenha o plano e monta a trilha, em serviços que rodam fora do sistema principal."

**Onde parar:**
- `docling-serve` → *"lê PDF e slide"*. O leitor.
- `Blueprint API` → *"desenha o plano"*. Roda em Python, container próprio. É o projetista: desenha antes de escrever.
- `course-designer` → *"monta a trilha do curso"*. O montador.

> "E repara numa coisa: o aluno não entra em nenhuma dessas três caixas. Toda rota daqui barra quem não tem papel de autoria. Não é configuração de tela, é porta trancada no servidor."

**Se perguntarem quem são os agentes:** `CreatorOS` gera as perguntas socráticas, `TesterOS` é o Validador de Qualidade que checa cada resposta contra critério fixo antes de chegar no aluno. *(nomes confirmados no código; ainda pendente da sua palavra final se quer citá-los no palco)*

**Virada:** "Dois capítulos, dois papéis. Agora a parte que me surpreendeu quando eu mapeei."

---

## Capítulo 3 · o sistema inteiro, sem cortes (5 min)

**Tecla:** `]` · **Título na tela:** "Cap. 3 · o sistema inteiro, sem cortes"

**Fala de contraste (esta é a melhor frase do bloco, diga devagar):**
> "Os mesmos quadrados servem o aluno e a autoria. O que separa os dois não é a caixa desenhada. É o guarda de papel em cada rota."

> "Quando eu montei esse mapa, eu esperava dois desenhos diferentes. Não são. São nove caixas compartilhadas e três exclusivas. A separação entre quem pode o quê não está no desenho da arquitetura, ela está numa checagem que roda em toda requisição. É por isso que segurança de verdade é chata: ela não aparece no slide bonito."

Aqui também entram, se sobrar fôlego: `EasyPanel`, `Docker` e `Traefik` rodando isso em produção, e a linha `service key` chegando no Postgres.

---

## Fecho (3 min), fora do diagrama

**Tecla:** `[` ou `0`

> "O aluno não vê nada disso. Ele recebe um tutor que pergunta em vez de responder, e que decide sozinho qual cérebro chamar dentro do que a empresa dele contratou. Isso é orquestração. Automação seria um prompt fixo numa API."

---

## Antes de subir ao palco

1. Rodar `node docs/architecture/tema-jovial.mjs` **se** for usar a versão jovial, e abrir o `-jovial.html`, não o outro.
2. Abrir em tela cheia. Decidir `T` (tema claro ou escuro) **antes**, pela luz da sala. Não mexer durante a fala.
3. Decidir se usa `F`: **com** `F` o diagrama ganha a tela toda mas os dicionários somem; **sem** `F` os dicionários ficam visíveis abaixo.
4. Ensaiar `]` três vezes e `R` uma vez. São os únicos gestos obrigatórios.
5. Clicar num nó uma vez, para ver o Passaporte abrir. É o seu plano B de explicação ao vivo.

---

## Atalhos

| Tecla | Ação |
|:---|:---|
| `F` | Presentation Stage (esconde os cards de dicionário) |
| `]` / `[` | próximo / anterior capítulo |
| `R` | traçar rota entre dois nós |
| `/` | achar um nó pelo nome |
| `M` | radar / visão geral |
| `E` | exportar PNG/SVG |
| `T` | tema claro/escuro |
| `0` | resetar enquadramento |
| `P` | **NÃO usar ao vivo.** Toca os capítulos sozinho e tira o ritmo das suas mãos. Serve no ensaio. |

---

## Material de bastidor (não é conteúdo de palco)

O card violeta traz paths e números de linha (`middleware.ts:226`, `model-router.ts:35`, `workspace-resolver.ts:36`). É prova documental para quem pedir o artefato depois. Ninguém numa mesa de mastermind lê número de linha.
