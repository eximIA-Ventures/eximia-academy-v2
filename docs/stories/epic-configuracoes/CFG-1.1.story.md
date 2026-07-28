# CFG-1.1 — Casca do hub de Configurações

> **Status:** InProgress (execução paralela a este registro) · **Tier:** 1 (código de aplicação, multi-arquivo, navegação e middleware) · **Tamanho:** L (layout novo, sidebar 4 grupos/16 itens, 5 sub-rotas, guard de middleware, migração da rota pessoal — casca de todo o hub)
> **Fonte:** `docs/architecture/configuracoes-publicacao-fase1.md` (plano executável, §2 Passos 0-8 e §6 Gates G1-G9)
> **Migrations:** NENHUMA (regra dura da Fase 1 — qualquer passo que exigisse `ALTER TABLE` sai do escopo e vira story de Fase 2)
> **Decisões-dono aplicadas:** D1 (5 vivas), D2 (11 "Em breve", sem arquivo de rota), D3 (hub aditivo, rotas antigas vivas), D5 (endereço `/admin/configuracoes`, página pessoal intocada), D7 (fila CFG-0.1/0.2 é pré-requisito preservado)

## Contexto

Esta story registra e dá critério de aceite ao trabalho de casca do hub que está em execução em paralelo (o plano executável já foi escrito e revisado; esta story serve como checklist de aceite rastreável, não como planejamento novo). Sem uma casca com guard + sidebar + sub-rotas montando os componentes já existentes, nenhuma das 5 seções vivas (CFG-3.1 a CFG-7.1) tem onde morar, e a Fase 2 (esquema aditivo) não tem front-end para consumir o dado novo.

**QUESTÃO ABERTA RESOLVIDA (@po, 2026-07-25) — endereço do hub é `/admin/configuracoes`.** A decisão D5 do dono prevalece sobre o plano executável (`configuracoes-publicacao-fase1.md` Passos 2-3, que propunha `/configuracoes` + mover a página pessoal para `/preferencias`). Consequências, todas verificadas no disco no momento desta validação:
> - O hub vive em `apps/web/src/app/(platform)/admin/configuracoes/` (layout + page + 5 sub-rotas + `_components/`, confirmado por `find`).
> - A página PESSOAL `apps/web/src/app/(platform)/configuracoes/page.tsx` **não se move e não se toca** — ela é a semente do futuro hub de configurações do USUÁRIO. `/preferencias` **não existe e não deve ser criada**.
> - `header.tsx:157` e `studio-header.tsx:112` **continuam apontando para `/configuracoes`** (a página pessoal). Nenhum link de header é repointado.
> - O Passo 2 inteiro do plano executável (mover a rota pessoal) está **CANCELADO**. O Passo 6 muda: `/admin` já está em `protectedPaths`, então nada é adicionado a essa lista.
> Onde o plano executável e esta story divergirem quanto ao path, **esta story vence** — o plano foi escrito antes de D5.

## Acceptance Criteria

1. **Baseline registrado antes de qualquer edição** (Passo 0): `npx tsc --noEmit -p apps/web/tsconfig.json` roda limpo (`exit=0`) e `npx vitest run packages/shared/src/__tests__/registry-nav.test.ts` tem sua contagem de falhas registrada como baseline (era `2 failed | 12 passed` na redação do plano — pode ter mudado, medir de novo antes de editar).
2. **Teste de nav alinhado ao código** (Passo 1): `registry-nav.test.ts:134` e `:157` trocam a expectativa `"Engajamento"` por `"Ações de Engajamento"` (o registry já usa esse rótulo desde a mudança E10); `npx vitest run packages/shared/src/__tests__/registry-nav.test.ts` fecha em `14 passed (14)`.
3. **Página pessoal PRESERVADA, zero movimentação** (D5, substitui o Passo 2 do plano executável, que fica cancelado): `apps/web/src/app/(platform)/configuracoes/page.tsx` e `loading.tsx` permanecem exatamente onde estão, com os mesmos nomes de componente; `apps/web/src/app/(platform)/preferencias/` **não é criada**; `header.tsx:157` e `studio-header.tsx:112` **continuam apontando para `/configuracoes`** (nenhum link de header repointado). Como o hub vive sob `/admin/configuracoes`, não há colisão de `page.tsx` no mesmo path — o motivo original do Passo 2 deixou de existir.
4. **Shell do hub dentro do route group `(platform)` existente** (Passo 3 adaptado a D5) — NÃO um route group novo (seria replicar 6 providers + Header + CSS de tenant à toa): `(platform)/admin/configuracoes/layout.tsx` com guard de servidor (`getAuthProfile` + `hasAnyRole({roles}, ["admin","super_admin"])`, redirect para `/login` sem sessão e `/dashboard` sem chapéu), `(platform)/admin/configuracoes/page.tsx` fazendo `redirect("/admin/configuracoes/organizacao")`, `(platform)/admin/configuracoes/_components/settings-hub-nav.tsx` com os 16 itens em 4 grupos (ORGANIZAÇÃO, PESSOAS, PLATAFORMA, AVANÇADO), ids espelhando o `data-panel` do mockup.
5. **5 itens vivos, 11 bloqueados** dentro da sidebar: os 5 vivos (`org-dados`→`/admin/configuracoes/organizacao`, `org-marca`→`/admin/configuracoes/marca`, `org-unidades`→`/admin/configuracoes/unidades`, `org-cargos`→`/admin/configuracoes/cargos`, `pessoas-usuarios`→`/admin/configuracoes/usuarios`) são `<Link>`; os 11 restantes são `<span>`/`<button disabled>` com pílula "Em breve" e `aria-disabled="true"`, **sem arquivo de rota criado para eles** (D2).
6. **5 sub-rotas montando os componentes já existentes, sem reimplementar tela** (Passo 4): cada sub-rota extrai o loader de dados do `page.tsx` server antigo para um módulo `loader.ts` co-locado, chamado pelas DUAS rotas (antiga e do hub) — `organizacao`/`marca` reusam `saveTenantSettings`/`saveWhitelabelConfig` + `LogoUpload`/`ColorPicker`/`BrandingPreview`/`WhitelabelSettingsForm`/`WhitelabelPreview`; `unidades` reusa `AreaManagementClient`; `cargos` reusa `JobRolesClient`; `usuarios` reusa `UserManagementClient`+`UserList`+`InviteUserDialog`+`UserProfileDialog`.
7. **Sidebar principal editada exatamente conforme o plano** (Passo 5, todas as mudanças em `packages/shared/src/modules/registry.ts`): remover das linhas do bloco `admin` os itens Cargos (`/admin/job-roles`), Usuários (`/admin/users`) e Unidades (`/admin/areas`, dentro do bloco `admin`); trocar o item Configurações para `{ label: "Configurações", href: "/admin/configuracoes", icon: "Settings" }` (D5); remover o item duplicado do módulo `units` (`nav.admin` do bloco `units`, mantendo `routes`/`apiRoutes` intactos — `ModuleGate`/`isRouteAllowed` dependem deles); **adicionar** `{ label: "Autenticação", href: "/admin/settings", icon: "Shield" }` sob "Sistema" (para não orfanar a aba SSO funcional); **adicionar** à chave `admin` `{ label: "Auditoria", href: "/admin/audit", icon: "Shield" }` e `{ label: "Plano & Cobrança", href: "/admin/plans", icon: "CreditCard" }` (aditividade real — hoje sem nenhuma entrada de nav para admin de tenant). NÃO ligar o módulo `integrations` (decisão do dono, registrada, não é bug).
8. **Guard no middleware** (Passo 6 adaptado a D5): `protectedPaths` **NÃO é alterada** — `/admin` já está lá (`middleware.ts:329`), e `/admin/configuracoes` herda essa proteção, logo o deslogado já cai em `/login` sem nenhuma edição. O que entra é apenas o guard novo, inserido após o bloco de `/instructor` e antes da escrita do cookie de workspace, checando `pathname.startsWith("/admin/configuracoes")` com `effectiveHats` (união de chapéus reais, nunca `profile.role` singular) contendo `admin` ou `super_admin`, redirect para `/dashboard` caso contrário; `blockedForInstructor` **NÃO** é tocado (o guard novo já cobre instrutor, que não tem chapéu admin).
9. **Inbound links repointados** (Passo 7) conforme a tabela do plano, com os paths corrigidos por D5: `admin-dashboard-page.tsx:116` (`/admin/users`→`/admin/configuracoes/usuarios`) e `:126` (`/admin/settings`→`/admin/configuracoes/organizacao`); demais links da tabela mantidos conforme a coluna "Ação" do plano (nenhuma invenção fora da tabela). Os links de header para `/configuracoes` (página pessoal) **não** são inbound links do hub e não entram nesta lista (AC3).
10. **Rotas antigas permanecem vivas, sem redirect, sem nav** (Passo 8, D3): `/admin/areas`, `/admin/job-roles`, `/admin/users`, `/admin/settings` continuam respondendo e renderizando via o loader extraído no AC6, preservando o acesso de `manager` (areas, job-roles) e `instructor` (job-roles) exatamente como hoje.
11. **Todos os gates G1-G9 do plano executável fecham verdes** (ver seção Gate abaixo), incluindo a asserção de regressão do nav (`buildNavigation — admin keys are untouched`) com as 9 expectativas literais do plano (G3).

## Dev Notes

- Guard de servidor: `getAuthProfile` é `cache()`-ado (`apps/web/src/lib/auth.ts`), não duplica query com `(platform)/layout.tsx`. Usar `hasAnyRole`/`roles` (união de chapéus), nunca `profile.role` singular (padrão legado usado em `admin/users/page.tsx:16`, não replicar aqui).
- `apps/web/src/lib/navigation.ts` não precisa de edição para os ícones `Settings`/`Shield`; se usar `CreditCard` para Plano & Cobrança, confirmar presença em `ICON_MAP` — ícone ausente não quebra o build, cai silenciosamente em `LayoutDashboard` (não é erro fatal, mas é regressão visual silenciosa).
- Estado verificado do bloco `admin` do registry ANTES desta story (para conferência de diff): `{section:"Administração"}`, Engajamento (`/admin/notifications`), Cargos (`/admin/job-roles`), Usuários (`/admin/users`), Unidades (`/admin/areas`), Grupos de Gestor (`/admin/manager-groups`), `{section:"Sistema"}`, Configurações (`/admin/settings`). O bloco `units` tem `nav.admin: [{label:"Unidades", href:"/admin/areas"}]` duplicado (motivo do "Unidades" aparecer 2× hoje, `buildNavigation` não deduplica).
- Guard de página das rotas antigas (confirmar que nada mudou nelas): `admin/areas/page.tsx` libera `["admin","super_admin","manager"]`; `admin/job-roles/page.tsx` libera `["manager","admin","instructor","super_admin"]`; `admin/users/page.tsx` libera só `["admin","super_admin"]`.
- `apps/web/src/middleware.ts` já está no working tree com modificações de outra frente (`git status --porcelain` mostrou `M apps/web/src/middleware.ts` antes desta story começar) — o diff desta story deve ser cirúrgico (só as linhas do AC8), nunca revertendo o que já está lá.
- `packages/shared/src/modules/registry.ts` e `packages/shared/src/__tests__/registry-nav.test.ts` estavam limpos (sem modificação) no início desta story — qualquer diff neles pertence exclusivamente a esta story.
- Working tree compartilhado (~92 entradas em `git status --porcelain` fora desta frente, Jornada/engagement/meu-plano): **NUNCA** `git add -A`, `git stash`, `git checkout .`/`restore .`. Commit (quando pedido pelo Regente) sempre por path explícito.

## Gate

Todos os comandos abaixo, literais, de `/Users/hugocapitelli/Dev/eximia/eximia-academy-v2` salvo onde houver `cd` explícito.

> **Nota @po (verificada):** o binário `vitest` **não existe** em `node_modules/.bin` da raiz (`npx vitest` na raiz devolve `sh: vitest: command not found`). Ele só existe nos workspaces `apps/web` e `packages/shared`. Todo gate de teste precisa de `cd` no workspace e path relativo a ele. Na raiz existem `biome`, `tsc` e `playwright`.

```bash
# G1 — tipos limpos
npx tsc --noEmit -p apps/web/tsconfig.json ; echo "exit=$?"        # esperado: exit=0, saída vazia

# G2 — teste de nav verde
cd packages/shared && npx vitest run src/__tests__/registry-nav.test.ts 2>&1 | tail -4   # esperado: Tests 14 passed (14) ou mais, com as asserções de G3

# G3 — asserções de regressão de nav (bloco "buildNavigation — admin keys are untouched")
# expect(s).toContain("Administração"); expect(l).toContain("Configurações");
# expect(hrefs(nav)).toContain("/admin/configuracoes"); expect(l).not.toContain("Usuários");
# expect(l).not.toContain("Cargos"); expect(hrefs(nav)).not.toContain("/admin/areas");
# expect(hrefs(nav)).toContain("/admin/settings"); expect(hrefs(nav)).toContain("/admin/audit");
# expect(hrefs(nav)).toContain("/admin/plans"); expect(s).not.toContain("Gestão do Time")

# G4 — estrutura do hub
find "apps/web/src/app/(platform)/admin/configuracoes" -name page.tsx | wc -l                                             # esperado: 6
grep -c 'href="/admin/configuracoes/' "apps/web/src/app/(platform)/admin/configuracoes/_components/settings-hub-nav.tsx"  # esperado: 5
grep -c 'Em breve' "apps/web/src/app/(platform)/admin/configuracoes/_components/settings-hub-nav.tsx"                     # esperado: 11
grep -cE 'ORGANIZAÇÃO|PESSOAS|PLATAFORMA|AVANÇADO' "apps/web/src/app/(platform)/admin/configuracoes/_components/settings-hub-nav.tsx"  # esperado: 4

# G5 — página pessoal INTOCADA e links de header preservados (D5, substitui o antigo G5 de migração)
ls "apps/web/src/app/(platform)/configuracoes/"                    # esperado: loading.tsx  page.tsx (a página PESSOAL, no lugar)
test ! -e "apps/web/src/app/(platform)/preferencias" && echo "ok: /preferencias não foi criada"
grep -rn '"/configuracoes"' apps/web/src/components/layout/header.tsx apps/web/src/components/studio/studio-header.tsx   # esperado: 2 hits (links pessoais preservados)
git diff --stat -- "apps/web/src/app/(platform)/configuracoes"     # esperado: vazio (nenhuma linha tocada na página pessoal)

# G6 — guard presente
grep -n '"/admin/configuracoes"' apps/web/src/middleware.ts         # esperado: >=1 hit (o guard de chapéu)
grep -n 'protectedPaths' apps/web/src/middleware.ts                 # esperado: lista INALTERADA, "/admin" já cobre o hub
grep -n 'hasAnyRole' "apps/web/src/app/(platform)/admin/configuracoes/layout.tsx"   # esperado: 1 hit

# G7 — rota respondendo e negando sem sessão (com `npm run dev` em :3000)
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/admin/configuracoes  # esperado: 307 → /login
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/configuracoes                        # esperado: 200 (página pessoal segue viva)

# G8 — gating negando não-admin (E2E, spec novo tests/e2e/settings-hub-gating.spec.ts)
npx playwright test tests/e2e/settings-hub-gating.spec.ts
# asserções: student → /dashboard; manager → /dashboard; admin → /admin/configuracoes/organizacao com 5 links + 11 "Em breve".
# Instrutor NÃO é automatizável (loginAs cobre só student|manager|admin) — gate manual obrigatório:
# logar como instrutor, abrir /admin/configuracoes (deve cair em /dashboard) e confirmar que /admin/job-roles CONTINUA acessível (D3).

# G9 — nenhum arquivo fora do escopo tocado
git status --porcelain | wc -l                                      # esperado: baseline (Passo 0) + só os arquivos desta story
git status --porcelain | grep -vE 'jornada|engagement|meu-plano' | sort
```

## Change Log
| Data | Evento |
|:--|:--|
| 2026-07-25 | Story criada por River (@sm) a partir do plano executável `configuracoes-publicacao-fase1.md`, para registrar/rastrear o trabalho de casca já em execução paralela. |
| 2026-07-25 | Validada por Pax (@po). QUESTÃO ABERTA do endereço **resolvida por D5**: hub em `/admin/configuracoes`, página pessoal intocada, `/preferencias` cancelada, links de header preservados. ACs 3, 4, 5, 7, 8, 9 e gates G4-G8 corrigidos para o path real (confirmado em disco: `find` mostra os 6 `page.tsx` sob `(platform)/admin/configuracoes/`, `preferencias/` não existe, header aponta para `/configuracoes`). Nota adicionada sobre `vitest` não existir na raiz. Veredito: **GO condicional** (9/10). |
