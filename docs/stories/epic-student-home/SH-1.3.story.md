# SH-1.3: Manchete "Meu progresso" + `buildProgressHeadline`

**Epic:** [EPIC-STUDENT-HOME](./EPIC-STUDENT-HOME.md)
**Status:** Draft
**Depende de:** nenhuma bloqueante
**Bloqueia:** SH-1.4 (integração monta este componente como a vista default de `StudentHomeCard`)
**Paralelizável:** SIM — worktree independente. Arquivo NOVO (`student-progress-headline.tsx`) + função nova em `student-comparison-scale.ts`. Único ponto de coordenação: apêndice em `-scale.ts` compartilhado com SH-1.2 (regiões distintas).

---

## Story

**As a** desenvolvedor implementando o redesign da home do aluno,
**I want** um componente `StudentProgressHeadline` que abra a home com o progresso PRÓPRIO do aluno e o CTA "Continuar agora" promovido a manchete, alimentado por uma função `buildProgressHeadline` com copy centrada no aluno (sem mencionar "média"),
**so that** a home deixe de abrir com veredito comparativo e passe a liderar por progresso próprio + próximo passo, conforme a Direção aprovada pelo Hugo.

## Contexto (Dev Notes)

Ler `01-architecture-plan.md` §1.4 e §4 antes de começar. Ler a Premissa 1 e 8 do `EPIC-STUDENT-HOME.md` §3 (comparação não lidera; CTA invariante).

- **Onde vive:** `apps/web/src/components/analytics/student-progress-headline.tsx` (NOVO, apresentação pura).
- **Reaproveitamento máximo, zero lógica de negócio nova:**
  - `buildVerdict([completionBar, ...buildSignalRows])` já existe em `student-comparison-scale.ts` e produz `headline`, `coachLine`, `nextStep`, `focusKey` — mas é fraseado como comparativo ("acima/abaixo da média"). **NÃO alterar `buildVerdict`** (é coberto por `student-comparison-scale.test.ts`, que precisa continuar verde).
  - Em vez disso, criar uma **função irmã** `buildProgressHeadline(bars)` em `student-comparison-scale.ts` que reusa `pickFocusMetric` (já é "próximo ganho", não "vs média") e deriva copy centrada no aluno: ex. "Você concluiu X com reflexão", "Seu próximo ganho é aprofundar". Esta função é NOVA, testável, e não deve mencionar "média"/comparação em nenhuma frase gerada.
  - `resolveContinueHref(data.courses)` (já existe em `student-dashboard.tsx:44`) resolve o destino do CTA "continuar de onde parou" — reusar, não reimplementar.
  - `NextStepBar` (já existe) é reusado, só muda a hierarquia visual (promovido a manchete, maior destaque).
  - North Star na manchete: `consciousCompletionPct` do bloco `student` é o número de destaque próprio (não comparado). `completionPct` e `avgDepth` entram como suporte.
- **Regra de casa (aplicável a toda copy nova):** NUNCA usar travessão (—). Usar vírgula. Os testes de `student-comparison-scale.test.ts` já verificam isso para funções existentes; `buildProgressHeadline` precisa do mesmo padrão.
- **Nenhuma query nova:** tudo já está no payload `?view=student` (via `student` block) + em `data.courses` do RSC (já disponível em `student-dashboard.tsx`).

## Acceptance Criteria

- [ ] **AC1:** `buildProgressHeadline(bars: MetricBar[])` é uma função nova em `student-comparison-scale.ts`, testável isoladamente, que retorna algo como `{ headline: string, coachLine: string, nextStep?: string, focusKey?: string }` (shape análogo a `buildVerdict`, mas com copy não-comparativa).
- [ ] **AC2:** Nenhuma string retornada por `buildProgressHeadline` menciona "média", "comparado", "acima de", "abaixo de", ou qualquer variante comparativa — a copy é sempre centrada no progresso próprio do aluno.
- [ ] **AC3:** `buildVerdict` NÃO é alterado (mesma assinatura, mesmo comportamento, mesmos testes passando sem modificação).
- [ ] **AC4:** Nenhuma string gerada por `buildProgressHeadline` contém o caractere travessão (—) — usar vírgula (regra da casa, mesma verificação já existente para funções de `-scale.ts`).
- [ ] **AC5:** `StudentProgressHeadline` (componente) exibe: (a) o CTA "Continuar agora" promovido visualmente a manchete (maior destaque que hoje, usando `NextStepBar` reusado com hierarquia visual nova), (b) `consciousCompletionPct` como número de destaque (North Star candidate), (c) `completionPct` e `avgDepth` como suporte/contexto.
- [ ] **AC6:** O CTA "Continuar agora" usa `resolveContinueHref` (reusado, não reimplementado) para resolver o destino.
- [ ] **AC7:** Teste unitário para `buildProgressHeadline`: dado um conjunto de `MetricBar[]` de exemplo (aluno com progresso alto e aluno com progresso baixo), a função retorna copy plausível e sempre sem menção comparativa (AC2) e sem travessão (AC4).
- [ ] **AC8:** `StudentProgressHeadline` é um componente de apresentação pura (sem fetch, sem estado assíncrono) — recebe os dados já resolvidos via props.

## Tasks

- [ ] 1. Confirmar suíte `student-comparison-scale.test.ts` VERDE antes de tocar o arquivo (first-move rule, ainda que a mudança seja aditiva/apêndice).
- [ ] 2. Adicionar `buildProgressHeadline(bars)` em `student-comparison-scale.ts`, em bloco separado (apêndice no fim do arquivo, para minimizar conflito com o apêndice de SH-1.2).
- [ ] 3. Escrever os testes de `buildProgressHeadline` (AC2, AC4, AC7).
- [ ] 4. Criar `apps/web/src/components/analytics/student-progress-headline.tsx` consumindo `buildProgressHeadline` + `resolveContinueHref` + `NextStepBar` reusado.
- [ ] 5. Confirmar que `student-comparison-scale.test.ts` (suíte existente) continua 100% verde sem modificação.

## Complexidade & Riscos

- **Complexidade:** S/M (small-medium). Reaproveitamento alto de lógica existente; o trabalho novo é a função de copy e a composição visual do componente.
- **Riscos:**
  - R1 (baixo): tentação de alterar `buildVerdict` em vez de criar função irmã, quebrando testes existentes. Mitigação: AC3 é explícito e bloqueante.
  - R2 (baixo): copy nova reintroduzir menção comparativa acidentalmente. Mitigação: AC2 + teste dedicado (AC7).
  - R3 (baixo): conflito de merge em `student-comparison-scale.ts` com SH-1.2. Mitigação: apêndices em blocos separados, coordenado no plano §6.2.

## Dev Notes

- **Não montar o toggle nem a tabela de comparação aqui.** Esta story entrega SÓ a manchete "Meu progresso". O toggle e a orquestração entre manchete/comparação são SH-1.4.
- Se o refactor de mover `buildSignalRows`/`completionBar` de `-view.tsx` para `-scale.ts` (nota §1.6 do plano) ainda não tiver acontecido, esta story pode consumir `buildSignalRows` de onde ele estiver hoje (import de `-view.tsx` se necessário) — não é responsabilidade desta story mover essas funções; se a mover for conveniente para reduzir import cruzado, tratar como refactor aditivo coberto por teste (first-move rule).
- Único arquivo de contato com SH-1.2 é `student-comparison-scale.ts` — adicionar em bloco separado, no fim do arquivo.

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web lint
pnpm --filter @eximia/web test -- student-comparison-scale
pnpm --filter @eximia/web test -- student-progress-headline
```

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-11 | Story criada a partir do EPIC-STUDENT-HOME + plano de arquitetura (Fatia C). | River (SM Agent) |
| 2026-07-11 | Validação PO + ACs fortalecidos (era a story mais magra em verificação; correção do AC6, asserções concretas de copy, precedente do guard anti-travessão). Veredito GO. | Contrato (@po) |

---

## PO Validation & Critérios Fortalecidos (@po)

> **Veredito: GO (9,0/10) após fortalecimento.** Esta era a story mais magra em MECÂNICA de verificação: as ACs descreviam o certo, mas sem o comando/asserção que prova. Duas correções materiais: (1) `resolveContinueHref` NÃO é exportado, é função local de `student-dashboard.tsx:44`, então um componente de apresentação PURA (AC8) não pode chamá-lo, ele recebe `continueHref` já resolvido via PROP; (2) as regras de copy ("sem média", "sem travessão") viram asserções de teste concretas, com precedente já existente na suíte.

### Correção do AC6 (achado de código)

`grep -n resolveContinueHref` mostra `function resolveContinueHref(courses...)` em `student-dashboard.tsx:44`, SEM `export`. O RSC `student-dashboard.tsx` já resolve o href e o passa adiante (`continueHref` desce por `student-comparison.tsx` até os componentes). Portanto:
- **AC6 revisado:** `StudentProgressHeadline` recebe `continueHref: string` como PROP (já resolvido por `resolveContinueHref` no nível do dashboard). NÃO importa nem reimplementa a resolução, e NÃO deve exportar/mover `resolveContinueHref` (isso seria escopo de SH-1.4/integração, não desta story). `resolveContinueHref` permanece a fonte única no dashboard.

### Given/When/Then por AC

- **AC1 (buildProgressHeadline nova, isolável):** *Given* `student-comparison-scale.ts` sem a função; *When* `buildProgressHeadline(bars: MetricBar[])` é adicionada em bloco de apêndice no FIM do arquivo; *Then* `grep -n "buildProgressHeadline" apps/web/src/components/analytics/student-comparison-scale.ts` acha a export, e ela retorna `{ headline, coachLine, nextStep?, focusKey? }`.
- **AC2 (copy não-comparativa, cravada como teste):** *Given* qualquer `MetricBar[]`; *When* `buildProgressHeadline` roda; *Then* a string concatenada da saída NÃO casa `/m[ée]dia|comparad|acima\s+d|abaixo\s+d/i`. Asserção literal do teste: `expect(`${r.headline} ${r.coachLine} ${r.nextStep ?? ""}`).not.toMatch(/m[ée]dia|comparad|acima|abaixo/i)`.
- **AC3 (buildVerdict intocado):** *Given* a suíte `student-comparison-scale.test.ts` (25 casos hoje); *When* a story termina; *Then* os 25 passam SEM modificação, e `git diff` mostra só APÊNDICE (a função `buildVerdict` byte-idêntica).
- **AC4 (sem travessão, com precedente):** *Then* `expect(saida).not.toContain("—")`. Precedente literal já na casa: `student-comparison-scale.test.ts:212` faz exatamente isso para `buildVerdict`. Espelhar o mesmo assert para `buildProgressHeadline`.
- **AC5/AC8 (componente puro):** *Given* dados resolvidos via props; *When* `StudentProgressHeadline` renderiza; *Then* exibe CTA "Continuar agora" promovido a manchete (via `NextStepBar` reusado, maior destaque), `consciousCompletionPct` como número de destaque (North Star), `completionPct` e `avgDepth` como suporte (avgDepth com âncora `/7`, alinhado a SH-1.5). Sem fetch, sem estado assíncrono.

### Comandos de Verificação (exatos)

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
pnpm --filter @eximia/web test -- student-comparison-scale     # baseline 25/25 ANTES, 25/25 + novos DEPOIS
pnpm --filter @eximia/web test -- student-progress-headline     # testes de AC2/AC4/AC7
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web lint
grep -n "buildProgressHeadline" apps/web/src/components/analytics/student-comparison-scale.ts
grep -nE "resolveContinueHref" apps/web/src/components/analytics/student-progress-headline.tsx   # esperado: VAZIO (recebe href por prop, AC6)
grep -nE "continueHref|NextStepBar|consciousCompletionPct" apps/web/src/components/analytics/student-progress-headline.tsx
git -C apps/web diff src/components/analytics/student-comparison-scale.ts   # só apêndice, buildVerdict intacto
```

Verificação visual (E2E real acontece em SH-1.4, quando a manchete vira a vista default): `pnpm --filter @eximia/web dev -- -p 3002`, `http://localhost:3002/dashboard` como aluno, confirmar que a home abre por progresso próprio com "Continuar agora" em destaque. Na story isolada, a prova é o teste de render + `buildProgressHeadline`.

### Critério de PRONTO (o Revisor Esquadro usa este)

Baseline `student-comparison-scale` 25/25 verde ANTES; `buildProgressHeadline` adicionada como apêndice (buildVerdict intocado, provado por diff); testes assertam ausência de copy comparativa (`/m[ée]dia|comparad|acima|abaixo/i`) E ausência de travessão (`.not.toContain("—")`); `StudentProgressHeadline` é apresentação pura recebendo `continueHref` por prop (NÃO importa `resolveContinueHref`); CTA promovido a manchete via `NextStepBar`; `consciousCompletionPct` como destaque. `typecheck`+`lint`+`test` verdes.

### Placar 10 pontos PO

1. Objetivo/contexto: 1 · 2. ACs testáveis: 1 (era 0,5, elevado com asserções literais) · 3. Precisão técnica: 1 (AC6 corrigido) · 4. Rastreabilidade Art. IV: 1 · 5. Autossuficiência: 1 · 6. Dependências: 1 · 7. Escopo: 1 · 8. Teste runnable: 1 · 9. Riscos+mitigação: 0,5 · 10. Anti-regressão/first-move: 0,5. **Total: 9,0 → GO.** (Pré-fortalecimento seria ~7,0 pela verificação frouxa; as correções de AC6 e das asserções fecham a lacuna.)
