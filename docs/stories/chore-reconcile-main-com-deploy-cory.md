# Story: Reconciliar `main` com `deploy/cory` — trazer o trabalho compartilhado de volta ao ponto de integração real

**Version:** 1.1
**Created:** 2026-08-09
**Updated:** 2026-08-09 (correções pós NO-GO)
**Author:** River (@sm)
**Status:** **Ready** — validada GO (8.5/10) pelo @po em 2026-08-09, com correção B8 aplicada pelo próprio @po em AC-1/AC-5/Comandos
**Priority:** P1 (dívida estrutural de branching, risco cresce a cada cliente novo)
**Branch:** `chore/reconcile-main-deploy-cory` (nova, cortada de `main`)
**Type:** Chore/infraestrutura (brownfield) — reconciliação de histórico Git, sem feature nova
**Tier:** 1 (SDC completo — risco real de produção, mexe em rotas de autorização/LGPD, cria CI em `main`)

## Executor Assignment

```
executor: "@dev"
quality_gate: "@architect"
quality_gate_tools: ["typecheck", "vitest", "build", "manual diff review de auth/RLS/tenant-config"]
```

**Nota de delegação (`agent-authority.md`):** `@dev` executa o merge local (branch, `git merge`, resolução de conflito, commits locais) — tudo permitido para `@dev` sem restrição. **Abertura de PR e merge para `main`, e o back-merge final para `deploy/cory`, são autoridade EXCLUSIVA de `@devops`** (`gh pr create`/`gh pr merge` bloqueado para `@dev`). Ver Abordagem recomendada, passos 7–9, e Tasks/Subtasks abaixo — `@dev` prepara, `@devops` publica.

---

## User Story

**As a** engenharia do eximIA Academy,
**I want** que `main` volte a ser o ponto de integração real de todo trabalho compartilhado (não específico de cliente),
**so that** o histórico não continue divergindo silenciosamente por 449+ commits, e que cada cliente novo (`deploy/{client}`) não precise ser cortado de outro cliente por falta de alternativa.

**As a** dono do produto (LGPD/segurança),
**I want** que a reconciliação revise manualmente qualquer arquivo que toque autorização, LGPD ou configuração de tenant,
**so that** nenhuma regra de acesso seja resolvida por "aceitar automático" de um lado do merge.

---

## Contexto (recon já investigado — usar como insumo, não redescobrir)

Investigação prévia, factual e verificada:

- `main` é o default branch no GitHub (correto — **não é objetivo desta story mudar isso**). **É `main` que está parada**: tip `2bc746e`, 2026-07-16, sem receber commit novo desde então. `deploy/cory` é a branch ativa — tip `c65f1da`, **hoje**, 2026-08-09 (os commits do POP-FIX-001 Passo 5, fechados horas atrás). `main` está **449 commits atrás** de `deploy/cory@c65f1da` (contagem confirmada: `git rev-list --count origin/main..origin/deploy/cory` = 449). Zero merge commits na história de `main`. Apenas 1 PR na vida do repo até hoje (#1, 2026-07-13).
  > **Correção 2026-08-09 (B1, @po):** a formulação original ("main está 449 commits atrás de deploy/cory, tip 2bc746e") citava o tip errado — `2bc746e` é o tip de `main`, não de `deploy/cory`. A leitura estava invertida: quem parou foi `main`, não `deploy/cory`.
- `deploy/cory` é a branch de **produção do cliente Argos**, não um trunk genérico. `apps/web/tenant.config.ts` documenta no próprio cabeçalho: *"Tenant configuration — customized per deployment branch. On `main`: defaults for local development. On `deploy/{client}`: client-specific branding and modules."* O `README.md` §Contribuindo confirma o desenho pretendido: branch a partir de `main`, PR para `main` com revisão obrigatória.
- Desde `faa106e` (2026-07-16, último merge de `main` → `deploy/cory`), a integração de trabalho compartilhado passou a acontecer **dentro de `deploy/cory`**, sem decisão registrada — deriva de prática, não arquitetura.
- Existe uma **segunda branch de cliente**, `deploy/vertice`, cortada de `deploy/cory` em 19c2824 (2026-07-29). Desde então `deploy/cory` avançou **45 commits** que `deploy/vertice` não tem (`git rev-list --count origin/deploy/vertice..origin/deploy/cory` = 45), diferença de **118 arquivos** no diff bruto entre as duas pontas hoje. O problema piora a cada cliente novo se não for corrigido agora — **`deploy/vertice` está fora de escopo desta story** (ver §Fora de escopo).
- `ci.yml` existe **só em `deploy/cory`**, nunca em `main`. Referencia `on: push: branches: [main, develop]` — `develop` **não existe** no repo. CI nunca rodou em nenhum dos 2 PRs da história do repo (confirmado via `gh run list`).
- **Risco real, já materializado uma vez:** uma tentativa de merge parecida (`engagement-center-v2` → `main`, 2026-07-13) produziu 3 conflitos de código-fonte, um deles numa rota de autorização/LGPD em produção.
- PR #2 (`https://github.com/eximIA-Ventures/eximia-academy-v2/pull/2`) já está aberto contra `main`, adicionando `.github/ISSUE_TEMPLATE/`. Não depende desta story, mas colide trivialmente se `main` mudar muito antes de mergear. Recomendação: revisar/mergear o PR #2 antes ou logo depois desta story, **não durante** o merge de reconciliação (evita dois merges concorrentes na mesma janela).
- **Alvo fixo (B2, @po):** `deploy/cory` é branch ativa e pode receber commits novos a qualquer momento (recebeu hoje mesmo). Esta story reconcilia **até o SHA `c65f1da` especificamente**, não "até o tip de `deploy/cory`" no momento da execução. Se `deploy/cory` avançar antes do @dev começar, o @dev registra o novo SHA e a diferença de commits na story antes de prosseguir — o alvo é sempre um SHA nomeado, nunca uma branch móvel.

---

## Objetivo

Trazer `main` de volta a ser o ponto de integração real, absorvendo o trabalho **compartilhado** (não específico de cliente) que hoje só existe em `deploy/cory`, **sem contaminar `main` com configuração do cliente Argos** — `tenant.config.ts` em `main` deve permanecer neutro/default, nunca virar `slug: cory-alimentos` ou equivalente.

---

## Acceptance Criteria

1. **AC-1 — `tenant.config.ts` neutro, verificado explicitamente.** Após o merge, `apps/web/tenant.config.ts` (e qualquer arquivo de config equivalente por tenant) contém os defaults de desenvolvimento local, não a configuração do cliente Argos. Verificação explícita (diff citado na story/PR, não presumida por "o merge passou").
   > **Ref correto (B8, @po):** o `@dev` verifica **na branch de trabalho** `chore/reconcile-main-deploy-cory` (é lá que o merge existe antes do PR); `main` só contém o resultado depois que `@devops` mergeia o PR. Verificar contra `main` durante a Task 2 leria a árvore **pré-merge** e daria falso-limpo. `@devops` re-confirma em `main` após o merge do PR.
2. **AC-2 — Rotas de autorização/LGPD revisadas linha a linha, com artefato verificável.** O @dev produz, na story, uma **tabela de revisão** com 1 linha por arquivo sensível (a partir da saída do `git diff --name-only` de auth/RLS/tenant-config já listado nos Comandos de Verificação), colunas: `Arquivo | Resolução (ours/theirs/manual) | Justificativa`. Nenhuma linha pode ter resolução `ours`/`theirs` sem justificativa textual explicando por que aquele lado é seguro de aceitar. Um AC "revisado manualmente" sem essa tabela não é considerado cumprido.
3. **AC-3 — `ci.yml` existe em `main`, com triggers corrigidos.** O workflow é portado para `main` sem a referência à branch `develop` inexistente. Avaliar explicitamente (e registrar a decisão, mesmo que seja "não") se `push` em `deploy/**` deveria também disparar CI.
4. **AC-4 — `main` fica verde após o merge.** `git status` limpo (working tree sem conflito pendente), `pnpm --filter @eximia/web typecheck`, suíte de testes e `pnpm --filter @eximia/web build` executados em `main` pós-merge, com resultado documentado na story (mesmo padrão de report usado em `docs/stories/fix-manager-privacy-gates.md` — comparar contra o baseline de falhas pré-existentes, não exigir 100% verde se já havia falhas anteriores não relacionadas).
5. **AC-5 — Nenhum dado ou config específica do cliente Argos vaza para `main`, verificado por comando contra baseline.** *(Reescrito pelo @po em 2026-08-09 — B8. A versão 1.1 deste AC foi testada contra o repo real e não era operável; os motivos estão registrados abaixo para que não seja "corrigida de volta".)*

   **Comando (usar `-P`, não `-E`):**
   ```bash
   git grep -inP '\b(cory|argos)\b' HEAD -- apps/web packages/ supabase/
   ```
   Rodar na **branch de trabalho** (`HEAD` = `chore/reconcile-main-deploy-cory` pós-merge, pré-PR), nunca contra `main` — ver a nota de ref em AC-1.

   **Critério: diferença contra o baseline, não contagem absoluta.** O baseline de `main@2bc746e` foi medido em 2026-08-09 e é **64 linhas em 6 arquivos**:
   `apps/web/src/app/brandbook/layout.tsx`, `apps/web/src/app/brandbook/page.tsx`, `supabase/migrations/20260311000000_cory_alimentos_tenant_update.sql`, `supabase/migrations/20260311100000_user_tenant_memberships.sql`, `supabase/migrations/20260421000001_tenant_deployment_url.sql`, `supabase/seed-cory-users.py`.
   Ou seja: **`main` já contém artefatos com o nome do cliente hoje, antes deste merge.** O AC é sobre o que **este merge acrescenta**, não sobre limpar o passado. **Não remover** nada do baseline acima — isso é dívida pré-existente, fora do escopo desta story.

   **Allowlist do que NÃO conta como vazamento:** (a) os 6 arquivos de baseline acima; (b) migrations já aplicadas em produção (remover migration histórica quebra o histórico do banco — nunca deletar, escalar se parecer necessário); (c) fixtures de teste que usam `tenant_id: "cory"` como dado de exemplo multi-tenant, desde que o teste seja de lógica compartilhada e não de regra de negócio exclusiva do cliente; (d) referências de marca no `brandbook`.

   **Conta como vazamento** (e deve ser removido antes de fechar a story): configuração de tenant apontando o cliente em `tenant.config.ts` ou equivalente; segredo, credencial, URL de produção ou dado pessoal real do cliente; e regra de negócio codificada como exclusiva de Argos/Cory dentro de caminho compartilhado. Colar o output do comando na story, com cada match novo (fora do baseline) classificado como allowlist ou vazamento.

   > **Por que não `-iE 'cory|argos'` (a forma da v1.1):** medido no repo, retorna **74 matches em `main` e 276 em `deploy/cory`**, inflados por falso-positivo de substring — a palavra portuguesa **"cargos"** contém "argos", e o repo tem um módulo inteiro `admin/job-roles` que a usa. A forma `-P` com `\b` elimina esse ruído. **Atenção:** `\b` **não** funciona com `-E` no git grep (retorna 0 matches, um falso-limpo silencioso) — só com `-P`.
6. **AC-6 — Trabalho compartilhado vs. específico de cliente foi triado, não assumido.** O @dev produz (na story ou em anexo) um inventário dos commits entre `main` e `deploy/cory@c65f1da` desde a última integração comum (`faa106e`), classificando cada um como "compartilhado → vai para `main`" ou "específico de cliente → fica só em `deploy/cory`". Merge não é "tudo ou nada" às cegas.
7. **AC-7 — `deploy/cory` recebe merge de volta de `main` ao final**, para que a branch de produção do cliente não perca nenhuma correção que tenha sido feita em `main` durante o processo (evita a mesma divergência recomeçar no dia seguinte). Executado por `@devops`, nunca por `@dev` (ver Executor Assignment).
8. **AC-8 — Espelho de AC-1: `deploy/cory` mantém a config Argos intacta após o back-merge de AC-7.** O back-merge de `main` → `deploy/cory` pode, por si só, **sobrescrever** `tenant.config.ts` de `deploy/cory` com os defaults neutros de `main` — esse é o risco inverso de AC-1, e não é coberto por ele. Depois do back-merge, `@devops` roda `git show deploy/cory:apps/web/tenant.config.ts` e cola o output na story, confirmando que a configuração do cliente Argos (não os defaults neutros) continua presente. Se o back-merge sobrescrever, resolver o conflito manualmente mantendo o lado `deploy/cory` nesse arquivo especificamente, antes de fechar a story.
9. **AC-9 — Critério de abort/rollback definido e seguido.** Ao encontrar, em qualquer arquivo de autenticação/RLS/LGPD/tenant-config, um conflito que o @dev não saiba resolver com segurança (ambiguidade real sobre qual lado é correto, ou risco de regressão de acesso), o procedimento obrigatório é: `git merge --abort` imediatamente, registrar na story qual arquivo e qual era o conflito, e escalar para `@architect` (quality gate desta story) antes de tentar de novo. **Nunca resolver no chute** nesses arquivos — essa é a saída de emergência que torna a proibição de `-X ours`/`-X theirs` (AC-2, Abordagem) sustentável na prática.

---

## Abordagem recomendada (orientação, não ordem rígida — @dev decide a tática exata)

**Passos 1–6, `@dev`:**

1. Cortar a branch de trabalho `chore/reconcile-main-deploy-cory` a partir de `main`.
2. Rodar `git merge --no-commit --no-ff deploy/cory` (SHA alvo `c65f1da` — ver §Contexto "Alvo fixo") primeiro, **para inspecionar o diff completo antes de commitar qualquer coisa**. Não commitar às cegas.
3. Revisar arquivo por arquivo os que tocam autenticação/autorização/RLS, LGPD (dados pessoais/sensíveis de aluno) e `tenant.config.ts`/configuração por cliente **antes de aceitar qualquer lado automaticamente**, produzindo a tabela de AC-2 conforme se avança.
4. **Não usar `git merge -X ours` / `-X theirs`** como atalho em nenhum arquivo sensível (auth, LGPD, tenant config) — resolução manual, commit por commit se necessário nesses arquivos.
5. **Critério de abort/rollback (AC-9):** se um conflito num arquivo sensível não tiver resolução óbvia e segura, `git merge --abort` na hora, registrar arquivo + natureza do conflito na story, e escalar para `@architect` antes de tentar de novo. Não é permitido "resolver e revisar depois" nesses arquivos — o abort vem antes da tentativa de resolução arriscada, não depois dela.
6. Fora dos arquivos sensíveis, aceitar merge padrão é aceitável quando o diff é claramente aditivo/não conflitante. Depois de tudo resolvido, rodar a bateria de verificação (AC-4, AC-5) localmente, preencher AC-1/AC-2/AC-5/AC-6 na story, e commitar o merge na branch de trabalho.

**Passos 7–9, `@devops` (autoridade exclusiva — `agent-authority.md`):**

7. `@dev` entrega a branch `chore/reconcile-main-deploy-cory` pronta (commitada, verde, ACs 1–6 e 9 documentados). `@devops` abre o PR contra `main` (revisão obrigatória, conforme `README.md` §Contribuindo) — **nunca mergear direto sem review**, mesmo sendo trabalho de reconciliação. `@dev` **não** abre nem mergeia o PR.
8. Após o PR revisado e mergeado em `main` por `@devops`, `@devops` executa o back-merge de `main` de volta em `deploy/cory` (AC-7) para fechar o ciclo.
9. Imediatamente após o back-merge, `@devops` verifica AC-8 (`git show deploy/cory:apps/web/tenant.config.ts` continua com a config Argos) e registra o resultado na story antes de considerar a story concluída.

---

## Fora de escopo (declarado explicitamente)

- **NÃO** promover `deploy/cory` a default branch do GitHub.
- **NÃO** mudar a estratégia de branch por cliente (`deploy/{client}` continua sendo o modelo).
- **NÃO** mexer no conteúdo do PR #2 (`.github/ISSUE_TEMPLATE/`) — é independente; apenas coordenar sequenciamento (revisar/mergear antes ou logo depois, não durante).
- **NÃO** tentar rodar/validar CI em `deploy/cory` — já existe lá; o objetivo é fazer existir em `main`.
- **NÃO** reconciliar `deploy/vertice` nesta story. `deploy/vertice` está 45 commits atrás de `deploy/cory` (118 arquivos de diff), divergência que só cresce a cada avanço de `deploy/cory` sem reconciliação. Reconhecido como dívida futura, fora do escopo desta story — que resolve especificamente `main` × `deploy/cory`.

---

## Definição de Pronto (Definition of Done)

- [ ] Todos os AC-1 a AC-9 verificados e documentados na story (com evidência: diffs citados, comandos rodados e output, tabela de AC-2 preenchida).
- [ ] `@po` validou a story via checklist de 10 pontos (revalidação pós B1–B7).
- [ ] `@architect` (quality gate) revisou a estratégia de reconciliação e qualquer escalação de AC-9, se houver.
- [ ] PR aberto por `@devops` contra `main`, revisado (não auto-mergeado), e mergeado por `@devops`.
- [ ] `deploy/cory` recebeu o back-merge de `main`, executado por `@devops`, com AC-8 confirmado.
- [ ] Nenhuma regressão nova introduzida além do baseline de falhas pré-existentes já conhecido no repo.
- [ ] Dev Agent Record preenchido (File List, comandos de verificação, resultado).

---

## Comandos de Verificação (para o @dev/@devops usarem como critério objetivo)

```bash
# diff completo antes de qualquer commit (SHA alvo: c65f1da)
git merge --no-commit --no-ff c65f1da

# arquivos sensíveis a revisar manualmente (ponto de partida, não lista fechada) — base da tabela de AC-2
git diff --name-only main c65f1da -- '*tenant.config*' '**/auth*' '**/rls*' '**/*guard*' 'supabase/migrations/*'

# AC-5 — varredura de vazamento (usar -P; com -E o \b falha silencioso e retorna 0)
# Rodar na branch de TRABALHO (HEAD), não em main. Comparar contra o baseline
# de main declarado em AC-5: 64 linhas / 6 arquivos.
git grep -inP '\b(cory|argos)\b' HEAD -- apps/web packages/ supabase/

# baseline de main, para a comparação de AC-5
git grep -inP '\b(cory|argos)\b' main -- apps/web packages/ supabase/ | wc -l   # esperado: 64

# pós-merge, na branch de trabalho (@dev); @devops repete em main após o merge do PR
pnpm --filter @eximia/web typecheck
npx vitest run
pnpm --filter @eximia/web build
git status --short   # deve estar limpo

# AC-8 — pós back-merge, em deploy/cory (rodar por @devops)
git show deploy/cory:apps/web/tenant.config.ts
```

---

## Tasks / Subtasks

- [x] Task 1 — Preparação (AC: 6)
  - [x] Confirmar SHA alvo de `deploy/cory` (`c65f1da`) — confirmado, não avançou (449 commits)
  - [x] Cortar `chore/reconcile-main-deploy-cory` a partir de `main`
  - [x] Rodar `git merge --no-commit --no-ff c65f1da` e produzir o inventário de commits — **zero conflitos** (`main` é ancestral estrito); inventário: 7 de 449 commits tocam artefato de cliente
- [x] Task 2 — Resolução de conflitos (AC: 1, 2, 5, 9)
  - [x] Tabela de AC-2 preenchida (51 arquivos sensíveis: 41 A, 10 M, 0 D; os 10 `M` revisados linha a linha)
  - [x] AC-9 **não acionado** — não houve conflito algum, logo nada de "resolver no chute"; zero uso de `-X ours`/`-X theirs`
  - [x] `tenant.config.ts` neutro na branch de trabalho (AC-1) — **+ achado novo:** logotipos de marca também trocavam e o grep de AC-5 não os enxerga
  - [x] Varredura AC-5 rodada contra o baseline (64 linhas/6 arquivos, confirmado); 2 vazamentos reais corrigidos, 1 falso-positivo preservado por ser trava de segurança
- [x] Task 3 — CI em `main` (AC: 3)
  - [x] `ci.yml` portado, referência a `develop` removida
  - [x] Decisão registrada: **sim**, `push` em `deploy/**` dispara CI (são as branches que chegam a produção)
- [~] Task 4 — Verificação e commit local (AC: 4)
  - [x] `typecheck` exit 0; `vitest` idêntico ao baseline medido no `c65f1da` pristino (19 falhas pré-existentes, zero regressão)
  - [ ] **`build` NÃO verificado** — `ENOSPC`, disco da máquina em 100%. Precisa ser rodado com disco livre antes do merge do PR
  - [x] `git status` limpo, merge commitado (`c0550a5`)
- [ ] Task 5 — Publicação, exclusiva `@devops` (AC: 7, 8)
  - [ ] Abrir PR contra `main`, aguardar review, mergear
  - [ ] Back-merge de `main` em `deploy/cory`
  - [ ] Confirmar AC-8 (`git show deploy/cory:apps/web/tenant.config.ts` com config Argos intacta) e registrar na story

---

## Notes

- Esta story é de **reconciliação de histórico**, não de feature. O valor é estrutural: sem ela, cada `deploy/{client}` novo nasce mais distante de `main`, e o custo de reconciliar cresce a cada branch.
- O precedente de `engagement-center-v2` → `main` (3 conflitos, um em rota de autorização/LGPD) é o motivo pelo qual AC-2 e a abordagem recomendada proíbem `-X ours`/`-X theirs` em arquivos sensíveis — o risco não é hipotético, já aconteceu uma vez neste mesmo repo.
- Sequenciamento com PR #2: recomendado revisar/mergear o PR #2 (`.github/ISSUE_TEMPLATE/`) antes de abrir o PR desta story, para reduzir a chance de conflito trivial de última hora — mas isso é coordenação de sequência, não uma dependência bloqueante.

---

## Dev Agent Record

**Agent:** @dev (Dex)
**Date:** 2026-08-09
**Branch:** `chore/reconcile-main-deploy-cory`
**Merge commit:** `c0550a5db2a4d38893017c18bb26de908fc31e25` (pais: `2bc746e` + `c65f1da`)
**Escopo executado:** passos 1–6 (`@dev`). Passos 7–9 permanecem com `@devops`.

### ACHADO ESTRUTURAL — `main` é ancestral ESTRITO de `c65f1da`

O fato que redefine a story, verificado antes de qualquer resolução:

```
$ git rev-list --count main..c65f1da     # 449
$ git rev-list --count c65f1da..main     # 0
$ git merge-base --is-ancestor main c65f1da  # verdadeiro
$ git merge-base main c65f1da            # 2bc746e (= o próprio tip de main)
```

Consequências, todas verificadas:

1. **O merge não teve conflito algum** (`git merge --no-commit --no-ff c65f1da` →
   *"Automatic merge went well"*, `git diff --diff-filter=U` vazio). Não existem "dois
   lados": `main` não tem uma única linha que `deploy/cory` já não tenha.
2. **A árvore do merge seria byte-a-byte idêntica à de `deploy/cory`** (ambas
   `ea8cce622bd39c9ae4e4a5bc3b37b9958383631d`). Ou seja, um merge ingênuo **traz a
   configuração do cliente Argos inteira para `main`** — exatamente o que o Objetivo
   proíbe. AC-1 não é uma formalidade aqui: sem intervenção deliberada, ele **falha**.
3. AC-9 (abort/rollback) **não foi acionado**: seu gatilho é "conflito em arquivo
   sensível sem resolução óbvia", e não houve conflito nenhum. Nenhum `-X ours`/`-X theirs`
   foi usado em lugar algum (não havia o que resolver).

### AC-1 — `tenant.config.ts` neutro (+ extensão para assets de marca)

Antes da intervenção, o merge trazia a config do cliente:

```
name: "Argos Consultoria"   slug: "cory-alimentos"
footerText: "© 2026 Argos Consultoria · Powered by exímIA Academy"
supportEmail: "suporte@eximiaventures.com.br"   partnerName/partnerLogo
```

Depois de restaurar a versão de `main` (`git checkout main -- apps/web/tenant.config.ts`):

```
$ grep -nE 'name:|slug:' apps/web/tenant.config.ts
14:    name: "eximIA Academy",
15:    slug: "demo",
$ git grep -inP '\b(cory|argos)\b' HEAD -- apps/web/tenant.config.ts
(zero matches)
```

**Extensão necessária de AC-1 (achado novo).** AC-1 fala em "qualquer arquivo de config
equivalente por tenant". O merge também trocava os **logotipos**, que são assets por
tenant e que **o `git grep` de AC-5 é estruturalmente incapaz de enxergar** (marca assada
em pixel, não em texto):

| Asset | `main` | `deploy/cory` | Ação |
|:---|:---|:---|:---|
| `apps/web/public/brand/logo.png` | eximIA (2632×567, 36379 B) | **ARGOS Consultoria** (1194×294, 29959 B) | restaurado de `main` |
| `apps/web/public/brand/logo-color.png` | eximIA (36379 B) | **ARGOS Consultoria** (29959 B) | restaurado de `main` |
| `apps/web/public/brand/favicon.ico` | não existia | símbolo eximIA laranja (verificado visualmente) | **mantido** — é marca eximIA, não do cliente, e preenche um vazio (o config neutro já referencia `/brand/favicon.ico`) |

Os três foram inspecionados como imagem, não por nome de arquivo. O favicon **parecia**
candidato a remoção pelo nome/origem e não era.

### AC-2 — Tabela de revisão dos arquivos sensíveis

`git diff --name-only main c65f1da -- '*tenant.config*' '**/auth*' '**/rls*' '**/*guard*' 'supabase/migrations/*'`
→ **51 arquivos: 41 adicionados (A), 10 modificados (M), 0 removidos.**

Os 41 `A` são arquivos novos vindos do trabalho compartilhado (sobretudo migrations de
`engagement`, `jornada`, `epic30`), sem contraparte em `main` e portanto sem escolha de
lado a fazer. Os 10 `M` foram lidos linha a linha:

| Arquivo | Resolução | Justificativa |
|:---|:---|:---|
| `apps/web/tenant.config.ts` | **manual — lado `main`** | Único arquivo em que o lado de `deploy/cory` foi **recusado**. AC-1 exige `main` neutro; o lado do cliente traz `slug: cory-alimentos`, marca Argos, `footerText` e `supportEmail` do cliente. |
| `apps/web/src/lib/auth.ts` | fast-forward (linhagem única) | +81/−4. Acrescenta `roles[]` (chapéus reais via `user_roles`), `hasSubordinates`, `hasEnrollment`. **Amplia** o objeto de sessão sem afrouxar regra de acesso: os dois `count` novos rodam **sob RLS** e o próprio código documenta que negação de RLS degrada para `false` (esconde o contexto de gestor). Fallback para `[profile.role]` só quando `user_roles` está vazio. Nada específico de cliente. |
| `apps/web/src/app/api/auth/callback/route.ts` | fast-forward (linhagem única) | +32/−12. Corrige erro **engolido**: `select` pedia `avatar_url`, coluna inexistente → `42703` devolvia `data: null`, lido como "pessoa não existe", caindo no ramo de **criação para quem já existe** e terminando em `/login?error=no_tenant`. Passa a distinguir `PGRST116` (linha ausente, legítimo) de erro real. **Endurece** o login, não relaxa. |
| `apps/web/src/lib/auth-actions.ts` | fast-forward (linhagem única) | +4. Apaga o cookie `x-user-role` no logout, para papel obsoleto não sobreviver à sessão. Estritamente a favor da segurança. |
| `apps/web/src/components/auth/login-form.tsx` | fast-forward (linhagem única) | +16/−15. Destino pós-login passa de `/dashboard` para `/workspace` e **remove o atalho do `super_admin`** que pulava o seletor. Roteamento, não autorização: quem pode o quê continua decidido no servidor. |
| `apps/web/src/app/(platform)/admin/users/__tests__/auth-accounts.test.ts`, `api/auth/callback/__tests__/route.test.ts`, `__tests__/saml-provisioning.test.ts` | fast-forward (linhagem única) | Testes acompanhando as mudanças acima. Sem regra de negócio. |
| `supabase/migrations/20260311100000_user_tenant_memberships.sql` | fast-forward (linhagem única) | Idempotência: `VALUES` com subquery escalar → `SELECT ... WHERE email IN (...)`, para pular usuário ausente em vez de inserir `NULL` em banco novo. **As políticas RLS são textualmente idênticas** (o resto do diff é normalização de fim de linha). |
| `supabase/migrations/20260315100001_seed_verso_regra_de_3.sql` | fast-forward (linhagem única) | Seed ganha `WHERE EXISTS (SELECT 1 FROM tenants ...)`. Sem efeito em autorização. |
| `supabase/migrations/20260421000000_jwt_tenant_claim_hook.sql` | fast-forward (linhagem única) | **Único `M` que mexe em permissão de banco:** adiciona `GRANT USAGE ON SCHEMA public TO supabase_auth_admin`. Concede a um papel **interno privilegiado do Supabase**, não a usuário final; sem ele o GoTrue não enxerga o hook após reset de schema ("Database error querying schema" no login). O `REVOKE ... FROM authenticated, anon, public` permanece intacto logo abaixo. Aditivo e necessário. |

> Nenhuma linha desta tabela usa `ours`/`theirs`: como `main` é ancestral, não houve
> conflito a resolver. A única **decisão de lado** real foi `tenant.config.ts`.

### AC-3 — CI em `main`

`ci.yml` passa a existir em `main` (vinha só de `deploy/cory`). Duas mudanças:

- **`develop` removido** — a branch não existe no repositório.
- **`deploy/**` adicionado ao `push`** (decisão registrada, conforme o AC pede: **sim**).
  Razão factual, não preferência: são as branches `deploy/{client}` que chegam a
  produção (`main` não é implantada), então rodar CI só em `main` deixaria justamente o
  artefato implantado sem gate. O próprio repositório já documenta essa lacuna em
  `apps/web/src/lib/tenant-features.ts:13` — *"disponível (branch `deploy/cory`, sem CI
  em push) — não é mitigação"*.

```yaml
on:
  push:
    branches: [main, "deploy/**"]
  pull_request:
    branches: [main]
```

### AC-5 — Varredura de vazamento contra o baseline

```
$ git grep -inP '\b(cory|argos)\b' main -- apps/web packages/ supabase/ | wc -l
64                                    # baseline confirmado (6 arquivos), bate com o AC
$ git grep -inP '\b(cory|argos)\b' HEAD -- apps/web packages/ supabase/ | wc -l
184                                   # branch de trabalho, 55 arquivos
```

**49 arquivos novos** em relação aos 6 do baseline. Classificação (nada do baseline foi
removido, conforme o AC exige):

| Categoria | Qtd | Veredito |
|:---|---:|:---|
| Migrations | 12 | **Allowlist (b)** — histórico aplicado, nunca deletar |
| Testes/fixtures multi-tenant | 22 | **Allowlist (c)** — dado de exemplo em lógica compartilhada |
| Comentários citando Cory/Argos como caso empírico ou nome de cor | 13 | **Allowlist** — não é config, segredo nem regra de negócio; documentam *por que* o código é como é |
| Páginas `/dev/preview-*` | 2 | **Sinalizado, não removido** (ver abaixo) |
| **`apps/web/tenant.config.ts`** | 1 | **VAZAMENTO → corrigido** (AC-1) |
| **`api/notifications/nudge/route.ts`** | 1 | **VAZAMENTO → corrigido** (abaixo) |

**Vazamento real corrigido — URL de produção do cliente em caminho compartilhado:**

```
- <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://cory.eximia.academy"}/dashboard"
+ <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard"
```

Era o **único** ponto do repositório com domínio de produção de cliente embutido: todos os
outros usos ou não têm fallback (`resend-invite/route.ts:44`, `invite-user.ts:52`) ou caem
em `http://localhost:3000` (`get-base-url.ts:18`, `openapi/generator.ts:22`, e o próprio
`ci.yml`). Em `main`, um env não definido faria o e-mail de nudge apontar para o domínio do
cliente. **Por que a troca é segura para o cliente:** `resend-invite` usa a mesma variável
*sem fallback nenhum*, então se ela não estivesse definida na produção do cliente os
e-mails de convite já estariam quebrados (`undefined/auth/accept-invite`). Logo o fallback
é código morto lá, e alterá-lo não muda comportamento em produção.

**Vazamento real corrigido — marca do cliente fixa em UI compartilhada:**

`workspace/_components/workspace-picker.tsx` trazia `alt="ARGOS Academy"` **duas vezes**,
string fixa (não comentário). Com os logotipos eximIA restaurados, o texto alternativo
passaria a **contradizer a imagem** em `main` — vazamento de marca *e* defeito de
acessibilidade. Corrigido para o padrão que o próprio repositório já usa em
`studio-sidebar.tsx` (`alt={brand.name}`), via `getTenantConfig()` — import estático, que
funciona antes do `BrandProvider` (a restrição que o comentário do arquivo justificava).

**Não removido de propósito (seria um erro):** `supabase/seed-student-home-demo.ts:62`
casa com `argos.eximiaacademy.com.br`, mas dentro de `PROD_HOST_DENYLIST` — é a **trava de
segurança** que impede o seed de demo tocar a produção do cliente. Removê-lo por "limpeza"
desarmaria a proteção. Registrado como allowlist com justificativa.

**Sinalizado para follow-up (fora do escopo, não bloqueante):** `app/dev/preview-vocabulario/page.tsx`
(e-mails `artur@cory.com`, `caio@cory.com`, `cintia@cory.com`, `neusa@cory.com`,
`venilton@cory.com`) e `app/dev/preview-feature-review/page.tsx` (rótulo "Cory Alimentos").
Domínio fabricado (`cory.com`, não `cory.com.br`) e rota `/dev/`, mas os prenomes coincidem
com pessoas reais do cliente (`caio.pinheiro@cory.com.br` aparece no baseline). Não removi
unilateralmente porque a remoção **propaga para a branch de produção do cliente** pelo
back-merge (ver alerta abaixo) — decisão para `@architect`.

**Confirmado sem segredo:** `supabase/seed-cory-users.py` lê `SUPABASE_SERVICE_ROLE_KEY` do
ambiente; nenhuma credencial literal na árvore.

### AC-6 — Inventário: compartilhado vs. específico de cliente

Dos **449** commits, apenas **7** tocam artefatos específicos do cliente:

| Commit | Classificação |
|:---|:---|
| `6a15f83` deploy: Cory Alimentos — branding + modules | **cliente** |
| `fffd304` merge: visual migration from main + Argos branding for Cory | **cliente** |
| `77096d5` fix: sidebar logo color variant + h-7 sizing for Argos | **cliente** |
| `97d0072` feat(cory): enforce module separation — only biblioteca + units | **cliente** |
| `327963c` feat(academy): analytics avançado + engagement engine + hardening multi-tenant | compartilhado (toca asset de marca de passagem) |
| `13136ca` chore(security): `seed-cory-users.py` lê service_role key do ambiente | **compartilhado** — remove segredo do código-fonte |
| `0f52018` feat(brand): favicon — símbolo eximIA laranja | **compartilhado** — marca eximIA |

**Conclusão verificável:** o efeito específico de cliente dos 449 commits está **inteiramente
contido em 3 arquivos** (`tenant.config.ts`, `logo.png`, `logo-color.png`), todos
neutralizados. Os outros 442 commits são trabalho compartilhado. Prova objetiva — a árvore
desta branch difere da de `deploy/cory` **exatamente** nos 6 arquivos deliberados:

```
$ git diff c0550a5 c65f1da --stat
 .github/workflows/ci.yml                           |   4 +-
 apps/web/public/brand/logo-color.png               | Bin
 apps/web/public/brand/logo.png                     | Bin
 apps/web/src/app/api/notifications/nudge/route.ts  |   2 +-
 .../app/workspace/_components/workspace-picker.tsx |   9 +-
 apps/web/tenant.config.ts                          |  23 +-
 6 files changed
```

### AC-4 — Verificação

Rodado em worktree isolada (`/Users/hugocapitelli/Dev/eximia/wt-reconcile`), **sem tocar a
árvore compartilhada**, que estava com trabalho não commitado de outros agentes.

| Gate | Resultado |
|:---|:---|
| `pnpm --filter @eximia/web typecheck` | **exit 0** — `tsc --noEmit` sem erro |
| `pnpm --filter @eximia/web test` | **19 falhas / 2206 passes / 2 skipped (177 arquivos)** — **idêntico ao baseline** |
| `pnpm --filter @eximia/web build` | **NÃO CONCLUÍDO — ENOSPC** (ver abaixo) |
| `git status --short` | limpo (só os symlinks locais de `node_modules`, não commitados) |

**As 19 falhas são pré-existentes, provado por execução, não por argumento.** Criei uma
worktree destacada no `c65f1da` pristino e rodei a mesma suíte:

```
baseline c65f1da :  Test Files 5 failed | 172 passed (177) · Tests 19 failed | 2206 passed | 2 skipped
esta branch      :  Test Files 5 failed | 172 passed (177) · Tests 19 failed | 2206 passed | 2 skipped
diff das listas de arquivos que falham: IDÊNTICO
```

Os 5 arquivos que falham (`sessions/messages/route.test.ts`, `login-form-google-oauth`,
`manager-course-dashboard`, `manager-dashboard`, `rate-limit`) correspondem, 4 de 5, a
arquivos que **outros agentes estão editando neste momento** na árvore compartilhada
(POP-FIX-001). **Zero regressão introduzida por esta reconciliação.** Como contraprova
positiva, `workspace-picker.test.tsx` — o teste do arquivo que editei — **passou (6 testes)**.

**`build` — por que está vermelho e por que não é código.** O disco da máquina está em
100% (228Gi, restavam ~1,5Gi ao iniciar). O `next build` encheu o volume e falhou com
`ENOSPC: no space left on device` — o erro chegou a impedir até a escrita do arquivo de log.
Não é falha de compilação. O que se pode afirmar com base objetiva: `tsc --noEmit` passa
(exit 0), e o único risco de build introduzido por mim seria o import novo de `@/lib/tenant`
num componente `"use client"` — verificado manualmente: a cadeia é
`lib/tenant.ts` → `tenant.config.ts` → **apenas um `import type`** (apagado na compilação),
sem `server-only` em lugar nenhum, portanto seguro no bundle de cliente; e o teste do
componente passa. **Ainda assim, `build` permanece formalmente NÃO VERIFICADO** e precisa
ser rodado com disco livre antes do merge do PR. A CI que AC-3 acabou de criar cobre isso.

### ⚠️ ALERTA PARA `@devops` — AC-7/AC-8 têm uma armadilha que a story não previu

AC-8 instrui: *"se o back-merge sobrescrever, resolver o conflito manualmente"*. **Não
haverá conflito.** Verificado:

```
$ git merge-base --is-ancestor c65f1da c0550a5   # verdadeiro
$ git merge-base deploy/cory c0550a5             # c65f1da (o próprio tip de deploy/cory)
```

Como `c65f1da` é **pai** do commit de merge, `deploy/cory` é ancestral dele: o back-merge
`main` → `deploy/cory` será um **fast-forward limpo, sem conflito e sem aviso**, e
`deploy/cory` receberia silenciosamente `tenant.config.ts` neutro (`slug: "demo"`) e os
logotipos eximIA — **a produção do cliente perderia a própria marca**, sem nada pedir
resolução. É o risco inverso de AC-1, e é *pior* que o previsto, porque não dispara conflito.

Procedimento seguro sugerido para o passo 8 (a restauração explícita **não é opcional**):

```bash
git checkout deploy/cory
git merge --no-ff main
git checkout c65f1da -- apps/web/tenant.config.ts \
                        apps/web/public/brand/logo.png \
                        apps/web/public/brand/logo-color.png
git commit
git show deploy/cory:apps/web/tenant.config.ts   # AC-8: deve mostrar Argos, não "demo"
```

Confirmado que **esta branch não alterou `deploy/cory`**: continua em
`c65f1da880e523623762479cb682a057ec75d951`.

### Nota de ambiente

A árvore compartilhada `eximia-academy-v2` estava em `deploy/cory` com 6 arquivos
modificados e 25 não rastreados, de outros agentes ativos. Por isso **nenhum comando git
mutante** foi executado nela: usei `git branch` (só move ponteiro) + `git worktree add`.
HEAD, branch e `git status` da árvore compartilhada conferidos idênticos antes e depois.
`node_modules` foi reaproveitado por symlink (o lockfile desta branch é idêntico ao de
`c65f1da`), evitando um `pnpm install` que o disco não comportaria.

**Pendências minhas (limpeza):** `apps/web/.next` (992M) na worktree de trabalho e a
worktree `wt-baseline` (28M) — ambos artefatos meus desta sessão. A remoção foi negada pelo
sistema de permissões; deixo registrado para quem for limpar. Enquanto existirem, o disco
segue em ~500Mi livres.

### File List

**Modificados nesta branch (6, todos deliberados vs. `deploy/cory`):**
- `apps/web/tenant.config.ts` — restaurado neutro (AC-1)
- `apps/web/public/brand/logo.png` — restaurado eximIA (AC-1 estendido)
- `apps/web/public/brand/logo-color.png` — restaurado eximIA (AC-1 estendido)
- `.github/workflows/ci.yml` — portado, `develop` removido, `deploy/**` adicionado (AC-3)
- `apps/web/src/app/api/notifications/nudge/route.ts` — fallback de URL do cliente removido (AC-5)
- `apps/web/src/app/workspace/_components/workspace-picker.tsx` — `alt` fixo "ARGOS Academy" → `brandName` (AC-5)

**Absorvidos do merge sem alteração:** 850 arquivos dos 449 commits compartilhados,
incluindo 41 migrations novas e os 10 arquivos sensíveis da tabela de AC-2.

**Documentação:** este arquivo (`docs/stories/chore-reconcile-main-com-deploy-cory.md`).

---

## QA Results

(preencher no QA gate)

---

## Change Log

| Data | Versão | Mudança | Autor |
|:---|:---|:---|:---|
| 2026-08-09 | 1.0.0 | Story criada (Draft) | @sm |
| 2026-08-09 | 1.0.1 | Validação **NO-GO (6.0/10)** — Status permanece Draft. Bloqueadores: (B1) fato invertido no Contexto, `2bc746e` é o tip de **`main`**, não de `deploy/cory` (tip real hoje `c65f1da`, 2026-08-09); (B2) alvo móvel, `deploy/cory` recebeu commits hoje e não há pin de SHA nem janela de congelamento; (B3) sem critério de abort/rollback apesar do precedente de conflito em rota LGPD; (B4) AC-7 (back-merge) sem AC-espelho garantindo que `tenant.config.ts` de `deploy/cory` mantenha a config Argos; (B5) AC-2 e AC-5 não verificáveis objetivamente; (B6) passo "abrir PR" atribuído ao @dev viola autoridade exclusiva do @devops; (B7) faltam campos `executor`/`quality_gate`/`quality_gate_tools` e seção Tasks/Subtasks com mapeamento AC↔task. Correções detalhadas no relatório de validação. | @po |
| 2026-08-09 | 1.1 | Correções B1–B7 aplicadas: (B1) Contexto reescrito com fatos verificados via `git rev-parse`/`git rev-list` — `main@2bc746e` é quem está parada, `deploy/cory@c65f1da` é a ponta ativa; (B2) alvo fixado no SHA `c65f1da`, com instrução de re-checagem se a branch avançar antes da execução; (B3) AC-9 novo (critério de abort/rollback obrigatório em conflito sensível não-óbvio, com escalação a `@architect`) e passo 5 da Abordagem; (B4) AC-8 novo, espelho de AC-7, exige `git show deploy/cory:apps/web/tenant.config.ts` pós back-merge; (B5) AC-2 reescrito exigindo tabela arquivo/resolução/justificativa, AC-5 reescrito com comando `git grep` + allowlist declarada; (B6) Abordagem dividida em passos 1–6 (`@dev`, local) e 7–9 (`@devops`, exclusivo — PR, merge, back-merge); (B7) adicionados bloco Executor Assignment (`executor: @dev`, `quality_gate: @architect`) e seção Tasks/Subtasks com mapeamento AC↔task. Menor: `deploy/vertice` declarado fora de escopo explicitamente, com números atualizados (45 commits / 118 arquivos de diff, verificados via `git rev-list`/`git diff --stat`, não mais "6 linhas"). Status muda para "aguardando revalidação de @po". | @sm |
| 2026-08-09 | 1.2 | **Passos 1–6 implementados** por `@dev` na branch `chore/reconcile-main-deploy-cory`, merge commit `c0550a5`. Achado que redefine a story: **`main` é ancestral ESTRITO de `c65f1da`** (0 commits exclusivos de `main`), então o merge teve **zero conflitos** e a árvore resultante seria idêntica à de `deploy/cory` — um merge ingênuo levaria a config Argos inteira para `main` e **reprovaria AC-1**. AC-9 não foi acionado (não havia conflito a resolver); zero uso de `-X ours`/`-X theirs`. Três achados novos: (i) **AC-1 precisa se estender aos assets de marca** — `logo.png`/`logo-color.png` trocavam para o logotipo ARGOS e o `git grep` de AC-5 é cego a pixel (verificado visualmente; o `favicon.ico` novo, ao contrário, é símbolo eximIA e foi mantido); (ii) dois vazamentos reais além do `tenant.config.ts` — domínio de produção do cliente como fallback em `nudge/route.ts` e `alt="ARGOS Academy"` fixo em UI compartilhada — corrigidos, enquanto `seed-student-home-demo.ts` foi **preservado** porque seu match está numa `PROD_HOST_DENYLIST` (trava de segurança, removê-la desarmaria a proteção); (iii) **AC-8 tem armadilha:** o back-merge será **fast-forward sem conflito**, então a instrução "resolver o conflito" nunca dispara e `deploy/cory` perderia a marca do cliente em silêncio — procedimento seguro registrado para `@devops`. Verificação: `typecheck` exit 0; suíte **idêntica ao baseline** medido em worktree pristina no `c65f1da` (19 falhas pré-existentes / 2206 passes, zero regressão); **`build` NÃO verificado por `ENOSPC`** (disco em 100%), pendência explícita antes do merge do PR. | @dev |
| 2026-08-09 | 1.1.1 | Revalidação **GO (8.5/10)** — Status: Draft → **Ready**. B1–B7 conferidos um a um contra o repo real e todos corretos (`main@2bc746e` parada desde 2026-07-16; `deploy/cory@c65f1da` ainda é o tip e não moveu; 449 via `origin/main..origin/deploy/cory`; `19c2824` de 2026-07-29 é de fato o merge-base de `deploy/vertice`; 45 commits / 118 arquivos). **Correção B8 aplicada pelo @po** (AC é seção de autoridade do @po, `story-lifecycle.md`), em vez de devolver ao @sm por um único AC: (i) AC-5 da v1.1 não era operável — `git grep -iE 'cory\|argos'` retorna 74 matches em `main` e 276 em `deploy/cory`, inflados pela palavra portuguesa "**cargos**", que contém "argos"; (ii) `main` **já contém** 6 arquivos com o nome do cliente hoje (incl. `seed-cory-users.py` e migrations aplicadas), então o critério binário "qualquer match é vazamento, remover" mandaria o @dev deletar migration histórica — AC-5 agora é diferença contra baseline medido (64 linhas / 6 arquivos), com allowlist reescrita a partir do output real; (iii) o `\b` **não funciona com `-E`** no git grep (retorna 0, falso-limpo silencioso), comando trocado para `-P`; (iv) AC-1/AC-4/AC-5 e o bloco de Comandos apontavam para `main`, mas após a divisão de autoridade do B6 o `@dev` trabalha na branch `chore/reconcile-main-deploy-cory` e nunca toca `main` — verificar contra `main` na Task 2 leria a árvore pré-merge e daria falso-limpo justamente no detector de vazamento. Refs corrigidos para `HEAD`/branch de trabalho, com re-confirmação do `@devops` em `main` pós-PR. | @po |
