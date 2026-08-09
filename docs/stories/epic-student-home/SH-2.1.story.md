# SH-2.1: Turma da tabela "Meu ritmo" só conta alunos com atividade real

**Epic:** [EPIC-STUDENT-HOME](./EPIC-STUDENT-HOME.md)
**Status:** InReview
**Depende de:** SH-1.5 (tabela "Meu ritmo"/`ComparisonInsightsTable`, já em produção; `computeStudentComparison`/`loadOrgReference` em `area-gestor.ts`).
**Bloqueia:** SH-2.2 (consome `OrgReference.orgStudentIds` já filtrado para calcular a média de "Última atividade" só sobre estudo real) e SH-2.3 (o painel-resumo consome os indicadores derivados desta e da SH-2.2).
**Paralelizável:** esta story rodou em SEQUÊNCIA com SH-2.2 e SH-2.3 (mesmo dev, terminal único, ordem deliberada: SH-2.1 primeiro porque as duas seguintes consomem seu resultado). Não paraleliza com trabalho concorrente que toque `area-gestor.ts`/`computeStudentComparison`.

---

## Story

**As a** Hugo (fundador, dono do produto), olhando o card "Meu ritmo" de qualquer aluno,
**I want** que as médias e rankings da "Turma" (progresso, interações, reflexões, engajamento, tetos de trilha) considerem só alunos que JÁ tocaram a plataforma de alguma forma,
**so that** uma conta provisionada mas nunca acessada não vire um "fantasma" que arrasta a média/ranking para baixo (ou para cima) e distorce a comparação de todo mundo.

## Contexto (Dev Notes)

**Diagnóstico (confirmado em código antes da edição, 2026-07-19):** `loadOrgReference` (`apps/web/src/lib/analytics/area-gestor.ts`) monta `orgStudentIds` a partir de uma query que filtra SOMENTE `tenant_id` + `role='student'` (linhas ~1266-1277 antes desta story), sem NENHUM filtro de atividade. Esse array crua alimenta `computeMetricBlock`, `computeUnitReferenceStats`, `computeOrgTrailMaxAverages` e é devolvido como o campo `OrgReference.orgStudentIds` — que por sua vez é a população "comparável" usada em `computeStudentComparison` para o rank real de engajamento (`isTopEngagement`/`engagementRank`, regra de negócio da SH-1.5). A ÚNICA exceção parcial já existente no código era `lastAccessAvgDays` (`student-home-indicators.ts`, D1): a média de recência já excluía quem nunca acessou — mas só localmente, sem se propagar para as outras médias/rankings.

**Correção aplicada:** dentro de `loadOrgReference`, logo após o `Promise.all` que carrega `orgSessionRows`/`orgReflectionRows` (e após o loop que monta `deadlineByCourse`), um novo `activeOrgStudentIds` filtra `orgStudentIds` para quem tem **pelo menos 1 sinal de atividade real** — os MESMOS 3 sinais que já governavam a exceção D1 de recência, generalizados aqui para toda a população de referência:
1. Tem ao menos 1 linha em `orgSessionRows` (sessão de curso).
2. OU tem ao menos 1 linha em `orgReflectionRows` (reflexão).
3. OU tem uma entrada em `lastSeenByStudent` (bump de `users.last_seen_at`, navegação pura — aqui conta como MEMBRESIA, distinto do bar mais estrito de "estudo" que a SH-2.2 define para a linha "Última atividade").

`activeOrgStudentIds` substitui `orgStudentIds` nas 3 chamadas downstream (`computeMetricBlock`, `computeUnitReferenceStats`, `computeOrgTrailMaxAverages`) e no valor do campo `orgStudentIds` retornado em `OrgReference` — ou seja, TODO consumidor de `orgRef.orgStudentIds` (incluindo o rank de engajamento em `computeStudentComparison`, e a checagem "população vazia") passa a enxergar a população ATIVA a partir de agora, de forma consistente.

**Deliberadamente NÃO usa `users.status`:** esse campo é um toggle administrativo de conta (ativo/suspenso/etc.), um conceito diferente de "esse aluno já tocou a plataforma". Uma conta `status='active'` que nunca logou continua fora da população; uma conta suspensa que já estudou antes de ser suspensa continua dentro (não é escopo desta story mudar isso).

**O que NÃO muda:** M2 (referência é a organização inteira, sem filtro de área) continua intacto — esta story adiciona um filtro de ATIVIDADE por cima, não reintroduz filtro de área. `area-gestor.ts`'s `computeMetricBlock`/`computeUnitReferenceStats`/`computeOrgTrailMaxAverages` (as funções puras em si) não mudaram — só a população que `loadOrgReference` passa para elas.

## Acceptance Criteria

- [x] **AC1:** `loadOrgReference` calcula `activeOrgStudentIds` = subconjunto de `orgStudentIds` com pelo menos 1 sinal em `orgSessionRows` OU `orgReflectionRows` OU `lastSeenByStudent`.
- [x] **AC2:** `computeMetricBlock`, `computeUnitReferenceStats` e `computeOrgTrailMaxAverages` recebem `activeOrgStudentIds` (não mais `orgStudentIds` cru).
- [x] **AC3:** O campo `orgStudentIds` retornado em `OrgReference` é `activeOrgStudentIds` — todo consumidor externo (incluindo `computeStudentComparison`'s rank de engajamento) enxerga a população ativa.
- [x] **AC4:** `users.status` NUNCA entra no filtro (documentado em comentário no código, para não ser reintroduzido por engano).
- [x] **AC5:** M2 (sem filtro de área) permanece intocado — nenhuma query nova toca `user_areas`.
- [x] **AC6:** Suíte `area-gestor.test.ts` cobre o comportamento (via os testes já existentes de `computeStudentComparison`, ajustados para fixtures com sinal de atividade onde a intenção original do teste exigia uma população não-vazia/de tamanho N).
- [x] **AC7:** Sem regressão: `student-home-indicators.test.ts` e `comparison-insights-table.test.tsx` seguem verdes sem modificação (não tocados por esta story — só `area-gestor.ts` e seu teste).

## Tasks

- [x] 1. Confirmar em código (não só na memória do diagnóstico anterior) o estado atual de `loadOrgReference`/`orgStudentIds` antes de editar.
- [x] 2. Implementar `activeOrgStudentIds` em `loadOrgReference`, logo após o `Promise.all` dos 4 scans org-wide.
- [x] 3. Substituir `orgStudentIds` por `activeOrgStudentIds` nas 3 chamadas downstream e no campo retornado.
- [x] 4. Atualizar o JSDoc do campo `orgStudentIds` na interface `OrgReference` para documentar a nova semântica (ativo, não só existente).
- [x] 5. Rodar a suíte `area-gestor.test.ts` e corrigir fixtures que dependiam implicitamente de uma população sem filtro de atividade (documentando a razão de cada ajuste, nunca deletando o teste).
- [x] 6. `tsc --noEmit` + `vitest run src/components/analytics src/lib/analytics` + `biome check` nos arquivos tocados, tudo verde antes de prosseguir para SH-2.2.

## Complexidade & Riscos

- **Complexidade:** S/M (small/medium). Uma função pura nova (filtro) + 3 pontos de substituição de argumento + 1 campo de retorno, tudo dentro de uma única função (`loadOrgReference`). Sem mudança de schema, sem nova query.
- **Riscos:**
  - R1 (médio, materializado): fixtures de teste que hoje modelam "org de N alunos" sem dar sinal de atividade a todos passam a ver N menor após o filtro, quebrando asserções de contagem/rank que dependiam do N original. Mitigação: ajustar a fixture (dar 1 sinal de atividade ao aluno que faltava) em vez de mudar a asserção, preservando a intenção original do teste sempre que possível.
  - R2 (baixo): algum consumidor futuro de `OrgReference.orgStudentIds` que precise da população TOTAL (não só ativa) para um headcount administrativo teria que buscar `orgStudentRows`/uma query própria — hoje não existe esse consumidor, então não é regressão, mas fica registrado como possível necessidade futura.

## Dev Notes

- **Arquivo único tocado (produção):** `apps/web/src/lib/analytics/area-gestor.ts` (`loadOrgReference` + JSDoc de `OrgReference.orgStudentIds`).
- **Arquivo de teste tocado:** `apps/web/src/lib/analytics/__tests__/area-gestor.test.ts` (2 fixtures ajustadas, ver Change Log).
- **NÃO tocar** `student-home-indicators.ts` nem `comparison-insights-table.tsx` nesta story — são escopo da SH-2.2 (que roda em seguida e consome o `orgRef.orgStudentIds` já filtrado por esta story).
- **Reusar, não reinventar:** os 3 sinais de atividade (sessão/reflexão/last_seen) já existiam individualmente no código (a exceção D1 de `lastAccessAvgDays` já os usava para recência); esta story generaliza o MESMO conjunto de sinais para a população inteira, não inventa um 4º sinal.

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2/apps/web
npx tsc --noEmit
npx vitest run src/components/analytics src/lib/analytics
npx biome check src/lib/analytics/area-gestor.ts src/lib/analytics/__tests__/area-gestor.test.ts
```

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-19 | Story criada e implementada: `activeOrgStudentIds` filtra a Turma para alunos com >=1 sinal real (sessão/reflexão/last_seen_at) em `loadOrgReference`; substitui `orgStudentIds` nas 3 chamadas downstream e no campo `OrgReference.orgStudentIds` retornado. `users.status` explicitamente excluído do critério (comentário no código). 2 fixtures de `area-gestor.test.ts` ajustadas para dar sinal de atividade a alunos mock que a intenção original do teste presumia contáveis (não a intenção do teste em si mudou). `tsc` exit 0; 330/330 testes verdes em `src/components/analytics` + `src/lib/analytics`; `biome check` limpo. | J.A.R.V.I.S. (@dev, terminal único consolidado) |

## Dev Agent Record

### Contexto de execução

Diagnóstico já havia sido feito e aprovado pelo Hugo (mapa visual com as 3 propostas de correção, SH-2.1/2.2/2.3) antes desta implementação — este dev não reabriu o diagnóstico, apenas confirmou em código que o estado batia com o mapeamento (linhas mudaram levemente de posição desde o diagnóstico original, mas a lógica descrita permanecia idêntica) antes de editar.

### Achados durante a implementação

- A query de população (`users.select("id, last_seen_at")`) já carregava `last_seen_at` na mesma varredura (contrato de cache de `loadOrgReference`, FOLLOW-UP B) — o filtro de atividade não precisou de nenhuma query nova, só reusar dados já em memória (`orgSessionRows`, `orgReflectionRows`, `lastSeenByStudent`), todos carregados ANTES do ponto de inserção do filtro.
- Dois testes em `area-gestor.test.ts` dependiam implicitamente de população sem filtro de atividade:
  1. `"consulta a população por tenant_id + role=student, SEM tocar user_areas"` (~linha 197): 2 alunos mock, nenhum com sinal — o teste em si valida a FORMA da query (não o tamanho da população), então bastou dar `last_seen_at` a 1 dos 2 para a população ativa não ficar vazia (o que zeraria `result.unit`/`referenceStats` sem relação com o que o teste queria provar).
  2. `"Round 2 — subject.engagementRank/total presentes no payload"` (~linha 341): órg de 3 alunos, mas só 2 com sessão — `engagementTotalStudents` foi de 3 para 2 após o filtro (peer-3 nunca tocou a plataforma). Corrigido dando 1 sessão a peer-3, preservando a intenção original do teste ("1º de 3") em vez de aceitar a regressão de contagem.
- Nenhum outro arquivo de teste no escopo verificado (`src/components/analytics`, `src/lib/analytics`) foi afetado — todos os demais fixtures já davam sessão a 100% dos alunos mock.

### File List

- `apps/web/src/lib/analytics/area-gestor.ts` (modificado)
- `apps/web/src/lib/analytics/__tests__/area-gestor.test.ts` (modificado)
- `docs/stories/epic-student-home/SH-2.1.story.md` (novo)
