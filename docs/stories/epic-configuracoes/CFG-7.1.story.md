# CFG-7.1 — Unidades & Áreas em fidelidade ao mockup

> **Status:** InProgress (implementação de comportamento concluída por Dex @dev em 2026-07-28, com todos os gates mecânicos verdes; **paridade VISUAL e gestos de arrasto pendentes de gate humano do Hugo** — ver Dev Agent Record). Status anterior: Ready — CFG-2.1 está `Done`: migration `20260728120000_departments_additive_p1.sql` aplicada em produção em 2026-07-28 (GO escrito do Hugo, execução por Dara @data-engineer, validada por Pax @po 9/10). As 3 tabelas (`departments`, `department_areas`, `user_departments`) existem e respondem HTTP 200, vazias (0 linhas), RLS ligada. AC0 (pré-requisito) satisfeito.
> **Tier:** 1 · **Tamanho:** L (Mapa kanban novo + drawer de unidade + MOVER≠EXPANDIR como operação de escrita composta + Vista Lista com paridade total) · **Depende de:** CFG-1.1 (sub-rota) **e CFG-2.1** (schema `departments`/`department_areas`/`user_departments`, com `areas` permanecendo unidade) — dependência satisfeita.
> **Fonte:** `docs/architecture/configuracoes-publicacao-fase1.md` §3.3 · `JARVIS/apps/hub-discovery/RESULT-board3.md` + `SPEC-board-v3.md` (vista Mapa) e `RESULT-lista.md` + `SPEC-lista-v2.md` (vista Lista), fidelidade provada com harness ALL PASS (23 Mapa + 32 Lista + nogsap + genjutsu).

## Contexto

Esta é a seção com a maior distância entre o que existe hoje (`AreaManagementClient`: lista simples com Nome/Slug/Descrição/contagens, Criar/Editar/Excluir) e o mockup (Mapa kanban com colunas = unidades, áreas corporativas inline atravessando colunas, drawer de área e de unidade, MOVER≠EXPANDIR como gestos distintos, vista Lista com grupos colapsáveis e paridade total com o Mapa). Essa distância existia porque o mockup já modela a camada de DEPARTAMENTO (departamentos podendo aparecer em mais de uma unidade, quando corporativos) que o banco não tinha — a camada de UNIDADE já existe hoje (`areas`, intocada por CFG-2.1). **[ATUALIZADO 2026-07-28] O bloqueio foi resolvido:** CFG-2.1 está `Done` e as 3 tabelas de departamento (`departments`, `department_areas`, `user_departments`) existem em produção, vazias, RLS ligada. Esta story pode começar. O achado do @po sobre a assimetria de bypass `is_super_admin()` entre `areas` (sem bypass) e as 3 tabelas novas (com bypass) virou AC0.1 acima — é o único cuidado extra herdado do schema recém-aplicado.

## ⚠ Nota do @po (2026-07-25) — RESOLVIDA pelo @sm em 2026-07-25 (nomenclatura traduzida)

> **CFG-2.1 levou NO-GO do @po** por inverter a recomendação P1 (ela criava `units` como tabela nova e transformava `areas` em departamento; P1 manda o contrário — `areas` **fica** unidade e a tabela nova é o departamento). Todo `units` / `area_units` / `user_areas.unit_id` citado nos ACs 5-9 e no Gate desta story vinha daquele desenho recusado.
> **Resolução aplicada (@sm, 2026-07-25):** com CFG-2.1 reescrita (`areas` permanece UNIDADE; tabela nova `departments`; junção N:N `department_areas`; vínculo pessoa↔departamento em tabela nova `user_departments`, sem tocar `user_areas`), os ACs 5-9 e o Gate desta story foram traduzidos para os nomes finais, num único movimento — exatamente como esta nota recomendava. A intenção funcional não mudou, só os nomes de tabela.
> A intenção que **não** muda, independentemente do nome: coluna do kanban = **unidade** (a linha de `areas` da Cory, "Ribeirão Preto"/"Minas Gerais", tabela existente e intocada), pilha dentro da coluna = **departamento** (tabela nova `departments`), e "corporativa" = departamento presente em 2+ unidades pela junção `department_areas` (D4).

## Acceptance Criteria — pré-requisito

0. **[SATISFEITO 2026-07-28] CFG-2.1 está `Done`** (migration da camada de departamento + junção N:N aplicada, com GO do Hugo) antes de qualquer commit desta story. **Prova:** Change Log de CFG-2.1, entrada "APLICADA EM PRODUÇÃO por Dara (@data-engineer)" — `departments`/`department_areas`/`user_departments` confirmadas HTTP 200 em produção (`vaguswivhqnlbgqvnjch`), 0 linhas, RLS ligada e testada com prova de bloqueio (leitura anônima → 0 linhas mesmo com dado presente). O `grep` do Gate (abaixo) prova a existência do arquivo de migration; a prova de aplicação é este registro, não o grep.

0.1. **[NOVO, achado do @po na validação de CFG-2.1, 2026-07-28] Toda leitura de `departments` na UI DEVE filtrar `tenant_id` explicitamente — nunca delegar o recorte ao RLS.** As 3 tabelas novas (`departments`, `department_areas`, `user_departments`) têm bypass `is_super_admin()` na policy de SELECT, que a tabela `areas` (unidade) **não tem**. Consequência prática: para o `super_admin` (dono do produto, `tenant_id` NULL), uma query ingênua de `departments` sem filtro explícito devolveria departamentos de **todas** as empresas misturados no Mapa kanban, enquanto a coluna de unidades (via `areas`) viria corretamente vazia/tenant-scoped — um Mapa com colunas de 1 tenant e pilhas de N tenants, defeito silencioso e visível só em produção multi-tenant. É a mesma classe de defeito que a auditoria de escopo de tenant (rodada 4) já está corrigindo em `listJobRolesWithStats`/`listAreas` (`job_roles` ganhou `jr_super_admin`, filtro explícito). **Critério de aceite:** toda query desta story que lê `departments`, `department_areas` ou `user_departments` (loader do Mapa, loader da Lista v2, drawer de unidade, drawer de departamento) inclui `.eq("tenant_id", tenantId)` explícito no client, com `tenantId` resolvido do `profile` de quem chama — nunca confiando que o RLS sozinho faz o recorte. Gate: `grep` por toda ocorrência de `.from("departments")`/`.from("department_areas")`/`.from("user_departments")` nos arquivos novos desta story deve encontrar um `.eq("tenant_id", ...)` na mesma cadeia de query.

## Acceptance Criteria — sobem já hoje, independente de CFG-2.1 (podem ser feitas primeiro, sem esperar)

1. Lista com Nome, Slug, **Descrição em destaque** (coluna existe, produção Cory já a usa dizendo "Unidade de..." — expor com destaque na UI é o remédio mais barato para a ambiguidade semântica atual e não depende de nenhum schema novo), contagem de Usuários e de Cursos (já existe em `AreaManagementClient`, preservar).
2. Criar (nome, slug, descrição), Editar, Excluir com a confirmação atual — preservar, não regredir.
3. Detalhe de área: adicionar/remover pessoas (`user_areas`) e vincular/desvincular cursos (`course_areas`) — já existe em `admin/areas/[areaId]/_components/area-detail-client.tsx`, preservar.
4. Gate do módulo `units` continua valendo (tenant sem o módulo vê o upsell atual).

## Acceptance Criteria — dependem de CFG-2.1 (Mapa e Lista v2 de verdade)

5. **Vista Mapa (kanban)**: colunas = unidades reais (`areas`, tabela existente e intocada), pilhas de departamentos locais dentro de cada coluna, departamento corporativo (presente em 2+ `department_areas`) como barra inline atravessando as colunas cobertas (paridade com `RESULT-board3.md` R1 — nunca uma faixa separada, o dono já rejeitou esse desenho no v2).
6. **MOVER ≠ EXPANDIR como duas operações distintas** (paridade com `SPEC-board-v3.md` R2): mover o departamento de uma unidade para outra (escreve `department_areas`, removendo a linha antiga `(department_id, area_id-origem)` e criando a nova `(department_id, area_id-destino)`, e atualiza `user_areas.area_id` das pessoas vinculadas a esse departamento via `user_departments`, refletindo a unidade nova) é uma operação DIFERENTE de expandir a presença do departamento para uma unidade adicional (INSERE nova linha em `department_areas`, mantendo a antiga — o departamento passa a ser corporativo se ainda não era). Encolher = remover 1 linha de `department_areas` (o departamento deixa de estar presente numa unidade, sem ser excluído).
7. **Drawer de unidade** com Renomear, "+ Adicionar departamento" e Excluir unidade (paridade com `SPEC-board-v3.md` R3): excluir unidade (linha de `areas`) com departamentos/pessoas oferece destino (mover departamento local para outra unidade via `department_areas`, ou arquivar) e reatribuição de pessoas (`user_areas.area_id`, apontando para a unidade de destino); departamento corporativo que cobria a unidade excluída só perde aquela presença (vira local se sobrar 1 vínculo em `department_areas`).
8. **Vista Lista v2** com paridade total ao Mapa (mesmo estado, mesmas mutações — mover/expandir pela Lista reflete no Mapa e vice-versa): grupos por unidade colapsáveis, busca por área ou gestor, filtro segmentado Todas/Locais/Corporativas/Arquivadas, ações recolhidas em ⋯ (Mover para unidade…, Gerir unidades…, Renomear, Arquivar), corporativas exibidas dentro de cada unidade que cobrem com sufixo "também em {outras}" (paridade com `RESULT-lista.md`).
9. Duas armadilhas de rótulo (registradas no plano, respeitar): (a) não prometer um rótulo único "correto" para Cory e Harven sem que o dado realmente diferencie unidade de departamento — só depois que `areas` (unidade) e `departments` (departamento) estiverem de fato separadas em produção por CFG-2.1 isso é honesto; (b) não reusar `manager_groups`/`is_corporate` como motor de "área corporativa" — a área corporativa desta story é 100% modelada por `department_areas` (CFG-2.1), `manager_groups` continua sendo outra entidade ("Grupos de gestores", uma das 11 "Em breve").

## Fica para depois (mesmo com CFG-2.1 aplicada)

- Vista Mapa com IA socrática/Sugestões e snackbar Desfazer com o mesmo polish visual do mockup — a paridade FUNCIONAL (ACs 5-8) vem primeiro; motion/Coreografia de nível mockup é uma iteração de polish separada.
- Qualquer coisa da variante "Assinatura" (`configuracoes-hub-assinatura.html`) — exploratória, não é escopo desta story (ver nota no README do épico).

## Dev Notes

- Componente atual: `apps/web/src/app/(platform)/admin/areas/_components/area-management-client.tsx` (`AreaManagementClient`), detalhe em `apps/web/src/app/(platform)/admin/areas/[areaId]/_components/area-detail-client.tsx`.
- Fato de produção: a tabela `areas` já É a unidade hoje (dado real na Cory: "Ribeirão Preto", "Minas Gerais") e não muda nesta story — colunas: `id, tenant_id, name, slug, description, created_at, updated_at` (+ `UNIQUE(tenant_id, slug)`), sem `parent_id`, `manager_id`, `status`/`archived_at`. **[ATUALIZADO 2026-07-28]** As 3 tabelas de CFG-2.1 (`departments`, `department_areas`, `user_departments`) agora existem em produção, vazias (0 linhas), RLS ligada — o Mapa kanban tem de onde ler tanto as COLUNAS (unidades, via `areas`) quanto as PILHAS dentro de cada coluna (departamentos, incluindo os corporativos, via `department_areas`). Cuidado herdado do schema recém-aplicado: `departments`/`department_areas`/`user_departments` têm bypass `is_super_admin()` que `areas` não tem — ver AC0.1.
- Duas armadilhas já documentadas no plano (não redescobrir): a tela atual se auto-rotula "Unidades Gerenciais" (`admin/areas/page.tsx`) e o paywall do módulo mistura "unidades (filiais, plantas, departamentos)" numa frase só — não copiar essa confusão para o hub.
- Referência de fidelidade funcional: `RESULT-board3.md` (Mapa v3, MOVER≠EXPANDIR, drawer de unidade com Excluir, 23 asserts) e `RESULT-lista.md` (Lista v2, paridade total com o Mapa, 32 asserts) — usar como especificação de comportamento, adaptando ao design system real (não copiar HTML/CSS/GSAP do mockup, a stack de motion do produto é diferente).

## Gate

> **Correções de gate do @po (verificadas em disco):** (a) `npx vitest` não roda na raiz; (b) `"apps/web/src/app/(platform)/admin/areas"` **não contém nenhum arquivo de teste** — o comando não executava nada; os testes reais adjacentes são `src/lib/__tests__/area-context.test.ts` e `src/lib/analytics/__tests__/area-gestor.test.ts`; (c) path do hub errado (D5: `admin/configuracoes/unidades`); (d) o grep de pré-requisito prova que **o arquivo existe**, não que a migration **foi aplicada** — ver AC0.

```bash
# pré-requisito — AC0, já satisfeito (nomes finais já traduzidos pela reescrita de CFG-2.1)
grep -rln "CREATE TABLE IF NOT EXISTS departments\b" supabase/migrations/ && \
grep -rln "CREATE TABLE IF NOT EXISTS department_areas\b" supabase/migrations/ && \
grep -rln "CREATE TABLE IF NOT EXISTS user_departments\b" supabase/migrations/   # esperado: as 3 tabelas de CFG-2.1 presentes no mesmo arquivo de migration
# O grep acima só prova que o arquivo existe. A prova de aplicação em produção é o Change Log de CFG-2.1
# ("APLICADA EM PRODUÇÃO por Dara", 2026-07-28) — HTTP 200 confirmado nas 3 tabelas, ver AC0.

npx tsc --noEmit -p apps/web/tsconfig.json ; echo "exit=$?"
cd apps/web && npx vitest run src/lib/__tests__/area-context.test.ts src/lib/analytics/__tests__/area-gestor.test.ts src/app/\(platform\)/admin/areas 2>&1 | tail -20   # o 3º path não tem teste hoje — criar junto com os ACs 5-8
npx biome check "apps/web/src/app/(platform)/admin/areas" "apps/web/src/app/(platform)/admin/configuracoes/unidades"

# AC0.1 — toda leitura de departments/department_areas/user_departments filtra tenant_id explicitamente
grep -rn '\.from("departments")\|\.from("department_areas")\|\.from("user_departments")' "apps/web/src/app/(platform)/admin/configuracoes/unidades" "apps/web/src/app/(platform)/admin/areas" 2>/dev/null | while read -r hit; do echo "$hit"; done
# revisar manualmente: cada ocorrência acima precisa de um .eq("tenant_id", ...) na mesma cadeia de query
```

> **Gate novo exigido pelo @po (bloqueante para o AC6):** MOVER≠EXPANDIR é a operação de maior risco de todo o épico — mover escreve **e apaga** vínculo em `department_areas`, e ainda reatribui pessoas em `user_areas.area_id`. Precisa de teste dedicado provando as três operações separadamente (mover: some da unidade origem e aparece na destino; expandir: continua na origem E aparece na destino, virando corporativa; encolher: perde só uma presença, a entidade sobrevive), e provando que encolher a última presença **não** apaga o departamento silenciosamente.

## Dev Agent Record (Dex @dev, 2026-07-28)

### Decisões que mudam como a story deve ser lida

1. **"Arquivada" é ZERO presenças, não coluna nova.** `departments` não tem `archived_at`, e esta
   story está proibida de emitir migration. Em vez de fingir que o filtro "Arquivadas" (AC8) e a
   ação "Arquivar" não existem, ambos foram modelados pela MESMA régua que a migration escolheu
   para "corporativa": a cardinalidade de `department_areas`. **0 presenças = arquivada · 1 = local
   · 2+ = corporativa.** Isso encaixa exatamente com a exigência do Gate ("encolher a última
   presença NÃO apaga o departamento"): o que sobra depois da última remoção É o estado arquivado.

   **Fronteira desta regra, fechada em 2026-07-28 por decisão do dono.** A cardinalidade 0 funde
   três fatos: (1) arquivada de propósito, (2) encolhida até a última presença, (3) nunca vinculada.
   Para (1) e (2) a fusão é intencional e correta. Para (3) seria mentira — a tela afirmaria um
   arquivamento que nunca houve. A UI já não permitia (3) (botão desabilitado sem unidades, select
   sem opção vazia), mas a API convidava: `areaId` era `.optional()`. Levada como pergunta de
   produto, a resposta do dono foi **"não, toda área nasce em uma unidade"**, então `areaId` passou
   a ser **obrigatório** na criação. **(3) deixou de ser alcançável por qualquer superfície**, e
   "Arquivada" passa a significar exclusivamente (1) ou (2). Sobra um único caminho residual, e ele
   é declarado: os dois inserts da criação não são transação, então uma falha do segundo deixa a
   área sem unidade — e a resposta diz isso ao usuário, com o remédio ("está em Arquivadas,
   restaure-a"). Sem migration; o GO de banco ficou guardado.

   *Gatilho que reabre a discussão:* se o produto um dia quiser "área sem unidade" como estado
   **legítimo** (criar a área antes de decidir onde ela fica), (3) volta a ser alcançável **por
   design** e o rótulo errado vira defeito de produto. Aí sim a coluna `archived_at` volta à mesa,
   com GO próprio e migration própria — e o ganho extra é `restore` ficar exato e "Arquivadas"
   deixar de depender de ausência.
2. **"Gestor de área" é derivado, não é campo.** `departments` não tem `manager_id`. O gestor
   exibido (e buscável, AC8) são os membros do departamento (`user_departments`) com chapéu
   `manager`. Nenhum uso de `manager_groups` como motor de nada — AC9(b) respeitado.
3. **O Mapa e a Lista v2 sobem só em `/admin/configuracoes/unidades`.** A rota antiga
   `/admin/areas` continua com a tabela de sempre, de propósito: ela é liberada para `manager`, e as
   escritas de `department_areas` são admin-only. Dar o Mapa ao gestor seria expor botões que
   respondem 403. Efeito colateral bom: zero edição em `admin/areas/page.tsx`, que está sendo
   mexida por outra frente em paralelo.
4. **A tabela atual de unidades (ACs 1-3) não foi tocada.** `AreaManagementClient` entrou como a
   aba "Unidades" do workspace, sem uma linha alterada. Verificável: o arquivo não aparece no diff.
5. **Ordem de escrita: INSERE antes de REMOVER** (`api/admin/departments/_apply.ts`). Sem transação
   no client HTTP, uma das metades pode falhar sozinha. Inserindo primeiro, a falha deixa a área
   presente nas DUAS unidades — visível e corrigível em um clique. Removendo primeiro, ela ficaria
   em NENHUMA: sumiria do Mapa e viraria uma arquivada que ninguém pediu.

### Como MOVER foi distinguido de EXPANDIR (AC6, gate bloqueante)

A distinção é **estrutural, não convencional**, em três camadas:

- **No tipo:** `PresenceOp` é união discriminada — `move` carrega origem E destino, `expand` só
  destino, `shrink` só origem. Uma não vira a outra por descuido de spread.
- **No plano:** `planPresence` devolve `removePresences` e `addPresences` separados. `expand`
  **nunca** produz remoção; `move` produz exatamente uma de cada. O teste
  `"mover e expandir a partir do MESMO estado produzem bancos diferentes"` prova o ponto exato do
  risco: as duas inserem a MESMA linha em `department_areas`, e a diferença INTEIRA está no que é
  removido — que é justamente o que some da tela sem avisar quando as duas se confundem.
- **Na rota:** o cliente NOMEIA a operação (`{ op: "move" }`), a rota nunca deduz do payload.

Também provado separadamente: encolher a última presença arquiva e **não apaga** a entidade
(`archivesDepartment: true`, entidade segue no estado com as pessoas dela).

### Como o isolamento por empresa foi provado (AC0.1)

`departments-loader.ts` filtra `tenant_id` explicitamente em toda leitura das 3 tabelas, e o teste
`departments-loader-tenant-scope.test.ts` usa um mock que **devolve tudo o que a query não filtrou**.
Prova de que o gate morde: removendo um único `.eq("tenant_id", tenantId)` do loader, 4 testes
falham (verificado ao vivo, e o arquivo foi restaurado em seguida). A fixture tem um departamento de
outra empresa apontando para uma unidade de outra empresa — exatamente o cenário que produziria
"colunas de 1 tenant, pilhas de N tenants" na tela do dono.

### Estado vazio (produção hoje: 3 unidades, 0 departamentos)

- Sem unidade nenhuma: o Mapa explica o que É uma unidade e oferece criar a primeira.
- Com unidades e nenhuma área: faixa explicando a diferença entre unidade e área, cada coluna com
  "Nenhuma área ainda" + "Adicionar área", e o botão "Nova área" ativo.
- Busca sem resultado: oferece "Limpar busca" em vez de tela vazia.
- Todos cobertos por teste em `departments-views.test.tsx`.

### Pendente de gate humano (NÃO cumprido)

- **Paridade visual** com `RESULT-board3.md`/`RESULT-lista.md`: a paridade FUNCIONAL está entregue;
  a fidelidade visual (motion, coreografia, tint dos slots, micro-rótulo junto ao cursor) depende do
  olho do Hugo e não é declarável por teste.
- **Gestos de arrastar** (drag do cartão para mover, alça ∥ para expandir): esta entrega expõe as
  duas operações por menu/drawer explícitos, com a distinção escrita na própria tela. O gesto de
  arrasto é polish de interação, na mesma prateleira do "Fica para depois" da story.
- **Snackbar Desfazer**: já estava em "Fica para depois".

### File List

**Criados**
- `apps/web/src/app/(platform)/admin/areas/departments-model.ts` — modelo puro (derivação, planos
  MOVER/EXPANDIR/ENCOLHER/ARQUIVAR/RESTAURAR, plano de exclusão de unidade, busca/filtro)
- `apps/web/src/app/(platform)/admin/areas/departments-loader.ts` — leitura escopada (AC0.1)
- `apps/web/src/app/(platform)/admin/areas/_components/departments-map.tsx` — vista Mapa (AC5)
- `apps/web/src/app/(platform)/admin/areas/_components/departments-list.tsx` — vista Lista v2 (AC8)
- `apps/web/src/app/(platform)/admin/areas/_components/areas-workspace-client.tsx` — casca, drawers
  de unidade e de área (AC7), modais de operação
- `apps/web/src/app/(platform)/admin/areas/__tests__/departments-model.test.ts` — 28 testes (AC6)
- `apps/web/src/app/(platform)/admin/areas/__tests__/departments-loader-tenant-scope.test.ts` — 7 (AC0.1)
- `apps/web/src/app/(platform)/admin/areas/__tests__/departments-views.test.tsx` — 13 (AC5/AC8)
- `apps/web/src/app/api/admin/departments/route.ts` — criar área (unidade **obrigatória**)
- `apps/web/src/app/api/admin/departments/__tests__/create-requires-unit.test.ts` — 5 testes
  provando que área sem unidade é recusada **sem gravar nada**
- `apps/web/src/app/api/admin/departments/[departmentId]/route.ts` — renomear (sem DELETE, de propósito)
- `apps/web/src/app/api/admin/departments/[departmentId]/presence/route.ts` — operação nomeada (AC6)
- `apps/web/src/app/api/admin/departments/_apply.ts` — executor do plano
- `apps/web/src/app/api/admin/departments/_context.ts` — gate admin + empresa + client

**Modificados**
- `apps/web/src/app/(platform)/admin/configuracoes/unidades/page.tsx` — passa a montar o workspace
- `apps/web/src/lib/audit.ts` — **uma** união de tipo alargada com `"department"` (a coluna é TEXT
  livre no banco; registrar departamento como `area` tornaria a auditoria cúmplice da ambiguidade
  que a migration desfez)
- `apps/web/src/app/(platform)/admin/areas/[areaId]/page.tsx` — **só formatação**, efeito colateral
  do `biome check --write` rodado na pasta. Nenhuma mudança de comportamento minha; a mudança
  semântica que o arquivo carrega (guard por chapéu) é de outra frente.

**Fora do diff de propósito:** `area-management-client.tsx` e `area-detail-client.tsx` foram
reformatados pelo mesmo `biome --write` e **revertidos** — ACs 1-3 mandam preservar, e inflar o diff
de arquivos que a story não muda atrapalha justamente quem vai revisar a operação mais arriscada do
épico. Por isso `biome check` na pasta `admin/areas` acusa 2 erros de `format` PRÉ-EXISTENTES nesses
dois arquivos (mais 1 warning `noArrayIndexKey` em `loading.tsx`, também pré-existente); os 15
arquivos criados/tocados por esta story passam limpos.

### Resultado literal dos gates (2026-07-28)

| Gate | Resultado |
|:--|:--|
| `npx tsc --noEmit -p apps/web/tsconfig.json` | **exit=0** às 15:31 com todo o código desta story. Reexecuções posteriores acusam erros em `components/admin/__tests__/user-list.test.tsx` e `user-profile-drawer.tsx`, arquivos de OUTRA frente em voo no mesmo working tree — zero erros em qualquer caminho desta story, em todas as execuções. |
| `vitest` (areas + configuracoes) | **79 testes, 79 passando** (53 desta story) |
| grep AC0.1 | 6 acessos às 3 tabelas, **todos** com recorte de empresa (`.eq("tenant_id")` em leitura/update/delete, coluna `tenant_id` no insert) |
| `biome check` (arquivos desta story) | **limpo** |
| `git status` schema/migration | **vazio** — nenhuma mudança minha em `packages/database/` ou `supabase/` |
| `git status` território alheio | **vazio** — nada meu em `admin/users`, `api/admin/users`, `admin/job-roles`, `configuracoes/cargos`, `registry.ts` |
| `turbo run build` | Rodado uma vez em 2026-07-28 com **exit=0**, `✓ Compiled successfully` + `✓ Generating static pages (136/136)`. **A partir daí o build integrador passou a ser responsabilidade do orquestrador, uma vez ao fim** — build paralelo por frente foi o que encheu o disco. Registro do sintoma porque ele engana: três execuções anteriores falharam no export, em página DIFERENTE a cada rodada (`/login`, `/workspace`, `/admin/plans` — nenhuma desta story), com `Could not find files for /_error in .next/build-manifest.json`. A causa real só apareceu no log de `next build --experimental-build-mode compile`: **`ENOSPC: no space left on device`** (`df`: 122 MiB livres, disco 100%). Com espaço liberado, o mesmo comando passou sem nenhuma alteração de código. Se o sintoma voltar, olhar o disco antes de caçar o bug. |

## Change Log
| Data | Evento |
|:--|:--|
| 2026-07-25 | Story criada por River (@sm) a partir de `configuracoes-publicacao-fase1.md` §3.3 e da fidelidade provada em `RESULT-board3.md`/`SPEC-board-v3.md` + `RESULT-lista.md`/`SPEC-lista-v2.md`. Bloqueada por CFG-2.1 (dependência dura). |
| 2026-07-25 | Validada por Pax (@po): **NO-GO herdado, 6/10.** A story em si está bem construída (dependência dura declarada, ACs separados entre "sobem já" e "dependem do schema", armadilhas de rótulo respeitadas, `manager_groups` corretamente excluído). O NO-GO é herdado de CFG-2.1: os nomes de tabela dos ACs 5-8 vêm do desenho recusado. Fixes aplicados: nota de nomenclatura sub judice, AC0 com prova de aplicação corrigida (grep não prova aplicação), gates de vitest/biome corrigidos, gate dedicado exigido para MOVER≠EXPANDIR. |
| 2026-07-25 | **Tradução de nomenclatura por River (@sm)**, seguindo exatamente o que a nota do @po recomendava: com CFG-2.1 reescrita (`areas` permanece unidade; `departments`, `department_areas`, `user_departments` são as tabelas novas), os ACs 5-9, o Contexto, as Dev Notes e o Gate desta story foram traduzidos do desenho recusado (`units`/`area_units`/`user_areas.unit_id`) para os nomes finais. Nenhuma intenção funcional mudou (Mapa kanban, MOVER≠EXPANDIR, corporativa inline, paridade Lista×Mapa) — só a nomenclatura. Status permanece `Blocked`: depende de CFG-2.1 estar `Done` (GO do Hugo para aplicar a migration + nova validação do @po), não desta tradução. |
| 2026-07-28 | **Decisão do dono fecha a fronteira do "arquivada = 0 presenças".** O @po levantou o caso de borda: uma área recém-criada, antes de vinculada, teria 0 presenças e nasceria indistinguível de arquivada. Investigação em disco (Dex @dev) mostrou que a UI já fechava esse caminho (botão desabilitado sem unidades, `<Select>` sem opção vazia, `areaId` sempre no payload) — ou seja, **não era um buraco escondido pelas tabelas vazias**, era a superfície da API que ficava aberta para o próximo chamador (import em massa, integrador, outra tela). Levado ao dono como pergunta de PRODUTO, não técnica; resposta: **"não, toda área nasce em uma unidade"**. Aplicado: `areaId` virou **obrigatório** no schema de criação (`api/admin/departments/route.ts`), a validação de unidade-da-empresa passou a rodar incondicionalmente **antes** do insert (recusa não deixa órfã para trás), o botão "Criar" da UI exige unidade, e o comentário que afirmava "a Lista permite criar sem unidade" — falso como construído, denunciado pelo próprio autor — foi removido. Teste novo `api/admin/departments/__tests__/create-requires-unit.test.ts` (5 casos): sem `areaId`, com `null`/`""`, e com unidade de outra empresa, todos **400 e ZERO linha inserida** (o assert que carrega o peso é o segundo: recusar e mesmo assim gravar seria o pior dos mundos); com unidade válida, 201 com as 2 linhas e a área **nascendo local, nunca com zero presenças**. Prova de mutação: devolvendo `.optional()` ao schema, o caso principal falha. **Sem migration** — o GO de banco ficou guardado. Gatilho de reabertura registrado nas Decisões (item 1). |
| 2026-07-28 | **Implementada por Dex (@dev).** ACs 5-8 de comportamento entregues sobre o schema de CFG-2.1: Mapa kanban com corporativa inline atravessando as colunas cobertas (grid `gridColumn: início/fim+1`, tradução do mockup para a stack real), Lista v2 com grupos colapsáveis + busca por área ou gestor + filtro Todas/Locais/Corporativas/Arquivadas + ⋯, drawer de unidade com Renomear/Adicionar área/Excluir com destino, drawer de área, e MOVER≠EXPANDIR como operações estruturalmente distintas (união discriminada no tipo, no plano e na rota). ACs 1-4 preservados sem tocar `AreaManagementClient`. AC0.1 provado por teste com mock que devolve o não-filtrado (remover um `.eq("tenant_id")` derruba 4 testes — verificado ao vivo). Duas decisões registradas por falta de coluna no schema, sem emitir migration: **arquivada = 0 presenças** e **gestor derivado dos membros com chapéu `manager`**. 53 testes novos, todos passando. Paridade VISUAL e gestos de arrasto marcados como pendentes de gate humano, nunca como cumpridos. `tsc` exit=0, 53 testes novos passando, `next build` exit=0 com 136/136 páginas (as 3 falhas anteriores eram `ENOSPC`, disco cheio, não código). Nenhum commit. |
| 2026-07-28 | **Destravada por River (@sm) — CFG-2.1 está `Done`.** Migration aplicada em produção (Dara @data-engineer, GO escrito do Hugo) e validada pelo @po (9/10). AC0 marcado `[SATISFEITO]` com a prova (HTTP 200 nas 3 tabelas, RLS testada). **AC0.1 criado** a partir do achado médio do @po na validação de CFG-2.1: as 3 tabelas novas têm bypass `is_super_admin()` que `areas` não tem, então toda leitura de `departments`/`department_areas`/`user_departments` nesta story precisa filtrar `tenant_id` explicitamente, sob pena do Mapa kanban misturar departamentos de tenants diferentes para o super_admin — virou critério de aceite com gate próprio, não nota de rodapé. Contexto e Dev Notes atualizados para o fato novo (schema existe, não falta mais). Status sai de `Blocked` para `Ready`. |
