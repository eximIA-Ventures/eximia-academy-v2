# E11: Testes + Hardening (Cenário Canônico)

**Epic:** [00-EPIC-OVERVIEW](./00-EPIC-OVERVIEW.md)
**Status:** Draft
**Depende de:** E1–E10 (todas)
**Bloqueia:** fechamento do epic

---

## Story

**As a** time de engenharia,
**I want** uma suíte de testes automatizados cobrindo os pontos de escopo mais sensíveis do Centro de Engajamento,
**so that** uma regressão futura no filtro de escopo (a Regra Absoluta do epic) seja pega por CI, não por um gestor real vendo dados de outro time.

## Contexto (Dev Notes)

Ler `00-EPIC-OVERVIEW.md` Seção 2 (Regra Absoluta de Escopo) e Seção 7 (DoD do epic) antes de começar. Esta story é o hardening final — testes incrementais já devem ter sido escritos dentro de cada story anterior (E2 AC8, E3 AC9); esta story fecha as lacunas, adiciona o teste de cenário end-to-end e faz uma varredura final.

- Não é escopo desta story reimplementar nada de E1–E10 — é escopo GARANTIR que o comportamento entregue está coberto por teste e é resiliente.
- Comandos reais confirmados do repo: `pnpm --filter @eximia/web lint` (biome), `pnpm --filter @eximia/web typecheck` (tsc --noEmit), `pnpm --filter @eximia/web test` (vitest run).

## Acceptance Criteria

- [ ] **AC1:** Teste unitário para `classifyNudgeCohorts` + cohort `behind_teaching_plan` (E2) com um fixture sintético de alunos cobrindo os 5 tipos de cohort simultaneamente, confirmando que cada aluno cai em exatamente o(s) cohort(s) correto(s) e nenhum aluno "vaza" para um cohort que não deveria.
- [ ] **AC2:** Teste unitário para a dismissal de 7 dias por `manager_id + type` (E2 AC4): dispensar como Gestor A não afeta Gestor B; reaparecimento após 8 dias se o sinal persistir; supressão continua ativa no dia 6.
- [ ] **AC3:** Teste unitário para `sender_identity`/`sender_name` afetando o corpo renderizado da mensagem (E2 AC6), cobrindo os dois exemplos exatos da Seção 11 do report (saudação como gestor vs. como plataforma).
- [ ] **AC4:** Teste unitário para `resolveAudienceScoped` (E3 AC1) cobrindo os 4 perfis de `resolveCallerStudentScope`: admin/super_admin (tenant-wide, `null`), manager (subtree via `includeSubtree:true`), instructor (união por área), e qualquer outro papel (fail-closed `[]`).
- [ ] **AC5:** Teste de "vazamento" para cada uma das 5 rotas de `api/engagement/*` (E3 AC9): payload/contexto tentando alcançar um `studentId` fora do escopo do caller autenticado retorna erro apropriado (400/403) ou lista vazia, NUNCA dados do aluno de fora.
- [ ] **AC6:** `computeStudentAction` (`student-triage.ts`) NÃO foi modificado por este epic (decisão do orquestrador 2026-07-08, ver E10/E6). Verificar: a suíte existente `apps/web/src/lib/__tests__/student-triage.test.ts` permanece verde e inalterada, e `git diff` do epic não toca `student-triage.ts`. ADICIONALMENTE, teste unitário para a NOVA função de derivação server-side de `nudgeType` a partir do `ritmo` (E6 AC10): `atrasado` → `behind_teaching_plan`, `nao_iniciado`/`totalSessions===0` → `never_accessed`, demais → `inactive`.
- [ ] **AC7:** TESTE DE CENÁRIO CANÔNICO END-TO-END (o mais importante desta story): simular o cenário Rinaldo/Meu Time com 6 alunos (fixture de dados: 1 tenant, 1 gestor com um `manager_group` de 6 membros, mais um conjunto adicional de alunos do MESMO tenant fora desse grupo — o "13 alunos" do exemplo do report) e confirmar, chamando as camadas reais (engine + resolveAudienceScoped, não mocks superficiais que escondam o bug):
  - `GET /api/engagement/overview` para o gestor retorna cards e sugestões computados só sobre os 6, nunca sobre os 13.
  - `GET /api/engagement/history` para o gestor retorna só notificações endereçadas aos 6.
  - Uma tentativa de campanha/ação visando um `studentId` fora dos 6 é rejeitada.
- [ ] **AC8:** Rodar `pnpm --filter @eximia/web lint`, `pnpm --filter @eximia/web typecheck`, `pnpm --filter @eximia/web test` no repositório inteiro (não só nos arquivos tocados por este epic) e confirmar 0 erros novos introduzidos pelas 10 stories anteriores.
- [ ] **AC9:** Revisão final da kill list (E10 AC7) confirmando que nenhum item voltou a aparecer após a bateria de testes (regressão visual/funcional rápida).
- [ ] **AC10:** Os 10 critérios de aceite do epic (`00-EPIC-OVERVIEW.md` Seção 7) revisados um a um nesta story, cada um marcado como satisfeito com a evidência (teste automatizado, verificação manual, ou ambos) registrada no Dev Agent Record.

## Tasks

- [ ] 1. Auditar quais testes já existem de E2/E3 (AC8 de E2, AC9 de E3) e identificar lacunas.
- [ ] 2. Escrever os testes faltantes de AC1 a AC6.
- [ ] 3. Construir o fixture de dados do cenário canônico (tenant + gestor + 6 alunos no grupo + 7 alunos extras no mesmo tenant fora do grupo = 13 total).
- [ ] 4. Escrever o teste end-to-end de AC7.
- [ ] 5. Rodar a suíte completa do repo (lint/typecheck/test) e corrigir qualquer regressão.
- [ ] 6. Revisar a kill list (AC9).
- [ ] 7. Preencher a tabela de evidência do DoD do epic (AC10) no Dev Agent Record.

## Complexidade & Riscos

- **Complexidade:** L (large). Suíte de testes cobrindo todas as camadas + fixture do cenário canônico + varredura final do repo.
- **Riscos:**
  - R1 (alto): o teste canônico end-to-end (AC7) é inútil se for superficial (mockar `resolveCallerStudentScope` para devolver os 6 ids esconde exatamente o bug que ele deveria pegar). Mitigação: Dev Notes proíbe explicitamente; o teste deve exercitar a resolução real a partir do `manager_group`.
  - R2 (médio): pode ser inviável rodar contra Postgres real em CI. Mitigação: seguir o padrão de teste já usado por `resolveCallerStudentScope`/`getManagedTeamStudentIds` no repo (Task 1 audita o padrão existente).
  - R3 (baixo): regressão introduzida por E1-E10 no resto do repo. Mitigação: AC8 roda a suíte inteira, não só arquivos tocados.

## Regra Absoluta de Escopo (verificação)

É o objeto central desta story: AC7 é a prova operacional de que a Regra não é aspiração de design mas comportamento verificado por CI. Blocker de fechamento do epic.

## Dev Notes

- O teste do AC7 é o que mais importa nesta story — é a prova operacional de que a Regra Absoluta de Escopo do epic não é só uma aspiração de design, é um comportamento verificado. Se este teste não existir ou for superficial (ex.: mockar `resolveCallerStudentScope` para sempre retornar os 6 ids em vez de exercitar a resolução real a partir do `manager_group`), a story não está completa.
- Onde for inviável rodar contra um banco Postgres real em CI, usar o padrão de teste já estabelecido no repo para camadas que dependem de Supabase (verificar como `resolveCallerStudentScope`/`getManagedTeamStudentIds` já são testados hoje, se houver testes existentes, e seguir o mesmo padrão de client mockado/fixture).

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
pnpm --filter @eximia/web lint
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web test
```

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-08 | Story criada | River (SM Agent) |
| 2026-07-08 | PO: AC6 reescrito para refletir decisão do orquestrador (computeStudentAction não muda; testar a nova derivação server-side). Complexidade & Riscos. Validada GO (9/10). | Pax (@po) |

## PO Validation: GO

**Verdict:** GO — **9/10** — 2026-07-08 — @po (Pax)

Hardening bem desenhado. Comandos reais confirmados (`biome check ./src`, `tsc --noEmit`, `vitest run`). AC7 (cenário canônico end-to-end com fixture de 6+7=13 alunos) é a joia da story, e a Dev Notes acerta ao proibir explicitamente o mock superficial que esconderia o bug. AC6 reescrito para casar com a decisão do orquestrador: verificar que `student-triage.ts` NÃO mudou (suíte existente verde) + testar a NOVA função de derivação de E6. AC10 amarra os 10 critérios do DoD do epic com evidência.
**Nota para devs:** o teste AC7 DEVE exercitar `resolveCallerStudentScope` real a partir do `manager_group` — mocká-lo para devolver os 6 ids invalida o teste inteiro.
