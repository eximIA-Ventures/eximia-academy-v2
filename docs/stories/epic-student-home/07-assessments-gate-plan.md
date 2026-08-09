# SH-F.7 — Gate LGPD do `assessments.results` (correção curta, ANEXA à finalização SH-F)

> **Autor:** Vitruvio (Planejador) · **Data:** 2026-07-13
> **NÃO é epic novo.** Anexa à epic de finalização **SH-F** existente, próximo id **SH-F.7**.
> **Fase:** DOCS ONLY. Corrente: Vitruvio → Saga → Roteiro → Contrato → Capataz (Malho implementa, Lupa verifica).
> **Base:** worktree `integration/main-x-engagement`, HEAD `7416995`. main intocada em `52a54f5`. ZERO push.

## 0. O gap (2º canal de exposição, sinalizado pela Lupa)

Arquivo: `apps/web/src/app/(platform)/analytics/students/[studentId]/page.tsx`.

O gate de LGPD aprovado é por **PAPEL PRIMÁRIO** (linhas 26-27):
```
const canSeeRawContent =
  profile.role === "instructor" || profile.role === "admin" || profile.role === "super_admin"
```
Chat e reflexões JÁ estão gated por ele:
- `messages: canSeeRawContent ? (messagesBySession.get(s.id) ?? []) : []` (linha 277)
- `chapterReflections: !canSeeRawContent ? [] : [...]` (linha 287)

**MAS `assessments.results` NÃO está gated** (linhas 346-350):
```
assessments: (assessments ?? []).map((a) => ({
  type: a.assessment_type,
  results: a.results,        // ← passado inteiro, SEM gate
  createdAt: a.created_at,
})),
```
`assessment_history.results` é JSON opaco por `assessment_type` e **PODE conter texto livre do aluno**. Hoje ele chega ao payload de leader/manager primário sem restrição, inconsistente com a política de LGPD que o Hugo acabou de cravar.

## 1. A correção (curta, um campo, padrão já estabelecido)

Aplicar o **MESMO `canSeeRawContent`** ao `results`, exatamente como messages/reflections já fazem (fail-closed):

```
results: canSeeRawContent ? a.results : null,
```

**Por que `null` (fail-closed) é o default recomendado:** `results` é um JSON opaco cujo schema varia por `assessment_type` e NÃO está enumerado aqui. Sem um schema por-tipo que garanta quais chaves são estruturadas (score/enum) vs texto livre, a ÚNICA forma de garantir objetivamente "nenhum texto livre alcança manager/leader" é não enviar `results` quando `!canSeeRawContent`. É idêntico ao padrão já aprovado (messages → `[]`, reflections → `[]`).

**Agregados/scores estruturados (opção, só se produto pedir):** se o manager PRECISA ver scores estruturados, isso exige um **allowlist por `assessment_type`** (projeção que mantém só campos numéricos/enum conhecidos, some com o texto livre). Isso depende de conhecer os schemas de `results` por tipo, então fica como **follow-up explícito**, fora do escopo desta correção curta, a menos que o Contrato/Hugo especifique os campos estruturados a preservar. O default desta story é fail-closed (`null`).

## 2. Arquivos e blast radius

- `apps/web/src/app/(platform)/analytics/students/[studentId]/page.tsx` — 1 linha (o `results:` do map de assessments).
- **Verificar** que `StudentFullProfile` (`./_components/student-full-profile.tsx`) tolera `results: null` sem crash no ramo manager/leader (renderiza vazio/agregado, não quebra). Se hoje assume `results` sempre presente, adicionar guard de null (aditivo).
- Nada mais toca: o gate `canSeeRawContent` já existe e já é usado; esta story só ESTENDE seu alcance a mais um campo. Zero mudança de contrato/tipo obrigatória (o campo já é opcional no consumo).

## 3. Critério de saída (AC objetivo, espelha a ordem do Hugo)

- **(a)** manager primário **COM chapéu instructor** → `assessments.results` **SEM texto livre** (o gate é `profile.role`, não a união; manager primário → `canSeeRawContent=false` → `results: null`).
- **(b)** instructor/admin/super_admin primário → `results` COMPLETO.
- **(c)** leader/manager puro primário → `results` SEM texto livre.
- **(d)** build de produção verde (`next build`, 116/116 páginas, exit 0).
- **(e)** zero regressão: suíte delta ZERO vs baseline (8 falhas web / 31 repo), typecheck 0.

## 4. Comandos de verificação (Lupa roda, reproduz as provas, não confia no resumo)

- `pnpm --filter web build` → verde, 116/116, exit 0.
- Teste do gate ESTENDIDO cobrindo `assessments.results`: texto livre **NEGADO** a manager/leader primário (mesmo com chapéu instructor); **PERMITIDO** a instructor/admin/super_admin primário. (Espelhar o teste já existente do gate de messages/reflections, adicionando o eixo assessments.)
- Suíte delta ZERO vs baseline; `pnpm --filter web typecheck` → 0.
- `grep`: nenhum texto livre de `results` no payload quando `canSeeRawContent=false` (com `results: null`, a asserção é `results === null` no ramo negado).

## 5. Guardrails

- Trabalhar na worktree `integration/main-x-engagement` (HEAD `7416995`), **NÃO** na main.
- **ZERO push.** main (`52a54f5`) e deploy/cory intocadas.
- Quando a Lupa aprovar + build verde, o Capataz sinaliza **"ASSESSMENTS GATE RESOLVIDO E APROVADO"** para o J.A.R.V.I.S. acionar o @devops.

## 6. Auto-checagem deste plano
- [x] Aponta o gap real (linhas 346-350, `results` ungated) e o gate existente (26-27, primário).
- [x] Correção = mesmo `canSeeRawContent`, fail-closed (`null`), consistente com messages/reflections.
- [x] AC (a)-(e) objetivos; comandos de verificação da Lupa; guardrails (zero push, main intocada).
- [x] Anexa a SH-F como SH-F.7, não cria epic novo.

**Path:** `/Users/hugocapitelli/Dev/eximia/eximia-academy-v2/docs/stories/epic-student-home/07-assessments-gate-plan.md`
