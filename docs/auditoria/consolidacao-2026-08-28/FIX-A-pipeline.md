# FIX-A — Falha silenciosa na frente "Aprendizagem do Time"

> Executado em 2026-08-28/29, branch `integra/main-cory`, sobre `d2b8083`.
> Escopo: `apps/web/src/lib/analytics/aprendizagem-time/**` e
> `apps/web/src/app/api/analytics/aprendizagem-time/**`. Nada fora disso foi tocado.
> Nenhuma escrita no banco, nenhum commit, nenhum push.

## Resumo

As 6 correções estão feitas. **5 delas nasceram de um teste vermelho colado abaixo**, com a
saída literal da execução ANTES da correção. A sexta (constantes mortas) era, por instrução,
"apagar, não testar" — e está provada por busca de consumidor, não por teste.

Uma ressalva honesta está registrada no item 3: a frase do laudo ("`blocoErro` nunca executa
em teste") descreve uma **lacuna de cobertura**, não um defeito de código — e a distinção
está explicada lá, com a evidência de por que o caminho por-bloco já estava correto e qual é
o defeito real, adjacente, que consegui deixar vermelho.

| # | Correção | Vermelho antes? | Arquivo |
|---|---|---|---|
| 1 | `processadas` conta gravações; rota com 3 desfechos | SIM | `classificador/index.ts`, `classify/route.ts` |
| 2 | Estado da tela olha TODAS as fontes, num só lugar | SIM | `estado-tela.ts` (novo) + as 3 montagens |
| 3 | Saída antecipada não engole a falha de leitura | SIM (ver ressalva) | `montagem*.ts` |
| 4 | A-5/A-6: falha de leitura aborta, não degrada | SIM | `classificador/fontes-evidencia.ts` |
| 5 | `reavaliarCapacidade` para quando não sabe a linha vigente | SIM | `classificador/index.ts` |
| 6 | 4 constantes mortas apagadas | n/a (por instrução) | `classificador/limiares.ts` |

---

## Comandos de verificação (estado final)

```
$ pnpm --filter @eximia/web test src/lib/analytics/aprendizagem-time src/app/api/analytics/aprendizagem-time --run
 Test Files  18 passed (18)
      Tests  75 passed (75)

$ pnpm --filter @eximia/web test src/lib/analytics --run          # sem regressão
 Test Files  147 passed (147)
      Tests  1059 passed (1059)

$ pnpm --filter @eximia/web test src/components/analytics "src/app/(platform)/analytics" --run
 Test Files  28 passed (28)
      Tests  461 passed | 3 skipped (464)

$ pnpm --filter @eximia/web typecheck
(0 erros)

$ npx biome check apps/web/src/lib/analytics/aprendizagem-time apps/web/src/app/api/analytics/aprendizagem-time
Checked 61 files in 12ms. No fixes applied.

$ grep -rn "MIN_EVIDENCIAS_EMERGENTE" apps/web/src
(nenhum consumidor — só a nota de remoção no cabeçalho de limiares.ts)

$ git status --short -- apps/web/src/lib/analytics/aprendizagem-time apps/web/src/app/api/analytics/aprendizagem-time
(7 modificados + 5 novos, todos dentro da área)
```

---

## Item 1 · `processadas` contava candidatos, não gravações (C-3)

**O defeito.** `classificador/index.ts` devolvia `processadas: pendentes.length` — o número de
candidatos que entraram no laço. Com 100% dos `upsert` falhando, o `continue` engolia cada
erro e o retorno dizia 20 sobre um banco intocado. A rota transformava isso em
`200 {"ok":true,"processed":20}`. Qualquer monitor lia "o pipeline está vivo".

### Teste vermelho ANTES da correção

```
$ pnpm --filter @eximia/web test src/lib/analytics/aprendizagem-time/classificador/__tests__/pipeline-conta-o-que-gravou.test.ts --run

 ❯ pipeline-conta-o-que-gravou.test.ts (8 tests | 8 failed) 9ms
   × [CP] caminho feliz — 3 pendentes viram 3 gravações e 3 processadas
     → expected undefined to be 3 // Object.is equality
   × C-3 — com 100% dos upserts falhando, `processadas` é 0, não o número de candidatos
     → expected 3 to be +0 // Object.is equality
   × C-3 — sucesso parcial se declara: 3 tentativas, 3 gravadas, 0 falhas é diferente de 3/0/3
     → expected [ undefined, 3, undefined ] to deeply equal [ 3, 3, +0 ]
```

O vermelho que carrega o defeito é o segundo: `expected 3 to be +0`. O duplo registrou
**zero** linhas em `capability_evidence`, e a função devolveu **3**.

E o lado HTTP:

```
$ pnpm --filter @eximia/web test src/app/api/analytics/aprendizagem-time --run

 ❯ classify-nunca-diz-ok-sem-gravar.test.ts (5 tests | 5 failed) 75ms
   × C-3 — tentou 20 e gravou 0: NUNCA ok:true, e o status é 500
     → expected true to be false // Object.is equality
   × C-3 — sucesso parcial se declara como parcial, não como ok
     → expected true to be false // Object.is equality
   × A-5 — falha de LEITURA não vira 200 'nada a fazer'
     → expected 200 to be 500 // Object.is equality
```

### O que mudou

`ResultadoProcessamento` passou a descrever o EFEITO, não a intenção: `processadas` (gravadas),
`tentativas`, `falhasDeGravacao`, `falhaLeitura`. A rota decide entre três desfechos:

| Situação | HTTP | `ok` | `status` |
|---|---|---|---|
| Gravou tudo o que tentou (inclusive "nada a fazer") | 200 | `true` | `"ok"` |
| Gravou parte | 200 | `false` | `"parcial"` |
| Tentou e não gravou nada, **ou** falha de leitura | 500 | `false` | `"falha"` |

### Verde depois

```
 ✓ src/app/api/analytics/aprendizagem-time/__tests__/classify-nunca-diz-ok-sem-gravar.test.ts (5 tests)
 ✓ src/lib/analytics/aprendizagem-time/classificador/__tests__/pipeline-conta-o-que-gravou.test.ts (8 tests)
```

---

## Item 2 · O banner de erro olhava 1 de 3-4 fontes

**O defeito.** Nas três montagens, o mesmo julgamento triplicado:

```ts
const estado = falhas.capacidades ? "erro" : (blocos.every(vazio) ? "vazio" : "ok")
```

`falhas.avaliacoes`, `falhas.evidencias`, `falhas.alunos` e `falhas.conceitos` eram calculadas
só para o campo `erro` — que as telas não consultam: elas decidem o banner por
`data.estado === "erro"` e nada mais (`visao-geral-tab.tsx:378`, `padroes-tab.tsx:295`,
`mapa-tab.tsx:374`). Uma falha de leitura chegava ao gestor como tela normal.

### Teste vermelho ANTES da correção

```
$ pnpm --filter @eximia/web test src/lib/analytics/aprendizagem-time/__tests__/a-tela-diz-que-falhou.test.ts --run

 ❯ a-tela-diz-que-falhou.test.ts (14 tests | 7 failed) 8ms
   ✓ [CP] sem falha nenhuma, a Tela 1 é 'ok' e não carrega erro
   ✓ [CP] vazio genuíno (sem capacidade cadastrada) continua 'vazio', não vira erro
   × Tela 1 — falha ao ler `avaliacoes` é ERRO, não 'amostra insuficiente'
     → expected 'ok' to be 'erro' // Object.is equality
   × Tela 1 — falha ao ler `evidencias` é ERRO
     → expected 'ok' to be 'erro' // Object.is equality
   ✓ [CP] Tela 1 — falha em `capacidades` continua sendo erro (não regrediu)
   × Tela 3 — falha ao ler `alunos` (roster) é ERRO, não matriz vazia
     → expected 'ok' to be 'erro' // Object.is equality
   × Tela 3 — falha ao ler `avaliacoes` é ERRO
     → expected 'ok' to be 'erro' // Object.is equality
   ✓ [CP] Tela 3 — sem falha é 'ok'
   × Tela 2 — falha ao ler `conceitos` é ERRO, não 'sem módulos'
     → expected 'ok' to be 'erro' // Object.is equality
   × Tela 2 — falha ao ler `evidencias` é ERRO
     → expected 'ok' to be 'erro' // Object.is equality
   ✓ [CP] Tela 2 — sem falha é 'ok'
   × item 3 — curso sem capacidades E falha em `evidencias`: a falha não pode ser engolida
     → expected null to deeply equal { codigo: '57014', …(1) }
   ✓ [blocoErro] bloco em erro não carrega texto de amostra insuficiente nem motivoVazio
   ✓ [CP][blocoErro] amostra pequena SEM falha continua vazio com o texto da §7
```

Sete vermelhos e sete verdes na mesma execução: os verdes são os controles positivos, que
existem para que a correção degenerada ("responde erro sempre") não passasse.

### O que mudou

Novo `estado-tela.ts` com `decidirEstadoDaTela(falhas, fontes, blocos)` e o conjunto de fontes
de cada tela declarado ao lado (`FONTES_DA_VISAO_GERAL`, `FONTES_DE_PADROES`, `FONTES_DO_MAPA`).
As três montagens passaram a chamá-la. **A decisão agora tem uma casa só** — três cópias do
mesmo julgamento é como o defeito nasceu e como ele sobreviveria a uma correção parcial.

---

## Item 3 · `blocoErro` nunca executava em teste — e a ressalva honesta

**O que o laudo diz.** "Um gestor lê 'Amostra ainda insuficiente' quando o que houve foi falha
de infraestrutura."

**O que encontrei ao tentar deixar isso vermelho.** Auditei os **20 blocos** e a fonte que cada
um consulta:

```
$ for f in placar.ts atencao.ts mudancas.ts ... ; do grep -n "primeiraFalha(falhas" $f; done
placar.ts:35:              ["capacidades", "evidencias"]                        ← consome evidências
atencao.ts:18:             ["capacidades", "avaliacoes", "evidencias"]
capacidades-evolucao.ts:34: ["capacidades", "avaliacoes"]                       ← consome avaliações
capacidades-do-time.ts:28:  ["capacidades", "avaliacoes", "alunos"]
onde-trava.ts:48:          ["capacidades", "evidencias", "conceitos"]
... (20 blocos)
```

Cada bloco consulta **exatamente** as fontes que consome, e devolve `blocoErro` corretamente.
Nenhum bloco devolve `TEXTO_AMOSTRA_INSUFICIENTE` sob uma falha que ele não checa. Um teste
que afirmasse o contrário nasceria **verde**, e verde-de-partida não prova nada.

**A conclusão honesta:** por-bloco, isto é lacuna de cobertura, não defeito. O sintoma descrito
pelo laudo é real, mas nasce **uma camada acima** — no estado da tela (item 2), que deixava o
banner sumir. Registro isso em vez de fabricar um vermelho.

**O defeito adjacente que CONSEGUI deixar vermelho** mora no mesmo par de arquivos: a saída
antecipada das três montagens (`if (capacidades.length === 0 && !falhas.capacidades)`) devolvia
`estado: "vazio", erro: null` mesmo com `evidencias`/`avaliacoes` em falha. O gestor lia uma
explicação de **produto** ("este curso ainda não tem capacidades definidas") para uma causa de
**infraestrutura**. Vermelho colado acima:

```
   × item 3 — curso sem capacidades E falha em `evidencias`: a falha não pode ser engolida
     → expected null to deeply equal { codigo: '57014', …(1) }
```

Corrigido nas três telas: a saída antecipada agora exige `!primeiraFalha(falhas, FONTES_DA_TELA)`.

Os dois casos `[blocoErro]` do arquivo passaram desde o início — são a **cobertura que faltava**,
e estão marcados como tal: pinam que um bloco em erro nunca carrega `motivoVazio` nem
`textoVazio`, para que a próxima mão não confunda os dois estados.

---

## Item 4 · A-5 e A-6, e os 6 sítios irmãos (`fontes-evidencia.ts`)

**O defeito.** Toda leitura que falhava caía em `return []`/`break`. `[]` é byte a byte o valor
de "esta fonte genuinamente não tem nada". Dois deles (`chapter_slides:242`, `quiz_sessions:418`)
nem `console.error` tinham: `if (erro || !linhas || linhas.length === 0) return` tratava erro e
vazio no mesmo `return` mudo.

- **A-5:** falha em `capabilities` → `[]` → `processarPendencias` responde zeros → indistinguível
  de "está tudo classificado, nada a fazer".
- **A-6:** falha na varredura de já-classificados → `Set` vazio → **todo o acervo volta a ser
  pendente**, pagando LLM de novo, com o teto de 20 por chamada limitando a rajada, não o total.

### Teste vermelho ANTES da correção

```
   × A-5 — falha ao ler `capabilities` não vira 'nada pendente'
     → the given combination of arguments (undefined and string) is invalid for this assertion.
       (r.falhaLeitura era `undefined` — o campo não existia: não havia como distinguir)

   × A-6 — falha ao varrer já-classificados aborta a rodada, não reclassifica o acervo
     → expected [ { …(3) }, { …(3) }, { …(3) } ] to have a length of +0 but got 3
```

O de A-6 é o mais eloquente: **3 evidências já classificadas foram reclassificadas e regravadas**
porque a varredura falhou. É o moinho, medido.

### O que mudou

Regra única, sem exceção: **`[]` significa exclusivamente "não há linha"; falha de leitura vira
um valor (`FalhaLeitura`) que sobe até quem decide, e aborta a rodada.**

- `carregarCapacidadesAtivas` → `{ capacidades, falha }` (inclui a leitura de `capability_criteria`,
  que antes só logava)
- `carregarChavesJaClassificadas` → `{ chaves, falha }`
- os **5 coletores** → `Promise<FalhaLeitura | null>`, e cada um dos 8 sítios de leitura agora
  separa erro de vazio, com log
- `buscarEvidenciasPendentes` → `{ pendentes, falha }`, abortando no primeiro erro
- `carregarCriteriosPorCapacidade` → `{ criterios, falha }`

**Controle positivo que impede a correção degenerada:** `[CP] varredura saudável não reclassifica
o que já foi classificado` — se o remédio virasse "aborta sempre", este caso cairia.

---

## Item 5 · `reavaliarCapacidade` descartava o erro sem sequer logar

**O defeito.** `index.ts:147` fazia `const { data: atual } = await db.from("capability_assessments")…`
— o `error` **não era destructurado**. Num timeout, `atual` fica indefinido, o código conclui
"aluno nunca avaliado antes", pula o flip de `is_current = false` e **insere uma segunda linha
`is_current: true`** para o mesmo par aluno×capacidade. Não é ruído de UI: é corrupção do estado
"corrente", que só o índice único da tabela poderia barrar — e os dois índices divergem entre
migrations (M-6 do laudo).

### Teste vermelho ANTES da correção

```
   × item 5 — falha ao ler `capability_assessments` não grava uma segunda linha corrente
     → expected [ { …(3) } ] to have a length of +0 but got 1
```

Uma gravação em `capability_assessments` aconteceu, sobre um par que já tinha linha corrente.

### O que mudou

O erro é destructurado, logado, e a função **retorna `false`**. Não saber qual é a linha vigente
é motivo para parar, nunca para gravar por cima. A asserção do teste vai além da escrita: conta
quantas linhas `is_current: true` restam para o par (deve ser exatamente 1).

---

## Item 6 · 4 constantes mortas apagadas

Removidas de `classificador/limiares.ts`: `AMOSTRA_MIN_APRENDIZES`, `AMOSTRA_MIN_EVIDENCIAS`,
`TENDENCIA_MIN_PERIODOS` (duplicatas literais das vivas em `../base.ts`) e
`MIN_EVIDENCIAS_EMERGENTE` (zero consumidores).

**Busca de consumidor, antes de remover cada uma:**

```
$ grep -rn "AMOSTRA_MIN_APRENDIZES\|AMOSTRA_MIN_EVIDENCIAS\|TENDENCIA_MIN_PERIODOS\|MIN_EVIDENCIAS_EMERGENTE" apps/web/src apps/web/tests packages
base.ts:97,98,99          ← declaração (VIVA)
base.ts:102,107           ← consumo real: amostraSuficiente(), tendenciaDisponivel()
onde-trava.ts:14,64       ← consumo real de AMOSTRA_MIN_EVIDENCIAS
classificador/limiares.ts:21,24,27,42   ← as 4 mortas, nenhum consumo
```

Nenhum consumidor das 4. O `MIN_EVIDENCIAS_EMERGENTE` não aparece em nenhum outro arquivo de
`src`. Depois da remoção, `grep` volta vazio (só a nota no cabeçalho explicando o que saiu).

O cabeçalho do arquivo registra **por que** saíram: o risco não era hoje, era o próximo
engenheiro editar a cópia morta para mexer no piso da §7, ver a suíte verde e concluir que
mudou a régua.

---

## Achados fora da minha área — registrados, não tocados

1. **`scripts/mutacao.mjs:361-385`** — os mutantes **C1, C2, C3 e C4** têm como alvo literal as
   4 constantes que acabei de apagar (o próprio comentário no arquivo os documenta como
   "NÃO PEGAM e são MORTOS"). Com as constantes fora, esses 4 mutantes **não têm mais onde
   aplicar**. Isso é o desfecho correto — eles existiam para provar que o código era morto —
   mas alguém precisa removê-los do harness, ou o placar do Eixo C vai reportar 4 falhas de
   aplicação. O arquivo está em `scripts/`, fora da minha área, e já modificado por um colega:
   registrei e não toquei.

2. **`src/app/(platform)/jornada/__tests__/leitura-que-falha-nao-vira-ausencia.test.ts`** —
   durante a execução apresentou 4 erros de typecheck (`SaveJourneyInput`). Na verificação
   final o `typecheck` voltou com **0 erros**, ou seja, o colega dono do arquivo corrigiu no
   intervalo. Registro só para o caso de reaparecer.

## Arquivos

**Modificados (7):**
- `apps/web/src/app/api/analytics/aprendizagem-time/classify/route.ts`
- `apps/web/src/lib/analytics/aprendizagem-time/classificador/index.ts`
- `apps/web/src/lib/analytics/aprendizagem-time/classificador/fontes-evidencia.ts`
- `apps/web/src/lib/analytics/aprendizagem-time/classificador/limiares.ts`
- `apps/web/src/lib/analytics/aprendizagem-time/montagem.ts`
- `apps/web/src/lib/analytics/aprendizagem-time/montagem-mapa.ts`
- `apps/web/src/lib/analytics/aprendizagem-time/montagem-padroes.ts`

**Novos (5):**
- `apps/web/src/lib/analytics/aprendizagem-time/estado-tela.ts` — a decisão de estado, num só lugar
- `apps/web/src/lib/analytics/aprendizagem-time/__tests__/a-tela-diz-que-falhou.test.ts`
- `apps/web/src/lib/analytics/aprendizagem-time/classificador/__tests__/pipeline-conta-o-que-gravou.test.ts`
- `apps/web/src/lib/analytics/aprendizagem-time/classificador/__tests__/banco-que-falha.ts` — duplo
  de Supabase que sabe falhar e registra escritas; `banco-que-filtra.ts` nunca falha e não conhece
  escrita, e era por isso que o caminho de erro deste pipeline era inalcançável por teste
- `apps/web/src/app/api/analytics/aprendizagem-time/__tests__/classify-nunca-diz-ok-sem-gravar.test.ts`
