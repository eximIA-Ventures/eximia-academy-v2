# CFG-3.1 — Cargos em fidelidade ao mockup

> **Status:** Ready (F5 aplicado — ACs 1 e 6 reescritos como comportamento, gate humano de paridade visual explicitado) · **Tier:** 1 · **Tamanho:** L (drawer novo + 2 enriquecimentos de query + mudança de regra de escrita) · **Depende de:** CFG-1.1 (a sub-rota `/admin/configuracoes/cargos` precisa existir — D5)
> **Fonte:** `docs/architecture/configuracoes-publicacao-fase1.md` §3.4 · `JARVIS/apps/hub-discovery/RESULT-cargos.md` + `SPEC-cargos-v2.md` (fidelidade alvo do mockup, provada com harness ALL PASS 47+1+6)
> **Migrations:** NENHUMA nesta story (o vínculo múltiplo cargo↔trilha e a camada de departamento ficam fora, ver ACs "fica para depois").

## Contexto

A seção Cargos hoje (`/admin/job-roles`, componente `JobRolesClient`) é uma lista agrupada por área funcional, com Editar/Excluir sempre visíveis e sem drawer. O mockup (fidelidade provada em `RESULT-cargos.md`) eleva isso a: busca por trilha, filtros por senioridade, stats clicáveis, drawer com trilhas vinculadas + pessoas do cargo, exclusão com reatribuição em massa, e Sugestões da IA. Esta story porta esse COMPORTAMENTO para o produto real (dados reais do Supabase, não os seeds JS do mockup), no que for possível SEM esquema novo — o que depende de CFG-2.1 (departamento) ou de vínculo N:N cargo↔trilha fica marcado como fora de escopo.

## Acceptance Criteria

1. **(comportamento, F5)** Lista agrupada por área (grupo "Sem área" por último). Cada grupo é colapsável individualmente. Contagem real "N cargos · N pessoas" no cabeçalho de cada grupo. O estado de colapso/expansão de cada grupo **persiste entre navegações** (sair da tela de Cargos e voltar preserva quais grupos estavam abertos e quais estavam fechados). Grupo sem nenhum cargo correspondente ao filtro/busca ativo **some da lista** (não aparece vazio). A referência visual (ícone de expansão, motion de colapso) é `SPEC-cargos-v2.md` §G3, citada em Dev Notes — não é critério de aceite; o comportamento acima é o que o gate mecânico prova.
2. Busca casando nome, descrição E nome de trilha vinculada (não apenas nome do cargo) — equivalente real de `listJobRolesWithStats` (`apps/web/src/app/(platform)/admin/job-roles/actions.ts`) enriquecido com os nomes de trilha, hoje só contados (`active_trails_count`), nunca listados por nome na tela.
3. Filtro por área (select, valores derivados das áreas do tenant) e filtro por senioridade (chips segmentados: Junior · Pleno · Senior · Lead · Gestor — os 5 níveis já existentes em `seniority_level`).
4. Stats clicáveis viram filtros rápidos com chip de filtro ativo removível (clicar em "N cargos sem trilha" aplica o recorte; "Cargos cadastrados" limpa todos os filtros).
5. Linha de cargo: nome + pill de senioridade (cores já existentes no mockup/produto), descrição truncada em 1 linha (title com o texto completo), **chips de trilha por NOME** (máx 2 visíveis + "+N", derivados de `learning_trails.target_job_role_id` real — hoje só a contagem é real, o nome nunca é resolvido na tela), **contagem de pessoas com mini-avatares** (máx 3 + "+N", derivada de `users.job_role_id` real, entregue em CFG-0.1), dot de governança quando SEM trilha ativa OU SEM pessoas vinculadas.
6. **(comportamento, F5)** Drawer do cargo abre ao clicar na linha, construído com os componentes do design system do produto (não é preciso reusar HTML/CSS/motion do mockup — a referência de layout é `.uv-drawer` em `SPEC-cargos-v2.md`, citada em Dev Notes). O drawer contém, verificáveis por bloco presente: cabeçalho com nome + pill de senioridade + área; descrição completa (editável em modo Editar); bloco "Trilhas vinculadas" (lista com remover ×, "+ Vincular trilha" com select das trilhas do tenant); bloco "Pessoas com este cargo" (avatar+nome+área) com ação "Mover pessoas de cargo…" (reatribuição em massa ou por pessoa, incluindo "Fica sem cargo"); bloco de sugestões (ex.: cargo sem trilha → sugerir trilha viva da mesma área; pessoas sem a trilha do cargo → sugerir vínculo); ações no rodapé (Editar/Salvar, Duplicar, Excluir, Fechar). **Gate humano (paridade visual):** onde a fidelidade ao motion/espaçamento do mockup importar de verdade (abertura do drawer, hierarquia visual dos blocos), a aprovação é do Hugo comparando com `configuracoes-hub.html` (seção Cargos) antes do merge — não é um AC que o dev marca sozinho.
7. "Novo cargo" abre o mesmo drawer em modo criação; "Duplicar" cria "Nome (cópia)" sem pessoas vinculadas.
8. **Excluir com reatribuição** (gap real hoje, o delete BLOQUEIA com `"Nao e possivel excluir: N trilha(s) ativa(s) vinculada(s)"`, `apps/web/src/app/(platform)/admin/job-roles/actions.ts:174`): substituir o bloqueio duro por um fluxo de confirmação que mostra o aviso, oferece reatribuição de PESSOAS (por pessoa ou em massa, incluindo "fica sem cargo") antes de excluir, e só bloqueia de fato se ainda houver trilha ATIVA vinculada ao cargo após a reatribuição de pessoas (a regra de "trilha ativa vinculada" impede exclusão continua existindo — o que muda é a UX de pessoas, não a regra de trilha).
9. Cargo já entregue tem área/senioridade/descrição/trilhas — **não regredir para um CRUD de 1 campo** (ressalva explícita do plano, §3.4).

## Fica para depois (fora de escopo desta story, registrado para não reabrir)

- Vínculo múltiplo cargo↔trilha (hoje `learning_trails.target_job_role_id` é 1 cargo por trilha — "+ Vincular trilha" escolhendo trilha de outro cargo MOVE, não adiciona; vínculo N:N exigiria tabela de junção nova, fora desta story).
- Renomear o campo "Área" do cargo para "Área (departamento)" — não fazer antes de CFG-2.1 existir, o rótulo mentiria sobre o dado (`job_roles.area_id` aponta para `areas`, que hoje é UNIDADE na Cory).

## Dev Notes

- Fonte de dados real: `apps/web/src/app/(platform)/admin/job-roles/actions.ts` — `listJobRolesWithStats()` já enriquece com `area_name` e `active_trails_count`; falta enriquecer com nomes de trilha (não só contagem) e com pessoas (join com `users.job_role_id`, disponível desde CFG-0.1).
- Guard: `admin/job-roles/page.tsx:21` libera `["manager","admin","instructor","super_admin"]` — a sub-rota do hub (`/admin/configuracoes/cargos`) é admin-tier (CFG-1.1), então este nível de acesso mais amplo continua servido pela rota ANTIGA (`/admin/job-roles`), preservada por D3. Esta story edita o COMPONENTE reusado (`JobRolesClient` ou o que vier a substituí-lo), então qualquer mudança de comportamento aparece nas DUAS rotas — não introduzir um comportamento que dependa de ser admin quando o componente também é renderizado para manager/instructor via a rota antiga.
- Bloqueio de exclusão hoje: `apps/web/src/app/(platform)/admin/job-roles/actions.ts:156-174` (`deleteJobRole`), mensagem exata `"Nao e possivel excluir: N trilha(s) ativa(s) vinculada(s)"`.
- Fidelidade de comportamento (não de pixel): `RESULT-cargos.md` documenta 47+1+6 asserts ALL PASS no mockup — usar como especificação funcional de referência para os testes desta story, adaptando ao design system real do produto (não copiar HTML/CSS do mockup).
- **Referência visual (F5, não critério de aceite):** `SPEC-cargos-v2.md` §G3 usa um ícone chevron para indicar expansão/colapso do grupo, e o mockup nomeia o padrão de painel lateral `.uv-drawer`. Ambos são pista de layout para quem implementa, adaptados ao design system real do produto (não copiar classe/HTML/motion do mockup) — o gate mecânico do AC1/AC6 prova comportamento (persistência de colapso, grupo some sem match, blocos presentes no drawer), a paridade visual fica com o gate humano do AC6.

## Gate

> **Correções de gate do @po (verificadas em disco):** (a) `npx vitest` não roda na raiz (binário só em `apps/web` e `packages/shared`); (b) **não existe nenhum arquivo de teste sob `apps/web/src/app/(platform)/admin/job-roles`** — o comando original passaria por "verde" sem executar um único assert; (c) o path de biome `(platform)/configuracoes/cargos` está errado — por D5 o hub é `(platform)/admin/configuracoes/cargos`.

```bash
npx tsc --noEmit -p apps/web/tsconfig.json ; echo "exit=$?"
cd apps/web && npx vitest run src/app/\(platform\)/admin/job-roles 2>&1 | tail -15   # PRÉ-REQUISITO: criar o arquivo de teste — hoje não existe nenhum aqui
npx biome check "apps/web/src/app/(platform)/admin/job-roles" "apps/web/src/app/(platform)/admin/configuracoes/cargos"
grep -n "Nao e possivel excluir" "apps/web/src/app/(platform)/admin/job-roles/actions.ts"   # revisar: mensagem/fluxo atualizados conforme AC8
```

> **Gate novo exigido pelo @po (bloqueante para o AC8):** o AC8 muda a regra de exclusão de cargo — uma mudança de comportamento de escrita que hoje **não tem nenhum teste** e que aparece nas DUAS rotas (hub admin-tier e `/admin/job-roles`, viva para `manager`/`instructor` por D3). Criar `apps/web/src/app/(platform)/admin/job-roles/__tests__/delete-job-role.test.ts` cobrindo: (i) exclusão com pessoas vinculadas → oferece reatribuição e conclui; (ii) exclusão com trilha ATIVA vinculada → continua bloqueada (a regra de trilha não muda); (iii) reatribuição "fica sem cargo" zera `users.job_role_id` sem apagar o usuário. Sem esse arquivo, o gate desta story é decorativo.

## Estado dos ACs após a implementação (Dex, @dev, 2026-07-28)

| AC | Estado | Prova |
|:--|:--|:--|
| 1 | Implementado | `job-roles-view-model.test.ts` ("Sem área" por último, grupo sem match some, contagem real) + `job-roles-client.test.tsx` (colapsar → desmontar → montar de novo mantém o grupo fechado, e só ele) |
| 2 | Implementado | `matchesSearch` casa nome, descrição e **nome de trilha**: "venda" acha Vendedor Interno pela trilha "Técnicas de Venda" |
| 3 | Implementado | filtro de área (com o recorte explícito "Sem área") + chips dos 5 níveis de `seniority_level` |
| 4 | Implementado | stats clicáveis ("sem trilha", "sem pessoas"), chip removível, "Cargos cadastrados" limpa tudo |
| 5 | Implementado | linha com chips de trilha POR NOME (máx 2 + "+N"), mini-avatares (máx 3 + "+N"), descrição truncada com `title`, dot de governança com explicação |
| 6 | **Comportamento implementado · paridade visual PENDENTE DE GATE HUMANO** | os 6 blocos existem e são verificados por `data-testid` no teste de render. A aprovação de motion/espaçamento/hierarquia contra `configuracoes-hub.html` é do Hugo, e **não está marcada como cumprida** |
| 7 | Implementado | "Novo cargo" abre o MESMO drawer em modo criação; `duplicateJobRole` cria "Nome (cópia)" sem pessoas e sem trilhas |
| 8 | Implementado | `delete-job-role.test.ts` (10 asserts): reatribuição conclui, "fica sem cargo" zera `job_role_id` sem apagar ninguém, sem destino a exclusão é RECUSADA, trilha ativa continua bloqueando **e bloqueia antes de mover qualquer pessoa** |
| 9 | Não regrediu | área, senioridade, descrição e trilhas continuam no drawer; nada virou CRUD de 1 campo |

### Guard de escrita — CORRIGIDO com GO do dono (2026-07-28)

> A seção seguinte descreve o defeito **como ele era**. Ele foi corrigido nesta mesma story, numa rodada posterior, com **GO explícito do dono em 2026-07-28** e a justificativa dele: sem a correção, a tela de Cargos subia inutilizável para o dono do produto. A correção foi aplicada com as **duas metades juntas**, como exigido:

**Metade 1 — o eixo.** `requireContentRole` (coluna singular `users.role`, sem `super_admin`) foi substituída por `requireJobRoleWriter`, que decide sobre a **união de chapéus** (`user_roles`, via `getAuthProfile().roles`) com `hasAnyRole` — o mesmo eixo de `lib/admin-route-access.ts` (guard de página) e `lib/api-auth/require-admin.ts` (guard de rota de API). O conjunto agora é `["manager","admin","instructor","super_admin"]`, **idêntico ao que a rota já usava para LER** (`ADMIN_ROUTE_ROLES["/admin/job-roles"]`): era exatamente essa assimetria ler-por-chapéu / gravar-por-coluna que produzia o defeito. **As duas formas NÃO coexistem** — não sobrou nenhum caminho de escrita nesta seção consultando `profile.role` singular, então não há o que registrar como convivência.

**Metade 2 — a empresa.** O guard devolve a empresa **resolvida** (`resolveTenantId`: tenant próprio → cookie `x-sa-active-tenant` do seletor → primeira empresa pela ordem canônica), e `createJobRole` grava `tenant_id: ctx.tenantId` em vez de `roleCheck.tenantId`. Quando nenhuma empresa é resolvível, a operação é **recusada** com `"Nenhuma empresa ativa: selecione uma empresa antes de gravar"` — nunca grava nulo.

**Escopo de empresa em TODA escrita (consequência obrigatória da metade 1).** `jr_super_admin` é um bypass `FOR ALL`, então alargar o guard sem escopar a escrita deixaria o dono alcançar cargo de **qualquer** empresa por id, ignorando a que escolheu no seletor. Por isso cada escrita ganhou `.eq("tenant_id", ctx.tenantId)`: update, delete, duplicar, vincular/desvincular trilha e reatribuição de pessoas.

**O que a correção NÃO faz:** não mexe em RLS. O banco continua decidindo por `auth_user_role()` (`jr_content_role_all`) e pelo bypass de super_admin. Chapéu de escrita com coluna singular divergente passa no app e é recusado no banco — falha fechada, o lado certo de errar. E **nenhum outro guard foi tocado**: `admin/plans/actions.ts`, `admin/manager-groups/actions.ts` e `admin/users/enrollment-actions.ts` seguem byte-idênticos ao HEAD, verificado por `git diff --quiet HEAD --`.

**Inversão deliberada do teste.** O bloco de teste que travava o comportamento ANTIGO ("perfil sem chapéu de conteúdo é recusado") foi reescrito para provar o NOVO, com as três fronteiras exigidas: (a) cargo criado pelo dono nasce com a empresa do seletor, nunca nula (idem duplicar); (b) sem empresa resolvível, a operação é recusada e nada é gravado; (c) ninguém alcança cargo de empresa alheia (idem o destino da reatribuição). Somam-se a isso a prova de eixo (perfil com `users.role = "student"` e chapéu `admin` **escreve**, provando que quem decide é a união) e a de que chapéu sem direito continua recusado. **Prova por mutação:** removendo `super_admin` da lista, **7 testes falham**; removendo o `.eq("tenant_id", …)` do delete, a fronteira (c) falha. Restauração conferida por `shasum` idêntico nas duas vezes.

### Como o defeito era, antes do GO (registro histórico)

`admin/job-roles/actions.ts` → `requireContentRole` admitia `["manager","admin","instructor"]` e **excluía `super_admin`**. Toda ação de escrita desta tela passava por ele (`createJobRole`, `updateJobRole`, `duplicateJobRole`, `linkTrailToJobRole`, `unlinkTrailFromJobRole`, `reassignJobRolePeople`, `deleteJobRoleWithReassignment`), então o dono do produto **via** os cargos da empresa selecionada e recebia "Permissão negada" em todas elas — inclusive na exclusão com reatribuição que esta story entrega. Na rodada de entrega, esse comportamento foi deliberadamente travado por teste, para que a correção viesse a ser deliberada e não acidental; foi esse teste que a rodada do GO inverteu, de propósito e com registro.

O diagnóstico de que o conserto exigia **duas coisas juntas** (guard por chapéus **e** `tenant_id` de inserção por `resolveTenantId`, já que `createJobRole` gravava `tenant_id: roleCheck.tenantId`, que seria `null` para esse perfil) foi o que o dono aprovou em 2026-07-28. As duas foram aplicadas na mesma rodada, com gate próprio, como descrito acima.

### Decisões de implementação que valem registro

- **Ordem da exclusão:** a trilha ativa é checada ANTES de mover uma única pessoa. O AC8 admitia ler "reatribui e depois bloqueia"; isso deixaria N pessoas reatribuídas por causa de um delete que nem aconteceu. O resultado observável é o mesmo (trilha ativa impede excluir), sem o meio-estado destrutivo.
- **Chips mostram toda trilha vinculada; o dot olha só as ATIVAS.** Esconder do chip uma trilha em rascunho faria o vínculo sumir da tela sem explicação.
- **Vínculo 1:1 continua sendo 1:1.** "+ Vincular trilha" MOVE o vínculo quando a trilha já é de outro cargo, e a tela diz isso em texto. Vínculo N:N segue fora de escopo.
- **`ReassignPeopleFields` é um componente só**, usado pelo drawer e pela exclusão: duas cópias da mesma pergunta divergiriam, e a que divergisse voltaria a apagar vínculo por omissão.

## File List

| Arquivo | Ação |
|:--|:--|
| `apps/web/src/app/(platform)/admin/job-roles/actions.ts` | modificado (leitura enriquecida; `listTenantTrails`, `deleteJobRoleWithReassignment`, `reassignJobRolePeople`, `duplicateJobRole`, `linkTrailToJobRole`, `unlinkTrailFromJobRole`) |
| `apps/web/src/app/(platform)/admin/job-roles/types.ts` | novo (contratos fora do módulo `"use server"`) |
| `apps/web/src/app/(platform)/admin/job-roles/job-roles-view-model.ts` | novo (busca, filtros, stats, agrupamento, sugestões, colapso persistente — tudo puro) |
| `apps/web/src/app/(platform)/admin/job-roles/job-roles-client.tsx` | reescrito (lista v2) |
| `apps/web/src/app/(platform)/admin/job-roles/_components/job-role-drawer.tsx` | novo |
| `apps/web/src/app/(platform)/admin/job-roles/_components/delete-job-role-dialog.tsx` | novo |
| `apps/web/src/app/(platform)/admin/job-roles/_components/reassign-people-fields.tsx` | novo (compartilhado pelo drawer e pela exclusão) |
| `apps/web/src/app/(platform)/admin/job-roles/loader.ts` | modificado (passa a compor o catálogo de trilhas) |
| `apps/web/src/app/(platform)/admin/job-roles/page.tsx` | modificado (repassa `trails`) |
| `apps/web/src/app/(platform)/admin/configuracoes/cargos/page.tsx` | modificado (repassa `trails`) |
| `apps/web/src/app/(platform)/admin/job-roles/__tests__/delete-job-role.test.ts` | novo (gate bloqueante do AC8) |
| `apps/web/src/app/(platform)/admin/job-roles/__tests__/job-roles-view-model.test.ts` | novo |
| `apps/web/src/app/(platform)/admin/job-roles/__tests__/job-roles-client.test.tsx` | novo |

## Change Log
| Data | Evento |
|:--|:--|
| 2026-07-25 | Story criada por River (@sm) a partir de `configuracoes-publicacao-fase1.md` §3.4 e da fidelidade provada em `RESULT-cargos.md`/`SPEC-cargos-v2.md`. |
| 2026-07-25 | Validada por Pax (@po): **GO condicional, 8/10.** Fixes aplicados: path do hub corrigido para `/admin/configuracoes/cargos` (D5), gate de vitest corrigido (não rodava — nem binário na raiz, nem teste no diretório), tamanho declarado, e gate de teste do AC8 tornado obrigatório (mudança de regra de escrita sem teste, visível também na rota liberada para `manager`/`instructor`). Pendente para virar `Ready`: AC1 e AC6 ainda importam vocabulário de motion do mockup (`chevron`, `.uv-drawer`) — o critério de aceite é **comportamento** (colapso persiste, drawer abre com os blocos X/Y/Z), nunca paridade de pixel/motion; explicitar isso antes do dev pegar. |
| 2026-07-28 | **Implementada por Dex (@dev).** ACs 1-5 e 7-9 entregues e provados por 44 asserts em 4 arquivos (3 novos + o `tenant-scope.test.ts` existente, que NÃO regrediu com a leitura enriquecida). AC6: comportamento entregue e provado por bloco; **paridade visual segue PENDENTE de gate humano do Hugo**, conforme o F5. Esbarrei no defeito do guard de escrita (`requireContentRole` sem `super_admin`) e **não o corrigi** — documentado acima e travado por teste. Gates finais: `tsc` **exit=0 no repositório inteiro**, `vitest` **44/44 verdes**, `biome` com 1 erro + 1 warning **pré-existentes e confirmados contra HEAD** (`toSlug` com classe de caracteres enganosa em `actions.ts`; index key em `loading.tsx`) — meu código está limpo e uma violação pré-existente (`noNonNullAssertion`) morreu junto com o código que a continha. `build` **não rodado por instrução do lead** (o build integrador é rodado uma vez, no fim, para todos). Nenhum commit. |
| 2026-07-28 | **`users.avatar_url` removida do select e classe de erro engolido fechada (Dex, @dev).** A coluna é declarada em `packages/database/src/schema/users.ts` e NUNCA foi criada por migration: pedi-la fazia o PostgREST recusar a consulta inteira (`42703`), e como o código só desestruturava `data`, o bloco "Pessoas com este cargo" voltava VAZIO em produção — com o agravante de que a exclusão lia pessoas por outro select (sem `avatar_url`) e portanto **encontrava** as mesmas pessoas: a tela dizia "sem pessoas" e o Excluir exigia destino para gente que a tela nunca mostrou. Decisão do dono: remover do código, não criar a coluna (zero fotos em produção; o avatar já cai na inicial). Varri o resto do arquivo pela MESMA classe e achei três leituras que falhavam **abertas** no caminho destrutivo — trilhas ativas, pessoas vinculadas e o invariante de sobras: com `data: null` a contagem virava 0 e a exclusão era AUTORIZADA por uma leitura quebrada. As três agora cancelam. Novo `__tests__/read-errors.test.ts` (7 asserts) trava a classe com um mock que sabe FALHAR — o mock dos testes de escrita sempre devolve sucesso e por construção nunca pegaria isto. Mutação: removendo a checagem do caminho destrutivo, o teste cai. Território: 59 asserts, `tsc` exit=0. |
| 2026-07-28 | **Guard de escrita corrigido por Dex (@dev), com GO explícito do dono nesta data.** As duas metades juntas: eixo de CHAPÉUS (`requireJobRoleWriter` com `hasAnyRole` sobre `user_roles`, incluindo `super_admin`, substituindo `requireContentRole` sobre a coluna singular) e empresa RESOLVIDA (`resolveTenantId`, com recusa explícita quando não há empresa, em vez de gravar `tenant_id` nulo). Como consequência obrigatória de alargar o guard sob o bypass `jr_super_admin`, toda escrita passou a ser escopada por `.eq("tenant_id", ctx.tenantId)`. **O teste que travava o comportamento antigo foi invertido de forma deliberada** e ampliado com as três fronteiras (empresa correta na criação, recusa sem empresa, nenhum alcance a empresa alheia) — 18 asserts no arquivo, 52 no território. Prova por mutação: tirar `super_admin` derruba 7 testes; tirar o escopo de empresa do delete derruba a fronteira (c). Nenhum outro guard tocado (`plans`, `manager-groups`, `enrollment-actions` byte-idênticos ao HEAD). `tsc` exit=0, `vitest` 52/52. Nenhum commit. |
| 2026-07-28 | **F5 aplicado por River (@sm).** AC1 reescrito de "padrão visual/motion do `SPEC-cargos-v2.md` §G3 (chevron, colapso persistente, grupos sem match somem)" para 3 comportamentos verificáveis: colapso persiste entre navegações, grupos sem match somem, contagem real no cabeçalho — vocabulário de motion (`chevron`) movido para Dev Notes. AC6 reescrito para descrever os blocos observáveis do drawer (cabeçalho, trilhas, pessoas, sugestões, ações) sem depender de reusar `.uv-drawer`; onde a paridade visual/motion importa de verdade, virou **gate humano explícito** (Hugo aprova comparando com o mockup), não um AC que o dev marca sozinho. Nenhuma intenção funcional mudou — só a fronteira entre o que é gate mecânico e o que é aprovação visual. Status sai de `Draft` para `Ready`, conforme o próprio GO condicional do @po de 2026-07-25 previa. |
| 2026-07-28 | **Gate independente do guard de escrita por Quinn (@qa): GO, 9.5/10.** Veredito registrado em `## QA Results` abaixo. As duas metades verificadas no código, a preocupação de escalação de privilégio **PROCEDE e foi provada por mutação própria** (sem o escopo de empresa, excluir cargo de empresa alheia devolve `{success:true}`), prova de mutação do @dev reproduzida integralmente (7 e 1), arquivo restaurado por edição direta com `shasum` conferido, nenhum commit. |

## QA Results

**Gate independente — Quinn (@qa), 2026-07-28. Veredito: GO. Nota 9.5/10.**

Revisor não é o autor. Alvo: correção do guard de escrita de cargos, em caminho de ESCRITA de produção (`argos.eximiaacademy.com.br`).

**Nota de estado, registrada por honestidade:** o briefing previa árvore suja com 220+ arquivos. Ao iniciar o gate a árvore estava **limpa** — as 5 frentes foram commitadas às 16:28-16:29 (`5fedd17`, `d0974db`, `7afc3f6`, `d9f8924`, `13aaf1c`), e esta correção está dentro de `d9f8924`. O alvo da revisão passou a ser o diff commitado; o conteúdo auditado é byte a byte o mesmo. Nenhum comando git alterou a árvore.

### 1. As duas metades

| Metade | Veredito | Evidência |
|:--|:--|:--|
| Eixo de chapéus | **Correta** | `requireJobRoleWriter` decide por `hasAnyRole({roles}, JOB_ROLE_WRITE_HATS)` sobre a união de `user_roles` (`actions.ts:58-71`). `getAuthProfile` compõe `effectiveRoles` de `user_roles` com fallback a `[profile.role]` (`lib/auth.ts:45-47`), então o dono (singular `super_admin`, sem linha em `user_roles`) resolve para `["super_admin"]` e passa. A lista de escrita agora é **a mesma** que a rota já usava para ler — a assimetria que causava o defeito morreu. |
| Empresa resolvida | **Correta** | `resolveTenantId(profile.tenant_id)` no guard, com `if (!tenantId) return { error: … }` **antes** de qualquer insert. |

### 2. A pergunta que mais importa — a preocupação PROCEDE

**Sim, e não por argumento: por prova.** A policy é literalmente um bypass total, sem recorte de empresa:

```sql
CREATE POLICY "jr_super_admin" ON job_roles FOR ALL
  USING (is_super_admin()) WITH CHECK (is_super_admin());
```
(`supabase/migrations/20260229000000_trails_job_roles.sql:25-26`)

Não é um caso isolado: **as três tabelas** que o caminho de escrita toca têm bypass `FOR ALL` de super_admin — `job_roles` (`jr_super_admin`), `learning_trails` (`lt_super_admin`, mesma migration:61) e `users` (`super_admin_all_users`, `20260209000000_epic11_super_admin_whitelabel.sql:69`). Ou seja: alargar o guard **sem** escopar a escrita não deixaria uma brecha, deixaria três.

Removi o `.eq("tenant_id", ctx.tenantId)` da busca do cargo no delete e rodei a suíte. Resultado:

```
× (c) ninguém alcança cargo de empresa ALHEIA
  → expected { success: true, reassigned: +0 } to deeply equal { error: 'Cargo não encontrado' }
```

O cargo de outra empresa **foi excluído com sucesso**. Sem o escopo que o @dev acrescentou, o dono do produto apagaria dado de cliente alheio passando um id, ignorando o seletor. Isso é escalação de privilégio cross-tenant real, e o @dev a fechou **na mesma rodada em que abriu a porta que a tornaria alcançável** — que é a ordem certa. O item 3 do relato dele foi trabalho **além do pedido e necessário**, não escopo inflado: sem ele, a correção autorizada teria sido um downgrade de segurança.

### 3. `tenant_id` nulo — impossível, e a recusa vem antes do insert

- `createJobRole`: guard em `actions.ts:275`, insert em `:283`. `tenant_id: ctx.tenantId`, e `ctx` só existe se `tenantId` for verdadeiro. Recusa **precede** inclusive o parse do schema.
- `duplicateJobRole`: `tenant_id: source.tenant_id`, e `source` só é alcançável já escopado (`:550`); a coluna é `NOT NULL` no schema.
- Demais escritas são `update`/`delete` e não tocam `tenant_id`.
- Varredura: `job-roles/actions.ts` é o **único** caminho de escrita em `job_roles` no app — todas as 10 outras ocorrências de `from("job_roles")` são `.select(...)`. Nenhum caminho paralelo escapa do guard.

### 4. Prova de mutação, reproduzida por mim

| Mutação | Esperado pelo @dev | Observado |
|:--|:--|:--|
| Tirar `"super_admin"` de `JOB_ROLE_WRITE_HATS` | ~7 quedas | **7 quedas exatas** (52 → 45 passando) |
| Tirar o escopo de empresa do delete | fronteira (c) cai | **1 queda, exatamente a (c)**, com o delete alheio devolvendo `success` |

Ambas revertidas por **edição direta**, nunca por git. `shasum` do arquivo antes e depois: `2114bdba3ccb4905b5633ed3970c51839e0e81f4` — idêntico. `git status` limpo.

### 5. Nenhum outro guard alargado

`plans/actions.ts`, `manager-groups/actions.ts`, `enrollment-actions.ts`: idênticos ao HEAD **e** não tocados por `d9f8924`. `courses/actions.ts` mantém seu `requireContentRole` intacto — o alargamento ficou cirurgicamente contido em cargos.

### 6. Gates

`npx tsc --noEmit` **exit=0**. `vitest` no território: **52/52 verdes** (4 arquivos), reconfirmado após a restauração.

### 7. Falha fechada — confirmada

`is_super_admin()` consulta `users.role = 'super_admin'` (coluna **singular**), e `jr_content_role_all` usa `auth_user_role()`. Logo, chapéu de escrita com coluna singular divergente passa no app e é **recusado no banco**. A afirmação 4 do @dev procede: erra para o lado seguro.

### 8. Observação (não bloqueante)

`resolveTenantId` cai, na ausência de cookie, na **primeira empresa pela ordem canônica**. Para o dono que ainda não tocou o seletor, uma criação de cargo grava nessa empresa em vez de recusar. Está mitigado por design — o cabeçalho usa a **mesma** ordenação (`orderedTenantQuery`), então o que a tela anuncia é o que ela grava — e está coberto por teste. Registro como comportamento conhecido, não como defeito desta correção.

### Conclusão

Correção **completa, contida e provada**. Fecha o defeito autorizado e, no mesmo movimento, fecha um buraco de cross-tenant que a própria correção teria aberto. **GO para deploy.**
