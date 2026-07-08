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

- [ ] **AC1:** `nudge_suggestions` ganha coluna `manager_id UUID REFERENCES users(id) ON DELETE SET NULL`. Nula para rows legadas (geradas antes desta migration, sem gestor específico — tenant-wide). Índice `idx_nudge_suggestions_manager ON nudge_suggestions(tenant_id, manager_id)`.
- [ ] **AC2:** `nudge_suggestions.type` CHECK constraint estendido para incluir `'behind_teaching_plan'`. Usar `ALTER TABLE ... DROP CONSTRAINT IF EXISTS ... ADD CONSTRAINT ...` (idempotente — nomear a constraint explicitamente se ainda não tiver nome, ou usar `DO $$ ... $$` para checar existência antes de recriar).
- [ ] **AC3:** `notifications` ganha duas colunas: `sender_identity TEXT NOT NULL DEFAULT 'platform' CHECK (sender_identity IN ('manager','platform'))` e `sender_name TEXT` (nome do gestor, nula quando `sender_identity='platform'`). Backfill: rows existentes recebem `sender_identity='platform'` (default já cobre isso automaticamente via `DEFAULT`, mas documentar explicitamente no comentário da migration que é a decisão correta — mensagens antigas nunca tiveram atribuição de gestor).
- [ ] **AC4:** `notification_templates` ganha duas colunas: `intent TEXT CHECK (intent IN ('primeiro_acesso','retomada','atraso_plano','reflexao_pendente','reconhecimento','manual'))` e `tone TEXT` (livre, ex: "Leve e institucional", "Direto e urgente"). Ambas nullable inicialmente (backfill no AC5 preenche as existentes).
- [ ] **AC5:** Backfill dos 5 templates seed existentes com `intent`/`tone`:
  - `never_accessed` → intent `primeiro_acesso`, tone "Leve e institucional"
  - `inactive_14d` → intent `retomada`, tone "Acolhedor, sem cobrança pesada"
  - `session_no_reflection` → intent `reflexao_pendente`, tone "Encorajador"
  - `top_performer_recognition` → intent `reconhecimento`, tone "Celebratório"
  - `announcement_generic` → intent `manual`, tone "Neutro institucional"
  - Usar `UPDATE notification_templates SET intent = ..., tone = ... WHERE key = ... AND intent IS NULL` (idempotente, não sobrescreve edição manual futura de um admin).
- [ ] **AC6:** Novo template seed `behind_teaching_plan` (intent `atraso_plano`), inserido para todo tenant existente via o mesmo padrão `CROSS JOIN (VALUES ...) ON CONFLICT (tenant_id, key) DO NOTHING` usado no seed original. Conteúdo sugerido (ajustar tom conforme Seção 8 do report — mensagem mais direta que `inactive_14d`, pois atraso no plano é `atencao` (vermelho), pior que `sem_acesso` (âmbar) na hierarquia de `student-triage.ts`):
  - `title`: "Você está atrás do seu Plano de Ensino"
  - `body_inapp`: algo como "Olá, {{primeiro_nome}}! Seu progresso em {{curso}} está abaixo do esperado para o prazo do Plano de Ensino. Retome quando puder."
  - `channel_inapp: true`, `channel_email: true`
  - `variables: '["primeiro_nome","curso"]'::jsonb`
- [ ] **AC7:** Novo template seed de reconhecimento explícito para o botão "No ritmo → Parabenizar" se ainda não existir cobertura suficiente em `top_performer_recognition` — reusar `top_performer_recognition` como o template de reconhecimento (NÃO criar um segundo template redundante; confirmar que seu `intent='reconhecimento'` do AC5 já cobre esse uso e documentar essa decisão no `Dev Agent Record` da story).
- [ ] **AC8:** `NUDGE_TYPE_TEMPLATE_KEY` em `apps/web/src/lib/notifications/engine.ts` ganha a entrada `behind_teaching_plan: "behind_teaching_plan"`. O tipo `NudgeType` (em `apps/web/src/types/notifications.ts` — CONFIRMAR o path exato do arquivo de tipos ao implementar) ganha o literal `"behind_teaching_plan"`.
- [ ] **AC9:** Migration roda limpa em ambiente local (`supabase db reset` ou equivalente do projeto — CONFIRMAR o comando exato em `package.json`/`README.md` da raiz do repo) sem erro, e é idempotente (rodar duas vezes não falha nem duplica seeds).
- [ ] **AC10:** Nenhuma policy de RLS existente é enfraquecida. As novas colunas em `notifications`/`nudge_suggestions`/`notification_templates` NÃO alteram o resultado de nenhuma policy já definida em `20260604120000_engagement_engine.sql` / `20260630000000_engagement_rls_group_scope.sql` (elas continuam sendo `SELECT *`/`INSERT`/`UPDATE` amplos sobre a tabela, então uma coluna nova automaticamente herda a mesma visibilidade — CONFIRMAR isso lendo as duas migrations antes de declarar este AC satisfeito).

## Tasks

- [ ] 1. Ler `supabase/migrations/20260604120000_engagement_engine.sql` e `20260630000000_engagement_rls_group_scope.sql` na íntegra para confirmar nomes de constraint, índices e convenções de estilo.
- [ ] 2. Criar `supabase/migrations/{timestamp}_engagement_center_v2.sql` seguindo a task list de AC1 a AC8.
- [ ] 3. Rodar a migration localmente e validar idempotência (rodar 2x).
- [ ] 4. Atualizar `apps/web/src/types/notifications.ts` (ou o path real do arquivo de tipos) com o novo literal `NudgeType` e os campos novos nas interfaces `NotificationRow`/`NotificationTemplateRow`/`NudgeSuggestionRow`.
- [ ] 5. Atualizar `NUDGE_TYPE_TEMPLATE_KEY` em `apps/web/src/lib/notifications/engine.ts` (AC8).
- [ ] 6. Rodar `pnpm --filter @eximia/web typecheck` para garantir que nenhum consumidor existente de `NudgeType`/`NotificationRow` quebrou com os campos novos.
- [ ] 7. Documentar no Dev Agent Record da story a decisão do AC7 (reuso de `top_performer_recognition`).

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

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-08 | Story criada | River (SM Agent) |
| 2026-07-08 | PO: adicionadas seções Complexidade & Riscos e Nota de Escopo. Validada GO (9/10). | Pax (@po) |

## PO Validation: GO

**Verdict:** GO — **9/10** — 2026-07-08 — @po (Pax)

Fundação sólida e 100% aditiva. Schema real verificado no repo: `notification_templates.key` (não `type`), CHECK enum de `nudge_suggestions.type` exatamente `never_accessed|inactive|no_reflection|top_performer|announcement|custom`, `notifications.status` = `queued|sent|read|acted`, timestamp `20260708120000` sem colisão — todos os fatos das Dev Notes conferem contra as migrations reais. AC1-AC10 testáveis e idempotentes. Único risco aberto (R1: nome da constraint de CHECK pode ser anônimo) já mitigado por AC2. Dev frio consegue implementar só com a story + o arquivo base citado.
**Nota para devs:** confirmar na Task 1 o nome real da constraint `nudge_suggestions.type` antes de `DROP CONSTRAINT` — pode ser anônima.
