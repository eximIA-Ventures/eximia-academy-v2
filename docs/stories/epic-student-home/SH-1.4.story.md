# SH-1.4: Toggle de intenção + container `StudentHomeCard` (integração)

**Epic:** [EPIC-STUDENT-HOME](./EPIC-STUDENT-HOME.md)
**Status:** Draft
**Depende de:** SH-1.1 (backend aditivo), SH-1.2 (`IndicatorComparisonTable`), SH-1.3 (`StudentProgressHeadline`) — todas as três devem estar mergeadas antes desta story começar de verdade (consome os três artefatos diretamente).
**Bloqueia:** SH-1.5 pode rodar em paralelo tecnicamente (liga dados às linhas), mas a integração visual final depende de SH-1.4 existir; SH-1.6 (PostHog) depende de `StudentHomeCard` existir.
**Paralelizável:** NÃO com SH-1.1/1.2/1.3 (é o ponto de integração que os consome). É a última fatia a começar, conforme ordem de merge sugerida pelo epic (A → B → C → integração).

---

## Story

**As a** desenvolvedor implementando o redesign da home do aluno,
**I want** decompor `StudentComparisonView` em um novo container `StudentHomeCard` que orquestre a manchete "Meu progresso" (default), o toggle de intenção "Meu progresso"/"Como me comparo", e as duas vistas de comparação (tabela nova + barras atuais como vista detalhada), com o CTA "Continuar agora" invariante entre vistas,
**so that** a home do aluno funcione ponta a ponta com a nova hierarquia de informação, sem quebrar o export estável usado pelo dev harness `preview-desempenho`.

## Contexto (Dev Notes)

Ler `01-architecture-plan.md` §1.5, §2 (todo), §5.1 e §6.2 (bloco "Integração final") antes de começar. Ler `EPIC-STUDENT-HOME.md` §6 itens 1-3 e 8-9, e §3 premissas 1-3 e 8.

- **Árvore final proposta pelo plano:**

```
student-dashboard.tsx
  └─ StudentComparison (fetch wrapper — inalterado no contrato, ganha 1 estado de toggle)
       └─ StudentHomeCard (NOVO container — orquestra manchete + toggle + vistas)
            ├─ StudentProgressHeadline           (default: "Meu progresso" + CTA manchete) [SH-1.3]
            └─ [toggle "Como me comparo"]
                 ├─ IndicatorComparisonTable      (ESPINHA reaproveitável — vista comparação 1ª classe) [SH-1.2]
                 └─ SignalRow[] (vista detalhada) (barras atuais, preservadas)
```

- **`StudentComparisonView` NÃO é deletado.** Preservar o export `StudentComparisonView` estável para o dev harness `preview-desempenho/page.tsx` (que importa `StudentComparisonView` + `ComparableMetricBlock`). Recomendação do plano: manter o export, mudar só os internals (o arquivo `student-comparison-view.tsx` vira o "container de vistas").
- **Estado do toggle:** `useState<'progress' | 'compare'>('progress')` no `StudentHomeCard`. Default `'progress'` (Direção: comparação NÃO é veredito de entrada). NÃO usar URL param nesta fatia (estado efêmero é suficiente).
- **Sub-vista detalhada:** segundo estado local dentro de `'compare'`: `compareView: 'table' | 'bars'`, default `'table'`.
- **Invariância do CTA (requisito explícito do Hugo, plano §2.3):** o `NextStepBar` (destino = `resolveContinueHref`) é renderizado pelo `StudentHomeCard` FORA do switch de vistas — é elemento comum, não pertence a nenhuma vista específica. Trocar o toggle NUNCA move nem muda o CTA. Isto precisa de um teste de invariância dedicado (§5.3 item 4 do plano).
- **`suppressComparison` derivado de `totalStudents`:** o `StudentHomeCard` calcula `suppressComparison = unit.totalStudents < 5` (limiar calibrável, documentar a escolha) e passa essa prop para `IndicatorComparisonTable` — a lógica de QUANDO suprimir vive aqui, não dentro do componente de tabela (que só obedece a prop, conforme SH-1.2).
- **`OwnMetricsOnly`** (estado sem unidade) permanece — na prática vira um caso degenerado da manchete sem o toggle de comparação (não há unidade para comparar).
- **Blast radius:** `student-comparison.tsx` (wrapper) e `student-dashboard.tsx` NÃO mudam de contrato — o card novo entra pelo mesmo `<StudentComparison/>`. Confirmar isso ao final (nenhuma prop nova exigida desses dois arquivos).
- **Dev harness:** atualizar `apps/web/src/app/.../preview-desempenho/page.tsx` (ou onde estiver) para o novo container, e seus mocks para incluir os campos opcionais novos (`distinctActiveDays`, mediana) — não obrigatório para type-check passar (campos são opcionais), mas desejável para um preview fiel.

## Acceptance Criteria

- [ ] **AC1:** `StudentHomeCard` (novo componente/container) monta: `StudentProgressHeadline` (SH-1.3) como vista default (`intent: 'progress'`), e o toggle que alterna para `IndicatorComparisonTable` (SH-1.2) ou as barras `SignalRow` (vista detalhada) quando `intent: 'compare'`.
- [ ] **AC2:** O estado default do toggle é `'progress'` — a home abre em "Meu progresso", nunca em "Como me comparo".
- [ ] **AC3:** Dentro de `'compare'`, o sub-estado `compareView` default é `'table'` (a tabela indicador-por-linha é o novo default da comparação, não as barras).
- [ ] **AC4:** As barras `SignalRow` atuais continuam acessíveis (não deletadas), como vista detalhada dentro de `compareView: 'bars'`.
- [ ] **AC5:** Teste de invariância do CTA: alternar o toggle entre `'progress'` e `'compare'` (e entre `compareView: 'table'`/`'bars'`) NÃO altera `href` nem o texto do `NextStepBar` — o componente é renderizado fora do switch de vistas e permanece idêntico.
- [ ] **AC6:** `suppressComparison` é derivado de `unit.totalStudents < 5` (ou limiar documentado) dentro de `StudentHomeCard` e passado como prop para `IndicatorComparisonTable`.
- [ ] **AC7:** `StudentComparisonView` continua exportado com o mesmo nome, e o dev harness `preview-desempenho` continua funcionando sem quebrar (type-check + render manual/smoke).
- [ ] **AC8:** `StudentComparison` (fetch wrapper) e `student-dashboard.tsx` NÃO mudam de contrato de props — confirmado por diff mínimo nesses dois arquivos.
- [ ] **AC9:** `OwnMetricsOnly` (estado sem unidade) continua funcionando, exibindo a manchete sem o toggle de comparação (não há unidade de referência).
- [ ] **AC10:** Suítes `student-comparison-scale.test.ts` e `route-student-view.test.ts` continuam VERDES sem modificação.

## Tasks

- [ ] 1. Confirmar SH-1.1, SH-1.2, SH-1.3 mergeadas (ou disponíveis na branch de integração).
- [ ] 2. Rodar a suíte completa e confirmar VERDE (baseline, first-move rule antes do refactor de decompor `StudentComparisonView`).
- [ ] 3. Criar `StudentHomeCard` orquestrando `StudentProgressHeadline` + toggle + `IndicatorComparisonTable`/`SignalRow`.
- [ ] 4. Implementar o estado do toggle (`intent`) e sub-estado (`compareView`), com defaults corretos (AC2/AC3).
- [ ] 5. Garantir que `NextStepBar` é renderizado fora do switch de vistas (AC5).
- [ ] 6. Implementar a derivação de `suppressComparison` a partir de `unit.totalStudents` (AC6).
- [ ] 7. Decompor `student-comparison-view.tsx` preservando o export `StudentComparisonView` (AC7); mover as barras `SignalRow` para dentro da sub-vista `bars`.
- [ ] 8. Atualizar `preview-desempenho/page.tsx` (dev harness) para o novo container + mocks com os campos novos.
- [ ] 9. Escrever o teste de invariância do CTA (AC5).
- [ ] 10. Rodar a suíte completa novamente e confirmar VERDE ao final (AC10).

## Complexidade & Riscos

- **Complexidade:** L (large). É o ponto de integração de 3 fatias paralelas, envolve refactor de um componente existente (`StudentComparisonView`) com export estável a preservar, e um teste de invariância específico.
- **Riscos:**
  - R1 (médio): decompor `StudentComparisonView` sem preservar o export quebra o dev harness. Mitigação: AC7 explícito + Task 8.
  - R2 (baixo): CTA muda de destino/texto acidentalmente ao trocar o toggle. Mitigação: AC5 + teste dedicado, CTA fora do switch por construção.
  - R3 (baixo): limiar de `suppressComparison` (`< 5`) mal calibrado. Mitigação: documentar a escolha no Dev Agent Record, deixar fácil de ajustar (constante nomeada, não número mágico espalhado).
  - R4 (baixo): esta story só pode começar de verdade depois de SH-1.1/1.2/1.3 — se alguma atrasar, o integrador pode adiantar a estrutura do toggle com dados/componentes mockados, mas o merge final espera as três.

## Dev Notes

- **Esta é a story mais sensível a first-move rule de refactor:** suíte verde ANTES de decompor `StudentComparisonView`, suíte verde do início ao fim.
- Não reabrir nenhuma premissa do epic (§3) — em especial: comparação não lidera (premissa 1), CTA invariante (premissa 8), barras não somem (premissa 7).
- A prop `suppressComparison` e o limiar de `totalStudents` são decisão desta story, mas devem ser documentados claramente para SH-1.5 (que também precisa saber quando a régua "mediana vs média" se aplica).

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web lint
pnpm --filter @eximia/web test -- student-comparison
pnpm --filter @eximia/web test -- student-home-card
pnpm --filter @eximia/web test -- route-student-view
```

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-11 | Story criada a partir do EPIC-STUDENT-HOME + plano de arquitetura (Integração final). | River (SM Agent) |
| 2026-07-11 | Validação PO + ACs fortalecidos (Given/When/Then, teste de invariância cravado, verificação visual E2E, gate de dependência). Veredito GO condicionado à sequência A→B→C. | Contrato (@po) |

---

## PO Validation & Critérios Fortalecidos (@po)

> **Veredito: GO (9,0/10), condicionado.** É o ponto de integração (complexidade L) e a única com dependência dura: SH-1.1 + SH-1.2 + SH-1.3 mergeadas antes do MERGE final. O integrador PODE adiantar a estrutura do toggle com mocks, mas o merge espera as três. Fortalecimento: cravar o teste de invariância do CTA como asserção literal e a verificação visual E2E nas duas rotas reais.

### Given/When/Then por AC

- **AC1/AC2/AC3 (composição + defaults):** *Given* `StudentHomeCard` montando manchete + toggle + vistas; *When* a home abre; *Then* vista default é `intent:'progress'` (`StudentProgressHeadline`), nunca `'compare'`; dentro de `'compare'`, `compareView` default é `'table'` (`IndicatorComparisonTable`), não barras. Prova: `grep -nE "useState.*'progress'|useState<.*'progress'" apps/web/src/components/analytics/student-home-card.tsx`.
- **AC5 (invariância do CTA, cravada):** *Given* `StudentHomeCard` renderizado; *When* alterna `intent` progress↔compare E `compareView` table↔bars; *Then* `href` e texto do `NextStepBar` são IDÊNTICOS em todos os estados. Asserção do teste: capturar `getByRole("link", { name: /continuar/i })` antes e depois do toggle e `expect(hrefAntes).toBe(hrefDepois)`. O `NextStepBar` é renderizado FORA do switch de vistas (prova estrutural, não só de teste).
- **AC6 (suppressComparison do caller):** *Given* `unit.totalStudents`; *When* `< 5` (limiar em constante nomeada, não número mágico); *Then* `suppressComparison=true` é passado ao `IndicatorComparisonTable`. Prova: `grep -nE "totalStudents\s*<\s*[0-9]|SUPPRESS_THRESHOLD|suppressComparison" apps/web/src/components/analytics/student-home-card.tsx`.
- **AC7/AC8 (export estável + contrato do wrapper):** *Given* o dev harness importa `StudentComparisonView`; *When* o arquivo é decomposto; *Then* `grep -rn "StudentComparisonView" apps/web/src/app/dev/preview-desempenho/page.tsx` continua resolvendo, e `git -C apps/web diff --stat src/components/analytics/student-comparison.tsx src/components/dashboard/student-dashboard.tsx` mostra diff mínimo/zero de props (o card novo entra pelo mesmo `<StudentComparison/>`).
- **AC9 (OwnMetricsOnly):** *Given* aluno sem unidade; *Then* manchete renderiza sem o toggle de comparação (caso degenerado, sem régua para comparar).
- **AC10 (suítes intactas):** `student-comparison-scale.test.ts` e `route-student-view.test.ts` verdes sem modificação.

### Comandos de Verificação (exatos)

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
pnpm --filter @eximia/web test        # suíte completa verde (baseline ANTES do refactor + final)
pnpm --filter @eximia/web test -- student-home-card          # inclui o teste de invariância do CTA (AC5)
pnpm --filter @eximia/web test -- student-comparison-scale route-student-view   # AC10, intactos
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web lint
grep -rn "StudentComparisonView" apps/web/src/app/dev/preview-desempenho/page.tsx   # AC7: export preservado
grep -nE "totalStudents\s*<|SUPPRESS" apps/web/src/components/analytics/student-home-card.tsx   # AC6
git -C apps/web diff --stat src/components/analytics/student-comparison.tsx src/components/dashboard/student-dashboard.tsx   # AC8: contrato intacto
```

Verificação visual E2E (esta é a story onde o E2E vale de verdade): `pnpm --filter @eximia/web dev -- -p 3002`, então:
- `http://localhost:3002/dashboard` (como aluno): abre em "Meu progresso" com "Continuar agora" em destaque; togglar para "Como me comparo" mostra a tabela indicador-por-linha; o CTA não se move nem muda de destino.
- `http://localhost:3002/dev/preview-desempenho`: harness renderiza o novo container sem quebrar; barras (`SignalRow`) acessíveis como vista detalhada (`compareView:'bars'`).

### Critério de PRONTO (o par que integrar usa este)

SH-1.1/1.2/1.3 mergeadas; suíte completa VERDE antes de decompor `StudentComparisonView` e verde ao final (first-move de refactor); `StudentHomeCard` com defaults `intent:'progress'`/`compareView:'table'`; teste de invariância do CTA presente e verde (href+texto idênticos entre todos os toggles); `suppressComparison` derivado de `totalStudents < 5` em constante nomeada; export `StudentComparisonView` preservado e harness funcionando; `student-comparison.tsx`/`student-dashboard.tsx` sem mudança de contrato (diff mínimo); barras preservadas como vista detalhada; PostHog fica para SH-1.6 (fora desta story). E2E nas duas rotas confere.

### Placar 10 pontos PO

1. Objetivo/contexto: 1 · 2. ACs testáveis: 1 · 3. Precisão técnica: 1 · 4. Rastreabilidade Art. IV: 1 · 5. Autossuficiência: 1 · 6. Dependências/sequência: 1 (dura, explícita) · 7. Escopo: 1 · 8. Teste runnable: 1 · 9. Riscos+mitigação: 0,5 · 10. Anti-regressão/first-move: 0,5. **Total: 9,0 → GO** (condicionado à sequência A→B→C antes do merge final; começar estrutura com mocks é permitido).
