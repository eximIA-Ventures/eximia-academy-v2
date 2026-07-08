# E10: Ponte Tabela→Centro, Navegação, Kill List

**Epic:** [00-EPIC-OVERVIEW](./00-EPIC-OVERVIEW.md)
**Status:** Draft
**Depende de:** E6 (Sheet de Ação Individual), E9 (templates de reconhecimento)
**Bloqueia:** nenhuma (fecha o epic funcionalmente antes de E11)

---

## Story

**As a** gestor,
**I want** que os botões Lembrar/Acionar/No ritmo da tabela de alunos abram diretamente o Centro de Engajamento pré-preenchido,
**so that** eu não precise navegar manualmente nem re-selecionar o aluno depois de decidir agir.

## Contexto (Dev Notes)

Ler Seção 6 e Seção 16 do report antes de começar. Ler `00-EPIC-OVERVIEW.md` Seção 5 (nota sobre incerteza de `student-insights-table.tsx`).

- Componente-alvo: `apps/web/src/components/analytics/student-insights-table.tsx`, que JÁ SUPORTA `variant="manager"` e `canNudge` (confirmado por leitura de código em 2026-07-08). O que NÃO está confirmado é se os botões visuais Lembrar/Acionar/No ritmo já estão implementados dentro deste arquivo ou ainda precisam ser adicionados — a PRIMEIRA task desta story é abrir o arquivo e confirmar isso antes de qualquer outra coisa.
- Lógica de qual botão mostrar para cada aluno: `computeStudentAction(triagem, totalSessions)` em `apps/web/src/lib/student-triage.ts`, que já retorna `{kind:"none"}` | `{kind:"lembrar", nudgeType}` | `{kind:"acionar", nudgeType}`. Botão "No ritmo" corresponde a `{kind:"none"}` (badge estática, sem ação obrigatória).
- DECISÃO DO ORQUESTRADOR (tomada, NÃO reabrir — 2026-07-08): **`computeStudentAction` em `apps/web/src/lib/student-triage.ts` NÃO muda.** Verificação de código (2026-07-08) confirmou dois fatos que fecham a questão:
  1. A assinatura é `computeStudentAction(triagem: StudentTriagem | undefined, totalSessions: number)` — a função recebe SOMENTE `triagem` (`no_ritmo`|`atencao`|`sem_acesso`), **não recebe `ritmo`**. Ela é estruturalmente incapaz de distinguir `atrasado` de `nao_iniciado`, porque `atencao` já colapsou os dois. Fazê-la distinguir exigiria mudar a assinatura e todos os call-sites — custo desproporcional.
  2. A função tem múltiplos consumidores em produção (`student-insights-table.tsx` linhas 248 e 902) e um contrato de teste travado (`apps/web/src/lib/__tests__/student-triage.test.ts`, 6 asserções, linhas 447-474). Mudá-la é um risco de regressão desnecessário.
- Em vez disso: o motivo granular "atrasado no Plano de Ensino" e a seleção do template `behind_teaching_plan` são **derivados server-side dentro do fluxo do Centro de Engajamento (E6/E3), a partir dos sinais do aluno** (`computeStudentRitmo` / `auth_team_engagement_signals` → `ritmo === "atrasado"`), **NÃO do `nudgeType` do botão da tabela**. O botão "Acionar" continua navegando com `?student={id}&action=activate` (sem carregar `nudgeType` da tabela); o Sheet (E6), ao montar server-side, resolve o `ritmo` real daquele aluno e, se `atrasado`, pré-seleciona `behind_teaching_plan`; se `nao_iniciado`, `never_accessed`; caso contrário, `inactive`. Assim a diferenciação `behind_teaching_plan` existe onde há dado para ela (E6, com acesso aos sinais completos), sem tocar a função pura da tabela.
- Consequência para esta story: E10 **não altera `student-triage.ts`** e **não precisa de teste de regressão sobre `computeStudentAction`**. A responsabilidade de escolher `behind_teaching_plan` vs. `never_accessed`/`inactive` é de E6 (Sheet) + E3 (rota `POST /api/engagement/action`, que já revalida escopo e pode resolver o `ritmo` server-side). Esta story só garante que a navegação chega ao Sheet com o `student` e o `action` corretos.
- Botão "Lembrar" (Seção 6): navega para `/engagement?student={id}&action=remind`.
- Botão "Acionar" (Seção 6): navega para `/engagement?student={id}&action=activate`.
- Botão "No ritmo" (Seção 6 + decisão #10 do epic): abre menu com 3 opções — Ver detalhe | Parabenizar (usa o template de reconhecimento, `top_performer_recognition`, intent `reconhecimento` — E1 AC7) | Nada (fecha o menu sem ação).
- Item de navegação "Engajamento" (`apps/web/src/lib/navigation.ts`): deve apontar para `/engagement`, não para `/admin/notifications`, para o papel `manager`.
- Kill list (Seção 16 do report) — aplicar TODOS os itens que ainda existirem na base de código após E1–E9:
  1. Contagens globais dentro do contexto Meu Time — já deveria estar resolvido por E2/E3/E4, esta story CONFIRMA que não sobrou nenhum resquício.
  2. Audiências salvas vazias sem função clara — confirmar que a UI do gestor (E7) não expõe `notification_audiences` como conceito de primeira classe.
  3. Histórico mostrando pessoas fora do recorte atual — já resolvido por E8, confirmar.
  4. Templates com nomes técnicos como informação principal — já resolvido por E9, confirmar.
  5. Botão "Aprovar e disparar" sem revisão clara — confirmar que nenhum fluxo novo (E5/E7) tem um botão equivalente sem preview/revisão antes.
  6. Campanha coletiva sem lista de destinatários antes do envio — já resolvido por E7, confirmar.
  7. Métrica de eficácia com 0% sem explicar base, período e retorno esperado — se algum card (E4) mostrar uma métrica de eficácia, ela deve vir acompanhada do período e da base de cálculo (ex.: "Taxa de leitura: 0% (0 de 3 mensagens lidas nos últimos 7 dias)"), nunca um número solto.
  8. Separação confusa entre ação individual e coletiva — confirmar que E6 (Sheet) e E7 (Campanha) são visual e logicamente distintos.
  9. Tela com aparência de ferramenta genérica de marketing/campanha — validação visual final contra a Seção 17 do report.

## Acceptance Criteria

- [ ] **AC1:** Confirmado (via leitura de código, documentado no Dev Agent Record) se `student-insights-table.tsx` já implementa os botões Lembrar/Acionar/No ritmo, ou se esta story precisa adicioná-los.
- [ ] **AC2:** Botão "Lembrar" navega para `/engagement?student={id}&action=remind`, abrindo o Sheet de E6 automaticamente com os dados do aluno certo.
- [ ] **AC3:** Botão "Acionar" navega para `/engagement?student={id}&action=activate`, mesma mecânica, com o tom mais forte de E6 AC4.
- [ ] **AC4:** `student-triage.ts` (`computeStudentAction`) NÃO é modificado por esta story (decisão do orquestrador, ver Dev Notes). A ponte da tabela navega com `?student={id}&action={remind|activate}` SEM carregar `nudgeType`. Verificável: `git diff` desta story não toca `apps/web/src/lib/student-triage.ts`, e a suíte `student-triage.test.ts` permanece verde e inalterada. A resolução de `behind_teaching_plan` (quando `ritmo === "atrasado"`) é responsabilidade server-side de E6 (Sheet) + E3 (rota action), não desta story.
- [ ] **AC5:** Botão "No ritmo" abre menu com Ver detalhe / Parabenizar / Nada. "Parabenizar" pré-preenche o Sheet (ou um preview simplificado, decidir e documentar) com o template `top_performer_recognition`, origem "gestor" como default (mensagem de reconhecimento pessoal tem mais peso vindo do gestor — mas o gestor pode trocar).
- [ ] **AC6:** `apps/web/src/lib/navigation.ts` tem a entrada "Engajamento" para o papel `manager` apontando para `/engagement`.
- [ ] **AC7:** Todos os 9 itens da kill list (Seção 16) verificados um a um contra o estado final do código após E1–E9, com cada item marcado como "confirmado resolvido" ou "ainda presente + plano de correção" no Dev Agent Record desta story.
- [ ] **AC8:** Cenário canônico de regressão executado manualmente ponta a ponta: usuário Rinaldo (ou equivalente de teste) em `Meu Time` com 6 alunos — nenhuma contagem, sugestão, campanha ou histórico mostra um número ou pessoa fora desses 6 alunos, em NENHUMA aba do Centro de Engajamento.

## Tasks

- [ ] 1. Abrir `student-insights-table.tsx` e confirmar AC1.
- [ ] 2. Implementar (ou ajustar) os botões Lembrar/Acionar para navegar com os query params corretos.
- [ ] 3. Confirmar que a navegação Lembrar/Acionar NÃO carrega `nudgeType` da tabela (a derivação de `behind_teaching_plan` é server-side em E6/E3) e que `student-triage.ts` permanece intocado (AC4).
- [ ] 4. Implementar o menu "No ritmo" (Ver detalhe / Parabenizar / Nada).
- [ ] 5. Atualizar `navigation.ts`.
- [ ] 6. Passar pela kill list item a item (AC7), documentando cada um.
- [ ] 7. Executar o cenário canônico de regressão (AC8) e registrar o resultado.

## Complexidade & Riscos

- **Complexidade:** M (medium). Ponte de navegação + menu "No ritmo" + varredura de kill list. Reduzida pela decisão do orquestrador de NÃO tocar `student-triage.ts`.
- **Riscos:**
  - R1 (médio): incerteza sobre se os botões Lembrar/Acionar/No ritmo já existem em `student-insights-table.tsx`. Mitigação: Task 1/AC1 confirmam por leitura de código ANTES de qualquer outra coisa.
  - R2 (baixo, resolvido): risco de regressão em `computeStudentAction` — ELIMINADO pela decisão do orquestrador (função não é tocada; derivação move para E6 server-side).
  - R3 (médio): a kill list (AC7) depende do estado final de E1-E9; se rodar antes delas, itens aparecerão como "ainda presente". Dev Notes já exige que E10 rode por último (antes de E11).

## Regra Absoluta de Escopo (verificação)

Coberta por AC8 (cenário canônico Rinaldo/6 alunos ponta a ponta em TODAS as abas) + item 1 da kill list (AC7). Blocker de fechamento do epic.

## Dev Notes

- Esta story é o "fecho" funcional do epic — depende de quase todas as outras terem sido implementadas (E1, E2, E3, E6, E9 no mínimo). Não começar antes dessas estarem prontas o suficiente para o Sheet e a navegação funcionarem de ponta a ponta.
- Se AC1 revelar que os botões NÃO existem em `student-insights-table.tsx`, esta story precisa implementá-los seguindo o padrão visual já usado no componente (cores: laranja para ação principal, verde para "no ritmo", vermelho para "acionar", âmbar para "lembrar" — conforme a paleta da Seção 17 e a hierarquia de `student-triage.ts` já documentada no epic overview).

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web lint
pnpm --filter @eximia/web test -- student-insights-table
pnpm --filter @eximia/web test -- student-triage
```

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-08 | Story criada | River (SM Agent) |
| 2026-07-08 | PO: DESBLOQUEADA — aplicada decisão do orquestrador (computeStudentAction NÃO muda; derivação move p/ E6/E3 server-side). AC4/Dev Notes/Tasks reescritos. Complexidade & Riscos. Validada GO (9/10). | Pax (@po) |

## PO Validation: GO

**Verdict:** GO — **9/10** — 2026-07-08 — @po (Pax)

**Desbloqueada.** O AC bloqueante original (mudar `computeStudentAction` para diferenciar `behind_teaching_plan`) foi resolvido pela decisão do orquestrador, e a verificação de código a confirma como tecnicamente correta: `computeStudentAction(triagem, totalSessions)` (linha 114) NÃO recebe `ritmo` — é estruturalmente incapaz de distinguir `atrasado` de `nao_iniciado` sem mudar assinatura + 2 call-sites (`student-insights-table.tsx` 248, 902) + 6 asserções de teste travadas. A derivação de `behind_teaching_plan` migrou para E6/E3 server-side (onde o `ritmo` está disponível). AC4 reescrito como verificável (`git diff` não toca `student-triage.ts`; suíte permanece verde). Kill list (AC7) percorrida item a item. `student-insights-table.tsx` confirmado com `variant="manager"`/`canNudge`.
**Nota para devs:** NÃO modificar `student-triage.ts`. A ponte navega com `?student&action` SEM `nudgeType`. Rodar E10 só depois de E1-E9 (a kill list depende do estado final).
