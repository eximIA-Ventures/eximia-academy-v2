# E12 — Patch de Confiança Pós-Lançamento (Centro de Engajamento v2)

**Status:** InReview
**Tipo:** Story leve (Tier 2), aberta após o fechamento do epic (00-EPIC-OVERVIEW.md §12), a partir de uso real do Hugo + painel real (Steve Jobs, Jony Ive, Don Norman) convocado em 2026-07-09.

## Contexto

O Hugo usou a tela `/engagement` ao vivo e reportou 6 problemas via screenshot. Um painel real de
3 especialistas (Steve Jobs, Jony Ive, Don Norman como advogado do diabo) revisou a tela inteira e
convergiu que os itens abaixo são bugs de confiança que precisam ser corrigidos **antes** de
qualquer redesenho estrutural de abas (essa decisão maior de fundir Campanhas + Central de Envios
foi explicitamente ADIADA pelo Hugo — ver `academy-engagement-center-v2.md` na memória do J.A.R.V.I.S.
para o registro completo do painel). Esta story é SÓ o patch, não o redesenho.

## Escopo (Tier 2 — sem epic novo, story standalone)

1. **Bug do badge de contexto dessincronizado.** No header de `/engagement`, o badge de escopo
   mostrou "Organização" enquanto o dropdown CONTEXTO mostrava "Meu Time". Achado técnico:
   `resolveContextLabels` (`apps/web/src/app/(platform)/engagement/page.tsx:42-64`) cai no ramo
   `organization` quando `activeContext?.type !== "team"`, mesmo com o dropdown mostrando "Meu Time"
   — investigar por que o cookie de contexto ativo não bate com o que a UI mostra nesse caso e
   corrigir a fonte de verdade única (a mesma que a análise da BUG 2 do E6 já usou).
2. **Contagem do Histórico inconsistente com o card de resumo (102 vs 51).** Causa raiz já
   identificada: `apps/web/src/app/api/engagement/history/route.ts` não aplica o mesmo filtro de
   canal (`channel = "inapp"`) que o card "Mensagens enviadas" aplica em
   `apps/web/src/app/(platform)/engagement/page.tsx` (linha ~61). Alinhar os dois: ou o histórico
   aplica o mesmo filtro por padrão (permitindo override explícito via `?channel=`), ou o card passa
   a contar todos os canais — escolher UMA fonte de verdade e usar nos dois lugares.
3. **Picker "Escolha o aluno" (Central de Envios) não retorna resultados.** Investigação estática
   (Explore) não achou bug óbvio no código (debounce, mínimo de 2 caracteres, chamada a
   `GET /api/engagement/students?q=` parecem corretos). Precisa de reprodução AO VIVO (login como
   gestor real, ex. Rinaldo/Meu Time) para achar a causa real: escopo resolvendo vazio, erro
   silencioso no fetch (o catch de `send-center-tab.tsx` engole erros sem logar), ou falha na query
   Supabase. Adicionar log visível de erro (mesmo que só client-side/console) para não repetir esse
   modo de falha silenciosa no futuro.
4. **Terminologia de "grupo" em Campanhas não se explica sozinha.** O próprio Hugo não entendeu o
   termo. Trocar o rótulo genérico "grupo" pelo critério nomeado real (ex.: "Sem acesso há 15+ dias
   · 12 alunos" em vez de "grupo"), no `campaigns-tab.tsx` e no `EmptyState` correspondente.
5. **Aviso seco de Templates ("afeta toda a organização").** Melhorar a comunicação de risco no
   `templates-tab.tsx` — não é para mudar o modelo de permissão (isso seria redesenho, fora de
   escopo aqui), é para o aviso comunicar melhor o que realmente acontece (quantos gestores são
   afetados, se é reversível) em vez de um parágrafo genérico de susto.
6. **Histórico demovido de aba de peso igual para acesso secundário.** Por decisão do Hugo (opção
   escolhida no painel), a aba Histórico deixa de competir em peso visual com as abas de ação —
   vira acessível a partir de um link no card de resumo "Mensagens enviadas", mantendo a rota e o
   conteúdo intactos (não é para deletar a funcionalidade, só reduzir a proeminência na navegação
   principal).

## Fora de escopo (explicitamente adiado pelo Hugo)

- Fusão estrutural de Central de Envios + Campanhas numa tela/fluxo só (a divergência Jobs/Ive vs.
  Norman do painel).
- Mudança de modelo de permissão de Templates (biblioteca só-leitura + clone pessoal, sugestão do
  Norman) — fora de escopo desta story, é redesenho.
- Botão flutuante universal de mensagem substituindo a aba Central de Envios.

## Comandos de Verificação

- `pnpm --filter @eximia/web typecheck`
- `pnpm --filter @eximia/web test`
- `npx biome check apps/web/src/app/\(platform\)/engagement apps/web/src/app/api/engagement`
- Reprodução manual do picker via dev server (login como gestor real).

## Critério de Saída

Os 6 itens acima corrigidos, suíte sem regressão nova além do baseline já conhecido, badge e
contagens do Histórico consistentes entre si em qualquer recorte testado.

## Dev Agent Record

**Agent:** Dex (@dev) · **Data:** 2026-07-09 · **Status:** InReview

### Item 1 — Badge de contexto dessincronizado (RESOLVIDO)

**Causa raiz (mais funda do que a descrita na story):** o header dropdown ("Contexto") e o badge da
`/engagement` liam de fontes DIFERENTES no estado fresco (cookie ausente). O dropdown vem de
`resolveContext()` (`lib/context-resolver.ts`), que aplica um default de estado-fresco: sem cookie, um
gestor cai em "Meu Time" (`defaultContext` prefere organization > team > personal). Já o
`resolveContextLabels` da página lia `getActiveContextCookie()` cru — que retorna `null` no estado
fresco — então caía no ramo `organization` e mostrava "Organização" enquanto o dropdown mostrava "Meu
Time". Não era só cosmético: era duas lógicas de resolução divergentes para o MESMO estado.

**Fix:** `resolveContextLabels` (`page.tsx`) passou a derivar o contexto ativo do MESMO `resolveContext()`
que renderiza o dropdown — uma fonte de verdade única para QUAL contexto está ativo. O sub-modo de time
(Diretos vs. Hierarquia) continua vindo de `x-team-view`, MAS agora espelha exatamente o que
`resolveEngagementScope` computa: cookie de team explícito → `getTeamViewMode()`; estado fresco (sem
cookie, gestor) → o scope usa a subárvore inteira (`getManagedTeamStudentIds includeSubtree`) → badge
lê "Hierarquia". Assim badge, dropdown E scope concordam em todo estado testado. O
`resolveEngagementScope` (helper de segurança, com testes load-bearing) NÃO foi tocado — só a camada de
label passou a consultar a mesma verdade. O fast-path tenant-wide ("Todos") ficou intacto.

### Item 2 — Contagem do Histórico (102) vs card "Mensagens enviadas" (51) (RESOLVIDO)

**Causa raiz confirmada por leitura:** o card conta SÓ in-app — tanto `page.tsx:101` quanto
`overview/route.ts:61` filtram `.eq("channel","inapp")`, e o sublabel do card diz "in-app neste
recorte". O `history/route.ts` só aplicava `channel="inapp"` se `?channel=` fosse passado
explicitamente; sem param, retornava TODOS os canais → 102 vs 51.

**Fix (fonte de verdade única = in-app):** `history/route.ts` agora DEFAULTA para `channel="inapp"`
quando nenhum canal é pedido, mantendo o override explícito `?channel=email` (só e-mails) e adicionando
`?channel=all` (todos os canais, o comportamento antigo). O `history-tab.tsx` foi alinhado: o filtro
"Canal" agora inicia em "In-app" (o default que casa com o card), a opção "Todos os canais" envia
`channel=all` de forma explícita, e o tipo `ChannelFilter` deixou de ter o `""` ambíguo. Resultado: o
total padrão do Histórico passa a bater com o card. Testes de não-vazamento (`canonical-scope`,
`routes-leak`) continuam verdes (não passam `channel` e não asseveram sobre canal).

### Item 3 — Picker "Escolha o aluno" sem resultados (BLINDADO; reprodução ao vivo NÃO obtida — documentado honestamente)

**Reprodução ao vivo tentada, sem login utilizável:** o `.env.local` do repo aponta para um Supabase
remoto vivo (`vaguswivhqnlbgqvnjch`). O seed documentado (`supabase/seed-engagement-test.sql`,
`manager@a.com` / `123456`) é para um `db reset` LOCAL que recria RPCs de subárvore que nunca foram
committadas como migration — esse usuário NÃO existe no alvo remoto (auth retorna
`invalid_credentials`). Candidatos plausíveis (`gestor@`, `rinaldo@`, `admin@eximia.com`) também não
existem. Não inventei/adivinhei credenciais reais (seria fishing). Portanto foquei em blindar o código
contra a falha silenciosa e revisar a lógica mais uma vez por leitura atenta.

**Achado da leitura (causa mais provável em produção):** `getManagedTeamStudentIds(includeSubtree)`
(`lib/area-context.ts:142`) chama a RPC `auth_reachable_student_ids`; se a RPC ERRA, retorna `null`, e
`resolveEngagementScope` colapsa isso para `[]` (fail-closed). A rota de busca então retorna
`{students:[]}` com **200 OK** — indistinguível de "nenhum match" no client antigo. Esse é exatamente
o sintoma "picker vazio sem erro".

**Fix (tornar a falha visível/debugável, sem afrouxar segurança):**
- `send-center-tab.tsx`: o `catch` e o ramo `!res.ok` do picker deixaram de engolir erros — agora logam
  `console.error` com status/corpo e mostram um estado de erro visível ao usuário (`role="alert"`),
  distinguindo "falha real" de "sem match". Mesmo tratamento aplicado ao `loadStudent` (detalhe do aluno).
- `lib/area-context.ts:142`: a falha da RPC `auth_reachable_student_ids` agora é logada
  (`console.error`) antes de colapsar para `null` — o comportamento fail-closed é preservado (correto
  por segurança), mas o operador consegue distinguir "a RPC quebrou" de "este gestor não alcança
  ninguém". Antes, o erro era descartado em silêncio.

**Pendência honesta:** a causa raiz específica no ambiente do Hugo não pôde ser confirmada ao vivo nesta
rodada. Com os logs adicionados, a próxima ocorrência será diagnosticável pelo console (client) e pelos
logs de servidor (RPC). Se o picker seguir vazio, o log dirá se é escopo fail-closed (RPC/subárvore) ou
403/permissão — os dois caminhos agora falam.

### Item 4 — Terminologia "grupo" em Campanhas (RESOLVIDO)

O `nudgeTypeLabel`/`nudgeTypeReason` (`nudge-labels.ts`) já produziam o critério nomeado ("Nunca
acessaram", "Inativos há mais de 14 dias", etc.). O que era opaco era a palavra genérica **"grupo"** na
copy e nos botões. Troquei em todo o `campaigns-tab.tsx`: "Acionar grupo" → "Acionar lista"; a linha de
fallback do card agora mostra o critério + contagem (`nudgeTypeReason(c.type) · N alunos`); "Alunos deste
grupo" → "Alunos desta lista" com "critério: {reason}"; empty state "Nenhum grupo para acionar" → "Nenhuma
lista para acionar" com descrição por critério; "Voltar aos grupos"/"N no grupo"/"Este grupo tem…"/"outro
grupo" reescritos. A palavra "grupo" solta não aparece mais na UI (só em comentários explicativos).

### Item 5 — Aviso seco de Templates (RESOLVIDO, sem mudar permissão)

O aviso de uma linha ("afeta toda a organização") virou um bloco informativo com ícone `Info`: explica O
QUE é compartilhado, QUEM é afetado (todos os gestores da instituição), QUANDO passa a valer (próximas
mensagens; comunicações já enviadas não mudam) e que é REVERSÍVEL (editar de novo). Adicionei também um
lembrete curto no ponto-de-ação (Modal de edição), factual e não-alarmante. O modelo de permissão
(templates tenant-wide, `manager` pode editar) ficou INTOCADO — fora de escopo.

### Item 6 — Histórico demovido de aba de peso igual para link secundário (RESOLVIDO)

O `TabsTrigger value="history"` foi removido da `TabsList` (deixa de competir visualmente com as abas de
ação). Rota e conteúdo intactos: o `TabsContent value="history"` continua montado. O acesso agora vem de
um link secundário "Ver histórico" NO card "Mensagens enviadas" (novo campo opcional `link` em
`SummaryCardSpec`, que chama `setActiveTab("history")`). Como a aba não tem mais trigger, adicionei um
"Voltar às ações" dentro da view de Histórico para o usuário não ficar preso. O deep-link e o
`focusedStudentId` seguem funcionando (o valor "history" continua selecionável).

### File List

- `apps/web/src/app/(platform)/engagement/page.tsx` — item 1: `resolveContextLabels` via `resolveContext()`.
- `apps/web/src/app/api/engagement/history/route.ts` — item 2: default `channel="inapp"` + `?channel=all`.
- `apps/web/src/app/(platform)/engagement/_components/history-tab.tsx` — item 2: filtro Canal alinhado ao default.
- `apps/web/src/app/(platform)/engagement/_components/send-center-tab.tsx` — item 3: erro visível + logs no picker e no load do aluno.
- `apps/web/src/lib/area-context.ts` — item 3: log da falha da RPC `auth_reachable_student_ids` (fail-closed preservado).
- `apps/web/src/app/(platform)/engagement/_components/campaigns-tab.tsx` — item 4: "grupo" → critério nomeado / "lista".
- `apps/web/src/app/(platform)/engagement/_components/templates-tab.tsx` — item 5: aviso de risco informativo + lembrete no modal.
- `apps/web/src/app/(platform)/engagement/_components/engagement-shell.tsx` — item 6: Histórico demovido para link do card.

### Verificação

- `pnpm --filter @eximia/web typecheck` → limpo.
- `npx biome check (platform)/engagement api/engagement lib/area-context.ts` → limpo.
- `pnpm --filter @eximia/web test` → 31 fail / 657 pass (IDÊNTICO ao baseline pré-mudança; os 31 são
  pré-existentes em sessions/messages, auth OAuth, dashboards, onboarding, rate-limit — nenhum de
  engagement). Os 4 arquivos de teste de engagement (`canonical-scope`, `routes-leak`, `students-scope`,
  `derive-nudge-type`) = 29/29 verdes.

## Rodada 2 (2026-07-09) — Investigação com dado REAL de cliente (Cory Alimentos), ao vivo

O Hugo usou a tela `/engagement` ao vivo apontando para o Supabase REMOTO real (tenant Cory
Alimentos, `a9d56b85-ee0e-4295-8db2-5fbcb3fd7a32`, 45 alunos reais). Dois sintomas: (a) buscar "Caio"
no picker "Escolha o aluno" da Central de Envios não retornava nada; (b) a aba Campanhas mostrava
"Nenhuma lista para acionar". Investiguei ambos direto no banco (service role) e no código.

### Achado A — "Caio não aparece": é role=manager MESMO, o escopo NÃO estava quebrado (evidência)

Consulta ao banco real:
- **"Caio Pinheiro" (`16e3e6ed-…`) é `role: manager`**, não `student` (dono do "Time de Caio Pinheiro",
  5 membros, reporta a Rinaldo). A rota `GET /api/engagement/students` filtra `.eq("role","student")`,
  então está CORRETA em não retornar um gestor. Não é bug de dado.
- Descartei a hipótese de "escopo quebrado por trás": o gestor de topo real é **Rinaldo**
  (`55993f62-…`, `reports_to: null`), cujo subtree resolve para **40 alunos** — bate exatamente com o
  "40 alunos analisados" que a tela mostrou. Simulei `auth_reachable_student_ids` (subtree ∪ membros de
  manager_group) por manager: Rinaldo=40, Caio=5, "Gestor Teste RP (REMOVER)"=0. O escopo resolve certo.
- **Veredito:** o picker "não funcionava" porque (1) "Caio" não é aluno E (2) o picker exigia digitar 2
  letras e só buscava por nome — o gestor não tinha como VER quem estava no recorte para perceber que
  Caio não é aluno. UX, não escopo. Corrigido no item B abaixo.

### Achado B — Central de Envios: lista completa rolável do recorte por padrão (pedido do Hugo, feito)

Implementado o pedido explícito de UX (definitivo): a Central de Envios agora CARREGA a lista completa
e rolável de todos os alunos do recorte ao abrir a aba, e a barra de busca FILTRA essa lista.
- **Rota `GET /api/engagement/students`**: modo LIST unificado com o SEARCH. Quando `ids` está ausente,
  lista os alunos do recorte ordenados por nome (teto 100, `?limit` até 200); `?q=` vira filtro
  `ilike` OPCIONAL em cima da mesma lista escopada. `q` nunca amplia alcance, só filtra dentro do
  recorte — o `.in("id", allowedStudentIds)` continua sendo a trava (admin `null` = tenant-wide).
- **`send-center-tab.tsx`**: o picker carrega a lista no mount (sem gate de 2 letras); digitar refina.
  Estados vazios distinguem "nenhum resultado do filtro" de "nenhum aluno no recorte".

### Achado C — Campanhas "Nenhuma lista": BUG real (não estado vazio), corrigido na fonte

Existem HOJE na tabela `nudge_suggestions` **5 cohorts `pending` reais** gerados para Rinaldo
(never_accessed=9, inactive=28, no_reflection=13, top_performer=3, behind_teaching_plan=5). A tela
mostrava vazio porque `page.tsx` renderizava SÓ as sugestões RECÉM-CRIADAS nesta chamada
(`generateNudgeSuggestions().created`). Esse gerador é idempotente por design: a cadência de 24h PULA
todo cohort já gerado nas últimas 24h → `created: []` assim que o gestor gera uma vez no dia. O papel do
gerador é MANTER o conjunto pending fresco; o papel da página é EXIBIR o conjunto pending — o
acoplamento ao `created` conflava os dois. **Fix (page.tsx):** rodar o gerador pelo efeito colateral,
depois LER os cohorts `pending` do recorte (dedup por tipo, mais recente; re-escopar `target_student_ids`
pelo `inScope` atual — defesa em profundidade) e renderizar ESSES. O card "Ações pendentes" passa a bater
com o que aparece em Campanhas.

Realidade do cohort da Cory (thresholds reais, tenant-wide, 45 alunos): 12 never_accessed, 32 inactive
(>14d), 14 no_reflection. Portanto "Nenhuma lista" era factualmente errado — há alunos de sobra em
critério. Prova do fix: simulando a nova query da página para Rinaldo, retornam os 5 cohorts
(recorte=40), em vez do vazio.

### File List (Rodada 2)

- `apps/web/src/app/api/engagement/students/route.ts` — modo LIST (lista o recorte sem `ids`; `q` filtra).
- `apps/web/src/app/(platform)/engagement/_components/send-center-tab.tsx` — picker carrega lista no open, busca filtra.
- `apps/web/src/app/(platform)/engagement/page.tsx` — Campanhas: renderiza cohorts `pending` do recorte, não só os recém-criados.
- `apps/web/src/app/api/engagement/__tests__/students-scope.test.ts` — 3 testes novos do modo LIST (subtree-bound, sem `.ilike` no vazio, fail-closed).

### Verificação (Rodada 2)

- `pnpm --filter @eximia/web typecheck` → limpo.
- `npx biome check (platform)/engagement api/engagement` → limpo.
- Testes de engagement+notifications via vitest direto: **48/48 verdes** (43 antigos + 5 do modo LIST/
  realocados). As únicas falhas na suíte web ampla (`rate-limit` esperando 15 limiters, existem 16) são
  PRÉ-EXISTENTES e não tocam engagement.

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-09 | Story criada (Tier 2, pós-uso do Hugo + painel real Jobs/Ive/Norman) | River (SM) |
| 2026-07-09 | Implementados os 6 itens do Escopo (InReview). Item 3 blindado (falha visível + logs) mas reprodução ao vivo NÃO obtida — sem login utilizável no alvo remoto, documentado honestamente. Typecheck/biome limpos, suíte sem regressão nova (baseline 31 fails inalterado). NÃO committado. | Dex (@dev) |
| 2026-07-09 | Rodada 2 (dado real Cory, ao vivo): (A) causa raiz de "Caio não aparece" = role=manager mesmo, escopo do gestor real (Rinaldo→40) provado íntegro; (B) Central de Envios agora lista o recorte completo rolável, busca filtra (rota modo LIST + picker); (C) BUG de Campanhas corrigido na fonte — página renderiza cohorts `pending` do recorte (5 reais), não só os recém-criados descartados pela cadência 24h. 3 testes novos, 48/48 verdes, typecheck/biome limpos. NÃO committado. | Dex (@dev) |
