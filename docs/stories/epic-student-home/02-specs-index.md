# 02 — Specs Index & Veredito PO (EPIC-STUDENT-HOME)

> **Autor:** Contrato (@po) · **Data:** 2026-07-11 · **DOCS ONLY** (nenhum código de app tocado)
> **Insumos:** `00-validation-stage0.md` (Atlas/@analyst), `01-architecture-plan.md` (Aria/@architect), `EPIC-STUDENT-HOME.md` (Bob/@pm)
> **Escopo deste doc:** veredito GO/NO-GO por story (validação de 10 pontos), dependência real, ordem e atribuição dos 3 pares coder-revisor.

---

## 1. Veredito por story

| Story | Título | Complexidade | Placar 10pt | Veredito |
|:---|:---|:---|:---|:---|
| **SH-1.1** | Backend aditivo (`distinctActiveDays` + mediana irmã) | M | 9,0 | **GO** |
| **SH-1.2** | Componente-espinha `IndicatorComparisonTable` | M | 9,0 | **GO** |
| **SH-1.3** | Manchete "Meu progresso" + `buildProgressHeadline` | S/M | 9,0 | **GO** (era a mais magra, fortalecida) |
| **SH-1.4** | Toggle + container `StudentHomeCard` (integração) | L | 9,0 | **GO** condicionado (merge espera 1.1+1.2+1.3) |

**4/4 GO.** Nenhum NO-GO. As ACs fortalecidas (Given/When/Then + comandos concretos + critério de PRONTO) foram anexadas em cada `.story.md` na seção `## PO Validation & Critérios Fortalecidos (@po)`, preservando as ACs originais do @sm (aditivo, nada sobrescrito).

SH-1.5 (reancoragem de métricas) e SH-1.6 (PostHog) estão previstas no epic (§10) mas **ainda não têm arquivo `.story.md`** neste diretório, portanto fora deste passo de specs. Ficam como backlog imediato pós-integração.

## 2. Achados de verificação do PO (verificados em código, 2026-07-11)

Estes achados são a razão do fortalecimento, todos confirmados por varredura em `apps/web/src`:

1. **Símbolos reais, confirmados:** `toMetricBar`/`buildVerdict`/`pickFocusMetric` (`student-comparison-scale.ts`), `computeMetricBlock` (`area-gestor.ts:133`), `computeStudentComparison` (`:988`), `NextStepBar`/`SignalRow`/`OwnMetricsOnly` (`student-comparison-view.tsx`). Nenhum símbolo inventado nas stories. Art. IV (No Invention) satisfeito.
2. **`distinctActiveDays` de fato AUSENTE** em `types/analytics.ts` (só há `avgDepth?`, `consciousCompletionPct?`, `avgSessionsPerStudent`). Confirma que SH-1.1 é trabalho novo aditivo, não renomeação.
3. **Zero cobertura de teste sobre `computeMetricBlock`** (não existe `area-gestor.test.ts`; o único teste do caminho é `route-student-view.test.ts`, que cobre só o gate `canAccessView`). → Corrigi SH-1.1: o "baseline verde area-gestor" foi reancorado nas suítes que EXISTEM; os testes novos da SH-1.1 são a primeira cobertura da função (eleva a barra). O grep `toEqual` (AC8) legitimamente não acha nada (risco de shape ≈ nulo).
4. **`resolveContinueHref` NÃO é exportado** (função local `student-dashboard.tsx:44`). → Corrigi SH-1.3 AC6: `StudentProgressHeadline` recebe `continueHref` por PROP (apresentação pura), não importa nem reimplementa a resolução.
5. **Guard anti-travessão já existe** em `student-comparison-scale.test.ts:212` (`.not.toContain("—")` sobre `buildVerdict`). → Precedente literal para SH-1.3 AC4.
6. **Runner/comandos reais:** pacote `@eximia/web`; `test`=`vitest run`, `lint`=`biome check ./src`, `typecheck`=`tsc --noEmit`. Rotas de verificação visual: home do aluno `http://localhost:3002/dashboard`, harness `http://localhost:3002/dev/preview-desempenho` (dev com `pnpm --filter @eximia/web dev -- -p 3002`).

## 3. Dependência real (o mapa que rege o dispatch)

```
SH-1.1 (backend: distinctActiveDays + mediana)  ─┐
   └─ é BASE de dados de SH-1.2 e SH-1.3          │
SH-1.2 (espinha IndicatorComparisonTable) ────────┼──► SH-1.4 (integração: StudentHomeCard)
SH-1.3 (manchete + buildProgressHeadline) ────────┘         monta 1.2 + 1.3, consome campos de 1.1
```

**Verdade da dependência (não a leitura ingênua "tudo depende de tudo"):**
- **SH-1.1 é a base de DADOS**, não bloqueio de compilação. SH-1.2 e SH-1.3 **compilam e testam sem SH-1.1 mergeada**, usando fallback `?? undefined` nos campos opcionais (`distinctActiveDays`, mediana). Ou seja: os três (A/B/C) rodam em PARALELO em worktrees.
- **Único arquivo de contato B↔C:** `student-comparison-scale.ts`. SH-1.2 (se precisar de helper novo) e SH-1.3 (`buildProgressHeadline`) adicionam em APÊNDICE, blocos separados no fim do arquivo, regiões distintas → merge trivial. SH-1.1 NÃO toca esse arquivo.
- **SH-1.4 tem dependência DURA de merge:** só faz o merge final depois de 1.1+1.2+1.3. Pode começar a estrutura do toggle com mocks/componentes stub, mas o merge espera as três.
- **Ordem de merge:** A → B → C → integração (A primeiro elimina o `?? undefined` temporário de B/C).

## 4. Ordem e atribuição dos 3 pares coder-revisor

Cada fatia toca arquivos majoritariamente disjuntos → os 3 pares trabalham em paralelo, em worktrees independentes. O par que liberar primeiro pega SH-1.4.

| Par (coder / revisor) | Story | Arquivos-alvo | Paralelo? | Critério de PRONTO (revisor) |
|:---|:---|:---|:---|:---|
| **Bigorna / Crivo** | **SH-1.1** | `types/analytics.ts`, `lib/analytics/area-gestor.ts` (+ novo teste) | SIM (worktree A) | Ver `SH-1.1 §Critério de PRONTO`. Chave: assinatura de `computeMetricBlock` intacta (diff), mediana FORA dela, testes AC4/AC7 verdes, escolha de shape da mediana registrada no Dev Agent Record. |
| **Malho / Lupa** | **SH-1.2** | `components/analytics/indicator-comparison-table.tsx` (NOVO) (+ apêndice opcional em `-scale.ts`) | SIM (worktree B) | Ver `SH-1.2 §Critério de PRONTO`. Chave: grep anti-vermelho VAZIO (behind=neutro), reusa `toMetricBar`, teste de reuso aluno↔gestor (AC7), ≥3 casos AC9. |
| **Solda / Esquadro** | **SH-1.3** | `components/analytics/student-progress-headline.tsx` (NOVO), `buildProgressHeadline` em `-scale.ts` | SIM (worktree C) | Ver `SH-1.3 §Critério de PRONTO`. Chave: `buildVerdict` intocado (diff = só apêndice), teste assertando sem copy comparativa e sem travessão, `continueHref` por prop (AC6 corrigido). |
| **Primeiro par que liberar** | **SH-1.4** | `student-comparison-view.tsx` (decompor), `student-home-card.tsx` (NOVO), `student-comparison.tsx`, `student-dashboard.tsx`, `dev/preview-desempenho/page.tsx` | NÃO (após A+B+C) | Ver `SH-1.4 §Critério de PRONTO`. Chave: invariância do CTA (teste), export `StudentComparisonView` preservado, `suppressComparison` em constante nomeada, contrato do wrapper intacto, E2E nas duas rotas. |

**Coordenação B↔C obrigatória:** Malho (SH-1.2) e Solda (SH-1.3) tocam `student-comparison-scale.ts`. Regra: cada um adiciona seu bloco no FIM do arquivo, em região própria. Se o conflito incomodar, combinar B+C num worktree (o plano §6.2 admite). Crivo e Lupa devem checar no review que os apêndices não colidem.

## 5. Invariantes que NENHUM par pode reabrir (do epic §3)

Regras de aceite transversais, o revisor reprova se violadas:
1. Comparação NÃO lidera (default `intent:'progress'`).
2. Toggle é de PERGUNTA, não de formato.
3. "Abaixo" é NEUTRO, nunca vermelho/punitivo (grep anti-vermelho em SH-1.2).
4. CTA "Continuar agora" INVARIANTE entre vistas (teste em SH-1.4).
5. Barras `SignalRow` preservadas como vista detalhada (não deletar).
6. Só código ADITIVO: nenhuma assinatura de `computeMetricBlock`/`toMetricBar`/`computeStudentComparison`/gate muda.
7. Suítes existentes (`student-comparison-scale`, `route-student-view`) verdes sem modificação.
8. Regra da casa: copy nova sem travessão (—), usar vírgula.

## 6. Portão de saída (o Capataz pode decompor e dispatchar quando)

- [x] 4 stories com ACs verificáveis (Given/When/Then + comandos exatos) — anexadas em cada `.story.md`.
- [x] Veredito PO por story (4/4 GO).
- [x] Dependência real cravada (A/B/C paralelos; 1.4 espera merge dos três).
- [x] Atribuição dos 3 pares + regra de SH-1.4 (primeiro a liberar).
- [x] Achados de verificação documentados (símbolos reais, gaps corrigidos).

**Liberação:** os 3 pares podem começar A/B/C AGORA em paralelo. SH-1.4 entra assim que um par liberar, e mergeia por último. Só código aditivo, testes existentes verdes.

---

## Change Log

| Data | Mudança | Autor |
|:---|:---|:---|
| 2026-07-11 | Index criado: veredito 4/4 GO, dependência real, atribuição dos 3 pares. ACs fortalecidas nos 4 `.story.md`. | Contrato (@po) |
