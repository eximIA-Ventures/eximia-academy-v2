# Story 19.5: Golden Dataset & Quality Benchmark (Fase 1)

**Epic:** [Epic 19 — Quality Framework & Testes](../../epics/epic-19-ws1-quality-framework-testes.md)
**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** River (SM)
**Status:** Ready
**Story Points:** 5
**Priority:** P1 (pre-launch)
**Blocked By:** None (independente — pode ser paralelo com outras stories)
**Blocks:** None
**Assigned To:** @dev + @qa

---

## User Story

**As a** product manager,
**I want** um Golden Dataset e framework de benchmark para avaliar a qualidade do novo pipeline,
**so that** possamos validar a troca de modelos antes do launch.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws1-motor-socratico-architecture.md`, Secao 10 (Fase 1) |
| **PRD Ref** | `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socratico |
| **Stack** | TypeScript, AI SDK, Zod |
| **Risk** | MEDIUM — requer golden dataset curado manualmente |

---

## Acceptance Criteria

- [ ] **AC1:** Golden Dataset com 50+ conversas em `tests/benchmarks/golden-dataset/`
  - Cobertura: 4 tipos de interacao (socratic_dialogue, quiz, scenario, assignment)
  - Cobertura: hard skill + soft skill
  - Cobertura: 4 perfis (reflexivo longo, impulsivo curto, resistente, usando IA)
  - Cobertura: profundidade superficial (1-2), media (3-5), avancada (6-7)
  - Cobertura: casos-limite ("nao sei", ofensivo, resposta perfeita, off-topic)
- [ ] **AC2:** Script de benchmark em `tests/benchmarks/run-benchmark.ts`
  - Roda Golden Dataset em pipeline Standard + Premium (referencia)
  - Gera output por combo
  - Calcula metricas automaticas: Guardiao avg score, rejection rate, schema compliance, latencia P95
- [ ] **AC3:** Quality Scorecard interface:
  - `human_eval_avg`, `guardian_avg_score`, `guardian_rejection_rate`, `guardian_false_positive_rate`, `guardian_false_negative_rate`, `schema_compliance_rate`, `p95_latency_ms`, `quality_delta_vs_premium`
- [ ] **AC4:** Criterios de aprovacao documentados:
  - Score medio >= 4.0/5.0
  - Delta vs Premium <= -0.3
  - Schema compliance >= 98%
- [ ] **AC5:** Relatorio gerado em `tests/benchmarks/reports/` (gitignored)

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Criar Golden Dataset
  - [ ] Criar estrutura `tests/benchmarks/golden-dataset/`
  - [ ] Subdiretorios: `socratic-dialogue/`, `quiz/`, `scenario/`, `assignment/`
  - [ ] Cada conversa: arquivo JSON com input (mensagem aluno) + context (capitulo, historico)
  - [ ] Cobertura por dimensao:
    - 4 tipos de interacao (min 10 conversas cada)
    - 2 temas: hard skill (SCRUM, financas) + soft skill (lideranca, comunicacao)
    - 4 perfis: reflexivo longo, impulsivo curto, resistente, usando IA
    - 3 faixas de profundidade: superficial, media, avancada
    - 5 casos-limite: "nao sei", ofensivo, resposta perfeita, off-topic, monossilabico
  - [ ] Total: 50+ conversas curadas

- [ ] **Task 2** (AC: 2) Implementar script de benchmark
  - [ ] Criar `tests/benchmarks/run-benchmark.ts`
  - [ ] Carregar golden dataset
  - [ ] Rodar cada input em pipeline Standard (modelos do plano Standard)
  - [ ] Rodar cada input em pipeline Premium (referencia — all gpt-4.1)
  - [ ] Coletar: Guardiao score, schema validity, latencia
  - [ ] Gerar output por combo em `tests/benchmarks/reports/`

- [ ] **Task 3** (AC: 3) Definir Quality Scorecard
  - [ ] Interface TypeScript:
    ```typescript
    interface BenchmarkMetrics {
      human_eval_avg: number
      guardian_avg_score: number
      guardian_rejection_rate: number
      guardian_false_positive_rate: number
      guardian_false_negative_rate: number
      schema_compliance_rate: number
      p95_latency_ms: number
      quality_delta_vs_premium: number
    }
    ```
  - [ ] Calcular metricas automaticas a partir dos resultados

- [ ] **Task 4** (AC: 4) Documentar criterios GO/NO-GO
  - [ ] Score medio >= 4.0/5.0
  - [ ] Delta vs Premium <= -0.3
  - [ ] Schema compliance >= 98%
  - [ ] Documentar em `tests/benchmarks/README.md`

- [ ] **Task 5** (AC: 5) Gerar relatorio
  - [ ] Output em `tests/benchmarks/reports/` (adicionar ao .gitignore)
  - [ ] Formato: JSON + markdown summary
  - [ ] Incluir metricas por tipo de interacao, por perfil, por profundidade

---

## Dev Notes

### Golden Dataset — Formato

```json
{
  "id": "sd-001",
  "type": "socratic_dialogue",
  "theme": "hard_skill",
  "topic": "SCRUM",
  "profile": "reflexivo_longo",
  "depth_target": "media",
  "chapter_content": "O Scrum Master facilita...",
  "conversation": [
    {
      "role": "user",
      "content": "Eu acho que o Scrum Master e tipo um gerente de projeto, nao?"
    }
  ],
  "expected_quality": {
    "min_depth_layer": 3,
    "should_question_assumption": true,
    "should_end_with_question": true
  }
}
```

### Benchmark Execution

O benchmark roda contra APIs **reais** (nao mockadas). Requer:
- `OPENAI_API_KEY` valida
- `DEEPSEEK_API_KEY` valida (para plano Standard)
- Tempo estimado: ~30 min para 50 conversas x 2 combos

### Avaliacao Humana (Futuro)

A avaliacao humana cega (3-5 avaliadores) e parte da Fase 1 do Quality Framework mas esta **fora do escopo** desta story. O script de benchmark prepara os dados para a avaliacao humana gerar pares de respostas anonimizados.

### File Locations

```
tests/benchmarks/
├── golden-dataset/
│   ├── socratic-dialogue/     # 10+ conversas
│   ├── quiz/                  # 10+ conversas
│   ├── scenario/              # 10+ conversas
│   └── assignment/            # 10+ conversas
├── run-benchmark.ts           # NOVO
├── README.md                  # NOVO (criterios GO/NO-GO)
└── reports/                   # NOVO (gitignored)
    ├── benchmark-standard.json
    └── benchmark-premium.json
```

### Testing

- Benchmark e executado manualmente (nao em CI)
- Resultado e input para decisao GO/NO-GO do PM

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-15 | 1.0 | Story creation | River (SM) |
| 2026-02-15 | 1.1 | PO validation: GO (10/10). Status Draft → Ready | Pax (PO) |

---

## Dev Agent Record

### Agent Model Used
_To be filled by @dev_

### Debug Log References
_To be filled by @dev_

### Completion Notes List
_To be filled by @dev_

### File List
_To be filled by @dev_

---

## QA Results
_To be filled by @qa_
