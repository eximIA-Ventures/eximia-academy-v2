# SH-F.1: Poda do órfão `StudentProgressHeadline` (componente sem uso)

**Epic:** [EPIC-STUDENT-HOME-FINALIZACAO](./EPIC-STUDENT-HOME-FINALIZACAO.md)
**Status:** Draft
**Insumo obrigatório:** `03-finalizacao-plan.md` §1 (SH-F.1) e §3. Ler antes de começar.
**Depende de:** nada. Opera sobre a base `feat/SH-1.4-student-home-card` (HEAD `d8b7f85`).
**Bloqueia:** nada diretamente. É pré-condição de árvore limpa para o merge.
**Paralelizável:** SIM com SH-F.3 (Par B) e SH-F.4 (Par C). Par A junto de SH-F.2 (mesmo par para eliminar coordenação cross-par sobre o baseline dos 8 testes pré-existentes; ver epic §7).

---

## Story

**As a** desenvolvedor finalizando a home do aluno para o merge,
**I want** remover SOMENTE o componente órfão `student-progress-headline.tsx`, que não é importado por nenhum código de app, preservando integralmente o helper `buildProgressHeadline` (vivo, usado pelo CTA) e o teste que cobre esse helper,
**so that** a árvore fique sem código morto no merge, sem perder nenhuma cobertura de função em uso (subtração cirúrgica, não faxina).

## Contexto (Dev Notes)

Achado de código que corrige o briefing original (verificado na worktree `/Users/hugocapitelli/Dev/eximia/sh-1.4-worktree`):

- O **componente** `apps/web/src/components/analytics/student-progress-headline.tsx` (export `StudentProgressHeadline`, linha 69) **não é importado por nenhum código de app**. Prova: `grep -rn "from .*student-progress-headline\|import.*StudentProgressHeadline" apps/web/src` retorna 0 imports reais. As únicas menções fora do próprio arquivo são **comentários**: `dev/preview-desempenho/page.tsx:62` e `student-home-card.tsx:23-24` (que documenta explicitamente que o componente está UNUSED e não deve ser deletado por engano em outra fatia).
- O **helper** `buildProgressHeadline` vive em `apps/web/src/components/analytics/student-comparison-scale.ts:353` e **continua em uso**: importado e chamado por `student-home-card.tsx:33` e `:92` (deriva a linha de coaching do CTA). Ele NÃO é o alvo desta story.
- O teste `apps/web/src/components/analytics/__tests__/student-progress-headline.test.ts` importa `buildProgressHeadline` de `"../student-comparison-scale"` (linha 6), ou seja, **testa o helper, não o componente**. Apagar esse teste perderia cobertura de função viva, seria regressão silenciosa. Portanto ELE PERMANECE.

**Correção do briefing (plano §1 SH-F.1):** o briefing dizia "pode o componente órfão + seu teste". Na prática **não existe teste do componente**. A poda é **só o `.tsx`**. O `.test.ts` fica (opcionalmente RENOMEADO para `student-comparison-scale.progress-headline.test.ts`, por honestidade de nome, mudança aditiva sem tocar o conteúdo dos testes).

## Acceptance Criteria

- [ ] **AC1 (precondição bloqueante, provada ANTES de podar):** `grep -rn "from .*student-progress-headline\|import.*StudentProgressHeadline" apps/web/src` retorna **0 imports de app** (só self-file e comentários). Se retornar qualquer import real, a story PARA e reporta, não poda.
- [ ] **AC2 (subtração):** o arquivo `apps/web/src/components/analytics/student-progress-headline.tsx` deixa de existir após a poda.
- [ ] **AC3 (helper preservado):** `buildProgressHeadline` continua existindo em `student-comparison-scale.ts` e continua sendo importado/chamado por `student-home-card.tsx`. Prova: `grep -rn "buildProgressHeadline" apps/web/src` mostra `student-comparison-scale.ts`, `student-home-card.tsx` e o arquivo de teste (o componente já não aparece).
- [ ] **AC4 (teste do helper preservado):** `student-progress-headline.test.ts` (ou o `.test.ts` renomeado) continua presente e VERDE, testando `buildProgressHeadline`. Nenhuma asserção do teste é alterada.
- [ ] **AC5 (typecheck limpo):** `pnpm --filter @eximia/web typecheck` passa, sem nenhum import pendente do componente removido.
- [ ] **AC6 (delta zero de suíte):** o conjunto pass/fail de `pnpm --filter @eximia/web test` é **o MESMO antes e depois** da poda (nenhum teste perdido, nenhum teste novo quebrado). Registrar os dois conjuntos como evidência.

## Tasks

- [ ] 1. Rodar a precondição (AC1): `grep -rn "from .*student-progress-headline\|import.*StudentProgressHeadline" apps/web/src`. Só prosseguir se retornar 0 imports de app.
- [ ] 2. Capturar baseline da suíte: `pnpm --filter @eximia/web test` e registrar o conjunto pass/fail (para o delta-zero da AC6).
- [ ] 3. Deletar `apps/web/src/components/analytics/student-progress-headline.tsx`.
- [ ] 4. (Opcional, aditivo) Renomear `__tests__/student-progress-headline.test.ts` para `__tests__/student-comparison-scale.progress-headline.test.ts`, sem alterar o conteúdo dos testes.
- [ ] 5. (Opcional, cosmético) Atualizar o comentário em `apps/web/src/app/dev/preview-desempenho/page.tsx:62` que menciona o componente removido. NÃO tocar `student-home-card.tsx` (é arquivo de outra fatia; o comentário lá pode permanecer).
- [ ] 6. Rodar `pnpm --filter @eximia/web typecheck` (AC5).
- [ ] 7. Rodar `pnpm --filter @eximia/web test` de novo e confirmar o MESMO conjunto pass/fail do passo 2 (AC6).

## Complexidade & Riscos

- **Complexidade:** XS (extra small). Um delete + verificação.
- **Riscos:**
  - R1 (baixo, mitigado por AC1): deletar algo ainda usado. Mitigação: a precondição de grep é bloqueante, provada antes de qualquer remoção.
  - R2 (baixo): apagar o helper ou o teste do helper por engano (regressão silenciosa). Mitigação: AC3 e AC4 explícitos, escopo trava a poda no `.tsx`.

## Dev Notes

- **Natureza: SUBTRAÇÃO (aditivo em nada, remove 1 arquivo).** Não há mudança de comportamento de app, o componente já estava sem uso. Não é breaking: nenhum import de app depende dele (AC1).
- **File-disjunto:** o único arquivo removido é `student-progress-headline.tsx`. Os arquivos opcionais tocados (`.test.ts` renomeado, comentário do `preview-desempenho/page.tsx`) não são donos de nenhuma outra story (matriz de conflito, epic §7). Não editar `vitest.config.ts` (SH-F.2), `area-gestor.ts`/`org-reference-cache.ts` (SH-F.3), nem `seed-student-home-demo.ts` (SH-F.4).
- Não reabrir a premissa de finalização do epic §3.1: "poda é subtração cirúrgica, não faxina".

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/sh-1.4-worktree
# AC1 (precondição, antes de podar): deve retornar 0 imports de app
grep -rn "from .*student-progress-headline\|import.*StudentProgressHeadline" apps/web/src
# AC3 (helper vivo, após podar): mostra scale + card + teste, sem o componente
grep -rn "buildProgressHeadline" apps/web/src
pnpm --filter @eximia/web typecheck          # AC5
pnpm --filter @eximia/web test                # AC6: mesmo conjunto pass/fail antes/depois
```

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-12 | Story criada a partir de `EPIC-STUDENT-HOME-FINALIZACAO.md` §4/§10 + `03-finalizacao-plan.md` §1 (SH-F.1). Fatos de código (0 imports, helper vivo em `scale.ts:353`, teste cobre o helper) verificados na worktree SH-1.4. | Roteiro (@sm) |
| 2026-07-12 | Validação PO: fatos reconfirmados na worktree, achado extra (asserções `toBe` de string exata no teste do helper). Veredito GO. | Contrato (@po) |

---

## PO Validation & Critérios Fortalecidos (@po)

> **Veredito: GO (9,5/10).** Poda cirúrgica de risco mínimo, precondição de grep bloqueante, todos os fatos reconfirmados na worktree por este @po. Um achado extra reforça a AC4.

### Fatos reconfirmados (worktree `sh-1.4-worktree`, 2026-07-12)

- `student-progress-headline.tsx` existe; `grep` de import real de app retorna **0** (só o próprio arquivo e comentários em `student-home-card.tsx:24` e `preview-desempenho`).
- `buildProgressHeadline` vivo em `student-comparison-scale.ts:353`, importado e chamado por `student-home-card.tsx:33` e `:92`.
- **Achado extra do @po:** o teste `__tests__/student-progress-headline.test.ts` não só tem o guard `.not.toContain("—")` (linhas 58-59) como também asserções `toBe(...)` de STRING EXATA sobre `buildProgressHeadline(...).headline` (linhas 64-67). Isso torna a AC4 ("nenhuma asserção alterada") mais forte na prática: se o dev renomear o arquivo, o conteúdo é byte-idêntico, senão os `toBe` quebram e denunciam a alteração. Renomear é seguro; editar conteúdo não é.

### Given/When/Then

- **AC1 (precondição bloqueante):** *Given* a árvore antes da poda; *When* `grep -rn "from .*student-progress-headline\|import.*StudentProgressHeadline" apps/web/src`; *Then* retorno = só self-file + comentários, **0 import real**. Se aparecer 1 import real, a story PARA e reporta, não poda.
- **AC3/AC4 (helper e teste preservados):** *When* após a poda `grep -rn "buildProgressHeadline" apps/web/src`; *Then* aparece em `student-comparison-scale.ts`, `student-home-card.tsx` e no `.test.ts`, e NÃO aparece mais o componente. Os `toBe` de string exata do teste continuam verdes sem edição.
- **AC6 (delta-zero de suíte):** *Given* o conjunto pass/fail capturado ANTES; *When* após a poda; *Then* conjunto IDÊNTICO (mesmos N verdes, mesmos falhando). Como a home tem 8 falhas reais pré-existentes (baseline de SH-F.2), "delta-zero" aqui significa: os mesmos verdes continuam verdes e os mesmos 8 continuam os 8, nenhum a mais nem a menos.

### Comandos de Verificação (exatos)

```bash
cd /Users/hugocapitelli/Dev/eximia/sh-1.4-worktree
grep -rn "from .*student-progress-headline\|import.*StudentProgressHeadline" apps/web/src   # AC1: 0 import real ANTES de podar
grep -rn "buildProgressHeadline" apps/web/src   # AC3/AC4: helper vivo + teste, sem o componente
pnpm --filter @eximia/web typecheck             # AC5: sem import pendente
pnpm --filter @eximia/web test                  # AC6: mesmo conjunto pass/fail antes/depois
```

### Critério de PRONTO (o revisor do Par A usa)

grep AC1 = 0 import real (registrado ANTES); `student-progress-headline.tsx` deletado; `buildProgressHeadline` e o teste do helper intactos (conteúdo do teste byte-idêntico, `toBe` verdes); typecheck limpo; conjunto pass/fail idêntico ao baseline. Subtração de 1 arquivo, nada mais tocado (matriz §7).

### Placar 10 pontos PO

1. Objetivo/contexto: 1 · 2. ACs testáveis: 1 · 3. Precisão técnica (reconfirmada): 1 · 4. Rastreabilidade Art. IV: 1 · 5. Autossuficiência: 1 · 6. Dependências: 1 · 7. Escopo (só o `.tsx`): 1 · 8. Teste runnable: 1 · 9. Riscos+mitigação: 1 · 10. First-move/anti-regressão: 0,5 (baseline pass/fail deve ser capturado ANTES, explicitado). **Total: 9,5 → GO.**

---

## Dev Agent Record (@dev — Bigorna, Par A) — Status: InReview

**Worktree:** `sh-1.4-worktree`, branch `feat/SH-1.4-student-home-card`, HEAD `d8b7f85`. Sem commit até PASS do Crivo. Modelo Opus.

### Baseline coordenado (compartilhado com SH-F.2, capturado ANTES de qualquer mudança)

`pnpm --filter @eximia/web test` no HEAD pristino: **8 arquivos falhando** / 82 passando (90); **31 testes falhando** / 734 passando (765). Os 8 (todos pré-existentes, alheios a esta fatia): `sessions/[sessionId]/messages/route.test.ts`, `login-form-google-oauth.test.tsx`, `manager-course-dashboard.test.tsx`, `manager-dashboard-order.test.tsx`, `manager-dashboard.test.tsx`, `student-dashboard.test.tsx`, `step-employee-status.test.tsx`, `rate-limit.test.ts`.

### Execução

- **AC1 (precondição bloqueante):** `grep -rn "from .*student-progress-headline\|import.*StudentProgressHeadline" apps/web/src` → **0 imports reais**. As 3 menções restantes de `student-progress-headline`/`StudentProgressHeadline` são: `preview-desempenho/page.tsx:62` (comentário) e `student-home-card.tsx:23` (comentário que documenta o UNUSED) e o próprio arquivo. Prosseguiu-se com a poda.
- **AC2:** `git rm apps/web/src/components/analytics/student-progress-headline.tsx` (‑151 linhas).
- **AC4 (rename aditivo):** `git mv __tests__/student-progress-headline.test.ts → __tests__/student-comparison-scale.progress-headline.test.ts`. Conteúdo **byte-idêntico** (0 linhas alteradas no diff do rename); os `toBe(...)` de string exata do helper seguem verdes (8 testes). O teste importa `buildProgressHeadline`/`toMetricBar` de `../student-comparison-scale` — testa o HELPER, nunca o componente.
- **AC3 (helper vivo):** `grep -rn "buildProgressHeadline" apps/web/src` → `student-comparison-scale.ts` (def), `student-home-card.tsx:33,92` (uso no CTA), teste renomeado. O componente sumiu.
- **Task 5 (cosmético):** atualizado o comentário `preview-desempenho/page.tsx:62` (não referencia mais o componente removido). `student-home-card.tsx` NÃO tocado (arquivo de outra fatia; seu comentário fica).
- **AC5:** `tsc --noEmit` → exit 0 (nenhum import pendente).
- **AC6 (delta-zero):** `pnpm --filter @eximia/web test` após a poda → **conjunto de falhas IDÊNTICO ao baseline** (mesmos 8 arquivos, 82 passando, 31/734 testes). `diff` dos dois conjuntos = vazio. Nenhum teste perdido, nenhum antes-verde virou vermelho.

### File List

- `apps/web/src/components/analytics/student-progress-headline.tsx` — **DELETADO** (órfão, ‑151 linhas).
- `apps/web/src/components/analytics/__tests__/student-progress-headline.test.ts` → `.../student-comparison-scale.progress-headline.test.ts` — **RENOMEADO** (byte-idêntico, testa o helper).
- `apps/web/src/app/dev/preview-desempenho/page.tsx` — comentário atualizado (cosmético, ‑1/+1).

### Coordenação pós-`2b50411` (SH-F.3 mesclada na mesma branch)

Após o Par B commitar SH-F.3 (HEAD `2b50411`, adiciona `org-reference-cache.test.ts` e mexe em `area-gestor.ts` — arquivo que esta fatia NÃO toca), o **delta-zero da AC6 foi re-medido na árvore atual**: os **mesmos 8** arquivos de falha reais permanecem inalterados. O total de testes verdes subiu de 734→**737** (+3) e de 90→**91** arquivos, exclusivamente pelo teste novo do F.3 que entra PASS. Isso **não é violação do delta-zero** (o conjunto dos 8 reais não mudou; a poda não perdeu nem quebrou nenhum teste), é o efeito esperado da fatia irmã. Medição final feita pós-`2b50411`.

### Change Log add

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-12 | Poda executada (delete do componente + rename do teste do helper + comentário). AC1‑AC6 provados, delta-zero. Status → InReview. | Bigorna (@dev, Par A) |
| 2026-07-12 | Delta-zero re-medido pós-`2b50411` (F.3 mesclada): mesmos 8 reais; +3 verdes do teste novo de F.3 (esperado). | Bigorna (@dev, Par A) |
