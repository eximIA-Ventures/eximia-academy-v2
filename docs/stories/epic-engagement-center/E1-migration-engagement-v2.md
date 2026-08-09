# E1: Migration Engagement v2 (schema + seeds)

**Epic:** [00-EPIC-OVERVIEW](./00-EPIC-OVERVIEW.md)
**Status:** Draft
**Depende de:** nenhuma (fundação do epic)
**Bloqueia:** E2, E3

---

## Story

**As a** engine de engajamento,
**I want** um schema estendido que suporte auditoria de sugestões por gestor, origem de mensagem e templates organizados por intenção,
**so that** as próximas stories (E2, E3) tenham as colunas necessárias para computar sugestões ao vivo, escolher origem da mensagem e exibir templates por intenção.

## Contexto (Dev Notes)

Ler `docs/stories/epic-engagement-center/00-EPIC-OVERVIEW.md` Seção 5 antes de começar — contém os fatos já verificados do schema real.

- Migration base: `supabase/migrations/20260604120000_engagement_engine.sql` (na RAIZ do repo, não em `apps/web/`). Lá estão as definições atuais de `notification_templates`, `notifications`, `nudge_suggestions`, `notification_audiences`, RLS e o seed de 5 templates (`never_accessed`, `inactive_14d`, `session_no_reflection`, `top_performer_recognition`, `announcement_generic`).
- Hardening RLS: `supabase/migrations/20260630000000_engagement_rls_group_scope.sql`.
- RPC de sinais de time: `supabase/migrations/20260703010000_auth_team_engagement_signals.sql`.
- `nudge_suggestions.type` hoje é `CHECK (type IN ('never_accessed','inactive','no_reflection','top_performer','announcement','custom'))`. Esta story adiciona `behind_teaching_plan` a este CHECK.
- `notification_templates` já usa `key` (TEXT, UNIQUE por tenant) como identificador técnico, não `type`. Não renomear esta coluna — apenas adicionar `intent` e `tone`.
- Convenção de migration do repo: arquivo `supabase/migrations/{YYYYMMDDHHMMSS}_{nome_descritivo}.sql`, idempotente (`CREATE ... IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS` + recriar, `ON CONFLICT ... DO NOTHING`), dentro de `BEGIN; ... COMMIT;`, com comentários `COMMENT ON COLUMN` documentando cada campo novo (ver o estilo de `20260604120000_engagement_engine.sql`).
- Nomear o arquivo desta migration com timestamp POSTERIOR a `20260703010000` (ex.: `20260708120000_engagement_center_v2.sql`) — confirmar que não colide com nenhuma migration já existente rodando `ls supabase/migrations/ | sort | tail -5` antes de criar o arquivo.

## Acceptance Criteria

- [x] **AC1:** `nudge_suggestions` ganha coluna `manager_id UUID REFERENCES users(id) ON DELETE SET NULL`. Nula para rows legadas (geradas antes desta migration, sem gestor específico — tenant-wide). Índice `idx_nudge_suggestions_manager ON nudge_suggestions(tenant_id, manager_id)`.
- [x] **AC2:** `nudge_suggestions.type` CHECK constraint estendido para incluir `'behind_teaching_plan'`. Usar `ALTER TABLE ... DROP CONSTRAINT IF EXISTS ... ADD CONSTRAINT ...` (idempotente — nomear a constraint explicitamente se ainda não tiver nome, ou usar `DO $$ ... $$` para checar existência antes de recriar).
- [x] **AC3:** `notifications` ganha duas colunas: `sender_identity TEXT NOT NULL DEFAULT 'platform' CHECK (sender_identity IN ('manager','platform'))` e `sender_name TEXT` (nome do gestor, nula quando `sender_identity='platform'`). Backfill: rows existentes recebem `sender_identity='platform'` (default já cobre isso automaticamente via `DEFAULT`, mas documentar explicitamente no comentário da migration que é a decisão correta — mensagens antigas nunca tiveram atribuição de gestor).
- [x] **AC4:** `notification_templates` ganha duas colunas: `intent TEXT CHECK (intent IN ('primeiro_acesso','retomada','atraso_plano','reflexao_pendente','reconhecimento','manual'))` e `tone TEXT` (livre, ex: "Leve e institucional", "Direto e urgente"). Ambas nullable inicialmente (backfill no AC5 preenche as existentes).
- [x] **AC5:** Backfill dos 5 templates seed existentes com `intent`/`tone`:
  - `never_accessed` → intent `primeiro_acesso`, tone "Leve e institucional"
  - `inactive_14d` → intent `retomada`, tone "Acolhedor, sem cobrança pesada"
  - `session_no_reflection` → intent `reflexao_pendente`, tone "Encorajador"
  - `top_performer_recognition` → intent `reconhecimento`, tone "Celebratório"
  - `announcement_generic` → intent `manual`, tone "Neutro institucional"
  - Usar `UPDATE notification_templates SET intent = ..., tone = ... WHERE key = ... AND intent IS NULL` (idempotente, não sobrescreve edição manual futura de um admin).
- [x] **AC6:** Novo template seed `behind_teaching_plan` (intent `atraso_plano`), inserido para todo tenant existente via o mesmo padrão `CROSS JOIN (VALUES ...) ON CONFLICT (tenant_id, key) DO NOTHING` usado no seed original. Conteúdo sugerido (ajustar tom conforme Seção 8 do report — mensagem mais direta que `inactive_14d`, pois atraso no plano é `atencao` (vermelho), pior que `sem_acesso` (âmbar) na hierarquia de `student-triage.ts`):
  - `title`: "Você está atrás do seu Plano de Ensino"
  - `body_inapp`: algo como "Olá, {{primeiro_nome}}! Seu progresso em {{curso}} está abaixo do esperado para o prazo do Plano de Ensino. Retome quando puder."
  - `channel_inapp: true`, `channel_email: true`
  - `variables: '["primeiro_nome","curso"]'::jsonb`
- [x] **AC7:** Novo template seed de reconhecimento explícito para o botão "No ritmo → Parabenizar" se ainda não existir cobertura suficiente em `top_performer_recognition` — reusar `top_performer_recognition` como o template de reconhecimento (NÃO criar um segundo template redundante; confirmar que seu `intent='reconhecimento'` do AC5 já cobre esse uso e documentar essa decisão no `Dev Agent Record` da story).
- [x] **AC8:** `NUDGE_TYPE_TEMPLATE_KEY` em `apps/web/src/lib/notifications/engine.ts` ganha a entrada `behind_teaching_plan: "behind_teaching_plan"`. O tipo `NudgeType` (em `apps/web/src/types/notifications.ts` — CONFIRMAR o path exato do arquivo de tipos ao implementar) ganha o literal `"behind_teaching_plan"`.
- [~] **AC9:** Migration roda limpa em ambiente local (`supabase db reset` / Docker) sem erro, e é idempotente (rodar duas vezes não falha nem duplica seeds). **Docker indisponível nesta sessão** — validação estrutural feita (construtos 100% idempotentes: `ADD COLUMN IF NOT EXISTS`, `DO $$` que consulta `pg_constraint` antes de recriar o CHECK, `UPDATE ... WHERE intent IS NULL`, `INSERT ... ON CONFLICT DO NOTHING`). Rodar `supabase db reset` (2x) quando Docker estiver ativo.
- [x] **AC10:** Nenhuma policy de RLS existente é enfraquecida. As novas colunas em `notifications`/`nudge_suggestions`/`notification_templates` NÃO alteram o resultado de nenhuma policy já definida em `20260604120000_engagement_engine.sql` / `20260630000000_engagement_rls_group_scope.sql`. Confirmado lendo as duas migrations: todas as policies são `FOR SELECT/INSERT/UPDATE/ALL` amplas sobre a tabela inteira (sem lista de colunas), então colunas novas herdam automaticamente a mesma visibilidade. Migration não toca em nenhuma policy.

## Tasks

- [x] 1. Ler `supabase/migrations/20260604120000_engagement_engine.sql` e `20260630000000_engagement_rls_group_scope.sql` na íntegra para confirmar nomes de constraint, índices e convenções de estilo.
- [x] 2. Criar `supabase/migrations/20260708120000_engagement_center_v2.sql` seguindo a task list de AC1 a AC8.
- [~] 3. Rodar a migration localmente e validar idempotência (rodar 2x). — Docker indisponível; validação estrutural (ver AC9).
- [x] 4. Atualizar `apps/web/src/types/notifications.ts` com o novo literal `NudgeType`, tipos `SenderIdentity`/`TemplateIntent`, e os campos novos nas interfaces `NotificationRow`/`Notification`/`NotificationTemplateRow`/`NotificationTemplate`/`NudgeSuggestionRow`/`NudgeSuggestion`.
- [x] 5. Atualizar `NUDGE_TYPE_TEMPLATE_KEY` em `apps/web/src/lib/notifications/engine.ts` (AC8).
- [x] 6. Rodar `pnpm --filter @eximia/web typecheck` — verde (corrigido o único consumidor afetado: `inbox.ts` `toNotification` ganhou `senderIdentity`/`senderName`).
- [x] 7. Documentar no Dev Agent Record da story a decisão do AC7 (reuso de `top_performer_recognition`).

## Complexidade & Riscos

- **Complexidade:** S (small). Migration aditiva + ajuste de tipos TS. Sem lógica de negócio.
- **Riscos:**
  - R1 (médio): CHECK constraint de `nudge_suggestions.type` pode não ter nome explícito no schema base — se for anônimo, `DROP CONSTRAINT IF EXISTS <nome>` não encontra o alvo. Mitigação: ler o nome real (ou usar `DO $$` que consulta `pg_constraint` antes de recriar), conforme AC2. Confirmar na Task 1.
  - R2 (baixo): adicionar coluna a `notifications` numa tabela grande pode ser lento em produção, mas `ADD COLUMN ... DEFAULT` de valor constante é metadata-only no Postgres 11+ (sem rewrite). Confirmar versão do Postgres do Supabase.
  - R3 (baixo): backfill de `intent`/`tone` com `WHERE intent IS NULL` é idempotente por design (AC5) — reruns não sobrescrevem edição manual.

## Nota de Escopo

A Regra Absoluta de Escopo (epic overview Seção 2) NÃO se aplica a esta story: ela não lê nem exibe dados de aluno escopados — só altera schema (colunas/CHECK/seeds) e tipos TS. A garantia de escopo é responsabilidade das stories que consomem estes dados (E2-E8). AC10 cobre o requisito relacionado que ESTA story tem: não enfraquecer nenhuma RLS existente.

## Dev Notes

- Nenhuma tabela é dropada ou renomeada nesta story — só ADD COLUMN e ajuste de CHECK. Migration 100% aditiva, seguindo o padrão do arquivo base.
- `manager_id` em `nudge_suggestions` é nullable por design (AC1): sugestões geradas antes desta wave, ou geradas em modo tenant-wide por um admin, não têm gestor dono. A lógica de E2 é quem decide QUANDO popular esse campo (sempre, a partir de E2 em diante — mas a coluna em si precisa aceitar `NULL` para não quebrar rows históricas).
- Não reescrever a lógica de `generateNudgeSuggestions`/`dispatchTeamNudge` nesta story — isso é E2. Esta story só prepara o schema e os tipos TypeScript.

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
# Confirmar comando de reset local antes de rodar (checar README.md/package.json raiz)
ls supabase/migrations/ | sort | tail -5   # confirmar timestamp sem colisão
pnpm --filter @eximia/web typecheck                # tipos batem com o schema novo
pnpm --filter @eximia/web lint
pnpm --filter @eximia/web test
```

## Dev Agent Record

**Agent:** Dex (@dev) · **Data:** 2026-07-08 · **Status:** InReview

### Decisões técnicas
- **AC2 (constraint anônima):** confirmado na Task 1 que o CHECK de `nudge_suggestions.type` no schema base é definido inline (anônimo). A migration usa um bloco `DO $$` que (a) checa se a constraint nomeada `nudge_suggestions_type_check_v2` já existe (idempotência), (b) se não, varre `pg_constraint` por qualquer CHECK que referencie `type` via `pg_get_constraintdef(...) ILIKE '%type%'`, dropa e (c) recria nomeada com o valor novo. Reruns não falham nem duplicam.
- **AC7 (reconhecimento):** DECISÃO — reusar `top_performer_recognition` como o único template de reconhecimento. O AC5 já seta `intent='reconhecimento'` nele, o que cobre tanto o cohort `top_performer` quanto o botão "No ritmo → Parabenizar" (E10). Nenhum segundo template redundante foi criado (foco por subtração).
- **AC3 (backfill sender):** rows históricas herdam `sender_identity='platform'` pelo `DEFAULT` da coluna (metadata-only no PG 11+, sem rewrite). Documentado no comentário da migration.
- **Tipos:** além do literal `behind_teaching_plan` em `NudgeType`, foram adicionados dois tipos nomeados novos (`SenderIdentity`, `TemplateIntent`) reusados por E2/E3, e os campos espelhados nas 6 interfaces (Row + domain de templates/notifications/suggestions). Único consumidor quebrado pelo typecheck: `inbox.ts` `toNotification` — corrigido (herda `platform`/`null` como fallback defensivo).
- **AC9 (idempotência local):** Docker/Supabase local indisponível nesta sessão. Validação estrutural: todos os construtos são idempotentes por design. `supabase db reset` (2x) pendente para quando o Docker estiver ativo.

### Verificação
- `pnpm --filter @eximia/web typecheck` → verde.
- `npx biome check` nos 3 arquivos TS tocados → clean (repo tem baseline pré-existente de lint fora de escopo).
- `pnpm --filter @eximia/web test` → 547 pass / 32 fail — as 32 falhas são baseline pré-existente idêntico ao tree limpo `f916d51` (drift de mock Supabase em rotas não relacionadas), zero regressão de E1.

### File List
- `supabase/migrations/20260708120000_engagement_center_v2.sql` (novo)
- `apps/web/src/types/notifications.ts` (modificado)
- `apps/web/src/lib/notifications/engine.ts` (modificado — só `NUDGE_TYPE_TEMPLATE_KEY`)
- `apps/web/src/lib/notifications/inbox.ts` (modificado — `toNotification` mapping)

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-08 | Story criada | River (SM Agent) |
| 2026-07-08 | PO: adicionadas seções Complexidade & Riscos e Nota de Escopo. Validada GO (9/10). | Pax (@po) |
| 2026-07-08 | Implementada: migration aditiva + tipos TS + NUDGE_TYPE_TEMPLATE_KEY. AC1-8,10 done, AC9 estrutural (Docker off). InReview. | Dex (@dev) |

## PO Validation: GO

**Verdict:** GO — **9/10** — 2026-07-08 — @po (Pax)

Fundação sólida e 100% aditiva. Schema real verificado no repo: `notification_templates.key` (não `type`), CHECK enum de `nudge_suggestions.type` exatamente `never_accessed|inactive|no_reflection|top_performer|announcement|custom`, `notifications.status` = `queued|sent|read|acted`, timestamp `20260708120000` sem colisão — todos os fatos das Dev Notes conferem contra as migrations reais. AC1-AC10 testáveis e idempotentes. Único risco aberto (R1: nome da constraint de CHECK pode ser anônimo) já mitigado por AC2. Dev frio consegue implementar só com a story + o arquivo base citado.
**Nota para devs:** confirmar na Task 1 o nome real da constraint `nudge_suggestions.type` antes de `DROP CONSTRAINT` — pode ser anônima.
