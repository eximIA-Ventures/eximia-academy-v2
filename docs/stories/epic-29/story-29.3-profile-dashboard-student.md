# Story 29.3: Profile Dashboard (Student)

**Epic:** [Epic 29 — WS3: Adaptive Learning & Assessments](../../epics/epic-29-ws3-adaptive-learning-assessments.md)
**Version:** 1.0
**Created:** 2026-02-26
**Updated:** 2026-02-26
**Author:** River (SM)
**Status:** Ready for Review
**Story Points:** 5
**Priority:** P0
**Blocked By:** Story 29.1, Story 29.2
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As a** student,
**I want** a unified learning profile dashboard showing my implicit and explicit traits,
**so that** I understand my learning style and get personalized insights.

---

## Acceptance Criteria

- [ ] **AC1:** Page `/profile/learning` com perfil unificado
- [ ] **AC2:** Section "Perfil Implicito": Kolb learning style (se detectado), engagement pattern
- [ ] **AC3:** Section "Big Five": radar chart + insights. Se nao completou: CTA "Descubra seu perfil"
- [ ] **AC4:** Section "DISC": radar chart + tipo dominante. Se nao completou: CTA
- [ ] **AC5:** Section "Insights de Aprendizado": sugestoes personalizadas baseadas no perfil
- [ ] **AC6:** Server action `getStudentProfile(userId)` combina learner_profiles + assessment_history
- [ ] **AC7:** Navigation entry "Meu Perfil" no menu student
- [ ] **AC8:** Responsive (mobile-friendly)
- [ ] **AC9:** Funciona sem assessments (mostra apenas perfil implicito + CTAs)

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Criar pagina
  - [ ] Criar `apps/web/src/app/(platform)/profile/learning/page.tsx`
  - [ ] Layout: sections empilhadas com Cards

- [ ] **Task 2** (AC: 2) Perfil implicito
  - [ ] Buscar learner_profile do user
  - [ ] Mostrar Kolb learning style (se existir): nome + descricao
  - [ ] Mostrar engagement pattern
  - [ ] Se sem dados: "Seu perfil implicito sera construido conforme voce usa a plataforma"

- [ ] **Task 3** (AC: 3) Section Big Five
  - [ ] Se tem assessment big_five: radar chart + scores + insights
  - [ ] Se nao: Card CTA "Descubra seu perfil Big Five" → link para /assessments/big-five
  - [ ] Insights: texto baseado nos scores altos/baixos

- [ ] **Task 4** (AC: 4) Section DISC
  - [ ] Se tem assessment disc: radar chart + tipo dominante + descricao
  - [ ] Se nao: Card CTA "Descubra seu estilo DISC" → link para /assessments/disc

- [ ] **Task 5** (AC: 5) Insights personalizados
  - [ ] Combinar Big Five + DISC + Kolb em insights accionáveis
  - [ ] Ex: "Seu alto Openness + estilo Divergente sugere que voce aprende melhor com exemplos criativos"
  - [ ] 3-5 insights no maximo
  - [ ] Se sem assessments: insights genericos sobre a importancia de completar o perfil

- [ ] **Task 6** (AC: 6) Server action
  - [ ] `getStudentProfile(userId)` em actions
  - [ ] JOIN: learner_profiles + assessment_history (type big_five e disc)
  - [ ] Retornar objecto unificado

- [ ] **Task 7** (AC: 7) Navigation
  - [ ] Adicionar "Meu Perfil" no menu student em navigation.ts

---

## Dev Notes

### Technical Notes

- `learner_profiles` tem campos Kolb (learning style) e engagement pattern — populados implicitamente pelo WS1
- `assessment_history` tem type='big_five' e type='disc' com scores JSONB
- Se aluno nao usou WS1: learner_profile pode nao existir. Tratar como nullable
- Insights sao regras estaticas (if/else por score range), nao IA
- Linguagem nao-julgamental em todos os textos

### File Locations

| Ficheiro | Acao |
|----------|------|
| `apps/web/src/app/(platform)/profile/learning/page.tsx` | CRIAR |
| `apps/web/src/lib/navigation.ts` | MODIFICAR |

### Testing

- Com assessments: mostra radar charts e insights
- Sem assessments: mostra CTAs
- Responsive
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
