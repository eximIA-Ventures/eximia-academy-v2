# GOAL — Consolidação auditada da Academy v2

> Aberto em 2026-08-28 por J.A.R.V.I.S., a pedido do Senhor.
> Modo: só Cloud (subagentes Claude isolados). Auditoria visual autorizada com app vivo.
> Escopo decidido pelo Senhor: **auditar e sanear, sem mexer em `main`**.

## Objeto (declarado por path, nunca por descrição)

`/Users/hugocapitelli/Dev/eximia/eximia-academy-v2`, branch `integra/main-cory`, commit `d2b8083`.
Escopo exato: `git diff origin/main...HEAD` — 40 commits, 263 arquivos, +39.060 / −722 linhas.
Sincronizada com `origin/deploy/cory` (0 à frente, 0 atrás). `origin/main` está 40 commits atrás.

Frentes contidas no escopo:
- Aprendizagem do Time (analytics do gestor) — `apps/web/src/lib/analytics/aprendizagem-time/`
- Autogestão da Jornada (aluno) — `apps/web/src/lib/analytics/autogestao/`, `apps/web/src/app/(platform)/jornada/_autogestao/`
- Identidade de marca por variável de build
- Harness gauntlet e gabaritos — `apps/web/scripts/gauntlet/`, `docs/gauntlet/`
- 4 migrations Supabase

## Pronto quando (critério de saída verificável)

1. Todo vermelho de verificador está classificado HERDADO / INTRODUZIDO / NÃO-PROVADO, com o comando que sustenta a classificação colado.
2. Nenhum vermelho INTRODUZIDO pelos 40 commits sobrevive — ou está corrigido, ou tem decisão registrada do Senhor.
3. Toda regra de negócio nova tem teste que **reprova sob mutação** (verde não conta como prova).
4. As 6 telas novas foram medidas com app vivo: `elementFromPoint`, rolagem, clique e comparação contra referência, com INVERIFICÁVEL declarado onde não der para medir.
5. A dispersão está resolvida ou registrada: 33 entradas untracked triadas, migrations auditadas contra o schema real, duplicação entre as duas frentes de analytics decidida.
6. `main` permanece intocada. Nenhum push, PR ou deploy (autoridade exclusiva do @devops).

## Comandos de verificação (a mesma régua que o revisor usa)

```
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
pnpm turbo typecheck --force --continue
pnpm turbo test --force --continue
pnpm turbo lint --force --continue
git log --oneline -1                    # d2b8083, inalterado
git rev-list --left-right --count origin/main...HEAD   # main intocada
```

`--force` é obrigatório em todos: cache de turbo já produziu verde por vacuidade nesta casa.

## Linha de base medida (2026-08-28 18:35, HEAD d2b8083)

| Verificador | Resultado | Detalhe |
|:---|:---|:---|
| typecheck | **FALHA** (exit 2) | 36 erros TS, todos em `packages/ui/src/stories/*` (Storybook ausente). 6 dos 7 workspaces verdes. |
| test | **FALHA** (exit 1) | 69 falhas / 3.799 testes. `ui` 20/11 arquivos · `agents` 8/1 · `web` 41/6 |
| lint | **FALHA** (exit 1) | 676 erros: web 589, agents 43, course-designer 41, central 3 |

Delta preliminar por diff de path (a ser provado por medição no LOOP-0):
- `packages/ui` e `packages/agents` **não foram tocados** pelos 40 commits → vermelhos herdados de `main`.
- `apps/web`: `login-form-google-oauth` e `manager-dashboard` não tocados; `rate-limit`, `epic-23-docs-vs-code` e `epic-6-security-posture-doc` **tocados**; `epic9-docs-vs-realidade.test.ts` **não versionado** e falhando 8 de 18.

Logs crus preservados neste diretório: `acad_test.log`, `acad_tsc.log`, `acad_lint.log`.

## Achado já confirmado antes dos loops

`docs/gauntlet/autogestao-jornada/GABARITO.json` está modificado e não commitado. O diff é de 13 linhas: mudam `courseId`, os 8 `capituloIds` e os IDs dos alunos, e **nenhum valor esperado**. A régua não foi afrouxada. Porém o `tenantId` permaneceu fixo (`b483c98b-…`) enquanto todo o resto foi recriado: o tenant "descartável" está sendo reusado entre runs.

## Loops abertos

| Loop | Frente | Executor | Verificador |
|:---|:---|:---|:---|
| LOOP-0 | Delta herdado vs introduzido | @qa isolado | Medição em `origin/main`, sem cache |
| LOOP-1 | Revisão técnica dos 40 commits | @architect isolado | Cenário de falha concreto por achado |
| LOOP-2 | Auditoria funcional | @qa isolado | Mutação dirigida: o teste reprova quando quebro a regra? |
| LOOP-3 | Auditoria visual | @qa isolado | App vivo, DOM medido, comparação contra referência |
| LOOP-4 | Consolidação e dispersão | a abrir | Depende dos anteriores |

Invariante: nenhum loop corrige o que ele mesmo mediu. Maker ≠ checker.
