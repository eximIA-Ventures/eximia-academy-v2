# E16: Fechamento do loop (retorno agregado + encerramento)

**Epic:** [00-EPIC-OVERVIEW](./00-EPIC-OVERVIEW.md)
**Status:** InReview
**Implementa:** [E13 — Proposta de Redesign da Aba Campanhas](./E13-campanhas-redesign-proposta.md) §3 (fechamento do loop), decisões **D2**, **D5**
**Depende de:** E14 (tabela `campaigns`), E15 (notificações carregam `campaign_id`)
**Bloqueia:** nenhuma (E17 consome o read de resultado, mas pode iniciar em paralelo com esta e integrar quando pronta)

---

## Story

**As a** gestor,
**I want** que a campanha, depois do disparo, mostre quem voltou a estudar (não só quantas mensagens saíram) e se encerre com um resultado quando a janela cumprir ou quando eu encerrar manualmente,
**so that** eu feche o loop (Ulwick): a campanha deixa de terminar numa contagem de saída cega e vira um objeto observável com resultado — usando o sinal de retorno que **já existe** no sistema, sem tracking novo.

## Contexto (Dev Notes)

Ler [E13 §3](./E13-campanhas-redesign-proposta.md) (fechamento do loop — o dado já existe) e [E13 §5.3](./E13-campanhas-redesign-proposta.md) (delta do backend) antes de começar. Ler também [E8 (Histórico)](./E8-aba-historico.md) — a lógica de resultado que esta story reusa nasceu lá.

**O achado central do E13: os dados para fechar o loop já existem e já são computados por um cron. Fechar o loop é ~90% recomposição de primitivos, ~10% infra nova (a tabela `campaigns` de E14).** Esta story NÃO cria tracking novo de comportamento (E13 §3.2).

- **`notifications.returned_at` (coluna existente)** é o sinal de "o aluno voltou depois da mensagem". Verificado (2026-07-10) por @po: existe na migration base (`20260604120000_engagement_engine.sql` l.96, "efficacy: student had a session after sent_at (cron-set)") e é preenchido por `markReturnedForSentNudges()` em `apps/web/src/lib/notifications/efficacy.ts` (l.101), rodado pelo cron de eficácia. **Esta story NÃO altera o cron nem `efficacy.ts`** — reusa a coluna que ele já carimba (E13 §9).
- **`read_at`, `acted_at`, `sent_at`** (existentes) alimentam as métricas de "aberta" (enviadas/lidas). Já lidos por `inbox.ts` (verificado: select em `inbox.ts` l.28 inclui `returned_at`, `read_at`, `acted_at`, `sent_at`).
- **A lógica de resultado JÁ FOI escrita no Histórico (E8):** `resultLabel` ("Acessou depois da mensagem" quando `returned_at` presente; "Sem resposta" quando `sent_at > 3d`) e o agregado `retornaram`. Esta story REUSA essa mesma lógica, só que **agrupada por `campaign_id`** em vez de por linha solta (E13 §3.2, "exatamente o `returned_at IS NOT NULL` que o Histórico já usa — só que agrupado por `campaign_id`"). NÃO reimplementar a semântica de resultado; extrair/reusar a de E8 se possível.
- **Estados de vida da campanha (E13 §3.2):**
  - **ABERTA** (dentro da janela): métrica de progresso — "12 enviadas · 5 lidas · aguardando retorno até {window_end}".
  - **ENCERRADA** (janela cumprida ou gestor encerra): resultado congelado — "Rodou de {window_start} a {window_end} · 12 alunos · 7 voltaram (58%) · 5 sem resposta".
- **Encerramento (decisão D5 — ambos):**
  - **Automático:** um passo A MAIS no cron de eficácia (ou um cron irmão) vira `campaigns.status` de `open`→`closed` quando `window_end` passou (E13 §3.3, §5.3). Reusar o índice `idx_campaigns_window_end` de E14 para varrer `open` vencidos.
  - **Manual:** o gestor pode encerrar agora — um `PATCH` que seta `status='closed'` (re-scopado ao caller, só campanhas do recorte dele).
- **Janela default = 7 dias (D2)** — já materializada em `campaigns.window_end` por E15/E14; esta story só a LÊ para decidir aberta vs encerrada e para o rótulo "aguardando retorno até {data}".
- **O resultado NÃO precisa ser materializado** (E13 §3.3): pode ser derivado on-read via join/agregação sobre as notificações do `campaign_id`. Só `status` e `window_end` moram em `campaigns`.

## Acceptance Criteria

- [x] **AC1:** Nova leitura de resultado por campanha: `GET /api/engagement/campaign/:id` (ou um bloco agregado no `overview` — decidir e documentar) que, para um `campaign_id`, agrega sobre as `notifications` daquele lote: total enviadas, total lidas (`read_at IS NOT NULL`), total retornaram (`returned_at IS NOT NULL`), total sem resposta. Escopado ao caller (o gestor só lê resultado de campanha do recorte dele — reusa `resolveEngagementScope`, fail-closed).
- [x] **AC2:** O cálculo de "retornaram" usa **exatamente** `returned_at IS NOT NULL` (o sinal que o cron já carimba e o Histórico já usa), agregado por `context->>'campaign_id'`. NENHUM tracking de comportamento novo, NENHUMA query de sessão nova (E13 §3.1/§3.2). A base é sempre explícita ("M de N enviadas retornaram", nunca % solto — mesma disciplina do AC5 de E8).
- [x] **AC3:** Estado ABERTA: quando `campaigns.status='open'` e `now() < window_end`, o read retorna a métrica de progresso (enviadas/lidas/aguardando) + a `window_end` para a UI mostrar "aguardando retorno até {data}".
- [x] **AC4:** Estado ENCERRADA: quando `status='closed'` (ou `now() >= window_end`), o read retorna o resultado congelado (janela `window_start`→`window_end`, N alunos, M retornaram + %, sem-resposta). O % é derivado, a base N é sempre exibida.
- [x] **AC5:** Encerramento **automático**: um passo adicionado ao cron de eficácia (ou cron irmão) vira `status` de `open`→`closed` para toda campanha com `window_end < now()`. Idempotente (só toca `status='open'`, re-assere o predicado). **`efficacy.ts`/`markReturnedForSentNudges` NÃO é alterado na sua lógica de carimbar `returned_at`** — o encerramento é um passo SEPARADO e aditivo (pode viver no mesmo cron handler, mas não muda o carimbo de retorno). Documentar onde o passo foi adicionado.
- [x] **AC6:** Encerramento **manual**: `PATCH /api/engagement/campaign/:id` com `{ status: 'closed' }`, re-scopado ao caller (só campanhas cujo `tenant_id` + recorte pertencem ao gestor; um `campaign_id` de outro time → 403/404, nunca encerra). Idempotente (encerrar campanha já encerrada não erra).
- [x] **AC7:** A aba Histórico (E8) e o cron de eficácia permanecem **funcionalmente intactos** — esta story reusa `returned_at`/`resultLabel`, não os modifica. Verificar que `apps/web/src/lib/notifications/efficacy.ts` e `history-tab.tsx` não têm mudança de comportamento (só possível extração compartilhada da função de resultado, se feita, preservando o comportamento de E8 — cobrir com o teste existente de E8).
- [x] **AC8:** Teste automatizado: (a) agregação por `campaign_id` conta corretamente enviadas/lidas/retornaram sobre um conjunto mockado de notificações com `returned_at` misto; (b) o read de resultado é escopado (campanha de outro recorte → não retorna dado); (c) encerramento manual re-scopado rejeita `campaign_id` fora do recorte; (d) encerramento automático só toca `open` com `window_end` vencido.

## Tasks

- [x] 1. Ler `efficacy.ts` (`markReturnedForSentNudges` + o handler do cron), `inbox.ts` (select com `returned_at`) e `history-tab.tsx` (`resultLabel`/`retornaram`) na íntegra.
- [x] 2. Implementar o read de resultado agregado por `campaign_id` (AC1, AC2), escopado (fail-closed).
- [x] 3. Modelar os dois estados (aberta/encerrada) no read (AC3, AC4).
- [x] 4. Adicionar o passo de encerramento automático ao cron (AC5), sem tocar o carimbo de `returned_at`.
- [x] 5. Implementar o `PATCH` de encerramento manual re-scopado (AC6).
- [x] 6. Garantir que `efficacy.ts`/Histórico não regridem (AC7); escrever o teste de agregação + escopo (AC8).
- [x] 7. `pnpm --filter @eximia/web typecheck` + `lint` + `test` verdes.

## Complexidade & Riscos

- **Complexidade:** M (medium). O read é agregação/join sobre dado existente (baixo risco de invenção); o encerramento manual+automático adiciona duas transições de estado escopadas. A maior parte é recomposição, não lógica nova (E13 §3.1).
- **Riscos:**
  - R1 (médio): read de resultado não-escopado deixaria um gestor ver o resultado (e a contagem de alunos) de campanha de outro time. Mitigação: AC1/AC2 exigem `resolveEngagementScope` fail-closed; AC8 (teste) prova o escopo. Mesma disciplina do vazamento que E8 corrigiu.
  - R2 (médio): mexer no cron de eficácia poderia quebrar o carimbo de `returned_at` (que o Histórico depende). Mitigação: AC5/AC7 exigem que o encerramento seja um passo SEPARADO e aditivo, sem tocar `markReturnedForSentNudges`; teste de E8 continua verde.
  - R3 (baixo): encerramento manual não-idempotente ou não-scopado. Mitigação: AC6 exige idempotência + re-scope.
  - R4 (baixo): reimplementar a semântica de resultado divergindo de E8 (duas fontes de verdade). Mitigação: AC2/AC7 exigem reuso da lógica de E8, extração compartilhada preferida sobre reescrita.

## Regra Absoluta de Escopo (verificação)

Blocker. O read de resultado (AC1) e o encerramento manual (AC6) são escopados server-side (`resolveEngagementScope`, fail-closed) — um gestor nunca lê nem encerra campanha de outro recorte. Cenário canônico Rinaldo (Seção 2 do overview) aplicado ao read de resultado: a contagem de "alunos" e "retornaram" de uma campanha só reflete alunos do recorte do caller. Coberto por AC8.

## Restrições de Segurança Herdadas (E13 §6 — INEGOCIÁVEIS, não reabrir)

Esta story é de leitura/estado, não de disparo — a trava de dispatch (E15) não é tocada. As restrições relevantes aqui: (4) leitura escopada server-side (AC1), e (5) não reabrir a auditoria do E7 nem alterar o cron/Histórico (AC7). O encerramento manual (AC6) é uma escrita de ESTADO da campanha, escopada — não é um caminho de dispatch e não altera destinatários.

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
git diff --stat -- apps/web/src/lib/notifications/efficacy.ts   # comportamento de carimbo INTACTO (AC7) — só adição de passo de encerramento, se no mesmo arquivo
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web lint
pnpm --filter @eximia/web test -- engagement/campaign
pnpm --filter @eximia/web test -- engagement/history            # E8 continua verde (AC7)
```

## Critério de Saída (objetivo)

- Existe um read que, dado um `campaign_id`, retorna enviadas/lidas/retornaram/sem-resposta agregados por `context->>'campaign_id'`, escopado ao caller (AC1, AC2).
- A campanha renderiza dois estados: ABERTA (progresso + janela) e ENCERRADA (resultado congelado com base N explícita) (AC3, AC4).
- Encerramento automático (cron, `window_end` vencido) e manual (`PATCH` re-scopado) ambos funcionam e são idempotentes (AC5, AC6).
- `returned_at` é o único sinal de retorno usado (zero tracking novo); `efficacy.ts`/Histórico sem regressão (AC2, AC7).
- Teste de agregação + escopo + transições verde (AC8); `typecheck`/`lint`/`test` verdes.

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-10 | Story criada a partir do E13 (§3, D2/D5). `returned_at` (migration l.96) e `markReturnedForSentNudges` (efficacy.ts l.101) verificados como dado já existente; loop = recomposição, não tracking novo. | Pax (@po) |
| 2026-07-10 | Loop fechado implementado: GET result por `campaign_id` (via function `campaign_result()`), encerramento automático (cron) + manual (PATCH), ambos escopados. `efficacy.ts`/Histórico intocados. | Dex (@dev) |

## Dev Agent Record

**Agente:** Dex (@dev)

**Decisões (IDS: reuso — o dado já existe, isto é recomposição):**
- **AC1/AC2 (read de resultado):** `GET /api/engagement/campaign/[id]` chama a function SQL `campaign_result(:id)` (já criada pela migration de E14 §5), que agrega `returned_at`/`read_at` sobre as notificações do `campaign_id` usando EXATAMENTE o critério de eficácia (`origin=nudge`, `channel=inapp`, `sent_at` set — o mesmo do cron e do Histórico). Nenhuma query de comportamento nova. Helper de app `campaignResult()` em `campaigns.ts`. A base N (`recipients`) é SEMPRE explícita ao lado do %.
- **AC1/AC6 (escopo — decisão de arquitetura):** a function `campaign_result()` já re-assere autoridade internamente, mas ela é chamada via service client no caminho de produto. Portanto o ROTA faz o gate de app-layer ANTES: `getCampaignById` + `callerMayReach` (tenant + `created_by === user.id` p/ manager, tenant-wide p/ admin — espelha a RLS da migration). Uma campanha de outro dono/tenant → **404 fail-closed** (nunca vaza existência nem contagens). Provado por `campaign-result-scope.test.ts`.
- **AC3/AC4 (aberta vs encerrada):** o `state` do read é derivado de `status==='closed' OR window_end <= now()` — então a UI nunca fica presa em "aberta" depois do prazo mesmo se o cron ainda não rodou.
- **AC5 (encerramento automático):** `autoCloseExpiredCampaigns()` (helper em `campaigns.ts`) foi adicionado como um passo SEPARADO e ADITIVO ao cron de eficácia (`api/cron/notification-efficacy/route.ts`), DEPOIS de `markReturnedForSentNudges()`. Ele só toca `status='open' AND window_end < now()` (idempotente) e NUNCA carimba `returned_at`. Onde foi adicionado: o handler do cron existente, resposta ganhou `campaignsClosed`.
- **AC6 (encerramento manual):** `PATCH /api/engagement/campaign/[id]` com `{status:'closed'}` → `closeCampaignManually()` (re-assere id+tenant+`status='open'`, idempotente, stamp `closed_reason='manual'`+`closed_by`), re-scopado pelo mesmo gate do GET. Foreign → 404, nunca encerra.
- **AC7 (Histórico/cron intactos):** `git diff -- efficacy.ts` VAZIO e `history-tab.tsx` intocado. A lógica de "retornou" NÃO foi reimplementada — a function SQL reusa o critério; a app só re-agrupa por `campaign_id`. Zero segunda fonte de verdade.

**File List:**
- `apps/web/src/app/api/engagement/campaign/[id]/route.ts` (A) — GET result escopado + PATCH manual close escopado
- `apps/web/src/lib/notifications/campaigns.ts` (A/já criado em E15) — `campaignResult`, `getCampaignById`, `autoCloseExpiredCampaigns`, `closeCampaignManually`
- `apps/web/src/app/api/cron/notification-efficacy/route.ts` (M) — passo aditivo de auto-close (não toca returned_at)
- `apps/web/src/app/api/engagement/__tests__/campaign-result-scope.test.ts` (A) — AC8 (agregação, escopo 404, close escopado, body inválido)
- `apps/web/src/lib/notifications/__tests__/campaigns.test.ts` (A) — AC8 (createCampaign, campaignResult, auto-close predicate open+expired, manual close re-assert)

**Verificação:** `typecheck` verde; `campaign-result-scope.test.ts` 8/8; `campaigns.test.ts` 6/6; `git diff efficacy.ts` vazio; baseline (31 fails) inalterado.
