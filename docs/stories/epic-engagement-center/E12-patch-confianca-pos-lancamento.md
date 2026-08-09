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

## Rodada 3 — Pills funcionais + Hierarquia como árvore (ao vivo, Hugo 2026-07-09)

Dois pedidos concretos do Hugo usando `/engagement` ao vivo (tenant Cory, gestor Rinaldo, 40 no subtree):

1. **"Não tá funcionando esse botão de mudar pro Meu Time"** — os pills Hierarquia/Meu Time no header
   eram `<span>` estáticos, sem interação, e o estado fresco caía em Hierarquia (subtree achatado) por
   padrão. Hugo quer: pills que sejam BOTÕES reais + o default (sem cookie) deve ser **Meu Time/Diretos**,
   com Hierarquia como opt-in explícito.
2. **"Quero que a hierarquia seja realmente uma hierarquia, tipo o dashboard, só depois de ir ABRINDO"** —
   ao entrar em Hierarquia, a página já mostrava os 40 de uma vez (flatten). Hugo quer uma ÁRVORE: começar
   nos reports diretos e ir EXPANDINDO nó por nó, como o `TeamScopeControl`/drill-down do `analytics/page.tsx`.

### Causa raiz do "default cai em hierarquia"

O default do cookie `x-team-view` (`getTeamViewMode()`) JÁ era `direct`. O problema estava em
`resolveEngagementScope`: o ramo "manager FORA do contexto team" (estado fresco, sem `x-active-context`)
retornava INCONDICIONALMENTE o subtree inteiro (`getManagedTeamStudentIds includeSubtree`), divergindo do
ramo "dentro do team" (que honrava Diretos/Hierarquia). Um gestor recém-chegado caía nesse ramo → subtree
achatado. **Fix:** unifiquei os dois ramos — ambos honram `getTeamViewMode()` (default `direct`) + o
`?focus=` do drill-down. O `resolveContextLabels` (badge) foi alinhado ao mesmo default. O teste
`canonical-scope` (que força `getTeamViewMode→"hierarchy"`) continua pinando o subtree completo (6 de 13),
provando que só o default fresco/Diretos mudou.

### Drill-down real (nó por nó), coerente entre página e abas

`resolveEngagementScope` ganhou um 5º arg opcional `focus?: string | null` (gated via
`getSubtreeStudentIdsAtNode`/`getDirectTeamStudentIds` — narrow-only, nunca alarga). Para a página e as
abas nunca divergirem sobre QUEM está no recorte, o `?focus=` flui de ponta a ponta: as 7 rotas
`/api/engagement/*` leem o param (helper `readFocusParam`) e o repassam; as abas anexam `?focus=` aos
próprios fetches (helper cliente `withFocus`). A página resolve `resolveDrilldownNav` (mesmo de analytics)
e passa `trail` + `mode` + `subteams` ao shell, que renderiza o `TeamScopeControl` (toggle + breadcrumb
"subir") e o `SubtreeNodeList` ("Times abaixo" = descer), ambos reusados VERBATIM do dashboard. Clicar
uma subequipe seta `?focus=` → a página re-renderiza no nó e as abas refetcham nele.

### Decisões / trade-offs (documentados honestamente)

- **Default compartilhado (REPORTADO):** `getTeamViewMode()`/`x-team-view` é compartilhado entre
  `/engagement` e `/analytics`. Porém, `resolveEngagementScope` (onde apliquei o fix de default) é usado
  SÓ pelo `/engagement` e suas rotas; o `analytics/page.tsx` NÃO chama `resolveEngagementScope` (usa os
  helpers de area-context direto). Portanto o novo default fresco=Diretos afeta apenas `/engagement`. Se
  o gestor tiver mexido no toggle em qualquer tela, o cookie persiste e ambas respeitam — comportamento
  correto e esperado.
- **`SubtreeNodeList` só em Hierarquia:** em Diretos a página já é o recorte de diretos, então não há
  "Times abaixo" (espelha o padrão do dashboard). O breadcrumb "subir" aparece nos dois modos.
- **Campanha PREVIEW não honra `focus`:** o preview usa `resolveAudienceScoped` (helper separado, que já
  ignorava o switch Diretos/Hierarquia antes da Rodada 3). Só o CONFIRM (que usa `resolveEngagementScope`)
  passou a honrar `focus` — é o gate de segurança que filtra a lista revisada. Limitação registrada, não
  refatorei o helper de preview (fora do escopo mínimo).

### File List (Rodada 3)

- `apps/web/src/lib/notifications/engagement-scope.ts` — 5º arg `focus` + `readFocusParam`; unificação dos
  ramos manager (default `direct`, drill-down por nó).
- `apps/web/src/app/api/engagement/{overview,action,history,campaign,students}/route.ts` — leem `?focus=`
  via `readFocusParam` e repassam (overview: `request` opcional p/ os testes arg-less).
- `apps/web/src/app/(platform)/engagement/page.tsx` — lê `?focus=`, resolve `resolveDrilldownNav`, monta
  `teamScope` (trail/mode/subteams); `resolveContextLabels` alinhado ao default Diretos.
- `apps/web/src/app/(platform)/engagement/_components/engagement-shell.tsx` — renderiza `TeamScopeControl`
  + `SubtreeNodeList` (reuso do dashboard); lê `focus` de `useSearchParams`, propaga às abas.
- `apps/web/src/app/(platform)/engagement/_components/{suggested-actions,send-center,campaigns,history}-tab.tsx`
  — prop `focus` + fetches via `withFocus`.
- `apps/web/src/app/(platform)/engagement/_components/engagement-fetch.ts` — NOVO helper cliente `withFocus`.
- `apps/web/src/app/(platform)/engagement/_components/types.ts` — `EngagementTeamScope` + `focus` nas props das abas.
- `apps/web/src/app/api/engagement/__tests__/routes-leak.test.ts` — mock de `engagement-scope` ganhou `readFocusParam`.

### Verificação (Rodada 3)

- `pnpm --filter @eximia/web typecheck` → limpo.
- `npx biome check (platform)/engagement api/engagement engagement-scope.ts` → limpo.
- Engagement + team-view + audiences-scoped + team-scope-control via vitest: **54/54 verdes**.
- Suíte web ampla: **660 pass / 31 fail** — os 31 são o baseline PRÉ-EXISTENTE (rate-limit, login-oauth,
  onboarding, dashboards de render), ZERO em engagement. Sem regressão nova. NÃO committado.

## Rodada 4 — Canal de envio real + Popup "Ver alunos" (2026-07-09)

Dois pedidos concretos do Hugo, sem relação entre si, ambos na tela `/engagement`.

### Mudança 1 — Canal de envio agora controla de verdade o disparo de e-mail

**Bug (confiança):** no wizard de Campanhas (`campaigns-tab.tsx`), o STEP "Canal" (In-app/Email) só
FILTRAVA quais templates apareciam compatíveis (`channel === "inapp" ? t.channelInapp : t.channelEmail`).
O valor `channel` **nunca era enviado** no payload do `POST /api/engagement/campaign` (`confirm`). O disparo
real de e-mail em `engine.ts` (`dispatchTeamNudge`) dependia SÓ de `template.channel_email && student.email`;
como os 5 templates seed têm `channel_email=true`, QUALQUER envio disparava e-mail via Resend
independentemente da escolha do gestor. A tela prometia um controle que não existia.

**Fix (mínimo, aditivo):**
- `dispatchTeamNudge` ganhou o parâmetro `channel?: "inapp" | "email"`, **default `"email"`**. O e-mail
  mirror só sai quando `emailAllowed (channel !== "inapp") && template.channel_email && student.email`. A
  notificação in-app é SEMPRE criada (é o inbox do aluno); o flag governa apenas o mirror de e-mail.
- `POST /api/engagement/campaign` lê `channel` do payload, normaliza (`channel === "inapp" ? "inapp" :
  "email"`, fail-safe para o legado) e propaga a `dispatchTeamNudge`.
- `campaigns-tab.tsx` envia `channel` no `confirm` (não no `preview` — o preview não dispara nada e a UI já
  mostra o canal a partir do state local). `channel` adicionado ao array de deps do `useCallback runConfirm`.

**Por que default `"email"` (decisão de escopo):** os dois call-sites existentes que NÃO passam canal
(`api/analytics/manager/nudge`, `api/engagement/action`) preservam o comportamento legado byte-a-byte — o
e-mail continua saindo quando o template suporta. Só o wizard de Campanhas, que agora passa `channel`
explicitamente, ganha o controle. Nenhum consumidor existente muda.

**Central de Envios individual (`send-center-tab.tsx` / `/api/engagement/action`) — SEM seletor de canal
(decisão de escopo documentada):** a UI individual NÃO tem seletor de canal nenhum hoje. O pedido do Hugo foi
escopado ao "que o wizard de Campanhas já expõe". Inventar um seletor de canal na Central de Envios seria
escopo além do pedido (Artigo IV — No Invention). Ela permanece no comportamento atual (default `email` =
mirror quando o template suporta). Se/quando o Hugo quiser um seletor de canal individual, é uma story nova
com UI própria — o motor JÁ aceita o parâmetro, então será só plumbing de UI→rota.

### Mudança 2 — Popup "Ver alunos": fecha de verdade + visual da tabela principal

**Achado 1 (fechar):** o modal "Ver alunos" em `suggested-actions-tab.tsx` NÃO usava `<ModalOverlay />`
(fundo escuro + fecha ao clicar fora) nem `<ModalClose />` (X). Só fechava por Esc (que ninguém descobre).
Ambos os componentes já existem em `packages/ui/src/components/modal.tsx` e são usados por outras telas do
produto (ex.: `admin/areas/[areaId]`). Fix: adicionei `<ModalOverlay />` como primeiro filho do `<Modal>` e
um `<ModalClose aria-label="Fechar" />` (X) no `ModalHeader` (com `flex-row items-start justify-between`),
copiando o padrão real do produto. Agora fecha por **X, clique fora e Esc**.

**Achado 2 (visual):** a lista do modal mostrava só nome + "Último acesso: X · Y%" em texto plano. O Hugo
quer o MESMO visual da tabela principal do gestor (`student-insights-table.tsx`): o `RitmoBadge` colorido,
a barra de progresso e o bloco de Engajamento (score + "N interações · M reflexões").

- **Fonte única (não duplicação, pedido explícito do Hugo):** extraí `RitmoBadge`, `RITMO_BADGE`,
  `RITMO_SORT_RANK`, o tipo `RitmoDisplay` e a partição display-level (agora `ritmoDisplayFrom`, pura sobre
  campos primitivos) de `student-insights-table.tsx` para um novo módulo compartilhado
  `apps/web/src/components/analytics/ritmo-badge.tsx`. A tabela reimporta de lá (`getRitmoDisplay` virou
  adapter fino); o modal importa o mesmo. UMA fonte de verdade para o visual, como pedido. Extração de baixo
  risco (esses símbolos só eram usados DENTRO da tabela; nenhum consumidor externo importava eles — o teste
  `student-insights-table.test.tsx` importa só `StudentInsightRow`/`StudentInsightsTable`/`buildManagerCsv`,
  segue 31/31 verde após a refatoração, provando preservação de comportamento).
- **`student-triage.ts` intocado (contrato travado):** o motor é read-only aqui. A partição de DISPLAY já
  era presentation-level (nunca foi do motor); só mudou de arquivo, não de lógica.
- **Rota `GET /api/engagement/students` (modo `ids`) ampliada (aditivo):** ela JÁ retornava
  `completedSessions`, `reflectionsCount`, `progressPct`, `ritmo` e `status` (= `triagem`). Faltava
  `coursesEnrolled`/`coursesCompleted` (o `RitmoDisplay` precisa deles para o estado "Concluído"). Derivei os
  dois do MESMO array `enrollments` já carregado (sem query nova, sem cálculo paralelo — mesma fonte do
  dashboard). Adicionados à interface local da rota E à `EngagementStudentDetail` compartilhada em `types.ts`
  (como opcionais, para não quebrar consumidores anteriores). Puramente aditivo: nenhum campo removido/renomeado,
  então `send-center-tab.tsx` (outro consumidor da rota) segue intacto.
- **`CohortStudent` (interface local do modal) ampliada** com os campos novos (todos já vêm da rota; zero
  cálculo client-side novo).

### Comandos de Verificação (Rodada 4)

- `pnpm --filter @eximia/web typecheck` → limpo.
- `pnpm --filter @eximia/web test` → **31 fail / 663 pass** — os 31 são o baseline PRÉ-EXISTENTE (sessions,
  auth-oauth, onboarding, dashboards de render, rate-limit), ZERO em engagement/analytics. +3 pass do teste
  novo de canal, +1 test file. Sem regressão nova.
- `npx biome check` nos diretórios tocados → meus arquivos limpos (o único warning restante é um
  `noArrayIndexKey` PRÉ-EXISTENTE no `StudentExpandedContent` da tabela, que não toquei).

### Teste novo (Rodada 4)

- `apps/web/src/lib/notifications/__tests__/dispatch-channel.test.ts` — 3 casos provando o gate de canal:
  `channel="inapp"` suprime o e-mail (Resend NUNCA chamado, nenhuma linha de e-mail), `channel="email"`
  dispara (Resend chamado + linha de e-mail), `channel` omitido = comportamento legado (default email). É a
  prova objetiva do bug fix (first-move rule: teste vermelho antes do código estava impossível — o
  comportamento antigo não tinha o parâmetro; então o teste pin o comportamento NOVO e a ausência dele no
  legado via o caso "omitido").

### File List (Rodada 4)

- `apps/web/src/lib/notifications/engine.ts` — `dispatchTeamNudge` ganhou `channel?` (default `email`) +
  gate `emailAllowed` no disparo do mirror.
- `apps/web/src/app/api/engagement/campaign/route.ts` — lê/normaliza `channel` do payload e propaga.
- `apps/web/src/app/(platform)/engagement/_components/campaigns-tab.tsx` — envia `channel` no `confirm` + dep.
- `apps/web/src/app/api/engagement/students/route.ts` — retorna `coursesEnrolled`/`coursesCompleted` (derivados
  dos enrollments já carregados).
- `apps/web/src/app/(platform)/engagement/_components/types.ts` — `EngagementStudentDetail` +2 campos opcionais.
- `apps/web/src/components/analytics/ritmo-badge.tsx` — NOVO módulo, fonte única do `RitmoBadge`/partição.
- `apps/web/src/components/analytics/student-insights-table.tsx` — reimporta do módulo; `getRitmoDisplay` vira
  adapter fino (definições locais duplicadas removidas).
- `apps/web/src/app/(platform)/engagement/_components/suggested-actions-tab.tsx` — modal com
  `ModalOverlay`+`ModalClose`; lista com `RitmoBadge`+barra+engajamento; `CohortStudent` ampliada.
- `apps/web/src/lib/notifications/__tests__/dispatch-channel.test.ts` — NOVO teste do gate de canal.

## Rodada 5 — Painel real Ulwick/Malouf/Taleb/Duke (2026-07-10)

Um painel real (Tony Ulwick, Dave Malouf, Nassim Taleb, Annie Duke) revisou a tela `/engagement`
ao vivo e convergiu em 6 itens, executados em ordem (o item 1 é a base dos itens 2 e 3).

### Item 1 (PRIORIDADE MÁXIMA, achado Malouf) — Unificar a lógica de triagem (RESOLVIDO)

**Bug confirmado no código:** `overview/route.ts` (e o espelho server-side em `page.tsx`)
REIMPLEMENTAVA a própria lógica de risco — redeclarava `SEM_ACESSO_DAYS = 14` como número
mágico local e definia "atenção" de forma ESTREITA (`!hasSession` apenas, ignorando atraso no
plano de ensino), enquanto o dashboard usa a taxonomia canônica de `student-triage.ts` onde
`atenção = atrasado || nao_iniciado`. Consequência real: o MESMO aluno podia cair em buckets de
risco diferentes conforme a tela — um aluno que ACESSA recentemente mas está atrasado no plano
aparecia como "No ritmo" no `/engagement` e como "Atenção" no dashboard.

**Fix — fonte de verdade única server-side:** novo helper `lib/notifications/engagement-triage.ts`
(`computeEngagementTriage`) que reusa `student-triage.ts` VERBATIM (`computeStudentRitmo` +
`computeStudentTriagem` + `computeTriageSummary`, consumidos, NUNCA modificados) e a MESMA
computação de `behind`/pace (deadline × progresso decorrido) que a rota `students` já usa. Retorna
o `TriageSummary` canônico (noRitmo/atencao/semAcesso + %). O `overview/route.ts` e o `page.tsx`
passaram a delegar a esse helper — o número mágico local e a definição estreita foram REMOVIDOS.
`student-triage.ts` fica INTOCADO (contrato travado). Defesa em profundidade: o helper filtra por
`inScope` em JS além do `.in()` no banco (mesmo belt-and-suspenders do overview antigo). Prova:
3 testes novos em `engagement-triage.test.ts`, o load-bearing sendo "aluno com sessão recente MAS
atrasado no plano → Atenção" (o caso que a lógica `!hasSession` antiga perdia).

### Item 2 (achado Taleb) — "Ações pendentes" com falha silenciosa (RESOLVIDO)

`acoesPendentes = suggestions.length` degradava a 0 (verde tranquilizador) quando o motor de
sugestão quebrava. O card "Ações pendentes" foi REMOVIDO do topo (redundante com "Atenção", achado
Ulwick). ANTES de remover, garantido que o sinal de erro NÃO se perde: o `console.error` no `catch`
de `generateNudgeSuggestions` (já existia no overview e no page) foi preservado e comentado como o
ponto onde um monitor/log captura a falha agora que o card que (mal) a expunha saiu. O contrato
`acoesPendentes` saiu do shape `EngagementOverviewCards`; a contagem de sugestões continua drivando
Campanhas via `suggestions` (bloco separado do overview), intacta.

### Item 3 — 5 cards → 3 cards canônicos (No ritmo / Sem acesso / Atenção) + Mensagens (RESOLVIDO)

`engagement-shell.tsx` `buildSummaryCards` agora emite os MESMOS 3 cards que o dashboard
(`dashboard/triage-cards.tsx`): No ritmo (verde `#059669`), Sem acesso (âmbar `#d97706`), Atenção
(vermelho `#dc2626`) — mesma cor, mesmo rótulo, mesmo sublabel, mesmo "(pct%)", mesmo cálculo (agora
unificado pelo item 1). "Mensagens enviadas" mantido como 4º card específico do canal (o dashboard
não o tem, é legítimo). "Taxa de leitura" REMOVIDA do topo (não usar "lido" para pixel de e-mail; se
preservada no futuro, vai para o detalhe de uma mensagem, rotulada "entregue"/"aproximado"). Grid de
5→4 colunas. O link "Ver histórico" (item 6 da Rodada anterior) migrou para o card Mensagens, intacto.

### Item 4 (achado Ulwick) — "Tipo de mensagem" ganha dropdown de templates reais (RESOLVIDO)

A Central de Envios (`send-center-tab.tsx`) tinha 4 categorias fixas de Tipo (Lembrete/Acionamento/
Reconhecimento/Mensagem livre) SEM conexão com o catálogo de templates (aba Templates, E9). Os dois
jobs agora COEXISTEM em sequência: (a) o seletor de Tipo continua categorizando o TOM; (b) dentro de
cada tipo, um dropdown "Modelo pronto" lista os templates REAIS daquela intenção (de
`notification_templates`, via o MESMO `GET /api/engagement/templates` que a aba Templates e o wizard
de Campanhas usam — UM catálogo). Mapa Tipo→intents em `TYPE_INTENTS` (remind→retomada/primeiro_acesso,
activate→atraso_plano/retomada, recognize→reconhecimento, manual→manual+sem-intent). Escolher um
template preenche a prévia com o `bodyInapp` dele como ponto de partida (o textarea já era editável,
só conectei a fonte do texto inicial). Trocar o Tipo invalida o template escolhido. O envio passa a
gravar a `templateKey` do template escolhido (rastreabilidade) quando há um. Sem template = texto
sugerido do tipo (comportamento anterior).

### Item 5 (achado Malouf) — Fase 0 de Templates pessoais: SÓ schema + RLS (RESOLVIDO)

Migration aditiva `20260710000000_engagement_personal_templates.sql`: adiciona `scope` (`'org'`|
`'personal'`, default `'org'`) e `owner_user_id` (nullable, `REFERENCES users(id) ON DELETE CASCADE`)
a `notification_templates`, mais um CHECK que casa scope↔owner (org⇒owner NULL; personal⇒owner NOT
NULL) para nunca produzir um template órfão ou ambíguo. RLS ajustada: `nt_select`/`nt_write` agora
diferenciam por scope — `personal` só é visível/editável por `owner_user_id = auth.uid()`; `org`
mantém EXATAMENTE a política atual (qualquer manager/admin do tenant edita — o risco latente que o
Malouf registrou, NÃO resolvido aqui, só não piorado). Aditiva e retrocompatível: todo template
existente vira `scope='org'` (default da coluna + backfill explícito), owner NULL, comportamento
byte-a-byte preservado. SEM UI nova nesta rodada (só o modelo de dados, como pedido).

### Item 6 (Hugo ao vivo) — Central de Envios sem botão Cancelar (RESOLVIDO)

Adicionado botão "Cancelar" (variant ghost, ao lado do Enviar) no composer do `send-center-tab.tsx`
que chama `resetToPicker` (limpa o estado, volta à seleção de aluno, sem enviar nada). Padrão visual
dos demais botões da tela; complementa o "Trocar aluno" do header (que já fazia o reset, mas o Hugo
queria um Cancelar explícito na área de ação).

### Decisões de escopo (documentadas honestamente)

- **`taxaLeituraPct` removida do contrato, não movida para detalhe de mensagem nesta rodada.** O
  item 3 sugere "mover para dentro do detalhe de uma mensagem, rotulado por canal". A remoção do topo
  foi feita; a re-inserção no detalhe de mensagem é UI nova (a tela de detalhe de mensagem não existe
  hoje separada do Histórico) e ficou fora do escopo mínimo — registrado como follow-up, não fingido
  como feito.
- **Item 5 é schema+RLS apenas, migration NÃO aplicada ao cloud.** O deploy ao Supabase remoto é
  autoridade exclusiva do @devops (`agent-authority.md`); a migration está no repo, aditiva e
  idempotente (`ADD COLUMN IF NOT EXISTS`, `DROP CONSTRAINT/POLICY IF EXISTS` antes de recriar). Não
  há harness de migração local (nem PGlite) neste repo para prova automatizada; a validação é por
  revisão contra o schema real de `20260604120000` + idempotência das cláusulas.
- **Mapa Tipo→intent do item 4 é uma escolha de curadoria.** Os intents `retomada`/`atraso_plano`/
  etc. não têm um vínculo formal com os 4 tipos de tom; o mapa `TYPE_INTENTS` é uma associação
  editorial razoável (Art.IV: não inventei um vínculo no schema, só uma filtragem na UI). Se o Hugo
  quiser outro agrupamento, é ajuste de uma constante.

### File List (Rodada 5)

- `apps/web/src/lib/notifications/engagement-triage.ts` — NOVO helper canônico (item 1), fonte única
  de triagem server-side reusando `student-triage.ts`.
- `apps/web/src/app/api/engagement/overview/route.ts` — item 1: delega a `computeEngagementTriage`;
  cards viram o shape canônico; item 2: log de falha preservado ao remover o card.
- `apps/web/src/app/(platform)/engagement/page.tsx` — item 1: mesmo helper no first-paint server-side;
  `SEM_ACESSO_DAYS` local e o import top-level de `getActiveContextCookie` removidos.
- `apps/web/src/app/(platform)/engagement/_components/types.ts` — item 1-3: `EngagementOverviewCards`
  vira o shape canônico (analisados/noRitmo/semAcesso/atencao + %s + mensagensEnviadas).
- `apps/web/src/app/(platform)/engagement/_components/engagement-shell.tsx` — item 3: 3 cards canônicos
  (cor/rótulo/cálculo do `TriageCards`) + Mensagens; grid 5→4; "Ações pendentes" e "Taxa de leitura"
  removidos.
- `apps/web/src/app/(platform)/engagement/_components/send-center-tab.tsx` — item 4: dropdown "Modelo
  pronto" com templates reais por tipo; item 6: botão Cancelar.
- `apps/web/supabase/migrations/20260710000000_engagement_personal_templates.sql` — item 5: NOVA
  migration aditiva (scope + owner_user_id + RLS por scope).
- `apps/web/src/lib/notifications/__tests__/engagement-triage.test.ts` — NOVO, 3 testes do helper
  canônico (behind→atenção, mix nos 3 buckets, fail-closed).
- `apps/web/src/app/api/engagement/__tests__/{routes-leak,canonical-scope}.test.ts` — asserções dos
  cards migradas do shape antigo (`alunosEmAtencao`/`semAcessoRecente`) para o canônico
  (`analisados`/`atencao`).

### Verificação (Rodada 5)

- `pnpm --filter @eximia/web typecheck` → limpo.
- `pnpm --filter @eximia/web test` → **31 fail / 666 pass** — os 31 são o baseline PRÉ-EXISTENTE
  (rate-limit, login-oauth, dashboards de render, onboarding, sessions/messages), ZERO em engagement.
  +3 pass do helper novo. Sem regressão nova. Domínio engagement+notifications = 54/54 verde.
- `npx biome check (platform)/engagement api/engagement lib/notifications` → limpo (o único warning é
  o `noArrayIndexKey` PRÉ-EXISTENTE de `StudentExpandedContent`, não tocado).
- Migration (item 5): aditiva/idempotente por revisão; NÃO aplicada ao cloud (autoridade @devops).
- NÃO committado (working tree).

## Rodada 6 — Uso ao vivo do Hugo, 6 problemas com screenshot (2026-07-11)

O Hugo testou `/engagement` ao vivo (dev server, `localhost:3001`) e reportou 6 problemas concretos.
A ordem de execução foi técnica: item 1 (crítico, rápido) primeiro, depois a reforma do composer
(itens 2/3/4/5) e o polish (item 6). Repo real = `eximia-academy-v2`.

### Item 1 (CRÍTICO) — "Revisar mensagem"/"Ação individual" não faziam nada (RESOLVIDO)

**Causa raiz confirmada (o Hugo já a tinha diagnosticado):** `openIndividual()` em
`suggested-actions-tab.tsx` navega client-side para `/engagement?student=X&action=Y`. O
`engagement-shell.tsx` selecionava a aba "send-center" via um INICIALIZADOR de `useState`
(`deepLinked ? "send-center" : "suggested"`). O inicializador de `useState` só roda na PRIMEIRA
montagem — como o usuário já está montado em `/engagement` (navegação client-side na MESMA rota, sem
remount), ele nunca reagia à chegada tardia de `initialStudentId`/`initialAction`: a URL mudava mas a
aba nunca trocava, e os botões pareciam mortos.

**Fix:** adicionado um `useEffect` que OBSERVA `initialStudentId`/`initialAction` e chama
`setActiveTab("send-center")` quando os dois ficam preenchidos — reage à mudança em vez de só
inicializar uma vez. Confirmado o fluxo: o `page.tsx` é server component que re-renderiza com os novos
`searchParams` no `router.push`, re-passando os props ao shell; o effect dispara e a aba abre
pré-preenchida.

### Item 2 (mudança de produto, override da Rodada 5) — "Tipo de mensagem" simplificado (RESOLVIDO)

O Hugo rejeitou o modelo da Rodada 5 (4 categorias de TOM Lembrete/Acionamento/Reconhecimento/Mensagem
livre + dropdown de template dentro de cada uma): *"Escolha o tom, não é assim que funciona, você tem
que escrever o texto ou usar um template pré-escrito."* Removida a seção "Tipo de mensagem" (o array
`ACTION_OPTIONS`/`MESSAGE_TYPES` e o mapa `TYPE_INTENTS`). Em seu lugar, uma escolha binária:
**Escrever do zero** (textarea livre, sem tom antes) OU **Usar um template** (dropdown ÚNICO listando
TODOS os templates ativos do tenant, filtrado apenas pelo CANAL escolhido, não por tom/tipo). O
`nudgeType` que a lógica de negócio precisa continua DERIVADO server-side do status real do aluno (o
`detail.nudgeType` que a rota `students` já computa via `deriveNudgeTypeFromRitmo`); o gestor nunca mais
escolhe um tom. Bulk (item 5) usa `nudgeType='custom'` (a mensagem livre É o corpo).

### Item 3 (bug de copy) — mensagem duplicada "percebeu ... Percebi que" (RESOLVIDO)

Os textos de `SUGGESTED_BODY` começavam com "Percebi que você ainda não acessou..." Quando a origem é
Plataforma, `renderWithOrigin` já prefixa "A exímIA Academy percebeu o seguinte:", resultando em
"...percebeu o seguinte: Percebi que...". Reescritos os 5 textos para começarem DIRETO na observação
("Você ainda não acessou a plataforma...", "Faz um tempo que você não acessa...", etc.), sem
"Percebi/Notei/Percebemos que". Verificado que lê bem sob AMBAS as origens: Plataforma ("A exímIA
Academy percebeu o seguinte:\n\nVocê ainda não acessou...") e Gestor ("Aqui é {nome}.\n\nVocê ainda
não acessou...").

### Item 4 (gap) — canal de envio individual/bulk hardcoded em in-app (RESOLVIDO)

O canal estava hardcoded: `channel: "inapp"` no payload e `channelInapp={true} channelEmail={false}` no
`MessagePreviewPanel`. Agora passo `channelEmail={true}` também, então o painel renderiza o radio group
In-app/Email que ELE JÁ TINHA (usado pela aba Campanhas desde a Rodada 4), e `preview.channel` dirige o
payload. `POST /api/engagement/action` passou a LER `channel` e propagá-lo a `dispatchTeamNudge` (que já
aceita o gate `channel?` desde a Rodada 4 — reuso do MESMO mecanismo, sem inventar novo). Um "In-app"
explícito agora SUPRIME de verdade o mirror de e-mail; o default (omitido) continua `email` (legado
byte-a-byte para `api/analytics/manager/nudge`).

### Item 5 (feature nova) — envio em massa leve na Central de Envios (RESOLVIDO)

O picker "Escolha o aluno" virou **seleção MÚLTIPLA**: marcar vários alunos (checkbox por linha + chips
removíveis dos selecionados). 1 selecionado → composer completo com o card do aluno; 2+ selecionados →
composer de lote (mesma mensagem para todos, sem card individual). O botão Enviar dispara para todos os
selecionados com o MESMO texto/canal/origem. **Reuso do mecanismo existente (não inventei caminho
novo):** `POST /api/engagement/action` ganhou um `studentIds: string[]` OPCIONAL ao lado do `studentId`
legado; ele re-escopa a lista via `resolveEngagementScope` (mesma trava), aplica o cap de 200 e chama o
MESMO `dispatchTeamNudge` (o motor que a Campanha usa) com a lista. Distinção de Campanhas preservada:
é um envio PONTUAL manual, registrado no Histórico como um envio individual, **sem** criar um objeto de
campanha observável (não vira "campanha aberta"). Inegociáveis de segurança preservados: cap 200,
re-scope server-side (out-of-scope são DROPADOS, set vazio → 403), revisão antes do envio (o composer
sempre mostra o preview editável). O componente exige `preview.message.trim().length > 0` no botão.

### Item 6 (polish visual) — "Acionar aluno" e Templates (RESOLVIDO)

- **Composer da Central de Envios:** reorganizado com hierarquia clara — card `bg-bg-card rounded-2xl
  shadow-card p-6`, métricas do aluno num bloco `bg-bg-surface rounded-xl`, separadores
  `border-border-subtle`, botões de modo de composição com estados de seleção consistentes (tokens
  `cerrado-600`). Espaçamento `space-y-6` uniforme.
- **Aba Templates:** banner "Templates são compartilhados" ganhou trilho de acento
  (`border-l-4 border-cerrado-600`) + ícone em círculo + card da casa; os headings de intenção ganharam
  contador; os cards ganharam `ring-1 ring-border-subtle/60`, hover `shadow-elevated` (token existente,
  NÃO inventei `shadow-card-hover`), prévia em `bg-bg-surface` e rodapé com separador. Lógica intocada.

### Decisões / observações honestas (Rodada 6)

- **Double-greeting pré-existente (NÃO corrigido, fora de escopo):** `preview.message` já contém a
  saudação (via `buildSuggestedMessage`), e o motor `renderWithOrigin` a envolve de novo no dispatch,
  produzindo "Olá, X. ...\n\nOlá, X. ..." no que o ALUNO recebe. Isso é PRÉ-EXISTENTE (o código de HEAD
  fazia idêntico no envio individual) e NÃO estava nos 6 itens nem foi flagado pelo Hugo. Preservei o
  comportamento byte-a-byte (Art. IV — não expandir escopo silenciosamente); registro como observação
  para um follow-up dedicado se o Hugo confirmar que incomoda.
- **`[AUTO-DECISION]` fetch do detalhe do aluno manual → `action=activate`.** Sem o seletor de tom, a
  rota `students` ainda precisa de um `action` para derivar o `nudgeType`. Escolhi `activate` (deriva do
  ritmo real — o sinal honesto), que rende o corpo sugerido certo; deep-links preservam seu `?action=`
  (recognize → top_performer intocado).
- **`[AUTO-DECISION]` bulk usa `nudgeType='custom'`.** No lote não há um `detail` único; `custom` já está
  no enum de `POST /action` e a mensagem livre É o corpo (o motor aceita override). Rastreabilidade via
  `templateKey` quando um template é escolhido.
- **Reprodução manual do item 1 não executada ao vivo por mim** (o dev server é do Hugo; não o
  reiniciei). O fix é determinístico (o inicializador de `useState` não reage a props tardios é um modo
  de falha conhecido de React) e a lógica de re-render do server component com novos `searchParams` é o
  contrato do Next App Router. Se ainda não abrir, o próximo sinal seria o `page.tsx` não re-renderizar
  — mas isso quebraria também o deep-link inicial (que já funcionava), então o effect é o elo faltante.

### File List (Rodada 6)

- `apps/web/src/app/(platform)/engagement/_components/engagement-shell.tsx` — item 1: `useEffect` que
  reage a `initialStudentId`/`initialAction` e troca para a aba Central de Envios.
- `apps/web/src/app/(platform)/engagement/_components/send-center-tab.tsx` — itens 2/3/4/5/6: seletor de
  tom removido → binário escrever/template; textos sugeridos sem "Percebi que"; canal real via painel;
  picker multi-select + envio em lote; polish do composer.
- `apps/web/src/app/api/engagement/action/route.ts` — itens 4/5: aceita `studentIds[]` (bulk,
  re-escopado + cap 200) e `channel` (propaga a `dispatchTeamNudge`).
- `apps/web/src/app/(platform)/engagement/_components/templates-tab.tsx` — item 6: polish do banner +
  cards + headings.
- `apps/web/src/app/api/engagement/__tests__/routes-leak.test.ts` — 3 testes novos do action route
  (bulk drop out-of-scope, 403 quando todo o lote é fora de escopo, propagação de canal).

### Verificação (Rodada 6)

- `pnpm --filter @eximia/web typecheck` → limpo.
- `pnpm --filter @eximia/web test` → **31 fail / 688 pass** — os 31 são o baseline PRÉ-EXISTENTE
  (sessions/messages, auth-oauth, onboarding, dashboards de render, rate-limit), ZERO em
  engagement/notifications. +3 pass dos testes novos do action route. Sem regressão nova. Domínio
  engagement+notifications = **76/76 verde**.
- `npx biome check` nos arquivos tocados → limpos (o único warning restante é um
  `noExplicitAny`-suppression PRÉ-EXISTENTE em `engagement-triage.test.ts`, que não toquei).
- NÃO committado (working tree).

## Rodada 7 — 3 problemas ao vivo do Hugo, com reprodução real de browser (2026-07-11)

O Hugo testou `/engagement` de novo ao vivo e reportou 3 problemas. Repo real = `eximia-academy-v2`,
branch `feat/engagement-center-v2`.

### Item 1 (CRÍTICO, exigia reprodução AO VIVO) — "Ação individual" no modal "não fazia nada" (RESOLVIDO por diagnóstico de ambiente + hardening)

**Reprodução real (não leitura de código):** montei um driver Playwright headless (`@playwright/test`
+ sessão Supabase real do gestor **Rinaldo**, gerada via `admin.generateLink` magiclink →
`verifyOtp` → cookies do `@supabase/ssr` injetados no browser) e dirigi o fluxo exato: logar como
Rinaldo → `/engagement` → aba Ações Sugeridas → "Ver alunos" num card → dentro do modal, "Ação
individual" no aluno (Venilton). **Resultado: o fluxo FUNCIONA.** A URL muda para
`/engagement?student=…&action=activate`, o modal fecha, a aba "Central de Envios" fica ativa (destaque
laranja) e o composer abre com o aluno pré-selecionado no chip. Screenshot capturado, zero erro de
console.

**Causa raiz REAL (não era o código):** o dev server do Hugo (`localhost:3000`, iniciado de madrugada)
está rodando com **env congelada de um projeto Supabase MORTO** (o SANDBOX `pkdzthdymdhfqwgskijv`, cujo
DNS nem resolve mais). O `.env.local` atual aponta para o PROD (`vaguswivhqnlbgqvnjch`), mas o Next.js
fixa a env no BOOT — o turbopack recarrega o CÓDIGO a quente, mas NÃO a env. Prova A/B definitiva: a
MESMA sessão PROD e o MESMO código dão `307 → /login` na porta 3000 (server do Hugo) e `200 renderiza`
numa porta 3005 recém-bootada com a env PROD correta. Ou seja, o `getUser()` do middleware na 3000
falha (não alcança o Supabase do SANDBOX morto) e todo request protegido cai no login — o que o Hugo
interpretou como "os botões não fazem nada" era o servidor rejeitando a navegação, não o engagement.
**Ação para o Hugo: reiniciar o dev server** (matar e subir de novo) para recarregar o `.env.local`
PROD. O código de engagement está correto e provado.

**Hardening aditivo (custo zero, robustez real):** troquei a dependência do `useEffect` que troca a aba
de `[initialStudentId, initialAction]` (props derivados) para `[searchParams.get("student"),
searchParams.get("action")]` (query string crua). Isso cobre o caso de navegação REPETIDA para o MESMO
aluno (deep-link A → voltar às Ações → deep-link A de novo): com os props, as deps não mudavam e a aba
não re-trocava se o gestor tivesse voltado manualmente; lendo a query crua, todo `router.push` genuíno
re-seleciona a Central de Envios.

### Item 2 — canal deveria permitir os DOIS ao mesmo tempo (RESOLVIDO)

O `MessagePreviewPanel` tinha um `RadioGroup` In-app/E-mail (mutuamente exclusivo; e, pior, o rótulo
"E-mail" na verdade significava "in-app + e-mail", porque o motor SEMPRE escreve a linha in-app e o
e-mail é espelho). Troquei por **dois `Checkbox` independentes** — o gestor marca In-app e/ou E-mail, os
dois juntos se quiser. `MessagePreviewValue.channel: "inapp"|"email"` virou o par honesto
`channelInapp: boolean` + `channelEmail: boolean`. Na Central de Envios o `handleSend` deriva o modelo
de 3 estados do motor a partir dos dois flags: in-app só → `"inapp"` (espelho de e-mail suprimido);
in-app + e-mail → `"email"` (linha in-app + espelho de e-mail, comportamento legado); **e-mail só →
`"email_only"` (novo — pula a linha da caixa de entrada in-app e manda só o e-mail).** Nenhum canal
marcado desabilita o botão Enviar + aviso "Selecione ao menos um canal". O motor `dispatchTeamNudge`
ganhou o gate `inAppAllowed = channel !== "email_only"` ao lado do `emailAllowed` existente; a rota
`action` aceita e propaga `"email_only"`. Default `"email"` preserva TODO call-site legado byte-a-byte
(a Campanhas não muda). Prova ao vivo: as duas checkboxes renderizam e marcar E-mail mantém In-app
marcado (independência confirmada por `aria-checked`).

### Item 3 (bug confirmado) — saudação dupla "Olá X. ...\n\nOlá X! ..." (RESOLVIDO)

Confirmado o mecanismo: os 5 templates seed (`body_inapp` da migration `20260604120000`) começam com
"Olá, {{primeiro_nome}}!...", e `renderWithOrigin` SEMPRE prefixa a saudação canônica ("Olá, {nome}.
Aqui é {gestor}." / "Olá, {nome}. A exímIA Academy percebeu o seguinte:"), empilhando duas. O mesmo
vale para o corpo livre composto pelo cliente (`buildSuggestedMessage` já traz saudação, e o motor
envolve de novo — a observação de follow-up da Rodada 6).

**Fonte única de verdade = `renderWithOrigin`, aplicada exatamente uma vez.** Dois movimentos:
1. **`renderWithOrigin` virou idempotente** (`engine.ts`): antes de aplicar a saudação, tira uma
   saudação líder pré-existente. Duas formas conhecidas, casadas com precisão para nunca comer corpo
   real: a de PARÁGRAFO (`"Olá, X. Aqui é Y.\n\n"` / `"Olá, X. A exímIA Academy percebeu o
   seguinte:\n\n"` / `"Olá, X.\n\n"`) e a INLINE do template legado (`"Olá, X! "` com o resto na mesma
   linha). Isso cobre template, corpo livre, mensagem editada à mão E linhas de banco não migradas —
   backstop no único ponto de estrangulamento do servidor.
2. **Migration aditiva `20260712000000`** que remove o "Olá, {{primeiro_nome}}! " líder do `body_inapp`
   dos 5 templates seed em TODOS os tenants (idempotente: só toca linhas que ainda começam com a
   saudação). Escopo deliberado: SÓ `body_inapp`. O `email_html` fica intacto — no caminho
   Plataforma+template puro o motor manda o `email_html` do template CRU (a saudação dele é a ÚNICA ali;
   remover deixaria o e-mail sem saudação). O `body_inapp` é o único campo sempre re-envolvido por
   `renderWithOrigin`, então é o único que duplicava.

Testado nos dois casos (origem Gestor e Plataforma): exatamente uma saudação. Falso-positivo checado
(`"Olários..."` não é saudação e é preservado).

### Decisões / observações honestas (Rodada 7)

- **Item 1 não era bug de código.** Provado por reprodução de browser real + teste A/B de porta. A
  entrega aqui é o diagnóstico (env do dev server congelada num Supabase morto) + um hardening que torna
  a troca de aba robusta a navegação repetida. Não inventei um "fix" para um código que já funcionava
  (Artigo IV).
- **`email_only` é um TERCEIRO estado novo do motor**, não uma reinterpretação do `"email"` legado — por
  isso `"email"` continua significando "ambos" e nenhum call-site existente muda.
- A migration `20260712000000` **NÃO foi aplicada ao banco remoto** (sem Docker; aplicação é do
  orquestrador/@devops). Só o arquivo foi escrito.

### File List (Rodada 7)

- `apps/web/src/lib/notifications/engine.ts` — item 3: `renderWithOrigin` idempotente
  (`stripLeadingGreeting` + 2 regex de saudação líder); item 2: gate `inAppAllowed` + canal
  `"email_only"` no tipo e no loop de dispatch (pula a linha in-app).
- `apps/web/src/app/(platform)/engagement/_components/message-preview-panel.tsx` — item 2:
  `MessagePreviewValue` passa a `channelInapp`/`channelEmail`; seção de canal vira 2 checkboxes
  independentes + aviso de nenhum canal.
- `apps/web/src/app/(platform)/engagement/_components/send-center-tab.tsx` — item 2: seeds do preview e
  `applyTemplate` usam os dois flags; filtro de templates por canais selecionados; `handleSend` deriva
  `"inapp"|"email"|"email_only"` e bloqueia sem canal; botão Enviar desabilitado sem canal.
- `apps/web/src/app/(platform)/engagement/_components/engagement-shell.tsx` — item 1 (hardening): o
  `useEffect` de troca de aba passa a reagir à query string crua (`?student`/`?action`).
- `apps/web/src/app/api/engagement/action/route.ts` — item 2: aceita e propaga `channel: "email_only"`.
- `supabase/migrations/20260712000000_engagement_template_dedup_greeting.sql` — item 3: UPDATE aditivo
  que tira a saudação embutida do `body_inapp` dos 5 templates seed (NÃO aplicada ao remoto).
- `apps/web/src/lib/notifications/__tests__/engine.test.ts` — item 3: 3 testes de idempotência de
  `renderWithOrigin` (gestor com saudação líder, plataforma com saudação de template, falso-positivo).
- `apps/web/src/lib/notifications/__tests__/dispatch-channel.test.ts` — item 2: 1 teste de
  `channel="email_only"` (e-mail sai, linha in-app pulada).

### Verificação (Rodada 7)

- Reprodução de browser real do item 1 (Playwright + sessão Rinaldo real): fluxo "Ação individual" →
  Central de Envios pré-preenchida FUNCIONA; A/B de porta 3000 (env morta) vs 3005 (env PROD) isola a
  causa no ambiente do dev server. Screenshots capturados.
- `pnpm --filter @eximia/web typecheck` → limpo.
- `pnpm --filter @eximia/web test` → **31 fail / 692 pass** — os 31 são o baseline PRÉ-EXISTENTE
  (sessions/messages, auth-oauth, onboarding, dashboards de render, rate-limit), ZERO em
  engagement/notifications. +4 pass dos testes novos (3 idempotência + 1 `email_only`). Sem regressão
  nova. Domínio engagement+notifications = **75/75 verde** (56 rotas + 15 engine + 4 canal).
- `npx biome check` nos 7 arquivos tocados → limpos.
- Scripts de reprodução temporários removidos (não deixaram resíduo no repo).
- NÃO committado (working tree).

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-11 | Rodada 7 (3 problemas ao vivo, com REPRODUÇÃO real de browser): **(1)** CRÍTICO "Ação individual" — reproduzido AO VIVO com Playwright + sessão real do gestor Rinaldo e o fluxo FUNCIONA (Central de Envios abre pré-preenchida); causa raiz REAL = o dev server do Hugo (`localhost:3000`) está com env congelada de um Supabase MORTO (SANDBOX `pkdzthdymdhfqwgskijv`, DNS não resolve), provado por A/B de porta (mesma sessão+código: 3000 dá 307→login, 3005 recém-bootado com env PROD renderiza 200); ação = Hugo reiniciar o dev server; hardening aditivo = o `useEffect` de troca de aba reage à query string crua (cobre navegação repetida ao mesmo aluno). **(2)** canal permite os DOIS ao mesmo tempo — `RadioGroup` exclusivo → 2 `Checkbox` independentes; `MessagePreviewValue.channel` → par `channelInapp`/`channelEmail`; motor ganha 3º estado `"email_only"` (pula linha in-app) via gate `inAppAllowed`; rota `action` propaga; sem canal desabilita Enviar; default `"email"`=ambos preserva legado byte-a-byte. **(3)** saudação dupla — `renderWithOrigin` virou idempotente (tira saudação líder de parágrafo OU inline antes de aplicar a canônica) + migration aditiva `20260712000000` que limpa o `body_inapp` dos 5 templates seed (só `body_inapp`; `email_html` intacto pois é a única saudação no caminho Plataforma+template). 4 testes novos (3 idempotência + 1 `email_only`), 75/75 no domínio, baseline 31 fails inalterado, typecheck/biome limpos. Migration NÃO aplicada ao remoto (@devops). NÃO committado. | Dex (@dev) |
| 2026-07-09 | Story criada (Tier 2, pós-uso do Hugo + painel real Jobs/Ive/Norman) | River (SM) |
| 2026-07-09 | Implementados os 6 itens do Escopo (InReview). Item 3 blindado (falha visível + logs) mas reprodução ao vivo NÃO obtida — sem login utilizável no alvo remoto, documentado honestamente. Typecheck/biome limpos, suíte sem regressão nova (baseline 31 fails inalterado). NÃO committado. | Dex (@dev) |
| 2026-07-09 | Rodada 2 (dado real Cory, ao vivo): (A) causa raiz de "Caio não aparece" = role=manager mesmo, escopo do gestor real (Rinaldo→40) provado íntegro; (B) Central de Envios agora lista o recorte completo rolável, busca filtra (rota modo LIST + picker); (C) BUG de Campanhas corrigido na fonte — página renderiza cohorts `pending` do recorte (5 reais), não só os recém-criados descartados pela cadência 24h. 3 testes novos, 48/48 verdes, typecheck/biome limpos. NÃO committado. | Dex (@dev) |
| 2026-07-09 | Rodada 3 (pills funcionais + hierarquia como árvore, ao vivo): pills Hierarquia/Meu Time viraram o toggle real (`TeamScopeControl` reusado) + default fresco corrigido para Diretos/Meu Time (causa raiz = ramo "manager fora de team" de `resolveEngagementScope` retornava subtree achatado; ramos unificados honrando `getTeamViewMode` default `direct`). Drill-down real nó por nó via `?focus=` de ponta a ponta (5º arg em `resolveEngagementScope` + `readFocusParam` nas 7 rotas + `withFocus` nas abas + `SubtreeNodeList`/"Times abaixo" reusado). Trade-offs registrados (default `/engagement`-only, preview de campanha não honra focus). 54/54 verdes no domínio, baseline 31 fails inalterado. NÃO committado. | Dex (@dev) |
| 2026-07-09 | Rodada 4 (2 pedidos do Hugo): (1) canal do wizard de Campanhas passou a controlar de VERDADE o disparo de e-mail — `dispatchTeamNudge` ganhou `channel?` (default `email`, legado intocado), rota propaga, client envia no `confirm`; Central de Envios individual ficou de fora por decisão de escopo documentada (sem seletor de canal na UI, Art.IV). (2) Popup "Ver alunos" agora fecha por X + clique fora + Esc (`ModalOverlay`/`ModalClose` no padrão do produto) e mostra Ritmo/Progresso/Engajamento no MESMO visual da tabela via `RitmoBadge` extraído p/ módulo compartilhado `ritmo-badge.tsx` (fonte única, não duplicação); rota `students` retorna +2 campos aditivos de enrollment. 3 testes novos de canal, baseline 31 fails inalterado, typecheck/biome limpos. NÃO committado. | Dex (@dev) |
| 2026-07-11 | Rodada 6 (uso ao vivo do Hugo, 6 problemas com screenshot): **(1)** CRÍTICO — botões "Revisar mensagem"/"Ação individual" mortos porque o inicializador de `useState` do shell não reagia à chegada tardia do deep-link (navegação client-side sem remount); fix = `useEffect` que reage a `initialStudentId`/`initialAction`. **(2)** override da Rodada 5 — seletor de TOM (4 categorias) removido, virou escolha binária escrever-do-zero / usar-template (dropdown ÚNICO de TODOS os templates ativos, filtrado só por canal); `nudgeType` segue derivado server-side. **(3)** textos sugeridos reescritos sem "Percebi que" (evita "percebeu ... Percebi que" sob origem Plataforma). **(4)** canal de envio individual/bulk deixou de ser hardcoded in-app — painel oferece In-app/Email de verdade, rota `action` lê+propaga `channel` a `dispatchTeamNudge`. **(5)** picker virou seleção MÚLTIPLA + envio em lote leve reusando `dispatchTeamNudge` via `studentIds[]` na rota `action` (re-escopado + cap 200, sem criar campanha observável; registrado no Histórico como envio individual). **(6)** polish visual do composer e da aba Templates. Double-greeting pré-existente registrado como observação (fora de escopo, Art. IV). 3 testes novos do action route, 76/76 no domínio, baseline 31 fails inalterado, typecheck/biome limpos. NÃO committado. | Dex (@dev) |
| 2026-07-10 | Rodada 5 (painel real Ulwick/Malouf/Taleb/Duke, 6 itens em ordem): **(1)** triagem unificada — novo helper `engagement-triage.ts` (fonte única server-side reusando `student-triage.ts`), overview/page delegam a ele, `SEM_ACESSO_DAYS` mágico e "atenção=!hasSession" REMOVIDOS (o mesmo aluno atrasado no plano agora bate entre `/engagement` e dashboard); **(2)** card "Ações pendentes" (falha silenciosa a 0) removido do topo, log de erro do motor preservado; **(3)** 5 cards→3 canônicos (No ritmo/Sem acesso/Atenção, cor+rótulo+cálculo do `TriageCards`)+Mensagens, "Taxa de leitura" fora; **(4)** Central de Envios ganha dropdown "Modelo pronto" com templates REAIS por tipo (mesmo catálogo da aba Templates), Tipo continua sendo o tom; **(5)** Fase 0 de Templates pessoais — migration aditiva `20260710000000` (scope+owner_user_id+RLS por scope), SEM UI nova, retrocompatível; **(6)** botão Cancelar no composer da Central de Envios. 3 testes novos do helper, 54/54 no domínio, baseline 31 fails inalterado, typecheck/biome limpos. `taxaLeitura no detalhe de msg` e deploy da migration ao cloud (autoridade @devops) documentados como follow-up. NÃO committado. | Dex (@dev) |
