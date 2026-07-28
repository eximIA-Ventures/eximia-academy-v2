# CFG-0.1 — Correções da seção Usuários (ficha corretiva, Bloco A: A1+A2+A3)

> **Status:** Done (gates verdes, verificados pelo REGENTE) · **Tier:** 1 (código de aplicação, multi-arquivo) · **Tamanho:** M (3 correções — drift ORM, vínculo organizacional na ficha, reset de senha — multi-arquivo, sem migration) · **GO:** Hugo 2026-07-22 ("faz todas as correções" — Bloco A)
> **Fonte:** `docs/architecture/configuracoes-ficha-corretiva.md`
> **Migrations:** NENHUMA (colunas `users.reports_to` e `users.job_role_id` JÁ existem no banco — migrations `20260702222743` e `20260229000000`).

## Acceptance Criteria

### A1 — Drift Drizzle (packages/database)
- [x] `packages/database/src/schema/users.ts` ganha `reportsTo: uuid("reports_to")` (self-FK users.id, SET NULL) e `jobRoleId: uuid("job_role_id")` (FK job_roles.id, SET NULL), espelhando EXATAMENTE as colunas existentes no banco. Nenhuma migration nova.

### A2 — Vínculo organizacional na UI (apps/web)
- [x] No drawer/dialog de edição de usuário em `/admin/users`: campo **Superior imediato** (busca/select de usuários ativos do MESMO tenant, exclui o próprio usuário) e campo **Cargo** (select de job_roles do tenant, opção "Nenhum").
- [x] `PATCH /api/admin/users/[id]` aceita `reportsTo` e `jobRoleId` com validação: mesmo tenant, usuário não pode ser superior de si mesmo, valores nuláveis.

### A3.1 — Redefinir senha
- [x] `POST /api/admin/users/[id]/reset-password`: guard admin/super_admin do tenant, dispara email de recovery via Supabase Auth admin. Sem expor link na resposta.
- [x] Botão "Redefinir senha" na ficha do usuário com confirmação antes do disparo e feedback de sucesso/erro.

### A3.2 — Ponte para auditoria
- [x] Link "Ver ações deste usuário" na ficha, apontando `/admin/audit?user={id}` (página nasce em CFG-0.2).

### Auditoria das ações desta story
- [x] `apps/web/src/lib/audit.ts` ganha helper genérico `logAdminAction` (actor, action, targetType, targetId, details, tenant-scoped), reutilizando o padrão de `logSuperAdminAction`. Fail-open: erro de log nunca quebra o request.
- [x] Os handlers de users (PATCH role/status/reportsTo/jobRoleId, DELETE, POST convite, reset-password) gravam em `platform_audit_log` via helper.

## Gates (todos verdes antes de Done)
```bash
npx tsc --noEmit          # (pnpm typecheck no workspace tocado)
npx vitest run <escopo tocado>
npx biome check <arquivos tocados>
```

## Change Log
| Data | Evento |
|:--|:--|
| 2026-07-22 | Story criada pelo REGENTE a partir da ficha corretiva; despachada a terminais Maestri (Opus: A1 · Sonnet: A2/A3). |
