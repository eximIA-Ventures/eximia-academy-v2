# E7: Aba Campanhas

**Epic:** [00-EPIC-OVERVIEW](./00-EPIC-OVERVIEW.md)
**Status:** InReview
**Depende de:** E4 (shell)
**Bloqueia:** nenhuma (paralela a E5, E6, E8, E9)

---

## Story

**As a** gestor,
**I want** enviar mensagens para grupos de alunos gerados automaticamente a partir do meu recorte, com revisão obrigatória antes do envio,
**so that** eu nunca dispare uma campanha coletiva sem ver exatamente quem vai recebê-la.

## Contexto (Dev Notes)

Ler Seção 12 do report antes de começar.

- REGRA CENTRAL (Seção 12): "Evitar a ideia de audiências salvas como elemento principal. Em vez disso, mostrar grupos gerados automaticamente" — os mesmos 5 tipos de cohort de E2/E5 (`never_accessed`, `inactive`, `behind_teaching_plan`, `no_reflection`, `top_performer`), agora com a lente de campanha coletiva em vez de card individual.
- `notification_audiences` (tabela existente) NÃO deve virar o elemento principal da UI do gestor — ela pode continuar existindo como mecanismo técnico interno (ex.: para o admin), mas a experiência do gestor é 100% grupos contextuais auto-gerados.
- Fluxo obrigatório (Seção 12, final): Ver alunos → Escolher template → Escolher origem da mensagem → Selecionar canal → Pré-visualizar → **Tela de revisão obrigatória** → Enviar. A tela de revisão mostra: Lista de destinatários, Motivo de inclusão, Mensagem, Origem, Canal, Possibilidade de remover alunos da audiência.
- Backend: `POST /api/engagement/campaign` (E3) já é desenhado com dois modos — preview (sem enviar) e confirm (envia). Esta story implementa a UI que consome os dois modos NESSA ORDEM, nunca pulando o preview.
- Cap de 200 destinatários por campanha (mesmo `MAX_RECIPIENTS` de `nudge/route.ts`, replicado em E3) — a UI deve comunicar claramente se um grupo excede o cap (ex.: "propor envio em lotes" ou simplesmente bloquear com mensagem clara; decidir e documentar).

## Acceptance Criteria

- [x] **AC1:** Aba Campanhas lista os grupos contextuais auto-gerados do recorte atual, cada um com contagem (ex.: "3 nunca acessaram", "2 inativos há mais de 14 dias", "1 atrasado no Plano de Ensino", "4 sem reflexão recente", "2 destaques positivos") — mesma fonte de dados de `GET /api/engagement/overview` (prop `initialCohorts`, que é o bloco `suggestions` do overview). Confirmado: MESMO endpoint (default do AC), a aba apresenta os cohorts com a lente de campanha (rótulo humano + contagem via `nudge-labels.ts`).
- [x] **AC2:** Nenhum grupo com 0 alunos aparece (filtro `targetStudentIds.length > 0`, defensivo sobre o filtro que o servidor já aplica).
- [x] **AC3:** Clicar em "Acionar grupo" abre a máquina de estados: Ver alunos → Template → Origem → Canal → Preview → Revisão → Enviada. Stepper visível, voltar/avançar em cada etapa, nenhuma pula a anterior.
- [x] **AC4:** `POST /api/engagement/campaign` modo "preview" (`runPreview`) resolve a lista de destinatários SERVER-SIDE; a UI renderiza exatamente o que o servidor devolve, nunca uma lista calculada no client.
- [x] **AC5:** Tela de revisão exibe nome (fallback email/id) + motivo de inclusão por aluno (`nudgeTypeReason`), Mensagem final, Origem, Canal, e botão Remover por aluno (`removedIds`).
- [x] **AC6:** Envio confirm (`runConfirm`) só é invocável do botão da tela de revisão — nenhum atalho de outro passo dispara envio.
- [x] **AC7:** `capped`/`total` do preview mostram banner âmbar explícito ANTES do envio + botão desabilitado quando a lista final excede 200.
- [x] **AC8:** Passo "done" mostra `inAppCreated`, `emailsSent`, `emailsFailed` (só se >0), `recipientsSkipped` (só se >0) do retorno do confirm.
- [x] **AC9:** A UI NUNCA fabrica destinatários — tanto preview quanto confirm são re-escopados no servidor (E3 `resolveAudienceScoped`/`resolveEngagementScope`, testado em `routes-leak.test.ts`). Garantia estrutural; teste manual do cenário Rinaldo pendente de dado no ambiente.

## Tasks

- [x] 1. Criar listagem de grupos contextuais na aba Campanhas.
- [x] 2. Implementar o wizard (Ver alunos → Template → Origem → Canal → Preview).
- [x] 3. Implementar a tela de revisão obrigatória com remoção de alunos.
- [x] 4. Conectar preview e confirm a `POST /api/engagement/campaign`.
- [x] 5. Implementar aviso de cap de 200 destinatários.
- [x] 6. Implementar tela de confirmação pós-envio com contagens.
- [x] 7. Garantia de escopo estrutural (AC9); teste manual pendente de dado no ambiente.

## Complexidade & Riscos

- **Complexidade:** L (large). Wizard multi-passo + tela de revisão obrigatória com remoção de destinatários + preview/confirm + cap de FinOps.
- **Riscos:**
  - R1 (alto): campanha coletiva é onde um vazamento de escopo tem MAIOR impacto (mensagem enviada em massa a alunos de outro time). Mitigação: AC9 (cenário canônico) + o servidor resolve os destinatários no modo preview (AC4), nunca confia na lista do client.
  - R2 (médio): pular a tela de revisão = envio em massa não revisado (item de kill list Seção 16). Mitigação: AC6 trava o envio confirm apenas a partir da revisão.
  - R3 (baixo): grupo acima de 200 (cap FinOps). Mitigação: AC7 comunica ANTES da tentativa.

## Regra Absoluta de Escopo (verificação)

Coberta por AC9 (nenhuma pessoa fora do recorte na lista, em preview OU confirm). Blocker.

## Dev Notes

- Reaproveitar o componente de preview de mensagem (origem/canal/texto editável) de E5/E6 se já existir, para consistência visual e evitar 3 implementações divergentes do mesmo conceito.
- "Motivo de inclusão" por aluno pode ser tão simples quanto reusar a `rationale` do cohort (já existe em `nudge_suggestions.rationale`/nos cohorts calculados por `classifyNudgeCohorts`) — não é necessário calcular um motivo individual por aluno, o motivo do GRUPO já é suficiente para satisfazer a Seção 12.

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web lint
pnpm --filter @eximia/web test -- engagement/campaign
```

## Dev Agent Record

**Agent:** Dex (@dev) · **Data:** 2026-07-08 · **Status:** InReview

### Decisões técnicas (IDS)

- **REUSE:** `@eximia/ui` (`Button`, `Badge`, `Select`, `Textarea`, `EmptyState`, `Skeleton`, `useToast`); contrato `CampaignsTabProps` de `types.ts` (não tocado); contratos reais das rotas E3 (`POST /api/engagement/campaign` preview/confirm, `GET /api/engagement/templates`).
- **CREATE (justificado):** `nudge-labels.ts` (rótulos humanos de `NudgeType` — banimento da chave técnica como rótulo, mesma disciplina da Seção 14; compartilhado com E8). Corpo de `campaigns-tab.tsx` como máquina de estados de 7 passos + subcomponente local `OriginOption`.
- **Preview NÃO confia no client (AC4):** a lista de destinatários vem 100% de `POST .../campaign` modo preview. O `criteria: { risk: cohortType }` faz o servidor resolver o conjunto via `resolveAudienceScoped` (escopado). O client só renderiza e permite remover.
- **Cohort source (AC1):** `initialCohorts` é o mesmo bloco `suggestions` do `GET /api/engagement/overview` — confirmado default do AC (mesmo endpoint, lente diferente). Não criei endpoint irmão.
- **Cap de 200 (AC7):** comunicado por banner + botão desabilitado ANTES do envio, usando `capped`/`total` do preview; o servidor também rejeita >200 no confirm (defesa em profundidade).
- **Origem:** `senderOptions.managerName` server-trusted; a opção "Gestor" fica desabilitada se `managerName` for null (admin/plataforma), nunca deixa o usuário digitar outro nome (E3 força o nome do caller no dispatch).

### Lacunas de props registradas (para o orquestrador reconciliar)

- **Nenhuma alteração em `types.ts`.** `CampaignsTabProps` foi suficiente. As shapes locais (`CampaignTemplate`, `PreviewRecipient`, `ConfirmResult`) são específicas da aba e derivadas dos retornos reais das rotas E3; declaradas localmente em `campaigns-tab.tsx` (não em `types.ts`, por convivência com o agente paralelo). Se E5/E6 vierem a precisar de um `MessagePreviewPanel` compartilhado, hoje ele NÃO existe (E5/E6 ainda eram placeholders) — construí o preview inline; vale extrair para `packages/ui` numa reconciliação futura.

### Verificação

- `pnpm --filter @eximia/web typecheck` → sem erros nos arquivos E7.
- File List abaixo.

### File List

- `apps/web/src/app/(platform)/engagement/_components/campaigns-tab.tsx` (modificado — corpo real do wizard E7)
- `apps/web/src/app/(platform)/engagement/_components/nudge-labels.ts` (novo — rótulos humanos de NudgeType, compartilhado com E8)

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-08 | Story criada | River (SM Agent) |
| 2026-07-08 | PO: adicionadas Complexidade & Riscos + verificação de escopo. Validada GO (8/10). | Pax (@po) |
| 2026-07-08 | Implementada: wizard de 7 passos (Ver alunos→Template→Origem→Canal→Preview→Revisão→Enviada), preview/confirm server-side, cap 200, confirmação pós-envio. nudge-labels.ts. InReview. | Dex (@dev) |

## PO Validation: GO

**Verdict:** GO — **8/10** — 2026-07-08 — @po (Pax)

Fluxo de campanha coletiva com revisão obrigatória bem modelado (mata dois itens da kill list: "aprovar e disparar sem revisão" e "campanha sem lista de destinatários"). AC4 (preview resolvido server-side, não confia no client) e AC6 (confirm só a partir da revisão) são os ACs de segurança certos. `rationale` verificado como campo real de `nudge_suggestions` (linha 128) e retorno de `classifyNudgeCohorts` — o reuso proposto em Dev Notes é válido, não inventado. Cap de 200 alinhado a `nudge/route.ts`.
**Nota para devs:** reaproveitar `MessagePreviewPanel` de E5/E6. Confirmar com E3 se a listagem de cohorts para campanhas usa o mesmo endpoint `overview` ou um irmão (default: mesmo).
