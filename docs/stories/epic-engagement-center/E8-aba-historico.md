# E8: Aba Histórico

**Epic:** [00-EPIC-OVERVIEW](./00-EPIC-OVERVIEW.md)
**Status:** Draft
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

- [ ] **AC1:** Tabela de histórico implementada com as 8 colunas da Seção 13 (Destinatário, Motivo, Mensagem/template, Origem, Canal, Status, Data, Resultado), usando `packages/ui/src/components/table.tsx` ou `data-table.tsx` (CONFIRMAR qual componente é o padrão do repo para tabelas com filtro/paginação — `student-insights-table.tsx` é a referência mais próxima).
- [ ] **AC2:** Filtros implementados: Aluno (busca por nome), Tipo de ação (nudgeType), Origem da mensagem (manager/platform), Canal (inapp/email), Status, Período (data inicial/final).
- [ ] **AC3:** TODA row exibida tem `recipient_id` dentro do `allowedStudentIds` do gestor autenticado — nenhuma pessoa fora do time aparece, em nenhum filtro, em nenhuma paginação.
- [ ] **AC4:** Mapeamento de status de banco (`queued`/`sent`/`read`/`acted`) para rótulos de UI documentado e implementado consistentemente (ver Dev Notes acima) — se algum dos 6 status da Seção 13 não tiver base de dado real, isso é documentado explicitamente, não inventado.
- [ ] **AC5:** Coluna Resultado exibe "Acessou depois da mensagem" quando `returned_at IS NOT NULL`, "Sem resposta" caso contrário e `sent_at` já passado há tempo suficiente (definir um threshold razoável, ex. mesma janela do cron de eficácia — CONFIRMAR o threshold usado pelo job de eficácia existente, se houver, antes de inventar um novo).
- [ ] **AC6:** Estado vazio (Seção 15): "Nenhuma comunicação enviada para este recorte ainda." — exibido quando o histórico filtrado ao recorte atual está vazio.
- [ ] **AC7:** Ao selecionar um aluno específico no filtro (ou navegar da tabela de alunos com um aluno focado), a lista se restringe automaticamente a esse aluno, mantendo os demais filtros aplicáveis.
- [ ] **AC8:** Teste manual do cenário canônico: gestor com recorte pequeno NUNCA vê uma linha de histórico de um aluno fora do time, mesmo trocando todos os filtros disponíveis.

## Tasks

- [ ] 1. Criar componente de tabela de histórico consumindo `GET /api/engagement/history`.
- [ ] 2. Implementar os 6 filtros (Aluno, Tipo, Origem, Canal, Status, Período).
- [ ] 3. Implementar o mapeamento de status banco → rótulo UI, documentando lacunas.
- [ ] 4. Implementar coluna Resultado com o sinal `returned_at`.
- [ ] 5. Implementar estado vazio.
- [ ] 6. Teste manual do cenário canônico de escopo.

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

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-08 | Story criada | River (SM Agent) |
| 2026-07-08 | PO: adicionadas Complexidade & Riscos + verificação de escopo. Validada GO (9/10). | Pax (@po) |

## PO Validation: GO

**Verdict:** GO — **9/10** — 2026-07-08 — @po (Pax)

Exemplar no tratamento do descompasso schema-vs-report. Verifiquei no repo: `notifications.status` é exatamente `queued|sent|read|acted` (AC4 correto), `returned_at` existe como sinal de eficácia cron-set (AC5 correto). A story se recusa a inventar colunas ("Falhou"/"Dispensado" não existem — documentar a lacuna, derivar de campos reais) — exatamente a disciplina anti-alucinação que o padrão de qualidade exige. AC3/AC8 travam o vazamento que é o problema explícito da Seção 13. Componentes `table.tsx`/`data-table.tsx` existem.
**Nota para devs:** o mapeamento status-banco→rótulo-UI deve ser documentado no Dev Agent Record; NÃO criar coluna de status nova.
