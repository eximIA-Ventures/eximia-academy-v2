# SH-F.6: Resolução do conflito de merge `engagement-center-v2 → main` (pré-requisito do deploy prod Argos)

**Epic:** [EPIC-STUDENT-HOME-FINALIZACAO](./EPIC-STUDENT-HOME-FINALIZACAO.md)
**Status:** Draft
**Insumo obrigatório:** **`06-merge-conflict-main-plan.md` (plano-fonte, ler inteiro)**. Constitution Art. IV, nada fora do plano.
**Executores:** **Malho** (resolve os conflitos) + **Lupa** (verifica). Malho não é @devops, NÃO pusha.
**Depende de:** o trabalho de finalização já mesclado em `feat/engagement-center-v2` (tip `e94c47c`). Pré-requisito do deploy de produção do Argos (ordem do Hugo).
**Bloqueia:** o deploy de prod, que é retomado pelo @devops (Gage) DEPOIS desta story e com o GO do Hugo.
**Paralelizável:** NÃO (é resolução de merge sobre uma branch de integração única).
**⚠ GATE de produto:** o **Conflito 3 (LGPD)** é **PENDENTE-DE-CONFIRMAÇÃO-DO-HUGO**. Só entra após GO explícito. Malho resolve os 2 triviais, PARA no conflito 3 e flaga. Ver §Gate LGPD.

---

## Story

**As a** responsável por destravar o deploy de produção do Argos,
**I want** resolver, numa branch de integração criada a partir da main (nunca na main direto), os 3 conflitos de `git merge feat/engagement-center-v2 → main`, aplicando os 2 triviais e PARANDO no conflito LGPD crítico até o Hugo ratificar a política,
**so that** o merge fique pronto e verificado (build de produção verde + checklist LGPD da Lupa), sem push, sem tocar a main definitiva, entregando ao @devops uma base limpa para o deploy quando houver GO.

## Contexto (Dev Notes)

Estado verificado read-only (nada mesclado, main intacta):

- `main` tip: **`52a54f5`** (`fix: question chooser async/await + error handling + solid backdrop`).
- `feat/engagement-center-v2` tip: **`e94c47c`**.
- merge-base: **`ab5e7ca`**.
- A **main DIVERGIU** com feature-work próprio (não está só "atrás"). `eng → main` dá **3 conflitos**, confirmados por `git merge-tree` sem tocar working tree:
  1. `apps/web/src/components/module-gate.tsx` (TRIVIAL, bugfix).
  2. `apps/web/src/app/(platform)/courses/[courseId]/chapters/[chapterId]/_components/question-chooser-sheet.tsx` (UI, decisão visual).
  3. `apps/web/src/app/(platform)/analytics/students/[studentId]/page.tsx` (**LGPD, CRÍTICO**, é uma REESCRITA da página, não 2 hunks).

Os 3 arquivos existem no working tree; os 3 SHAs acima foram reconferidos por este @sm.

## GUARDRAILS (não-negociáveis, plano §1)

- **Branch de integração OFF-MAIN.** Malho cria `integration/eng-to-main` **a partir da main** (`git checkout -b integration/eng-to-main main`), NUNCA trabalha na main direto. Main permanece em `52a54f5`.
- **ZERO push.** Deploy é autoridade EXCLUSIVA do @devops (Gage), que retoma depois, com o GO. Malho é BLOQUEADO de `git push`/PR/deploy (`agent-authority.md`).
- **NÃO** tocar em deploy/cory nem na main definitiva.
- **Se sujar:** `git merge --abort` / `git reset --hard` e restaurar; main permanece em `52a54f5`.
- **Conflito 3 (LGPD) NÃO é aplicado sem confirmação explícita do Hugo.** Malho resolve os 2 triviais, PARA no LGPD e flaga.

## Resolução por conflito

### Conflito 1 — `module-gate.tsx` (TRIVIAL → ENG/bugfix)

1 hunk, `href` do botão "Entrar em contato" (mailto):
- **MAIN (BUG):** `href="mailto:...${encodeURIComponent(moduleName)}"` com **aspas duplas**, o `${...}` NÃO interpola, vai literal.
- **ENG (BUGFIX):** `` href={`mailto:...${encodeURIComponent(moduleName)}`} `` **template literal** em chaves, interpola o nome do módulo.

**Resolução: lado ENG (bugfix).** Verificação: o `href` renderizado contém o nome do módulo interpolado, não `${...}` literal.

### Conflito 2 — `question-chooser-sheet.tsx` (UI → ENG, com registro do porquê)

2 hunks (paleta dos badges + z-index/backdrop/tema do modal). **Resolução: lado ENG**, e **Malho REGISTRA o porquê no commit de resolução** (plano §3):
1. `z-[9999]` garante que o modal nunca seja ocluído; `z-[60]` da main é frágil.
2. Fundo branco inline (`style={{backgroundColor:'#ffffff'}}`) segue o padrão de **imunidade CSS-stale** já adotado nos cards "Meu ritmo" (cor crítica viaja no HTML, não some sob CSS defasado/Docker layer).
3. O ENG **cumpre a intenção da tip da main** ("solid backdrop") de forma mais completa (backdrop opaco + fundo sólido garantido), então tomar ENG **subsume** o fix da main, não regride.
4. Paleta light (stone/orange) é consistente com as superfícies socráticas/"Meu ritmo".

> Se, ao ver ao vivo, Malho achar que a animação `animate-in` da main agrega sem custo, pode reintroduzir SÓ o `animate-in` sobre a base ENG, registrando. O núcleo (`z-[9999]` + fundo sólido inline) fica.

### Conflito 3 — `analytics/students/[studentId]/page.tsx` (LGPD, CRÍTICO, **GATED**)

Não são 2 hunks: o ENG é uma **reescrita** (aggregation server-side + `StudentFullProfile` + gate LGPD de verbatim). **Recomendação do plano = lado ENG, MARCADA PENDENTE-DE-CONFIRMAÇÃO-DO-HUGO.** Os 4 eixos com os 2 lados (plano §4):

| Eixo | MAIN (`52a54f5`) | ENG (`e94c47c`) |
|:--|:--|:--|
| A, roles que ABREM a página | `["manager","admin","super_admin"]` (role singular) | `["leader","manager","admin","instructor","super_admin"]` (adiciona leader + instructor) |
| B, `canSeeRawContent` (quem vê VERBATIM: chat + texto de reflexão) | **não existe** neste arquivo (verbatim resolvido na camada de tabs/API) | `instructor \|\| admin \|\| super_admin` sobre a **UNIÃO de chapéus (`roles`)**; leader/manager recebem só `moduleInsights` (agregados), nunca o texto |
| C, tenant do super_admin + cliente de banco | service client só p/ super_admin, senão RLS-bound | service client p/ TODOS, compensado com `.eq("tenant_id", tenantId)` em TODA query + escopo transitivo em messages |
| D, `.single()` vs `.maybeSingle()` | `.single()` (erro em 0 linhas) | `.maybeSingle()` + guard `if (!student) return redirect("/analytics")` (aluno de outro tenant → 0 linhas → null → redirect, sem vazamento, sem crash) |

**Malho PARA aqui.** Traz ao Maestro (que leva ao Hugo) os 2 lados de cada eixo + a recomendação (ENG). NÃO aplica sem GO.

## Gate LGPD, é POLÍTICA que só o Hugo ratifica (flag BLOQUEANTE ao Contrato/@po)

A mudança de comportamento que exige ratificação do Hugo ANTES de aplicar o Conflito 3:
1. **leader e manager passam a ABRIR a página de detalhe do aluno** (antes só manager/admin/super_admin), vendo **agregados, nunca verbatim**. Confirmar que é o desejado.
2. **"Quem vê verbatim" = instructor + admin + super_admin** (união de chapéus). Confirmar que **manager e leader NUNCA devem ver** o texto literal de chat/reflexão do aluno. Se a política do Hugo for outra (manager também vê verbatim, OU leader nem deve abrir), o gate muda.

Sem GO do Hugo, o Conflito 3 fica em aberto e a story não pode ser considerada resolvida.

## Acceptance Criteria

- [ ] **AC1 (branch off-main, main intacta):** existe `integration/eng-to-main` criada a partir da main; a main permanece em `52a54f5` durante e após a story. Prova: `git rev-parse --short main` == `52a54f5`.
- [ ] **AC2 (conflito 1 → ENG/bugfix):** `module-gate.tsx` resolvido a favor do ENG. O `href` do mailto usa template literal interpolado (nome do módulo aparece), sem `${...}` literal.
- [ ] **AC3 (conflito 2 → ENG, com registro):** `question-chooser-sheet.tsx` resolvido a favor do ENG (`z-[9999]` + fundo branco inline). A mensagem do commit de resolução REGISTRA o porquê (imunidade CSS-stale + subsome o "solid backdrop" da main).
- [ ] **AC4 (conflito 3 GATED, não aplicado sem GO):** Malho NÃO resolve nem aplica o Conflito 3 antes do GO do Hugo. Ele PARA, entrega os 4 eixos + a recomendação ao Maestro e aguarda. Enquanto não houver GO, o LGPD fica em aberto.
- [ ] **AC5 (pós-GO, resolução LGPD confirmada):** somente após GO do Hugo, o Conflito 3 é resolvido para o lado confirmado (default recomendado = ENG) e o checklist da Lupa (abaixo) passa.
- [ ] **AC6 (build de produção verde):** na branch de integração (com os 2 triviais e o LGPD já resolvido pós-GO), `pnpm --filter @eximia/web build` termina VERDE.
- [ ] **AC7 (zero push, sem tocar prod):** nenhum `git push`, nenhum PR, nada tocado em main definitiva/deploy/cory. Se algo sujar, `git merge --abort`/`git reset --hard` e main volta a `52a54f5`.

### Checklist da Lupa (4 eixos LGPD, plano §4 (a)-(d), verificado no MERGED tree pós-GO)

- [ ] **(a) Guard presente:** `if (!student) return redirect(...)` existe após o `.maybeSingle()` (re-confirmar no tree mesclado, não no pré-merge).
- [ ] **(b) LGPD real, os dois caminhos:** um **manager puro (sem chapéu instructor)** recebe `messages: []` e `chapterReflections: []` (zero verbatim) e o `StudentFullProfile` renderiza o ramo agregado; um **instructor/admin/super_admin** recebe o verbatim. Provar ambos.
- [ ] **(c) Isolamento de tenant:** TODA query usa `.eq("tenant_id", tenantId)` (ou escopo transitivo por `sessionIds`); nenhum caminho lê cross-tenant sob o service client.
- [ ] **(d) Fail-closed registrado:** o gate de ACESSO usa `profile.role` singular, enquanto `canSeeRawContent` usa a união `roles`. Um `profile.role="student"` com chapéu instructor é **bloqueado no acesso** (fail-closed, não vaza). Registrar como aceitável; se o Hugo quiser acesso também pela união, é ajuste posterior (nova story).

## Tasks

- [ ] 1. **Malho:** `git checkout -b integration/eng-to-main main`; `git merge feat/engagement-center-v2` → 3 conflitos.
- [ ] 2. **Malho:** resolver Conflito 1 (`module-gate.tsx`) a favor do ENG (bugfix). Verificar interpolação do `href`.
- [ ] 3. **Malho:** resolver Conflito 2 (`question-chooser-sheet.tsx`) a favor do ENG, **registrando o porquê** na mensagem do commit de resolução.
- [ ] 4. **Malho:** PARAR no Conflito 3 (LGPD). NÃO aplicar. Entregar ao Maestro os 4 eixos + recomendação (ENG). Aguardar GO do Hugo.
- [ ] 5. **(pós-GO) Malho:** aplicar a resolução confirmada do Conflito 3 (default = ENG).
- [ ] 6. **(pós-GO) Malho:** `pnpm --filter @eximia/web build` na branch de integração, confirmar VERDE.
- [ ] 7. **Lupa:** rodar o checklist (a)-(d) no tree mesclado + confirmar os 2 triviais corretos + build verde. Reportar PRONTO.
- [ ] 8. **ZERO push.** Reportar pronto ao Maestro; o @devops retoma o deploy com o GO.

## Complexidade & Riscos

- **Complexidade:** M (medium). Dois conflitos triviais + um crítico que é gate de política, não de código. O risco é de governança (não pushar, não tocar main, não aplicar LGPD sem GO), não de dificuldade técnica.
- **Riscos:**
  - R1 (ALTO se violado): aplicar o LGPD sem GO do Hugo muda quem vê verbatim de aluno (política de privacidade). Mitigação: AC4 + gate explícito, Malho PARA no Conflito 3.
  - R2 (ALTO se violado): push acidental ou trabalho na main. Mitigação: branch off-main (AC1) + zero-push (AC7) + @devops é o único que pusha.
  - R3 (médio): resolução textual do LGPD (reescrita) introduzir regressão de isolamento de tenant. Mitigação: checklist da Lupa (c) sobre o tree mesclado.
  - R4 (baixo): tomar ENG no Conflito 2 regredir o "solid backdrop" da main. Mitigação: análise do plano §3 (ENG subsume a intenção da main); registro no commit.

## Dev Notes

- **Natureza: RESOLUÇÃO DE MERGE (ops), não feature.** Não adiciona funcionalidade; concilia duas linhas divergentes. O Conflito 3 muda comportamento de privacidade (verbatim/acesso), por isso é gated ao Hugo.
- **Fase e limites:** trabalho acontece SÓ na branch `integration/eng-to-main`. Nenhuma outra story do epic é tocada. A main definitiva não é alterada por esta story em hipótese alguma.
- **Verificação no tree MESCLADO, não no pré-merge:** as line numbers e o conteúdo final dos 3 arquivos após o merge é o que a Lupa verifica; SHAs/linhas das branches individuais são referência de origem, não o alvo da checagem final.
- **Filtro pnpm real = `@eximia/web`** (o plano §5 escreve `pnpm --filter web build`; o filtro correto do repo é `@eximia/web`, reconfirmado pelo @sm).
- **Divisão de papéis:** Malho resolve e commita na branch de integração (pode `git add`/`git commit` local, `agent-authority.md` @dev); Lupa só lê e verifica (`agent-authority.md` @qa). Nenhum dos dois pusha.

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
git rev-parse --short main                         # AC1: deve permanecer 52a54f5
git checkout -b integration/eng-to-main main       # AC1: branch off-main
git merge feat/engagement-center-v2                 # 3 conflitos esperados
# ... Malho resolve conflitos 1 e 2 (ENG); PARA no 3 (LGPD) e aguarda GO ...
# (pós-GO do Hugo) resolver conflito 3 e então:
pnpm --filter @eximia/web build                     # AC6: build de produção VERDE
git log --oneline -3                                # AC3: commit de resolução registra o porquê do conflito 2
# Lupa (read-only) confirma no tree mesclado:
grep -n "if (!student)\|canSeeRawContent\|maybeSingle\|tenant_id" "apps/web/src/app/(platform)/analytics/students/[studentId]/page.tsx"
# ZERO push em qualquer momento.
```

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-13 | Story criada a partir de `06-merge-conflict-main-plan.md` (fold no epic §5 dec.6/§7/§8/§10). SHAs reconferidos read-only (main `52a54f5`, eng `e94c47c`, base `ab5e7ca`) e os 3 arquivos em conflito confirmados. Conflitos 1 (module-gate→ENG bugfix) e 2 (question-chooser→ENG, com registro) resolvíveis; Conflito 3 (LGPD, reescrita) GATED, PENDENTE-DE-CONFIRMAÇÃO-DO-HUGO, com os 4 eixos + checklist da Lupa. Guardrails duros (branch off-main, zero push, abort+restore, deploy é do @devops). Filtro pnpm real `@eximia/web`. | Roteiro (@sm) |
| 2026-07-13 | Validação PO: SHAs + 3 conflitos + 4 eixos LGPD reconfirmados read-only (sem sujar árvore). Achado material: assimetria de chapéus (acesso=singular, verbatim=união) exige AFIAR a pergunta ao Hugo. Veredito GO com C3 GATED. | Contrato (@po) |

---

## PO Validation & Critérios Fortalecidos (@po)

> **Veredito: GO (9,0/10), com o Conflito 3 EXPLICITAMENTE GATED.** Story de governança, o risco é de política/privacidade e de disciplina git, não de dificuldade técnica. Reconfirmei tudo READ-ONLY (sem `checkout`, sem `merge`, árvore intocada). O fortalecimento central é AFIAR a pergunta LGPD ao Hugo: a formulação "manager NUNCA vê verbatim" é imprecisa e, se aplicada ao pé da letra, contradiria o código ENG.

### Fatos reconfirmados pelo @po, READ-ONLY (repo `eximia-academy-v2`, 2026-07-13)

Método: `git rev-parse`, `git merge-tree --write-tree` e `git show <ref>:<path>`, todos read-only. Nenhum merge aplicado, `main` permanece `52a54f5`, working tree não sujado por esta validação.

- **SHAs batem:** main `52a54f5`, eng `e94c47c`, merge-base `ab5e7ca`. Branch atual = `main` (limpo).
- **`git merge-tree` confirma EXATAMENTE 3 conflitos de conteúdo:** `module-gate.tsx`, `question-chooser-sheet.tsx`, `analytics/students/[studentId]/page.tsx`. (Vários outros arquivos auto-merge sem conflito, esperado.)
- **C1 (mailto):** MAIN linha 58 usa **aspas duplas** (`"...${...}"`, literal, BUG); ENG linha 58 usa **template literal** (`` `...${...}` `` em chaves, interpola). ENG = bugfix, confirmado.
- **Os 4 eixos LGPD do lado ENG, confirmados linha a linha:**
  - **A (acesso):** ENG:16 `["leader","manager","admin","instructor","super_admin"].includes(profile.role)`; MAIN:16 `["manager","admin","super_admin"]`. ENG adiciona leader+instructor.
  - **B (verbatim):** ENG:25-26 `canSeeRawContent = roles.includes("instructor")||roles.includes("admin")||roles.includes("super_admin")` sobre a **UNIÃO `roles`** (comentário :23 confirma multi-hat); ENG:276 `messages: canSeeRawContent ? ... : []`; ENG:286 `chapterReflections: !canSeeRawContent ? [] : [...]`. MAIN não tem esse gate (delega a `StudentProfileTabs`).
  - **C (tenant):** ENG:36 `createServiceClient()` para todos; `.eq("tenant_id", tenantId)` em :44/:52/:74/:82; `user_gamification` por `user_id` :95 (studentId já confirmado in-tenant pelo guard D).
  - **D (single vs maybeSingle):** ENG:45 `.maybeSingle()` + ENG:56 `if (!student) return redirect("/analytics")`; MAIN:38/:44 `.single()`.

### O AFIAMENTO da pergunta ao Hugo (o ponto que o @po não deixa passar)

A §Gate LGPD pergunta se "manager e leader NUNCA devem ver verbatim". **Isso é impreciso e o código ENG NÃO se comporta assim ao pé da letra**, por causa da assimetria de chapéus:

- **Acesso** usa `profile.role` SINGULAR (ENG:16). **Verbatim** usa a UNIÃO `roles` (ENG:26).
- Logo, um **manager PURO** (só `profile.role="manager"`, sem outro chapéu) → abre a página, `canSeeRawContent=false` → vê só agregados. ✅ bate com a intenção.
- Mas um **manager que TAMBÉM tem chapéu instructor** (`roles` inclui "instructor") → abre a página E `canSeeRawContent=true` → **VÊ verbatim**. Isto é a semântica multi-hat deliberada ("um manager+instructor mantém o acesso de instructor", comentário ENG:23).

**Portanto a pergunta correta ao Hugo tem duas partes, não uma:**
1. leader + manager passam a ABRIR a página (agregados). Desejado? (sim/não)
2. Verbatim = instructor OR admin OR super_admin sobre a **UNIÃO de chapéus**. Consequência: manager/leader PUROS nunca veem verbatim, **mas um manager que também detém chapéu instructor VÊ** (multi-hat). Essa semântica multi-hat é a desejada, OU o verbatim deve ser negado a QUALQUER um cujo papel primário seja manager/leader (ignorando chapéu secundário)? **Se for a segunda, o gate ENG está errado e precisa mudar** (usar `profile.role` no verbatim, não a união).

Sem essa distinção, o Hugo ratificaria "manager nunca vê verbatim" e o código entregaria o oposto para o caso multi-hat. O @po exige que a pergunta ao Maestro/Hugo leve as DUAS partes.

### Assimetria fail-closed (Eixo D), ratificada como aceitável

Acesso usa singular, verbatim usa união. O reverso do multi-hat: um `profile.role="student"` COM chapéu instructor é **bloqueado no acesso** (ENG:16 checa singular, "student" não está na lista → redirect), então nunca chega ao verbatim. **Fail-closed = seguro.** Ratifico como aceitável; se o Hugo quiser acesso também pela união, é ajuste posterior (nova story). Vira item (d) do checklist da Lupa.

### Given/When/Then (guardrails como gates)

- **AC1 (main intocada):** *Given/When/Then* em qualquer momento `git rev-parse --short main == 52a54f5`. Trabalho SÓ em `integration/eng-to-main` criada de main. Nota de higiene: há `.codex-*-msg.txt` untracked no repo, Malho NÃO deve `git add .` cego (não commitar lixo de scratch).
- **AC4 (C3 GATED, o gate mais importante):** *Given* os 2 triviais resolvidos; *When* Malho chega ao C3; *Then* ele PARA, NÃO resolve, entrega os 4 eixos + as DUAS perguntas afiadas (acima) ao Maestro, e aguarda GO. Enquanto não houver GO, a story não é "resolvida".
- **AC6 (build verde, só pós-GO):** o build só roda com sentido DEPOIS do C3 resolvido (pré-C3 há marcadores de conflito). *Then* `pnpm --filter @eximia/web build` VERDE na branch de integração.
- **AC7 (zero push):** nenhum `git push`/PR/deploy. Deploy é EXCLUSIVO do @devops (Gage). Se sujar: `git merge --abort`/`git reset --hard`, main volta a `52a54f5`.

### Checklist da Lupa, agora verificável no MERGED tree (grep concreto)

Após o GO e o merge resolvido, rodar no tree mesclado (não nas branches de origem):

```bash
F="apps/web/src/app/(platform)/analytics/students/[studentId]/page.tsx"
grep -nE "if \(!student\).*redirect" "$F"                    # (a) guard após maybeSingle
grep -nE "canSeeRawContent|messages: canSeeRawContent|chapterReflections" "$F"  # (b) verbatim gated
grep -nE "\.eq\(\"tenant_id\", tenantId\)" "$F"              # (c) isolamento de tenant em toda query
grep -nE "\.includes\(profile\.role\)|roles\.includes" "$F"  # (d) acesso=singular, verbatim=união (fail-closed)
```
- **(b) prova os DOIS caminhos:** um teste/execução com **manager puro** → `messages: []` e `chapterReflections: []` (ramo agregado); um **instructor/admin/super_admin** (ou manager+instructor) → verbatim presente. A prova do manager+instructor é o que amarra a semântica multi-hat que o Hugo ratificou.

### Comandos de Verificação (exatos)

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
git rev-parse --short main                          # AC1: 52a54f5 sempre
git merge-tree --write-tree --name-only main feat/engagement-center-v2   # read-only: confirma os 3 conflitos ANTES de tocar
git checkout -b integration/eng-to-main main        # AC1: branch off-main
git merge feat/engagement-center-v2                 # 3 conflitos
# Malho: C1 e C2 → ENG; PARA no C3, entrega 4 eixos + 2 perguntas afiadas, aguarda GO
# (pós-GO) resolve C3 (default ENG) e:
pnpm --filter @eximia/web build                     # AC6: build de produção VERDE
git log --oneline -3                                # AC3: commit do C2 registra o porquê (imunidade CSS-stale + subsume)
# Lupa roda o checklist (a)-(d) no tree MESCLADO. ZERO push em qualquer momento.
```

### Critério de PRONTO (a Lupa usa, com poder de veto)

`main` intocada em `52a54f5`; branch `integration/eng-to-main` off-main; C1→ENG (mailto interpolado); C2→ENG (`z-[9999]`+fundo inline) com o porquê no commit; **C3 só resolvido APÓS GO do Hugo às DUAS perguntas afiadas** (default ENG); checklist (a)-(d) verde no tree mesclado, incluindo a prova dos dois caminhos de verbatim (manager puro=[], instructor=verbatim); `pnpm --filter @eximia/web build` verde; nenhum `.codex-*` ou lixo commitado; ZERO push. Deploy retomado pelo @devops com o GO.

### Placar 10 pontos PO

1. Objetivo/contexto: 1 · 2. ACs testáveis: 1 · 3. Precisão técnica (SHAs + 4 eixos read-only): 1 · 4. Rastreabilidade (plano §2-§4): 1 · 5. Autossuficiência: 1 · 6. Dependências/ordem (off-main, eng tip): 1 · 7. Escopo (só branch integração): 1 · 8. Teste runnable (build + grep no tree mesclado): 1 · 9. Riscos+mitigação (pergunta LGPD afiada + fail-closed ratificado): 0,5 · 10. Governança/gate (C3 gated, zero push, main intocada): 0,5. **Total: 9,0 → GO** (C3 permanece GATED até o GO do Hugo às duas perguntas afiadas).
