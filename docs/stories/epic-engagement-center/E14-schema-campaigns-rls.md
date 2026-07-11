# E14: Schema `campaigns` + `campaign_id` + RLS

**Epic:** [00-EPIC-OVERVIEW](./00-EPIC-OVERVIEW.md)
**Status:** Draft
**Implementa:** [E13 — Proposta de Redesign da Aba Campanhas](./E13-campanhas-redesign-proposta.md) §2.3 (Opção B), §3.3, decisões **D1**, **D2**, **D5**
**Depende de:** E1 (migration base do epic — schema de `notifications` existente)
**Bloqueia:** E15, E16

---

## Story

**As a** engine de engajamento,
**I want** uma tabela `campaigns` leve que amarre as N notificações de um mesmo disparo e guarde o ciclo de vida do lote (janela de medição, aberta/encerrada), mais um `campaign_id` no `context` de cada notificação,
**so that** a campanha exista como entidade observável com estado de encerramento — o único pedaço de infraestrutura nova de todo o redesign E13 (§7).

## Contexto (Dev Notes)

Ler [E13 §2.3](./E13-campanhas-redesign-proposta.md) (anatomia do objeto Campanha) e [E13 §3.3](./E13-campanhas-redesign-proposta.md) (estado de encerramento) antes de começar. Ler também a Seção 5 do [00-EPIC-OVERVIEW](./00-EPIC-OVERVIEW.md) (fatos verificados do schema real) e o padrão de migration de [E1](./E1-migration-engagement-v2.md).

**A tabela `campaigns` NÃO existe hoje.** Verificado (2026-07-10) por @po: `grep -rn "campaign_id" supabase/migrations/` retorna zero ocorrências; `notifications` não tem coluna `campaign_id`. Esta é a **única infra nova** de todo o E13 (E13 §7, tabela de reconvergência: "Modelo de dados da campanha — genuinamente novo"). Tudo o mais reusa primitivos existentes.

- **Migration base do schema de `notifications`:** `supabase/migrations/20260604120000_engagement_engine.sql` (na RAIZ do repo, não em `apps/web/`). Ali estão `notifications` (com `context jsonb`, `returned_at`, `read_at`, `acted_at`, `sent_at`, `status` CHECK `queued|sent|read|acted`), suas RLS, e o estilo de comentários `COMMENT ON`.
- **RLS de referência a espelhar:** as policies de `notifications` em `20260604120000_engagement_engine.sql` + o hardening por grupo de `20260630000000_engagement_rls_group_scope.sql`. A tabela `campaigns` deve espelhar o MESMO padrão de escopo (tenant + criador/staff), NÃO afrouxar (E13 §6, restrição inegociável 4).
- **Convenção de migration do repo (de E1):** arquivo `supabase/migrations/{YYYYMMDDHHMMSS}_{nome}.sql`, idempotente (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS` + recriar, `CREATE INDEX IF NOT EXISTS`), dentro de `BEGIN; ... COMMIT;`, com `COMMENT ON COLUMN` documentando cada campo.
- **Timestamp posterior à última migration.** Rodar `ls supabase/migrations/ | sort | tail -5` ANTES de criar o arquivo para escolher um timestamp sem colisão (a última hoje é `20260703010000` + o `20260708120000_engagement_center_v2.sql` de E1; usar algo tipo `20260710120000_campaigns.sql`, confirmar).
- **A tabela `campaigns` NÃO guarda mensagem nem destinatário** (E13 §2.3): isso continua 100% em `notifications`, re-scopado como hoje. `campaigns` só guarda o *cabeçalho* do lote e seu ciclo de vida.
- **`window_end` default = 7 dias** (decisão **D2** aprovada pelo Hugo). O cálculo pode ser `created_at + interval '7 days'` no default da coluna ou computado no INSERT pela engine (E15) — decidir e documentar; a coluna em si só precisa aceitar o valor.
- **`status` da campanha = `open|closed`** (decisão **D5**: encerramento automático via cron E manual pelo gestor). A coluna nasce `open`; E16 implementa as duas transições.

## Acceptance Criteria

- [ ] **AC1:** Nova tabela `campaigns` criada com, no mínimo, as colunas de E13 §2.3: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `tenant_id UUID NOT NULL REFERENCES tenants(id)` (confirmar nome real da tabela de tenants no schema base), `created_by UUID REFERENCES users(id) ON DELETE SET NULL`, `segment_type TEXT` (o estado do semáforo de origem: `atencao|sem_acesso|no_ritmo` — ver E13 §4, alinhar aos valores de `StudentTriagem` de `student-triage.ts`), `focus_node TEXT` (o recorte/`?focus=` de origem, nullable), `window_start TIMESTAMPTZ NOT NULL DEFAULT now()`, `window_end TIMESTAMPTZ NOT NULL` (default 7d — D2), `status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed'))`, `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`. Nome opcional de campanha (`name TEXT`, nullable) permitido mas não obrigatório.
- [ ] **AC2:** RLS habilitada em `campaigns` espelhando o padrão de `notifications`: leitura/escrita escopada por `tenant_id` + papel (staff/criador), SEM afrouxar nenhuma policy existente. Nenhuma policy de outra tabela é tocada (defesa: E13 §6.4, o semáforo/escopo continua server-side; a RLS de `campaigns` é a camada de banco, não substitui o re-scope de aplicação). Documentar no comentário da migration que `campaigns` não é a fronteira de escopo de destinatários (isso é `notifications` + o re-scope de E15).
- [ ] **AC3:** Índices: `idx_campaigns_tenant ON campaigns(tenant_id)`, `idx_campaigns_status ON campaigns(tenant_id, status)` (para a query "campanhas abertas do recorte"), `idx_campaigns_window_end ON campaigns(status, window_end)` (para o cron de encerramento de E16 varrer `open` com `window_end` vencido).
- [ ] **AC4:** `campaign_id` passa a viver no `context jsonb` de cada `notification` do lote (E13 §2.3, "gravar `campaign_id` dentro do `context`"). Esta story NÃO adiciona coluna `campaign_id` a `notifications` — o `context jsonb` já existe e é o lar correto (E13 §5.3, "gravá-lo no `context` de cada notificação"). Adicionar um índice funcional/GIN sobre `context->>'campaign_id'` SE o padrão de índice do repo permitir e a query de agregação de E16 se beneficiar; caso contrário, documentar que a agregação filtra por `context->>'campaign_id'` sem índice dedicado nesta wave e por quê. Decidir e documentar no Dev Agent Record.
- [ ] **AC5:** Migration 100% aditiva e idempotente: rodar duas vezes não falha nem duplica (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS`+recriar). Nenhuma tabela existente é dropada, renomeada ou tem coluna removida. Nenhuma RLS existente é enfraquecida (mesma disciplina de AC10 de E1).
- [ ] **AC6:** Tipos TypeScript: criar/estender o arquivo de tipos de engajamento (`apps/web/src/types/notifications.ts` ou irmão — CONFIRMAR o path exato ao implementar, mesmo arquivo que E1 tocou) com uma interface `Campaign`/`CampaignRow` refletindo as colunas de AC1 e um tipo `CampaignStatus = 'open' | 'closed'`. `pnpm --filter @eximia/web typecheck` verde.

## Tasks

- [ ] 1. Ler `20260604120000_engagement_engine.sql` (tabela `notifications` + suas RLS) e `20260630000000_engagement_rls_group_scope.sql` na íntegra; confirmar nome real da tabela de tenants e das tabelas referenciadas por FK.
- [ ] 2. `ls supabase/migrations/ | sort | tail -5` — escolher timestamp sem colisão.
- [ ] 3. Criar a migration `supabase/migrations/{ts}_campaigns.sql` com a tabela (AC1), RLS (AC2), índices (AC3) e a decisão de `campaign_id` no `context` (AC4).
- [ ] 4. Adicionar tipos TS `Campaign`/`CampaignRow`/`CampaignStatus` (AC6).
- [ ] 5. `pnpm --filter @eximia/web typecheck` verde.
- [ ] 6. Validar idempotência (`supabase db reset` 2x SE Docker disponível; senão validação estrutural documentada, como E1 AC9).

## Complexidade & Riscos

- **Complexidade:** S (small). Uma tabela ~9 colunas + RLS espelhada + índices + tipos TS. Sem lógica de negócio (isso é E15/E16).
- **Riscos:**
  - R1 (médio): RLS de `campaigns` mal-espelhada poderia deixar um gestor ver campanhas de outro tenant/time. Mitigação: AC2 exige espelhar o padrão de `notifications` e um teste de escopo em E15/E17. A fronteira de escopo de *destinatários* NÃO é `campaigns` (é `notifications`+re-scope), então o raio de um erro aqui é o cabeçalho da campanha, não a lista de alunos — ainda assim, tratar como escopado.
  - R2 (baixo): índice GIN sobre `context->>'campaign_id'` pode ser desnecessário se o volume for baixo. Mitigação: AC4 permite adiar com justificativa.
  - R3 (baixo): FK para tabela de tenants/users com nome divergente do assumido. Mitigação: Task 1 confirma nomes reais antes de escrever a FK.

## Nota de Escopo

A Regra Absoluta de Escopo (epic overview Seção 2) aplica-se PARCIALMENTE: esta story não lê nem exibe dados de aluno, só cria schema. Mas a RLS de `campaigns` (AC2) é a camada de banco que sustenta o escopo do *cabeçalho* da campanha; a fronteira de escopo dos *destinatários* permanece em `notifications` + o re-scope server-side de E15 (E13 §6). AC5 cobre o requisito duro desta story: não enfraquecer nenhuma RLS existente.

## Restrições de Segurança Herdadas (E13 §6 — INEGOCIÁVEIS, não reabrir)

Esta story não toca a trava AUTH→VALIDATE→RE-SCOPE→DISPATCH (isso é E15). Ela só adiciona a tabela de cabeçalho. As 5 restrições de E13 §6 permanecem responsabilidade de E15 (re-scope no confirm) e são citadas aqui só para deixar claro que o schema novo NÃO cria um caminho paralelo de escopo.

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
ls supabase/migrations/ | sort | tail -5      # confirmar timestamp sem colisão
grep -rn "campaign_id\|CREATE TABLE.*campaigns" supabase/migrations/   # a nova migration deve aparecer, e só ela
pnpm --filter @eximia/web typecheck            # tipos Campaign batem
pnpm --filter @eximia/web lint
# SE Docker disponível: supabase db reset (2x) — idempotência
```

## Critério de Saída (objetivo)

- Existe uma migration nova em `supabase/migrations/` que cria `campaigns` (tabela + RLS + índices) e documenta `campaign_id` no `context` de `notifications`, 100% aditiva e idempotente por leitura.
- `apps/web/src/types/*` expõe `Campaign`/`CampaignRow`/`CampaignStatus`.
- `pnpm --filter @eximia/web typecheck` verde.
- `grep` confirma que nenhuma RLS existente foi alterada (a migration só faz `CREATE`/`ADD`, nunca `ALTER POLICY`/`DROP POLICY` de policy de OUTRA tabela).

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-10 | Story criada a partir do E13 (§2.3 Opção B, D1/D2/D5). Validada como base de implementação. | Pax (@po) |
