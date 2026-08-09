# SH-2.2: Última atividade mede estudo real, não login

**Epic:** [EPIC-STUDENT-HOME](./EPIC-STUDENT-HOME.md)
**Status:** InReview
**Depende de:** SH-2.1 (Turma já filtrada para alunos ativos em `OrgReference.orgStudentIds` — a média "Turma" desta story herda essa população).
**Bloqueia:** SH-2.3 (o painel-resumo consome `s.lastAccessDays`/`r.lastAccessAvgDays` já corrigidos por esta story para decidir severidade/abertura honesta).
**Paralelizável:** rodou em sequência com SH-2.1 (antes) e SH-2.3 (depois), mesmo dev, terminal único. Não paraleliza com trabalho concorrente em `student-home-indicators.ts`/`comparison-insights-table.tsx`.

---

## Story

**As a** Hugo (fundador, dono do produto), que trouxe um caso real (aluno Angelo) mostrando a linha "Última atividade" acesa verde "ativo acima da média" para um aluno que só tinha ABERTO a plataforma, sem estudar nada,
**I want** que a linha "Última atividade" da tabela "Meu ritmo" meça ATIVIDADE DE ESTUDO real (sessão de curso ou reflexão), nunca um mero login/acesso à plataforma, com um rótulo e uma copy que deixem isso explícito,
**so that** nenhum aluno leia "acima da média" só porque abriu o app, e a linha vire uma medida honesta do que ela promete medir.

## Contexto (Dev Notes)

### O caso Angelo (motivação, evidência)

Screenshot trazido pelo Hugo: a linha "Última atividade" do aluno Angelo mostrava **"hoje"** e acendia **verde "ativo acima da média"** — mas os outros 4 indicadores da mesma tabela contavam uma história bem diferente: **0% de progresso, 0/8 interações, 1/41 reflexões, 28º de 45 no engajamento**. A frase do Hugo, verbatim: *"a última atividade do angelo não foi hoje, ele apenas entrou na plataforma... não podemos fazer com que logo na primeira vez que ele acessar ele fique 'acima da média'... acredito que esse última atividade precisa de uma outra nomenclatura e uma outra forma de falar sobre"*.

### Diagnóstico (confirmado em código antes de qualquer edição, 2026-07-19)

`s.lastAccessDays` (Você) e `r.lastAccessAvgDays` (Turma) — consumidos por `buildRows` em `comparison-insights-table.tsx` (linha `lastAccess`, `direction: "lower"`) e comparados por `winnerOf`/`leituraFor` — eram calculados em `student-home-indicators.ts` a partir de um ÚNICO par de estruturas (`latestByStudent`/`subjectStamps`) alimentado por TRÊS sinais fundidos sem distinção de tipo: sessão (`created_at`/`updated_at`), reflexão (`created_at`/`updated_at`) e **`users.last_seen_at`** — este último uma decisão anterior deliberada ("FOLLOW-UP B", Hugo 2026-07-14: *"pure navigation (login/browse without chat or reflection) is access too"*). A regra de "penúltima visita" (AJUSTE 2, Hugo 2026-07-14) resolve a tautologia do self-view ("hoje" óbvio porque o aluno está olhando a página agora), mas não filtra por TIPO de sinal — um login fora da janela de 60 min ainda contava como "a penúltima visita". Resultado: um login puro do Angelo virou seu stamp mais recente qualificável, `lastAccessDays` computou `0`, e a comparação (direção "lower", menos dias vence) leu isso como vitória → chip verde "ativo acima da média". Zero atividade de curso foi necessária para produzir esse resultado.

### Correção aplicada

Em `student-home-indicators.ts`:
1. `latestByStudent`/`subjectStamps` permanecem INTOCADOS (continuam alimentados por sessão+reflexão+login) — `displayFor` (ritmo/triagem, usado em outro lugar do app, fora do escopo desta story) continua legitimamente lendo "qualquer acesso".
2. Um SEGUNDO par de estruturas — `studyLatestByStudent` (mapa) e `subjectStudyStamps` (array) — é preenchido SOMENTE dentro dos loops de sessão e reflexão (nunca no loop de `lastSeenByStudent`/login). `bumpLatest` ganhou um 3º parâmetro `isStudySignal: boolean` para alimentar as duas estruturas ao mesmo tempo sem duplicar a lógica de parsing.
3. `subjectLastAccessDays` (a IIFE de "penúltima visita", mesma janela de 60 min preservada) passou a ler `subjectStudyStamps` em vez de `subjectStamps`.
4. `lastAccessDaysOf()` (a média da Turma) passou a ler `studyLatestByStudent` em vez de `latestByStudent`.
5. Efeito: um aluno que só loga, nunca estuda de verdade, tem `lastAccessDays = null` nos dois lados (Você e Turma, mesma régua) → cai no caminho JÁ EXISTENTE de `winnerOf`/`leituraFor` (`subject === null → { text: "—", tone: "none" }`) — **reusa infraestrutura existente**, sem inventar um estado novo. Não é mais possível ler "acima da média" por mero login.

Em `comparison-insights-table.tsx` (nomenclatura, `buildRows`/`LEITURA_COPY`/`ACTION_LABEL`/fallback de `formatDays`):

| Elemento | Antes | Depois |
|---|---|---|
| Label da linha | "Última atividade" | **"Última sessão de estudo"** |
| `LEITURA_COPY.lastAccess.win` | "ativo acima da média" | **"estudando acima da média"** |
| `LEITURA_COPY.lastAccess.behind` | "vamos retomar?" | **"vamos retomar os estudos?"** |
| `LEITURA_COPY.lastAccess.tie` | "no ritmo da turma" | (inalterado) |
| `ACTION_LABEL.lastAccess` | "Retomar atividade" | **"Retomar os estudos"** |
| Fallback null (`formatDays`) | "Primeiro acesso" | **"Ainda sem sessão de estudo"** |

O fallback null mudou de nome porque, sob a nova semântica, `null` não significa mais literalmente "primeiro login" — um aluno pode ter logado dezenas de vezes e ainda ter `lastAccessDays = null` (nunca estudou de verdade). "Ainda sem sessão de estudo" é honesto nos dois casos.

### Decisão de design — ponto 3 do pedido (nunca-estudou vs. adiantado vs. atrasado)

**Decisão: reusar a infraestrutura `null`/`tone: "none"` já existente em `winnerOf`/`leituraFor`, sem criar um terceiro tom novo.** `winnerOf` já retorna `null` quando qualquer lado é `null` ("Empate ou valor ausente não gera leitura de vitória/convite", comentário pré-existente no cabeçalho do arquivo), e `leituraFor` já traduz isso em `{ text: "—", tone: "none" }`. Com a correção do dado, um aluno que NUNCA estudou (nem sessão, nem reflexão) automaticamente cai nesse caminho — sem "acima da média" falso, sem punição, só ausência honesta de comparação. Os outros dois estados (estudou e está adiantado / estudou e está atrasado) já eram cobertos pelos tons `win`/`behind-mild`/`behind-severe` existentes, agora operando sobre dado correto. Nenhuma mudança de tipo (`Leitura`) foi necessária — a correção é inteiramente de FONTE DE DADO, a distinção de estado emerge do `null` honesto, não de uma ramificação nova de UI.

## Acceptance Criteria

- [x] **AC1:** `subjectLastAccessDays` (Você) deriva exclusivamente de `subjectStudyStamps` (sessão/reflexão), nunca de `lastSeenByStudent`.
- [x] **AC2:** `lastAccessAvgDays` (Turma) deriva exclusivamente de `studyLatestByStudent` (sessão/reflexão), mesma régua do lado Você.
- [x] **AC3:** `latestByStudent`/`subjectStamps` (usados por `displayFor`/ritmo-triagem) permanecem intocados — nenhuma mudança de comportamento fora da linha "Última atividade"/"Última sessão de estudo".
- [x] **AC4:** Um aluno com sinal de estudo ZERO (sem sessão, sem reflexão) tem `lastAccessDays = null` em ambos os lados, resultando em `leituraFor` retornando `tone: "none"` (nunca `"win"`).
- [x] **AC5:** Rótulo da linha, `LEITURA_COPY.lastAccess` (win/behind), `ACTION_LABEL.lastAccess` e o fallback null de `formatDays` renomeados conforme a tabela acima, nomeando "estudo" explicitamente.
- [x] **AC6:** Caso Angelo reproduzido em teste: sinal de `last_seen_at` recente + nenhuma sessão/reflexão recente → linha NÃO mostra "hoje"/"win", mostra o dado honesto (data da última sessão/reflexão real, ou o fallback null).
- [x] **AC7:** Sem regressão: `student-home-indicators.test.ts` (blocos que não usam `last_seen_at`) e demais suítes do domínio analytics seguem verdes.

## Tasks

- [x] 1. Confirmar em código a fonte exata de `lastAccessDays`/`lastAccessAvgDays` antes de editar (feito na fase de diagnóstico, aprovada pelo Hugo antes desta implementação).
- [x] 2. Adicionar `studyLatestByStudent`/`subjectStudyStamps` em `student-home-indicators.ts`, alimentados só nos loops de sessão/reflexão.
- [x] 3. Repontar `subjectLastAccessDays` e `lastAccessDaysOf` para as novas estruturas.
- [x] 4. Atualizar JSDoc de `StudentHomeSubject.lastAccessDays`/`StudentHomeReference.lastAccessAvgDays` em `types/analytics.ts`.
- [x] 5. Renomear label/LEITURA_COPY/ACTION_LABEL/fallback em `comparison-insights-table.tsx`, incluindo o recálculo de largura do botão (`ACTION_LABEL_SIZE.lastAccess`, "Retomar os estudos" = 18 caracteres, ainda cabe em `text-xs`/12px com folga real).
- [x] 6. Reescrever o describe `"último acesso — users.last_seen_at (navegação pura) conta como acesso"` para o comportamento INVERSO (login não conta mais) em `student-home-indicators.test.ts`.
- [x] 7. Atualizar as 4 asserções de `ACTION_LABEL`/`LEITURA_COPY`/label/fallback em `comparison-insights-table.test.tsx`.
- [x] 8. `tsc --noEmit` + `vitest run src/components/analytics src/lib/analytics` + `biome check` nos arquivos tocados, tudo verde antes de prosseguir para SH-2.3.

## Complexidade & Riscos

- **Complexidade:** M (medium). Uma bifurcação de sinal dentro de uma função pura já complexa (`buildStudentHomeIndicators`), mais 5 pontos de renomeação de copy coordenados em outro arquivo, mais um bloco inteiro de testes que precisou ser INVERTIDO (não só ajustado).
- **Riscos:**
  - R1 (médio, mitigado): renomear a copy sem recalcular a largura do botão calibrada por caractere (Round 25/26) quebraria a simetria visual dos 5 botões. Mitigação: recálculo explícito documentado no código (18 caracteres, mesma fórmula, ainda cabe no degrau `text-xs`).
  - R2 (baixo): esquecer de reverter o teste que hoje afirma "login conta como acesso" (agora comportamento errado) faria o CI ficar verde testando o bug antigo. Mitigação: bloco reescrito com título e asserções invertidos, não apenas deletado.
  - R3 (baixo): a query mudar `deadlines`/mapas usados por `displayFor` sem querer. Mitigação: AC3 — `latestByStudent`/`subjectStamps` (fonte de `displayFor`) nunca tocados.

## Dev Notes

- **Arquivos de produção tocados:** `apps/web/src/lib/analytics/student-home-indicators.ts`, `apps/web/src/components/analytics/comparison-insights-table.tsx`, `apps/web/src/types/analytics.ts` (JSDoc apenas).
- **Arquivos de teste tocados:** `apps/web/src/lib/analytics/__tests__/student-home-indicators.test.ts`, `apps/web/src/components/analytics/__tests__/comparison-insights-table.test.tsx`.
- **NÃO tocar** `apps/web/src/lib/analytics/area-gestor.ts` (SH-2.1, já fechada) nem `apps/web/src/lib/analytics/ritmo-summary.ts` (SH-2.3, próxima — consome o resultado desta story).
- **Reusar, não reinventar:** o `null`/`tone: "none"` de `winnerOf`/`leituraFor` já existiam (ver §Decisão de design acima) — nenhuma ramificação de UI nova foi criada para "nunca estudou".

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2/apps/web
npx tsc --noEmit
npx vitest run src/components/analytics src/lib/analytics
npx biome check src/lib/analytics/student-home-indicators.ts src/lib/analytics/__tests__/student-home-indicators.test.ts src/components/analytics/comparison-insights-table.tsx src/components/analytics/__tests__/comparison-insights-table.test.tsx src/types/analytics.ts
```

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-19 | Story criada e implementada a partir do caso real do aluno Angelo (Hugo). `studyLatestByStudent`/`subjectStudyStamps` isolam sinais de ESTUDO (sessão/reflexão) de `latestByStudent`/`subjectStamps` (que continuam incluindo login, para ritmo/triagem). `lastAccessDays`/`lastAccessAvgDays` passam a ler só das novas estruturas. Nomenclatura: "Última atividade" → "Última sessão de estudo"; `LEITURA_COPY.lastAccess` win/behind renomeados para nomear estudo explicitamente; `ACTION_LABEL.lastAccess` "Retomar atividade" → "Retomar os estudos" (largura de botão recalculada, ainda cabe); fallback null "Primeiro acesso" → "Ainda sem sessão de estudo". Bloco de testes que afirmava "login conta como acesso" invertido para o comportamento correto. `tsc` exit 0; 330/330 testes verdes; `biome check` limpo. | J.A.R.V.I.S. (@dev, terminal único consolidado) |

## Dev Agent Record

### Contexto de execução

O diagnóstico completo (fonte do dado, causa raiz, proposta de correção em prosa) já tinha sido apresentado ao Hugo e aprovado ANTES desta implementação — nenhuma parte do diagnóstico foi reaberta aqui, só materializada em código exatamente como desenhada.

### Achados durante a implementação

- `bumpLatest` já existia como um único helper reusado por sessão/reflexão/(indiretamente)login; adicionar o 3º parâmetro `isStudySignal` evitou duplicar a lógica de parsing de ISO/epoch em 4 call sites diferentes — um único ponto de bifurcação.
- A calibração de largura de botão por caractere (Round 25/26, comentário extenso em `ActionButton`) exigiu um recálculo explícito ao trocar "Retomar atividade" (17 caracteres) por "Retomar os estudos" (18 caracteres) — a fórmula documentada no próprio código (`charCount × 0.58 × fontSizePx`) confirmou que o degrau `text-xs`/12px continua com folga real (14,7px, acima da menor folga já aceita no Round 26, 12,4px), então NENHUM degrau de fonte precisou mudar — só a validação.
- O describe `"último acesso — users.last_seen_at (navegação pura) conta como acesso"` não podia ser apenas "ajustado" — o comportamento que ele provava (login conta) é EXATAMENTE o bug que esta story corrige. Foi reescrito com título e asserções invertidos (4 testes), preservando a estrutura de fixtures para deixar claro que é o MESMO cenário testado, com veredito oposto.
- O bloco "penúltima visita" (janela de 60 min) não precisou de nenhuma mudança de valor esperado — todos os seus 4 testes já usavam só sinais de sessão, então são idênticos antes/depois da story; só o comentário de cabeçalho do describe ganhou uma nota sobre o escopo da SH-2.2.

### File List

- `apps/web/src/lib/analytics/student-home-indicators.ts` (modificado)
- `apps/web/src/lib/analytics/__tests__/student-home-indicators.test.ts` (modificado)
- `apps/web/src/components/analytics/comparison-insights-table.tsx` (modificado)
- `apps/web/src/components/analytics/__tests__/comparison-insights-table.test.tsx` (modificado)
- `apps/web/src/types/analytics.ts` (modificado, JSDoc)
- `docs/stories/epic-student-home/SH-2.2.story.md` (novo)
