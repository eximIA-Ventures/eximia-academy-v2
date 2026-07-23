# EPIC-JORNADA — "Meu plano de estudos" vira Jornada persistida na plataforma oficial

> **Status:** Aberto (2026-07-23)
> **Branch:** `deploy/cory` (working tree com trabalho local não commitado — ver §Riscos)
> **Origem:** GO do Hugo após aprovar a demo pública https://jornada-eximia.vercel.app — "colocar na versão oficial da plataforma, com 3 agentes em paralelo para acelerar".
> **Fonte da verdade de produto:** `JARVIS/apps/jornada-demo/SPEC.md` (19 rounds, especificação de facto de tudo que o Hugo validou).
> **Fonte da verdade de persistência (a EVOLUIR):** `docs/architecture/meu-plano-arquitetura-implementacao.md`.

---

## 1. Visão

A demo aprovada transforma o fluxo "Meu plano de estudos" em **Jornada**: um aluno recém-inscrito (pela empresa) **constrói o próprio plano** arrastando uma timeline de módulos, com dois prazos (meta do gestor âmbar + prazo final como teto duro), confirma com "Começar minha jornada", cai num hub "Minhas jornadas" e num dashboard rico que lê o combinado × realizado. Terminologia: **SEMPRE "jornada" na UI, nunca "plano"** (round 16 da SPEC).

Hoje, a rota `/meu-plano` (stories SH-3.1→3.4) já materializou motores puros TESTADOS de projeção/dashboard, mas **zero persistência** — o "Confirmar meu plano" é só um toast local. Este épico:

1. **Persiste a jornada** (schema + migration + server actions), evoluindo o design nunca-aplicado de `study_plans` para o modelo da demo: **prazos POR MÓDULO** definidos pelo aluno (não só ritmo semanal), **meta do gestor** (campo novo), **preferências** (unidade semanas/dias, auto-ajuste on/off).
2. **Constrói o construtor de timeline** React (drag/cascade/snap/fitDays/presets/revisar) fiel à SPEC.
3. **Constrói o hub + dashboard + integração com a home**, com o dialeto de motion Coreografia.

Princípio inegociável (herdado das SH-3.x): **os motores puros existentes são REUSADOS, nunca reescritos** — `study-plan-projection.ts`, `study-plan-dashboard.ts`, `plan-dashboard-data.ts`, deep-links de `area-gestor.ts`. E **a UI atual (`/meu-plano`) não pode quebrar**: toda leitura de jornada persistida degrada graciosamente para o comportamento de hoje quando não há jornada salva.

---

## 2. Arquitetura de 3 trilhas paralelas — TERRITÓRIOS DE ARQUIVO DISJUNTOS

A regra de ouro para os 3 agentes rodarem em paralelo sem colisão: **cada arquivo tem UM dono.** Arquivos novos ficam em pastas disjuntas; os poucos arquivos compartilhados (barrel do schema, `theme.css`, entrypoint da home) têm dono único explícito abaixo. B e C trabalham contra o **contrato** (`contrato.md`) + mock até A entregar — a mesma fronteira que as SH-3.x já validaram (UI construída sobre função pura antes do dado real existir).

### TRILHA A — Persistência / Backend (ESटE agente)

| Arquivo | Ação |
|---|---|
| `packages/database/src/schema/study-plans.ts` | **NOVO** — schema Drizzle da `study_plans` evoluída |
| `packages/database/src/schema/index.ts` | **EDITA (dono A)** — +1 linha de export |
| `packages/database/src/schema/courses.ts` | **EDITA (dono A)** — +1 coluna `managerDeadlineDays` (meta do gestor) |
| `supabase/migrations/20260723000000_jornada_study_plans.sql` | **NOVO** — migration ESCRITA, **NÃO aplicada** (banco é produção compartilhada; aplicar só com GO do Hugo) |
| `apps/web/src/lib/journey/types.ts` | **NOVO** — o CONTRATO (interfaces `JourneyPlan`, prefs, contexto). Criado por A no Ato 1, importado por B e C |
| `apps/web/src/lib/journey/plan-math.ts` | **NOVO** — funções puras que A e B compartilham (validação, `fitToDeadline`, datas derivadas) |
| `apps/web/src/lib/journey/journey-plan-data.ts` | **NOVO** — camada de dados SSR (lê jornada ativa + contexto do curso, fallback gracioso) |
| `apps/web/src/app/(platform)/jornada/actions.ts` | **NOVO** — server actions (`saveJourneyPlan`/`loadJourneyPlan`/`updateJourneyPlan`) |
| `apps/web/src/lib/journey/__tests__/*` | **NOVO** — vitest das funções puras + contrato |

### TRILHA B — Construtor da timeline + Revisar jornada

| Arquivo | Ação |
|---|---|
| `apps/web/src/lib/journey/timeline-engine.ts` | **NOVO** — motor puro de interação (drag, cascade, snap semanal, `fitDays`, presets Tranquilo/Moderado/Intenso clampados), portado do `app.js` da demo. Importa `plan-math.ts` (dono A) |
| `apps/web/src/app/(platform)/jornada/_components/builder/*` | **NOVO** — componentes React do construtor (timeline arrastável, tabela "Seus módulos em detalhe", banner de consequência, dropdown Sugerir, switch Auto-ajuste, segmentado Semanas/Dias) |
| `apps/web/src/app/(platform)/jornada/_components/review/*` | **NOVO** — "Revisar jornada" com diff antes→depois |
| `apps/web/src/lib/journey/__tests__/timeline-engine.test.ts` | **NOVO** — vitest do motor (portar `proof-teto.js` + `proof-coreografia.js` da demo como asserções) |

### TRILHA C — Hub "Minhas jornadas" + Dashboard + tokens + home

| Arquivo | Ação |
|---|---|
| `apps/web/src/app/(platform)/jornada/_components/hub/*` | **NOVO** — "Minhas jornadas" (3 cards) |
| `apps/web/src/app/(platform)/jornada/_components/dashboard/*` | **NOVO** — dashboard rico (hero, 3 stats, "Sua semana", acompanhamento, Leitura da IA, Visão de Ritmo) |
| `apps/web/src/app/(platform)/jornada/page.tsx` | **NOVO (dono C)** — SSR que roteia hub/dashboard/construtor pelo `status` da jornada (usa `journey-plan-data.ts` de A) |
| `apps/web/src/styles/theme.css` | **EDITA (dono C)** — +tokens `--mo-*` do dialeto Coreografia (append; ver Risco R2) |
| `apps/web/src/components/analytics/student-home-card.tsx` | **EDITA (dono C)** — entrypoint/banner da home aponta p/ `/jornada` (ver Decisão 3) |

**Fronteira de leitura ↔ escrita:** A entrega dados (server-side reads + actions). B/C consomem via contrato. Nenhum arquivo React é editado por A; nenhum schema/migration/action é editado por B/C.

---

## 3. Plano de fases (10 linhas)

1. **A-fase-0 (feito neste turno):** épico + contrato gravados; schema + migration escritos; server actions + camada de dados com fallback; vitest verde.
2. **A-fase-1:** regenerar `types/supabase.ts` — SÓ após Hugo aplicar a migration (Decisão 2). Até lá, A tipa via `study-plans.ts` (Drizzle) + casts controlados.
3. **B-fase-1:** `timeline-engine.ts` puro + testes (independe de A rodar; usa `plan-math.ts`).
4. **B-fase-2:** construtor React sobre mock do contrato → troca mock por `loadJourneyPlan` quando A entrega.
5. **C-fase-1:** tokens Coreografia + hub sobre mock.
6. **C-fase-2:** dashboard reusando `plan-dashboard-data.ts`/`study-plan-dashboard.ts` reancorados no `moduleDurations` persistido.
7. **C-fase-3:** `page.tsx` roteador + integração da home.
8. **Integração:** B+C plugam nas actions reais de A; smoke manual em http://localhost:3002.
9. **Gate:** `pnpm --filter web typecheck` + `pnpm --filter web test` + `biome check` verdes por trilha.
10. **Fechamento:** @devops (exclusivo) faz push/PR; migration aplicada só com GO explícito do Hugo.

---

## 4. Riscos

- **R1 — Banco é produção compartilhada.** A migration é **escrita, nunca aplicada** por nenhum agente. Aplicar `study_plans` + a coluna `courses.manager_deadline_days` exige GO explícito do Hugo, idealmente contra staging/branch antes de `deploy/cory` produção. Mitigação: toda a camada de dados degrada graciosamente se a tabela ainda não existir (try/catch → fallback ao comportamento atual).
- **R2 — `theme.css` compartilhado.** C só faz APPEND dos tokens `--mo-*` (fonte única de duração do dialeto Coreografia), nunca reescreve regras existentes. Se houver colisão de nome de token, prefixar `--mo-` resolve (namespace já isolado na demo).
- **R3 — Working tree com 135 arquivos não commitados** (linha SH-3.x e outros). Cada agente faz `git add` APENAS dos próprios arquivos novos; ninguém commita o que não é seu. **Recomendação ao Hugo: commitar o estado atual do working tree antes da integração final**, para o diff do épico ficar limpo.
- **R4 — Drift `courses.deadline_days`.** A coluna existe no banco (migration `20260405000000_teaching_plan.sql`) mas não no schema Drizzle. A adiciona `deadline_days` + `managerDeadlineDays` ao `courses.ts` nesta rodada, fechando o drift.
- **R5 — Dois modelos de "plano".** O produto atual modela ritmo semanal (`StudyPlanChoice`: dias/sessões/reflFocus); a demo modela **duração por módulo** (timeline arrastável). O contrato adota o modelo da demo como canônico da Jornada; os motores de ritmo semanal permanecem reusados no dashboard (comparação semanal realizado × combinado), sem conflito.

---

## 5. As 3 decisões que precisam do Hugo

**Decisão 1 — Rota e rename.**
- **Recomendação:** criar rota nova **`/jornada`** (termo canônico da UI agora) e transformar `/meu-plano` em **redirect permanente** para `/jornada`. Preserva links existentes, adota o vocabulário novo, e isola o código novo da UI legada (que continua funcionando até o cutover).
- **Alternativa registrada:** evoluir `/meu-plano` no lugar (menos arquivos novos, mas mistura código legado e novo na mesma pasta e mantém o nome "plano" na URL).

**Decisão 2 — Momento de aplicar a migration.**
- A migration `20260723000000_jornada_study_plans.sql` fica **escrita e não aplicada**. O banco do `.env.local` é produção compartilhada (deploy/cory). **Quando e onde aplicar?** Recomendação: aplicar primeiro contra um branch/staging Supabase, validar, e só então produção, com o Hugo presente. Regenerar `types/supabase.ts` logo após.

**Decisão 3 — Destino do toggle/banner da home (meta do gestor incluída).**
- O entrypoint atual (`student-home-card.tsx` / `study-plan-invite-strip.tsx`) aponta para `/meu-plano`. Passa a apontar para `/jornada`? E o cobre com que copy ("Montar minha jornada" / "Ver minha jornada" conforme status)?
- **Sub-decisão (meta do gestor):** "Meta do gestor" é um dado de coorte/curso (a demo cravou `META_DAYS=105`). **Recomendação:** coluna nova `courses.manager_deadline_days` (nullable, mesmo padrão de `deadline_days`), escrita pelo gestor num fluxo FUTURO; v1 usa default/seed ou deriva `deadline_days − 21`. Quem escreve a meta e quando é decisão do Hugo.

---

## 6. Índice de stories

- **Trilha A:** [JRN-A.1](JRN-A.1.story.md) (schema+migration), [JRN-A.2](JRN-A.2.story.md) (server actions), [JRN-A.3](JRN-A.3.story.md) (camada de dados + fallback).
- **Trilha B:** [JRN-B.1](JRN-B.1.story.md) (motor + construtor + revisar) — esqueleto.
- **Trilha C:** [JRN-C.1](JRN-C.1.story.md) (hub + dashboard + tokens + home) — esqueleto.
- **Contrato compartilhado:** [contrato.md](contrato.md).
