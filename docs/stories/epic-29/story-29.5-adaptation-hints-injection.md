# Story 29.5: Adaptation Hints Injection (WS1 Integration)

**Epic:** [Epic 29 — WS3: Adaptive Learning & Assessments](../../epics/epic-29-ws3-adaptive-learning-assessments.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 5
**Priority:** P1
**Blocked By:** Story 29.1, Story 29.2, WS1 (motor pedagogico)
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As a** student,
**I want** the pedagogical engine to adapt its communication style to my profile,
**so that** I have a more effective and personalized learning experience.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws3-platform-evolution-architecture.md`, Secao 4.3 (Adaptation Rules) |
| **Epic Ref** | `docs/epics/epic-29-ws3-adaptive-learning-assessments.md` — Story 29.5 |
| **Stack** | TypeScript, AI SDK |
| **Package** | `apps/web`, `packages/agents`, `packages/shared` |
| **Existing Pattern** | `adaptation_hints` field em sessions, motor WS1 |
| **Risk** | MEDIO — adaptacao perceptivel pode ser negativa (uncanny valley) |

---

## Acceptance Criteria

- [ ] **AC1:** Funcao `buildAdaptationHints(userId)` gera hints baseados no perfil
- [ ] **AC2:** Hints format: `{ communication_style, content_preferences, challenge_level, pace_preference, examples_type }`
- [ ] **AC3:** Integrado no pipeline do Mestre: hints injectados no system prompt antes do dialogo
- [ ] **AC4:** Adaptacao sutil — hints sao sugestoes, nao commands rígidos
- [ ] **AC5:** Funciona sem assessment (fallback para defaults neutros)
- [ ] **AC6:** Hints registrados na session para analytics futura

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 2) Criar buildAdaptationHints
  - [ ] Criar `packages/shared/src/utils/adaptation.ts`
  - [ ] Input: userId
  - [ ] Buscar: learner_profile + assessment_history (big_five, disc)
  - [ ] Gerar hints com regras:
    - Alto Openness (>70): examples_type = "creative", challenge_level = "high"
    - Alto Conscientiousness (>70): content_preferences = "structured", pace_preference = "methodical"
    - Alto Dominance (>70): communication_style = "direct", challenge_level = "high"
    - Alto Influence (>70): examples_type = "storytelling", communication_style = "enthusiastic"
    - Alto Steadiness (>70): pace_preference = "steady", communication_style = "supportive"
  - [ ] Combinar multiplas dimensoes (nao mutuamente exclusivas)
  - [ ] Default (sem assessments): todos "neutral"

- [ ] **Task 2** (AC: 3, 4) Integrar no pipeline do Mestre
  - [ ] Antes de iniciar dialogo: chamar `buildAdaptationHints(userId)`
  - [ ] Adicionar ao system prompt do Mestre como secao `## Adaptation Hints`
  - [ ] Formato no prompt: "O aluno prefere comunicacao directa, exemplos criativos e desafios altos. Adapte seu tom."
  - [ ] Hints sao SUGESTOES — Mestre mantem personalidade propria

- [ ] **Task 3** (AC: 5) Fallback sem assessment
  - [ ] Se nenhum assessment completado: `buildAdaptationHints` retorna defaults
  - [ ] Defaults: communication_style="balanced", content_preferences="mixed", etc.
  - [ ] Nao injectar secao vazia no prompt

- [ ] **Task 4** (AC: 6) Registrar hints na session
  - [ ] Ao iniciar sessao: salvar adaptation_hints usados no campo `adaptation_hints` da session
  - [ ] Campo ja existe na tabela sessions
  - [ ] Permite analytics futura: correlacionar hints com engagement

---

## Dev Notes

### Technical Notes

- `adaptation_hints` field ja existe em sessions table — nao precisa de migration
- Motor pedagogico (WS1 Mestre) esta em `packages/agents/src/` — localizar onde o system prompt e construido
- Adaptacao deve ser SUTIL — o aluno nao deve perceber que o sistema adapta. Se muito obvio, gera rejeicao
- Hints nao mudam o conteudo, apenas o TOM e ESTILO da comunicacao
- Se WS1 nao esta implementado nesta branch: criar a funcao buildAdaptationHints e documentar ponto de integracao

### File Locations

| Ficheiro | Acao |
|----------|------|
| `packages/shared/src/utils/adaptation.ts` | CRIAR |
| `packages/agents/src/` (ponto de integracao WS1) | MODIFICAR (quando disponivel) |

### Testing

- User com Big Five alto O → hints incluem "creative"
- User com DISC alto D → hints incluem "direct"
- User sem assessments → defaults neutros
- `pnpm typecheck` passa

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-26 | 1.0 | Story criada a partir do Epic 29 | River (SM) |

---

## Dev Agent Record

### Agent Model Used
_(preenchido pelo dev agent)_

### Debug Log References
_(preenchido pelo dev agent)_

### Completion Notes List
_(preenchido pelo dev agent)_

### File List
_(preenchido pelo dev agent)_

---

## QA Results
_(preenchido pelo QA agent)_
