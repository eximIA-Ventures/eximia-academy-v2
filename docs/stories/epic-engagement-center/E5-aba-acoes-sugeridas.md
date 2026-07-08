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

- [ ] **AC1:** Componente de card de sugestão implementado com a estrutura exata da Seção 10: Título, "N alunos do seu time [motivo]", Motivo, Ação sugerida, Audiência (lista resumida ou contagem com link "ver alunos"), Origem da mensagem (seletor ou indicação do default), botões Ver alunos / Revisar mensagem / Enviar / Dispensar.
- [ ] **AC2:** Os 5 tipos de sugestão (`never_accessed`, `inactive`, `behind_teaching_plan`, `no_reflection`, `top_performer`) são exibidos quando aplicáveis, cada um com o texto de motivo apropriado ao tipo (não um texto genérico repetido).
- [ ] **AC3:** Nenhum card é renderizado para um tipo de sugestão sem alunos no recorte atual (nem no servidor, nem defensivamente no componente).
- [ ] **AC4:** Botão "Ver alunos" abre uma lista/modal com os alunos daquele cohort (nome, e ao menos 1 dado de contexto relevante — último acesso ou progresso).
- [ ] **AC5:** Botão "Revisar mensagem" abre o preview editável de mensagem (compartilhado com E6/E7 conforme decisão documentada), pré-preenchido com o template mapeado por `NUDGE_TYPE_TEMPLATE_KEY`.
- [ ] **AC6:** Botão "Enviar" direto no card (sem abrir preview) só é permitido se o fluxo já tiver passado por uma confirmação equivalente — decidir: ou "Enviar" sempre abre o preview primeiro (mais seguro, recomendado), ou existe uma via de "envio rápido" com o template default sem edição. Default desta story: **Enviar sempre abre o preview antes do disparo real** (consistente com a regra de revisão obrigatória de campanhas, decisão #8 do epic, e evita envio acidental de um texto não revisado).
- [ ] **AC7:** Botão "Dispensar" chama a API de dismissal (E3, endpoint de sugestões), persiste `manager_id` + `type`, e a sugestão desaparece da lista imediatamente (otimista ou por refetch) sem exigir reload da página.
- [ ] **AC8:** Estado vazio correto (Seção 15 do report): "Nenhuma ação pendente no momento. Seu time não possui alunos em risco dentro do recorte atual." — exibido quando NENHUM cohort tem alunos.
- [ ] **AC9:** Teste manual: trocar o recorte ativo (ex.: de `Meu Time` para `Diretos`) e confirmar que as sugestões mudam de acordo — nenhuma sugestão do recorte anterior "vaza" para o novo.

## Tasks

- [ ] 1. Criar componente `SuggestionCard` (nome sugerido) em `apps/web/src/app/(platform)/engagement/_components/` (ou path equivalente ao padrão do repo — CONFIRMAR convenção olhando `admin/notifications/_components/`).
- [ ] 2. Conectar a listagem de sugestões à resposta de `GET /api/engagement/overview`.
- [ ] 3. Implementar "Ver alunos" (lista/modal).
- [ ] 4. Implementar "Revisar mensagem" reaproveitando (ou criando, se ainda não existir) o componente de preview compartilhado com E6.
- [ ] 5. Implementar "Dispensar" chamando a API de E3.
- [ ] 6. Implementar estado vazio (AC8).
- [ ] 7. Teste manual de troca de recorte (AC9).

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

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-08 | Story criada | River (SM Agent) |
| 2026-07-08 | PO: adicionadas Complexidade & Riscos + verificação de escopo. Validada GO (8/10). | Pax (@po) |

## PO Validation: GO

**Verdict:** GO — **8/10** — 2026-07-08 — @po (Pax)

Card de sugestão fiel à estrutura exata da Seção 10 do report. Os 5 tipos de cohort batem com o que E2 entrega. Boa decisão de segurança em AC6 (Enviar sempre abre preview antes do disparo, alinhado à decisão #8 do epic — evita envio acidental). AC8 (estado vazio) e AC9 (troca de recorte) cobrem os cantos. Não usa `key` técnica como rótulo (AC + Dev Notes).
**Nota para devs:** coordenar com E6 quem materializa `MessagePreviewPanel` (compartilhado E5/E6/E7) — não triplicar. A fonte de dados é `GET /api/engagement/overview` (E3), não introduzir caminho paralelo sem escopo.
