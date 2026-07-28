# EPIC-CONFIGURACOES — Hub de Configurações do eximIA Academy

> **Owner:** REGENTE (orquestrador dedicado, mandato Hugo 2026-07-22)
> **Referências:**
> - Mockup aprovado `JARVIS/apps/hub-discovery/configuracoes-hub.html` (variante base) e `configuracoes-hub-assinatura.html` (variante visual "Assinatura", EXPLORATÓRIA, não mesclada ao baseline — ver nota na tabela de stories)
> - Mapa `docs/architecture/configuracoes-estado-atual.md` · estudo Stratws `docs/architecture/configuracoes-referencia-stratws.md`
> - Ficha corretiva `docs/architecture/configuracoes-ficha-corretiva.md` (Bloco A concluído em CFG-0.1/0.2; Bloco B condicionado a GO do Hugo)
> - Plano executável da Fase 1 + matriz da camada de departamento `docs/architecture/configuracoes-publicacao-fase1.md` (403 linhas — fonte primária de CFG-1.1 e CFG-2.1)
> - RESULTs/SPECs de fidelidade do mockup (terminais Immersive Web, `JARVIS/apps/hub-discovery/`): `RESULT-usuarios2.md`/`SPEC-usuarios-v2.md` (Usuários), `RESULT-cargos.md`/`SPEC-cargos-v2.md` (Cargos), `RESULT-board3.md`/`SPEC-board-v3.md` + `RESULT-lista.md`/`SPEC-lista-v2.md` (Unidades & Áreas, vistas Mapa e Lista)
> **Regras invioláveis:** sem push/PR/deploy; sem migration sem GO explícito do Hugo; não tocar em `meu-plano/**`, `components/analytics/**`, `lib/analytics/**`, `epic-student-home/**`.

## Decisões do dono (Hugo, 2026-07-25) que fixam o escopo deste README

D1. Sobem VIVAS 5 seções no hub: Dados da organização, Marca & Aparência, Unidades & Áreas, Cargos, Usuários.
D2. As outras 11 (inclusive Auditoria) ficam em cinza, não-clicáveis, pílula "Em breve", sem arquivo de rota.
D3. Hub ADITIVO: nenhum acesso hoje existente pode ser perdido. `/admin/areas`, `/admin/job-roles`, `/admin/users`, `/admin/settings` ficam vivas e SEM redirect.
D4. Nomenclatura: Unidade = site físico; Área = departamento; Área corporativa = área presente em N unidades (N:N).
D5. Endereço do hub: **`/admin/configuracoes`** (decisão do dono, prevalece). A página pessoal `apps/web/src/app/(platform)/configuracoes/page.tsx` **não se move e não se toca** (é a semente do futuro hub de configurações do USUÁRIO). Nenhum link de header é repointado. Ver "Nota D5" logo abaixo.
D6. Destino das 5 seções é fidelidade ao mockup (drawer, Mapa kanban, Coreografia, stats clicáveis, import em massa, IA socrática), mas isso é fase 3+ — a Fase 1 (CFG-1.1) é a casca no ar com as telas ATUAIS montadas dentro.
D7. A fila untracked de CFG-0.1/CFG-0.2 (ficha do usuário, redefinir senha, página+API de auditoria) é PRÉ-REQUISITO e faz parte desta publicação — já materializada (CFG-0.1/0.2 Done) e preservada.

**Nota D5 — RESOLVIDA pelo @po em 2026-07-25.** Havia divergência entre a decisão do dono (`/admin/configuracoes`) e o plano executável `configuracoes-publicacao-fase1.md` Passos 2-3 (que propunha `/configuracoes` + mover a página pessoal para `/preferencias`). **D5 prevalece**, e a realidade em disco já a segue — verificado durante a validação:

- `find "apps/web/src/app/(platform)/admin/configuracoes" -name page.tsx` → 6 arquivos (raiz + 5 seções vivas); `_components/settings-hub-nav.tsx` tem 5 `href="/admin/configuracoes/` e 11 `Em breve`.
- `apps/web/src/app/(platform)/preferencias/` **não existe** e não deve ser criada.
- `header.tsx:157` e `studio-header.tsx:112` continuam em `/configuracoes` (página pessoal, intocada).
- `registry.ts:219` já aponta `{ label: "Configurações", href: "/admin/configuracoes" }`, e `registry-nav.test.ts` já asserta `/admin/configuracoes`, `/admin/audit` e `/admin/plans`.
- `middleware.ts:329` mantém `protectedPaths` **inalterada** (`/admin` já cobre o hub) e tem guard dedicado de chapéu em `:348`.

**Consequência para leitura do plano executável:** o Passo 2 (mover a rota pessoal) está **CANCELADO**; nos Passos 3-7 e nos gates G4-G8, leia `/admin/configuracoes/*` onde o documento diz `/configuracoes/*`. Onde o plano e CFG-1.1 divergirem quanto ao path, **CFG-1.1 vence** — o plano foi escrito antes de D5.

## Fases

| Fase | Conteúdo | Status |
|:--|:--|:--|
| **0 — Correções (Bloco A da ficha)** | CFG-0.1 (usuários: drift ORM, vínculo organizacional, reset senha) + CFG-0.2 (auditoria viva: instrumentação + UI) | **Concluída** (2026-07-22, gates verdes) |
| **1 — Casca do hub** | CFG-1.1 — layout `/configuracoes/*`, sidebar 4 grupos/16 itens (5 vivos + 11 "Em breve"), 5 sub-rotas montando os componentes admin existentes, guard de middleware, rota pessoal migrada | **Em execução** (paralelo a este backlog) |
| **2 — Esquema aditivo (aguarda GO)** | CFG-2.1 (departamento + N:N unidade, recomendação P1, aguarda GO de migration) · CFG-2.2 (ciclo de vida de convites — **desenho decidido em 2026-07-28, caminho D-mínimo, sem migration**, `Ready`) · CFG-2.3 (último acesso real via `auth.users`) | CFG-2.1 aguarda GO do Hugo; **CFG-2.2 não depende mais de GO de migration** (nenhuma migration nesta story) |
| **3+ — Fidelidade seção a seção** | CFG-3.1 (Cargos) · CFG-4.1 (Marca & Aparência) · CFG-5.1 (Dados da organização) · CFG-6.1 (Usuários) · CFG-7.1 (Unidades & Áreas) | **5/5 stories `Ready`** — CFG-2.1 aplicada em produção em 2026-07-28 destravou CFG-7.1 (dependência dura); CFG-6.1 permanece `Ready` com ACs 1-7 liberados e ACs 8-9 sujeitos à conclusão em disco de CFG-2.2/CFG-2.3 (em execução por outra frente neste momento — não reavaliado nesta rodada); aguarda apenas CFG-1.1 concluir para a Fase 3 começar de fato — ver "Sequência recomendada" no fim deste README |

Bloco B da ficha (permission_grants, hierarquia de unidades, matrícula/terceiro) aguarda decisão do Hugo — nada aplicado além do desenho explicitamente coberto por CFG-2.1/2.2.

## Stories

| ID | Título | Status | Depende de |
|:--|:--|:--|:--|
| CFG-0.1 | Correções da seção Usuários (A1+A2+A3) | Done | — |
| CFG-0.2 | Auditoria viva (A4 + link por pessoa) | Done | — |
| CFG-1.1 | Casca do hub de Configurações | InProgress (execução paralela) | CFG-0.1, CFG-0.2 |
| CFG-2.1 | Esquema aditivo P1 — departamento + junção N:N com unidade | Blocked: reescrita pelo @sm segue P1 corretamente (**fix F1 resolvido**); aguarda GO do Hugo + nova validação do @po | CFG-1.1 |
| CFG-2.2 | Ciclo de vida de convites (caminho D-mínimo, sem migration) | **Ready** (desenho decidido pelo dono 2026-07-28, **fix F2 resolvido**) | CFG-1.1 |
| CFG-2.3 | Último acesso real (leitura de `auth.users` via service role) | Blocked: aguarda GO do Hugo | CFG-1.1 |
| CFG-3.1 | Cargos em fidelidade (drawer, trilhas, pessoas, exclusão com reatribuição) | Draft (GO condicional do @po, aguarda fix F5) | CFG-1.1 |
| CFG-4.1 | Marca & Aparência em fidelidade (produto já à frente do mockup) | **Ready** (rebaixada ao delta real pelo @sm, **fix F3 resolvido**) | CFG-1.1 |
| CFG-5.1 | Dados da organização em fidelidade (form onde hoje há um `<p>`) | **Ready** (rebaixada ao delta real pelo @sm, **fix F3 resolvido**; **fix F4 resolvido pelo dono em 2026-07-28** — admin edita o próprio tenant) | CFG-1.1 |
| CFG-6.1 | Usuários em fidelidade (drawer, stats clicáveis, import em massa, IA) | **Ready** (ACs 1-7; 8-9 bloqueados) | CFG-1.1; convites/último-acesso dependem de CFG-2.2/CFG-2.3 |
| CFG-7.1 | Unidades & Áreas em fidelidade (Mapa kanban, corporativas, arquivar, gestor de área) | **Ready** — CFG-2.1 aplicada em produção 2026-07-28, AC0 satisfeito; **AC0.1 novo** (filtro `tenant_id` explícito, achado do @po) | CFG-1.1, CFG-2.1 (satisfeita) |

> **Vereditos e correções do @po (2026-07-25):** ver a seção "Fixes exigidos pelo @po" no fim deste README. Correções pequenas já foram aplicadas nos arquivos das stories; **F1 e F3 foram resolvidos pelo @sm em 2026-07-25** (reescrita de CFG-2.1 seguindo P1; rebaixamento de CFG-4.1/CFG-5.1 ao delta real). **F2 foi resolvido pelo dono + @sm em 2026-07-28** (decisão de caminho D-mínimo para CFG-2.2, sem migration). **F4 foi resolvido pelo dono em 2026-07-28** (admin da própria empresa pode editar o nome do tenant, CFG-5.1 AC2). **F5 (separar comportamento de motion nos ACs) foi aplicado nesta rodada em CFG-3.1**, a única story com resíduo — ver seção F5 abaixo.

## Fixes exigidos pelo @po (validação de 2026-07-25, Pax)

Veredito por story pelo checklist de 10 pontos (GO ≥ 7). Correções pequenas já aplicadas em disco nos arquivos das stories; o que está abaixo é o que **não** cabia numa edição cirúrgica.

| Story | Nota | Veredito | Fix pendente (bloqueante) |
|:--|:--|:--|:--|
| CFG-1.1 | 9/10 | **GO condicional** | Nenhum bloqueante. Endereço corrigido para `/admin/configuracoes` em 6 ACs e 5 gates. Falta apenas o spec E2E `tests/e2e/settings-hub-gating.spec.ts` (G8) e o gate manual de instrutor. |
| CFG-2.1 | 5/10 → reescrita | **NO-GO → RESOLVIDO pelo @sm** | **F1 resolvido.** Reescrita completa segue P1: `areas` intacta, `departments`+`department_areas`+`user_departments` novas. Aguarda GO do Hugo (migration) e nova validação do @po. |
| CFG-2.2 | 6/10 → reescrita | **NO-GO → RESOLVIDO pelo dono + @sm** | **F2 resolvido.** Dono escolheu o caminho D-mínimo (2026-07-28, ver `convites-desenho.md`); ACs 1-10 reescritos para acesso via Auth, sem migration. Status: Ready. |
| CFG-2.3 | 9/10 | **GO condicional** | Nenhum bloqueante além do GO do Hugo. |
| CFG-3.1 | 8/10 | **GO → RESOLVIDO (F5 aplicado)** | **F5 resolvido 2026-07-28** — ACs 1 e 6 reescritos como comportamento verificável, vocabulário de motion movido para Dev Notes, gate humano de paridade visual explicitado no AC6. Status `Ready`. |
| CFG-4.1 | 6/10 → reescrita | **NO-GO → RESOLVIDO pelo @sm** | **F3 resolvido.** Rebaixada ao delta real (pílula "PRO" na sidebar + teste novo do `WhitelabelSettingsForm`). Status: Ready. |
| CFG-5.1 | 6/10 → reescrita | **NO-GO → RESOLVIDO pelo @sm (F3) e pelo dono (F4)** | **F3 resolvido** (rebaixada ao delta: teste novo de Salvar/Descartar). **F4 resolvido em 2026-07-28**: dono confirmou que o admin da própria empresa edita o próprio `tenants.name`, aceitando a justificativa do @po de que `saveTenantSettings` nunca alcança tenant alheio. |
| CFG-6.1 | 8/10 | **GO condicional** | Nenhum bloqueante (fato falso do AC5 já corrigido em disco). |
| CFG-7.1 | 6/10 | **NO-GO herdado → RESOLVIDO (schema aplicado)** | Não mais bloqueada por F1 (CFG-2.1 reescrita); nomenclatura já traduzida (@sm, 2026-07-25). **2026-07-28: destravada de fato** — CFG-2.1 aplicada em produção e validada (@po 9/10); AC0 satisfeito com prova; AC0.1 novo carrega o achado do @po (bypass `is_super_admin()` exige filtro `tenant_id` explícito em toda leitura de `departments`). Status `Ready`. |

### F1 (RESOLVIDO 2026-07-25 pelo @sm) — CFG-2.1 inverte a recomendação P1 da matriz

`configuracoes-publicacao-fase1.md` §4 aprova: *"`areas` **fica** Unidade; tabela nova de **departamento** + junção N:N"*. Os ACs de CFG-2.1 faziam o oposto: criavam `units` como tabela nova e transformavam `areas` em departamento via `area_units`. Isso viraria o significado das linhas de `areas` vivas na Cory ("Ribeirão Preto", "Minas Gerais") **sem migrar uma linha e sem quebrar nada** — o modo de falha exato pelo qual P2 e P3 foram REJEITADOS (clientes Supabase não-tipados, o compilador não avisa). Somava-se: `manager_group_units.unit_id` já referencia `areas(id)`, então criar uma tabela real `units` produziria duas entidades com `unit_id` homônimo apontando para tabelas diferentes; e o AC1 antigo (coluna nova em `user_areas`) contradizia o AC2 ("zero objeto existente tocado"), com um grep de prova que não cobria o caso.
**Resolução aplicada (@sm, 2026-07-25):** `CFG-2.1.story.md` foi reescrita por completo. `areas` permanece UNIDADE, sem nenhuma alteração; a tabela nova é `departments` (o DEPARTAMENTO); a junção N:N é `department_areas` (department_id, area_id→areas); o vínculo pessoa↔departamento é a tabela nova `user_departments`, sem tocar `user_areas` — o que elimina a autocontradição AC1×AC2 pela raiz, em vez de só reescrever a promessa. O requisito antigo de editar 5 arquivos de job-roles/recommendations deixou de existir, porque `job_roles.area_id` não muda de significado nesta versão (documentado com gate de `git diff --stat` vazio). Story permanece `Blocked`, agora aguardando (a) GO do Hugo para aplicar a migration e (b) nova validação do @po sobre a reescrita — não é mais um NO-GO de desenho.

### F2 (RESOLVIDO 2026-07-28 pelo dono + @sm) — CFG-2.2 era um pedido de decisão, não uma story implementável

O AC2 original listava três desenhos possíveis e não escolhia; os ACs 1 e 3 só viravam critério verificável depois da escolha. O @architect produziu material de decisão (`docs/architecture/convites-desenho.md`) acrescentando um quarto caminho (D, Auth como fonte da verdade do aceite) e medindo blast radius real: 23 call-sites tocam `users.status`, 1 tem guard de tipo, 0 quebrariam o build com um valor novo — o mesmo modo de falha que já reprovara os caminhos B/P2/P3 na CFG-2.1.
**Resolução aplicada:** o dono decidiu **caminho D, variante D-mínimo** (2026-07-28) — não a recomendação (a) do @po (tabela `user_invites` como fonte da verdade), mas o caminho que lê o ciclo de vida que o Supabase Auth já mantém, sem criar tabela nem migration. A CFG-2.2 foi reescrita pelo @sm com ACs 1-10 para esse caminho e passou a `Ready`.

### F3 (RESOLVIDO 2026-07-25 pelo @sm) — CFG-4.1 e CFG-5.1 pediam trabalho que a casca já entregou

Verificado em disco: `admin/configuracoes/marca/page.tsx` já monta o `WhitelabelSettingsForm` original com `SectionHeader` e gate de plano (cobria CFG-4.1 ACs 1, 2, 5); `_components/org-data-form.tsx` já chama `saveTenantSettings` com `LogoUpload`/`ColorPicker`/`BrandingPreview` e Salvar/Descartar, e `organizacao/page.tsx` já tem `SectionHeader` (cobria CFG-5.1 ACs 1, 2, 3, 5). A premissa de CFG-5.1 de que `saveTenantSettings` "não tem nenhum caller" estava obsoleta, e o gate `grep saveTenantSettings` daquela story já passava sem trabalho nenhum.
**Resolução aplicada (@sm, 2026-07-25):** as duas stories foram reescritas, rebaixadas ao delta real. **CFG-4.1** (Ready): pílula "PRO" na sidebar quando o plano não cobre + teste novo do `WhitelabelSettingsForm` (nunca existiu). **CFG-5.1** (Ready, exceto AC4): teste novo de Salvar/Descartar + `[AUTO-DECISION]` do @sm de não duplicar o form na aba "Configurações Gerais" da rota antiga (fica como `<p>` estático — D3 exige acesso preservado, não paridade de capacidade; duplicar seria a "implementação paralela" que o plano §2 Passo 4 proíbe). O gap de autoridade sobre `tenants.name` (F4) foi preservado intacto como decisão do dono, não decidido nesta reescrita.

### F4 (RESOLVIDO 2026-07-28 pelo dono) — autoridade sobre `tenants.name` (CFG-5.1 AC4)

Hoje `saveTenantSettings` aceita `admin`+`super_admin`, enquanto `PATCH /api/admin/tenants/[tenantId]` exige `super_admin`. Ligar o form do hub amplia quem edita o nome do tenant. Não era decisão do @po nem do @sm.
**Resolução aplicada:** o dono confirmou a ampliação — o admin da própria empresa PODE editar o nome do próprio tenant. Justificativa aceita, a mesma recomendação que já estava registrada aqui: `saveTenantSettings` resolve o `tenantId` a partir do PRÓPRIO `profile.tenant_id` de quem chama (nunca de um parâmetro do payload — `tenantSettingsSchema` não tem campo `tenantId`), logo o admin só alcança o PRÓPRIO tenant e nenhuma porta lateral para editar empresa alheia se abre; o console de super-admin (`PATCH /api/admin/tenants/[tenantId]`, guard estrito `profile.role !== "super_admin"`) continua intocado para editar qualquer tenant. **Nenhuma mudança de comportamento foi necessária** — a casca (CFG-1.1) já entregava esse comportamento de fato; a decisão do dono apenas confirma o que já está em produção. `CFG-5.1` AC2 (antigo AC4) foi reescrito de "questão aberta" para critério verificável com gate próprio, e a story está `Ready` sem pendência.

### F5 (RESOLVIDO 2026-07-28 pelo @sm, para as stories com resíduo) — separar comportamento de motion nos ACs de fidelidade

Vários ACs importam vocabulário do harness do mockup (`chevron`, `.uv-drawer`, "Coreografia", "padrão visual/motion do SPEC §G3"). Nenhum desses é verificável por gate mecânico, e "ficar igual ao mockup" não é critério de aceite. **Regra para todo o épico:** o AC descreve o COMPORTAMENTO observável (o colapso persiste entre navegações; o drawer abre com os blocos X, Y, Z; a corporativa aparece nas N colunas que cobre); o mockup é referência **visual**, citada em Dev Notes, nunca em AC. Onde a paridade visual importar de verdade, ela vira gate humano explícito ("Hugo aprova o visual"), não um AC que o dev possa marcar sozinho.
**Varredura de 2026-07-28 (`grep -niE "chevron|uv-drawer|Coreografia|padrão visual/motion|§G3"` em todas as stories):** o resíduo estava só em **CFG-3.1** (ACs 1 e 6) — resolvido, ver Change Log da própria story. **CFG-6.1 e CFG-7.1 já estavam limpas** (CFG-7.1 só cita "Coreografia" em "Fica para depois", fora de AC, o que é correto). **CFG-4.1 e CFG-5.1 não têm resíduo** (nenhum RESULT/SPEC de fidelidade cobre essas duas seções, ver Dev Notes de ambas).

### F6 (transversal, mecânico) — gates que não executavam nada

Achado verificado nesta validação, presente em **7 das 9 stories**: os gates rodavam `npx vitest` a partir da raiz do repo, onde **o binário não existe** (`sh: vitest: command not found` — ele só está em `apps/web/node_modules/.bin` e `packages/shared/node_modules/.bin`; na raiz há `biome`, `tsc` e `playwright`). Pior: 5 gates apontavam para diretórios **sem nenhum arquivo de teste** (`(platform)/admin/users`, `/admin/job-roles`, `/admin/areas`, `/admin/settings`, `packages/database`), e um apontava para um arquivo-fonte (`registry.ts`) como se fosse teste. Um gate que não roda é pior que um gate ausente: ele produz "verde" sem executar um único assert.
**Já corrigido em disco em todas as 9 stories** (forma canônica: `cd apps/web && npx vitest run src/...`, path relativo ao workspace).

**Estado real verificado em 2026-07-28** (`find`/`ls` em disco, não presumido):
- ✅ **Criado:** teste do accessor de último acesso com falha simulada (CFG-2.3, AC6) — `apps/web/src/app/(platform)/admin/users/__tests__/last-sign-in.test.ts`, `describe("AC6 — o acesso privilegiado falha e a página continua de pé")`, cobre service role indisponível, erro da API de Auth e erro de rede, todos devolvendo mapa vazio sem lançar. **Sai da lista de pendências.**
- ❌ **Ainda falta:** `whitelabel-settings-form.test.tsx` (CFG-4.1, AC2) — não existe em disco.
- ❌ **Ainda falta:** `org-data-form.test.tsx` (CFG-5.1, AC1) — não existe em disco.
- ❌ **Ainda falta:** `__tests__/delete-job-role.test.ts` (CFG-3.1, AC8) — não existe; o único teste sob `admin/job-roles/__tests__/` hoje é `tenant-scope.test.ts` (de outra frente, auditoria de escopo de tenant), que não cobre exclusão/reatribuição.
- ❌ **Ainda falta:** teste de MOVER≠EXPANDIR (CFG-7.1, AC6) — não existe; esperado, a story estava `Blocked` até esta rodada e agora está `Ready`, o teste nasce junto com a implementação do AC6.
- **Achado extra, não listado no F6 original:** CFG-2.2 (accessor de convites, AC1) já tem 8 arquivos de teste novos em disco (`auth-accounts.test.ts`, `invite-status.test.ts`, `loader-invite-stats.test.ts`, `invite-lifecycle.test.ts`, entre outros), registrados no próprio Dev Agent Record da story — sem pendência de teste ali.

### F7 (RESOLVIDO 2026-07-28 pelo @sm) — nenhuma story tinha estimativa de tamanho

O ponto 6 do checklist de 10 pontos (complexidade/sizing) não era atendido por nenhuma story: o campo `Tier` é classificação de governança (`sdc-mandatory.md`), não estimativa. **Resolução aplicada:** as 11 stories do épico têm agora `Tamanho: S|M|L` no cabeçalho (`grep -l "Tamanho:" docs/stories/epic-configuracoes/*.story.md` → 11/11). Ver "Sequência recomendada da Fase 3" no fim deste README para o uso prático dessa estimativa.

### Confirmação de conformidade com o plano executável

- **Nenhuma story propõe renomear `areas` para `units`** (caminho P2, REJEITADO com evidência), e **nenhuma tabela nova chamada `units` existe mais no repo de stories** após a reescrita de CFG-2.1 (guard mecânico no próprio gate da story: `grep -c "\bunits\b"` esperado 0). P3 (`kind`+`parent_id`) também não aparece em nenhuma story.
- **Nenhuma story viola os riscos de §5:** zero migration na Fase 1 (CFG-1.1 declara `Migrations: NENHUMA`); nenhuma propõe `git add -A`/`stash`/`restore`; nenhuma propõe push/PR; nenhuma propõe redirecionar as rotas antigas (D3/§5.7 preservados, e CFG-3.1 explicita que o acesso mais amplo de `manager`/`instructor` continua servido pela rota antiga); nenhuma propõe route group novo (§5.4); a aba SSO não fica órfã (CFG-1.1 AC7 adiciona o item "Autenticação", §5.6); a aditividade de nav para Auditoria e Plano & Cobrança está no AC7 (§5.5).
- **A contradição com a matriz §4 (F1) foi resolvida** pela reescrita de CFG-2.1 em 2026-07-25 — `areas` permanece Unidade, a tabela nova é `departments`. **F2 (decisão do dono sobre CFG-2.2) foi resolvido em 2026-07-28** — caminho D-mínimo, sem migration. **F4 (decisão do dono sobre `tenants.name` em CFG-5.1) foi resolvido em 2026-07-28** — admin da própria empresa edita o próprio tenant. **F5 (vocabulário de motion nos ACs) e F7 (sizing) também resolvidos em 2026-07-28.** Nenhum ponto de decisão do dono permanece em aberto no épico. O que resta é mecânico e localizado: os 4 arquivos de teste ainda ausentes listados em F6 (naturais de trabalho não iniciado, não de gate quebrado).

**Nota sobre a variante "Assinatura":** `configuracoes-hub-assinatura.html` é uma cópia exploratória (motion/visual: transições direcionais, sombra reativa ao drag, spotlight, pulso do tenant-chip) feita para comparação, nunca mesclada ao arquivo baseline (`configuracoes-hub.html`) nem ao produto. Nenhuma story deste backlog assume a variante Assinatura como escopo — ela é insumo de decisão visual futura, registrada aqui para não se perder.

## Sequência recomendada da Fase 3 (River, @sm, 2026-07-28)

As 5 stories de fidelidade estão **todas `Ready`** pela primeira vez neste épico. Ordem sugerida por custo (`Tamanho`) e dependência — recomendação para o Regente decidir, não decisão desta rodada:

1. **CFG-5.1 (S)** — a menor de todas, e a única que teve uma decisão do dono pendente (F4) fechada nesta própria rodada; zero risco de schema, zero dependência externa além de CFG-1.1. Bom primeiro corte para validar o padrão de "delta real" (teste novo + gate) com custo mínimo.
2. **CFG-4.1 (S)** — mesmo porte e mesmo perfil de risco de CFG-5.1 (delta pequeno sobre casca já entregue, único teste novo). Sequenciada logo depois por ser a única seção onde o produto já está à frente do mockup, sem nenhuma decisão de UX nova a tomar.
3. **CFG-3.1 (L)** — maior custo entre as sem dependência de schema, mas autocontida (só depende de CFG-1.1); o AC8 muda uma regra de escrita visível em duas rotas (hub e `/admin/job-roles`), então vale rodar com o time "fresco" das duas primeiras, antes de acumular contexto de outra frente em paralelo.
4. **CFG-6.1 (L)** — ACs 1-7 já podem começar em paralelo com qualquer uma das anteriores (mesma dependência, só CFG-1.1), mas os ACs 8-9 dependem de CFG-2.2/CFG-2.3 estarem de fato mescladas (hoje em execução por outra frente); sequenciar depois de CFG-3.1 dá tempo para essas duas convergirem sem bloquear o restante da story.
5. **CFG-7.1 (L)** — por último, não por ser a maior, mas por ser a que a própria story nomeia como "a operação de maior risco de todo o épico" (MOVER≠EXPANDIR, gate dedicado) somada ao achado novo do @po (AC0.1, filtro `tenant_id` explícito, achado numa validação de HOJE); entrar por último dá ao time o padrão de drawer/Mapa já rodado uma vez em CFG-3.1/CFG-6.1 antes de encarar a peça mais nova e mais arriscada.
