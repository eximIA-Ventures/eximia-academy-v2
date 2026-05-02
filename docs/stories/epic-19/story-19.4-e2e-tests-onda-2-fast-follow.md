# Story 19.4: E2E Tests — Onda 2 (Fast Follow)

**Epic:** [Epic 19 — Quality Framework & Testes](../../epics/epic-19-ws1-quality-framework-testes.md)
**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** River (SM)
**Status:** Ready
**Story Points:** 5
**Priority:** P1 (fast follow)
**Blocked By:** Story 19.3 (Onda 1 — pattern E2E estabelecido)
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** testes E2E adicionais para smart closing, perfil do aluno, detalhe de sessao e AI detection,
**so that** features avancadas do WS1 sejam validadas automaticamente.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws1-motor-socratico-architecture.md`, Secao 17.7 |
| **PRD Ref** | `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socratico |
| **Stack** | Playwright, MSW v2, Next.js 15 |
| **Risk** | LOW — padrao E2E ja estabelecido na Onda 1 |

---

## Acceptance Criteria

- [ ] **AC1:** `smart-closing.spec.ts`
  - Mestre retorna `is_closing: true` (fixture adaptada)
  - UI mostra indicacao de encerramento (resumo ou mensagem de fechamento)
  - Session status: completed
- [ ] **AC2:** `student-profile-analytics.spec.ts`
  - Manager navega `/analytics/students/[id]`
  - 4 tabs renderizam (Perfil IA, Padroes, Evolucao, Sessoes)
  - Dados do seed visiveis nos componentes
- [ ] **AC3:** `session-detail-analytics.spec.ts`
  - Manager navega `/analytics/sessions/[id]`
  - Analise cognitiva + jornada renderizam
  - Transcript com anotacoes visiveis
- [ ] **AC4:** `ai-detection-flag.spec.ts`
  - Sessao com `likely_ai` verdict (seed data)
  - Badge visivel no dashboard de alertas e perfil do aluno
- [ ] **AC5:** Todos os 4 specs passam com `pnpm e2e`

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Implementar smart-closing.spec.ts
  - [ ] Configurar MSW para Mestre retornar is_closing: true
  - [ ] Verificar UI mostra indicacao de encerramento
  - [ ] Verificar session status = completed
  - [ ] Seed: sessao com interactions_remaining = 1

- [ ] **Task 2** (AC: 2) Implementar student-profile-analytics.spec.ts
  - [ ] Login como manager
  - [ ] Navegar para `/analytics/students/[studentId]`
  - [ ] Verificar: 4 tabs existem e sao clicaveis
  - [ ] Tab "Perfil IA": Kolb scatter visivel, estilo de engajamento
  - [ ] Tab "Padroes": barras de padroes cognitivos
  - [ ] Tab "Evolucao": grafico de profundidade
  - [ ] Tab "Sessoes": tabela com historico
  - [ ] Seed data do learner_profile visivel

- [ ] **Task 3** (AC: 3) Implementar session-detail-analytics.spec.ts
  - [ ] Login como manager
  - [ ] Navegar para `/analytics/sessions/[sessionId]`
  - [ ] Verificar: header com metricas
  - [ ] Tab "Analise Cognitiva": padroes detectados visiveis
  - [ ] Tab "Jornada": grafico de depth progression
  - [ ] Tab "Conversa": transcript com badges de anotacao
  - [ ] Seed: sessao com analytics JSONB completo

- [ ] **Task 4** (AC: 4) Implementar ai-detection-flag.spec.ts
  - [ ] Seed: sessao com ai_detection.verdict = "likely_ai"
  - [ ] Navegar para /analytics: badge de alerta AI visivel
  - [ ] Navegar para perfil do aluno: badge AI na tab "Padroes Cognitivos"
  - [ ] Badge vermelho/amarelo indica deteccao IA

- [ ] **Task 5** (AC: 5) Executar e validar
  - [ ] `pnpm e2e` passa (4 novos specs + 3 da Onda 1)

---

## Dev Notes

### Smart Closing — Fixture Adaptada

O Mestre fixture precisa de variante com `is_closing: true`. Pode ser configurado via MSW request counter ou fixture separada.

### Seed Data Requirements

Os 4 specs usam seed data do analytics. Reutilizar `ANALYTICS_SEED` da Story 19.3 + estender:

```typescript
// Sessao com likely_ai (para ai-detection-flag.spec.ts)
{
  analytics: {
    ...baseAnalytics,
    ai_detection: {
      probability: 0.82,
      verdict: "likely_ai",
      flag: "alta_probabilidade_texto_IA"
    }
  }
}
```

### File Locations

```
tests/e2e/specs/
├── smart-closing.spec.ts              # NOVO
├── student-profile-analytics.spec.ts  # NOVO
├── session-detail-analytics.spec.ts   # NOVO
└── ai-detection-flag.spec.ts          # NOVO
```

### Testing

- 4 specs Onda 2 sao fast follow (apos launch)
- Total E2E apos Onda 2: 7 specs
- Tempo target: < 60s por spec

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
