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

- [ ] **AC1:** `resolveAudienceScoped(db, tenantId, userId, roles, criteria)` implementado em `apps/web/src/lib/notifications/audiences.ts` (ou módulo equivalente), compondo `resolveCallerStudentScope` + a resolução de audiência existente. Contrato: retorna a lista final de `studentIds` já escopada — nunca retorna alunos fora do alcance do caller, mesmo que `criteria` peça algo mais amplo.
- [ ] **AC2:** Toda função de eficácia (`efficacy.ts`) ganha uma variante ou parâmetro que aceita `allowedStudentIds` e filtra os cálculos de leitura/retorno a esse conjunto antes de agregar métricas. A versão tenant-wide (usada hoje pelo admin) permanece disponível separadamente — não quebrar o uso admin existente.
- [ ] **AC3:** `GET /api/admin/notifications` — se este endpoint for reusado por qualquer rota nova do gestor (CONFIRMAR se E3/E8 vão reusá-lo ou se a nova API é 100% independente; default: a nova API é independente e NÃO reusa esta rota admin, para não acoplar os dois papéis — documentar a decisão tomada), então ganha o mesmo filtro de escopo. Se a decisão for "não reusar", este AC vira "confirmado: `GET /api/admin/notifications` permanece admin-only e não é tocado por este epic", e isso deve estar explícito no Dev Agent Record.
- [ ] **AC4:** `GET /api/engagement/overview` implementado: recebe (via cookies de contexto, mesma leitura que `analytics/page.tsx` — CONFIRMAR nomes de cookie exatos ao implementar E4/E3 juntos) o contexto ativo do gestor, resolve `allowedStudentIds` via `resolveCallerStudentScope`, chama a engine de E2 para: (a) cards de resumo escopados (Ações pendentes, Alunos em atenção, Sem acesso recente, Mensagens enviadas, Taxa de leitura), (b) lista de sugestões ao vivo do recorte atual. Retorna JSON com os dois blocos.
- [ ] **AC5:** `POST /api/engagement/action` implementado: dispara uma ação individual (remind/activate/recognize/manual) para 1 aluno. Segue o esqueleto AUTH→VALIDATE→RE-SCOPE→DISPATCH; RE-SCOPE usa `resolveCallerStudentScope` para confirmar que o `studentId` alvo está dentro do alcance do gestor ANTES de despachar (um `studentId` fora do escopo retorna 403/400, nunca despacha silenciosamente).
- [ ] **AC6:** `POST /api/engagement/campaign` implementado em DOIS momentos: (1) modo "preview" retorna a lista de destinatários + motivo de inclusão, SEM enviar nada; (2) modo "confirm" (payload explicitamente revisado, possivelmente com alunos removidos pelo gestor) efetivamente despacha. Cap de 200 destinatários (mesmo padrão de `nudge/route.ts`). Nenhuma campanha despacha sem ter passado pelo modo preview antes (decisão #8 do epic).
- [ ] **AC7:** `GET /api/engagement/history` implementado: lista `notifications` filtradas por `allowedStudentIds` (via `recipient_id IN (...)`), com filtros de query string (aluno, tipo, origem, canal, status, período). Nunca retorna uma row cujo `recipient_id` esteja fora do escopo do gestor que chamou.
- [ ] **AC8:** `GET /api/engagement/templates` e `PATCH /api/engagement/templates/{id}` implementados: listar templates ativos do tenant (todos, incluindo o novo `behind_teaching_plan`), com campos `intent`/`tone`/`name` visíveis; PATCH permite editar corpo/nome/tone de um template (mantendo `key` imutável). Autorização: só `admin`/`manager` (mesma regra de RLS de `nt_write` em `20260604120000_engagement_engine.sql`).
- [ ] **AC9:** Todas as 5 rotas acima têm teste de "vazamento": um payload/contexto que tenta alcançar um aluno fora do escopo do caller retorna 400/403/lista vazia, nunca dados do aluno de fora.

## Tasks

- [ ] 1. Ler `audiences.ts`, `efficacy.ts`, `nudge/route.ts` por completo.
- [ ] 2. Implementar `resolveAudienceScoped` compondo `resolveCallerStudentScope`.
- [ ] 3. Estender `efficacy.ts` para aceitar escopo.
- [ ] 4. Decidir e documentar o destino de `GET /api/admin/notifications` (AC3).
- [ ] 5. Criar `apps/web/src/app/api/engagement/overview/route.ts`.
- [ ] 6. Criar `apps/web/src/app/api/engagement/action/route.ts`.
- [ ] 7. Criar `apps/web/src/app/api/engagement/campaign/route.ts` (preview + confirm).
- [ ] 8. Criar `apps/web/src/app/api/engagement/history/route.ts`.
- [ ] 9. Criar `apps/web/src/app/api/engagement/templates/route.ts` (GET) e `[id]/route.ts` (PATCH).
- [ ] 10. Escrever testes de vazamento (AC9) para as 5 rotas.

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

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-08 | Story criada | River (SM Agent) |
| 2026-07-08 | PO: adicionadas Complexidade & Riscos + verificação de escopo. Validada GO (9/10). | Pax (@po) |

## PO Validation: GO

**Verdict:** GO — **9/10** — 2026-07-08 — @po (Pax)

A story de segurança do epic, e a mais crítica. `resolveCallerStudentScope` verificado (`area-context.ts` linha 412), `nudge/route.ts` existe como padrão de ouro, `audiences.ts` e `efficacy.ts` existem. Os 4 vazamentos a fechar são fatos verificados, não hipóteses. Contratos das 5 rotas (`overview`, `action`, `campaign` preview/confirm, `history`, `templates` GET/PATCH) são completos o suficiente para E4-E9 consumirem sem inventar: request/response, escopo, cap de 200, autorização por papel — tudo especificado. AC9 (teste de vazamento por rota) é o gate correto.
**Nota para devs:** confirmar o nome exato de cada cookie de contexto ao implementar junto com E4 (o briefing original errou os nomes; usar os REAIS de `analytics/page.tsx`). Decidir explicitamente (AC3) se `GET /api/admin/notifications` é reusado (default: não, API nova é independente).
