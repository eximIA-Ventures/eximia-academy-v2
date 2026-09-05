# Paridade visual — Configurações (Fase 3, EPIC-CONFIGURACOES)

**Data:** 2026-07-30
**Branch:** `deploy/cory`
**Status:** 🔴 **BLOQUEADO NA AUTENTICAÇÃO — 0 de 5 telas capturadas**

---

## Resumo executivo

O mapeamento das 5 seções está **concluído** (parte 1 da tarefa). A captura das
imagens está **bloqueada**: as telas ficam atrás de login de admin e não há
credencial disponível para esta frente. Nenhuma tentativa de contornar o login
foi feita — o desbloqueio depende do maestro.

Este relatório será completado com as 5 imagens e as observações visuais assim
que a credencial chegar. O que já está feito não precisa ser refeito.

---

## 1. As 5 seções da Fase 3 (mapeadas)

Fonte cruzada: `docs/stories/epic-configuracoes/README.md` (linha 39, tabela de
Fases) × registry de navegação em
`apps/web/src/app/(platform)/admin/configuracoes/_components/settings-hub-nav.tsx`.

| # | Nome exibido | Rota | Arquivo que renderiza | Story |
|---|---|---|---|---|
| 1 | Dados da organização | `/admin/configuracoes/organizacao` | `apps/web/src/app/(platform)/admin/configuracoes/organizacao/page.tsx` | CFG-5.1 |
| 2 | Marca & Aparência | `/admin/configuracoes/marca` | `apps/web/src/app/(platform)/admin/configuracoes/marca/page.tsx` | CFG-4.1 |
| 3 | Unidades & Áreas | `/admin/configuracoes/unidades` | `apps/web/src/app/(platform)/admin/configuracoes/unidades/page.tsx` | CFG-7.1 |
| 4 | Cargos | `/admin/configuracoes/cargos` | `apps/web/src/app/(platform)/admin/configuracoes/cargos/page.tsx` | CFG-3.1 |
| 5 | Usuários | `/admin/configuracoes/usuarios` | `apps/web/src/app/(platform)/admin/configuracoes/usuarios/page.tsx` | CFG-6.1 |

A raiz `/admin/configuracoes` não é tela: `page.tsx` faz `redirect()` para
`/admin/configuracoes/organizacao`.

### Observação de escopo — o hub tem 9 seções vivas, não 5

O briefing desta frente fala em "5 seções". Isso está correto **para a Fase 3**,
mas o hub que o Hugo vai abrir mostra **9 itens clicáveis** na barra lateral.
As outras 4 vieram da Fase 2 (documentado no cabeçalho do `settings-hub-nav.tsx`:
*"Fase 1: 5 vivas, 11 em cinza. Fase 2: +4 vivas. Total: 9 vivas, 7 em cinza"*):

| Nome exibido | Rota | Fase |
|---|---|---|
| Times | `/admin/configuracoes/grupos` | 2 |
| Segurança & Sessão | `/admin/configuracoes/seguranca` | 2 |
| Auditoria | `/admin/configuracoes/auditoria` | 2 |
| Plano & Cobrança | `/admin/configuracoes/plano` | 2 |

Mais 7 itens em cinza, não-clicáveis, com pílula "Em breve" (Convites, Perfis &
Permissões, Preferências, Notificações, Integrações, API Keys, Webhooks).

**Por que isso importa para o gate visual:** a barra lateral entra no
enquadramento das 5 capturas de qualquer jeito. Se o Hugo aprovar "as 5", ele
estará vendo — e implicitamente aprovando — a coluna com 16 itens em 3
semânticas visuais diferentes (ativo, vivo, cinza+pílula). Vale decidir se as 4
seções da Fase 2 entram no mesmo gate ou ficam para outro.

### Observação estrutural — onde a divergência visual provavelmente mora

As 5 páginas seguem o mesmo padrão: um `<SectionHeader title description />`
seguido do componente que **já existia na rota antiga**:

| Seção | Componente reaproveitado | Rota antiga (segue viva) |
|---|---|---|
| Dados da organização | `OrgDataForm` (próprio do hub) | `/admin/settings` |
| Marca & Aparência | `WhitelabelSettingsForm` | `/admin/settings` (aba Whitelabel) |
| Unidades & Áreas | `AreasWorkspaceClient` | `/admin/areas` |
| Cargos | `JobRolesClient` | `/admin/job-roles` |
| Usuários | `UserManagementClient` | `/admin/users` |

Ou seja: o miolo de cada tela é código já rodado e já visto. A superfície nova é
a **costura** — header, espaçamento entre header e conteúdo, e a consistência
entre as 5. É aí que a inspeção visual deve olhar primeiro.

Três das cinco têm **estado alternativo** que também precisa ser aprovado com os
olhos, e que não aparece numa captura de caminho feliz:

- `organizacao` e `marca` → `TenantRequiredState` quando não há tenant resolvido.
- `marca` → gate de plano: sem `whitelabelEnabled`, renderiza um upsell no lugar
  do formulário (e a barra lateral ganha a pílula "PRO" no item).
- `unidades` → `UnitsModuleUpsell` quando o módulo está desabilitado.

---

## 2. Ambiente local — OK

```
pnpm --filter web dev
▲ Next.js 15.5.12 (Turbopack)
- Local: http://localhost:3000
- Environments: .env.local
✓ Ready in 11.9s
```

O servidor sobe e responde.

---

## 3. Onde exatamente travou

### 3.1 A armadilha do 307 — confirmada

O middleware devolve `307 → /login` **tanto para rota real quanto para rota
inexistente**. Status HTTP não prova nada nesta área:

```
/admin/configuracoes/organizacao              status=307 redirect=.../login
/admin/configuracoes/rota-que-nao-existe-xyz  status=307 redirect=.../login
```

### 3.2 A verificação por render — é a parede de login

Navegador real, viewport 1440x900, `waitUntil: networkidle`:

```
URL final : http://localhost:3000/login
title     : Argos Consultoria — Academy
1o heading: "Aprenda com inteligência."
```

Evidência: **`00-BLOQUEIO-login-wall.png`** (1440x900) — é o que se vê hoje ao
pedir `/admin/configuracoes/organizacao` sem sessão. É a única imagem nesta
pasta; **não é** uma das 5 telas pedidas.

### 3.3 Por que não usei o caminho de e2e que já existe no repo

Existe credencial de teste versionada em `tests/e2e/helpers/auth.ts`
(`admin@test.com` / `Test123!@#`). **Não a usei**, por dois motivos:

1. **`pnpm test:e2e` escreve no banco.** `playwright.config.ts` declara
   `globalSetup: "./tests/e2e/global-setup.ts"`, que chama `seedTestData()`.
   Rodar a suíte cria usuários — proibido no escopo desta frente.

2. **`apps/web/.env.local` aponta para o banco de PRODUÇÃO.** O project ref do
   Supabase em `.env.local` é idêntico ao de `.env.local.PROD-BACKUP`, e
   diferente do de `.env.local.SANDBOX-BACKUP`. Como o `global-setup` carrega
   justamente `apps/web/.env.local`, rodar `pnpm test:e2e` como está semearia
   usuários de teste **em produção**.

   O dev local que subi também está apontado para produção — por isso o usei
   **apenas para leitura** (navegar até a parede de login), sem nenhuma escrita.

⚠️ **Independente desta tarefa, isso merece atenção do dono:** `pnpm test:e2e`
rodado por qualquer pessoa nesta máquina, no estado atual do `.env.local`,
escreve em produção. Não é falha da Fase 3 e não toquei em nada — mas está
registrado aqui porque foi descoberto no caminho.

---

## 4. O que falta e o que eu preciso

Falta: capturar as 5 telas em 1440x900 e escrever as 2–4 linhas de observação
visual de cada uma (seção 5 abaixo, hoje vazia).

Para destravar, preciso de **uma** destas decisões do maestro/dono:

1. **Uma credencial de admin** válida no ambiente onde as telas devem ser vistas
   (produção `argos.eximiaacademy.com.br` ou o sandbox), que eu use só para
   logar e capturar; ou
2. **Autorização + apontamento para o sandbox** (`pkdzthdy...`), incluindo
   confirmação de que ele tem dados suficientes para as telas não saírem todas
   em estado vazio — o que tornaria o gate visual pouco útil; ou
3. **As capturas feitas pelo próprio Hugo**, já logado, que eu então comento.

Não vou criar usuário, alterar banco, mexer em RLS nem tentar adivinhar
credencial em nenhuma dessas rotas.

---

## 5. Observações visuais por tela

_Pendente — depende do desbloqueio da seção 4._

| # | Tela | Imagem | Observações |
|---|---|---|---|
| 1 | Dados da organização | — | — |
| 2 | Marca & Aparência | — | — |
| 3 | Unidades & Áreas | — | — |
| 4 | Cargos | — | — |
| 5 | Usuários | — | — |

---

## Arquivos tocados

Só documentação, dentro de `docs/qa/paridade-visual-2026-07-30/`. Nenhum arquivo
de aplicação foi alterado. Nenhum commit, nenhum push.
