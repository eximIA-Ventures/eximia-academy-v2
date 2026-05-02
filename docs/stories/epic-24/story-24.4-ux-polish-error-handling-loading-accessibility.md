# Story 24.4: UX Polish — Error Handling, Loading States, Accessibility

**Epic:** [Epic 24 — WS2: Quality: Tests, Benchmarks & Polish](../../epics/epic-24-ws2-quality-tests-benchmarks-polish.md)
**Version:** 1.0
**Created:** 2026-02-16
**Updated:** 2026-02-16
**Author:** River (SM)
**Status:** Ready
**Story Points:** 5
**Priority:** P1 (polish — funcionalidade core já existe)
**Blocked By:** Epic 22
**Blocks:** None
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** que o Course Creator tenha error handling claro, loading states visuais e seja acessível,
**so that** eu tenha uma experiência de uso polida e inclusiva.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws2-course-creator-architecture.md`, Seções 14, 19 |
| **PRD Ref** | `Benchmarks/07_Course_Designer/PRD-Course-Designer-v1.0.md` — WS2: Course Creator |
| **Stack** | Next.js 15, React, TypeScript, @eximia/ui, axe-core |
| **Package** | `apps/web` |
| **Existing Pattern** | `@eximia/ui` components (Toast, Alert, Skeleton, Modal), `docs/design-system-guide.md` |
| **Risk** | LOW — melhorias incrementais |

---

## Acceptance Criteria

- [ ] **AC1:** Error handling em todos os formulários do wizard
  - Validação inline: erros exibidos abaixo de cada campo em vermelho
  - Toast para erros de API: mensagem clara + ação sugerida
  - Retry button para operações que falharam
  - Mensagens em português (Brasil)
- [ ] **AC2:** Loading states
  - Skeleton loading no Blueprint Viewer enquanto carrega
  - Spinner no "Preencher com IA" durante processamento
  - DesignProgress com animação durante geração
  - Disabled state em botões durante operações async
  - Optimistic updates para edição de blueprint
- [ ] **AC3:** Edge cases tratados
  - Wizard: refresh não perde dados (URL params)
  - Pipeline timeout: mensagem clara + opção de retry
  - Blueprint vazio (0 módulos): mensagem explicativa
  - Arquivo upload > 10MB: mensagem de limite
  - Curso sem chapters (Path B): warning
  - Concurrent editing: last-write-wins com warning
- [ ] **AC4:** Accessibility (WCAG 2.1 AA)
  - Keyboard navigation: wizard navegável via Tab/Enter
  - Focus management: focus move para próximo step ao avançar
  - Screen reader: aria-labels em todos os componentes visuais
  - Color contrast: verificar tokens contra WCAG AA ratios
  - FrameworkStageBar: aria-label com percentuais (não só cor)
  - QualityScorecard: valores numéricos acessíveis (não só visual)
- [ ] **AC5:** Empty states
  - Lista de blueprints vazia: "Nenhum blueprint criado. Comece criando o design do seu curso."
  - Nenhum framework encontrado: fallback message
- [ ] **AC6:** Confirmação antes de ações destrutivas
  - Deletar blueprint: modal de confirmação
  - Aplicar blueprint: confirmação com resumo (N chapters, N questions serão criados)
  - Descartar edições: "Tem certeza? Alterações não salvas serão perdidas."

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Implementar error handling nos formulários do wizard
  - [ ] Adicionar validação inline com erros abaixo de cada campo em vermelho
  - [ ] Implementar Toast para erros de API com mensagem clara + ação sugerida
  - [ ] Adicionar Retry button para operações que falharam
  - [ ] Garantir todas as mensagens em português (Brasil)

- [ ] **Task 2** (AC: 2) Implementar loading states
  - [ ] Adicionar Skeleton loading no Blueprint Viewer enquanto carrega
  - [ ] Adicionar Spinner no "Preencher com IA" durante processamento
  - [ ] Implementar DesignProgress com animação durante geração
  - [ ] Adicionar disabled state em botões durante operações async
  - [ ] Implementar optimistic updates para edição de blueprint

- [ ] **Task 3** (AC: 3) Tratar edge cases
  - [ ] Wizard: persistir dados em URL params para sobreviver a refresh
  - [ ] Pipeline timeout: mensagem clara + opção de retry
  - [ ] Blueprint vazio (0 módulos): mensagem explicativa
  - [ ] Arquivo upload > 10MB: mensagem de limite
  - [ ] Curso sem chapters (Path B): warning
  - [ ] Concurrent editing: last-write-wins com warning

- [ ] **Task 4** (AC: 4) Implementar accessibility (WCAG 2.1 AA)
  - [ ] Keyboard navigation: wizard navegável via Tab/Enter
  - [ ] Focus management: focus move para próximo step ao avançar
  - [ ] Screen reader: aria-labels em todos os componentes visuais
  - [ ] Color contrast: verificar tokens contra WCAG AA ratios
  - [ ] FrameworkStageBar: aria-label com percentuais (não só cor)
  - [ ] QualityScorecard: valores numéricos acessíveis (não só visual)
  - [ ] Validar com axe-core no E2E

- [ ] **Task 5** (AC: 5) Implementar empty states
  - [ ] Lista de blueprints vazia: "Nenhum blueprint criado. Comece criando o design do seu curso."
  - [ ] Nenhum framework encontrado: fallback message

- [ ] **Task 6** (AC: 6) Implementar confirmação antes de ações destrutivas
  - [ ] Deletar blueprint: modal de confirmação usando Modal do @eximia/ui
  - [ ] Aplicar blueprint: confirmação com resumo (N chapters, N questions serão criados)
  - [ ] Descartar edições: "Tem certeza? Alterações não salvas serão perdidas."

- [ ] **Task 7** (AC: 1-6) Validar typecheck e zero console errors
  - [ ] Rodar `pnpm typecheck` — deve passar sem erros
  - [ ] Verificar zero console errors no browser
  - [ ] Testar keyboard navigation funciona no wizard

---

## Dev Notes

### Technical Notes

Usar componentes `@eximia/ui` existentes: Toast, Alert, Skeleton, Modal. Accessibility pode ser validada com `axe-core` no E2E.

```typescript
// Exemplo: Toast para erro de API
toast.error({
  title: "Erro ao gerar blueprint",
  description: "O pipeline não respondeu em tempo. Tente novamente.",
  action: { label: "Retry", onClick: () => handleGenerate() }
})
```

```typescript
// Exemplo: Modal de confirmação para ação destrutiva
<Modal open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
  <ModalContent>
    <ModalHeader>Confirmar exclusão</ModalHeader>
    <ModalBody>
      Tem certeza que deseja deletar este blueprint? Esta ação não pode ser desfeita.
    </ModalBody>
    <ModalFooter>
      <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancelar</Button>
      <Button variant="destructive" onClick={handleDelete}>Deletar</Button>
    </ModalFooter>
  </ModalContent>
</Modal>
```

LEMBRETE: Todas as cores devem usar theme tokens (`bg-bg-card`, `text-text-primary`, etc.). Zero hardcoded hex/rgba values.

**Quality Gates:**

| Gate | Validation | Blocker |
|------|-----------|---------|
| Pre-Commit | `pnpm typecheck` passa | Yes |
| Pre-PR | Zero console errors no browser | Yes |
| Pre-PR | Keyboard navigation funciona no wizard | Yes |

### File Locations

```
apps/web/src/app/(platform)/courses/new/design/_components/  # ATUALIZAR (múltiplos)
apps/web/src/app/(platform)/courses/[courseId]/blueprint/_components/  # ATUALIZAR (múltiplos)
```

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-16 | 1.0 | Story creation | River (SM) |
| 2026-02-16 | 1.1 | PO validation: GO — Status Draft → Ready | Pax (PO) |

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
