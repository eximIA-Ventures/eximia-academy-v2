# Triagem das 23 falhas de teste — HERDADA ou REGRESSÃO?

> **Data:** 2026-07-28 · **Autor:** @qa (Quinn) · **Repo:** `eximia-academy-v2`, branch `deploy/cory`
> **Baseline:** commit `8314547` (HEAD), *"fix(workspace): entrar no mundo Padrão abre a trilha do aluno, não o painel do time"*
> **Frente sob julgamento:** 202 arquivos não commitados (3º mundo Admin + hub de Configurações + Fase 2)

## 0. Veredito

**As 6 são DÍVIDA HERDADA. Zero regressões.** A frente não quebrou nenhum teste. A prova é por
**EXECUÇÃO**, não por inspeção: as mesmas 23 falhas, nos mesmos 6 arquivos, com as mesmas mensagens
literais, reproduzem no HEAD limpo, num worktree separado sem nenhuma mudança desta frente.

Mais que isso: a frente **adicionou** 23 arquivos de teste e 306 testes verdes, sem introduzir uma
única falha nova.

| Placar | Test Files | Tests |
|:---|:---|:---|
| Baseline (HEAD limpo, `/tmp/academy-baseline`) | 6 failed \| 115 passed (121) | **23 failed** \| 1456 passed \| 2 skipped (1481) |
| Árvore de trabalho (com a frente) | 6 failed \| 138 passed (144) | **23 failed** \| 1762 passed \| 2 skipped (1787) |
| Delta introduzido pela frente | +23 arquivos, **+0 falhas** | +306 passando, **+0 falhas** |

## 1. Método (o que é execução e o que é inspeção)

**Execução (a prova da classificação).** Worktree descartável criado em `/tmp/academy-baseline` no
commit `8314547`, com `pnpm install --frozen-lockfile --prefer-offline` (58s, reaproveitando o store
do pnpm). A árvore principal **não foi tocada**: nenhum `git stash`, `checkout`, `restore` ou commit.

```bash
git worktree add /tmp/academy-baseline HEAD --detach
cd /tmp/academy-baseline && pnpm install --frozen-lockfile --prefer-offline --ignore-scripts
cd /tmp/academy-baseline/apps/web && npx vitest run
```

O worktree era obrigatório e o atalho de symlinkar `node_modules` foi **descartado de propósito**:
`packages/` está sujo nesta frente (`packages/shared/src/modules/registry.ts`,
`packages/ui/src/components/sidebar.tsx`, `packages/database/src/schema/*`), e como os pacotes de
workspace entram por symlink no `node_modules`, o baseline teria silenciosamente consumido o código
**sujo** da frente e a prova seria falsa.

**Inspeção (só para a coluna "causa").** A causa-raiz de cada falha veio de ler o teste contra o
código de produção. Ela explica *por que* falha; ela não é o que classifica HERDADA vs REGRESSÃO.

**Dado de apoio (não é prova sozinho).** Os 6 arquivos de teste estão limpos no git, e 5 dos 6
arquivos de produção que eles exercitam também estão limpos, com último commit em maio ou 15/jul.
O único sujo é `login-form.tsx`, e o diff dele é inócuo para o teste (ver §2.5).

## 2. Classificação, arquivo a arquivo

| # | Arquivo | Classificação | Causa (uma frase) |
|:--|:---|:---|:---|
| 1 | `src/lib/__tests__/rate-limit.test.ts` (2/3) | **HERDADA** | O módulo hoje exporta 16 limiters e um fallback `InMemoryRatelimit`; o teste ainda exige 15 e espera `null` sem env. |
| 2 | `src/components/onboarding/__tests__/step-employee-status.test.tsx` (4/4) | **HERDADA** | Os rótulos das 3 opções foram reescritos no componente; o teste procura a redação antiga. |
| 3 | `src/app/api/sessions/[sessionId]/messages/__tests__/route.test.ts` (9/16) | **HERDADA** | O mock do `serviceClient` só implementa `insert()`; a rota passou a chamar `.from("sessions").select()`, e o `TypeError` derruba o pipeline em 500. |
| 4 | `src/components/dashboard/__tests__/manager-dashboard.test.tsx` (1/2) | **HERDADA** | O hero renderiza `Olá, Carlos` **sem** "!"; o teste casa `/Olá, Carlos!/` **com** "!". |
| 5 | `src/components/auth/__tests__/login-form-google-oauth.test.tsx` (6/10) | **HERDADA** | O `LoginForm` foi redesenhado e o botão Google saiu do ar ("disabled until provider is configured"); o teste ainda exercita a UI antiga. |
| 6 | `src/components/dashboard/__tests__/manager-course-dashboard.test.tsx` (1/2) | **HERDADA** | O hero renderiza `Olá, Maria!` **com acento**; o teste casa `/Ola, Maria!/` **sem acento**. |

### 2.1 `rate-limit.test.ts` — HERDADA

Evidência de execução (baseline, HEAD limpo):

```
FAIL  src/lib/__tests__/rate-limit.test.ts > exports null limiters when env vars are missing
AssertionError: expected InMemoryRatelimit{ …(4) } to be null
FAIL  src/lib/__tests__/rate-limit.test.ts > exports exactly 15 named limiters
AssertionError: expected [ 'chatLimiter', 'authLimiter', …(14) ] to have a length of 15 but got 16
```

Causa: `rate-limit.ts:28` define `class InMemoryRatelimit` e `:88` devolve `new InMemoryRatelimit(...)`
como fallback quando o Upstash não está configurado, então o limiter nunca é `null`. E
`grep -c "^export const .*Limiter"` devolve **16** (o 16º, `semanticAnalysisLimiter`, entrou no commit
`5aec368`, 20/mai). O código está certo; o teste envelheceu.

**Esta é a única das 6 já declarada em documento.** `docs/architecture/workspace-admin.md:748` e
`:905` a registram como pré-existente ("não é regressão, não consertar"). A execução confirma a
declaração.

**Ação:** atualizar o teste para 16 limiters e para o contrato de fallback in-memory. Baixa
prioridade, não bloqueia.

### 2.2 `step-employee-status.test.tsx` — HERDADA

```
TestingLibraryElementError: Unable to find an element with the text: Sou novo, preciso do onboarding
```

O componente (`step-employee-status.tsx:14-28`) renderiza hoje:

| `value` | Título real hoje | O que o teste procura |
|:---|:---|:---|
| `new_needs_onboarding` | "É minha primeira vez aqui" | "Sou novo, preciso do onboarding" |
| `new_already_onboarded` | "Já conheço a plataforma" | "Sou novo, mas já fiz o onboarding" |
| `existing` | "Estou retornando" | "Já trabalho aqui há algum tempo" |

O título da tela também mudou (o teste espera "Você é novo na empresa?"). Último commit do
componente: `cd7493f`, 07/mai. **A copy mudou de propósito e o teste ficou obsoleto** — o
comportamento (os 3 `value`) permanece correto.

**Ação:** reescrever as 4 asserções para os rótulos atuais. É atualização de teste, não conserto de
código.

### 2.3 `route.test.ts` (sessions/messages) — HERDADA

Esta é a mais informativa, porque a mensagem entrega a causa literal:

```
TypeError: serviceClient.from(...).select is not a function
    at Module.POST (.../api/sessions/[sessionId]/messages/route.ts:70:8)
```

A rota (`route.ts:68-75`) faz `serviceClient.from("sessions").select(...).eq("id", sessionId).limit(1)`.
O mock do teste (`route.test.ts:188`) devolve um objeto que só tem `insert`:

```js
mockServiceFrom.mockImplementation(() => ({
  insert: () => ({ select: () => ({ single: () => ... }) }),
}))
```

Logo `.select` é `undefined`, o `TypeError` estoura no `try`, e as 9 falhas são **uma só causa em
cascata**: o 500 substitui o 200, nenhum spy do pipeline chega a ser chamado, e o corpo de erro vira
JSON com stack em vez do texto `"Pipeline error"` que o teste espera. A rota migrou de `.single()`
para `.select().limit(1)` (linhagem do commit `7517f01`, 21/mai, *"pipeline crash — null-safe question"*)
e o mock nunca acompanhou.

**Ação:** completar o mock do `serviceClient` com a cadeia `from().select().eq().limit()`. Corrigir
**um** mock deve devolver as 9 de uma vez. É o item de maior retorno da lista.

### 2.4 e 2.6 Os dois dashboards ("corporate labels") — HERDADA, e o motivo é pontuação

O lead pediu atenção especial a estes dois, porque a frente mexeu em rótulos e dashboards. **Mexeu,
mas não foi isto.** Ambos os componentes estão limpos no git, e ambos falham no baseline. O que
falha, aliás, não é rótulo de card nenhum: é a **primeira** asserção de cada teste, a saudação do
hero. E os dois erram por motivos espelhados:

| Componente (limpo no git) | O que renderiza hoje | O que o teste casa | O que sobra |
|:---|:---|:---|:---|
| `manager-dashboard.tsx:279` | `Olá, {firstName}` | `/Olá, Carlos!/` | falta o **"!"** no componente |
| `manager-course-dashboard.tsx:71` | `Olá, {firstName}!` | `/Ola, Maria!/` | falta o **acento** no teste |

Cada teste, por acaso, casa com a convenção do *outro* componente. Isso é copy que divergiu ao longo
do tempo sem ninguém rodar os dois testes juntos, não uma decisão desta frente.

**Registro para decisão (não fazer no escuro):** as asserções seguintes de cada teste ("Competencias
Ativas", "ROI de Treinamento", "Total de Cursos e Trilhas") **nunca chegaram a ser avaliadas**,
porque o teste morre na saudação. Ao consertar a saudação, é provável que apareçam falhas de rótulo
de card por baixo. Quem for corrigir precisa decidir, com o dono da copy, qual é o texto canônico —
e a divergência de "!" e de acento entre os dois heros é, ela mesma, um bug de produto pequeno que
vale endereçar junto.

**Ação:** decisão de copy primeiro (padronizar a saudação nos dois heros), teste depois. Não
bloqueia este pacote.

### 2.5 `login-form-google-oauth.test.tsx` — HERDADA (apesar do arquivo de produção estar sujo)

Este é o único caso em que o arquivo de produção **foi tocado por esta frente**, então merece o
escrutínio maior. Ele continua sendo dívida herdada, por dois motivos independentes:

**Primeiro, a execução.** As 6 falhas reproduzem idênticas no baseline, onde a mudança da frente não
existe.

**Segundo, o diff é inócuo para o teste.** `git diff` em `login-form.tsx` são 13 inserções e 8
remoções, todas dentro do `handleLogin`: comentários mais o descarte do atalho `if (data.superAdmin)
router.push("/super-admin/tenants")` em favor de `router.push("/workspace")` para todos. Não toca uma
linha de render.

A causa real é anterior: o `LoginForm` foi reescrito em markup próprio (não importa mais nada de
`@eximia/ui`), os placeholders viraram `"Email"` e `"Senha"` (o `"seu@email.com"` que o teste procura
só sobrevive no formulário de recuperação de senha, atrás de `if (showReset)`), e o bloco do Google
foi desativado — o arquivo termina com o comentário literal
`{/* Google OAuth — disabled until provider is configured */}` e nenhum botão. O `Divider` com o
`"ou"` existe (`:366-374`) mas não é mais renderizado no fluxo padrão.

O teste, por sua vez, nunca foi tocado desde `d65f3a5` (*"initial import from eximia-academy v1"*).
Ele descreve uma feature que **hoje não está no ar**.

**Ação — e aqui há uma pergunta de produto, não de teste.** Este arquivo é o único dos 6 que não é
"teste velho": ele é um **teste velho apontando para uma feature removida**. Antes de mexer no
teste, alguém precisa responder se o login com Google deve voltar. Se sim, o teste está certo e o
código é que está incompleto. Se não, o arquivo inteiro deve ser deletado, e não remendado — manter
teste vermelho de feature morta é ruído permanente no gate. **Não decidi isso sozinho; fica
registrado para o dono.**

## 3. Higiene da verificação

O worktree foi removido ao final e a árvore principal ficou intacta:

```
$ git worktree list
/Users/hugocapitelli/Dev/eximia/eximia-academy-v2   8314547 [deploy/cory]
(+ os worktrees pré-existentes de outras frentes; /tmp/academy-baseline não consta)
```

Nenhum commit foi feito. A árvore principal foi alterada em **exatamente 1 arquivo**: este
documento (202 → 203 arquivos no `git status --porcelain`).

## 4. Veredito final

**O pacote está saudável e pode seguir para commit.** Nada nas 23 falhas pertence a esta frente:
todas as 6 são dívida herdada, provada por execução no HEAD limpo, e a frente entrega +306 testes
verdes sem nenhuma falha nova. **Não há bloqueador.**

Duas ressalvas que **não bloqueiam este commit**, mas devem virar itens próprios:

1. **`route.test.ts` é o melhor retorno da fila** — um mock incompleto segura 9 das 23 falhas.
   Consertar a cadeia `from().select().eq().limit()` provavelmente reverdece o arquivo inteiro.
2. **`login-form-google-oauth.test.tsx` precisa de decisão do dono, não de conserto** — é teste de
   uma feature que foi desativada no código. Voltar a feature e deletar o teste são caminhos
   opostos, e escolher no escuro é pior que deixar vermelho mais uma semana.

Fica também o registro de que apenas 1 das 6 (a `rate-limit.test.ts`) estava declarada em documento.
As outras 5 eram vermelho não documentado, o que é exatamente o que faz um gate integrador perder
poder de sinalização: quando o vermelho é normal, ninguém olha o vermelho novo.

---
*Classificação por execução — @qa (Quinn), guardião da qualidade.*
