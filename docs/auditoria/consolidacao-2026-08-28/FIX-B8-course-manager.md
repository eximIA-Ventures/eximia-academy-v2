# FIX-B8 — `requireCourseManager`: três estados, e as duas rotas sem guard de papel

> Executado em 2026-08-30, worktree `/Users/hugocapitelli/Dev/eximia/eximia-academy-v2`,
> branch `integra/main-cory`.
> Última família conhecida do E→NEGA (laudo LOOP-0c), depois de FIX-B, FIX-B2 e FIX-B5.
> **Nenhum commit, push ou escrita em banco.** Todos os duplos são em memória.
> **Não toquei** em `api-role-guard.ts`, `require-admin.ts`, `super-admin-auth.ts`, `auth.ts`
> nem em `notifications/nudge` — todos com outros donos.

## Placar

| Frente | Vermelho antes | Verde depois |
|---|---|---|
| Guard + `enrich`/`export` | **5 falhas** | 25/25 |
| `generation-status` (rota sem guard) | **3 falhas** | 8/8 (inclui as travas de `quizzes`) |
| **Total** | **8 falhas** | **33/33** |

Mais **2 mutantes mortos em direções opostas** e **1 trava de compilador** que enumerou os
chamadores.

`src/app/api` → **43 arquivos, 839 testes, 0 falhas**.
`src/app` + `src/lib` → **302 arquivos, 3198 testes, 0 falhas**.
`tsc --noEmit` → **limpo** (0 erros).

---

## Parte 1 — `requireCourseManager` tinha dois estados onde a realidade tem três

### O defeito

```ts
const { data: profile } = await supabase
  .from("users").select("role, tenant_id, user_roles!…(role)").eq("id", userId).single()
if (!profile) return { ok: false, error: "Perfil não encontrado" }
```

Mesma omissão do `error` das 47 rotas já corrigidas. **Aqui é pior por um motivo específico:**
a recusa por falha de leitura imita exatamente a recusa legítima que este gate existe para
aplicar (a separação entre a lente do gestor e a do instrutor, de `fix-manager-privacy-gates`).
Ela não parece um defeito — parece o gate funcionando.

### O censo dos chamadores: 16 em produção, 8 em teste

O briefing fala em 24 call sites. São **16 invocações em produção** e **8 dentro do arquivo de
teste existente** (`lib/__tests__/course-management-guard.test.ts`). Os 16 se distribuem em
**cinco formas de tradução** diferentes, e é essa diversidade que torna o colapso fácil:

| Forma | Sítios | Como traduzia `ok:false` |
|---|---|---|
| Rota de API | 2 (`enrich`, `export`) | `403 { error }` |
| Página RSC | 5 | `redirect(...)` |
| Server action `{ error }` | 7 | `return { error }` |
| Server action `{ ok, error }` | 1 | `return { ok:false, error }` |
| `throw` | 1 (`slide-actions`) | `throw new Error("Forbidden")` |

### O terceiro estado, e a trava que impede ele de morrer no chamador

```ts
export type CourseManagerCheck =
  | { ok: false; motivo: "sem-permissao"; error: string }
  | { ok: false; motivo: "indisponivel"; mensagem: string }
  | { ok: true; motivo?: never; ctx: CourseManagerContext }
```

**Os nomes dos campos são assimétricos de propósito, e o campo ausente é ausente MESMO — não
`?: never`.** Essa diferença decide se a trava funciona, e eu errei na primeira tentativa:

| Desenho | O que o `tsc` acusa |
|---|---|
| `error?: never` na perna `indisponivel` | ler `check.error` é **legal** (devolve `string \| undefined`); só reclama onde o destino exige `string` → **3 sítios** |
| campo simplesmente ausente | `check.error` sobre a união é **propriedade inexistente** → **10 sítios** |

Ou seja: a versão "elegante" com `?: never` teria deixado **7 chamadores colapsando em
silêncio**, que é precisamente o risco que o briefing nomeia. Medi as duas e fiquei com a que
enumera.

Os **10 sítios apontados pelo compilador** (8 actions + 2 rotas de API) são os que leem a
mensagem. Os **6 restantes** (5 páginas que só fazem `redirect`, e o `slide-actions` que só faz
`throw`) **o compilador não pega**, porque nunca tocam no campo — foram varridos à mão, um a um,
e estão na régua abaixo.

### Propagação, decidida por forma

| Forma | Indisponibilidade passa a ser | Por quê |
|---|---|---|
| Rota de API (3, com `generation-status`) | **503 + `Retry-After`**, corpo `profile_check_unavailable` | Mesma assimetria do `feature-gate` e do `api-role-guard`. Retentável, e diz a verdade. |
| Página RSC (5) | **`throw`** (fronteira de erro do Next) | `redirect` para a lista diz "você não pertence aqui" — a mesma mentira do 403, com outra roupa. |
| Server action (8) | mensagem distinta, via `mensagemDaRecusa()` | O contrato de retorno só carrega string; a distinção chega ao usuário como texto: "tente novamente" em vez de "permissão negada". |
| `throw` (1) | `throw` com a mensagem retentável | "Forbidden" para leitura falha é a mesma mentira. |

**Limite honesto, registrado para quem for dono da UI:** nas 8 server actions a distinção chega
ao usuário como **texto**, não como campo legível por máquina. O cliente não consegue oferecer
um botão "tentar de novo" nem instrumentar a taxa de indisponibilidade. Elevar isso exigiria
mudar o contrato de retorno das 8 actions e os componentes que as consomem — fora do escopo
desta rodada.

### Vermelho ANTES

```
 × requireCourseManager > erro transitório na leitura do perfil NÃO pode virar recusa
   → expected undefined to be 'indisponivel'
 × requireCourseManager > [CP] perfil inexistente (PGRST116) continua RECUSA
   → expected undefined to be 'sem-permissao'
 × requireCourseManager > [CP] chapéu de gestor puro continua RECUSA
   → expected undefined to be 'sem-permissao'
 × enrich/export > POST /api/courses/[courseId]/enrich — falha ao LER o perfil não pode virar 403
   → expected 403 not to be 403
 × enrich/export > GET /api/courses/[courseId]/export — falha ao LER o perfil não pode virar 403
   → expected 403 not to be 403
      Tests  5 failed | 9 passed (14)
```

### Ajuste de fixture no teste existente — não é o teste cedendo ao código

O stub de `course-management-guard.test.ts` devolvia `{ message: "not found" }` **sem `code`**
para a linha ausente. Isso não é o que o PostgREST devolve: `.single()` sem linhas dá
`PGRST116`. A fixture estava errada sobre a realidade, e a imprecisão só ficou visível quando o
guard passou a decidir **por `code`** — sem `code`, o caso cairia em "indisponível", que é o
oposto do que aquele arquivo afirma.

Passei a fixture a emitir o erro real. **A intenção das asserções (perfil ausente é recusa, não
falha de infraestrutura) fica intacta e melhor provada.** Registro explicitamente porque
"ajustar o teste para o código passar" é, em geral, o antipadrão — aqui é o contrário: o teste
passou a descrever o banco de verdade.

---

## Parte 2 — as duas rotas sem guard de papel, e por que recebem tratamentos OPOSTOS

Medi a alegação de RLS por conta própria, como pedido. **Concordo que não é porta aberta**, e
tenho uma ressalva de grau numa das duas.

### Concordância: ambas usam o cliente de sessão

`createClient()` (chave anônima + cookie), não `createServiceClient()`. O RLS se aplica. Confere.

### A ressalva: as duas políticas de RLS não têm a mesma largura

| Tabela | Política de SELECT | Escopo real |
|---|---|---|
| `quiz_sessions` | `qs_student_select` | tenant **+ papel student + `is_active` + matrícula ATIVA no curso** |
| `chapter_slides` | `chapter_slides_select` | `auth.role() = 'authenticated'` **+ tenant, e mais nada** |

```sql
-- 20260314000000_chapter_slides.sql
CREATE POLICY "chapter_slides_select" ON chapter_slides FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
  );
```

`chapter_slides` **não é escopada por matrícula nem por papel**. Então em
`generation-status` a frase "o aluno só vê o que já lhe seria permitido" é literalmente
verdadeira (o RLS permite), mas o que o RLS permite ali é **mais largo que a intenção da
feature**: qualquer membro do tenant, inclusive um aluno não matriculado, lê o progresso de
autoria de um capítulo em rascunho (quantos slides, quantos em revisão, % pronto). Não é dado
pessoal nem o texto dos slides — mas é material que o gate de gestão de curso existe para
manter na lente do instrutor.

**Veredito:** concordo com "defesa em profundidade" para `quizzes`; para `generation-status`
ponho **um degrau acima** — não é acesso indevido no sentido de RLS, mas a fronteira do RLS foi
escrita para outro propósito e é mais larga que a da feature. A gravidade não muda a ação
(ambas precisam do guard); muda a ordem de prioridade se alguém tiver de escolher uma.

### `generation-status` — GANHA guard

O **único consumidor** no repositório é `slide-manager.tsx`, que vive dentro de
`courses/[courseId]/chapters/[chapterId]/edit/page.tsx` — **uma página já protegida por
`requireCourseManager`**. Aplicar o mesmo guard alinha a rota ao seu próprio chamador e não
fecha porta em ninguém legítimo.

Vermelho antes:
```
 × aluno do mesmo tenant NÃO pode ler o progresso de autoria          → expected 200 to be 403
 × falha ao LER o perfil não pode virar 403                           → expected 200 to be 503
 × [CP] chapéu de gestor puro continua recusado                       → expected 200 to be 403
      Tests  3 failed | 5 passed (8)
```

### `quizzes` — NÃO ganha guard, de propósito

Dois fatos, e eles apontam para o outro lado:

1. `qs_student_select` **contempla explicitamente o aluno** (tenant + papel student +
   `is_active` + matrícula ativa). O aluno é público legítimo deste dado, **por desenho do
   banco**.
2. A rota **não tem nenhum consumidor no repositório**. Não dá para inferir a intenção pelo
   chamador.

Pôr um guard de instrutor aqui **estreitaria o acesso contra o desenho do RLS** — exatamente o
erro de "mudar quem tem direito a pretexto de arrumar outra coisa", na direção inversa. É o
mesmo princípio que me fez recusar aplicar `requireRole` na `notifications/nudge`.

**Tratamento:** três testes **[TRAVA]** que fixam o contrato atual — aluno autenticado não pode
receber 403, sem sessão continua 401, e erro de leitura continua **500 explícito** (nunca lista
vazia com 200, que é o E→ENGOLIDO). Eles não corrigem defeito: existem para que a próxima pessoa
que "padronizar os guards" veja vermelho **antes** de trancar o aluno do lado de fora.

---

## Duas mutações, em direções opostas

Um mutante só provaria metade. A suíte precisa distinguir o estado certo dos **dois** vizinhos
degenerados.

**M1 — o guard volta a colapsar** (`if (false && error && error.code !== ZERO_LINHAS)`):
```
 × requireCourseManager > erro transitório na leitura do perfil NÃO pode virar recusa
 × generation-status > falha ao LER o perfil não pode virar 403
 × enrich/export > POST .../enrich — falha ao LER o perfil não pode virar 403
 × enrich/export > GET .../export — falha ao LER o perfil não pode virar 403
      Tests  4 failed | 18 passed (22)
```

**M2 — tudo vira indisponível** (a recusa legítima passa a `motivo: "indisponivel"`):
```
 × [CP] chapéu de gestor puro continua RECUSA — o gate de privacidade não pode afrouxar
 × generation-status > aluno do mesmo tenant NÃO pode ler o progresso de autoria
 × generation-status > [CP] chapéu de gestor puro continua recusado
 × enrich/export > [CP] .../enrich — chapéu de gestor puro continua 403
 × enrich/export > [CP] .../export — chapéu de gestor puro continua 403
 × requireCourseManager > denies a manager-only hat — the leak this fixes
 × requireCourseManager > denies student hat
 × requireCourseManager > denies leader hat
      Tests  8 failed | 363 passed (371)
```

M2 é o mais importante: ele mostra que a correção **não pode afrouxar o gate de privacidade**
para parecer generosa. Arquivo restaurado e conferido com `diff` contra o backup nas duas vezes.

## Régua — os 16 sítios (17 com a rota nova), arquivo a arquivo

Cada arquivo precisa decidir o motivo pelo menos tantas vezes quantas invoca o guard:

```
app/(platform)/courses/[courseId]/chapters/[chapterId]/edit/page.tsx          1/1  OK
app/(platform)/courses/[courseId]/chapters/[chapterId]/edit/slide-actions.ts  1/1  OK
app/(platform)/courses/[courseId]/chapters/[chapterId]/questions/actions.ts   3/3  OK
app/(platform)/courses/[courseId]/chapters/[chapterId]/questions/page.tsx     1/1  OK
app/(platform)/courses/[courseId]/chapters/actions.ts                         1/1  OK
app/(platform)/courses/[courseId]/chapters/new/ingest/page.tsx                1/1  OK
app/(platform)/courses/[courseId]/chapters/new/page.tsx                       1/1  OK
app/(platform)/courses/[courseId]/enrich/actions.ts                           1/1  OK
app/(platform)/courses/[courseId]/questions/actions.ts                        2/2  OK
app/(platform)/courses/[courseId]/questions/page.tsx                          1/1  OK
app/(platform)/courses/actions.ts                                             1/1  OK
app/api/chapters/[chapterId]/slides/generation-status/route.ts                1/1  OK  (nova)
app/api/courses/[courseId]/enrich/route.ts                                    1/1  OK
app/api/courses/[courseId]/export/route.ts                                    1/1  OK
```

**A régua é fraca por construção** (conta ocorrências de token, não verifica semântica). Ela é o
complemento, não a prova — a prova são os 10 sítios que o compilador recusou e as duas mutações.

## Formatação

`biome check` nos 19 arquivos que toquei: **contagem conferida (`Checked 19 files`)**, e as
únicas queixas são `format` em 3 arquivos de rota **que já estavam desformatados em `HEAD`** —
verificado extraindo as versões de `HEAD` para árvore temporária e rodando o mesmo `biome`
(`slide-actions.ts`, `generation-status/route.ts`, `export/route.ts`, com o mesmo
`noUnusedTemplateLiteral` pré-existente no primeiro). Não reformatei o que não toquei. Os
arquivos novos estão limpos.

## Arquivos

**Novos:**
- `apps/web/src/lib/__tests__/course-manager-tres-estados.test.ts`
- `apps/web/src/app/api/courses/[courseId]/__tests__/course-manager-ilegivel-nao-e-negacao.test.ts`
- `apps/web/src/app/api/__tests__/rotas-sem-guard-de-papel.test.ts`

**Modificados:** `lib/course-management-guard.ts`, os 16 sítios de chamada, a rota
`generation-status`, e a fixture de `lib/__tests__/course-management-guard.test.ts`.

**Não modificado, por regra de coordenação:** `api-role-guard.ts`, `require-admin.ts`,
`super-admin-auth.ts`, `auth.ts`, `notifications/nudge`, `courses/[courseId]/quizzes` (esta
última por decisão de mérito, ver Parte 2).

## Aberto, para quem tiver o contexto

1. **O contrato de retorno das 8 server actions** só carrega string. A indisponibilidade chega
   ao usuário como texto, não como campo. Um botão "tentar de novo" exigiria mudar as actions e
   os componentes.
2. **`chapter_slides_select` é escopada só por tenant.** O guard de rota fecha o caminho da API,
   mas a política em si continua mais larga que a intenção da feature. É decisão de quem for
   dono do RLS, não minha.
3. **`courses/[courseId]/quizzes` não tem consumidor no repositório.** Ou é consumida
   externamente, ou é rota morta. Vale um veredito de quem souber.

## Comandos de evidência

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2

pnpm --filter @eximia/web test src/lib/__tests__/course-manager-tres-estados.test.ts \
  src/lib/__tests__/course-management-guard.test.ts \
  "src/app/api/courses/[courseId]/__tests__" \
  src/app/api/__tests__/rotas-sem-guard-de-papel.test.ts        # 33/33

pnpm --filter @eximia/web test src/app/api                       # 43 arquivos, 839 testes
pnpm --filter @eximia/web test src/app src/lib                   # 302 arquivos, 3198 testes
pnpm --filter @eximia/web exec tsc --noEmit                      # limpo

# a política que sustenta o veredito da Parte 2
sed -n '36,43p' supabase/migrations/20260314000000_chapter_slides.sql   # só tenant
sed -n '69,80p' supabase/migrations/20260228200000_quiz_tables.sql      # tenant+student+matrícula
```
