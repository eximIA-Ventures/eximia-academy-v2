# EPIC-MANAGER-UX / S4, Engajamento do gestor, escopo de leitura no time e UI travada (REWORK)

> Status: Draft, PRONTA PARA REVISAO, NAO IMPLEMENTAR ate GO de Hugo.
> Executor: @dev · Tipo: refactor · Branch: feat/engajamento-gestor-m1

## User Story

Como gestor operando na lente Gestor, quero que a Central de Engajamento me mostre apenas sinais do MEU time (roster, historico, sugestoes, audiencias, eficacia), sem conteudo bruto de notificacao e sem a opcao de disparar para audiencias amplas ou "todos", para que eu aja sobre engajamento da minha equipe sem vazar dados de alunos fora do meu alcance.

Contexto do modelo aprovado (Hugo, 03/07): a lente Gestor mantem a Central de Engajamento visivel, mas a audiencia fica TRAVADA no time (sem "todos"), roster e sugestoes escopados, e ZERO conteudo bruto. Esta story e SO UX + escopo de LEITURA. Toda decisao de PAPEL/gate de DISPATCH (escrita) e propriedade da S5, que S4 consome; os gates de ADMISSAO de LEITURA sao de S4 (ver Correcao D9 abaixo).

> **Correcao pos-verificacao (D9, prevalece sobre o corpo desta story):** os gates de ADMISSAO de LEITURA da superficie de engajamento sao PROPRIEDADE DE S4 e devem ser migrados de `["admin","manager","instructor"].includes(profile.role)` SINGULAR para `hasAnyRole({roles}, ["admin","manager","instructor"])` sobre o union de chapeus. Sao eles: `admin/notifications/page.tsx:12`, `api/admin/engagement/history/route.ts:14`, `api/admin/engagement/suggestions/route.ts` (GET), `api/admin/engagement/templates/route.ts` (GET) e `api/analytics/manager/route.ts` (GET). **Onde o corpo desta story disser que esses gates de LEITURA sao "propriedade de S5", leia-se S4.** S5 continua dono APENAS dos gates de DISPATCH (escrita): campaign, suggestions/generate, suggestions/[id], notifications/nudge, admin/notifications POST, e o gate de admissao de analytics/manager/nudge. Motivo: sem isto, um multi-chapeu legitimo cujo `profile.role` singular diverge seria barrado (403/redirect) na porta da Central, mesmo detendo o chapeu na uniao. **Aceite D9:** grep de decisao de admissao por `profile.role` nesses 5 read-gates retorna zero; um teste de admissao com multi-chapeu (`roles` inclui manager, `profile.role` singular = "student") NAO e barrado; e nenhum gate de dispatch de S5 e tocado por S4.

## Estado atual (recon arquivo:linha)

Fonte de verdade lida integralmente. Todos os ponteiros abaixo batem com o codigo real.

1. `apps/web/src/app/(platform)/admin/notifications/page.tsx` (SSR, RSC):
   - linha 10: `const { user, profile } = await getAuthProfile()`. NAO destrutura `supabase` nem `roles` hoje.
   - linha 12: gate `if (!["admin","manager","instructor"].includes(profile.role)) redirect`. Usa `profile.role` SINGULAR. Este gate e propriedade de S5 (D1), S4 NAO o migra.
   - linha 17: `const db = createServiceClient()` (bypass RLS). Todas as leituras abaixo usam este client, portanto NAO ha anel RLS por baixo (D8).
   - linhas 20-38: `Promise.allSettled` carrega, todos TENANT-WIDE, sem escopo de time: `listPendingSuggestions(tenantId)` (engine.ts:878, tenant-wide); `notification_templates` where `tenant_id`; `notifications` select `id, recipient_id, template_id, channel, origin, title, status, created_at, sent_at, read_at, acted_at, returned_at` where `tenant_id`, limit 80 (NAO seleciona `body` aqui); `nudgeEfficacyByType(tenantId)` (efficacy.ts:225, tenant-wide).
   - linhas 50-77: enriquecimento de history com `full_name`/`email` dos recipients (bulk).
   - linhas 79-98: `notification_audiences` (tenant-wide), `courses`, `areas` para o construtor de criterios de campanha.
   - linhas 104-105: `canManageSuggestions`/`canManageCampaigns` derivados de `profile.role` SINGULAR. Sao gates de papel de S5 (D1), S4 NAO os migra; apenas consome os booleanos ja resolvidos ao renderizar.
   - linhas 108-118: props passadas ao client (`suggestions, templates, history, efficacy, audiences, courses, areas, canManageSuggestions, canManageCampaigns`).

2. `apps/web/src/app/(platform)/admin/notifications/_components/engagement-center-client.tsx` (client):
   - linhas 70-83: `Props` recebe `history: any[]`, `audiences: Audience[]`, `efficacy`, `suggestions`, e os dois booleanos de papel.
   - linhas 36-51: `HistoryRow` NAO tem campo `body` (o corpo bruto nunca e renderizado no client pelo caminho SSR).
   - linhas 594-776 (aba Campanhas): dropdown de Audiencia (`campaign-audience`, linhas 619-632) lista TODAS as `audiences` salvas do tenant, incluindo audiencias de alcance amplo. Estado vazio em 614-618 e 731-738.
   - linhas 778-921 (aba Historico & Metricas): renderiza cards de eficacia (782-826) e a tabela de history (839-917). Colunas: destinatario, titulo, canal, origem, status, eficacia, data. NAO ha coluna de corpo. `readRate` (374-377) deriva de `history`.

3. `apps/web/src/app/api/admin/engagement/history/route.ts` (GET, API exposta):
   - linha 12: `getAuthProfile()`.
   - linha 14: gate `["admin","manager","instructor"].includes(profile.role)` SINGULAR. Propriedade de S5 (D1), S4 NAO o migra.
   - linha 26: `const db = createServiceClient()` (bypass RLS).
   - linha 32: o select INCLUI `body` (`"id, recipient_id, template_id, channel, origin, title, body, status, created_at, sent_at, read_at, acted_at, returned_at"`), tenant-wide, e a resposta (linha 76 `NextResponse.json({ notifications: enriched, efficacy })`) devolve `body`. Vazamento de conteudo bruto, alvo direto de S4.
   - linhas 34-36: query tenant-wide (`.eq("tenant_id", tenantId)`), sem intersecao com o time do caller.

4. Contratos de escopo ja existentes (S4 CONSOME, NAO cria):
   - `apps/web/src/lib/area-context.ts:307` `resolveCallerStudentScope(db, tenantId, userId, role: string): Promise<string[] | null>`. Retorna `null` para admin/super_admin (tenant-wide), o subtree do time para manager (`getManagedTeamStudentIds` includeSubtree, EXIGE client autenticado, linha 320), a uniao das areas para instructor, `[]` fail-closed para o resto. S5 migra a assinatura para `roles: string[]` (D1), S4 chama a versao migrada.
   - `getAuthProfile()` (auth.ts:63-71) ja retorna `roles: effectiveRoles` (union de chapeus) e `supabase` (client autenticado do caller). S4 usa AMBOS.

5. Contrato de lente (S1, ainda inexistente no repo, confirmado por grep vazio de `RoleLens`/`isManagerLens`/`activeLens`): S4 consome `isManagerLens(activeLens)` / o tipo `RoleLens` de S1 para decidir SE a pagina esta na lente Gestor.

## Escopo decidido

S4 faz APENAS o seguinte (D1: UX + escopo de leitura + trava de audiencia na UI):

E1. Escopo de leitura da pagina do engajamento (page.tsx) ao time do gestor. Quando a lente ativa e Gestor (`isManagerLens`), calcular o universo de alunos alcancaveis via `resolveCallerStudentScope(supabase_autenticado, tenantId, user.id, roles)` (helper de S5) e intersectar as leituras que expoem alunos:
   - `history` (linhas 30-36): para gestor, filtrar as linhas de `notifications` para `recipient_id IN scope`.
   - `suggestions`: filtrar `listPendingSuggestions` ao subconjunto cujas `target_student_ids` estao integralmente dentro do escopo, descartando a sugestao inteira se houver qualquer alvo fora do time.
   - `efficacy`: recalcular a eficacia sobre o subconjunto escopado de notificacoes em vez do agregado tenant-wide.
   - Para admin/super_admin, escopo `null` = comportamento tenant-wide EXATAMENTE preservado.

E2. Escopo do corpo da history route (history/route.ts). Intersectar as linhas retornadas ao escopo de leitura do time (mesma logica de E1), consumindo `resolveCallerStudentScope` com o client AUTENTICADO desta rota (`getAuthProfile().supabase`).

E3. ZERO conteudo bruto. Remover `body` do select (linha 32) e da resposta da history route. O corpo da notificacao (texto pessoal/mensagem) nunca deve trafegar para a central. A pagina SSR ja nao carrega `body`; garantir que continue assim.

E4. Subtracao de UI travada por audiencia (engagement-center-client.tsx). Na lente Gestor: o dropdown de Audiencia NAO oferece audiencias de alcance amplo/"todos"; a pagina passa ao client apenas `audiences` ja escopadas ao time (audiences incompativeis removidas server-side, D1 "audiences vazias p/ gestor"); se nao houver audiencia elegivel, o estado vazio ja existente (614-618, 731-738) e reutilizado, sem qualquer opcao de "enviar para todos".

E5. Consumo de contratos, nao criacao de gates. S4 usa `isManagerLens`/`RoleLens` (S1) e `resolveCallerStudentScope roles:string[]` (S5). S4 NAO re-migra nenhum gate de papel.

## Fora de escopo

F1. Migrar os gates de DISPATCH (escrita) `profile.role` singular para union (hasRole). PROPRIEDADE DE S5 (D1): campaign/route.ts:45, suggestions/generate, suggestions/[id]:21, notifications/nudge:43, admin/notifications POST (~96) e o gate de admissao de analytics/manager/nudge. S4 NAO toca nenhum desses. RESSALVA (D9): os gates de ADMISSAO de LEITURA (page.tsx:12, history/route.ts:14, suggestions GET, templates GET, analytics/manager GET) NAO estao aqui, sao PROPRIEDADE DE S4 e sao migrados por esta story, conforme a Correcao D9 no topo.
F2. Migrar a assinatura de `resolveCallerStudentScope` para `roles:string[]`. PROPRIEDADE DE S5 (D1). S4 apenas a CHAMA na forma ja migrada.
F3. Definir/mudar o switcher de lente, `activeLens`, props do Header, `navRoleForContext`. PROPRIEDADE DE S1 (D5). S4 apenas LE `isManagerLens(activeLens)`.
F4. Mover o item Analytics de modulo ou migrar o SSR de Analytics. PROPRIEDADE DE S3 (D2/D3/D7).
F5. Estender a candidate pool para group-owner nodes (Perfis da Equipe). PROPRIEDADE DE S2 (D6).
F6. Migrar `auth_user_role()` de singular para union no anel DB. FORA DE ESCOPO GLOBAL (D8), apenas sinalizado.
F7. Remover aprendizado da lente Gestor, permitir Rinaldo ver 2 lentes juntas, composicao Unidade x Time. DEFERIDO.
F8. Campanhas manuais/edicao de templates continuam gated por `canManageCampaigns` (papel, de S5). S4 nao altera essa logica de permissao, apenas a lista de audiencias oferecida.

## Mudancas de codigo (POR ARQUIVO, com assinatura/shape)

### A) `apps/web/src/app/(platform)/admin/notifications/page.tsx`

1. Destruturar `supabase` e `roles` de `getAuthProfile()`, e receber a lente ativa (contrato de S1). Forma alvo:

```ts
const { user, profile, supabase, roles } = await getAuthProfile()
// ...gate de S5 permanece intacto (linha 12)...
const activeLens = /* contrato S1: lente ativa resolvida */
const managerLens = isManagerLens(activeLens) // helper de S1
```

2. Calcular o escopo de leitura UMA vez, na lente Gestor, com o client AUTENTICADO (nunca o service client, por causa do branch subtree que le `auth.uid()`):

```ts
// null = tenant-wide (so admin/super_admin); [] = escopo vazio (fail-closed);
// [ids] = universo de alunos do time do gestor.
const readScope: string[] | null = managerLens
  ? await resolveCallerStudentScope(supabase, tenantId, user.id, roles) // helper migrado de S5
  : null
const scopeSet = readScope ? new Set(readScope) : null
```

3. Aplicar `readScope` as leituras que expoem alunos:
   - `notifications` (history): quando `readScope` for array, encadear `.in("recipient_id", readScope)` e curto-circuitar para `[]` quando `readScope.length === 0`.
   - `listPendingSuggestions`: apos carregar, `suggestions.filter(s => s.target_student_ids.every(id => scopeSet.has(id)))` quando `readScope` for array (tenant-wide quando `null`). Uma sugestao que mistura alunos dentro e fora do time nao aparece (nao ha como acionar so parte sem vazar o alvo dos demais).
   - `efficacy`: substituir `nudgeEfficacyByType(tenantId)` por um calculo escopado quando `readScope` for array (ver Dados-RLS-Seguranca); quando `null`, comportamento tenant-wide inalterado.
   - `notification_audiences`: apos carregar, manter apenas as audiencias cujo universo resolvido esta contido no time. Para cada audiencia salva, resolver seu conjunto via `resolveAudience(aud.criteria, tenantId)` (audiences.ts:299) e manter so as com `resolved.length > 0 && resolved.every(id => scopeSet.has(id))`. Quando `readScope` for `null` (admin), nenhuma filtragem.

4. NAO alterar `canManageSuggestions`/`canManageCampaigns` (gates de papel de S5). NAO alterar o gate da linha 12.

### B) `apps/web/src/app/api/admin/engagement/history/route.ts`

1. Remover `body` do select (linha 32) e, por consequencia, do payload (`enriched` deriva de `rows`, o campo desaparece). Novo select:

```ts
"id, recipient_id, template_id, channel, origin, title, status, created_at, sent_at, read_at, acted_at, returned_at"
```

2. Escopar o corpo da rota ao time do gestor, consumindo o helper de S5 com o client AUTENTICADO desta rota:

```ts
const { user, profile, supabase } = await getAuthProfile() // supabase = client autenticado
// ...gate de S5 (linha 14) permanece intacto...
const scope = await resolveCallerStudentScope(supabase, tenantId, user.id, /* roles de S5 */)
let query = db.from("notifications").select(SELECT_SEM_BODY).eq("tenant_id", tenantId)/* ...order/limit/origin... */
if (scope != null) {
  if (scope.length === 0) return NextResponse.json({ notifications: [], efficacy: [] })
  query = query.in("recipient_id", scope)
}
```

   - `scope === null` (admin/super_admin): tenant-wide, inalterado.
   - `scope === []`: resposta vazia (fail-closed), nunca tenant-wide.
   - `efficacy` retornado pela rota tambem deve ser escopado quando `scope` for array (mesmo tratamento de A.3), para nao vazar metricas agregadas de fora do time.

3. NAO migrar o gate da linha 14 (S5). Se a assinatura migrada de S5 exigir `roles`, S4 obtem `roles` de `getAuthProfile()` (ja disponivel) e o repassa; isso e CONSUMO do contrato, nao migracao de gate.

### C) `apps/web/src/app/(platform)/admin/notifications/_components/engagement-center-client.tsx`

1. Nenhuma prop de papel nova. O client ja recebe `audiences` (agora ja escopadas server-side por A.3) e `history` (agora ja escopado por A.3, sem `body`). A trava de UI e consequencia natural: o dropdown de Audiencia (linhas 619-632) itera `audiences`, que na lente Gestor ja vem sem alcances amplos.

2. Ajuste textual do estado vazio de audiencias: quando `audiences.length === 0`, o texto (linhas 731-738) nao deve sugerir "todos". Manter copy neutra ("Nenhuma audiencia disponivel.") OU a pagina passa um rotulo ja derivado (ex.: `audienceScopeLabel`), sem introduzir gate de papel (apenas rotulo UX).

3. Garantir que nenhuma coluna/preview passe a exibir corpo bruto: `TemplatePreview` (linhas 1045-1073) mostra `template.title`/`template.body_inapp`, que sao TEMPLATES (config do tenant, nao dado pessoal do aluno), permanecem, pois nao sao conteudo bruto de notificacao enviada. A tabela de history (839-917) ja nao tem coluna de corpo; manter assim.

## Dados-RLS-Seguranca

- Sem anel RLS neste caminho (D8 aplicado por analogia). `page.tsx:17` e `history/route.ts:26` usam `createServiceClient()` (bypass RLS). Portanto o escopo de leitura por time e feito na APP-LAYER (intersecao por `recipient_id`), e ele e o UNICO gate de escopo de dados aqui. NAO representar RLS como defense-in-depth para esta leitura.
- Client autenticado obrigatorio para calcular o escopo. O branch `manager` de `resolveCallerStudentScope` chama `getManagedTeamStudentIds(..., {includeSubtree:true})`, que executa `db.rpc("auth_reachable_student_ids")` hard-wired a `auth.uid()` (area-context.ts:141-144). Passar o SERVICE client resolveria para o usuario errado/vazio. Regra dura: o calculo de escopo usa `getAuthProfile().supabase` (autenticado); a leitura ja intersectada por ids pode usar o service client.
- Fail-closed. `scope === []` sempre resulta em zero linhas/audiences, nunca tenant-wide. `scope === null` e reservado a admin/super_admin (via S5).
- Limitacao conhecida herdada (D6b/D8). Para um multi-chapeu cujo `profile.role` singular diverge de `manager`, o read de time pode falhar-fechado dependendo de como a assinatura union de S5 resolve a decisao de papel e de os RPCs subjacentes ainda gatearem por `auth_user_role()` singular no anel DB. S4 depende de S5 para a decisao de papel; S4 nao corrige o role singular do DB (fora de escopo, D8). Sinalizar no PR.
- Sem conteudo bruto. `body` removido do select e da resposta da history route (E3). Nenhum campo de texto pessoal do aluno trafega para a central; so sinais (status, canal, origem, titulo do template, timestamps, eficacia).
- Privacidade cross-tenant ja garantida pelo `.eq("tenant_id", tenantId)` existente; S4 apenas ADICIONA a intersecao por time, nunca remove o filtro de tenant.

## Acceptance Criteria (numerados)

AC1. Na lente Gestor, a aba Historico & Metricas exibe SOMENTE notificacoes cujo `recipient_id` pertence ao time do gestor (subtree via `resolveCallerStudentScope`). Uma notificacao para aluno fora do time NAO aparece nem na SSR (`page.tsx`) nem no GET `engagement/history`.

AC2. Na lente Gestor, a aba Sugestoes exibe SOMENTE sugestoes cujos `target_student_ids` estao integralmente dentro do time do gestor; sugestoes que mirem qualquer aluno fora do time nao aparecem.

AC3. O GET `/api/admin/engagement/history` NAO retorna o campo `body` em nenhuma linha (para nenhum papel), e o select da query nao o inclui. ZERO conteudo bruto.

AC4. Na lente Gestor, o dropdown de Audiencia oferece SOMENTE audiencias cujo universo resolvido e subconjunto do time do gestor; nenhuma audiencia de alcance amplo/"todos" e selecionavel. Se nao houver audiencia elegivel, o estado vazio e mostrado sem qualquer caminho para "enviar para todos".

AC5. Para admin/super_admin (escopo `null`), o comportamento e byte-a-byte o atual: history tenant-wide, todas as sugestoes, todas as audiencias, eficacia tenant-wide. Nenhuma regressao.

AC6. Os cards de eficacia na lente Gestor refletem apenas notificacoes do time (nao o agregado tenant-wide); em admin, permanecem tenant-wide.

AC7. Os gates de DISPATCH (as 5 rotas de disparo + admissao de analytics/manager/nudge) e `canManageSuggestions`/`canManageCampaigns` NAO sao alterados por S4 (permanecem como S5 os entrega). Os gates de ADMISSAO de LEITURA (`page.tsx:12`, `history/route.ts:14`, suggestions GET, templates GET, analytics/manager GET) SAO migrados por S4 para `hasAnyRole` union (Correcao D9, aceite D9). O diff de S4 nao altera nenhuma das 5 rotas de disparo.

AC11. (D9) Nenhum dos 5 gates de ADMISSAO de LEITURA decide admissao por `profile.role` singular apos S4; todos usam `hasAnyRole({roles}, ["admin","manager","instructor"])`. Teste RED-first (T10): um multi-chapeu com `roles=["student","manager"]` e `profile.role="student"` e ADMITIDO na Central e no GET history (hoje seria barrado); um `student`-puro (`roles=["student"]`) continua barrado.

AC8. Escopo `[]` (gestor sem time) resulta em history vazio, sugestoes vazias, audiencias vazias e eficacia vazia; NUNCA tenant-wide.

AC9. Todos os literais de secao/rotulo novos ou tocados usam acentuacao correta (ex.: qualquer referencia a secao usa exatamente "Gestão do Time", D4). S4 nao adiciona `{section}` ao modulo analytics (D2, de S3).

AC10. A dependencia de S5 esta documentada no cabecalho da story e no PR: S4 nao pode landar antes de S5 (assinatura union de `resolveCallerStudentScope` e a decisao de trava).

## Plano de testes (first-move rule)

Regra de primeiro movimento: escrever CADA teste RED antes da implementacao correspondente, provando o vazamento atual, depois implementar ate ficar verde.

T1 (RED-first, AC1). Fixture: tenant com gestor G (time = {A,B}) e aluno C fora do time; notificacoes para A, B e C. Assert atual (RED): a SSR e o GET history na lente Gestor retornam a linha de C. Depois (GREEN): C some; A e B permanecem.

T2 (RED-first, AC3). Assert atual (RED): GET `engagement/history` retorna `body` no payload. Depois (GREEN): nenhuma linha contem `body`; o select nao referencia `body`.

T3 (RED-first, AC2). Fixture: sugestao S1 alvo {A,B} (dentro), sugestao S2 alvo {A,C} (mistura), sugestao S3 alvo {C} (fora). Assert (RED): as tres aparecem na lente Gestor. Depois (GREEN): so S1 aparece.

T4 (RED-first, AC4). Fixture: audiencia "Todos" (tenant-wide), audiencia "Time G" (subconjunto do time), audiencia "Outra area" (fora). Assert (RED): o dropdown lista as tres. Depois (GREEN): so "Time G" e oferecida.

T5 (AC5, guard de nao-regressao). Como admin (escopo `null`): history tenant-wide, todas as sugestoes/audiencias, eficacia tenant-wide, identicos ao baseline pre-S4.

T6 (AC8, fail-closed). Gestor sem time (`resolveCallerStudentScope` retorna `[]`): history/sugestoes/audiencias/eficacia todos vazios; nunca tenant-wide.

T7 (AC6). Eficacia na lente Gestor computa retorno apenas sobre notificacoes de {A,B}; verificar que uma notificacao para C nao entra no denominador.

T8 (seguranca do client autenticado). Teste que garante que o calculo de escopo recebe o client autenticado do caller (nao o service client) no page.tsx e no history route; um mock que detecta `auth.uid()` ausente falha o teste (previne o fail-open descrito no maior risco).

T9 (multi-chapeu, D6b/D8, documentacao). Cenario: usuario com `profile.role` singular != manager mas com chapeu manager em `roles[]`. Assert do comportamento resolvido por S5 (esperado: escopo do time correto se S5 resolver union; se falhar-fechado por role singular no DB, o teste documenta a limitacao conhecida, nao a mascara).

## Dependencias

- S5 (lands PRIMEIRO, dependencia dura): assinatura migrada `resolveCallerStudentScope(db, tenantId, userId, roles: string[])` e a semantica union de chapeus; garantia de que os 5 gates de disparo + gate de admissao ja foram migrados. S4 CONSOME, nunca re-migra.
- S1: conceito de lente ativa e `isManagerLens`/`RoleLens` para decidir SE a pagina esta na lente Gestor. S4 apenas LE.
- Helpers ja existentes (consumidos): `getAuthProfile()` (retorna `roles` e `supabase` autenticado, auth.ts:63-71), `resolveAudience` (audiences.ts:299) para resolver o universo de cada audiencia salva, o caminho de eficacia escopado (efficacy.ts:225).
- Nao invade: campaign/route.ts, suggestions/generate, suggestions/[id], notifications/nudge, admin/notifications POST, analytics/page.tsx, registry.ts, sidebar.tsx, header.tsx, e a assinatura de area-context.ts. Sequenciamento global: S5 -> S1 -> S2 -> S3, com S4 logo apos S5.

## Riscos

R1 (MAIOR). Passar o service client (bypass RLS, sem `auth.uid()`) ao branch subtree de `resolveCallerStudentScope` resolveria o escopo para o usuario errado ou vazio, causando fail-open (vaza tenant) ou fail-closed silencioso (tela vazia). Mitigacao: usar obrigatoriamente `getAuthProfile().supabase` para o calculo de escopo; T8 cobre.
R2. Multi-chapeu cujo `profile.role` singular != manager pode falhar-fechado por causa do role singular herdado do anel DB (auth_user_role) ate S5/D8; risco de o gestor legitimo ver tela vazia. Mitigacao: dependencia explicita de S5; T9 documenta; sinalizar limitacao no PR (D8, fora de escopo corrigir o DB).
R3. Filtrar audiencias resolvendo `resolveAudience` para cada audiencia salva adiciona custo O(n_audiencias) de queries no SSR. Mitigacao: numero de audiencias por tenant e pequeno; resolver em paralelo (`Promise.all`) e so na lente Gestor.
R4. Eficacia escopada requer recomputo por subconjunto; se o helper de eficacia nao aceitar filtro de recipients hoje, e preciso um caminho de agregacao escopado que nao regrida o caminho admin. Mitigacao: manter `nudgeEfficacyByType(tenantId)` intacto para `scope===null` e adicionar o caminho escopado apenas para array; T5/T7 travam ambos.
R5. Acoplamento a contratos ainda inexistentes (S1 `isManagerLens`, S5 assinatura union). Mitigacao: S4 nao pode landar antes de S1 e S5; documentado no status e AC10.