# 04 — Specs Index & Veredito PO (EPIC-STUDENT-HOME-FINALIZACAO)

> **Autor:** Contrato (@po) · **Data:** 2026-07-12 · **DOCS ONLY** (nenhum código de app tocado)
> **Insumos:** `EPIC-STUDENT-HOME-FINALIZACAO.md` (Saga/@pm), stories SH-F.1..SH-F.4 (Roteiro/@sm), plano `03-finalizacao-plan.md` (Vitruvio/@architect, referenciado).
> **Base de código:** worktree `/Users/hugocapitelli/Dev/eximia/sh-1.4-worktree`, branch `feat/SH-1.4-student-home-card`, HEAD `d8b7f85`. Home "Meu ritmo" aprovada, SEM push.
> **Escopo:** veredito GO/NO-GO por story (validação 10 pontos), tratamento das 2 atenções bloqueantes, atribuição dos 3 pares.

---

## 1. Veredito por story

| Story | Título | Natureza | Complexidade | Placar 10pt | Veredito |
|:---|:---|:---|:---|:---|:---|
| **SH-F.1** | Poda do órfão `StudentProgressHeadline` | Subtração (delete) | XS | 9,5 | **GO** |
| **SH-F.2** | Estabilidade de teste (`vitest.config.ts`) | Config | S | 9,0 | **GO** |
| **SH-F.3** | Cache org por tenant (`org-reference-cache.ts`) | Aditivo + **muda leitura** | L | 9,0 | **GO** (decisão de produto ratificada) |
| **SH-F.4** | Seed demo fresco (`seed-student-home-demo.ts`) | **Escrita no banco** (demo-only) | M | 9,0 | **GO** (guardas ratificadas como gates bloqueantes) |

**4/4 GO. Nenhum NO-GO.** ACs fortalecidas anexadas em cada `.story.md` na seção `## PO Validation & Critérios Fortalecidos (@po)`, preservando as ACs originais do @sm (aditivo).

## 2. Fatos de código reconfirmados pelo @po (worktree SH-1.4, 2026-07-12)

Este @po reverificou, não carimbou:
1. **F.1:** `student-progress-headline.tsx` existe, **0 import de app** (só self + comentários em `student-home-card.tsx:24` e `preview-desempenho`). `buildProgressHeadline` VIVO em `student-comparison-scale.ts:353`, usado por `student-home-card.tsx:33`/`:92`. Teste do helper tem guard `.not.toContain("—")` (l.58-59) **e** asserções `toBe` de string exata (l.64-67), o que blinda a AC4.
2. **F.2:** `vitest.config.ts` sem `testTimeout` nem tuning de pool. `test` = `vitest run`.
3. **F.3:** `computeStudentComparison`@1091; padrão `feature-gate.ts` (`CACHE_TTL_MS`@44, `Map`@45, `expiry`@50/142) confirmado como precedente de cache por tenant em processo longo.
4. **F.4:** `seed-remote.ts` (createClient@1, envs@3-4, `TENANT_ID`@15); aluno de demo = `student@a.com` (l.22); `tsx` disponível na raiz; `seed-student-home-demo.ts` ainda não existe.

## 3. As duas atenções bloqueantes, RESOLVIDAS na spec

### 3.1 SH-F.3, muda semântica de LEITURA (decisão de produto ratificada)

- **Comportamento aceito e declarado:** a "Média da organização" pode ficar defasada em até **60s** (TTL). Staleness intencional, com TETO verificável. O @po fixou 60s como **decisão de produto** (constante nomeada `ORG_REFERENCE_TTL_MS`, troca de 1 linha se mudar).
- **O aluno é SEMPRE fresco:** exigido por AC3, provado por AC6 (dois `studentId` no mesmo tenant → `student` diferente, `orgBlock` idêntico) e **endurecido pelo @po** com prova de CHAVE: o `Map` é keyed só por `tenantId` e guarda só `OrgReference`, grep confirma ausência de `studentId` no cache. Aluno cacheado = bug de reprovação.
- **Staleness tem teto provado:** AC4 exige recarga após avançar `now` além do TTL. A defasagem nunca excede 60s.

### 3.2 SH-F.4, ESCREVE no banco (guardas como gates bloqueantes)

- **Guardas elevadas de "desejáveis" a GATES DE ACEITE:** falha de qualquer guarda = reprovação automática do review.
- **Ordem cravada:** id hardcoded `1111...` → `SELECT slug` runtime (`=== "demo"`) → recusa de host de prod, TODAS antes da 1ª escrita. O revisor aponta a linha da primeira escrita e prova que as 3 guardas estão acima.
- **Recusa de prod concretizada** (o @po tirou a moleza do "documentado no cabeçalho"): opt-in explícito `ALLOW_DEMO_SEED=1` + denylist de host de prod, implementados, não só descritos. Slug runtime é a rede final baseada em dado do tenant.
- **Idempotência provada por contagem:** 2 runs = contagem idêntica do conjunto demo-recente.

## 4. Dependência real e ordem

```
SH-F.1 (poda .tsx)  ─┐
SH-F.2 (config)      ├─ Par A (mesmo par: F.1 mexe no conjunto de testes, F.2 em como rodam)
SH-F.3 (cache org) ──── Par B (isolado, muda leitura)
SH-F.4 (seed demo) ──── Par C (isolado, escreve no banco demo)
```

- **File-disjunção é invariante** (matriz epic §7): nenhum arquivo tem dois donos. Os 3 pares rodam em paralelo.
- **Único ponto de coordenação:** o baseline de estabilidade de SH-F.2. F.1 remove 1 componente (sem teste próprio → não muda a contagem de testes) e F.3 ADICIONA 1 teste novo (que deve passar). Por isso **SH-F.2 é re-verificada na integração final**, com todas as fatias dentro, para o "3 runs = os 8 pré-existentes" refletir a árvore final.
- **Ordem de merge:** F.1 e F.4 (independentes, baixo risco) → F.3 (cache, revisar leitura) → **F.2 por último / re-verificada na integração**. Regra dura única: F.2 re-verificada após todo merge que adiciona ou remove testes.

## 5. Atribuição dos 3 pares coder-revisor

| Par (coder / revisor) | Story(s) | Arquivos-alvo | Foco do revisor |
|:---|:---|:---|:---|
| **Par A** | **SH-F.1 + SH-F.2** | `student-progress-headline.tsx` (del), `vitest.config.ts` | F.1: grep AC1 = 0 import ANTES de podar; helper+teste intactos; delta-zero de suíte. F.2: baseline de 8 registrado; `testTimeout`+cap de paralelismo; 3 runs iguais; zero arquivo de app tocado. |
| **Par B** | **SH-F.3** | `area-gestor.ts`, `org-reference-cache.ts` (novo) + teste | Chave do cache só `tenantId` (grep sem `studentId`); `db` fake prova 0 scans no 2º req + recarga pós-TTL + número idêntico + 2 alunos; módulo verde sem alterar asserção; TTL=60s nomeado. **Veto se o aluno vazar para o cache.** |
| **Par C** | **SH-F.4** | `seed-student-home-demo.ts` (novo) | Guardas ANTES da 1ª escrita (aponta a linha); não-demo/sem opt-in aborta com zero escrita (contagem); 2 runs = contagem idêntica; home do aluno demo viva. **Veto se qualquer guarda falhar.** |

Atribuição dos pares nomeados fica a cargo do Capataz (na wave anterior: Bigorna/Crivo, Malho/Lupa, Solda/Esquadro). SH-F.1+F.2 juntas exigem 1 par; F.3 e F.4 um par cada. O par que liberar primeiro pode absorver a re-verificação de integração de F.2.

## 6. Nota de consistência (não bloqueante)

O EPIC-STUDENT-HOME-FINALIZACAO §6 (Critérios de Sucesso) ainda usa `pnpm --filter web ...` em alguns comandos, enquanto as stories e este index usam o filtro correto **`@eximia/web`** (confirmado em `apps/web/package.json`). As stories são autoritativas (epic §9). Recomendo ao @pm alinhar o §6 do epic para `@eximia/web` numa próxima passagem, para o comando do epic não falhar se copiado ao pé da letra.

## 7. Portão de saída (o Capataz pode decompor e dispatchar)

- [x] 4 stories com ACs verificáveis (Given/When/Then + comandos exatos) anexadas.
- [x] Veredito PO por story (4/4 GO).
- [x] Atenção SH-F.3 (leitura) resolvida: decisão de produto ratificada, TTL=60s fixado, aluno-não-cacheado provado por chave.
- [x] Atenção SH-F.4 (escrita) resolvida: guardas viram gates bloqueantes, recusa de prod concretizada (opt-in + denylist), idempotência por contagem.
- [x] File-disjunção + ordem de merge + re-verificação de F.2 na integração cravadas.
- [x] Atribuição dos 3 pares + poder de veto de B e C.

**Liberação:** os 3 pares podem começar em paralelo AGORA. F.2 re-verificada por último na integração. Só código aditivo (F.1 é subtração de 1 órfão comprovado); nenhum push/PR/deploy (exclusivo @devops).

---

## Change Log

| Data | Mudança | Autor |
|:---|:---|:---|
| 2026-07-12 | Index de finalização criado: 4/4 GO, 2 atenções bloqueantes resolvidas na spec, atribuição dos 3 pares. ACs fortalecidas nos 4 `.story.md`. | Contrato (@po) |
| 2026-07-12 | **SH-F.4 fechada como PASS-COM-WAIVER** (Par C: Solda/Esquadro). Guardas demo-only provadas adversarialmente (offline 3 aborts exit 1 + AC6-live zero-write por contagem 319/51/207). **AC4/AC5-live DISPENSADOS por waiver formal do Maestro** (tenant demo `1111` inexistente no Cloud v2 + HOLD de escrita de seed até GO do Hugo); live-run deferido como follow-up (inclui esclarecer qual ambiente demo é o canônico). Ferramenta commitada na worktree, sem push, nenhuma escrita em banco. | Solda (@dev) / Maestro (waiver) |
