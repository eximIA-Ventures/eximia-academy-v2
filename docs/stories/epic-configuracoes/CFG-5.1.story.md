# CFG-5.1 — Dados da organização em fidelidade ao mockup (rebaixada ao delta real)

> **Status:** Ready · **Tier:** 3 · **Tamanho:** S (1 arquivo de teste novo; AC4 sem mudança de código, é confirmação de comportamento já em produção) · **Depende de:** CFG-1.1 (já entregue)
> **Fonte:** `docs/architecture/configuracoes-publicacao-fase1.md` §3.1
> **Migrations:** NENHUMA (colunas `tenants.name` e `branding.*` já existem; nenhuma coluna nova entra nesta story).

## Rebaixamento de escopo (@sm, 2026-07-25) — fix F3 do @po

> A premissa central da versão anterior ("`saveTenantSettings` não tem nenhum caller no repo") está **obsoleta**. Verificado em disco (`RESULT-casca-hub.md`, CFG-1.1 já executada): `apps/web/src/app/(platform)/admin/configuracoes/_components/org-data-form.tsx` já existe, já importa `saveTenantSettings`, já monta `LogoUpload` + `ColorPicker` + `BrandingPreview`, já tem Salvar e Descartar; `organizacao/page.tsx` já o renderiza com `SectionHeader`. Os ACs 1, 2, 3 e 5 da versão anterior estão entregues. Esta reescrita rebaixa a story ao que sobra de verdade.

## Contexto

A aba "Configurações Gerais" da rota antiga `/admin/settings` é, até hoje, literalmente um `<p>`: *"Configurações gerais do tenant são definidas no tenant.config.ts do deploy"* (`settings-tabs-wrapper.tsx:69`). A ação que alimenta um form real (`saveTenantSettings`, `admin/settings/actions.ts:40`) já existe, já valida (Zod), já grava audit log `settings.updated` desde CFG-0.2 — e a casca (CFG-1.1) já a ligou dentro do hub, em `/admin/configuracoes/organizacao`. Esta story cuida do que a casca não cobriu: prova de teste e as duas decisões de escopo que ficaram abertas.

## O que já está entregue (preservar, não retrabalhar)

Verificado em disco, não é trabalho desta story:
- Form em `/admin/configuracoes/organizacao` com Nome da organização, Logo (`LogoUpload`), Cor Primária/Secundária (`ColorPicker`), preview ao vivo (`BrandingPreview`).
- Botões Salvar (chama `saveTenantSettings` de verdade) e Descartar.
- Guard de autoria embutido na própria action (`["admin","super_admin"].includes(profile.role)`), sem reimplementação na sub-rota.
- `SectionHeader` com descrição de 1 linha na sub-rota do hub.

## Decisão registrada por River (@sm, 2026-07-25) — não duplicar o form na rota antiga

> **[AUTO-DECISION]** A aba "Configurações Gerais" de `/admin/settings` continua sendo o `<p>` estático, **não** recebe uma segunda cópia do form → (reason: D3 exige que a rota antiga permaneça **acessível**, não que ganhe **paridade de capacidade** com o hub; duplicar o form nas duas rotas é exatamente a "implementação paralela" que o plano §2 Passo 4 manda evitar, e o admin já alcança o form real em 1 clique via o item "Configurações" já presente na sidebar principal. Revogável pelo Hugo se ele quiser o form replicado também na rota antiga).

## Acceptance Criteria (delta real)

1. **Criar o teste que prova o AC2 de verdade (Salvar/Descartar).** Não existe hoje nenhum teste de `org-data-form.tsx`. Criar `apps/web/src/app/(platform)/admin/configuracoes/__tests__/org-data-form.test.tsx` cobrindo: (a) Salvar chama `saveTenantSettings` com o payload esperado (nome, `branding.logo_url`, `branding.primary_color`, `branding.secondary_color`); (b) **Descartar reverte o form para o valor persistido e NÃO chama a action** — é o único comportamento do AC2 original que nenhum grep prova, e é onde um bug passaria despercebido.
2. **(AC4) RESOLVIDO pelo dono (2026-07-28): o admin da própria empresa PODE editar o nome do tenant.** Existe uma segunda superfície que também edita `tenants.name` — `/admin/tenants/[id]` (console de super-admin, `PATCH /api/admin/tenants/[tenantId]` com guard estrito `profile.role !== "super_admin"`) — e o form do hub amplia quem edita o nome frente a esse console, porque `saveTenantSettings` aceita `admin`+`super_admin`. O dono confirmou a ampliação, aceitando a justificativa do @po: `saveTenantSettings` resolve `tenantId` a partir do PRÓPRIO perfil de quem chama, nunca de um parâmetro externo, logo um `admin` só alcança o próprio tenant e nenhum caminho lateral para editar empresa alheia se abre. Critério de aceite verificável: (a) `admin` e `super_admin` conseguem salvar `name` via `saveTenantSettings` sobre o PRÓPRIO tenant; (b) nenhuma chamada de `saveTenantSettings` aceita ou usa um `tenantId` vindo do cliente — o `tenantId` resolvido é sempre derivado do `profile` da sessão, nunca de input do form ou de query param; (c) o console de super-admin (`PATCH /api/admin/tenants/[tenantId]`) continua exigindo `super_admin` estrito para editar QUALQUER tenant, inalterado. O gate abaixo prova (b) por leitura do código-fonte da action.
3. Registrar no Change Log a confirmação do Hugo (já feita, ver Change Log) — nenhum ajuste de form é necessário, o comportamento atual já é o confirmado.

## Fica para depois (bloqueado por schema/produto, inalterado)

- Slug, Domínio de acesso, Idioma padrão, cores "Texto"/"Fundo", pipeline de upload de arquivo para storage — todos fora de escopo por falta de coluna/campo no schema atual, sem mudança nesta reescrita.

## Dev Notes

- `tenantSettingsSchema` completo está em `apps/web/src/app/(platform)/admin/settings/actions.ts:9-30`.
- `saveTenantSettings` resolve `tenantId` internamente (`profile.role === "super_admin" ? null : profile.tenant_id`) e retorna erro `"Nenhum tenant ativo selecionado"` quando `super_admin` sem tenant ativo via cookie — o form do hub deve propagar esse erro de forma legível (já entregue pela casca; o teste do AC1 desta story não precisa cobrir esse caminho, é caso de borda de super-admin, fora do delta).
- Componentes órfãos já ligados pela casca: `logo-upload.tsx`, `color-picker.tsx`, `branding-preview.tsx` (cada um já tem teste próprio em `apps/web/src/components/admin/__tests__/`).
- Mockup desta seção (`configuracoes-hub.html:1495-1570`) é HTML estático puro, sem comportamento a copiar — não existe RESULT/SPEC de fidelidade funcional para esta seção, mesmo motivo de CFG-4.1.

## Gate

```bash
npx tsc --noEmit -p apps/web/tsconfig.json ; echo "exit=$?"
cd apps/web && npx vitest run "src/app/(platform)/admin/configuracoes/__tests__/org-data-form.test.tsx" 2>&1 | tail -15
npx biome check "apps/web/src/app/(platform)/admin/configuracoes/_components/org-data-form.tsx" "apps/web/src/app/(platform)/admin/settings/actions.ts"
grep -n "Descartar" "apps/web/src/app/(platform)/admin/configuracoes/_components/org-data-form.tsx"   # AC1: descartar reverte sem chamar a action
grep -n "settings-tabs-wrapper" "apps/web/src/app/(platform)/admin/settings/"* 2>/dev/null || true      # guarda: a aba antiga não foi duplicada (AUTO-DECISION)
grep -n "resolveTenantId(profile.tenant_id)" "apps/web/src/app/(platform)/admin/settings/actions.ts"                     # AC4(b): tenantId sempre resolvido do profile da sessão, nunca de parâmetro
grep -n "saveTenantSettings({" "apps/web/src/app/(platform)/admin/configuracoes/_components/org-data-form.tsx"          # AC4(b): payload chamado pelo form
sed -n '/tenantSettingsSchema = z.object/,/^})/p' "apps/web/src/app/(platform)/admin/settings/actions.ts" | grep -c tenantId   # AC4(b): esperado 0 — tenantId não faz parte do payload aceito pela action
grep -n "super_admin" "apps/web/src/app/api/admin/tenants/[tenantId]/route.ts"                                           # AC4(c): console de super-admin continua com guard estrito, inalterado
```

## Change Log
| Data | Evento |
|:--|:--|
| 2026-07-25 | Story criada por River (@sm) a partir de `configuracoes-publicacao-fase1.md` §3.1. Gap de autoridade sobre `name`/`slug` registrado como questão aberta. |
| 2026-07-25 | Validada por Pax (@po): NO-GO por escopo (6/10) — ACs 1, 2, 3 e 5 já entregues pela casca; premissa "nenhum caller" obsoleta. AC4 preservado como decisão do dono, não decidida pelo @po. |
| 2026-07-25 | **Rebaixada ao delta real por River (@sm), fix F3.** Removidos os ACs já entregues (preservados só como "O que já está entregue"). Delta real: teste novo de Salvar/Descartar (AC1) + decisão pendente do Hugo sobre `tenants.name` preservada integralmente, sem tentar decidi-la (AC2). `[AUTO-DECISION]` tomada apenas sobre um ponto de escopo distinto (não duplicar o form na aba "Configurações Gerais" da rota antiga) — decisão de arquitetura/escopo, não de permissão/segurança, revogável pelo Hugo. Tier rebaixado de 2 para 3. |
| 2026-07-28 | **Delta implementado por Dex (@dev).** AC1: criado `org-data-form.test.tsx` (8 casos) — Salvar com o payload exato (`name` + `branding.{logo_url,primary_color,secondary_color}`), trim do nome, Salvar desabilitado com nome vazio, erro da action virando mensagem, e Descartar revertendo TUDO sem chamar a action. AC2: criado `tenant-name-authority.test.ts` (10 casos) provando a fronteira em runtime, com o `resolveTenantId` REAL (não dublado) — ver linha seguinte. AC3: nenhum ajuste de form foi necessário, como a story previa. |
| 2026-07-28 | **AC2 (fronteira de autoridade) PROVADO, não assumido — a premissa do dono se sustenta no código real (@dev).** Runtime, `tenant-name-authority.test.ts`: (a) o admin da Cory salva o nome e o `UPDATE` sai escopado em `.eq("id","tenant-7")`, com audit `settings.updated`; (b) **caso adversarial** — o mesmo admin com o cookie `x-sa-active-tenant` apontando para `tenant-42` continua gravando SÓ em `tenant-7`, porque `resolveTenantId` devolve `profileTenantId` antes de olhar o cookie; (c) **contraprova de não-vacuidade** — o MESMO cookie leva um `super_admin` sem tenant próprio para `tenant-42`, provando que o cookie não é decorativo e que o caso (b) está verde por a fronteira existir, não por mock quebrado; (d) `id`/`tenant_id`/`tenantId` injetados no payload são descartados pelo Zod (`Object.keys(updateData) == ["name","updated_at"]`); (e) `manager` e `student` levam "Acesso negado" com zero escritas; (f) `UPDATE` que casa 0 linhas (RLS) devolve erro honesto e NÃO audita. Source-level (gate da story): `resolveTenantId(profile.tenant_id)` na linha 74 da action; `grep -c tenantId` no `tenantSettingsSchema` = **0**; console de super-admin com `profile.role !== "super_admin"` inalterado (linhas 21 e 52). **Veredito: a fronteira se sustenta. Sim.** |
| 2026-07-28 | **BUG REAL encontrado pelo teste de Descartar, e corrigido (@dev).** `ColorPicker` e `LogoUpload` são meio-controlados: semeiam estado local a partir de `value`/`currentUrl` UMA vez e nunca ressincronizam. "Descartar" revertia o estado do form e o `BrandingPreview`, mas o campo hexadecimal e a miniatura do logo continuavam exibindo o rascunho descartado — a tela MENTIA, e quem clicasse Salvar em seguida gravaria a cor original vendo a cor rascunhada. Correção contida em `org-data-form.tsx`: um `resetToken` remonta os dois filhos no descarte (que é quando, e só quando, o pai reescreve o estado por fora). Nenhum componente compartilhado mudou de contrato — o `ColorPicker` PRECISA do estado local para não ter o "#ff" intermediário da digitação atropelado, comportamento que os testes dele já guardam. Era exatamente o "bug que passaria despercebido" que o AC1 previa. |
| 2026-07-28 | **F4 RESOLVIDO — GO do Hugo: admin da própria empresa pode editar o nome do tenant.** O dono confirmou a ampliação de escopo, aceitando a justificativa do @po (`saveTenantSettings` resolve `tenantId` a partir do PRÓPRIO `profile.tenant_id` da sessão via `resolveTenantId`, nunca de um parâmetro do payload — `tenantSettingsSchema` não tem campo `tenantId`, confirmado por grep; o console de super-admin `PATCH /api/admin/tenants/[tenantId]` continua com guard estrito `profile.role !== "super_admin"`, inalterado). AC2 (antigo AC4) reescrito por River (@sm) de "questão aberta" para critério verificável com 3 sub-condições e gate próprio. Nenhuma mudança de código: o comportamento confirmado já é o que está em produção desde a casca (CFG-1.1). Story sai de "Blocked no AC4" para totalmente `Ready`, sem AC pendente. |

## File List

| Arquivo | Ação |
|:--|:--|
| `apps/web/src/app/(platform)/admin/configuracoes/__tests__/org-data-form.test.tsx` | **Criado** — 8 casos (AC1: Salvar/Descartar) |
| `apps/web/src/app/(platform)/admin/configuracoes/__tests__/tenant-name-authority.test.ts` | **Criado** — 10 casos (AC2: fronteira de autoridade sobre `tenants.name`) |
| `apps/web/src/app/(platform)/admin/configuracoes/_components/org-data-form.tsx` | Modificado — `resetToken` remonta `ColorPicker`/`LogoUpload` no Descartar (bug achado pelo teste do AC1) |

> Sem mudança em schema, migration ou banco. `admin/settings/actions.ts` foi LIDA e provada, não alterada.
