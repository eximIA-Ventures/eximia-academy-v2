# SH-F.3: Cache por tenant do bloco da média da organização (`org-reference-cache.ts`)

**Epic:** [EPIC-STUDENT-HOME-FINALIZACAO](./EPIC-STUDENT-HOME-FINALIZACAO.md)
**Status:** Draft
**Insumo obrigatório:** `03-finalizacao-plan.md` §1 (SH-F.3, desenho recomendado em 3 passos) e §3 (atenção de leitura). Ler antes de começar.
**Depende de:** nada para começar. Opera sobre a base `feat/SH-1.4-student-home-card` (HEAD `d8b7f85`).
**Bloqueia:** adiciona 1 teste novo (`org-reference-cache.test.ts`) que entra no baseline de SH-F.2; por isso SH-F.2 é re-verificada na integração final (epic §7).
**Paralelizável:** SIM. Par B, isolado. Independente de SH-F.1/F.2/F.4.
**⚠ Atenção para o Contrato/@po:** esta story **muda semântica de LEITURA** (staleness intencional ≤ TTL na média da organização). Ver Dev Notes e epic §8.

---

## Story

**As a** desenvolvedor preparando a home do aluno para tenants grandes,
**I want** extrair o bloco org-wide de `computeStudentComparison` para uma função de carga pura `loadOrgReference(db, tenantId, now)` e memoizá-la por tenant num novo `org-reference-cache.ts` com TTL curto, espelhando o padrão já existente em `feature-gate.ts`, mantendo o bloco do aluno computado FRESCO a cada request,
**so that** requests do mesmo tenant dentro do TTL parem de repetir os 4 scans org-wide do tenant inteiro, sem mudar o número mostrado ao aluno e sem nunca cachear o dado individual do aluno.

## Contexto (Dev Notes)

Verificado na worktree `/Users/hugocapitelli/Dev/eximia/sh-1.4-worktree`, em `apps/web/src/lib/analytics/area-gestor.ts`:

- `computeStudentComparison(db, ...)` começa em **linha 1091**.
- **Bloco `student` (escopado a `student_id`, auth), NUNCA cachear:** linhas ~1104-1152. Scans do aluno: `.from("sessions")` (1107), `.from("slide_reflections")` (1114); e `.from("chapters")` (1122) + `.from("courses")` (1127) que derivam `tenantChapterCount` (1132).
- **Bloco org-wide (idêntico para todos os alunos do tenant numa janela):** a partir de ~linha 1164. Resolve `orgStudentIds` via `.from("users")` (1164, 1168) e dispara os **4 scans org-wide** do tenant:
  - `.from("sessions")` (1180)
  - `db.from("slide_reflections")` (1185)
  - `.from("enrollments")` (1189)
  - `db.from("courses").select("id, deadline_days")` (1194, deadlines)
  Em seguida compõe `orgBlock` (1197, via `computeMetricBlock`), `referenceStats` (1207, via `computeUnitReferenceStats`), `unit` (1214) e `deadlineByCourse` (1218-1219), que alimentam `buildStudentHomeIndicators` (1222-1226). Arquivo tem 1231 linhas.
- **Padrão de cache canônico a espelhar:** `apps/web/src/lib/feature-gate.ts` usa `const tenantCache = new Map<string, CacheEntry>()` (linha 45), `const CACHE_TTL_MS = 5 * 60 * 1000` (44), `getCacheEntry(tenantId)` com checagem `Date.now() > entry.expiry` (47-50), `expiry: Date.now() + CACHE_TTL_MS` (142) e `invalidateFeatureCache` (58). App roda em processo longo (EasyPanel/Docker, não serverless), então cache por processo é válido, como já é em prod para o feature-gate.

**Desenho recomendado (plano §1 SH-F.3, mínimo refactor, correto por construção):**
1. **Extrair** de `computeStudentComparison` a parte org-wide (a região dos 4 scans + `orgStudentIds` + `orgBlock` + `referenceStats` + `deadlineByCourse`/`tenantChapterCount` que o lado-org de `buildStudentHomeIndicators` consome) para uma função pura de carga `loadOrgReference(db, tenantId, now)` que retorna o `OrgReference` (`{ orgStudentIds, orgSessionRows, orgReflectionRows, orgEnrollmentRows, deadlineByCourse, tenantChapterCount, orgBlock, referenceStats }`). O boundary exato de extração (em especial `tenantChapterCount` e os scans `chapters`/`courses` que também são org-wide) é decisão do implementador, desde que o bloco do aluno permaneça fresco fora do cache.
2. **Novo arquivo** `apps/web/src/lib/analytics/org-reference-cache.ts`: `Map<tenantId, {ref, expiry}>` + TTL curto (**60s**, calibrável, justificado: a home deve parecer viva mas a referência org só muda em janela). Invalidação **por TTL apenas** (sem invalidação manual nesta fatia; staleness ≤ TTL é aceito por design, documentar). Exportar `getOrgReference(db, tenantId, now)` que serve do cache válido ou chama `loadOrgReference` e popula.
3. `computeStudentComparison` passa a: (a) computar o bloco `student` FRESCO por request (NUNCA cacheado, é `student_id=auth`), (b) obter o org via `getOrgReference` (cacheado por tenant), (c) recompor `unit` + `buildStudentHomeIndicators(studentId, ...orgRef)` por request (barato, em memória, sem DB).

**Prova de que o aluno não é cacheado:** o cache é keyed SÓ por `tenantId` e guarda SÓ o `OrgReference`. O bloco `student` e o lado "Você" dos indicators são derivados por request a partir de `studentId`. Dois alunos do mesmo tenant → mesmo `orgBlock` (cache hit), blocos `student` DIFERENTES.

## Acceptance Criteria

- [ ] **AC1 (extração pura):** existe `loadOrgReference(db, tenantId, now)` que executa os 4 scans org-wide e retorna o `OrgReference`. `computeStudentComparison` não repete mais esses scans inline; obtém o org via `getOrgReference`.
- [ ] **AC2 (novo cache espelhando feature-gate):** existe `apps/web/src/lib/analytics/org-reference-cache.ts` com `Map<string, {ref, expiry}>`, TTL de **60s** (constante nomeada), checagem `Date.now() > expiry`, e `getOrgReference(db, tenantId, now)` que serve do cache ou popula. Prova: `grep -nE "new Map<|expiry|getOrgReference|60|TTL" apps/web/src/lib/analytics/org-reference-cache.ts`.
- [ ] **AC3 (aluno sempre fresco):** o bloco `student` de `computeStudentComparison` é computado por request e NÃO passa pelo cache. O cache é keyed apenas por `tenantId` e guarda apenas o `OrgReference`.
- [ ] **AC4 (cache-hit prova, 0 scans no 2º request):** teste novo `apps/web/src/lib/analytics/__tests__/org-reference-cache.test.ts` com um `db` fake que CONTA chamadas `.from()`: prova que o **2º request do MESMO tenant dentro do TTL faz 0 scans org** (as 4 leituras org só ocorrem no 1º) e que após expirar o TTL (avançando `now`) **recarrega**.
- [ ] **AC5 (número preservado):** o mesmo teste (ou irmão) prova que `orgBlock`/indicators do 2º request (cache hit) são **numericamente idênticos** ao 1º.
- [ ] **AC6 (aluno não cacheado, provado):** o teste prova que **dois `studentId` distintos** no mesmo tenant recebem blocos `student` DIFERENTES com o MESMO `orgBlock` (cache hit no org, aluno derivado por request).
- [ ] **AC7 (sem regressão):** `pnpm --filter @eximia/web typecheck` limpo; a suíte do módulo analytics (`area-gestor.test.ts`, `student-home-indicators.test.ts`) segue VERDE sem modificação de asserção.

## Tasks

- [ ] 1. First-move (refactor de leitura): rodar a suíte do módulo analytics e confirmar VERDE antes de tocar `area-gestor.ts` (`pnpm --filter @eximia/web test -- area-gestor student-home-indicators`).
- [ ] 2. Definir o tipo `OrgReference` e extrair a região org-wide de `computeStudentComparison` (a partir de ~1164) para `loadOrgReference(db, tenantId, now)` em `area-gestor.ts`, mantendo o bloco `student` (~1104-1152) fora dela.
- [ ] 3. Criar `apps/web/src/lib/analytics/org-reference-cache.ts` espelhando `feature-gate.ts`: `Map`, `ORG_REFERENCE_TTL_MS = 60 * 1000` (constante nomeada), `getOrgReference(db, tenantId, now)`.
- [ ] 4. Religar `computeStudentComparison`: `student` fresco por request + `getOrgReference` para o org + recompor `unit`/`buildStudentHomeIndicators` por request.
- [ ] 5. Escrever `__tests__/org-reference-cache.test.ts` com `db` fake que conta `.from()`: AC4 (0 scans no 2º request, recarga pós-TTL), AC5 (número idêntico), AC6 (dois alunos, mesmo org, `student` distintos).
- [ ] 6. `pnpm --filter @eximia/web typecheck` + suíte do módulo verde (AC7).

## Complexidade & Riscos

- **Complexidade:** L (large). Refactor de uma função de ~140 linhas com semântica de leitura, novo módulo de cache e prova por teste com `db` fake.
- **Riscos:**
  - R1 (médio): extração incorreta do boundary faz o bloco do aluno vazar para o cache (aluno cacheado = bug). Mitigação: AC3 + AC6 (teste prova dois alunos com `student` distintos).
  - R2 (médio): número muda no cache-hit por recomputar `unit`/indicators de forma diferente. Mitigação: AC5 (idêntico numérico) + suíte do módulo intacta (AC7).
  - R3 (baixo, por design): staleness da média da org até 60s. Mitigação: intencional e limitado, documentado; decisão de produto a fixar na spec (ver atenção ao Contrato).
  - R4 (baixo): TTL mal calibrado. Mitigação: TTL em constante nomeada, fácil de ajustar.

## Dev Notes

- **Natureza: ADITIVO em estrutura, MUDA SEMÂNTICA DE LEITURA.** Novo arquivo + extração de função (aditivo/refactor), porém a "Média da organização" passa a poder estar defasada em até o TTL (≤60s). O bloco do aluno é sempre fresco. **Isto é a mudança de comportamento a sinalizar ao Contrato/@po** (epic §8): staleness intencional e limitado, fixar o TTL como decisão de produto, provar que o aluno NÃO é cacheado.
- **File-disjunto:** dono de `apps/web/src/lib/analytics/area-gestor.ts`, do novo `org-reference-cache.ts` e do novo teste `org-reference-cache.test.ts`. Não editar `student-progress-headline.tsx` (SH-F.1), `vitest.config.ts` (SH-F.2) nem `seed-student-home-demo.ts` (SH-F.4).
- **Fora de escopo (epic §4):** invalidação manual de cache. Só TTL nesta fatia.
- Cache por processo é válido aqui pela mesma razão que já vale para `feature-gate.ts` em prod (processo longo, não serverless). Não introduzir Redis/externo.

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/sh-1.4-worktree
pnpm --filter @eximia/web test -- area-gestor student-home-indicators   # first-move: verde ANTES
# ... implementar ...
grep -nE "new Map<|expiry|getOrgReference|TTL" apps/web/src/lib/analytics/org-reference-cache.ts   # AC2
pnpm --filter @eximia/web test -- org-reference-cache    # AC4/AC5/AC6 (0 scans no 2º req, número idêntico, aluno não cacheado)
pnpm --filter @eximia/web test -- area-gestor student-home-indicators   # AC7: módulo sem regressão
pnpm --filter @eximia/web typecheck                     # AC7
```

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-12 | Story criada a partir de `EPIC-STUDENT-HOME-FINALIZACAO.md` §4/§10 + `03-finalizacao-plan.md` §1 (SH-F.3). Anchors de `area-gestor.ts` (`computeStudentComparison`@1091, 4 scans org @1180/1185/1189/1194) e o padrão `feature-gate.ts` (Map@45, TTL@44, expiry@142) verificados na worktree SH-1.4. Atenção de leitura sinalizada ao Contrato. | Roteiro (@sm) |
| 2026-07-12 | Validação PO: DECISÃO DE PRODUTO ratificada (staleness ≤ TTL aceito, TTL=60s fixado), prova "aluno nunca cacheado" endurecida com asserção de chave de cache. Veredito GO. | Contrato (@po) |

---

## PO Validation & Critérios Fortalecidos (@po)

> **Veredito: GO (9,0/10).** É a fatia que MUDA SEMÂNTICA DE LEITURA, então o @po não só valida a mecânica, RATIFICA a mudança de comportamento como decisão de produto explícita. Anchors reconfirmados (`computeStudentComparison`@1091; `feature-gate.ts` TTL@44/Map@45/expiry@50/142).

### DECISÃO DE PRODUTO (ratificada pelo @po, não deixada como nota de dev)

A "Média da organização" mostrada ao aluno **pode ficar defasada em até 60 segundos** após um dado org mudar. Isto é **comportamento ACEITO e intencional**, não bug:
- **Staleness limitado e cravado:** teto = TTL = **60 segundos**. Fixado como decisão de produto por este @po (calibrável em UMA constante nomeada `ORG_REFERENCE_TTL_MS`, se o produto pedir outro valor no futuro, é troca de 1 linha, não refactor).
- **O bloco do aluno é SEMPRE fresco.** O número individual do aluno ("Você") nunca passa pelo cache, é computado por request a partir de `student_id=auth`. A defasagem só afeta a RÉGUA de comparação (agregado org do tenant), que por natureza só muda em janela, não a cada segundo.
- **Justificativa:** a home deve parecer viva (barato por request) sem repetir 4 scans org-wide do tenant inteiro a cada aluno. O ganho de custo por request supera folgadamente 60s de defasagem numa média que se move devagar. Alinhado ao precedente já em produção (`feature-gate.ts`, TTL de 5 min por tenant).

Por que isto importa para o revisor: a mudança de leitura NÃO é um efeito colateral silencioso. Ela é uma decisão registrada, com teto verificável. Um cache-hit que devolvesse número DIFERENTE do 1º request (dentro do TTL) seria bug (AC5). Um bloco de aluno que viesse do cache seria bug (AC3/AC6).

### Given/When/Then (com o endurecimento da prova de não-cacheamento)

- **AC3+AC6 endurecidos (aluno nunca cacheado, provado por CHAVE):** *Given* o cache `org-reference-cache.ts`; *When* inspeciona-se o tipo da chave do `Map`; *Then* a chave é `tenantId: string` e SÓ isso, o valor guardado é apenas `OrgReference` (nunca inclui `student`/`studentId`). Prova estrutural (grep) + prova comportamental (teste): dois `studentId` distintos no mesmo tenant, dentro do TTL, recebem `student` DIFERENTE e `orgBlock` IDÊNTICO (0 scan org no 2º).
- **AC4 (staleness tem TETO, provado):** *Given* 1º request popula o cache; *When* 2º request com `now` DENTRO do TTL; *Then* 0 scans org. *When* 3º request com `now` avançado PARA ALÉM de 60s; *Then* recarrega (scans org voltam a ocorrer). Isso prova que a defasagem nunca excede o TTL.
- **AC5 (número idêntico no hit):** *Then* `orgBlock` e os indicators do lado-org do cache-hit são numericamente IDÊNTICOS ao 1º request (o cache serve o mesmo objeto, não recomputa diferente).

### Comandos de Verificação (exatos)

```bash
cd /Users/hugocapitelli/Dev/eximia/sh-1.4-worktree
pnpm --filter @eximia/web test -- area-gestor student-home-indicators   # first-move: VERDE antes de tocar
grep -nE "new Map<string|Map<string,|ORG_REFERENCE_TTL_MS|60 \* 1000|expiry|getOrgReference" apps/web/src/lib/analytics/org-reference-cache.ts   # AC2 + chave só tenantId
grep -nE "studentId|student\b" apps/web/src/lib/analytics/org-reference-cache.ts   # AC3/AC6: NÃO deve haver studentId na chave nem no valor do cache
pnpm --filter @eximia/web test -- org-reference-cache                   # AC4/AC5/AC6 (db fake conta .from(): 0 scans no 2º req, recarga pós-TTL, número idêntico, 2 alunos)
pnpm --filter @eximia/web test -- area-gestor student-home-indicators   # AC7: módulo sem regressão
pnpm --filter @eximia/web typecheck                                     # AC7
```

### Critério de PRONTO (o revisor do Par B usa)

`loadOrgReference(db, tenantId, now)` extraído; `org-reference-cache.ts` espelha `feature-gate.ts` (Map por `tenantId`, `ORG_REFERENCE_TTL_MS = 60*1000` nomeado, checagem `Date.now() > expiry`); grep confirma que a chave/valor do cache NÃO contém `studentId`; teste com `db` fake prova 0 scans no 2º request, recarga pós-TTL, número idêntico e dois alunos (mesmo org, `student` distinto); suíte `area-gestor`/`student-home-indicators` verde sem alterar asserção; typecheck limpo. Staleness ≤ 60s é DECISÃO DE PRODUTO registrada acima, não pendência. Sem invalidação manual (fora de escopo, epic §4).

### Placar 10 pontos PO

1. Objetivo/contexto: 1 · 2. ACs testáveis: 1 · 3. Precisão técnica (anchors reconfirmados): 1 · 4. Rastreabilidade Art. IV: 1 · 5. Autossuficiência: 1 · 6. Dependências (F.2 re-verifica): 1 · 7. Escopo (só leitura org): 1 · 8. Teste runnable: 1 · 9. Riscos+mitigação: 0,5 · 10. First-move (verde antes, refactor de leitura): 0,5. **Total: 9,0 → GO** (com a mudança de semântica de leitura RATIFICADA como decisão de produto, TTL=60s fixado).
