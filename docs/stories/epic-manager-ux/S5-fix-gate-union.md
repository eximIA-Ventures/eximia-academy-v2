# EPIC-MANAGER-UX / S5, Fix de seguranca: gate e escopo do engajamento por union de chapeus

> Status: Draft, PRONTA PARA REVISAO, NAO IMPLEMENTAR ate GO de Hugo.
> Executor: @dev · Tipo: fix · Branch: feat/engajamento-gestor-m1

## User Story

Como plataforma multi-tenant com usuarios multi-chapeu (Rinaldo detem Aluno, Instrutor e Gestor ao mesmo tempo), o gate e o escopo de disparo do engajamento (nudges, campanhas, sugestoes, notificacoes) DEVEM ser decididos pela uniao real de chapeus do chamador (`user_roles`, via `hasRole`), nunca pela coluna singular `profile.role`. Hoje `resolveCallerStudentScope` e as cinco rotas de disparo leem `profile.role` singular. Isso abre dois modos de falha reais: (a) um usuario cujo singular e `admin` mas que na pratica opera como gestor recebe alcance TENANT-WIDE (vazamento: notifica alunos fora do time dele), e (b) um usuario cujo singular NAO e `manager`/`instructor`/`admin` (por exemplo singular `student` com chapeu `manager` real) e barrado ou fail-closed indevidamente. S5 e a story de SEGURANCA: migra a assinatura de `resolveCallerStudentScope` para `roles: string[]`, migra as CINCO rotas de disparo e o gate de admissao de `analytics/manager/nudge` para a uniao de chapeus (`hasRole`/`hasAnyRole` + politica de precedencia identica ao `aggregate/route.ts`), e produz a lista autoritativa de todo `profile.role` lido em decisao de escopo/gate no engajamento e no SSR de analytics, com AC de grep residual = 0 (coordenado com S3, dona do SSR). S5 LANDS PRIMEIRO; S4 e S3 consomem o helper de S5.

## Estado atual (recon arquivo:linha)

- `apps/web/src/lib/area-context.ts:307-342`, `resolveCallerStudentScope(db, tenantId, userId, role: string)`. Decide por `role === "admin" || role === "super_admin"` (null, tenant-wide), `role === "manager"` (subtree via `getManagedTeamStudentIds({includeSubtree:true})`), `role === "instructor"` (uniao das areas), senao `[]` (fail-closed). O 4o parametro `role: string` e a raiz do bug: recebe o singular `profile.role`.
- `apps/web/src/app/api/admin/engagement/suggestions/generate/route.ts:17` gate `["admin","manager","instructor"].includes(profile.role)`; `:32` `resolveCallerStudentScope(supabase, tenantId, user.id, profile.role)`. Usa `getAuthProfile()` (tem `roles`).
- `apps/web/src/app/api/admin/engagement/suggestions/[id]/route.ts:21` gate singular; `:42` `resolveCallerStudentScope(..., profile.role)`. Usa `getAuthProfile()`.
- `apps/web/src/app/api/notifications/nudge/route.ts:22` gate `["instructor","manager","admin","super_admin"].includes(profile.role)`; `:43` `resolveCallerStudentScope(supabase, profile.tenant_id, user.id, profile.role)`. NAO usa `getAuthProfile()`, faz fetch inline `from("users").select("role, full_name, tenant_id")` (linha 17-21), SEM embed `user_roles`, entao `roles` NAO esta disponivel aqui.
- `apps/web/src/app/api/admin/notifications/route.ts:96` (POST, quinta rota antes esquecida), `resolveCallerStudentScope(supabase, profile.tenant_id, user.id, profile.role)`; gate `:53` singular; fetch inline `from("users").select("role, tenant_id, full_name")` (linha 47-51), SEM `user_roles`. Escape de seguranca real E build-breaker da troca de assinatura.
- `apps/web/src/app/api/admin/engagement/campaign/route.ts:45` gate `["admin","manager"].includes(profile.role)`; `:95` trava `if (profile.role === "manager")` re-resolve time via `getManagedTeamStudentIds({includeSubtree:true})` e intersecta. Usa `getAuthProfile()` (tem `roles`). NAO chama `resolveCallerStudentScope` (usa `getManagedTeamStudentIds` direto).
- `apps/web/src/app/api/analytics/manager/nudge/route.ts:48` gate de admissao `if (profile.role !== "manager") 403` (SINGULAR); `:107` trava `getManagedTeamStudentIds({includeSubtree:true})`. Usa `getAuthProfile()` (tem `roles`). Um multi-chapeu cujo singular != `manager` mas que detem o chapeu `manager` e barrado indevidamente.
- `apps/web/src/lib/notifications/engine.ts:302-316` (`generateNudgeSuggestions(tenantId, allowedStudentIds?)`), `:464-470,525-526` (`approveSuggestion({..., allowedStudentIds})`), `:674` (`dispatchTeamNudge`). O engine ja aceita `allowedStudentIds?: string[] | null` e intersecta quando nao-null, contrato do engine NAO muda.
- `apps/web/src/lib/role-helpers.ts:12-18`, `hasRole(profile:{roles:string[]}, role)` e `hasAnyRole(profile, roles)`, puros, sobre a uniao. JA EXISTEM. S5 os consome, nao os redefine.
- `apps/web/src/lib/auth.ts:31-72`, `getAuthProfile()` ja retorna `roles: string[]` (uniao de `user_roles`, fallback `[profile.role]` pre-backfill). As 4 rotas que usam `getAuthProfile()` ja tem `roles` de graca.
- `apps/web/src/app/api/analytics/aggregate/route.ts:726-747`, POLITICA CANONICA a espelhar: monta `callerRoles` de `user_roles` (fallback singular so quando join vazio); `isTenantWideRole = admin || super_admin`; `isManagerScoped = !isTenantWideRole && manager`. Precedencia super_admin/admin > manager. `resolveCallerStudentScope` DEVE ter a mesma semantica de precedencia.
- `apps/web/src/app/(platform)/analytics/page.tsx:61` gate de admissao SSR singular; `:116` `if (profile.role === "manager")` (SINGULAR) decide escopo, divergente do `aggregate/route.ts` que ja usa uniao (`roles` ja esta desestruturado de `getAuthProfile()` na linha 58, e usado no gate LGPD linha 72, mas NAO no escopo linha 116). PROPRIEDADE DE S3 (D3); S5 apenas cataloga.
- `supabase/migrations/20260630000000_engagement_rls_group_scope.sql:76-135`, anel RLS de escrita gateia por `auth_user_role() = 'admin'` / `= 'manager'` (SINGULAR). `supabase/migrations/20260207000000_initial_schema.sql:165-167` e `20260518100000_fix_leader_rls_recursion.sql:22-30` definem `auth_user_role() RETURNS TEXT` = `SELECT role FROM users WHERE id=auth.uid()` (singular). Confirma D8: o anel DB e singular, nao pega o escape multi-chapeu.
- Rotas com `createServiceClient` (RLS bypass): `campaign/route.ts:59`, `admin/notifications/route.ts:105`, e o engine chamado por `suggestions/generate` e `suggestions/[id]` escreve por service client. Nessas, o anel RLS nem participa, o check de uniao na app-layer e o UNICO gate.

## Escopo decidido

1. **Migrar a assinatura de `resolveCallerStudentScope`** de `(db, tenantId, userId, role: string)` para `(db, tenantId, userId, roles: string[])`. A logica interna passa a decidir por precedencia da uniao (identica ao `aggregate/route.ts:743-745`): admin/super_admin > manager > instructor > fail-closed.
2. **Migrar o gate + trava por uniao (`hasRole`/`hasAnyRole`) em TODAS as 5 rotas de disparo**: `campaign/route.ts`, `suggestions/generate/route.ts`, `suggestions/[id]/route.ts`, `notifications/nudge/route.ts`, `admin/notifications/route.ts` (POST, linha 96).
3. **Migrar o gate de admissao de `analytics/manager/nudge/route.ts:48`** de `profile.role !== "manager"` singular para `hasRole(roles, "manager")` (uniao). A trava de escopo (`getManagedTeamStudentIds`) ja e correta e nao muda.
4. Para as duas rotas que NAO usam `getAuthProfile()` (`notifications/nudge`, `admin/notifications`), garantir que `roles` esteja disponivel adicionando o embed `user_roles!user_roles_user_id_fkey(role)` ao fetch inline e derivando `roles` (mesmo recipe do `getAuthProfile`). Decisao NA SPEC = adicionar o embed inline, minimizando blast radius (vs trocar toda a rota para `getAuthProfile`).
5. **Produzir a lista autoritativa** de todo `profile.role` lido em decisao de escopo/gate no engajamento + SSR de analytics, e um **AC de grep residual = 0** (coordenado com S3, que remove os do SSR).
6. Testes red-first: um teste VERMELHO que reproduz o vazamento multi-chapeu (`roles:[instructor,manager]`, `profile.role:admin`) ANTES do fix, provando alcance tenant-wide indevido; depois verde com escopo confinado ao subtree do gestor.

## Fora de escopo

- **Migrar `auth_user_role()` do DB para uniao** (D8): FORA DE ESCOPO, apenas SINALIZAR. O anel DB continua singular; nao representar RLS como defense-in-depth para ESTE bug (o check de uniao na app e o unico gate real nas rotas service-client).
- **S4 (UX/dados do engajamento)**: escopo de LEITURA da pagina (roster, historico, sugestoes, audiences, eficacia), subtracao de UI (remover audiencia ampla/"todos"), escopo do corpo do `history/route.ts`. S4 CONSOME o helper de uniao de S5, NUNCA re-migra um gate que S5 possui. S4 depende de S5.
- **S3 (nav-move + SSR union)**: mover Analytics para a chave `manager` do modulo `admin` (D2), migrar `analytics/page.tsx:116` para uniao (D3), `UnitComparison` oculto na lente Gestor (D7). S3 possui `page.tsx`. S5 apenas cataloga os `profile.role` do SSR no grep autoritativo; a REMOCAO deles e de S3.
- **S1 (lente de papel / Header)** e **S2 (candidate pool)**: nao tocados por S5.
- O contrato do engine (`allowedStudentIds`) NAO muda, S5 so muda quem produz o valor passado.

## Mudancas de codigo (POR ARQUIVO, com assinatura/shape)

### 1. `apps/web/src/lib/area-context.ts` (DONO: S5)

Migrar a assinatura e a logica de `resolveCallerStudentScope`.

Assinatura ANTES:
```ts
export async function resolveCallerStudentScope(
  db: SupabaseClient<any, "public", any>,
  tenantId: string,
  userId: string,
  role: string,
): Promise<string[] | null>
```

Assinatura DEPOIS:
```ts
export async function resolveCallerStudentScope(
  db: SupabaseClient<any, "public", any>,
  tenantId: string,
  userId: string,
  roles: string[],                    // UNIAO de chapeus (user_roles), NAO o singular
): Promise<string[] | null>
```

Corpo (precedencia identica ao `aggregate/route.ts:743-745`, semantica preservada):
```ts
  const roleSet = new Set(roles)
  // admin / super_admin -> tenant-wide (null). Precedencia mais alta.
  if (roleSet.has("admin") || roleSet.has("super_admin")) return null
  // manager (sem admin/super_admin) -> subtree proprio; db DEVE ser o client
  // autenticado do gestor (includeSubtree le auth.uid()).
  if (roleSet.has("manager")) {
    return (await getManagedTeamStudentIds(db, tenantId, userId, { includeSubtree: true })) ?? []
  }
  // instructor -> uniao das areas atribuidas (composicao do primitivo UNIDADE).
  if (roleSet.has("instructor")) {
    const areaIds = await getInstructorAreaIds(userId, tenantId)
    if (areaIds.length === 0) return []
    const perArea = await Promise.all(areaIds.map((a) => getAreaStudentIds(db, tenantId, a)))
    const union = new Set<string>()
    for (const ids of perArea) for (const id of ids ?? []) union.add(id)
    return [...union]
  }
  // qualquer outro chapeu -> fail-closed (zero destinatarios, NUNCA tenant-wide).
  return []
```
Atualizar o JSDoc (`:284-306`) para descrever a politica por UNIAO e a precedencia. NAO introduzir novo primitivo de escopo (No-Invention), apenas troca a fonte de verdade do papel.

### 2. `apps/web/src/app/api/admin/engagement/suggestions/generate/route.ts` (DONO: S5)

Rota ja usa `getAuthProfile()`. Adicionar `roles` a desestruturacao e migrar gate + call-site.
- `const { user, profile, roles, supabase } = await getAuthProfile()`
- Import: `import { hasAnyRole } from "@/lib/role-helpers"`
- Gate `:17`: de `if (!["admin","manager","instructor"].includes(profile.role))` para `if (!hasAnyRole({ roles }, ["admin","manager","instructor","super_admin"]))`.
- Call-site `:32`: `resolveCallerStudentScope(supabase, tenantId, user.id, roles)`.

### 3. `apps/web/src/app/api/admin/engagement/suggestions/[id]/route.ts` (DONO: S5)

Ja usa `getAuthProfile()`. Mesma migracao.
- `const { user, profile, roles, supabase } = await getAuthProfile()`
- Import `hasAnyRole`.
- Gate `:21`: `if (!hasAnyRole({ roles }, ["admin","manager","instructor","super_admin"]))`.
- Call-site `:42`: `resolveCallerStudentScope(supabase, tenantId, user.id, roles)`.

### 4. `apps/web/src/app/api/admin/engagement/campaign/route.ts` (DONO: S5)

Ja usa `getAuthProfile()`. NAO chama `resolveCallerStudentScope`, mas o gate e a trava leem singular.
- `const { user, profile, roles, supabase } = await getAuthProfile()`
- Import `hasRole, hasAnyRole`.
- Gate `:45`: de `if (!["admin","manager"].includes(profile.role))` para `if (!hasAnyRole({ roles }, ["admin","manager","super_admin"]))`.
- Trava `:95`: de `if (profile.role === "manager")` para `if (!hasRole({ roles }, "admin") && !hasRole({ roles }, "super_admin") && hasRole({ roles }, "manager"))`. Isto preserva a precedencia: um admin+manager mantem alcance tenant-wide (a trava de time NAO dispara), enquanto um manager-puro e confinado. Comentario atualizado para citar a precedencia de uniao.

### 5. `apps/web/src/app/api/analytics/manager/nudge/route.ts` (DONO: S5)

Ja usa `getAuthProfile()`. So o gate de admissao muda; a trava de escopo (`getManagedTeamStudentIds`) permanece.
- `const { user, profile, roles, supabase } = await getAuthProfile()`
- Import `hasRole`.
- Gate `:48`: de `if (profile.role !== "manager")` para `if (!hasRole({ roles }, "manager"))`. Isto admite um multi-chapeu com o chapeu manager real (cujo singular != manager). A trava `:106-109` permanece = piso de seguranca mais amplo do gestor. Atualizar o comentario do cabecalho `:6` ("403 unless role === 'manager'") para "403 unless hasRole(roles,'manager')".

### 6. `apps/web/src/app/api/notifications/nudge/route.ts` (DONO: S5)

NAO usa `getAuthProfile()`, fetch inline sem `user_roles`. Adicionar o embed e derivar `roles`.
- Fetch `:17-21`: mudar o select para `.select("role, full_name, tenant_id, user_roles!user_roles_user_id_fkey(role)")`.
- Derivar apos o fetch (mesmo recipe de `auth.ts:60-63`):
```ts
  const rawRoles = (profile as { user_roles?: { role: string }[] } | null)?.user_roles ?? []
  const roles: string[] = rawRoles.length > 0 ? rawRoles.map((r) => r.role) : profile?.role ? [profile.role] : []
```
- Import `hasAnyRole`.
- Gate `:22`: de `["instructor","manager","admin","super_admin"].includes(profile.role)` para `!hasAnyRole({ roles }, ["instructor","manager","admin","super_admin"])`.
- Call-site `:43`: `resolveCallerStudentScope(supabase, profile.tenant_id, user.id, roles)`.

### 7. `apps/web/src/app/api/admin/notifications/route.ts` (DONO: S5), QUINTA rota, antes esquecida

POST `:40-103` faz fetch inline sem `user_roles`; GET `:10-37` tambem gateia singular (`:23`) mas NAO chama `resolveCallerStudentScope`. S5 migra AMBOS os gates e o call-site do POST.
- POST fetch `:47-51`: adicionar embed `user_roles!user_roles_user_id_fkey(role)` e derivar `roles` (mesmo recipe do item 6).
- Import `hasAnyRole`.
- POST gate `:53`: `!hasAnyRole({ roles }, ["admin","manager","instructor","super_admin"])`.
- POST call-site `:96`: `resolveCallerStudentScope(supabase, profile.tenant_id, user.id, roles)`.
- GET fetch `:17-21` e gate `:23`: adicionar embed + derivar `roles` + `!hasAnyRole({ roles }, ["admin","manager","instructor","super_admin"])` (paridade de gate; o GET so lista, sem escopo de disparo, mas o gate deve ser consistente para nao barrar multi-chapeu).

### NAO tocar nesta story (contrato compartilhado)

- `apps/web/src/app/(platform)/analytics/page.tsx:116` (SSR de escopo), PROPRIEDADE DE S3 (D3). S5 apenas cataloga no grep autoritativo.
- `apps/web/src/lib/notifications/engine.ts`, contrato `allowedStudentIds` intacto.
- `apps/web/src/app/api/admin/engagement/history/route.ts`, `.../suggestions/route.ts`, `.../templates/route.ts`, `analytics/manager/route.ts`, gates de LEITURA; propriedade de S4 (escopo de leitura). S5 nao migra gates de leitura (evita invadir S4). O grep autoritativo os LISTA como "leitura, S4".

## Dados-RLS-Seguranca

- **Fonte de verdade do papel:** passa de `users.role` (coluna singular) para a uniao `user_roles(role)` via `hasRole`/`hasAnyRole`. Nenhum novo objeto de banco.
- **RLS (D8), corrigir a alegacao de "anel RLS":** as rotas de disparo que escrevem por `createServiceClient` (campaign, admin/notifications POST, e o engine acionado por suggestions/generate e suggestions/[id]) BYPASSAM o RLS por design. Nessas, o check de uniao na app-layer e o UNICO gate, NAO existe anel RLS de defense-in-depth para elas. O anel de escrita `20260630000000_engagement_rls_group_scope.sql:76-135` gateia por `auth_user_role()` (SINGULAR, `20260207:165-167` / `20260518100000:22-30`), entao mesmo nas rotas que usassem o client autenticado, o anel NAO pega o escape multi-chapeu (um singular `admin` + chapeu manager passa `auth_user_role()='admin'` tenant-wide). Conclusao: para este bug, a app-layer e a unica trava efetiva; nao ha rede DB por baixo.
- **Fora de escopo, SINALIZADO:** migrar `auth_user_role()` para retornar/considerar a uniao (`user_roles`) fecharia o anel DB, mas e trabalho de banco com blast radius amplo (todas as policies que chamam `auth_user_role()`), e fica para uma story de RLS dedicada. S5 registra o risco residual: um gestor tecnicamente sofisticado batendo PostgREST direto com o proprio JWT ainda esbarra no anel singular, mas isso ja e o comportamento atual e nao piora com S5.
- **Fail-closed preservado:** `resolveCallerStudentScope` continua retornando `[]` (nunca tenant-wide) para qualquer chapeu que nao seja admin/super_admin/manager/instructor. `null` (tenant-wide) so para admin/super_admin.
- **LGPD:** S5 nao toca conteudo bruto; apenas gate/escopo de disparo. O gate de conteudo bruto do SSR (`page.tsx:71-72`) ja usa uniao e nao muda.

## Acceptance Criteria (numerados)

1. `resolveCallerStudentScope` tem assinatura `(db, tenantId, userId, roles: string[])`; o 4o parametro `role: string` foi removido; a decisao usa `Set(roles)` com precedencia admin/super_admin > manager > instructor > fail-closed, byte-equivalente a `aggregate/route.ts:743-745`.
2. As 5 rotas de disparo (`campaign`, `suggestions/generate`, `suggestions/[id]`, `notifications/nudge`, `admin/notifications` POST) gateiam admissao por `hasAnyRole({roles}, [...])` e nao por `profile.role`; as que chamam `resolveCallerStudentScope` passam `roles` (nao `profile.role`).
3. `campaign/route.ts:95` dispara a trava de time apenas para gestor SEM chapeu admin/super_admin; um usuario admin+manager mantem alcance tenant-wide (trava nao dispara).
4. `analytics/manager/nudge/route.ts:48` admite qualquer chamador com `hasRole({roles},"manager")`, inclusive multi-chapeu cujo singular != manager; a trava de escopo `getManagedTeamStudentIds({includeSubtree:true})` permanece inalterada.
5. `notifications/nudge/route.ts` e `admin/notifications/route.ts` (GET e POST) obtem `roles` via embed `user_roles!user_roles_user_id_fkey(role)` no fetch inline, com fallback `[profile.role]` quando o join vem vazio (paridade com `auth.ts`).
6. **Teste red-first (vazamento):** um teste que, ANTES do fix, prova que `resolveCallerStudentScope` com `roles:["instructor","manager"]` retorna tenant-wide (`null`) quando o codigo antigo lia o singular `admin`, e DEPOIS do fix retorna o subtree confinado do gestor (nao-null, sem tenant-wide). O teste falha na versao antiga e passa na nova.
7. **Grep exaustivo de call-sites de `resolveCallerStudentScope` = 4-5, todos migrados:** `grep -rn "resolveCallerStudentScope" apps/web/src` retorna a definicao + os call-sites (generate, suggestions/[id], notifications/nudge, admin/notifications POST); nenhum call-site passa `profile.role`; `next build`/`tsc` verde (a troca de assinatura obriga migrar todos, sem overload transitorio residual).
8. **Grep residual = 0 (coordenado com S3):** nenhum `profile.role` sobrevive em decisao de ESCOPO/GATE de disparo no engajamento. A lista autoritativa (secao Plano de testes) enumera cada ocorrencia com dono (S5 ou S3). Os itens de S5 estao zerados ao fim de S5; os de S3 (SSR `page.tsx:61,116`) sao removidos em S3. AC de S5 = os itens marcados "S5" no catalogo estao a zero.
9. `hasRole`/`hasAnyRole` sao consumidos de `@/lib/role-helpers` (nao redefinidos). Nenhum novo primitivo de escopo criado em `area-context.ts` (No-Invention).
10. Comentarios de cabecalho que citam "role === 'manager'"/"admin" singular foram atualizados para refletir a uniao (`analytics/manager/nudge/route.ts:6`, `campaign/route.ts:88-93`).

## Plano de testes (first-move rule)

**FIRST MOVE (teste VERMELHO antes do fix):** em `apps/web/src/lib/__tests__/area-context.test.ts` (arquivo existente, estilo `makeDb` chainable stub confirmado nas linhas 17-52), adicionar bloco `describe("resolveCallerStudentScope, union of hats")`:
- Caso 1 (RED, reproduz o vazamento): `roles:["instructor","manager"]` (multi-chapeu) DEVE retornar o subtree do gestor (nao-null, nao tenant-wide). Na versao antiga (assinatura `role: string` recebendo o singular `admin`), o retorno seria `null` (tenant-wide), o teste falha. Na nova, retorna `[...]` do subtree. Isto E a prova do vazamento multi-chapeu (`roles:[instructor,manager]`, `profile.role:admin`).
- Caso 2: `roles:["admin","manager"]` -> `null` (tenant-wide, precedencia admin vence).
- Caso 3: `roles:["manager"]` -> subtree via `getManagedTeamStudentIds({includeSubtree:true})`, `null` colapsa a `[]`.
- Caso 4: `roles:["instructor"]` -> uniao das areas; assignment vazio -> `[]`.
- Caso 5: `roles:["student"]` (ou `roles:[]`) -> `[]` (fail-closed, nunca tenant-wide).

**Testes de rota (novos, por rota):** para cada uma das 5 rotas + `analytics/manager/nudge`, um teste que mocka `getAuthProfile()` (ou o fetch inline) com `roles:["admin","manager"]` e `profile.role:"admin"` e assevera:
- admissao concedida por `hasAnyRole`/`hasRole`;
- para admin+manager: alcance tenant-wide (campaign nao dispara trava de time; `resolveCallerStudentScope` -> null);
- para um manager-puro (`roles:["manager"]`, `profile.role:"student"`): confinado ao subtree, admissao concedida em `manager/nudge` (prova que o singular != manager nao barra mais).

**Grep gates (CI/manual, viram AC 7-8):**
- `grep -rn "resolveCallerStudentScope" apps/web/src` -> definicao + 4 call-sites, nenhum com `profile.role`.
- `grep -rnE "profile\\.role" apps/web/src/app/api/admin/engagement apps/web/src/app/api/analytics/manager apps/web/src/app/api/notifications/nudge apps/web/src/app/api/admin/notifications` -> zero em decisao de escopo/gate de disparo (restam apenas leituras de S4, listadas no catalogo).

**LISTA AUTORITATIVA de `profile.role` em escopo/gate (engajamento + SSR analytics), com dono:**
| arquivo:linha | uso | dono |
|:---|:---|:---|
| area-context.ts:307 (param `role`) | escopo dispatch | S5 (remove) |
| suggestions/generate/route.ts:17,32 | gate+scope | S5 (remove) |
| suggestions/[id]/route.ts:21,42 | gate+scope | S5 (remove) |
| notifications/nudge/route.ts:22,43 | gate+scope | S5 (remove) |
| admin/notifications/route.ts:23,53,96 | gate+scope | S5 (remove) |
| campaign/route.ts:45,95 | gate+trava | S5 (remove) |
| analytics/manager/nudge/route.ts:48 | gate admissao | S5 (remove) |
| analytics/page.tsx:61,116 | gate+scope SSR | S3 (D3, remove em S3) |
| analytics/page.tsx:806-808 | rotulo view-role | S3 (fora do bug de escopo; migrar por consistencia) |
| engagement/history,suggestions,templates; analytics/manager/route.ts | gate de LEITURA | S4 (escopo de leitura) |

**Build:** `pnpm --filter web build` (ou `tsc --noEmit`) verde apos a troca de assinatura.

## Dependencias

- **Nenhuma dependencia de entrada:** S5 e seguranca pura e pode comecar imediatamente (primeiro no sequenciamento S5 -> S1 -> S2 -> S3, com S4 logo apos S5).
- **Consumidores de S5:** S4 consome `resolveCallerStudentScope(roles)` e `hasRole`/`hasAnyRole` para todas as decisoes de papel na pagina do engajamento (leitura). S3 consome o conceito de uniao (via `hasRole`, ja existente) para migrar `analytics/page.tsx:116` (D3) e coordena a remocao dos `profile.role` do SSR contra o grep autoritativo de S5.
- **Reusa (nao cria):** `hasRole`/`hasAnyRole` (`role-helpers.ts`, JA existem), `roles` de `getAuthProfile` (`auth.ts`, JA retornado), o embed `user_roles!user_roles_user_id_fkey(role)` (padrao ja usado em `auth.ts` e `aggregate/route.ts`), o contrato `allowedStudentIds` do engine (intacto).

## Riscos

- **Maior risco, falso-verde de teste vs RLS de producao:** os testes unitarios mockam o client e NAO simulam RLS. Como o anel DB e singular (D8) e varias rotas bypassam RLS via service client, um teste verde na app-layer NAO garante que o anel DB concorde; um multi-chapeu admin+manager batendo PostgREST direto ainda passa pelo anel singular. Mitigacao: AC explicito de que a app-layer e o unico gate para rotas service-client, e sinalizacao formal (fora de escopo) de que migrar `auth_user_role()` para uniao e a story de follow-up. Nao vender S5 como defense-in-depth.
- **Regressao de admissao:** trocar o gate singular por `hasAnyRole` pode ADMITIR chamadores antes barrados (multi-chapeu cujo singular era `student`). Isso e o comportamento CORRETO desejado, mas precisa dos testes de rota (roles-puro e multi-chapeu) para provar que a admissao ampliada nao vaza escopo (o escopo continua confinado por `resolveCallerStudentScope`).
- **Build-breaker da troca de assinatura:** os 4 call-sites de `resolveCallerStudentScope` DEVEM migrar juntos; um call-site esquecido quebra `tsc`. AC 7 (grep exaustivo) e o freio. Sem overload transitorio, troca atomica.
- **Fetch inline sem `user_roles` (2 rotas):** se o embed for esquecido em `notifications/nudge` ou `admin/notifications`, `roles` fica indefinido e o fallback `[profile.role]` reintroduz o bug singular. AC 5 cobre; o teste de rota do manager-puro pega.