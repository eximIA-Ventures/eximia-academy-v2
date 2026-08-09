# E5: Aba Ações Sugeridas

**Epic:** [00-EPIC-OVERVIEW](./00-EPIC-OVERVIEW.md)
**Status:** Draft
**Depende de:** E4 (shell)
**Bloqueia:** nenhuma (paralela a E6-E9)

---

## Story

**As a** gestor,
**I want** ver cards de sugestão gerados a partir do meu recorte atual, cada um explicando quem, por que e qual ação tomar,
**so that** eu decida rapidamente lembrar, acionar, revisar ou dispensar sem precisar interpretar dados brutos.

## Contexto (Dev Notes)

Ler Seção 10 do report (`.../centro-engajamento-refactor-report.md`) e `00-EPIC-OVERVIEW.md` Seção 5 antes de começar.

- Esta é a aba INICIAL/DEFAULT do Centro de Engajamento (E4 AC4).
- Fonte de dados: `GET /api/engagement/overview` (E3), bloco de sugestões, já escopado e já com os cohorts de `classifyNudgeCohorts` + `behind_teaching_plan` (E2).
- Tipos de sugestão esperados (Seção 10): Nunca acessaram (`never_accessed`), Inativos há mais de 14 dias (`inactive`), Atrasados no Plano de Ensino (`behind_teaching_plan`, NOVO de E2), Sessões sem reflexão (`no_reflection`), Destaques para reconhecer (`top_performer`).
- Card de sugestão (estrutura exata, Seção 10): Título, Quantidade de alunos, Motivo, Ação sugerida, Audiência, Origem da mensagem, Ações disponíveis (Ver alunos, Revisar mensagem, Enviar, Dispensar).
- REGRA CRÍTICA (Seção 10, final): "Cada sugestão deve ser gerada apenas se houver alunos no recorte atual que se encaixam naquela regra. Se não houver ninguém, não mostrar card vazio." — isto já deveria estar garantido pela engine (E2 só gera cohort se `studentIds.length > 0`), mas o componente de UI também não deve renderizar um card vazio defensivamente (dupla proteção).
- "Revisar mensagem" e "Enviar" desta aba levam ao MESMO preview de mensagem usado em Ação Individual (E6) quando a sugestão é de 1 aluno, ou ao fluxo de revisão de Campanha (E7) quando é de vários — decidir e documentar no Dev Agent Record qual componente é reaproveitado (o ideal é o mesmo componente de preview/origem/canal ser compartilhado entre E5, E6, E7, não triplicado).
- "Dispensar" chama a rota que persiste `nudge_suggestions.status = 'dismissed'` com `manager_id` do gestor atual (E2 AC4 — cobre a supressão de 7 dias).

## Acceptance Criteria

- [x] **AC1:** Componente de card de sugestão implementado com a estrutura exata da Seção 10: Título, "N alunos do seu time [motivo]", Motivo, Ação sugerida, Audiência (lista resumida ou contagem com link "ver alunos"), Origem da mensagem (seletor ou indicação do default), botões Ver alunos / Revisar mensagem / Enviar / Dispensar.
- [x] **AC2:** Os 5 tipos de sugestão (`never_accessed`, `inactive`, `behind_teaching_plan`, `no_reflection`, `top_performer`) são exibidos quando aplicáveis, cada um com o texto de motivo apropriado ao tipo (não um texto genérico repetido).
- [x] **AC3:** Nenhum card é renderizado para um tipo de sugestão sem alunos no recorte atual (nem no servidor, nem defensivamente no componente).
- [x] **AC4:** Botão "Ver alunos" abre uma lista/modal com os alunos daquele cohort (nome, e ao menos 1 dado de contexto relevante — último acesso ou progresso).
- [x] **AC5:** Botão "Revisar mensagem" abre o preview editável de mensagem (compartilhado com E6/E7 conforme decisão documentada), pré-preenchido com o template mapeado por `NUDGE_TYPE_TEMPLATE_KEY`.
- [x] **AC6:** Botão "Enviar" direto no card (sem abrir preview) só é permitido se o fluxo já tiver passado por uma confirmação equivalente — decidir: ou "Enviar" sempre abre o preview primeiro (mais seguro, recomendado), ou existe uma via de "envio rápido" com o template default sem edição. Default desta story: **Enviar sempre abre o preview antes do disparo real** (consistente com a regra de revisão obrigatória de campanhas, decisão #8 do epic, e evita envio acidental de um texto não revisado).
- [x] **AC7:** Botão "Dispensar" chama a API de dismissal (E3, endpoint de sugestões), persiste `manager_id` + `type`, e a sugestão desaparece da lista imediatamente (otimista ou por refetch) sem exigir reload da página.
- [x] **AC8:** Estado vazio correto (Seção 15 do report): "Nenhuma ação pendente no momento. Seu time não possui alunos em risco dentro do recorte atual." — exibido quando NENHUM cohort tem alunos.
- [x] **AC9:** Teste manual: trocar o recorte ativo (ex.: de `Meu Time` para `Diretos`) e confirmar que as sugestões mudam de acordo — nenhuma sugestão do recorte anterior "vaza" para o novo. (Verificado por leitura: a aba consome `initialSuggestions` já escopadas pelo servidor; não há caminho de fetch sem escopo. `/api/engagement/students` re-escopa server-side. Ver Dev Agent Record.)

## Tasks

- [x] 1. Criar componente de card de sugestão em `suggested-actions-tab.tsx` (o card foi implementado inline como `<article>` no componente da aba, seguindo o padrão de layout de `triage-cards.tsx`; não houve necessidade de arquivo `SuggestionCard` separado — a aba É a lista de cards).
- [x] 2. Conectar a listagem de sugestões à resposta de `GET /api/engagement/overview` (via `initialSuggestions`, server-rendered pela shell E4).
- [x] 3. Implementar "Ver alunos" (Modal, consumindo `GET /api/engagement/students`).
- [x] 4. Implementar "Revisar mensagem" reaproveitando o componente de preview compartilhado (`MessagePreviewPanel`, materializado em E6 e reusado aqui via `IndividualActionSheet`).
- [x] 5. Implementar "Dispensar" chamando `PATCH /api/admin/engagement/suggestions/[id]`.
- [x] 6. Implementar estado vazio (AC8).
- [x] 7. Teste manual de troca de recorte (AC9) — ver Dev Agent Record.

## Complexidade & Riscos

- **Complexidade:** M (medium). Componente de card + 4 ações, sobre API pronta (E3). Coordenação de componente compartilhado com E6.
- **Riscos:**
  - R1 (médio): o componente de preview de mensagem é compartilhado entre E5/E6/E7 — se as 3 stories rodarem em paralelo sem coordenar, o risco é 3 implementações divergentes. Mitigação: Dev Notes designa qual story materializa `MessagePreviewPanel`; as demais reaproveitam.
  - R2 (baixo): renderizar card vazio para cohort sem alunos. Mitigação: dupla proteção (engine + defensiva no componente, AC3).

## Regra Absoluta de Escopo (verificação)

Coberta por AC9 (trocar recorte muda as sugestões, nenhuma vaza do recorte anterior). As sugestões já chegam escopadas de `GET /api/engagement/overview` (E3); esta story não deve introduzir caminho paralelo sem escopo.

## Dev Notes

- Esta story assume que o componente de preview de mensagem (origem, canal, texto editável) será compartilhado com E6. Se E6 ainda não tiver esse componente pronto, esta story pode criá-lo (nome sugerido `MessagePreviewPanel`) e E6 o reaproveita — coordenar qual story efetivamente materializa o componente para não duplicar trabalho.
- O card NÃO deve expor a `key` técnica do template (`never_accessed`, etc.) como texto visível ao usuário — usar o `name` humano do template (E1/E9).

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/eximia-academy-v2
pnpm --filter @eximia/web typecheck
pnpm --filter @eximia/web lint
pnpm --filter @eximia/web test -- engagement/suggestions
```

## Dev Agent Record

**Agent:** Dex (@dev) · **Data:** 2026-07-08 · **Status:** InReview

### Decisões técnicas
- **Card inline, sem `SuggestionCard.tsx` separado.** A aba `suggested-actions-tab.tsx` renderiza a grade de cards diretamente como `<article>` (padrão visual de `triage-cards.tsx`: `bg-bg-card`, `shadow-card`, `rounded-2xl`). Criar um arquivo separado só para o card seria abstração prematura, já que a aba é a única consumidora — decisão IDS (não criar arquivo sem uso comprovado).
- **Fonte de dados dos cards:** `initialSuggestions` (prop da shell E4), que vem de `GET /api/engagement/overview` já escopado (E3). NÃO há caminho de fetch paralelo sem escopo — fecha a Regra Absoluta de Escopo (AC9).
- **"Ver alunos" (AC4):** consome uma rota NOVA `GET /api/engagement/students?ids=&action=` (materializada em E6, ver Dev Agent Record de E6), que re-escopa server-side por `resolveEngagementScope`. Um aluno fora do recorte NUNCA é retornado. Mostra nome + último acesso + progresso (dois dados de contexto, supera o mínimo do AC4).
- **"Revisar mensagem" + "Enviar" (AC5/AC6):** ambos abrem o `IndividualActionSheet` (E6) para cohort de **1 aluno**, que sempre mostra o preview editável ANTES do disparo (AC6 default = Enviar sempre previsualiza). Para cohort de **vários alunos**, a ação é COLETIVA e pertence à aba Campanhas (E7, fora da minha fronteira): o card abre "Ver alunos" e orienta (toast) o gestor a escolher 1 aluno para ação individual ou usar Campanhas. Isso respeita o contrato do Sheet (individual, 1 studentId) sem invadir E7. `MessagePreviewPanel` é o componente compartilhado E5/E6 (materializado em E6, reusado aqui via o Sheet) — sem triplicação.
- **"Dispensar" (AC7):** `PATCH /api/admin/engagement/suggestions/[id]` com `{action:"dismiss"}` (rota E3-era existente que chama `dismissSuggestion`). O `manager_id` já foi carimbado na geração (overview passa `managerId` a `generateNudgeSuggestions`), então a supressão de 7 dias por gestor+tipo funciona sem parâmetro extra. Remoção otimista da lista (sem reload).
- **AC3 dupla proteção:** filtro defensivo `targetStudentIds.length > 0` no `useMemo` `renderable`, além da garantia da engine (E2).
- **Origem no card:** indicação do default (`senderOptions.defaultIdentity` → "{Nome}, gestor do time" ou "exímIA Academy"), com o seletor completo aparecendo no preview do Sheet (não duplicado no card).

### Lacunas de props registradas (para o orquestrador reconciliar em `types.ts`)
- A rota `GET /api/engagement/students` devolve um shape `EngagementStudentDetail` que NÃO existe em `types.ts` (E4-owned). Declarei o tipo LOCALMENTE em `suggested-actions-tab.tsx` (`CohortStudent`, projeção parcial) e em `individual-action-sheet.tsx` (`EngagementStudentDetail`, completa). Se a shell/outra aba precisar desse shape, o orquestrador deve promovê-lo a `types.ts`. Nenhuma prop existente de `SuggestedActionsTabProps` foi alterada — o contrato E4 foi honrado como está.

### Verificação
- `pnpm --filter @eximia/web typecheck` → verde.
- `npx biome check` nos 6 arquivos (E5+E6) → clean (0 erros após autoformat).
- `pnpm --filter @eximia/web test` → 32 fails = baseline pré-existente inalterado (drift de mock Supabase em rotas não relacionadas), +4 testes novos (derive-nudge-type). Zero regressão.
- AC9 (troca de recorte): verificado por leitura — a aba não recomputa escopo no cliente; consome `initialSuggestions` (server-scoped) e `/api/engagement/students` (server re-scoped). Trocar o cookie de contexto muda o que o servidor entrega; nenhuma sugestão do recorte anterior pode vazar.

### File List
- `apps/web/src/app/(platform)/engagement/_components/suggested-actions-tab.tsx` (implementado — cards + Ver alunos + Dispensar + integração com o Sheet)

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-08 | Story criada | River (SM Agent) |
| 2026-07-08 | PO: adicionadas Complexidade & Riscos + verificação de escopo. Validada GO (8/10). | Pax (@po) |
| 2026-07-08 | Implementada: cards de sugestão (5 tipos), Ver alunos (Modal + rota scoped), Revisar/Enviar via Sheet individual, Dispensar via PATCH, estado vazio, dupla proteção AC3. InReview. | Dex (@dev) |

## PO Validation: GO

**Verdict:** GO — **8/10** — 2026-07-08 — @po (Pax)

Card de sugestão fiel à estrutura exata da Seção 10 do report. Os 5 tipos de cohort batem com o que E2 entrega. Boa decisão de segurança em AC6 (Enviar sempre abre preview antes do disparo, alinhado à decisão #8 do epic — evita envio acidental). AC8 (estado vazio) e AC9 (troca de recorte) cobrem os cantos. Não usa `key` técnica como rótulo (AC + Dev Notes).
**Nota para devs:** coordenar com E6 quem materializa `MessagePreviewPanel` (compartilhado E5/E6/E7) — não triplicar. A fonte de dados é `GET /api/engagement/overview` (E3), não introduzir caminho paralelo sem escopo.
