# Decisões abertas — material para o Senhor decidir

> Produzido em 2026-08-30. **Tarefa 100% READ-ONLY.**
> Nenhum arquivo de produção alterado, nenhuma escrita em banco, nenhum DDL, nenhum commit.
> As consultas ao banco de produção foram feitas por sonda descartável (criada em `/tmp`,
> executada, apagada), com `SUPABASE_SERVICE_ROLE_KEY` e **apenas `SELECT`**. O MCP não foi
> usado, por proibição do briefing.

---

# 1. A largura de `chapter_slides_select`

## A política, e a irmã

```sql
-- 20260314000000_chapter_slides.sql:36
CREATE POLICY "chapter_slides_select" ON chapter_slides FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );

-- 20260228200000_quiz_tables.sql:69 — a irmã, para contraste
CREATE POLICY "qs_student_select" ON quiz_sessions FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() = 'student'
    AND is_active = true
    AND EXISTS (SELECT 1 FROM enrollments WHERE course_id = quiz_sessions.course_id
                AND student_id = auth.uid() AND status = 'active')
  );
```

## O alcance real, medido em produção (leitura)

```
tenant                  | usuarios | passam no RLS de slides | destes SEM chapéu autoral
Cory Alimentos          |    51    |          51             |          47
exímIA Academy          |     2    |           2             |           2
Harven Finance          |     1    |           1             |           0
Vértice Indústria       |   129    |         129             |         126
GAUNTLET (descartável)  |     2    |           2             |           2
TOTAL: 186 usuários, 5 tenants (1 usuário sem tenant, fora do alcance)
```

**Todo usuário do tenant passa.** Não há subconjunto: a política não olha papel nem matrícula,
então "quantos passam" é idêntico a "quantos existem". Os **177 sem chapéu autoral** (de 186)
leem hoje o material de autoria do próprio tenant.

## O contraste, no mesmo tenant e no mesmo material

Aplicando a régua da irmã (matrícula ativa no curso) aos capítulos que **de fato** têm slides:

| tenant | regra ATUAL (tenant) | regra por MATRÍCULA | capítulos com slides | delta |
|---|---:|---:|---:|---:|
| Vértice Indústria | 129 | 120 | 8 | **9** |
| Cory Alimentos | 51 | 30 | 8 | **21** |
| exímIA Academy | 2 | 1 | 8 | **1** |
| Harven Finance | 1 | 1 | 51 | 0 |

**31 usuários** leem hoje slides de cursos em que não estão matriculados. É o número que a
decisão custa ou economiza.

## O que exatamente está exposto

```
chapter_slides: 698 linhas, em 75 capítulos
text_status: { approved: 589, pending: 109 }
chapters por status: { published: 103 }   ← ZERO rascunhos hoje
```

**Correção da minha própria moldura no FIX-B8.** Eu escrevi "progresso de autoria de um capítulo
em rascunho". **Não há capítulo em rascunho hoje** — os 103 estão `published`. A exposição não é
zero (há **109 slides `pending`**, ou seja, material publicado com texto ainda por aprovar), mas
é menor do que a minha frase sugeria. Registro porque a frase era mais alarmante que o dado.

## Existe outra política igualmente larga no domínio de autoria?

**Sim, duas coisas — e a segunda é mais larga que esta.**

**(a) A própria migration se contradiz.** No mesmo arquivo, as outras três políticas de
`chapter_slides` **escopam por papel**:

| Política | Escopo |
|---|---|
| `chapter_slides_select` | `authenticated` + tenant |
| `chapter_slides_insert` | + `role IN ('admin','manager','instructor')` |
| `chapter_slides_update` | + `role IN ('admin','manager','instructor')` |
| `chapter_slides_delete` | + `role IN ('admin','manager')` |

Três de quatro aplicam o padrão de papel. **Isso é evidência forte de omissão, não de decisão de
projeto** — quem escreveu conhecia o padrão e o usou três vezes.

**(b) `chapter_assets` é mais larga, e cross-tenant.**

```sql
-- 20260210000003_epic12_multimodal_content.sql:13
INSERT INTO storage.buckets (id, name, public) VALUES ('chapter-assets','chapter-assets', true);
CREATE POLICY "chapter_assets_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'chapter-assets' AND auth.role() = 'authenticated');
```

O bucket de imagens e áudio dos capítulos é **`public = true`**, e a política de leitura **não
tem escopo de tenant nenhum**. Na prática o RLS ali é decorativo: bucket público é legível por
URL, sem sessão. As irmãs de `upload`/`delete` escopam por papel — de novo, só a leitura não.
Isto provavelmente é deliberado (`<img src>` e `<audio src>` sem assinar URL), mas é **material
de curso legível por qualquer um que tenha o link**, e o Senhor deveria saber disso ao decidir
sobre `chapter_slides`.

## A mudança, DESCRITA e NÃO aplicada

```sql
-- NÃO EXECUTAR sem o Senhor presente. DDL em produção.
DROP POLICY "chapter_slides_select" ON chapter_slides;

CREATE POLICY "chapter_slides_select" ON chapter_slides FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND (
      -- quem AUTORA vê tudo do tenant (mesma lista das irmãs insert/update)
      EXISTS (SELECT 1 FROM users WHERE id = auth.uid()
              AND role IN ('admin','manager','instructor'))
      -- quem ESTUDA vê os slides dos capítulos dos cursos em que está matriculado
      OR EXISTS (
        SELECT 1 FROM chapters c
        JOIN enrollments e ON e.course_id = c.course_id
        WHERE c.id = chapter_slides.chapter_id
          AND e.student_id = auth.uid() AND e.status = 'active'
      )
    )
  );
```

**Risco a medir antes:** o aluno precisa ler slides do curso em que está matriculado (é o
material da aula). A cláusula `OR` acima preserva isso; sem ela, a mudança **quebraria a
experiência do aluno**, que é pior que o problema. Uma verificação obrigatória antes de aplicar:
confirmar que a leitura de slides pelo aluno passa por esta tabela e não por outra via.

## Recomendação

**Estreitar, mas não agora e não isolado.** A evidência de omissão é forte (três de quatro
políticas escopam), e 31 usuários leem material de cursos alheios. Mas:

- **Custo de seguir:** DDL em produção, com risco de quebrar a leitura do aluno se a cláusula
  `OR` estiver errada. Exige o Senhor presente e uma verificação prévia do caminho de leitura do
  aluno.
- **Custo de não seguir:** 31 usuários continuam com alcance largo sobre 698 slides, dos quais
  109 ainda em elaboração. **O guard de rota que apliquei no FIX-B8 já fecha o caminho da API** —
  o que resta aberto é o acesso direto via cliente Supabase do navegador.

**Sugiro tratar junto com `chapter_assets`**, porque as duas são a mesma decisão ("o que do
material de curso é legível por quem?") e aplicá-las em momentos diferentes deixa a metade mais
larga em pé.

---

# 2. `quizzes` é rota morta?

## Varredura por construção, não por literal

```bash
# TODA construção de URL /api/courses/${...}/ no monorepo:
grep -rnoE '`/api/courses/\$\{[^}]*\}/[a-z-]*' apps --include='*.ts' --include='*.tsx'
   2 /api/courses/${course.id}/export
   1 /api/courses/${courseId}/generate-questions
   1 /api/courses/${course.id}/enrich
   1 /api/courses/${course.id}/generate-questions
```

**Nenhuma constrói `/quizzes`.** A varredura é por forma de chamada (template literal com
interpolação), que é justamente o que um `grep` por string literal perderia.

## O que eu esperava encontrar, e encontrei

A story 26.2 declara: *"AC8: API route `GET /api/courses/[courseId]/quizzes` lista quizzes do
curso"* e *"Componente `QuizList` com lista de quizzes"*. **O `QuizList` existe** —
`courses/[courseId]/quiz/_components/quiz-list.tsx`. E ele **não chama a rota**:

```tsx
useEffect(() => {
  listCourseQuizzes(courseId).then((res) => { setQuizzes(res.data as Quiz[]); ... })
}, [courseId])
```

`listCourseQuizzes` é uma **server action** (`courses/[courseId]/quiz/actions.ts:73`) que faz a
**mesma consulta** da rota — mesma tabela, mesmo filtro, mesma ordenação, mesmo `select` (menos
`created_by`). A rota e a action são gêmeas; a UI usa a action.

## O universo de chamadores possíveis está fechado

| Via | Pode chamar `/api/courses/[id]/quizzes`? | Por quê |
|---|---|---|
| UI desta aplicação | não chama | a única tela usa a server action |
| Integração externa / webhook | **não pode** | a superfície pública é `/api/v1/*` com `getV1Context` (chave de API); esta rota usa `createClient()`, que exige **cookie de sessão** |
| `apps/central` | não | nenhuma referência |
| App móvel | não existe | o monorepo tem `apps/central` e `apps/web`, só |

**Dado adicional:** `quiz_sessions` tem **0 linhas** em produção. A rota, hoje, só pode devolver
`{ data: [] }`.

## Veredito

**Órfã — não "não achei".** O universo de chamadores é limitado por desenho a um navegador com
sessão desta aplicação, e nenhum código desta aplicação a chama. A única possibilidade residual
é um cliente externo que compartilhe o cookie de sessão, que o desenho torna implausível.

Chamo isso de **órfã com alta confiança**, não NÃO-DETERMINADO, porque o limite é estrutural
(mecanismo de autenticação), não uma busca que pode ter falhado.

## Recomendação: poda, e um achado de brinde que vale mais

**Podar a rota.** Ela é uma gêmea sem chamador de uma server action que faz o mesmo. Custo de
podar: baixo (nenhum consumidor). Custo de não podar: uma rota autenticada a menos de superfície,
que a próxima auditoria terá de reexaminar. **Meus três testes `[TRAVA]` do FIX-B8 devem ser
removidos junto** — eles protegem uma rota que deixaria de existir.

**ACHADO NÃO PEDIDO, e é o mais grave desta página.** A server action que a UI **realmente** usa
tem o defeito que a rota não tem:

```ts
// courses/[courseId]/quiz/actions.ts:86
if (error) return { error: "Erro ao carregar quizzes", data: [] }

// quiz-list.tsx:33 — o consumidor
listCourseQuizzes(courseId).then((res) => { setQuizzes(res.data as Quiz[]); setLoading(false) })
```

O componente **lê `res.data` e ignora `res.error`**. Uma falha de banco devolve `data: []`, e a
tela desenha **"nenhum quiz"** — o E→ENGOLIDO clássico, indistinguível de "não há quizzes". Eu
protegi a **rota** (500 explícito) com um teste `[TRAVA]`; o caminho que os usuários de fato
percorrem continua engolindo. **Se podar a rota sem corrigir a action, a casa fica com o defeito
e sem a trava.** Recomendo tratar os dois na mesma rodada.

---

# 3. O contrato de retorno das 8 server actions

## O que existe hoje, depois do FIX-B8

| | Antes do FIX-B8 | Depois |
|---|---|---|
| Falha de leitura de perfil | toast `"Permissão negada"` (mentira) | toast `"Não foi possível verificar suas permissões agora. Tente novamente em instantes."` |

O usuário **já recebe a informação certa e acionável**, como texto. O que falta é a distinção em
forma legível por máquina.

## O tamanho da mudança, contado

| Camada | Arquivos | Detalhe |
|---|---:|---|
| Actions com o guard | **5** | 8 sítios de chamada; 23 funções exportadas |
| Componentes consumidores | **9** | **35** usos de `result.error` |
| Guard | 1 | já tem `mensagemDaRecusa()` |
| **Total** | **14 arquivos** | |

A mudança seria trocar `{ error: string }` por algo como
`{ error: string; motivo?: "indisponivel" }` em 23 funções, e nos 9 componentes trocar
`toast({ variant: "error", title: result.error })` por um ramo que distinga.

## O ganho concreto, e ele é menor do que parece

| Ganho candidato | Real? |
|---|---|
| Mensagem honesta ao usuário | **já obtido** pelo FIX-B8, sem mudar contrato |
| Botão "tentar de novo" no toast | marginal: nenhuma das ações perde estado ao falhar (a seleção de perguntas permanece), então "tentar de novo" é clicar o mesmo botão de novo |
| Variante visual distinta (aviso vs erro) | cosmético |
| **Instrumentar a taxa de indisponibilidade** | **real — e é o único que importa** |

## A alternativa de 1 arquivo que captura o ganho real

O guard já registra a ocorrência:

```ts
// lib/course-management-guard.ts:94
console.error(`[course-management-guard] leitura de perfil indisponivel para ${userId}:`, error)
```

`@sentry/nextjs` já está no projeto e é usado no servidor (`lib/sentry.ts`, `lib/question-generation.ts`,
`lib/course-enrichment.ts`). **Um `Sentry.captureException` ao lado desse `console.error` dá a
métrica de taxa de indisponibilidade mexendo em 1 arquivo em vez de 14** — e a métrica é o que
ninguém tem hoje.

## Recomendação

**Não mudar o contrato das 8 actions. Adicionar a captura no guard.**

- **Custo de seguir a recomendação:** 1 arquivo, 2 linhas. Perde-se o botão de nova tentativa
  (marginal) e a variante visual (cosmética).
- **Custo de fazer a mudança grande:** 14 arquivos, 35 pontos de alteração, risco de regressão em
  9 telas — para um ganho que, para o usuário, é quase todo já entregue pelo texto honesto.
- **Custo de não fazer nada:** continua sem métrica; ninguém sabe se a indisponibilidade acontece
  uma vez por mês ou cem vezes por dia. **Este é o custo que vale evitar**, e é o barato.

Se a métrica mostrar que a indisponibilidade é frequente, aí sim o contrato maior se justifica —
com dado, não com suposição.

---

---

# ADENDO 1 — `chapter-assets`: medido, não deduzido

> Acrescentado em 2026-08-30, a pedido. A contradição entre "política exige sessão" e "bucket é
> público" muda a gravidade em uma ordem de magnitude, e não podia ficar em aberto.

## A resposta, em uma linha

**SIM. Um estranho com a URL lê o arquivo, sem sessão, sem header, sem nada.**

```
══ SEM NENHUMA SESSÃO, SEM NENHUM HEADER (só 1 byte, range 0-0) ══
  chapter-assets  -> HTTP 206  content-type: audio/mpeg
  materials       -> HTTP 206  content-type: application/pdf

══ CONTROLE: a mesma URL COM a chave anônima ══
  chapter-assets  -> HTTP 206

══ CONTROLE NEGATIVO: caminho inexistente no mesmo bucket ══
  inexistente     -> HTTP 400
```

O `206` sem credencial é o veredito. O **controle negativo (`400`)** é o que impede o teste de
ser vácuo: se o serviço respondesse `206` para qualquer coisa, o primeiro número não valeria
nada. Ele responde `400` para caminho inexistente e `206` para objeto real — logo o `206` é o
arquivo sendo servido.

**A política `chapter_assets_read` não é consultada.** Em bucket público o Supabase serve o
objeto direto pela rota `/storage/v1/object/public/`. O `auth.role() = 'authenticated'` da
migration é decorativo. Minha frase original ("sem sessão") estava certa; a ressalva de que
exigiria sessão estava errada.

## Correção de um detalhe do enunciado

Os buckets **não** são `materials` e `biblioteca_books`. A verdade do servidor
(`storage.listBuckets()`, mais autoritativa que a migration) são **três**, e **os três são
públicos**:

```
chapter-assets         public=true
materials              public=true
books                  public=true
```

Só `chapter-assets` nasce de `INSERT INTO storage.buckets` numa migration; os outros dois foram
criados fora do versionamento — o que é, por si, um achado (ver
`project_academy_schema_fora_de_migration`, o mesmo padrão desta casa).

## O tamanho, e a diferença que decide a urgência

| Bucket | Objetos | Caminho adivinhável (sem UUID) |
|---|---:|---:|
| `chapter-assets` | **612** | **0** |
| `materials` | **2** | **2** |
| `books` | 1 | 0 |

**615 objetos legíveis sem sessão.** Mas os dois grupos têm exposição muito diferente:

- **`chapter-assets` (612):** todo caminho é `{tenant-uuid}/{chapter-uuid}/{arquivo-uuid}`. Não
  é enumerável por adivinhação. O risco é **vazamento de URL** — e URLs aparecem no HTML e no
  tráfego de rede de qualquer página, então basta um aluno copiar um link para que ele funcione
  para sempre, para qualquer pessoa, inclusive de outro tenant.
- **`materials` (2):** nomes planos e legíveis — `treinamento-asp-rev0.pdf` e
  `treinamento-asp-rev0-2.pdf`. **Enumeráveis por adivinhação.** Eu cheguei ao segundo pela forma
  óbvia do primeiro, e ele respondeu `206`. São dois PDFs de treinamento de cliente.

## Gravidade e recomendação

**Isto passa à frente dos 31 usuários dos slides.** Lá o alcance é de membros do mesmo tenant,
autenticados. Aqui é **qualquer pessoa na internet**, sem conta, e atravessa tenant.

Recomendo, em ordem:

1. **`materials` primeiro** — 2 objetos, nomes adivinháveis, conteúdo de cliente. É o único caso
   em que a exposição não depende de vazar URL nenhuma.
2. **`chapter-assets` depois**, com cuidado: virar o bucket privado **quebra `<img src>` e
   `<audio src>`** de todas as telas de capítulo, a menos que se passe a assinar URL
   (`createSignedUrl`). É trabalho real de aplicação, não um `UPDATE` de uma coluna. Custo de não
   fazer: 612 objetos permanentemente legíveis para quem tiver o link.
3. **`books`** junto do segundo, mesma natureza.

**Nenhuma alteração foi feita.** Não virei bucket, não criei objeto, não escrevi política. A
decisão de `public=false` + URLs assinadas é do Senhor, e tem custo de aplicação que precisa ser
orçado antes.

---

---

# ADENDO 2 — `listCourseQuizzes` + `QuizList`: a falha que o usuário via desenhada

> Acrescentado em 2026-08-30. Correção dos **dois lados**, conforme instruído.
> **A rota órfã NÃO foi podada** — poda é decisão do Senhor, e eu mesmo argumentei que podá-la
> sem corrigir a action deixaria a casa com o defeito e sem a trava.

## O defeito, no caminho vivo

```ts
// actions.ts — as duas pernas de FALHA carregavam lista vazia
if (!user)  return { error: "Não autorizado",        data: [] }
if (error)  return { error: "Erro ao carregar quizzes", data: [] }

// quiz-list.tsx — o consumidor lê `data` e ignora `error`
listCourseQuizzes(courseId).then((res) => { setQuizzes(res.data as Quiz[]); setLoading(false) })
```

Resultado na tela: **"Nenhum quiz criado ainda"**, com o convite *"Crie um quiz para avaliar o
aprendizado dos alunos"*. O instrutor conclui que o curso está vazio e cria um quiz duplicado,
ou desiste. É o único caso desta rodada em que o **usuário final vê a mentira desenhada**.

## Vermelho ANTES

```
 × erro de banco NÃO pode desenhar o estado vazio
 × erro de banco precisa DIZER que falhou, e oferecer nova tentativa
   → Unable to find an element with the text: /não foi possível carregar/i
 ✓ [CP] lista genuinamente vazia CONTINUA desenhando o vazio
 ✓ [CP] lista com quizzes continua desenhando os quizzes
 × [CP] sem sessão também não pode virar 'nenhum quiz'
      Tests  3 failed | 2 passed (5)
```

O teste exercita a **costura real**: o duplo é o cliente Supabase e a action de verdade roda
contra ele. Mockar a action mediria o componente contra a minha suposição do que ela devolve — e
é exatamente essa suposição que estava errada.

## A correção, dos dois lados

**Action:** a perna de falha deixou de carregar `data`. Não é estilo, é a trava: com
`{ error } | { data }`, ler `res.data` sem separar os casos vira erro de propriedade
inexistente. Mais `console.error` para haver rastro.

**Componente:** ganhou o terceiro estado (`erro`), um ramo próprio que **diz que falhou** e um
botão **"Tentar novamente"** que re-executa a leitura.

## O achado sobre a minha PRÓPRIA suíte, e ele quase passou

Mutei a action para devolver `data: []` junto do erro. **Os 5 testes de tela continuaram
verdes.** O motivo: o componente corrigido checa `"error" in res` primeiro e nunca chega ao
`data`.

O teste de tela mede o comportamento do **consumidor atual**. O `data: []` na perna de falha é o
convite para o **próximo** consumidor repetir o colapso — e nenhum teste de tela pega isso,
porque o próximo consumidor ainda não existe. Escrevi um segundo arquivo que tranca a **forma**
da action, e só então o mutante morreu:

```
══ MUTANTE: data: [] volta junto do erro ══
 × listCourseQuizzes — erro de banco: devolve `error` e NÃO devolve `data`
   → expected true to be false
      Tests  1 failed | 8 passed (9)

══ MUTANTE 2: o componente volta a ignorar o erro ══
 × erro de banco NÃO pode desenhar o estado vazio
 × erro de banco precisa DIZER que falhou, e oferecer nova tentativa
 × [CP] sem sessão também não pode virar 'nenhum quiz'
      Tests  3 failed | 6 passed (9)
```

Um mutante de cada lado, cada um matando o teste do seu lado. É o que prova que a correção de
duas pontas está medida nas duas.

## Reincidência minha, registrada

Ao tipar o retorno da action escrevi `{ error: string; data?: never } | { error?: never; data: unknown[] }`.
O `tsc` reprovou no chamador (`res.error` virou `string | undefined`): com `?: never` a
propriedade está **declarada**, então `"error" in res` deixa de discriminar. **É exatamente a
armadilha que eu havia documentado no FIX-B8 poucos minutos antes, e caí nela de novo.** A forma
correta é omitir os campos: `{ error: string } | { data: unknown[] }`.

## Fora de escopo, registrado e não tocado

No **mesmo arquivo**, `listCourseQuestions` e `listCourseChapters` mantêm a forma
`return { error: "...", data: [] }`. Não as toquei (o escopo era a gêmea do `QuizList`), mas elas
são o mesmo convite ao colapso, e valem uma rodada própria com o mesmo par de testes.

---

---

# ADENDO 3 — O que são os 2 PDFs, e o custo real de fechar cada bucket

> Acrescentado em 2026-08-31. **Leitura apenas.** Nenhum `UPDATE`, nenhum DDL, nenhum objeto
> movido ou apagado. Os PDFs foram baixados para `/tmp`, classificados por **contagem de
> marcadores** (não por transcrição) e apagados no mesmo comando.

## A resposta curta, e ela desmonta a premissa da tarefa

**A tabela `materials` tem ZERO linhas.** O bucket tem 2 objetos. Logo:

- **Não há URL persistida para invalidar.** A preocupação de que fechar o bucket quebraria
  endereços gravados **não se aplica a `materials`** — não há registro apontando para eles.
- Os 2 arquivos são **órfãos**, e não foram sequer produzidos pelo app: `uploadMaterial` grava em
  `{tenantId}/{uuid}-{nome}`, e estes estão **na raiz, com nome plano**. Foram colocados à mão
  (dashboard do Supabase ou versão anterior), em **2026-02-11, com 10 segundos de diferença**.
- `last_accessed_at` é **idêntico ao `created_at`** nos dois: nunca foram acessados pelo storage
  desde que subiram.

## Os 2 arquivos, identificados

| | `treinamento-asp-rev0.pdf` | `treinamento-asp-rev0-2.pdf` |
|---|---|---|
| Tamanho | 2,55 MB | 5,11 MB |
| Páginas | 30 | 97 |
| Criado | 2026-02-11 21:50:06Z | 2026-02-11 21:50:16Z |
| Título (metadado) | `SlideModel Free PowerPoint Templates` | idem |
| Autor (metadado) | `SlideModel` | idem |
| Assunto real (1ª linha) | **"TREINAMENTO ANÁLISE E SOLUÇÃO DE PROBLEMAS — Argos Consultoria"** | idem |
| Tenant | **nenhum** — objeto órfão, fora do padrão `{tenantId}/…` | idem |
| Quem subiu | **não rastreável** — sem linha em `materials`, e o storage não guarda autor | idem |

O nome **não** identificava: "asp" é a sigla de **Análise e Solução de Problemas**. O metadado
tampouco — `Title` e `Author` são do template gratuito SlideModel, não do documento. Foi preciso
abrir para classificar, como previsto.

## Classificação: **público / divulgação — material da própria casa**

Varredura de marcadores no **documento inteiro** (não só nas primeiras páginas), sem transcrever:

| Marcador | rev0 (1.203 palavras) | rev0-2 (4.986 palavras) |
|---|---:|---:|
| CPF / CNPJ | 0 | 0 |
| Valores em R$ | 0 | 0 |
| "confidencial" / "restrito" / "uso interno" | 0 | 0 |
| E-mail | 0 | 0 |
| Telefone | 0 | 0 |
| Nome de cliente (Cory, Vértice, Harven, Sumitomo) | 0 | 0 |

**Não é material de cliente.** É treinamento de metodologia da **Argos Consultoria**, a casa do
próprio Senhor — a mesma metodologia dos 7 passos que o `POP-FIX-001` já usa. `rev0-2` é a
revisão expandida de `rev0` (97 páginas contra 30), subida 10 segundos depois.

**Correção da minha própria frase do Adendo 1:** eu escrevi "dois PDFs de treinamento de
cliente". Estava errado — são material **da casa**, sem dado de cliente algum. A urgência que eu
atribuí a `materials` cai bastante: o que está exposto é conteúdo didático próprio, não dado de
terceiro.

## Custo de migração, medido, bucket a bucket

### `materials` — trivial

| Item | Medida |
|---|---:|
| Registros a reescrever | **0** (tabela vazia) |
| Sítios que geram/leem a URL | **2** (`lib/utils/material-upload.ts`, `components/materiais/materiais-page-client.tsx`) |
| `createSignedUrl` resolve sem mudar schema? | **Sim** — o `storagePath` é derivável de `{tenantId}/{uuid}-{nome}`; e com 0 linhas, nem isso é preciso hoje |

**É pequeno como parecia, e menor ainda: são minutos.** Como não há linha nenhuma, a decisão
nem precisa de migração de dados — basta virar o bucket e ajustar os 2 sítios para assinar URL
antes do primeiro upload real. **Os 2 órfãos podem simplesmente ser removidos**, se o Senhor
quiser: nada no produto os referencia.

### `books` — nada a fazer

| Item | Medida |
|---|---:|
| Objetos no bucket | **0** (só uma pasta vazia, `11111111-…`) |
| Linhas na tabela `books` | **0** |
| Sítios que tocam o bucket | 9 arquivos |

Bucket público, mas **vazio**. Exposição atual: zero. Os 9 sítios são custo futuro, não presente.

### `chapter-assets` — aqui a sua frase ao Senhor estava certa

**Sim, a URL pública é persistida — em três colunas, 746 linhas:**

```
chapters.audio_url:          24 de 103 linhas
chapters.slide_audio_url:    24 de 103 linhas
chapters.video_url:           0 de 103 linhas
content_ingestions.source_url: 0 de   0 linhas
chapter_slides.image_url:   698 de 698 linhas
```

**Mas há um alívio que barateia a maior parte:** `chapter_slides` guarda também o caminho.

```
chapter_slides: 698 linhas | SEM image_storage_path: 92
  -> 606 com caminho podem assinar URL sem reescrever nada
  ->  92 sem caminho exigem derivar o caminho da URL gravada
```

Ou seja, dos 746 endereços gravados: **606 (81%) migram sem tocar em dado**, bastando trocar
`getPublicUrl` por `createSignedUrl` a partir de `image_storage_path`. Os outros **140** (92
slides sem caminho + 48 áudios de capítulo) precisam de derivação a partir da URL, ou de uma
coluna de caminho nova para os áudios — que `chapters` não tem.

**Correção do que eu disse no Adendo 1:** eu tratei `chapter-assets` como "depois, com cuidado".
A medição refina: **é caro nos 140, e barato nos 606.**

## ACHADO NÃO PEDIDO — o bucket `tenant-assets` não existe

Dois componentes gravam nele:

```
components/admin/logo-upload.tsx:61       supabase.storage.from("tenant-assets")…
components/onboarding/step-welcome.tsx:59 supabase.storage.from("tenant-assets")…
```

E `listBuckets()` devolve **apenas três**: `chapter-assets`, `materials`, `books`. **Não há
`tenant-assets`.** Ou o upload de logo do tenant e o passo de boas-vindas do onboarding falham
em produção, ou falham em silêncio. Não exercitei as telas (tarefa read-only) — registro como
**suspeita forte, não veredito**, e vale uma verificação de quem for dono do onboarding.

## Recomendação, revista pela medição

| Bucket | Exposição hoje | Custo de fechar | Recomendação |
|---|---|---|---|
| `materials` | 2 PDFs órfãos, **conteúdo da própria casa**, sem dado de cliente | **minutos** — 0 registros, 2 sítios | Fechar, e **remover os 2 órfãos**; nada os referencia |
| `books` | **nenhuma** (vazio) | 9 sítios, custo futuro | Fechar agora, enquanto é grátis |
| `chapter-assets` | 612 objetos, 746 URLs gravadas | **606 baratos, 140 caros** | Tratar como projeto próprio; começar pelos 606 via `image_storage_path` |

**A ordem que eu recomendava mudou.** No Adendo 1 pus `materials` como o mais urgente, por supor
conteúdo de cliente. Com o conteúdo classificado, a urgência real é: **`books` primeiro** (grátis
agora, caro depois), **`materials` em seguida** (minutos), e **`chapter-assets`** como trabalho
planejado — que é onde estão os 612 objetos e a única exposição de material de curso de cliente.

---

---

# ADENDO 4 — `tenant-assets`: **CONFIRMADO**, e a falha é **visível**, não silenciosa

> Acrescentado em 2026-08-31. Nenhum bucket criado, nenhuma flag alterada, nenhum objeto gravado
> (as tentativas falharam por não existir o bucket, que é o próprio achado). Servidor de teste
> subido e encerrado.

## Veredito

**CONFIRMADO** — o bucket não existe e os dois uploads falham. **Mas a falha é VISÍVEL**, com
mensagem na tela, e **nada é persistido**. Não é a família da falha silenciosa.

## A prova, com controle

```
GET /storage/v1/bucket/{nome}  (service_role, leitura)
  tenant-assets    -> {"statusCode":"404","error":"Bucket not found","code":"NoSuchBucket"}
  chapter-assets   -> 200  {"id":"chapter-assets", public:true, …}
  materials        -> 200
  books            -> 200
```

E o upload real, com a **chave anônima** — exatamente o que o navegador faz:

```
POST /storage/v1/object/tenant-assets/{tenant}/logo.png        -> {"message":"Bucket not found"}
POST /storage/v1/object/tenant-assets/{tenant}/avatars/u1.png  -> {"message":"Bucket not found"}

CONTROLE, num bucket que EXISTE:
POST /storage/v1/object/chapter-assets/…  -> {"message":"new row violates row-level security policy"}
```

O controle é o que impede o teste de ser vácuo: num bucket existente o erro é **outro**
(`row-level security`), o que prova que a sonda alcança a costura real e distingue "bucket
ausente" de qualquer outra recusa. Nenhum objeto foi criado em nenhum dos dois casos.

Alvo das tentativas: **tenant descartável (GAUNTLET)**. Nunca Cory nem Vértice.

## O que o usuário vê, lido no código e coerente com o medido

| Componente | Tratamento | O que aparece |
|---|---|---|
| `admin/logo-upload.tsx:57` | `if (uploadError) { setError(uploadError.message); setPreview(currentUrl \|\| null); return }` | **"Bucket not found"** — cru, em inglês; o preview local volta ao logo anterior |
| `onboarding/step-welcome.tsx:57` | `if (error) { setUploadError(\`Erro no upload: ${error.message}\`); return }` | **"Erro no upload: Bucket not found"** |

**O resultado observado é o que o código prevê.** Não há `catch` que engula: os dois têm
checagem explícita do `error` e `return` antes de propagar. **Não é o padrão das 37 ocorrências.**

## Nada é persistido — verificado no consumidor

Os dois só chamam o callback **depois** do sucesso:

- `logo-upload` → `onUpload(finalUrl)` após o `getPublicUrl`, inalcançável no erro.
  O pai (`admin/configuracoes/_components/org-data-form.tsx:134`) faz `onUpload={setLogoUrl}`, ou
  seja, no erro o formulário **mantém o valor anterior**. Se o admin salvar, salva o logo antigo.
- `step-welcome` → `onChange(publicUrl)` idem.

**Nenhum ponteiro para arquivo inexistente é gravado.** Este é o desfecho bom dentro do defeito:
falha limpa, não sujeira no banco.

## O limite honesto: parei na parede de login

Subi o app (`./node_modules/.bin/next dev -p 3131`, `/login` → **HTTP 200**) e as duas telas
respondem **307 para `/login`**:

```
  /admin/configuracoes   -> HTTP 307  Location: http://localhost:3131/login
  /onboarding            -> HTTP 307  Location: http://localhost:3131/login
  /login                 -> HTTP 200
```

**Não exercitei o clique real**, porque entrar exigiria credenciais que não tenho, e fabricar um
usuário é escrita — em tenant real, o caso que o briefing manda parar e reportar. O que substitui
o clique é mais forte que uma captura de tela: **reproduzi a chamada HTTP exata que o componente
faz, com a mesma chave anônima**, e li o tratamento das duas pontas. Servidor encerrado.

## A correção EXIGE criar o bucket — parado, conforme instruído

O defeito é a ausência do bucket. Corrigi-lo é `createBucket("tenant-assets")` em produção,
**escrita que precisa do Senhor** — ainda mais depois de hoje termos descoberto que `materials` e
`books` foram criados fora do versionamento. **Não criei.**

Quando for criado, duas decisões acompanham, e nenhuma é minha:

1. **`public` true ou false?** Logo de cliente aparece em `<img>`; público é o caminho fácil e
   repete exatamente o problema que a casa está fechando hoje nos outros buckets. Recomendo
   **privado + URL assinada** — é bucket novo, sem endereço legado para invalidar, ou seja, o
   momento mais barato que existirá.
2. **Nascer numa migration**, não pelo dashboard. É o que separa este bucket dos dois que
   apareceram sem versionamento.

## O que eu fiz, e que não exige o bucket: a rede

Os dois componentes **não tinham teste nenhum**. A propriedade que medi — falha visível, nada
propagado — não estava travada por nada, e o pior desfecho possível aqui é alguém "limpar" o
tratamento de erro e transformar a falha visível numa tela que parece ter salvo o logo.

`components/admin/__tests__/upload-que-falha-nao-pode-calar.test.tsx` — 4 casos, verdes.
Como nasceram verdes, **mutei** o componente para engolir o erro (removendo o bloco
`if (uploadError)`), que é a degeneração exata que eles existem para impedir:

```
 × falha do storage APARECE para o administrador
   → Unable to find an element with the text: /bucket not found/i
 × falha do storage NÃO propaga URL nenhuma ao formulário
   → Unable to find an element with the text: /bucket not found/i
      Tests  2 failed | 2 passed (4)
```

Mutante morto; arquivo restaurado e conferido com `diff` contra o backup. Os 2 verdes que
sobrevivem são os controles positivos (sucesso continua propagando a URL; tipo inválido continua
barrado antes de tocar no storage) — sem eles, "nunca chame `onUpload`" ficaria verde e o
componente pararia de funcionar quando o bucket existir.

## Recomendação

| | |
|---|---|
| Gravidade | **Média** — funcionalidade morta (logo de cliente e foto de onboarding), mas falha limpa e legível como erro |
| Agravante | A mensagem é **"Bucket not found"**, em inglês, para um administrador de cliente configurando a identidade da própria empresa. Ele vê um termo de infraestrutura e não sabe se a culpa é do arquivo dele |
| Ação | Criar `tenant-assets` **privado, por migration** — decisão e execução do Senhor |
| Enquanto não | A rede de testes impede que a falha vire silenciosa |

---

# Resumo das três recomendações

| # | Questão | Recomendação | Custo de seguir | Custo de não seguir |
|---|---|---|---|---|
| 1 | `chapter_slides_select` | **Estreitar**, junto com `chapter_assets`, com o Senhor presente | DDL em produção; risco de quebrar leitura do aluno se o `OR` estiver errado | 31 usuários com alcance largo sobre 698 slides (109 em elaboração); a API já está fechada pelo guard |
| 2 | `quizzes` | **Podar** a rota, **e corrigir a action gêmea** que engole erro | baixo; remover 3 testes `[TRAVA]` junto | superfície autenticada órfã + o E→ENGOLIDO fica sem trava |
| 3 | Contrato das 8 actions | **Não mudar.** Adicionar `Sentry.captureException` no guard | 1 arquivo, 2 linhas | seguir sem métrica de indisponibilidade |

# Onde NÃO consegui medir

- **Se algum cliente externo compartilha o cookie de sessão** para chamar `/quizzes`. Não é
  determinável a partir do repositório. Considero implausível pelo mecanismo de autenticação
  (integrações usam chave de API em `/api/v1/*`), mas não é prova.
- **Se a leitura de slides pelo aluno passa por `chapter_slides`** ou por outra via. É a
  verificação obrigatória antes de aplicar a mudança da questão 1, e exige exercitar a tela do
  aluno — não fiz, por ser tarefa read-only sem navegador.
- **A frequência real da indisponibilidade de leitura de perfil.** É exatamente o que não existe
  hoje, e o que a recomendação 3 propõe passar a medir.

# Comandos de evidência

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2

# as políticas
sed -n '36,78p' supabase/migrations/20260314000000_chapter_slides.sql   # 3 de 4 escopam por papel
sed -n '13,18p' supabase/migrations/20260210000003_epic12_multimodal_content.sql  # bucket public=true
sed -n '69,80p' supabase/migrations/20260228200000_quiz_tables.sql      # a irmã, com matrícula

# a varredura por construção (questão 2)
grep -rnoE '`/api/courses/\$\{[^}]*\}/[a-z-]*' apps --include='*.ts' --include='*.tsx'

# o consumidor real do QuizList
grep -n "listCourseQuizzes" "apps/web/src/app/(platform)/courses/[courseId]/quiz/_components/quiz-list.tsx"
grep -n -A14 "export async function listCourseQuizzes" "apps/web/src/app/(platform)/courses/[courseId]/quiz/actions.ts"

# o tamanho da questão 3
grep -rl "createCourse\|createChapter\|approveQuestion\|batchApproveQuestions\|approveSource" \
  apps/web/src/app --include='*.tsx' | grep -v actions.ts | wc -l    # 9 componentes
```

As consultas ao banco foram feitas por sonda descartável em `/tmp`, somente `SELECT`, já
apagada. Nenhum arquivo de produção foi alterado por esta tarefa.
