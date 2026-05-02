# Sprint: Remoção do Dual-Mode (Universidade vs Corporativo)

**Decisão:** O modo dual (universidade/corporativo) será removido. A plataforma será exclusivamente **corporativa**.

**Motivo:** Simplificar a plataforma para foco corporativo. O modo universidade poderá ser reintroduzido futuramente se necessário.

**Impacto:** ~35-40 arquivos em 4 camadas (DB, Types, UI, Tests/Docs)

**Prioridade:** Alta — precede consolidação da plataforma

---

## Estratégia

Remover o campo `mode` de todo o codebase e hardcodar terminologia **corporativa**:
- Cursos → **Trilhas**
- Notas/Frequência → **Competências/ROI**
- Coordenador/Professor/Aluno → **Gestor T&D/Líder/Colaborador**
- Curso/Período → **Setor/Área**
- Frequência → **Competências Ativas**
- Taxa de Aprovação → **ROI de Treinamento**

---

## Stories

### Story R.1 — Remover Dual-Mode do Backend (Types, DB, Validators)

**Status:** Pendente

**Tarefas:**
- [ ] Criar migration nova: `ALTER TABLE tenants DROP COLUMN mode`
- [ ] Criar migration nova: `ALTER TABLE courses DROP COLUMN mode`
- [ ] Drizzle schema `packages/database/src/schema/tenants.ts` — remover campo `mode`
- [ ] Drizzle schema `packages/database/src/schema/courses.ts` — remover campo `mode`
- [ ] Types `packages/shared/src/types/models.ts` — remover `TenantMode`
- [ ] Validators `packages/shared/src/validators/courses.ts` — remover `mode` do schema Zod
- [ ] Deletar ou simplificar `packages/shared/src/constants/mode-config.ts` — exportar apenas labels corporativos fixos
- [ ] Seed `supabase/seed.sql` — remover referências a mode
- [ ] Seed `supabase/seed-remote.ts` — remover referências a mode
- [ ] Server Action `apps/web/src/app/(platform)/admin/settings/actions.ts` — remover mode
- [ ] Server Action `apps/web/src/app/(platform)/courses/actions.ts` — remover mode
- [ ] API routes admin — remover mode dos payloads

**Arquivos afetados:**
- `supabase/migrations/NEW_remove_dual_mode.sql`
- `packages/database/src/schema/tenants.ts`
- `packages/database/src/schema/courses.ts`
- `packages/shared/src/types/models.ts`
- `packages/shared/src/validators/courses.ts`
- `packages/shared/src/constants/mode-config.ts`
- `supabase/seed.sql`
- `supabase/seed-remote.ts`
- `apps/web/src/app/(platform)/admin/settings/actions.ts`
- `apps/web/src/app/(platform)/courses/actions.ts`

---

### Story R.2 — Remover Dual-Mode do Frontend (UI Components)

**Status:** Pendente
**Depende de:** R.1

**Tarefas:**
- [ ] `apps/web/src/components/admin/tenant-settings-form.tsx` — remover seletor de modo
- [ ] `apps/web/src/app/(platform)/courses/_components/course-form-dialog.tsx` — remover dropdown de modo
- [ ] `apps/web/src/components/layout/sidebar.tsx` — hardcodar labels corporativos ("Trilhas")
- [ ] `apps/web/src/components/dashboard/student-dashboard.tsx` — hardcodar "Trilhas"
- [ ] `apps/web/src/components/dashboard/teacher-dashboard.tsx` — hardcodar "Trilhas"
- [ ] `apps/web/src/components/dashboard/manager-dashboard.tsx` — hardcodar "Competências Ativas", "ROI de Treinamento"
- [ ] `apps/web/src/components/onboarding/step-sector.tsx` — unificar para input corporativo (Setor/Área)
- [ ] `apps/web/src/components/providers/tenant-provider.tsx` — remover `mode` do contexto
- [ ] Deletar `apps/web/src/components/dashboard/dual-mode-labels.ts`
- [ ] `apps/web/src/app/(platform)/courses/[courseId]/_components/course-detail-client.tsx` — remover mode display
- [ ] `apps/web/src/app/(platform)/courses/_components/course-card.tsx` — remover mode badge
- [ ] `apps/web/src/app/(platform)/courses/_components/course-table.tsx` — remover mode column

**Arquivos afetados:** 12 componentes

---

### Story R.3 — Atualizar Testes e Documentação

**Status:** Pendente
**Depende de:** R.1, R.2

**Tarefas:**
- [ ] `packages/shared/src/__tests__/mode-config.test.ts` — deletar ou adaptar
- [ ] `apps/web/src/components/dashboard/__tests__/dual-mode-labels.test.ts` — deletar
- [ ] `apps/web/src/components/dashboard/__tests__/student-dashboard.test.tsx` — remover assertions de mode
- [ ] `apps/web/src/components/dashboard/__tests__/teacher-dashboard.test.tsx` — remover testes de dual-mode
- [ ] `apps/web/src/components/dashboard/__tests__/manager-dashboard.test.tsx` — remover testes de mode labels
- [ ] `apps/web/src/components/onboarding/__tests__/step-sector.test.tsx` — simplificar testes
- [ ] `docs/architecture.md` — remover Seção 8.3 (Modos: Universidade vs Corporativo)
- [ ] `docs/prd.md` — atualizar referências a dual-mode
- [ ] `docs/stories/epic-5/story-5.4-dual-mode.md` — marcar como DEPRECATED
- [ ] `docs/qa/gates/5.4-dual-mode.yml` — marcar como DEPRECATED
- [ ] `docs/stories/epic-5/story-5.1-gestao-tenant-admin-panel.md` — remover referências a mode selector
- [ ] `docs/stories/epic-5/story-5.3-onboarding-aluno.md` — remover mode awareness

**Arquivos afetados:** 12+ arquivos (6 testes + 6+ docs)

---

## Critérios de Aceite (Sprint)

- [ ] Nenhuma referência a `TenantMode`, `"university"`, ou dual-mode no código
- [ ] Labels corporativos hardcodados em todos os componentes
- [ ] Migration executada com sucesso (drop column mode)
- [ ] Todos os testes passando
- [ ] Lint e typecheck passando
- [ ] Documentação atualizada
- [ ] Build sem erros

---

## Estimativa

| Story | Complexidade | Estimativa |
|-------|-------------|------------|
| R.1 Backend | Média | ~2h |
| R.2 Frontend | Média | ~2h |
| R.3 Testes/Docs | Baixa | ~1h |
| **Total** | | **~5h** |

---

## Riscos

1. **Migration destrutiva** — perda da coluna mode (irreversível). Mitigação: backup antes.
2. **Referências esquecidas** — grep extensivo necessário pós-implementação.
3. **Testes quebrando em cadeia** — executar testes após cada story.
