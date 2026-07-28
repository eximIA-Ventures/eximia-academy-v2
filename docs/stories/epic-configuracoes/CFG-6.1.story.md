# CFG-6.1 — Usuários em fidelidade ao mockup

> **Status:** Ready (ACs 1-7 liberados pelo @po em 2026-07-25; ACs 8-9 permanecem bloqueados por CFG-2.2/CFG-2.3) · **Tier:** 1 · **Tamanho:** L
> **Depende de:** CFG-1.1 (sub-rota) · CFG-2.2 (ciclo de vida de convites) · CFG-2.3 (último acesso real) — as duas últimas SÓ para as partes explicitamente marcadas abaixo.
> **Fonte:** `docs/architecture/configuracoes-publicacao-fase1.md` §3.5 · `docs/architecture/configuracoes-ficha-corretiva.md` A2/A3 (Bloco A, já Done em CFG-0.1) · `JARVIS/apps/hub-discovery/RESULT-usuarios2.md` + `SPEC-usuarios-v2.md` (fidelidade alvo, harness ALL PASS 60+1+6)
> **Migrations:** NENHUMA nesta story diretamente — as partes de convite/último-acesso dependem das migrations/camada de acesso de CFG-2.2/CFG-2.3.

## Contexto

CFG-0.1 já entregou o vínculo organizacional na ficha (Superior imediato + Cargo) e Redefinir senha + "Ver ações deste usuário". Esta story eleva o RESTANTE da seção Usuários à fidelidade do mockup: ficha em drawer (não mais modal/estático), stats clicáveis, filtro de status, colunas Cargo/Área resolvidas, e os dois [NOVO] de fluxo (Convidar com ciclo de vida completo, Importar em massa) — sendo que os dois últimos só funcionam de ponta a ponta depois de CFG-2.2/CFG-2.3.

## Acceptance Criteria — sem dependência de schema novo (podem entrar já)

1. Lista com paginação por cursor (já existe, preservar — o mockup não pagina, não regredir para isso), busca por nome/email **e cargo** (casando pelo nome do cargo linkado — hoje só nome/email), filtro por papel (já existe, adicionar a opção "Instrutor" que falta no `<select>` embora o papel já seja badgeado na linha), filtro por área (já existe).
2. **Resolver Cargo e Área como colunas de verdade**: `job_role_id` já vem no `select` de `admin/users/page.tsx:62` e nunca é resolvido para nome na tela (`apps/web/src/components/admin/user-list.tsx` não renderiza nenhuma coluna Cargo/Área hoje, confirmado por grep); `user_areas` hoje só é usado como filtro, nunca exibido como coluna. Resolver os dois como colunas reais. **O sub-rótulo "Unidade" dentro da coluna Área NÃO entra nesta story** — pré-CFG-2.1 não existe dado que distinga unidade de departamento, então renderizá-lo seria simular semântica inexistente (o próprio "Fica para depois" desta story já o exclui; a redação condicional anterior contradizia esse bullet).
3. Papel editável inline (`RoleSelector`, já existe, preservar — é mais poderoso que o pill estático do mockup).
4. Ficha do usuário vira **drawer** (não modal): cabeçalho (avatar, nome, email, pill de papel), campos editáveis Superior imediato e Cargo (já entregues em CFG-0.1, só migram de superfície para o drawer), Área, ações Redefinir senha e "Ver ações deste usuário" (já entregues em CFG-0.1, migram de superfície), Desativar/Reativar com sheet de confirmação quando desativar.
5. ⋯ por linha condicional ao status, com **exatamente os dois estados que existem hoje** (ativos: Editar ficha, Mover de área, Redefinir senha, Ver ações → Auditoria, Desativar; desativados: Reativar, Editar ficha, Ver ações). **Correção factual do @po:** o estado "pendente" **não existe** no banco — `users_status_check` aceita só `('active','inactive')` e o convite grava `active` direto (é precisamente o gap que CFG-2.2 abre). A redação anterior ("preservando a diferenciação que já existe hoje entre pendente/desativado/ativo") afirmava um fato falso e levaria o dev a implementar um ramo morto. O terceiro estado entra junto com o AC8, nunca antes.
6. **Mover de área pelo lado da pessoa** (gap real, barato de resolver): hoje o vínculo só é gerenciável pelo lado da ÁREA (`/admin/areas/[areaId]/users`); esta story adiciona "Mover de área" no ⋯/drawer da pessoa, usando a mesma mutação de `user_areas` que já existe do lado da área.
7. Descrição de 1 linha no cabeçalho da seção (critério transversal A5).

## Acceptance Criteria — dependem de CFG-2.2 (convites)

8. Stat clicável "Convites pendentes" com filtro removível; ⋯ de linhas pendentes ganha Reenviar convite / Revogar convite; fluxo "Convidar usuário" passa a criar um convite real no ciclo de vida decidido em CFG-2.2 (não mais inserir `status: 'active'` direto). **Sem CFG-2.2 aplicada, este AC não pode ser implementado** — a UI pode nascer com o layout pronto, mas as ações ficam desabilitadas/informativas até a migration existir.

## Acceptance Criteria — depende de CFG-2.3 (último acesso)

9. Coluna "Último acesso" deixa de mostrar sempre vazio e passa a usar o valor real retornado pelo accessor de CFG-2.3. **Sem CFG-2.3 aplicada, este AC não pode ser implementado** — a coluna permanece com o placeholder atual.

## Fica para depois (fora de escopo mesmo com CFG-2.x aplicadas)

- Importação em massa via CSV real (upload de arquivo, parsing, matching por matrícula — depende de B3 da ficha corretiva, migration própria fora deste épico ainda; a UI do fluxo pode ser desenhada em 3 passos como o mockup modela, mas sem persistência real de arquivo).
- Chapéus múltiplos de verdade (`users.role` é valor único; `user_tenant_memberships` tem `UNIQUE(user_id, tenant_id)`) — mostrar chapéus extras na UI (mini-chips) só é honesto se a fonte de dado permitir hoje; se não permitir, não simular.
- Sub-rótulo "Unidade" na coluna Área além do que os dados atuais (pré-CFG-2.1) já expõem.
- Desfazer (snackbar com undo) e Sugestões da IA como as do mockup — ficam para uma iteração de polish depois que o CRUD real estiver estável; não é a prioridade desta story.

## Dev Notes

- Fonte de dados hoje: `apps/web/src/app/(platform)/admin/users/page.tsx` (guard `["admin","super_admin"]` linha 16; select com `reports_to`/`job_role_id` linha 62; resolução de `superior_name` já implementada linhas ~110-120; `last_sign_in_at: null` chumbado linha 129 — ver CFG-2.3).
- Componente de listagem: `apps/web/src/components/admin/user-list.tsx` (tipos já incluem `reports_to`/`job_role_id`, linhas 36-37, mas SEM coluna renderizada para eles hoje — confirmado por grep, nenhuma ocorrência de "Cargo"/"Área" como header de coluna).
- Componente de convite: `apps/web/src/components/admin/invite-user-dialog.tsx`.
- Ficha (dialog atual, migra para drawer): `apps/web/src/components/admin/user-profile-dialog.tsx` (arquivo untracked, entregue em CFG-0.1 — D7 confirma que esta fila entra no branch do hub).
- Referência de fidelidade funcional (não de pixel): `RESULT-usuarios2.md` documenta a unificação de estado pessoa↔cargo↔área provada bidirecionalmente no mockup (20 pessoas, 17 ativos/2 pendentes/1 desativado no seed) — no produto real isso já é verdade estrutural (uma linha `users`, um `job_role_id`, sem duplicação), então a "prova bidirecional" do mockup já está garantida pelo próprio schema; não precisa reconstruir a unificação, só a UI.

## Gate

> **Correções de gate do @po (verificadas em disco):** (a) `npx vitest` não roda na raiz; (b) `"apps/web/src/app/(platform)/admin/users"` **não contém nenhum arquivo de teste** — esse trecho não executava nada (os testes reais do domínio são `components/admin/__tests__/user-list.test.tsx` e `app/api/admin/users/__tests__/user-admin-handlers.test.ts`, ambos confirmados); (c) path do hub errado (D5: `admin/configuracoes/usuarios`).

```bash
npx tsc --noEmit -p apps/web/tsconfig.json ; echo "exit=$?"
cd apps/web && npx vitest run src/components/admin/__tests__/user-list.test.tsx src/app/api/admin/users/__tests__/user-admin-handlers.test.ts 2>&1 | tail -20
npx biome check "apps/web/src/app/(platform)/admin/users" apps/web/src/components/admin/user-list.tsx apps/web/src/components/admin/user-profile-dialog.tsx apps/web/src/components/admin/invite-user-dialog.tsx "apps/web/src/app/(platform)/admin/configuracoes/usuarios"
```

> **Gate novo exigido pelo @po (AC2 e AC6):** o `user-list.test.tsx` já existe — estender com (i) asserção de que as colunas Cargo e Área renderizam o NOME resolvido (AC2), e (ii) caso de "Mover de área" pelo lado da pessoa chamando a mesma mutação de `user_areas` usada pelo lado da área (AC6, é escrita em produção, não pode subir sem teste).

## Dev Agent Record

### Estado dos ACs (implementação de 2026-07-28)

| AC | Estado | Nota |
|:--|:--|:--|
| 1 | Feito | Busca única cobre nome, email **e cargo** (casa pelo nome do cargo → `job_role_id.in.(...)` no mesmo `.or()`); opção "Instrutor" adicionada ao `<select>`; cursor e filtros de papel/área preservados. |
| 2 | Feito | Cargo e Área viraram colunas reais, com NOME resolvido. Cargo sai do mapa de cargos já carregado (nenhuma query nova); Área sai de UMA leitura de `user_areas` para os ids da página. Sub-rótulo "Unidade" continua fora, como a story manda. |
| 3 | Feito (preservado) | `RoleSelector` inline intocado. |
| 4 | Feito, **paridade visual pendente de gate humano** | Ficha migrou de `Modal` para `Sheet` (drawer): cabeçalho com avatar/nome/email/pílulas, Superior imediato, Cargo, **Área**, Redefinir senha, Ver ações, e Desativar/Reativar com sheet de confirmação. |
| 5 | Feito | Menu ⋯ condicional: ativo (Editar ficha · Mover de área · Redefinir senha · Ver ações · Desativar) e desativado (Reativar · Editar ficha · Ver ações). O terceiro estado (convite pendente) entra pelo AC8, agora destravado. |
| 6 | Feito | "Mover de área" pelo lado da pessoa, usando as MESMAS rotas de `user_areas` do lado da área (`DELETE` no antigo, `POST` no novo). Nenhuma rota de escrita nova. |
| 7 | Feito (já existia) | Descrição de 1 linha presente nas duas superfícies. |
| 8 | **Destravado e feito** | CFG-2.2 está em disco: ciclo de vida de convite derivado, Reenviar/Revogar no ⋯, contador de pendentes. Esta story acrescentou o que faltava: **os cards do topo viraram filtros clicáveis**, com chip removível e `aria-pressed`. O filtro por estado é derivado (não existe `WHERE`), computado sobre o censo e aplicado por `.in`, igual ao filtro de área. |
| 9 | **Destravado e feito (preservado)** | CFG-2.3 em disco: "Último acesso" vem do accessor real. A rota de "Carregar mais" foi alinhada para trazer os mesmos campos, senão a página 2 perderia colunas que a 1 tem. |

### Fora de escopo, confirmado

- Import em massa: entregue **por e-mail**, não por matrícula. O casamento por matrícula (B3) continua fora — depende de coluna que não existe no schema.
- Sugestões da IA e desfazer com snackbar: continuam na iteração de polish, como a story define.
- Chapéus múltiplos e sub-rótulo "Unidade": inalterados.

### Como o import em massa se protege

1. **Pré-visualização obrigatória**: o modo `preview` da rota não escreve nada e devolve as contagens (a criar / já cadastrados / repetidos no arquivo / inválidos / total lido).
2. **A mesma função classifica preview e apply** (`bulk-import.ts`, pura). Não são dois cálculos parecidos: é a mesma chamada sobre o mesmo texto.
3. **Confirmação por número**: o cliente não manda a lista do que criar, manda o CSV e o número que viu. Se o recálculo no `apply` divergir, a rota devolve **409 e não cria nada**, com a foto nova para reconfirmar. É isto que torna a criação silenciosa impossível.
4. **Linha duplicada** vale a primeira ocorrência (a segunda é ignorada com motivo); **e-mail já existente** no tenant é ignorado, nunca sobrescrito; **linha inválida** (e-mail malformado, nome vazio, papel desconhecido) é ignorada com motivo. Invariante provada em teste: `criadas + ignoradas === total`.
5. **Teto de 500 linhas** por lote e criação **sequencial** (evita 429 do GoTrue no meio do lote).
6. **Falha parcial é explícita**: linha que falha no Auth ou no perfil volta em `failed` com a mensagem, e o resto do lote não é escondido.
7. Limite conhecido e documentado: "já cadastrado" é verificado dentro da empresa do chamador. Colisão com outra empresa da plataforma só aparece no `apply`, como falha explícita — nunca como criação errada.

### Pendente de gate humano (não marcado como cumprido)

- Paridade **visual** do drawer, dos cards clicáveis e do fluxo de import com o mockup (`SPEC-usuarios-v2.md`). Os ACs acima descrevem comportamento observável e estão provados por teste; a aprovação de aparência é do dono.

### File List

**Criados**
- `apps/web/src/app/(platform)/admin/users/filters.ts`
- `apps/web/src/app/(platform)/admin/users/bulk-import.ts`
- `apps/web/src/app/api/admin/users/invite-user.ts`
- `apps/web/src/app/api/admin/users/bulk-invite/route.ts`
- `apps/web/src/components/admin/user-profile-drawer.tsx`
- `apps/web/src/components/admin/user-area-move.ts`
- `apps/web/src/components/admin/user-bulk-import-dialog.tsx`
- `apps/web/src/app/(platform)/admin/users/__tests__/filters.test.ts`
- `apps/web/src/app/(platform)/admin/users/__tests__/bulk-import.test.ts`
- `apps/web/src/app/(platform)/admin/users/__tests__/loader-status-filter.test.ts`
- `apps/web/src/app/api/admin/users/__tests__/bulk-invite.test.ts`

**Modificados**
- `apps/web/src/app/(platform)/admin/users/loader.ts`
- `apps/web/src/app/(platform)/admin/users/page.tsx`
- `apps/web/src/app/(platform)/admin/users/user-management-client.tsx`
- `apps/web/src/app/(platform)/admin/users/user-stats-grid.tsx`
- `apps/web/src/app/(platform)/admin/configuracoes/usuarios/page.tsx`
- `apps/web/src/app/api/admin/users/route.ts`
- `apps/web/src/components/admin/user-list.tsx`
- `apps/web/src/components/admin/__tests__/user-list.test.tsx`

**Removido**
- `apps/web/src/components/admin/user-profile-dialog.tsx` (substituído pelo drawer, AC4)

### Resultado dos gates

- `npx tsc --noEmit -p apps/web/tsconfig.json` → **exit=0**, sem saída.
- `npx vitest run "(platform)/admin/users" api/admin/users components/admin` → **18 arquivos, 194 testes, todos verdes** (inclui os 79 de convite/último acesso que já existiam).
- `npx biome check` sobre os arquivos da story → **0 erros** (1 warning pré-existente em `loading.tsx`).
- `grep "status: 'pending'"` em `admin/users` e `api/admin/users` → **vazio**: estado de convite continua DERIVADO, nunca escrito.
- Build: **fora do gate desta frente** por decisão do lead (builds paralelos encheram o disco da máquina). O build integrador roda uma vez, no fim, pelo lead. Registro do que foi observado antes da mudança de protocolo: a primeira execução falhou no prerender de `/login`, `/lives` e `/admin/configuracoes/usuarios` com `Cannot read properties of undefined (reading 'call')` — causa era o `next dev` rodando contra o mesmo `.next`, não o código; a reexecução compilou com sucesso.
- Disco: `df -h /System/Volumes/Data` → **6,1 GB livres** no fecho (piso combinado: 1 GB).
- `git status` em `admin/job-roles`, `admin/areas`, `packages/database`, `supabase/`, `packages/shared`, `meu-plano`, `lib/analytics` → só mudanças das outras frentes; **nenhum arquivo desses caminhos foi tocado por esta story**.

### Endurecimento dos mocks de teste (2026-07-28, pós-interrupção)

Ler `fetchMock.mock.calls[0][0]` direto quebra o `tsc` do app INTEIRO com `TS2493`:
`vi.fn(() => ...)` infere a tupla de argumentos como `[]`, e indexar tupla vazia é erro
de tipo. As saídas fáceis (`!`, `as any`) apagariam o sintoma e deixariam um teste que
estoura com `TypeError` obscuro quando a chamada esperada não acontece.

A correção é um helper `stubFetch` com `callAt(i)`, que **afirma que a chamada ocorreu**
— exatamente o que o teste deveria provar antes de olhar o argumento — e devolve tipo
exato, sem cast e sem encadeamento opcional. `jsonBodyOf` faz o mesmo com o corpo.
Grep de `as any` / `as unknown as` / `mock.calls[` nos testes desta frente: **vazio**.

## Change Log
| Data | Evento |
|:--|:--|
| 2026-07-25 | Story criada por River (@sm) a partir de `configuracoes-publicacao-fase1.md` §3.5 e da fidelidade provada em `RESULT-usuarios2.md`/`SPEC-usuarios-v2.md`. ACs 8-9 marcados como dependentes de CFG-2.2/CFG-2.3. |
| 2026-07-28 | Retomada após interrupção do lead (disco da máquina cheio por builds paralelos, não falha do código). Trabalho íntegro em disco. Mocks de `fetch` do `user-list.test.tsx` endurecidos: `stubFetch`/`callAt` afirmam que a chamada ocorreu antes de ler o argumento, eliminando a classe de erro `TS2493` sem `!` nem `as any`. Build sai do gate desta frente por decisão do lead; gate agora é `tsc` + `vitest` + `biome`. 194 testes verdes, `tsc` exit=0, biome 0 erros. |
| 2026-07-28 | Implementada por Dex (@dev). ACs 1-7 feitos; **ACs 8 e 9 destravaram de fato** (CFG-2.2 e CFG-2.3 estão em disco) e foram implementados/preservados. Import em massa entregue por e-mail (matrícula/B3 segue fora), com pré-visualização obrigatória e confirmação por número — 409 e zero criações quando o recálculo diverge. Ficha migrou de modal para drawer. Paridade visual fica pendente de gate humano do dono. 194 testes verdes, `tsc` exit=0, biome sem erros, build verde. Nenhum commit. |
| 2026-07-25 | Validada por Pax (@po): **GO condicional, 8/10.** A separação dos ACs em 3 blocos por dependência é o melhor padrão deste backlog e deve ser copiado pelas demais. Fixes aplicados: AC5 afirmava um estado "pendente" que **não existe** no banco (`users_status_check` só aceita `active|inactive`) e teria gerado ramo morto de UI; AC2 tinha cláusula condicional que contradizia o próprio "Fica para depois"; gate de vitest não executava nada e apontava para path de hub errado; exigidos testes para AC2 e AC6. |
