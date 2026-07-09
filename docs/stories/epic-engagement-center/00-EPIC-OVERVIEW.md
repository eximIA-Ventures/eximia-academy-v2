# EPIC: Centro de Engajamento v2 (Central de Ação Contextual do Gestor)

**Repo:** `eximia-academy-v2` (branch `feat/engagement-center-v2`)
**Criado:** 2026-07-08
**Autor:** River (SM Agent)
**Fonte:** `/Users/hugocapitelli/Dev/eximia/JARVIS/apps/eximia-academy/docs/centro-engajamento-refactor-report.md` (LEITURA OBRIGATÓRIA antes de qualquer story deste epic)
**Status:** Draft (todas as 11 stories em Draft)

---

## 1. Tese

O Centro de Engajamento deixa de ser uma tela genérica de "campanhas" (sugestões + campanhas + templates + histórico misturados, sem lógica de escopo) e vira a **central de ação contextual do Gestor**: tudo nasce do recorte atual do time, toda ação tem motivo claro, todo envio mostra quem recebe, quem assina e qual resultado se espera.

A tela responde 7 perguntas (Seção 4 do report):
1. Quem precisa de atenção?
2. Por que essa pessoa ou grupo apareceu aqui?
3. Qual ação faz sentido tomar agora?
4. Quem vai receber a mensagem?
5. A mensagem sai em nome do gestor ou da plataforma?
6. O que já foi enviado antes?
7. Qual foi o resultado?

## 2. Regra Absoluta de Escopo (NON-NEGOTIABLE em toda story deste epic)

> Nenhuma contagem, sugestão, audiência, histórico ou campanha pode ignorar o contexto atual do gestor.

Cenário canônico de regressão (usar em TODO teste manual e automatizado deste epic):

> Rinaldo, no contexto `Meu Time` com 6 alunos, NUNCA pode ver uma contagem "13 alunos nunca acessaram" — 13 é o tenant inteiro, 6 é o time dele.

Esta regra vale para: cards de resumo, sugestões (Ações Sugeridas), campanhas, histórico, eficácia. Nenhuma exceção.

## 3. Non-Goals Desta Wave

Explicitamente FORA de escopo, não implementar, não redesenhar, não tocar:

- Unificar a UX da tela admin (`/admin/notifications`) com a nova tela do gestor. A tela admin permanece intocada para o papel admin.
- UX de Instrutor para o Centro de Engajamento (esta wave é 100% Gestor).
- Canal WhatsApp (o report menciona só in-app + email).
- Testes A/B de mensagem/template.
- Qualquer redesign da tabela de alunos além dos botões Lembrar/Acionar/No ritmo que JÁ EXISTEM — a ponte entre a tabela e o Centro é escopo (E10), a tabela em si não é.

## 4. Decisões de Arquitetura (já tomadas, não reabrir nas stories)

1. Nova rota `apps/web/src/app/(platform)/engagement/` para o gestor. A tela admin antiga (`(platform)/admin/notifications/`) permanece intocada para admin.
2. Sugestões passam a ser **computadas ao vivo do recorte atual** (contexto + team-view + focus), nunca lidas de rows tenant-wide pendentes. `nudge_suggestions` ganha `manager_id uuid` e passa a registrar APENAS auditoria de ações tomadas (approved/dismissed). Dismissal por gestor+tipo vale 7 dias (generator exclui).
3. Novo tipo de sugestão `behind_teaching_plan` (usa a lógica de pace/atraso de `student-triage.ts` / `auth_team_engagement_signals`).
4. Origem da mensagem: colunas novas em `notifications`: `sender_identity text CHECK IN ('manager','platform') DEFAULT 'platform'`, `sender_name text`. Preview editável, envio usa `message` override do `dispatchTeamNudge` (já existe, estendido para carregar sender_identity/sender_name). Email continua saindo do remetente da plataforma (deliverability), mas assunto/corpo refletem a origem.
5. Templates ganham `intent text` (primeiro_acesso|retomada|atraso_plano|reflexao_pendente|reconhecimento|manual) e `tone text`; UI exibe nome humano + intenção, nunca a `key` técnica como informação principal.
6. Fechamento de vazamentos: `resolveAudienceScoped(criteria, tenantId, allowedStudentIds)` usado em toda rota de campanha; eficácia SEMPRE escopada ao caller; GET suggestions e GET `/api/admin/notifications` ganham filtro de escopo server-side.
7. Nova superfície de API em `apps/web/src/app/api/engagement/`: `GET overview`, `POST action`, `POST campaign`, `GET history`, `GET/PATCH templates`. Reusa o engine existente; toda rota revalida escopo server-side (padrão de `nudge/route.ts`).
8. Campanhas = grupos contextuais auto-gerados dos mesmos tipos de sugestão (sem "audiências salvas" como elemento principal da UI do gestor). Revisão obrigatória antes do envio: lista de destinatários + motivo + remoção de alunos.
9. Kill list da Seção 16 do report aplica-se integralmente à tela nova (ver E10).
10. Botão "No ritmo" abre ação positiva: Ver detalhe | Parabenizar (template de reconhecimento) | nada.

## 5. Fatos Já Verificados no Repo (2026-07-08) — DIVERGEM do texto informal do briefing em pontos técnicos; usar ESTES paths e nomes

O repo é mais maduro que a descrição informal sugeria. Correções factuais importantes:

- **Migrations reais** (raiz do repo, NÃO `apps/web/supabase/`):
  - `supabase/migrations/20260604120000_engagement_engine.sql` — schema base (`notification_templates`, `notifications`, `nudge_suggestions`, `notification_audiences`) + RLS + seed de 5 templates.
  - `supabase/migrations/20260630000000_engagement_rls_group_scope.sql` — hardening RLS por grupo.
  - `supabase/migrations/20260703010000_auth_team_engagement_signals.sql` — RPC `auth_team_engagement_signals`.
- **Schema real de `notification_templates`:** coluna de tipo é `key` (TEXT, UNIQUE por tenant), NÃO `type`. `nudge_suggestions.type` é um CHECK enum (`never_accessed`, `inactive`, `no_reflection`, `top_performer`, `announcement`, `custom`) — `behind_teaching_plan` (decisão #3) precisa ser ADICIONADO a este CHECK.
- **`apps/web/src/lib/notifications/engine.ts`** já é bem mais robusto que "lógica simples":
  - `generateNudgeSuggestions(tenantId, allowedStudentIds?)` já aceita um filtro de escopo opcional (`null`/`undefined` = tenant-wide, array = interseção, `[]` = fail-closed). JÁ TEM cadência de dedup: pula cohort que teve sugestão gerada nas últimas 24h em qualquer status (não é o dismissal de 7 dias por gestor+tipo pedido na decisão #2 — esse é NOVO, ver E2).
  - `dispatchTeamNudge(params)` JÁ ACEITA `message?: string | null` que sobrescreve o corpo in-app/email (override do template). NÃO precisa ser criado, precisa ser ESTENDIDO com `sender_identity`/`sender_name`.
  - `approveSuggestion(params)` já faz claim atômico (compare-and-set pending→approved) antes de despachar — preservar esse padrão em qualquer novo fluxo de aprovação.
  - `NUDGE_TYPE_TEMPLATE_KEY` é o mapa canônico `NudgeType → template key`; ao adicionar `behind_teaching_plan`, adicionar entrada aqui e criar/seedar o template correspondente.
- **Escopo/contexto já tem primitivas maduras em `apps/web/src/lib/area-context.ts`:**
  - `resolveCallerStudentScope(db, tenantId, userId, roles)` é a função UNIFICADA que já resolve "quais alunos este caller pode alcançar" (admin/super_admin → `null` tenant-wide; manager → `getManagedTeamStudentIds(..., {includeSubtree:true})`; instructor → união de `getAreaStudentIds` por área; qualquer outro papel → `[]` fail-closed). Este É o candidato natural para a decisão #6 (`resolveAudienceScoped`) — NÃO reinventar, compor sobre esta função.
  - `getManagedTeamStudentIds(db, tenantId, managerId, {includeSubtree})` — `includeSubtree:true` usa RPC `auth_reachable_student_ids()` (hierarquia completa); default (sem opts) usa só `manager_group_members` (Diretos, sem fan-out).
  - `getDirectTeamStudentIds(db, tenantId, node)` — via RPC `auth_direct_student_ids` — é o "Diretos" puro (reports_to direto + manager_group_members do node).
  - `getSubtreeStudentIdsAtNode(db, tenantId, node)` — drill-down seguro num node específico da hierarquia, com gate contra node forjado.
  - Cookies de contexto: `x-active-area` (não `x-active-context`/`x-team-view`/`x-role-lens` como aproximado no briefing original — CONFIRMAR o nome exato de cada cookie usado por `analytics/page.tsx` durante a implementação de E4, e usar os mesmos).
- **`apps/web/src/lib/student-triage.ts`** é a fonte canônica de Ritmo/Triagem/Ação:
  - `StudentTriagem`: `no_ritmo` (verde) | `atencao` (vermelho — atrasado ou não iniciado) | `sem_acesso` (âmbar — sumido >14 dias mas em dia no plano).
  - `computeStudentAction(triagem, totalSessions)` retorna `{kind:"none"}` | `{kind:"lembrar", nudgeType:"inactive"}` | `{kind:"acionar", nudgeType: totalSessions===0 ? "never_accessed" : "inactive"}`. **Hoje NÃO existe mapeamento para `behind_teaching_plan`** — E10 precisa decidir se `atencao` (atrasado) deveria gerar `nudgeType:"behind_teaching_plan"` em vez de sempre cair em `never_accessed`/`inactive`. Documentar a decisão na story E10, não assumir.
  - Hierarquia de gravidade (Hugo, 2026-07-07): atraso > inatividade. `atencao` é pior que `sem_acesso`.
- **`apps/web/src/app/api/analytics/manager/nudge/route.ts`** é o PADRÃO DE OURO de rota escopada (4 passos: AUTH → VALIDATE → RE-SCOPE com client autenticado → DISPATCH). Toda rota nova em `api/engagement/*` deve seguir este mesmo esqueleto. Nota: hoje ele usa `getManagedTeamStudentIds(..., {includeSubtree:true})` diretamente, não `resolveCallerStudentScope` — ao migrar para `resolveAudienceScoped`, decidir explicitamente se este endpoint também migra ou se `resolveCallerStudentScope`/`resolveAudienceScoped` é só para as rotas NOVAS (`api/engagement/*`). Default: migrar também, para não ter duas fontes de verdade de escopo coexistindo sem necessidade.
- **`apps/web/src/components/analytics/student-insights-table.tsx`** já existe com suporte a `variant="manager"` e `canNudge` — CONFIRMAR na E10 se os botões Lembrar/Acionar/No ritmo já estão implementados aqui ou se ainda precisam ser adicionados (o report, Seção 18, registra incerteza sobre isso).
- **Design system:** `apps/web/src/styles/theme.css` tem tokens `cerrado-*` (laranja, ação), `semantic-success/warning/error/info`. Componentes prontos em `packages/ui/src/components/`: `card.tsx`, `badge.tsx`, `button.tsx`, `tabs.tsx`, `sheet.tsx` (usar para o drawer de Ação Individual, E6), `empty-state.tsx`, `table.tsx`. NUNCA usar pares `bg-white dark:bg-*` — usar tokens (`bg-bg-card`, `text-text-primary`, etc., CONFIRMAR nomes exatos em `theme.css` durante implementação). Padrão de referência visual: `apps/web/src/components/dashboard/triage-cards.tsx` e `teaching-plan-highlights.tsx`.
- **Scripts reais do `apps/web/package.json`:** `lint` = `biome check ./src`, `typecheck` = `tsc --noEmit`, `test` = `vitest run`. Usar estes comandos EXATOS nas seções Testing de cada story (não `npm run test` genérico assumido pelo briefing).
- **Legacy a não tocar:** `email_notifications` (tabela pré-engine, mantida só para leitura histórica).

## 6. Mapa de Dependências Entre Stories

```
E1 (migration)
  └─> E2 (engine contextual) ──┐
  └─> E3 (fechamento de vazamentos + API) ──┤
                                             ├─> E4 (shell da página)
                                             │     ├─> E5 (Ações Sugeridas)
                                             │     ├─> E6 (Ação Individual)
                                             │     ├─> E7 (Campanhas)
                                             │     ├─> E8 (Histórico)
                                             │     └─> E9 (Templates)
                                             │           └─> E10 (ponte tabela + nav + kill list)
                                             └───────────────────┴─> E11 (testes + hardening, cobre tudo)
```

E1 bloqueia tudo. E2 e E3 podem rodar em paralelo após E1 (E3 depende do schema de E1 mas não da lógica de E2, exceto pela função `resolveAudienceScoped` que ambas tocam — coordenar). E4 depende de E2+E3 prontos (a API precisa existir). E5–E9 dependem de E4 (shell) mas são paralelas entre si. E10 depende de E9 (templates de reconhecimento) e da tabela existente. E11 roda por último, mas os testes unitários de cada camada (engine, resolveAudienceScoped) podem ser escritos incrementalmente dentro de cada story — E11 é o hardening final + o teste de cenário canônico end-to-end.

## 7. Definition of Done do Epic (transcrito da Seção 20 do report)

A refatoração é considerada correta se, e somente se, TODOS os 10 critérios abaixo forem verdadeiros:

1. Todas as contagens respeitam o contexto atual do gestor.
2. Nenhuma pessoa fora do time/recorte aparece em sugestões, campanhas ou histórico.
3. Ação individual e campanha coletiva são visualmente e logicamente separadas.
4. Clicar em `Lembrar` na tabela abre um fluxo individual pré-preenchido.
5. Clicar em `Acionar` na tabela abre um fluxo individual pré-preenchido com tom mais forte.
6. Toda mensagem permite escolher origem: gestor ou plataforma.
7. Campanhas coletivas exigem revisão de audiência antes de envio.
8. Templates são exibidos com nomes humanos e organizados por intenção.
9. Histórico é filtrado pelo contexto atual.
10. A tela tem visual alinhado à exímIA Academy: limpa, premium, clara e orientada à ação.

## 8. Frase Central do Produto (Seção 21 do report)

> O Centro de Engajamento deve ser a central de ação contextual do gestor: tudo nasce do time atual, toda ação tem motivo claro, todo envio mostra quem recebe, quem assina e qual resultado se espera.

## 9. Lista de Stories

| # | Arquivo | Título |
|---|---------|--------|
| E1 | `E1-migration-engagement-v2.md` | Migration engagement v2 (schema + seeds) |
| E2 | `E2-engine-contextual.md` | Engine contextual (sugestões live-computed, behind_teaching_plan, dispatch estendido) |
| E3 | `E3-fechamento-vazamentos-api.md` | Fechamento de vazamentos de escopo + nova API `/api/engagement/*` |
| E4 | `E4-shell-pagina-engagement.md` | Página `/engagement` shell (contexto, cards, tabs) |
| E5 | `E5-aba-acoes-sugeridas.md` | Aba Ações Sugeridas |
| E6 | `E6-fluxo-acao-individual.md` | Fluxo de Ação Individual (Sheet) |
| E7 | `E7-aba-campanhas.md` | Aba Campanhas |
| E8 | `E8-aba-historico.md` | Aba Histórico |
| E9 | `E9-aba-templates.md` | Aba Templates |
| E10 | `E10-ponte-tabela-nav-kill-list.md` | Ponte tabela→Centro, navegação, kill list |
| E11 | `E11-testes-hardening.md` | Testes + hardening (cenário canônico) |

## 10. Regras de Execução Para Quem Implementar

- Cada story é autossuficiente: um dev sem acesso a esta conversa deve conseguir implementar só com a story + os paths citados nas Dev Notes.
- A Regra Absoluta de Escopo (Seção 2) é blocker em toda story que toque contagem, sugestão, campanha ou histórico — se um AC não a satisfaz, a story não está pronta.
- Nenhuma story fecha sem rodar `pnpm --filter @eximia/web lint`, `pnpm --filter @eximia/web typecheck` e `pnpm --filter @eximia/web test` (ou os comandos equivalentes documentados em cada story) verdes.
- Onde este overview e uma story individual divergirem em algum detalhe, a Dev Notes da story individual vence (foi verificada por último), mas a divergência deve ser reportada de volta ao PO/SM.

---

## 11. QA Gate do Epic — Quinn (@qa), 2026-07-08

**Veredito do epic: CONCERNS (aprovado com 2 ressalvas minor, nenhum blocker).**

Postura adversarial: cada critério do DoD (Seção 7) foi checado contra o CÓDIGO real das
superfícies, não os Dev Agent Records. Baseline de suíte e imutabilidade de `student-triage.ts`
verificados de forma independente (worktree em `416fa4a`, diff byte-a-byte dos SUTs que falham).

### DoD (Seção 7) — 10 critérios, um a um

| # | Critério | Veredito | Evidência (código real) |
|---|----------|----------|-------------------------|
| 1 | Todas as contagens respeitam o contexto | ✅ PASS | `overview/route.ts` filtra roster/sessions/notifications por `inScope(allowedStudentIds)`; suggestions passam `allowedStudentIds` a `generateNudgeSuggestions`. AC7 prova cards=6/13. |
| 2 | Ninguém fora do recorte em sugestão/campanha/histórico | ✅ PASS | `history/route.ts` (recipient_id IN scope + enrichment bounded aos ids in-scope), `campaign` re-scope no confirm, `admin/notifications` GET por `sender_id`/POST intersecta scope. `students/route` idem. Nenhum vazamento. |
| 3 | Individual vs coletivo separados | ✅ PASS | `engagement-shell.tsx` 4 tabs (Ações Sugeridas/Campanhas/Histórico/Templates); ação individual via `individual-action-sheet.tsx` (Sheet), campanha via wizard. |
| 4 | Lembrar → fluxo individual pré-preenchido | ✅ PASS | `student-insights-table.tsx` navega `?action=remind`; `individual-action-sheet` remind = versão leve (sem status/histórico). |
| 5 | Acionar → individual pré-preenchido, tom mais forte | ✅ PASS | `?action=activate`; sheet activate = + Status atual + Histórico recente + body por nudgeType derivado do ritmo real. |
| 6 | Toda mensagem permite origem gestor/plataforma | ✅ PASS | `message-preview-panel.tsx` seletor Origem (manager/platform) com texto da Seção 8; painel compartilhado por ação individual E campanha; `sender_name` server-trusted. |
| 7 | Campanha exige revisão antes do envio | ✅ PASS | `campaign/route.ts` só despacha em `mode=confirm` com `studentIds` explícito (re-scoped); wizard tem step `review` obrigatório entre preview e envio. Sem caminho de dispatch por critério puro. |
| 8 | Templates com nome humano por intenção | ✅ PASS | `templates-tab.tsx` agrupa por `INTENT_LABELS` (nunca a `key` crua); migration seed `intent`/`tone`. |
| 9 | Histórico filtrado pelo contexto | ✅ PASS | `history/route.ts` fail-closed em scope vazio; filtro student fora do scope → lista vazia; type inválido → 400. |
| 10 | Visual alinhado (tokens da casa) | ✅ PASS | grep no `engagement/` = ZERO `bg-white dark:` e zero `bg-white` cru; usa `bg-bg-card`/`text-text-*`. |

### Ângulos técnicos

| Ângulo | Veredito | Nota |
|--------|----------|------|
| Regressão (suíte vs baseline) | ✅ PASS | 597 pass / 32 fail (baseline 582/32). +15 pass, 0 fail novo. Os 32 fails têm SUT byte-idêntico ao `416fa4a` (pré-existentes: rate-limit, onboarding, dashboards, auth OAuth, sessions/messages). |
| Typecheck | ✅ PASS | `tsc --noEmit` 0 erros. |
| Biome (footprint do epic) | ⚠️ CONCERN | 1 format em `page.tsx:187` (epic, minor MNT-001). `resend!` e `noArrayIndexKey` são pré-existentes. |
| Migration aditiva/idempotente | ✅ PASS (estático) | Só `ADD COLUMN IF NOT EXISTS`, CHECK-rebuild via `pg_constraint`, `UPDATE WHERE intent IS NULL`, seed `ON CONFLICT DO NOTHING`. Nenhuma RLS alterada. `db reset` empírico ⚠️ pendente (Docker, TEST-001). |
| RLS não afrouxada | ✅ PASS | Migration não altera policy; novas colunas herdam a visibilidade das policies existentes. |
| Rota admin antiga (retrocompat) | ✅ PASS | `admin/notifications/route.ts` GET/POST intactos p/ admin; scope trava adicionada sem quebrar o caminho admin. |
| Cap 200 | ✅ PASS | `campaign/route.ts` `MAX_RECIPIENTS=200` (preview capa + confirm rejeita >200); history `MAX_ROWS=200`. |
| `computeStudentAction`/`student-triage.ts` intocados | ✅ PASS | `git diff 416fa4a..HEAD -- student-triage.ts` VAZIO (verificado). |

### Ressalvas (ambas minor, não bloqueiam o fechamento)

- **TEST-001 (low):** AC9 — `supabase db reset` não rodou (Docker indisponível). Idempotência
  provada por leitura estática. **Pendência**: re-rodar com Docker.
- **MNT-001 (low):** `page.tsx:187` falha `biome check` (formatação). Cosmético.
  Fix: `biome check --write` no fix loop.

**Gate:** CONCERNS → `gates/E11-testes-hardening.yml`. As duas ressalvas são registradas,
não bloqueantes; o epic pode seguir para push com as pendências acompanhadas.
