# LOOP-0 — Delta `origin/main` × HEAD (`d2b8083`, branch `integra/main-cory`)

> Medido em 2026-08-28. `origin/main` = `4af618d` (Merge PR #83, feat/analytics-visao-geral).
> HEAD = `d2b8083`, 40 commits à frente de `origin/main`, 263 arquivos, +39k linhas.

## Caminho de medição

`origin/main` foi medido no worktree **`/Users/hugocapitelli/Dev/eximia/wt-baseline`**
(detached, antes em `c65f1da`, 58 commits atrás de `origin/main`). Não foi criado worktree
novo — disco a 98% cheio (6,1 GiB livres de 228 GiB) tornava isso arriscado.

`git checkout origin/main` foi feito dentro desse worktree (não no repositório principal).
O único conteúdo "sujo" ali eram os próprios `node_modules` (untracked, sem trabalho real
perdido) — confirmado por `git status --porcelain` antes do checkout.

**Achado que reduziu o custo a quase zero:** `pnpm-lock.yaml` é **byte-idêntico** entre
`c65f1da`, `d2b8083` (HEAD) e `origin/main` (mesmo MD5). Os 40 commits não tocam dependências.
`pnpm install --frozen-lockfile` rodou em 1s, sem baixar nada.

**Achado colateral a registrar:** `node_modules` do worktree `wt-baseline` é **symlink** para
`node_modules` do repositório principal (`eximia-academy-v2/node_modules`), não uma cópia
isolada. O `pnpm install` portanto tocou o `node_modules` compartilhado. Isso só foi seguro
porque o lockfile é idêntico nos três pontos — não houve divergência de dependências instaladas
em nenhum momento. Se o lockfile divergisse, este caminho teria contaminado o ambiente do
repositório principal, e não deveria ter sido usado sem antes copiar/isolar `node_modules`.

**Disco:** antes `6,1 GiB` livres (98%), depois `6,4 GiB` livres (97%) — nunca caiu, na
verdade subiu levemente (limpeza incidental durante o install). Acima do piso de 3 GiB.

**Repositório principal:** permaneceu em `d2b8083` o tempo todo, nenhum `checkout`/`stash`
foi feito nele. `git status --porcelain` media **33** no início da tarefa e **34** ao final.
Investiguei a diferença: todas as 34 entradas têm `mtime` **anterior ou igual a 18:40** de
hoje — o instante em que `docs/auditoria/` foi criado (pela própria medição de HEAD que
antecede este LOOP-0). Nenhum arquivo tem mtime posterior ao início desta tarefa (~18:43).
Ou seja: nenhuma escrita minha alterou o repositório principal; a diferença 33→34 é um
artefato de timing entre a contagem original do time-lead e a criação de `docs/auditoria/`,
não uma consequência deste trabalho. Reportado por transparência, não escondido.

## Tabela delta

| Verificador | Workspace | `origin/main` | HEAD (`d2b8083`) | Delta | Classificação |
|:---|:---|---:|---:|---:|:---|
| typecheck | `@eximia/ui` | 36 erros (11 arquivos, todos `src/stories/*`) | 36 erros (idêntico) | 0 | **HERDADO** |
| typecheck | demais 6 workspaces c/ script (`shared`,`database`,`course-designer`,`central`,`agents`,`web`) | 0 erros | 0 erros | 0 | **HERDADO** (verde nos dois) |
| test | `@eximia/ui` | 20 falhas / 11 arquivos | 20 falhas / 11 arquivos (idêntico) | 0 | **HERDADO** |
| test | `@eximia/agents` | 8 falhas / 1 arquivo (`tests/model-router.test.ts`) | 8 falhas / 1 arquivo (mesmas asserções, byte a byte) | 0 | **HERDADO** |
| test | `@eximia/web` — `login-form-google-oauth.test.tsx` | falha | falha (idêntica) | 0 | **HERDADO** |
| test | `@eximia/web` — `manager-dashboard.test.tsx` | falha | falha (idêntica) | 0 | **HERDADO** |
| test | `@eximia/web` — `rate-limit.test.ts` | 2/3 falham | 1/3 falha (conteúdo mudou) | -1, mas com falha residual **diferente** | **MISTO** (ver nota 1) |
| test | `@eximia/web` — `messages/route.test.ts` (sessions) | 19 falhas | 0 (arquivo passa) | -19 | **HERDADO E CORRIGIDO** (ver nota 2) |
| test | `@eximia/web` — `manager-course-dashboard.test.tsx` | falha | 0 (arquivo passa) | corrigido | **HERDADO E CORRIGIDO** (ver nota 2) |
| test | `@eximia/web` — `tests/epic-23-docs-vs-code.test.ts` | arquivo **não existe** | 16/25 falham | +16 | **INTRODUZIDO** (nota 3) |
| test | `@eximia/web` — `tests/epic-6-security-posture-doc.test.ts` | arquivo **não existe** | falhas (não quantificadas linha a linha) | novo | **INTRODUZIDO** (nota 3) |
| test | `@eximia/web` — `tests/epic9-docs-vs-realidade.test.ts` | arquivo **não existe** (e é UNTRACKED até em HEAD) | 8/18 falham | novo | **INTRODUZIDO, não commitado** (nota 4) |
| test | `@eximia/web` total | **19 falhas / 5 arquivos** | 41 falhas / 6 arquivos | **+22 falhas / +1 arquivo** | ver composição acima |
| test | `@eximia/shared` | 80 passed | 81 passed | +1 (sem falha) | **INTRODUZIDO** (teste novo, verde) |
| test | `@eximia/course-designer` | 112 passed | 112 passed | 0 | **HERDADO** (idêntico) |
| lint | `@eximia/central` | 3 erros | 3 erros | 0 | **HERDADO** |
| lint | `@eximia/course-designer` | 41 erros | 41 erros | 0 | **HERDADO** |
| lint | `@eximia/agents` | 43 erros | 43 erros | 0 | **HERDADO** |
| lint | `@eximia/web` | **580 erros** / 221 warnings | 589 erros / 224 warnings | **+9 erros / +3 warnings** | **INTRODUZIDO** (nota 5) |
| lint | `@eximia/ui` (warnings only) | 20 warnings, 0 erros | 20 warnings (idêntico) | 0 | **HERDADO** |

## Notas

**Nota 1 — `rate-limit.test.ts` (MISTO).** Em `origin/main` falham 2 de 3 testes:
`exports null limiters when env vars are missing` (esperava `null`, harness testava contrato
que o código não cumpria) e `exports exactly 15 named limiters` (esperava 15, tinha 16). O
commit `fb12ad2` ("corrige 4 suites que acusavam o produto por defeito do proprio harness")
**renomeou e corrigiu** o primeiro teste para `falls back to in-memory limiters...`, que agora
passa (HERDADO, corrigido). Mas o segundo teste sobrevive com um número **diferente**: em HEAD
o teste já foi atualizado para esperar 16 (não mais 15), e mesmo assim falha porque o código
real agora expõe **18** limiters — ou seja, os 40 commits **adicionaram limiters reais** sem
atualizar a contagem esperada no teste. A falha remanescente é, portanto, **INTRODUZIDA**,
mesmo estando no mesmo arquivo/mesma categoria de asserção que a falha herdada original.

**Nota 2 — `messages/route.test.ts` e `manager-course-dashboard.test.tsx` (herdado e
corrigido).** Ambos falhavam em `origin/main` e foram tocados pelo mesmo commit `fb12ad2`
("corrige 4 suites que acusavam o produto por defeito do proprio harness"). Em HEAD os dois
passam. Isto **não é um defeito a corrigir na consolidação** — é uma melhoria já entregue
pelos 40 commits sobre uma falha herdada. Confirmado por diff de conteúdo das mensagens de
falha (ver comandos abaixo).

**Nota 3 — `epic-23-docs-vs-code.test.ts` e `epic-6-security-posture-doc.test.ts`
(introduzido, red intencional).** Ambos **não existem** em `origin/main` — criados pelo commit
`41c7bc0` ("test(pop-fix): testes vermelhos de drift doc-vs-codigo dos epics 6, 8 e 23"). Pelo
nome do commit e pelo padrão já visto nesta casa (POP-FIX, first-move rule do teste vermelho —
`sdc-mandatory.md`), são testes **vermelhos DELIBERADOS**, escritos para documentar um drift
doc-vs-código antes da correção, não uma regressão acidental. Ainda assim contam como vermelho
presente em HEAD hoje e devem ser tratados pela consolidação (fechar o POP-FIX ou aceitar o
vermelho como conhecido).

**Nota 4 — `epic9-docs-vs-realidade.test.ts` (introduzido, não commitado).** Este arquivo é
**UNTRACKED** — não existe em nenhum commit (nem `origin/main`, nem `d2b8083`). É conteúdo do
diretório de trabalho, parte das 33/34 entradas soltas do `git status`. É um vermelho real
hoje, mas sua origem não pode ser atribuída a um commit específico porque nunca foi commitado.

**Nota 5 — lint `@eximia/web` +9 erros (NÃO-PROVADO em nível de arquivo/regra).** O `biome`
trunca a saída (`Diagnostics not shown: 781` em ambas as medições), então não há como
reconstruir a lista completa de violações a partir do log para diffar arquivo a arquivo. O
`biome.json` não mudou entre `origin/main` e HEAD (diff vazio), então a mudança de contagem
não é de configuração. Delimitei o conjunto de commits candidatos: **24 commits** tocam
código-fonte não-teste de `apps/web/src/**` entre `origin/main` e HEAD (`git log --oneline
origin/main..d2b8083 -- 'apps/web/src/**/*.ts' 'apps/web/src/**/*.tsx'
':!apps/web/src/**/__tests__/**'`), incluindo rotas e telas novas (`722ffa7` tela Visão Geral,
`a4980ba`/`17c0497` rota `GET /api/courses`, `e02dea2`/`e8c38fd`/`f6b3ab8` feature-gate). Código
novo costuma carregar débito de lint inicial, mas **não confirmei isso por biome scoped run**
— fica **NÃO-PROVADO em nível de commit único**, provado apenas em nível de contagem agregada
(580→589) e de conjunto de commits candidatos.

## Comandos de evidência

```bash
# Lockfile idêntico nos 3 pontos
git diff --stat c65f1da origin/main -- pnpm-lock.yaml   # vazio
git diff --stat d2b8083 origin/main -- pnpm-lock.yaml   # vazio

# packages/agents e packages/ui não tocados pelos 40 commits (confirma HERDADO)
git diff --stat origin/main d2b8083 -- packages/agents packages/ui   # vazio

# origin/main, medido em wt-baseline
cd /Users/hugocapitelli/Dev/eximia/wt-baseline
pnpm turbo typecheck --force --continue   # 36 erros, @eximia/ui apenas
pnpm turbo test --force --continue        # ui 20/11, agents 8/1, web 19/5
pnpm turbo lint --force --continue        # central 3, course-designer 41, agents 43, web 580

# HEAD, já preservado pelo time-lead
cat /Users/hugocapitelli/Dev/eximia/eximia-academy-v2/docs/auditoria/consolidacao-2026-08-28/acad_{tsc,test,lint}.log

# arquivos de teste que só existem em HEAD (introduzidos)
git cat-file -e origin/main:apps/web/tests/epic-23-docs-vs-code.test.ts   # falha = ausente
git log --oneline origin/main..d2b8083 -- apps/web/tests/epic-23-docs-vs-code.test.ts  # 41c7bc0

# arquivos herdados e corrigidos pelos 40 commits
git log --oneline origin/main..d2b8083 -- 'apps/web/src/app/api/sessions/[sessionId]/messages/__tests__/route.test.ts'  # fb12ad2
```

## Resumo executivo

- **typecheck:** 100% HERDADO. 36 erros idênticos, todos em `packages/ui/src/stories/*`
  (Storybook ausente), zero delta.
- **test:** `ui` e `agents` 100% HERDADO (contagem e conteúdo idênticos). `web` tem
  **+22 falhas / +1 arquivo**, decompostos em: 2 arquivos herdados corrigidos pelos 40 commits
  (`fb12ad2`, líquido negativo), 1 falha herdada substituída por falha nova no mesmo teste
  (limiters), e 3 arquivos de teste novos (2 red intencional de POP-FIX via `41c7bc0`, 1
  não-commitado). O número bruto do time-lead (41 vermelhos herdados) está **superestimado**:
  parte relevante desses vermelhos é introduzida ou já corrigida, não pré-existente.
- **lint:** `central`, `course-designer`, `agents` 100% HERDADO. `web` tem **+9 erros / +3
  warnings**, atribuição em nível de commit único **NÃO-PROVADA** por limitação de truncamento
  do biome; atribuída a um conjunto de 24 commits candidatos.
- **Disco e repositório principal:** ambos íntegros ao final (6,4 GiB livres, HEAD em
  `d2b8083`, nenhuma escrita real no repositório principal).
