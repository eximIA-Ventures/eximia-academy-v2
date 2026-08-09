# EPIC-STUDENT-HOME — Plano Técnico: ENGAJAMENTO como FRAÇÃO "X de N" (1 story)

> **Autor:** Vitruvio (Planejador / arquiteto técnico) · **Data:** 2026-07-13
> **Origem:** feedback do Hugo na home "Meu ritmo". Fatia PEQUENA (1 story), mas segue a LINHA completa: este plano → Saga (epic/story) → Roteiro → Contrato → Capataz.
> **Fase:** DOCS ONLY.
> **Base:** branch `feat/SH-1.4-student-home-card` (HEAD `c25f779`, worktree `/Users/hugocapitelli/Dev/eximia/sh-1.4-worktree`), já no **PR #1 → engagement-center-v2**. Esta fatia entra **na MESMA branch** (o PR se atualiza).

---

## 0. O pedido (decisão explícita do Hugo)

Na coluna **Engajamento** da home "Meu ritmo", o **número do topo** hoje é absoluto (ex.: `13`) com sublinha `X interações · Y reflexões`. O Hugo quer que o número do topo vire uma **fração "de possíveis"**: não `13` solto, mas **`13 de N`**, para dar contexto.

- **Sublinha CONTINUA ABSOLUTA e INTOCADA** (`5 interações · 3 reflexões`). Só o número grande ganha denominador.
- **Linha do Você:** `X de N`, com N = o máximo de engajamento possível na trilha do PRÓPRIO aluno.
- **Linha da Média da org:** denominador AMBÍGUO (a org tem várias trilhas). Tratamento definido abaixo + **flag ao Contrato/Maestro** para o Hugo decidir.
- **Destaque de vencedor (`winnerOf`):** INALTERADO, compara o engajamento ABSOLUTO (maior vence). O denominador é só display.

---

## 1. Estado atual verificado no código (worktree)

- Engajamento é computado em `apps/web/src/lib/analytics/student-home-indicators.ts`:
  `engagementOf(id) = interactionsOf(id) * 2 + reflectionsOf(id)`, onde `interactionsOf = completedByStudent` (sessões concluídas) e `reflectionsOf = reflectionsByStudent` (contagem de `slide_reflections`). O `subject` carrega `engagement`, `interactions`, `reflections`; a `reference` carrega `engagementAvg` (derivado = `2*interactionsAvg + reflectionsAvg`), `interactionsAvg`, `reflectionsAvg`.
- Render em `apps/web/src/components/analytics/comparison-insights-table.tsx`, `buildColumns`, coluna `engagement` (linhas 109-120):
  - topo: `subjectNode: String(s.engagement)` / `referenceNode: String(r.engagementAvg)`.
  - sublinha: `subjectSub: \`${s.interactions} interações · ${s.reflections} reflexões\`` (e o par da Média).
  - comparação: `subjectValue: s.engagement`, `referenceValue: r.engagementAvg`, `direction: "higher"` → `winnerOf` compara o ABSOLUTO. **É exatamente o que fica intocado.**
- Tipo `StudentHomeIndicators` = `{ subject: StudentHomeSubject, reference: StudentHomeReference }` em `types/analytics.ts` (linhas ~646+).
- Dados carregados em `computeStudentComparison` (`lib/analytics/area-gestor.ts`, ~1091-1231): `chapterRows` (id, course_id) tenant-wide, `activeCourseIds` (não-arquivados), `tenantChapterCount`, `orgEnrollmentRows` (student_id, status, course_id, ...), `courseDeadlineRows`. **`chapter_slides` NÃO é escaneado neste caminho do aluno** (só o caminho gestor escaneia `chapter_slides` em `loadContext:506`, e apenas `id, chapter_id`, sem `text_content`).
- Heurística de "slide com reflexão possível" JÁ EXISTE no repo (`reflectionPotential` = blockquotes em `chapter_slides.text_content` via `isReflectionBlock`, replicada server-side; usada por `aggregate/route.ts`, `pedagogical-actions.ts`, `cause-inference.ts`). **Reusar, não reinventar.**
- Mock do preview: `apps/web/src/app/dev/preview-desempenho/page.tsx`, const `INDICATORS` (subject.engagement=14, interactions=6, reflections=2; reference.engagementAvg=9).

---

## 2. A story (com critério de saída VERIFICÁVEL)

### SH-F.5 — Engajamento do topo vira fração "X de N" (N = máximo da trilha)

#### 2.1 Definição do denominador N (Você)

`N_você = (capítulos da trilha do aluno × 2) + (slides com reflexão possível na trilha do aluno)`

Isto casa 1:1 com a fórmula do engajamento (`interações×2 + reflexões`), tratando N como o teto: cada capítulo dá no máximo 1 interação concluída (×2), cada slide-com-reflexão dá no máximo 1 reflexão.

- **Capítulos da trilha:** a trilha do aluno = cursos em que ele está matriculado (não-arquivados). Derivar de `orgEnrollmentRows` filtrado a `studentId` (status `active`/`completed`) ∩ `activeCourseIds`; contar `chapterRows` cujo `course_id` está nesse conjunto. **Dados já carregados, SEM scan novo.**
- **Slides com reflexão possível na trilha:** contar slides-de-reflexão dos capítulos da trilha, **reusando a heurística `reflectionPotential`/`isReflectionBlock`** sobre `chapter_slides.text_content`. **Requer 1 scan novo** de `chapter_slides` (id, chapter_id, text_content) escopado aos capítulos da trilha do aluno (pequeno, por-request, lado do ALUNO). Reusar a função de detecção existente (não replicar a heurística).

> **Modeling note (flag ao Contrato):** assume-se "1 interação concluível por capítulo". Se um capítulo puder gerar >1 sessão concluída contável, o teto de interações mudaria; a decisão cravada é capítulo→1. Documentar.

#### 2.2 Tratamento da linha da MÉDIA (denominador ambíguo) — decisão + flag

A org tem várias trilhas, com N diferente por aluno. **Default recomendado (não-confuso, decisão do plano):** a linha da **Média mantém o número ABSOLUTO** (`engagementAvg`), **SEM denominador**. Só a linha do **Você** ganha a fração. Isto evita inventar um denominador médio heterogêneo (exatamente o "confuso" que o Hugo pediu para não fazer).

> **FLAG explícito ao Contrato/Maestro (Hugo decide):** se o Hugo quiser fração também na Média, a opção mais sensata é **"média dos máximos das trilhas dos alunos da org"** (`avg(N_i)` sobre os alunos da org). Custo honesto: exige computar N por aluno da org → scan org-wide de `chapter_slides.text_content` + rollup enrollment→capítulo→slide por aluno, que é org-level e portanto **cabe no OrgReference cacheado** (SH-F.3), mas é uma computação nova de peso para um ganho de 1 linha, e o denominador seria uma média de máximos heterogêneos (caveat de leitura). **Recomendação: começar com Média absoluta; só adicionar a fração na Média se o Hugo pedir.** Não implementar a fração da Média sem GO.

#### 2.3 winnerOf — INALTERADO

A coluna `engagement` mantém `subjectValue: s.engagement` e `referenceValue: r.engagementAvg` (ABSOLUTOS) e `direction: "higher"`. O denominador entra SÓ no `subjectNode` (render). `winnerOf` não muda: um Você `14 de 40` vs Média `9` vence igual a um Você `14 de 200` vs Média `9`. O denominador nunca altera o vencedor.

#### 2.4 Mudanças por arquivo (todas na mesma branch)

| Arquivo | Mudança | Classificação |
|:--|:--|:--|
| `types/analytics.ts` | Adicionar campo OPCIONAL `engagementMax?: number` a `StudentHomeSubject`. (NÃO adicionar denominador à `StudentHomeReference` agora, ver §2.2.) | ADITIVO (opcional) |
| `lib/analytics/area-gestor.ts` (`computeStudentComparison`) | Derivar a trilha do aluno (capítulos já carregados) + **1 scan novo** `chapter_slides.text_content` da trilha → `reflectionPossibleSlides`; calcular `engagementMax = capítulosTrilha*2 + reflectionPossibleSlides`; passar a `buildStudentHomeIndicators`. **Lado do ALUNO (fresco), NÃO cacheado** (coerente com SH-F.3: o aluno nunca é cacheado). | ADITIVO |
| `lib/analytics/student-home-indicators.ts` | `buildStudentHomeIndicators` aceita o `engagementMax` (param aditivo) e o expõe em `subject.engagementMax`. | ADITIVO |
| `components/analytics/comparison-insights-table.tsx` | Coluna engagement: `subjectNode = s.engagementMax != null ? \`${s.engagement} de ${s.engagementMax}\` : String(s.engagement)`. **`subjectSub` (sublinha) INTOCADA.** `referenceNode` INTOCADO (absoluto). `subjectValue`/`referenceValue`/`winnerOf` INTOCADOS. | ADITIVO |
| `app/dev/preview-desempenho/page.tsx` | Mock `INDICATORS.subject` ganha `engagementMax` (ex.: `40` → renderiza "14 de 40"). Reference mock intocado. | ADITIVO |
| Testes | `student-home-indicators.test.ts` + `comparison-insights-table.test.tsx` ganham casos (ver §2.5). | ADITIVO |

#### 2.5 Critério de saída (VERIFICÁVEL)

- **Topo do Você = fração:** teste em `comparison-insights-table.test.tsx` provando que, com `subject.engagementMax = N`, a célula `cell-subject-engagement` renderiza **`"X de N"`** (ex.: "14 de 40"); e que, com `engagementMax` ausente/undefined, renderiza `"X"` (degradação graciosa).
- **Sublinha absoluta e intocada:** o mesmo teste assere que `subjectSub` continua `"X interações · Y reflexões"` (absoluto), sem denominador.
- **Média absoluta (default):** `cell-reference-engagement` renderiza `String(engagementAvg)` sem denominador (a menos que o Hugo aprove a fração na Média, então nova story).
- **winnerOf inalterado:** teste provando que o vencedor do engajamento depende só do absoluto: `winnerOf(14, 9, "higher") === "subject"` independe do denominador; e um caso com N grande (`14 de 200` vs `9`) mantém `"subject"`.
- **N correto:** teste em `student-home-indicators.test.ts` (ou irmão em area-gestor) provando `engagementMax = capítulosTrilha*2 + reflectionPossibleSlides` para um fixture conhecido (ex.: 3 capítulos + 4 slides-reflexão → `3*2 + 4 = 10`).
- **Engajamento absoluto inalterado:** `subject.engagement` continua `interactions*2 + reflections` (o denominador não altera o numerador).
- `pnpm --filter web typecheck` limpo; suíte do módulo verde.
- Preview `/dev/preview-desempenho` mostra "X de N" na célula do Você (verificação visual do mock).

---

## 3. Blast radius e coordenação com a finalização em voo

- **Mesma branch / mesmo PR #1.** A fatia atualiza o PR existente.
- **Conflito soft com SH-F.3 (cache):** ambas editam `computeStudentComparison` em `area-gestor.ts`. **Regiões diferentes:** SH-F.3 mexe no **bloco ORG (cacheado)**; esta story mexe no **bloco do ALUNO (fresco)** + adiciona 1 scan de `chapter_slides` da trilha do aluno. Baixo risco, mas **flag de ordem de merge ao Capataz:** sequenciar (rebasar esta sobre SH-F.3 se F.3 aterrissar primeiro, ou vice-versa) para não colidir em `computeStudentComparison`. O scan novo é do lado do aluno → **NÃO entra no OrgReference cacheado** (preserva o invariante "aluno nunca cacheado" de SH-F.3).
- `winnerOf` é exportado e testado; como NÃO muda, os testes de `comparison-insights-table` existentes seguem verdes (só ganham casos novos).
- Nenhum outro consumidor de `StudentHomeIndicators` além do card + preview + testes (campo novo é opcional → nada quebra).

---

## 4. Critério de saída deste plano (auto-checagem)

- [x] Topo do Você = fração `"X de N"`, N = máximo da trilha (`capítulos*2 + slides-reflexão`), reusando a heurística `reflectionPotential` existente.
- [x] Sublinha absoluta e INTOCADA.
- [x] Linha da Média: default = absoluto (não-confuso) + **flag da alternativa "média dos máximos" ao Contrato/Maestro** para o Hugo decidir (não inventa denominador confuso).
- [x] `winnerOf` INALTERADO (compara absoluto; denominador é só display), com teste que prova a invariância.
- [x] Mock do preview atualizado para "X de N".
- [x] Blast radius: campo opcional aditivo, e flag de ordem de merge com SH-F.3 (ambas tocam `computeStudentComparison`, regiões distintas).

**Path deste plano:** `/Users/hugocapitelli/Dev/eximia/eximia-academy-v2/docs/stories/epic-student-home/05-engajamento-fracao-plan.md`
