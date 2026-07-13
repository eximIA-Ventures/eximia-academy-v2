# E2: Engine Contextual (sugestões live-computed, behind_teaching_plan, dispatch estendido)

**Epic:** [00-EPIC-OVERVIEW](./00-EPIC-OVERVIEW.md)
**Status:** Draft
**Depende de:** E1 (schema)
**Bloqueia:** E4 (shell precisa da API que consome esta engine)

---

## Story

**As a** gestor,
**I want** que as sugestões de engajamento sejam calculadas ao vivo a partir do meu recorte atual (não lidas de uma fila tenant-wide),
**so that** eu nunca veja uma sugestão que inclua alunos fora do meu time.

## Contexto (Dev Notes)

Ler `00-EPIC-OVERVIEW.md` Seção 5 antes de começar. Arquivo principal a modificar: `apps/web/src/lib/notifications/engine.ts`.

**O que já existe e NÃO deve ser reescrito do zero:**
- `generateNudgeSuggestions(tenantId, allowedStudentIds?)` já aceita filtro de escopo opcional (interseção quando array não-nulo, fail-closed com `[]`). Já tem cadência de 24h (pula cohort com sugestão gerada nas últimas 24h em qualquer status).
- `classifyNudgeCohorts(signals)` já implementa a lógica de `never_accessed`, `inactive` (>14 dias), `no_reflection` (>=2 sessões completas, 0 reflexões), `top_performer` (>=3 sessões completas, >=2 reflexões, top 3).
- `dispatchTeamNudge(params)` já aceita `message?: string | null` (override do corpo). Já faz re-scope de tenant+role hat (`user_roles`) antes de despachar.
- `approveSuggestion(params)` já faz claim atômico (compare-and-set `pending`→`approved`).
- `NUDGE_TYPE_TEMPLATE_KEY` é o mapa canônico `NudgeType → template key` (E1 já adicionou `behind_teaching_plan`).

**O que esta story PRECISA construir (novo):**
1. Um novo cohort `behind_teaching_plan` em `classifyNudgeCohorts` (ou uma função irmã), usando a MESMA lógica de pace/atraso de `apps/web/src/lib/student-triage.ts` (`computeStudentRitmo`/`computeStudentTriagem` → `atrasado`/`atencao`) — NÃO reinventar o critério de atraso, reusar/importar a lógica existente ou o dado já calculado pela RPC `auth_team_engagement_signals` (`supabase/migrations/20260703010000_auth_team_engagement_signals.sql` — ler esta migration para entender o que a RPC já retorna antes de decidir se a classificação lê direto da RPC ou recalcula em TS).
2. Substituir a semântica de "geração em fila tenant-wide, lida depois" por "geração SOB DEMANDA, escopada ao recorte do gestor que abriu a tela" — isso significa que a rota `GET overview` (E3) vai chamar `generateNudgeSuggestions(tenantId, allowedStudentIds)` toda vez que o gestor abrir a aba Ações Sugeridas (ou com um cache curto — decidir e documentar no Dev Agent Record), em vez de só ler `nudge_suggestions` com `status='pending'` como hoje faz `listPendingSuggestions`.
3. Dismissal por gestor+tipo válido por 7 dias: quando um gestor dispensa uma sugestão (`dismissSuggestion`), a próxima geração para O MESMO gestor + O MESMO tipo dentro de 7 dias deve ser suprimida — isto é uma regra NOVA, diferente da cadência de 24h já existente (que é por tenant, não por gestor). Implementar como uma nova consulta que verifica `nudge_suggestions WHERE manager_id = X AND type = Y AND status = 'dismissed' AND approved_at > now() - interval '7 days'` antes de incluir aquele cohort na lista de sugestões retornadas ao gestor.
4. Estender `dispatchTeamNudge` (e `approveSuggestion`, se aplicável) para aceitar e persistir `senderIdentity: 'manager' | 'platform'` e `senderName?: string | null`, gravando nas colunas novas de `notifications` (E1 AC3). Quando `senderIdentity === 'manager'`, `senderName` é obrigatório (nome do gestor, resolvido server-side a partir do profile autenticado — NUNCA aceitar `senderName` livre do payload do cliente sem validar que corresponde ao usuário autenticado, para não permitir que um gestor assine como outra pessoa).
5. Ajustar a renderização do corpo da mensagem (`renderTemplate`/`renderTemplateString`) para prefixar/adequar a saudação conforme a origem — Seção 8 do report tem os dois exemplos de texto (assinado pelo gestor vs. institucional). Isso pode ser um novo parâmetro em `renderTemplate` ou uma função wrapper `renderWithOrigin(template, vars, senderIdentity, senderName)` que decide a saudação antes de chamar `renderTemplateString`.

## Acceptance Criteria

- [x] **AC1:** Cohort adicional dentro de `classifyNudgeCohorts` produz `behind_teaching_plan` de `s.behindSchedule && s.totalSessions > 0` (atrasado E já começou — exclui `nao_iniciado`, que é `never_accessed`). **Fonte de dados (documentada):** o sinal `behindSchedule` é computado em `computeBehindStudentIds` (engine.ts) usando a FÓRMULA IDÊNTICA da RPC `auth_team_engagement_signals.behind` CTE (enrollment active + course.deadline_days>0 + progress% < expectedPct, expectedPct=LEAST(100,round(elapsed/deadline*100))). Não recalculei pace "à mão" divergente — é a mesma fórmula byte-a-byte da RPC e de `student-triage.ts`. Motivo de computar no engine e não chamar a RPC: o engine roda com o service client (RLS-bypass), e a RPC é SECURITY DEFINER hard-wired a `auth.uid()` (não faz sentido chamá-la com service client). A fórmula é a fonte única.
- [x] **AC2:** `generateNudgeSuggestions(tenantId, allowedStudentIds?, managerId?)` aceita `managerId` e popula `nudge_suggestions.manager_id` em todo INSERT quando fornecido.
- [x] **AC3:** A lista ao gestor é recém-computada por chamada (o overview de E3 chama `generateNudgeSuggestions` a cada request). Rows `approved`/`dismissed` são auditoria; nenhuma `pending` fica como fila persistente lida depois. Sem cache nesta camada (decisão: a chamada é barata e sempre reflete o recorte atual).
- [x] **AC4:** Dismissal de 7 dias por gestor+tipo: query `nudge_suggestions WHERE manager_id=X AND type=Y AND status='dismissed' AND approved_at > now()-7d` suprime o tipo só para ESSE gestor. Coberto por teste (A suprime, B não afetado). Distinto da cadência de 24h tenant-wide.
- [x] **AC5:** `dispatchTeamNudge` aceita `senderIdentity`/`senderName` (opcionais, default `platform`/`null`), grava nas colunas novas de `notifications`. A validação de identidade (senderName == usuário autenticado) é responsabilidade da ROTA (E3); a função só recebe e persiste.
- [x] **AC6:** `renderWithOrigin(body, identity, {firstName, senderName})` muda a saudação: manager → "Olá, {nome}. Aqui é {gestor}." / platform → "Olá, {nome}. A exímIA Academy percebeu...". Corpo substantivo preservado; só o prefixo muda. Coberto por teste.
- [x] **AC7:** O novo cohort passa por `scopedSignals` (interseção `allowedStudentIds`) igual a todos os outros — nenhum caminho novo ignora o escopo. Coberto por teste (behind sob escopo).
- [x] **AC8:** Testes unitários (Vitest) em `engine.test.ts`: cohort `behind_teaching_plan` (3 casos), `renderWithOrigin` (3 casos), dismissal 7d por gestor (A vs B), interseção de escopo + fail-closed. 12/12 verdes.

## Tasks

- [x] 1. Ler `apps/web/src/lib/student-triage.ts` e `supabase/migrations/20260703010000_auth_team_engagement_signals.sql` para decidir a fonte de dados do cohort `behind_teaching_plan`. → RPC expõe `behind_schedule`; fórmula replicada byte-a-byte no engine (service client).
- [x] 2. Implementar o cohort `behind_teaching_plan` em `engine.ts` (+ `computeBehindStudentIds`).
- [x] 3. Implementar a checagem de dismissal de 7 dias por `manager_id + type`.
- [x] 4. Adicionar `manager_id` ao INSERT de `nudge_suggestions` em `generateNudgeSuggestions`.
- [x] 5. Estender `dispatchTeamNudge` com `senderIdentity`/`senderName`, persistindo nas colunas de E1.
- [x] 6. Implementar a variação de saudação por origem em `renderWithOrigin` (função wrapper nova).
- [x] 7. Escrever testes unitários (Vitest) para os 4 comportamentos do AC8. → 12/12 verdes.
- [x] 8. Rodar typecheck + test — nenhuma chamada existente a `dispatchTeamNudge`/`generateNudgeSuggestions` quebrou (params novos opcionais com default; `nudge/route.ts` intacto).

## Complexidade & Riscos

- **Complexidade:** L (large). Coração lógico do epic: novo cohort, nova regra de dismissal temporal, extensão de dispatch + render, tudo sobre engine existente com múltiplos call-sites.
- **Riscos:**
  - R1 (alto): estender a assinatura de `dispatchTeamNudge`/`generateNudgeSuggestions` pode quebrar call-sites existentes (`nudge/route.ts`, rotas admin). Mitigação: params novos OPCIONAIS com default `platform`/`null` (AC5, Dev Notes) + `typecheck` na Task 8.
  - R2 (médio): a fonte de dados de `behind_teaching_plan` (RPC vs. recálculo TS) é uma decisão em aberto — se a RPC `auth_team_engagement_signals` não expuser o pace/atraso já calculado, recalcular em TS pode divergir de `student-triage.ts`. Mitigação: Task 1 confirma a fonte ANTES de implementar (AC1 exige documentar a fonte).
  - R3 (médio): `senderName` aceito do cliente sem validação permitiria um gestor assinar como outro. Mitigação: AC5 exige validação server-side de identidade (na rota E3).

## Regra Absoluta de Escopo (verificação)

Coberta por AC7 (novo cohort respeita `allowedStudentIds`). Blocker: se qualquer caminho novo ignorar o parâmetro de escopo, a story não está pronta.

## Dev Notes

- `dispatchTeamNudge` já é chamado por `apps/web/src/app/api/analytics/manager/nudge/route.ts` — ao estender a assinatura, os parâmetros novos (`senderIdentity`, `senderName`) devem ser OPCIONAIS com default `senderIdentity: 'platform'`, `senderName: null`, para não quebrar esse call-site existente até que E3/E6 o atualizem explicitamente (ou, se for mais limpo, atualizar esse call-site nesta mesma story — decidir e documentar).
- Não é escopo desta story mexer nas rotas HTTP (`api/engagement/*`) — isso é E3. Esta story entrega só a camada de lógica em `engine.ts` (e testes), pronta para ser consumida pela API nova.
- `resolveCallerStudentScope` (em `area-context.ts`) é quem resolve `allowedStudentIds` a partir do usuário autenticado — essa resolução acontece na ROTA (E3), não aqui. Esta story recebe `allowedStudentIds` já pronto como parâmetro.

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web lint
pnpm --filter @eximia/web test -- notifications/engine
```

## Dev Agent Record

**Agent:** Dex (@dev) · **Data:** 2026-07-08 · **Status:** InReview

### Decisões técnicas
- **Fonte de `behind_teaching_plan` (Task 1 / R2):** a RPC `auth_team_engagement_signals` expõe `behind_schedule`. Mas o engine roda com o **service client** (RLS-bypass) e a RPC é SECURITY DEFINER hard-wired a `auth.uid()`, então não é chamável com service client. Decisão: replicar a fórmula EXATA da CTE `behind` da RPC em `computeBehindStudentIds` (enrollment active + course.deadline_days>0 + progress% < expectedPct). Byte-equivalente à RPC e a `student-triage.ts` `ritmo==="atrasado"`. Não há divergência de taxonomia — é a mesma fórmula, computada onde o engine já lê os dados. `loadStudentSignals` passou a buscar `enrollments`+`courses` em paralelo com sessions/reflections.
- **Cohort exclui `nao_iniciado`:** `behind_teaching_plan` = `behindSchedule && totalSessions>0`. Um aluno atrasado que nunca acessou cai em `never_accessed` (AC1 explícito).
- **Retrocompat (R1):** `generateNudgeSuggestions` ganhou 3º param `managerId?` opcional; `dispatchTeamNudge` ganhou `senderIdentity?`/`senderName?` opcionais com default `platform`/`null`. O call-site legado `api/analytics/manager/nudge/route.ts` NÃO foi tocado e continua funcionando (default platform). typecheck confirma zero break.
- **AC3 (sem fila):** decisão de NÃO adicionar cache nesta camada — a geração é barata e sempre reflete o recorte. E3 chama `generateNudgeSuggestions` a cada overview.
- **AC5 (validação de identidade):** a função só persiste `senderName`; a trava de "senderName == usuário autenticado" fica na ROTA (E3), como manda a Dev Note.
- **Email (decisão #4):** o corpo do email espelha a saudação origin-aware; o FROM permanece o remetente da plataforma (deliverability); o label do remetente no envelope reflete o gestor quando `manager`.

### Verificação
- `pnpm --filter @eximia/web typecheck` → verde.
- `npx vitest run src/lib/notifications/__tests__/engine.test.ts` → **12/12 pass**.
- `npx biome check` engine.ts + engine.test.ts → clean.
- Suíte completa: 559 pass / 32 fail — +12 vs baseline E1 (só meus testes novos), 32 fails = baseline pré-existente inalterado. Zero regressão.

### File List
- `apps/web/src/lib/notifications/engine.ts` (modificado — signals+pace, cohort, dismissal 7d, managerId, dispatch sender, renderWithOrigin)
- `apps/web/src/lib/notifications/__tests__/engine.test.ts` (novo — 12 testes)

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-08 | Story criada | River (SM Agent) |
| 2026-07-08 | PO: adicionadas Complexidade & Riscos + verificação de escopo. Validada GO (9/10). | Pax (@po) |
| 2026-07-08 | Implementada: cohort behind_teaching_plan (fórmula da RPC), dismissal 7d por gestor, dispatch com origem + renderWithOrigin, 12 testes. InReview. | Dex (@dev) |

## PO Validation: GO

**Verdict:** GO — **9/10** — 2026-07-08 — @po (Pax)

Coração lógico do epic, bem escopado. Símbolos verificados no repo: `generateNudgeSuggestions` (linha 302, já aceita `allowedStudentIds`), `classifyNudgeCohorts` (linha 219, retorna `{type,studentIds,rationale}`), `dispatchTeamNudge` (linha 674, já aceita `message?`), `NUDGE_TYPE_TEMPLATE_KEY` (linha 66), `approveSuggestion` (linha 464) — todos existem exatamente como descrito. A distinção entre a cadência de 24h existente e o dismissal de 7 dias NOVO está clara e correta. AC8 exige testes unitários dos 4 comportamentos. Boa disciplina de retrocompatibilidade (params opcionais).
**Nota para devs:** a fonte de dados do cohort `behind_teaching_plan` (RPC `auth_team_engagement_signals` vs. recálculo em TS) é decisão aberta — resolver na Task 1 e NÃO recalcular pace à mão se a RPC já entrega; divergir de `student-triage.ts` é o risco.
