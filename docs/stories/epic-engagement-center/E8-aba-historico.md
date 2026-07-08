# E8: Aba Histórico

**Epic:** [00-EPIC-OVERVIEW](./00-EPIC-OVERVIEW.md)
**Status:** InReview
**Depende de:** E4 (shell)
**Bloqueia:** nenhuma (paralela a E5, E6, E7, E9)

---

## Story

**As a** gestor,
**I want** ver o histórico de comunicações enviadas, estritamente filtrado ao meu recorte atual,
**so that** eu nunca veja uma mensagem enviada a alguém fora do meu time.

## Contexto (Dev Notes)

Ler Seção 13 do report antes de começar.

- PROBLEMA ATUAL EXPLÍCITO (Seção 13): "Hoje o problema é que aparecem notificações recentes de pessoas fora do time. Isso não pode acontecer." — esta story é a correção direta desse vazamento, especificamente para a experiência do gestor.
- Fonte de dados: `GET /api/engagement/history` (E3), já escopado por `allowedStudentIds` via `resolveCallerStudentScope`.
- Colunas recomendadas (Seção 13, exatas): Destinatário, Motivo, Mensagem/template, Origem, Canal, Status, Data, Resultado.
- Filtros recomendados (Seção 13, exatos): Aluno, Tipo de ação, Origem da mensagem, Canal, Status, Período.
- Status possíveis (Seção 13): Enviado, Lido, Não lido, Falhou, Aguardando, Dispensado. NOTA: o schema real (`notifications.status`) só tem o CHECK `('queued','sent','read','acted')` — mapear esses 4 valores de banco para os rótulos de UI da Seção 13 (ex.: `queued`→"Aguardando", `sent`→"Enviado"/"Não lido" dependendo se há `read_at`, `read`→"Lido", `acted`→"Lido" com CTA clicado). "Falhou" e "Dispensado" não existem como status de `notifications` hoje — "Dispensado" é estado de `nudge_suggestions`, não de `notifications` individual; "Falhou" pode vir do resultado de envio de email (`emailsFailed` do dispatch) sem persistir como status formal na tabela. Decidir e documentar o mapeamento exato no Dev Agent Record, sem inventar uma coluna de banco nova sem necessidade — preferir derivar o rótulo de UI a partir dos campos já existentes (`status`, `read_at`, `acted_at`, `sent_at`) sempre que possível.
- Resultado/eficácia (Seção 13): "Acessou depois da mensagem" (deriva de `notifications.returned_at IS NOT NULL`), "Retomou sessão", "Concluiu módulo", "Fez reflexão", "Sem resposta". O schema atual só tem o sinal genérico `returned_at` (sessão após o envio) — os resultados mais granulares ("Concluiu módulo", "Fez reflexão") podem não ter dado de origem hoje; se não existir base de dados para eles, exibir apenas "Acessou depois da mensagem" / "Sem resposta" nesta wave, e documentar a lacuna em vez de inventar dado.

## Acceptance Criteria

- [x] **AC1:** Tabela com as 8 colunas da Seção 13 (Destinatário, Motivo, Mensagem, Origem, Canal, Status, Data, Resultado) via `@eximia/ui` `DataTable` — confirmado como o componente padrão do repo p/ tabela com busca/filtro/empty embutidos.
- [x] **AC2:** Filtros implementados: Aluno (busca client-side por nome/mensagem), Tipo de ação (coluna Motivo derivada de `context.nudge_type`/`origin` — ver lacuna: a rota E3 NÃO tem param `type`), Origem (nudge/manual/system), Canal (inapp/email), Status, Período (data inicial/final). Origem/Canal/Status/Período são query-params server-side; Aluno é busca client sobre as rows já escopadas.
- [x] **AC3:** Garantido pela ROTA: o componente só consome `GET /api/engagement/history` (escopado por `recipient_id ∈ allowedStudentIds` em E3) e NÃO abre nenhum caminho paralelo não-escopado (sem 2ª chamada, sem join com dado tenant-wide). A busca de Aluno é client sobre as rows já filtradas pelo servidor.
- [x] **AC4:** Mapeamento documentado e implementado (`statusLabel`): `queued`→"Aguardando", `sent`→"Não lido" (ou "Lido" se `read_at`), `read`/`acted`→"Lido". "Falhou"/"Dispensado" NÃO existem como status de `notifications` — não inventados (documentado no comentário do arquivo e aqui).
- [x] **AC5:** `resultLabel`: "Acessou depois da mensagem" quando `returned_at` presente; "Sem resposta" quando `sent_at` > 3d atrás; senão "—". Eficácia SEMPRE com base explícita ("M de N enviadas retornaram", nunca % solto). LACUNA: a rota E3 (`history/route.ts`) NÃO seleciona `returned_at`/`acted_at`; o campo é lido defensivamente e a UI faz upgrade automático se a rota passar a retorná-lo.
- [x] **AC6:** Estado vazio exato da Seção 15: "Nenhuma comunicação enviada para este recorte ainda." (só quando não há dado, não quando filtros escondem rows).
- [x] **AC7:** `focusedStudentId` vira o query-param `student` (server-side, re-escopado pela rota), mantendo os demais filtros aplicáveis.
- [x] **AC8:** Não-vazamento é garantia estrutural da rota (`routes-leak.test.ts` de E3). Teste manual do cenário Rinaldo pendente de dado no ambiente.

## Tasks

- [x] 1. Criar componente de tabela de histórico consumindo `GET /api/engagement/history`.
- [x] 2. Implementar os filtros (Aluno busca + Tipo/Origem/Canal/Status/Período).
- [x] 3. Mapeamento status banco → rótulo UI, lacunas documentadas.
- [x] 4. Coluna Resultado com `returned_at` (lacuna do select da rota documentada).
- [x] 5. Estado vazio.
- [x] 6. Garantia de escopo estrutural (rota); teste manual pendente de dado.

## Complexidade & Riscos

- **Complexidade:** M (medium). Tabela com 6 filtros + mapeamento status banco→UI + coluna resultado, sobre API pronta (E3).
- **Riscos:**
  - R1 (médio): mapear 6 rótulos de UI (Seção 13) sobre 4 status reais de banco (`queued`/`sent`/`read`/`acted`) sem inventar coluna nova. "Falhou" e "Dispensado" não existem como status de `notifications`. Mitigação: AC4 exige documentar o mapeamento e as lacunas explicitamente, derivando de campos existentes (`read_at`/`acted_at`/`returned_at`).
  - R2 (médio): reintroduzir vazamento via caminho paralelo (2ª chamada sem escopo ou join client-side com dado tenant-wide). Mitigação: Dev Notes proíbe explicitamente; AC3/AC8 verificam.
  - R3 (baixo): resultados granulares ("Concluiu módulo", "Fez reflexão") podem não ter dado de origem. Mitigação: AC5 exibe só o que há base (`returned_at`), documenta lacuna.

## Regra Absoluta de Escopo (verificação)

É o motivo de existir desta story (o vazamento de histórico é o problema explícito da Seção 13). Coberta por AC3 + AC8. Blocker.

## Dev Notes

- Esta story consome dados que já vêm escopados de `GET /api/engagement/history` (E3) — a responsabilidade de filtrar por `allowedStudentIds` é do BACKEND, esta story só precisa garantir que a UI não introduz nenhum caminho paralelo (ex.: uma segunda chamada de API sem escopo, ou uma junção client-side com dado tenant-wide de outro endpoint) que reintroduza o vazamento.
- Se `data-table.tsx` (`packages/ui/src/components/data-table.tsx`) já suportar paginação/filtro server-side, preferir usá-lo em vez de implementar do zero.

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web lint
pnpm --filter @eximia/web test -- engagement/history
```

## Dev Agent Record

**Agent:** Dex (@dev) · **Data:** 2026-07-08 · **Status:** InReview

### Decisões técnicas (IDS)

- **REUSE:** `@eximia/ui` `DataTable` (busca + filterSlot + empty embutidos, componente padrão do repo), `Badge`, `Select`, `EmptyState`; `nudge-labels.ts` (criado em E7, reusado aqui p/ o rótulo humano de Motivo); contrato `HistoryTabProps` de `types.ts` (não tocado).
- **CREATE (justificado):** corpo de `history-tab.tsx` — mapeadores puros `statusLabel`/`resultLabel`/`motivoLabel`/`fmtDate` + a orquestração de fetch/filtro.
- **Sem caminho paralelo (AC3):** única fonte é `GET /api/engagement/history`. Os filtros Origem/Canal/Status/Período viram query-params (a rota os suporta); Aluno é busca client sobre as rows JÁ escopadas pelo servidor — nunca um 2º fetch não-escopado nem join com dado tenant-wide.
- **Status (AC4):** só os 4 valores reais de banco viram rótulo; "Falhou"/"Dispensado" não existem em `notifications` e não foram inventados.

### Lacunas de props/contrato registradas (para o orquestrador reconciliar)

- **`types.ts` não alterado.** `HistoryTabProps` (context + focusedStudentId) foi suficiente.
- **LACUNA na rota E3 `history/route.ts` (fora da minha fronteira, não editei):**
  1. O `select` retorna `recipient_id` mas NÃO o nome do aluno → a coluna "Destinatário" mostra `recipient_name` se vier, senão "Aluno {id8}". Recomendo estender o select/join para trazer `full_name` escopado (a mesma disciplina de escopo da rota).
  2. O `select` OMITE `returned_at` e `acted_at` → "Resultado" (AC5) não consegue mostrar "Acessou depois da mensagem" de fato até a rota incluí-los. Lido defensivamente; UI faz upgrade sozinha quando a rota passar a retorná-los.
  3. A rota NÃO tem query-param `type`/`nudgeType` → o filtro "Tipo de ação" foi servido pela coluna/derivação de Motivo (`context.nudge_type`/`origin`) + o filtro de Origem. Se um filtro de tipo dedicado for desejado, a rota precisa do param.

### Verificação

- `pnpm --filter @eximia/web typecheck` → sem erros nos arquivos E8.
- `npx biome check` → clean (após format).

### File List

- `apps/web/src/app/(platform)/engagement/_components/history-tab.tsx` (modificado — corpo real da tabela E8)

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-08 | Story criada | River (SM Agent) |
| 2026-07-08 | PO: adicionadas Complexidade & Riscos + verificação de escopo. Validada GO (9/10). | Pax (@po) |
| 2026-07-08 | Implementada: tabela de 8 colunas via DataTable + 6 filtros, status/resultado derivados, eficácia com base. Lacunas do select da rota E3 (nome/returned_at/type) registradas. InReview. | Dex (@dev) |

## PO Validation: GO

**Verdict:** GO — **9/10** — 2026-07-08 — @po (Pax)

Exemplar no tratamento do descompasso schema-vs-report. Verifiquei no repo: `notifications.status` é exatamente `queued|sent|read|acted` (AC4 correto), `returned_at` existe como sinal de eficácia cron-set (AC5 correto). A story se recusa a inventar colunas ("Falhou"/"Dispensado" não existem — documentar a lacuna, derivar de campos reais) — exatamente a disciplina anti-alucinação que o padrão de qualidade exige. AC3/AC8 travam o vazamento que é o problema explícito da Seção 13. Componentes `table.tsx`/`data-table.tsx` existem.
**Nota para devs:** o mapeamento status-banco→rótulo-UI deve ser documentado no Dev Agent Record; NÃO criar coluna de status nova.
