# Consolidação auditada da Academy v2 — relatório final

> Objeto: `eximia-academy-v2`, branch `integra/main-cory` (HEAD `d2b8083` no início),
> escopo `git diff origin/main...HEAD` — 40 commits, 263 arquivos, +39.060 / −722.
> Data: 2026-08-28. Modo: só Cloud. Escopo decidido pelo Senhor: **auditar e sanear, sem mexer em `main`**.
> `main` permanece intocada. Nenhum push, PR ou deploy foi feito (autoridade exclusiva do @devops).

---

## 1. Placar dos verificadores

| Verificador | Linha de base (18:35) | Agora | Delta |
|:---|:---|:---|:---|
| typecheck | 36 erros TS | **36** | 0 — 100% herdado de `main` |
| test · `ui` | 20 falhas / 11 arquivos | **20** | 0 — herdado |
| test · `agents` | 8 falhas / 1 arquivo | **8** | 0 — herdado |
| test · `shared` | 81 verdes | **81 verdes** | — |
| test · `course-designer` | 112 verdes | **112 verdes** | — |
| test · `web` | **41 falhas / 6 arquivos** | **22 falhas / 4 arquivos** | **−19** |
| Total de testes | 3.361 | **3.373** | **+12** |
| lint | 676 erros | 676 | 0 |

**Toda falha remanescente é herdada de `main` ou é um impasse que aguarda decisão do Senhor.**
Nenhuma falha introduzida pelos 40 commits sobreviveu sem tratamento.

Detalhe das 22 do `web`:

| Arquivo | Natureza |
|:---|:---|
| `login-form-google-oauth.test.tsx` | herdado de `main`, fora do escopo destes commits |
| `manager-dashboard.test.tsx` | herdado de `main`, fora do escopo |
| `epic-23-docs-vs-code.test.ts` (13) | **impasse RBAC** — decisão pendente, §5 |
| `epic-6-security-posture-doc.test.ts` (2) | bloqueadas pelo epic-23; ficam verdes sozinhas quando ele resolver |

---

## 2. O achado central: uma frente inteira morta em produção

**A frente "Aprendizagem do Time" — 3 telas, ~5.500 linhas, um pipeline que chama LLM — roda
sobre um schema que nunca foi aplicado ao banco.** Provado por consulta direta à produção, não
por leitura de código:

- `capability_evidence` tem **12 colunas**; faltam as **13** que o código assume. `SELECT count(comprehension)` falha com `42703`.
- As **5 tabelas novas** (`concepts`, `capability_concepts`, `capability_assessments`, e as duas de junção) **não existem**.
- `schema_migrations` **não registra nada de agosto**.
- As 853 linhas de `capability_evidence` são backfill único de 25/08. Zero gravações desde.
- `capabilities` existe com 15 linhas, mas com **outros nomes de coluna**: o código pede `title`/`slug`/`is_active`/`display_order`; o banco tem `name`/`code`/`order`. São 4 divergências, e o Postgres só reporta a primeira.

**O que o usuário via:** HTTP 200 e `column capabilities.title does not exist` impresso na tela.

O par de migrations existente era **mutuamente exclusivo por terreno** — cada uma só funcionava
no terreno que a outra não produzia. Não havia sequência capaz de levantar o schema do zero.

### Estado do tratamento

| Item | Estado |
|:---|:---|
| Migration convergente `20260828120000` | **Escrita e testada** em PostgreSQL real (PGlite 18.3), nos dois terrenos, com 4 sabotagens provando que o harness reprova. **NÃO aplicada** — aguarda o Senhor. |
| Link para a frente quebrada | **Contido.** Item oculto da barra de domínios; rota segue acessível por URL direta. |
| Plano de aplicação e rollback | Escrito, executável por quem não viu a análise (`LOOP-7-migration.md` §7 e §8) |

---

## 3. O segundo achado: a única fronteira entre clientes não tinha guarda

Os **7 filtros de tenant e de aluno** das consultas novas podiam ser deletados, um a um, e a
suíte permanecia 235/235 verde. O cliente Supabase nesse caminho é o **de serviço**, que
contorna RLS por definição — o `.eq("tenant_id", …)` da aplicação era a **única** fronteira
entre dois clientes pagantes no mesmo banco. Esta casa já teve esse incidente em 18/08/2026.

**Corrigido e provado.** Verificação independente (não do agente que escreveu): removi o filtro
de `capabilities` — justamente o arquivo que tinha cobertura zero — e a suíte reprovou em 3
testes. Restaurado, voltou a 48 verdes.

```
FAIL  A5 — `capabilities` não traz capacidade de OUTRO TENANT
FAIL  fecho — o retorno é EXATAMENTE o do meu tenant, nas quatro consultas
FAIL  espelho — lendo como o outro cliente, só as linhas DELE voltam
```

Os testes pinam a **intenção** (não vazar), não a chamada de `.eq` — alimentam o mock com dois
tenants e verificam o resultado. Refactor que mude a forma e preserve o isolamento continua
passando; o que perca o isolamento reprova.

Cobertos também os 2 gates de auth da mesma natureza: o ramo "sem sessão" de `/analytics` e o
gate de `/jornada`, ambos sem teste antes.

---

## 4. O padrão dominante: falha que se apresenta como sucesso

Varredura exaustiva de 159 arquivos de código não-teste: **37 ocorrências defeituosas** (mais 11
locais confirmados legítimos, documentados para não inflar a conta). A revisão por leitura tinha
encontrado 6 — era amostra, não lista.

Dois achados sistêmicos:

1. **8 rotas negam permissão quando não conseguiram verificá-la.** Leem o perfil sem checar erro
   e concluem `403` se vier vazio. Falha transitória vira "Permissão negada" para usuário
   legítimo. 7 são herdadas; a 8ª (`courses/route.ts`) é nova e **copiou o padrão defeituoso das
   irmãs**. Fail-closed (nega, não vaza). Zero testes.
2. **O banner de erro da Aprendizagem do Time só olha 1 de 3-4 fontes de falha**, nos 3 arquivos
   de montagem. **Sobreviveria à correção do schema**: uma falha de leitura continuaria
   indistinguível de "tela vazia por falta de dado".

Nenhuma das 37 tem teste que reprove o caminho de falha.

---

## 5. Decisão pendente do Senhor: RBAC do course-designer

O teste `epic-23` exige que as rotas do course-designer aceitem **2 papéis** (`manager`, `admin`).
O código aceita **4** (mais `super_admin` e `instructor`), uniformemente nas 6 rotas, desde o
import inicial. A asserção mede **as duas pontas** — não existe edição de documento que a satisfaça.

| Saída | Consequência |
|:---|:---|
| A política correta é **4** | O bloco B do teste mede a coisa errada e precisa ser reescrito |
| A política correta é **2** | 6 rotas que disparam LLM sobre o curso estão largas demais — mudança de código com impacto de autorização, e run POP-FIX própria |

**Recomendação de J.A.R.V.I.S.: 4 papéis.** `instructor` é quem cria e revisa conteúdo, e curso
desenhado por instrutor é o caso de uso normal da ferramenta. Mas a decisão é do dono do produto.

Enquanto não resolver, o épico 23 carrega aviso de que endereço de artefato e guarda de papel de
seus documentos **não servem como referência**.

---

## 6. Outros itens que pedem decisão

| # | Item | Por quê importa |
|:--|:---|:---|
| 1 | `manager` lê `capability_evidence` do tenant inteiro, sem recorte de equipe | A policy viva contradiz o comentário das migrations, que dizia ser exclusão deliberada. Uma das duas está errada, e é o comentário. **Anterior a esta rodada.** |
| 2 | `anon` e `authenticated` têm `TRUNCATE` em toda tabela de `public` | RLS **não cobre TRUNCATE**. Sistêmico, não desta frente. Pede `REVOKE` próprio. |
| 3 | `processadas` conta candidatos, não gravações | Com 100% de falha a rota responde `{ok:true, processed:20}`. Foi esta cegueira que manteve o defeito invisível. `paresTocados.size` já existe e daria o número honesto. |
| 4 | Vocabulário duplo em `source_type` (PT e EN) | Expand deliberado, não estado final. A contração exige decidir o idioma. Recomendação: inglês, como o resto do modelo. |
| 5 | 13 arquivos não versionados (~5,6 MB de HTML Archify + inventário com IDs de produção na raiz) | Derivados são reproduzíveis; originais não. Decisão é sobre o lote. |
| 6 | `/perfil` não tem entrada de navegação | Terceira "porta trancada por dentro" da mesma safra, depois de `/jornada` e da Aprendizagem do Time. |

---

## 7. O que ficou genuinamente bom

Registro porque relatório que só lista buracos é tão desonesto quanto suíte que só mostra verde.

- **Autogestão da Jornada passou a régua visual: 44/46 critérios (95,7%), barra de 90%.** As 3 telas rolam, nenhum overlay cobre nada, todo controle é alcançável, zero placeholder pendurado. As 2 falhas são cosméticas.
- **Isolamento por tenant está presente em toda consulta nova.** O código estava certo; o que faltava era a guarda. Agora tem.
- **O gate de papel da rota do gestor está pinado por mutação** — comentar a chamada reprova 6 testes, um por aba.
- **O vazio é caminho principal e isso é verificável** — 6 de 7 mutações reprovam.
- **Os limiares vivos têm par contraditório** (2 alunos → vazio, 3 → ok). É o padrão certo.
- **`epic-8` e `epic-9` fechados**, incluindo o inventário de dado pessoal que estava em Draft negando coleta em produção.
- **Nenhuma asserção foi desativada, pulada, afrouxada ou reescrita** para produzir verde.

---

## 8. Régua permanente deixada para trás

`scripts/mutacao.mjs` ganhou **37 mutantes novos** cobrindo as duas frentes — gates de auth,
limiares do classificador, fronteira de semana, janela das séries, estado vazio, e um exemplar de
cada uma das 5 formas de falha silenciosa. Antes cobria só a onda anterior.

**Duas lacunas honestas, ainda abertas:**
1. **Os 7 mutantes do Eixo A (filtros de tenant) não foram catalogados** — o agente caiu antes.
2. Os 37 novos ficam **fora do conjunto default** (`ROTULOS_PADRAO` são os 31 primeiros): só rodam com `--somente=`. Régua que não roda sozinha é candidata a virar decoração.

---

## 9. Dano colateral desta auditoria, e seu conserto

O `pnpm install` autorizado no worktree de baseline **reescreveu os symlinks do repositório
principal**, cruzando 113 deles pelo worktree — inclusive os 5 pacotes internos (`@eximia/ui`,
`shared`, `database`, `agents`, `course-designer`), que passaram a resolver para o **código de
`main`** em vez do desta branch. O Turbopack parou de subir.

**Consertado por repontamento cirúrgico** (não por reinstalação — com 6,3 GiB livres, apagar e
recriar `node_modules` poderia falhar no meio). Zero symlinks cruzados, zero quebrados.

**Medições revalidadas com o ambiente correto**: typecheck idêntico (36), `ui` idêntico (20),
`agents` idêntico (8), `shared` e `course-designer` verdes. Nenhum número da auditoria dependia
do estado avariado.

---

## 10. Estado da árvore

Nada foi commitado. Todo o trabalho está na árvore para revisão do Senhor.

| Área | Arquivos |
|:---|:---|
| Testes de isolamento (novos) | 4 arquivos em `lib/analytics/**/__tests__/` |
| Contenção | `lib/analytics/dominios.ts` + 2 consumidores + teste |
| Migration convergente | `supabase/migrations/20260828120000_*.sql` (nova) + 3 neutralizadas |
| Correção documental | `docs/epics/` (3), `docs/stories/` (5+) |
| Régua de mutação | `scripts/mutacao.mjs` |
| Inventário de limiters | `apps/web/src/lib/__tests__/rate-limit.test.ts` |
| Laudos desta auditoria | `docs/auditoria/consolidacao-2026-08-28/` (9 documentos + 18 capturas) |

---

## 11-BIS. Fechamento em 2026-08-29 — decisões do Senhor executadas

| Decisão | Estado |
|:---|:---|
| **Course-designer sai de escopo** ("precisamos refazer") | As 15 asserções vermelhas (13 do epic-23 + 2 do epic-6) permanecem **por decisão**, não por pendência. O impasse de RBAC não se resolve aqui. |
| **Aplicar a migration** | **APLICADA em produção.** `capability_evidence` 12 → 25 colunas; 853 evidências e 15 capacidades intactas antes e depois; árbitro único e não-parcial criado; 4 versões registradas em `schema_migrations`; RLS provada em transação revertida. Laudo: `APLICACAO-migration.md`. |
| **Reverter a contenção** | **REVERTIDA.** `oculto: true` removido, e o **campo que o hospedava removido junto** — um interruptor de ocultar parado no código convidaria a esconder a próxima tela quebrada em vez de consertá-la. Fica registro histórico datado apontando para `git log -S oculto`. |

**Prova de ponta a ponta das 3 telas** (app vivo, porta 3399, encerrado ao final):
`data-fonte="motor"` nas três, HTTP 200, **zero** ocorrências de `does not exist`, 6 headings por
tela (antes: 1 heading, 499 chars). Controle: forçando `?fonte=fixture` o marcador vira
`"fixture"` — o atributo distingue de verdade, então a medição é do produto, não do simulacro.

**O passo 6 do plano foi recusado, e a recusa foi correta.** Disparar o pipeline no tenant
descartável devolveria `{ok:true, processed:0}`: ele tem 0 capacidades, e das 19 sessões
existentes **nenhuma** tem profundidade numérica (o coletor descarta todas). Seria verde que não
prova nada. A gravação foi provada por SQL equivalente — as 19 colunas literais que o pipeline
emite, emitidas duas vezes para exercitar o `ON CONFLICT`, dentro de `BEGIN…ROLLBACK`. Zero LLM,
zero persistência, linha comprovadamente gravada.

**O que essa prova NÃO cobre, declarado:** ela usa `ON CONFLICT` com alvo explícito em SQL, não a
*inferência* de árbitro que o PostgREST faz a partir do parâmetro HTTP. A precondição está
provada (índice único e não-parcial), mas o caminho HTTP completo só se exerce quando o pipeline
rodar contra tenant com material real — hoje, só Cory (764 evidências) ou Vértice (83).

### Placar final

| Verificador | Início da auditoria | Fechamento |
|:---|:---|:---|
| test · `web` | 41 falhas / 6 arquivos | **22 falhas / 4 arquivos** |
| Total de testes | 3.361 | **3.384** |
| typecheck · `ui` | 36 erros | 36 — herdados |
| test · `ui` / `agents` | 20 / 8 | 20 / 8 — herdados |

As 4 áreas ainda vermelhas: 2 herdadas de `main` (fora do escopo destes commits) e 2 que são o
course-designer, que o Senhor tirou de escopo para refazer.

---

## 11-TER. Segunda rodada (30-31/08) — as correções, e o que elas revelaram

O Senhor cobrou: a auditoria tinha mapeado 37 ocorrências de "falha que se apresenta como
sucesso" e **nenhuma fora corrigida**. A cobrança era justa — eu havia apresentado a lista como
achado de relatório, não como trabalho a fazer. Segue o que a correção produziu.

### O censo cresceu quatro vezes, sempre pelo mesmo motivo

| Momento | Rotas com o defeito | Como foi descoberto |
|:---|---:|:---|
| Laudo original | 8 | revisão de código |
| Após varredura por texto | 47 | `grep` por `const { data: profile }` |
| Após 2º helper | +22 | outro helper escreve `const { data }` — invisível ao grep |
| Após censo **por mecanismo** | **6 caminhos** | quem lê `users` e decide direito, independente da grafia |

Os seis: `requireRole`, `require-admin.ts`, `super-admin-auth.ts`, chamadores de `getAuthProfile`
que descartam o erro, **guards locais sem nome** (invisíveis a qualquer busca por helper), e o
**`middleware.ts`**.

**A lição:** varredura pela forma do texto é cega para quem escreveu a mesma coisa com outras
palavras. Erramos três vezes seguidas antes de trocar a pergunta.

### O que foi corrigido

| Frente | Entrega |
|:---|:---|
| Pipeline (FIX-A) | rota nunca responde `ok:true` com zero gravações; julgamento do estado extraído de 3 cópias para `estado-tela.ts`; 4 constantes mortas apagadas |
| Rotas (FIX-B2/3/4/8) | 47 rotas + `requireCourseManager` (24 chamadores, 5 formas de tradução) |
| Origem (FIX-B6) | 2 helpers na origem, 29 + 27 handlers propagados |
| União (FIX-B7) | `requireAnyRole` para as 5 rotas que decidem por chapéus |
| Autogestão (FIX-C) | erro de leitura deixa de virar "zero pessoas"; gate 2 da marca existe **e é chamado** |
| Telas (FIX-D) | erro de banco não vaza SQL; `/perfil` alcançável (3ª "porta trancada por dentro") |
| Réguas (FIX-FUROS) | 3 furos fechados, 21 mutações vermelhas provadas |

### O que a verificação adversarial encontrou

**Nenhuma correção é decorativa** — 31 mutações em 3 rodadas, todas acusadas. Mas **três furos
estavam na rede que protege as correções**:

1. **As réguas pegavam alargamento de acesso e eram cegas ao estreitamento** — que é o defeito
   que esta auditoria inteira existe para corrigir. Remover `admin` da lista deixava a suíte
   verde. Passamos três dias caçando "negar a quem tem direito" e construímos guardas contra o
   defeito oposto.
2. **`|| true` no `Dockerfile`** desligava o gate da marca com o teste 2/2 verde.
3. **O 3º estado chegava aos 6 sítios invisíveis, mas nada o segurava ali.**

### Precisões que mudaram enunciados

- **A defesa estrutural é condicionada.** "Quem esquecer a linha não compila" é largo demais: o
  correto é *"quem esquecer a linha **e usar o perfil** não compila"*. Removendo também a
  referência ao perfil, o `tsc` cala e a rota fica sem guarda. Hoje os 16 consomem, então vale —
  é invariante por coincidência favorável documentada, não por construção.
- **`tenant_id` nulo ⟺ `super_admin`** é invariante de banco (`users_super_admin_tenant_check`,
  nunca derrubada) — **mas sobre `users.role`, não sobre chapéus.** Onde a decisão é por chapéu,
  a premissa não vale.
- ~~**O papel `leader` não existe neste banco.**~~ **CORRIGIDO em 31/08 pela verificação da 4ª
  rodada.** A migration citada diz "medido: admin, instructor, manager, student, super_admin" —
  isso é a **população de hoje**, não o que o schema aceita. A `users_role_check` vigente
  (`20260518000000_leader_role.sql`, sem migration posterior que a altere) **inclui `leader`**, e
  uma linha com esse papel é inserível agora. O caso de `leader` na matriz **mede de verdade** e
  deve ficar; o que precisa mudar é o comentário que instrui o próximo leitor a descartá-lo — quem
  fizer a "limpeza óbvia" reabre o furo que esta rodada fechou.
  *(Sobre `teacher` o raciocínio original está correto: saiu do `CHECK` em `20260228100000` e não
  voltou. Dois valores na mesma frase, vereditos opostos — é a diferença entre medir a população e
  ler a restrição.)*

### Storage: o achado que nenhuma auditoria de código veria

**Três buckets públicos servem arquivos a qualquer pessoa na internet, sem sessão.** Provado por
requisição sem cookie (`HTTP 206`) com controle negativo (`400` em caminho falso).

**Dois deles não existem em migration alguma** — foram criados direto no servidor. Só apareceram
quando alguém perguntou ao servidor em vez de ao repositório.

| Bucket | Exposição | Desfecho |
|:---|:---|:---|
| `books` | vazio | privado (autorizado) |
| `materials` | 2 PDFs, **0 registros na tabela** | privado (autorizado) |
| `chapter-assets` | 612 objetos, 746 URLs persistidas | **projeto próprio** — 606 (81%) migram sem tocar em dado |

Os 2 PDFs são material de divulgação da própria casa (Argos, metodologia ASP), varridos por
inteiro: sem dado pessoal, sem valores, sem menção a cliente. **A urgência inicial que atribuí a
eles estava errada e foi corrigida por quem os mediu.**

### Erros de método cometidos e registrados

Registro porque são o produto mais durável desta rodada:

| Erro | Quem | Lição |
|:---|:---|:---|
| `git diff` vazio usado como prova em arquivo **untracked** | um agente **e J.A.R.V.I.S.** | o `git diff` é vazio por construção; a prova é `mtime` ou conteúdo |
| Mutar o **tipo** sem tocar o **runtime** | 2 agentes | 5 verdes de silêncio |
| Mutar sobre estado que o **banco proíbe** | 2 agentes | vermelho de ficção — pior, porque convence |
| Controle positivo **sobre-determinado** | 1 agente | mutante de alargamento sobreviveu: régua cega |
| Régua que varre **por diretório** | J.A.R.V.I.S. | nunca fica vazia; pega arquivos de outros donos |
| `git checkout --` em árvore compartilhada | 1 agente | destruiu trabalho não commitado de outra frente |
| Mutador em modo texto normalizou **CRLF→LF** | 1 agente | `git diff` aprovaria; `shasum` acusou |
| Mutante **mal mirado** lido como sobrevivente | 1 agente | provar que o mutante foi aplicado antes de crer no verde |

**Regra que passou a valer:** nenhuma operação `git` mutante em árvore compartilhada; restauração
só por cópia. O hash detecta o estrago, não o desfaz.

### Placar

| | Início da auditoria | Agora |
|:---|:---|:---|
| `src/app/api` | 589 testes | **948** |
| `src/app` + `src/lib` | — | **3.280** |
| Suíte inteira | 3.361 | **4.156** |
| Falhas | 41 no `web` | 22, **todas** herdadas ou fora de escopo por decisão |

---

## 11. Próximos passos, em ordem de risco

1. **Decidir o RBAC** (§5) — destrava 15 asserções e fecha 2 runs POP-FIX.
2. **Aplicar a migration com o Senhor presente** — plano em `LOOP-7-migration.md` §7; rollback em §8.
3. Após aplicar: **reverter a contenção** (apagar `oculto: true`), cuja condição objetiva já está escrita no código.
4. Corrigir `processadas` para contar gravações (§6.3) — senão a próxima falha volta a ser invisível.
5. Fechar as lacunas da régua de mutação (§8).
6. Decidir os itens 1, 2, 4, 5 e 6 da §6.
