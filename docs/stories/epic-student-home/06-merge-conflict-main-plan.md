# EPIC-STUDENT-HOME — Plano: RESOLUÇÃO DE CONFLITO DE MERGE (eng-center-v2 → main)

> **Autor:** Vitruvio (Planejador) · **Data:** 2026-07-13
> **Ordem do Hugo:** pré-requisito do deploy de prod do Argos. Linha completa: este plano → Saga → Roteiro → Contrato → Capataz → par Malho/Lupa.
> **Fase:** DOCS ONLY + análise read-only (nenhum merge aplicado, nada pushado, main intacta).
> **Repo:** `/Users/hugocapitelli/Dev/eximia/eximia-academy-v2`.

## 0. Contexto e SHAs (verificados read-only)

O deploy travou: `feat/engagement-center-v2 → main` não é limpo. A **main DIVERGIU** com feature-work próprio (não está só "atrás"). Gage já pushou `feat/SH-1.4` e mergeou o PR #1 → `feat/engagement-center-v2`; ao tentar `eng → main` deu 3 CONFLITOS, abortou, **main INTACTA**.

- `main` tip: **52a54f5** (`fix: question chooser async/await + error handling + solid backdrop`)
- `feat/engagement-center-v2` tip: **e94c47c**
- merge-base: **ab5e7ca**
- 3 arquivos em conflito (confirmado por `git merge-tree`, sem tocar working tree):
  1. `apps/web/src/components/module-gate.tsx` (TRIVIAL, bugfix)
  2. `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/_components/question-chooser-sheet.tsx` (UI, decisão visual)
  3. `apps/web/src/app/(platform)/analytics/students/[studentId]/page.tsx` (**LGPD, CRÍTICO**)

## 1. GUARDRAILS (não-negociáveis)

- Malho cria **branch de integração a partir da main** (ex.: `integration/eng-to-main`), **NÃO** trabalha na main direto. Main fica limpa se algo der errado.
- **ZERO push.** O @devops (Gage) retoma o deploy depois, com o GO.
- **NÃO** tocar em deploy/cory nem na main definitiva.
- Se sujar: `git merge --abort` / `git reset --hard` e restaurar. Main permanece em 52a54f5.
- **O LGPD (conflito 3) NÃO é aplicado sem confirmação explícita do Hugo** (ver §4). Malho resolve os 2 triviais, PARA no LGPD e flaga.

---

## 2. Conflito 1 — `module-gate.tsx` (TRIVIAL, resolver a favor do BUGFIX)

**1 hunk, `href` do botão "Entrar em contato" (mailto).**

- **MAIN (BUG):** `href="mailto:...subject=Interesse%20no%20modulo%20${encodeURIComponent(moduleName)}"` — string com **aspas duplas**; `${...}` NÃO é interpolado → o assunto vai literal `${encodeURIComponent(moduleName)}`.
- **ENG (BUGFIX):** `` href={`mailto:...${encodeURIComponent(moduleName)}`} `` — **template literal** em chaves → interpola corretamente o nome do módulo.

**Resolução:** tomar o lado **ENG** (bugfix). Verificação: o `href` renderizado contém o nome do módulo interpolado, não `${...}` literal.

---

## 3. Conflito 2 — `question-chooser-sheet.tsx` (UI, decisão visual REGISTRADA)

**2 hunks: (a) paleta dos badges de intenção; (b) z-index + backdrop + tema do modal.**

| Aspecto | MAIN (52a54f5) | ENG (engagement-center-v2) |
|:--|:--|:--|
| Badges intenção | dark-theme: `bg-purple-500/10 text-purple-400 ring-purple-500/20` (roxo/âmbar/esmeralda/azul escuros) | light-theme: `bg-purple-100 text-purple-700 ring-purple-200` |
| z-index do overlay | `z-[60]` | `z-[9999]` |
| Backdrop | `bg-black/95 animate-in fade-in duration-200` | `bg-black/95` (opaco, sem animação) |
| Fundo do modal | `bg-bg-card` (token, adapta tema) + `animate-in zoom-in-95` | `bg-white` + `style={{backgroundColor:'#ffffff'}}` (imunidade CSS-stale, padrão da casa) |
| Palette geral | tokens (`text-text-primary`, `bg-border-subtle`, `hover:bg-bg-elevated`) | hardcoded stone/orange (`text-stone-900`, `border-stone-200`, `bg-orange-50`) + `border-b/border-t` divisores |

**Recomendação: tomar o lado ENG**, e **registrar o porquê** (Malho documenta no commit de resolução):
1. **`z-[9999]`** garante que o modal nunca seja ocluído por outro overlay; `z-[60]` é frágil se algum overlay usar stacking maior.
2. **Fundo branco inline (`style backgroundColor`)** segue o padrão de **imunidade CSS-stale** já adotado nos cards "Meu ritmo" (cor crítica viaja no HTML, não some sob CSS defasado/Docker layer) — exatamente o risco que a própria tip da main tentou cobrir ("solid backdrop").
3. O ENG **cumpre a intenção declarada da tip da main** ("solid backdrop") de forma mais completa (backdrop opaco + fundo sólido garantido), então tomar ENG NÃO regride o fix da main, o subsume.
4. Paleta light (stone/orange) é consistente com as demais superfícies socráticas/"Meu ritmo" (claras).

> Se o Malho, ao ver ao vivo, achar que a animação da main agrega sem custo, pode reintroduzir SÓ o `animate-in` sobre a base ENG, registrando. O núcleo (z-[9999] + fundo sólido inline) fica.

---

## 4. Conflito 3 — `analytics/students/[studentId]/page.tsx` (**LGPD, CRÍTICO — PENDENTE DE CONFIRMAÇÃO DO HUGO**)

Não são "2 hunks pequenos": o ENG é uma **reescrita** da página (server-side aggregation + `StudentFullProfile` + gate LGPD + gamification/assessments), enquanto a MAIN delega a `StudentProfileTabs` e NÃO tem gate de verbatim server-side aqui. Extraí os **dois lados em cada eixo de segurança**:

### Eixo A — Lista de roles que ABREM a página
- **MAIN:** `["manager","admin","super_admin"].includes(profile.role)` (role singular).
- **ENG:** `["leader","manager","admin","instructor","super_admin"].includes(profile.role)` — **adiciona leader + instructor** (ainda no `profile.role` singular).

### Eixo B — Gate `canSeeRawContent` (quem vê o texto VERBATIM do aluno: mensagens de chat + texto de reflexão `response`/`aiResponse`)
- **MAIN:** **NÃO existe** esse gate neste arquivo. A main monta `StudentAnalyticsResponse` e entrega `studentId` a `StudentProfileTabs` (o verbatim é resolvido na camada de tabs/API, fora deste arquivo).
- **ENG:** `const canSeeRawContent = roles.includes("instructor") || roles.includes("admin") || roles.includes("super_admin")` — calculado sobre a **UNIÃO de chapéus (`roles`)**, não o `profile.role` singular. Efeito:
  - `messages: canSeeRawContent ? (messagesBySession.get(s.id) ?? []) : []` (chat verbatim gated);
  - `chapterReflections: !canSeeRawContent ? [] : [...]` (texto de reflexão gated);
  - **leader/manager recebem `moduleInsights`** (contagens agregadas: progresso, nº sessões/reflexões, avgDepth, último acesso), **nunca o texto**.

### Eixo C — Resolução de tenant do super_admin + cliente de banco
- **MAIN:** resolve `tenantId = profile.tenant_id ?? resolveTenantId(null)`; usa service client **só para super_admin** (`profile.role === "super_admin" ? createServiceClient() : supabase`), senão o cliente RLS-bound.
- **ENG:** **preserva** a mesma resolução de tenant (`tenantId = profile.tenant_id ?? resolveTenantId(null)`; redirect se null); porém usa **service client para TODOS** (`const db = createServiceClient()`). Compensa com **`.eq("tenant_id", tenantId)` em TODAS as queries** (users, sessions, slide_reflections, enrollments) e escopo transitivo em messages (via `sessionIds` já tenant-scoped). `user_gamification`/`user_areas` usam `.eq("user_id", studentId)`, com `studentId` já confirmado in-tenant pelo guard (ver Eixo D).

### Eixo D — `.single()` vs `.maybeSingle()`
- **MAIN:** `.single()` no fetch do aluno (e de `learner_profiles`) — retorna ERRO em 0 linhas.
- **ENG:** `.maybeSingle()` — retorna `null` sem erro em 0 linhas, **com guard explícito `if (!student) return redirect("/analytics")` (linha 56)**. Como o fetch é `.eq("id", studentId).eq("tenant_id", tenantId)`, um aluno de OUTRO tenant → 0 linhas → null → redirect. **Sem vazamento cross-tenant, sem crash.** (Verificado read-only.)

### RECOMENDAÇÃO (marcada **PENDENTE-DE-CONFIRMAÇÃO-DO-HUGO**)

**Tomar o lado ENG deste arquivo**, porque:
1. É o único que carrega o **gate LGPD deliberado** ("fix-manager-privacy-gates, Correção 1"): verbatim restrito a instructor/admin/super_admin, sobre a UNIÃO de chapéus (semântica multi-hat correta, um manager+instructor mantém o acesso de instructor). É **mais restritivo** no verbatim do que a main neste arquivo.
2. A expansão de ACESSO à página (leader/manager/instructor) é **segura** porque o verbatim é gated à parte, leader/manager veem só agregados (`moduleInsights`).
3. Resolução de tenant do super_admin **preservada**; service-client-para-todos é **manualmente tenant-scoped** em toda query (não vaza cross-tenant).
4. `.maybeSingle()` + guard `if (!student)` é mais seguro que `.single()` para o caso "aluno de outro tenant" (null limpo → redirect, sem erro).

### POR QUE O HUGO PRECISA CONFIRMAR ANTES DE APLICAR (é POLÍTICA, não código)

A mudança de comportamento que só o Hugo pode ratificar:
1. **leader e manager passam a ABRIR a página de detalhe do aluno** (antes só manager/admin/super_admin), vendo **agregados, nunca verbatim**. Confirmar que isto é o desejado.
2. **"Quem vê verbatim" = instructor + admin + super_admin** (união de chapéus). Confirmar que **manager e leader NUNCA devem ver** o texto literal de chat/reflexão do aluno. Se a política do Hugo for outra (ex.: manager também vê verbatim, OU leader nem deve abrir a página), o gate muda.

### O QUE A LUPA VERIFICA (antes de considerar resolvido, após o GO)
- (a) **Guard presente:** `if (!student) return redirect(...)` existe após o `.maybeSingle()` (confirmado read-only na linha 56; re-confirmar pós-merge).
- (b) **LGPD real:** um usuário **manager puro (sem chapéu instructor)** recebe `messages: []` e `chapterReflections: []` (zero verbatim) e o `StudentFullProfile` renderiza o ramo agregado; um **instructor/admin/super_admin** recebe o verbatim. Provar os dois caminhos.
- (c) **Isolamento de tenant:** TODA query usa `.eq("tenant_id", tenantId)` (ou escopo transitivo por `sessionIds`); nenhum caminho lê cross-tenant sob o service client.
- (d) **Nota (fail-closed):** o gate de ACESSO (linha 17) usa `profile.role` singular, enquanto `canSeeRawContent` usa a união `roles`. Um usuário com `profile.role="student"` mas chapéu instructor seria **bloqueado** no acesso (fail-closed, não vaza). Registrar como aceitável; se o Hugo quiser que o acesso também use a união, é ajuste posterior.

---

## 5. Ordem de execução (Malho executa, Lupa verifica)

1. **Malho:** `git checkout -b integration/eng-to-main main` (branch de integração a partir da main; NÃO na main). `git merge feat/engagement-center-v2` → 3 conflitos.
2. Resolver **Conflito 1** (module-gate) a favor do **ENG (bugfix)**.
3. Resolver **Conflito 2** (question-chooser) a favor do **ENG**, **registrando o porquê** (§3) no commit de resolução.
4. **PARAR no Conflito 3 (LGPD).** NÃO aplicar. **Trazer ao Maestro** (o Maestro leva ao Hugo) os 2 lados de cada eixo + a recomendação (este §4). Aguardar GO.
5. **Após o GO do Hugo:** aplicar a resolução confirmada do LGPD (default recomendado = ENG), rodar **build de produção verde** na branch de integração (`pnpm --filter web build`), e a **Lupa verifica** (§4 checklist (a)-(d) + os 2 triviais corretos + build verde).
6. **ZERO push.** Reportar pronto; @devops retoma o deploy com o GO.

## 6. Critério de saída deste plano (auto-checagem)

- [x] Os 3 conflitos cobertos com os 2 lados extraídos (read-only, main intacta).
- [x] Conflito 1: resolução = ENG (bugfix), verificável.
- [x] Conflito 2: recomendação = ENG, com justificativa a registrar.
- [x] Conflito 3 (LGPD): 4 eixos (roles de acesso, `canSeeRawContent`, tenant/super_admin, `.single` vs `.maybeSingle`) com os 2 lados + recomendação (ENG) **marcada PENDENTE-DE-CONFIRMAÇÃO-DO-HUGO** + as perguntas exatas que o Hugo ratifica + o checklist da Lupa.
- [x] Guardrails: branch de integração off-main, zero push, abort+restore, main definitiva intocada.

**Path:** `/Users/hugocapitelli/Dev/eximia/eximia-academy-v2/docs/stories/epic-student-home/06-merge-conflict-main-plan.md`
