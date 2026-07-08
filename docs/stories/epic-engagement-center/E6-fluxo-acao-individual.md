# E6: Fluxo de Ação Individual (Sheet)

**Epic:** [00-EPIC-OVERVIEW](./00-EPIC-OVERVIEW.md)
**Status:** Draft
**Depende de:** E4 (shell)
**Bloqueia:** E10 (ponte tabela→Sheet)

---

## Story

**As a** gestor,
**I want** um painel lateral (Sheet) com todos os dados de um aluno específico e uma mensagem pré-preenchida e editável,
**so that** eu possa lembrar ou acionar aquele aluno com contexto completo, sem sair da tela onde estava.

## Contexto (Dev Notes)

Ler Seção 6 (botões Lembrar/Acionar/No ritmo) e Seção 11 (Aba Ação Individual) do report antes de começar.

- Componente: `packages/ui/src/components/sheet.tsx` — usar este, não criar modal do zero.
- Entrada por 2 caminhos: (a) query params `?student={id}&action={remind|activate}` (usado pela ponte da tabela em E10); (b) clique num aluno específico dentro da aba Ações Sugeridas ("Ver alunos" de um card, ao clicar em 1 aluno da lista).
- Campos exigidos pela Seção 11 do report: Aluno selecionado, Motivo da ação, Status atual, Último acesso, Progresso, Engajamento, Histórico recente de comunicações, Template sugerido, Origem da mensagem, Canal, Prévia da mensagem, Botão enviar.
- Diferença de tom entre Lembrar e Acionar (Seção 6): Lembrar é mais leve (aluno com atraso leve/baixa frequência/risco inicial); Acionar é mais forte (aluno parado/atrasado/inativo/sem acesso/em risco alto), e ganha um campo adicional: Histórico recente de comunicações (Acionar tem esse campo, Lembrar não, conforme a lista exata da Seção 6).
- Origem da mensagem (Seção 8): seletor com o texto de UI EXATO:
  - Label: "Origem da mensagem"
  - Sublabel: "Escolha como o aluno verá esta comunicação."
  - Opções: "{Nome do gestor}, gestor do time" / "exímIA Academy"
- Preview de mensagem (Seção 11, exemplos exatos a replicar como referência de tom):
  - Como gestor: "Olá, Marcela. Aqui é o Rinaldo.\n\nPercebi que você ainda não retomou sua trilha na exímIA Academy. Seu progresso está abaixo do esperado para o Plano de Ensino.\n\nQuando puder, acesse a plataforma e avance no próximo módulo."
  - Como plataforma: "Olá, Marcela.\n\nA exímIA Academy percebeu que sua trilha está abaixo do ritmo esperado no Plano de Ensino.\n\nAcesse a plataforma para retomar seu progresso."
- Template sugerido é resolvido via `NUDGE_TYPE_TEMPLATE_KEY[nudgeType]` (E2). A ORIGEM do `nudgeType` depende do caminho de entrada:
  - **Entrada pela tabela (E10, query params `?student&action`):** o `action` (`remind`/`activate`) NÃO carrega o `nudgeType`. O `nudgeType` é derivado SERVER-SIDE ao montar o Sheet, a partir do `ritmo` real do aluno (decisão do orquestrador 2026-07-08 — `computeStudentAction` NÃO é usado para isso porque só recebe `triagem`, não `ritmo`, e não distingue `atrasado` de `nao_iniciado`). Regra de derivação (E6 AC10): `ritmo === "atrasado"` → `behind_teaching_plan`; `ritmo === "nao_iniciado"` (ou `totalSessions === 0`) → `never_accessed`; caso contrário → `inactive`. Fonte do `ritmo`: `computeStudentRitmo` (`student-triage.ts`) ou a RPC `auth_team_engagement_signals` (`supabase/migrations/20260703010000_auth_team_engagement_signals.sql`) — CONFIRMAR qual expõe `ritmo`/pace já calculado e reusar, sem recalcular à mão.
  - **Entrada pela aba Ações Sugeridas (E5):** o `nudgeType` vem do tipo do cohort que originou a sugestão (já inclui `behind_teaching_plan` de E2).
- Endpoint de envio: `POST /api/engagement/action` (E3).

## Acceptance Criteria

- [ ] **AC1:** Componente `EngagementActionSheet` (nome sugerido) implementado com `packages/ui/src/components/sheet.tsx`, abrindo lateralmente sem perder o contexto da página por trás.
- [ ] **AC2:** Sheet aceita entrada via query params `?student={id}&action={remind|activate}` — ao montar a página com esses params presentes, o Sheet abre automaticamente pré-preenchido.
- [ ] **AC3:** Campos exibidos para `action=remind` (Lembrar): Aluno selecionado, Motivo do lembrete, Último acesso, Progresso, Engajamento, Template sugerido, Prévia da mensagem, Origem da mensagem, Canal, Botão de enviar. (Sem histórico de comunicações — conforme Seção 6.)
- [ ] **AC4:** Campos exibidos para `action=activate` (Acionar): os mesmos do AC3 MAIS Status atual e Histórico recente de comunicações (Seção 6, lista completa do botão Acionar).
- [ ] **AC5:** Seletor de origem com o texto EXATO da Seção 8 (label + sublabel + as 2 opções nomeadas com o nome real do gestor autenticado).
- [ ] **AC6:** Prévia da mensagem é editável (textarea ou editor simples) e reflete IMEDIATAMENTE a mudança de origem (trocar de "gestor" para "plataforma" reescreve a saudação/corpo sugerido, sem perder edições manuais já feitas pelo gestor de forma destrutiva — se o gestor já editou manualmente, avisar antes de sobrescrever, ou aplicar a mudança de origem só ao template base, não ao texto já editado à mão. Decidir e documentar comportamento exato no Dev Agent Record).
- [ ] **AC7:** Botão "Enviar" chama `POST /api/engagement/action` com `studentId`, `nudgeType`, `senderIdentity`, `senderName` (quando aplicável), `channel`, `message` (texto final da prévia, possivelmente editado). Em caso de sucesso, fecha o Sheet e mostra confirmação (toast — `packages/ui/src/components/` CONFIRMAR se existe `toast.tsx`).
- [ ] **AC8:** Se o `studentId` do query param não pertencer ao escopo do gestor autenticado (checado server-side pela rota E3 AC5), a chamada falha com mensagem clara — o Sheet nunca deve permitir o envio silencioso para um aluno fora de alcance.
- [ ] **AC9:** Histórico recente de comunicações (Acionar) mostra ao menos as últimas 3 notificações enviadas àquele aluno (data, template, status), consumindo o mesmo endpoint de histórico de E8 filtrado por `studentId` (ou uma query direta equivalente).
- [ ] **AC10:** Quando o Sheet é aberto pela tabela (`?student&action=activate`), o `nudgeType`/template sugerido é derivado SERVER-SIDE a partir do `ritmo` real do aluno (NÃO de `computeStudentAction`, que não recebe `ritmo`): `ritmo === "atrasado"` → template `behind_teaching_plan`; `nao_iniciado`/`totalSessions === 0` → `never_accessed`; caso contrário → `inactive`. `apps/web/src/lib/student-triage.ts` NÃO é modificado por esta story. Coberto por teste unitário da função de derivação (3 casos: atrasado, não iniciado, inativo).

## Tasks

- [ ] 1. Criar `EngagementActionSheet` usando `packages/ui/src/components/sheet.tsx`.
- [ ] 2. Implementar leitura de query params e abertura automática do Sheet.
- [ ] 3. Implementar os dois modos de campos (remind vs. activate).
- [ ] 4. Implementar seletor de origem com o texto exato da Seção 8.
- [ ] 5. Implementar preview editável com a lógica de troca de origem (AC6).
- [ ] 6. Conectar botão Enviar a `POST /api/engagement/action`.
- [ ] 7. Implementar bloco de histórico recente de comunicações (Acionar).
- [ ] 8. Implementar a derivação server-side de `nudgeType` a partir do `ritmo` do aluno (AC10) + teste unitário dos 3 casos, sem tocar `student-triage.ts`.
- [ ] 9. Teste manual: tentar acessar `?student={id-fora-do-escopo}` e confirmar bloqueio.

## Complexidade & Riscos

- **Complexidade:** L (large). Sheet com 2 modos, seletor de origem, preview editável com lógica de reescrita não-destrutiva, derivação server-side de nudgeType, envio real. É o componente mais denso de UI do epic.
- **Riscos:**
  - R1 (médio): a lógica de "trocar origem sem destruir edição manual do gestor" (AC6) é sutil — sobrescrever texto já editado é um bug de UX ruim. Mitigação: AC6 exige decidir e documentar o comportamento exato (aplicar mudança só ao template base, não ao texto editado).
  - R2 (médio): a derivação server-side de `behind_teaching_plan` (AC10) depende de o `ritmo` estar disponível na montagem do Sheet — se a fonte (RPC ou `computeStudentRitmo`) não estiver acessível no contexto do Sheet, cai para `never_accessed`/`inactive`. Mitigação: confirmar a fonte do `ritmo` (Dev Notes) antes de implementar.
  - R3 (baixo): envio para aluno fora de escopo — mitigado server-side por E3 AC5 (AC8 aqui).

## Regra Absoluta de Escopo (verificação)

Coberta por AC8 (aluno fora do escopo bloqueado server-side pela rota E3). O Sheet nunca despacha para fora de alcance.

## Dev Notes

- Este é o fluxo que a ponte da tabela (E10, botões Lembrar/Acionar) abre diretamente. Não implementar a ponte em si aqui — só o Sheet e seu comportamento próprio, assumindo que os query params já chegam corretos.
- Se E5 já tiver criado um componente de preview de mensagem compartilhado (`MessagePreviewPanel`), reaproveitar aqui em vez de duplicar a lógica de edição/origem/canal.
- `channel` (in-app, email) segue `notification_templates.channel_inapp`/`channel_email` do template resolvido — se o template só suporta um canal, não oferecer escolha inexistente na UI.

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web lint
pnpm --filter @eximia/web test -- engagement/action-sheet
```

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-08 | Story criada | River (SM Agent) |
| 2026-07-08 | PO: aplicada decisão do orquestrador (derivação server-side de behind_teaching_plan, AC10); Complexidade & Riscos. Validada GO (8/10). | Pax (@po) |

## PO Validation: GO

**Verdict:** GO — **8/10** — 2026-07-08 — @po (Pax)

Sheet bem especificado com os campos exatos das Seções 6/8/11 do report (texto de UI de origem e exemplos de preview literais). `sheet.tsx`, `toast.tsx` existem. Recebeu a decisão do orquestrador: E6 agora OWNS a derivação server-side de `behind_teaching_plan` a partir do `ritmo` (AC10 novo), sem tocar `computeStudentAction` — correto, pois a função pura só recebe `triagem`, não `ritmo` (verificado no código). AC6 (reescrita não-destrutiva na troca de origem) é a parte mais sutil e está corretamente marcada como "decidir e documentar".
**Nota para devs:** confirmar a fonte do `ritmo` no contexto do Sheet (RPC vs. `computeStudentRitmo`) antes de implementar AC10. `computeStudentAction` NÃO deve ser modificado.
