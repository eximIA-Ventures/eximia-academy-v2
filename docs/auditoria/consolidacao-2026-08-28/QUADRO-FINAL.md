# Quadro final — Academy v2, auditoria e consolidação (28 a 31/08/2026)

> Peça única para o Senhor. Detalhe em 31 laudos no mesmo diretório.
> **Nada commitado.** `main` intocada, 40 commits atrás de `HEAD`.
> 156 arquivos modificados, 83 novos, todos na árvore de trabalho.

---

## 1. O que estava errado, e o que se corrigiu

### Uma frente de produto estava morta em produção

"Aprendizagem do Time" — 3 telas, ~5.500 linhas, um pipeline que chama LLM — rodava sobre um
schema **que nunca foi aplicado ao banco**. O gestor não via "sem dados": via
`column capabilities.title does not exist` impresso na tela.

**Corrigido.** Migration de convergência aplicada em produção com o Senhor presente:
`capability_evidence` foi de 12 para 25 colunas, 853 evidências e 15 capacidades preservadas, e
as 3 telas passaram a renderizar contra o motor (provado por `data-fonte="motor"`, com a fixture
como controle).

### A única fronteira entre clientes não tinha guarda

7 filtros de tenant podiam ser deletados um a um com a suíte **235/235 verde**. O cliente é o de
serviço, que contorna RLS — aquele filtro era a única fronteira entre dois clientes pagantes.

**Corrigido e provado por mutação:** os 7 acusam hoje, com zero silenciosos, e entraram no harness
permanente.

### 37 ocorrências de "falha que se apresenta como sucesso"

A revisão de código achou 6; a varredura exaustiva achou 37. Rota respondendo `ok:true` com zero
gravações, leitura truncada marcada como completa, erro virando "zero pessoas", falha virando
"nada pendente", reclassificação repetida pagando LLM de novo.

**Corrigidas**, cada uma com teste que reprova o caminho de falha.

### O censo de rotas cresceu 4 vezes

| Momento | Rotas | Como se descobriu |
|:---|---:|:---|
| Laudo original | 8 | revisão de código |
| Varredura por texto | 47 | `grep` por uma grafia |
| 2º helper | +22 | outro helper escreve outra grafia |
| Censo **por mecanismo** | **6 caminhos** | quem lê `users` e decide direito |

**Todas corrigidas**, incluindo `requireCourseManager` com 24 chamadores e 5 formas de tradução.

### Segurança de banco: o que nenhuma auditoria de código veria

Achado do inventário servidor-contra-repositório, feito porque dois buckets apareceram no servidor
sem constar de migration.

**7 funções `SECURITY DEFINER` que escrevem eram executáveis pela chave pública do site.** Uma
delas apagava usuário por identificador, sem login. Outra **executou de fato** (`204`), reescrevendo
papel de usuário.

**Contido em 3 rodadas, 6 migrations versionadas:**

```
SECDEF alcançáveis por anon      22 → 15
dessas, que ESCREVEM              6 → 0
SECDEF sem search_path fixo      10 → 0
políticas de escrita sem recorte  2 → 0
```

Prova de fechamento: `25006` (erro de dentro do corpo) → `42501` (permissão negada antes de
entrar), com controle positivo em `200` provando que o canal continua vivo.

**Mais:** o recorte por equipe do gestor nunca chegara ao servidor — um gestor notificava qualquer
aluno do tenant. Corrigido. E `user_roles` tinha duas RLS rivais que, se "reconciliadas"
ingenuamente, permitiriam a um admin gravar a própria linha como super administrador.

### Storage

3 buckets públicos serviam 615 arquivos a qualquer pessoa, sem sessão. Os 2 PDFs expostos eram
material de divulgação da própria casa (varredura completa: sem dado pessoal, sem valores, sem
menção a cliente). `books` e `materials` fechados; `chapter-assets` (612 objetos, 746 URLs
persistidas, 81% migráveis sem tocar em dado) fica como projeto próprio.

---

## 2. Placar de testes

| | Início | Fim |
|:---|:---|:---|
| `src/app/api` | 589 | **948** |
| Suíte inteira | 3.361 | **4.156** |
| Falhas | 41 no `web` | **22** — todas herdadas de `main` ou fora de escopo por decisão do Senhor |

---

## 3. O que continua aberto

### Decisão do Senhor

| Item | Por quê importa |
|:---|:---|
| **RBAC do course-designer** | O teste exige 2 papéis, o código tem 4. Fora de escopo por decisão ("precisamos refazer"). Trava 15 asserções. |
| **`middleware.ts`** | Leitura falha vira **expulsão silenciosa**: o admin não vê erro, apenas se acha no painel de aluno. Não corrigido porque 503 em middleware derruba a navegação e a alternativa alarga acesso. **Maior blast radius do app.** |
| **`chapter-assets`** | 612 objetos públicos, material de curso de cliente. Migração para URL assinada. |
| **Migration órfã** | A migration aplicada em produção **nunca foi commitada** — existe só nesta árvore. É assim que nascem as "12 migrations só no servidor". **Ação mais barata do relatório.** |
| **`TRUNCATE` para `anon`** | Nas 81 tabelas, e o ACL padrão faz toda tabela futura nascer igual. Sem caminho conhecido hoje — pólvora seca. |
| **5 helpers de leitura alcançáveis por `anon`** | Só leem, mas são avaliados dentro das políticas de RLS. Revogar exige prova prévia. |
| **`tenant-assets`** | Bucket nunca criado; upload de logo do cliente e onboarding mortos. Migration escrita, **não aplicada**. |

### Trabalho mapeado sem dono

- `enrich`/`export` via `requireCourseManager` — 24 call sites, frente própria
- Contrato de retorno das 8 server actions — recomendação: **não mudar**; o ganho real sai com 2 linhas de instrumentação
- Poda da rota morta de quizzes, **depois** de corrigir a action que a UI usa
- 3 paginações com o mesmo desenho de truncamento silencioso
- Mutantes novos fora do conjunto padrão do harness — régua que não roda sozinha vira decoração

---

## 4. O aprendizado, que é o produto mais durável

Oito erros de método, cometidos **por nós**, durante a própria correção. Estão tabelados no
`RELATORIO-CONSOLIDADO.md` §11-TER. Os quatro que mais importam:

1. **`git diff` vazio não prova nada em arquivo untracked** — vazio por construção. Cometido por
   um agente **e por J.A.R.V.I.S.**, que reportou ao Senhor uma conclusão certa apoiada em
   evidência que não valia.
2. **Mutação sobre estado que o banco proíbe** produz vermelho de ficção — pior que silêncio,
   porque convence. E **mutar o tipo sem tocar o runtime** produz verde de silêncio.
3. **Controle positivo sobre-determinado**: um caso recusado por duas razões não mede nenhuma. Um
   mutante de alargamento de acesso sobreviveu com 78/78 verdes por causa disso.
4. **Varredura pela forma do texto** é cega para quem escreveu a mesma coisa com outras palavras.
   Erramos o censo 4 vezes antes de trocar a pergunta de "quem escreve esta string" para "quem faz
   esta coisa".

**Erro nº 9 — o único cometido consertando, não auditando.** As 7 migrations de segurança nomeavam
4 funções que **nenhuma migration define**. Em produção funcionam; num banco reconstruído do git,
**falham**. É a mesma classe do par mutuamente exclusivo corrigido no dia anterior, reintroduzida
por nós ao corrigir segurança.

Formulação da lição, do agente que a cometeu e corrigiu: *revisar uma migration pelo que ela faz em
produção, sem perguntar o que faria num banco vazio.* As 7 tinham controle positivo e negativo, e
**nenhuma dessas provas era capaz de ver isto** — porque todas foram feitas em terreno ocupado.

> **"Provei que fecha" e "provei que aplica" são duas perguntas, e a primeira não implica a segunda.**

**Corrigido** (`20260831125000`, timestamp anterior às revogações, aplicada **apenas no repositório**).
Ele **recusou** a correção barata (condicionar a revogação à existência): passaria verde em terreno
virgem **sem ter endurecido nada**, e a função nasceria depois com o ACL padrão aberto — o achado
nº 1 se reconstituindo em silêncio. Prova em terreno virgem: cenário sem a correção **falha** com a
mensagem literal do Postgres; com ela, aplica. E o controle que impede o falso "fechado":
**`anon` executa 4 de 4 logo após as definições, 0 de 4 após a revogação** — endureceu de verdade,
e é atribuível.

Subproduto medido ao vivo: em banco limpo, as funções **nascem** com `EXECUTE` para `anon`. O
mecanismo do achado nº 1, reproduzido num terreno virgem.

**Recorte declarado:** versionou as 4 funções, não os 3 gatilhos nem as colunas de que os corpos
dependem. **A sequência agora aplica em terreno virgem; o banco reconstruído ainda não é
funcionalmente equivalente à produção.** Isso é o achado das 12 migrations só do servidor, e é
trabalho próprio.

**E a ironia que resume tudo:** passamos a auditoria inteira perseguindo o defeito de **negar
acesso a quem tem direito** — e construímos, para proteger as correções, réguas que só pegavam o
defeito oposto. Cegas exatamente ao que viemos combater. Só se descobriu porque um verificador
entrou para **derrubar** em vez de confirmar.

O padrão, nomeado antes desta auditoria e confirmado por ela: **o instrumento responde com
precisão a uma pergunta que não é a pergunta.**
