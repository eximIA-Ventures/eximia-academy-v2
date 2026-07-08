# E3: Fechamento de Vazamentos de Escopo + Nova API `/api/engagement/*`

**Epic:** [00-EPIC-OVERVIEW](./00-EPIC-OVERVIEW.md)
**Status:** Draft
**Depende de:** E1 (schema), coordena com E2 (lógica de engine)
**Bloqueia:** E4, E5, E6, E7, E8, E9 (todas as abas consomem esta API)

---

## Story

**As a** gestor,
**I want** que toda rota de engajamento (sugestões, eficácia, histórico, campanhas) aplique o MESMO filtro de escopo que já protege `/api/analytics/manager/nudge`,
**so that** nenhuma contagem, sugestão ou histórico jamais me mostre alunos fora do meu recorte atual.

## Contexto (Dev Notes)

Ler `00-EPIC-OVERVIEW.md` Seção 5 antes de começar.

**Vazamentos conhecidos a fechar (fatos verificados, não hipóteses):**
1. `apps/web/src/lib/notifications/audiences.ts` — função `resolveAudience` (CONFIRMAR nome exato ao abrir o arquivo) hoje resolve audiências SEM aplicar `allowedStudentIds`/escopo de gestor.
2. `apps/web/src/lib/notifications/efficacy.ts` — função de eficácia (`nudgeEfficacyByType` ou equivalente, CONFIRMAR nome exato) hoje calcula métricas TENANT-WIDE, mesmo quando quem chama é um gestor.
3. `GET /api/admin/notifications` (`apps/web/src/app/api/admin/notifications/route.ts`) — hoje não filtra por escopo de gestor (é uma rota historicamente admin-only, mas se algum caminho do gestor a reusar, precisa ganhar o mesmo filtro).
4. O `GET` de sugestões pendentes (via `listPendingSuggestions` em `engine.ts`) hoje é tenant-wide — precisa ganhar escopo antes de virar a base do endpoint `GET /api/engagement/overview` (E2 já resolve isso na camada de engine; esta story garante que a ROTA passa o `allowedStudentIds` correto).

**Função central desta story:** `resolveAudienceScoped(criteria, tenantId, allowedStudentIds)`.

- NÃO reinventar a resolução de escopo do zero. `apps/web/src/lib/area-context.ts` já expõe `resolveCallerStudentScope(db, tenantId, userId, roles)`, que resolve exatamente "quais alunos este caller pode alcançar" (admin/super_admin → `null` tenant-wide; manager → subtree completo via `getManagedTeamStudentIds(..., {includeSubtree:true})`; instructor → união por área via `getAreaStudentIds`; qualquer outro papel → `[]` fail-closed). `resolveAudienceScoped` deve COMPOR sobre essa função: primeiro resolve `allowedStudentIds = resolveCallerStudentScope(...)`, depois filtra o resultado de `resolveAudience(criteria, tenantId)` pela interseção com `allowedStudentIds` (quando não-nulo).
- Padrão de rota a seguir para TODA rota nova em `api/engagement/*`: o esqueleto de 4 passos de `apps/web/src/app/api/analytics/manager/nudge/route.ts` (AUTH → VALIDATE payload → RE-SCOPE com client autenticado → DISPATCH/QUERY). Ler esse arquivo por completo antes de escrever qualquer rota nova.
- Cap de FinOps: `nudge/route.ts` usa `MAX_RECIPIENTS = 200` para um único dispatch — replicar o mesmo cap em `POST /api/engagement/campaign`.

## Acceptance Criteria

- [x] **AC1:** `resolveAudienceScoped(authClient, tenantId, userId, roles, criteria, serviceDbOverride?)` em `audiences.ts`, compondo `resolveCallerStudentScope` (escopo do caller, client AUTENTICADO) + `resolveAudience` (criteria→set), retornando a INTERSEÇÃO. Caller null (admin) passa direto; scoped intersecta; `[]` → `[]` fail-closed. Coberto por teste.
- [x] **AC2:** `nudgeEfficacyByType(tenantId, dbOverride?, allowedStudentIds?)` ganhou o 3º param: non-null filtra `recipient_id IN (...)` (chunks de 200) antes de agregar; `[]` → zero (fail-closed); null → tenant-wide (uso admin intacto). Coberto por teste.
- [x] **AC3:** DECISÃO — nova API `/api/engagement/*` é 100% INDEPENDENTE, NÃO reusa `GET /api/admin/notifications`. Essa rota lê a tabela LEGADA `email_notifications` (campaign-level, `recipients` = snapshot jsonb, SEM `recipient_id` por aluno). Como o epic pede que o fechamento valha p/ a tela admin antiga, apliquei o escopo POSSÍVEL: não-admin vê só campanhas que ELE enviou (`sender_id = user.id`); admin/super_admin mantém tenant-wide. (POST já tinha `resolveCallerStudentScope`.)
- [x] **AC4:** `GET /api/engagement/overview`: `resolveEngagementScope` (helper novo honrando os cookies REAIS `x-active-context` + `x-team-view`, idêntico a `analytics/page.tsx`) → `allowedStudentIds`; 5 cards escopados + sugestões live via `generateNudgeSuggestions`.
- [x] **AC5:** `POST /api/engagement/action` (AUTH→VALIDATE→RE-SCOPE→DISPATCH). RE-SCOPE confirma `studentId` ∈ alcance; fora → 403, nunca despacha. `senderName` server-trusted (nome do caller), nunca do payload. Coberto por teste.
- [x] **AC6:** `POST /api/engagement/campaign` em 2 modos: `preview` (via `resolveAudienceScoped`, SEM enviar) e `confirm` (re-scopa a lista revisada, dropa ids fora, despacha). Cap 200. Sem preview → sem dispatch. Coberto por teste.
- [x] **AC7:** `GET /api/engagement/history`: `recipient_id IN (allowedStudentIds)` (chunked) + filtros query-string (student, origin, channel, status, from, to). student fora do escopo → vazio; scope vazio → vazio. Coberto por teste.
- [x] **AC8:** `GET /api/engagement/templates` (ativos c/ intent/tone/name, inclui `behind_teaching_plan`) + `PATCH .../[id]` (edita name/title/body/email/tone/intent/canais; `key` IMUTÁVEL, nunca aceito). Autorização admin/manager (paridade `nt_write`).
- [x] **AC9:** `routes-leak.test.ts` (9 testes) cobre as 5 rotas + `audiences-scoped.test.ts` (5 testes) prova a interseção. Payload/contexto fora do escopo → 400/403/vazio, nunca dado de fora.

## Tasks

- [x] 1. Ler `audiences.ts`, `efficacy.ts`, `nudge/route.ts` por completo.
- [x] 2. Implementar `resolveAudienceScoped` compondo `resolveCallerStudentScope`.
- [x] 3. Estender `efficacy.ts` para aceitar escopo.
- [x] 4. Decidir e documentar o destino de `GET /api/admin/notifications` (AC3) — independente; escopo por autor aplicado.
- [x] 5. Criar `apps/web/src/app/api/engagement/overview/route.ts`.
- [x] 6. Criar `apps/web/src/app/api/engagement/action/route.ts`.
- [x] 7. Criar `apps/web/src/app/api/engagement/campaign/route.ts` (preview + confirm).
- [x] 8. Criar `apps/web/src/app/api/engagement/history/route.ts`.
- [x] 9. Criar `apps/web/src/app/api/engagement/templates/route.ts` (GET) e `[id]/route.ts` (PATCH).
- [x] 10. Escrever testes de vazamento (AC9) para as 5 rotas. → 14 testes (9 rotas + 5 audiences/efficacy).

## Complexidade & Riscos

- **Complexidade:** L (large). 5 rotas HTTP novas + refactor de audiences/efficacy para escopo, tudo com o gate de segurança de vazamento como blocker.
- **Riscos:**
  - R1 (alto): esta é a story onde um erro = vazamento de dados entre times (a falha exata que o epic existe para matar). Mitigação: todo endpoint segue o esqueleto de 4 passos de `nudge/route.ts` (RE-SCOPE obrigatório) + AC9 exige teste de vazamento por rota.
  - R2 (médio): migrar `nudge/route.ts` de `getManagedTeamStudentIds` para `resolveAudienceScoped` (overview Seção 5) pode alterar sutilmente o conjunto resolvido (subtree vs. direto). Mitigação: decidir explicitamente se o endpoint legado migra (default: sim) e cobrir com teste antes/depois.
  - R3 (médio): coordenação com E2 sobre `resolveAudienceScoped` vs. `allowedStudentIds` — mesma ideia em duas camadas. Dev Notes já distingue (E3 RESOLVE o conjunto, E2 CONSOME). Risco de implementação duplicada se as stories rodarem em paralelo sem coordenar.

## Regra Absoluta de Escopo (verificação)

É o núcleo desta story inteira. AC9 (teste de vazamento nas 5 rotas) é o AC verificável que a materializa. Blocker absoluto.

## Dev Notes

- Esta story assume que E2 já entregou a lógica de engine (cohorts, dismissal 7d, sender origin) — se E2 ainda estiver em andamento, coordenar para não duplicar a implementação de `resolveAudienceScoped` vs. o parâmetro `allowedStudentIds` que E2 já usa em `generateNudgeSuggestions`. São a MESMA ideia (interseção de escopo); `resolveAudienceScoped` é a camada que RESOLVE esse conjunto a partir do usuário autenticado, E2 é quem CONSOME o conjunto já resolvido.
- Rota de referência para o esqueleto de segurança: `apps/web/src/app/api/analytics/manager/nudge/route.ts` linha a linha (AUTH, VALIDATE, RE-SCOPE, DISPATCH comentados explicitamente no arquivo).
- Não implementar UI nesta story — é 100% backend/API. E4 em diante consome estes endpoints.

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web lint
pnpm --filter @eximia/web test -- api/engagement
pnpm --filter @eximia/web test -- notifications/audiences
pnpm --filter @eximia/web test -- notifications/efficacy
```

## Dev Agent Record

**Agent:** Dex (@dev) · **Data:** 2026-07-08 · **Status:** InReview

### Decisões técnicas
- **`resolveAudienceScoped` (AC1):** compõe `resolveCallerStudentScope` (com o client AUTENTICADO, pois o ramo manager lê `auth.uid()`) + `resolveAudience` (que usa o service client interno, só precisa de tenant). Retorna a interseção; admin (null) passa direto. Não reinventa escopo — pura composição.
- **`resolveEngagementScope` (helper novo, `engagement-scope.ts`):** ÚNICA fonte de verdade de escopo para as 5 rotas, para não repetir a lógica de contexto em cada uma. Honra os cookies REAIS confirmados no `analytics/page.tsx`: `x-active-context` (`getActiveContextCookie`) + `x-team-view` (`getTeamViewMode`) + `resolveCallerStudentScope`. O briefing original errou os nomes de cookie; usei os reais. Manager em `team` context → direct vs subtree pelo switch; fora do team → subtree completo; admin → null; outros → `resolveCallerStudentScope` (fail-closed).
- **AC3 (`GET /api/admin/notifications`):** a nova API NÃO reusa essa rota. Ela lê a tabela LEGADA `email_notifications` (campaign-level, `recipients` jsonb, sem `recipient_id` por aluno). Fechamento possível nessa tabela = escopo por AUTOR (`sender_id = user.id` p/ não-admin); admin mantém tenant-wide. O POST dessa rota já tinha `resolveCallerStudentScope` de wave anterior.
- **Padrão de rota:** todas as 5 seguem AUTH→VALIDATE→RE-SCOPE→DISPATCH/QUERY do padrão de ouro `nudge/route.ts`, fail-closed. `senderName` (identidade manager) é sempre o nome do caller autenticado (resolvido de `profile.full_name`), NUNCA do payload — impede assinar como outra pessoa (E2 R3).
- **Cap FinOps:** `MAX_RECIPIENTS = 200` na campaign, igual `nudge/route.ts`. Reads escopados por `recipient_id IN (...)` são chunked em 200 p/ não estourar a URL do PostgREST.
- **Templates:** `key` imutável no PATCH (nunca aceito do payload) porque wira o mapa `NUDGE_TYPE_TEMPLATE_KEY`.

### Verificação
- `pnpm --filter @eximia/web typecheck` → verde.
- `npx biome check` nos arquivos E3 → clean (o `noNonNullAssertion` remanescente em `admin/notifications` linha 155 é `resend!` no POST, código pré-existente fora do meu escopo).
- Testes novos: `audiences-scoped.test.ts` (5) + `routes-leak.test.ts` (9) = **14 pass**.
- Suíte completa: 573 pass / 32 fail — +14 vs baseline E2, 32 fails = baseline pré-existente inalterado (drift de mock Supabase em rotas não relacionadas). Zero regressão.
- Guards do briefing: `grep sender_identity` migration+engine = 11 hits; `grep resolveAudienceScoped` = 13 hits (definida + usada na campaign + testes).

### File List
- `apps/web/src/lib/notifications/audiences.ts` (modificado — `resolveAudienceScoped`)
- `apps/web/src/lib/notifications/efficacy.ts` (modificado — `nudgeEfficacyByType` escopo)
- `apps/web/src/lib/notifications/engagement-scope.ts` (novo — helper de escopo por contexto)
- `apps/web/src/app/api/engagement/overview/route.ts` (novo)
- `apps/web/src/app/api/engagement/action/route.ts` (novo)
- `apps/web/src/app/api/engagement/campaign/route.ts` (novo — preview + confirm)
- `apps/web/src/app/api/engagement/history/route.ts` (novo)
- `apps/web/src/app/api/engagement/templates/route.ts` (novo — GET)
- `apps/web/src/app/api/engagement/templates/[id]/route.ts` (novo — PATCH)
- `apps/web/src/app/api/admin/notifications/route.ts` (modificado — GET escopado por autor, AC3)
- `apps/web/src/lib/notifications/__tests__/audiences-scoped.test.ts` (novo — 5 testes)
- `apps/web/src/app/api/engagement/__tests__/routes-leak.test.ts` (novo — 9 testes)

## Patch de contratos (pós-E7/E8/E9) — 2026-07-08

**Agent:** Dex (@dev). Fechamento cirúrgico das 4 lacunas de contrato que as abas de UI (E7-E9) registraram ao consumir as rotas. A UI já lia os campos defensivamente; este patch faz os campos chegarem, sem afrouxar o escopo.

- **`GET /api/engagement/history`** (3 lacunas):
  1. **`recipient_name`/`recipient_email`** — enrichment via bulk lookup em `users` (`.in("id", recipientIds)`), espelhando o padrão de `admin/notifications/page.tsx`. INVARIANTE DE SEGURANÇA: os ids do lookup vêm EXCLUSIVAMENTE das rows já escopadas (`recipient_id ∈ allowedStudentIds`), o lookup é ainda tenant-anchored (`.eq("tenant_id", ...)`) como belt-and-suspenders. Impossível resolver nome de aluno fora do recorte.
  2. **`returned_at` + `acted_at`** — adicionados ao SELECT de `notifications` (a coluna Resultado da UI depende de `returned_at` para "Acessou depois da mensagem").
  3. **filtro `type`** — novo query-param, validado contra a união `NudgeType` (unknown → 400, nunca vai cru pro DB). Aplicado como `.eq("context->>nudge_type", value)` (operador JSONB do PostgREST). **Decisão do filtro `type`:** o tipo de ação vive em `context.nudge_type` na própria row (mesma fonte que a UI já usa via `motivoLabel`), então o filtro é feito no JSONB da tabela `notifications` SEM join, sem dependência de `nudge_suggestions`. Zero fragilidade de join.
- **`GET /api/engagement/templates`** (lacuna 4): removido o filtro `is_active=true` → retorna TODOS os templates do tenant; SELECT e payload ganharam `is_active`/`updated_at` (`isActive`/`updatedAt`); ordenação `is_active desc, intent asc` (ativos no topo). **`PATCH .../[id]`** passou a aceitar `is_active` (toggle de ativação/desativação); `key` continua IMUTÁVEL (nunca aceito do payload); response SELECT inclui `is_active`/`updated_at`.
- **Testes** (`routes-leak.test.ts`): +6 (15 total). Novos: 400 em `type` desconhecido; enrichment anexa nome/email/returned_at/acted_at; **teste de não-vazamento do enrichment** (mesmo com `users` "envenenado" retornando um id fora do escopo, o lookup só pede os ids das rows escopadas e nenhuma notificação carrega o nome de fora); GET templates retorna ativo+inativo com isActive/updatedAt; PATCH aceita `is_active` e dropa `key`; PATCH 400 quando só `key` é enviado.
- **Verificação:** `pnpm --filter @eximia/web typecheck` → zero erros nos arquivos tocados (erros remanescentes em `student-insights-table.tsx` são de outro agente em paralelo, fora do meu escopo). `biome check` nos 4 arquivos → clean. Domínio isolado (`engagement` API + `notifications` lib) → 32/32 pass. Full suite fail-count subiu por churn do agente paralelo (`student-insights-table.tsx` não compila no working tree agora), não por este patch.
- **File List (patch):** `apps/web/src/app/api/engagement/history/route.ts`, `apps/web/src/app/api/engagement/templates/route.ts`, `apps/web/src/app/api/engagement/templates/[id]/route.ts`, `apps/web/src/app/api/engagement/__tests__/routes-leak.test.ts`.

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-08 | Story criada | River (SM Agent) |
| 2026-07-08 | PO: adicionadas Complexidade & Riscos + verificação de escopo. Validada GO (9/10). | Pax (@po) |
| 2026-07-08 | Implementada: resolveAudienceScoped + eficácia escopada + engagement-scope + 5 rotas /api/engagement/* + GET admin escopado por autor + 14 testes de vazamento. InReview. | Dex (@dev) |
| 2026-07-08 | Patch de contratos (pós-E7/E8/E9): history ganhou recipient_name/email, returned_at/acted_at e filtro `type`; templates retorna todos + is_active/updated_at + PATCH is_active. +6 testes (15 total), escopo intacto. | Dex (@dev) |

## PO Validation: GO

**Verdict:** GO — **9/10** — 2026-07-08 — @po (Pax)

A story de segurança do epic, e a mais crítica. `resolveCallerStudentScope` verificado (`area-context.ts` linha 412), `nudge/route.ts` existe como padrão de ouro, `audiences.ts` e `efficacy.ts` existem. Os 4 vazamentos a fechar são fatos verificados, não hipóteses. Contratos das 5 rotas (`overview`, `action`, `campaign` preview/confirm, `history`, `templates` GET/PATCH) são completos o suficiente para E4-E9 consumirem sem inventar: request/response, escopo, cap de 200, autorização por papel — tudo especificado. AC9 (teste de vazamento por rota) é o gate correto.
**Nota para devs:** confirmar o nome exato de cada cookie de contexto ao implementar junto com E4 (o briefing original errou os nomes; usar os REAIS de `analytics/page.tsx`). Decidir explicitamente (AC3) se `GET /api/admin/notifications` é reusado (default: não, API nova é independente).
