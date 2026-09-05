# LOOP-0c — Varredura exaustiva: falha que se apresenta como sucesso

> Medido em 2026-08-28, HEAD `d2b8083`, branch `integra/main-cory`. 100% read-only.
> Universo bruto do diff: `git diff --name-only origin/main...HEAD | grep -E '\.tsx?$' | wc -l` → **221**
> arquivos `.ts`/`.tsx`. Descontando testes (`__tests__`, `.test.`, `tests/`): **159 arquivos de
> código-fonte de produção**, universo efetivamente varrido linha a linha para o padrão. Os 62
> arquivos de teste restantes foram usados só para responder "existe teste que reprova?", não
> para procurar o padrão neles mesmos (teste que engole erro é outro problema, fora do escopo
> pedido).
>
> Ponto de partida: o laudo de Aria (`LOOP-1-tecnico.md`) já nomeia 6 ocorrências no eixo (e)
> — não 5: **C-3, A-1, A-2, A-5, A-6, M-1**. Esta varredura parte deles, mas os trata como
> amostra a confirmar, não como teto.

## Resposta direta à pergunta final

**Os 6 (não 5) casos de Aria eram amostra, não a lista completa.** A varredura exaustiva
encontrou **34 ocorrências adicionais** do padrão nos 159 arquivos, das quais **31 são
defeituosas** (3 das adicionais são legítimas e por isso não entram na conta de defeito). Somando
aos 6 de Aria (todos confirmados por leitura própria e citados com evidência de dois lados),
o total de **ocorrências defeituosas é 37**, distribuídas nas 5 formas pedidas. O achado mais
grave que a revisão de código não nomeou é sistêmico, não pontual: **8 rotas de API inteiras
compartilham o mesmo E→NEGA** (checagem de perfil sem checar erro de leitura), e **os 3
arquivos de montagem da "Aprendizagem do Time" (visão geral, mapa, padrões) descartam o sinal
de falha de leitura de `avaliacoes`/`evidencias`/[`alunos`/`conceitos`] no gate que decide se a
tela mostra banner de erro** — o mecanismo de honestidade (`FalhaLeitura`, `MotivoVazio.
falha-de-leitura`) existe e é usado corretamente na CAMADA DE LEITURA, mas é descartado na
CAMADA DE MONTAGEM antes de chegar à tela, em 3 lugares idênticos.

**Cobertura por teste que reprova:** de todas as ocorrências defeituosas encontradas nesta
varredura (as 31 novas + as 6 de Aria), **nenhuma tem teste que reprova o caminho de falha**.
Onde não pude confirmar por leitura com certeza suficiente, declarei NÃO-DETERMINADO em vez de
chutar (ver coluna "Teste" de cada tabela).

---

## CRÍTICOS desta varredura (além dos 3 já nomeados por Aria)

Nenhum novo CRÍTICO isolado, mas um achado eleva o risco dos CRÍTICOS já registrados: o defeito
de montagem (abaixo, tabela E→VAZIO #1) significa que, **mesmo depois de C-2/C-3 corrigidos**,
uma falha de leitura em `capability_assessments` ou `capability_evidence` (não só em
`capabilities`) continuará invisível ao gestor — o defeito de montagem é uma segunda porta para
o MESMO sintoma que C-3 descreve ("115/118 numa tela que não faz nada"), aberta em paralelo à
que Aria já fechou.

---

## E→SUCESSO — caminho de erro retorna status de sucesso

| # | Arquivo:linha | O que o usuário vê | Severidade | Teste |
|---|---|---|---|---|
| 1 (=C-3 de Aria) | `lib/analytics/aprendizagem-time/classificador/index.ts:78-105` + `app/api/analytics/aprendizagem-time/classify/route.ts:44-49` | `{"ok":true,"processed":20}` com 100% dos upserts falhando | CRÍTICO (já registrado por Aria) | NÃO-COBERTO |
| 2 (novo) | `app/api/course-designer/blueprints/[blueprintId]/apply/route.ts:224-234` | O "Step 4" (`UPDATE course_blueprints SET status='applied', applied_at=...`) não checa `{ error }` — se essa escrita falhar, a rota responde `{ success: true, courseId, chaptersCreated, questionsCreated }` do mesmo jeito. O manager vê "blueprint aplicado com sucesso", mas o registro do blueprint continua com `status` antigo (provavelmente `approved`), podendo ser reaplicado depois pelo mesmo botão. | ALTO — mesma classe do C-3 (a escrita que fecha a operação some sem que o `success:true` saiba) | NÃO-COBERTO |
| 3 (novo) | `app/api/course-designer/generate/route.ts:230-232` | `dispatchEvent(profile.tenant_id, "blueprint.generated", {...}).catch(() => {})` — o webhook de notificação externa falha em silêncio TOTAL, nem `console.error`. A rota já respondeu `{status:"completed"}` antes disso via SSE; o cliente do webhook (integração externa do tenant) nunca sabe que o evento não chegou. | MÉDIO — não corrompe dado interno, mas quebra integração de terceiro sem qualquer rastro | NÃO-COBERTO |

## E→VAZIO — erro vira array/objeto vazio, indistinguível de "não há dados"

| # | Arquivo:linha | O que o usuário vê | Severidade | Teste |
|---|---|---|---|---|
| 1 (novo, sistêmico) | `lib/analytics/aprendizagem-time/montagem.ts:116-120`, `montagem-mapa.ts:113-117`, `montagem-padroes.ts:102-106` | Nos 3 arquivos, `const estado = falhas.capacidades ? "erro" : (blocos.every(vazio) ? "vazio" : "ok")` só olha `falhas.capacidades`. `falhas.avaliacoes`, `falhas.evidencias` (e em `montagem-mapa.ts` também `falhas.alunos`, em `montagem-padroes.ts` também `falhas.conceitos`) são computados por `primeiraFalha(...)` só para o campo `erro` do objeto de retorno — **nenhum bloco individual e nenhuma das 3 telas checam esses 3-4 valores em lugar nenhum além dessa linha.** `visao-geral-tab.tsx:378`, `padroes-tab.tsx:295` e `mapa-tab.tsx:374` decidem o banner de página inteira só por `data.estado === "erro"`. Resultado: falha de leitura em `capability_assessments`/`capability_evidence`/`users`(alunos)/`concepts` faz as 3 telas mostrarem "amostra ainda insuficiente" (estado `vazio`) em vez do banner de erro — byte a byte o mesmo sintoma que C-3 descreve, por uma porta diferente. | ALTO (ver nota nos CRÍTICOS acima) | NÃO-COBERTO |
| 2 (novo) | `lib/analytics/aprendizagem-time/classificador/index.ts:147` | `const { data: atual } = await db.from("capability_assessments")...maybeSingle()` — **erro não é sequer destructurado**, não há `console.error`, nada. Se essa leitura falhar, `atual` fica `undefined`, o código trata como "aluno nunca avaliado antes" (`if (atual) {...}` pula o flip de `is_current=false`) e insere uma NOVA linha `is_current:true` sem desativar a anterior — risco de **2 linhas `is_current=true` para o mesmo par aluno×capacidade** se o índice único da tabela não pegar (ver M-6 de Aria: os 2 índices divergem entre migrations). Pior que A-6: nem logado. | ALTO — risco de corrupção de estado "corrente", não só de UI | NÃO-COBERTO |
| 3 (novo, 6 sites, 1 arquivo) | `lib/analytics/aprendizagem-time/classificador/fontes-evidencia.ts:56-58` (chapters), `:242` (slides, sem log), `:255-258` (reflections), `:311-314` (scenarios), `:369-372` (assignments), `:418` (quiz_sessions, sem log), `:434-437` (quiz_attempts), `:492-495` (sessions) | Mesmo root cause de A-5/A-6 (já registrados por Aria como as linhas 147 e 201 desta mesma classe), repetido em cada um dos 5 coletores + as 2 leituras que os alimentam. Cada um, isolado, faz aquela fonte de evidência contribuir ZERO para `pendentes`, sem sinal de que faltou algo — 2 dos 8 sites (`:242`, `:418`) nem `console.error` têm, porque a condição é `if (erroX \|\| !linhas \|\| linhas.length === 0) return` (erro e "genuinamente vazio" tratados como o mesmo `return` silencioso). | ALTO (soma ao A-5/A-6 já contado por Aria; aqui é a extensão para os outros 6 pontos de leitura do mesmo arquivo) | NÃO-COBERTO (`grep -rln "processarPendencias" apps/web/src apps/web/tests` já confirmado por Aria: zero testes) |
| 4 (novo) | `lib/analytics/admin-overview.ts:444` (`courses.rows.filter(...)` sem checar `courses.available`), `:294-331` (`readAxis`: `groups`/`memberships` vêm de `readAll` e o `available` de cada leitura nunca sai da função — o tipo de retorno nem tem o campo), `:528` (`adoption.available = axisData.groups.length > 0` conflating "zero grupos cadastrados" com "falha ao ler grupos") | Se a leitura de `courses` ou `areas`/`departments`/`user_areas` falhar, `/admin/visao-geral` mostra "0 cursos publicados" ou "eixo de adoção não configurado" como fato, quando o correto seria "—"/estado de erro — mesma família do A-1/A-2 já registrados por Aria neste MESMO arquivo, em 3 pontos que ela não citou individualmente. | ALTO (mesma tela, mesmo arquivo, mesma classe do A-1/A-2 de Aria) | NÃO-COBERTO |
| 5 (novo, severidade capada) | `app/gauntlet-preview/aprendizagem-{mapa-capacidades,padroes-evolucao,visao-geral}/leitura-real.ts` — `idDoTenant()` e `idDoCurso()` em cada um dos 3 arquivos: `const { data } = await db...maybeSingle()`, erro nunca destructurado | Preview de QA mostra "cenário não semeado" (rotulado `SEM_TENANT`) quando a causa real pode ser falha de leitura, não ausência do tenant — rótulo de causa errado, não sucesso falso. | BAIXO — rota bloqueada em produção por `NODE_ENV` (Dockerfile:103, M-8 de Aria); público é QA local, não gestor/decisor | NÃO-COBERTO |

## E→ENGOLIDO — catch/checagem que só loga e segue, sem propagar

| # | Arquivo:linha | O que o usuário vê | Severidade | Teste |
|---|---|---|---|---|
| 1 (novo) | `lib/analytics/aprendizagem-time/classificador/index.ts:205-210` (`erroJoinEv`), `:223-228` (`erroJoinCrit`) | `reavaliarCapacidade` já inseriu a linha em `capability_assessments` (sucesso real) e retorna `true` (mudou) mesmo que o insert em `capability_assessment_evidence`/`capability_assessment_criteria` falhe — só `console.error`. A avaliação do aluno aparece certa na tela, mas o "por que" (evidências/critérios que a sustentam) fica com o rastro de auditoria quebrado, sem qualquer sinal. | MÉDIO — o dado principal está certo, a explicabilidade que o próprio código promete (`f-14-explicabilidade-cita-evidencias-consideradas.test.ts` existe, ver nota abaixo) fica furada | PARCIALMENTE COBERTO — existe `f-14-explicabilidade-cita-evidencias-consideradas.test.ts`, mas cobre a função pura de explicabilidade, não o caminho de falha do INSERT das linhas de junção; NÃO-DETERMINADO se cobre o cenário de erro especificamente |
| 2 (=A parte de M-1/M-2 de Aria, confirmado aqui de novo por leitura própria) | `lib/analytics/aprendizagem-time/fonte-supabase.ts:60` (`MAX_PAGINAS=50`), `lib/analytics/autogestao/fonte-supabase.ts:78` (idem) | Ao esgotar 50 páginas (50.000 linhas) sem erro, o laço simplesmente para — sem marcar `falha`. Indistinguível de "isso é tudo". Já registrado por Aria como M-1; confirmado aqui por leitura direta do código (não só do laudo). | MÉDIO (herdado da classificação de Aria) | NÃO-COBERTO |
| 3 (novo, herdado — ver nota) | `app/api/analytics/aggregate/route.ts:95-107` (`fetchAllRows`) | `if (error \|\| !data \|\| data.length === 0) break` — idêntico ao padrão de A-1 (`readAll` do admin-overview), mas SEM sequer o wrapper `TolerantRead`: a função devolve `T[]` puro, nenhum chamador tem como saber se truncou por erro. **Esta função NÃO foi tocada pelos 40 commits** (`git diff origin/main...HEAD -- <arquivo> \| grep fetchAllRows` vazio) — é dívida HERDADA que mora num arquivo que a branch tocou por outro motivo. Reporto porque está no arquivo em escopo, mas a origem é anterior a esta branch. | MÉDIO, classificado HERDADO (não introduzido pelos 40 commits) | NÃO-DETERMINADO |

## E→PARCIAL — leitura truncada devolvida como completa

| # | Arquivo:linha | O que o usuário vê | Severidade | Teste |
|---|---|---|---|---|
| 1 (=A-1 de Aria) | `lib/analytics/admin-overview.ts:189-201` (`readAll`) | "1.000 concluintes" quando o real é 2.500, sem "—" | CRÍTICO na prática (Aria classificou ALTO; concordo com a leitura dela — decisão de programa de treinamento sobre 40% do dado) | NÃO-COBERTO |
| 2 (=M-1 de Aria) | `fonte-supabase.ts` (as duas, `aprendizagem-time` e `autogestao`), `MAX_PAGINAS=50` | Truncamento silencioso a partir de 50.000 linhas, sem sinal | MÉDIO (mesmo registro do E→ENGOLIDO #2 acima — a mesma linha de código é as duas coisas: engole o limite E devolve parcial como completo) | NÃO-COBERTO |

## E→NEGA — erro de verificação vira negação de direito

| # | Arquivo:linha | O que o usuário vê | Severidade | Teste |
|---|---|---|---|---|
| 1 (sistêmico, 8 rotas) | `app/api/course-designer/{ai-fill,analyze-content,audit-course,generate}/route.ts`, `app/api/course-designer/blueprints/route.ts`, `app/api/course-designer/blueprints/[blueprintId]/apply/route.ts`, `app/api/course-designer/frameworks/route.ts`, `app/api/courses/route.ts` — todas na forma `const { data: profile } = await supabase.from("users").select("role, tenant_id").eq("id", user.id).single(); if (!profile \|\| !roles.includes(profile.role)) return 403` | As 8 rotas destructuram `profile` **sem checar `error`**. Se a leitura de `users` falhar (RLS, timeout, blip de rede), `.single()` devolve `data: null`, `profile` fica `null`, e a condição `!profile` cai no MESMO `403 "Permissão negada"` que um usuário genuinamente sem o papel receberia. Um manager legítimo, num soluço de rede, lê "você não tem permissão" quando a verdade é "não conseguimos confirmar". É exatamente o inverso do `feature-gate` (que Aria e eu confirmamos, por leitura própria, que separa corretamente 403 de 503 — ver Nota de legitimidade abaixo) aplicado ao invés na checagem de PAPEL. | ALTO — sistêmico (8 rotas), mas fail-closed (nega acesso, não concede) — não é vazamento, é confusão operacional e possível ticket de suporte recorrente | NÃO-COBERTO (nenhuma das 8 rotas tem diretório `__tests__`) |

**Nota de origem do achado E→NEGA:** confirmei via `git diff origin/main...HEAD -- <arquivo> \| grep "^+.*if (!profile"` que a linha em si é **HERDADA em 7 das 8 rotas** (já existia em `origin/main`, não foi escrita por esta branch) — só `courses/route.ts` mostra a linha como adição (`+1`), porque **o arquivo inteiro é novo nesta branch** (criado por `a4980ba`, ver B9 do LOOP-0b). Ou seja: a branch não inventou o defeito, mas ao criar a 8ª rota **copiou o padrão defeituoso das 7 irmãs em vez de corrigi-lo** — é exatamente o tipo de "reintrodução" que a pergunta do briefing antecipava, só que por replicação de padrão, não por regressão de uma correção específica.

---

## Legítimo — confirmado por leitura, não é achado

Para não inflar a lista, seguem os locais onde o mesmo tipo de checagem (`catch`, `if (error)`,
fallback) foi lido e **é o comportamento correto**, com a razão:

| Arquivo | Por que é legítimo |
|---|---|
| `lib/analytics/aprendizagem-time/fonte-supabase.ts` (função `ler`, exceto o teto `MAX_PAGINAS`), `lib/analytics/autogestao/fonte-supabase.ts` (função `ler`, mesma ressalva) | Erro na primeira página aborta e devolve `{ linhas: [], falha: {...} }` — nunca confunde "zero linhas" com "erro". Confirma o que Aria já registrou. |
| `lib/analytics/autogestao/fonte-supabase.ts:236` (`erroPlano`) | Propagado como `falhas.plano`, nunca descartado. |
| `lib/analytics/autogestao/fonte-supabase.ts:258-263` (`erroTenant`, fuso horário) | Cai num default NOMEADO (Brasília) com `console.error` — decisão documentada de que ausência de configuração de fuso é o caminho majoritário hoje, não um erro a esconder; é fail-safe declarado, não fail-silent. |
| `components/feature-gate.tsx:93-102`, `lib/feature-gate.ts:346-360` | `FeatureCheckUnavailableError` distingue estruturalmente "não sei" (503, `Retry-After`, `<CheckUnavailable/>`) de "não tem direito" (403/`fallback`). Este é o padrão-ouro que o resto da casa deveria copiar — e é precisamente o inverso do achado E→NEGA acima. |
| `app/api/analytics/aggregate/route.ts:225-238` (RPCs `auth_reachable_student_ids`, `auth_subtree_user_ids`, `subtree_student_ids`) | `error ? [] : [...ids]` — comentário no código confirma que é **fail-closed intencional**: como a rota já usa o cliente de serviço (RLS ignorado), o `[]` em caso de erro é a barreira real. Diferente do E→VAZIO desta lista porque aqui o "vazio" empurra para MENOS acesso, nunca mais — direção seguraconservadora, não enganosa para quem decide. |
| `app/api/courses/route.ts:37-48`, `app/api/admin/api-keys/route.ts` (2 sites), `app/api/admin/webhooks/route.ts` (2 sites), `app/api/analytics/aggregate/route.ts:863-866` (`sessionsError`), `app/api/analytics/autogestao/_contexto.ts:116-124` (`profileError`) | Todos retornam `500`/mensagem de erro explícita, nunca uma lista vazia ou `ok:true` disfarçado. |
| `app/(platform)/jornada/page.tsx:348-350` (catch do tour do builder) | Degrada para "sem tour" em vez de quebrar a página — cosmético, sem custo de decisão errada (não é dado que um gestor lê para decidir algo). |
| `app/(platform)/dashboard/_components/manager-dashboard-page.tsx:155` (`mgrTenantError`), `:617` (catch geral) | O primeiro cai em feature flag desligada por padrão (fail-safe documentado), o segundo relança (`throw new Error`), que o Next.js transforma em página de erro — não é silêncio. |
| `app/gauntlet-preview/{autogestao-mapa,autogestao-padroes,autogestao-visao-geral}/leitura-real.ts` | As 3 versões "autogestao" (diferente das 3 "aprendizagem" na tabela E→VAZIO acima) checam `erroTenant`/`erroUser`/`erroEnroll` corretamente e devolvem `{ erroMotivo: "..." }`, uma forma distinta de "não encontrado". Mesmo diretório, tratamento oposto — por isso as 3 "aprendizagem" contam como achado e estas 3 não. |
| `app/api/course-designer/{audit-course,ai-fill,analyze-content,generate,blueprints/[id]/apply}/route.ts` — catches do corpo da requisição (`bodySchema.parse`) e do bloco principal (chamada ao LLM) | Todos retornam `400`/`500` com mensagem, nunca sucesso disfarçado. (A ressalva é só o `if (!profile...)` de autorização, já contado no E→NEGA.) |
| `scripts/gauntlet/provar-elo4-nucleo.ts:590-597` | `process.exit(1)` no catch — falha dura, correta para um script de prova. |

---

## Comandos de evidência

```bash
# universo
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
git diff --name-only origin/main...HEAD | grep -E '\.tsx?$' | wc -l    # 221
git diff --name-only origin/main...HEAD | grep -E '\.tsx?$' | grep -v "__tests__\|\.test\.\|tests/" | wc -l   # 159

# achado sistêmico E→NEGA (8 rotas)
grep -n "if (!profile" apps/web/src/app/api/course-designer/*/route.ts \
  "apps/web/src/app/api/course-designer/blueprints/[blueprintId]/apply/route.ts" \
  apps/web/src/app/api/courses/route.ts

# confirma que 7 das 8 são herdadas, 1 é arquivo novo
for f in apps/web/src/app/api/course-designer/ai-fill/route.ts apps/web/src/app/api/courses/route.ts; do
  git diff origin/main...HEAD -- "$f" | grep -c "^+.*if (!profile"
done

# achado sistêmico E→VAZIO na montagem (3 arquivos)
grep -n "falhas\.\w*" apps/web/src/lib/analytics/aprendizagem-time/montagem*.ts

# quem consome data.estado === "erro" (a porta que nunca abre para avaliacoes/evidencias)
grep -rn 'estado === "erro"' apps/web/src/components/analytics/aprendizagem-time/*.tsx

# ausência de teste para o pipeline de escrita (já citado por Aria, reconfirmado)
grep -rln "processarPendencias" apps/web/src apps/web/tests

# ausência de diretório de teste nas 8 rotas do E→NEGA
find apps/web/src/app/api/course-designer apps/web/src/app/api/courses -iname "*.test.ts"

# estado final do repo
git log --oneline -1        # d2b8083
git diff --name-only        # arquivos de colegas (rate-limit.test.ts, docs/epics, docs/stories/epic-9, GABARITO.json) — nenhum meu
```
