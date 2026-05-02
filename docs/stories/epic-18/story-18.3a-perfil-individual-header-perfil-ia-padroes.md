# Story 18.3a: Perfil Individual — Header, Perfil IA e Padroes Cognitivos (`/analytics/students/[id]`)

**Epic:** [Epic 18 — Analytics & Output Analitico Avancado](../../epics/epic-18-ws1-analytics-output-analitico.md)
**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** River (SM)
**Status:** Ready
**Story Points:** 5
**Priority:** P0 (core)
**Blocked By:** Story 18.1 (API endpoints)
**Blocks:** Story 18.3b
**Assigned To:** @dev

---

## User Story

**As a** manager,
**I want** ver o perfil IA e os padroes cognitivos de um aluno,
**so that** eu entenda o estilo de aprendizado e os padroes comportamentais do aluno.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws1-motor-socratico-architecture.md`, Secao 16 (UC2, D2) |
| **PRD Ref** | `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socratico |
| **Stack** | Next.js 15 (RSC + Client), recharts, @eximia/ui (Tabs) |
| **Design Tokens** | `apps/web/src/styles/theme.css` |
| **Risk** | MEDIUM — Kolb scatter + divergencia teste vs IA |

---

## Acceptance Criteria

- [ ] **AC1:** Pagina `/analytics/students/[id]` com tabs
  - Usar `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` do `@eximia/ui`
  - 4 tabs: Perfil IA, Padroes Cognitivos, Evolucao, Sessoes
  - URL compartilhavel, espaco completo
- [ ] **AC2:** `StudentProfileHeader` — avatar, nome, badge plano, ultima sessao, total sessoes
  - Reutilizar componentes existentes (Avatar, Badge do @eximia/ui)
- [ ] **AC3:** Tab "Perfil IA"
  - `KolbScatterPlot` — ponto no plano 2D (individual, nao turma)
  - Estilo de engajamento, raciocinio, orientacao, profundidade media, trend, confianca, QA score
  - `DivergenceTable` — comparacao teste vs IA por dimensao (Kolb, DISC)
  - Badge para divergencias significativas
- [ ] **AC4:** Tab "Padroes Cognitivos"
  - `CognitivePatternBars` — top padroes recorrentes (ultimas 10 sessoes, BarChart horizontal)
  - Valores implicitos, mecanismos de defesa, readiness medio
  - Alertas: deteccao IA, resistencia persistente, breakthroughs
- [ ] **AC5:** Auth: apenas manager/admin do tenant
- [ ] **AC6:** Consultar `docs/design-system-guide.md` antes de criar componentes
- [ ] **AC7:** `pnpm typecheck` passa

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1) Criar pagina e tabs
  - [ ] Criar `apps/web/src/app/[tenant]/analytics/students/[studentId]/page.tsx`
  - [ ] Usar Tabs do @eximia/ui com 4 tabs
  - [ ] RSC para dados iniciais + Client components para interatividade

- [ ] **Task 2** (AC: 2) Implementar StudentProfileHeader
  - [ ] Criar `apps/web/src/components/analytics/StudentProfileHeader.tsx`
  - [ ] Avatar, nome, badge do plano do tenant, ultima sessao, total sessoes
  - [ ] Usar Card do @eximia/ui como container

- [ ] **Task 3** (AC: 3) Implementar Tab "Perfil IA"
  - [ ] `KolbScatterPlot` — recharts ScatterChart individual (1 ponto no plano 2D)
  - [ ] Eixos: grasping (-1 a +1), transforming (-1 a +1)
  - [ ] Overlay: ponto do teste (WS3) se existente, vs ponto da IA
  - [ ] Card com estilo, raciocinio, orientacao, profundidade, trend, confianca
  - [ ] `DivergenceTable` — DataTable comparando teste vs IA por dimensao

- [ ] **Task 4** (AC: 4) Implementar Tab "Padroes Cognitivos"
  - [ ] `CognitivePatternBars` — recharts BarChart horizontal (top padroes ultimas 10 sessoes)
  - [ ] Valores implicitos, mecanismos de defesa, readiness medio
  - [ ] Alertas inline (badges: deteccao IA, resistencia, breakthroughs)

- [ ] **Task 5** (AC: 5) Auth guard
  - [ ] Verificar role manager/admin no RSC

- [ ] **Task 6** (AC: 6, 7) Design system compliance e validacao
  - [ ] Consultar `docs/design-system-guide.md`
  - [ ] `pnpm typecheck` passa

---

## Dev Notes

### Kolb Scatter — Individual vs Turma

Na Story 18.2b o `KolbTeamScatter` mostra toda a turma. Aqui o `KolbScatterPlot` mostra 1-2 pontos:
- Ponto IA (do Perfilador): grasping_axis, transforming_axis
- Ponto Teste (do WS3): se aluno fez teste Kolb formal (user_profiles)
- Divergencia visual entre os dois pontos

### Divergence Table

| Dimensao | Teste (WS3) | IA (Perfilador) | Badge |
|---|---|---|---|
| Kolb | Convergente | Divergente (68%) | Alta |
| DISC | D (Dominancia) | I (Influencia) | Alta |
| Big Five openness | 0.7 | — | Sem IA |

### Tabs Structure (Tabs do @eximia/ui)

```tsx
<Tabs defaultValue="perfil-ia">
  <TabsList>
    <TabsTrigger value="perfil-ia">Perfil IA</TabsTrigger>
    <TabsTrigger value="padroes">Padroes Cognitivos</TabsTrigger>
    <TabsTrigger value="evolucao">Evolucao</TabsTrigger>
    <TabsTrigger value="sessoes">Sessoes</TabsTrigger>
  </TabsList>
  <TabsContent value="perfil-ia">...</TabsContent>
  <TabsContent value="padroes">...</TabsContent>
  <TabsContent value="evolucao">...</TabsContent>
  <TabsContent value="sessoes">...</TabsContent>
</Tabs>
```

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 16, D2]

### File Locations

```
apps/web/src/app/[tenant]/analytics/students/[studentId]/
└── page.tsx                        # NOVO

apps/web/src/components/analytics/
├── StudentProfileHeader.tsx        # NOVO
├── KolbScatterPlot.tsx             # NOVO
├── DivergenceTable.tsx             # NOVO
└── CognitivePatternBars.tsx        # NOVO
```

### Testing

- Testes E2E no Epic 19 (Story 19.4 — student-profile-analytics.spec.ts)
- Validar: tabs renderizam, dados do seed visiveis

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
