# E15: Engine de disparo com variação por destinatário

**Epic:** [00-EPIC-OVERVIEW](./00-EPIC-OVERVIEW.md)
**Status:** Draft
**Implementa:** [E13 — Proposta de Redesign da Aba Campanhas](./E13-campanhas-redesign-proposta.md) §2.2, §4.3, §5.3, decisões **D3**, **D4**
**Depende de:** E14 (tabela `campaigns` + `campaign_id`)
**Bloqueia:** E16 (loop lê o que E15 grava), E17 (UI consome os contratos de E15)

---

## Story

**As a** gestor,
**I want** que o preview me devolva, por aluno, o motivo de inclusão e o texto pré-renderizado, e que o confirm aceite uma variação de mensagem/template por destinatário — sem eu redigir 40 mensagens do zero,
**so that** eu fale diferente com cada aluno (o Venilton que nunca acessou vs o Artur que sumiu há 54 dias estando em dia) dentro de um mesmo ato de organização, com a trava de segurança do E7 intacta.

## Contexto (Dev Notes)

Ler [E13 §2.2](./E13-campanhas-redesign-proposta.md) (por que não vira 40 envios manuais), [E13 §4.3](./E13-campanhas-redesign-proposta.md) (variação cai de graça do semáforo) e [E13 §5.3](./E13-campanhas-redesign-proposta.md) (delta honesto do backend) antes de começar.

**A trava de segurança do E7 é herdada byte-a-byte (E13 §6). Esta story ADICIONA variação por destinatário ACIMA da trava, sem tocá-la.** A auditoria de segurança do E7 NÃO é reaberta (E13 §9).

- **Rota real a estender:** `apps/web/src/app/api/engagement/campaign/route.ts`. Verificado (2026-07-10) por @po que ela já tem: `mode` `preview|confirm` (l.78), `MAX_RECIPIENTS = 200` (l.23), `resolveAudienceScoped` no preview (l.99), `resolveEngagementScope` no confirm (l.160), `dispatchTeamNudge` (l.183) com uma **única `message`** por lote (l.188). A mudança é aditiva no payload; a trava de 4 passos permanece.
- **`dispatchTeamNudge` (`apps/web/src/lib/notifications/engine.ts`)** JÁ aceita `message?: string | null` que sobrescreve o corpo (E1/overview §5). Hoje é UMA string para o lote. A variação por destinatário é: em vez de uma `message`, o confirm recebe um array `{ studentId, message?, templateKey? }` (E13 §5.3, decisão **D4**: template como default + texto livre como override). O re-scope continua filtrando os `studentId` exatamente como hoje (`safeIds`).
- **Derivação do `nudgeType` por aluno (o coração da variação — E13 §4.3):** usar `computeStudentAction(triagem, totalSessions)` de `apps/web/src/lib/student-triage.ts`. Verificado (2026-07-10) por @po: a linha 121 faz `nudgeType: totalSessions === 0 ? "never_accessed" : "inactive"` — exatamente o desempate que E13 cita. Dentro de um segmento "Atenção", o aluno com `totalSessions===0` mapeia para `never_accessed` e o atrasado para `inactive`, POR ALUNO. A segmentação unificada e a personalização individual são a mesma decisão de design (E13 §4.3). **NÃO tocar `student-triage.ts`/`computeStudentAction`** — ele é imutável neste epic (verificado intocado nos gates §11/§12 do overview); apenas CONSUMIR.
- **Segmentação de entrada = semáforo (E13 §4):** o ponto de partida deixa de ser os 5 `nudgeType` e passa a ser os 3 estados de `StudentTriagem` (`atencao` 🔴 / `sem_acesso` 🟡 / `no_ritmo` 🟢). O `nudgeType` NÃO some — ele passa a ser DERIVADO por aluno a partir do segmento (E13 §4.3). Decisão **D3** (aprovada): `no_ritmo` PODE originar campanha de reconhecimento, como segmento separado e opcional (reusa `top_performer`/template de reconhecimento de E1 AC7).
- **`campaign_id` (de E14):** o confirm gera um `campaign_id` (uuid), insere a linha em `campaigns` (E14), e grava `campaign_id` no `context` de cada notificação criada (E13 §5.3). O INSERT em `campaigns` calcula `window_end` (default 7d — D2, ver E14).
- **Renderização pré-preenchida (preview):** o preview passa a retornar, por aluno, além da lista: `nudgeType` derivado (via `computeStudentAction`) + o texto do template renderizado com o contexto DAQUELE aluno. Reusar o `renderTemplate` já usado hoje (`{{primeiro_nome}}`/`{{curso}}`). Mudança aditiva no payload do preview, não quebra a trava.

## Acceptance Criteria

- [ ] **AC1:** `POST /api/engagement/campaign` modo **preview** passa a aceitar `segment` (um estado de `StudentTriagem`: `atencao|sem_acesso|no_ritmo`) como origem do recorte, resolvido server-side por `resolveAudienceScoped` + a triagem sobre o universo escopado — a UI nunca manda lista pronta (E13 §4.4, restrição herdada). O critério antigo por `nudgeType`/`criteria.risk` continua aceito para retrocompat (não quebrar E7), mas o caminho novo é por `segment`. Documentar a coexistência no Dev Agent Record.
- [ ] **AC2:** O preview retorna, para CADA destinatário: `studentId`, nome (fallback email/id), `nudgeType` **derivado por aluno** via `computeStudentAction` (never_accessed vs inactive conforme `totalSessions`), motivo de inclusão daquele aluno, e o texto do template **pré-renderizado** com o contexto dele. Payload aditivo — os campos de E7 continuam presentes.
- [ ] **AC3:** `POST /api/engagement/campaign` modo **confirm** passa a aceitar, em vez de uma `message` única, um array `recipients: { studentId, message?, templateKey? }[]` (decisão D4: `templateKey` = default por linha, `message` = override texto livre por linha; ausência de ambos → cai no template do `nudgeType` derivado). A `message` única legada continua aceita como fallback para retrocompat com E7. Documentar a precedência no Dev Agent Record.
- [ ] **AC4:** **Re-scope no confirm INTACTO (E13 §6, inegociável 3):** os `studentId` do array `recipients` são re-validados server-side contra `resolveEngagementScope` + `?focus=` exatamente como hoje (`safeIds`); um id removido/estrangeiro nunca reentra. A variação por linha NÃO abre um caminho paralelo de escopo — o filtro de ids acontece ANTES de montar as mensagens variadas. Coberto por teste (AC9).
- [ ] **AC5:** **Cap de 200 INTACTO (E13 §6, inegociável 1):** `recipients.length > MAX_RECIPIENTS` rejeitado no confirm (como hoje, l.142); o cap é sobre a lista final de destinatários, independentemente da variação por linha.
- [ ] **AC6:** No confirm, gerar `campaign_id` (uuid), inserir a linha em `campaigns` (E14: `segment_type`, `focus_node`, `window_start=now()`, `window_end=now()+7d`, `status='open'`, `created_by`, `tenant_id`), e gravar `campaign_id` no `context` de cada `notification` criada pelo `dispatchTeamNudge`. Se o INSERT em `campaigns` falhar, o dispatch NÃO acontece (transação/ordem: cabeçalho antes das mensagens, ou compensação documentada).
- [ ] **AC7:** A variação por destinatário é aplicada via o `message` override já existente de `dispatchTeamNudge` (por aluno agora, não por lote) — NÃO reescrever o dispatch nem inventar um segundo caminho de envio. Se `dispatchTeamNudge` hoje só aceita uma `message` para o lote inteiro, estendê-lo para aceitar a variação por aluno preservando o claim atômico/padrão existente (overview §5: `approveSuggestion` faz compare-and-set; não quebrar esse padrão em fluxos de dispatch). Documentar a extensão exata no Dev Agent Record.
- [ ] **AC8:** `student-triage.ts` / `computeStudentAction` permanecem **byte-idênticos** (imutáveis no epic — gates §11/§12). Verificar com `git diff -- apps/web/src/lib/student-triage.ts` VAZIO ao final. A variação vem de CONSUMIR `computeStudentAction`, nunca de alterá-lo.
- [ ] **AC9:** Teste automatizado (estender `routes-leak.test.ts` de E3 ou um novo `campaign-variation.test.ts`) que prova: (a) um `studentId` fora do recorte no array `recipients` é DROPADO no confirm (não recebe mensagem); (b) o cap de 200 rejeita; (c) o `nudgeType` derivado por aluno bate com `computeStudentAction` para um aluno `totalSessions===0` (never_accessed) e um atrasado (inactive). O cenário canônico Rinaldo (epic overview Seção 2) continua verde.

## Tasks

- [ ] 1. Ler `campaign/route.ts` (preview+confirm), `dispatchTeamNudge`/`renderTemplate` em `engine.ts`, e `computeStudentAction` em `student-triage.ts` na íntegra.
- [ ] 2. Estender o **preview** para aceitar `segment` + retornar `nudgeType` derivado + texto pré-renderizado por aluno (AC1, AC2), sem remover o caminho legado de E7.
- [ ] 3. Estender o **confirm** para aceitar `recipients[]` com variação por linha, mantendo re-scope + cap (AC3, AC4, AC5).
- [ ] 4. Gerar `campaign_id`, inserir em `campaigns`, gravar no `context` das notificações (AC6).
- [ ] 5. Estender `dispatchTeamNudge` para variação por aluno preservando o padrão atômico (AC7).
- [ ] 6. Escrever/estender o teste de não-vazamento + derivação (AC9); confirmar `student-triage.ts` intocado (AC8).
- [ ] 7. `pnpm --filter @eximia/web typecheck` + `lint` + `test -- engagement/campaign` verdes.

## Complexidade & Riscos

- **Complexidade:** L (large). Estende preview E confirm, muda o contrato de mensagem de "1 string" para "array por aluno", integra `campaigns`, tudo POR TRÁS de uma trava de segurança que não pode regredir.
- **Riscos:**
  - R1 (**alto**): a variação por destinatário é onde um erro de escopo tem maior impacto (mensagem variada disparada a aluno de outro time). Mitigação: AC4 exige que o re-scope aconteça ANTES de montar as mensagens variadas; AC9 (teste) prova o drop do id estrangeiro. Este é o mesmo R1 do E7, herdado.
  - R2 (médio): estender `dispatchTeamNudge` para variação por aluno pode quebrar o claim atômico existente ou outros consumidores. Mitigação: AC7 exige preservar o padrão e documentar a extensão; impacto em consumidores checado antes.
  - R3 (médio): ordem de escrita (INSERT `campaigns` vs criar notificações) — falha parcial deixaria mensagens órfãs sem cabeçalho, ou cabeçalho sem mensagens. Mitigação: AC6 exige ordem/transação definida (cabeçalho antes; falha do cabeçalho aborta o dispatch).
  - R4 (baixo): consumir `computeStudentAction` errado (assinatura `(triagem, totalSessions)`) geraria `nudgeType` errado por aluno. Mitigação: AC2/AC9 amarram ao comportamento real da l.121.

## Regra Absoluta de Escopo (verificação)

Blocker. A variação por destinatário NÃO pode reintroduzir vazamento: o re-scope no confirm (AC4) filtra os ids ANTES da montagem das mensagens variadas. Cenário canônico Rinaldo (Seção 2 do overview) coberto por AC9. Idêntico em rigor ao AC9 do E7, agora com o array `recipients` como superfície nova a testar.

## Restrições de Segurança Herdadas (E13 §6 — INEGOCIÁVEIS, não reabrir)

1. **Cap de 200** — AC5.
2. **Revisão obrigatória antes do disparo** — garantida pela UI (E17); o confirm só recebe `recipients` já revisados. A rota não expõe um caminho de dispatch por critério puro (E13 §5.2 / overview §11 critério 7).
3. **Re-scope no confirm** — AC4, byte-a-byte com E7.
4. **Preview server-side** — AC1 (segment resolvido server-side, UI nunca fabrica destinatários).
5. **Auditoria do E7 não reaberta** — esta story adiciona a camada de variação ACIMA da trava, sem tocá-la (E13 §9).

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
git diff --stat -- apps/web/src/lib/student-triage.ts   # DEVE estar vazio (AC8)
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web lint
pnpm --filter @eximia/web test -- engagement/campaign     # inclui não-vazamento + derivação (AC9)
```

## Critério de Saída (objetivo)

- `campaign/route.ts` preview retorna `nudgeType` derivado + texto pré-renderizado por aluno (AC2); confirm aceita `recipients[]` com variação por linha (AC3).
- Re-scope no confirm e cap de 200 provados intactos por teste (AC4, AC5, AC9); id estrangeiro dropado.
- Cada notificação do lote carrega `campaign_id` no `context`, e existe a linha correspondente em `campaigns` com `status='open'` e `window_end` = +7d (AC6).
- `git diff -- student-triage.ts` VAZIO (AC8).
- `pnpm --filter @eximia/web typecheck && lint && test -- engagement/campaign` verdes.

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-10 | Story criada a partir do E13 (§2.2/§4.3/§5.3, D3/D4). Claims de código (campaign route, dispatchTeamNudge, computeStudentAction l.121) verificados contra o repo real. | Pax (@po) |
