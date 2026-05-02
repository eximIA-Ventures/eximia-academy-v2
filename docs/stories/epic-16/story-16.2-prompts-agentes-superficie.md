# Story 16.2: Prompts dos Agentes de Superficie (Mestre, Polidor, Guardiao)

**Epic:** [Epic 16 — Core Agents & Pipeline Socratico](../../epics/epic-16-ws1-core-agents-pipeline-socratico.md)
**Version:** 1.0
**Created:** 2026-02-15
**Updated:** 2026-02-15
**Author:** River (SM)
**Status:** Ready
**Story Points:** 8
**Priority:** P0 (fundacao)
**Blocked By:** Story 16.1 (schemas/types)
**Blocks:** Story 16.4 (Orquestrador v2)
**Assigned To:** @dev

---

## User Story

**As a** developer,
**I want** system prompts completos para Mestre, Polidor e Guardiao,
**so that** cada agente tenha comportamento socratico preciso conforme a arquitetura.

---

## Story Context

| Item | Detalhe |
|------|---------|
| **Architecture Ref** | `docs/architecture/ws1-motor-socratico-architecture.md`, Secoes 6.1-6.3, 12 |
| **PRD Ref** | `docs/prd/evolucao-eximia-academy-workstreams.md` — WS1: Motor Socratico |
| **Stack** | TypeScript (template literals) |
| **Package** | `@eximia/agents` |
| **Existing Pattern** | `packages/agents/src/prompts/creator.ts` (seguir pattern) |
| **Risk** | MEDIUM — qualidade do prompt impacta diretamente a experiencia do aluno |

---

## Acceptance Criteria

- [ ] **AC1:** Prompt do Mestre em `packages/agents/src/prompts/mestre.ts`
  - Identidade: `Eximia_Mestre` (MSW identifier)
  - 7 camadas de profundidade (Fatos, Compreensao, Aplicacao, Analise, Perspectiva, Avaliacao, Sintese)
  - 6 tipos de perguntas socraticas (clarificacao, pressupostos, perspectiva, evidencia, consequencias, metacognicao)
  - 5 tecnicas avancadas de pergunta (paradoxal, temporal, inversao, essencia, permissao)
  - Calibracao emocional (4 estados: confuso, defensivo, frustrado, insight)
  - 5 tipos de resistencia com tratamento (intelectualizacao, deflexao, minimizacao, agressao, desistencia)
  - Fechamento socratico (quando `interactions_remaining <= 1`)
  - 10 regras inviolaveis
  - Recebe: conteudo do capitulo, historico, perfil do aluno, feedback do Guardiao (se retry)
  - Context injection: Big Five, Enneagram, DISC, Inteligencias Multiplas, perfil IA do Perfilador
- [ ] **AC2:** Prompt do Polidor em `packages/agents/src/prompts/polidor.ts`
  - Identidade: `Eximia_Polidor`
  - Processo de edicao (5 passos)
  - Regras: 2 paragrafos, 80-200 palavras, sem labels, naturalidade, termina com ?
- [ ] **AC3:** Prompt do Guardiao em `packages/agents/src/prompts/guardiao.ts`
  - Identidade: `Eximia_Guardiao`
  - 7 criterios de validacao
  - Score 0-1 por criterio + score geral
  - Verdict APPROVED/REJECTED
  - Feedback especifico para retry (se REJECTED)
- [ ] **AC4:** Prompts em portugues (Brasil)
- [ ] **AC5:** Cada prompt inclui identifier `Eximia_*` no inicio do system prompt
- [ ] **AC6:** Funcao `buildMestrePrompt(context)` que injeta conteudo do capitulo + perfil + historico

---

## CodeRabbit Integration

> **CodeRabbit Integration**: Disabled
>
> CodeRabbit CLI is not enabled in `core-config.yaml`.
> Quality validation will use manual review process only.

---

## Tasks / Subtasks

- [ ] **Task 1** (AC: 1, 4, 5) Criar prompt do Mestre
  - [ ] Criar `packages/agents/src/prompts/mestre.ts`
  - [ ] Definir constante `MESTRE_SYSTEM_PROMPT` com structured markdown:
    - Secao IDENTIDADE: `Eximia_Mestre`, missao socratica, personalidade
    - Secao 7 CAMADAS DE PROFUNDIDADE: tabela com layer -> pergunta exemplo -> progressao por turno
    - Secao 6 TIPOS DE PERGUNTAS: enum com exemplo de cada
    - Secao 5 TECNICAS AVANCADAS: paradoxal, temporal, inversao, essencia, permissao
    - Secao CALIBRACAO EMOCIONAL: tabela estado aluno -> resposta adequada
    - Secao RESISTENCIA: 5 tipos com mitigacao
    - Secao FECHAMENTO SOCRATICO: condicoes (interactions_remaining <= 1), perguntas de integracao/acao/apreciacao
    - Secao INVARIANTES: 10 regras inquebraveis
    - Secao CONTEXTO DE ENTRADA: descricao dos inputs
  - [ ] Criar funcao `buildMestrePrompt(context: MestrePromptContext): string`
    - Injeta: conteudo do capitulo, historico da conversa, perfil do aluno (se existente)
    - Injeta: feedback do Guardiao (se retry)
    - Injeta: interaction_type configs
    - Sanitiza inputs (regex + length limits)

- [ ] **Task 2** (AC: 2, 4, 5) Criar prompt do Polidor
  - [ ] Criar `packages/agents/src/prompts/polidor.ts`
  - [ ] Definir constante `POLIDOR_SYSTEM_PROMPT` com:
    - Identidade: `Eximia_Polidor`
    - Processo de edicao (5 passos): identificar labels -> remover -> reestruturar 2 paragrafos -> ajustar fluencia -> validar
    - Regras: exatamente 2 paragrafos, 80-200 palavras, remover labels artificiais, simplificar linguagem robotica, preservar 100% do significado, nunca adicionar conteudo, terminar com ?

- [ ] **Task 3** (AC: 3, 4, 5) Criar prompt do Guardiao
  - [ ] Criar `packages/agents/src/prompts/guardiao.ts`
  - [ ] Definir constante `GUARDIAO_SYSTEM_PROMPT` com:
    - Identidade: `Eximia_Guardiao`
    - 7 criterios de validacao: no_direct_answer, no_labels, ends_with_question, single_question, connected_to_chapter, references_student, within_limits
    - Score 0-1 por criterio + score geral
    - Verdict APPROVED (score >= 0.7) ou REJECTED (score < 0.7)
    - Se REJECTED: gerar recommendation com feedback especifico para o Mestre

- [ ] **Task 4** (AC: 6) Criar builder do Mestre
  - [ ] Definir `MestrePromptContext` interface em mestre.ts (usa `ConversationMessage` de `types.ts` e campos de `OrchestratorInput["studentProfile"]` — ambos ja existentes)
  - [ ] Implementar `buildMestrePrompt()` que:
    - Concatena MESTRE_SYSTEM_PROMPT + secoes dinamicas
    - Injeta conteudo do capitulo (truncado a 3000 chars se necessario)
    - Injeta perfil do aluno (Big Five, DISC, Enneagram, Kolb) se disponivel
    - Injeta feedback do Guardiao se retry
    - Sanitiza todos os inputs injetados

- [ ] **Task 5** (AC: 5) Atualizar barrel file
  - [ ] Exportar prompts e builder em `packages/agents/src/index.ts`

- [ ] **Task 6** Validar
  - [ ] `pnpm typecheck` passa

---

## Dev Notes

### Existing Prompt Pattern

Seguir o pattern de `packages/agents/src/prompts/creator.ts`:

```typescript
export const CREATOR_SYSTEM_PROMPT = `# System Prompt: Harven_Creator (CreatorOS)

> **Identidade**: Voce e CreatorOS, ...
...
`
```

**DIFERENCA IMPORTANTE**: Os novos agentes usam prefixo `Eximia_` em vez de `Harven_`. Isso e critico para MSW mocking — o handler `detectAgent()` usa esses identifiers para rotear fixtures.

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 17.3]

### Prompt Content Reference

**Mestre — 10 regras inviolaveis**:
1. Se aluno pedir resposta direta → reformular como pergunta guia
2. Se resposta errada → perguntas que exponham inconsistencia (nunca corrigir)
3. Se resposta correta → aprofundar com nuances/excecoes/aplicacoes
4. Se resposta superficial → pedir exemplos/contra-argumentos/mecanismos
5. NUNCA mais de 1 pergunta por resposta
6. NUNCA usar labels artificiais
7. NUNCA dar resposta direta/completa
8. NUNCA fugir do topico do capitulo
9. SEMPRE terminar com pergunta aberta
10. SEMPRE referenciar algo especifico que o aluno disse

**Polidor — processo de edicao (5 passos)**:
1. Identificar e marcar labels para remocao
2. Remover todos os labels (manter conteudo)
3. Reestruturar em exatamente 2 paragrafos
4. Ajustar fluencia e simplificar linguagem robotica
5. Validar (contar paragrafos, verificar pergunta, contagem palavras, significado preservado)

**Guardiao — 7 criterios**:
1. no_direct_answer — nao deu conselho/solucao
2. no_labels — texto limpo, natural
3. ends_with_question — termina com pergunta aberta (nao sim/nao)
4. single_question — foco claro (1 pergunta)
5. connected_to_chapter — nao divagou
6. references_student — mencionou algo especifico da resposta do aluno
7. within_limits — 80-200 palavras, 2 paragrafos

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secoes 6.1-6.3]

### Context Injection — Perfil do Aluno

O Mestre recebe contexto de perfil (se disponivel) via `buildMestrePrompt()`:
- Big Five (abertura, conscienciosidade, extroversao, amabilidade, neuroticismo)
- DISC (dominancia, influencia, estabilidade, conformidade)
- Enneagram (tipo 1-9 + asa)
- Inteligencias Multiplas (top 2)
- Kolb (estilo + adaptacao: divergente→perspectiva, assimilador→frameworks, convergente→aplicacao, acomodador→experimentacao)

O perfil vem de `learner_profiles` (Epic 17) e `user_profiles` (existente). Se nao existir, Mestre usa comportamento neutro.

[Source: docs/architecture/ws1-motor-socratico-architecture.md, Secao 12]

### File Locations

```
packages/agents/src/prompts/
├── mestre.ts      # NOVO (export: MESTRE_SYSTEM_PROMPT, buildMestrePrompt)
├── polidor.ts     # NOVO (export: POLIDOR_SYSTEM_PROMPT)
├── guardiao.ts    # NOVO (export: GUARDIAO_SYSTEM_PROMPT)
├── creator.ts     # EXISTENTE (referencia pattern)
└── socrates.ts    # EXISTENTE (sera deletado no 16.7)
```

### Testing

- Testes de prompt serao criados no Epic 19 (Story 19.2)
- Verificar que identifiers `Eximia_Mestre`, `Eximia_Polidor`, `Eximia_Guardiao` estao presentes
- Verificar context injection funcional

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-02-15 | 1.0 | Story creation | River (SM) |
| 2026-02-15 | 1.1 | QA fix: MestrePromptContext dependency on existing types noted | Quinn (QA) + River (SM) |

---

## Dev Agent Record

### Agent Model Used
_To be filled by @dev_

### Debug Log References
_To be filled by @dev_

### Completion Notes List
_To be filled by @dev_

### File List
_To be filled by @dev_

---

## QA Results
_To be filled by @qa_
