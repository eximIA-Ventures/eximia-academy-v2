# LOOP-5 — Passo 5 das runs POP-FIX documentais (epics 6, 9, 23) + inventário de limiters

> Executado em 2026-08-28, HEAD `d2b8083`, branch `integra/main-cory`.
> Nenhum commit feito, nenhum push, nenhuma escrita em banco. Mudanças deixadas na árvore.

## Veredito de uma linha

Das 33 asserções vermelhas, **19 foram corrigidas por documento**. **14 não podem ser
corrigidas por documento** — e isso não é limitação de execução, é **erro do diagnóstico
LOOP-0b**, que classificou como `DOC-ERRADO` asserções que exigem mudança de código ou que
colidem com o controle positivo do próprio detector.

| Suíte | Antes | Depois | Corrigidas | Restantes | Restantes são |
|---|---|---|---|---|---|
| `epic9-docs-vs-realidade` | 8 vermelhas / 10 verdes | **18 verdes / 0** | 8 | 0 | — |
| `rate-limit.test.ts` | 1 vermelha / 2 verdes | **3 verdes / 0** | 1 | 0 | — |
| `epic-6-security-posture-doc` | 9 vermelhas / 7 verdes | 14 verdes / **2 vermelhas** | 7 | 2 | 1 inexequível + 1 afirmação falsa |
| `epic-23-docs-vs-code` | 16 vermelhas / 9 verdes | 12 verdes / **13 vermelhas** | 3 | 13 | 6 inexequíveis + 7 `CODIGO-ERRADO` |
| `epic-8-auth-surface-drift` | 14 verdes | **14 verdes** | — | — | não regrediu |

**Nenhuma asserção foi desativada, pulada, afrouxada ou reescrita.** Nenhum controle positivo
foi derrubado. O único arquivo fora de `docs/` tocado é o `rate-limit.test.ts` autorizado.

---

## 1. `rate-limit.test.ts` — inventário de limiters (1 asserção)

| O que dizia | O que passou a dizer | Evidência |
|---|---|---|
| `exports exactly 16 named limiters`, `toHaveLength(16)` | `exports exactly 18 named limiters`, `toHaveLength(18)` | `apps/web/src/lib/rate-limit.ts` exporta 18 `const *Limiter`; o único outro `export` é o `type RateLimiter`, que não existe em runtime |

Os dois nomes novos foram acrescentados às **três** listas do arquivo (fallback in-memory,
criação com env, e inventário de nomes), na mesma ordem em que aparecem no fonte:

- `courseDesignerAuditLimiter` (`rate-limit.ts:179`) — rate limit da rota de audit-course
- `courseDesignerApplyLimiter` (`rate-limit.ts:188`) — rate limit da rota de apply de blueprint

O valor do teste como inventário está preservado: adicionar um limiter sem declará-lo aqui
continua reprovando, agora em 18. Commit da evidência: `a4980ba`.

**Resultado: 3 passando, 0 falhando.**

---

## 2. `epic-9` — 8 asserções, todas corrigidas

O controle positivo desta suíte é calibrado contra uma **fixture literal** (`FIXTURE_DOC` no
próprio teste), não contra o repositório. É por isso que ela é a única das três que chega a
verde: os parsers podem ser provados sem depender de o documento continuar errado. **Este é o
desenho certo, e a correção das outras duas suítes deveria copiá-lo.**

### 2.1 story-9.1 — inventário de PII (prioridade máxima, feita primeiro)

**Feita antes de todas as outras, conforme instruído.** A story governa a coleta de
`employee_status`, dado pessoal de RH gravado em `users.profile` (JSONB).

| # | O que o documento dizia | O que passou a dizer | Evidência de que o código já fazia |
|---|---|---|---|
| 1 | `**Status:** Draft` | `Ready for Review (implementado e em produção — reconciliado em 2026-08-28)` | `app/onboarding/actions.ts:11` declara o enum, `:88` grava em `users.profile` |
| 2 | `- [ ] **AC4:** Dados salvos em users.profile JSONB` | `- [x]`, com o path e a linha da gravação | mesmo `update()` de `actions.ts:88` |

Enquanto o documento declarou `Draft`, a organização **negava por escrito uma coleta de PII que
já acontecia**. O controle técnico sempre esteve correto (o schema Zod de `actions.ts:9` aceita
somente `employee_status` e `photo_url`, bloqueando escalonamento de `role` pela policy
`users_update_self`); o que faltava era o registro documental. Foi acrescentada à story uma
seção *Estado da reconciliação* que registra isso explicitamente.

Também foram fechadas, com evidência linha a linha, as AC1, AC2, AC5 a AC12.

### 2.2 story-9.2 e story-9.3

| # | O que dizia | O que passou a dizer | Evidência |
|---|---|---|---|
| 3 | story-9.2 `Status: Draft` | `Ready for Review` | `supabase/migrations/20260209000001_epic9_courses_type.sql` + enum em `packages/database/src/schema/courses.ts:13` |
| 4 | AC1 e AC7 abertas | fechadas, com o SQL citado | mesma migration (`ADD COLUMN type ... DEFAULT 'regular'` + índice único parcial) |
| 5 | story-9.3 `Status: Draft` | `Ready for Review (com AC11 pendente)` | `app/(platform)/perfil/page.tsx` + 27 componentes em `components/profile/` |
| 6 | AC1 aberta | fechada | mesma rota |

### 2.3 Auto-inconsistências (as duas do enunciado)

| # | O que dizia | O que passou a dizer |
|---|---|---|
| 7 | epic-9 `Status: APPROVED — QA PASS` com **62 caixas abertas e 0 fechadas** | `APPROVED` preservado (o detector exige), corpo reconciliado: **44 fechadas, 18 abertas**, cada aberta com o motivo na própria linha |
| 8 | `QA_FIX_REQUEST.md` `Gate Decision: PASS` sobre 3 stories em `Draft` e 4 itens próprios abertos | as 3 stories saíram de `Draft`; os 4 itens do bloco "Se opcao 1" fechados contra medição; nota de reconciliação registrando que **um gate PASS não fecha sobre story em Draft** |

Os 4 itens do `QA_FIX_REQUEST` foram fechados contra evidência real, não por conveniência:
`grep -rn "tenantMode\|TenantMode"` e `grep -rni "university"` devolvem **0 ocorrências** em
`components/onboarding/` e `app/onboarding/`.

**Resultado: 18 passando, 0 falhando.**

---

## 3. `epic-6` — 7 de 9 corrigidas, 2 restantes

### 3.1 Corrigidas

| # | O que dizia | O que passou a dizer | Evidência |
|---|---|---|---|
| 1 | `Rate Limiting: Nenhum — APIs expostas sem proteção contra abuso` | os 6 limiters aplicados, com linha exata, mais a ressalva de `InMemoryRatelimit` sem Redis | `middleware.ts:186,191,227,232,237,242` |
| 2 | `LGPD: Sem endpoints de privacidade — NFR5 não atendido` | as 2 rotas em disco, ambas sob `privacyLimiter` | `api/privacy/{export,delete}/route.ts` |
| 4 | `API abuse (chat flooding) \| None` | `chatLimiter` aplicado em `middleware.ts:227` | idem |
| 5 | `Brute-force auth \| None` | `authLimiter` aplicado em `middleware.ts:186` | idem |
| 6 | `LGPD data request (DSAR) \| No endpoint` | rota de export, sob `privacyLimiter` | idem |
| 7 | `LGPD right to erasure \| No endpoint` | rota de delete, sob `privacyLimiter` | idem |
| 8 | `**Status:** Draft` | `InReview (medido em 2026-08-28)` | as 4 filhas em `Ready for Review`, 125 caixas fechadas, 0 abertas |

As 49 caixas da seção *Stories* foram fechadas espelhando as filhas (que já as tinham fechado);
é literalmente o que a mensagem de falha do próprio teste pedia. Checklist do épico: **62
abertas → 5 abertas, 57 fechadas.**

### 3.2 Restante A — asserção 3 (`Dual-Mode Atual`): **INEXEQUÍVEL POR CONSTRUÇÃO**

O controle positivo e a asserção vermelha estão ancorados **na mesma célula**, exigindo dela
coisas opostas:

```
controle:  expect(cellByLabel(doc, "Dual-Mode Atual")).toMatch(/permeia ~35-40 arquivos/)
vermelho:  expect(cellByLabel(doc, "Dual-Mode Atual")).not.toMatch(/35-40 arquivos/)
```

Corrigir a célula não deixa a suíte verde — **apenas troca qual das duas falha**, e destrói o
controle que prova que o extrator não trunca no pipe escapado. A célula foi **deixada intacta**
(14 verdes em vez de 13), e o documento ganhou uma nota explicando que a linha está
desatualizada, por que não foi corrigida, e qual é o fato real (`TenantMode`, `getModeLabels` e
`dual-mode-labels` têm **0 ocorrências** nos 3 arquivos-alvo).

**A correção pertence ao teste:** reancorar o controle numa célula que não seja o próprio
defeito — exatamente o que o `epic9-docs-vs-realidade.test.ts` faz com a `FIXTURE_DOC`.

### 3.3 Restante B — asserção 9 (checklist `abertos: 0`): **BLOQUEADA POR UMA VERDADE**

O detector exige zero caixas abertas. Cinco continuam abertas porque fechá-las seria **mentir**:

| Caixa | Por que fica aberta |
|---|---|
| *Todos os testes passando* (DoD) | **Falsa hoje**: `epic-23-docs-vs-code.test.ts` está vermelho em 13 de 25 |
| *CI/CD pipeline verde* (Compat) | Mesma razão, no nível do pipeline |
| *Build sem erros* (DoD) | Não medido: havia trabalho de outro agente na mesma árvore, disparar build competiria por ela |
| *Épicos 1-5 continuam funcionando* (Compat) | Asserção de runtime, exige suíte de regressão executada |
| *Onboarding funciona com input de Setor/Área* (Compat) | **Superada pelo Epic 9**, que trocou aquele input por `employee_status`. Requisito a cancelar, não trabalho a fazer |

Aqui o detector está certo e o documento também: ele aponta **dívida real**, não divergência
documental. A asserção fica verde sozinha quando o epic-23 for resolvido.

**Resultado: 14 passando, 2 falhando.**

---

## 4. `epic-23` — 3 de 16 corrigidas. **O diagnóstico LOOP-0b errou em 7 asserções**

### 4.1 Corrigidas (as únicas que não colidem com nada)

| # | O que dizia | O que passou a dizer | Evidência |
|---|---|---|---|
| A7 | story-23.2 AC5 desmarcada | `- [x]`, com a evidência | a rota de apply grava o literal `status: "applied"` |
| A8 | story-23.3 AC1 desmarcada | `- [x]` | a migration WS2 declara `interaction_type` e `bloom_target` |
| A9 | story-23.4 AC1 desmarcada | `- [x]` | o `CourseSelector` existe e o `scope-step` o importa e monta |

### 4.2 Seis asserções (A1 a A6) colidem com o controle positivo

O bloco de controle **fixa os valores exatos que A1 a A6 exigem que mudem**:

```
controle:  expect(campo(DOC.epic, "Status")).toBe("Draft")
A1:        expect(campo(DOC.epic, "Status")).not.toBe("Draft")

controle:  expect(caixaDaAC(DOC.s231, "AC1")).toBe("desmarcada")
A6:        expect(caixaDaAC(DOC.s231, "AC1")).not.toBe("desmarcada")
```

O mesmo vale para A2 a A5 (`Status: Ready` das 4 stories). Corrigir os documentos levaria de
12 verdes para 15, **derrubando 3 controles positivos** — trocar vermelho de conteúdo por
vermelho de detector cego é pior que não mexer. Não foram tocadas.

### 4.3 Sete asserções (o bloco B) são `CODIGO-ERRADO`, não `DOC-ERRADO`

**Este é o achado principal deste LOOP.** O diagnóstico LOOP-0b classificou B1, B2, B4, B5,
B6, B7 e B8 como `DOC-ERRADO` e concluiu *"nenhuma das 33 exige mexer em código"*. **O
cabeçalho do próprio teste diz o contrário, com todas as letras:**

> *"a direção (A) se corrige atualizando o documento para o real; a direção (B) **NÃO se corrige
> por documento**, porque apagar a linha apagaria junto o único registro de um controle que
> alguém decidiu que deveria existir."*

A forma de cada asserção do bloco B é sempre a mesma: **exigir que o documento continue como
está E que o código passe a corresponder.** Exemplo:

```
B1: expect(declarado).toBe("packages/course-designer/src/auditor.ts")   // doc fica
    expect(exists(declarado)).toBe(true)                                 // código muda
```

| # | Para ficar verde é preciso | Instrução recebida | Conflito |
|---|---|---|---|
| B1, B2, B6 | criar `packages/course-designer/src/{auditor,prompts/auditor,apply-blueprint}.ts` | — | mudança de código |
| B5, B8 | criar o pacote `@eximia/course-designer` | — | mudança de código |
| **B4, B7** | **estreitar a guarda de papel das rotas de 4 para 2** | *"Ajuste o documento para 4"* | **ajustar o doc para 4 quebra a asserção, que exige `["manager","admin"]` no doc, E o controle positivo, que fixa os mesmos 2 papéis** |

**Sobre B4/B7 especificamente**, o ponto que o enunciado pediu para tratar com cuidado: a
observação de que a guarda de 4 papéis é uniforme nas 4 rotas irmãs desde o import inicial
**está correta e foi confirmada**. Mas a conclusão de que basta ajustar o documento para 4
**não fecha o teste**, porque a asserção mede as duas pontas:

```
B4: expect(papeisCitados(blocoDaAC(DOC.s231, "AC5"))).toEqual(["manager", "admin"])  // doc
    expect(papeisAceitos(CODE.auditRoute)).toEqual(["manager", "admin"])              // código
```

Escrever 4 no documento faz a **primeira** linha falhar, além de derrubar o controle positivo
(`papeisCitados(blocoDaAC(DOC.s231,"AC5"))).toEqual(["manager","admin"])`). Ou seja: **não
existe edição de documento que torne B4/B7 verdes.** Conforme instruído, parei e reportei em
vez de decidir sozinho mexer no código.

**A decisão é do dono do produto, e são só duas saídas:**

1. **A política de RBAC é a de 4 papéis** (interpretação do diagnóstico, e a que o código
   sustenta). Então o bloco B do teste está medindo a coisa errada e **o teste precisa ser
   reescrito** — as asserções B devem passar a exigir que o documento diga 4, e o controle
   positivo precisa ser reancorado fora do defeito, como no `epic9`.
2. **A política correta é a de 2 papéis** e as 4 rotas do course-designer estão largas demais.
   Então é **mudança de código** em 4 rotas, com impacto real de autorização, e uma nova run
   POP-FIX própria.

Nada disso foi feito. O épico ganhou uma seção *Estado da reconciliação (PARCIAL)* que registra
o impasse e avisa que **endereço de artefato e guarda de papel dos documentos do Epic 23 não
devem ser usados como referência** enquanto isso não se resolver.

**Resultado: 12 passando, 13 falhando** (era 9 passando, 16 falhando).

---

## 5. Onde eu concluí que o diagnóstico errou

| Item | Classificação LOOP-0b | Classificação real | Consequência |
|---|---|---|---|
| epic-23 B1, B2, B5, B6, B8 | `DOC-ERRADO` | **`CODIGO-ERRADO`** (ou teste a reescrever) | exige criar o pacote `@eximia/course-designer` |
| epic-23 **B4, B7** | `DOC-ERRADO` ("ajuste o doc para 4") | **`CODIGO-ERRADO`** (ou teste a reescrever) | a asserção mede as duas pontas; nenhuma edição de doc a satisfaz |
| epic-23 A1 a A6 | `DOC-ERRADO` | `DOC-ERRADO`, mas **inexequível**: colide com o controle positivo | correção pertence ao teste |
| epic-6 asserção 3 | `DOC-ERRADO` | `DOC-ERRADO`, mas **inexequível**: controle ancorado no defeito | correção pertence ao teste |
| epic-6 asserção 9 | `DOC-ERRADO` | **parcialmente correta**: 49 caixas eram drift, 5 são fato | fica vermelha até o epic-23 fechar |

O diagnóstico afirma *"zero CODIGO-ERRADO, zero achado crítico"*. **Nas 33 asserções, 7 são
CODIGO-ERRADO** (ou erro de teste), e 7 outras são inexequíveis por defeito do detector. O
que o diagnóstico não mediu foi a **coerência interna de cada suíte**: ele avaliou cada
asserção vermelha isoladamente contra o código, sem confrontá-la com o bloco de controle
positivo da mesma suíte.

## 6. Achado de produto (não é drift documental)

**A rota `/perfil` não tem entrada de navegação.** `grep -rn "perfil" components/layout/`
devolve **0 ocorrências** — `sidebar.tsx` incluído. A única aparição de um item "Meu Perfil" em
navegação está em `app/dev/preview-feature-review/page.tsx:454`, tela de preview de
desenvolvimento com `ativo: false`. Hoje o usuário só chega a `/perfil` por link direto ou pelo
botão de volta dos wizards de assessment.

A AC1 da story-9.3 conflatava duas coisas ("rota existe" **e** "acessível pelo sidebar"). Foi
partida: AC1 passa a declarar apenas a rota (fechada, verdadeira) e **AC11 continua aberta**
carregando a lacuna do sidebar por inteiro. Marcar AC1 inteira esconderia uma tela que a
plataforma tem e o usuário não encontra.

## 7. Comandos de verificação (a régua, não alterada)

```
pnpm --filter @eximia/web test tests/epic-23-docs-vs-code.test.ts    → 13 failed | 12 passed (25)
pnpm --filter @eximia/web test tests/epic-6-security-posture-doc.test.ts →  2 failed | 14 passed (16)
pnpm --filter @eximia/web test tests/epic9-docs-vs-realidade.test.ts →            18 passed (18)
pnpm --filter @eximia/web test src/lib/__tests__/rate-limit.test.ts  →             3 passed (3)
pnpm --filter @eximia/web test tests/epic-8-auth-surface-drift.test.ts →          14 passed (14)

git diff --name-only | grep -v '^docs/' | grep -v 'rate-limit.test.ts'   → vazio
```

`docs/gauntlet/autogestao-jornada/GABARITO.json` aparece como modificado no `git status`: é
alteração **pré-existente**, anterior a esta run, não tocada aqui.
