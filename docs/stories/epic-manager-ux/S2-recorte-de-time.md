# EPIC-MANAGER-UX / S2, Recorte de time unificado (TeamScopeControl) e drill "time do meu time" visivel

> Status: Draft, PRONTA PARA REVISAO, NAO IMPLEMENTAR ate GO de Hugo.
> Executor: @dev · Tipo: feat · Branch: feat/engajamento-gestor-m1

## User Story

Como gestor na lente Gestor (Ver como: Gestor), quero um controle unico de recorte de time (Diretos, Hierarquia e a possibilidade de descer para um sub-time) reunido num so lugar visivel, para eu escolher a fatia da minha equipe sem caçar dois controles separados (switch Diretos/Hierarquia de um lado, drill de sub-time de outro), e para que qualquer superficie que consome esse recorte (dashboard do time e, na S3, o Analytics em Gestão do Time) leia o MESMO estado de forma consistente. O drill "time do meu time" precisa aparecer no default, inclusive quando um sub-gestor esta ligado a mim por manager_group (e nao por reports_to), que hoje some da lista.

Esta story NAO cria a lente de papel (isso e S1), NAO migra gate de seguranca (isso e S5), NAO move o item de nav do Analytics nem migra o SSR (isso e S3), e NAO escopa a pagina de Engajamento (isso e S4). Ela unifica os controles de recorte de time do dashboard, corrige o buraco da candidate pool na raiz, e EXPORTA um componente reutilizavel `TeamScopeControl` mais o contrato de estado (`x-team-view` + `?focus`) que a S3 reusa no Analytics.

## Estado atual (recon arquivo:linha)

- `apps/web/src/app/(platform)/dashboard/_components/manager-team-dashboard-page.tsx:139-178` monta um `teamRecortePanel` inline que ja reune, no mesmo painel "Recorte da equipe", o `OrgDrilldownBreadcrumb` (subir/voltar a arvore, linha 159) e o `TeamViewSwitch` (Diretos/Hierarquia, linha 161), e condicionalmente o `SubtreeNodeList` ("Times abaixo", linha 169). Ou seja, o "recorte unificado" ja existe fisicamente como JSX inline, mas NAO como componente reutilizavel: a S3 (Analytics em Gestão do Time) nao tem como reusar essa mesma UI porque ela esta soldada dentro do dashboard.
- `apps/web/src/app/(platform)/dashboard/_components/team-view-switch.tsx:36-76`, `TeamViewSwitch({ mode })`, client component, tablist de duas opcoes (`direct`, `hierarchy`), grava via `setTeamView` (server action) e faz `router.refresh()`. O comentario de cabecalho (linhas 11-13) ainda afirma que "Times abaixo stays visible in both modes", desatualizado: a Iteração 3 (manager-team-dashboard-page.tsx:38-42, 172-176) ja removeu "Times abaixo" do modo Diretos.
- `apps/web/src/lib/team-view-context.ts:29-56`, cookie `x-team-view` (enum `direct`|`hierarchy`, 8h, httpOnly/secure/sameSite strict). `getTeamViewMode()` default `direct`; le legacy `global` como `hierarchy`. `setTeamViewMode(mode)` recusa valor malformado. Este e o contrato de estado do eixo Diretos/Hierarquia.
- `apps/web/src/app/(platform)/context/actions.ts:95-96`, `setTeamView(mode)` delega para `setTeamViewMode`, escreve invalido como no-op.
- `apps/web/src/app/(platform)/dashboard/_components/org-drilldown-breadcrumb.tsx:34-90`, breadcrumb; grava/limpa `?focus` na URL (linha 44-55). Este e o contrato de estado do eixo drill (`?focus` na querystring).
- `apps/web/src/app/(platform)/dashboard/_components/subtree-node-list.tsx:48-121`, "Times abaixo"; clique grava `?focus=<node>` (linha 53-60). Renderiza `null` se `subteams.length === 0` (linha 63).
- `apps/web/src/lib/org-tree.ts:67-182`, `resolveDrilldownNav(db, tenantId, managerId, focus)`. GATE por `auth_subtree_user_ids()` (linha 84-87). BUG-ALVO (D6a): `directReportIds` (linha 145-147) deriva EXCLUSIVAMENTE de `u.reportsTo === focusUserId`; o predicado `ownsTeam` (linha 159-162) tambem so olha arestas `reports_to`. Um sub-gestor cujos alunos me alcançam por `manager_group_members` (E3 `auth_reachable_student_ids` une `reports_to` ∪ membros de manager_group descendente) mas que NAO tem `reports_to = managerId` NUNCA entra em `directReportIds`, logo NUNCA aparece em "Times abaixo". A candidate pool na RAIZ e incompleta.
- `apps/web/src/lib/__tests__/org-tree.test.ts:92-121`, cobre "owns a team" via `reports_to` com `user_roles` retornando `[]`, mas NAO cobre o caso group-owner sem aresta `reports_to`. Falta o teste red-first de D6a.
- `apps/web/src/lib/area-context.ts:126-167`, `getManagedTeamStudentIds`, ramo DEFAULT resolve `manager_groups` (`manager_id = managerId`) e `manager_group_members`. `manager_group_members(group_id, student_id, tenant_id)` (schema `supabase/migrations/20260530130000_area_gestor.sql:104-113`), `manager_groups(id, manager_id, tenant_id)` (idem :83-121). Este e o caminho de dados para descobrir group-owner nodes.
- `supabase/migrations/20260604140000_fix_area_gestor_rls.sql:39-48`, `mg_select` gateia leitura de `manager_groups` por `auth_user_role() IN ('admin','manager','instructor') OR manager_id = auth.uid()`. `auth_user_role()` e SINGULAR (`supabase/migrations/20260207000000_initial_schema.sql:165-166`). Limitacao conhecida (D6b), ligada ao problema de role singular que a S5 possui.
- `apps/web/src/lib/role-helpers.ts:12-18`, `hasRole(profile,{role})` sobre `profile.roles[]` (union). S1 vai expor o conceito de lente (`RoleLens`/`isManagerLens`); esta story CONSOME esse conceito, nao o define.

## Escopo decidido

1. **Extrair `TeamScopeControl` (novo componente reutilizavel).** Criar `apps/web/src/app/(platform)/dashboard/_components/team-scope-control.tsx`, client component, que encapsula o "cabeçalho de recorte" que hoje esta inline no `teamRecortePanel` (manager-team-dashboard-page.tsx:139-163): o rotulo "Recorte da equipe", a frase-resumo do estado atual, o `OrgDrilldownBreadcrumb` (subir) e o `TeamViewSwitch` (Diretos/Hierarquia). O `SubtreeNodeList` ("Times abaixo") e a strip de engajamento NAO entram no `TeamScopeControl` (eles sao conteudo do dashboard, nao controle de recorte); permanecem no dashboard. O `TeamScopeControl` e o unico ponto de UI do recorte, reutilizavel por qualquer pagina em contexto de time (dashboard hoje, Analytics em Gestão do Time na S3).
2. **Refatorar `manager-team-dashboard-page.tsx` para consumir `TeamScopeControl`** em vez do JSX inline, preservando byte-a-byte o comportamento visual e de dados atual (mesma frase-resumo, mesma ordem Hierarquia = "Times abaixo" primeiro + strip; Diretos = so strip).
3. **Corrigir a candidate pool na raiz de `resolveDrilldownNav` (D6a).** Estender a origem de `directReportIds` para a UNIAO de: (a) nodes com `reports_to === focusUserId` (comportamento atual) e (b) group-owner nodes, ou seja, `manager_groups.manager_id` dentro do subtree autorizado cujos membros (`manager_group_members`) alcançam o focusUserId. Um group-owner sem aresta `reports_to` para o gestor passa a aparecer em "Times abaixo". A resolucao continua estritamente dentro de `allowed` (o gate `auth_subtree_user_ids()`), sem alargar reach.
4. **Atualizar o comentario desatualizado** em `team-view-switch.tsx:11-13` para refletir que "Times abaixo" e exclusivo de Hierarquia (alinhar com a Iteração 3 ja implementada). Sem mudanca de comportamento.
5. **EXPORTAR o contrato de estado compartilhado** para a S3 reusar: (a) o componente `TeamScopeControl` e seu prop-shape; (b) a documentacao explicita de que o estado do recorte vive em `x-team-view` (cookie, via `team-view-context.ts`) + `?focus` (querystring, gate `auth_subtree_user_ids()`), e que a S3 monta o mesmo `TeamScopeControl` passando o mesmo `trail`/`mode`/`rootId` resolvidos server-side.
6. **Documentar a limitacao de `mg_select` (D6b):** `resolveGroupOwningNodes` (o helper novo de dados de D6a) depende de leitura de `manager_groups`, gateada por `mg_select` que usa `auth_user_role()` SINGULAR. Para um multi-chapeu cujo role singular diverge de {admin, manager, instructor} e que nao e `manager_id` do grupo, a leitura falha-fechada (o group-owner node simplesmente nao aparece). E limitacao conhecida, fail-closed (esconde, nunca vaza), ligada ao problema de role singular que a S5 possui. Fora de escopo desta story migrar `auth_user_role()`/`mg_select` para union.

## Fora de escopo

- Lente de papel, `RoleLens`, `activeLens`/`eligibleLenses`, switcher de lente (S1).
- Migracao de gate/trava de seguranca em qualquer rota de disparo do engajamento e assinatura de `resolveCallerStudentScope` (S5).
- Mover o item Analytics para a chave `manager` do modulo `admin`, remover o item do modulo `analytics`, e migrar o SSR `analytics/page.tsx:116` de singular para union (S3, decisoes D2/D3).
- Ocultar/ajustar `UnitComparison` na lente Gestor e o fetch sem `areaId` (S3, D7).
- Escopo de LEITURA da pagina de Engajamento (roster, historico, sugestoes, audiences, eficacia) e subtracao de UI de audiencia ampla (S4).
- Migrar `auth_user_role()`/`mg_select` para union (apenas sinalizado, D6b/D8).
- Rinaldo ver 2 lentes juntas; composicao Unidade x Time; remover aprendizado da lente Gestor (DEFERIDO no epico).

## Mudancas de codigo (POR ARQUIVO, com assinatura/shape)

### 1. `apps/web/src/app/(platform)/dashboard/_components/team-scope-control.tsx` (NOVO)

Client component reutilizavel. Extrai o cabeçalho de recorte inline do dashboard. Assinatura:

```tsx
"use client"
import type { BreadcrumbNode } from "./org-drilldown-breadcrumb"
import type { TeamViewMode } from "@/lib/team-view-context"

export interface TeamScopeControlProps {
  /** Trilha root→focus, ja resolvida e gateada server-side (auth_subtree_user_ids). */
  trail: BreadcrumbNode[]
  /** Id do gestor (raiz do subtree); focar nele limpa `?focus`. */
  rootId: string
  /** Rotulo da raiz (default "Meu Time"). */
  rootLabel?: string
  /** Diretos | Hierarquia, estado atual do cookie x-team-view. */
  mode: TeamViewMode
  /** Esta focado na raiz? (usado so para a frase-resumo). */
  isRoot: boolean
  /** Rotulo do node focado (para a frase-resumo quando !isRoot). */
  focusedLabel: string
}

export function TeamScopeControl(props: TeamScopeControlProps): JSX.Element
```

Comportamento: renderiza a `<section>` "Recorte da equipe" (o bloco de cabeçalho das linhas 141-163 do dashboard atual), com a frase-resumo derivada de `mode`/`isRoot`/`focusedLabel` (mesmo texto atual), o `OrgDrilldownBreadcrumb trail rootId rootLabel` e o `TeamViewSwitch mode`. NAO renderiza `SubtreeNodeList` nem a strip de engajamento (permanecem no dashboard). O componente e apenas o CONTROLE de recorte, sem conteudo de dados. Nao le cookies nem faz I/O (recebe tudo por props resolvidas server-side, preservando o padrao SSR: estado no cookie/URL, componente puro).

### 2. `apps/web/src/app/(platform)/dashboard/_components/manager-team-dashboard-page.tsx` (MODIFICAR)

- Importar `TeamScopeControl`.
- Substituir o JSX inline do cabeçalho de recorte (o `<div>` das linhas 141-163 dentro de `teamRecortePanel`) por `<TeamScopeControl trail={nav.trail} rootId={managerId} rootLabel="Meu Time" mode={teamViewMode} isRoot={isRoot} focusedLabel={focusedLabel} />`.
- Manter a estrutura externa do `teamRecortePanel` (a `<section>` container das linhas 139-178) e a logica condicional Hierarquia/Diretos (subtreeList + engagementStrip vs so engagementStrip, linhas 165-176) exatamente como esta. `focusedLabel` e `isRoot` ja sao computados (linhas 86-87).
- Nenhuma mudanca de dados, escopo ou seguranca. Refactor puro de UI (mesmo render).

### 3. `apps/web/src/lib/org-tree.ts` (MODIFICAR), corrigir candidate pool na raiz (D6a)

Adicionar um helper de dados e uni-lo a `directReportIds`. Novo helper:

```ts
/**
 * Group-owner nodes: usuarios DENTRO do subtree autorizado (`allowed`) que sao
 * `manager_id` de um `manager_groups` cujos membros alcançam o node focado, mas
 * que podem NAO ter aresta reports_to === focusUserId. Sem eles, um sub-gestor
 * ligado por manager_group some de "Times abaixo" (D6a).
 *
 * Le APENAS dentro de `allowed` (gate E3). Fail-closed: mg_select gateia
 * `manager_groups` por auth_user_role() SINGULAR (D6b), para um multi-chapeu
 * cujo singular diverge e que nao e manager_id do grupo, a leitura devolve
 * zero linhas e o node simplesmente nao aparece (esconde, nunca vaza).
 */
async function resolveGroupOwningNodes(
  db: SupabaseClient<any, "public", any>,
  tenantId: string,
  allowed: Set<string>,
  focusUserId: string,
): Promise<string[]>
```

Implementacao: ler `manager_groups (id, manager_id)` do tenant restrito a `manager_id IN [...allowed]`; ler `manager_group_members (group_id, student_id)` desses grupos; um node `manager_id` e group-owner-do-focus se pelo menos um membro do seu grupo estiver em `allowed` E (para a lista da raiz) sua ligacao ao focusUserId for pelo subtree. Como todos os nodes ja estao intersectados com `allowed` (o subtree do focusUserId, resolvido pelo gate), basta devolver os `manager_id` distintos que estao em `allowed` e `!== focusUserId`. Retornar sempre subconjunto de `allowed`.

Uni-lo em `resolveDrilldownNav` (linha 145-147):

```ts
const reportsToDirect = [...byId.values()]
  .filter((u) => u.reportsTo === focusUserId && u.id !== focusUserId)
  .map((u) => u.id)
const groupOwners = await resolveGroupOwningNodes(db, tenantId, allowed, focusUserId)
const directReportIds = [...new Set([...reportsToDirect, ...groupOwners])]
  .filter((id) => allowed.has(id) && id !== focusUserId)
```

O restante do fluxo (`ownsTeam`, `candidates`, contagem via `subtree_student_ids`, `sort`) permanece. `ownsTeam` (linha 159-162) deve incluir group-owner nodes: quando o node e group-owner mas nao tem aresta `reports_to` interna, ainda assim e alvo de drill valido, entao a checagem `candidates` (linha 168-170) passa a aceitar tambem `groupOwners.includes(u.id)` alem de `ownsTeam.has(u.id)`. Contagem de alunos continua via `subtree_student_ids(node.id)` (UNION ALWAYS, identico ao path de analytics). Nenhuma alteracao no gate nem no fallback de focus.

### 4. `apps/web/src/app/(platform)/dashboard/_components/team-view-switch.tsx` (MODIFICAR, so comentario)

Corrigir o bloco de cabeçalho (linhas 11-13) para: "'Times abaixo' e exclusivo do modo Hierarquia (Iteração 3); no modo Diretos ele nao e renderizado. O breadcrumb (trilha de drill) permanece nos dois modos." Sem mudanca de codigo executavel.

### Contrato exportado para S3 (documental, sem novo arquivo)

- **Componente:** `TeamScopeControl` + `TeamScopeControlProps` (arquivo novo item 1). A S3, ao renderizar o Analytics em contexto de time, importa `TeamScopeControl` e o monta com o mesmo `trail`/`rootId`/`mode`/`isRoot`/`focusedLabel` resolvidos por `resolveDrilldownNav` + `getTeamViewMode` server-side.
- **Estado:** eixo Diretos/Hierarquia vive em `x-team-view` (`team-view-context.ts`, `getTeamViewMode`/`setTeamViewMode`, action `setTeamView`); eixo drill vive em `?focus` (querystring, gate `auth_subtree_user_ids()`). A S3 NAO cria estado novo, reusa esses dois. O SSR do Analytics ja le `?focus` + `getTeamViewMode` (analytics/page.tsx:117-147), entao o contrato ja bate.

## Dados-RLS-Seguranca

- **Nao ha nova rota, nova tabela ou nova policy nesta story.** `resolveGroupOwningNodes` le `manager_groups` e `manager_group_members` sob o MESMO client autenticado (RLS) que `resolveDrilldownNav` ja usa (org-tree.ts:67-73 roda no client autenticado do gestor). O gate `auth_subtree_user_ids()` continua sendo a trava: todo node devolvido e intersectado com `allowed`, entao um `?focus` forjado ou um group-owner fora do subtree colapsa para a raiz / nao aparece (fail-closed, org-tree.ts:20-23 permanece valido).
- **Limitacao conhecida (D6b):** `mg_select` (`20260604140000_fix_area_gestor_rls.sql:40-48`) gateia `manager_groups` por `auth_user_role()` SINGULAR. Um multi-chapeu na lente Gestor cujo role singular NAO esta em {admin, manager, instructor} e que nao e `manager_id` do grupo nao consegue ler a linha de `manager_groups` de um sub-gestor, entao esse group-owner node fica invisivel. Isso e fail-closed (esconde, nunca alarga reach) e esta ligado ao problema de role singular que a S5 possui (a S5 e dona de migrar gates para union; migrar `auth_user_role()`/`mg_select` para union esta FORA DE ESCOPO desta story e da S5, apenas sinalizado como divida).
- **Sem service client:** `resolveGroupOwningNodes` NUNCA usa o service client. Toda leitura passa por RLS. Nao ha novo escape multi-chapeu introduzido; o unico gate continua sendo `auth_subtree_user_ids()` + RLS de leitura.
- **Multi-chapeu / lente:** esta story consome o conceito de lente de S1 apenas indiretamente (o dashboard so renderiza `ManagerTeamDashboardPage` quando o roteador ja resolveu contexto de time; a decisao de papel e de S1/S3). Esta story NAO le `profile.role` e NAO decide papel; se precisar de qualquer decisao de papel, consome `hasRole`/o helper de lente de S1.

## Acceptance Criteria (numerados)

1. Existe `TeamScopeControl` em `team-scope-control.tsx`, client component, exportado, cujo render e o cabeçalho "Recorte da equipe" (rotulo + frase-resumo + `OrgDrilldownBreadcrumb` + `TeamViewSwitch`), SEM `SubtreeNodeList` e SEM a strip de engajamento.
2. `manager-team-dashboard-page.tsx` consome `TeamScopeControl` (nao ha mais o `<div>` inline de cabeçalho de recorte), e o render final da pagina do time e visualmente identico ao anterior: mesma frase-resumo por (mode, isRoot, focusedLabel), Hierarquia mostra "Times abaixo" antes da strip, Diretos mostra so a strip.
3. O eixo Diretos/Hierarquia continua persistindo em `x-team-view` via `setTeamView` e o eixo drill continua em `?focus`; nenhum estado novo foi introduzido. `TeamScopeControl` e puro (recebe estado por props resolvidas server-side, sem ler cookie/URL diretamente).
4. `resolveDrilldownNav` na raiz lista, em "Times abaixo", tanto sub-gestores ligados por `reports_to` quanto group-owner nodes (ligados por `manager_group`), todos com contagem de alunos correta via `subtree_student_ids`, ordenados por nome.
5. Um group-owner que NAO tem aresta `reports_to === managerId` mas cujos alunos alcançam o gestor por `manager_group_members` APARECE em "Times abaixo" (teste red-first de D6a), estritamente dentro do subtree autorizado.
6. Todo node surfaceado por `resolveDrilldownNav` (incluindo os novos group-owners) esta contido em `allowed` (`auth_subtree_user_ids()`); um `?focus` forjado ou node fora do subtree continua colapsando para a raiz (AC6/AC7 originais de E9 preservados). Nenhum node fora do subtree e nomeado ou contado.
7. `resolveGroupOwningNodes` nao usa service client, le so via RLS, e para um multi-chapeu cujo role singular diverge de {admin, manager, instructor} e que nao e `manager_id` do grupo, o group-owner node nao aparece (fail-closed), com comentario no codigo apontando a limitacao `mg_select`/`auth_user_role()` singular (D6b) e a ligacao com a S5.
8. O comentario de cabeçalho de `team-view-switch.tsx` reflete que "Times abaixo" e exclusivo de Hierarquia; nenhum comportamento executavel mudou nesse arquivo.
9. O contrato compartilhado esta documentado: a S3 consegue montar `TeamScopeControl` com `trail`/`rootId`/`mode`/`isRoot`/`focusedLabel` e reusar `x-team-view` + `?focus` sem criar estado novo.
10. Nenhuma das outras stories e invadida: nada de lente/switcher (S1), nada de gate/trava de seguranca ou assinatura de `resolveCallerStudentScope` (S5), nada de nav-move/SSR-union/UnitComparison (S3), nada de escopo da pagina de Engajamento (S4).

## Plano de testes (first-move rule)

RED-FIRST obrigatorio para D6a (o defeito primario desta story):

1. **`apps/web/src/lib/__tests__/org-tree.test.ts` (estender):**
   - **RED (novo):** cenario com um group-owner (ex.: "Gil") que possui um `manager_groups` cujos membros (alunos) reportam ao gestor via `manager_group_members`, mas `Gil.reports_to !== RAFAEL` (ligado ao gestor apenas por group, sem aresta reports_to direta). Adicionar ao double `makeClient` as tabelas `manager_groups` e `manager_group_members`. Assertar `nav.subteams` inclui "Gil" com `studentCount` correto. Este teste FALHA na implementacao atual (candidate pool so olha `reports_to`) e passa apos D6a.
   - Regressao: manter os 3 testes existentes verdes (Bia/Caco via reports_to com `user_roles=[]`; leaf manager sem subteams; breadcrumb ancora na raiz).
   - Fail-closed: cenario onde a leitura de `manager_groups` devolve `[]` (simulando `mg_select` negando) → o group-owner NAO aparece, sem erro, "Times abaixo" ainda lista os que vem por `reports_to`.
2. **`team-scope-control.tsx` (novo teste de componente, ex.: `__tests__/team-scope-control.test.tsx`):** renderiza breadcrumb + switch, NAO renderiza "Times abaixo" nem strip; frase-resumo correta para (Diretos/raiz), (Hierarquia/raiz), (Diretos/subteam), (Hierarquia/subteam); componente e puro (nao chama cookies/fetch).
3. **`manager-team-dashboard-page` (regressao visual/estrutural):** garantir que o refactor mantem a ordem de render (Hierarquia: subtree list antes da strip; Diretos: so strip) e que `TeamScopeControl` recebe as props corretas resolvidas por `resolveDrilldownNav` + `getTeamViewMode`.
4. **Contrato S3:** teste leve que importa `TeamScopeControl` + `TeamScopeControlProps` de fora do dashboard (simulando o consumo da S3) e monta com props stub, provando reutilizabilidade sem estado novo.
5. Rodar `pnpm --filter web test` (vitest) e `pnpm --filter web typecheck` verdes.

## Dependencias

- **S1 (lente de papel):** esta story consome o conceito de lente/`hasRole` de S1 se precisar de qualquer decisao de papel; NAO define lente. Ordem de sequenciamento: S5 → S1 → **S2** → S3.
- **S5 (seguranca):** esta story NAO migra nenhum gate; apenas documenta a limitacao `mg_select`/`auth_user_role()` singular como divida ligada a S5. Nao depende de S5 landing antes, mas nao pode reintroduzir/re-migrar gate que S5 possui.
- **S3 (nav-move/SSR/Analytics em Gestão do Time):** DEPENDE deste contrato (`TeamScopeControl` + `x-team-view`/`?focus`). S2 exporta, S3 consome. S3 vem depois de S2.
- Infra existente: `resolveDrilldownNav`, `getTeamViewMode`/`setTeamView`, `OrgDrilldownBreadcrumb`, `TeamViewSwitch`, `SubtreeNodeList`, `manager_groups`/`manager_group_members` (schema `20260530130000`), gate `auth_subtree_user_ids()` (E3).

## Riscos

- **Maior risco:** a correcao D6a em `resolveGroupOwningNodes` alargar reach por engano se a intersecao com `allowed` for afrouxada. Mitigacao: TODO node devolvido e re-filtrado por `allowed.has(id)` antes de virar candidate; teste AC6 explicito de que nenhum node fora do subtree aparece; leitura sempre via RLS client, nunca service.
- **Risco de regressao visual:** o refactor de extrair `TeamScopeControl` mudar sutilmente o layout do painel de recorte. Mitigacao: mover o JSX identico (mesmas classes Tailwind), teste estrutural de ordem de render, revisao lado a lado.
- **Risco de contrato:** S3 assumir um shape de props diferente do exportado. Mitigacao: `TeamScopeControlProps` exportado e tipado; teste de consumo cross-story (item 4 dos testes).
- **Limitacao aceita (nao risco a corrigir aqui):** `mg_select` singular esconde group-owners de certos multi-chapeus (D6b). Fail-closed, ligado a S5, fora de escopo migrar.