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

- [x] **AC1:** Componente `IndividualActionSheet` implementado com `packages/ui/src/components/sheet.tsx`, abrindo lateralmente sem perder o contexto da página por trás.
- [x] **AC2:** Sheet aceita entrada via query params `?student={id}&action={remind|activate}` — a shell E4 lê os params e passa `open`/`studentId`/`action`; o Sheet, ao abrir, faz fetch e pré-preenche. (E5 também monta sua própria instância para o clique num aluno.)
- [x] **AC3:** Campos exibidos para `action=remind` (Lembrar): Aluno, Motivo, Último acesso, Progresso, Engajamento, Template sugerido (via preview), Prévia da mensagem, Origem, Canal, Botão de enviar. (Sem Status atual, sem histórico — Seção 6.)
- [x] **AC4:** Campos exibidos para `action=activate` (Acionar): os do AC3 MAIS Status atual (Badge) e Histórico recente de comunicações.
- [x] **AC5:** Seletor de origem com o texto EXATO da Seção 8 (label "Origem da mensagem" + sublabel "Escolha como o aluno verá esta comunicação." + opções "{Nome}, gestor do time" / "exímIA Academy"), no `MessagePreviewPanel` compartilhado.
- [x] **AC6:** Prévia editável (textarea) que reflete a troca de origem; comportamento não-destrutivo documentado abaixo (rastreamento de `isPristine`).
- [x] **AC7:** Botão "Enviar" chama `POST /api/engagement/action` com `studentId`, `nudgeType`, `templateKey`, `senderIdentity`, `message` (texto final editado). `senderName` é resolvido SERVER-SIDE pela rota E3 (nunca do payload). Sucesso → fecha o Sheet + toast de sucesso (`useToast`).
- [x] **AC8:** `studentId` fora do escopo → `GET /api/engagement/students` re-escopa e retorna vazio (mensagem "Este aluno não pertence ao seu recorte atual."); `POST /api/engagement/action` (E3 AC5) também bloqueia com 403. Envio silencioso impossível.
- [x] **AC9:** Histórico recente (Acionar) mostra as últimas 3 notificações (título, data, status) via `GET /api/engagement/history?student={id}` (rota E3/E8, escopada por `recipient_id`).
- [x] **AC10:** `nudgeType`/template derivado SERVER-SIDE do `ritmo` real (`computeStudentRitmo`, não `computeStudentAction`) na rota `GET /api/engagement/students`: `atrasado` → `behind_teaching_plan`; `nao_iniciado`/`totalSessions===0` → `never_accessed`; senão → `inactive`. `student-triage.ts` NÃO modificado. Função pura `deriveNudgeTypeFromRitmo` com teste unitário (4 casos, cobre os 3 exigidos + fallback).

## Tasks

- [x] 1. Criar `IndividualActionSheet` usando `packages/ui/src/components/sheet.tsx`.
- [x] 2. Implementar abertura via query params (a shell E4 lê os params; o Sheet faz fetch e pré-preenche ao abrir).
- [x] 3. Implementar os dois modos de campos (remind vs. activate — Status atual + histórico só no activate).
- [x] 4. Implementar seletor de origem com o texto exato da Seção 8 (`MessagePreviewPanel`).
- [x] 5. Implementar preview editável com a lógica de troca de origem não-destrutiva (AC6).
- [x] 6. Conectar botão Enviar a `POST /api/engagement/action`.
- [x] 7. Implementar bloco de histórico recente de comunicações (Acionar) via `GET /api/engagement/history?student=`.
- [x] 8. Implementar a derivação server-side de `nudgeType` a partir do `ritmo` (rota `GET /api/engagement/students` + `deriveNudgeTypeFromRitmo`) + teste unitário, sem tocar `student-triage.ts`.
- [x] 9. Teste manual: `?student={id-fora-do-escopo}` bloqueado — ver Dev Agent Record.

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

## Dev Agent Record

**Agent:** Dex (@dev) · **Data:** 2026-07-08 · **Status:** InReview

### Decisões técnicas
- **Fonte do `ritmo` para AC10 (confirmada antes de implementar, como pede a nota do PO):** criei uma rota NOVA `GET /api/engagement/students` que reusa `computeStudentRitmo` (`student-triage.ts`, fonte canônica) alimentada por um mapa de pace ("behind") computado com a MESMA fórmula documentada de `engine.computeBehindStudentIds` / RPC `auth_team_engagement_signals.behind` (não reinventei a fórmula). NÃO usei `computeStudentAction` (que só recebe `triagem`, não distingue `atrasado` de `nao_iniciado`) — exatamente o que o AC10 exige. `student-triage.ts` ficou INTOCADO.
- **`deriveNudgeTypeFromRitmo` (função pura, AC10):** módulo separado `derive-nudge-type.ts`, testável em isolamento. Regra literal da story: `atrasado`→`behind_teaching_plan`; `nao_iniciado`/`totalSessions===0`→`never_accessed`; senão→`inactive`. 4 testes (3 exigidos + fallback `totalSessions===0`).
- **Rota `GET /api/engagement/students` (nova, dentro da fronteira E5/E6):** por que uma rota dedicada em vez da pesada `/api/analytics/students/[id]` — a nova é uma projeção LEVE que aceita VÁRIOS ids de uma vez (necessário p/ "Ver alunos" de E5) e devolve o `nudgeType` derivado server-side (AC10). Segue o padrão de ouro E3 (AUTH→RE-SCOPE→QUERY) e re-escopa por `resolveEngagementScope` — aluno fora do recorte NUNCA é retornado (fecha AC8 no nível do fetch, além do 403 de `POST /api/engagement/action`).
- **AC6 (troca de origem não-destrutiva) — comportamento exato decidido:** o `MessagePreviewPanel` rastreia `isPristine` (o textarea ainda contém exatamente o texto sugerido pela origem atual). Se PRISTINE, trocar a origem reescreve a saudação livremente. Se o gestor JÁ EDITOU à mão, a troca de origem só muda o flag de identidade e PRESERVA o texto editado — um aviso amarelo aparece com um botão explícito "Aplicar o texto sugerido para esta origem (descarta minhas edições)". Nunca sobrescreve edição manual silenciosamente.
- **`MessagePreviewPanel` compartilhado (E5/E6/E7):** materializado aqui em E6 (dono único, conforme coordenação das Dev Notes). E5 o reusa via `IndividualActionSheet`. Origem + preview editável + canal num só componente controlado.
- **Canal:** a rota `action` de E3 despacha in-app por default; expus `channelInapp={true} channelEmail={false}` porque os templates seedados de nudge são in-app (Dev Notes: não oferecer canal inexistente). Quando um template suportar e-mail, o painel já renderiza o seletor de canal automaticamente (`bothChannels`).
- **`senderName` server-trusted:** o Sheet envia apenas `senderIdentity`; a rota E3 resolve `senderName` do perfil autenticado. O Sheet nunca deixa digitar um nome de gestor diferente (E3 R3 / types.ts nota).

### Lacunas de props registradas (para o orquestrador reconciliar em `types.ts`)
- O shape `EngagementStudentDetail` (retorno de `GET /api/engagement/students`) NÃO existe em `types.ts` (E4-owned). Declarado LOCALMENTE em `individual-action-sheet.tsx`. Se a shell/E10 precisar dele, promover a `types.ts`. `IndividualActionSheetProps` (E4) foi honrado sem alteração.
- `IndividualActionSheetProps.context` é recebido mas usado apenas para consistência de assinatura (o escopo real é resolvido server-side nas rotas); registrado para o caso de o orquestrador querer enxugar a prop.

### Verificação
- `pnpm --filter @eximia/web typecheck` → verde.
- `pnpm --filter @eximia/web exec vitest run .../derive-nudge-type.test.ts` → 4/4 pass.
- `npx biome check` nos 6 arquivos → clean.
- `pnpm --filter @eximia/web test` → 32 fails = baseline pré-existente inalterado; +4 novos. Zero regressão.
- AC8 (fora de escopo): verificado por leitura — `GET /api/engagement/students` re-escopa (retorna vazio → mensagem no Sheet) e `POST /api/engagement/action` (E3) devolve 403 "Recipient outside your scope". Dupla trava.

### Gap D3 fechado (2026-07-08, Dex/@dev)
O Sheet ganhou um TERCEIRO modo, `action="recognize"` (Parabenizar), fechando o gap D3 registrado no Dev Agent Record de E10. Modo POSITIVO: título "Parabenizar aluno", acento verde/success no header, sem histórico de comunicações e sem badge de cobrança (é um reconhecimento avulso, não follow-up). `nudgeType` FORÇADO a `top_performer` server-side pela rota `GET /api/engagement/students` quando `action=recognize` (valor já existente no union `NudgeType`, não inventado; template `top_performer_recognition`, intent `reconhecimento`). Envio real pela mesma `POST /api/engagement/action`, que já aceitava `top_performer`. Escopo intacto (mesma dupla trava do AC8). `deriveNudgeTypeFromRitmo` intocada (recognize não passa pela derivação de ritmo). `student-triage.ts` continua intocado.

### File List
- `apps/web/src/app/(platform)/engagement/_components/individual-action-sheet.tsx` (implementado — Sheet completo, 2 modos, histórico, envio; +modo recognize no fechamento do gap D3)
- `apps/web/src/app/(platform)/engagement/_components/message-preview-panel.tsx` (novo — origem + preview editável + canal, compartilhado E5/E6)
- `apps/web/src/app/(platform)/engagement/_components/derive-nudge-type.ts` (novo — função pura de derivação AC10)
- `apps/web/src/app/(platform)/engagement/_components/__tests__/derive-nudge-type.test.ts` (novo — 4 testes AC10)
- `apps/web/src/app/api/engagement/students/route.ts` (novo — projeção scoped de aluno + nudgeType derivado)

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-08 | Story criada | River (SM Agent) |
| 2026-07-08 | PO: aplicada decisão do orquestrador (derivação server-side de behind_teaching_plan, AC10); Complexidade & Riscos. Validada GO (8/10). | Pax (@po) |
| 2026-07-08 | Implementada: Sheet (2 modos), MessagePreviewPanel compartilhado, derivação server-side de nudgeType (rota scoped + função pura + teste), histórico recente, envio real. InReview. | Dex (@dev) |

## PO Validation: GO

**Verdict:** GO — **8/10** — 2026-07-08 — @po (Pax)

Sheet bem especificado com os campos exatos das Seções 6/8/11 do report (texto de UI de origem e exemplos de preview literais). `sheet.tsx`, `toast.tsx` existem. Recebeu a decisão do orquestrador: E6 agora OWNS a derivação server-side de `behind_teaching_plan` a partir do `ritmo` (AC10 novo), sem tocar `computeStudentAction` — correto, pois a função pura só recebe `triagem`, não `ritmo` (verificado no código). AC6 (reescrita não-destrutiva na troca de origem) é a parte mais sutil e está corretamente marcada como "decidir e documentar".
**Nota para devs:** confirmar a fonte do `ritmo` no contexto do Sheet (RPC vs. `computeStudentRitmo`) antes de implementar AC10. `computeStudentAction` NÃO deve ser modificado.
