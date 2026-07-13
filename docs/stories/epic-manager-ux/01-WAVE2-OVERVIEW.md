# EPIC-MANAGER-UX / Onda 2, OVERVIEW: Detalhes dos Alunos, funil de decisão do gestor

> Status: SPECS PRONTAS PARA VALIDAÇÃO DO SENHOR, NADA IMPLEMENTADO.
> Onda: 2 · Data: 2026-07-07
> Origem: 2 pranchas de design do Hugo (R1 diagnóstico, R2 proposta) + mockup da tela (R3), paths em `docs/stories/epic-manager-ux/design/`.
> Decisões do Hugo (2026-07-07, inegociáveis): **D-A** a onda é REORGANIZAÇÃO da leitura da tela (funil: recorte → destaques → tabela), mantendo a arquitetura; **D-B** a coluna Ação é ligação INDIVIDUAL com o sistema de nudges existente (endpoint rico, array de 1); **D-C** detalhe do aluno (expansão de linha, perfil completo, futura visão detalhada) é EXCLUSIVO de instrutor/admin, gestor NUNCA, e o strip LGPD server-side permanece.

## Norte da onda

A tela do gestor hoje é um painel de dados: KPIs genéricos, analytics, tabela com 8 colunas que exigem interpretação manual. A Onda 2 a transforma num **funil de decisão** em três estágios: (1) **recorte**, quem estou analisando; (2) **destaques**, o sistema pré-computa a triagem; (3) **investigação**, a tabela responde caso a caso. Os 4 verbos do gestor (quem está ativo, quem parou, quem avança, quem precisa de atenção) deixam de ser inferência do usuário e viram campos calculados server-side, com uma única taxonomia canônica (seção Taxonomia) compartilhada por cards, destaques e tabela.

Nenhuma superfície nova é criada nem dado novo coletado: a onda reorganiza o que a Onda 1 já entrega (RPCs de escopo, buckets, nudge), reduzindo colunas, pré-computando status e ordenando os blocos no funil.

## Referência de design

- **R1** `docs/stories/epic-manager-ux/design/01-diagnostico-detalhes-alunos.pdf`: prancha de diagnóstico com os 9 problemas da tela atual (mapeados na tabela abaixo).
- **R2** `docs/stories/epic-manager-ux/design/02-proposta-detalhes-alunos.pdf`: proposta "Possíveis mudanças", 5 blocos: recortes, destaques, tabela simplificada, ações do gestor, detalhe futuro.
- **R3** `docs/stories/epic-manager-ux/design/03-mockup-tela-principal.png`: mockup: header "Detalhes dos Alunos", bloco "Quem estou analisando?" com pills Diretos/Hierarquia/Todos os times, 4 cards (Alunos analisados 6, No ritmo 3 (50%), Atenção 1 (17%), Sem acesso 2 (33%)), Destaques em 3 colunas (a terceira é "SEM ACESSO RECENTE"), tabela com colunas Aluno/Time/Último acesso/Ritmo/Progresso/Engajamento/Ação e badges No ritmo/Lembrar/Acionar.

## Estado atual (recon verificado 2026-07-07, arquivo:linha)

- **Server data:** `apps/web/src/app/(platform)/dashboard/_components/manager-dashboard-page.tsx`. Strip LGPD server-side (`recentSessions`/`recentReflections` zerados para gestor) na L159. `paceHighlights` nas L215-265: por enrollment ATIVO em curso com `deadline_days`, `expectedPct = min(100, round((diasDesdeMatricula / deadline_days) * 100))` (L244), `status` ahead/on_track/behind (L253). Enrollment `completed` fica fora; `progress` null vira 0 e cai em behind (não existe "não iniciado" hoje).
- **Client:** `apps/web/src/components/dashboard/manager-dashboard.tsx`. Ordem atual dos blocos: hero "Olá, {nome}" (L76), `teamRecortePanel` (L86), `teachingPlanHighlights` (L89), `SummaryCards` KPIs genéricos (L92), quick actions, Socratic KPIs, `ManagerDashboardClient` analytics (L143), `StudentInsightsTable` com `expandable={false}` (L153).
- **Tabela compartilhada:** `apps/web/src/components/analytics/student-insights-table.tsx`. `getEngagementScore = completedSessions*2 + reflectionsCount` (L70), `columnCount = showSubteam ? 8 : 7` (L145), `DIRECT_KEY = "__direct__"` (L165). Colunas: Nome, Time (funil multi-select), Email, Último Acesso, Sessões, Engajamento, Cursos, Progressão.
- **Buckets:** `apps/web/src/lib/engagement-helpers.ts`, `INACTIVE_DAYS=14` (L67), `AT_RISK_DAYS=5` (L68), 3 buckets exclusivos (inativos > devendo > accessed), razão "atras_cronograma" vem da RPC SECURITY DEFINER `auth_team_engagement_signals` (migration `supabase/migrations/20260703010000_auth_team_engagement_signals.sql`).
- **Nudge rico:** `POST /api/analytics/manager/nudge` (`apps/web/src/app/api/analytics/manager/nudge/route.ts`), validação manual (`UUID_RE`, `studentIds` 1..200, `NUDGE_TYPES` enum) `studentIds: string[] (1..200)`, gate `hasRole(roles,"manager")` estrito + re-scope server-side; dispatch via `dispatchTeamNudge` (`apps/web/src/lib/notifications/engine.ts:674`), in-app + email + funil de eficácia. Chamado hoje por bucket em `team-engagement-header.tsx:194`. Array de tamanho 1 = nudge individual completo, nada a criar no backend.
- **Gate de detalhe:** `apps/web/src/app/(platform)/analytics/students/[studentId]/page.tsx:25`, `canSeeRawContent` exige instructor/admin/super_admin na união de chapéus; manager não passa. Visão instrutor renderiza a mesma tabela com expansão (`instructor/page.tsx:314`).
- **Endpoint legado** `POST /api/notifications/nudge` (só email hardcoded, sem histórico): NÃO usar em nenhuma spec.

## Os 9 problemas do diagnóstico (R1) → onde são resolvidos

| # | Problema (R1) | Resolvido em |
|---|---|---|
| 1 | Recorte pouco evidente (usuário não sabe quem está analisando) | S6 |
| 2 | Filtro de time acoplado e invisível (funil escondido no header da coluna) | S6 |
| 3 | Indicadores conflitantes (pace diz uma coisa, tabela outra) | S7 + S9 |
| 4 | Coluna Cursos sem valor de decisão | S9 (removida) |
| 5 | Coluna Sessões ambígua | S9 (removida, absorvida por Ritmo/Engajamento) |
| 6 | Engajamento opaco (score sem explicação) | S9 (tooltip de composição), parcial: explicação completa fica na visão detalhada futura (instrutor/admin, onda 3) |
| 7 | Progressão conflita com prazo do curso | S7 + S9 (coluna Ritmo recontextualiza) |
| 8 | Interpretação manual (gestor precisa deduzir quem acionar) | S7 + S8 (triagem pré-computada) |
| 9 | Falta hierarquia de leitura na página | S11 (ordem dos blocos) + todas |

## As 6 specs da onda

| Spec | Título | Tipo | Arquivos-chave | Depende de |
|---|---|---|---|---|
| S6 | Recorte evidente: "Quem estou analisando?" | refactor | `team-scope-control.tsx`, `manager-team-dashboard-page.tsx`, `student-insights-table.tsx` (desacoplar filtro de time) | nenhuma |
| S7 | Fundação: taxonomia Ritmo/Triagem (`student-triage.ts`) + 4 cards de triagem | feat | `apps/web/src/lib/student-triage.ts` (novo), `manager-dashboard-page.tsx`, `manager-dashboard.tsx` (cards via `summary-cards.tsx` reusado), tipos de `student-insights-table.tsx` | nenhuma |
| S8 | Destaques em 3 listas (inclui "Sem acesso recente") | feat | `teaching-plan-highlights.tsx`, `manager-dashboard-page.tsx` | S7 |
| S9 | Tabela simplificada do gestor (Aluno/Time/Último acesso/Ritmo/Progresso/Engajamento/Ação) | refactor | `student-insights-table.tsx`, `manager-dashboard.tsx` | S6, S7 |
| S10 | Coluna Ação: nudge individual (Lembrar/Acionar) | feat | `student-insights-table.tsx`, reuso de `/api/analytics/manager/nudge` (array de 1) | S7, S9 |
| S11 | Ordem da página: o funil de decisão | refactor | `manager-dashboard.tsx`, `manager-dashboard-page.tsx` | S6, S8, S9, S10 |

## Sequenciamento

S7 é a fundação (helper puro, sem dependências) e destrava S8 e S9. S6 é independente e deve entrar cedo. S9 também consome S6 (o filtro de time sai do header da coluna e vai para o bloco de recorte). S10 vem após S7+S9 (a coluna Ação vive na tabela nova e deriva da triagem). S11 fecha a onda reordenando os blocos já transformados.

```
S7 (fundação: taxonomia + cards)      S6 (recorte, independente)
 |                                      |
 +--> S8 (destaques 3 col)              |
 |                                      |
 +--> S9 (tabela simplificada) <--------+
        |
        +--> S10 (coluna Ação, nudge individual)
               |
               +--> S11 (ordem da página, funil de decisão)
```

Paralelismo recomendado: {S6, S7} juntas na largada; depois {S8, S9} em paralelo; S10; S11.

## Taxonomia canônica (contrato entre as specs, copiar sem variação)

- **T1. RitmoAluno (coluna Ritmo, POR ALUNO):** `type StudentRitmo = "no_ritmo" | "atrasado" | "nao_iniciado"`. Regras (derivadas dos campos da row + dados de pace já buscados): `nao_iniciado` = `totalSessions===0 && (courseProgressPct??0)===0`; `atrasado` = NÃO nao_iniciado && existe enrollment ATIVO em curso com deadline com `pct < expectedPct` (mesma fórmula do paceHighlights); `no_ritmo` = caso contrário (inclui ahead, on_track e concluídos).
- **T2. TriagemAluno (cards + coluna Ação + 3ª lista dos destaques, POR ALUNO, partição exaustiva):** `type StudentTriagem = "no_ritmo" | "atencao" | "sem_acesso"`. Regras (espelham os buckets existentes accessed/devendo/inativos com os mesmos limiares 5/14 dias): `sem_acesso` = `totalSessions===0` OU `daysSince(lastSessionDate)>14`; `atencao` = NÃO sem_acesso && (`ritmo==="atrasado"` OU `daysSince(lastSessionDate)>5`); `no_ritmo` = resto. Mapeamento conceitual: accessed→no_ritmo, devendo→atencao, inativos→sem_acesso.
- **T3. Ação (deriva da triagem):** `no_ritmo` → sem ação (badge estática "No ritmo"); `atencao` → botão "Lembrar" (nudgeType `"inactive"`); `sem_acesso` → botão "Acionar" (nudgeType = `totalSessions===0 ? "never_accessed" : "inactive"`).
- **T4. Cores:** no_ritmo verde (`semantic-success`), atencao/Lembrar âmbar (`accent-gold`), atrasado/Acionar vermelho (`semantic-error`), nao_iniciado cinza (`text-muted`). Exceção deliberada de cor: `sem_acesso` é vermelho nos cards (S7) e no botão Acionar (S10), mas âmbar/neutro na coluna 3 dos destaques (S8), decisão de design registrada, não inconsistência.
- **T5. Onde computar:** server-side em `manager-dashboard-page.tsx` num helper novo compartilhado `apps/web/src/lib/student-triage.ts`, exportando `computeStudentRitmo`/`computeStudentTriagem` puros (recebem a row + mapa de pace por aluno), enriquecendo cada `StudentInsightRow` com campos opcionais `ritmo?: StudentRitmo` e `triagem?: StudentTriagem`. As specs S7, S8, S9 e S10 consomem o MESMO helper.

## Relação com a Onda 1 (S1-S5)

S1-S5 tratam lente e recorte (RoleLens, TeamScopeControl, RPCs de escopo `getDirectTeamStudentIds`/`getManagedTeamStudentIds`/`getSubtreeStudentIdsAtNode`) e o engajamento por bucket (header + nudge por bucket via endpoint rico). A Onda 2 **assume esses contratos e NÃO os altera**: nenhuma RPC muda de assinatura, o `TeamScopeControl` continua sendo a fonte do recorte (S6 o torna mais evidente, não o substitui), e o endpoint `/api/analytics/manager/nudge` é reusado tal como está (D-B: a única novidade é chamá-lo com `studentIds` de tamanho 1).

## Fora de escopo da onda

- Visão detalhada de aprendizagem por aluno: onda 3, e SÓ instrutor/admin por D-C. Gestor jamais vê texto escrito por aluno; o strip LGPD server-side (`manager-dashboard-page.tsx:159`) e o gate `canSeeRawContent` permanecem intocados.
- Mudanças na visão instrutor (`instructor/page.tsx`): a tabela continua compartilhada, e toda mudança de coluna nas specs deve preservar o comportamento do instrutor (expansão de linha, link de perfil).
- Cooldown persistente de nudge (anti-spam por aluno entre sessões): registrar como follow-up, não bloqueia a onda.
- Mudança dos limiares 5/14 dias (`AT_RISK_DAYS`/`INACTIVE_DAYS`): a taxonomia os reusa, não os recalibra.
- Sidebar e navegação global.

## Dados, RLS e segurança

**Nenhuma migration nova é necessária na onda inteira.** Tudo reusa o que existe: RPCs SECURITY DEFINER de escopo (fail-closed), RPC `auth_team_engagement_signals` para o sinal de atraso, endpoint `/api/analytics/manager/nudge` com gate `hasRole` estrito e re-scope server-side (ids fora do time viram `recipientsSkipped`). A triagem é computação pura server-side sobre dados já autorizados. O risco de regressão de segurança da onda é, portanto, limitado a: (a) não vazar campos LGPD ao enriquecer rows (o helper T5 não toca `recentSessions`/`recentReflections`), (b) não reintroduzir expansão de linha para gestor (D-C), (c) não usar o endpoint legado `/api/notifications/nudge`.

## Nota de validação

Nada foi implementado. As 6 specs (S6-S11) estão escritas e aguardam o GO do Hugo antes de qualquer linha de código. A ordem de implementação proposta é a do sequenciamento acima; cada spec traz seus próprios Acceptance Criteria e plano de testes (first-move rule: fixes e itens de segurança começam por teste vermelho; refactors mantêm a suíte verde, com `pnpm --filter @eximia/web typecheck` como gate mínimo).
