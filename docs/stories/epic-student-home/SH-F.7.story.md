# SH-F.7: Gate LGPD do `assessments.results` (2º canal de exposição, fail-closed)

**Epic:** [EPIC-STUDENT-HOME-FINALIZACAO](./EPIC-STUDENT-HOME-FINALIZACAO.md)
**Status:** Draft
**Insumo obrigatório:** **`07-assessments-gate-plan.md` (plano-fonte, ler inteiro)**. Constitution Art. IV, nada fora do plano.
**Executores:** **Malho** (implementa a correção) + **Lupa** (verifica). Malho não é @devops, NÃO pusha.
**Depende de:** SH-F.6, o gate `canSeeRawContent` (papel primário) foi implementado e aprovado pela Lupa ali. Esta story só ESTENDE o alcance dele a mais um campo.
**Bloqueia:** o deploy de prod do Argos até o gate cobrir também `assessments.results` (2º canal de vazamento sinalizado pela Lupa). @devops retoma o deploy depois, com o GO.
**Paralelizável:** NÃO (mesma linha de 1 arquivo do gate LGPD de SH-F.6).
**Base:** worktree `integration/main-x-engagement` (HEAD `7416995`), NÃO a main. main intocada em `52a54f5`. ZERO push.

---

## Story

**As a** responsável pela conformidade LGPD da página de detalhe do aluno,
**I want** estender o gate `canSeeRawContent` já aprovado (SH-F.6) ao campo `assessments.results`, que hoje é passado inteiro sem restrição, aplicando o mesmo fail-closed (`null` quando negado) que `messages` e `chapterReflections` já usam,
**so that** nenhum texto livre do aluno contido em `results` chegue a leader/manager primário, fechando o 2º canal de exposição sinalizado pela Lupa, de forma consistente com a política de LGPD que o Hugo acabou de cravar.

## Contexto (Dev Notes)

Verificado read-only na worktree `/Users/hugocapitelli/Dev/eximia/integration-worktree` (branch `integration/main-x-engagement`, HEAD `7416995`), arquivo `apps/web/src/app/(platform)/analytics/students/[studentId]/page.tsx`:

- **Gate existente (papel PRIMÁRIO), aprovado em SH-F.6, linha 26:**
  ```
  const canSeeRawContent =
    profile.role === "instructor" || profile.role === "admin" || profile.role === "super_admin"
  ```
  O gate é sobre `profile.role` (papel primário), NÃO sobre a união de chapéus, então um manager primário com chapéu instructor tem `canSeeRawContent = false`.
- **Dois canais JÁ gated por ele:**
  - `messages: canSeeRawContent ? (messagesBySession.get(s.id) ?? []) : []` (linha 277).
  - `chapterReflections: !canSeeRawContent ? [] : [...]` (linha 287).
- **O gap, `assessments.results` NÃO está gated** (map de assessments, linhas ~347-349):
  ```
  type: a.assessment_type,          // 347
  results: a.results,               // 348  ← passado inteiro, SEM gate
  createdAt: a.created_at,          // 349
  ```
  A origem é `.select("id, assessment_type, results, created_at")` (linha 104). `assessment_history.results` é JSON opaco por `assessment_type` e **PODE conter texto livre do aluno**. Hoje ele chega ao payload de leader/manager primário sem restrição.
- **Consumo, `StudentFullProfile`** (`./_components/student-full-profile.tsx`): o tipo declara `assessments: Array<{ type: string; results: unknown; createdAt: string }>` (linha 70), e o render do card de assessments (linhas 646-657) usa **apenas `a.type` e `a.createdAt`, NUNCA dereferencia `a.results`**. Logo `results: null` já é tolerado sem crash, e `null` é atribuível a `unknown` (typecheck limpo). O guard de null é confirmação defensiva, não mudança forçada (ver AC5/Dev Notes).

## A correção (1 campo, padrão já estabelecido)

Aplicar o MESMO `canSeeRawContent` ao `results`, fail-closed, idêntico a messages/reflections:

```
results: canSeeRawContent ? a.results : null,
```

**Por que `null` (fail-closed) é o default:** `results` é JSON opaco cujo schema varia por `assessment_type` e não está enumerado aqui. Sem um schema por-tipo que separe campos estruturados (score/enum) de texto livre, a única forma objetiva de garantir "nenhum texto livre alcança manager/leader" é não enviar `results` quando `!canSeeRawContent`. Idêntico ao padrão aprovado (messages → `[]`, reflections → `[]`).

## Acceptance Criteria

- [ ] **AC1 (manager primário COM chapéu instructor → sem texto livre):** para um usuário com `profile.role="manager"` (mesmo que tenha chapéu instructor na união), `assessments.results` sai `null` (o gate é `profile.role`, não a união → `canSeeRawContent=false`).
- [ ] **AC2 (instructor/admin/super_admin primário → completo):** para `profile.role` ∈ {`instructor`,`admin`,`super_admin`}, `assessments.results` sai COMPLETO (`a.results`).
- [ ] **AC3 (leader/manager puro primário → sem texto livre):** para `profile.role` ∈ {`leader`,`manager`} puro, `assessments.results` sai `null`.
- [ ] **AC4 (build de produção verde):** `pnpm --filter @eximia/web build` termina VERDE, 116/116 páginas, exit 0.
- [ ] **AC5 (consumo tolera null, guard confirmado):** `StudentFullProfile` renderiza o card de assessments com `results: null` sem crash no ramo manager/leader. Confirmado read-only que o render atual só usa `a.type`/`a.createdAt`; se algum caminho passar a dereferenciar `a.results` assumindo presença, adicionar guard de null (aditivo). `pnpm --filter @eximia/web typecheck` → 0.
- [ ] **AC6 (zero regressão + teste do gate ESTENDIDO):** a suíte tem delta ZERO vs baseline (8 falhas web / 31 repo); e o teste existente do gate de `messages`/`reflections` é ESTENDIDO para cobrir o eixo `assessments.results` (texto livre NEGADO a manager/leader primário mesmo com chapéu instructor; PERMITIDO a instructor/admin/super_admin primário). No ramo negado, a asserção é `results === null`.

## Tasks

- [ ] 1. First-move (correção sensível a regressão): rodar a suíte e registrar o baseline (8 falhas web / 31 repo) antes de editar.
- [ ] 2. **Malho:** em `page.tsx` (linha ~348), trocar `results: a.results,` por `results: canSeeRawContent ? a.results : null,`.
- [ ] 3. **Malho:** confirmar que `StudentFullProfile` tolera `results: null` (read-only mostra que só usa `type`/`createdAt`); adicionar guard de null SOMENTE se algum caminho dereferencia `a.results` assumindo presença.
- [ ] 4. **Malho/Lupa:** estender o teste do gate (o que já cobre messages/reflections) com o eixo `assessments.results`: NEGADO a manager/leader primário (mesmo com chapéu instructor), PERMITIDO a instructor/admin/super_admin primário; ramo negado assere `results === null`.
- [ ] 5. **Lupa:** `pnpm --filter @eximia/web build` verde (116/116, exit 0); `pnpm --filter @eximia/web typecheck` → 0; suíte delta ZERO vs baseline. Reportar PRONTO.
- [ ] 6. **ZERO push.** Reportar ao Maestro; o @devops retoma o deploy com o GO.

## Complexidade & Riscos

- **Complexidade:** XS (extra small). Uma linha de gate + confirmação de tolerância a null + extensão de um teste existente.
- **Riscos:**
  - R1 (ALTO se não corrigido): texto livre do aluno em `results` vaza para leader/manager, inconsistente com a política LGPD cravada. Mitigação: a própria correção (fail-closed `null`) + AC1/AC3 + teste estendido.
  - R2 (baixo): consumo assumir `results` presente e quebrar com `null`. Mitigação: verificado read-only que o render só usa `type`/`createdAt`; AC5 exige guard só se algum caminho dereferenciar `results`.
  - R3 (baixo): regressão na suíte. Mitigação: AC6 delta ZERO vs baseline + typecheck 0.

## Dev Notes

- **Natureza: ADITIVO / fail-closed.** Estende um gate já existente e aprovado a mais um campo; nenhum contrato/tipo obrigatório muda (`results` já é consumido como opcional/`unknown`). Não é breaking.
- **File-disjunto do resto do epic:** toca só `page.tsx` (1 linha) e, se necessário, um guard aditivo em `student-full-profile.tsx`. Não toca nenhuma outra fatia SH-F.
- **Consistência de política:** o gate é por PAPEL PRIMÁRIO (`profile.role`), deliberadamente diferente da união de chapéus, exatamente como SH-F.6 aprovou. Um manager+instructor primário=manager → negado (fail-closed). Não reabrir essa decisão aqui.
- **FOLLOW-UP FORA DE ESCOPO (só flag ao Contrato/@po):** se o produto quiser que manager/leader vejam SCORES ESTRUTURADOS de assessment (não texto livre), isso exige um **allowlist por `assessment_type`** (projeção que preserva só campos numéricos/enum conhecidos e descarta texto livre), o que depende de enumerar os schemas de `results` por tipo. Vira story NOVA só se Contrato/Hugo especificar os campos estruturados a preservar. O default desta story é fail-closed (`null`).
- **Filtro pnpm real = `@eximia/web`** (o plano §4 escreve `pnpm --filter web`; o filtro correto do repo é `@eximia/web`, reconfirmado pelo @sm nas stories irmãs).

## Testing

```bash
cd /Users/hugocapitelli/Dev/eximia/integration-worktree
git rev-parse --short HEAD                        # deve ser 7416995 (integration/main-x-engagement)
pnpm --filter @eximia/web test                    # baseline ANTES (8 falhas web / 31 repo)
# ... Malho aplica results: canSeeRawContent ? a.results : null; estende o teste do gate ...
pnpm --filter @eximia/web test                    # AC6: delta ZERO vs baseline + teste do gate estendido verde
pnpm --filter @eximia/web typecheck               # AC5: 0
pnpm --filter @eximia/web build                   # AC4: verde, 116/116, exit 0
# prova do ramo negado (results === null quando canSeeRawContent=false):
grep -n "results: canSeeRawContent ? a.results : null" "apps/web/src/app/(platform)/analytics/students/[studentId]/page.tsx"
# ZERO push em qualquer momento; main permanece 52a54f5.
```

## Change Log

| Data | Mudança | Autor |
|------|---------|-------|
| 2026-07-13 | Story criada a partir de `07-assessments-gate-plan.md` (anexa à finalização SH-F como SH-F.7, não é epic novo). Anchors reconferidos read-only na worktree `integration/main-x-engagement` (HEAD `7416995`): gate `canSeeRawContent`@26, `messages`@277, `chapterReflections`@287, `results: a.results` ungated@348, `.select(... results ...)`@104, consumo em `student-full-profile.tsx` só usa `type`/`createdAt` (results `null` já tolerado). Correção = mesmo gate fail-closed (`null`), AC (a)-(e) espelhando o plano + teste do gate estendido. Follow-up de allowlist por `assessment_type` sinalizado fora de escopo. Filtro pnpm real `@eximia/web`. | Roteiro (@sm) |
| 2026-07-13 | Validação PO: anchors + tolerância a null reconfirmados read-only; confirmado que o gate é PAPEL PRIMÁRIO (decisão 2a do Hugo aterrissou); AC5 virou prova (consumidor nunca dereferencia results); varredura de completude por 3º canal (item novo da Lupa). Veredito GO. | Contrato (@po) |

---

## PO Validation & Critérios Fortalecidos (@po)

> **Veredito: GO (9,5/10).** Correção XS, fail-closed, um campo, consistente com a política LGPD que o Hugo cravou. Reconfirmei tudo READ-ONLY na worktree de integração. Três fortalecimentos: (1) provo que o gate já é papel-primário (a decisão 2a aterrissou), (2) transformo a AC5 de "adicionar guard se necessário" em prova de que o guard é desnecessário, (3) adiciono uma varredura de COMPLETUDE (há um 3º canal?) para "consertamos o que a Lupa achou" não virar "LGPD fechado".

### Fatos reconfirmados pelo @po, READ-ONLY (worktree `/integration-worktree`, HEAD `7416995`)

- Branch `integration/main-x-engagement` @ `7416995`; **main intocada em `52a54f5`**.
- **O gate JÁ é PAPEL PRIMÁRIO (a decisão 2a do Hugo aterrissou):** linha 27 `profile.role === "instructor" || profile.role === "admin" || profile.role === "super_admin"`. NÃO é mais a união `roles`. Isto confirma, no código, que a escolha do Hugo em SH-F.6 (2a, mais protetor: manager/leader primário nunca vê verbatim, mesmo com chapéu instructor) foi implementada. Esta story herda e estende esse gate, coerente.
- **Canais já gated:** `messages`@277 (`canSeeRawContent ? ... : []`), `chapterReflections`@287 (`!canSeeRawContent ? [] : [...]`).
- **O gap confirmado:** `results: a.results`@348, sem gate; origem `.select("id, assessment_type, results, created_at")`@104.
- **Consumidor tolera null, PROVADO:** `student-full-profile.tsx:70` declara `results: unknown`; o render usa só `a.type`@652 e `a.createdAt`@655, **nunca dereferencia `a.results`**. Logo `results: null` é seguro (null é atribuível a `unknown`, typecheck limpo) e o guard de null é confirmação defensiva, não mudança forçada.

### AC5 endurecida (de "talvez guard" para PROVA)

A story dizia "adicionar guard de null SOMENTE se algum caminho dereferencia `a.results`". O @po já verificou read-only que NENHUM caminho o dereferencia (render só usa `type`/`createdAt`). Então AC5 vira uma prova positiva:
- *Given* o consumidor `student-full-profile.tsx`; *When* `grep -nE "\.results" apps/web/src/.../student-full-profile.tsx`; *Then* zero dereferência de `a.results` no render (o campo é declarado `unknown` mas não lido). Guard de null confirmado desnecessário, `results: null` é seguro por construção. Nenhum guard é obrigatório; se o Malho adicionar um por defesa, é aditivo e inofensivo.

### AC6, asserção do teste exata

O teste estendido deve espelhar o eixo messages/reflections com asserções literais:
- ramo NEGADO (`profile.role` ∈ {leader, manager}, mesmo com chapéu instructor na união): `expect(payload.assessments.every(a => a.results === null)).toBe(true)`.
- ramo PERMITIDO (`profile.role` ∈ {instructor, admin, super_admin}): `results` presente (=== `a.results` de origem, não null quando a origem tem valor).

### Completude LGPD, o 3º canal (item NOVO do @po para a Lupa)

O @po não deixa "fechamos o canal que a Lupa achou" ser lido como "LGPD totalmente fechada". Varri o payload (linhas ~260-360) e os canais de texto livre são: `messages` (gated), `chapterReflections` (gated), `assessments.results` (este fix). `gamification`/agregados são estruturados. **Não achei um 3º canal óbvio**, mas varri UMA janela, não o arquivo inteiro. Portanto, item de checklist para a Lupa:
- **(f, novo) Varredura de completude:** confirmar que NENHUM outro campo do payload entregue ao ramo `!canSeeRawContent` carrega texto livre do aluno (varrer o objeto retornado por inteiro, não só `results`). Se achar um 4º canal, é achado novo (não bloqueia esta story, gera follow-up). Isto impede a falsa sensação de "tudo gated" após corrigir só o 2º canal.

### Comandos de Verificação (exatos)

```bash
cd /Users/hugocapitelli/Dev/eximia/integration-worktree
git rev-parse --short HEAD                          # 7416995
F="apps/web/src/app/(platform)/analytics/students/[studentId]/page.tsx"
grep -n "results: canSeeRawContent ? a.results : null" "$F"   # correção aplicada
grep -nE "\.results" "apps/web/src/app/(platform)/analytics/students/[studentId]/_components/student-full-profile.tsx"  # AC5: consumidor não dereferencia
pnpm --filter @eximia/web test                      # AC6: baseline ANTES / delta ZERO depois + teste do gate estendido (eixo assessments)
pnpm --filter @eximia/web typecheck                 # 0
pnpm --filter @eximia/web build                     # AC4: verde, 116/116, exit 0
# ZERO push; main permanece 52a54f5.
```

### Critério de PRONTO (a Lupa usa, com poder de veto)

`results: canSeeRawContent ? a.results : null` aplicado na linha ~348; gate herdado é papel-primário (não reabrir); teste do gate estendido ao eixo `assessments` com asserção `results === null` no ramo negado e presente no permitido; consumidor não dereferencia `a.results` (guard confirmado desnecessário); varredura de completude (f) sem 3º canal de texto livre no ramo negado; `typecheck` 0; suíte delta ZERO vs baseline (8 web/31 repo); `build` verde 116/116 exit 0. Worktree de integração, ZERO push, main `52a54f5` intocada.

### Flag de follow-up (ratificada FORA de escopo)

Allowlist de scores estruturados por `assessment_type` (deixar manager/leader ver score numérico/enum sem o texto livre) é **story NOVA, só se o Hugo/Contrato especificar os campos estruturados a preservar por tipo**. O default desta story é fail-closed (`null`), correto. Não bloqueia.

### Placar 10 pontos PO

1. Objetivo/contexto: 1 · 2. ACs testáveis: 1 · 3. Precisão técnica (anchors + gate primário read-only): 1 · 4. Rastreabilidade (plano §0-§3): 1 · 5. Autossuficiência: 1 · 6. Dependências (herda gate de F.6): 1 · 7. Escopo (1 campo, follow-up deferido): 1 · 8. Teste runnable (asserção exata + build): 1 · 9. Riscos+mitigação (AC5 provada): 0,5 · 10. Completude LGPD (varredura do 3º canal adicionada): 0,5. **Total: 9,5 → GO.**
