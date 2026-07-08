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

- [ ] **AC1:** Existe uma função (nome sugerido `classifyBehindTeachingPlanCohort` ou cohort adicional dentro de `classifyNudgeCohorts`) que produz o cohort `behind_teaching_plan` a partir da MESMA definição de atraso já usada em `student-triage.ts` (`StudentTriagem === 'atencao'` com `ritmo === 'atrasado'`, especificamente — não `nao_iniciado`, que já é coberto por `never_accessed`). Confirmar e documentar a fonte de dados exata usada (RPC `auth_team_engagement_signals` vs. recálculo em TS) no Dev Agent Record.
- [ ] **AC2:** `generateNudgeSuggestions` (ou uma nova função que a envolve, ex. `generateContextualSuggestions`) aceita `manager_id` como parâmetro além de `allowedStudentIds`, e popula `nudge_suggestions.manager_id` em todo INSERT feito a partir desta wave em diante.
- [ ] **AC3:** Rows de `nudge_suggestions` com `status IN ('approved','dismissed')` funcionam como AUDITORIA — nenhuma sugestão `pending` "sobra" esperando ser lida depois; a lista exibida ao gestor é sempre recém-computada na chamada (ou servida de um cache com TTL curto explicitamente documentado, nunca lida como fila persistente).
- [ ] **AC4:** Dismissal de 7 dias por gestor+tipo implementado e coberto por teste unitário: dispensar `never_accessed` como Gestor A não impede Gestor B de ver `never_accessed` no dia seguinte (o filtro é por `manager_id`, não tenant-wide); dispensar novamente após 8 dias faz a sugestão reaparecer se o sinal persiste.
- [ ] **AC5:** `dispatchTeamNudge` aceita `senderIdentity` e `senderName`, grava em `notifications.sender_identity`/`notifications.sender_name`, e valida que `senderName` só é aceito quando corresponde ao usuário autenticado que fez a chamada (a validação de identidade acontece na ROTA que chama esta função — E3 — mas a função aqui deve ter a assinatura pronta para receber e persistir esses dois campos).
- [ ] **AC6:** Mensagem renderizada muda de saudação conforme `senderIdentity`: exemplo "Olá, Marcela. Aqui é o Rinaldo." (manager) vs. "Olá, Marcela. A exímIA Academy percebeu..." (platform) — replicar o padrão exato da Seção 11 do report.
- [ ] **AC7:** Todo cohort novo (`behind_teaching_plan`) respeita a interseção de escopo (`allowedStudentIds`) da MESMA forma que os cohorts existentes — nenhum caminho novo ignora o parâmetro de escopo.
- [ ] **AC8:** Testes unitários cobrindo: cohort `behind_teaching_plan` correto para um conjunto sintético de alunos; dismissal de 7 dias; `senderIdentity` afetando o corpo renderizado; interseção de escopo aplicada ao novo cohort.

## Tasks

- [ ] 1. Ler `apps/web/src/lib/student-triage.ts` e `supabase/migrations/20260703010000_auth_team_engagement_signals.sql` para decidir a fonte de dados do cohort `behind_teaching_plan`.
- [ ] 2. Implementar o cohort `behind_teaching_plan` em `engine.ts`.
- [ ] 3. Implementar a checagem de dismissal de 7 dias por `manager_id + type`.
- [ ] 4. Adicionar `manager_id` ao INSERT de `nudge_suggestions` em `generateNudgeSuggestions` (ou wrapper novo).
- [ ] 5. Estender `dispatchTeamNudge` com `senderIdentity`/`senderName`, persistindo nas colunas de E1.
- [ ] 6. Implementar a variação de saudação por origem em `renderTemplate`/nova função wrapper.
- [ ] 7. Escrever testes unitários (Vitest) para os 4 comportamentos do AC8.
- [ ] 8. Rodar `pnpm --filter @eximia/web typecheck` e `pnpm --filter @eximia/web test` — nenhuma chamada existente a `dispatchTeamNudge`/`generateNudgeSuggestions` (ex.: `nudge/route.ts`, rotas admin) deve quebrar.

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

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-08 | Story criada | River (SM Agent) |
| 2026-07-08 | PO: adicionadas Complexidade & Riscos + verificação de escopo. Validada GO (9/10). | Pax (@po) |

## PO Validation: GO

**Verdict:** GO — **9/10** — 2026-07-08 — @po (Pax)

Coração lógico do epic, bem escopado. Símbolos verificados no repo: `generateNudgeSuggestions` (linha 302, já aceita `allowedStudentIds`), `classifyNudgeCohorts` (linha 219, retorna `{type,studentIds,rationale}`), `dispatchTeamNudge` (linha 674, já aceita `message?`), `NUDGE_TYPE_TEMPLATE_KEY` (linha 66), `approveSuggestion` (linha 464) — todos existem exatamente como descrito. A distinção entre a cadência de 24h existente e o dismissal de 7 dias NOVO está clara e correta. AC8 exige testes unitários dos 4 comportamentos. Boa disciplina de retrocompatibilidade (params opcionais).
**Nota para devs:** a fonte de dados do cohort `behind_teaching_plan` (RPC `auth_team_engagement_signals` vs. recálculo em TS) é decisão aberta — resolver na Task 1 e NÃO recalcular pace à mão se a RPC já entrega; divergir de `student-triage.ts` é o risco.
