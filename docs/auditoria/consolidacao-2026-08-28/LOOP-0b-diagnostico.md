# LOOP-0b — Diagnóstico das 3 runs POP-FIX abandonadas + triagem dos untracked

> Medido em 2026-08-28, HEAD `d2b8083`. 100% read-only — nenhum documento ou código foi
> alterado por esta tarefa. Suítes rodadas frescas (não a partir do log antigo):
> `pnpm --filter @eximia/web test tests/epic-23-docs-vs-code.test.ts`,
> `tests/epic-6-security-posture-doc.test.ts`, `tests/epic9-docs-vs-realidade.test.ts`.

## CRÍTICOS

**Nenhum.** Das 33 asserções vermelhas diagnosticadas nas 3 suítes, **zero são CODIGO-ERRADO**.
Toda asserção vermelha é **DOC-ERRADO** (documento nega ou omite um controle/estado que o
código já implementa corretamente). Não há funcionalidade ausente, controle de segurança
ausente ou dado pessoal desprotegido em produção — apenas documentação que não acompanhou o
código.

Dois pontos que TOCAM autorização/segurança foram investigados a fundo por estarem no
território sensível descrito na tarefa, e **nenhum se confirmou como CODIGO-ERRADO**:

- **epic-23 B4/B7** (guarda de papel do audit-course e do apply route): o documento declara
  guarda de 2 papéis (`manager`, `admin`), o código aceita 4 (`manager`, `admin`,
  `super_admin`, `instructor`). Verifiquei as **4 rotas irmãs** do course-designor
  (`generate`, `ai-fill`, `apply`, `audit-course`) e as 4 têm **exatamente a mesma guarda de
  4 papéis**, presente desde o import inicial (`d65f3a5`), não introduzida por um commit
  isolado. É uma política de RBAC uniforme e deliberada do produto (instrutores e
  super-admins também podem operar o course-designer), não um bug de escopo pontual nesta
  rota. Classificado DOC-ERRADO — o doc documenta uma versão antiga e mais estreita da
  política, que o produto já superou de forma consistente.
- **epic-9, story-9.1** (coleta de `employee_status`, dado de RH/pessoal): a story declara
  `Draft` negando que a coleta exista, mas o código já coleta e grava o campo em produção
  (`apps/web/src/app/onboarding/actions.ts`). Isto é DOC-ERRADO no sentido do veredito (o
  código está certo, o doc nega), mas registro à parte: enquanto a doc de inventário de dado
  pessoal ficar em Draft, a organização **não tem o registro formal de coleta de PII
  atualizado** — relevante para LGPD por motivo de compliance documental, não porque o
  controle técnico esteja ausente. Recomendo que a atualização do Status desta story para
  refletir a realidade seja tratada com prioridade acima das demais correções de doc, dado o
  tema.

## Parte 1 — Diagnóstico asserção a asserção

### `epic-23-docs-vs-code.test.ts` — 16 de 25 falham (9 passam, controle positivo íntegro)

Bloco A — SUBESTIMA (documento nega o que o código tem). Todas as 9 são **DOC-ERRADO**: os
Status ficaram em `Ready`/`Draft` e as caixas de AC ficaram desmarcadas porque ninguém voltou
ao documento depois de implementar — código confirmado em produção em cada linha.

| # | Asserção | O que ela afirma | Evidência doc | Evidência código | Veredito |
|---|---|---|---|---|---|
| A1 | epic-23:7 Status ≠ Draft | epic diz `Draft`, mas as 4 stories-filhas têm artefato em produção | `docs/epics/epic-23-...md:7` → `**Status:** Draft` | `packages/agents/src/course-designer/{auditor,apply-blueprint}.ts`, migration WS2, `course-selector.tsx` — todos existem (confirmado no bloco controle) | **DOC-ERRADO** |
| A2 | story-23.1:8 Status ≠ Ready | `auditCourse` já está exportado de `@eximia/agents` | `story-23.1...md:8` → `**Status:** Ready` | `packages/agents/src/index.ts` exporta `auditCourse` (regex `\bauditCourse\b` casa) | **DOC-ERRADO** |
| A3 | story-23.2:8 Status ≠ Ready | `applyBlueprint` já está exportado | idem, `Status: Ready` | `packages/agents/src/index.ts` exporta `applyBlueprint` | **DOC-ERRADO** |
| A4 | story-23.3:8 Status ≠ Ready | migration WS2 e schema Drizzle aplicados | `story-23.3...md:8` → `Ready` | `supabase/migrations/20260226000000_add_ws2_fields_to_chapters.sql` existe; `packages/database/src/schema/chapters.ts` contém `interaction_type` | **DOC-ERRADO** |
| A5 | story-23.4:8 Status ≠ Ready | CourseSelector montado no wizard | `story-23.4...md:8` → `Ready` | `scope-step.tsx` contém `<CourseSelector />` | **DOC-ERRADO** |
| A6 | story-23.1 AC1 caixa ≠ desmarcada | `auditCourse` existe e exportado | `story-23.1...md:40` → `- [ ] **AC1:**` | `packages/agents/src/course-designer/auditor.ts` existe, exportado em `index.ts` | **DOC-ERRADO** |
| A7 | story-23.2 AC5 caixa ≠ desmarcada | rota grava `status: "applied"` | AC5 desmarcada | `apply/route.ts` contém `status: "applied"` | **DOC-ERRADO** |
| A8 | story-23.3 AC1 caixa ≠ desmarcada | migration tem as 2 colunas WS2 | AC1 desmarcada | migration SQL contém `interaction_type` E `bloom_target` | **DOC-ERRADO** |
| A9 | story-23.4 AC1 caixa ≠ desmarcada | CourseSelector existe e é importado no scope-step | AC1 desmarcada | `exists(courseSelector)` true; `scope-step.tsx` tem `from "./course-selector"` | **DOC-ERRADO** |

Bloco B — SUPERESTIMA (documento afirma o que o código não tem). B3 e B9 **já passam** (rate
limit e rota `GET /api/courses` foram corrigidos pelo commit `a4980ba`, fora do escopo desta
tarefa read-only) — não entram no diagnóstico. As 7 restantes:

| # | Asserção | O que ela afirma | Evidência doc | Evidência código | Veredito |
|---|---|---|---|---|---|
| B1 | story-23.1 AC1 declara `packages/course-designer/src/auditor.ts` | esse path não existe | `story-23.1...md:40` cita `packages/course-designer/src/auditor.ts` | o arquivo real é `packages/agents/src/course-designer/auditor.ts` (existe, confirmado no controle) | **DOC-ERRADO** (path/pacote errado no doc; a funcionalidade existe, só não no endereço citado) |
| B2 | story-23.1 AC6 declara `packages/course-designer/src/prompts/auditor.ts` | esse path não existe | `story-23.1...md:69` | real: `packages/agents/src/course-designer/prompts/auditor.ts` (existe) | **DOC-ERRADO** |
| B4 | story-23.1 AC5 declara guarda de 2 papéis | rota aceita 4 | `story-23.1...md:66` → `Requer role manager ou admin` | `audit-course/route.ts:34` → `["manager","admin","super_admin","instructor"].includes(profile.role)`, **idêntico** nas 4 rotas irmãs do course-designer desde o import inicial | **DOC-ERRADO** (ver nota nos CRÍTICOS acima — política de RBAC uniforme e deliberada, não bug pontual) |
| B5 | story-23.1 Story Context declara Package `@eximia/course-designer` | artefatos vivem em `@eximia/agents` | `story-23.1...md:32` → `**Package** \| @eximia/course-designer, apps/web` | `packages/course-designer/src/auditor.ts` não existe; equivalente real em `packages/agents/` | **DOC-ERRADO** |
| B6 | story-23.2 AC2 declara `packages/course-designer/src/apply-blueprint.ts` | não existe | `story-23.2...md:44` | real: `packages/agents/src/course-designer/apply-blueprint.ts` (existe) | **DOC-ERRADO** |
| B7 | story-23.2 AC1 declara guarda de 2 papéis | rota aceita 4 | `story-23.2...md:42` → `Requer role manager ou admin` | `apply/route.ts:40`, mesma guarda de 4 papéis | **DOC-ERRADO** (mesma nota de B4) |
| B8 | story-23.2 Story Context declara Package `@eximia/course-designer` | artefatos em `@eximia/agents` | `story-23.2...md:32` | idem B5, path do pacote errado | **DOC-ERRADO** |

**Padrão B1/B2/B5/B6/B8:** as 5 stories foram escritas quando o plano era um pacote
`@eximia/course-designer` dedicado; a implementação real consolidou os artefatos dentro de
`packages/agents/src/course-designer/`. É uma decisão de arquitetura que mudou de rumo e o
Story Context/AC nunca foi atualizado para o pacote final.

### `epic-6-security-posture-doc.test.ts` — 9 de 16 falham (7 passam, controle positivo íntegro)

Todas as 9 são **DOC-ERRADO** — o epic-6 (`docs/epics/epic-6-simplificacao-seguranca.md`)
está congelado em `Draft` desde antes da implementação das 4 stories-filhas, todas hoje em
`Ready for Review`.

| # | Asserção | O que ela afirma | Evidência doc | Evidência código | Veredito |
|---|---|---|---|---|---|
| 1 | linha "Rate Limiting" ≠ "Nenhum..." | 6 limiters vivos no middleware | `epic-6...md:24` → `\| **Rate Limiting** \| Nenhum — APIs expostas sem proteção contra abuso \|` | `apps/web/src/lib/rate-limit.ts` exporta `authLimiter`,`chatLimiter`,`catchAllLimiter`,`courseCreateLimiter`,`privacyLimiter`,`questionGenLimiter`; todos aplicados via `checkLimit(...)` em `middleware.ts` (linhas 186, 227 e adjacentes) | **DOC-ERRADO** |
| 2 | linha "LGPD" ≠ "Sem endpoints..." | export e delete existem | `epic-6...md:25` → `\| **LGPD** \| Sem endpoints de privacidade — NFR5 não atendido \|` | `apps/web/src/app/api/privacy/export/route.ts` e `.../delete/route.ts` existem | **DOC-ERRADO** |
| 3 | linha "Dual-Mode Atual" ≠ "~35-40 arquivos" | zero ocorrências de `TenantMode`/`getModeLabels`/`dual-mode-labels` nos 3 arquivos-alvo | `epic-6...md:23` → cita `~35-40 arquivos` | `packages/shared/src/types/models.ts`, `.../constants/labels.ts`, `apps/web/.../sidebar.tsx` — 0 ocorrências do padrão dual-mode (Stories 6.1/6.2 já removeram) | **DOC-ERRADO** |
| 4 | "API abuse (chat flooding)" ≠ "None" | `chatLimiter` vivo | tabela de vulnerabilidades, linha 49: `\| API abuse (chat flooding) \| None \| Rate limiting P0 \|` | `middleware.ts:227` chama `checkLimit(chatLimiter, ...)` para rotas `/api/sessions/*/messages` | **DOC-ERRADO** |
| 5 | "Brute-force auth" ≠ "None" | `authLimiter` vivo | linha 50: `\| Brute-force auth \| None \| ... \|` | `middleware.ts:186` chama `checkLimit(authLimiter, ...)` para `/api/auth` | **DOC-ERRADO** |
| 6 | "LGPD data request (DSAR)" ≠ "No endpoint" | rota export existe | linha 51: `\| LGPD data request (DSAR) \| No endpoint \| ... \|` | `apps/web/src/app/api/privacy/export/route.ts` existe | **DOC-ERRADO** |
| 7 | "LGPD right to erasure" ≠ "No endpoint" | rota delete existe | linha 52: `\| LGPD right to erasure \| No endpoint \| ... \|` | `apps/web/src/app/api/privacy/delete/route.ts` existe | **DOC-ERRADO** |
| 8 | Status do épico ≠ Draft | as 4 stories-filhas estão em `Ready for Review` | `epic-6...md:7` → `**Status:** Draft` | `story-6.{1,2,3,4}...md:7` → `Status: Ready for Review` nas 4 | **DOC-ERRADO** |
| 9 | checklist do épico não pode ter 62 abertos | filhas 100% fechadas (0 abertos, >100 fechados somados) | `grep -c "^- \[ \]"` no epic-6 = 62 | somatório das 4 stories: 0 abertos, >100 fechados | **DOC-ERRADO** |

### `epic9-docs-vs-realidade.test.ts` — 8 de 18 falham (10 passam, controle positivo íntegro)

Todas as 8 são **DOC-ERRADO**. Nota: este arquivo de teste é **untracked** (ver Parte 2) —
ele mesmo é um artefato de trabalho em andamento, não commitado ainda.

| # | Asserção | O que ela afirma | Evidência doc | Evidência código | Veredito |
|---|---|---|---|---|---|
| 1 | story-9.1:7 Status ≠ Draft | coleta de `employee_status` está viva em produção | `story-9.1...md:7` → `**Status:** Draft` | `apps/web/src/app/onboarding/actions.ts:11` declara `employee_status: z.enum([...])`, linha 99 usa o valor coletado | **DOC-ERRADO** (ver nota de compliance nos CRÍTICOS) |
| 2 | AC4 de story-9.1 não pode seguir aberta | a gravação em `users.profile` já é feita | `story-9.1...md:59` → `- [ ] **AC4:** Dados salvos em users.profile JSONB...` | mesmo `actions.ts` grava o campo | **DOC-ERRADO** |
| 3 | story-9.2:7 Status ≠ Draft | migration + enum já aplicados | `story-9.2...md:7` → `Draft` | `supabase/migrations/20260209000001_epic9_courses_type.sql` existe; `packages/database/src/schema/courses.ts:13` declara `enum: ["regular","onboarding"]` | **DOC-ERRADO** |
| 4 | AC1/AC7 de story-9.2 não podem seguir abertas | coluna `type` e migration já existem | AC1/AC7 desmarcadas | mesma evidência do item 3 | **DOC-ERRADO** |
| 5 | story-9.3:7 Status ≠ Draft | rota `/perfil` renderiza em produção | `story-9.3...md:7` → `Draft` | `apps/web/src/app/(platform)/perfil/page.tsx` existe, com `actions.ts`/`loading.tsx` e 27 componentes em `src/components/profile/` | **DOC-ERRADO** |
| 6 | AC1 de story-9.3 não pode seguir aberta | a rota `/(platform)/perfil` já existe | AC1 desmarcada | mesma evidência do item 5 | **DOC-ERRADO** |
| 7 | epic-9 não pode ter 0 caixas fechadas com Status "APPROVED — QA PASS" | um documento aprovado não pode ter o corpo 100% pendente | `docs/epics/epic-9-...md:7` → `**Status:** APPROVED — QA PASS (Quinn review v1.2, 90→100/100)`; checklist do corpo: 62 abertas, 0 fechadas | contradição interna do próprio documento (não é código vs. doc, é doc vs. doc) | **DOC-ERRADO** (auto-inconsistência) |
| 8 | as 3 stories cobertas pelo gate não podem estar Draft com gate PASS | `QA_FIX_REQUEST.md` declara `PASS (all fixed 2026-02-09)` | `docs/stories/epic-9/QA_FIX_REQUEST.md:6` → `~~FAIL~~ → **PASS**`; linhas 119-122 ainda têm 4 itens `- [ ]` abertos, e as 3 stories-filhas seguem `Draft` | contradição entre o gate declarado PASS e o estado real (Draft + itens abertos) | **DOC-ERRADO** |

### Soma

| Veredito | epic-23 | epic-6 | epic-9 | Total |
|---|---:|---:|---:|---:|
| DOC-ERRADO | 16 | 9 | 8 | **33** |
| CODIGO-ERRADO | 0 | 0 | 0 | **0** |
| TESTE-ERRADO | 0 | 0 | 0 | **0** |

Nenhuma das 33 asserções vermelhas exige mexer em código. As 3 runs POP-FIX estão paradas
exatamente no ponto em que a metodologia manda parar (Passo 2 — teste vermelho commitado,
correção é Passo 5) — não há regressão escondida atrás delas, só documentação que não foi
atualizada depois de o código avançar.

## Parte 2 — Triagem dos 33 arquivos não versionados

`git status --porcelain | grep '^??'` — 33 entradas (a 34ª linha do status total é a
modificação pré-existente em `GABARITO.json`, fora do escopo desta triagem).

| Item | Classificação | Razão |
|---|---|---|
| `.claude/settings.local.json` (dentro de `.claude/`) | **IGNORAR** | Já coberto por `.gitignore:39`; ao dar `git add .claude/` o próprio git pula este arquivo. Não é ação a tomar, é not-a-problem. |
| `.claude/agent-memory/aiox-analyst/`, `.claude/agent-memory/aiox-dev/` (2 arquivos de memória, 12K total) | **COMMITAR** | Memória de agente de sessões anteriores neste repo específico, pequena, sem `.gitignore` cobrindo o padrão geral — o `.gitignore` só exclui `settings.local.json` e `handoffs/`, sinal de que o resto de `.claude/` é para ser versionado. |
| `.demo-tenant-vertice-inventory.json` | **DECIDIR** | Contém IDs reais de tenant/curso criados em PRODUÇÃO (mesmo projeto Supabase que serve `argos.eximiaacademy.com.br`) pelo script de seed. Útil como registro de auditoria/cleanup, mas está solto na raiz do repo (não em `scripts/` nem `docs/qa/`) — o Senhor decide se quer manter como registro permanente e em que pasta. |
| `apps/central/next-env.d.ts` | **COMMITAR** | `apps/web/next-env.d.ts` (arquivo gerado, idêntico em natureza) já está versionado no repo e não há entrada em `.gitignore` para o padrão `next-env.d.ts` — a convenção já estabelecida aqui é commitar este arquivo por app. `apps/central` só está atrasado em relação a essa convenção. |
| `apps/web/README.md`, `packages/agents/README.md`, `packages/shared/README.md` | **COMMITAR** | READMEs novos, sem conflito, preenchem lacuna (nenhum pacote/app tinha README versionado). Baixo risco. |
| `apps/web/tests/epic9-docs-vs-realidade.test.ts` | **COMMITAR** | Teste vermelho do POP-FIX-001 epic-9 (mesmo padrão de `epic-23-docs-vs-code.test.ts` e `epic-6-security-posture-doc.test.ts`, ambos já commitados via `41c7bc0`). Diagnosticado nesta run (Parte 1) — commitar por consistência com as duas runs-irmãs já registradas em disco. |
| `docs/architecture/eximia-academy-archify.html` (612K) + `.json` (12K) | **DECIDIR** | Deliverable bruto de uma ferramenta externa ("Archify", per comentário de `tema-academy.mjs`: "archify deliver -> este script"). Não é gerado por nenhum script deste repo — é entrada, não saída. |
| `docs/architecture/eximia-academy-archify-jovial.html` (704K) | **DECIDIR** (reproduzível SE o par acima for mantido) | **Derivado**: produzido rodando `tema-jovial.mjs --src eximia-academy-archify.html`. Reproduzível a partir do raw + script, mas só se o raw (`archify.html`) e `fontes/` também forem mantidos no repo — decisão em bloco, não item a item. |
| `docs/architecture/eximia-academy-archify-speaker-notes.md`, `-tema-jovial.md` | **DECIDIR** | Parte do mesmo lote de material de apresentação (notas de fala, escolha de tema); mesma dúvida de propósito/local do lote archify. |
| `docs/architecture/eximia-academy-conceitos.html` (616K) + `.json` (16K) | **DECIDIR** | Mesmo padrão: deliverable bruto do Archify ("mapa de conceitos"), não gerado por script local. |
| `docs/architecture/eximia-academy-conceitos-academy.html` (700K), `-jovial.html` (704K) | **DECIDIR** (reproduzíveis SE o raw acima for mantido) | Derivados de `conceitos.html` via `tema-academy.mjs`/`tema-jovial.mjs`. |
| `docs/architecture/eximia-academy-guia-de-fala.md` | **DECIDIR** | Mesmo lote de apresentação (guia de fala/narrativa do deck). |
| `docs/architecture/eximia-academy-mastermind.html` (80K) | **DECIDIR** | Título interno "exímIA Academy · o método e o sistema" — parece ser um deck próprio (não claramente derivado dos outros dois pelo `tema-*.mjs`), tamanho bem menor. Mesma dúvida de propósito. |
| `docs/architecture/meu-plano-defeitos-archify.html` (608K) + `.json` (8K) | **DECIDIR** | Terceiro deliverable bruto do Archify no mesmo lote ("meu plano — defeitos"). |
| `docs/architecture/fontes/` (3 arquivos `.woff2`, ~100K) | **DECIDIR** (segue a decisão do lote acima) | Fontes usadas pelos scripts de tema para embutir tipografia via base64 nos HTMLs derivados; não têm uso fora desse lote. |
| `docs/architecture/tema-academy.mjs`, `tema-jovial.mjs` (24K + 44K) | **COMMITAR** (independente da decisão sobre os HTMLs) | São CÓDIGO (scripts geradores), não deliverable de terceiro — legítimos e reutilizáveis mesmo que os HTMLs específicos deste lote não sejam mantidos. Se o lote de decks for descartado, os scripts continuam úteis para o próximo. |
| `docs/auditoria/` (esta pasta, incluindo os logs desta auditoria de consolidação) | **COMMITAR** (ao final da consolidação) | É o próprio produto de trabalho desta rodada de auditoria (LOOP-0, LOOP-0b e o que os colegas `loop2-funcional`/`loop3-visual` ainda vão gravar aqui). Ainda em produção no momento desta triagem — commitar faz sentido só depois que a consolidação fechar, não antes (para não commitar um estado parcial). |
| `docs/features/README.md`, `multi-tenant.md`, `course-designer.md`, `motor-socratico.md` (56K) | **COMMITAR** | Documentação de features, sem conflito, granularidade de doc razoável. |
| `docs/prd/roadmap-em-andamento-2026-08.md` | **COMMITAR** | Documento de PRD/roadmap, natural para o repo. |
| `docs/qa/demo-course-jornada-2026-07-28.md`, `demo-tenant-vertice-2026-07-29.md` | **COMMITAR** | Registro de QA de preparação de demos passadas — trilha de auditoria, baixo risco, útil para referência futura. |
| `docs/qa/paridade-visual-2026-07-30/` (`RELATORIO.md` + 1 PNG, 528K) | **COMMITAR** | Relatório de QA com evidência visual (1 screenshot) de paridade — artefato de auditoria legítimo, tamanho modesto. |
| `docs/stories/chore-reconcile-main-com-deploy-vertice.md` | **COMMITAR** | Story de reconciliação main×deploy/cory já referenciada na memória do ecossistema (`project_academy-igualar-main-deploy-cory`); documentação de decisão real. |
| `scripts/auditoria-dobra-real.mjs` (8K) | **COMMITAR** | Script de auditoria/diagnóstico legítimo (mede altura real do rodapé/moldura em runtime); ferramenta de QA reutilizável, não lixo de sessão. |
| `scripts/demo-tenant-vertice-seed.mjs` (36K), `demo-tenant-vertice-phase5.mjs` (16K) | **COMMITAR** | Scripts operacionais que já executaram contra PRODUÇÃO (comentário do próprio arquivo: "Phases 1-4... completed successfully"). Mantê-los documenta e audita uma operação real feita em produção — relevante para rastreabilidade, mesmo sendo "one-shot". Recomendo manter junto do `.demo-tenant-vertice-inventory.json` (ver item DECIDIR acima) como conjunto. |

### Resumo da triagem

| Balde | Quantidade | Itens |
|---|---:|---|
| COMMITAR | 19 | `.claude/agent-memory/*` (2), `next-env.d.ts`, 3 READMEs, `epic9-docs-vs-realidade.test.ts`, `tema-academy.mjs`, `tema-jovial.mjs`, `docs/auditoria/`, `docs/features/*` (4), `roadmap-em-andamento-2026-08.md`, 2 docs de QA de demo, `paridade-visual-2026-07-30/`, `chore-reconcile-main-com-deploy-vertice.md`, `auditoria-dobra-real.mjs`, 2 scripts de seed de demo |
| IGNORAR | 1 (item interno) | `.claude/settings.local.json` — já resolvido pelo `.gitignore`, nenhuma ação necessária |
| DESCARTAR | 0 | Nenhum item identificado como lixo puro de sessão anterior — tudo tem propósito rastreável |
| DECIDIR | 13 | Todo o lote `docs/architecture/*archify*`, `*conceitos*`, `meu-plano-defeitos-archify*`, `eximia-academy-guia-de-fala.md`, `eximia-academy-mastermind.html`, `fontes/` (11 arquivos, ~5,6 MB) + `.demo-tenant-vertice-inventory.json` (1 arquivo, 4K) |

**Nota sobre os HTMLs grandes:** confirmei em `tema-academy.mjs`/`tema-jovial.mjs` que os
arquivos com sufixo `-academy.html`/`-jovial.html` **são gerados** a partir de um HTML "raw"
irmão (mesmo nome sem sufixo) + a pasta `fontes/` (embutida via base64). Os HTMLs SEM sufixo
(`eximia-academy-archify.html`, `eximia-academy-conceitos.html`,
`meu-plano-defeitos-archify.html`) e seus `.json` companheiros **não são gerados por nada
neste repo** — são entrega bruta de uma ferramenta externa ("Archify", citada em comentário),
portanto não reproduzíveis localmente. Ou seja: mesmo que se decida manter só os "raws" e
descartar os derivados (regenerando sob demanda), os 3 raws + `fontes/` continuam
obrigatórios — a decisão de manter/descartar é sobre o lote inteiro (5,6 MB), não uma poda
parcial que preserve reprodutibilidade.

## Comandos de evidência

```bash
# suítes rodadas frescas
pnpm --filter @eximia/web test tests/epic-23-docs-vs-code.test.ts
pnpm --filter @eximia/web test tests/epic-6-security-posture-doc.test.ts
pnpm --filter @eximia/web test tests/epic9-docs-vs-realidade.test.ts

# guarda de papel idêntica nas 4 rotas do course-designer (não é bug pontual)
grep -n "includes(profile.role)" \
  apps/web/src/app/api/course-designer/generate/route.ts \
  apps/web/src/app/api/course-designer/ai-fill/route.ts \
  "apps/web/src/app/api/course-designer/blueprints/[blueprintId]/apply/route.ts" \
  apps/web/src/app/api/course-designer/audit-course/route.ts

# rate limiters e rotas LGPD citados pelo epic-6
grep -n "checkLimit(authLimiter\|checkLimit(chatLimiter" apps/web/src/middleware.ts
ls apps/web/src/app/api/privacy/export/route.ts apps/web/src/app/api/privacy/delete/route.ts

# origem dos HTML grandes (raw vs. derivado)
grep -n "archify deliver -> este script" docs/architecture/tema-academy.mjs

# estado final do repo
git log --oneline -1        # d2b8083
git diff --stat             # só GABARITO.json, pré-existente
```
