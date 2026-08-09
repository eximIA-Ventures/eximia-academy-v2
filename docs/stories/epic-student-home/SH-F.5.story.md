# SH-F.5: Engajamento do topo vira fração "X de N" (N = máximo da trilha)

**Epic:** [EPIC-STUDENT-HOME-FINALIZACAO](./EPIC-STUDENT-HOME-FINALIZACAO.md)
**Status:** Draft
**Insumo obrigatório:** `03-finalizacao-plan.md` (contexto) + **`05-engajamento-fracao-plan.md` (plano-fonte desta story, ler inteiro)**. Constitution Art. IV, nada fora do plano.
**Depende de:** SH-F.3 (cache org). Ambas editam `computeStudentComparison`, regiões distintas; SH-F.3 **já aterrissou na branch** (HEAD `c25f779`, `area-gestor.ts` já usa `orgRef.*`), então esta fatia rebaseia por cima. Ver flag de ordem de merge (c).
**Bloqueia:** nada.
**Paralelizável:** Par D (epic §7). Independente de SH-F.1/F.2/F.4 em arquivos; a única sobreposição é `computeStudentComparison` com SH-F.3 (região do ALUNO, fresca, vs região ORG cacheada de F.3).
**Base:** branch `feat/SH-1.4-student-home-card`, no PR #1 → `engagement-center-v2`. Esta fatia entra na MESMA branch (o PR se atualiza).
**⚠ 3 flags BLOQUEANTES para o Contrato/@po (epic §8):** (a) assunção capítulo→1 interação no teto N; (b) fração na Média NÃO se implementa sem GO do Hugo; (c) ordem de merge com SH-F.3. Ver Dev Notes.

---

## Story

**As a** aluno olhando a coluna Engajamento da home "Meu ritmo",
**I want** que o número grande do topo da minha linha ("Você") deixe de ser um absoluto solto (ex.: `14`) e passe a ser uma fração `X de N`, onde N é o máximo de engajamento possível na minha própria trilha,
**so that** o número ganhe contexto (o quão perto estou do teto), sem mudar a sublinha absoluta, sem mudar quem vence a comparação, e sem cachear nenhum dado individual meu.

## Contexto (Dev Notes)

Verificado na worktree `/Users/hugocapitelli/Dev/eximia/sh-1.4-worktree` (HEAD `c25f779`):

- **Fórmula do engajamento (intocada):** `apps/web/src/lib/analytics/student-home-indicators.ts:134` → `engagementOf(id) = interactionsOf(id) * 2 + reflectionsOf(id)`, com `interactionsOf = completedByStudent` (sessões concluídas, :132) e `reflectionsOf = reflectionsByStudent` (contagem de `slide_reflections`, :133). `subject.engagement = engagementOf(studentId)` (:147). `buildStudentHomeIndicators` começa em `:52`.
- **Render:** `apps/web/src/components/analytics/comparison-insights-table.tsx`, `buildColumns` (:77), coluna `engagement` (:110-118):
  - `subjectValue: s.engagement` (:113), `referenceValue: r.engagementAvg` (:114) → alimentam `winnerOf` (:41, chamada em :196), `direction: "higher"`.
  - `subjectNode: String(s.engagement)` (:115), `referenceNode: String(r.engagementAvg)` (:116).
  - `subjectSub: \`${s.interactions} interações · ${s.reflections} reflexões\`` (:118). **Esta é a sublinha absoluta que fica INTOCADA.**
- **Tipos:** `types/analytics.ts` → `StudentHomeSubject` (:611, campo `engagement` :619), `StudentHomeReference` (:627, `engagementAvg` :639), `StudentHomeIndicators` (:646-648).
- **Bloco do ALUNO em `computeStudentComparison`** (`lib/analytics/area-gestor.ts`, ~1218-1250): o "own metric block" é computado FRESCO por request (`student_id = auth`), **NUNCA cacheado** (o próprio comentário do código afirma isso). `buildStudentHomeIndicators` é chamado em `:1263` recebendo o lado org de `orgRef.*` (referência cacheada por SH-F.3). É neste ponto que `engagementMax` deve ser derivado (lado do aluno, fresco) e passado adiante.
- **Heurística de "slide com reflexão possível" JÁ EXISTE, reusar, não reinventar:** `isReflectionBlock(text)` (`apps/web/src/app/api/analytics/aggregate/route.ts:105`) e `countReflectionBlocks(textContent)` (`:120`), que contam blockquotes de prompt de reflexão no `chapter_slides.text_content` (comentário `:104`: "Replicates presentation-viewer.tsx isReflectionBlock() heuristic SERVER-SIDE"). São hoje **funções privadas dentro do route file** (ver flag I1).
- **Mock do preview:** `apps/web/src/app/dev/preview-desempenho/page.tsx`, const `INDICATORS` (:8), `subject.engagement = 14` (:13), `reference.engagementAvg = 9` (:21).

### Definição do denominador N (lado do Você), plano §2.1

`N_você = (capítulos da trilha do aluno × 2) + (slides com reflexão possível na trilha do aluno)`

Casa 1:1 com `interações×2 + reflexões`, tratando N como teto: cada capítulo dá no máximo 1 interação concluída (×2), cada slide-com-reflexão dá no máximo 1 reflexão.

- **Capítulos da trilha:** cursos em que o aluno está matriculado (status `active`/`completed`), não-arquivados: filtrar `orgEnrollmentRows` a `studentId` ∩ `activeCourseIds`; contar os `chapterRows` cujo `course_id` está nesse conjunto. **Sem scan novo** (dados de capítulo já carregados; ver flag I2 sobre acessá-los pós-cache de F.3).
- **Slides com reflexão possível na trilha:** contar slides-de-reflexão dos capítulos da trilha, **reusando `isReflectionBlock`/`countReflectionBlocks`** sobre `chapter_slides.text_content`. **1 scan NOVO** de `chapter_slides` (`id, chapter_id, text_content`) escopado aos capítulos da trilha do aluno (pequeno, por-request, lado do ALUNO, FRESCO, **NUNCA cacheado**, não entra no `OrgReference` de SH-F.3).

## Acceptance Criteria

- [ ] **AC1 (campo aditivo opcional):** `StudentHomeSubject` ganha `engagementMax?: number` (OPCIONAL). `StudentHomeReference` NÃO ganha denominador nesta story (Média fica absoluta, ver flag b). Prova: `grep -n "engagementMax" apps/web/src/types/analytics.ts`.
- [ ] **AC2 (derivação de N, lado do aluno fresco):** `computeStudentComparison` deriva a trilha do aluno (capítulos matriculados não-arquivados) e faz **1 scan novo** `chapter_slides.text_content` escopado a esses capítulos, contando slides-de-reflexão com `isReflectionBlock`/`countReflectionBlocks` (reusadas, não reimplementadas), e computa `engagementMax = capítulosTrilha*2 + reflectionPossibleSlides`. O scan é do lado do aluno, fresco, e NÃO entra no `OrgReference` cacheado.
- [ ] **AC3 (propagação aditiva):** `buildStudentHomeIndicators` aceita `engagementMax` como parâmetro aditivo e o expõe em `subject.engagementMax`. `subject.engagement` continua `interactions*2 + reflections` (o numerador não muda). Prova: `grep -n "engagementMax" apps/web/src/lib/analytics/student-home-indicators.ts`.
- [ ] **AC4 (topo do Você = fração):** teste em `comparison-insights-table.test.tsx` provando que, com `subject.engagementMax = N`, o `subjectNode` da coluna engagement renderiza **`"X de N"`** (ex.: "14 de 40"); e que, com `engagementMax` ausente/undefined, renderiza `"X"` (degradação graciosa).
- [ ] **AC5 (sublinha absoluta e INTOCADA):** o mesmo teste assere que `subjectSub` continua `"X interações · Y reflexões"` (absoluto), sem denominador.
- [ ] **AC6 (Média absoluta por default):** `referenceNode` da coluna engagement continua `String(r.engagementAvg)`, SEM denominador. Fração na Média não é implementada nesta story (flag b).
- [ ] **AC7 (winnerOf INALTERADO):** teste provando que o vencedor do engajamento depende só do absoluto: `winnerOf(14, 9, "higher") === "subject"` independe do denominador; um caso com N grande (Você `14 de 200` vs Média `9`) mantém `"subject"`. `subjectValue`/`referenceValue`/`direction` da coluna não mudam.
- [ ] **AC8 (N correto):** teste em `student-home-indicators.test.ts` (ou irmão em area-gestor) provando `engagementMax = capítulosTrilha*2 + reflectionPossibleSlides` para um fixture conhecido (ex.: 3 capítulos + 4 slides-reflexão → `3*2 + 4 = 10`).
- [ ] **AC9 (preview + degradação):** o mock `INDICATORS.subject` em `preview-desempenho/page.tsx` ganha `engagementMax` (ex.: `40` → renderiza "14 de 40"); o reference mock fica intocado. Com o campo removido do mock, a célula volta a "14" sem quebrar.
- [ ] **AC10 (sem regressão):** `pnpm --filter @eximia/web typecheck` limpo; a suíte do módulo (`student-home-indicators.test.ts`, `comparison-insights-table.test.tsx`, `area-gestor.test.ts`) verde. Testes existentes de `comparison-insights-table` seguem verdes (campo opcional → nada quebra).

## Tasks

- [ ] 1. First-move (refactor de leitura sobre `computeStudentComparison`): rodar a suíte do módulo analytics e confirmar VERDE antes de editar (`pnpm --filter @eximia/web test -- student-home-indicators comparison-insights-table area-gestor`).
- [ ] 2. Resolver o reuso da heurística (flag I1): extrair `isReflectionBlock`/`countReflectionBlocks` de `app/api/analytics/aggregate/route.ts` para um módulo compartilhado (ex.: `lib/analytics/reflection-potential.ts`, aditivo) e importá-lo nos dois pontos, OU confirmar com Contrato outro caminho de reuso. NÃO copiar/replicar a heurística.
- [ ] 3. Em `types/analytics.ts`: adicionar `engagementMax?: number` a `StudentHomeSubject` (AC1).
- [ ] 4. Em `computeStudentComparison` (`area-gestor.ts`): derivar a trilha do aluno (capítulos matriculados não-arquivados; garantir acesso aos `chapterRows`/`course_id` pós-cache de F.3, flag I2), fazer o scan novo `chapter_slides.text_content` escopado à trilha, contar slides-reflexão via a heurística reusada, computar `engagementMax` (AC2).
- [ ] 5. Em `student-home-indicators.ts`: `buildStudentHomeIndicators` aceita `engagementMax` (param aditivo) e o expõe em `subject.engagementMax` (AC3).
- [ ] 6. Em `comparison-insights-table.tsx`: `subjectNode = s.engagementMax != null ? \`${s.engagement} de ${s.engagementMax}\` : String(s.engagement)`. NÃO tocar `subjectSub`, `referenceNode`, `subjectValue`, `referenceValue`, `winnerOf` (AC5/AC6/AC7).
- [ ] 7. Atualizar o mock do preview (AC9).
- [ ] 8. Escrever/estender os testes: AC4 (fração + degradação), AC5 (sublinha intocada), AC7 (winnerOf invariante), AC8 (N correto).
- [ ] 9. `pnpm --filter @eximia/web typecheck` + suíte do módulo verde (AC10).

## Complexidade & Riscos

- **Complexidade:** M (medium). Campo aditivo + 1 scan novo escopado + reuso de heurística existente + testes. O grosso do risco é de coordenação (F.3) e de reuso correto, não de lógica.
- **Riscos:**
  - R1 (médio): reinventar a heurística de reflexão em vez de reusar (viola o plano, diverge do resto do repo). Mitigação: flag I1 + Task 2 (extrair e importar, não copiar).
  - R2 (médio): scan novo vazar para o cache org de SH-F.3 (quebra o invariante "aluno nunca cacheado"). Mitigação: AC2 explícito, scan fica no bloco do aluno (fresco), fora do `OrgReference`.
  - R3 (baixo): denominador alterar o vencedor por engano. Mitigação: AC7 + coluna mantém `subjectValue`/`referenceValue` absolutos; denominador entra só no `subjectNode`.
  - R4 (baixo): conflito textual com SH-F.3 em `computeStudentComparison`. Mitigação: F.3 já landou; rebasear e editar a região do aluno (distinta da região org). Flag c.

## Dev Notes

- **Natureza: ADITIVO.** Campo opcional (`engagementMax?`), 1 scan novo do lado do aluno, e render condicional com degradação graciosa (`engagementMax` ausente → "X"). Nenhum consumidor existente quebra (campo opcional). Não é breaking.
- **File-disjunto das demais fatias**, exceto a sobreposição conhecida com SH-F.3 em `computeStudentComparison` (regiões distintas). Não editar `vitest.config.ts` (F.2), `org-reference-cache.ts`/região ORG (F.3), `seed-student-home-demo.ts` (F.4), `student-progress-headline.tsx` (F.1, já removido).

### Flags BLOQUEANTES para o Contrato/@po (epic §8, plano §2.1/§2.2/§3)

- **(a) Assunção de modelagem, capítulo→1 interação concluível no teto N.** N usa `capítulos×2` assumindo no máximo 1 sessão concluída contável por capítulo. Se um capítulo puder gerar >1 sessão concluída contável, o teto de interações muda. Decisão cravada do plano: capítulo→1. A spec deve declarar essa assunção explicitamente.
- **(b) Fração na Média NÃO se implementa sem GO do Hugo.** Default desta story: a linha da Média fica ABSOLUTA (`engagementAvg`, sem denominador), para não inventar um denominador médio heterogêneo (o "confuso" que o Hugo pediu para evitar). Alternativa, só com GO explícito do Hugo, em NOVA story: "média dos máximos das trilhas dos alunos da org" (`avg(N_i)`), que exigiria computar N por aluno da org (scan org-wide de `chapter_slides.text_content` + rollup), cabendo no `OrgReference` cacheado de F.3. NÃO implementar sem GO.
- **(c) Ordem de merge com SH-F.3.** Ambas tocam `computeStudentComparison`: F.3 = bloco ORG (cacheado), F.5 = bloco do ALUNO (fresco) + 1 scan novo de `chapter_slides` da trilha. F.3 já aterrissou (HEAD `c25f779`); F.5 rebaseia por cima. O scan de F.5 é do lado do aluno → **não entra** no `OrgReference` cacheado, preservando o invariante "aluno nunca cacheado".

### Flags de implementação surfaçadas (epic §9, divergência plano↔código, reportar ao PO/SM)

- **I1, a heurística de reflexão é privada num route file.** `isReflectionBlock`/`countReflectionBlocks` vivem hoje DENTRO de `app/api/analytics/aggregate/route.ts` (não exportadas). Para "reusar, não reinventar" (plano §1/§2.1) sem replicar, o caminho recomendado é extrair para um módulo compartilhado (`lib/analytics/reflection-potential.ts`, aditivo) importado por ambos. Isso adiciona um toque leve em `aggregate/route.ts` (trocar defs locais por import), não listado na tabela §2.4 do plano. Confirmar com Contrato.
- **I2, o `OrgReference` de F.3 expõe só `tenantChapterCount`, não os `chapterRows` por curso.** Para contar "capítulos da trilha do aluno" sem scan novo de capítulos, é preciso acesso aos `chapterRows` (com `course_id`), hoje agregados em `tenantChapterCount` dentro de `loadOrgReference`. Recomenda-se expor `chapterRows` (ou um `chaptersByCourse`) no `OrgReference` (dado org-compartilhado, cacheável, seguro) para a derivação do lado do aluno, sem novo scan de `chapters`. Confirmar boundary com Contrato.

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/sh-1.4-worktree
pnpm --filter @eximia/web test -- student-home-indicators comparison-insights-table area-gestor   # first-move: verde ANTES
# ... implementar ...
grep -n "engagementMax" apps/web/src/types/analytics.ts apps/web/src/lib/analytics/student-home-indicators.ts   # AC1/AC3
pnpm --filter @eximia/web test -- comparison-insights-table   # AC4 (fração + degradação), AC5 (sublinha intocada), AC7 (winnerOf invariante)
pnpm --filter @eximia/web test -- student-home-indicators     # AC8 (N correto)
pnpm --filter @eximia/web test -- area-gestor                 # AC10 (sem regressão)
pnpm --filter @eximia/web typecheck                           # AC10
```

Verificação visual (AC9): `pnpm --filter @eximia/web dev -- -p 3002`, abrir `http://localhost:3002/dev/preview-desempenho` e confirmar a célula do Você em "14 de 40".

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-13 | Story criada a partir de `05-engajamento-fracao-plan.md` (fold no epic §5 dec.5 / §7 Par D / §8 / §10). Anchors verificados na worktree SH-1.4 (HEAD `c25f779`): `engagementOf`@indicators:134, coluna engagement@table:110-118, `winnerOf`@41, tipos@analytics:611/627/646, bloco do aluno fresco@area-gestor:1218-1263, heurística `isReflectionBlock`/`countReflectionBlocks`@aggregate/route:105/120. SH-F.3 confirmado já mesclado. 3 flags bloqueantes + 2 flags de implementação (I1 heurística privada, I2 chapterRows no OrgReference) sinalizados ao Contrato. Filtro pnpm real `@eximia/web` (plano dizia `web`). | Roteiro (@sm) |
| 2026-07-13 | Validação PO: I1/I2 ratificados com guardas, flag(a) com edge X>N adicionado (AC11), flag(b) Média fica absoluta (fração só com GO do Hugo, story separada), correção do "só região do aluno" (I2 toca a estrutura cacheada de F.3, additivo/org-only). Veredito GO. | Contrato (@po) |

---

## PO Validation & Critérios Fortalecidos (@po)

> **Veredito: GO (9,0/10).** Feature aditiva de contexto de display, bem ancorada. Reconfirmei todos os fatos na worktree (HEAD `c25f779`, F.1..F.4 já mescladas). Ratifico as duas flags de implementação com guardas, adiciono o tratamento de um edge que a story não cobria (X > N), e cravo o default da Média.

### Fatos reconfirmados pelo @po (worktree `sh-1.4-worktree`, HEAD `c25f779`)

- F.1..F.4 **todas mescladas** (`86136bd` F.1+F.2, `2b50411` F.3, `c25f779` F.4). `computeStudentComparison` já consome `getOrgReference`/`orgRef.*`. F.5 rebaseia por cima, sem conflito vivo.
- **I1:** `isReflectionBlock`/`countReflectionBlocks` privadas em `aggregate/route.ts:105/120`. Achado extra do @po: a heurística **já está DUPLICADA** (cópia em `present/_components/presentation-viewer.tsx:108`). Extrair para uma lib compartilhada resolve o reuso E encolhe uma duplicação existente.
- **I2:** `OrgReference` (interface @area-gestor:1100) expõe `orgStudentIds`, `tenantChapterCount` (number@1110), `referenceStats`, `orgBlock`. Os `chapterRows` (com `course_id`) são carregados em `loadOrgReference`@1129 mas hoje colapsados em `tenantChapterCount`, não expostos.

### Ratificação das flags de implementação (decisões do @po)

- **I1, RATIFICADO, extrair para `lib/analytics/reflection-potential.ts`** (aditivo) e importar em `aggregate/route.ts` (troca as defs locais por import, **comportamento byte-idêntico**) e no novo caminho de F.5. Guarda: `aggregate/route.ts` é caminho compartilhado com outros consumidores, então sua suíte (ou, se ausente, o typecheck + um teste de paridade do fixture) deve provar que a extração NÃO muda o resultado da função. `aggregate/route.ts` NÃO é dono de nenhuma outra fatia F.1..F.4, sem conflito de arquivo. Opcional (não obrigatório): deduplicar também `presentation-viewer.tsx` é fora de escopo (é client component, pode divergir), não forçar.
- **I2, RATIFICADO com a guarda CENTRAL, expor `chapterRows` no `OrgReference`** (dado org-wide = catálogo de capítulos do tenant, idêntico para todos os alunos, portanto **cacheável com segurança**). Isso honra o plano §2.1 ("capítulos já carregados, SEM scan novo de chapters"). **Correção material ao texto da story:** isto significa que F.5 **TOCA a estrutura cacheada de F.3** (`OrgReference` + `loadOrgReference`), NÃO é "só a região do aluno". A afirmação da flag (c) "o scan novo não entra no OrgReference" continua verdadeira (o scan de `chapter_slides` é do aluno, fresco), mas a EXTENSÃO de `chapterRows` no `OrgReference` é uma mudança na região ORG. Guarda bloqueante: **o `OrgReference` estendido deve conter apenas dados org-wide, ZERO dado por-aluno**, para preservar o invariante "aluno nunca cacheado" de F.3. O subconjunto da trilha do aluno (enrollment ∩ cursos ativos) é derivado FRESCO por request a partir do catálogo cacheado, nunca cacheado.

### Given/When/Then

- **AC2/AC3 (N fresco, aluno):** *Given* `chapterRows` disponível no `OrgReference` (catálogo org) + `orgEnrollmentRows`; *When* o request roda; *Then* `computeStudentComparison` filtra a trilha do aluno FRESCO, faz 1 scan novo de `chapter_slides.text_content` escopado a esses capítulos, conta slides-reflexão via a heurística REUSADA (import, não cópia), e computa `engagementMax = capítulosTrilha*2 + reflectionPossibleSlides`. `subject.engagement` (numerador) permanece `interactions*2 + reflections`.
- **AC4 (fração + degradação):** *Given* `subject.engagementMax = N`; *Then* `subjectNode` = `"X de N"`. *Given* `engagementMax` ausente; *Then* `"X"` (degradação graciosa).
- **AC7 (winnerOf invariante):** *Then* `subjectValue`/`referenceValue` continuam absolutos; `winnerOf(14,9,"higher")==="subject"` com N=40 e com N=200, o denominador nunca move o vencedor.
- **AC11 (NOVO, edge X > N, o @po não deixa passar):** sob a assunção (a) (capítulo→1 interação), pode haver caso em que o numerador exceda o teto (ex.: aluno com mais sessões concluídas contáveis que capítulos, se a contagem de `completedByStudent` não for por-capítulo-distinto). *Given* `engagement > engagementMax`; *When* renderiza; *Then* a célula mostra a fração honesta `"X de N"` SEM quebrar (sem NaN, sem negativo, sem crash). Teste dedicado com `engagement=14, engagementMax=10`. O @po NÃO exige clamp (mudar o número seria mentir), exige robustez de render + a assunção (a) declarada (ver abaixo).

### Decisões de produto cravadas pelo @po

- **Flag (a), assunção declarada:** N assume **1 interação concluível contável por capítulo** (`capítulos×2`). Se o numerador (`completedByStudent`) puder exceder o número de capítulos, `X > N` é possível (coberto por AC11). Isto fica DECLARADO na spec como assunção de modelagem; se o Senhor quiser X≤N garantido, é follow-up que mexe na semântica do numerador (fora do escopo desta story, que preserva o numerador, AC3).
- **Flag (b), RESOLVIDA por DECISÃO EXPLÍCITA DO HUGO (2026-07-13, via Maestro/Capataz): a linha da Média fica ABSOLUTA, fração na Média NÃO se implementa.** Não é mais pendência, é decisão ratificada. Só a linha do "Você" vira `X de N`; a Média mantém `String(engagementAvg)` sem denominador; sublinha absoluta nas duas linhas; `winnerOf` inalterado. A alternativa "média dos máximos das trilhas" (`avg(N_i)`) fica descartada nesta wave (só reabre se o Senhor pedir explicitamente no futuro, seria nova story). AC6 já trava a Média absoluta.

### Comandos de Verificação (exatos)

```bash
cd /Users/hugocapitelli/Dev/eximia/sh-1.4-worktree
pnpm --filter @eximia/web test -- student-home-indicators comparison-insights-table area-gestor   # first-move: VERDE antes
ls apps/web/src/lib/analytics/reflection-potential.ts                        # I1: heurística extraída
grep -nE "reflection-potential|isReflectionBlock|countReflectionBlocks" apps/web/src/app/api/analytics/aggregate/route.ts   # I1: route agora IMPORTA (não define)
grep -nE "chapterRows|studentId|student_id" apps/web/src/lib/analytics/area-gestor.ts | grep -i "OrgReference\|interface" # I2: OrgReference org-only
grep -n "engagementMax" apps/web/src/types/analytics.ts apps/web/src/lib/analytics/student-home-indicators.ts   # AC1/AC3
pnpm --filter @eximia/web test -- reflection-potential aggregate   # I1: paridade da heurística + rota sem regressão
pnpm --filter @eximia/web test -- comparison-insights-table   # AC4/AC5/AC7/AC11 (fração, sublinha intocada, winner invariante, edge X>N)
pnpm --filter @eximia/web test -- student-home-indicators     # AC8 (N correto)
pnpm --filter @eximia/web test -- area-gestor                 # AC10 (sem regressão)
pnpm --filter @eximia/web typecheck                           # AC10
```

Visual (AC9): `pnpm --filter @eximia/web dev -- -p 3002`, `http://localhost:3002/dev/preview-desempenho`, célula do Você em "14 de 40".

### Critério de PRONTO (o revisor do Par D usa)

`engagementMax?` opcional em `StudentHomeSubject`; heurística extraída para `reflection-potential.ts` e IMPORTADA por `aggregate/route.ts` (comportamento provado idêntico) e pelo novo caminho, sem cópia; `OrgReference` estendido com `chapterRows` provado **org-only** (grep sem `studentId`/`student_id` no cache); 1 scan novo de `chapter_slides` do lado do aluno, fresco, fora do `OrgReference`; `subjectNode` = fração com degradação; sublinha, `referenceNode`, `subjectValue`/`referenceValue`, `winnerOf` INTOCADOS; edge X>N renderiza são (AC11); N correto por fixture (AC8); suíte do módulo + `aggregate` verdes; typecheck limpo. Média absoluta (fração da Média não implementada). Numerador (`subject.engagement`) inalterado.

### Placar 10 pontos PO

1. Objetivo/contexto: 1 · 2. ACs testáveis: 1 (com AC11 adicionado) · 3. Precisão técnica (I1/I2 reconfirmados): 1 · 4. Rastreabilidade Art. IV (plano §2): 1 · 5. Autossuficiência: 1 · 6. Dependências/ordem (F.3 landed, rebase): 1 · 7. Escopo (Média deferida): 1 · 8. Teste runnable: 1 · 9. Riscos+mitigação (edge X>N + guarda I2 org-only): 0,5 · 10. First-move/anti-regressão (aggregate paridade): 0,5. **Total: 9,0 → GO.**

---

## Dev Agent Record

**Agente:** Malho (@dev, Opus) · **Par:** revisora Lupa (VETO) · **Data:** 2026-07-13 · **Status:** InReview → PASS da Lupa (veto não disparado)

### Resumo da implementação

O número grande do Engajamento na linha do **Você** virou a fração **`X de N`** (N = teto de engajamento da própria trilha do aluno); a linha da **Média** ficou **absoluta** (decisão explícita do Hugo, ratificada @po), sublinha absoluta nas duas linhas, `winnerOf` inalterado (compara os absolutos).

- **N (Você) = capítulosTrilha × 2 + slides-com-reflexão**, casando 1:1 com o numerador `interações×2 + reflexões`. Assunção declarada (flag a): 1 interação concluível por capítulo.
- **I1** — `isReflectionBlock`/`countReflectionBlocks` extraídas VERBATIM de `app/api/analytics/aggregate/route.ts` para o novo `lib/analytics/reflection-potential.ts`; a rota agora **importa** (byte-idêntico, provado por `reflection-potential.test.ts` + typecheck da rota, sem suíte própria da rota).
- **I2** — `OrgReference` (cache do F.3) estendido com `chapterRows` + `activeCourseIds` (**catálogo org-wide**, zero dado por-aluno). A **trilha** do aluno (enrollment ∩ cursos ativos → capítulos) é derivada FRESCA por request a partir do catálogo cacheado. O **scan novo** de `chapter_slides` (id, chapter_id, text_content, escopado aos capítulos da trilha) é do lado do **aluno**, fresco, **fora do `OrgReference`**.
- **AC11** — edge `X > N` renderiza a fração honesta (`"14 de 10"`) sem clamp, sem NaN, sem quebra.

### Decisões / notas

- **Fração na Média NÃO implementada** (flag b, decisão do Hugo): Média fica `String(engagementAvg)`. `avg(N_i)` fica como follow-up, só com GO explícito.
- **Guarda do VETO honrada:** grep de `studentId`/`student_id` no `OrgReference`/cache retorna só comentários; o cache guarda só dados org-wide (população + catálogo + agregados). O `student` block e o lado "Você" seguem derivados por request. AC6 do F.3 (2 alunos → `student` diferente, org idêntico, 0 scan org no 2º) segue verde.
- **Transparência (reportado à Lupa):** toquei `org-reference-cache.test.ts` (meu teste do F.3) só para o fake db suportar `.in` (o código novo faz `.in` no `chapter_slides`) — infra do fake, zero mudança de asserção.

### Arquivos

Novos: `lib/analytics/reflection-potential.ts` (+teste). Modificados: `types/analytics.ts` (`engagementMax?`), `lib/analytics/area-gestor.ts` (I2 `OrgReference` + trilha + scan), `lib/analytics/student-home-indicators.ts` (helpers de trilha + param `engagementMax`), `components/analytics/comparison-insights-table.tsx` (`subjectNode` fração), `app/api/analytics/aggregate/route.ts` (I1 import), `app/dev/preview-desempenho/page.tsx` (mock), `__tests__/student-home-indicators.test.ts` + `__tests__/comparison-insights-table.test.tsx` + `__tests__/org-reference-cache.test.ts` (`.in`). Restritos NÃO tocados: `vitest.config.ts`, `seed-student-home-demo.ts`, `student-progress-headline.tsx`, `org-reference-cache.ts`.

### Verificação

typecheck 0 · biome limpo · módulo (`student-home-indicators`, `comparison-insights-table`, `area-gestor`, `org-reference-cache`, `reflection-potential`) verde · suíte completa 757✓/31✗ (file set de falhas idêntico ao baseline, delta zero) · E2E ao vivo (Playwright 3002): topo do Você "14 de 40", Média absoluta "9", sublinha intocada, winner mantido.

### Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-13 | Implementação SH-F.5 (fração X de N no Você; Média absoluta; I1 extração heurística; I2 catálogo org-only no OrgReference; scan chapter_slides lado-aluno fresco). PASS da Lupa (veto não disparado). | Malho (@dev) |
