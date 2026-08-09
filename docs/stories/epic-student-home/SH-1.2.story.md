# SH-1.2: Componente-espinha `IndicatorComparisonTable`

**Epic:** [EPIC-STUDENT-HOME](./EPIC-STUDENT-HOME.md)
**Status:** Draft
**Depende de:** nenhuma bloqueante (consome campos opcionais de SH-1.1 via `?? undefined` se ainda não mergeada)
**Bloqueia:** SH-1.4 (integração monta este componente dentro de `StudentHomeCard`), SH-1.5 (reancoragem liga as linhas de dados a este componente)
**Paralelizável:** SIM — worktree independente. Arquivo NOVO (`indicator-comparison-table.tsx`), zero conflito com SH-1.1/SH-1.3. Único ponto de coordenação: apêndice em `student-comparison-scale.ts` compartilhado com SH-1.3 (regiões distintas do arquivo).

---

## Story

**As a** desenvolvedor implementando o redesign da home do aluno,
**I want** um componente de apresentação pura `IndicatorComparisonTable` que renderize comparação indicador-por-linha (rótulo | Você | Média/Mediana Org | barra comparativa), com destaque quente só onde o sujeito se sobressai e "abaixo" sempre neutro,
**so that** a vista "Como me comparo" (SH-1.4) tenha a espinha visual reaproveitável entre aluno e gestor, banindo o padrão punitivo (vermelho) e o "+525%" enganoso.

## Contexto (Dev Notes)

Ler `01-architecture-plan.md` §1.2, §1.3 e §3.4 antes de começar. Ler a Premissa 4 e 5 do `EPIC-STUDENT-HOME.md` §3 (destaque quente só onde sobressai; componente reaproveitável aluno↔gestor).

- **Onde vive:** `apps/web/src/components/analytics/indicator-comparison-table.tsx` (NOVO, apresentação pura, sem fetch, sem estado de negócio).
- **Reusa `toMetricBar`** de `apps/web/src/components/analytics/student-comparison-scale.ts` — essa função já é a geometria indicador-por-linha (barra proporcional com proteção de divisão por zero). NÃO reimplementar essa lógica.
- **Contrato de props proposto pelo plano** (§1.2) — usar como base, mas o dev pode ajustar nomes desde que a semântica abaixo seja preservada:

```ts
export interface IndicatorRow {
  key: string
  label: string
  subjectValue: number
  referenceValue: number
  format: "pct" | "decimal" | "int"
  referenceLabel?: string   // default "média"
  highlight?: boolean       // true = ESTE indicador é destaque quente
  neutral?: boolean         // true = contexto puro, nunca colore (ex.: Reflexões)
}

export interface IndicatorComparisonTableProps {
  rows: IndicatorRow[]
  subjectLabel: string       // "Você" no aluno; nome do time no gestor
  referenceLabel: string     // "Média da unidade", "Org"
  suppressComparison?: boolean  // esconde "abaixo"/delta, mostra só valores + barra proporcional
  colorScheme?: "biome" | "neutral"
}
```

- **Regras visuais embutidas (não delegar ao caller):**
  - Cada `IndicatorRow` é UMA linha: rótulo | valor do sujeito | valor de referência | barra comparativa embutida.
  - `highlight === true` → cor quente (biome). Comportamento default (sem highlight, sem neutral, "abaixo" da referência) → NEUTRO (cinza), NUNCA vermelho. Isto é uma mudança de semântica em relação ao `DeltaChip` atual (que hoje pinta vermelho quando behind) — o componente novo não reusa `DeltaChip` tal como está; se reaproveitar partes dele, remover a lógica de cor vermelha.
  - A linha/coluna de referência é RÉGUA neutra e mais leve visualmente (espelha `BAR_AVG_FILL` atual, já cinza).
  - `neutral: true` → sem cor de delta nenhuma, é contexto puro (usado por Reflexões em SH-1.5).
  - `suppressComparison: true` → mostra valores e a barra proporcional (honesta por construção, `toMetricBar` usa max compartilhado), mas NÃO pinta "abaixo" nem exibe delta percentual relativo. Isto é a alavanca de mitigação do risco §4 do epic (média distorcida em unidade pequena) — a lógica de QUANDO ativar (`totalStudents < 5`) é responsabilidade do caller (SH-1.4), não deste componente; este componente só obedece a prop.

## Acceptance Criteria

- [ ] **AC1:** `IndicatorComparisonTable` renderiza uma linha por `IndicatorRow`, no formato rótulo | valor do sujeito | valor de referência | barra comparativa, usando `toMetricBar` (ou equivalente) para a geometria da barra.
- [ ] **AC2:** Quando `row.highlight === true`, a linha recebe destaque quente (cor biome). Quando `highlight` é `false`/ausente e o sujeito está "abaixo" da referência, a linha é NEUTRA (cinza) — nunca vermelha, nunca punitiva.
- [ ] **AC3:** Quando `row.neutral === true`, a linha nunca recebe cor de delta, independente de `highlight` ou da comparação de valores — contexto puro.
- [ ] **AC4:** Quando `suppressComparison === true` na prop do componente, nenhuma linha exibe indicação textual/visual de "abaixo" nem delta percentual relativo; os valores brutos e a barra proporcional continuam visíveis.
- [ ] **AC5:** A coluna/linha de referência (média/mediana) é visualmente mais leve/neutra que a coluna do sujeito, em qualquer combinação de props.
- [ ] **AC6:** `colorScheme: "neutral"` desabilita a cor biome mesmo em linhas com `highlight: true` (para o caso de reuso genérico fora do contexto do aluno, se necessário) — comportamento default é `colorScheme: "biome"`.
- [ ] **AC7:** O componente é reaproveitável sem adaptação de dados: um teste (ou snapshot) demonstra o mesmo componente renderizando tanto um cenário "aluno × média da unidade" quanto um cenário "time × org", ambos usando `IndicatorRow[]` derivado de um `ComparableMetricBlock`-like shape (não precisa consumir o tipo real do gestor nesta story — só provar que o contrato de props não amarra a semântica "aluno").
- [ ] **AC8:** Nenhum indicador exibe percentual relativo tipo "+525%" quando a referência tem massa estatística baixa — a decisão de QUANDO suprimir é do caller (`suppressComparison`), mas o componente nunca calcula/exibe delta relativo por conta própria sem seguir essa prop.
- [ ] **AC9:** Testes cobrindo AC2 (highlight vs neutro), AC3 (neutral suprime cor), AC4 (suppressComparison esconde delta) — ao menos 3 casos de teste dedicados, espelhando §5.3 item 1 do plano.

## Tasks

- [ ] 1. Criar `apps/web/src/components/analytics/indicator-comparison-table.tsx` com o contrato de props acima (ajustável).
- [ ] 2. Implementar a renderização de linha reusando `toMetricBar` de `student-comparison-scale.ts`.
- [ ] 3. Implementar a lógica de cor: `highlight` → quente; default/abaixo → neutro; `neutral: true` → sem cor; `colorScheme: "neutral"` → força sem cor biome.
- [ ] 4. Implementar `suppressComparison` (esconde "abaixo"/delta, preserva valores e barra).
- [ ] 5. Escrever os testes de destaque/neutralidade/supressão (AC9).
- [ ] 6. Escrever o teste de reuso (AC7) com dois cenários de dados (aluno-like e time-like).
- [ ] 7. Se aplicável, adicionar um apêndice em `student-comparison-scale.ts` SOMENTE se alguma função pura nova for necessária para alimentar `IndicatorRow[]` a partir de `MetricBar[]` — coordenar com SH-1.3 para não colidir na mesma região do arquivo (ver Dev Notes).

## Complexidade & Riscos

- **Complexidade:** M (medium). Componente novo com regras visuais específicas (cor condicional em 3 eixos: highlight/neutral/suppressComparison), mas sem fetch nem estado assíncrono.
- **Riscos:**
  - R1 (baixo): se este componente e SH-1.3 tocarem a mesma região de `student-comparison-scale.ts` ao mesmo tempo, conflito de merge. Mitigação: cada fatia adiciona funções em BLOCOS SEPARADOS (apêndice no fim do arquivo), conforme o plano §6.2.
  - R2 (baixo): reimplementar a lógica de `toMetricBar` em vez de reusar, duplicando a proteção de divisão por zero. Mitigação: AC1 exige reuso explícito.

## Dev Notes

- **Não depender de SH-1.1 estar mergeada.** Se os campos `distinctActiveDays`/mediana ainda não existirem no tipo real, este componente não precisa deles — ele consome `IndicatorRow[]` já mapeado, e o mapeamento real (SH-1.5) é responsabilidade de outra story. Os testes desta story podem usar dados mockados/inline.
- **Não montar o toggle nem buscar dados aqui.** Esta story é só o componente de apresentação da tabela. O toggle de intenção e a integração com `StudentHomeCard` são SH-1.4.
- Único arquivo de contato com SH-1.3 é `student-comparison-scale.ts` — se ambas as stories precisarem tocá-lo, cada uma adiciona no fim do arquivo, em bloco próprio, para minimizar conflito de merge.

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web lint
pnpm --filter @eximia/web test -- indicator-comparison-table
```

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-11 | Story criada a partir do EPIC-STUDENT-HOME + plano de arquitetura (Fatia B). | River (SM Agent) |
| 2026-07-11 | Validação PO + ACs fortalecidos (Given/When/Then, grep anti-vermelho, verificação visual no harness). Veredito GO. | Contrato (@po) |

---

## PO Validation & Critérios Fortalecidos (@po)

> **Veredito: GO (9,0/10).** Componente puro, contrato de props claro, `toMetricBar` confirmado em `student-comparison-scale.ts:70`. Fortalecimento: transformar a regra semântica "behind = neutro, nunca vermelho" (a decisão de produto mais fácil de violar por hábito) em um grep concreto, e cravar a verificação de reuso (AC7) como asserção de teste, não só intenção.

### Given/When/Then por AC

- **AC1 (uma linha por indicador, reusa toMetricBar):** *Given* `rows: IndicatorRow[]`; *When* renderiza; *Then* uma linha por row (rótulo | sujeito | referência | barra) e `grep -n "toMetricBar" apps/web/src/components/analytics/indicator-comparison-table.tsx` prova o reuso (não reimplementar a proteção de divisão por zero).
- **AC2/AC3 (cor):** *Given* `highlight:true`; *Then* cor quente (biome). *Given* `highlight` ausente e sujeito abaixo da referência; *Then* linha NEUTRA (cinza), nunca vermelha. *Given* `neutral:true`; *Then* sem cor de delta em nenhuma hipótese. Prova por teste dedicado (Testing Library, assertando classe/estilo) e pelo grep de guarda abaixo.
- **AC4 (suppressComparison):** *Given* `suppressComparison:true` na prop; *When* renderiza; *Then* nenhuma linha exibe texto/visual de "abaixo" nem delta percentual relativo; valores brutos e barra proporcional permanecem. O componente NUNCA calcula delta relativo por conta própria (AC8), quem decide QUANDO suprimir é o caller (SH-1.4).
- **AC7 (reuso aluno↔gestor, cravado):** *Given* dois `IndicatorRow[]`, um "aluno × média da unidade" e um "time × org", ambos derivados de um shape `ComparableMetricBlock`-like; *When* o MESMO componente renderiza os dois; *Then* ambos renderizam sem adaptação de dados. Prova: um teste com os dois cenários no mesmo `describe`, ou 2 snapshots, no arquivo de teste desta story.

### Comandos de Verificação (exatos)

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web lint
pnpm --filter @eximia/web test -- indicator-comparison-table   # >= 3 casos (AC9) + caso de reuso (AC7)
ls apps/web/src/components/analytics/indicator-comparison-table.tsx
grep -n "toMetricBar" apps/web/src/components/analytics/indicator-comparison-table.tsx   # AC1: reuso, não reimplementação
# GUARDA anti-punitivo (AC2): "abaixo" nunca vermelho. Nenhuma cor destrutiva no componente:
grep -niE "text-red|bg-red|border-red|destructive|vermelho|#ef|#dc2" apps/web/src/components/analytics/indicator-comparison-table.tsx   # esperado: nada
```

Verificação visual (após SH-1.4 montar o harness): `pnpm --filter @eximia/web dev -- -p 3002` e abrir `http://localhost:3002/dev/preview-desempenho`, confirmar linha-por-indicador, quente só onde sobressai, referência mais leve. Na story ISOLADA, a prova é o teste de render (o harness só existe wired após SH-1.4).

### Critério de PRONTO (o Revisor Lupa usa este)

`typecheck` + `lint` verdes; `indicator-comparison-table.tsx` existe como apresentação pura (sem fetch, sem estado de negócio); reusa `toMetricBar` (grep); grep anti-vermelho retorna VAZIO (behind = neutro provado); `neutral:true` suprime cor; `suppressComparison` esconde delta/"abaixo" mantendo valores+barra; teste de reuso aluno↔gestor (AC7) presente; ≥3 casos de AC9 verdes. Arquivo novo, zero conflito com SH-1.1/SH-1.3 (único contato: apêndice em `-scale.ts`, região distinta de SH-1.3).

### Placar 10 pontos PO

1. Objetivo/contexto: 1 · 2. ACs testáveis: 1 · 3. Precisão técnica: 1 · 4. Rastreabilidade Art. IV: 1 · 5. Autossuficiência: 1 · 6. Dependências: 1 · 7. Escopo: 1 · 8. Teste runnable: 1 · 9. Riscos+mitigação: 0,5 (reuso AC7 agora cravado como asserção) · 10. Anti-regressão/first-move: 0,5 (grep anti-vermelho adicionado). **Total: 9,0 → GO.**
