# E7: Aba Campanhas

**Epic:** [00-EPIC-OVERVIEW](./00-EPIC-OVERVIEW.md)
**Status:** Draft
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

- [ ] **AC1:** Aba Campanhas lista os grupos contextuais auto-gerados do recorte atual, cada um com contagem (ex.: "3 nunca acessaram", "2 inativos há mais de 14 dias", "1 atrasado no Plano de Ensino", "4 sem reflexão recente", "2 destaques positivos") — mesma fonte de dados de `GET /api/engagement/overview` ou uma variante de listagem de cohorts (CONFIRMAR com E3 se é o mesmo endpoint ou um endpoint irmão; default: mesmo endpoint, a aba Campanhas apenas apresenta os cohorts de forma diferente da aba Sugestões).
- [ ] **AC2:** Nenhum grupo com 0 alunos aparece na listagem (mesma regra de "não mostrar card vazio" de E5).
- [ ] **AC3:** Clicar em um grupo abre o fluxo: Ver alunos (lista) → Escolher template → Escolher origem → Selecionar canal → Pré-visualizar mensagem. Cada etapa é navegável (voltar/avançar), nenhuma etapa pula a anterior.
- [ ] **AC4:** Ao final do fluxo, `POST /api/engagement/campaign` é chamado em modo "preview", retornando a lista final de destinatários resolvidos pelo servidor (nunca confiando apenas na lista calculada no client).
- [ ] **AC5:** Tela de revisão exibe: Lista de destinatários (nome + 1 dado de contexto), Motivo de inclusão (por que cada um está no grupo), Mensagem (texto final), Origem, Canal, e permite REMOVER alunos individualmente da lista antes de confirmar o envio.
- [ ] **AC6:** Envio final (`POST /api/engagement/campaign` modo "confirm") só é possível a partir da tela de revisão — não existe nenhum atalho que dispare uma campanha sem passar por ela.
- [ ] **AC7:** Se a lista de destinatários exceder 200 (cap de FinOps), a UI comunica isso claramente ANTES da tentativa de envio (mensagem explícita, não um erro genérico de servidor).
- [ ] **AC8:** Após envio bem-sucedido, a UI mostra confirmação com contagem de mensagens enviadas (in-app + email) e falhas, se houver, replicando o retorno de `dispatchTeamNudge` (`inAppCreated`, `emailsSent`, `emailsFailed`, `recipientsSkipped`).
- [ ] **AC9:** Nenhuma pessoa fora do recorte atual do gestor aparece na lista de destinatários em NENHUM momento do fluxo (preview ou confirm) — teste manual replicando o cenário canônico Rinaldo/Meu Time.

## Tasks

- [ ] 1. Criar listagem de grupos contextuais na aba Campanhas.
- [ ] 2. Implementar o wizard de 4 passos (Ver alunos → Template → Origem → Canal → Preview).
- [ ] 3. Implementar a tela de revisão obrigatória com remoção de alunos.
- [ ] 4. Conectar preview e confirm a `POST /api/engagement/campaign`.
- [ ] 5. Implementar aviso de cap de 200 destinatários.
- [ ] 6. Implementar tela de confirmação pós-envio com contagens.
- [ ] 7. Teste manual do cenário canônico de escopo (AC9).

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

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-08 | Story criada | River (SM Agent) |
| 2026-07-08 | PO: adicionadas Complexidade & Riscos + verificação de escopo. Validada GO (8/10). | Pax (@po) |

## PO Validation: GO

**Verdict:** GO — **8/10** — 2026-07-08 — @po (Pax)

Fluxo de campanha coletiva com revisão obrigatória bem modelado (mata dois itens da kill list: "aprovar e disparar sem revisão" e "campanha sem lista de destinatários"). AC4 (preview resolvido server-side, não confia no client) e AC6 (confirm só a partir da revisão) são os ACs de segurança certos. `rationale` verificado como campo real de `nudge_suggestions` (linha 128) e retorno de `classifyNudgeCohorts` — o reuso proposto em Dev Notes é válido, não inventado. Cap de 200 alinhado a `nudge/route.ts`.
**Nota para devs:** reaproveitar `MessagePreviewPanel` de E5/E6. Confirmar com E3 se a listagem de cohorts para campanhas usa o mesmo endpoint `overview` ou um irmão (default: mesmo).
