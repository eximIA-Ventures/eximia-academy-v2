# E17: UI nova da aba Campanhas (revisão individual + resultado)

**Epic:** [00-EPIC-OVERVIEW](./00-EPIC-OVERVIEW.md)
**Status:** Draft
**Implementa:** [E13 — Proposta de Redesign da Aba Campanhas](./E13-campanhas-redesign-proposta.md) §2.1, §5.1, §5.2, decisões **D3**, **D4**, **D5**
**Depende de:** E15 (contratos preview/confirm com variação), E16 (read de resultado + encerramento)
**Bloqueia:** nenhuma (último degrau do redesign)

---

## Story

**As a** gestor,
**I want** entrar na aba Campanhas pelos 3 estados do semáforo, revisar linha-a-linha as N ações pré-preenchidas (ajustando só as que eu quiser), disparar tudo junto, e depois ver a campanha como um objeto vivo que me mostra quem voltou,
**so that** eu organize um lote de ações individuais revisáveis com loop fechado — não "1 mensagem para 40 pessoas", mas "N ações preparadas de uma vez, revisadas individualmente, disparadas juntas, medidas juntas" (E13 §2.1).

## Contexto (Dev Notes)

Ler [E13 §5.1](./E13-campanhas-redesign-proposta.md) (fluxo novo), [E13 §5.2](./E13-campanhas-redesign-proposta.md) (permanece vs muda) e [E13 §2.2](./E13-campanhas-redesign-proposta.md) (por que não vira 40 envios manuais) antes de começar.

**Esta story SUBSTITUI o wizard de 7 passos do E7 por uma tabela de revisão individual + estados de campanha (aberta/encerrada), consumindo os contratos de E15 e E16. A revisão obrigatória permanece (E13 §6, inegociável 2) — muda a granularidade (por-linha), não o princípio.**

- **Componente real a reescrever:** `apps/web/src/app/(platform)/engagement/_components/campaigns-tab.tsx` (o corpo do wizard E7 vive aqui). Verificado (2026-07-10) por @po que o diretório `_components/` já tem, prontos para reuso: `message-preview-panel.tsx` (o painel de origem/canal/texto compartilhado — E13 §5.1 origem/canal no cabeçalho), `derive-nudge-type.ts` (derivação de nudgeType no client, alinhar com a derivação server-side de E15/`computeStudentAction`), `nudge-labels.ts` (rótulos humanos, criado em E7), `engagement-fetch.ts`, `types.ts`.
- **Primitivos de UI disponíveis** (`packages/ui/src/components/`): `data-table.tsx`, `table.tsx`, `badge.tsx`, `button.tsx`, `select.tsx`, `textarea.tsx`, `empty-state.tsx`, `card.tsx`, `stat-card.tsx`, `skeleton.tsx`, `tabs.tsx`. Reusar, não recriar (IDS: REUSE > ADAPT > CREATE).
- **Tokens da casa (overview §5 / gate §12 critério 10):** NUNCA `bg-white dark:*`; usar `bg-bg-card`/`text-text-primary`/`text-text-*`/`border-*` (confirmar nomes em `theme.css`). O BUG 1 já foi corrigido (gate §12) — os tokens semânticos compilam. Referência visual: `dashboard/triage-cards.tsx`, `teaching-plan-highlights.tsx`.
- **Entrada pelo semáforo (E13 §5.1 passo 1-2 / §4):** a aba mostra os 3 estados de `StudentTriagem` com contagem do recorte ("🔴 Atenção: 5 · 🟡 Sem acesso: 8 · 🟢 No ritmo: 27"), não os 5 nudgeTypes. Clicar num estado inicia a campanha para esse segmento (chama o preview de E15 com `segment`). Decisão **D3** (aprovada): 🟢 "No ritmo" aparece como segmento SEPARADO e opcional (reconhecimento), não obrigatório.
- **Revisão individual (E13 §5.1 passo 4 / §2.2 / decisão D4):** tabela de N linhas; por linha o gestor pode: editar o texto daquela mensagem (override texto livre — D4), trocar o template daquela linha (D4), remover o aluno. O default é o pré-preenchido (velocidade); a opção é o toque individual (fidelidade). Origem (gestor/plataforma) e canal (in-app/email) no CABEÇALHO da campanha, não por linha (reusar `message-preview-panel.tsx` para o cabeçalho).
- **Cap de 200 comunicado ANTES (E13 §6 inegociável 1 / §5.1 passo 4):** banner âmbar explícito + botão de disparo travado se a lista final exceder — mesma UX do AC7 do E7.
- **Estados de campanha (E13 §3.2 / §5.1 passo 6-7, consome E16):** depois do disparo, a campanha aparece como objeto ABERTO ("12 enviadas · 5 lidas · aguardando retorno até 13/07") e, na janela cumprida ou encerramento manual, ENCERRADA ("Rodou de X a Y · 7 de 12 voltaram — 58%"). O botão "encerrar campanha agora" (D5 manual) chama o `PATCH` de E16.
- **Escopo é do backend (E13 §4.4 / §6):** a UI NUNCA fabrica destinatários — preview e confirm são re-scopados server-side (E15). A UI só renderiza o que o preview devolve e permite ajustar/remover. O confirm manda o array `recipients` já revisado.

## Acceptance Criteria

- [ ] **AC1:** A aba Campanhas lista os **3 estados do semáforo** (`atencao`/`sem_acesso`/`no_ritmo`) com contagem do recorte atual (não os 5 nudgeTypes do E7). 🟢 "No ritmo" é um segmento separado e opcional (D3). Contagens vêm escopadas do servidor (mesmo recorte que o resto da tela — Regra Absoluta de Escopo). Nenhum segmento com 0 alunos vira ação vazia.
- [ ] **AC2:** Clicar num segmento chama `POST /api/engagement/campaign` modo **preview** com `segment` (E15 AC1) e renderiza uma **tabela de N linhas**, uma por aluno, cada uma pré-preenchida com: nome (fallback email/id), motivo de inclusão daquele aluno, `nudgeType` derivado por aluno, e o texto do template pré-renderizado com o contexto dele (consome E15 AC2). A UI renderiza exatamente o que o servidor devolve (AC de segurança — nunca lista calculada no client).
- [ ] **AC3:** **Revisão individual por-linha (D4):** por linha o gestor pode (a) editar o texto livre daquela mensagem, (b) trocar o template daquela linha, (c) remover o aluno. As linhas não-editadas mantêm o pré-preenchido. Origem (gestor/plataforma) e canal (in-app/email) ficam no cabeçalho via `message-preview-panel.tsx` reusado.
- [ ] **AC4:** **Revisão obrigatória mantida (E13 §6 inegociável 2):** o disparo (confirm) só é alcançável a partir da tela de revisão; nenhum atalho dispara sem a revisão. O confirm envia o array `recipients: {studentId, message?, templateKey?}[]` de E15 AC3 (a variação por linha revisada).
- [ ] **AC5:** **Cap de 200 (E13 §6 inegociável 1):** banner âmbar explícito comunicado ANTES do envio + botão de disparo desabilitado quando a lista final excede 200 (usa `capped`/`total` do preview, mesma UX do E7 AC7).
- [ ] **AC6:** Após o disparo, a campanha aparece como objeto **ABERTO** consumindo o read de E16: "N enviadas · M lidas · aguardando retorno até {window_end}". Não é mais a tela "done" terminal e cega do E7.
- [ ] **AC7:** Campanha **ENCERRADA** (janela cumprida ou encerramento manual) mostra o resultado congelado de E16: janela {window_start}→{window_end}, N alunos, M retornaram + % (base N sempre explícita, nunca % solto — disciplina de E8/E16). Botão "encerrar campanha agora" (D5 manual) chama o `PATCH` de E16 e re-renderiza como encerrada.
- [ ] **AC8:** **A UI nunca fabrica destinatários (E13 §4.4 / §6 inegociável 4):** preview e confirm são re-scopados server-side; a UI só renderiza/ajusta/remove e manda o array revisado. Garantia estrutural herdada de E15 (o teste de não-vazamento vive lá); a UI não abre caminho paralelo (sem 2º fetch não-escopado, sem join client com dado tenant-wide) — mesma disciplina do AC3 de E8.
- [ ] **AC9:** Visual alinhado à casa (gate §12 critério 10): grep no arquivo tocado = ZERO `bg-white dark:` e zero `bg-white` cru; usa tokens `bg-bg-card`/`text-text-*`. Estado vazio para segmento sem alunos e para "nenhuma campanha ainda" (reusar `empty-state.tsx`).

## Tasks

- [ ] 1. Ler `campaigns-tab.tsx` (wizard E7 atual), `message-preview-panel.tsx`, `derive-nudge-type.ts`, `nudge-labels.ts`, `engagement-fetch.ts`, `types.ts` na íntegra.
- [ ] 2. Reescrever a listagem de entrada para os 3 estados do semáforo com contagem escopada (AC1).
- [ ] 3. Implementar a tabela de revisão individual consumindo o preview de E15 (AC2, AC3).
- [ ] 4. Ligar o cabeçalho origem/canal via `message-preview-panel.tsx` reusado (AC3) + cap de 200 (AC5).
- [ ] 5. Implementar o confirm com o array `recipients` revisado, só a partir da revisão (AC4).
- [ ] 6. Implementar os estados ABERTA/ENCERRADA consumindo o read de E16 + botão de encerramento manual (AC6, AC7).
- [ ] 7. Estados vazios + varredura de tokens (AC9); testes de componente se o padrão do repo (`__tests__/`) exigir.
- [ ] 8. `pnpm --filter @eximia/web typecheck` + `lint` + `test -- engagement/campaign` verdes.

## Complexidade & Riscos

- **Complexidade:** L (large). Reescreve o corpo da aba (wizard → tabela de revisão individual), adiciona 2 estados de campanha (aberta/encerrada) e a variação por-linha, consumindo dois contratos novos (E15, E16). É a maior superfície de UI do redesign.
- **Riscos:**
  - R1 (**alto** — herdado): campanha coletiva é onde um vazamento de escopo tem maior impacto. Mitigação: AC8 — a UI não abre caminho paralelo; o re-scope é server-side (E15). O teste de não-vazamento vive em E15; esta story garante que a UI não o contorna.
  - R2 (médio): pular a revisão = envio em massa não revisado (kill list Seção 16 do report / E13 §6). Mitigação: AC4 trava o confirm apenas a partir da revisão por-linha.
  - R3 (médio): a tabela de N linhas com edição por-linha pode ficar pesada/confusa com 200 alunos. Mitigação: default pré-preenchido (E13 §2.2 — o gestor ajusta só o que quiser); considerar virtualização se `data-table.tsx` já suportar. Documentar a decisão de UX no Dev Agent Record.
  - R4 (baixo): divergência entre a derivação de nudgeType no client (`derive-nudge-type.ts`) e a server-side (E15/`computeStudentAction`). Mitigação: AC2 exige renderizar o que o SERVIDOR devolve; a derivação client é só apresentação/otimismo, o servidor é a fonte de verdade.

## Regra Absoluta de Escopo (verificação)

Blocker. As contagens dos 3 segmentos (AC1), a lista de revisão (AC2) e o resultado (AC6/AC7) vêm todos escopados do servidor; a UI não abre caminho paralelo (AC8). Cenário canônico Rinaldo (Seção 2 do overview): um gestor com 6 alunos nunca vê contagem, destinatário ou resultado do tenant inteiro. Herdado byte-a-byte do rigor de E7 AC9 + E8 AC3.

## Restrições de Segurança Herdadas (E13 §6 — INEGOCIÁVEIS, não reabrir)

1. **Cap de 200** — AC5 (banner + botão travado ANTES do envio).
2. **Revisão obrigatória antes do disparo** — AC4 (confirm só a partir da revisão por-linha).
3. **Re-scope no confirm** — garantido server-side por E15; a UI manda o array revisado, o servidor re-filtra (AC8).
4. **Preview server-side (UI nunca fabrica destinatários)** — AC2/AC8.
5. **Auditoria do E7 não reaberta** — esta story troca a UI/modelo mental por cima da trava intacta (E13 §7/§9).

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
grep -n "bg-white" apps/web/src/app/\(platform\)/engagement/_components/campaigns-tab.tsx   # deve retornar VAZIO (AC9)
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web lint
pnpm --filter @eximia/web test -- engagement/campaign
```

## Critério de Saída (objetivo)

- A aba Campanhas entra pelos 3 estados do semáforo (AC1), abre uma tabela de revisão individual pré-preenchida por aluno (AC2), permite ajuste/remoção por-linha (AC3), e só dispara a partir da revisão (AC4).
- Cap de 200 comunicado antes + botão travado (AC5).
- Pós-disparo: campanha ABERTA com progresso (AC6); ENCERRADA com resultado + base N e botão de encerramento manual (AC7).
- UI não fabrica destinatários nem abre caminho paralelo (AC8); zero `bg-white`, estados vazios presentes (AC9).
- `pnpm --filter @eximia/web typecheck && lint && test -- engagement/campaign` verdes.

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-10 | Story criada a partir do E13 (§2.1/§5.1/§5.2, D3/D4/D5). Reuso de `message-preview-panel.tsx`/`derive-nudge-type.ts`/`nudge-labels.ts` confirmado no diretório real `_components/`. | Pax (@po) |
