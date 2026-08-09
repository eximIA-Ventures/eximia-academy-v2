# Meu Plano de Estudos — Arquitetura de Dados e Plano de Implementação

> **Status:** PLANO — nenhuma migration foi executada, nenhum componente React foi editado.
> **Autor:** Planejador (Maestri, terminal arquiteto), a pedido do Maestro/Hugo.
> **Data:** 2026-07-21
> **Repo/branch:** `eximia-academy-v2` @ `deploy/cory`
> **Cruza a fronteira de escopo estabelecida em SH-3.1** ("weekly-plan persistence is a future story — schema not yet decided with Hugo"). Autorizado por Hugo: *"sim, é agora"*.

---

## 1. Fontes desta rodada

1. `docs/stories/epic-student-home/SH-1.5.story.md` → `SH-3.2.story.md` (Change Logs completos) — lidos via subagente de exploração.
2. `docs/architecture/meu-plano-metodologia-pesquisa.md` (ciência de goal-setting, 282 linhas) — lido integralmente.
3. `docs/architecture/meu-plano-por-curso-pesquisa.md` (plano por curso + course workload estimation, 210 linhas) — lido integralmente.
4. `JARVIS/apps/hub-discovery/meu-plano-sintese-completa.html` (síntese executiva) — lido integralmente.
5. **Link do ChatGPT (`https://chatgpt.com/share/6a5ebe7e-8168-83e9-a531-0dfb7a8363b5`) — NÃO PÔDE SER LIDO.** Devo registrar isto com transparência: `WebFetch` retornou só o shell da SPA (conversa carregada via XHR pós-hidratação, não SSR). Tentei `curl` com UA de browser (1.1MB de HTML, sem payload de conversa embutido — nem `__NEXT_DATA__`, nem RSC stream, nem `client-bootstrap`) e os dois padrões prováveis de endpoint público (`backend-api/share/{id}`, `backend-api/public/conversation/{id}`) devolveram `403` (bloqueio anti-bot da OpenAI, não uma falha de autenticação corrigível por mim). Não tentei contornar o bloqueio — seria o tipo de ação que este protocolo não autoriza sozinho.
   - **O que isso significa na prática:** o raciocínio textual do Hugo naquela conversa está ausente deste documento. Compensei com os **5 screenshots que o Hugo descreveu com fidelidade no briefing** (que dão a estrutura de tela quase completa) + as 3 pesquisas already-lidas (que cobrem o "porquê" científico/de mercado que a conversa provavelmente também cobriu) + arqueologia de código real. Julgo que a base é sólida o bastante para um plano técnico, mas **se a conversa tinha uma decisão específica de schema/algoritmo que os screenshots não capturam, ela não está refletida aqui.**
   - **Recomendação:** se o Hugo tiver a conversa aberta, colar o texto bruto (Ctrl+A no chat) num arquivo e eu re-leio numa rodada de refinamento antes da Fatia 1 começar. Não bloqueante para o restante do documento.
6. Arqueologia de código real: `packages/database/src/schema/*.ts`, `supabase/migrations/*.sql`, `apps/web/src/lib/analytics/{area-gestor,student-home-indicators,study-plan-projection,ritmo-summary}.ts`, `apps/web/src/app/(platform)/meu-plano/**`, `apps/web/src/app/api/analytics/student/route.ts`.
7. RLS de `study_plans` desenhado por `@data-engineer` real (invocado via Agent tool, ver §6.2) — não decidi esse ponto sozinho, por instrução explícita do briefing.

---

## 2. Estado atual (o que já existe — reuso, não reinvenção)

| Conceito da tela | Fonte real hoje | Observação |
|---|---|---|
| Progresso do curso | `enrollments.progress` (jsonb `{percentage}` ou number) | Não é granular por módulo. |
| "Ritmo esperado" (own-pace) | `computeStudentComparison` → `subject.expectedProgressPct` (SH-2.7): `elapsedDays/deadlineDays` da enrollment líder | `courses.deadline_days` existe no banco (migration `20260405000000_teaching_plan.sql`) mas **não está no schema Drizzle** (`courses.ts`) — drift pré-existente, não introduzido por mim, útil registrar aqui porque `study_plans` vai depender dele. |
| "Interações" (realizado) | tabela `sessions` (id, `student_id`, `chapter_id`, `question_id`, `tenant_id`, `status`, `created_at`, `completed_at`) | 1 linha ≈ 1 sessão de diálogo socrático por capítulo. `interactionsMax` = nº de capítulos da trilha (1 por capítulo, comentário em `student-home-indicators.ts:103`). |
| "Reflexões" (realizado) | tabela `slide_reflections` (id, `student_id`, `slide_id`, `tenant_id`, `response`, `created_at`, UNIQUE(student_id, slide_id)) | `reflectionsMax` = nº de `chapter_slides` cujo `text_content` tem ≥1 bloco de reflexão (`countReflectionPossibleSlides`). |
| Estrutura do curso | `courses` → `chapters` (order, `estimated_duration_minutes` nullable) → `chapter_slides` (order, `text_content`) | Granularidade por capítulo/slide já existe — suficiente para "por módulo", não precisa de tabela nova de estrutura. |
| Status "Concluído" por módulo | Derivado: existe `sessions` com `status='completed'` para aquele `chapter_id` (ver `apps/web/src/app/api/analytics/student/route.ts:41-55`, mesma lógica em `student-dashboard-page.tsx:177`) | **Não é um campo persistido** — é sempre calculado a partir de `sessions`. `study_plans` deve seguir o MESMO padrão para módulo, não reinventar. |
| Motor de projeção (gap → sessões) | `apps/web/src/lib/analytics/study-plan-projection.ts` (`computeStudyPlanProjection`) — PURO, testado, já usado por `/meu-plano` | `PT_PER_SESSION = 1.5` é constante **ilustrativa**, marcada como placeholder no próprio código. Reuso total, não reescrever. |
| Tela `/meu-plano` atual (SH-3.1→SH-3.2) | `page.tsx` (SSR, monta `StudyPlanDiagnostic`) + `meu-plano-client.tsx` (estado local `useState`, "Confirmar meu plano" é só toast) | **Zero persistência hoje** — é exatamente a fronteira que este documento cruza. |
| Entidade não relacionada (não confundir) | `consciousness_responses` (pre/post por curso, `learningGoal`/`commitment`/`selfRating`) | É um ritual de curso inteiro (fase pré/pós), não um plano semanal. Não toca nesta arquitetura. |

**Confirmação das 3 hipóteses do briefing (item 3 da tarefa):**

- **3b confirmado:** "Realizado" não precisa de tabela nova — deriva de `sessions` (interações) e `slide_reflections` (reflexões), com filtro de data. Isso é literalmente o mesmo padrão que `computeStudentComparison` já usa para o acumulado total; só falta o filtro de janela semanal.
- **3c confirmado, com ajuste:** `chapters`/`chapter_slides` já têm granularidade suficiente para "quantidade esperada" por módulo (1 interação/capítulo, N reflexões = slides-com-reflexão daquele capítulo). **Não** precisa de tabela nova de estimativa — precisa de uma função pura que DISTRIBUI essa quantidade ao longo do tempo (ver §5.3), usando o peso de custo do eixo 3 da pesquisa (reflexão ≫ interação em custo/tempo, Rice: ~45min/página de reflexão vs. leitura simples).
- **3a:** plano por curso (não global) — confirmado tanto pela pesquisa (Dilution Model, Zhang/Fishbach/Kruglanski) quanto pelo fato de `expectedProgressPct`/`deadline_days` já serem por-enrollment. `study_plans` é escopado por `enrollment_id`.

---

## 3. Arquitetura de dados proposta

### 3.1 Tabela nova: `study_plans`

Um plano semanal **ativo** por enrollment (1 curso = 1 plano; sem plano global do aluno). Histórico de recálculos **não é versionado em v1** — recalcular MUTA a linha ativa (`updated_at`/`recalculated_at` registram quando). Trade-off deliberado: reconstruir "o que estava planejado" para uma semana passada, se o plano mudou desde então, não é perfeito em v1 (reflete o padrão ATUAL, não o histórico exato). Caminho de evolução futura, se o produto precisar: tabela `study_plan_snapshots` (não construir agora — não superengenheirar antes de confirmar que o produto precisa).

```
study_plans
├── id                       uuid PK
├── enrollment_id            uuid FK → enrollments(id) CASCADE
├── student_id               uuid FK → users(id) CASCADE        (denormalizado, mesmo padrão de consciousness_responses)
├── course_id                uuid FK → courses(id) CASCADE      (denormalizado, idem)
├── tenant_id                uuid FK → tenants(id) CASCADE      (denormalizado, obrigatório p/ RLS — ver §6.2 pergunta 3)
├── status                   text CHECK ('active'|'paused'|'completed'), default 'active'
├── weekly_pattern           jsonb NOT NULL   -- {days: boolean[7] Seg-first, sessionsPerDay: int, reflFocus: boolean}
├── start_date               date NOT NULL
├── target_completion_date   date NULL        -- NULL quando o curso não tem deadline_days (degrada como StudyPlanDiagnostic.daysLeft)
├── recalculated_at          timestamptz NULL -- última vez que "Recalcular automaticamente" rodou
├── created_at                timestamptz
└── updated_at                timestamptz
```

`weekly_pattern` espelha **literalmente** a interface `StudyPlanChoice` já existente em `study-plan-projection.ts` — zero remapeamento entre o que a tela já calcula e o que se persiste. Índice único parcial garante 1 plano ativo por enrollment (`WHERE status = 'active'`).

### 3.2 Derivação "Planejado × Realizado" da semana (Tela 1, tabela inferior direita + Tela 2)

Semana = calendário (Segunda 00:00 → Domingo 23:59), porque `weekly_pattern.days` é indexado por dia-da-semana real (Seg=0), não por offset desde `start_date`. Mesma simplicidade de timezone que o resto do código já usa (`Date.now()` direto, sem conversão explícita de fuso).

- **Planejado.sessões** = `chosenDays × sessionsPerDay` (do `weekly_pattern` ATUAL — constante por semana até o próximo recálculo).
- **Planejado.reflexões** = `reflFocus ? chosenDays : 0`.
- **Realizado.sessões** = `COUNT(sessions) WHERE student_id=X AND status IN (mesmo filtro que area-gestor.ts já usa) AND chapter_id IN (SELECT id FROM chapters WHERE course_id=study_plans.course_id) AND created_at BETWEEN weekStart AND weekEnd`.
- **Realizado.reflexões** = `COUNT(slide_reflections) WHERE student_id=X AND slide_id IN (SELECT id FROM chapter_slides WHERE chapter_id IN (chapters do curso)) AND created_at BETWEEN weekStart AND weekEnd`.
- **Situação** = `Cumprido` (realizado ≥ planejado) | `N pendente` (planejado − realizado, semana ainda em curso ou passada) — mesma linguagem dos 2 screenshots.

**Regra de não-duplicação:** a contagem de "sessões"/"reflexões" realizada aqui DEVE reusar exatamente o mesmo predicado de filtro (`status`, joins) que `computeStudentComparison`/`area-gestor.ts` já usa para o acumulado — só adicionando o `BETWEEN weekStart AND weekEnd` e o escopo por curso. Se a implementação reescrever esse filtro do zero, os números de "Meu ritmo" (acumulado) e "Meu plano" (semanal) podem divergir silenciosamente — risco concreto a vigiar na Fatia 2.

### 3.3 Derivação "Sua jornada planejada" por módulo (Tela 1, tabela inferior esquerda)

Para cada `chapter` do curso, ordenado por `order`:

- **Interações (esperado)** = 1 (convenção já estabelecida, `interactionsMax` = 1/capítulo).
- **Reflexões (esperado)** = `COUNT(chapter_slides WHERE chapter_id = X AND countReflectionBlocks(text_content) > 0)` — reuso direto de `countReflectionPossibleSlides`, só agrupado por capítulo em vez de somado na trilha inteira.
- **Status** = `Concluído` se existe `sessions.status='completed'` para esse `chapter_id` (mesma lógica de `completedChapters` em `api/analytics/student/route.ts`) · `Em andamento` se é o capítulo "continue" (sessão ativa, ou próximo capítulo sem sessão completa, mesma lógica de `continueChapterId`) · `Planejado` caso contrário.
- **Prazo sugerido** = distribuição proporcional ao CUSTO de cada capítulo, não uniforme. Custo pondera reflexão >> interação (eixo 3 da pesquisa, Rice: reflexão ≈ 45min/página vs. leitura simples):

  ```
  custo(capítulo) = INTERACTION_COST × interações_esperadas + REFLECTION_COST × reflexões_esperadas
  ```

  `REFLECTION_COST / INTERACTION_COST` é uma constante **ilustrativa e configurável** (proponho começar em `3`, mesmo espírito de honestidade do `PT_PER_SESSION` já existente — não é um número validado, é um ponto de partida a calibrar com o Hugo/produto). Prazo sugerido do capítulo N = `start_date + (custo_acumulado_até_N / custo_total_do_curso) × (target_completion_date − start_date)`. Graceful degradation: se `target_completion_date` é NULL, a coluna "Prazo sugerido" fica vazia (mesmo padrão de `daysLeft: null` já usado em `study-plan-projection.ts`), nunca inventa uma data.

### 3.4 Fluxo "Recalcular automaticamente" (Tela 2)

Operacionaliza o texto do próprio screenshot: *"ajusto seu plano para que você siga no ritmo, **mantendo sua data de conclusão**"* — `target_completion_date` é o ANCLE, nunca muda no recálculo automático. O que muda é `weekly_pattern`, redistribuindo o déficit pelas semanas restantes (nunca tudo na próxima semana — isso seria "plano-canhão", contra o Spacing Effect da pesquisa, P2).

```
déficit = max(0, planejado_semana_atual − realizado_semana_atual)   // por sessões e por reflexões, mesmo cálculo
semanas_restantes_depois_desta = ceil(dias_até(target_completion_date) / 7) − 1

SE semanas_restantes_depois_desta <= 0:
  → NÃO finge que redistribuiu. Expõe um estado novo explícito ("plano em risco, sem semanas
    para absorver o déficit sem mudar a data") e oferece ao aluno: mover a data OU aceitar o
    déficit como está. (Este é um estado de verdict novo, não coberto pelo motor atual —
    ver Fatia 4.)
SENÃO:
  extra_por_semana = ceil(déficit_sessões / semanas_restantes_depois_desta)
  nova_sessionsPerDay = min(5, sessionsPerDay_atual + ceil(extra_por_semana / chosenDays))
    // preferir aumentar sessões/dia nos MESMOS dias já escolhidos antes de adicionar um dia novo
    // (P1 da pesquisa: implementation intention é ancorada em QUANDO/ONDE específicos — trocar
    // os dias do hábito já formado tem custo maior que intensificá-lo)
  SE nova_sessionsPerDay > 5 (teto do produto, já existe em meu-plano-client.tsx):
    → adicionar 1 dia à semana em vez de violar o teto, escolhendo o próximo dia
      não-selecionado mais próximo dos dias já ativos (evita espalhar demais)
  reflexões seguem reflFocus (se ligado, cada dia ativo carrega 1 reflexão — adicionar dia
  já adiciona reflexão automaticamente; não precisa de lógica own separada)
```

Função pura proposta: `recalculateWeeklyPattern(currentPattern, deficit, weeksRemaining): StudyPlanChoice | "at-risk"` — mesmo espírito testável e determinístico de `computeStudyPlanProjection`, em `study-plan-projection.ts` (extensão do módulo já existente, não arquivo novo — mesma família de funções puras).

"Manter como está" = no-op. Não precisa de campo novo em v1 (`recalculated_at` continua NULL/antigo); se o produto quiser depois medir quantas vezes o aluno recusou, adiciona-se um campo então.

---

## 4. Contrato de dados / API

**Server-side (SSR, `meu-plano/page.tsx`, estende o que já existe):**
- `diagnostic: StudyPlanDiagnostic` — **inalterado**, já funciona.
- NOVO `activePlan: StudyPlanRecord | null` — a linha `study_plans` ativa da enrollment líder, se existir. Se existir, hidrata o `choice` inicial do client (em vez de sempre abrir em `DEFAULT_STUDY_PLAN_CHOICE`) e determina a ROTA: **existe plano ativo → renderiza Tela 1 (dashboard "Meu Plano")**; **não existe → renderiza a tela de configuração já implementada (SH-3.2)**. Essa é uma decisão mecânica orientada a dado, não uma escolha visual — a escolha visual/de composição de componente fica para a fatia de implementação e, se for grande, para @ux-design-expert.
- NOVO `weeklyComparison: { weekStart, weekEnd, planned: {sessions, reflections}, realized: {sessions, reflections}, situation }` — §3.2.
- NOVO `moduleJourney: Array<{ chapterId, title, order, suggestedDeadline: string | null, interactionsExpected, reflectionsExpected, status }>` — §3.3.

**Server Actions novas** (mesmo padrão já usado no repo — `actions.ts` colocado, ex. `trails/dashboard/actions.ts`), em `meu-plano/actions.ts`:
- `confirmStudyPlan(choice: StudyPlanChoice): Promise<void>` — upsert (insert se não existe plano ativo pra essa enrollment; update de `weekly_pattern` se já existe). Substitui o `setConfirmed(true)` local-only atual.
- `recalculateStudyPlan(): Promise<{ pattern: StudyPlanChoice } | { atRisk: true }>` — roda a fórmula de §3.4 server-side, persiste, retorna o novo padrão (ou o estado "em risco").
- `keepCurrentPlan(): Promise<void>` — no-op v1 (existe só para simetria de UI/telemetria futura).

---

## 5. Migration proposta

`supabase/migrations/20260721000000_weekly_study_plans.sql` (mesmo padrão raw-SQL das migrations mais recentes deste repo — `chapter_slides`/`slide_reflections` também não têm schema Drizzle, só migration + `packages/database/src/types/supabase.ts` regenerado; `study_plans` segue o MESMO padrão, não introduz um terceiro jeito de definir tabela).

```sql
-- =============================================================
-- Weekly Study Plans: study_plans table (Meu Plano de Estudos)
-- PROPOSTA / PLANO — não implementado, não aplicado.
-- =============================================================

BEGIN;

CREATE TABLE study_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  weekly_pattern JSONB NOT NULL,
  start_date DATE NOT NULL,
  target_completion_date DATE,
  recalculated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE study_plans IS 'One active weekly study commitment per student per course (enrollment-scoped, SH-3.x "Meu plano de estudos"). History is NOT versioned in v1 — recalculation mutates the active row.';
COMMENT ON COLUMN study_plans.weekly_pattern IS 'Mirrors StudyPlanChoice (study-plan-projection.ts): {days:boolean[7], sessionsPerDay:number, reflFocus:boolean}.';

CREATE UNIQUE INDEX idx_study_plans_one_active ON study_plans(enrollment_id) WHERE status = 'active';
CREATE INDEX idx_study_plans_student_tenant ON study_plans(student_id, tenant_id);
CREATE INDEX idx_study_plans_tenant ON study_plans(tenant_id);

CREATE OR REPLACE FUNCTION set_study_plans_updated_at_fn()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER set_study_plans_updated_at
  BEFORE UPDATE ON study_plans
  FOR EACH ROW
  EXECUTE FUNCTION set_study_plans_updated_at_fn();

-- =============================================================
-- Row Level Security (desenhada por @data-engineer real, ver §6.2)
-- =============================================================

ALTER TABLE study_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sp_student_select" ON study_plans FOR SELECT
  USING (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  );

-- Variante B (recomendada pelo data-engineer): prova que enrollment_id/course_id
-- pertencem de fato a este student_id+tenant_id, fechando o gap de integridade
-- referencial que RLS pinada só em student_id/tenant_id não cobre.
CREATE POLICY "sp_student_insert" ON study_plans FOR INSERT
  WITH CHECK (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
    AND auth_user_role() = 'student'
    AND EXISTS (
      SELECT 1 FROM enrollments e
      WHERE e.id = study_plans.enrollment_id
        AND e.student_id = study_plans.student_id
        AND e.course_id = study_plans.course_id
        AND e.tenant_id = study_plans.tenant_id
    )
  );

CREATE POLICY "sp_student_update" ON study_plans FOR UPDATE
  USING (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  )
  WITH CHECK (
    student_id = auth.uid()
    AND tenant_id = auth_tenant_id()
  );

-- Instrutor/manager/admin: SÓ LEITURA (coaching/observação). Recalcular em nome
-- do aluno, se algum dia for necessário, é uma RPC SECURITY DEFINER dedicada,
-- nunca uma policy de escrita ampla — decisão do data-engineer, não revisitar
-- sem nova consulta.
CREATE POLICY "sp_content_role_select" ON study_plans FOR SELECT
  USING (
    tenant_id = auth_tenant_id()
    AND auth_user_role() IN ('instructor', 'manager', 'admin')
  );

CREATE POLICY "sp_super_admin" ON study_plans FOR ALL
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Sem policy de DELETE para humanos por design: "parar de estudar" é
-- status → 'paused'/'completed' (soft). Deleção só via CASCADE ou super-admin.

COMMIT;
```

Após aplicar (fora do escopo desta fase): regenerar `packages/database/src/types/supabase.ts` (mesmo processo já usado para `chapter_slides`/`slide_reflections`).

### 6.2 As 4 perguntas de RLS respondidas pelo `@data-engineer` (não decidi sozinho, por instrução do briefing)

1. **Instrutor/manager podem escrever em nome do aluno?** Não — RLS fica read-only para staff. Recalcular-em-nome-de é caso de uso separado (RPC `SECURITY DEFINER`), não uma policy de UPDATE ampla.
2. **DELETE?** Não para humanos. "Pausar"/"encerrar" é sempre `UPDATE status`. Hard delete só via `ON DELETE CASCADE` (quando a enrollment/usuário é removido) ou super-admin.
3. **`tenant_id` denormalizado é necessário mesmo com `enrollment_id`?** Sim — mantém como predicado direto de RLS (indexável, auditável, garantido no momento do INSERT), mesmo padrão que `consciousness_responses` já usa apesar de também ter `enrollment_id`.
4. **Risco de vazamento específico desta tabela?** Sim: as 4 chaves denormalizadas (`enrollment_id`/`student_id`/`course_id`/`tenant_id`) criam superfície para inconsistência referencial que tabelas-folha como `slide_reflections` não têm (elas só denormalizam 1-2 chaves). O `EXISTS` no INSERT (variante B acima) fecha esse gap.

---

## 7. Plano de implementação em fatias (ordem sugerida)

| # | Fatia | Escopo | Depende de |
|---|---|---|---|
| 1 | Persistência básica | Migration (§5) + regenerar types + `confirmStudyPlan` (server action) substituindo o `setConfirmed` local-only + SSR passa a ler `activePlan` e hidratar o `choice` inicial | — |
| 2 | Planejado × Realizado semanal | `weekly-plan-comparison.ts` (função pura, §3.2) + wiring na tabela inferior direita da Tela 1 + caixa de alerta | Fatia 1 |
| 3 | Jornada planejada por módulo | `module-journey.ts` (função pura, §3.3, pondera reflexão > interação) + wiring na tabela inferior esquerda da Tela 1 | Fatia 1 |
| 4 | Recalcular plano | `recalculateWeeklyPattern` (função pura, §3.4, incl. estado "em risco") + `recalculateStudyPlan` (server action) + Tela 2 completa | Fatias 1-2 |
| 5 | Dashboard "Meu Plano" (Tela 1) | Banner + 4 stat cards + "Seu plano sugerido" + "Sua semana" — a montagem visual completa dos 5 screenshots. Maior fatia de UI; recomendo passar por @ux-design-expert antes do dev, já que aqui a composição visual pesa mais que dado. A tela de configuração SH-3.2 já implementada vira o destino de "Ajustar plano →"/"Revisar plano →". | Fatias 1-4 |

Cada fatia é testável isoladamente (funções puras primeiro, wiring depois — mesmo padrão que `study-plan-projection.ts` já validou nas stories anteriores).

## 8. Decisões em aberto para o Hugo

1. **Conteúdo da conversa do ChatGPT não recuperado** (§1, item 5) — se houver uma decisão específica lá que diverge deste plano, preciso do texto colado para reconciliar antes da Fatia 1.
2. **`REFLECTION_COST/INTERACTION_COST = 3`** (§3.3) é um chute inicial ilustrativo, não validado — mesmo status que `PT_PER_SESSION` já tem hoje. Calibrar com dado real depois que a Fatia 3 estiver rodando (comparar `suggestedDeadline` previsto vs. tempo real que alunos levam por capítulo).
3. **Sem versionamento de histórico de plano em v1** (§3.1) — aceito como trade-off deliberado; se o produto precisar de "o que estava planejado na semana 3" com fidelidade histórica perfeita, isso vira uma tabela `study_plan_snapshots` numa rodada futura.
