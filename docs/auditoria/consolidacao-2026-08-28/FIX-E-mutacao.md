# FIX-E — Saneamento do harness de mutação

> O agente que executou este trabalho caiu por queda de conexão antes de escrever o relatório.
> O trabalho estava **concluído em disco**; este documento é o registro, escrito e **verificado
> por J.A.R.V.I.S.** com execução própria do harness. Onde o texto abaixo afirma um número, ele
> foi medido nesta verificação, não herdado do agente.

## 1. Mutantes órfãos C1-C4 — removidos

O FIX-A apagou 4 constantes mortas de `classificador/limiares.ts`
(`AMOSTRA_MIN_APRENDIZES`, `AMOSTRA_MIN_EVIDENCIAS`, `TENDENCIA_MIN_PERIODOS`,
`MIN_EVIDENCIAS_EMERGENTE`). Os mutantes C1-C4 miravam exatamente essas constantes — **o mutante
morreu junto com o alvo**. Mantidos, produziriam 4 × `INVALIDO`: ruído que parece defeito do
harness e não é.

Foram removidos, e o bloco de comentário que ficou no lugar declara: o que eram, por que sumiram,
e **por que não devem ser recriados**. Registrar a ausência é o que impede alguém de "consertar"
o buraco daqui a três meses.

**A cobertura não diminuiu**, e isto foi verificado: C5, C6 e C7 mutam as **mesmas** constantes na
casa viva (`aprendizagem-time/base.ts:97-99`, todas as três confirmadas presentes). O que sumiu foi
a sombra, não a régua.

## 2. Os 7 mutantes do Eixo A — catalogados, e o placar é perfeito

Eram a lacuna mais grave do harness: os filtros de tenant e de aluno, no caminho onde o cliente é
service role e RLS não se aplica — a única fronteira entre clientes pagantes.

Execução própria (`node scripts/mutacao.mjs --somente=A1…A7`):

| Mutante | Veredito | Testes que acusam |
|:---|:---|---:|
| `A1:sessions-tenant` | **ACUSA** | 3 |
| `A2:sessions-student` | **ACUSA** | 3 |
| `A3:slide_reflections-tenant` | **ACUSA** | 2 |
| `A4:chapters-tenant` | **ACUSA** | 3 |
| `A5:capabilities-tenant` | **ACUSA** | 3 |
| `A6:capability_assessments-tenant` | **ACUSA** | 2 |
| `A7:users-tenant` | **ACUSA** | 3 |

```
===== SILENCIOSOS (achado: morto ou não coberto — diga qual) =====
nenhum

restauração conferida por sha256: ok, todos idênticos ao início
```

**7 de 7 acusam. Zero silenciosos.** Em 28/08 esses mesmos 7 filtros podiam ser deletados um a um
com a suíte 235/235 verde. O ciclo fechou: o defeito foi encontrado por mutação, corrigido com
guarda, e a guarda entrou no harness permanente — a próxima remoção acidental acusa sozinha.

Note que os testes que acusam não são só o do filtro específico: o **fecho** ("o retorno é
exatamente o do meu tenant, nas quatro consultas") e o **espelho** ("lendo como o outro cliente,
só as linhas dele voltam") disparam junto. São testes que pinam a *intenção* de não vazar, não a
chamada de `.eq` — por isso pegam qualquer forma de perder o isolamento, não só a que foi mutada.

## 3. Pendência: o conjunto default

**Não resolvida** — o agente caiu antes. Os mutantes novos continuam fora de `ROTULOS_PADRAO`
(os 31 primeiros), então só rodam com `--somente=` ou `--tudo`.

O risco está nomeado e é real: régua que não roda sozinha é candidata a virar decoração, que é
exatamente o destino dos gabaritos do gauntlet — existem, funcionam, e nenhum gate automático os
executa. O custo do outro lado também é real: `--tudo` leva cerca de 8 minutos.

O harness já tem o mecanismo para resolver isso sem escolher entre os dois extremos: a derivação
de suíte por mutante (`SUITE_DO_ARQUIVO`) permite conjuntos nomeados. **Fica como trabalho aberto**,
com a recomendação de um conjunto por frente em vez de tudo-ou-nada.

## 4. Estado do arquivo

`node --check scripts/mutacao.mjs` → válido. Restauração conferida por `sha256` ao fim de cada
mutação; nenhuma sobreviveu no disco.
