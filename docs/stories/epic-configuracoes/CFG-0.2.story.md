# CFG-0.2 — Auditoria viva (ficha corretiva, Bloco A: A4 + A3.2)

> **Status:** Done (gates verdes, verificados pelo REGENTE)
> **Tier:** 1 · **Tamanho:** M (instrumentação de auditoria + UI de página + link por pessoa, multi-arquivo, sem migration) · **GO:** Hugo 2026-07-22 (Bloco A)
> **Migrations:** NENHUMA (`platform_audit_log` existe com índices desde a criação).

## Acceptance Criteria

### Instrumentação (gravar de verdade)
- [x] Handlers admin passam a gravar em `platform_audit_log` via `logAdminAction`: áreas (create/update/delete, vínculos), api-keys (create/rotate/revoke), webhooks (create/delete), settings do tenant (branding/whitelabel/sessionTimeout), SSO (configurar/remover), integrações (keys/conexões). Fail-open sempre.
- [x] NÃO tocar nos handlers de users (já instrumentados em CFG-0.1) nem em rotas fora de `/api/admin/*` e `/api/integrations/*`.

### API de consulta
- [x] `GET /api/admin/audit-log`: guard admin/super_admin, escopo do tenant, filtros `period` (1/7/30/90 dias), `type` (targetType), `user` (ator OU alvo), paginação. Ordenação desc por data.
- [x] Export CSV do mesmo filtro (`?format=csv` ou endpoint irmão).

### UI
- [x] Página `/admin/audit` (grupo `(platform)`, guard SSR admin/super_admin como as demais páginas admin): filtros período/tipo/pessoa, tabela (Ação com detalhe, Autor, Quando, IP se disponível em details), estado vazio, botão Exportar CSV. Estrutura de painel fiel à seção Auditoria do mockup aprovado (função, não pixel).
- [x] Query param `?user={id}` pré-aplica o filtro de pessoa (destino do link "Ver ações deste usuário" de CFG-0.1).
- [x] `middleware.ts`: `/admin/audit` entra na lista de bloqueio de instructor (mesma régua de users/settings/api-keys/webhooks).

## Gates
```bash
npx tsc --noEmit
npx vitest run <escopo tocado>
npx biome check <arquivos tocados>
```

## Change Log
| Data | Evento |
|:--|:--|
| 2026-07-22 | Story criada pelo REGENTE a partir da ficha corretiva (A4 + ponte A3.2). |
